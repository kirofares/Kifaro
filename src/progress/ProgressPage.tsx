import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Brain, CheckCircle2, ClipboardCheck, Target, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { anatomateLectures, anatomateYears } from '../data/anatomate'
import { useProgress } from '../hooks/useProgress'
import { useMCQBank } from '../mcq/useMCQBank'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useStudentYear } from '../hooks/useStudentYear'
import { useLang, useTr } from '../i18n'

type AssessmentSummary = {
  attempts: number
  average: number
}

export default function ProgressPage() {
  const nav = useNavigate()
  const tr = useTr()
  const lang = useLang()
  const { user } = useAuth()
  const { year: studentYear } = useStudentYear()
  const { progress } = useProgress()
  const { levels, levelPerformance, reviewTargets, mastery } = useMCQBank()
  const [assessmentSummary, setAssessmentSummary] = useState<AssessmentSummary>({ attempts: 0, average: 0 })

  useEffect(() => {
    if (!supabase || !user) {
      setAssessmentSummary({ attempts: 0, average: 0 })
      return
    }

    supabase
      .from('assessment_attempts')
      .select('score,max_score')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const rows = data || []
        const percentages = rows
          .filter((row) => Number(row.max_score) > 0)
          .map((row) => (Number(row.score) / Number(row.max_score)) * 100)
        const average = percentages.length
          ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
          : 0
        setAssessmentSummary({ attempts: rows.length, average })
      })
  }, [user])

  const overallLectureProgress = useMemo(() => {
    const visibleLectures = studentYear ? anatomateLectures.filter((lecture) => lecture.year === studentYear) : anatomateLectures
    if (!visibleLectures.length) return 0
    const total = visibleLectures.reduce((sum, lecture) => sum + Number(progress[lecture.id]?.progress || 0), 0)
    return Math.round(total / visibleLectures.length)
  }, [progress, studentYear])

  const mcqSummary = useMemo(() => {
    const attempts = mastery.reduce((sum, row) => sum + Number(row.attempts || 0), 0)
    const correct = mastery.reduce((sum, row) => sum + Number(row.correct || 0), 0)
    return {
      attempts,
      score: attempts ? Math.round((correct / attempts) * 100) : 0,
    }
  }, [mastery])

  const demonstratedLevel = useMemo(() => {
    const combined = levels.map((level) => {
      const historic = levelPerformance.find((item) => Number(item.difficulty) === level.level_no)
      const attempts = Number(historic?.attempts || 0)
      const correct = Number(historic?.correct || 0)
      const score = attempts ? Math.round((correct / attempts) * 100) : null
      return { ...level, attempts, score }
    })

    return [...combined]
      .reverse()
      .find((item) => item.score !== null && item.attempts >= 3 && Number(item.score) >= Number(item.pass_threshold))
      || combined.find((item) => item.score !== null)
  }, [levels, levelPerformance])

  const weaknesses = useMemo(() => {
    const map = new Map<string, {
      lectureId: string
      topic: string
      subtopic: string | null
      objective: string | null
      attempts: number
      correct: number
      score: number
      difficulty: number
    }>()

    for (const row of reviewTargets) {
      if (Number(row.score) >= 70) continue
      const key = [row.lecture_id, row.learning_objective || row.subtopic || row.topic].join('::')
      const current = map.get(key)
      if (!current || Number(row.score) < current.score) {
        map.set(key, {
          lectureId: row.lecture_id,
          topic: row.topic,
          subtopic: row.subtopic,
          objective: row.learning_objective,
          attempts: Number(row.attempts),
          correct: Number(row.correct),
          score: Number(row.score),
          difficulty: Number(row.difficulty),
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => a.score - b.score).slice(0, 12)
  }, [reviewTargets])

  const yearProgress = useMemo(() => anatomateYears.filter((year) => !studentYear || year.year === studentYear).map((year) => {
    const lectures = year.modules.flatMap((module) => module.lectures)
    const value = lectures.length
      ? Math.round(lectures.reduce((sum, lecture) => sum + Number(progress[lecture.id]?.progress || 0), 0) / lectures.length)
      : 0

    return {
      year: year.year,
      value,
      modules: year.modules.map((module) => {
        const moduleValue = module.lectures.length
          ? Math.round(module.lectures.reduce((sum, lecture) => sum + Number(progress[lecture.id]?.progress || 0), 0) / module.lectures.length)
          : 0
        return { ...module, value: moduleValue }
      }),
    }
  }), [progress, studentYear])

  const lectureFor = (lectureId: string) => anatomateLectures.find((lecture) => lecture.id === lectureId)

  return (
    <div className="page progresspage">
      <div className="pagehead">
        <div>
          <span className="eyebrow">KIFARO STUDENT PROGRESS</span>
          <h1>{tr('Your Progress', 'تقدمك')}</h1>
          <p>{tr(
            'Track learning, MCQ mastery, assessments and the exact points that need review.',
            'تابع مستوى التعلم والـMCQ والتقييمات واعرف بالضبط النقاط التي تحتاج مراجعة.'
          )}</p>
        </div>
      </div>

      <div className="progressmetrics">
        <div className="progressmetric"><BookOpen/><div><strong>{overallLectureProgress}%</strong><span>{tr('Lecture progress', 'تقدم المحاضرات')}</span></div></div>
        <div className="progressmetric"><Brain/><div><strong>{mcqSummary.score}%</strong><span>{tr('MCQ mastery', 'إتقان MCQ')}</span></div></div>
        <div className="progressmetric"><ClipboardCheck/><div><strong>{assessmentSummary.average}%</strong><span>{tr('Assessment average', 'متوسط التقييمات')}</span></div></div>
        <div className="progressmetric"><Target/><div><strong>{demonstratedLevel ? (lang === 'ar' ? demonstratedLevel.short_ar : demonstratedLevel.short_en) : '—'}</strong><span>{tr('Current MCQ level', 'مستوى MCQ الحالي')}</span></div></div>
      </div>

      <section className="progresspanel">
        <div className="progresspanelhead">
          <div><h2>{tr('Weak points', 'نقاط الضعف')}</h2><p>{tr('Every weakness links directly to its lecture and focused MCQ review.', 'كل نقطة ضعف مرتبطة مباشرة بالمحاضرة ومراجعة MCQ مركزة.')}</p></div>
          <span>{weaknesses.length}</span>
        </div>

        {weaknesses.length ? (
          <div className="weaknesslist">
            {weaknesses.map((weakness, index) => {
              const lecture = lectureFor(weakness.lectureId)
              const focus = weakness.objective || weakness.subtopic || weakness.topic
              return (
                <article className="weaknesscard" key={weakness.lectureId + '-' + focus + '-' + index}>
                  <div className="weaknessscore">
                    <strong>{Math.round(weakness.score)}%</strong>
                    <span>{tr('mastery', 'إتقان')}</span>
                  </div>
                  <div className="grow">
                    <small>{lecture ? `Year ${lecture.year} · ${lecture.module}` : weakness.lectureId}</small>
                    <h3>{focus}</h3>
                    <p>{lecture?.title || weakness.topic} · {weakness.correct}/{weakness.attempts} {tr('correct', 'صحيح')}</p>
                  </div>
                  <div className="weaknessactions">
                    {lecture && <button className="secondary" onClick={() => nav('/anatomate/lecture/' + lecture.slug)}><BookOpen size={16}/>{tr('Open lecture', 'افتح المحاضرة')}</button>}
                    {lecture && <button className="primary" onClick={() => nav('/mcq/lecture/' + lecture.slug + '?review=' + encodeURIComponent(focus))}>{tr('Review weakness', 'راجع نقطة الضعف')}<ArrowRight size={16}/></button>}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="progressgood"><CheckCircle2/><div><strong>{tr('No clear weak points yet', 'لا توجد نقاط ضعف واضحة حتى الآن')}</strong><p>{tr('Complete more MCQs to build a more accurate weakness profile.', 'حل المزيد من أسئلة MCQ لبناء تقييم أدق لنقاط الضعف.')}</p></div></div>
        )}
      </section>

      <section className="progresspanel">
        <div className="progresspanelhead"><div><h2>{tr('Curriculum progress', 'تقدم المنهج')}</h2><p>{tr('Progress by academic year and module.', 'التقدم حسب السنة الدراسية والموديول.')}</p></div></div>
        <div className="yearprogresslist">
          {yearProgress.map((year) => (
            <div className="yearprogresscard" key={year.year}>
              <div className="yearprogresshead"><strong>{tr('Year', 'السنة')} {year.year}</strong><span>{year.value}%</span></div>
              <div className="progressbar"><i style={{ width: year.value + '%' }}/></div>
              <div className="moduleprogresslist">
                {year.modules.map((module) => (
                  <button key={module.slug} onClick={() => nav('/anatomate/year/' + year.year + '/module/' + module.slug)}>
                    <span>{module.title}</span>
                    <div><b>{module.value}%</b><ArrowRight size={15}/></div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="progresspanel progressquick">
        <div><TrendingUp/><strong>{mcqSummary.attempts}</strong><span>{tr('MCQ attempts recorded', 'محاولات MCQ مسجلة')}</span></div>
        <div><ClipboardCheck/><strong>{assessmentSummary.attempts}</strong><span>{tr('Assessments completed', 'تقييمات مكتملة')}</span></div>
      </section>
    </div>
  )
}
