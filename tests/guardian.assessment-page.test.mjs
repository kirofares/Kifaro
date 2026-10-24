import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../src/assessment/AssessmentCenter.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText

// Actual wrapper and component logic; isolated hooks/JSX, not a browser or RLS test.
function fixture({ invoke = async () => ({ error: { context: { status: 403 } } }), user = { id: 'student' }, loading = false, ar = false } = {}) {
  const state = { user, loading, id: 'item', ar }
  let cursor = 0
  const values = [], effects = [], pending = [], calls = [], navigation = []
  const jsx = (type, props, key) => ({ type, props, key })
  const exports = {}
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in values)) values[i] = initial
      return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value }]
    },
    useMemo(fn) { return fn() },
    useEffect(fn, deps) {
      const i = cursor++
      if (!effects[i] || deps.some((v, n) => !Object.is(v, effects[i].deps[n]))) {
        effects[i]?.cleanup?.()
        effects[i] = { deps }
        pending.push(() => { effects[i].cleanup = fn() })
      }
    },
  }
  const modules = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'react-router-dom': { useParams: () => ({ id: state.id }), useNavigate: () => path => navigation.push(path) },
    '../auth/AuthContext': { useAuth: () => state },
    '../i18n': { useTr: () => (en, arabic) => state.ar ? arabic : en, useLang: () => state.ar ? 'ar' : 'en' },
    '../lib/supabase': { supabase: {
      functions: { invoke: (...args) => { calls.push(args); return invoke(...args) } },
      from: () => ({ select() { return this }, eq() { return this }, order: async () => ({ data: [] }) }),
    } },
  }
  vm.runInNewContext(compiled, { exports, require: name => modules[name] || {}, window: { setInterval: () => 1, clearInterval() {} } })
  const wrapper = () => exports.AssessmentItemPage()
  const render = () => {
    cursor = 0
    const outer = wrapper()
    const tree = typeof outer.type === 'function' ? outer.type() : outer
    pending.splice(0).forEach(fn => fn())
    return tree
  }
  const all = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(all)]
  return { state, calls, navigation, wrapper, render, text: () => JSON.stringify(render()),
    button: label => all(render()).find(n => n.type === 'button' && n.props.children === label),
    cleanup: () => effects.forEach(e => e?.cleanup?.()),
  }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

test('assessment page: guest gets sign-in without requesting protected data', () => {
  const f = fixture({ user: null }); assert.match(f.text(), /Sign in to open this assessment/)
  assert.equal(f.calls.length, 0); f.button('Sign in').props.onClick(); assert.deepEqual(f.navigation, ['/login'])
})
test('assessment page: session hydration does not flash an access error', () => {
  const f = fixture({ user: null, loading: true }); assert.match(f.text(), /Checking your session/)
  assert.equal(f.calls.length, 0)
})
test('assessment page: route and user identities remount protected state', () => {
  const f = fixture(); const first = f.wrapper().key
  f.state.id = 'another-item'; assert.notEqual(f.wrapper().key, first)
  const second = f.wrapper().key; f.state.user = { id: 'another-student' }; assert.notEqual(f.wrapper().key, second)
  f.state.user = null; assert.equal(f.wrapper().type, 'div')
})
for (const [status, message] of [[401, 'Your session has expired'], [403, 'do not have active access'], [404, 'not available'], [429, 'Too many requests'], [500, 'Could not load']]) {
  test(`assessment page: HTTP ${status} gives a safe actionable message`, async () => {
    const f = fixture({ invoke: async () => ({ error: { context: { status }, message: 'Edge Function returned a non-2xx status code' } }) })
    f.render(); await settle(); assert.match(f.text(), new RegExp(message)); assert.doesNotMatch(f.text(), /non-2xx/)
    assert.ok(f.button(status === 401 ? 'Sign in' : 'Try again'))
  })
}
test('assessment page: rejected request becomes retryable and retry calls the server', async () => {
  const f = fixture({ invoke: async () => { throw new Error('offline internals') } })
  f.render(); await settle(); assert.match(f.text(), /Could not load/)
  f.button('Try again').props.onClick(); f.render(); await settle()
  assert.equal(f.calls.length, 2); assert.doesNotMatch(f.text(), /offline internals/)
})
test('assessment page: empty success does not spin forever', async () => {
  const f = fixture({ invoke: async () => ({ data: {} }) }); f.render(); await settle()
  assert.match(f.text(), /not available/)
})
test('assessment page: Arabic unauthorized feedback is localized', async () => {
  const f = fixture({ ar: true }); f.render(); await settle(); assert.match(f.text(), /ليس لديك وصول سارٍ/)
})
test('assessment page: language switch translates feedback without restarting the assessment request', async () => {
  const f = fixture(); f.render(); await settle()
  f.state.ar = true
  assert.match(f.text(), /ليس لديك وصول سارٍ/)
  assert.equal(f.calls.length, 1)
})
test('assessment page: response after unmount cannot set protected content', async () => {
  let resolve
  const f = fixture({ invoke: () => new Promise(r => { resolve = r }) })
  f.render(); f.cleanup(); resolve({ data: { item: { title: 'STALE SECRET', content: {} } } }); await settle()
  assert.doesNotMatch(f.text(), /STALE SECRET/)
})
