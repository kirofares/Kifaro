import {useEffect,useMemo,useState} from 'react'
import {NavLink,Route,Routes,useNavigate} from 'react-router-dom'
import {Bell,BookOpen,Brain,Check,ChevronRight,Clock3,GraduationCap,HeartPulse,Home,Library,Menu,MessageSquare,Microscope,Palette,PlayCircle,Search,Settings,Sparkles,Star,Stethoscope,X} from 'lucide-react'

type Theme='blue'|'teal'|'violet'|'forest'
type Lang='en'|'ar'
type Lesson={id:string;title:string;module:string;system:string;duration:number;progress:number;completed?:boolean;favorite?:boolean;status:'free'|'purchased'}

const seed:Lesson[]=[
{id:'brachial',title:'Brachial Plexus Nerves',module:'Upper Limb',system:'Musculoskeletal System',duration:38,progress:68,status:'purchased'},
{id:'facial',title:'Facial Bones',module:'Head & Neck',system:'AnatoMate',duration:26,progress:20,status:'free'},
{id:'heart',title:'Heart Chambers',module:'Cardiovascular',system:'Cardiovascular System',duration:32,progress:0,status:'free'},
{id:'upper-limb',title:'Upper Limb Anatomy',module:'Locomotor',system:'Musculoskeletal System',duration:54,progress:100,completed:true,status:'purchased'}
]

const copy={
en:{overview:'Overview',curriculum:'Curriculum',anatomate:'AnatoMate',topics:'Topics',room:'Learning Room',studio:'KIFARO Studio',library:'My Library',preferences:'Preferences',search:'Search courses, topics, or exams',hello:'Good evening, Amina.',subtitle:'Continue your medical journey with one focused step at a time.',continue:'Continue Learning',open:'Open AnatoMate',browse:'Browse your pathways',revision:'Revision Queue',weak:'Weak topics to revisit',exams:'Upcoming KIFARO Exams',weekly:'Weekly progress',mark:'Mark as complete',fav:'Add to favorites',unfav:'Remove favorite',theme:'Theme color',language:'Language',saved:'Saved to favorites',removed:'Removed from favorites',done:'Lesson completed',anatomyTitle:'Learn anatomy as a living system.',anatomyBody:'Visual, clinically connected anatomy designed for real understanding — not memorization alone.'},
ar:{overview:'الرئيسية',curriculum:'المنهج',anatomate:'AnatoMate',topics:'الموضوعات',room:'غرفة التعلم',studio:'KIFARO Studio',library:'مكتبتي',preferences:'التفضيلات',search:'ابحث في المقررات أو الموضوعات أو الاختبارات',hello:'مساء الخير، أمينة.',subtitle:'كمّلي رحلتك الطبية بخطوة مركزة كل مرة.',continue:'متابعة التعلم',open:'افتح AnatoMate',browse:'استعرض مساراتك',revision:'قائمة المراجعة',weak:'موضوعات تحتاج مراجعة',exams:'اختبارات KIFARO القادمة',weekly:'التقدم الأسبوعي',mark:'تحديد كمكتمل',fav:'أضف للمفضلة',unfav:'إزالة من المفضلة',theme:'لون الواجهة',language:'اللغة',saved:'تمت الإضافة للمفضلة',removed:'تمت الإزالة من المفضلة',done:'تم إكمال المحاضرة',anatomyTitle:'تعلّم التشريح كنظام حي مترابط.',anatomyBody:'تشريح بصري مرتبط سريريًا، مصمم للفهم الحقيقي وليس للحفظ فقط.'}
}

function useStored<T>(key:string,initial:T){
 const [v,setV]=useState<T>(()=>{try{const x=localStorage.getItem(key);return x?JSON.parse(x):initial}catch{return initial}})
 useEffect(()=>localStorage.setItem(key,JSON.stringify(v)),[key,v])
 return [v,setV] as const
}

