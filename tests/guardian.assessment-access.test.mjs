import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Actual Edge handlers; isolated Auth/database adapters. This does not test RLS.
const compiled = Object.fromEntries(await Promise.all(['assessment-item', 'assessment-submit', 'assessment-media-access'].map(async name => [name,
  ts.transpileModule((await readFile(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8')).replace(/^import .*\n/, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText,
])))

function fixture(endpoint) {
  const state = {
    profiles: [{ id: 'student', role: 'student', medical_year: 1 }],
    assessment_items: [{ id: 'item', assessment_type: 'case', year: 1, module_code: 'IAE-1', published: true, quality_status: 'ready', media_url: 'private:asset', title: 'PRIVATE STEM', content: { questions: [{ prompt: 'PRIVATE QUESTION', options: ['A', 'B'], answer: 0, explanation: 'PRIVATE ANSWER' }], key_points: ['PRIVATE KEY'] } }],
    module_entitlements: [{ user_id: 'student', module_code: 'IAE-1', academic_year: 1, product_type: 'cases', revoked_at: null, expires_at: '2099-01-01T00:00:00.000Z' }],
    lecture_settings: [{ lecture_id: 'free-lecture', access_mode: 'free' }],
    protected_media_assets: [{ asset_key: 'asset', mime_type: 'image/png', content: 'base64:dGVzdA==' }],
  }
  const writes = []
  let handler
  const client = {
    auth: { getUser: async token => ({ data: { user: ['valid', 'other-account'].includes(token) ? { id: token === 'valid' ? 'student' : 'other-student' } : null } }) },
    rpc: async () => ({ data: true }),
    from(table) {
      let rows = state[table] || []
      return {
        select() { return this },
        eq(key, value) { rows = rows.filter(row => row[key] === value); return this },
        is(key, value) { return this.eq(key, value) },
        gt(key, value) { rows = rows.filter(row => row[key] > value); return this },
        maybeSingle: async () => ({ data: rows.length === 1 ? rows[0] : null, error: rows.length > 1 ? { message: 'Multiple rows' } : null }),
        insert: async data => { writes.push({ table, data }); return { error: null } },
      }
    },
  }
  vm.runInNewContext(compiled[endpoint], {
    createClient: () => client, Request, Response, TextEncoder, btoa,
    Deno: { env: { get: () => 'test' }, serve: fn => { handler = fn } },
  })
  return { state, writes, request: (body = {}, token = 'valid') => handler(new Request('https://example.invalid/' + endpoint, {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ itemId: 'item', answers: { 0: 0 }, ...body }),
  })) }
}

for (const endpoint of Object.keys(compiled)) {
  for (const [name, mutate, token, status] of [
    ['guest', () => {}, null, 401],
    ['expired session', () => {}, 'expired', 401],
    ['non-subscriber', s => { s.module_entitlements = [] }, 'valid', 403],
    ['wrong profile year', s => { s.profiles[0].medical_year = 2 }, 'valid', 403],
    ['wrong entitlement year', s => { s.module_entitlements[0].academic_year = 2 }, 'valid', 403],
    ['another account entitlement', s => { s.module_entitlements[0].user_id = 'other-student' }, 'valid', 403],
    ['wrong module', s => { s.module_entitlements[0].module_code = 'MLS-1' }, 'valid', 403],
    ['wrong product', s => { s.module_entitlements[0].product_type = 'osce' }, 'valid', 403],
    ['revoked subscription', s => { s.module_entitlements[0].revoked_at = '2026-01-01' }, 'valid', 403],
    ['expired subscription', s => { s.module_entitlements[0].expires_at = '2000-01-01' }, 'valid', 403],
    ['unpublished content', s => { s.assessment_items[0].published = false }, 'valid', 404],
    ['not-ready content', s => { s.assessment_items[0].quality_status = 'draft' }, 'valid', 404],
    ['free lecture does not include a paid assessment', s => { s.assessment_items[0].lecture_id = 'free-lecture'; s.module_entitlements = [] }, 'valid', 403],
  ]) test(`${endpoint}: ${name} cannot get questions, answers or media`, async () => {
    const f = fixture(endpoint); mutate(f.state)
    const response = await f.request({ userId: 'student', medical_year: 1, academicYear: 1, role: 'admin', subscribed: true }, token)
    assert.equal(response.status, status)
    assert.doesNotMatch(await response.text(), /PRIVATE|dGVzdA==/)
    assert.equal(f.writes.length, 0)
  })
  test(`${endpoint}: correct-year subscriber succeeds`, async () => {
    const f = fixture(endpoint); const response = await f.request()
    assert.equal(response.status, 200)
    const data = await response.json()
    if (endpoint === 'assessment-item') {
      assert.equal(data.item.content.questions[0].prompt, 'PRIVATE QUESTION')
      assert.doesNotMatch(JSON.stringify(data), /PRIVATE ANSWER|PRIVATE KEY|"answer"/)
    } else if (endpoint === 'assessment-submit') {
      assert.equal(data.score, 1); assert.equal(f.writes[0].data.user_id, 'student')
    } else assert.equal(data.url, 'data:image/png;base64,dGVzdA==')
  })
  test(`${endpoint}: switching accounts rechecks access using the token`, async () => {
    const f = fixture(endpoint)
    f.state.profiles.push({ id: 'other-student', role: 'student', medical_year: 1 })
    assert.equal((await f.request()).status, 200)
    f.writes.length = 0
    const response = await f.request({ userId: 'student' }, 'other-account')
    assert.equal(response.status, 403); assert.doesNotMatch(await response.text(), /PRIVATE|dGVzdA==/)
    assert.equal(f.writes.length, 0)
  })
}
