import { useEffect, useMemo, useState } from 'react'
import { Activity, CheckCircle2, ChevronRight, Clock3, Eye, FileQuestion, RotateCcw, Stethoscope } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useLang, useTr } from '../i18n'
import { anatomateLectures, anatomateYears } from '../data/anatomate'
import { getVivaDeck } from '../viva/content'
import { ModuleAccessGate, type ModuleProductType } from '../payments/ModuleAccess'
import { useStudentYear } from '../hooks/useStudentYear'
import { useAdmin } from '../hooks/useAdmin'

type AssessmentType = 'case' | 'osce' | 'ospe' | 'spotter'

function caseLevelName(level: number, ar: boolean) {
  const en = ['','Identify','Explain','Apply','Integrate / Clinical']
  const arLabels = ['','تحديد','تفسير','تطبيق','تكامل / سريري']
  return (ar ? arLabels[level] : en[level]) || String(level)
}
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
      .eq('quality_status', 'ready')
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

function AssessmentListPage({ types, titleEn, titleAr, bodyEn, bodyAr, productType }: {
  types: AssessmentType[]
  titleEn: string
  titleAr: string
  bodyEn: string
  bodyAr: string
  productType?: ModuleProductType
}) {
  const nav = useNavigate()
  const tr = useTr()
  const { user } = useAuth()
  const { isAdmin } = useAdmin(user?.id)
  const { year: studentYear } = useStudentYear()
  const { items, loading } = useAssessmentItems(types)

  const grouped = useMemo(() => {
    const map = new Map<string, { year: number; moduleCode: string; items: AssessmentItem[] }>()
    for (const item of items.filter((row) => isAdmin || !studentYear || row.year === studentYear)) {
      const key = item.year + '::' + item.module_code
      const current = map.get(key) || { year: item.year, moduleCode: item.module_code, items: [] }
      current.items.push(item)
      map.set(key, current)
    }
    return Array.from(map.values())
  }, [items, studentYear, isAdmin])

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
          {grouped.map((group) => (
            <section className="assessmentgroup" key={group.year + '-' + group.moduleCode}>
              <div className="assessmentgrouphead"><h2>Year {group.year} · {group.moduleCode}</h2><span>{group.items.length}</span></div>
              {productType ? <ModuleAccessGate moduleCode={group.moduleCode} productType={productType}><div className="assessmentcards">
                {group.items.map((item) => (
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
              </div></ModuleAccessGate> : <div className="assessmentcards">
                {group.items.map((item) => (
                  <button key={item.id} className="assessmentcard" onClick={() => nav('/assessments/item/' + item.id)}>
                    <div className="assessmenticon">{item.assessment_type === 'case' ? <Activity /> : item.assessment_type === 'spotter' ? <Eye /> : <Stethoscope />}</div>
                    <div className="grow"><small>{item.assessment_type.toUpperCase()} · {item.time_limit_seconds ? Math.ceil(item.time_limit_seconds / 60) + ' min' : tr('Untimed', 'بدون وقت')}</small><h3>{item.title}</h3><p>{item.stem}</p></div><ChevronRight />
                  </button>
                ))}
              </div>}
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
  const nav = useNavigate()
  const tr = useTr()
  const lang = useLang()
  const { user } = useAuth()
  const { isAdmin } = useAdmin(user?.id)
  const { year: studentYear } = useStudentYear()
  const { items, loading } = useAssessmentItems(['case'])
  const caseItems = items.filter((item) => item.assessment_type === 'case')
  const visibleYears = isAdmin
    ? anatomateYears
    : studentYear
      ? anatomateYears.filter((item) => item.year === studentYear)
      : anatomateYears

  return (
    <div className="page assessmentpage casespage">
      <div className="pagehead">
        <div>
          <span className="eyebrow">ANATOMATE CLINICAL CASES</span>
          <h1>{tr('Clinical Cases', 'الحالات السريرية')}</h1>
          <p>{tr(
            'Cases follow the curriculum so you can move from anatomy facts to clinical application lecture by lecture.',
            'الحالات ماشية بنفس ترتيب المنهج عشان تنتقل من المعلومة التشريحية للتطبيق السريري محاضرة بمحاضرة.'
          )}</p>
        </div>
        <div className="casesummary">
          <strong>{caseItems.length}</strong>
          <span>{tr('published cases', 'حالة منشورة')}</span>
        </div>
      </div>

      {loading ? (
        <div className="assessmentempty">{tr('Loading cases…', 'جارٍ تحميل الحالات…')}</div>
      ) : (
        <div className="caseyears">
          {visibleYears.map((year) => {
            const yearCases = caseItems.filter((item) => item.year === year.year)
            return (
              <section className="caseyear" key={year.year}>
                <div className="caseyearhead">
                  <div><span className="yearbadge">YEAR {year.year}</span><h2>{tr('Medical Year ' + year.year, 'السنة الطبية ' + year.year)}</h2></div>
                  <span className="mcqcount">{yearCases.length} {tr('cases', 'حالات')}</span>
                </div>

                <div className="casemodules">
                  {year.modules.map((module) => {
                    const moduleCases = yearCases.filter((item) => item.module_code === module.code)
                    return (
                      <div className="casemodule" key={module.slug}>
                        <div className="casemodulehead">
                          <div><small>{module.code}</small><h3>{module.title}</h3></div>
                          <span>{moduleCases.length}</span>
                        </div>

                        <ModuleAccessGate moduleCode={module.code} productType="cases">
                        <div className="caselectures">
                          {module.lectures.map((lecture) => {
                            const lectureCases = moduleCases.filter((item) => item.lecture_id === lecture.id)
                            return (
                              <div className="caselecture" key={lecture.id}>
                                <div className="caselecturehead">
                                  <div className="lectureseq">{lecture.sequence}</div>
                                  <div><small>{lecture.system}</small><h4>{lecture.title}</h4></div>
                                  <span>{lectureCases.length} {tr('cases', 'حالات')}</span>
                                </div>

                                {lectureCases.length ? (
                                  <div className="casecards">
                                    {lectureCases.map((item) => (
                                      <button key={item.id} className="casecard" onClick={() => nav('/assessments/item/' + item.id)}>
                                        <div className="casecardtop">
                                          <span className={'difficulty d' + item.difficulty}>{tr('Level', 'مستوى')} {item.difficulty}</span>
                                          {item.time_limit_seconds && <span><Clock3 size={14}/>{Math.ceil(item.time_limit_seconds/60)} min</span>}
                                        </div>
                                        <h5>{item.title}</h5>
                                        <p>{item.stem}</p>
                                        <strong>{tr('Open case', 'افتح الحالة')} <ChevronRight size={16}/></strong>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="caseempty">{tr('Cases coming soon for this lecture.', 'سيتم إضافة حالات لهذه المحاضرة قريبًا.')}</div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        </ModuleAccessGate>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function OSCEPage() {
  const nav = useNavigate()
  const tr = useTr()
  const { user } = useAuth()
  const { isAdmin } = useAdmin(user?.id)
  const { year: studentYear } = useStudentYear()
  const { items, loading } = useAssessmentItems(['osce','ospe'])
  const visibleYears = isAdmin
    ? anatomateYears
    : studentYear
      ? anatomateYears.filter((item) => item.year === studentYear)
      : anatomateYears

  return (
    <div className="page assessmentpage">
      <div className="pagehead">
        <div>
          <span className="eyebrow">KIFARO PRACTICAL ASSESSMENT</span>
          <h1>{tr('OSCE / OSPE Stations', 'محطات OSCE / OSPE')}</h1>
          <p>{tr('Unlock practical stations once per module.', 'افتح المحطات العملية مرة واحدة لكل موديول.')}</p>
        </div>
      </div>

      {loading ? <div className="assessmentempty">{tr('Loading stations…', 'جارٍ تحميل المحطات…')}</div> : (
        <div className="assessmentgroups">
          {visibleYears.flatMap((year) => year.modules.map((module) => {
            const moduleItems = items.filter((item) => item.year === year.year && item.module_code === module.code)
            return (
              <section className="assessmentgroup" key={year.year + '-' + module.code}>
                <div className="assessmentgrouphead"><h2>Year {year.year} · {module.code}</h2><span>{moduleItems.length}</span></div>
                <ModuleAccessGate moduleCode={module.code} productType="osce">
                  {moduleItems.length ? (
                    <div className="assessmentcards">
                      {moduleItems.map((item) => (
                        <button key={item.id} className="assessmentcard" onClick={() => nav('/assessments/item/' + item.id)}>
                          <div className="assessmenticon"><Stethoscope /></div>
                          <div className="grow">
                            <small>{item.assessment_type.toUpperCase()} · {item.time_limit_seconds ? Math.ceil(item.time_limit_seconds / 60) + ' min' : tr('Untimed', 'بدون وقت')}</small>
                            <h3>{item.title}</h3><p>{item.stem}</p>
                          </div>
                          <ChevronRight />
                        </button>
                      ))}
                    </div>
                  ) : <div className="caseempty">{tr('Stations coming soon for this module.', 'سيتم إضافة محطات لهذا الموديول قريبًا.')}</div>}
                </ModuleAccessGate>
              </section>
            )
          }))}
        </div>
      )}
    </div>
  )
}

export function SpottersPage() {
  return <AssessmentListPage types={['spotter']} titleEn="Image Spotters" titleAr="السبوتر والصور" bodyEn="Practice recognition of structures from images, specimens and labeled views." bodyAr="تدرب على التعرف على التراكيب من الصور والعينات والمناظر التشريحية." />
}

export function VivaBankPage() {
  const nav = useNavigate()
  const tr = useTr()
  const { user } = useAuth()
  const { isAdmin } = useAdmin(user?.id)
  const { year: studentYear } = useStudentYear()
  const lectures = anatomateLectures.filter((lecture) => (isAdmin || !studentYear || lecture.year === studentYear) && Boolean(getVivaDeck(lecture.id)))

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
  const nav = useNavigate()
  const tr = useTr()
  const lang = useLang()
  const { user } = useAuth()
  const [item, setItem] = useState<AssessmentItem | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [timerStarted, setTimerStarted] = useState(false)
  const [nextItemId, setNextItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !id) return
    supabase
      .from('assessment_items')
      .select('id, assessment_type, year, module_code, lecture_id, title, stem, instructions, media_url, media_alt, difficulty, time_limit_seconds, content')
      .eq('id', id)
      .eq('published', true)
      .eq('quality_status', 'ready')
      .maybeSingle()
      .then(async ({ data }) => {
        const next = (data || null) as AssessmentItem | null
        setItem(next)
        setSecondsLeft(next?.time_limit_seconds ?? null)
        setNextItemId(null)

        if (!next || !supabase) return
        const { data: siblings } = await supabase
          .from('assessment_items')
          .select('id, assessment_type, year, module_code, created_at')
          .eq('published', true)
          .eq('quality_status', 'ready')
          .eq('assessment_type', next.assessment_type)
          .eq('year', next.year)
          .eq('module_code', next.module_code)
          .order('created_at', { ascending: true })

        const list = siblings || []
        const currentIndex = list.findIndex((row) => row.id === next.id)
        if (currentIndex >= 0 && list.length > 1) {
          const following = list[(currentIndex + 1) % list.length]
          setNextItemId(following?.id || null)
        }
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
  const mediaContext = [item.title, item.stem, item.instructions || '', ...questions.map((q) => q.prompt)].join(' ').toLowerCase()
  const shouldShowMedia = Boolean(item.media_url) && /\b(image|figure|shown|specimen|radiograph|x-ray|xray|ct|mri|scan|ultrasound|diagram|photo|photograph|label|arrow|section|micrograph|karyotype)\b/.test(mediaContext)
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
        <div><span className="eyebrow">YEAR {item.year} · {item.module_code} · {item.assessment_type.toUpperCase()}{item.assessment_type === 'case' ? '' : ''}</span><h1>{item.title}</h1></div>
        {secondsLeft !== null && <div className={secondsLeft < 60 ? 'stationtimer urgent' : 'stationtimer'}><Clock3/><strong>{minutes}:{String(seconds).padStart(2,'0')}</strong></div>}
      </div>

      {!timerStarted && item.time_limit_seconds ? (
        <div className="stationstart"><h2>{tr('Ready to start?', 'جاهز تبدأ؟')}</h2><p>{item.instructions || tr('Read the station carefully and complete it before time ends.', 'اقرأ المحطة جيدًا وأكملها قبل انتهاء الوقت.')}</p><button className="primary" onClick={() => setTimerStarted(true)}>{tr('Start station', 'ابدأ المحطة')}</button></div>
      ) : (
        <>
          <section className="stationstem">
            <p>{item.stem}</p>
            {shouldShowMedia && <figure><img src={item.media_url!} alt={item.media_alt || item.title}/>{item.media_alt && <figcaption>{item.media_alt}</figcaption>}</figure>}
          </section>

          {questions.length > 0 && <div className="stationquestions">
            {questions.map((q, index) => <section key={index} className="stationquestion"><h3>Q{index+1}. {q.prompt}</h3><div className="stationoptions">{q.options.map((option, optionIndex) => <button key={option} disabled={submitted} className={answers[index] === optionIndex ? 'selected' : ''} onClick={() => setAnswers((state) => ({...state,[index]:optionIndex}))}><span>{String.fromCharCode(65+optionIndex)}</span>{option}</button>)}</div>{submitted && <div className={answers[index] === q.answer ? 'stationfeedback correct' : 'stationfeedback'}>{q.explanation || (answers[index] === q.answer ? tr('Correct', 'صحيح') : tr('Review this point', 'راجع هذه النقطة'))}</div>}</section>)}
          </div>}

          {checklist.length > 0 && <section className="stationchecklist"><h2>{tr('Station checklist', 'قائمة تقييم المحطة')}</h2><p>{tr('For practice mode, tick each step you completed correctly.', 'في وضع التدريب علّم على كل خطوة نفذتها بصورة صحيحة.')}</p>{checklist.map((row,index)=><label key={index}><input type="checkbox" disabled={submitted} checked={Boolean(checked[index])} onChange={(e)=>setChecked((state)=>({...state,[index]:e.target.checked}))}/><span>{row.label}</span><strong>{row.marks}</strong></label>)}</section>}

          {!submitted ? <div className="stationactions"><button className="primary" onClick={() => void finish()}>{tr('Finish assessment', 'إنهاء التقييم')}</button></div> : <section className="stationresult"><CheckCircle2/><div><small>{tr('Result', 'النتيجة')}</small><strong>{score}/{maxScore}</strong><p>{item.content?.key_points?.length ? tr('Key points to review:', 'نقاط للمراجعة:') + ' ' + item.content.key_points.join(' · ') : tr('Attempt saved to your progress.', 'تم حفظ المحاولة في تقدمك.')}</p></div><div className="stationresultactions"><button className="secondary" onClick={()=>{setAnswers({});setChecked({});setSubmitted(false);setSecondsLeft(item.time_limit_seconds);setTimerStarted(!item.time_limit_seconds)}}><RotateCcw size={17}/>{tr('Try again', 'إعادة المحاولة')}</button>{nextItemId && <button className="primary" onClick={()=>nav('/assessments/item/' + nextItemId)}>{item.assessment_type === 'case' ? tr('Next Case', 'الحالة التالية') : tr('Next Station', 'المحطة التالية')}<ChevronRight size={17}/></button>}</div></section>}
        </>
      )}
    </div>
  )
}
