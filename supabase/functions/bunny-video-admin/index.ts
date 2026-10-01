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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anonKey || !serviceKey) throw new Error('Supabase function environment is incomplete')

    const token = authHeader.slice('Bearer '.length)
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401)

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') return json({ error: 'Admin access required' }, 403)

    const libraryId = Deno.env.get('BUNNY_STREAM_LIBRARY_ID')
    const apiKey = Deno.env.get('BUNNY_STREAM_API_KEY')
    const configured = Boolean(libraryId && apiKey)

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || 'configuration')

    if (action === 'configuration') {
      return json({ configured, libraryId: configured ? libraryId : null })
    }

    if (!configured || !libraryId || !apiKey) {
      return json({
        error: 'Bunny Stream is not configured yet.',
        requiredSecrets: ['BUNNY_STREAM_LIBRARY_ID', 'BUNNY_STREAM_API_KEY'],
      }, 503)
    }

    const lectureId = String(body?.lectureId || '').trim()
    if (!lectureId) return json({ error: 'lectureId is required' }, 400)

    if (action === 'prepare') {
      const title = String(body?.title || lectureId).trim() || lectureId
      const createResponse = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
        method: 'POST',
        headers: {
          'AccessKey': apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      })

      const createText = await createResponse.text()
      let video: any = null
      try { video = JSON.parse(createText) } catch {}

      if (!createResponse.ok || !video?.guid) {
        return json({ error: video?.message || createText || 'Could not create Bunny video.' }, 502)
      }

      const videoId = String(video.guid)
      const expires = Math.floor(Date.now() / 1000) + 6 * 60 * 60
      const signature = await sha256Hex(`${libraryId}${apiKey}${expires}${videoId}`)

      const { error: saveError } = await adminClient.from('lecture_assets').upsert({
        lecture_id: lectureId,
        video_provider: 'bunny',
        bunny_video_id: videoId,
        bunny_status: 'uploading',
        bunny_encode_progress: 0,
        updated_at: new Date().toISOString(),
        updated_by: userData.user.id,
      }, { onConflict: 'lecture_id' })

      if (saveError) return json({ error: saveError.message }, 500)

      return json({
        endpoint: 'https://video.bunnycdn.com/tusupload',
        libraryId,
        videoId,
        expires,
        signature,
      })
    }

    const { data: asset, error: assetError } = await adminClient
      .from('lecture_assets')
      .select('bunny_video_id')
      .eq('lecture_id', lectureId)
      .maybeSingle()

    if (assetError) return json({ error: assetError.message }, 500)
    if (!asset?.bunny_video_id) return json({ error: 'No Bunny video is attached to this lecture.' }, 404)

    if (action === 'uploaded') {
      const { error } = await adminClient.from('lecture_assets').update({
        video_provider: 'bunny',
        bunny_status: 'processing',
        bunny_encode_progress: 0,
        updated_at: new Date().toISOString(),
        updated_by: userData.user.id,
      }).eq('lecture_id', lectureId)
      if (error) return json({ error: error.message }, 500)
    }

    if (action === 'status' || action === 'uploaded') {
      const statusResponse = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${asset.bunny_video_id}`,
        { headers: { 'AccessKey': apiKey, 'Accept': 'application/json' } },
      )

      const statusText = await statusResponse.text()
      let video: any = null
      try { video = JSON.parse(statusText) } catch {}

      if (!statusResponse.ok || !video) {
        return json({ error: video?.message || statusText || 'Could not read Bunny video status.' }, 502)
      }

      const encodeProgress = Math.max(0, Math.min(100, Number(video.encodeProgress || 0)))
      const ready = encodeProgress >= 100 && Boolean(video.availableResolutions)
      const bunnyStatus = ready ? 'ready' : 'processing'

      const { error: updateError } = await adminClient.from('lecture_assets').update({
        video_provider: 'bunny',
        bunny_status: bunnyStatus,
        bunny_encode_progress: Math.round(encodeProgress),
        updated_at: new Date().toISOString(),
        updated_by: userData.user.id,
      }).eq('lecture_id', lectureId)

      if (updateError) return json({ error: updateError.message }, 500)

      return json({
        videoId: asset.bunny_video_id,
        status: bunnyStatus,
        encodeProgress: Math.round(encodeProgress),
        availableResolutions: video.availableResolutions || null,
        length: video.length || null,
      })
    }

    return json({ error: 'Unsupported action' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
