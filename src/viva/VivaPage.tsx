import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Check, ChevronRight, Lightbulb, RotateCcw, Target } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getLectureBySlug } from '../data/anatomate'
import { useLectureSettings } from '../hooks/useLectureSettings'
import { useLang, useTr } from '../i18n'
import { getVivaDeck, type VivaDeck, type VivaText } from './content'
import { advanceSession, newSession, parseSession, recordAnswer, revealAnswer, reviewQueue, sessionKey, toggleCriterion, useHint, type VivaSession } from './session'
import './viva.css'

export default function VivaPage() {
  const { slug } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { settings, loading } = useLectureSettings()
  const tr = useTr()
  const lecture = getLectureBySlug(slug)
  const deck = lecture && getVivaDeck(lecture.id)
  const setting = lecture && settings.get(lecture.id)
  // This is an explicitly free, source-excerpt pilot. No paid assets or
  // entitlements are retrieved by Viva; original slides keep their own gate.
  if (loading || authLoading) return <div className="page" role="status">{tr('Loading practice…', 'جارٍ تحميل التدريب…')}</div>
  if (!lecture || !deck || setting?.published === false) return <div className="page viva-page">
    <h1>{tr('Viva practice is not available for this lecture yet.', 'تدريب Viva غير متاح لهذه المحاضرة بعد.')}</h1>
    <Link className="secondary" to="/anatomate">{tr('Back to AnatoMate', 'العودة إلى AnatoMate')}</Link>
  </div>
  return <VivaPractice key={sessionKey(deck, user?.id)} deck={deck} userId={user?.id} slug={lecture.slug} title={setting?.title_override || lecture.title} />
}

