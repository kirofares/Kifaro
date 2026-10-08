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

async function canAccess(adminClient: any, userId: string, item: any, isAdmin: boolean) {
  if (isAdmin) return true
  const { data: profile } = await adminClient
    .from('profiles')
    .select('medical_year')
    .eq('id', userId)
    .maybeSingle()

  if (!profile || Number(profile.medical_year) !== Number(item.year)) return false
  if (item.assessment_type === 'spotter') return true

  const productType = item.assessment_type === 'case' ? 'cases'
    : ['osce','ospe'].includes(item.assessment_type) ? 'osce'
    : null
  if (!productType) return false

  const { data: entitlement } = await adminClient
    .from('module_entitlements')
    .select('expires_at, revoked_at')
    .eq('user_id', userId)
    .eq('module_code', item.module_code)
    .eq('product_type', productType)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  return Boolean(entitlement)
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
      p_action_key: 'assessment_item',
      p_limit: 120,
      p_window_seconds: 60,
    })
    if (rateError || !rateAllowed) return json({ error: rateError?.message || 'Too many requests. Try again later.' }, 429)

    const [{ data: profile }, { data: item, error: itemError }] = await Promise.all([
      adminClient.from('profiles').select('role').eq('id', userData.user.id).maybeSingle(),
      adminClient
        .from('assessment_items')
        .select('id, assessment_type, year, module_code, lecture_id, title, stem, instructions, media_url, media_alt, difficulty, time_limit_seconds, content, created_at')
        .eq('id', itemId)
        .eq('published', true)
        .eq('quality_status', 'ready')
        .maybeSingle(),
    ])

    if (itemError) return json({ error: itemError.message }, 400)
    if (!item) return json({ error: 'Assessment not available' }, 404)

    const isAdmin = profile?.role === 'admin'
    if (!(await canAccess(adminClient, userData.user.id, item, isAdmin))) {
      return json({ error: 'No active access to this assessment' }, 403)
    }

    const raw = item.content && typeof item.content === 'object' ? item.content : {}
    const questions = Array.isArray(raw.questions)
      ? raw.questions.map((q: any) => ({
          prompt: String(q?.prompt || ''),
          options: Array.isArray(q?.options) ? q.options.map((x: unknown) => String(x)) : [],
        }))
      : []
    const checklist = Array.isArray(raw.checklist)
      ? raw.checklist.map((row: any) => ({ label: String(row?.label || ''), marks: Number(row?.marks || 0) }))
      : []

    return json({
      item: {
        id: item.id,
        assessment_type: item.assessment_type,
        year: item.year,
        module_code: item.module_code,
        lecture_id: item.lecture_id,
        title: item.title,
        stem: item.stem,
        instructions: item.instructions,
        media_url: item.media_url,
        media_alt: item.media_alt,
        difficulty: item.difficulty,
        time_limit_seconds: item.time_limit_seconds,
        created_at: item.created_at,
        content: { questions, checklist },
      },
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected assessment error' }, 500)
  }
})
