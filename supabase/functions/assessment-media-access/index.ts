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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Server configuration incomplete' }, 503)

    const token = authHeader.slice('Bearer '.length)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401)

    const body = await req.json().catch(() => ({}))
    const itemId = String(body?.itemId || '').trim()
    if (!itemId) return json({ error: 'Assessment item is required' }, 400)

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: rateAllowed, error: rateError } = await adminClient.rpc('consume_service_rate_limit', {
      p_actor_key: 'user:' + userData.user.id,
      p_action_key: 'assessment_media',
      p_limit: 120,
      p_window_seconds: 60,
    })
    if (rateError || !rateAllowed) return json({ error: rateError?.message || 'Too many requests. Try again later.' }, 429)

    const [{ data: profile }, { data: item, error: itemError }] = await Promise.all([
      adminClient.from('profiles').select('medical_year,role').eq('id', userData.user.id).maybeSingle(),
      adminClient
        .from('assessment_items')
        .select('id,assessment_type,year,module_code,media_url,published,quality_status')
        .eq('id', itemId)
        .maybeSingle(),
    ])

    if (itemError) return json({ error: itemError.message }, 400)
    if (!item || !item.published || item.quality_status !== 'ready') return json({ error: 'Assessment not available' }, 404)
    if (!item.media_url || !String(item.media_url).startsWith('private:')) return json({ error: 'Protected image not configured' }, 404)

    const isAdmin = profile?.role === 'admin'
    if (!isAdmin) {
      if (Number(profile?.medical_year || 0) !== Number(item.year)) return json({ error: 'No access to this assessment' }, 403)
      const productType = item.assessment_type === 'case'
        ? 'cases'
        : ['osce','ospe','spotter'].includes(item.assessment_type)
          ? 'osce'
          : null
      if (!productType) return json({ error: 'Protected media type not supported' }, 403)

      const { data: entitlement } = await adminClient
        .from('module_entitlements')
        .select('expires_at')
        .eq('user_id', userData.user.id)
        .eq('module_code', item.module_code)
        .eq('academic_year', item.year)
        .eq('product_type', productType)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (!entitlement) return json({ error: 'No active access to this assessment media' }, 403)
    }

    const assetKey = String(item.media_url).slice('private:'.length)
    const { data: asset, error: assetError } = await adminClient
      .from('protected_media_assets')
      .select('mime_type,content')
      .eq('asset_key', assetKey)
      .maybeSingle()

    if (assetError) return json({ error: assetError.message }, 400)
    if (!asset?.content) return json({ error: 'Protected image not found' }, 404)

    const bytes = new TextEncoder().encode(String(asset.content))
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)

    return json({
      url: 'data:' + String(asset.mime_type || 'image/svg+xml') + ';base64,' + btoa(binary),
      expiresIn: 0,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected image access error' }, 500)
  }
})
