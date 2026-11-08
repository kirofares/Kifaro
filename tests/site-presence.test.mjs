import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'

const source = await readFile(new URL('../src/lib/sitePresence.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const ok = { error: null, data: null, status: 204, statusText: 'No Content' }
const paymentRequired = { error: { message: 'Payment Required', code: '' }, data: null, status: 402, statusText: 'Payment Required' }
const flush = () => new Promise((resolve) => setImmediate(resolve))

function harness({ reply = () => paymentRequired, client, random = 0, visible = true, online = true, storageBlocked = false } = {}) {
  let now = 0
  let id = 0
  const timers = new Map()
  const calls = []
  const logs = []
  const writes = []
  const events = () => {
    const listeners = new Map()
    return {
      addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn) },
      removeEventListener(name, fn) { listeners.get(name)?.delete(fn) },
      emit(name) { for (const fn of listeners.get(name) ?? []) fn() },
      count() { return [...listeners.values()].reduce((n, set) => n + set.size, 0) },
    }
  }
  const window = {
    ...events(),
    location: { pathname: '/', search: '?email=private@example.invalid', hash: '#/lectures' },
    navigator: { onLine: online },
    localStorage: {
      getItem() { if (storageBlocked) throw new Error('blocked'); return null },
      setItem(...args) { writes.push(args) },
    },
    setTimeout(fn, delay) { const key = ++id; timers.set(key, { at: now + delay, fn }); return key },
    clearTimeout(key) { timers.delete(key) },
  }
  const document = { ...events(), visibilityState: visible ? 'visible' : 'hidden' }
  const fakeClient = {
    rpc(name, args) {
      return { abortSignal(signal) { calls.push({ name, args, signal, at: now }); return reply(signal) } }
    },
  }
  const exports = {}
  vm.runInNewContext(compiled, {
    exports, require: (name) => { assert.equal(name, './supabase'); return { supabase: client === undefined ? fakeClient : client } },
    window, document, performance: { now: () => now }, AbortController,
    crypto: { randomUUID: () => '00000000-0000-4000-a000-000000000001' },
    Math: Object.assign(Object.create(Math), { random: () => random }),
    console: { log: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) },
  })
  return {
    start: exports.startSitePresenceTracking, window, document, timers, calls, logs, writes,
    async advance(ms) {
      await flush()
      const end = now + ms
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        const [key, timer] = next
        now = timer.at
        timers.delete(key)
        timer.fn()
        await flush()
      }
      now = end
      await flush()
    },
    burst() { for (let i = 0; i < 20; i++) { window.emit('hashchange'); window.emit('popstate'); document.emit('visibilitychange'); window.emit('online') } },
  }
}

test('resolved 402 backs off: at most 9 requests in one hour vs 121 old heartbeat requests', async () => {
  const h = harness()
  const stop = h.start()
  await h.advance(0)
  for (let i = 0; i < 120; i++) {
    h.burst()
    await h.advance(30_000)
  }
  assert.deepEqual(h.calls.map((c) => c.at), [0, 60_000, 180_000, 420_000, 900_000, 1_500_000, 2_100_000, 2_700_000, 3_300_000])
  assert.equal(h.logs.length, 0)
  stop()
})

test('success after failure resets cadence and failure count, sampling the current route', async () => {
  let result = paymentRequired
  const h = harness({ reply: () => result })
  const stop = h.start()
  await h.advance(0)
  h.window.location.hash = '#/lectures/new?email=secret@example.invalid'
  h.burst()
  await h.advance(59_999)
  assert.equal(h.calls.length, 1)
  result = ok
  await h.advance(1)
  assert.equal(h.calls[1].args.p_path, '/#/lectures/new')
  await h.advance(30_000)
  assert.equal(h.calls.length, 3)
  result = paymentRequired
  await h.advance(30_000)
  await h.advance(59_999)
  assert.equal(h.calls.length, 4)
  await h.advance(1)
  assert.equal(h.calls.length, 5)
  stop()
})

test('healthy route and visibility bursts coalesce without mutating navigation', async () => {
  const h = harness({ reply: () => ok })
  const stop = h.start()
  await h.advance(0)
  h.window.location.hash = '#/learn'
  h.burst()
  await h.advance(29_999)
  assert.equal(h.calls.length, 1)
  assert.equal(h.window.location.hash, '#/learn')
  await h.advance(1)
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[1].args.p_path, '/#/learn')
  assert.equal(h.calls[1].args.p_session_id, h.calls[0].args.p_session_id)
  stop()
})

test('single in-flight call; abort timeout recovers through backoff', async () => {
  const h = harness({ reply: (signal) => new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve({ error: { message: 'AbortError' }, status: 0 }), { once: true })
  }) })
  const stop = h.start()
  h.burst()
  await h.advance(14_999)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].signal.aborted, false)
  await h.advance(1)
  assert.equal(h.calls[0].signal.aborted, true)
  h.burst()
  await h.advance(59_999)
  assert.equal(h.calls.length, 1)
  await h.advance(1)
  assert.equal(h.calls.length, 2)
  stop()
  await flush()
  assert.equal(h.timers.size, 0)
})

