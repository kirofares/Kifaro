import { useEffect, useMemo, useState } from 'react'
import { Check, FileUp, Trash2 } from 'lucide-react'
import { anatomateLectures } from '../data/anatomate'
import { supabase } from '../lib/supabase'
import { useMCQBank } from '../mcq/useMCQBank'

type ImportRow = {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A'|'B'|'C'|'D'
  explanation?: string
  topic?: string
  subtopic?: string
  question_type?: string
  difficulty?: number
  source_scope?: string
  learning_objective?: string
  why_a_wrong?: string
  why_b_wrong?: string
  why_c_wrong?: string
  why_d_wrong?: string
}

function parseCsv(text: string): ImportRow[] {
  const rows = text.trim().split(/\r?\n/)
  if (rows.length < 2) return []
  const headers = rows[0].split(',').map((x) => x.trim().replace(/^"|"$/g, ''))
  return rows.slice(1).filter(Boolean).map((line) => {
    const values:string[] = []
    let current = ''
    let quoted = false
    for (let i=0;i<line.length;i+=1) {
      const ch=line[i]
      if (ch === '"') {
        if (quoted && line[i+1] === '"') { current += '"'; i += 1 }
        else quoted = !quoted
      } else if (ch === ',' && !quoted) {
        values.push(current.trim()); current=''
      } else current += ch
    }
    values.push(current.trim())
    const obj:any = {}
    headers.forEach((h,i) => { obj[h] = values[i] ?? '' })
    if (obj.difficulty) obj.difficulty = Number(obj.difficulty)
    obj.correct_option = String(obj.correct_option || '').trim().toUpperCase()
    return obj as ImportRow
  })
}

function normalizeRows(raw: unknown): ImportRow[] {
  const rows = Array.isArray(raw) ? raw : []
  return rows.map((item:any) => ({
    question_text: String(item.question_text || item.question || '').trim(),
    option_a: String(item.option_a || item.options?.[0] || '').trim(),
    option_b: String(item.option_b || item.options?.[1] || '').trim(),
    option_c: String(item.option_c || item.options?.[2] || '').trim(),
    option_d: String(item.option_d || item.options?.[3] || '').trim(),
    correct_option: String(item.correct_option || ['A','B','C','D'][Number(item.answer)] || '').toUpperCase() as 'A'|'B'|'C'|'D',
    explanation: String(item.explanation || '').trim(),
    topic: String(item.topic || '').trim(),
    subtopic: String(item.subtopic || '').trim(),
    question_type: String(item.question_type || 'single-best-answer').trim(),
    difficulty: Number(item.difficulty || 2),
    source_scope: String(item.source_scope || 'AnatoMate').trim(),
    learning_objective: String(item.learning_objective || '').trim(),
    image_url: String(item.image_url || '').trim(),
    image_alt: String(item.image_alt || '').trim(),
    why_a_wrong: String(item.why_a_wrong || item.distractor_explanations?.A || '').trim(),
    why_b_wrong: String(item.why_b_wrong || item.distractor_explanations?.B || '').trim(),
    why_c_wrong: String(item.why_c_wrong || item.distractor_explanations?.C || '').trim(),
    why_d_wrong: String(item.why_d_wrong || item.distractor_explanations?.D || '').trim(),
  })).filter((q) =>
    q.question_text && q.option_a && q.option_b && q.option_c && q.option_d &&
    ['A','B','C','D'].includes(q.correct_option)
  )
}

type CoverageRow = {
  lecture_id: string
  learning_points: number
  fully_covered: number
  missing_l1: number
  missing_l2: number
  missing_l3: number
  missing_l4: number
  coverage_percent: number
}

