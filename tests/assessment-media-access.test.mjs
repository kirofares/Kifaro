import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Execute the actual Edge entrypoint with an in-memory database adapter.
// No network, production tokens, purchases, or student data are used.
const source = await readFile(new URL('../supabase/functions/assessment-media-access/index.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source.replace(/^import .*\n/, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText
function fixture(overrides = {}) {
  const state = {
    user: { id: 'student' },
    profiles: [{ id: 'student', medical_year: 1, role: 'student' }],
    assessment_items: [{ id: 'item', year: 1, module_code: 'MLS-1', assessment_type: 'spotter',
      media_url: 'private:reviewed/one', published: true, quality_status: 'ready' }],
    module_entitlements: [{ user_id: 'student', academic_year: 1, module_code: 'MLS-1',
      product_type: 'osce', expires_at: '2027-04-22T12:00:00.000Z', revoked_at: null }],
    protected_media_assets: [{ asset_key: 'reviewed/one', mime_type: 'image/jpeg', content: 'base64:/9j/2Q==' }],
    ...overrides,
  }
  const reads = []
  let handler
  const client = {
    auth: { getUser: async token => ({ data: { user: token === 'valid' ? state.user : null }, error: null }) },
    rpc: async () => ({ data: true, error: null }),
    from(table) {
      reads.push(table)
      let rows = state[table] || []
      const query = {
        select() { return this },
        eq(key, value) { rows = rows.filter(row => row[key] === value); return this },
        is(key, value) { rows = rows.filter(row => row[key] === value); return this },
        gt(key, value) { rows = rows.filter(row => row[key] > value); return this },
        async maybeSingle() { return { data: rows.length === 1 ? rows[0] : null, error: null } },
      }
      return query
    },
  }
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-22T12:00:00.000Z'])) }
  }
  vm.runInNewContext(compiled, { createClient: () => client, Request, Response, TextEncoder,
    btoa, Date: FixedDate, Deno: { env: { get: () => 'test-only' }, serve: fn => { handler = fn } } })
  return { state, reads, request: (token = 'valid', body = { itemId: 'item' }) => handler(new Request('https://test.invalid', {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
  })) }
}

for (const [name, token] of [['unsigned visitor', null], ['invalid token', 'invalid']]) {
  test(`${name} cannot retrieve media`, async () => {
    const f = fixture(); const r = await f.request(token)
    assert.equal(r.status, 401); assert.equal(f.reads.length, 0)
    assert.equal((await r.json()).url, undefined)
  })
}
for (const [name, mutate] of [
  ['unpaid', s => { s.module_entitlements = [] }],
  ['wrong year', s => { s.profiles[0].medical_year = 2 }],
  ['missing profile', s => { s.profiles = [] }],
  ['wrong module', s => { s.module_entitlements[0].module_code = 'IAE-1' }],
  ['wrong entitlement year', s => { s.module_entitlements[0].academic_year = 2 }],
  ['MCQ-only purchase', s => { s.module_entitlements[0].product_type = 'mcq' }],
  ['another student purchase', s => { s.module_entitlements[0].user_id = 'other' }],
  ['expired six-month access', s => { s.module_entitlements[0].expires_at = '2026-10-21T12:00:00.000Z' }],
  ['exact expiry instant', s => { s.module_entitlements[0].expires_at = '2026-10-22T12:00:00.000Z' }],
  ['revoked', s => { s.module_entitlements[0].revoked_at = '2026-10-21T12:00:00.000Z' }],
]) test(`${name} is denied before reading asset bytes`, async () => {
  const f = fixture(); mutate(f.state); const r = await f.request()
  assert.equal(r.status, 403); assert.ok(!f.reads.includes('protected_media_assets'))
  assert.equal((await r.json()).url, undefined)
})

test('paid correct-year student receives no-store image through item-bound lookup', async () => {
  const f = fixture(); const r = await f.request('valid', { itemId: 'item', assetKey: 'other', media_url: 'private:other' })
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store')
  assert.equal((await r.json()).url, 'data:image/jpeg;base64,/9j/2Q==')
})
test('six-month entitlement works immediately before expiry', async () => {
  const f = fixture(); f.state.module_entitlements[0].expires_at = '2026-10-22T12:00:00.001Z'
  assert.equal((await f.request()).status, 200)
})
test('trusted database admin role retains access', async () => {
  const f = fixture(); f.state.profiles[0].role = 'admin'; f.state.module_entitlements = []
  assert.equal((await f.request()).status, 200)
})
for (const [name, mutate] of [
  ['unpublished', s => { s.assessment_items[0].published = false }],
  ['not ready', s => { s.assessment_items[0].quality_status = 'draft' }],
  ['unknown item', s => { s.assessment_items = [] }],
  ['public source', s => { s.assessment_items[0].media_url = '/assets/old.svg' }],
  ['missing asset', s => { s.protected_media_assets = [] }],
]) test(`${name} returns no image`, async () => {
  const f = fixture(); mutate(f.state); const r = await f.request()
  assert.equal(r.status, 404); assert.equal((await r.json()).url, undefined)
})
