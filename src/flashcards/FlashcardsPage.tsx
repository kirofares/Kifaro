import { useEffect, useMemo, useState } from 'react'
import { Brain, Check, RotateCcw, Search, Shuffle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

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

function getArabic() {
  return document.documentElement.dir === 'rtl' || localStorage.getItem('kifaro-lang') === 'ar'
}

export default function FlashcardsPage() {
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
      const {data:history}=await supabase
        .from('flashcard_reviews')
        .select('flashcard_id,rating,reviewed_at')
        .eq('user_id',user.id)
        .order('reviewed_at',{ascending:false})
      const latest: ReviewMap={}
      for (const item of history || []) {
        if (!latest[item.flashcard_id]) latest[item.flashcard_id]=item.rating as 'know'|'review'
      }
      setReviews(latest)
    }
    setLoading(false)
  }

  const lectures=useMemo(()=>Array.from(new Set(cards.map(c=>c.lecture_id))).sort(),[cards])
  const topics=useMemo(()=>Array.from(new Set(cards.filter(c=>lecture==='all'||c.lecture_id===lecture).map(c=>c.topic))).sort(),[cards,lecture])
  const filtered=useMemo(()=>cards.filter(card=>{
    if (lecture!=='all'&&card.lecture_id!==lecture) return false
    if (topic!=='all'&&card.topic!==topic) return false
    if (reviewOnly&&reviews[card.id]!=='review') return false
    if (query) {
      const hay=(card.front+' '+card.back+' '+card.topic+' '+(card.subtopic||'')).toLowerCase()
      if (!hay.includes(query.toLowerCase())) return false
    }
    return true
  }),[cards,lecture,topic,query,reviewOnly,reviews])

  useEffect(()=>{ setIndex(0); setFlipped(false) },[lecture,topic,query,reviewOnly])
  const card=filtered[index]
  const knownCount=Object.values(reviews).filter(v=>v==='know').length
  const reviewCount=Object.values(reviews).filter(v=>v==='review').length

  async function rate(rating:'know'|'review') {
    if (!card) return
    setReviews(prev=>({...prev,[card.id]:rating}))
    if (supabase) {
      const {data:{user}}=await supabase.auth.getUser()
      if (user) await supabase.from('flashcard_reviews').insert({user_id:user.id,flashcard_id:card.id,rating})
    }
    setMessage(rating==='know' ? (ar?'تم تسجيلها كمعلومة متقنة':'Marked as known') : (ar?'اتضافت لقائمة المراجعة':'Added to review queue'))
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
        <div><strong>{reviewCount}</strong><span>{ar?'راجع تاني':'Review again'}</span></div>
        <div><strong>{cards.length ? Math.round((knownCount/cards.length)*100) : 0}%</strong><span>{ar?'تقدمك':'Mastery'}</span></div>
      </div>

      <div className="flashfilters">
        <label><span>{ar?'المحاضرة':'Lecture'}</span><select value={lecture} onChange={e=>{setLecture(e.target.value);setTopic('all')}}><option value="all">{ar?'كل المحاضرات':'All lectures'}</option>{lectures.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label><span>{ar?'الموضوع':'Topic'}</span><select value={topic} onChange={e=>setTopic(e.target.value)}><option value="all">{ar?'كل الموضوعات':'All topics'}</option>{topics.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label className="flashsearch"><span>{ar?'بحث':'Search'}</span><div><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'ابحث في الكروت':'Search cards'}/></div></label>
        <button className={reviewOnly?'secondary active':'secondary'} onClick={()=>setReviewOnly(v=>!v)}><RotateCcw size={17}/>{ar?'راجع الضعيف':'Review weak'}</button>
        <button className="secondary" onClick={shuffle}><Shuffle size={17}/>{ar?'عشوائي':'Shuffle'}</button>
      </div>

      {card ? <>
        <div className="flashprogress"><span>{index+1} / {filtered.length}</span><div><i style={{width:`${((index+1)/filtered.length)*100}%`}}/></div></div>
        <button className={flipped?'flashcard flipped':'flashcard'} onClick={()=>setFlipped(v=>!v)} aria-label={ar?'اقلب الكارت':'Flip card'}>
          <div className="flashmeta"><span>{card.lecture_id}</span><span>{card.topic}</span></div>
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
          <button className="knowbtn" onClick={()=>void rate('know')}><Check size={20}/>{ar?'عارفها':'Know it'}</button>
        </div>
        <div className="flashnav">
          <button className="secondary" disabled={index===0} onClick={()=>{setIndex(i=>Math.max(0,i-1));setFlipped(false)}}>{ar?'السابق':'Previous'}</button>
          <button className="secondary" disabled={index>=filtered.length-1} onClick={()=>{setIndex(i=>Math.min(filtered.length-1,i+1));setFlipped(false)}}>{ar?'التالي':'Next'}</button>
        </div>
      </> : <div className="empty"><h3>{ar?'مفيش كروت مطابقة':'No matching cards'}</h3><p>{ar?'غيّر الفلاتر أو أوقف Review weak.':'Change the filters or turn off Review weak.'}</p></div>}

      {message && <div className="toast">{message}</div>}
    </div>
  )
}
