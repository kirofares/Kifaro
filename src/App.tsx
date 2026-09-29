import {useEffect,useMemo,useState} from 'react'
import {NavLink,Route,Routes,useNavigate,useParams} from 'react-router-dom'
import {Bell,BookOpen,Brain,Check,ChevronRight,Clock3,GraduationCap,HeartPulse,Home,Library,Menu,MessageSquare,Microscope,Palette,PlayCircle,Search,Settings,Sparkles,Star,Stethoscope,X} from 'lucide-react'
import {anatomateLectures,anatomateYears,getLectureBySlug} from './data/anatomate'
import type {Lecture} from './data/types'

type Theme='blue'|'teal'|'violet'|'forest'
type Lang='en'|'ar'
type ProgressState=Record<string,{progress:number;completed?:boolean;favorite?:boolean}>

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
 const [progress,setProgress]=useStored<ProgressState>('kifaro-progress',{})
 const [query,setQuery]=useState('')
 const [prefs,setPrefs]=useState(false)
 const [drawer,setDrawer]=useState(false)
 const [toast,setToast]=useState('')
 const t=copy[lang]
 const nav=useNavigate()
 useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.body.dataset.theme=theme},[lang,theme])
 const withState=(l:Lecture)=>({...l,...(progress[l.id]||{progress:0})})
 const lectures=anatomateLectures.map(withState)
 const filtered=useMemo(()=>lectures.filter(l=>(l.title+l.module+l.system).toLowerCase().includes(query.toLowerCase())),[query,progress])
 const flash=(m:string)=>{setToast(m);setTimeout(()=>setToast(''),1800)}
 const update=(id:string,p:any)=>setProgress(s=>({...s,[id]:{...(s[id]||{progress:0}),...p}}))
 const links=[['/',t.overview,Home],['/curriculum',t.curriculum,GraduationCap],['/anatomate',t.anatomate,Microscope],['/topics',t.topics,Brain],['/studio',t.studio,Sparkles],['/library',t.library,Library]] as const
 return <div className="shell">
  <header className="topbar">
   <button className="icon mobile" onClick={()=>setDrawer(true)} aria-label="menu"><Menu/></button>
   <button className="brand" onClick={()=>nav('/')}><span className="brandmark"><Stethoscope/></span><strong>KIFARO</strong></button>
   <div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search}/></div>
   <div className="actions"><button className="icon" aria-label="messages"><MessageSquare/></button><button className="icon" aria-label="notifications"><Bell/></button><button className="prefbtn" onClick={()=>setPrefs(true)}><Palette size={18}/><span>{t.preferences}</span></button><div className="avatar">AM</div></div>
  </header>
  <aside className={drawer?'sidebar open':'sidebar'}>
   <div className="mobile sidehead"><strong>KIFARO</strong><button className="icon" onClick={()=>setDrawer(false)}><X/></button></div>
   <nav>{links.map(([to,label,Icon])=><NavLink end={to==='/'} to={to} key={to} onClick={()=>setDrawer(false)}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
   <NavLink to="/preferences"><Settings size={19}/><span>{t.preferences}</span></NavLink>
  </aside>
  {drawer&&<div className="backdrop" onClick={()=>setDrawer(false)}/>}
  <main className="main">
   <Routes>
    <Route path="/" element={<Dashboard t={t} lectures={filtered} go={nav}/>}/>
    <Route path="/curriculum" element={<Curriculum lectures={filtered} go={nav}/>}/>
    <Route path="/anatomate" element={<AnatoMate t={t} go={nav}/>}/>
    <Route path="/anatomate/year/:year/module/:module" element={<ModulePage progress={progress} update={update} flash={flash} t={t}/>}/>
    <Route path="/anatomate/lecture/:slug" element={<LecturePage progress={progress} update={update} flash={flash} t={t}/>}/>
    <Route path="/topics" element={<Topics lectures={filtered} go={nav}/>}/>
    <Route path="/studio" element={<Studio/>}/>
    <Route path="/library" element={<LibraryPage lectures={lectures} update={update} flash={flash} t={t} go={nav}/>}/>
    <Route path="/preferences" element={<Prefs lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} t={t}/>}/>
   </Routes>
  </main>
  {prefs&&<><div className="backdrop prefs" onClick={()=>setPrefs(false)}/><div className="panel"><div className="panelhead"><div><small>KIFARO</small><h2>{t.preferences}</h2></div><button className="icon" onClick={()=>setPrefs(false)}><X/></button></div><Prefs lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} t={t}/></div></>}
  {toast&&<div className="toast"><Check size={18}/>{toast}</div>}
 </div>
}

