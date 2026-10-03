import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'web'

export async function reportClientError(error: unknown, source = 'app', metadata: Record<string, unknown> = {}) {
  if (!supabase) return

  const message = error instanceof Error ? error.message : String(error || 'Unknown error')
  const stack = error instanceof Error ? error.stack : undefined

  try {
    await supabase.functions.invoke('client-error-report', {
      body: {
        source,
        message,
        stack,
        route: window.location.href,
        appVersion: APP_VERSION,
        platform: Capacitor.getPlatform(),
        metadata,
      },
    })
  } catch {
    // Error reporting must never interrupt the learning experience.
  }
}
