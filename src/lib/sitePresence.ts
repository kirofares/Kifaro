import { supabase } from './supabase'

const STORAGE_KEY = 'kifaro_presence_session_id'
let started = false

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
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
