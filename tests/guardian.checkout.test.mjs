import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import ts from 'typescript'

// Run the actual Edge entrypoint. Database/Auth and Paymob are in-memory fakes;
// these are regression tests, not evidence of production RLS or payment success.
const source = await readFile(new URL('../supabase/functions/paymob-create-checkout/index.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source.replace(/^import .*\n/, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText

function fixture() {
  const state = {
    profiles: [{ id: 'student', role: 'student', medical_year: 1, phone_no: 'test-phone', nationality: 'Egyptian' }],
    lecture_settings: [{ lecture_id: 'lecture', published: true, access_mode: 'paid', price_egp: 40 }],
    lecture_module_map: [{ lecture_id: 'lecture', academic_year: 1 }],
    lecture_pricing_rules: [], lecture_entitlements: [],
    lecture_assets: [{ lecture_id: 'lecture', pdf_path: 'private/test.pdf', video_provider: 'bunny', bunny_video_id: 'test-video', bunny_status: 'ready' }],
  }
  const providerCalls = []
  const reads = []
  let failTable = null
  let handler
  const client = {
    auth: { getUser: async token => ({ data: { user: token === 'valid' ? { id: 'student' } : null }, error: null }) },
    rpc: async () => ({ data: true, error: null }),
    from(table) {
      reads.push(table)
      let rows = state[table] || []
      const result = single => failTable === table
        ? { data: null, error: { message: 'simulated database outage' } }
        : { data: single ? rows[0] ?? null : rows, error: null }
      return {
        select() { return this },
        eq(key, value) { rows = rows.filter(row => row[key] === value); return this },
        maybeSingle() { return Promise.resolve(result(true)) },
        then(resolve, reject) { return Promise.resolve(result(false)).then(resolve, reject) },
      }
    },
  }
  const env = { SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test', PAYMOB_SECRET_KEY: 'test-secret', PAYMOB_PUBLIC_KEY: 'test-public', PAYMOB_HMAC_SECRET: 'test-hmac', PAYMOB_INTEGRATION_ID_CARD: '1' }
  vm.runInNewContext(compiled, {
    createClient: () => client, Request, Response, TextEncoder, btoa, crypto: webcrypto,
    Deno: { env: { get: key => env[key] }, serve: fn => { handler = fn } },
    fetch: async (url, options) => {
      providerCalls.push({ url, payload: JSON.parse(options.body) })
      return new Response(JSON.stringify({ client_secret: 'fake-secret', id: 'fake-intention' }), { status: 200 })
    },
  })
  return {
    state, reads, providerCalls, fail: table => { failTable = table },
    request: (body = {}, token = 'valid') => handler(new Request('https://example.invalid/checkout', {
      method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ lectureId: 'lecture', productType: 'bundle', ...body }),
    })),
  }
}

for (const [name, token] of [['guest', null], ['invalid session', 'invalid']]) {
  test(`checkout: ${name} cannot reach provider`, async () => {
    const f = fixture(); assert.equal((await f.request({}, token)).status, 401)
    assert.equal(f.providerCalls.length, 0); assert.equal(f.reads.length, 0)
  })
}
test('checkout: wrong server year cannot be overridden in the request', async () => {
  const f = fixture(); f.state.profiles[0].medical_year = 2
  assert.equal((await f.request({ academicYear: 1, medical_year: 1, role: 'admin' })).status, 403)
  assert.equal(f.providerCalls.length, 0)
})
for (const [name, mutate, status] of [
  ['free first lecture', s => { s.lecture_settings[0].access_mode = 'free' }, 409],
  ['unpublished lecture', s => { s.lecture_settings[0].published = false }, 404],
  ['missing lecture', s => { s.lecture_settings = [] }, 404],
  ['missing server profile', s => { s.profiles = [] }, 400],
]) test(`checkout: ${name} never creates a payment`, async () => {
  const f = fixture(); mutate(f.state)
  assert.equal((await f.request()).status, status); assert.equal(f.providerCalls.length, 0)
})
for (const productType of ['video', 'datashow', 'bundle']) {
  test(`checkout: missing metadata rejects ${productType} despite client readiness`, async () => {
    const f = fixture(); f.state.lecture_assets = []
    assert.equal((await f.request({ productType, has_video: true, has_datashow: true, pdf_path: 'forged' })).status, 409)
    assert.equal(f.providerCalls.length, 0)
  })
  test(`checkout: asset database error fails closed for ${productType}`, async () => {
    const f = fixture(); f.fail('lecture_assets')
    assert.equal((await f.request({ productType })).status, 503)
    assert.equal(f.providerCalls.length, 0)
  })
}
for (const bunny_status of ['uploading', 'processing', 'failed', 'missing', null]) {
  test(`checkout: Bunny ${bunny_status} does not sell video or bundle`, async () => {
    const f = fixture(); f.state.lecture_assets[0].bunny_status = bunny_status
    for (const productType of ['video', 'bundle']) assert.equal((await f.request({ productType })).status, 409)
    assert.equal(f.providerCalls.length, 0)
    assert.equal((await f.request({ productType: 'datashow' })).status, 200)
  })
}
test('checkout: document-only lecture sells datashow but not video or bundle', async () => {
  const f = fixture(); f.state.lecture_assets = [{ lecture_id: 'lecture', pdf_path: 'private/test.pdf' }]
  assert.equal((await f.request({ productType: 'video' })).status, 409)
  assert.equal((await f.request()).status, 409)
  assert.equal(f.providerCalls.length, 0)
  assert.equal((await f.request({ productType: 'datashow' })).status, 200)
})
test('checkout: video-only lecture cannot sell datashow or bundle', async () => {
  const f = fixture(); delete f.state.lecture_assets[0].pdf_path
  assert.equal((await f.request({ productType: 'datashow' })).status, 409)
  assert.equal((await f.request()).status, 409)
  assert.equal(f.providerCalls.length, 0)
  assert.equal((await f.request({ productType: 'video' })).status, 200)
})
test('checkout: blank paths and legacy public URLs cannot claim protected readiness', async () => {
  const f = fixture(); f.state.lecture_assets = [{ lecture_id: 'lecture', pdf_path: '  ', pptx_path: '', video_path: '\t', video_url: 'https://legacy.invalid/video', pdf_url: 'https://legacy.invalid/pdf' }]
  for (const productType of ['video', 'datashow', 'bundle']) assert.equal((await f.request({ productType })).status, 409)
  assert.equal(f.providerCalls.length, 0)
})
test('checkout: correct-year ready bundle uses server price and signed server year', async () => {
  const f = fixture(); const r = await f.request({ amount: 1, amountEgp: 1, medical_year: 6 })
  assert.equal(r.status, 200); assert.equal((await r.json()).amountEgp, 80)
  assert.equal(f.providerCalls.length, 1); assert.equal(f.providerCalls[0].payload.amount, 8000)
  const encoded = f.providerCalls[0].payload.extras.kifaro_state.split('.')[0]
  const signedState = JSON.parse(Buffer.from(encoded, 'base64url').toString())
  assert.equal(signedState.y, 1); assert.equal(signedState.a, 8000)
  assert.equal(signedState.u, 'student'); assert.equal(signedState.l, 'lecture')
})
test('checkout: protected storage video and PPTX references remain supported', async () => {
  const f = fixture(); f.state.lecture_assets = [{ lecture_id: 'lecture', video_path: 'private/test.mp4', pptx_path: 'private/test.pptx' }]
  assert.equal((await f.request()).status, 200)
})
test('checkout: active ownership still blocks duplicate purchase', async () => {
  const f = fixture(); f.state.lecture_entitlements = [{ user_id: 'student', lecture_id: 'lecture', video_access: true, datashow_access: true, revoked_at: null }]
  assert.equal((await f.request()).status, 409); assert.equal(f.providerCalls.length, 0)
})
