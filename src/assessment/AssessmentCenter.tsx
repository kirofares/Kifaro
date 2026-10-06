import { useEffect, useMemo, useState } from 'react'
import { Activity, CheckCircle2, ChevronRight, Clock3, Eye, FileQuestion, RotateCcw, Stethoscope } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useLang, useTr } from '../i18n'

type AssessmentType = 'case' | 'osce' | 'ospe' | 'spotter'
type ChoiceQuestion = {
  prompt: string
  options: string[]
  answer: number
  explanation?: string
}
type ChecklistItem = { label: string; marks: number }
type AssessmentContent = {
  questions?: ChoiceQuestion[]
  checklist?: ChecklistItem[]
  key_points?: string[]
}
type AssessmentItem = {
  id: string
  assessment_type: AssessmentType
  year: number
  module_code: string
  lecture_id: string | null
  title: string
  stem: string
  instructions: string | null
  media_url: string | null
  media_alt: string | null
  difficulty: number
  time_limit_seconds: number | null
  content: AssessmentContent
}

function useAssessmentItems(types?: AssessmentType[]) {
  const [items, setItems] = useState<AssessmentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setItems([])
      setLoading(false)
      return
    }
    let query = supabase
      .from('assessment_items')
      .select('id, assessment_type, year, module_code, lecture_id, title, stem, instructions, media_url, media_alt, difficulty, time_limit_seconds, content')
      .eq('published', true)
      .order('year')
      .order('module_code')
      .order('created_at')

    if (types?.length) query = query.in('assessment_type', types)

    query.then(({ data }) => {
      setItems((data || []) as AssessmentItem[])
      setLoading(false)
    })
  }, [types?.join('|')])

  return { items, loading }
}

