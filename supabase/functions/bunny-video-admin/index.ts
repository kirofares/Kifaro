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


// Core video-library settings use the account-level API key, not the Stream upload key.
// Diagnostic requests must never silently modify allowed referrers.
async function inspectAllowedReferrers(libraryId: string, accountKey: string | undefined) {
  if (!accountKey) {
    return {
      checked: false,
      reason: 'Bunny account-level API key is not configured. Check allowed domains in Bunny Stream > Library > Security.',
    }
  }

  try {
    const response = await fetch(`https://api.bunny.net/videolibrary/${encodeURIComponent(libraryId)}`, {
      headers: { AccessKey: accountKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      return {
        checked: false,
        httpStatus: response.status,
        reason: 'Bunny account-level API key could not access the library settings.',
      }
    }
    const library: any = await response.json()
    const allowedReferrers = (Array.isArray(library.AllowedReferrers)
      ? library.AllowedReferrers
      : Array.isArray(library.allowedReferrers) ? library.allowedReferrers : []
    ).map((s: unknown) => String(s).toLowerCase())
    const blockedReferrers = (Array.isArray(library.BlockedReferrers)
      ? library.BlockedReferrers
      : Array.isArray(library.blockedReferrers) ? library.blockedReferrers : []
    ).map((s: unknown) => String(s).toLowerCase())
    return {
      checked: true,
      httpStatus: 200,
      allowedReferrers,
      blockedReferrers,
      domainAllowed: allowedReferrers.length === 0 || allowedReferrers.includes('kifaroedu.com'),
      domainBlocked: blockedReferrers.includes('kifaroedu.com'),
      playerTokenAuthenticationEnabled: library.PlayerTokenAuthenticationEnabled ?? library.playerTokenAuthenticationEnabled ?? null,
      cdnTokenAuthenticationEnabled: library.EnableTokenAuthentication ?? library.enableTokenAuthentication ?? null,
      blockNoReferrer: library.BlockNoneReferrer ?? library.blockNoneReferrer ?? null,
      drmEnabled: library.EnableDRM ?? library.enableDRM ?? null,
      playerSigningKey: typeof (library.PlayerTokenAuthenticationKey ?? library.playerTokenAuthenticationKey) === 'string'
        ? (library.PlayerTokenAuthenticationKey ?? library.playerTokenAuthenticationKey) : null,
    }
  } catch {
    return { checked: false, reason: 'Cannot reach Bunny account-level library API.' }
  }
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
    const accountKey = Deno.env.get('BUNNY_ACCOUNT_API_KEY')
    const configured = Boolean(libraryId && apiKey)

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || 'configuration')

    if (action === 'configuration') {
      if (!configured || !libraryId || !apiKey) {
        return json({ configured: false, libraryId: null, domainSync: null })
      }
      const domainAudit = await inspectAllowedReferrers(libraryId, accountKey)
      const { playerSigningKey: _doNotExpose, ...publicAudit } = domainAudit as any
      const domainSync = publicAudit
      return json({ configured: true, libraryId, domainSync })
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

    if (action === 'diagnose') {
      // Read-only, admin-authorized diagnostics. Never return API keys, token keys,
      // signed playback URLs, or raw third-party responses to the browser.
      const videoResponse = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${encodeURIComponent(asset.bunny_video_id)}`,
        { headers: { 'AccessKey': apiKey, 'Accept': 'application/json' } },
      )
      if (!videoResponse.ok) {
        return json({
          reachable: false,
          providerHttpStatus: videoResponse.status,
          diagnosis: videoResponse.status === 404
            ? 'Bunny cannot find this video under the configured library.'
            : 'Bunny API did not return video metadata.',
        })
      }

      const video = await videoResponse.json()
      const actualLibrary = String(video?.videoLibraryId || '')
      const matchesLibrary = actualLibrary === String(libraryId)
      const matchesVideo = String(video?.guid || '').toLowerCase() === asset.bunny_video_id.toLowerCase()
      const tokenKey = Deno.env.get('BUNNY_STREAM_TOKEN_AUTH_KEY')
      const providerStatus = Number(video?.status)
      const hasPlayableResolution = Boolean(String(video?.availableResolutions || '').trim())

      const testEmbed = async (host: 'player.mediadelivery.net' | 'iframe.mediadelivery.net') => {
        if (!tokenKey) return { status: null, note: 'Playback token key is missing.' }
        const expires = Math.floor(Date.now() / 1000) + 300
        const signedToken = await sha256Hex(tokenKey + asset.bunny_video_id + String(expires))
        const url = `https://${host}/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(asset.bunny_video_id)}?token=${signedToken}&expires=${expires}`
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Referer': 'https://kifaroedu.com/' },
            redirect: 'manual',
            signal: AbortSignal.timeout(8000),
          })
          // A 3xx is a normal edge/player redirect, not definitive playback success.
          return { status: response.status, note: 'HTTP response from Bunny player (server-side probe).' }
        } catch {
          return { status: null, note: 'Player probe was blocked or timed out.' }
        }
      }

      const [currentPlayer, legacyPlayer] = await Promise.all([
        testEmbed('player.mediadelivery.net'),
        testEmbed('iframe.mediadelivery.net'),
      ])

      // Read-only library security audit with account-level credentials.
      // The Stream library key does not authorize core API access (HTTP 401).
      const securityAudit: any = await inspectAllowedReferrers(libraryId, accountKey)
      const librarySecurity = securityAudit.checked ? {
        fetched: true,
        httpStatus: 200,
        allowedReferrers: securityAudit.allowedReferrers,
        blockedReferrers: securityAudit.blockedReferrers,
        productionDomainAllowed: securityAudit.domainAllowed,
        productionDomainBlocked: securityAudit.domainBlocked,
        playerTokenAuthenticationEnabled: securityAudit.playerTokenAuthenticationEnabled,
        cdnTokenAuthenticationEnabled: securityAudit.cdnTokenAuthenticationEnabled,
        blockNoReferrer: securityAudit.blockNoReferrer,
        drmEnabled: securityAudit.drmEnabled,
        signingKeyMatches: securityAudit.playerSigningKey
          ? securityAudit.playerSigningKey === tokenKey : null,
        signingKeyComparisonAvailable: Boolean(securityAudit.playerSigningKey),
      } : {
        fetched: false,
        httpStatus: securityAudit.httpStatus ?? null,
        reason: securityAudit.reason,
        accountKeyRequired: !accountKey,
      }

      return json({
        reachable: true,
        providerHttpStatus: videoResponse.status,
        libraryMatches: matchesLibrary,
        videoMatches: matchesVideo,
        providerStatus,
        encodeProgress: Number(video?.encodeProgress || 0),
        hasPlayableResolution,
        availableResolutions: String(video?.availableResolutions || ''),
        videoLengthSeconds: Number(video?.length || 0),
        storageBytes: Number(video?.storageSize || 0),
        isPublic: typeof video?.isPublic === 'boolean' ? video.isPublic : null,
        tokenKeyConfigured: Boolean(tokenKey),
        librarySecurity,
        currentPlayer,
        legacyPlayer,
        // Probes can differ from the real browser due to session/cookie and CDN controls.
        requiresBrowserVerification: true,
      })
    }

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
      const providerStatus = Number(video.status)
      const hasPlayableResolution = String(video.availableResolutions || '').trim().length > 0
      // Bunny may report "resolution finished" (4) before overall encodeProgress reaches 100.
      const ready = hasPlayableResolution && (
        providerStatus === 3 || providerStatus === 4 || encodeProgress >= 100
      )
      const bunnyStatus = [5, 8].includes(providerStatus)
        ? 'error'
        : ready ? 'ready' : 'processing'

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
