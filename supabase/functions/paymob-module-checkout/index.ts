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

function encodeState(value: unknown) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)))
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const paymobSecret = Deno.env.get('PAYMOB_SECRET_KEY')
    const paymobPublic = Deno.env.get('PAYMOB_PUBLIC_KEY')
    const paymobHmac = Deno.env.get('PAYMOB_HMAC_SECRET')
    const cardIntegrationId = Number(Deno.env.get('PAYMOB_INTEGRATION_ID_CARD') || 0)

    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Supabase environment is incomplete')
    if (!paymobSecret || !paymobPublic || !paymobHmac || !cardIntegrationId) {
      return json({ error: 'Paymob credentials are not configured yet.' }, 503)
    }

    const token = authHeader.slice('Bearer '.length)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401)

    const { data: rateAllowed, error: rateError } = await adminClient.rpc('consume_service_rate_limit', {
      p_actor_key: 'user:' + userData.user.id,
      p_action_key: 'checkout_module',
      p_limit: 10,
      p_window_seconds: 600,
    })
    if (rateError) return json({ error: rateError.message }, 429)
    if (!rateAllowed) return json({ error: 'Too many requests. Try again later.' }, 429)

    const body = await req.json().catch(() => ({}))
    const moduleCode = String(body?.moduleCode || '').trim().toUpperCase()
    const productType = String(body?.productType || '').trim().toLowerCase()

    if (!moduleCode || !['mcq','cases','osce'].includes(productType)) {
      return json({ error: 'Invalid module checkout request' }, 400)
    }

    const [{ data: profile, error: profileError }, { data: product, error: productError }, { data: entitlement, error: entitlementError }] = await Promise.all([
      adminClient.from('profiles')
        .select('id, full_name, email, phone_no, medical_year, nationality')
        .eq('id', userData.user.id)
        .maybeSingle(),
      adminClient.from('module_products')
        .select('module_code, academic_year, product_type, price_egp, enabled')
        .eq('module_code', moduleCode)
        .eq('product_type', productType)
        .maybeSingle(),
      adminClient.from('module_entitlements')
        .select('module_code, product_type, revoked_at, expires_at')
        .eq('user_id', userData.user.id)
        .eq('module_code', moduleCode)
        .eq('product_type', productType)
        .maybeSingle(),
    ])

    if (profileError) return json({ error: profileError.message }, 400)
    if (productError) return json({ error: productError.message }, 400)
    if (entitlementError) return json({ error: entitlementError.message }, 400)
    if (!profile) return json({ error: 'Complete your student profile before checkout.' }, 400)
    if (!product || product.enabled === false) return json({ error: 'This module product is not available.' }, 404)
    if (Number(profile.medical_year) !== Number(product.academic_year)) {
      return json({ error: 'This module is not part of your current academic year.' }, 403)
    }
    if (entitlement && !entitlement.revoked_at && entitlement.expires_at && new Date(entitlement.expires_at).getTime() > Date.now()) {
      return json({ error: 'You already have active access to this module.' }, 409)
    }

    const phone = String(profile.phone_no || '').trim()
    if (!phone) return json({ error: 'Add your phone number in My Profile before payment.' }, 400)

    const priceEgp = Number(product.price_egp)
    const amountCents = Math.round(priceEgp * 100)
    const issuedAt = Math.floor(Date.now() / 1000)
    const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    const statePayload = {
      v: 2,
      s: 'module',
      u: userData.user.id,
      m: moduleCode,
      p: productType,
      a: amountCents,
      y: profile.medical_year,
      iat: issuedAt,
      x: nonce,
    }
    const encodedState = encodeState(statePayload)
    const stateSignature = await hmacSha256Base64Url(paymobHmac, encodedState)
    const kifaroState = encodedState + '.' + stateSignature
    const specialReference = 'KFM-' + issuedAt + '-' + nonce

    const nameParts = String(profile.full_name || userData.user.email || 'KIFARO Student').trim().split(/\s+/)
    const firstName = nameParts.shift() || 'KIFARO'
    const lastName = nameParts.join(' ') || 'Student'
    const functionBase = supabaseUrl + '/functions/v1'
    const returnUrl = 'https://kifaroedu.com/#/payment/return'

    const intentionPayload = {
      amount: amountCents,
      currency: 'EGP',
      payment_methods: [cardIntegrationId],
      items: [{
        name: ('KIFARO ' + productType.toUpperCase() + ' ' + moduleCode).slice(0, 50),
        amount: amountCents,
        description: ('6-month module ' + productType + ' access: ' + moduleCode).slice(0, 255),
        quantity: 1,
      }],
      billing_data: {
        apartment: 'NA',
        first_name: firstName.slice(0, 50),
        last_name: lastName.slice(0, 50),
        street: 'NA',
        building: 'NA',
        phone_number: phone,
        city: 'Cairo',
        country: 'EGY',
        email: String(profile.email || userData.user.email || 'student@kifaroedu.com'),
        floor: 'NA',
        state: 'Cairo',
        postal_code: 'NA',
      },
      customer: {
        first_name: firstName.slice(0, 50),
        last_name: lastName.slice(0, 50),
        email: String(profile.email || userData.user.email || 'student@kifaroedu.com'),
      },
      extras: {
        kifaro_state: kifaroState,
        module_code: moduleCode,
        product_type: productType,
      },
      special_reference: specialReference,
      expiration: 3600,
      notification_url: functionBase + '/paymob-webhook',
      redirection_url: returnUrl,
    }

    const intentionResponse = await fetch('https://accept.paymob.com/v1/intention/', {
      method: 'POST',
      headers: {
        'Authorization': 'Token ' + paymobSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(intentionPayload),
    })

    const intentionText = await intentionResponse.text()
    let intention: any = null
    try { intention = JSON.parse(intentionText) } catch {}

    if (!intentionResponse.ok || !intention?.client_secret) {
      return json({
        error: intention?.detail || intention?.message || 'Paymob could not create the payment.',
        paymobStatus: intentionResponse.status,
      }, 502)
    }

    const checkoutUrl =
      'https://accept.paymob.com/unifiedcheckout/?publicKey=' +
      encodeURIComponent(paymobPublic) +
      '&clientSecret=' + encodeURIComponent(String(intention.client_secret))

    return json({
      checkoutUrl,
      amountEgp: priceEgp,
      moduleCode,
      productType,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected checkout error' }, 500)
  }
})