function AssessmentListPage({ types, titleEn, titleAr, bodyEn, bodyAr }: {
  types: AssessmentType[]
  titleEn: string
  titleAr: string
  bodyEn: string
  bodyAr: string
}) {
  const nav = useNavigate()
  const tr = useTr()
  const { items, loading } = useAssessmentItems(types)

  const grouped = useMemo(() => {
    const map = new Map<string, AssessmentItem[]>()
    for (const item of items) {
      const key = `Year ${item.year} · ${item.module_code}`
      map.set(key, [...(map.get(key) || []), item])
    }
    return Array.from(map.entries())
  }, [items])

  return (
    <div className="page assessmentpage">
      <div className="pagehead">
        <div>
          <span className="eyebrow">KIFARO ASSESSMENTS</span>
          <h1>{tr(titleEn, titleAr)}</h1>
          <p>{tr(bodyEn, bodyAr)}</p>
        </div>
      </div>

      {loading ? <div className="assessmentempty">{tr('Loading assessments…', 'جارٍ تحميل التقييمات…')}</div> : grouped.length ? (
        <div className="assessmentgroups">
          {grouped.map(([group, groupItems]) => (
            <section className="assessmentgroup" key={group}>
              <div className="assessmentgrouphead"><h2>{group}</h2><span>{groupItems.length}</span></div>
              <div className="assessmentcards">
                {groupItems.map((item) => (
                  <button key={item.id} className="assessmentcard" onClick={() => nav('/assessments/item/' + item.id)}>
                    <div className="assessmenticon">
                      {item.assessment_type === 'case' ? <Activity /> : item.assessment_type === 'spotter' ? <Eye /> : <Stethoscope />}
                    </div>
                    <div className="grow">
                      <small>{item.assessment_type.toUpperCase()} · {item.time_limit_seconds ? Math.ceil(item.time_limit_seconds / 60) + ' min' : tr('Untimed', 'بدون وقت')}</small>
                      <h3>{item.title}</h3>
                      <p>{item.stem}</p>
                    </div>
                    <ChevronRight />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : <div className="assessmentempty">{tr('No published assessments yet.', 'لا توجد تقييمات منشورة حتى الآن.')}</div>}
    </div>
  )
}

export function AssessmentCenterPage() {
  const nav = useNavigate()
  const tr = useTr()
  const cards = [
    { path: '/mcq', icon: <FileQuestion />, title: tr('MCQ Bank', 'بنك MCQ'), body: tr('Lecture-based questions with mastery tracking and weak-topic reports.', 'أسئلة حسب المحاضرة مع قياس المستوى وتحديد نقاط الضعف.') },
    { path: '/cases', icon: <Activity />, title: tr('Clinical Cases', 'الحالات السريرية'), body: tr('Apply anatomy to short clinical scenarios and localization.', 'طبّق التشريح على سيناريوهات سريرية قصيرة وتحديد موضع المشكلة.') },
    { path: '/osce', icon: <Stethoscope />, title: 'OSCE / OSPE', body: tr('Timed stations, practical checklists and structured self-assessment.', 'محطات بوقت وقوائم تقييم عملية وتقييم ذاتي منظم.') },
    { path: '/spotters', icon: <Eye />, title: tr('Image Spotters', 'السبوتر والصور'), body: tr('Identify structures on images, specimens and radiology-style prompts.', 'تعرّف على التراكيب من الصور والعينات والأسئلة الشبيهة بالأشعة.') },
    { path: '/viva-bank', icon: <FileQuestion />, title: tr('Viva', 'الفايفا'), body: tr('Oral-style recall with structured criteria and hints.', 'أسئلة شفهية منظمة مع معايير تقييم وتلميحات.') },
  ]

  return (
    <div className="page assessmentpage">
      <div className="pagehead"><div><span className="eyebrow">KIFARO ASSESSMENT CENTER</span><h1>{tr('Assessment Center', 'مركز التقييم')}</h1><p>{tr('One place for knowledge, application, practical skills and image recognition.', 'مكان واحد لتقييم المعرفة والتطبيق والمهارات العملية والتعرف على الصور.')}</p></div></div>
      <div className="assessmenthubgrid">
        {cards.map((card) => <button key={card.path} className="assessmenthubcard" onClick={() => nav(card.path)}><div>{card.icon}</div><h2>{card.title}</h2><p>{card.body}</p><span>{tr('Open', 'فتح')} <ChevronRight size={16}/></span></button>)}
      </div>
    </div>
  )
}

export function CasesPage() {
  return <AssessmentListPage types={['case']} titleEn="Clinical Cases" titleAr="الحالات السريرية" bodyEn="Short scenarios that test anatomical reasoning, localization and clinical relevance." bodyAr="سيناريوهات قصيرة تقيس التفكير التشريحي وتحديد موضع المشكلة والربط السريري." />
}

export function OSCEPage() {
  return <AssessmentListPage types={['osce','ospe']} titleEn="OSCE / OSPE Stations" titleAr="محطات OSCE / OSPE" bodyEn="Timed structured stations with practical checklists and key points." bodyAr="محطات منظمة بوقت مع قوائم تقييم عملية ونقاط أساسية." />
}

export function SpottersPage() {
  return <AssessmentListPage types={['spotter']} titleEn="Image Spotters" titleAr="السبوتر والصور" bodyEn="Practice recognition of structures from images, specimens and labeled views." bodyAr="تدرب على التعرف على التراكيب من الصور والعينات والمناظر التشريحية." />
}

export function VivaBankPage() {
  const nav = useNavigate()
  const tr = useTr()
  const lectures = anatomateLectures.filter((lecture) => Boolean(getVivaDeck(lecture.id)))

  return (
    <div className="page assessmentpage">
      <div className="pagehead"><div><span className="eyebrow">KIFARO VIVA</span><h1>{tr('Viva Practice', 'تدريب الفايفا')}</h1><p>{tr('Oral-style recall linked to lecture content.', 'تدريب شفهي مرتبط بمحتوى المحاضرات.')}</p></div></div>
      <div className="assessmentcards">
        {lectures.map((lecture) => (
          <button key={lecture.id} className="assessmentcard" onClick={() => nav('/anatomate/lecture/' + lecture.slug + '/viva')}>
            <div className="assessmenticon"><FileQuestion /></div>
            <div className="grow"><small>YEAR {lecture.year} · {lecture.module}</small><h3>{lecture.title}</h3><p>{tr('Open viva practice', 'افتح تدريب الفايفا')}</p></div>
            <ChevronRight />
          </button>
        ))}
      </div>
    </div>
  )
}

export function AssessmentItemPage() {
  const { id } = useParams()
  const tr = useTr()
  const lang = useLang()
  const { user } = useAuth()
  const [item, setItem] = useState<AssessmentItem | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [timerStarted, setTimerStarted] = useState(false)

  useEffect(() => {
    if (!supabase || !id) return
    supabase
      .from('assessment_items')
      .select('id, assessment_type, year, module_code, lecture_id, title, stem, instructions, media_url, media_alt, difficulty, time_limit_seconds, content')
      .eq('id', id)
      .eq('published', true)
      .maybeSingle()
      .then(({ data }) => {
        const next = (data || null) as AssessmentItem | null
        setItem(next)
        setSecondsLeft(next?.time_limit_seconds ?? null)
      })
  }, [id])

  useEffect(() => {
    if (!timerStarted || submitted || secondsLeft === null || secondsLeft <= 0) return
    const timer = window.setInterval(() => setSecondsLeft((value) => value === null ? null : Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [timerStarted, submitted, secondsLeft])

  useEffect(() => {
    if (timerStarted && secondsLeft === 0 && !submitted) void finish()
  }, [secondsLeft, timerStarted, submitted])

  if (!item) return <div className="page"><div className="assessmentempty">{tr('Loading station…', 'جارٍ تحميل المحطة…')}</div></div>

  const questions = item.content?.questions || []
  const checklist = item.content?.checklist || []
  const autoScore = questions.reduce((sum, q, index) => sum + (answers[index] === q.answer ? 1 : 0), 0)
  const checklistScore = checklist.reduce((sum, row, index) => sum + (checked[index] ? Number(row.marks || 0) : 0), 0)
  const maxScore = questions.length + checklist.reduce((sum, row) => sum + Number(row.marks || 0), 0)
  const score = autoScore + checklistScore

  async function finish() {
    setSubmitted(true)
    if (supabase && user) {
      await supabase.from('assessment_attempts').insert({
        user_id: user.id,
        assessment_item_id: item!.id,
        score,
        max_score: maxScore,
        details: { answers, checklist: checked },
      })
    }
  }

  const minutes = secondsLeft === null ? null : Math.floor(secondsLeft / 60)
  const seconds = secondsLeft === null ? null : secondsLeft % 60

  return (
    <div className="page assessmentpage">
      <div className="assessmentstationhead">
        <div><span className="eyebrow">YEAR {item.year} · {item.module_code} · {item.assessment_type.toUpperCase()}</span><h1>{item.title}</h1></div>
        {secondsLeft !== null && <div className={secondsLeft < 60 ? 'stationtimer urgent' : 'stationtimer'}><Clock3/><strong>{minutes}:{String(seconds).padStart(2,'0')}</strong></div>}
      </div>

      {!timerStarted && item.time_limit_seconds ? (
        <div className="stationstart"><h2>{tr('Ready to start?', 'جاهز تبدأ؟')}</h2><p>{item.instructions || tr('Read the station carefully and complete it before time ends.', 'اقرأ المحطة جيدًا وأكملها قبل انتهاء الوقت.')}</p><button className="primary" onClick={() => setTimerStarted(true)}>{tr('Start station', 'ابدأ المحطة')}</button></div>
      ) : (
        <>
          <section className="stationstem">
            <p>{item.stem}</p>
            {item.media_url && <figure><img src={item.media_url} alt={item.media_alt || item.title}/>{item.media_alt && <figcaption>{item.media_alt}</figcaption>}</figure>}
          </section>

          {questions.length > 0 && <div className="stationquestions">
            {questions.map((q, index) => <section key={index} className="stationquestion"><h3>Q{index+1}. {q.prompt}</h3><div className="stationoptions">{q.options.map((option, optionIndex) => <button key={option} disabled={submitted} className={answers[index] === optionIndex ? 'selected' : ''} onClick={() => setAnswers((state) => ({...state,[index]:optionIndex}))}><span>{String.fromCharCode(65+optionIndex)}</span>{option}</button>)}</div>{submitted && <div className={answers[index] === q.answer ? 'stationfeedback correct' : 'stationfeedback'}>{q.explanation || (answers[index] === q.answer ? tr('Correct', 'صحيح') : tr('Review this point', 'راجع هذه النقطة'))}</div>}</section>)}
          </div>}

          {checklist.length > 0 && <section className="stationchecklist"><h2>{tr('Station checklist', 'قائمة تقييم المحطة')}</h2><p>{tr('For practice mode, tick each step you completed correctly.', 'في وضع التدريب علّم على كل خطوة نفذتها بصورة صحيحة.')}</p>{checklist.map((row,index)=><label key={index}><input type="checkbox" disabled={submitted} checked={Boolean(checked[index])} onChange={(e)=>setChecked((state)=>({...state,[index]:e.target.checked}))}/><span>{row.label}</span><strong>{row.marks}</strong></label>)}</section>}

          {!submitted ? <div className="stationactions"><button className="primary" onClick={() => void finish()}>{tr('Finish assessment', 'إنهاء التقييم')}</button></div> : <section className="stationresult"><CheckCircle2/><div><small>{tr('Result', 'النتيجة')}</small><strong>{score}/{maxScore}</strong><p>{item.content?.key_points?.length ? tr('Key points to review:', 'نقاط للمراجعة:') + ' ' + item.content.key_points.join(' · ') : tr('Attempt saved to your progress.', 'تم حفظ المحاولة في تقدمك.')}</p></div><button className="secondary" onClick={()=>{setAnswers({});setChecked({});setSubmitted(false);setSecondsLeft(item.time_limit_seconds);setTimerStarted(!item.time_limit_seconds)}}><RotateCcw size={17}/>{tr('Try again', 'إعادة المحاولة')}</button></section>}
        </>
      )}
    </div>
  )
}
