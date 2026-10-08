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

function matchesRule(rule: any, profile: any) {
  const nationality = String(profile?.nationality || '').trim().toLowerCase()
  const nationalityRule = String(rule?.nationality_match || '*').trim()
  const nationalityMatches =
    nationalityRule === '*' ||
    nationalityRule.toLowerCase() === nationality ||
    (nationalityRule === 'NON_EGYPTIAN' && !['egyptian', 'egypt'].includes(nationality))

  return (rule.academic_year == null || Number(rule.academic_year) === Number(profile?.medical_year)) && nationalityMatches
}

function ruleScore(rule: any) {
  const yearScore = rule.academic_year == null ? 0 : 20
  const nationalityScore =
    rule.nationality_match === '*' ? 0 :
    rule.nationality_match === 'NON_EGYPTIAN' ? 5 : 10
  return yearScore + nationalityScore + Number(rule.priority || 0)
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
    const walletIntegrationId = Number(Deno.env.get('PAYMOB_INTEGRATION_ID_WALLET') || 0)

    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Supabase environment is incomplete')
    if (!paymobSecret || !paymobPublic || !paymobHmac || !cardIntegrationId) {
      return json({ error: 'Paymob test credentials are not configured yet.' }, 503)
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
      p_action_key: 'checkout_lecture',
      p_limit: 10,
      p_window_seconds: 600,
    })
    if (rateError) return json({ error: rateError.message }, 429)
    if (!rateAllowed) return json({ error: 'Too many requests. Try again later.' }, 429)

    const body = await req.json().catch(() => ({}))
    const lectureId = String(body?.lectureId || '').trim()
    const productType = String(body?.productType || '').trim()
    const paymentMethod = String(body?.paymentMethod || 'card').trim().toLowerCase()

    if (!lectureId || !['video', 'datashow', 'bundle'].includes(productType) || !['card','wallet'].includes(paymentMethod)) {
      return json({ error: 'Invalid checkout request' }, 400)
    }

    const [
      { data: profile, error: profileError },
      { data: setting, error: settingError },
      { data: rules, error: rulesError },
      { data: existingEntitlement, error: entitlementError },
    ] = await Promise.all([
        adminClient.from('profiles')
          .select('id, full_name, email, phone_no, medical_year, nationality')
          .eq('id', userData.user.id)
          .maybeSingle(),
        adminClient.from('lecture_settings')
          .select('lecture_id, price_egp, access_mode, published')
          .eq('lecture_id', lectureId)
          .maybeSingle(),
        adminClient.from('lecture_pricing_rules')
          .select('academic_year, nationality_match, price_egp, view_limit, priority, product_type, enabled')
          .eq('lecture_id', lectureId)
          .eq('product_type', productType)
          .eq('enabled', true),
        adminClient.from('lecture_entitlements')
          .select('video_access, datashow_access, revoked_at')
          .eq('user_id', userData.user.id)
          .eq('lecture_id', lectureId)
          .maybeSingle(),
      ])

    if (profileError) return json({ error: profileError.message }, 400)
    if (settingError) return json({ error: settingError.message }, 400)
    if (rulesError) return json({ error: rulesError.message }, 400)
    if (entitlementError) return json({ error: entitlementError.message }, 400)
    if (!profile) return json({ error: 'Complete your student profile before checkout.' }, 400)
    if (!setting || setting.published === false) return json({ error: 'This lecture is not available for purchase.' }, 404)
    if (setting.access_mode === 'free') return json({ error: 'This lecture is free. Open it without payment.' }, 409)

    const activeEntitlement = existingEntitlement && !existingEntitlement.revoked_at ? existingEntitlement : null
    const ownsVideo = Boolean(activeEntitlement?.video_access)
    const ownsDatashow = Boolean(activeEntitlement?.datashow_access)

    if (
      (productType === 'video' && ownsVideo) ||
      (productType === 'datashow' && ownsDatashow) ||
      (productType === 'bundle' && ownsVideo && ownsDatashow)
    ) {
      return json({ error: 'You already own this product.' }, 409)
    }

    const phone = String(profile.phone_no || '').trim()
    if (!phone) return json({ error: 'Add your phone number in My Profile before payment.' }, 400)

    const matchingRule = (rules || [])
      .filter((rule: any) => matchesRule(rule, profile))
      .sort((a: any, b: any) => ruleScore(b) - ruleScore(a))[0]

    const basePrice = Math.max(0, Number(setting.price_egp ?? 0))
    const datashowBase = Math.max(30, basePrice)
    const fallbackPrice =
      productType === 'video' ? basePrice :
      productType === 'datashow' ? datashowBase :
      basePrice + datashowBase

    const priceEgp = matchingRule ? Number(matchingRule.price_egp) : fallbackPrice
    const viewLimit = productType === 'datashow' ? null : (matchingRule?.view_limit ?? null)

    if (!Number.isFinite(priceEgp) || priceEgp <= 0) {
      return json({ error: 'This product does not have a payable price configured.' }, 400)
    }

    const amountCents = Math.round(priceEgp * 100)
    const integrationId = paymentMethod === 'wallet' ? walletIntegrationId : cardIntegrationId
    if (!integrationId) {
      return json({
        error: paymentMethod === 'wallet'
          ? 'Mobile Wallet is not enabled in Paymob yet.'
          : 'Card payments are not configured yet.',
      }, 503)
    }
    const nameParts = String(profile.full_name || userData.user.email || 'KIFARO Student').trim().split(/\s+/)
    const firstName = nameParts.shift() || 'KIFARO'
    const lastName = nameParts.join(' ') || 'Student'
    const issuedAt = Math.floor(Date.now() / 1000)
    const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    const statePayload = {
      v: 1,
      u: userData.user.id,
      l: lectureId,
      p: productType,
      pm: paymentMethod,
      a: amountCents,
      vl: viewLimit,
      y: profile.medical_year ?? null,
      n: profile.nationality ?? null,
      iat: issuedAt,
      x: nonce,
    }
    const encodedState = encodeState(statePayload)
    const stateSignature = await hmacSha256Base64Url(paymobHmac, encodedState)
    const kifaroState = encodedState + '.' + stateSignature
    const specialReference = 'KF-' + issuedAt + '-' + nonce

    const functionBase = supabaseUrl + '/functions/v1'
    const returnUrl = 'https://kifaroedu.com/#/payment/return'

    const intentionPayload = {
      amount: amountCents,
      currency: 'EGP',
      payment_methods: [integrationId],
      items: [{
        name: ('KIFARO ' + productType).slice(0, 50),
        amount: amountCents,
        description: ('Lecture access: ' + lectureId).slice(0, 255),
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
        lecture_id: lectureId,
        product_type: productType,
        payment_method: paymentMethod,
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
      intentionId: intention.id || null,
      orderId: intention.intention_order_id || null,
      amountEgp: priceEgp,
      productType,
      paymentMethod,
      testMode: /test/i.test(paymobSecret) || /test/i.test(paymobPublic),
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected checkout error' }, 500)
  }
})