function PageHead({eyebrow,title,body}:{eyebrow:string;title:string;body:string}){return <div className="pagehead"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{body}</p></div></div>}

function Dashboard({t,lectures,go}:{t:any;lectures:any[];go:any}){
 const current=lectures.find(l=>l.progress>0&&!l.completed)||lectures[0]||anatomateLectures[0]
 return <div className="page">
  <PageHead eyebrow="Tuesday · September 29" title={t.hello} body={t.subtitle}/>
  <div className="dashgrid"><div>
   <section className="section"><div className="sectiontitle"><div><span>{t.continue}</span><h2>Pick up where you left off</h2></div></div>
    <div className="continuecard"><div className="softicon"><Brain/></div><div className="grow"><small>{current.module}</small><h3>{current.title}</h3><div className="meta"><span><Clock3 size={14}/>{current.duration} min</span><span>{current.progress||0}%</span></div><div className="progress"><i style={{width:(current.progress||0)+'%'}}/></div></div><button className="primary" onClick={()=>go('/anatomate/lecture/'+current.slug)}>Continue <ChevronRight size={17}/></button></div>
   </section>
   <section className="hero"><div><span className="pill">ANATOMATE BY KIFARO</span><h2>{t.anatomyTitle}</h2><p>{t.anatomyBody}</p><button className="lightbtn" onClick={()=>go('/anatomate')}>{t.open}<ChevronRight size={17}/></button></div><Microscope className="heroicon"/></section>
   <section className="section"><div className="sectiontitle"><h2>KIFARO Map</h2></div><div className="pathmap">{['Foundations','Musculoskeletal','Systems','Clinical Reasoning'].map((x,i)=><div className="pathcard" key={x}><small>0{i+1}</small><h3>{x}</h3><span>{i===0?'Complete':i===1?'In progress':i===2?'Up next':'Future branch'}</span></div>)}</div></section>
   <section className="section"><div className="sectiontitle"><h2>{t.browse}</h2></div><div className="cards">{lectures.slice(0,3).map(l=><Course key={l.id} l={l} go={go}/>)}</div></section>
  </div>
  <aside className="rightcol"><Mini icon={<BookOpen/>} title={t.revision} body="Meninges · Ventricular system"/><Mini icon={<HeartPulse/>} title={t.weak} body="Ascending tracts · Brainstem localization"/><Mini icon={<GraduationCap/>} title={t.exams} body="CNS Module Quiz · Friday"/><Mini icon={<Sparkles/>} title={t.weekly} body="4.8 hours · 72% target"/></aside>
 </div>
}

function Curriculum({lectures,go}:{lectures:any[];go:any}){return <div className="page"><PageHead eyebrow="ANATOMATE CURRICULUM" title="Curriculum" body="Structured by academic year, module and lecture sequence."/><div className="list">{lectures.map(l=><button className="lessonrow clickable" key={l.id} onClick={()=>go('/anatomate/lecture/'+l.slug)}><div className="softicon"><GraduationCap/></div><div className="grow"><small>Year {l.year} · Lecture {l.sequence}</small><h3>{l.title}</h3><p>{l.module} · {l.duration} min</p><div className="progress"><i style={{width:(l.progress||0)+'%'}}/></div></div><ChevronRight/></button>)}</div></div>}

function AnatoMate({t,go}:{t:any;go:any}){return <div className="page"><section className="hero compact"><div><span className="pill">ANATOMATE BY KIFARO</span><h2>{t.anatomyTitle}</h2><p>{t.anatomyBody}</p></div><Microscope className="heroicon"/></section><div className="yeargrid">{anatomateYears.map(y=><section className="yearcard" key={y.year}><div className="yearbadge">YEAR {y.year}</div><h2>Medical Year {y.year}</h2><p>Structured anatomy curriculum organized by modules.</p><div className="modulelist">{y.modules.map(m=><button key={m.slug} className="modulecard" onClick={()=>go('/anatomate/year/'+y.year+'/module/'+m.slug)}><div><small>{m.lectures.length} lectures</small><h3>{m.title}</h3><p>{m.description}</p></div><ChevronRight/></button>)}</div></section>)}</div></div>}

