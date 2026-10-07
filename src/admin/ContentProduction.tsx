import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Circle, RefreshCw, Search, Workflow } from 'lucide-react'
import { anatomateLectures } from '../data/anatomate'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'

type StageKey = 'outline' | 'slides' | 'images' | 'clinical' | 'mcq' | 'cases' | 'osce' | 'recall' | 'final_qa' | 'publish'
type StageState = 'pending' | 'in_progress' | 'needs_review' | 'complete' | 'blocked'
type OverallState = 'not_started' | 'in_progress' | 'needs_review' | 'ready' | 'published' | 'blocked'

type ProductionRow = {
  lecture_id: string
  academic_year: number
  module_code: string
  lecture_title: string
  overall_status: OverallState
  current_stage: StageKey
  stage_status: Partial<Record<StageKey, StageState>>
  production_notes: string | null
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
  if (STAGES.every(({ key }) => stages[key] === 'complete')) return 'ready'
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
  return value.replaceAll('_', ' ')
}

export default function ContentProduction() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Map<string, ProductionRow>>(new Map())
  const [quality, setQuality] = useState<Map<string, QualityRow>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [year, setYear] = useState(0)
  const [status, setStatus] = useState<'all' | OverallState>('all')

  const load = async () => {
    if (!supabase) return
    setLoading(true)
    setMessage('')

    const [productionResult, qualityResult] = await Promise.all([
      supabase
        .from('content_production')
        .select('lecture_id, academic_year, module_code, lecture_title, overall_status, current_stage, stage_status, production_notes, updated_at'),
      supabase
        .from('content_production_quality_summary')
        .select('lecture_id, mcq_total, mcq_ready, mcq_image_issues, case_total, case_ready, case_image_issues, osce_total, osce_ready, osce_image_issues, spotter_total, spotter_ready'),
    ])

    if (productionResult.error) setMessage(productionResult.error.message)
    if (qualityResult.error) setMessage(qualityResult.error.message)

    setRows(new Map(((productionResult.data || []) as ProductionRow[]).map((row) => [row.lecture_id, row])))
    setQuality(new Map(((qualityResult.data || []) as QualityRow[]).map((row) => [row.lecture_id, row])))
    setLoading(false)
  }

  useEffect(() => {
    void load()
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
      .select('lecture_id, academic_year, module_code, lecture_title, overall_status, current_stage, stage_status, production_notes, updated_at')
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
    const state = lectureState(lecture)
    const currentIndex = STATE_ORDER.indexOf(state.stages[key])
    const nextValue = STATE_ORDER[(currentIndex + 1) % STATE_ORDER.length]
    const next = { ...state.stages, [key]: nextValue }
    await saveStages(lecture, next, key)
  }

  const markReady = async (lecture: (typeof anatomateLectures)[number]) => {
    const next = emptyStages()
    STAGES.forEach(({ key }) => { next[key] = key === 'publish' ? 'pending' : 'complete' })
    await saveStages(lecture, next, 'publish')
  }

  const totalStarted = anatomateLectures.filter((lecture) => lectureState(lecture).overall !== 'not_started').length
  const totalReady = anatomateLectures.filter((lecture) => ['ready', 'published'].includes(lectureState(lecture).overall)).length
  const totalReview = anatomateLectures.filter((lecture) => lectureState(lecture).overall === 'needs_review').length
  const totalBlocked = anatomateLectures.filter((lecture) => lectureState(lecture).overall === 'blocked').length

  return (
    <div className="productiontracker">
      <div className="adminpanel">
        <div className="adminpanelhead">
          <div>
            <span className="eyebrow">ANATOMATE CONTENT ENGINE</span>
            <h2>Lecture Production</h2>
            <p>One workflow for every lecture: Outline → Slides → Images → Clinical → MCQ → Cases → OSCE → Recall → Final QA → Publish.</p>
          </div>
          <button className="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>

        <div className="productionstats">
          <div><small>STARTED</small><strong>{totalStarted}</strong><span>of {anatomateLectures.length}</span></div>
          <div><small>READY / PUBLISHED</small><strong>{totalReady}</strong><span>production complete</span></div>
          <div><small>NEEDS REVIEW</small><strong>{totalReview}</strong><span>QA attention</span></div>
          <div><small>BLOCKED</small><strong>{totalBlocked}</strong><span>needs intervention</span></div>
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
                    disabled={saving === lecture.id}
                    title="Tap to cycle stage status"
                    onClick={() => void cycleStage(lecture, stage.key)}
                  >
                    {state.stages[stage.key] === 'complete' ? <Check size={14}/> : <Circle size={12}/>}
                    <span>{stage.label}</span>
                  </button>
                ))}
              </div>

              <div className="productionqa">
                <div><small>MCQ</small><strong>{qa?.mcq_ready || 0}/{qa?.mcq_total || 0}</strong><span>ready</span></div>
                <div><small>CASES</small><strong>{qa?.case_ready || 0}/{qa?.case_total || 0}</strong><span>ready</span></div>
                <div><small>OSCE / OSPE</small><strong>{qa?.osce_ready || 0}/{qa?.osce_total || 0}</strong><span>ready</span></div>
                <div className={imageIssues ? 'issue' : 'ok'}><small>IMAGE QA</small><strong>{imageIssues}</strong><span>{imageIssues ? 'issues' : 'clear'}</span></div>
              </div>

              <div className="productionactions">
                <span><Workflow size={16}/>Current: <b>{STAGES.find((stage) => stage.key === state.current)?.label || state.current}</b></span>
                <div>
                  <button className="secondary" disabled={saving === lecture.id} onClick={() => void markReady(lecture)}>Complete through QA</button>
                  <button className="primary" disabled={saving === lecture.id || state.overall === 'published'} onClick={() => void continueLecture(lecture)}>
                    {saving === lecture.id ? 'Saving…' : state.overall === 'not_started' ? 'Start production' : 'Continue production'}<ChevronRight size={16}/>
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {!loading && !filtered.length && (
        <div className="adminpanel productionempty">No lectures match the current filters.</div>
      )}
    </div>
  )
}
