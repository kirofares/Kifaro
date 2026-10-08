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
    const answers = Array.isArray(body?.answers) ? body.answers : []
    if (!answers.length || answers.length > 200) return json({ error: 'Invalid answer batch' }, 400)

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await adminClient.rpc('service_submit_mcq_answers', {
      p_user_id: userData.user.id,
      p_answers: answers,
    })

    if (error) {
      const tooMany = /too many/i.test(error.message)
      const forbidden = /no active|not available|required/i.test(error.message)
      return json({ error: error.message }, tooMany ? 429 : forbidden ? 403 : 400)
    }

    return json({ results: data || [] })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected MCQ submission error' }, 500)
  }
})
