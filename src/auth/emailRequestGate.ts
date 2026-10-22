export type AuthFailure = { message: string; code?: string; status?: number }
export type EmailAction = 'signup' | 'recovery'

export function authFailure(error: unknown): AuthFailure {
  const value = error as Partial<AuthFailure> | null
  return {
    message: typeof value?.message === 'string' ? value.message : 'Unexpected authentication error.',
    code: typeof value?.code === 'string' ? value.code : undefined,
    status: typeof value?.status === 'number' ? value.status : undefined,
  }
}

export function emailRateLimit(error: AuthFailure): { limited: boolean; seconds?: number } {
  const limited = error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit'
  if (!limited) return { limited: false }
  // Supabase Auth exposes this server message through AuthApiError, not response headers.
  // Do not guess a delay from an unrelated number or from a generic quota error.
  const match = error.message.match(/you can only request this after (\d+) seconds?\b/i)
  const seconds = match ? Number(match[1]) : undefined
  return { limited, seconds: seconds && Number.isSafeInteger(seconds) ? seconds : undefined }
}

// Documented default per-user success window, NOT a project quota reset estimate.
// https://supabase.com/docs/guides/auth/rate-limits
export const EMAIL_SUCCESS_WINDOW_MS = 60_000

export class EmailRequestGate {
  private deadlines = new Map<string, number>()
  private confirmations = new Set<string>()
  private quotaBlocked = false
  private inFlight = false
  private key(email: string) { return email.trim().toLowerCase() }

  state(email: string, now = Date.now()) {
    const key = this.key(email)
    return {
      seconds: Math.max(0, Math.ceil(((this.deadlines.get(key) ?? 0) - now) / 1000)),
      awaitingConfirmation: this.confirmations.has(key),
      quotaBlocked: this.quotaBlocked,
      inFlight: this.inFlight,
    }
  }

  begin(email: string, action: EmailAction, now = Date.now()) {
    const state = this.state(email, now)
    if (state.inFlight || state.seconds || state.quotaBlocked || (action === 'signup' && state.awaitingConfirmation)) return false
    this.inFlight = true
    return true
  }

  finish(email: string, action: EmailAction, error?: AuthFailure, now = Date.now(), needsEmailConfirmation = true) {
    const key = this.key(email)
    if (error) {
      const limit = emailRateLimit(error)
      if (limit.seconds) this.deadlines.set(key, Math.max(this.deadlines.get(key) ?? 0, now + limit.seconds * 1000))
      else if (limit.limited) this.quotaBlocked = true
    } else {
      this.deadlines.set(key, now + EMAIL_SUCCESS_WINDOW_MS)
      if (action === 'signup' && needsEmailConfirmation) this.confirmations.add(key)
    }
    this.inFlight = false
  }

  // Explicit acknowledgement only; this does not claim the server quota has reset.
  allowManualRetry() { this.quotaBlocked = false }
}
