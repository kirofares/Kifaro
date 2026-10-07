import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Eye,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  UploadCloud,
  Workflow,
} from 'lucide-react'
import { anatomateLectures } from '../data/anatomate'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import LectureDraftReview, { type ReviewDraft } from './LectureDraftReview'

type StageKey = 'outline' | 'slides' | 'images' | 'clinical' | 'mcq' | 'cases' | 'osce' | 'recall' | 'final_qa' | 'publish'
type StageState = 'pending' | 'in_progress' | 'needs_review' | 'complete' | 'blocked'
type OverallState = 'not_started' | 'in_progress' | 'needs_review' | 'ready' | 'published' | 'blocked'
type ReviewState = 'not_generated' | 'generating' | 'awaiting_review' | 'changes_requested' | 'approved'
type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

type ProductionRow = {
  lecture_id: string
  academic_year: number
  module_code: string
  lecture_title: string
  overall_status: OverallState
  current_stage: StageKey
  stage_status: Partial<Record<StageKey, StageState>>
  production_notes: string | null
  approved_draft_id: string | null
  review_state: ReviewState
  review_feedback: string | null
  updated_at: string
}

type QualityRow = {
  lecture_id: string
  mcq_total: number
  mcq_ready: number
  mcq_image_issues: number
  case_total: number
  case_ready: number
  case_image_issues: number
  osce_total: number
  osce_ready: number
  osce_image_issues: number
  spotter_total: number
  spotter_ready: number
}

type DraftSlide = {
  slide_number?: number
  type?: string
  title?: string
  subtitle?: string
  body_points?: string[]
  highlight?: string
  clinical_application?: string
  visual_required?: boolean
  visual_brief?: string
  visual_labels?: string[]
  source_tags?: string[]
  speaker_notes?: string
}

type DraftContent = {
  lecture_title?: string
  academic_year?: number
  module?: string
  system?: string
  estimated_minutes?: number
  learning_objectives?: string[]
  slides?: DraftSlide[]
  active_recall?: string[]
  mcqs?: Array<Record<string, unknown>>
  cases?: Array<Record<string, unknown>>
  osce?: Array<Record<string, unknown>>
  exam_pearls?: string[]
  key_takeaways?: string[]
  qa_checklist?: string[]
}

type DraftRow = {
  id: string
  lecture_id: string
  revision: number
  status: 'draft' | 'needs_changes' | 'approved' | 'superseded' | 'rejected'
  model: string | null
  content: DraftContent
  feedback: string | null
  created_at: string
  updated_at: string
  approved_at: string | null
  pptx_path: string | null
  pdf_path: string | null
  artifacts_built_at: string | null
}

type GenerationJob = {
  id: string
  lecture_id: string
  action: 'generate' | 'revise'
  status: JobStatus
  model: string | null
  error_message: string | null
  result_draft_id: string | null
  created_at: string
}

const STAGES: Array<{ key: StageKey; label: string }> = [
  { key: 'outline', label: 'Outline' },
  { key: 'slides', label: 'Slides' },
  { key: 'images', label: 'Images' },
  { key: 'clinical', label: 'Clinical' },
  { key: 'mcq', label: 'MCQ' },
  { key: 'cases', label: 'Cases' },
  { key: 'osce', label: 'OSCE' },
  { key: 'recall', label: 'Recall' },
  { key: 'final_qa', label: 'Final QA' },
  { key: 'publish', label: 'Publish' },
]

const STATE_ORDER: StageState[] = ['pending', 'in_progress', 'needs_review', 'complete', 'blocked']

function emptyStages(): Record<StageKey, StageState> {
  return {
    outline: 'pending',
    slides: 'pending',
    images: 'pending',
    clinical: 'pending',
    mcq: 'pending',
    cases: 'pending',
    osce: 'pending',
    recall: 'pending',
    final_qa: 'pending',
    publish: 'pending',
  }
}

function normalizeStages(value?: Partial<Record<StageKey, StageState>>) {
  return { ...emptyStages(), ...(value || {}) }
}

