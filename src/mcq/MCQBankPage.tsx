import { useMemo, useState } from 'react'
import { BookOpenCheck, CheckCircle2, ChevronRight, CircleHelp, RotateCcw, Target, TrendingUp } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { anatomateYears, getLectureBySlug } from '../data/anatomate'
import { useLang, useTr } from '../i18n'
import { useMCQBank, type BankQuestion } from './useMCQBank'

function questionCount(lectureId: string, fallback: number, counts: Map<string, number>) {
  return counts.get(lectureId) || fallback
}

export function MCQBankPage() {
  const nav = useNavigate()
  const tr = useTr()
  const { countsByLecture, mastery } = useMCQBank()

  const overall = useMemo(() => {
    const attempts = mastery.reduce((sum, row) => sum + Number(row.attempts || 0), 0)
    const correct = mastery.reduce((sum, row) => sum + Number(row.correct || 0), 0)
    return attempts ? Math.round((correct / attempts) * 100) : 0
  }, [mastery])

  return (
    <div className="page mcqpage">
      <div className="pagehead">
        <div>
          <span className="eyebrow">ANATOMATE MCQ BANK</span>
          <h1>{tr('MCQ Bank', 'بنك أسئلة MCQ')}</h1>
          <p>{tr(
            'Practice questions organized exactly like your curriculum: academic year, module, then lecture.',
            'تدرب على الأسئلة بنفس تقسيم المنهج: السنة الدراسية ثم الموديول ثم المحاضرة.'
          )}</p>
        </div>
        <div className="mcqoverall"><TrendingUp/><div><strong>{overall}%</strong><span>{tr('Overall mastery', 'المستوى العام')}</span></div></div>
      </div>

      <div className="mcqyeargrid">
        {anatomateYears.map((year) => {
          const total = year.modules.reduce((sum, module) => sum + module.lectures.reduce((n, lecture) => n + questionCount(lecture.id, lecture.mcqs.length, countsByLecture), 0), 0)
          return (
            <section className="mcqyearcard" key={year.year}>
              <div className="mcqyearhead">
                <div>
                  <span className="yearbadge">YEAR {year.year}</span>
                  <h2>{tr('Medical Year ' + year.year, 'السنة الطبية ' + year.year)}</h2>
                </div>
                <span className="mcqcount">{total} MCQ</span>
              </div>

              <div className="mcqmodulelist">
                {year.modules.map((module) => {
                  const count = module.lectures.reduce((sum, lecture) => sum + questionCount(lecture.id, lecture.mcqs.length, countsByLecture), 0)
                  return (
                    <button key={module.slug} className="mcqmodulecard" onClick={() => nav('/mcq/year/' + year.year + '/module/' + module.slug)}>
                      <div>
                        <small>{module.code} · {module.lectures.length} {tr('lectures', 'محاضرة')}</small>
                        <h3>{module.title}</h3>
                        <p>{module.description}</p>
                      </div>
                      <div className="mcqmodulemeta"><span>{count} MCQ</span><ChevronRight /></div>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

export function MCQModulePage() {
  const { year, module } = useParams()
  const nav = useNavigate()
  const tr = useTr()
  const { countsByLecture, mastery } = useMCQBank()
  const yearData = anatomateYears.find((item) => String(item.year) === year)
  const moduleData = yearData?.modules.find((item) => item.slug === module)

  if (!yearData || !moduleData) {
    return <div className="page"><div className="pagehead"><div><span className="eyebrow">MCQ BANK</span><h1>{tr('Module not found', 'الموديول غير موجود')}</h1></div></div></div>
  }

  const total = moduleData.lectures.reduce((sum, lecture) => sum + questionCount(lecture.id, lecture.mcqs.length, countsByLecture), 0)

  return (
    <div className="page mcqpage">
      <div className="pagehead">
        <div><span className="eyebrow">YEAR {yearData.year} · MCQ BANK</span><h1>{moduleData.title}</h1><p>{tr('Choose a lecture to start its question set.', 'اختر المحاضرة لبدء مجموعة الأسئلة الخاصة بها.')}</p></div>
        <span className="mcqcount large">{total} MCQ</span>
      </div>

      <div className="mcqlecturelist">
        {moduleData.lectures.map((lecture) => {
          const rows = mastery.filter((row) => row.lecture_id === lecture.id)
          const attempts = rows.reduce((sum, row) => sum + Number(row.attempts || 0), 0)
          const correct = rows.reduce((sum, row) => sum + Number(row.correct || 0), 0)
          const score = attempts ? Math.round((correct / attempts) * 100) : null
          const count = questionCount(lecture.id, lecture.mcqs.length, countsByLecture)
          return (
            <button key={lecture.id} className="mcqlecturecard" onClick={() => nav('/mcq/lecture/' + lecture.slug)}>
              <div className="lectureseq">{lecture.sequence}</div>
              <div className="grow"><small>{lecture.system}</small><h3>{lecture.title}</h3><p>{count} {count === 1 ? 'MCQ' : 'MCQs'}</p></div>
              {score !== null && <span className="mcqlecturemastery">{score}%</span>}
              <ChevronRight />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function MCQLecturePage() {
  const { slug } = useParams()
  const tr = useTr()
  const lang = useLang()
  const lecture = getLectureBySlug(slug)
  const { questions: bankQuestions, stages, mastery, recordAttempt, refreshMastery } = useMCQBank()
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)

  const dbQuestions = useMemo(() => lecture ? bankQuestions.filter((q) => q.lecture_id === lecture.id) : [], [bankQuestions, lecture])
  const questions = useMemo(() => {
    if (!lecture) return []
    if (dbQuestions.length) return dbQuestions.map((q) => ({
      id: q.id,
      topic: q.topic || lecture.title,
      subtopic: q.subtopic,
      question: q.question_text,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      answer: ['A','B','C','D'].indexOf(q.correct_option),
      explanation: q.explanation,
      source: q,
    }))
    return lecture.mcqs.map((q) => ({ ...q, id: '', topic: lecture.title, subtopic: null, source: null as BankQuestion | null }))
  }, [lecture, dbQuestions])

  const score = useMemo(() => questions.reduce((sum, question, index) => sum + (answers[index] === question.answer ? 1 : 0), 0), [questions, answers])
  const percent = questions.length ? Math.round((score / questions.length) * 100) : 0
  const stage = stages.find((item) => percent >= Number(item.min_score) && percent <= Number(item.max_score)) || stages[0]

  const weakTopics = useMemo(() => {
    const map = new Map<string, { wrong: number; total: number }>()
    questions.forEach((question, index) => {
      const key = question.subtopic || question.topic || lecture?.title || 'Review'
      const item = map.get(key) || { wrong: 0, total: 0 }
      item.total += 1
      if (answers[index] !== question.answer) item.wrong += 1
      map.set(key, item)
    })
    mastery.filter((row) => row.lecture_id === lecture?.id && Number(row.score) < 70).forEach((row) => {
      const item = map.get(row.topic) || { wrong: 0, total: 0 }
      item.wrong += Math.max(1, Number(row.attempts) - Number(row.correct))
      item.total += Math.max(1, Number(row.attempts))
      map.set(row.topic, item)
    })
    return Array.from(map.entries())
      .filter(([, value]) => value.wrong > 0)
      .sort((a, b) => (b[1].wrong / b[1].total) - (a[1].wrong / a[1].total))
      .slice(0, 6)
  }, [questions, answers, mastery, lecture])

  if (!lecture) {
    return <div className="page"><div className="pagehead"><div><span className="eyebrow">MCQ BANK</span><h1>{tr('Lecture not found', 'المحاضرة غير موجودة')}</h1></div></div></div>
  }

  const submit = async () => {
    setSubmitted(true)
    await Promise.all(questions.map((question, index) => {
      if (!question.source) return Promise.resolve()
      const option = String.fromCharCode(65 + answers[index]) as 'A'|'B'|'C'|'D'
      return recordAttempt(question.source, option)
    }))
    await refreshMastery()
  }

  const reset = () => {
    setAnswers({})
    setSubmitted(false)
  }

  return (
    <div className="page mcqpage">
      <div className="pagehead mcqlecturehead">
        <div><span className="eyebrow">YEAR {lecture.year} · {lecture.module}</span><h1>{lecture.title}</h1><p>{tr('Lecture MCQ practice', 'تدريب MCQ للمحاضرة')} · {questions.length} {questions.length === 1 ? 'question' : 'questions'}</p></div>
        {submitted && <div className="mcqscore"><strong>{score}/{questions.length}</strong><span>{tr('Score', 'النتيجة')}</span></div>}
      </div>

      {submitted && stage && (
        <section className="mcqprogressreport">
          <div className="mcqstagebadge"><Target/><div><small>{tr('Your MCQ stage', 'مرحلتك في MCQ')}</small><strong>{lang === 'ar' ? stage.label_ar : stage.label_en}</strong></div><span>{percent}%</span></div>
          <div className="mcqstagetrack">
            {stages.map((item) => <div key={item.stage_no} className={item.stage_no <= stage.stage_no ? 'active' : ''}><span>{item.stage_no}</span><small>{lang === 'ar' ? item.label_ar : item.label_en}</small></div>)}
          </div>
          <p>{lang === 'ar' ? stage.description_ar : stage.description_en}</p>

          <div className="mcqweakbox">
            <h3>{tr('Topics to review', 'المعلومات التي تحتاج مراجعة')}</h3>
            {weakTopics.length ? (
              <div className="mcqweaktopics">{weakTopics.map(([topic, value]) => <div key={topic}><strong>{topic}</strong><span>{Math.round((value.wrong / value.total) * 100)}% {tr('needs review', 'تحتاج مراجعة')}</span></div>)}</div>
            ) : <p>{tr('No clear weak topic in this attempt. Keep revising to maintain mastery.', 'لا توجد نقطة ضعف واضحة في هذه المحاولة. استمر في المراجعة للحفاظ على المستوى.')}</p>}
          </div>
        </section>
      )}

      <div className="mcqquestions">
        {questions.map((question, qIndex) => {
          const selected = answers[qIndex]
          const isCorrect = selected === question.answer
          return (
            <section className="mcqquestion" key={question.id || qIndex}>
              <div className="mcqqhead"><span>Q{qIndex + 1}</span><div><h2>{question.question}</h2>{question.topic && <small className="mcqtopic">{question.subtopic || question.topic}</small>}</div></div>
              <div className="mcqoptions">
                {question.options.map((option, optionIndex) => {
                  const selectedOption = selected === optionIndex
                  const revealCorrect = submitted && optionIndex === question.answer
                  const revealWrong = submitted && selectedOption && optionIndex !== question.answer
                  return (
                    <button key={option} className={['mcqoption',selectedOption?'selected':'',revealCorrect?'correct':'',revealWrong?'wrong':''].filter(Boolean).join(' ')} onClick={() => !submitted && setAnswers((state) => ({ ...state, [qIndex]: optionIndex }))}>
                      <span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option}</strong>{revealCorrect && <CheckCircle2 size={18} />}
                    </button>
                  )
                })}
              </div>
              {submitted && <div className={isCorrect ? 'mcqexplanation correct' : 'mcqexplanation'}><BookOpenCheck size={18}/><div><strong>{isCorrect ? tr('Correct', 'إجابة صحيحة') : tr('Review this point', 'راجع هذه النقطة')}</strong><p>{question.explanation}</p></div></div>}
            </section>
          )
        })}
      </div>

      <div className="mcqsubmitbar">
        {!submitted ? (
          <button className="primary" disabled={!questions.length || Object.keys(answers).length !== questions.length} onClick={() => void submit()}><CircleHelp size={18}/> {tr('Submit answers', 'إرسال الإجابات')}</button>
        ) : (
          <button className="secondary" onClick={reset}><RotateCcw size={18}/> {tr('Try again', 'إعادة المحاولة')}</button>
        )}
      </div>
    </div>
  )
}