export default function App(){
 const [lang,setLang]=useStored<Lang>('kifaro-lang','en')
 const [theme,setTheme]=useStored<Theme>('kifaro-theme','blue')
 const [lessons,setLessons]=useStored<Lesson[]>('kifaro-lessons',seed)
 const [query,setQuery]=useState('')
 const [prefs,setPrefs]=useState(false)
 const [drawer,setDrawer]=useState(false)
 const [toast,setToast]=useState('')
 const t=copy[lang]
 const nav=useNavigate()
 useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.body.dataset.theme=theme},[lang,theme])
 const filtered=useMemo(()=>lessons.filter(l=>(l.title+l.module+l.system).toLowerCase().includes(query.toLowerCase())),[lessons,query])
 const flash=(m:string)=>{setToast(m);setTimeout(()=>setToast(''),1800)}
 const update=(id:string,p:Partial<Lesson>)=>setLessons(ls=>ls.map(l=>l.id===id?{...l,...p}:l))
 const links=[['/',t.overview,Home],['/curriculum',t.curriculum,GraduationCap],['/anatomate',t.anatomate,Microscope],['/topics',t.topics,Brain],['/learning-room',t.room,PlayCircle],['/studio',t.studio,Sparkles],['/library',t.library,Library]] as const
 return <div className="shell">
  <header className="topbar">
   <button className="icon mobile" onClick={()=>setDrawer(true)} aria-label="menu"><Menu/></button>
   <button className="brand" onClick={()=>nav('/')}><span className="brandmark"><Stethoscope/></span><strong>KIFARO</strong></button>
   <div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search}/></div>
   <div className="actions"><button className="icon"><MessageSquare/></button><button className="icon"><Bell/></button><button className="prefbtn" onClick={()=>setPrefs(true)}><Palette size={18}/><span>{t.preferences}</span></button><div className="avatar">AM</div></div>
  </header>
  <aside className={drawer?'sidebar open':'sidebar'}>
   <div className="mobile sidehead"><strong>KIFARO</strong><button className="icon" onClick={()=>setDrawer(false)}><X/></button></div>
   <nav>{links.map(([to,label,Icon])=><NavLink end={to==='/'} to={to} key={to} onClick={()=>setDrawer(false)}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
   <NavLink to="/preferences"><Settings size={19}/><span>{t.preferences}</span></NavLink>
  </aside>
  {drawer&&<div className="backdrop" onClick={()=>setDrawer(false)}/>}
  <main className="main">
   <Routes>
    <Route path="/" element={<Dashboard t={t} lessons={filtered} go={nav}/>}/>
    <Route path="/curriculum" element={<Curriculum lessons={filtered} update={update} flash={flash} t={t}/>}/>
    <Route path="/anatomate" element={<AnatoMate lessons={filtered} update={update} flash={flash} t={t} go={nav}/>}/>
    <Route path="/topics" element={<Topics lessons={filtered}/>}/>
    <Route path="/learning-room" element={<LearningRoom lesson={lessons[0]} update={update} flash={flash} t={t}/>}/>
    <Route path="/studio" element={<Studio/>}/>
    <Route path="/library" element={<LibraryPage lessons={lessons} update={update} flash={flash} t={t}/>}/>
    <Route path="/preferences" element={<Prefs lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} t={t}/>}/>
   </Routes>
  </main>
  {prefs&&<><div className="backdrop prefs" onClick={()=>setPrefs(false)}/><div className="panel"><div className="panelhead"><div><small>KIFARO</small><h2>{t.preferences}</h2></div><button className="icon" onClick={()=>setPrefs(false)}><X/></button></div><Prefs lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} t={t}/></div></>}
  {toast&&<div className="toast"><Check size={18}/>{toast}</div>}
 </div>
}

function PageHead({eyebrow,title,body}:{eyebrow:string;title:string;body:string}){return <div className="pagehead"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{body}</p></div></div>}

