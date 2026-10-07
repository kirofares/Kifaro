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

function extractOutputText(response: any) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) return response.output_text.trim()
  const chunks: string[] = []
  for (const item of response?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && typeof part?.text === 'string') chunks.push(part.text)
    }
  }
  return chunks.join('\n').trim()
}

function parseLectureJson(raw: string) {
  const clean = raw.trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '').trim()
  const parsed = JSON.parse(clean)
  if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length < 8) {
    throw new Error('The generated lecture did not contain a valid slide deck.')
  }
  return parsed
}

const MASTER_PROMPT = `
You are the AnatoMate by KIFARO medical-education production engine.
Create anatomy lecture drafts for Egyptian medical students in the exact house style below.

CONTENT STANDARD
- English only.
- Simple, precise medical English suitable for the target academic year.
- Scientifically accurate anatomy; never invent structures, relations, innervation, blood supply, embryology, or clinical facts.
- One slide = one teaching idea.
- Teach from map -> structure -> relationships -> function -> clinical relevance.
- Every major concept must include a clinically useful connection when appropriate.
- Use high-yield exam framing without sacrificing conceptual understanding.
- Avoid long paragraphs. Prefer short bullets, labels, arrows, contrasts, and stepwise logic.
- For embryology, use Langman-style developmental sequence and logic.
- For regional anatomy, emphasize boundaries, contents, relations, vessels, nerves, lymphatics, surface anatomy and clinical application as appropriate.
- Do not invent page numbers or editions.

ANATOMATE HOUSE STYLE
- 16:9 slide deck.
- Aptos font.
- Primary cyan #21B5EB; deep blue #0D70B8; dark text #123658; muted text #5C7589; soft panel #E7F6FD.
- Light full-slide watermark: "Dr. Kirolus Fares".
- Modern clean cover.
- Learning objectives immediately after the cover.
- One concept per slide.
- Dedicated Clinical Bridge slides when useful.
- Near the end include Quick Check, AnatoMate Exam Pearls, and Key Takeaways.
- Visual learning is central. For every slide say whether a visual is needed and provide a medically precise visual brief.
- Visual briefs must specify orientation, view, laterality, labels, and exclusions when relevant.

REFERENCE CATALOG
Use only these source tags when appropriate:
- Gray's Anatomy for Students
- Moore Clinically Oriented Anatomy
- Snell Clinical Anatomy by Regions
- Netter Atlas of Human Anatomy
- Langman's Medical Embryology
Never fabricate page numbers, DOI values, journal references, or editions.

ASSESSMENT STANDARD
- Active recall must test the exact lecture.
- MCQs are single-best-answer with four plausible options and one unambiguous correct answer.
- Cases are real clinical vignettes, not disguised factual questions.
- OSCE/OSPE stations are practical and anatomy-linked.
- Image-based items are flagged only when an image is genuinely needed.
- Include a concise explanation for every MCQ answer.

OUTPUT
Return VALID JSON ONLY. No markdown fences and no prose before or after it.
Use exactly this top-level structure:
{
  "lecture_title": string,
  "academic_year": number,
  "module": string,
  "system": string,
  "estimated_minutes": number,
  "design": {
    "ratio": "16:9",
    "font": "Aptos",
    "primary": "#21B5EB",
    "deep_blue": "#0D70B8",
    "text": "#123658",
    "muted": "#5C7589",
    "soft": "#E7F6FD",
    "watermark": "Dr. Kirolus Fares"
  },
  "learning_objectives": [string],
  "slides": [
    {
      "slide_number": number,
      "type": "cover|objectives|concept|clinical_bridge|quick_check|exam_pearls|summary",
      "title": string,
      "subtitle": string,
      "body_points": [string],
      "highlight": string,
      "clinical_application": string,
      "visual_required": boolean,
      "visual_brief": string,
      "visual_labels": [string],
      "source_tags": [string],
      "speaker_notes": string
    }
  ],
  "active_recall": [string],
  "mcqs": [
    {
      "question": string,
      "options": [string, string, string, string],
      "answer_index": number,
      "explanation": string,
      "topic": string,
      "subtopic": string,
      "difficulty": 1,
      "image_required": boolean,
      "image_brief": string
    }
  ],
  "cases": [
    {
      "title": string,
      "vignette": string,
      "questions": [string],
      "key_points": [string],
      "difficulty": 1,
      "image_required": boolean,
      "image_brief": string
    }
  ],
  "osce": [
    {
      "title": string,
      "station": string,
      "tasks": [string],
      "marking_points": [string],
      "image_required": boolean,
      "image_brief": string
    }
  ],
  "exam_pearls": [string],
  "key_takeaways": [string],
  "qa_checklist": [string]
}

For difficulty, use integer 1, 2, 3, or 4.
TARGET SIZE
- Usually 24-36 slides for a standard 45-60 minute lecture.
- Scale to topic complexity; never pad with repetition.
- 10-16 MCQs spanning recall through application.
- 3-6 clinical cases.
- 3-6 OSCE/OSPE stations.
- 8-15 active-recall prompts.
`

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

    const { data: profile } = await adminClient.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
    if (profile?.role !== 'admin') return json({ error: 'Admin access required' }, 403)

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    const model = Deno.env.get('OPENAI_LECTURE_MODEL') || 'gpt-5.6-sol'
    const configured = Boolean(apiKey)

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || 'configuration')

    if (action === 'configuration') {
      return json({
        configured,
        model,
        requiredSecrets: configured ? [] : ['OPENAI_API_KEY'],
        optionalSecrets: ['OPENAI_LECTURE_MODEL'],
      })
    }

    if (!configured || !apiKey) {
      return json({
        error: 'AI lecture generation is not configured yet.',
        requiredSecrets: ['OPENAI_API_KEY'],
      }, 503)
    }

    if (action === 'generate' || action === 'revise') {
      const lecture = body?.lecture || {}
      const lectureId = String(lecture?.id || '').trim()
      const title = String(lecture?.title || '').trim()
      if (!lectureId || !title) return json({ error: 'lecture.id and lecture.title are required' }, 400)

      let sourceDraft: any = null
      const draftId = String(body?.draftId || '').trim()
      if (action === 'revise') {
        if (!draftId) return json({ error: 'draftId is required for revision' }, 400)
        const { data, error } = await adminClient
          .from('lecture_drafts')
          .select('id, lecture_id, revision, content')
          .eq('id', draftId)
          .maybeSingle()
        if (error) return json({ error: error.message }, 500)
        if (!data || data.lecture_id !== lectureId) return json({ error: 'Source draft was not found for this lecture' }, 404)
        sourceDraft = data
      }

      const feedback = String(body?.feedback || '').trim()
      const lecturePrompt = [
        'Create the full AnatoMate draft for this lecture.',
        `Lecture ID: ${lectureId}`,
        `Title: ${title}`,
        `Academic year: ${Number(lecture?.year || 1)}`,
        `Module: ${String(lecture?.module || '')}`,
        `System: ${String(lecture?.system || '')}`,
        `Planned duration: ${Number(lecture?.duration || 50)} minutes`,
        Array.isArray(lecture?.objectives) && lecture.objectives.length
          ? `Existing curriculum objectives: ${lecture.objectives.join(' | ')}`
          : '',
        action === 'revise'
          ? `This is a revision. Preserve what is already strong and apply the requested changes precisely.\nRequested changes: ${feedback || 'Improve accuracy, clarity, slide flow, clinical relevance and assessment quality.'}\nPrevious draft JSON:\n${JSON.stringify(sourceDraft?.content || {})}`
          : '',
      ].filter(Boolean).join('\n')

      const { data: job, error: jobError } = await adminClient
        .from('lecture_generation_jobs')
        .insert({
          lecture_id: lectureId,
          action,
          status: 'queued',
          model,
          instructions: feedback || null,
          source_draft_id: sourceDraft?.id || null,
          requested_by: userData.user.id,
        })
        .select('id')
        .single()

      if (jobError || !job) return json({ error: jobError?.message || 'Could not create generation job' }, 500)

      await adminClient.from('content_production').upsert({
        lecture_id: lectureId,
        academic_year: Number(lecture?.year || 1),
        module_code: String(lecture?.module || ''),
        lecture_title: title,
        overall_status: 'in_progress',
        current_stage: 'outline',
        review_state: 'generating',
        review_feedback: feedback || null,
        updated_by: userData.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lecture_id' })

      const createResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          background: true,
          store: true,
          instructions: MASTER_PROMPT,
          input: lecturePrompt,
          max_output_tokens: 30000,
          metadata: {
            product: 'AnatoMate',
            lecture_id: lectureId,
            generation_job_id: job.id,
          },
        }),
      })

      const createText = await createResponse.text()
      let response: any = null
      try { response = JSON.parse(createText) } catch {}

      if (!createResponse.ok || !response?.id) {
        const errorMessage = response?.error?.message || createText || 'OpenAI generation request failed.'
        await adminClient.from('lecture_generation_jobs').update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', job.id)
        await adminClient.from('content_production').update({
          review_state: action === 'revise' ? 'changes_requested' : 'not_generated',
          updated_at: new Date().toISOString(),
          updated_by: userData.user.id,
        }).eq('lecture_id', lectureId)
        return json({ error: errorMessage }, 502)
      }

      await adminClient.from('lecture_generation_jobs').update({
        status: 'running',
        response_id: response.id,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)

      return json({ jobId: job.id, responseId: response.id, status: response.status || 'queued', model })
    }

    if (action === 'status') {
      const jobId = String(body?.jobId || '').trim()
      if (!jobId) return json({ error: 'jobId is required' }, 400)

      const { data: job, error: jobError } = await adminClient.from('lecture_generation_jobs').select('*').eq('id', jobId).maybeSingle()
      if (jobError) return json({ error: jobError.message }, 500)
      if (!job) return json({ error: 'Generation job not found' }, 404)
      if (job.status === 'completed' && job.result_draft_id) return json({ status: 'completed', jobId, draftId: job.result_draft_id })
      if (job.status === 'failed') return json({ status: 'failed', jobId, error: job.error_message || 'Generation failed' })
      if (!job.response_id) return json({ status: job.status || 'queued', jobId })

      const responseResult = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(job.response_id)}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      const responseText = await responseResult.text()
      let response: any = null
      try { response = JSON.parse(responseText) } catch {}

      if (!responseResult.ok) {
        const warning = response?.error?.message || responseText || 'Could not read generation status.'
        return json({ status: 'running', jobId, warning })
      }

      if (response.status === 'failed' || response.status === 'cancelled' || response.status === 'incomplete') {
        const errorMessage = response?.error?.message || response?.incomplete_details?.reason || 'Generation did not complete.'
        await adminClient.from('lecture_generation_jobs').update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', jobId)
        return json({ status: 'failed', jobId, error: errorMessage })
      }

      if (response.status !== 'completed') {
        await adminClient.from('lecture_generation_jobs').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', jobId)
        return json({ status: response.status || 'running', jobId })
      }

      let content: any
      try {
        content = parseLectureJson(extractOutputText(response))
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Could not parse generated lecture JSON.'
        await adminClient.from('lecture_generation_jobs').update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', jobId)
        return json({ status: 'failed', jobId, error: errorMessage })
      }

      const { data: latestRevision } = await adminClient
        .from('lecture_drafts')
        .select('revision')
        .eq('lecture_id', job.lecture_id)
        .order('revision', { ascending: false })
        .limit(1)
        .maybeSingle()
      const revision = Number(latestRevision?.revision || 0) + 1

      await adminClient
        .from('lecture_drafts')
        .update({ status: 'superseded', updated_at: new Date().toISOString() })
        .eq('lecture_id', job.lecture_id)
        .in('status', ['draft','needs_changes'])

      const { data: draft, error: draftError } = await adminClient
        .from('lecture_drafts')
        .insert({
          lecture_id: job.lecture_id,
          revision,
          status: 'draft',
          model: job.model || model,
          content,
          feedback: job.instructions || null,
          generation_job_id: job.id,
          created_by: job.requested_by || userData.user.id,
        })
        .select('id, lecture_id, revision, status, model, content, feedback, created_at, updated_at')
        .single()

      if (draftError || !draft) return json({ error: draftError?.message || 'Could not save generated draft' }, 500)

      await adminClient.from('lecture_generation_jobs').update({
        status: 'completed',
        result_draft_id: draft.id,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)

      await adminClient.from('content_production').update({
        overall_status: 'needs_review',
        current_stage: 'images',
        stage_status: {
          outline: 'complete',
          slides: 'complete',
          images: 'needs_review',
          clinical: 'complete',
          mcq: 'complete',
          cases: 'complete',
          osce: 'complete',
          recall: 'complete',
          final_qa: 'needs_review',
          publish: 'pending',
        },
        review_state: 'awaiting_review',
        review_feedback: null,
        updated_at: new Date().toISOString(),
        updated_by: userData.user.id,
      }).eq('lecture_id', job.lecture_id)

      return json({ status: 'completed', jobId, draft })
    }

    if (action === 'approve') {
      const draftId = String(body?.draftId || '').trim()
      if (!draftId) return json({ error: 'draftId is required' }, 400)

      const { data: draft, error: draftError } = await adminClient
        .from('lecture_drafts')
        .select('id, lecture_id, revision, status')
        .eq('id', draftId)
        .maybeSingle()
      if (draftError) return json({ error: draftError.message }, 500)
      if (!draft) return json({ error: 'Draft not found' }, 404)

      await adminClient
        .from('lecture_drafts')
        .update({ status: 'superseded', updated_at: new Date().toISOString() })
        .eq('lecture_id', draft.lecture_id)
        .eq('status', 'approved')
        .neq('id', draft.id)

      const now = new Date().toISOString()
      const { error: approveError } = await adminClient.from('lecture_drafts').update({
        status: 'approved',
        approved_by: userData.user.id,
        approved_at: now,
        updated_at: now,
      }).eq('id', draft.id)
      if (approveError) return json({ error: approveError.message }, 500)

      const { error: productionError } = await adminClient.from('content_production').update({
        approved_draft_id: draft.id,
        review_state: 'approved',
        review_feedback: null,
        overall_status: 'ready',
        current_stage: 'publish',
        stage_status: {
          outline: 'complete',
          slides: 'complete',
          images: 'complete',
          clinical: 'complete',
          mcq: 'complete',
          cases: 'complete',
          osce: 'complete',
          recall: 'complete',
          final_qa: 'complete',
          publish: 'pending',
        },
        updated_at: now,
        updated_by: userData.user.id,
      }).eq('lecture_id', draft.lecture_id)
      if (productionError) return json({ error: productionError.message }, 500)

      return json({
        approved: true,
        draftId: draft.id,
        lectureId: draft.lecture_id,
        revision: draft.revision,
        publishReady: true,
        published: false,
      })
    }

    return json({ error: 'Unsupported action' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