function ModulePage({progress,update,flash,t}:{progress:ProgressState;update:any;flash:any;t:any}){
 const {year,module}=useParams()
 const y=anatomateYears.find(x=>String(x.year)===year)
 const m=y?.modules.find(x=>x.slug===module)
 const go=useNavigate()
 if(!y||!m)return <div className="page"><PageHead eyebrow="ANATOMATE" title="Module not found" body="This module is not available."/></div>
 const completed=m.lectures.filter(l=>progress[l.id]?.completed).length
 const pct=Math.round((completed/m.lectures.length)*100)
 return <div className="page"><PageHead eyebrow={'YEAR '+y.year} title={m.title} body={m.description}/><div className="modulehero"><div><small>MODULE PROGRESS</small><strong>{pct}%</strong></div><div className="progress"><i style={{width:pct+'%'}}/></div><span>{completed} of {m.lectures.length} lectures completed</span></div><div className="list">{m.lectures.map(l=>{const s=progress[l.id]||{progress:0};return <div className="lessonrow" key={l.id}><div className="lectureseq">{l.sequence}</div><div className="grow"><small>{l.system}</small><h3>{l.title}</h3><p>{l.duration} min · {l.status==='free'?'Free preview':'Purchased'}</p><div className="progress"><i style={{width:(s.progress||0)+'%'}}/></div></div><button className="icon star" onClick={()=>{update(l.id,{favorite:!s.favorite});flash(s.favorite?t.removed:t.saved)}}><Star fill={s.favorite?'currentColor':'none'}/></button><button className="secondary" onClick={()=>go('/anatomate/lecture/'+l.slug)}>Open</button></div>})}</div></div>
}

function LecturePage({progress,update,flash,t}:{progress:ProgressState;update:any;flash:any;t:any}){
 const {slug}=useParams()
 const l=getLectureBySlug(slug)
 const [tab,setTab]=useState<'learn'|'clinical'|'pearls'|'recall'|'mcq'>('learn')
 const [answer,setAnswer]=useState<number|null>(null)
 if(!l)return <div className="page"><PageHead eyebrow="ANATOMATE" title="Lecture not found" body="This lecture is not available."/></div>
 const s=progress[l.id]||{progress:0}
 const quiz=l.mcqs[0]
 return <div className="page">
  <div className="lecturehead"><div><span className="eyebrow">YEAR {l.year} · LECTURE {l.sequence}</span><h1>{l.title}</h1><p>{l.module} · {l.duration} min · {l.system}</p></div><div className="lectureactions"><button className="secondary" onClick={()=>{update(l.id,{favorite:!s.favorite});flash(s.favorite?t.removed:t.saved)}}><Star size={17} fill={s.favorite?'currentColor':'none'}/>{s.favorite?t.unfav:t.fav}</button><button className="primary" onClick={()=>{update(l.id,{completed:true,progress:100});flash(t.done)}}>{t.mark}</button></div></div>
  <div className="lecturelayout"><aside className="lecturepanel"><div className="videobox"><PlayCircle/><span>Lecture video</span><small>Video URL ready to connect</small></div><button className="secondary full">Open slides</button><div className="lectureprogress"><small>YOUR PROGRESS</small><div className="progress"><i style={{width:(s.progress||0)+'%'}}/></div><span>{s.completed?'Completed':(s.progress||0)+'% complete'}</span></div></aside>
  <section className="lecturecontent"><p className="lead">{l.description}</p><div className="tabs">{[['learn','Learning objectives'],['clinical','Clinical relevance'],['pearls','Exam Pearls'],['recall','Active Recall'],['mcq','MCQ Challenge']].map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id as any)}>{label}</button>)}</div>
   {tab==='learn'&&<ContentList title="Learning objectives" items={l.objectives}/>}
   {tab==='clinical'&&<ContentList title="Clinical relevance" items={l.clinical}/>}
   {tab==='pearls'&&<ContentList title="AnatoMate Exam Pearls" items={l.pearls}/>}
   {tab==='recall'&&<ContentList title="Active Recall" items={l.activeRecall}/>}
   {tab==='mcq'&&<div className="contentbox"><h2>MCQ Challenge</h2><div className="quiz"><p>{quiz.question}</p>{quiz.options.map((x,i)=><button key={x} className={answer===i?'selected':''} onClick={()=>setAnswer(i)}><span>{String.fromCharCode(65+i)}</span>{x}</button>)}{answer!==null&&<div className={answer===quiz.answer?'feedback ok':'feedback bad'}>{answer===quiz.answer?'Correct. ':'Not quite. '}{quiz.explanation}</div>}</div></div>}
  </section></div>
 </div>
}

