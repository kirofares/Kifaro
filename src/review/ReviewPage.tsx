import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BookOpenCheck, Brain, ChevronRight, CircleCheck, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { anatomateLectures } from '../data/anatomate'
import { useLang, useTr } from '../i18n'

type Weakness = {
  learning_point_id: string
  lecture_id: string
  topic: string
  subtopic: string | null
  learning_objective: string
  wrong_count: number
  first_wrong_at: string
  last_wrong_at: string
  last_source: string
  flashcard_id: string | null
}

type ProgressRow = {
  lecture_id: string
  total_points: number
  tested_points: number
  mastered_points: number
  active_weaknesses: number
  mastery_percent: number
}

export default function ReviewPage() {
  const tr = useTr()
  const lang = useLang()
  const nav = useNavigate()
  const [weaknesses,setWeaknesses]=useState<Weakness[]>([])
  const [progress,setProgress]=useState<ProgressRow[]>([])
  const [loading,setLoading]=useState(true)
  const [lectureFilter,setLectureFilter]=useState('all')

  useEffect(()=>{ void load() },[])

  async function load() {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const [weakResult,progressResult]=await Promise.all([
      supabase.rpc('get_my_active_weaknesses'),
      supabase.rpc('get_my_learning_progress'),
    ])
    setWeaknesses((weakResult.data || []) as Weakness[])
    setProgress((progressResult.data || []) as ProgressRow[])
    setLoading(false)
  }

  const lectures=useMemo(()=>{
    const ids=Array.from(new Set(weaknesses.map(w=>w.lecture_id)))
    return ids.map(id=>({id,title:anatomateLectures.find(l=>l.id===id)?.title || id}))
  },[weaknesses])

  const visible=useMemo(()=>lectureFilter==='all' ? weaknesses : weaknesses.filter(w=>w.lecture_id===lectureFilter),[weaknesses,lectureFilter])
  const mastered=progress.reduce((s,r)=>s+Number(r.mastered_points||0),0)
  const total=progress.reduce((s,r)=>s+Number(r.total_points||0),0)
  const mastery=total ? Math.round(mastered/total*100) : 0

  function openMcq(lectureId:string) {
    const lecture=anatomateLectures.find(l=>l.id===lectureId)
    nav(lecture ? '/mcq/lecture/'+lecture.slug : '/mcq')
  }

  if (loading) return <div className="page"><div className="assessmentempty">{tr('Loading review queue…','جارٍ تحميل قائمة المراجعة…')}</div></div>

  return (
    <div className="page reviewpage">
      <div className="pagehead">
        <div>
          <span className="eyebrow">ANATOMATE REVIEW</span>
          <h1>{tr('Review & Weaknesses','المراجعة ونقاط الضعف')}</h1>
          <p>{tr(
            'A wrong answer stays here until you retest the same learning point and answer it correctly.',
            'أي معلومة تغلط فيها تفضل هنا لحد ما تعيد اختبار نفس الـLearning Point وتحلها صح.'
          )}</p>
        </div>
        <button className="secondary" onClick={()=>void load()}><RefreshCw size={17}/>{tr('Refresh','تحديث')}</button>
      </div>

      <div className="reviewstats">
        <div><strong>{weaknesses.length}</strong><span>{tr('Active weaknesses','نقاط ضعف نشطة')}</span></div>
        <div><strong>{mastered}/{total}</strong><span>{tr('Mastered learning points','Learning Points متقنة')}</span></div>
        <div><strong>{mastery}%</strong><span>{tr('Verified mastery','إتقان مؤكد')}</span></div>
      </div>

      <div className="reviewrule">
        <AlertTriangle size={20}/>
        <div>
          <strong>{tr('Reading does not remove a weakness.','المراجعة وحدها لا تمسح نقطة الضعف.')}</strong>
          <p>{tr('Flashcards help you revise, but progress improves only after a correct retest.','الـFlashcards تساعدك تراجع، لكن الـProgress يتحسن فقط بعد إعادة الاختبار والإجابة الصحيحة.')}</p>
        </div>
      </div>

      {lectures.length>1 && <div className="reviewfilters">
        <label>{tr('Lecture','المحاضرة')}
          <select value={lectureFilter} onChange={e=>setLectureFilter(e.target.value)}>
            <option value="all">{tr('All weak points','كل نقاط الضعف')}</option>
            {lectures.map(l=><option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </label>
      </div>}

      {visible.length ? <div className="reviewlist">
        {visible.map(item=>{
          const lecture=anatomateLectures.find(l=>l.id===item.lecture_id)
          return <article className="reviewitem" key={item.learning_point_id}>
            <div className="reviewicon"><Brain/></div>
            <div className="grow">
              <div className="reviewmeta"><span>{lecture?.title || item.lecture_id}</span><span>{item.last_source.toUpperCase()}</span></div>
              <h3>{item.subtopic || item.topic}</h3>
              <p>{item.learning_objective}</p>
              <div className="reviewdetails">
                <span>{tr('Wrong','أخطاء')}: <b>{item.wrong_count}</b></span>
                <span>{tr('Last error','آخر خطأ')}: {new Date(item.last_wrong_at).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB')}</span>
              </div>
            </div>
            <div className="reviewactions">
              <button className="secondary" onClick={()=>nav('/flashcards?weak=1&lp='+item.learning_point_id)}><BookOpenCheck size={16}/>{tr('Review card','راجع الكارت')}</button>
              <button className="primary" onClick={()=>openMcq(item.lecture_id)}>{tr('Retest','أعد الاختبار')}<ChevronRight size={16}/></button>
            </div>
          </article>
        })}
      </div> : <div className="reviewclear"><CircleCheck/><h2>{tr('No active weaknesses','لا توجد نقاط ضعف نشطة')}</h2><p>{tr('Your verified weak points are currently clear.','كل نقاط الضعف المسجلة عندك اتقفلت بإجابة صحيحة.')}</p></div>}
    </div>
  )
}
