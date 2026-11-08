import { supabase } from './supabase'

const STORAGE_KEY = 'kifaro_presence_session_id'
const HEARTBEAT_MS = 30_000
const FIRST_RETRY_MS = 60_000
const MAX_RETRY_MS = 600_000
const REQUEST_TIMEOUT_MS = 15_000
let started = false

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const seed = Date.now().toString(16) + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
  const hex = seed.replace(/[^a-f0-9]/gi, '').padEnd(32, '0').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function getSessionId() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) return saved
    const created = createSessionId()
    window.localStorage.setItem(STORAGE_KEY, created)
    return created
  } catch {
    return createSessionId()
  }
}

export function startSitePresenceTracking() {
  if (started || !supabase || typeof window === 'undefined') return
  started = true
  const client = supabase
  const sessionId = getSessionId()
  let stopped = false
  let inFlight = false
  let failures = 0
  let nextAttemptAt = 0
  let timer: number | undefined
  let requestTimer: number | undefined
  let controller: AbortController | undefined

  const schedule = (delay: number) => {
    window.clearTimeout(timer)
    if (!stopped) timer = window.setTimeout(() => void touch(), delay)
  }

  const touch = async () => {
    if (stopped || inFlight) return
    if (document.visibilityState !== 'visible' || !window.navigator.onLine) {
      window.clearTimeout(timer)
      return // Visibility/online events resume without bypassing the deadline.
    }
    const remaining = nextAttemptAt - performance.now()
    if (remaining > 0) {
      schedule(remaining)
      return
    }

    window.clearTimeout(timer)
    inFlight = true
    controller = new AbortController()
    const requestController = controller
    requestTimer = window.setTimeout(() => requestController.abort(), REQUEST_TIMEOUT_MS)
    let succeeded = false
    try {
      // HashRouter routes are useful; query strings and OAuth fragments are not.
      const hash = window.location.hash
      const route = hash.startsWith('#/') ? hash.split(/[?&=]/, 1)[0] : ''
      const { error, status } = await client.rpc('touch_site_presence', {
        p_session_id: sessionId,
        p_path: window.location.pathname + route,
      }).abortSignal(requestController.signal)
      // Supabase normally resolves HTTP failures (including 402), rather than throwing.
      succeeded = !error && status >= 200 && status < 300 && !requestController.signal.aborted
    } catch {
      // Best-effort telemetry must not reach the global error reporter or block navigation.
    } finally {
      window.clearTimeout(requestTimer)
      controller = undefined
      inFlight = false
      if (!stopped) {
        failures = succeeded ? 0 : Math.min(failures + 1, 5)
        const baseDelay = succeeded ? HEARTBEAT_MS : Math.min(FIRST_RETRY_MS * 2 ** (failures - 1), MAX_RETRY_MS)
        // Positive jitter avoids synchronized retries without allowing early attempts.
        const delay = succeeded ? baseDelay : Math.min(baseDelay * (1 + Math.random() * 0.2), MAX_RETRY_MS)
        nextAttemptAt = performance.now() + delay
        schedule(delay)
      }
    }
  }

  void touch()
  const onVisible = () => {
    if (document.visibilityState === 'visible') void touch()
  }
  const onRouteChange = () => void touch()

  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('hashchange', onRouteChange)
  window.addEventListener('popstate', onRouteChange)
  window.addEventListener('online', onRouteChange)

  return () => {
    if (stopped) return
    stopped = true
    window.clearTimeout(timer)
    window.clearTimeout(requestTimer)
    controller?.abort()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('hashchange', onRouteChange)
    window.removeEventListener('popstate', onRouteChange)
    window.removeEventListener('online', onRouteChange)
    started = false
  }
}