test('hidden and offline periods send no calls; resuming cannot bypass backoff', async () => {
  const h = harness()
  const stop = h.start()
  await h.advance(0)
  h.document.visibilityState = 'hidden'
  await h.advance(30_000)
  h.document.visibilityState = 'visible'
  h.document.emit('visibilitychange')
  h.window.navigator.onLine = false
  await h.advance(30_000)
  assert.equal(h.calls.length, 1)
  h.window.navigator.onLine = true
  h.window.emit('online')
  await flush()
  assert.equal(h.calls.length, 2)
  h.document.visibilityState = 'hidden'
  await h.advance(600_000)
  assert.equal(h.calls.length, 2)
  h.document.visibilityState = 'visible'
  h.document.emit('visibilitychange')
  await flush()
  assert.equal(h.calls.length, 3)
  stop()
})

test('starting hidden/offline waits for eligibility; missing client is a no-op', async () => {
  for (const initial of [{ visible: false }, { online: false }]) {
    const h = harness(initial)
    const stop = h.start()
    await h.advance(600_000)
    assert.equal(h.calls.length, 0)
    h.document.visibilityState = 'visible'
    h.window.navigator.onLine = true
    h.window.emit('online')
    assert.equal(h.calls.length, 1)
    stop()
    await flush()
  }
  assert.equal(harness({ client: null }).start(), undefined)
})

test('thrown errors, network status 0, 5xx and SDK error payloads are contained', async () => {
  for (const reply of [
    () => { throw new Error('private failure detail') },
    () => Promise.reject(new Error('private rejected detail')),
    () => ({ error: { message: 'network failure' }, status: 0 }),
    () => ({ error: null, status: 402 }),
    () => ({ error: { message: 'service unavailable' }, status: 503 }),
    () => ({ error: { message: 'unexpected payload' }, status: 200 }),
  ]) {
    const h = harness({ reply })
    const stop = h.start()
    await h.advance(59_999)
    h.burst()
    assert.equal(h.calls.length, 1)
    await h.advance(1)
    assert.equal(h.calls.length, 2)
    assert.equal(h.logs.length, 0)
    stop()
  }
})

test('positive jitter stays within 20 percent and the 10 minute ceiling', async () => {
  const h = harness({ random: 0.999999 })
  const stop = h.start()
  await h.advance(3_600_000)
  const times = h.calls.map((c) => c.at)
  for (let i = 1; i < times.length; i++) {
    const base = Math.min(60_000 * 2 ** (i - 1), 600_000)
    const delta = times[i] - times[i - 1]
    assert.ok(delta >= base && delta <= Math.min(base * 1.2, 600_000))
  }
  assert.ok(times[1] > 60_000)
  stop()
})

test('cleanup is idempotent, aborts in-flight work and cannot revive an old tracker', async () => {
  let finish
  const h = harness({ reply: () => new Promise((resolve) => { finish = resolve }) })
  const stop = h.start()
  assert.equal(h.start(), undefined)
  const finishOld = finish
  stop()
  assert.equal(h.calls[0].signal.aborted, true)
  assert.equal(h.window.count() + h.document.count(), 0)
  const stopNew = h.start()
  stop() // stale cleanup must not unlock the new tracker
  assert.equal(h.start(), undefined)
  finishOld(ok)
  await flush()
  assert.equal(h.timers.size, 1) // new request deadline only
  finish(ok)
  await flush()
  assert.equal(h.timers.size, 1) // new heartbeat only
  stopNew()
  h.burst()
  await h.advance(600_000)
  assert.equal(h.calls.length, 2)
  assert.equal(h.timers.size, 0)
})

test('only existing session ID is persisted; OAuth fragments and route queries are omitted', async () => {
  for (const hash of ['#access_token=secret&refresh_token=hidden', '#/auth/callback?access_token=secret', '#/learn&token=hidden']) {
    const h = harness({ reply: () => ok })
    h.window.location.hash = hash
    const stop = h.start()
    await h.advance(0)
    const payload = JSON.stringify(h.calls[0].args)
    assert.doesNotMatch(payload, /secret|hidden|private@example|access_token|refresh_token/)
    assert.deepEqual(Object.keys(h.calls[0].args).sort(), ['p_path', 'p_session_id'])
    assert.equal(h.writes.length, 1)
    assert.equal(h.writes[0][0], 'kifaro_presence_session_id')
    assert.equal(h.logs.length, 0)
    stop()
  }
  const h = harness({ storageBlocked: true, reply: () => ok })
  const stop = h.start()
  await h.advance(30_000)
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[0].args.p_session_id, h.calls[1].args.p_session_id)
  stop()
})

test('real installed Supabase SDK resolves JSON and plain-text HTTP 402, then recovers on 204', async () => {
  for (const body of ['{"message":"Payment Required"}', 'Payment Required']) {
    const requests = []
    let healthy = false
    const client = createClient('https://presence-test.invalid', 'test-only-not-a-real-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (url, options) => {
        requests.push({ url: String(url), method: options.method })
        return healthy ? new Response(null, { status: 204 }) : new Response(body, { status: 402 })
      } },
    })
    const h = harness({ client })
    const stop = h.start()
    await h.advance(59_999)
    h.burst()
    assert.equal(requests.length, 1)
    healthy = true
    await h.advance(1)
    assert.equal(requests.length, 2)
    await h.advance(30_000)
    assert.equal(requests.length, 3)
    assert.ok(requests.every((r) => r.method === 'POST' && r.url.endsWith('/rest/v1/rpc/touch_site_presence')))
    stop()
  }
})
