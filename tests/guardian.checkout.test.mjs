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
  const storageReads = []
  const storage = { data: { size: 1024, contentType: 'application/pdf' }, error: null }
  const bunny = { status: 200, data: { status: 4, availableResolutions: '720p' }, throws: false }
  const reads = []
  let failTable = null
  let handler
  const client = {
    storage: { from: bucket => ({ info: async path => {
      storageReads.push({ bucket, path })
      return storage
    } }) },
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
  const env = { SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test', PAYMOB_SECRET_KEY: 'test-secret', PAYMOB_PUBLIC_KEY: 'test-public', PAYMOB_HMAC_SECRET: 'test-hmac', PAYMOB_INTEGRATION_ID_CARD: '1', BUNNY_STREAM_LIBRARY_ID: '1', BUNNY_STREAM_API_KEY: 'test-bunny', BUNNY_STREAM_TOKEN_AUTH_KEY: 'test-playback' }
  vm.runInNewContext(compiled, {
    createClient: () => client, Request, Response, TextEncoder, btoa, crypto: webcrypto, AbortSignal,
    Deno: { env: { get: key => env[key] }, serve: fn => { handler = fn } },
    fetch: async (url, options) => {
      if (url.startsWith('https://video.bunnycdn.com/')) {
        if (bunny.throws) throw new Error('simulated timeout')
        return new Response(JSON.stringify(bunny.data), { status: bunny.status })
      }
      providerCalls.push({ url, payload: JSON.parse(options.body) })
      return new Response(JSON.stringify({ client_secret: 'fake-secret', id: 'fake-intention' }), { status: 200 })
    },
  })
  return {
    state, reads, providerCalls, storageReads, storage, bunny, env, fail: table => { failTable = table },
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
test('checkout: storage-only video and PPTX cannot satisfy the current Bunny/PDF student players', async () => {
  const f = fixture(); f.state.lecture_assets = [{ lecture_id: 'lecture', video_path: 'private/test.mp4', pptx_path: 'private/test.pptx' }]
  for (const productType of ['video', 'datashow', 'bundle']) assert.equal((await f.request({ productType })).status, 409)
  assert.equal(f.providerCalls.length, 0)
})
test('checkout: active ownership still blocks duplicate purchase', async () => {
  const f = fixture(); f.state.lecture_entitlements = [{ user_id: 'student', lecture_id: 'lecture', video_access: true, datashow_access: true, revoked_at: null }]
  assert.equal((await f.request()).status, 409); assert.equal(f.providerCalls.length, 0)
})

test('checkout: PPTX-only datashow is rejected even alongside a ready Bunny video', async () => {
  const f = fixture(); delete f.state.lecture_assets[0].pdf_path
  f.state.lecture_assets[0].pptx_path = 'private/test.pptx'
  for (const productType of ['datashow', 'bundle']) assert.equal((await f.request({ productType })).status, 409)
  assert.equal(f.providerCalls.length, 0)
})
for (const [name, data, error, status] of [
  ['missing object', null, { status: 404, statusCode: '404' }, 409],
  ['Storage not-found code', null, { status: 400, code: 'NoSuchKey' }, 409],
  ['empty object', { size: 0 }, null, 409],
  ['unknown object size', {}, null, 503],
  ['storage outage', null, { status: 500 }, 503],
  ['storage permission error', null, { status: 403 }, 503],
]) test(`checkout: ${name} blocks datashow and bundle before Paymob`, async () => {
  const f = fixture(); Object.assign(f.storage, { data, error })
  for (const productType of ['datashow', 'bundle']) assert.equal((await f.request({ productType })).status, status)
  assert.equal(f.providerCalls.length, 0)
})
test('checkout: checks the same private PDF path used by student delivery', async () => {
  const f = fixture(); assert.equal((await f.request({ productType: 'datashow' })).status, 200)
  assert.deepEqual(f.storageReads, [{ bucket: 'kifaro-content', path: 'private/test.pdf' }])
})
for (const [name, change, status] of [
  ['deleted Bunny video', { status: 404 }, 409],
  ['Bunny outage', { status: 503 }, 503],
  ['Bunny permission error', { status: 401 }, 503],
  ['Bunny timeout', { throws: true }, 503],
  ['still processing remotely', { data: { status: 2, availableResolutions: '720p' } }, 409],
  ['failed remotely', { data: { status: 5, availableResolutions: '720p' } }, 409],
  ['missing renditions', { data: { status: 4, availableResolutions: '' } }, 409],
]) test(`checkout: ${name} overrides stale ready metadata`, async () => {
  const f = fixture(); Object.assign(f.bunny, change)
  for (const productType of ['video', 'bundle']) assert.equal((await f.request({ productType })).status, status)
  assert.equal(f.providerCalls.length, 0)
})
for (const key of ['BUNNY_STREAM_LIBRARY_ID', 'BUNNY_STREAM_API_KEY', 'BUNNY_STREAM_TOKEN_AUTH_KEY']) {
  test(`checkout: missing ${key} stops video payment`, async () => {
    const f = fixture(); delete f.env[key]
    assert.equal((await f.request({ productType: 'video' })).status, 503)
    assert.equal(f.providerCalls.length, 0)
    assert.equal((await f.request({ productType: 'datashow' })).status, 200)
  })
}
test('checkout: storage path cannot hide an unready Bunny player', async () => {
  const f = fixture(); f.state.lecture_assets[0].video_path = 'private/old.mp4'
  f.state.lecture_assets[0].bunny_status = 'processing'
  assert.equal((await f.request({ productType: 'video' })).status, 409)
  assert.equal(f.providerCalls.length, 0)
})
test('checkout: owning one format does not buy the same format again, but allows the other', async () => {
  const f = fixture(); f.state.lecture_entitlements = [{ user_id: 'student', lecture_id: 'lecture', video_access: true, datashow_access: false, revoked_at: null }]
  assert.equal((await f.request({ productType: 'video' })).status, 409)
  assert.equal(f.providerCalls.length, 0)
  assert.equal((await f.request({ productType: 'datashow' })).status, 200)
})
