import { supabase } from './supabase'

const STORAGE_KEY = 'kifaro_presence_session_id'
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

  const touch = async () => {
    if (document.visibilityState !== 'visible') return
    await client.rpc('touch_site_presence', {
      p_session_id: sessionId,
      p_path: window.location.pathname + window.location.hash,
    })
  }

  void touch()
  const timer = window.setInterval(() => void touch(), 30000)
  const onVisible = () => {
    if (document.visibilityState === 'visible') void touch()
  }
  const onRouteChange = () => void touch()

  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('hashchange', onRouteChange)
  window.addEventListener('popstate', onRouteChange)

  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('hashchange', onRouteChange)
    window.removeEventListener('popstate', onRouteChange)
    started = false
  }
}
