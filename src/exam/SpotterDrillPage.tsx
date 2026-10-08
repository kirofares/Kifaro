import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clock3, Eye, SkipForward } from 'lucide-react'
import { useAssessmentItems, type AssessmentItem } from '../assessment/AssessmentCenter'
import { useAuth } from '../auth/AuthContext'
import { useAdmin } from '../hooks/useAdmin'
import { useStudentYear } from '../hooks/useStudentYear'
import { supabase } from '../lib/supabase'
import { useTr } from '../i18n'

const DEFAULT_STATION_SECONDS = 60

/**
 * OSPE-style spotter rotation: stations run back to back with a per-station timer that
 * moves on automatically, and the result is shown only at the end.
 */
export default function SpotterDrillPage() {
  const nav = useNavigate()
  const tr = useTr()
  const [params] = useSearchParams()
  const moduleFilter = params.get('module')
  const { user } = useAuth()
  const { isAdmin } = useAdmin(user?.id)
  const { year: studentYear } = useStudentYear()
  const { items, loading } = useAssessmentItems(['spotter'])

  const stations = useMemo(() => items.filter((item) =>
    (isAdmin || !studentYear || item.year === studentYear)
    && (!moduleFilter || item.module_code === moduleFilter)
    && (item.content?.questions?.length || 0) > 0,
  ), [items, isAdmin, studentYear, moduleFilter])

  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Record<number, number>>>({})
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [finished, setFinished] = useState(false)

  const station: AssessmentItem | undefined = stations[index]
  const stationSeconds = (item?: AssessmentItem) => item?.time_limit_seconds || DEFAULT_STATION_SECONDS

  useEffect(() => {
    if (!started || finished) return
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [started, finished, index])

  useEffect(() => {
    if (started && !finished && secondsLeft === 0) advance()
  }, [secondsLeft, started, finished])

  function scoreOf(item: AssessmentItem) {
    const chosen = answers[item.id] || {}
    return (item.content.questions || []).reduce((sum, q, i) => sum + (chosen[i] === q.answer ? 1 : 0), 0)
  }

  function advance() {
    if (index < stations.length - 1) {
      setIndex(index + 1)
      setSecondsLeft(stationSeconds(stations[index + 1]))
    } else {
      void finish()
    }
  }

  async function finish() {
    setFinished(true)
    if (!supabase || !user) return
    // Same attempt record as a single station, so drill results feed Progress.
    await supabase.from('assessment_attempts').insert(stations.map((item) => ({
      user_id: user.id,
      assessment_item_id: item.id,
      score: scoreOf(item),
      max_score: item.content.questions?.length || 0,
      details: { answers: answers[item.id] || {}, mode: 'spotter-drill' },
    })))
  }

  const begin = () => {
    setStarted(true)
    setFinished(false)
    setIndex(0)
    setAnswers({})
    setSecondsLeft(stationSeconds(stations[0]))
  }

  const total = stations.reduce((sum, item) => sum + (item.content.questions?.length || 0), 0)
  const score = stations.reduce((sum, item) => sum + scoreOf(item), 0)

  return (
    <div className="page assessmentpage drillpage">
      <div className="pagehead">
        <div>
          <span className="eyebrow">{tr('SPOTTER DRILL', 'تدريب السبوتر')}{moduleFilter ? ' · ' + moduleFilter : ''}</span>
          <h1>{tr('Timed spotter rotation', 'دورة سبوتر بالوقت')}</h1>
          <p>{tr('Stations run back to back like the OSPE. When time runs out, you move to the next station automatically.', 'المحطات ورا بعض زي الـ OSPE. لما الوقت يخلص بتنتقل للمحطة اللي بعدها تلقائيًا.')}</p>
        </div>
        {started && !finished && <div className={secondsLeft < 15 ? 'stationtimer urgent' : 'stationtimer'}><Clock3 /><strong><bdi dir="ltr">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</bdi></strong></div>}
      </div>

      {!started && (
        <div className="stationstart">
          {loading ? <p>{tr('Loading stations…', 'جارٍ تحميل المحطات…')}</p> : stations.length === 0 ? (
            <p>{tr('No spotter stations are available yet.', 'لسه مفيش محطات سبوتر متاحة.')}</p>
          ) : <>
            <h2>{tr(`${stations.length} stations`, `${stations.length} محطة`)}</h2>
            <p>{tr('Each station has its own timer (usually one minute). You can skip ahead, but not go back.', 'كل محطة ليها وقتها (غالبًا دقيقة). تقدر تتخطى لقدام لكن مش هترجع.')}</p>
            <button className="primary" onClick={begin}><Eye size={17} /> {tr('Start drill', 'ابدأ التدريب')}</button>
          </>}
          <button className="secondary" onClick={() => nav('/spotters')}><ArrowLeft size={17} className="dirarrow" /> {tr('Back to spotters', 'رجوع للسبوتر')}</button>
        </div>
      )}

      {started && !finished && station && (
        <>
          <div className="drillprogress"><bdi>{index + 1} / {stations.length}</bdi><div><i style={{ width: ((index + 1) / stations.length) * 100 + '%' }} /></div></div>
          <section className="stationstem">
            <h2>{station.title}</h2>
            <p>{station.stem}</p>
            {station.media_url && <figure><img src={station.media_url} alt={station.media_alt || station.title} /></figure>}
          </section>
          <div className="stationquestions">
            {(station.content.questions || []).map((question, qIndex) => (
              <div className="quiz" key={qIndex}>
                <p dir="auto">{question.prompt}</p>
                {question.options.map((option, oIndex) => (
                  <button key={oIndex} className={answers[station.id]?.[qIndex] === oIndex ? 'selected' : ''} onClick={() => setAnswers((state) => ({ ...state, [station.id]: { ...(state[station.id] || {}), [qIndex]: oIndex } }))}>
                    <span>{String.fromCharCode(65 + oIndex)}</span>{option}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="mcqsubmitbar"><button className="primary" onClick={advance}><SkipForward size={17} /> {index < stations.length - 1 ? tr('Next station', 'المحطة التالية') : tr('Finish drill', 'إنهاء التدريب')}</button></div>
        </>
      )}

      {finished && (
        <>
          <div className="stationresult">
            <div><small>{tr('Result', 'النتيجة')}</small><strong><bdi dir="ltr">{score}/{total}</bdi></strong></div>
            <div className="stationresultactions"><button className="secondary" onClick={begin}>{tr('Run again', 'أعد التدريب')}</button></div>
          </div>
          <section className="contentbox">
            <h2>{tr('Station review', 'مراجعة المحطات')}</h2>
            {stations.map((item, sIndex) => (
              <div key={item.id} className={scoreOf(item) === (item.content.questions?.length || 0) ? 'examreview correct' : 'examreview'}>
                <p><bdi>{sIndex + 1}.</bdi> <strong>{item.title}</strong> · <bdi dir="ltr">{scoreOf(item)}/{item.content.questions?.length || 0}</bdi></p>
                {(item.content.questions || []).map((question, qIndex) => (
                  <p key={qIndex} className="muted" dir="auto">{question.prompt} → <b>{question.options[question.answer]}</b>{question.explanation ? ' — ' + question.explanation : ''}</p>
                ))}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
