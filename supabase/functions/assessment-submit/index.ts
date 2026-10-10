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
  const productType = item.assessment_type === 'case' ? 'cases'
    : ['osce','ospe','spotter'].includes(item.assessment_type) ? 'osce'
    : null
  if (!productType) return false

  const { data: entitlement } = await adminClient
    .from('module_entitlements')
    .select('expires_at')
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
    const answers = body?.answers && typeof body.answers === 'object' ? body.answers : {}
    const checklist = body?.checklist && typeof body.checklist === 'object' ? body.checklist : {}
    if (!itemId) return json({ error: 'Assessment item is required' }, 400)

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: rateAllowed, error: rateError } = await adminClient.rpc('consume_service_rate_limit', {
      p_actor_key: 'user:' + userData.user.id,
      p_action_key: 'assessment_submit',
      p_limit: 30,
      p_window_seconds: 60,
    })
    if (rateError || !rateAllowed) return json({ error: rateError?.message || 'Too many submissions. Try again shortly.' }, 429)

    const [{ data: profile }, { data: item, error: itemError }] = await Promise.all([
      adminClient.from('profiles').select('role').eq('id', userData.user.id).maybeSingle(),
      adminClient
        .from('assessment_items')
        .select('id, assessment_type, year, module_code, content')
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
    const questions = Array.isArray(raw.questions) ? raw.questions : []
    const checklistRows = Array.isArray(raw.checklist) ? raw.checklist : []

    let autoScore = 0
    const questionResults = questions.map((q: any, index: number) => {
      const selected = Number(answers[String(index)])
      const correctAnswer = Number(q?.answer)
      const isCorrect = Number.isInteger(selected) && selected === correctAnswer
      if (isCorrect) autoScore += 1
      return {
        index,
        is_correct: isCorrect,
        correct_answer: Number.isInteger(correctAnswer) ? correctAnswer : null,
        explanation: String(q?.explanation || ''),
      }
    })

    let checklistScore = 0
    checklistRows.forEach((row: any, index: number) => {
      if (checklist[String(index)] === true) checklistScore += Number(row?.marks || 0)
    })

    const maxScore = questions.length + checklistRows.reduce((sum: number, row: any) => sum + Number(row?.marks || 0), 0)
    const score = autoScore + checklistScore

    const { error: insertError } = await adminClient.from('assessment_attempts').insert({
      user_id: userData.user.id,
      assessment_item_id: item.id,
      score,
      max_score: maxScore,
      details: {
        answers,
        checklist,
        scoring: 'server',
        checklist_mode: checklistRows.length ? 'self_assessed' : null,
      },
    })
    if (insertError) return json({ error: insertError.message }, 500)

    return json({
      score,
      max_score: maxScore,
      question_results: questionResults,
      key_points: Array.isArray(raw.key_points) ? raw.key_points.map((x: unknown) => String(x)) : [],
      checklist_mode: checklistRows.length ? 'self_assessed' : null,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected assessment submission error' }, 500)
  }
})
