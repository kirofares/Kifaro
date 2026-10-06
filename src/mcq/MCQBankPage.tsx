import { useMemo, useState } from 'react'
import { BookOpenCheck, CheckCircle2, ChevronRight, CircleHelp, RotateCcw } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { anatomateYears, getLectureBySlug } from '../data/anatomate'
import { useTr } from '../i18n'

export function MCQBankPage() {
  const nav = useNavigate()
  const tr = useTr()

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
      </div>

      <div className="mcqyeargrid">
        {anatomateYears.map((year) => {
          const total = year.modules.reduce((sum, module) => sum + module.lectures.reduce((n, lecture) => n + lecture.mcqs.length, 0), 0)
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
                  const count = module.lectures.reduce((sum, lecture) => sum + lecture.mcqs.length, 0)
                  return (
                    <button
                      key={module.slug}
                      className="mcqmodulecard"
                      onClick={() => nav('/mcq/year/' + year.year + '/module/' + module.slug)}
                    >
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
  const yearData = anatomateYears.find((item) => String(item.year) === year)
  const moduleData = yearData?.modules.find((item) => item.slug === module)

  if (!yearData || !moduleData) {
    return (
      <div className="page">
        <div className="pagehead"><div><span className="eyebrow">MCQ BANK</span><h1>{tr('Module not found', 'الموديول غير موجود')}</h1></div></div>
      </div>
    )
  }

  const total = moduleData.lectures.reduce((sum, lecture) => sum + lecture.mcqs.length, 0)

  return (
    <div className="page mcqpage">
      <div className="pagehead">
        <div>
          <span className="eyebrow">YEAR {yearData.year} · MCQ BANK</span>
          <h1>{moduleData.title}</h1>
          <p>{tr('Choose a lecture to start its question set.', 'اختر المحاضرة لبدء مجموعة الأسئلة الخاصة بها.')}</p>
        </div>
        <span className="mcqcount large">{total} MCQ</span>
      </div>

      <div className="mcqlecturelist">
        {moduleData.lectures.map((lecture) => (
          <button key={lecture.id} className="mcqlecturecard" onClick={() => nav('/mcq/lecture/' + lecture.slug)}>
            <div className="lectureseq">{lecture.sequence}</div>
            <div className="grow">
              <small>{lecture.system}</small>
              <h3>{lecture.title}</h3>
              <p>{lecture.mcqs.length} {lecture.mcqs.length === 1 ? 'MCQ' : 'MCQs'}</p>
            </div>
            <ChevronRight />
          </button>
        ))}
      </div>
    </div>
  )
}

export function MCQLecturePage() {
  const { slug } = useParams()
  const tr = useTr()
  const lecture = getLectureBySlug(slug)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)

  const score = useMemo(() => {
    if (!lecture) return 0
    return lecture.mcqs.reduce((sum, question, index) => sum + (answers[index] === question.answer ? 1 : 0), 0)
  }, [lecture, answers])

  if (!lecture) {
    return (
      <div className="page">
        <div className="pagehead"><div><span className="eyebrow">MCQ BANK</span><h1>{tr('Lecture not found', 'المحاضرة غير موجودة')}</h1></div></div>
      </div>
    )
  }

  const reset = () => {
    setAnswers({})
    setSubmitted(false)
  }

  return (
    <div className="page mcqpage">
      <div className="pagehead mcqlecturehead">
        <div>
          <span className="eyebrow">YEAR {lecture.year} · {lecture.module}</span>
          <h1>{lecture.title}</h1>
          <p>{tr('Lecture MCQ practice', 'تدريب MCQ للمحاضرة')} · {lecture.mcqs.length} {lecture.mcqs.length === 1 ? 'question' : 'questions'}</p>
        </div>
        {submitted && <div className="mcqscore"><strong>{score}/{lecture.mcqs.length}</strong><span>{tr('Score', 'النتيجة')}</span></div>}
      </div>

      <div className="mcqquestions">
        {lecture.mcqs.map((question, qIndex) => {
          const selected = answers[qIndex]
          const isCorrect = selected === question.answer
          return (
            <section className="mcqquestion" key={qIndex}>
              <div className="mcqqhead">
                <span>Q{qIndex + 1}</span>
                <h2>{question.question}</h2>
              </div>

              <div className="mcqoptions">
                {question.options.map((option, optionIndex) => {
                  const selectedOption = selected === optionIndex
                  const revealCorrect = submitted && optionIndex === question.answer
                  const revealWrong = submitted && selectedOption && optionIndex !== question.answer
                  return (
                    <button
                      key={option}
                      className={[
                        'mcqoption',
                        selectedOption ? 'selected' : '',
                        revealCorrect ? 'correct' : '',
                        revealWrong ? 'wrong' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => !submitted && setAnswers((state) => ({ ...state, [qIndex]: optionIndex }))}
                    >
                      <span>{String.fromCharCode(65 + optionIndex)}</span>
                      <strong>{option}</strong>
                      {revealCorrect && <CheckCircle2 size={18} />}
                    </button>
                  )
                })}
              </div>

              {submitted && (
                <div className={isCorrect ? 'mcqexplanation correct' : 'mcqexplanation'}>
                  <BookOpenCheck size={18} />
                  <div>
                    <strong>{isCorrect ? tr('Correct', 'إجابة صحيحة') : tr('Review this point', 'راجع هذه النقطة')}</strong>
                    <p>{question.explanation}</p>
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="mcqsubmitbar">
        {!submitted ? (
          <button className="primary" disabled={Object.keys(answers).length !== lecture.mcqs.length} onClick={() => setSubmitted(true)}>
            <CircleHelp size={18} /> {tr('Submit answers', 'إرسال الإجابات')}
          </button>
        ) : (
          <button className="secondary" onClick={reset}><RotateCcw size={18} /> {tr('Try again', 'إعادة المحاولة')}</button>
        )}
      </div>
    </div>
  )
}
