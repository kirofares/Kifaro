import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock3, Flag, Timer } from 'lucide-react'
import { anatomateYears } from '../data/anatomate'
import { useMCQBank, type BankQuestion } from '../mcq/useMCQBank'
import { ModuleAccessGate } from '../payments/ModuleAccess'
import { useTr } from '../i18n'

const SECONDS_PER_QUESTION = 60
const SIZES = [10, 20, 40]
const OPTIONS = ['A', 'B', 'C', 'D'] as const

function shuffled<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Timed, exam-style MCQ block for a whole module: questions mixed across its lectures,
 * one minute per question, no feedback until the end, then results by learning objective.
 */
export default function ModuleExamPage() {
  const { year, module } = useParams()
  const nav = useNavigate()
  const tr = useTr()
  const { questions: bank, loading, recordAttempt, refreshMastery } = useMCQBank()
  const yearData = anatomateYears.find((item) => String(item.year) === year)
  const moduleData = yearData?.modules.find((item) => item.slug === module)

  const pool = useMemo(() => {
    const ids = new Set(moduleData?.lectures.map((lecture) => lecture.id) || [])
    return bank.filter((question) => ids.has(question.lecture_id))
  }, [bank, moduleData])

  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [current, setCurrent] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const started = questions.length > 0
  const running = started && !submitted

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (running && secondsLeft === 0) void submit()
  }, [running, secondsLeft])

  if (!yearData || !moduleData) {
    return <div className="page"><div className="assessmentempty">{tr('Module not found', 'الموديول غير موجود')}</div></div>
  }

  const start = (size: number) => {
    const picked = shuffled(pool).slice(0, size)
    setQuestions(picked)
    setAnswers({})
    setCurrent(0)
    setSubmitted(false)
    setSecondsLeft(picked.length * SECONDS_PER_QUESTION)
  }

  async function submit() {
    setSubmitted(true)
    await Promise.all(questions.map((question) => {
      const choice = answers[question.id]
      return choice === undefined ? Promise.resolve() : recordAttempt(question, OPTIONS[choice])
    }))
    await refreshMastery()
  }

  const correctIndex = (question: BankQuestion) => OPTIONS.indexOf(question.correct_option as typeof OPTIONS[number])
  const score = questions.filter((question) => answers[question.id] === correctIndex(question)).length
  const answeredCount = Object.keys(answers).length

  // Results grouped by learning objective (or topic when no objective is set), weakest first.
  const breakdown = (() => {
    const map = new Map<string, { correct: number; total: number }>()
    for (const question of questions) {
      const key = question.learning_objective || question.subtopic || question.topic || tr('General', 'عام')
      const row = map.get(key) || { correct: 0, total: 0 }
      row.total += 1
      if (answers[question.id] === correctIndex(question)) row.correct += 1
      map.set(key, row)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
  })()

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const question = questions[current]

  return (
    <ModuleAccessGate moduleCode={moduleData.code} productType="mcq">
      <div className="page mcqpage exampage">
        <div className="pagehead">
          <div>
            <span className="eyebrow">{tr('EXAM MODE', 'وضع الامتحان')} · {moduleData.code}</span>
            <h1>{moduleData.title}</h1>
            <p>{tr('Mixed questions from the whole module, one minute each, no feedback until you finish.', 'أسئلة مختلطة من الموديول كله، دقيقة لكل سؤال، ومن غير تصحيح لحد ما تخلّص.')}</p>
          </div>
          {running && <div className={secondsLeft < 60 ? 'stationtimer urgent' : 'stationtimer'}><Clock3 /><strong><bdi dir="ltr">{minutes}:{String(seconds).padStart(2, '0')}</bdi></strong></div>}
        </div>

        {!started && (
          <div className="stationstart">
            {loading ? <p>{tr('Loading questions…', 'جارٍ تحميل الأسئلة…')}</p> : pool.length === 0 ? (
              <p>{tr('This module has no bank questions yet.', 'الموديول ده لسه مفيهوش أسئلة في البنك.')}</p>
            ) : <>
              <h2>{tr('How many questions?', 'كام سؤال؟')}</h2>
              <p>{tr(`${pool.length} questions available in this module.`, `${pool.length} سؤال متاح في الموديول ده.`)}</p>
              <div className="examsizes">
                {SIZES.filter((size, index) => size <= pool.length || index === 0).map((size) => {
                  const count = Math.min(size, pool.length)
                  return <button key={size} className="primary" onClick={() => start(count)}><Timer size={17} /> <bdi>{count}</bdi> {tr('questions', 'سؤال')} · <bdi>{count}</bdi> {tr('min', 'دقيقة')}</button>
                })}
              </div>
            </>}
            <button className="secondary" onClick={() => nav('/mcq/year/' + yearData.year + '/module/' + moduleData.slug)}><ArrowLeft size={17} className="dirarrow" /> {tr('Back to module', 'رجوع للموديول')}</button>
          </div>
        )}

        {running && question && (
          <>
            <div className="examgrid" aria-label={tr('Questions', 'الأسئلة')}>
              {questions.map((item, index) => (
                <button key={item.id} className={[index === current ? 'current' : '', answers[item.id] !== undefined ? 'answered' : ''].join(' ')} onClick={() => setCurrent(index)}><bdi>{index + 1}</bdi></button>
              ))}
            </div>
            <section className="contentbox">
              <small><bdi>{current + 1} / {questions.length}</bdi></small>
              <div className="quiz">
                <p>{question.question_text}</p>
                {question.image_url && <img className="examimage" src={question.image_url} alt={question.image_alt || ''} />}
                {[question.option_a, question.option_b, question.option_c, question.option_d].map((option, index) => (
                  <button key={index} className={answers[question.id] === index ? 'selected' : ''} onClick={() => setAnswers((state) => ({ ...state, [question.id]: index }))}>
                    <span>{OPTIONS[index]}</span>{option}
                  </button>
                ))}
              </div>
            </section>
            <div className="mcqsubmitbar examactions">
              <button className="secondary" disabled={current === 0} onClick={() => setCurrent((index) => index - 1)}>{tr('Previous', 'السابق')}</button>
              {current < questions.length - 1
                ? <button className="secondary" onClick={() => setCurrent((index) => index + 1)}>{tr('Next', 'التالي')}</button>
                : null}
              <button className="primary" onClick={() => void submit()}><Flag size={17} /> {tr(`Finish (${answeredCount}/${questions.length})`, `إنهاء (${answeredCount}/${questions.length})`)}</button>
            </div>
          </>
        )}

        {submitted && (
          <>
            <div className="stationresult">
              <div><small>{tr('Result', 'النتيجة')}</small><strong><bdi dir="ltr">{score}/{questions.length}</bdi></strong><p><bdi dir="ltr">{Math.round((score / questions.length) * 100)}%</bdi></p></div>
              <div className="stationresultactions">
                <button className="secondary" onClick={() => setQuestions([])}>{tr('New exam', 'امتحان جديد')}</button>
              </div>
            </div>
            <section className="contentbox">
              <h2>{tr('By learning objective', 'حسب هدف التعلم')}</h2>
              <div className="exambreakdown">
                {breakdown.map(([objective, row]) => (
                  <div key={objective} className={row.correct < row.total ? 'weak' : ''}>
                    <span dir="auto">{objective}</span>
                    <strong><bdi dir="ltr">{row.correct}/{row.total}</bdi></strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="contentbox">
              <h2>{tr('Review your answers', 'راجع إجاباتك')}</h2>
              {questions.map((item, index) => {
                const right = correctIndex(item)
                const chosen = answers[item.id]
                const ok = chosen === right
                return (
                  <div key={item.id} className={ok ? 'examreview correct' : 'examreview'}>
                    <p dir="auto"><bdi>{index + 1}.</bdi> {item.question_text}</p>
                    <p><b>{tr('Correct answer:', 'الإجابة الصحيحة:')}</b> <span dir="auto">{OPTIONS[right]}. {[item.option_a, item.option_b, item.option_c, item.option_d][right]}</span>{chosen !== undefined && !ok && <> · {tr('Your answer:', 'إجابتك:')} {OPTIONS[chosen]}</>}{chosen === undefined && <> · {tr('Not answered', 'لم تُجب')}</>}</p>
                    {item.explanation && <p className="muted" dir="auto">{item.explanation}</p>}
                  </div>
                )
              })}
            </section>
          </>
        )}
      </div>
    </ModuleAccessGate>
  )
}
