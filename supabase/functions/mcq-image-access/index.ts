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
    const questionId = String(body?.questionId || '').trim()
    if (!questionId) return json({ error: 'Question is required' }, 400)

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: rateAllowed, error: rateError } = await adminClient.rpc('consume_service_rate_limit', {
      p_actor_key: 'user:' + userData.user.id,
      p_action_key: 'mcq_image',
      p_limit: 120,
      p_window_seconds: 60,
    })
    if (rateError || !rateAllowed) return json({ error: rateError?.message || 'Too many requests. Try again later.' }, 429)

    const [{ data: profile }, { data: question, error: questionError }] = await Promise.all([
      adminClient.from('profiles').select('medical_year,role').eq('id', userData.user.id).maybeSingle(),
      adminClient
        .from('mcq_questions')
        .select('id,lecture_id,image_url,published,quality_status')
        .eq('id', questionId)
        .maybeSingle(),
    ])

    if (questionError) return json({ error: questionError.message }, 400)
    if (!question || !question.published || question.quality_status !== 'ready') return json({ error: 'Question not available' }, 404)
    if (!question.image_url || !String(question.image_url).startsWith('private:')) return json({ error: 'Protected image not configured' }, 404)

    const isAdmin = profile?.role === 'admin'
    if (!isAdmin) {
      const { data: mapping } = await adminClient
        .from('lecture_module_map')
        .select('module_code,academic_year')
        .eq('lecture_id', question.lecture_id)
        .eq('academic_year', Number(profile?.medical_year || 0))
        .maybeSingle()

      if (!mapping) return json({ error: 'No access to this question' }, 403)

      const { data: entitlement } = await adminClient
        .from('module_entitlements')
        .select('expires_at')
        .eq('user_id', userData.user.id)
        .eq('module_code', mapping.module_code)
        .eq('product_type', 'mcq')
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (!entitlement) return json({ error: 'No active MCQ access' }, 403)
    }

    const path = String(question.image_url).slice('private:'.length)

    const { data: protectedAsset } = await adminClient
      .from('protected_media_assets')
      .select('mime_type,content')
      .eq('asset_key', path)
      .maybeSingle()

    if (protectedAsset?.content) {
      const bytes = new TextEncoder().encode(String(protectedAsset.content))
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return json({
        url: 'data:' + String(protectedAsset.mime_type || 'image/svg+xml') + ';base64,' + btoa(binary),
        expiresIn: 0,
      })
    }

    const { data: signed, error: signedError } = await adminClient.storage.from('mcq-images').createSignedUrl(path, 300)
    if (signedError || !signed?.signedUrl) return json({ error: signedError?.message || 'Could not open image' }, 500)

    return json({ url: signed.signedUrl, expiresIn: 300 })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected image access error' }, 500)
  }
})
