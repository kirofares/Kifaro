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
  let instanceKey
  const values = [], effects = [], pending = [], calls = [], navigation = [], timers = new Map()
  let timerId = 0
  const jsx = (type, props, key) => ({ type, props, key })
  const exports = {}
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in values)) values[i] = initial
      return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value }]
    },
    useMemo(fn) { return fn() },
    useRef(initial) {
      const i = cursor++
      if (!(i in values)) values[i] = { current: initial }
      return values[i]
    },
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
  vm.runInNewContext(compiled, { exports, require: name => modules[name] || {}, window: {
    setInterval(fn) { timers.set(++timerId, fn); return timerId },
    clearInterval(id) { timers.delete(id) },
  } })
  const wrapper = () => exports.AssessmentItemPage()
  const render = () => {
    cursor = 0
    const outer = wrapper()
    if (outer.key !== instanceKey) {
      effects.forEach(e => e?.cleanup?.())
      values.length = 0; effects.length = 0; pending.length = 0
      instanceKey = outer.key
    }
    const tree = typeof outer.type === 'function' ? outer.type() : outer
    pending.splice(0).forEach(fn => fn())
    return tree
  }
  const all = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(all)]
  return { state, calls, navigation, wrapper, render, text: () => JSON.stringify(render()),
    button: label => all(render()).find(n => n.type === 'button' && [n.props.children].flat(Infinity).includes(label)),
    tick: () => [...timers.values()].forEach(fn => fn()),
    cleanup: () => effects.forEach(e => e?.cleanup?.()),
  }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

test('assessment page: guest gets sign-in without requesting protected data', () => {
  const f = fixture({ user: null }); assert.match(f.text(), /Sign in to open this assessment/)
  assert.equal(f.calls.length, 0); f.button('Sign in').props.onClick(); assert.deepEqual(f.navigation, ['/login'])
})

const readyItem = { id: 'item', year: 1, module_code: 'IAE-1', assessment_type: 'case', title: 'PRIVATE STATION', stem: 'PRIVATE QUESTION', content: { questions: [{ prompt: 'Select one', options: ['Choice A', 'Choice B'] }] }, time_limit_seconds: null }
for (const [status, message] of [[401, 'Your session has expired'], [403, 'do not have active access']]) {
  test(`assessment page: submit HTTP ${status} clears protected content and shows the correct action`, async () => {
    const f = fixture({ invoke: async name => name === 'assessment-item' ? { data: { item: readyItem } } : { error: { context: { status } } } })
    f.render(); await settle(); f.button('Finish assessment').props.onClick(); await settle()
    assert.match(f.text(), new RegExp(message))
    assert.doesNotMatch(f.text(), /PRIVATE STATION|PRIVATE QUESTION/)
    assert.ok(f.button(status === 401 ? 'Sign in' : 'Try again'))
  })
}
test('assessment page: a thrown submit failure allows retry without losing the answer', async () => {
  const f = fixture({ invoke: async name => name === 'assessment-item' ? { data: { item: readyItem } } : Promise.reject(new Error('network failure')) })
  f.render(); await settle()
  f.button('Choice B').props.onClick()
  await f.button('Finish assessment').props.onClick(); await settle()
  assert.match(f.text(), /Could not submit/)
  f.button('Finish assessment').props.onClick(); await settle()
  const submissions = f.calls.filter(([name]) => name === 'assessment-submit')
  assert.equal(submissions.length, 2)
  assert.equal(submissions[1][1].body.answers[0], 1)
})
test('assessment page: duplicate finish clicks create one submission', async () => {
  const f = fixture({ invoke: async name => name === 'assessment-item' ? { data: { item: readyItem } } : new Promise(() => {}) })
  f.render(); await settle()
  const button = f.button('Finish assessment'); button.props.onClick(); button.props.onClick()
  assert.equal(f.calls.filter(([name]) => name === 'assessment-submit').length, 1)
  f.cleanup()
})
test('assessment page: account switch clears loaded content and late submission results', async () => {
  let resolveSubmit
  const f = fixture({ invoke: name => name === 'assessment-submit'
    ? new Promise(resolve => { resolveSubmit = resolve })
    : Promise.resolve(f.state.user.id === 'student' ? { data: { item: readyItem } } : { error: { context: { status: 403 } } }) })
  f.render(); await settle(); f.button('Finish assessment').props.onClick()
  f.state.user = { id: 'other-student' }; f.render(); await settle()
  resolveSubmit({ data: { score: 1, max_score: 1, key_points: ['PRIVATE RESULTS'] } }); await settle()
  assert.doesNotMatch(f.text(), /PRIVATE STATION|PRIVATE QUESTION|PRIVATE RESULTS/)
  assert.match(f.text(), /do not have active access/)
})
test('assessment page: timed station starts explicitly and submits once at zero', async () => {
  const f = fixture({ invoke: async name => name === 'assessment-item'
    ? { data: { item: { ...readyItem, time_limit_seconds: 1 } } }
    : { data: { score: 0, max_score: 1, question_results: [] } } })
  f.render(); await settle(); f.render(); f.tick(); f.render()
  assert.equal(f.calls.length, 1)
  f.button('Start station').props.onClick(); f.render(); f.tick(); f.render(); await settle(); f.render()
  assert.equal(f.calls.filter(([name]) => name === 'assessment-submit').length, 1)
  f.cleanup()
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
