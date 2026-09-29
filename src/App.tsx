import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  Bell, BookOpen, Brain, Check, ChevronRight, Clock3, GraduationCap,
  HeartPulse, Home, Library, Menu, MessageSquare, Microscope, Palette,
  PlayCircle, Search, Settings, Sparkles, Star, Stethoscope, X,
} from 'lucide-react'
import { anatomateLectures, anatomateYears, getLectureBySlug } from './data/anatomate'
import type { Lecture } from './data/types'

type Theme = 'blue' | 'teal' | 'violet' | 'forest'
type Lang = 'en' | 'ar'
type ProgressState = Record<string, { progress: number; completed?: boolean; favorite?: boolean }>

const copy = {
  en: {
    overview: 'Overview', curriculum: 'Curriculum', anatomate: 'AnatoMate',
    topics: 'Topics', studio: 'KIFARO Studio', library: 'My Library',
    preferences: 'Preferences', search: 'Search courses, topics, or exams',
    hello: 'Good evening, Amina.',
    subtitle: 'Continue your medical journey with one focused step at a time.',
    continue: 'Continue Learning', open: 'Open AnatoMate', browse: 'Browse your pathways',
    revision: 'Revision Queue', weak: 'Weak topics to revisit',
    exams: 'Upcoming KIFARO Exams', weekly: 'Weekly progress',
    mark: 'Mark as complete', fav: 'Add to favorites', unfav: 'Remove favorite',
    theme: 'Theme color', language: 'Language', saved: 'Saved to favorites',
    removed: 'Removed from favorites', done: 'Lesson completed',
    anatomyTitle: 'Learn anatomy as a living system.',
    anatomyBody: 'Visual, clinically connected anatomy designed for real understanding — not memorization alone.',
  },
  ar: {
    overview: 'الرئيسية', curriculum: 'المنهج', anatomate: 'AnatoMate',
    topics: 'الموضوعات', studio: 'KIFARO Studio', library: 'مكتبتي',
    preferences: 'التفضيلات', search: 'ابحث في المقررات أو الموضوعات أو الاختبارات',
    hello: 'مساء الخير، أمينة.',
    subtitle: 'كمّلي رحلتك الطبية بخطوة مركزة كل مرة.',
    continue: 'متابعة التعلم', open: 'افتح AnatoMate', browse: 'استعرض مساراتك',
    revision: 'قائمة المراجعة', weak: 'موضوعات تحتاج مراجعة',
    exams: 'اختبارات KIFARO القادمة', weekly: 'التقدم الأسبوعي',
    mark: 'تحديد كمكتمل', fav: 'أضف للمفضلة', unfav: 'إزالة من المفضلة',
    theme: 'لون الواجهة', language: 'اللغة', saved: 'تمت الإضافة للمفضلة',
    removed: 'تمت الإزالة من المفضلة', done: 'تم إكمال المحاضرة',
    anatomyTitle: 'تعلّم التشريح كنظام حي مترابط.',
    anatomyBody: 'تشريح بصري مرتبط سريريًا، مصمم للفهم الحقيقي وليس للحفظ فقط.',
  },
}

function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue] as const
}

