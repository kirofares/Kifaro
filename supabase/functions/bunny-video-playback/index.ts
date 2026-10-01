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

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)

    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!url || !anonKey) throw new Error('Supabase function environment is incomplete')

    const libraryId = Deno.env.get('BUNNY_STREAM_LIBRARY_ID')
    const tokenKey = Deno.env.get('BUNNY_STREAM_TOKEN_AUTH_KEY')
    if (!libraryId || !tokenKey) {
      return json({
        error: 'Bunny Stream playback is not configured yet.',
        requiredSecrets: ['BUNNY_STREAM_LIBRARY_ID', 'BUNNY_STREAM_TOKEN_AUTH_KEY'],
      }, 503)
    }

    const token = authHeader.slice('Bearer '.length)
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401)

    const body = await req.json().catch(() => ({}))
    const lectureId = String(body?.lectureId || '').trim()
    if (!lectureId) return json({ error: 'lectureId is required' }, 400)

    const { data: accessData, error: accessError } = await userClient.rpc('consume_bunny_video', {
      p_lecture_id: lectureId,
    })

    if (accessError) {
      const forbidden = /access required|View limit reached/i.test(accessError.message)
      return json({ error: accessError.message }, forbidden ? 403 : 400)
    }

    const row = Array.isArray(accessData) ? accessData[0] : accessData
    const videoId = String(row?.video_id || '')
    if (!videoId) return json({ error: 'Video is not ready yet' }, 404)

    const expires = Math.floor(Date.now() / 1000) + 30 * 60
    const signedToken = await sha256Hex(tokenKey + videoId + String(expires))
    const embedUrl =
      `https://player.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(videoId)}` +
      `?token=${signedToken}&expires=${expires}&preload=true&rememberPosition=true`

    const remainingViews = row.view_limit == null ? null : Math.max(0, Number(row.view_limit) - Number(row.views_used || 0))

    return json({
      embedUrl,
      expires,
      viewsUsed: Number(row.views_used || 0),
      viewLimit: row.view_limit,
      remainingViews,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
