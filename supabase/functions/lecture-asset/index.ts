import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    const publishableKey = publishableKeys.default || Deno.env.get('SUPABASE_ANON_KEY')
    const secretKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const url = Deno.env.get('SUPABASE_URL')

    if (!url || !publishableKey || !secretKey) throw new Error('Supabase function environment is incomplete')

    const token = authHeader.slice('Bearer '.length)
    const userClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rateAllowed, error: rateError } = await userClient.rpc('consume_my_rate_limit', { p_action_key: 'lecture_asset' })
    if (rateError || !rateAllowed) {
      return new Response(JSON.stringify({ error: rateError?.message || 'Too many requests. Try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
    }

    const body = await req.json()
    const lectureId = String(body?.lectureId || '')
    const assetType = String(body?.assetType || '')

    if (!lectureId || !['video', 'datashow', 'document', 'pdf', 'pptx'].includes(assetType)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: accessData, error: accessError } = await userClient.rpc('consume_lecture_asset', {
      p_lecture_id: lectureId,
      p_asset_type: assetType,
    })

    if (accessError) {
      const forbidden = /required|admin only|No active|View limit/i.test(accessError.message)
      return new Response(JSON.stringify({ error: accessError.message }), {
        status: forbidden ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const row = Array.isArray(accessData) ? accessData[0] : accessData
    if (!row?.asset_path) {
      return new Response(JSON.stringify({ error: 'Asset is not available yet' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const expiresIn = assetType === 'video' ? 120 : (assetType === 'datashow' || assetType === 'document') ? 45 : 120
    const { data: signed, error: signedError } = await adminClient.storage
      .from('kifaro-content')
      .createSignedUrl(row.asset_path, expiresIn)

    if (signedError || !signed?.signedUrl) throw signedError || new Error('Could not sign asset URL')

    const remainingViews = row.view_limit == null ? null : Math.max(0, row.view_limit - row.views_used)

    return new Response(JSON.stringify({
      signedUrl: signed.signedUrl,
      expiresIn,
      viewsUsed: row.views_used,
      viewLimit: row.view_limit,
      remainingViews,
      viewerOnly: assetType === 'datashow' || assetType === 'document',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