function VivaPractice({ deck, userId, slug, title }: { deck: VivaDeck; userId?: string; slug: string; title: string }) {
  const tr = useTr()
  const lang = useLang()
  const text = (value: VivaText) => value[lang]
  const key = sessionKey(deck, userId)
  const [saved] = useState(() => {
    try { return parseSession(localStorage.getItem(key), deck) } catch { return null }
  })
  const [session, setSession] = useState<VivaSession>(() => saved || newSession(deck))
  const [started, setStarted] = useState(false)
  const [storageFailed, setStorageFailed] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const question = deck.questions.find((item) => item.id === session.queue[session.index])!
  const answer = session.answers[question.id]
  const lecturePath = `/anatomate/lecture/${slug}`

  useEffect(() => {
    if (!started) return
    try { localStorage.setItem(key, JSON.stringify(session)); setStorageFailed(false) } catch { setStorageFailed(true) }
  }, [key, session, started])

  useEffect(() => {
    if (started) headingRef.current?.focus()
  }, [started, session.index, session.complete])

  useEffect(() => {
    if (session.revealed) feedbackRef.current?.focus()
  }, [session.revealed])

  const start = (queue?: string[]) => {
    setSession(newSession(deck, queue))
    setStarted(true)
  }
  const forget = () => {
    try { localStorage.removeItem(key) } catch { setStorageFailed(true) }
    setStarted(false)
    setSession(newSession(deck))
    // Reloading the route is unnecessary: the restart card below reflects
    // the current session rather than the initial saved snapshot.
  }
  const hasSavedAnswers = Object.values(session.answers).some((item) => item.text.trim())
  const missing = reviewQueue(session, deck)
  const checkedCount = session.queue.filter((id) => session.answers[id]?.checked).length
  const coveredCount = Object.values(session.answers).reduce((total, item) => total + item.covered.length, 0)
  const criterionCount = session.queue.reduce((total, id) => total + deck.questions.find((item) => item.id === id)!.criteria.length, 0)

  return <div className="page viva-page">
    <Link className="viva-back" to={lecturePath}><ArrowLeft size={17} />{tr('Back to lecture', 'العودة للمحاضرة')}</Link>
    <header className="viva-header">
      <div><span className="eyebrow">KIFARO VIVA</span><h1>{title}</h1></div>
      <span className="viva-badge">{tr('Free pilot · Self-assessment', 'تجربة مجانية · تقييم ذاتي')}</span>
    </header>
    {!started ? <section className="viva-card viva-intro">
      <div className="viva-symbol"><Target size={30} aria-hidden="true" /></div>
      <h2>{tr('Explain it. Check it. Remember it.', 'جاوب. راجع. ثبّت المعلومة.')}</h2>
      <p>{tr('Five short questions from your Introduction to Anatomy lecture. Write in English or Arabic, compare with the lecture points, then practise what you missed.', 'خمس أسئلة قصيرة من محاضرة Introduction to Anatomy. اكتب بالعربي أو الإنجليزي، وقارن بنقاط المحاضرة، ثم تدرب على ما نسيته.')}</p>
      <ol className="viva-steps">
        <li>{tr('Answer from memory before revealing the key.', 'جاوب من الذاكرة قبل إظهار نقاط الإجابة.')}</li>
        <li>{tr('Select only the points your original answer included.', 'حدّد فقط النقاط التي ذكرتها فعلًا في إجابتك الأصلية.')}</li>
        <li>{tr('Repeat missed points and questions where you used a hint.', 'أعد النقاط الناقصة والأسئلة التي احتجت فيها لتلميح.')}</li>
      </ol>
      <p className="viva-note">{tr('This pilot uses your own checklist assessment. AI grading and voice conversation are not enabled yet.', 'التقييم هنا ذاتي باستخدام قائمة نقاط الإجابة. التصحيح بالذكاء الاصطناعي والمحادثة الصوتية لم يتم تفعيلهما بعد.')}</p>
      <div className="viva-actions">
        {hasSavedAnswers && <button className="primary" onClick={() => setStarted(true)}>{session.complete ? tr('View last result', 'عرض آخر نتيجة') : tr('Resume practice', 'أكمل التدريب')}<ChevronRight size={17} /></button>}
        <button className={hasSavedAnswers ? 'secondary' : 'primary'} onClick={() => start()}>{tr('Start 5 questions', 'ابدأ ٥ أسئلة')}<ChevronRight size={17} /></button>
      </div>
      <p className="viva-small">{tr('About 5–10 minutes. Progress and written answers are saved in this browser only. You can delete them below.', 'حوالي ٥–١٠ دقائق. تُحفظ الإجابات والتقدم في هذا المتصفح فقط، ويمكنك حذفهما بالزر أدناه.')}</p>
      {hasSavedAnswers && <button className="viva-text-button" onClick={forget}>{tr('Delete saved practice', 'حذف التدريب المحفوظ')}</button>}
    </section> : session.complete ? <section className="viva-card">
      <span className="viva-badge"><Check size={15} />{tr('Session complete', 'اكتملت الجلسة')}</span>
      <h2 ref={headingRef} tabIndex={-1}>{tr('Your review plan', 'خطة مراجعتك')}</h2>
      <p>{tr(`You marked ${coveredCount} of ${criterionCount} key points as present in your answers.`, `حددت أنك ذكرت ${coveredCount} من ${criterionCount} نقطة في إجاباتك.`)}</p>
      <p className="viva-note">{tr('This is your self-assessment, not an AI score or an official exam grade.', 'هذه نتيجة تقييمك الذاتي، وليست درجة من الذكاء الاصطناعي أو درجة امتحان رسمية.')}</p>
      <div className="viva-results">{session.queue.map((id) => {
        const item = deck.questions.find((entry) => entry.id === id)!
        const response = session.answers[id]
        const absent = item.criteria.filter((_, index) => !response?.covered.includes(index))
        return <article key={id} className="viva-result">
          <h3 dir="auto">{text(item.prompt)}</h3>
          <p className="viva-small">{absent.length ? tr('You marked these points for review:', 'حددت هذه النقاط للمراجعة:') : tr('You marked all key points as covered.', 'حددت أنك ذكرت كل النقاط الأساسية.')}</p>
          {!!absent.length && <ul>{absent.map((point) => <li key={point.en}>{text(point)}</li>)}</ul>}
          {response?.hintUsed && <p className="viva-small">{tr('You used a hint. Try this question again without it.', 'استخدمت تلميحًا. جرّب السؤال مرة أخرى بدونه.')}</p>}
          <details><summary>{tr('Your answer and lecture reference', 'إجابتك ومرجع المحاضرة')}</summary><p className="viva-written" dir="auto">{response?.text}</p><Source section={item.source.section} slide={item.source.slide} excerpt={item.source.excerpt} filename={deck.sourceFilename} /></details>
        </article>
      })}</div>
      <div className="viva-actions">
        {!!missing.length && <button className="primary" onClick={() => start(missing)}><RotateCcw size={17} />{tr(`Practise ${missing.length} questions again`, `تدرّب مجددًا على ${missing.length} أسئلة`)}</button>}
        <button className="secondary" onClick={() => start()}>{tr('Restart all 5 questions', 'أعد الأسئلة الخمسة')}</button>
        <Link className="secondary" to={lecturePath}><BookOpen size={17} />{tr('Review lecture', 'راجع المحاضرة')}</Link>
      </div>
      <p className="viva-small">{tr('Suggested next review: tomorrow. No reminder has been scheduled.', 'المراجعة المقترحة التالية: غدًا. لم يتم ضبط تنبيه.')}</p>
      <button className="viva-text-button" onClick={forget}>{tr('Delete saved practice', 'حذف التدريب المحفوظ')}</button>
    </section> : <section className="viva-card">
      <div className="viva-progress-label"><span>{tr(`Question ${session.index + 1} of ${session.queue.length}`, `السؤال ${session.index + 1} من ${session.queue.length}`)}</span><span>{tr('Written recall', 'استرجاع كتابي')}</span></div>
      <progress className="viva-progress" value={checkedCount} max={session.queue.length} aria-label={tr('Questions completed', 'الأسئلة المكتملة')} />
      <h2 ref={headingRef} tabIndex={-1} dir="auto">{text(question.prompt)}</h2>
      {!session.revealed && <><button className="viva-text-button" onClick={() => setSession(useHint(session))} aria-expanded={!!answer?.hintUsed}><Lightbulb size={16} />{tr('Show a hint', 'أظهر تلميحًا')}</button>
        {answer?.hintUsed && <p className="viva-hint" role="status">{text(question.hint)}</p>}</>}
      <label className="viva-answer-label" htmlFor="viva-answer">{tr('Your answer', 'إجابتك')}</label>
      <textarea id="viva-answer" className="viva-answer" dir="auto" maxLength={4000} rows={5} value={answer?.text || ''} readOnly={session.revealed}
        onChange={(event) => setSession(recordAnswer(session, event.target.value))}
        placeholder={tr('Explain in your own words…', 'اشرح بأسلوبك…')} aria-describedby="viva-answer-help" />
      <p id="viva-answer-help" className="viva-small">{session.revealed ? tr('Your original answer stays visible for an honest comparison.', 'تظل إجابتك الأصلية ظاهرة لتقارن بها.') : tr('English or Arabic is fine. Focus on the anatomical meaning.', 'العربي أو الإنجليزي مقبول. ركّز على المعنى التشريحي.')}</p>
      {!session.revealed ? <div className="viva-actions"><button className="primary" disabled={!answer?.text.trim()} onClick={() => setSession(revealAnswer(session))}>{tr('Compare with the lecture', 'قارن بنقاط المحاضرة')}<ChevronRight size={17} /></button></div> : <div ref={feedbackRef} tabIndex={-1} className="viva-feedback">
        <fieldset><legend>{tr('Which points did you include?', 'ما النقاط التي ذكرتها في إجابتك؟')}</legend>
          <p>{tr('Tick only what you wrote before seeing the answer. Leave missing or incorrect points unchecked.', 'علّم فقط ما كتبته قبل رؤية الإجابة. اترك النقاط الناقصة أو الخاطئة بدون علامة.')}</p>
          {question.criteria.map((point, index) => <label className="viva-criterion" key={point.en}><input type="checkbox" checked={answer?.covered.includes(index) || false} onChange={() => setSession(toggleCriterion(session, index, question.criteria.length))} /><span>{text(point)}{lang === 'ar' && <small lang="en" dir="ltr">{point.en}</small>}</span></label>)}
        </fieldset>
        <Source section={question.source.section} slide={question.source.slide} excerpt={question.source.excerpt} filename={deck.sourceFilename} />
        <div className="viva-actions"><button className="primary" onClick={() => setSession(advanceSession(session))}>{session.index === session.queue.length - 1 ? tr('Finish and see review plan', 'انتهِ واعرض خطة المراجعة') : tr('Save check and continue', 'احفظ التقييم وتابع')}<ChevronRight size={17} /></button></div>
      </div>}
      <div className="viva-session-footer"><button className="viva-text-button" onClick={() => setStarted(false)}>{tr('Pause practice', 'إيقاف التدريب مؤقتًا')}</button><span className="viva-small">{tr('Self-assessment · Saved on this device', 'تقييم ذاتي · محفوظ على هذا الجهاز')}</span></div>
    </section>}
    {storageFailed && <p role="alert" className="viva-note">{tr('This browser could not save your practice. Keep this page open to finish.', 'تعذر حفظ التدريب في المتصفح. اترك الصفحة مفتوحة حتى تنتهي.')}</p>}
    <footer className="viva-credit">AnatoMate + Dr. Kirolus Fares</footer>
  </div>
}

function Source({ section, slide, excerpt, filename }: { section: string; slide: number; excerpt: string; filename: string }) {
  const tr = useTr()
  return <details className="viva-source"><summary><BookOpen size={15} />{tr('Lecture source', 'المصدر من المحاضرة')}: <bdi>{section}</bdi></summary>
    <blockquote lang="en" dir="ltr">{excerpt}</blockquote>
    <p className="viva-small"><bdi>{filename}</bdi> · {tr('Source slide', 'شريحة المصدر')} {slide}</p>
  </details>
}
