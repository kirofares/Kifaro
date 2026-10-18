import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../src/auth/emailRequestGate.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
const { EmailRequestGate, emailRateLimit, authFailure } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const timed = { status: 429, code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 47 seconds.' }
const generic = { status: 429, code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }

test('preserves SDK error code and status', () => {
  assert.deepEqual(authFailure(timed), timed)
  assert.equal(authFailure(null).message, 'Unexpected authentication error.')
})
test('only recognized server duration produces a timer', () => {
  assert.deepEqual(emailRateLimit(timed), { limited: true, seconds: 47 })
  for (const message of ['email rate limit exceeded', 'try in 60 minutes', 'request 123 failed', 'you can only request this after 0 seconds']) {
    assert.equal(emailRateLimit({ ...generic, message }).seconds, undefined)
  }
  assert.equal(emailRateLimit({ ...timed, status: 400, code: 'invalid_credentials' }).limited, false)
})
test('timed rejection uses wall clock and normalized address, no early retry', () => {
  const gate = new EmailRequestGate()
  assert.equal(gate.begin(' USER@example.com ', 'signup', 0), true)
  gate.finish(' USER@example.com ', 'signup', timed, 0)
  assert.equal(gate.state('user@example.com', 1).seconds, 47)
  assert.equal(gate.begin('user@example.com', 'recovery', 46_999), false)
  assert.equal(gate.begin('user@example.com', 'recovery', 47_000), true)
})
test('success suppresses repeated signup beyond countdown, recovery can retry after default window', () => {
  const signup = new EmailRequestGate()
  signup.begin('a@example.com', 'signup', 0)
  signup.finish('a@example.com', 'signup', undefined, 0)
  assert.equal(signup.state('a@example.com', 0).seconds, 60)
  assert.equal(signup.begin('a@example.com', 'signup', 60_000), false)
  assert.equal(signup.begin('b@example.com', 'signup', 60_000), true)
  const recovery = new EmailRequestGate()
  recovery.begin('a@example.com', 'recovery', 0)
  recovery.finish('a@example.com', 'recovery', undefined, 0)
  assert.equal(recovery.begin('a@example.com', 'recovery', 59_999), false)
  assert.equal(recovery.begin('a@example.com', 'recovery', 60_000), true)
})
test('generic quota is untimed, survives email/mode changes and needs manual retry', () => {
  const gate = new EmailRequestGate()
  gate.begin('a@example.com', 'signup', 0)
  gate.finish('a@example.com', 'signup', generic, 0)
  assert.equal(gate.state('b@example.com', 1e9).seconds, 0)
  assert.equal(gate.begin('b@example.com', 'recovery', 1e9), false)
  gate.allowManualRetry()
  assert.equal(gate.begin('a@example.com', 'recovery', 1e9), true)
})
test('in-flight guard blocks duplicates synchronously; non-rate failures release it', () => {
  const gate = new EmailRequestGate()
  assert.equal(gate.begin('a@example.com', 'recovery'), true)
  assert.equal(gate.begin('b@example.com', 'signup'), false)
  gate.finish('a@example.com', 'recovery', { message: 'Network error' })
  assert.equal(gate.begin('a@example.com', 'recovery'), true)
})

// Exercise the actual component handlers with isolated hook/JSX adapters.
// No Supabase client, DOM, account, email or network is involved.
async function pageHarness({ signup = async () => ({ needsEmailConfirmation: true }), recover = async () => ({ error: null }), signin = async () => ({}) } = {}) {
  const hooks = []
  let cursor = 0
  let tick
  let cleaned = false
  const exports = {}
  const jsx = (type, props) => ({ type, props })
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in hooks)) hooks[i] = initial
      return [hooks[i], (value) => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value }]
    },
    useRef(initial) { const i = cursor++; return hooks[i] ??= { current: initial } },
    useEffect(effect) { const i = cursor++; if (!(i in hooks)) hooks[i] = effect() },
  }
  const modules = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'react-router-dom': { Link: 'link', Navigate: 'navigate', useNavigate: () => () => {} },
    'lucide-react': {},
    '../lib/supabase': { supabase: { auth: { resetPasswordForEmail: recover } } },
    './AuthContext': { useAuth: () => ({ configured: true, user: null, signIn: signin, signUp: signup }) },
    '../data/academicOptions': { ACADEMIC_LEVELS: [], EGYPTIAN_UNIVERSITIES: {}, FACULTIES: [], LEARNING_DEPTHS: [] },
    '../i18n': { useTr: () => (en) => en },
    './emailRequestGate': { EmailRequestGate, emailRateLimit, authFailure },
  }
  const page = await readFile(new URL('../src/auth/AuthPage.tsx', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(page, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(compiled, { exports, require: (name) => { assert.ok(name in modules, name); return modules[name] }, window: { location: { origin: 'https://example.invalid', pathname: '/' }, setInterval: (fn) => { tick = fn; return 1 }, clearInterval: () => { cleaned = true } } })
  const render = () => { cursor = 0; return exports.default() }
  function all(node) { if (!node || typeof node !== 'object') return []; return [node, ...[node.props?.children].flat(Infinity).flatMap(all)] }
  const find = (predicate) => all(render()).find(predicate)
  return {
    find, render, tick: () => tick(),
    email: (value) => find((n) => n.type === 'input' && n.props.type === 'email').props.onChange({ target: { value } }),
    signupMode: () => find((n) => n.type === 'button' && n.props.children === 'Create account').props.onClick(),
    accept: () => find((n) => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } }),
    submit: () => find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} }),
    recover: () => find((n) => n.type === 'button' && n.props.children === 'Forgot password?').props.onClick(),
    text: () => JSON.stringify(render()),
    cleanup: () => { hooks.forEach((value) => { if (typeof value === 'function') value() }); assert.equal(cleaned, true) },
  }
}