export default function App() {
  const [lang, setLang] = useStored<Lang>('kifaro-lang', 'en')
  const [theme, setTheme] = useStored<Theme>('kifaro-theme', 'blue')
  const [progress, setProgress] = useStored<ProgressState>('kifaro-progress', {})
  const [query, setQuery] = useState('')
  const [prefs, setPrefs] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [toast, setToast] = useState('')
  const t = copy[lang]
  const nav = useNavigate()

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.body.dataset.theme = theme
  }, [lang, theme])

  const lectures = useMemo(
    () => anatomateLectures.map((lecture) => ({
      ...lecture,
      ...(progress[lecture.id] || { progress: 0 }),
    })),
    [progress],
  )

  const filtered = useMemo(
    () => lectures.filter((lecture) =>
      (lecture.title + lecture.module + lecture.system).toLowerCase().includes(query.toLowerCase())
    ),
    [lectures, query],
  )

  const flash = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 1800)
  }

  const update = (id: string, patch: Partial<ProgressState[string]>) => {
    setProgress((state) => ({
      ...state,
      [id]: { ...(state[id] || { progress: 0 }), ...patch },
    }))
  }

  const links = [
    ['/', t.overview, Home],
    ['/curriculum', t.curriculum, GraduationCap],
    ['/anatomate', t.anatomate, Microscope],
    ['/topics', t.topics, Brain],
    ['/studio', t.studio, Sparkles],
    ['/library', t.library, Library],
  ] as const

  return (
    <div className="shell">
      <header className="topbar">
        <button className="icon mobile" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu /></button>
        <button className="brand" onClick={() => nav('/')}>
          <span className="brandmark"><Stethoscope /></span><strong>KIFARO</strong>
        </button>

        <div className="search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} />
        </div>

        <div className="actions">
          <button className="icon" aria-label="Messages"><MessageSquare /></button>
          <button className="icon" aria-label="Notifications"><Bell /></button>
          <button className="prefbtn" onClick={() => setPrefs(true)}><Palette size={18} /><span>{t.preferences}</span></button>
          <div className="avatar">AM</div>
        </div>
      </header>

      <aside className={drawer ? 'sidebar open' : 'sidebar'}>
        <div className="mobile sidehead">
          <strong>KIFARO</strong>
          <button className="icon" onClick={() => setDrawer(false)} aria-label="Close menu"><X /></button>
        </div>
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink end={to === '/'} to={to} key={to} onClick={() => setDrawer(false)}>
              <Icon size={19} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <NavLink to="/preferences"><Settings size={19} /><span>{t.preferences}</span></NavLink>
      </aside>

      {drawer && <div className="backdrop" onClick={() => setDrawer(false)} />}

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard t={t} lectures={filtered} go={nav} />} />
          <Route path="/curriculum" element={<Curriculum lectures={filtered} go={nav} />} />
          <Route path="/anatomate" element={<AnatoMate t={t} go={nav} />} />
          <Route path="/anatomate/year/:year/module/:module" element={<ModulePage progress={progress} update={update} flash={flash} t={t} />} />
          <Route path="/anatomate/lecture/:slug" element={<LecturePage progress={progress} update={update} flash={flash} t={t} />} />
          <Route path="/topics" element={<Topics lectures={filtered} go={nav} />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/library" element={<LibraryPage lectures={lectures} update={update} flash={flash} t={t} go={nav} />} />
          <Route path="/preferences" element={<Prefs lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} t={t} />} />
        </Routes>
      </main>

      {prefs && (
        <>
          <div className="backdrop prefs" onClick={() => setPrefs(false)} />
          <div className="panel">
            <div className="panelhead">
              <div><small>KIFARO</small><h2>{t.preferences}</h2></div>
              <button className="icon" onClick={() => setPrefs(false)} aria-label="Close preferences"><X /></button>
            </div>
            <Prefs lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} t={t} />
          </div>
        </>
      )}

      {toast && <div className="toast"><Check size={18} />{toast}</div>}
    </div>
  )
}

function PageHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="pagehead">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </div>
  )
}