function deriveOverall(stages: Record<StageKey, StageState>): OverallState {
  const values = Object.values(stages)
  if (values.includes('blocked')) return 'blocked'
  if (values.includes('needs_review')) return 'needs_review'
  if (stages.publish === 'complete') return 'published'
  if (STAGES.filter(({ key }) => key !== 'publish').every(({ key }) => stages[key] === 'complete') && stages.publish === 'pending') return 'ready'
  if (values.some((value) => value !== 'pending')) return 'in_progress'
  return 'not_started'
}

function firstOpenStage(stages: Record<StageKey, StageState>): StageKey {
  return STAGES.find(({ key }) => stages[key] !== 'complete')?.key || 'publish'
}

function progressPercent(stages: Record<StageKey, StageState>) {
  return Math.round((STAGES.filter(({ key }) => stages[key] === 'complete').length / STAGES.length) * 100)
}

function badgeLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function jobIsRunning(job?: GenerationJob) {
  return Boolean(job && (job.status === 'queued' || job.status === 'running'))
}

export default function ContentProduction() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Map<string, ProductionRow>>(new Map())
  const [quality, setQuality] = useState<Map<string, QualityRow>>(new Map())
  const [drafts, setDrafts] = useState<Map<string, DraftRow>>(new Map())
  const [jobs, setJobs] = useState<Map<string, GenerationJob>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [pollingJob, setPollingJob] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [year, setYear] = useState(0)
  const [status, setStatus] = useState<'all' | OverallState>('all')
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const [aiModel, setAiModel] = useState('')
  const [selectedDraft, setSelectedDraft] = useState<DraftRow | null>(null)
  const [feedback, setFeedback] = useState('')

  const load = async () => {
    if (!supabase) return
    setLoading(true)
    setMessage('')

    const [productionResult, qualityResult, draftsResult, jobsResult] = await Promise.all([
      supabase
        .from('content_production')
        .select('lecture_id, academic_year, module_code, lecture_title, overall_status, current_stage, stage_status, production_notes, approved_draft_id, review_state, review_feedback, updated_at'),
      supabase
        .from('content_production_quality_summary')
        .select('lecture_id, mcq_total, mcq_ready, mcq_image_issues, case_total, case_ready, case_image_issues, osce_total, osce_ready, osce_image_issues, spotter_total, spotter_ready'),
      supabase
        .from('lecture_drafts')
        .select('id, lecture_id, revision, status, model, content, feedback, created_at, updated_at, approved_at, pptx_path, pdf_path, artifacts_built_at')
        .order('revision', { ascending: false }),
      supabase
        .from('lecture_generation_jobs')
        .select('id, lecture_id, action, status, model, error_message, result_draft_id, created_at')
        .order('created_at', { ascending: false })
        .limit(300),
    ])

    for (const result of [productionResult, qualityResult, draftsResult, jobsResult]) {
      if (result.error) setMessage(result.error.message)
    }

    const draftMap = new Map<string, DraftRow>()
    for (const draft of (draftsResult.data || []) as DraftRow[]) {
      if (!draftMap.has(draft.lecture_id)) draftMap.set(draft.lecture_id, draft)
    }

    const jobMap = new Map<string, GenerationJob>()
    for (const job of (jobsResult.data || []) as GenerationJob[]) {
      if (!jobMap.has(job.lecture_id)) jobMap.set(job.lecture_id, job)
    }

    setRows(new Map(((productionResult.data || []) as ProductionRow[]).map((row) => [row.lecture_id, row])))
    setQuality(new Map(((qualityResult.data || []) as QualityRow[]).map((row) => [row.lecture_id, row])))
    setDrafts(draftMap)
    setJobs(jobMap)
    setLoading(false)
  }

  const loadConfiguration = async () => {
    if (!supabase) return
    const { data, error } = await supabase.functions.invoke('lecture-content-generator', {
      body: { action: 'configuration' },
    })
    if (error) {
      setAiConfigured(false)
      return
    }
    setAiConfigured(Boolean(data?.configured))
    setAiModel(String(data?.model || ''))
  }

  useEffect(() => {
    void load()
    void loadConfiguration()
  }, [])

  const lectureState = (lecture: (typeof anatomateLectures)[number]) => {
    const existing = rows.get(lecture.id)
    const stages = normalizeStages(existing?.stage_status)
    return {
      existing,
      stages,
      overall: existing?.overall_status || deriveOverall(stages),
      current: existing?.current_stage || firstOpenStage(stages),
      progress: progressPercent(stages),
      review: existing?.review_state || ('not_generated' as ReviewState),
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return anatomateLectures.filter((lecture) => {
      const state = lectureState(lecture)
      const text = [lecture.title, lecture.module, lecture.system, lecture.id].join(' ').toLowerCase()
      return (!year || lecture.year === year) &&
        (status === 'all' || state.overall === status) &&
        (!q || text.includes(q))
    })
  }, [query, year, status, rows])

  const saveStages = async (
    lecture: (typeof anatomateLectures)[number],
    nextStages: Record<StageKey, StageState>,
    preferredCurrent?: StageKey
  ) => {
    if (!supabase || !user) return
    setSaving(lecture.id)
    setMessage('')

    const overall = deriveOverall(nextStages)
    const current = preferredCurrent || firstOpenStage(nextStages)
    const previous = rows.get(lecture.id)
    const payload = {
      lecture_id: lecture.id,
      academic_year: lecture.year,
      module_code: lecture.module,
      lecture_title: lecture.title,
      overall_status: overall,
      current_stage: current,
      stage_status: nextStages,
      production_notes: previous?.production_notes || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('content_production')
      .upsert(payload, { onConflict: 'lecture_id' })
      .select('lecture_id, academic_year, module_code, lecture_title, overall_status, current_stage, stage_status, production_notes, approved_draft_id, review_state, review_feedback, updated_at')
      .single()

    if (error) {
      setMessage(error.message)
    } else if (data) {
      setRows((currentRows) => {
        const next = new Map(currentRows)
        next.set(lecture.id, data as ProductionRow)
        return next
      })
    }
    setSaving('')
  }

  const continueLecture = async (lecture: (typeof anatomateLectures)[number]) => {
    const state = lectureState(lecture)
    const current = firstOpenStage(state.stages)
    const next = { ...state.stages }
    if (next[current] === 'pending' || next[current] === 'needs_review') next[current] = 'in_progress'
    await saveStages(lecture, next, current)
  }

  const cycleStage = async (lecture: (typeof anatomateLectures)[number], key: StageKey) => {
    if (key === 'publish' && lectureState(lecture).review !== 'approved') {
      setMessage('Publishing stays locked until you approve an AI draft.')
      return
    }
    const state = lectureState(lecture)
    const currentIndex = STATE_ORDER.indexOf(state.stages[key])
    const nextValue = STATE_ORDER[(currentIndex + 1) % STATE_ORDER.length]
    const next = { ...state.stages, [key]: nextValue }
    await saveStages(lecture, next, key)
  }

  const pollGeneration = async (jobId: string, lectureId: string) => {
    if (!supabase) return
    setPollingJob(jobId)
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (attempt > 0) await delay(3000)
      const { data, error } = await supabase.functions.invoke('lecture-content-generator', {
        body: { action: 'status', jobId },
      })

      if (error) {
        setMessage(error.message)
        setPollingJob('')
        return
      }

      if (data?.status === 'completed') {
        setMessage('Lecture draft is ready for your review.')
        setPollingJob('')
        await load()
        const { data: draftData } = await supabase
          .from('lecture_drafts')
          .select('id, lecture_id, revision, status, model, content, feedback, created_at, updated_at, approved_at, pptx_path, pdf_path, artifacts_built_at')
          .eq('lecture_id', lectureId)
          .order('revision', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (draftData) setSelectedDraft(draftData as DraftRow)
        return
      }

      if (data?.status === 'failed') {
        setMessage(data?.error || 'Lecture generation failed.')
        setPollingJob('')
        await load()
        return
      }
    }

    setPollingJob('')
    setMessage('Generation is still running. You can use Check AI status later; nothing was lost.')
    await load()
  }

  const startGeneration = async (
    lecture: (typeof anatomateLectures)[number],
    mode: 'generate' | 'revise',
    draft?: DraftRow
  ) => {
    if (!supabase) return
    if (!aiConfigured) {
      setMessage('AI production is not configured yet. Add OPENAI_API_KEY to Supabase Edge Function secrets.')
      return
    }
    if (mode === 'revise' && !feedback.trim()) {
      setMessage('Write the requested changes first.')
      return
    }

    setSaving(lecture.id)
    setMessage(mode === 'generate' ? 'Starting AI lecture production…' : 'Starting a new revision…')

    const { data, error } = await supabase.functions.invoke('lecture-content-generator', {
      body: {
        action: mode,
        lecture: {
          id: lecture.id,
          title: lecture.title,
          year: lecture.year,
          module: lecture.module,
          system: lecture.system,
          duration: lecture.duration,
          objectives: lecture.objectives,
        },
        draftId: mode === 'revise' ? draft?.id : undefined,
        feedback: mode === 'revise' ? feedback.trim() : undefined,
      },
    })

    setSaving('')
    if (error || data?.error || !data?.jobId) {
      setMessage(data?.error || error?.message || 'Could not start lecture generation.')
      return
    }

    const job: GenerationJob = {
      id: String(data.jobId),
      lecture_id: lecture.id,
      action: mode,
      status: 'running',
      model: String(data.model || aiModel || ''),
      error_message: null,
      result_draft_id: null,
      created_at: new Date().toISOString(),
    }
    setJobs((current) => new Map(current).set(lecture.id, job))
    setFeedback('')
    setSelectedDraft(null)
    void pollGeneration(job.id, lecture.id)
  }

  const checkJob = async (job: GenerationJob) => {
    if (!jobIsRunning(job)) return
    await pollGeneration(job.id, job.lecture_id)
  }

  const publishLecture = async (lecture: (typeof anatomateLectures)[number]) => {
    if (!supabase || !user) return
    const state = lectureState(lecture)
    if (state.review !== 'approved') {
      setMessage('Final approval is required before publishing.')
      return
    }

    setSaving(lecture.id)
    setMessage('Publishing lecture…')
    const now = new Date().toISOString()
    const { error: publishError } = await supabase.from('lecture_settings').upsert({
      lecture_id: lecture.id,
      published: true,
      updated_at: now,
      updated_by: user.id,
    }, { onConflict: 'lecture_id' })

    if (publishError) {
      setSaving('')
      setMessage(publishError.message)
      return
    }

    const stages = { ...state.stages, publish: 'complete' as StageState }
    const { error: productionError } = await supabase.from('content_production').update({
      overall_status: 'published',
      current_stage: 'publish',
      stage_status: stages,
      updated_at: now,
      updated_by: user.id,
    }).eq('lecture_id', lecture.id)

    setSaving('')
    if (productionError) {
      setMessage(productionError.message)
      return
    }

    setMessage('Lecture published after final approval.')
    await load()
  }

  const generateNext = async () => {
    const nextLecture = anatomateLectures.find((lecture) => {
      const draft = drafts.get(lecture.id)
      const job = jobs.get(lecture.id)
      const state = lectureState(lecture)
      return !draft && !jobIsRunning(job) && state.overall !== 'published'
    })
    if (!nextLecture) {
      setMessage('Every lecture already has a draft or an active generation job.')
      return
    }
    await startGeneration(nextLecture, 'generate')
  }

  const totalStarted = anatomateLectures.filter((lecture) => lectureState(lecture).overall !== 'not_started').length
  const totalReady = anatomateLectures.filter((lecture) => ['ready', 'published'].includes(lectureState(lecture).overall)).length
  const totalReview = anatomateLectures.filter((lecture) => lectureState(lecture).review === 'awaiting_review').length
  const totalGenerating = anatomateLectures.filter((lecture) => jobIsRunning(jobs.get(lecture.id))).length

  return (
    <div className="productiontracker">
      <div className="adminpanel">
        <div className="adminpanelhead">
          <div>
            <span className="eyebrow">ANATOMATE CONTENT ENGINE</span>
            <h2>Lecture Production</h2>
            <p>AI prepares the lecture in the AnatoMate house style, then stops for your approval before publishing.</p>
          </div>
          <div className="productiontopactions">
            <button className="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/>{loading ? 'Refreshing…' : 'Refresh'}</button>
            <button className="primary" onClick={() => void generateNext()} disabled={!aiConfigured || totalGenerating > 0}><Sparkles size={16}/>Produce next lecture</button>
          </div>
        </div>

        <div className={aiConfigured ? 'aienginestatus connected' : 'aienginestatus setup'}>
          <div>
            <Sparkles size={18}/>
            <span>
              <strong>{aiConfigured === null ? 'Checking AI engine…' : aiConfigured ? 'AI production engine connected' : 'AI engine needs one secret'}</strong>
              <small>{aiConfigured ? 'Model: ' + (aiModel || 'configured model') + ' · Drafts never publish without approval.' : 'Add OPENAI_API_KEY to Supabase Edge Function secrets. ChatGPT subscription and API billing are separate.'}</small>
            </span>
          </div>
          <b>{aiConfigured === null ? 'Checking' : aiConfigured ? 'Ready' : 'Setup required'}</b>
        </div>

        <div className="productionstats">
          <div><small>STARTED</small><strong>{totalStarted}</strong><span>of {anatomateLectures.length}</span></div>
          <div><small>GENERATING</small><strong>{totalGenerating}</strong><span>AI jobs running</span></div>
          <div><small>AWAITING YOU</small><strong>{totalReview}</strong><span>drafts to review</span></div>
          <div><small>APPROVED / READY</small><strong>{totalReady}</strong><span>publish unlocked</span></div>
        </div>

        <div className="productionfilters">
          <label><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search lecture, module or system…" /></label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            <option value={0}>All years</option>
            {[1,2,3,4,5,6,7].map((value) => <option key={value} value={value}>{value === 7 ? 'Post Graduate' : 'Year ' + value}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | OverallState)}>
            <option value="all">All statuses</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="needs_review">Needs review</option>
            <option value="ready">Ready</option>
            <option value="published">Published</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      {message && <div className="adminmessage"><AlertTriangle size={17}/>{message}</div>}

      <div className="productionlist">
        {filtered.map((lecture) => {
          const state = lectureState(lecture)
          const qa = quality.get(lecture.id)
          const draft = drafts.get(lecture.id)
          const job = jobs.get(lecture.id)
          const running = jobIsRunning(job) || Boolean(pollingJob && pollingJob === job?.id)
          const imageIssues = Number(qa?.mcq_image_issues || 0) + Number(qa?.case_image_issues || 0) + Number(qa?.osce_image_issues || 0)

          return (
            <article className="productioncard" key={lecture.id}>
              <div className="productionhead">
                <div className="grow">
                  <small>YEAR {lecture.year} · {lecture.module}</small>
                  <h3>{lecture.title}</h3>
                  <p>{lecture.system}</p>
                </div>
                <div className="productionoverall">
                  <span className={'reviewstatus ' + state.review}>{badgeLabel(state.review)}</span>
                  <span className={'productionstatus ' + state.overall}>{badgeLabel(state.overall)}</span>
                  <strong>{state.progress}%</strong>
                </div>
              </div>

              <div className="productionbar"><i style={{ width: state.progress + '%' }} /></div>

              <div className="productionstages">
                {STAGES.map((stage) => (
                  <button
                    key={stage.key}
                    className={'productionstage ' + state.stages[stage.key]}
                    disabled={saving === lecture.id || running}
                    title={stage.key === 'publish' && state.review !== 'approved' ? 'Locked until you approve a draft' : 'Tap to cycle stage status'}
                    onClick={() => void cycleStage(lecture, stage.key)}
                  >
                    {state.stages[stage.key] === 'complete' ? <Check size={14}/> : <Circle size={12}/>}
                    <span>{stage.label}</span>
                  </button>
                ))}
              </div>

              <div className="productionqa">
                <div><small>MCQ BANK</small><strong>{qa?.mcq_ready || 0}/{qa?.mcq_total || 0}</strong><span>ready</span></div>
                <div><small>CASE BANK</small><strong>{qa?.case_ready || 0}/{qa?.case_total || 0}</strong><span>ready</span></div>
                <div><small>OSCE / OSPE</small><strong>{qa?.osce_ready || 0}/{qa?.osce_total || 0}</strong><span>ready</span></div>
                <div className={imageIssues ? 'issue' : 'ok'}><small>IMAGE QA</small><strong>{imageIssues}</strong><span>{imageIssues ? 'issues' : 'clear'}</span></div>
              </div>

              <div className="aidraftstrip">
                <div>
                  {running ? <Clock3 size={17}/> : draft?.status === 'approved' ? <CheckCircle2 size={17}/> : <Sparkles size={17}/>}
                  <span>
                    <strong>{running ? 'AI is producing this lecture' : draft ? 'Revision ' + draft.revision + ' · ' + badgeLabel(draft.status) : 'No AI draft yet'}</strong>
                    <small>{running ? 'Generation continues in the background.' : draft ? (draft.model || 'AI model') + ' · ' + new Date(draft.updated_at).toLocaleString() : 'Generate the first draft using the AnatoMate master pattern.'}</small>
                  </span>
                </div>
                <div className="aidraftactions">
                  {draft && <button className="secondary" onClick={() => { setSelectedDraft(draft); setFeedback('') }}><Eye size={16}/>Review draft</button>}
                  {running && job && <button className="secondary" disabled={pollingJob === job.id} onClick={() => void checkJob(job)}><RefreshCw size={16}/>Check AI status</button>}
                  {!running && !draft && <button className="primary" disabled={!aiConfigured || saving === lecture.id} onClick={() => void startGeneration(lecture, 'generate')}><Sparkles size={16}/>Generate draft</button>}
                  {!running && draft && draft.status !== 'approved' && <button className="secondary" disabled={!aiConfigured || saving === lecture.id} onClick={() => { setSelectedDraft(draft); setFeedback('') }}><RotateCcw size={16}/>Request changes</button>}
                </div>
              </div>

              <div className="productionactions">
                <span><Workflow size={16}/>Current: <b>{STAGES.find((stage) => stage.key === state.current)?.label || state.current}</b></span>
                <div>
                  {state.review === 'approved' && state.overall !== 'published' && (
                    <button className="primary" disabled={saving === lecture.id || running} onClick={() => void publishLecture(lecture)}>
                      <UploadCloud size={16}/>Publish lecture
                    </button>
                  )}
                  <button className="secondary" disabled={saving === lecture.id || running} onClick={() => void continueLecture(lecture)}>Manual continue<ChevronRight size={16}/></button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {!loading && !filtered.length && <div className="adminpanel productionempty">No lectures match the current filters.</div>}

      {selectedDraft && (() => {
        const lecture = anatomateLectures.find((item) => item.id === selectedDraft.lecture_id)
        return (
          <LectureDraftReview
            draft={selectedDraft as ReviewDraft}
            lecture={lecture}
            feedback={feedback}
            setFeedback={setFeedback}
            saving={saving === selectedDraft.lecture_id}
            onClose={() => setSelectedDraft(null)}
            onRevise={() => {
              if (lecture) void startGeneration(lecture, 'revise', selectedDraft)
            }}
            onApproved={async () => {
              setSelectedDraft(null)
              setMessage('Final revision approved. Review the card and use Publish lecture when ready.')
              await load()
            }}
          />
        )
      })()}
    </div>
  )
}
