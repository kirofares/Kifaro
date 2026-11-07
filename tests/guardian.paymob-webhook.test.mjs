import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { createHmac, webcrypto } from 'node:crypto'
import ts from 'typescript'

// Signed synthetic callbacks against the actual handler, with an in-memory DB.
// No Paymob request, real charge, real user, or live entitlement is involved.
const source = await readFile(new URL('../supabase/functions/paymob-webhook/index.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source.replace(/^import .*\n/, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText
const secret = 'local-test-only'
const sign = state => {
  const encoded = Buffer.from(JSON.stringify(state)).toString('base64url')
  return encoded + '.' + createHmac('sha256', secret).update(encoded).digest('base64url')
}
const hmac = obj => createHmac('sha512', secret).update([
  obj.amount_cents, obj.created_at, obj.currency, obj.error_occured,
  obj.has_parent_transaction, obj.id, obj.integration_id, obj.is_3d_secure,
  obj.is_auth, obj.is_capture, obj.is_refunded, obj.is_standalone_payment,
  obj.is_voided, obj.order?.id, obj.owner, obj.pending, obj.source_data?.pan,
  obj.source_data?.sub_type, obj.source_data?.type, obj.success,
].map(x => x == null ? '' : String(x)).join('')).digest('hex')

function fixture() {
  const db = { payment_transactions: [], lecture_entitlements: [] }
  const writes = []
  const rpcCalls = []
  let handler
  const client = {
    rpc: async (name, args) => { rpcCalls.push({ name, args }); return { error: null } },
    from(table) {
      let rows = db[table] || [], update
      return {
        select() { return this },
        eq(key, value) { rows = rows.filter(row => row[key] === value); return this },
        maybeSingle: async () => ({ data: rows[0] ?? null }),
        upsert: async (row, { onConflict }) => {
          writes.push({ table, row })
          const old = db[table].find(x => onConflict.split(',').every(k => x[k] === row[k]))
          if (old) Object.assign(old, row); else db[table].push({ ...row })
          return { error: null }
        },
        update(row) { update = row; return this },
        then(resolve, reject) {
          if (update) { rows.forEach(row => Object.assign(row, update)); writes.push({ table, update }) }
          return Promise.resolve({ error: null }).then(resolve, reject)
        },
      }
    },
  }
  const env = { SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test', PAYMOB_HMAC_SECRET: secret, PAYMOB_INTEGRATION_ID_CARD: '1', PAYMOB_INTEGRATION_ID_WALLET: '2' }
  vm.runInNewContext(compiled, { createClient: () => client, Request, Response, URL, TextEncoder, TextDecoder, btoa, atob, crypto: webcrypto, Deno: { env: { get: key => env[key] }, serve: fn => { handler = fn } } })
  return { db, writes, rpcCalls, request: async ({ state = {}, fields = {}, invalidHmac = false, invalidState = false } = {}) => {
    const payload = { v: 1, u: 'student-a', l: 'lecture', p: 'datashow', pm: 'card', a: 4000, y: 1, iat: Math.floor(Date.now() / 1000), ...state }
    const obj = { id: 1, created_at: '2026-10-27', amount_cents: 4000, currency: 'EGP', integration_id: 1, success: true, pending: false, order: { id: 10 }, is_refunded: false, is_voided: false, ...fields,
      payment_key_claims: { extra: { kifaro_state: invalidState ? 'forged.signature' : sign(payload) } } }
    return handler(new Request('https://example.invalid/webhook?hmac=' + (invalidHmac ? 'bad' : hmac(obj)), { method: 'POST', body: JSON.stringify({ type: 'TRANSACTION', obj }) }))
  } }
}

for (const pm of ['card', 'wallet']) test(`Paymob webhook: signed ${pm} purchase grants only the signed user and format`, async () => {
  const f = fixture(); const response = await f.request({ state: { pm }, fields: { integration_id: pm === 'card' ? 1 : 2, user_id: 'attacker', lecture_id: 'forged' } })
  assert.equal(response.status, 200)
  assert.equal(f.db.lecture_entitlements.length, 1)
  assert.equal(f.db.lecture_entitlements[0].user_id, 'student-a')
  assert.equal(f.db.lecture_entitlements[0].lecture_id, 'lecture')
  assert.equal(f.db.lecture_entitlements[0].video_access, false)
  assert.equal(f.db.lecture_entitlements[0].datashow_access, true)
})
for (const [name, input, status] of [
  ['invalid HMAC', { invalidHmac: true }, 401],
  ['forged state', { invalidState: true }, 400],
  ['wrong amount', { fields: { amount_cents: 1 } }, 400],
  ['wrong currency', { fields: { currency: 'USD' } }, 400],
  ['wrong card integration', { fields: { integration_id: 2 } }, 400],
  ['wrong wallet integration', { state: { pm: 'wallet' }, fields: { integration_id: 1 } }, 400],
]) test(`Paymob webhook: ${name} cannot write a payment or entitlement`, async () => {
  const f = fixture(); assert.equal((await f.request(input)).status, status)
  assert.equal(f.writes.length, 0)
})
for (const [name, fields] of [['declined', { success: false }], ['pending', { pending: true }], ['refunded', { is_refunded: true }], ['voided', { is_voided: true }]]) {
  test(`Paymob webhook: ${name} never grants access`, async () => {
    const f = fixture(); assert.equal((await f.request({ fields })).status, 200)
    assert.equal(f.db.lecture_entitlements.length, 0)
  })
}
test('Paymob webhook: duplicate success does not grant twice', async () => {
  const f = fixture(); assert.equal((await f.request()).status, 200)
  f.writes.length = 0
  const response = await f.request()
  assert.equal((await response.json()).idempotent, true)
  assert.equal(f.writes.length, 0)
})
