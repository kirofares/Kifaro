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
    if (!state || ![1,2].includes(Number(state.v))) return json({ error: 'Invalid KIFARO payment state' }, 400)
    if (callbackIntegration !== integrationId) return json({ error: 'Integration mismatch' }, 400)
    if (amountCents !== Number(state.a || 0)) return json({ error: 'Amount mismatch' }, 400)

    const isModulePurchase = Number(state.v) === 2 && String(state.s || '') === 'module'
    if (isModulePurchase) {
      if (!['mcq','cases','osce'].includes(String(state.p || '')) || !String(state.m || '').trim()) {
        return json({ error: 'Invalid module product' }, 400)
      }
    } else if (!['video', 'datashow', 'bundle'].includes(String(state.p || ''))) {
      return json({ error: 'Invalid product' }, 400)
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const userId = String(state.u || '')
    const moduleCode = isModulePurchase ? String(state.m || '').trim().toUpperCase() : null
    const lectureId = isModulePurchase ? 'module:' + moduleCode : String(state.l || '')
    const rawProductType = String(state.p)
    const productType = isModulePurchase ? rawProductType + '_module' : rawProductType
    const specialReference = String(obj?.order?.merchant_order_id || obj?.order?.id || '') || null
    const paymobOrderId = obj?.order?.id == null ? null : String(obj.order.id)
    const terminalStatus =
      obj?.is_refunded === true ? 'refunded' :
      obj?.is_voided === true ? 'voided' :
      success ? 'paid_pending_fulfillment' : 'failed'

    const { data: existingTransaction, error: existingTransactionError } = await adminClient
      .from('payment_transactions')
      .select('paymob_transaction_id, status')
      .eq('paymob_transaction_id', transactionId)
      .maybeSingle()

    if (existingTransactionError) return json({ error: existingTransactionError.message }, 500)

    if (existingTransaction?.status === 'paid' && terminalStatus === 'paid_pending_fulfillment') {
      return json({ received: true, paid: true, transactionId, lectureId, productType, idempotent: true })
    }

    const { error: transactionUpsertError } = await adminClient
      .from('payment_transactions')
      .upsert({
        paymob_transaction_id: transactionId,
        paymob_order_id: paymobOrderId,
        special_reference: specialReference,
        user_id: userId,
        lecture_id: lectureId,
        product_type: productType,
        module_code: moduleCode,
        amount_cents: amountCents,
        amount_egp: amountCents / 100,
        currency: String(obj.currency || 'EGP'),
        status: terminalStatus,
        integration_id: callbackIntegration,
        paid_at: success ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'paymob_transaction_id' })

    if (transactionUpsertError) return json({ error: transactionUpsertError.message }, 500)

    if (terminalStatus === 'refunded' || terminalStatus === 'voided') {
      if (isModulePurchase && moduleCode) {
        const { error: recalcError } = await adminClient.rpc('recalculate_module_entitlement_after_payment_change', {
          p_user_id: userId,
          p_module_code: moduleCode,
          p_product_type: rawProductType,
        })
        if (recalcError) return json({ error: recalcError.message, status: terminalStatus }, 500)
      } else {
        const { error: recalcError } = await adminClient.rpc('recalculate_lecture_entitlement_after_payment_change', {
          p_user_id: userId,
          p_lecture_id: lectureId,
        })
        if (recalcError) return json({ error: recalcError.message, status: terminalStatus }, 500)
      }

      return json({
        received: true,
        paid: false,
        transactionId,
        status: terminalStatus,
        accessRecalculated: true,
      })
    }

    if (!success) {
      return json({ received: true, paid: false, transactionId, status: terminalStatus })
    }

    const userIdChecked = userId

    if (isModulePurchase) {
      const { data: product, error: productError } = await adminClient
        .from('module_products')
        .select('module_code, academic_year, product_type, price_egp, enabled')
        .eq('module_code', moduleCode)
        .eq('product_type', rawProductType)
        .maybeSingle()

      if (productError) return json({ error: productError.message }, 500)
      if (!product || product.enabled === false) return json({ error: 'Module product unavailable' }, 404)
      if (Math.round(Number(product.price_egp) * 100) !== amountCents) return json({ error: 'Module price mismatch' }, 400)

      const { error: entitlementError } = await adminClient
        .from('module_entitlements')
        .upsert({
          user_id: userIdChecked,
          module_code: moduleCode,
          product_type: rawProductType,
          academic_year: Number(product.academic_year),
          price_paid_egp: amountCents / 100,
          source: 'paymob:' + transactionId,
          granted_at: new Date().toISOString(),
          expires_at: (() => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 6); return d.toISOString() })(),
          revoked_at: null,
        }, { onConflict: 'user_id,module_code,product_type' })

      if (entitlementError) return json({ error: entitlementError.message }, 500)

      const { error: finalizeModuleTransactionError } = await adminClient
        .from('payment_transactions')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('paymob_transaction_id', transactionId)

      if (finalizeModuleTransactionError) return json({ error: finalizeModuleTransactionError.message }, 500)

      return json({
        received: true,
        paid: true,
        transactionId,
        moduleCode,
        productType: rawProductType,
      })
    }

    const videoGrant = rawProductType === 'video' || rawProductType === 'bundle'
    const datashowGrant = rawProductType === 'datashow' || rawProductType === 'bundle'

    const { data: existing, error: existingError } = await adminClient
      .from('lecture_entitlements')
      .select('user_id, lecture_id, price_paid_egp, video_access, datashow_access, product_type, view_limit, views_used')
      .eq('user_id', userIdChecked)
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
      user_id: userIdChecked,
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

    const { error: finalizeTransactionError } = await adminClient
      .from('payment_transactions')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('paymob_transaction_id', transactionId)

    if (finalizeTransactionError) {
      return json({
        error: finalizeTransactionError.message,
        paid: true,
        fulfillment: 'completed',
        transactionLedger: 'pending',
      }, 500)
    }

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