function Dashboard({t,lessons,go}:{t:any;lessons:Lesson[];go:any}){
 const current=lessons[0]||seed[0]
 return <div className="page">
  <PageHead eyebrow="Tuesday · September 29" title={t.hello} body={t.subtitle}/>
  <div className="dashgrid"><div>
   <section className="section"><div className="sectiontitle"><div><span>{t.continue}</span><h2>Pick up where you left off</h2></div></div>
    <div className="continuecard"><div className="softicon"><Brain/></div><div className="grow"><small>{current.module}</small><h3>{current.title}</h3><div className="meta"><span><Clock3 size={14}/>{current.duration} min</span><span>{current.progress}%</span></div><div className="progress"><i style={{width:current.progress+'%'}}/></div></div><button className="primary" onClick={()=>go('/learning-room')}>Continue <ChevronRight size={17}/></button></div>
   </section>
   <section className="hero"><div><span className="pill">ANATOMATE BY KIFARO</span><h2>{t.anatomyTitle}</h2><p>{t.anatomyBody}</p><button className="lightbtn" onClick={()=>go('/anatomate')}>{t.open}<ChevronRight size={17}/></button></div><Microscope className="heroicon"/></section>
   <section className="section"><div className="sectiontitle"><h2>KIFARO Map</h2></div><div className="pathmap">{['Foundations','Musculoskeletal','Systems','Clinical Reasoning'].map((x,i)=><div className="pathcard" key={x}><small>0{i+1}</small><h3>{x}</h3><span>{i===0?'Complete':i===1?'In progress':i===2?'Up next':'Future branch'}</span></div>)}</div></section>
   <section className="section"><div className="sectiontitle"><h2>{t.browse}</h2></div><div className="cards">{lessons.slice(0,3).map(l=><Course key={l.id} l={l}/>)}</div></section>
  </div>
  <aside className="rightcol"><Mini icon={<BookOpen/>} title={t.revision} body="Brachial plexus · Heart chambers"/><Mini icon={<HeartPulse/>} title={t.weak} body="Cranial foramina · Thoracic wall"/><Mini icon={<GraduationCap/>} title={t.exams} body="Foundations Quiz · Friday"/><Mini icon={<Sparkles/>} title={t.weekly} body="4.8 hours · 72% target"/></aside>
 </div>
}

function Curriculum({lessons,update,flash,t}:{lessons:Lesson[];update:any;flash:any;t:any}){return <div className="page"><PageHead eyebrow="MEDICAL YEAR 1" title={t.curriculum} body="Modules, courses and structured pathways for your current year."/><div className="list">{lessons.map(l=><div className="lessonrow" key={l.id}><div className="softicon"><GraduationCap/></div><div className="grow"><small>{l.system}</small><h3>{l.title}</h3><p>{l.module} · {l.duration} min</p><div className="progress"><i style={{width:l.progress+'%'}}/></div></div><button className="icon star" onClick={()=>{update(l.id,{favorite:!l.favorite});flash(l.favorite?t.removed:t.saved)}}><Star fill={l.favorite?'currentColor':'none'}/></button></div>)}</div></div>}

function AnatoMate({lessons,update,flash,t,go}:{lessons:Lesson[];update:any;flash:any;t:any;go:any}){return <div className="page"><section className="hero compact"><div><span className="pill">ANATOMATE BY KIFARO</span><h2>{t.anatomyTitle}</h2><p>{t.anatomyBody}</p></div><Microscope className="heroicon"/></section><div className="systemtabs">{['All','Musculoskeletal','Cardiovascular','Nervous','Respiratory'].map((x,i)=><button className={i===0?'chip active':'chip'} key={x}>{x}</button>)}</div><div className="cards wide">{lessons.map(l=><div className="coursecard" key={l.id}><div className="cover"><Microscope/><span>{l.status==='free'?'FREE':'PURCHASED'}</span></div><div className="cardbody"><small>{l.module}</small><h3>{l.title}</h3><p>{l.system} · {l.duration} min</p><div className="progress"><i style={{width:l.progress+'%'}}/></div><div className="cardactions"><button className="secondary" onClick={()=>go('/learning-room')}>Open lesson</button><button className="icon star" onClick={()=>{update(l.id,{favorite:!l.favorite});flash(l.favorite?t.removed:t.saved)}}><Star fill={l.favorite?'currentColor':'none'}/></button></div></div></div>)}</div></div>}

function Topics({lessons}:{lessons:Lesson[]}){return <div className="page"><PageHead eyebrow="ANATOMATE" title="Topics" body="Review anatomy by region, system and clinical relevance."/><div className="topicgrid">{lessons.map((l,i)=><div className="topiccard" key={l.id}><span className="topicindex">0{i+1}</span><div><small>{l.system}</small><h3>{l.title}</h3><p>Learning objectives, key concepts, clinical relevance and related topics.</p><div className="tags"><span>{l.module}</span><span>{l.duration} min</span><span>Core</span></div></div></div>)}</div></div>}

