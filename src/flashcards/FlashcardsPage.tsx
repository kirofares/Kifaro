import { useEffect, useMemo, useState } from 'react'
import { Brain, Check, RotateCcw, Search, Shuffle, X, AlertTriangle, ChevronRight } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { anatomateYears } from '../data/anatomate'
import { useAuth } from '../auth/AuthContext'
import { useAdmin } from '../hooks/useAdmin'
import { useStudentYear } from '../hooks/useStudentYear'

type Flashcard = {
  id: string
  learning_point_id: string
  lecture_id: string
  topic: string
  subtopic: string | null
  front: string
  back: string
}

type ReviewMap = Record<string, 'know' | 'review'>
type WeaknessRow = { learning_point_id: string; wrong_count: number }

function getArabic() {
  return document.documentElement.dir === 'rtl' || localStorage.getItem('kifaro-lang') === 'ar'
}

export default function FlashcardsPage() {
  const { user } = useAuth()
  const { isAdmin } = useAdmin(user?.id)
  const { year: studentYear } = useStudentYear()
  const [cards,setCards]=useState<Flashcard[]>([])
  const [reviews,setReviews]=useState<ReviewMap>({})
  const [lecture,setLecture]=useState('all')
  const [topic,setTopic]=useState('all')
  const [query,setQuery]=useState('')
  const [index,setIndex]=useState(0)
  const [flipped,setFlipped]=useState(false)
  const [reviewOnly,setReviewOnly]=useState(false)
  const [loading,setLoading]=useState(true)
  const [message,setMessage]=useState('')
  const [openYears,setOpenYears]=useState<Set<number>>(new Set())
  const [openModules,setOpenModules]=useState<Set<string>>(new Set())
  const [weaknesses,setWeaknesses]=useState<WeaknessRow[]>([])
  const [params]=useSearchParams()
  const [weakOnly,setWeakOnly]=useState(params.get('weak')==='1')
  const requestedLearningPoint=params.get('lp')
  const ar=getArabic()

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    if (!supabase) { setLoading(false); return }
    const [{data:cardData},{data:{user}}] = await Promise.all([
      supabase.from('flashcards').select('id,learning_point_id,lecture_id,topic,subtopic,front,back').eq('published',true).order('lecture_id').order('topic'),
      supabase.auth.getUser(),
    ])
    setCards((cardData || []) as Flashcard[])
    if (user) {
      const [{data:history},{data:weakData}]=await Promise.all([
        supabase
          .from('flashcard_reviews')
          .select('flashcard_id,rating,reviewed_at')
          .eq('user_id',user.id)
          .order('reviewed_at',{ascending:false}),
        supabase.rpc('get_my_active_weaknesses'),
      ])
      const latest: ReviewMap={}
      for (const item of history || []) {
        if (!latest[item.flashcard_id]) latest[item.flashcard_id]=item.rating as 'know'|'review'
      }
      setReviews(latest)
      setWeaknesses((weakData || []).map((w:any)=>({learning_point_id:w.learning_point_id,wrong_count:Number(w.wrong_count||1)})))
    }
    setLoading(false)
  }

  const lectures=useMemo(()=>Array.from(new Set(cards.map(c=>c.lecture_id))).sort(),[cards])
  const topics=useMemo(()=>Array.from(new Set(cards.filter(c=>lecture==='all'||c.lecture_id===lecture).map(c=>c.topic))).sort(),[cards,lecture])
  const weakIds=useMemo(()=>new Set(weaknesses.map(w=>w.learning_point_id)),[weaknesses])
  const weakCounts=useMemo(()=>new Map(weaknesses.map(w=>[w.learning_point_id,w.wrong_count])),[weaknesses])
  const filtered=useMemo(()=>cards.filter(card=>{
    if (lecture!=='all'&&card.lecture_id!==lecture) return false
    if (topic!=='all'&&card.topic!==topic) return false
    if (reviewOnly&&reviews[card.id]!=='review') return false
    if (weakOnly&&!weakIds.has(card.learning_point_id)) return false
    if (query) {
      const hay=(card.front+' '+card.back+' '+card.topic+' '+(card.subtopic||'')).toLowerCase()
      if (!hay.includes(query.toLowerCase())) return false
    }
    return true
  }).sort((a,b)=>{
    if (requestedLearningPoint) {
      if (a.learning_point_id===requestedLearningPoint) return -1
      if (b.learning_point_id===requestedLearningPoint) return 1
    }
    return Number(weakIds.has(b.learning_point_id))-Number(weakIds.has(a.learning_point_id))
  }),[cards,lecture,topic,query,reviewOnly,reviews,weakOnly,weakIds,requestedLearningPoint])

  useEffect(()=>{ setIndex(0); setFlipped(false) },[lecture,topic,query,reviewOnly,weakOnly,requestedLearningPoint])
  const card=filtered[index]
  const knownCount=Object.values(reviews).filter(v=>v==='know').length
  const reviewCount=Object.values(reviews).filter(v=>v==='review').length
  const activeWeaknessCount=weaknesses.length
  const visibleYears=isAdmin?anatomateYears:studentYear?anatomateYears.filter(y=>y.year===studentYear):anatomateYears

  async function rate(rating:'know'|'review') {
    if (!card) return
    setReviews(prev=>({...prev,[card.id]:rating}))
    if (supabase) {
      const {data:{user}}=await supabase.auth.getUser()
      if (user) await supabase.from('flashcard_reviews').insert({user_id:user.id,flashcard_id:card.id,rating})
    }
    const isWeak=weakIds.has(card.learning_point_id)
    setMessage(rating==='know'
      ? (isWeak
          ? (ar?'راجعتها، لكن نقطة الضعف لن تُغلق إلا بعد إعادة الاختبار والإجابة الصحيحة.':'Reviewed. This weakness stays active until you retest it correctly.')
          : (ar?'تم تسجيلها كمراجعة معروفة':'Marked as known for flashcard review'))
      : (ar?'اتضافت لقائمة المراجعة':'Added to review queue'))
    setTimeout(()=>setMessage(''),1500)
    if (index<filtered.length-1) setIndex(i=>i+1)
    else setIndex(0)
    setFlipped(false)
  }

  function shuffle() {
    if (!filtered.length) return
    setIndex(Math.floor(Math.random()*filtered.length))
    setFlipped(false)
  }

  if (loading) return <div className="page"><div className="empty">Loading flashcards…</div></div>

  return (
    <div className="page flashcardspage">
      <div className="pagehead">
        <div><small>{ar?'مراجعة نشطة':'ACTIVE RECALL'}</small><h1>{ar?'Flashcards — بطاقات المراجعة':'Flashcards'}</h1><p>{ar?'كل Learning Point في المنهج اتحولت لكارت مراجعة مرتبط بتقدمك.':'Every learning point is now a review card linked to your progress.'}</p></div>
      </div>

      <div className="flashstats">
        <div><strong>{cards.length}</strong><span>{ar?'إجمالي الكروت':'Total cards'}</span></div>
        <div><strong>{knownCount}</strong><span>{ar?'متقن':'Known'}</span></div>
        <div><strong>{activeWeaknessCount}</strong><span>{ar?'نقاط ضعف نشطة':'Active weaknesses'}</span></div>
        <div><strong>{reviewCount}</strong><span>{ar?'راجع تاني':'Review again'}</span></div>
      </div>

      <div className="flashhierarchy">
        {visibleYears.map(year=>{
          const yearCount=year.modules.reduce((sum,module)=>sum+module.lectures.reduce((n,l)=>n+cards.filter(c=>c.lecture_id===l.id).length,0),0)
          if(!yearCount) return null
          const yearOpen=openYears.has(year.year)
          return <section className={yearOpen?'flashyear open':'flashyear'} key={year.year}>
            <button className="flashyearhead caseaccordionbutton" onClick={()=>setOpenYears(current=>{const next=new Set(current);next.has(year.year)?next.delete(year.year):next.add(year.year);return next})}>
              <div><span className="yearbadge">YEAR {year.year}</span><h2>{ar?'السنة الطبية '+year.year:'Medical Year '+year.year}</h2></div>
              <div className="caseaccordionmeta"><span className="mcqcount">{yearCount}</span><ChevronRight className="caseaccordionchevron" size={22}/></div>
            </button>
            {yearOpen&&<div className="flashmodules">
              {year.modules.map(module=>{
                const moduleCount=module.lectures.reduce((n,l)=>n+cards.filter(c=>c.lecture_id===l.id).length,0)
                if(!moduleCount) return null
                const key=year.year+':'+module.slug+':flash'
                const moduleOpen=openModules.has(key)
                return <div className={moduleOpen?'flashmodule open':'flashmodule'} key={module.slug}>
                  <button className="flashmodulehead caseaccordionbutton" onClick={()=>setOpenModules(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next})}>
                    <div><small>{module.code}</small><h3>{module.title}</h3></div>
                    <div className="caseaccordionmeta"><span className="mcqcount">{moduleCount}</span><ChevronRight className="caseaccordionchevron" size={20}/></div>
                  </button>
                  {moduleOpen&&<div className="flashlecturelist">
                    {module.lectures.map(l=>{
                      const count=cards.filter(c=>c.lecture_id===l.id).length
                      if(!count) return null
                      return <button key={l.id} className={lecture===l.id?'flashlecture active':'flashlecture'} onClick={()=>{setLecture(l.id);setTopic('all')}}>
                        <div className="lectureseq">{l.sequence}</div><div><small>{l.system}</small><strong>{l.title}</strong></div><span>{count}</span><ChevronRight size={18}/>
                      </button>
                    })}
                  </div>}
                </div>
              })}
            </div>}
          </section>
        })}
      </div>

      <div className="flashfilters">
        <label><span>{ar?'المحاضرة':'Lecture'}</span><select value={lecture} onChange={e=>{setLecture(e.target.value);setTopic('all')}}><option value="all">{ar?'كل المحاضرات':'All lectures'}</option>{lectures.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label><span>{ar?'الموضوع':'Topic'}</span><select value={topic} onChange={e=>setTopic(e.target.value)}><option value="all">{ar?'كل الموضوعات':'All topics'}</option>{topics.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label className="flashsearch"><span>{ar?'بحث':'Search'}</span><div><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'ابحث في الكروت':'Search cards'}/></div></label>
        <button className={weakOnly?'secondary active':'secondary'} onClick={()=>setWeakOnly(v=>!v)}><AlertTriangle size={17}/>{ar?'Weakness فقط':'Weakness only'}</button>
        <button className={reviewOnly?'secondary active':'secondary'} onClick={()=>setReviewOnly(v=>!v)}><RotateCcw size={17}/>{ar?'راجع تاني':'Review again'}</button>
        <button className="secondary" onClick={shuffle}><Shuffle size={17}/>{ar?'عشوائي':'Shuffle'}</button>
      </div>

      {card ? <>
        <div className="flashprogress"><span>{index+1} / {filtered.length}</span><div><i style={{width:`${((index+1)/filtered.length)*100}%`}}/></div></div>
        <button className={flipped?'flashcard flipped':'flashcard'} onClick={()=>setFlipped(v=>!v)} aria-label={ar?'اقلب الكارت':'Flip card'}>
          <div className="flashmeta"><span>{card.lecture_id}</span><span>{card.topic}</span></div>
          {weakIds.has(card.learning_point_id) && <div className="flashweakbadge"><AlertTriangle size={16}/>{ar?'Weakness نشطة':'Active weakness'} · {weakCounts.get(card.learning_point_id) || 1}</div>}
          <div className="flashicon"><Brain/></div>
          {!flipped ? <>
            <small>{ar?'السؤال':'QUESTION'}</small>
            <h2>{card.front}</h2>
            {card.subtopic && <p>{card.subtopic}</p>}
            <b>{ar?'اضغط لإظهار الإجابة':'Tap to reveal answer'}</b>
          </> : <>
            <small>{ar?'الإجابة':'ANSWER'}</small>
            <h2>{card.subtopic || card.topic}</h2>
            <p>{card.back}</p>
            <b>{ar?'اضغط للرجوع للسؤال':'Tap to see question'}</b>
          </>}
        </button>

        <div className="flashactions">
          <button className="reviewbtn" onClick={()=>void rate('review')}><X size={20}/>{ar?'راجع تاني':'Review again'}</button>
          <button className="knowbtn" onClick={()=>void rate('know')}><Check size={20}/>{ar?'راجعتها':'Reviewed'}</button>
        </div>
        <div className="flashnav">
          <button className="secondary" disabled={index===0} onClick={()=>{setIndex(i=>Math.max(0,i-1));setFlipped(false)}}>{ar?'السابق':'Previous'}</button>
          <button className="secondary" disabled={index>=filtered.length-1} onClick={()=>{setIndex(i=>Math.min(filtered.length-1,i+1));setFlipped(false)}}>{ar?'التالي':'Next'}</button>
        </div>
      </> : <div className="empty"><h3>{ar?'مفيش كروت مطابقة':'No matching cards'}</h3><p>{ar?'غيّر الفلاتر أو أوقف فلاتر المراجعة.':'Change the filters or turn off review filters.'}</p></div>}

      {message && <div className="toast">{message}</div>}
    </div>
  )
}