export default function MCQManager() {
  const [lectureId,setLectureId]=useState('')
  const [rows,setRows]=useState<ImportRow[]>([])
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [coverage,setCoverage]=useState<CoverageRow[]>([])
  const { countsByLecture, refreshQuestions } = useMCQBank()

  const selectedLecture = useMemo(() => anatomateLectures.find((l) => l.id === lectureId), [lectureId])

  const refreshCoverage = async () => {
    if (!supabase) return
    const { data } = await supabase.rpc('get_mcq_coverage_summary')
    setCoverage((data || []) as CoverageRow[])
  }

  useEffect(() => {
    void refreshCoverage()
  }, [])

  const readFile = async (file?: File) => {
    if (!file) return
    setMessage('')
    const text = await file.text()
    try {
      const parsed = file.name.toLowerCase().endsWith('.csv') ? parseCsv(text) : normalizeRows(JSON.parse(text))
      const normalized = file.name.toLowerCase().endsWith('.csv') ? normalizeRows(parsed) : parsed
      setRows(normalized)
      setMessage(normalized.length ? normalized.length + ' valid questions ready to import.' : 'No valid questions found.')
    } catch (error) {
      setRows([])
      setMessage(error instanceof Error ? error.message : 'Could not parse this file.')
    }
  }

  const upload = async () => {
    if (!supabase || !lectureId || !rows.length) return
    setBusy(true)
    setMessage('')
    const payload = rows.map((q) => ({
      lecture_id: lectureId,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      explanation: q.explanation || '',
      topic: q.topic || selectedLecture?.title || '',
      subtopic: q.subtopic || null,
      question_type: q.question_type || 'single-best-answer',
      difficulty: Math.min(4, Math.max(1, Number(q.difficulty || 2))),
      source_scope: q.source_scope || 'AnatoMate',
      learning_objective: q.learning_objective || null,
      distractor_explanations: {
        A: q.why_a_wrong || '', B: q.why_b_wrong || '', C: q.why_c_wrong || '', D: q.why_d_wrong || '',
      },
      published: true,
    }))
    const { error } = await supabase.from('mcq_questions').insert(payload)
    if (error) setMessage(error.message)
    else {
      setMessage(payload.length + ' MCQs uploaded and published.')
      setRows([])
      await refreshQuestions()
      await refreshCoverage()
    }
    setBusy(false)
  }

  return (
    <div className="adminpanel">
      <div className="adminpanelhead">
        <div>
          <h2>MCQ Bank Manager</h2>
          <p>Upload JSON or CSV once. Questions appear automatically under Year → Module → Lecture.</p>
        </div>
      </div>

      <div className="adminformgrid">
        <label className="adminformwide">
          Lecture
          <select value={lectureId} onChange={(e) => setLectureId(e.target.value)}>
            <option value="">Select lecture…</option>
            {anatomateLectures.map((lecture) => (
              <option key={lecture.id} value={lecture.id}>
                Year {lecture.year} · {lecture.module} · {lecture.title} · {countsByLecture.get(lecture.id) || 0} MCQs
              </option>
            ))}
          </select>
        </label>

        <label className="adminformwide">
          MCQ file (.json or .csv)
          <input type="file" accept=".json,.csv,application/json,text/csv" onChange={(e) => void readFile(e.target.files?.[0])}/>
        </label>
      </div>

      {rows.length > 0 && (
        <div className="mcqimportpreview">
          <div><strong>{rows.length}</strong><span>questions ready</span></div>
          <div><strong>{new Set(rows.map((q) => q.topic || selectedLecture?.title)).size}</strong><span>topics</span></div>
          <div><strong>{rows.filter((q) => q.difficulty === 3).length}</strong><span>hard questions</span></div>
        </div>
      )}

      {message && <div className="adminmessage"><Check size={17}/>{message}</div>}

      <div className="adminquick">
        <button className="primary" disabled={!lectureId || !rows.length || busy} onClick={() => void upload()}>
          <FileUp size={17}/>{busy ? 'Uploading…' : 'Upload & publish'}
        </button>
        <button className="secondary" disabled={!rows.length} onClick={() => { setRows([]); setMessage('') }}>
          <Trash2 size={17}/>Clear
        </button>
      </div>

      <p className="adminhint">
        Required columns: question_text, option_a, option_b, option_c, option_d, correct_option. Optional: explanation, topic, subtopic, difficulty (1–4), learning_objective, question_type, source_scope, why_a_wrong, why_b_wrong, why_c_wrong, why_d_wrong.
      </p>

      <div className="mcqcoverage">
        <div className="adminpanelhead">
          <div>
            <h3>Coverage Audit</h3>
            <p>A lecture is complete only when every learning point has Know, Understand, Apply, and Integrate/Clinical coverage.</p>
          </div>
          <button className="secondary" onClick={() => void refreshCoverage()}>Refresh audit</button>
        </div>
        <div className="admintablewrap">
          <table className="admintable">
            <thead><tr><th>Lecture</th><th>Points</th><th>L1</th><th>L2</th><th>L3</th><th>L4</th><th>Coverage</th></tr></thead>
            <tbody>
              {coverage.length ? coverage.map((row) => {
                const lecture = anatomateLectures.find((l) => l.id === row.lecture_id)
                return (
                  <tr key={row.lecture_id}>
                    <td><strong>{lecture?.title || row.lecture_id}</strong><small>{lecture ? 'Year ' + lecture.year : row.lecture_id}</small></td>
                    <td>{row.learning_points}</td>
                    <td className={Number(row.missing_l1) === 0 ? 'coverageok' : 'coveragebad'}>{Number(row.missing_l1) === 0 ? 'Complete' : row.missing_l1 + ' missing'}</td>
                    <td className={Number(row.missing_l2) === 0 ? 'coverageok' : 'coveragebad'}>{Number(row.missing_l2) === 0 ? 'Complete' : row.missing_l2 + ' missing'}</td>
                    <td className={Number(row.missing_l3) === 0 ? 'coverageok' : 'coveragebad'}>{Number(row.missing_l3) === 0 ? 'Complete' : row.missing_l3 + ' missing'}</td>
                    <td className={Number(row.missing_l4) === 0 ? 'coverageok' : 'coveragebad'}>{Number(row.missing_l4) === 0 ? 'Complete' : row.missing_l4 + ' missing'}</td>
                    <td><span className={Number(row.coverage_percent) === 100 ? 'readinessbadge ready' : 'readinessbadge missing'}>{Number(row.coverage_percent).toFixed(0)}%</span></td>
                  </tr>
                )
              }) : <tr><td colSpan={7}>No coverage data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