function ContentList({title,items}:{title:string;items:string[]}){return <div className="contentbox"><h2>{title}</h2><div className="learninglist">{items.map((x,i)=><div key={x}><span>{String(i+1).padStart(2,'0')}</span><p>{x}</p></div>)}</div></div>}

function Topics({lectures,go}:{lectures:any[];go:any}){return <div className="page"><PageHead eyebrow="ANATOMATE" title="Topics" body="Review anatomy by region, system and clinical relevance."/><div className="topicgrid">{lectures.map((l,i)=><button className="topiccard clickable" key={l.id} onClick={()=>go('/anatomate/lecture/'+l.slug)}><span className="topicindex">{String(i+1).padStart(2,'0')}</span><div><small>{l.system}</small><h3>{l.title}</h3><p>{l.description}</p><div className="tags"><span>Year {l.year}</span><span>{l.duration} min</span><span>Lecture {l.sequence}</span></div></div></button>)}</div></div>}

function Studio(){return <div className="page"><PageHead eyebrow="TOOLS" title="KIFARO Studio" body="Study tools that turn content into active revision."/><div className="toolgrid">{[['Flashcards','Rapid active-recall decks from your modules.'],['Revision Builder','Build a focused revision session.'],['Exam Preparation','Practice clinically oriented MCQs.'],['Saved Notes','Keep important concepts in one place.']].map(([a,b])=><div className="toolcard" key={a}><div className="softicon"><Sparkles/></div><h3>{a}</h3><p>{b}</p><button className="secondary">Open</button></div>)}</div></div>}

function LibraryPage({lectures,update,flash,t,go}:{lectures:any[];update:any;flash:any;t:any;go:any}){const fav=lectures.filter(x=>x.favorite);return <div className="page"><PageHead eyebrow="MY LIBRARY" title={t.library} body="Favorites and saved learning items."/><div className="cards wide">{(fav.length?fav:lectures.slice(0,3)).map(l=><div className="coursecard" key={l.id}><div className="cover"><Library/><span>YEAR {l.year}</span></div><div className="cardbody"><small>{l.module}</small><h3>{l.title}</h3><p>{l.system}</p><div className="cardactions"><button className="secondary" onClick={()=>go('/anatomate/lecture/'+l.slug)}>Open</button><button className="icon star" onClick={()=>{update(l.id,{favorite:!l.favorite});flash(l.favorite?t.removed:t.saved)}}><Star fill={l.favorite?'currentColor':'none'}/></button></div></div></div>)}</div></div>}

function Prefs({lang,setLang,theme,setTheme,t}:{lang:Lang;setLang:any;theme:Theme;setTheme:any;t:any}){return <div className="prefscontent"><section><h3>{t.theme}</h3><div className="optionlist">{(['blue','teal','violet','forest'] as Theme[]).map(x=><button key={x} className={theme===x?'selected':''} onClick={()=>setTheme(x)}><span className={'swatch '+x}/>{x==='blue'?'KIFARO Blue':x[0].toUpperCase()+x.slice(1)}{theme===x&&<Check/>}</button>)}</div></section><section><h3>{t.language}</h3><div className="optionlist"><button className={lang==='en'?'selected':''} onClick={()=>setLang('en')}>English{lang==='en'&&<Check/>}</button><button className={lang==='ar'?'selected':''} onClick={()=>setLang('ar')}>العربية{lang==='ar'&&<Check/>}</button></div></section></div>}

function Course({l,go}:{l:any;go:any}){return <button className="coursecard clickable" onClick={()=>go('/anatomate/lecture/'+l.slug)}><div className="cover"><Microscope/><span>LECTURE {l.sequence}</span></div><div className="cardbody"><small>{l.module}</small><h3>{l.title}</h3><p>{l.system}</p><div className="meta"><span>{l.duration} min</span><span>{l.progress||0}%</span></div><div className="progress"><i style={{width:(l.progress||0)+'%'}}/></div></div></button>}
function Mini({icon,title,body}:{icon:any;title:string;body:string}){return <div className="minicard"><div className="minihead"><span className="softicon">{icon}</span><h3>{title}</h3></div><p>{body}</p></div>}
