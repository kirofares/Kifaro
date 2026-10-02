import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function paymobString(value: unknown) {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value == null) return ''
  return String(value)
}

async function hmacHex(secret: string, value: string, hash: 'SHA-256' | 'SHA-512') {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function base64UrlToText(input: string) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - input.length % 4) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function base64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function hmacSha256Base64Url(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return base64Url(new Uint8Array(signature))
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifyPaymobTransactionHmac(secret: string, obj: any, received: string) {
  const fields = [
    obj?.amount_cents,
    obj?.created_at,
    obj?.currency,
    obj?.error_occured,
    obj?.has_parent_transaction,
    obj?.id,
    obj?.integration_id,
    obj?.is_3d_secure,
    obj?.is_auth,
    obj?.is_capture,
    obj?.is_refunded,
    obj?.is_standalone_payment,
    obj?.is_voided,
    obj?.order?.id,
    obj?.owner,
    obj?.pending,
    obj?.source_data?.pan,
    obj?.source_data?.sub_type,
    obj?.source_data?.type,
    obj?.success,
  ]
  const concat = fields.map(paymobString).join('')
  const computed = await hmacHex(secret, concat, 'SHA-512')
  return constantTimeEqual(computed.toLowerCase(), String(received || '').toLowerCase())
}

async function decodeAndVerifyState(secret: string, token: string) {
  const [encoded, signature] = String(token || '').split('.')
  if (!encoded || !signature) return null
  const computed = await hmacSha256Base64Url(secret, encoded)
  if (!constantTimeEqual(computed, signature)) return null
  try {
    return JSON.parse(base64UrlToText(encoded))
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const hmacSecret = Deno.env.get('PAYMOB_HMAC_SECRET')
    const integrationId = Number(Deno.env.get('PAYMOB_INTEGRATION_ID_CARD') || 0)

    if (!supabaseUrl || !serviceKey || !hmacSecret || !integrationId) {
      return json({ error: 'Webhook environment is incomplete' }, 503)
    }

    const url = new URL(req.url)
    const receivedHmac = url.searchParams.get('hmac') || ''
    const body = await req.json().catch(() => null)
    const obj = body?.obj

    if (body?.type !== 'TRANSACTION' || !obj) {
      // Paymob may also send token callbacks to the same notification URL.
      return json({ received: true, ignored: true })
    }

    if (!await verifyPaymobTransactionHmac(hmacSecret, obj, receivedHmac)) {
      return json({ error: 'Invalid HMAC' }, 401)
    }

    const transactionId = Number(obj.id || 0)
    const callbackIntegration = Number(obj.integration_id || 0)
    const amountCents = Number(obj.amount_cents || 0)
    const success = obj.success === true && obj.pending === false
    const stateToken =
      obj?.payment_key_claims?.extra?.kifaro_state ||
      obj?.payment_key_claims?.extras?.kifaro_state ||
      ''

    const state = await decodeAndVerifyState(hmacSecret, String(stateToken))
    if (!state || state.v !== 1) return json({ error: 'Invalid KIFARO payment state' }, 400)
    if (callbackIntegration !== integrationId) return json({ error: 'Integration mismatch' }, 400)
    if (amountCents !== Number(state.a || 0)) return json({ error: 'Amount mismatch' }, 400)
    if (!['video', 'datashow', 'bundle'].includes(String(state.p || ''))) return json({ error: 'Invalid product' }, 400)

    if (!success) {
      return json({ received: true, paid: false })
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const userId = String(state.u || '')
    const lectureId = String(state.l || '')
    const productType = String(state.p)
    const videoGrant = productType === 'video' || productType === 'bundle'
    const datashowGrant = productType === 'datashow' || productType === 'bundle'

    const { data: existing, error: existingError } = await adminClient
      .from('lecture_entitlements')
      .select('user_id, lecture_id, price_paid_egp, video_access, datashow_access, product_type, view_limit, views_used')
      .eq('user_id', userId)
      .eq('lecture_id', lectureId)
      .maybeSingle()

    if (existingError) return json({ error: existingError.message }, 500)

    const addsNewAccess =
      (videoGrant && !existing?.video_access) ||
      (datashowGrant && !existing?.datashow_access)

    const videoAccess = Boolean(existing?.video_access || videoGrant)
    const datashowAccess = Boolean(existing?.datashow_access || datashowGrant)
    const combinedProduct = videoAccess && datashowAccess ? 'bundle' : videoAccess ? 'video' : 'datashow'
    const amountEgp = amountCents / 100
    const nextPaid = Number(existing?.price_paid_egp || 0) + (addsNewAccess ? amountEgp : 0)

    const entitlement = {
      user_id: userId,
      lecture_id: lectureId,
      price_paid_egp: nextPaid,
      source: 'paymob:' + transactionId,
      granted_at: new Date().toISOString(),
      revoked_at: null,
      view_limit: videoGrant ? (state.vl == null ? null : Number(state.vl)) : (existing?.view_limit ?? null),
      views_used: videoGrant && !existing?.video_access ? 0 : Number(existing?.views_used || 0),
      offer_academic_year: state.y == null ? null : Number(state.y),
      offer_nationality: state.n == null ? null : String(state.n),
      video_access: videoAccess,
      datashow_access: datashowAccess,
      product_type: combinedProduct,
    }

    const { error: upsertError } = await adminClient
      .from('lecture_entitlements')
      .upsert(entitlement, { onConflict: 'user_id,lecture_id' })

    if (upsertError) return json({ error: upsertError.message }, 500)

    return json({
      received: true,
      paid: true,
      transactionId,
      lectureId,
      productType,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected webhook error' }, 500)
  }
})