function Dashboard({ t, lectures, go }: { t: any; lectures: any[]; go: (path: string) => void }) {
  const current = lectures.find((lecture) => lecture.progress > 0 && !lecture.completed) || lectures[0] || anatomateLectures[0]

  return (
    <div className="page">
      <PageHead eyebrow="Tuesday · September 29" title={t.hello} body={t.subtitle} />
      <div className="dashgrid">
        <div>
          <section className="section">
            <div className="sectiontitle"><div><span>{t.continue}</span><h2>Pick up where you left off</h2></div></div>
            <div className="continuecard">
              <div className="softicon"><Brain /></div>
              <div className="grow">
                <small>{current.module}</small>
                <h3>{current.title}</h3>
                <div className="meta"><span><Clock3 size={14} />{current.duration} min</span><span>{current.progress || 0}%</span></div>
                <div className="progress"><i style={{ width: (current.progress || 0) + '%' }} /></div>
              </div>
              <button className="primary" onClick={() => go('/anatomate/lecture/' + current.slug)}>Continue <ChevronRight size={17} /></button>
            </div>
          </section>

          <section className="hero">
            <div>
              <span className="pill">ANATOMATE BY KIFARO</span>
              <h2>{t.anatomyTitle}</h2>
              <p>{t.anatomyBody}</p>
              <button className="lightbtn" onClick={() => go('/anatomate')}>{t.open}<ChevronRight size={17} /></button>
            </div>
            <Microscope className="heroicon" />
          </section>

          <section className="section">
            <div className="sectiontitle"><h2>KIFARO Map</h2></div>
            <div className="pathmap">
              {['Foundations', 'Musculoskeletal', 'Systems', 'Clinical Reasoning'].map((item, index) => (
                <div className="pathcard" key={item}>
                  <small>0{index + 1}</small><h3>{item}</h3>
                  <span>{index === 0 ? 'Complete' : index === 1 ? 'In progress' : index === 2 ? 'Up next' : 'Future branch'}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="sectiontitle"><h2>{t.browse}</h2></div>
            <div className="cards">{lectures.slice(0, 3).map((lecture) => <Course key={lecture.id} l={lecture} go={go} />)}</div>
          </section>
        </div>

        <aside className="rightcol">
          <Mini icon={<BookOpen />} title={t.revision} body="Meninges · Ventricular system" />
          <Mini icon={<HeartPulse />} title={t.weak} body="Ascending tracts · Brainstem localization" />
          <Mini icon={<GraduationCap />} title={t.exams} body="CNS Module Quiz · Friday" />
          <Mini icon={<Sparkles />} title={t.weekly} body="4.8 hours · 72% target" />
        </aside>
      </div>
    </div>
  )
}

function Curriculum({ lectures, go }: { lectures: any[]; go: (path: string) => void }) {
  return (
    <div className="page">
      <PageHead eyebrow="ANATOMATE CURRICULUM" title="Curriculum" body="Structured by academic year, module and lecture sequence." />
      <div className="list">
        {lectures.map((lecture) => (
          <button className="lessonrow clickable" key={lecture.id} onClick={() => go('/anatomate/lecture/' + lecture.slug)}>
            <div className="softicon"><GraduationCap /></div>
            <div className="grow">
              <small>Year {lecture.year} · Lecture {lecture.sequence}</small>
              <h3>{lecture.title}</h3>
              <p>{lecture.module} · {lecture.duration} min</p>
              <div className="progress"><i style={{ width: (lecture.progress || 0) + '%' }} /></div>
            </div>
            <ChevronRight />
          </button>
        ))}
      </div>
    </div>
  )
}

function AnatoMate({ t, go }: { t: any; go: (path: string) => void }) {
  return (
    <div className="page">
      <section className="hero compact">
        <div><span className="pill">ANATOMATE BY KIFARO</span><h2>{t.anatomyTitle}</h2><p>{t.anatomyBody}</p></div>
        <Microscope className="heroicon" />
      </section>

      <div className="yeargrid">
        {anatomateYears.map((year) => (
          <section className="yearcard" key={year.year}>
            <div className="yearbadge">YEAR {year.year}</div>
            <h2>Medical Year {year.year}</h2>
            <p>Structured anatomy curriculum organized by modules.</p>
            <div className="modulelist">
              {year.modules.map((module) => (
                <button
                  key={module.slug}
                  className="modulecard"
                  disabled={module.status === 'coming-soon'}
                  onClick={() => module.status !== 'coming-soon' && go('/anatomate/year/' + year.year + '/module/' + module.slug)}
                >
                  <div>
                    <small>{module.status === 'coming-soon' ? 'Coming soon' : module.lectures.length + ' lectures'}</small>
                    <h3>{module.title}</h3>
                    <p>{module.description}</p>
                  </div>
                  <ChevronRight />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function ModulePage({ progress, update, flash, t }: { progress: ProgressState; update: any; flash: any; t: any }) {
  const { year, module } = useParams()
  const nav = useNavigate()
  const yearData = anatomateYears.find((item) => String(item.year) === year)
  const moduleData = yearData?.modules.find((item) => item.slug === module)

  if (!yearData || !moduleData) {
    return <div className="page"><PageHead eyebrow="ANATOMATE" title="Module not found" body="This module is not available." /></div>
  }

  const completed = moduleData.lectures.filter((lecture) => progress[lecture.id]?.completed).length
  const pct = moduleData.lectures.length ? Math.round((completed / moduleData.lectures.length) * 100) : 0

  return (
    <div className="page">
      <PageHead eyebrow={'YEAR ' + yearData.year} title={moduleData.title} body={moduleData.description} />
      <div className="modulehero">
        <div><small>MODULE PROGRESS</small><strong>{pct}%</strong></div>
        <div className="progress"><i style={{ width: pct + '%' }} /></div>
        <span>{completed} of {moduleData.lectures.length} lectures completed</span>
      </div>

      <div className="list">
        {moduleData.lectures.map((lecture) => {
          const state = progress[lecture.id] || { progress: 0 }
          return (
            <div className="lessonrow" key={lecture.id}>
              <div className="lectureseq">{lecture.sequence}</div>
              <div className="grow">
                <small>{lecture.system}</small>
                <h3>{lecture.title}</h3>
                <p>{lecture.duration} min · {lecture.status === 'free' ? 'Free preview' : 'Purchased'}</p>
                <div className="progress"><i style={{ width: (state.progress || 0) + '%' }} /></div>
              </div>
              <button
                className="icon star"
                aria-label="Toggle favorite"
                onClick={() => {
                  update(lecture.id, { favorite: !state.favorite })
                  flash(state.favorite ? t.removed : t.saved)
                }}
              >
                <Star fill={state.favorite ? 'currentColor' : 'none'} />
              </button>
              <button className="secondary" onClick={() => nav('/anatomate/lecture/' + lecture.slug)}>Open</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LecturePage({ progress, update, flash, t }: { progress: ProgressState; update: any; flash: any; t: any }) {
  const { slug } = useParams()
  const lecture = getLectureBySlug(slug)
  const [tab, setTab] = useState<'learn' | 'clinical' | 'pearls' | 'recall' | 'mcq'>('learn')
  const [answer, setAnswer] = useState<number | null>(null)

  if (!lecture) {
    return <div className="page"><PageHead eyebrow="ANATOMATE" title="Lecture not found" body="This lecture is not available." /></div>
  }

  const state = progress[lecture.id] || { progress: 0 }
  const quiz = lecture.mcqs[0]

  return (
    <div className="page">
      <div className="lecturehead">
        <div>
          <span className="eyebrow">YEAR {lecture.year} · LECTURE {lecture.sequence}</span>
          <h1>{lecture.title}</h1>
          <p>{lecture.module} · {lecture.duration} min · {lecture.system}</p>
        </div>
        <div className="lectureactions">
          <button
            className="secondary"
            onClick={() => {
              update(lecture.id, { favorite: !state.favorite })
              flash(state.favorite ? t.removed : t.saved)
            }}
          >
            <Star size={17} fill={state.favorite ? 'currentColor' : 'none'} />
            {state.favorite ? t.unfav : t.fav}
          </button>
          <button
            className="primary"
            onClick={() => {
              update(lecture.id, { completed: true, progress: 100 })
              flash(t.done)
            }}
          >
            {t.mark}
          </button>
        </div>
      </div>

      <div className="lecturelayout">
        <aside className="lecturepanel">
          <div className="videobox"><PlayCircle /><span>Lecture video</span><small>Video URL ready to connect</small></div>
          <button className="secondary full">Open slides</button>
          <div className="lectureprogress">
            <small>YOUR PROGRESS</small>
            <div className="progress"><i style={{ width: (state.progress || 0) + '%' }} /></div>
            <span>{state.completed ? 'Completed' : (state.progress || 0) + '% complete'}</span>
          </div>
        </aside>

        <section className="lecturecontent">
          <p className="lead">{lecture.description}</p>
          <div className="tabs">
            <button className={tab === 'learn' ? 'active' : ''} onClick={() => setTab('learn')}>Learning objectives</button>
            <button className={tab === 'clinical' ? 'active' : ''} onClick={() => setTab('clinical')}>Clinical relevance</button>
            <button className={tab === 'pearls' ? 'active' : ''} onClick={() => setTab('pearls')}>Exam Pearls</button>
            <button className={tab === 'recall' ? 'active' : ''} onClick={() => setTab('recall')}>Active Recall</button>
            <button className={tab === 'mcq' ? 'active' : ''} onClick={() => setTab('mcq')}>MCQ Challenge</button>
          </div>

          {tab === 'learn' && <ContentList title="Learning objectives" items={lecture.objectives} />}
          {tab === 'clinical' && <ContentList title="Clinical relevance" items={lecture.clinical} />}
          {tab === 'pearls' && <ContentList title="AnatoMate Exam Pearls" items={lecture.pearls} />}
          {tab === 'recall' && <ContentList title="Active Recall" items={lecture.activeRecall} />}
          {tab === 'mcq' && quiz && (
            <div className="contentbox">
              <h2>MCQ Challenge</h2>
              <div className="quiz">
                <p>{quiz.question}</p>
                {quiz.options.map((option, index) => (
                  <button key={option} className={answer === index ? 'selected' : ''} onClick={() => setAnswer(index)}>
                    <span>{String.fromCharCode(65 + index)}</span>{option}
                  </button>
                ))}
                {answer !== null && (
                  <div className={answer === quiz.answer ? 'feedback ok' : 'feedback bad'}>
                    {answer === quiz.answer ? 'Correct. ' : 'Not quite. '}{quiz.explanation}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ContentList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="contentbox">
      <h2>{title}</h2>
      <div className="learninglist">
        {items.map((item, index) => (
          <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></div>
        ))}
      </div>
    </div>
  )
}

function Topics({ lectures, go }: { lectures: any[]; go: (path: string) => void }) {
  return (
    <div className="page">
      <PageHead eyebrow="ANATOMATE" title="Topics" body="Review anatomy by region, system and clinical relevance." />
      <div className="topicgrid">
        {lectures.map((lecture, index) => (
          <button className="topiccard clickable" key={lecture.id} onClick={() => go('/anatomate/lecture/' + lecture.slug)}>
            <span className="topicindex">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <small>{lecture.system}</small><h3>{lecture.title}</h3><p>{lecture.description}</p>
              <div className="tags"><span>Year {lecture.year}</span><span>{lecture.duration} min</span><span>Lecture {lecture.sequence}</span></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function Studio() {
  const tools = [
    ['Flashcards', 'Rapid active-recall decks from your modules.'],
    ['Revision Builder', 'Build a focused revision session.'],
    ['Exam Preparation', 'Practice clinically oriented MCQs.'],
    ['Saved Notes', 'Keep important concepts in one place.'],
  ]
  return (
    <div className="page">
      <PageHead eyebrow="TOOLS" title="KIFARO Studio" body="Study tools that turn content into active revision." />
      <div className="toolgrid">
        {tools.map(([title, body]) => (
          <div className="toolcard" key={title}><div className="softicon"><Sparkles /></div><h3>{title}</h3><p>{body}</p><button className="secondary">Open</button></div>
        ))}
      </div>
    </div>
  )
}

function LibraryPage({ lectures, update, flash, t, go }: { lectures: any[]; update: any; flash: any; t: any; go: (path: string) => void }) {
  const favorites = lectures.filter((lecture) => lecture.favorite)
  const visible = favorites.length ? favorites : lectures.slice(0, 3)
  return (
    <div className="page">
      <PageHead eyebrow="MY LIBRARY" title={t.library} body="Favorites and saved learning items." />
      <div className="cards wide">
        {visible.map((lecture) => (
          <div className="coursecard" key={lecture.id}>
            <div className="cover"><Library /><span>YEAR {lecture.year}</span></div>
            <div className="cardbody">
              <small>{lecture.module}</small><h3>{lecture.title}</h3><p>{lecture.system}</p>
              <div className="cardactions">
                <button className="secondary" onClick={() => go('/anatomate/lecture/' + lecture.slug)}>Open</button>
                <button
                  className="icon star"
                  aria-label="Toggle favorite"
                  onClick={() => {
                    update(lecture.id, { favorite: !lecture.favorite })
                    flash(lecture.favorite ? t.removed : t.saved)
                  }}
                >
                  <Star fill={lecture.favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Prefs({ lang, setLang, theme, setTheme, t }: { lang: Lang; setLang: any; theme: Theme; setTheme: any; t: any }) {
  return (
    <div className="prefscontent">
      <section>
        <h3>{t.theme}</h3>
        <div className="optionlist">
          {(['blue', 'teal', 'violet', 'forest'] as Theme[]).map((item) => (
            <button key={item} className={theme === item ? 'selected' : ''} onClick={() => setTheme(item)}>
              <span className={'swatch ' + item} />
              {item === 'blue' ? 'KIFARO Blue' : item[0].toUpperCase() + item.slice(1)}
              {theme === item && <Check />}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>{t.language}</h3>
        <div className="optionlist">
          <button className={lang === 'en' ? 'selected' : ''} onClick={() => setLang('en')}>English{lang === 'en' && <Check />}</button>
          <button className={lang === 'ar' ? 'selected' : ''} onClick={() => setLang('ar')}>العربية{lang === 'ar' && <Check />}</button>
        </div>
      </section>
    </div>
  )
}

function Course({ l, go }: { l: any; go: (path: string) => void }) {
  return (
    <button className="coursecard clickable" onClick={() => go('/anatomate/lecture/' + l.slug)}>
      <div className="cover"><Microscope /><span>LECTURE {l.sequence}</span></div>
      <div className="cardbody">
        <small>{l.module}</small><h3>{l.title}</h3><p>{l.system}</p>
        <div className="meta"><span>{l.duration} min</span><span>{l.progress || 0}%</span></div>
        <div className="progress"><i style={{ width: (l.progress || 0) + '%' }} /></div>
      </div>
    </button>
  )
}

function Mini({ icon, title, body }: { icon: any; title: string; body: string }) {
  return <div className="minicard"><div className="minihead"><span className="softicon">{icon}</span><h3>{title}</h3></div><p>{body}</p></div>
}