test('component signup duplicate events, success state, mode/email lifecycle and timer cleanup', async () => {
  let calls = 0
  let finish
  const h = await pageHarness({ signup: () => { calls++; return new Promise((resolve) => { finish = resolve }) } })
  h.signupMode(); h.email('a@example.com'); h.accept()
  const first = h.submit(); await h.submit()
  assert.equal(calls, 1)
  assert.equal(h.find((n) => n.type === 'input' && n.props.type === 'email').props.disabled, true)
  finish({ needsEmailConfirmation: true }); await first
  assert.match(h.text(), /No need to create the account again/)
  assert.equal(h.find((n) => n.props?.className === 'primary authsubmit').props.disabled, true)
  h.find((n) => n.type === 'button' && n.props.children === 'Log in').props.onClick()
  assert.equal(h.find((n) => n.props?.className === 'primary authsubmit').props.disabled, false)
  h.signupMode(); assert.match(h.text(), /No need to create the account again/)
  h.email('b@example.com'); assert.equal(h.find((n) => n.props?.className === 'primary authsubmit').props.disabled, false)
  h.email('a@example.com'); assert.equal(h.find((n) => n.props?.className === 'primary authsubmit').props.disabled, true)
  h.tick(); h.cleanup()
})

test('component signup displays server countdown and generic quota without false time', async () => {
  for (const failure of [timed, generic]) {
    const h = await pageHarness({ signup: async () => ({ error: failure.message, authError: failure }) })
    h.signupMode(); h.email('a@example.com'); h.accept(); await h.submit()
    assert.equal(h.find((n) => n.props?.className === 'primary authsubmit').props.disabled, true)
    if (failure === timed) assert.match(h.text(), /Wait 47 seconds/)
    else { assert.match(h.text(), /did not provide a retry time/); assert.doesNotMatch(h.text(), /Wait 60 seconds/) }
    h.cleanup()
  }
})

test('component recovery uses shared handler for success, timed/generic 429 and thrown network error', async () => {
  for (const failure of [null, timed, generic, new Error('offline')]) {
    let calls = 0
    const h = await pageHarness({ recover: async () => { calls++; if (failure instanceof Error) throw failure; return { error: failure } } })
    h.email('a@example.com'); h.recover(); h.recover()
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(calls, 1)
    const button = h.find((n) => n.type === 'button' && n.props.children === 'Forgot password?')
    assert.equal(button.props.disabled, !(failure instanceof Error))
    if (!failure) assert.match(h.text(), /If this email has an account/)
    if (failure === timed) assert.match(h.text(), /Wait 47 seconds/)
    if (failure === generic) assert.match(h.text(), /did not provide a retry time/)
    if (failure instanceof Error) assert.match(h.text(), /Unable to complete this request/)
    h.cleanup()
  }
})

 test('session-returning signup does not leave a false pending-confirmation state', () => {
  const gate = new EmailRequestGate()
  gate.begin('a@example.com', 'signup', 0)
  gate.finish('a@example.com', 'signup', undefined, 0, false)
  assert.equal(gate.state('a@example.com', 0).awaitingConfirmation, false)
 })
 test('thrown login rate limit still gives visible feedback', async () => {
   const h = await pageHarness({ signin: async () => { throw timed } })
   h.email('a@example.com'); await h.submit()
   assert.match(h.text(), /Unable to log in right now/)
   h.cleanup()
 })