function LearningRoom({lesson,update,flash,t}:{lesson:Lesson;update:any;flash:any;t:any}){
 const [answer,setAnswer]=useState<number|null>(null)
 return <div className="page"><div className="roomtop"><div><span className="eyebrow">LEARNING ROOM</span><h1>{lesson.title}</h1><p>{lesson.module} · {lesson.system}</p></div><div className="timer"><Clock3 size={18}/> 18:42</div></div><div className="roomgrid"><aside className="rail"><small>LESSON FLOW</small>{['Learning objectives','Core anatomy','Clinical relevance','Active recall','MCQ challenge'].map((x,i)=><button className={i===0?'active':''} key={x}><span>{i+1}</span>{x}</button>)}</aside><section><div className="stage"><span className="eyebrow">LEARNING OBJECTIVES</span><h2>Understand the structure before memorizing the details.</h2><p className="lead">By the end of this lesson, you should be able to identify the key structures, explain their relationships, and use them in simple clinical localization.</p><div className="concept"><Brain/><div><strong>Key concept</strong><p>Structure → relationship → function → clinical meaning.</p></div></div><h3>Quick check</h3><div className="quiz"><p>Which principle best fits AnatoMate learning?</p>{['Memorize isolated lists','Understand relationships first','Skip clinical context'].map((x,i)=><button className={answer===i?'selected':''} onClick={()=>setAnswer(i)} key={x}><span>{String.fromCharCode(65+i)}</span>{x}</button>)}{answer!==null&&<div className={answer===1?'feedback ok':'feedback bad'}>{answer===1?'Correct — relationships create usable anatomy knowledge.':'Try again — focus on relationships before isolated detail.'}</div>}</div></div><div className="roomactions"><button className="secondary">Previous</button><button className="primary" onClick={()=>{update(lesson.id,{completed:true,progress:100});flash(t.done)}}>{t.mark}</button></div></section></div></div>
}

function Studio(){return <div className="page"><PageHead eyebrow="TOOLS" title="KIFARO Studio" body="Study tools that turn content into active revision."/><div className="toolgrid">{[['Flashcards','Rapid active-recall decks from your modules.'],['Revision Builder','Build a focused revision session.'],['Exam Preparation','Practice clinically oriented MCQs.'],['Saved Notes','Keep important concepts in one place.']].map(([a,b])=><div className="toolcard" key={a}><div className="softicon"><Sparkles/></div><h3>{a}</h3><p>{b}</p><button className="secondary">Open</button></div>)}</div></div>}

function LibraryPage({lessons,update,flash,t}:{lessons:Lesson[];update:any;flash:any;t:any}){const fav=lessons.filter(x=>x.favorite);return <div className="page"><PageHead eyebrow="MY LIBRARY" title={t.library} body="Favorites, recent purchases and saved learning items."/><div className="cards wide">{(fav.length?fav:lessons.slice(0,2)).map(l=><div className="coursecard" key={l.id}><div className="cover"><Library/><span>{l.status}</span></div><div className="cardbody"><h3>{l.title}</h3><p>{l.module}</p><button className="secondary" onClick={()=>{update(l.id,{favorite:!l.favorite});flash(l.favorite?t.removed:t.saved)}}>{l.favorite?t.unfav:t.fav}</button></div></div>)}</div></div>}

function Prefs({lang,setLang,theme,setTheme,t}:{lang:Lang;setLang:any;theme:Theme;setTheme:any;t:any}){return <div className="prefscontent"><section><h3>{t.theme}</h3><div className="optionlist">{(['blue','teal','violet','forest'] as Theme[]).map(x=><button key={x} className={theme===x?'selected':''} onClick={()=>setTheme(x)}><span className={'swatch '+x}/>{x==='blue'?'KIFARO Blue':x[0].toUpperCase()+x.slice(1)}{theme===x&&<Check/>}</button>)}</div></section><section><h3>{t.language}</h3><div className="optionlist"><button className={lang==='en'?'selected':''} onClick={()=>setLang('en')}>English{lang==='en'&&<Check/>}</button><button className={lang==='ar'?'selected':''} onClick={()=>setLang('ar')}>العربية{lang==='ar'&&<Check/>}</button></div></section></div>}

function Course({l}:{l:Lesson}){return <div className="coursecard"><div className="cover"><Microscope/><span>{l.status==='free'?'FREE':'PURCHASED'}</span></div><div className="cardbody"><small>{l.module}</small><h3>{l.title}</h3><p>{l.system}</p><div className="meta"><span>{l.duration} min</span><span>{l.progress}%</span></div><div className="progress"><i style={{width:l.progress+'%'}}/></div></div></div>}
function Mini({icon,title,body}:{icon:any;title:string;body:string}){return <div className="minicard"><div className="minihead"><span className="softicon">{icon}</span><h3>{title}</h3></div><p>{body}</p></div>}
