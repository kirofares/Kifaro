import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  Bell, BookOpen, Brain, Check, ChevronRight, Clock3, GraduationCap,
  HeartPulse, Home, Library, Menu, MessageSquare, Microscope, Palette,
  CreditCard, Lock, LogIn, LogOut, PlayCircle, Search, Settings, ShieldCheck, Sparkles, Star, Stethoscope, UserRound, X,
} from 'lucide-react'
import { anatomateLectures, anatomateYears, getLectureBySlug } from './data/anatomate'
import AuthPage from './auth/AuthPage'
import ProfilePage from './auth/ProfilePage'
import AdminPage from './admin/AdminPage'
import ResetPasswordPage from './auth/ResetPasswordPage'
import { useAdmin } from './hooks/useAdmin'
import { useAuth } from './auth/AuthContext'
import { useProgress, type LectureProgressState as ProgressState } from './hooks/useProgress'
import { useEntitlements } from './hooks/useEntitlements'
import { useLectureSettings, type LectureSetting } from './hooks/useLectureSettings'
import { usePricingRules } from './hooks/usePricingRules'
import { supabase } from './lib/supabase'

type Theme = 'blue' | 'teal' | 'violet' | 'forest'
type Lang = 'en' | 'ar'

type LecturePrice = 0 | 40 | 50 | 60

function getLecturePrice(lecture: { status: string; duration: number; system: string }, setting?: LectureSetting): LecturePrice {
  if (setting?.access_mode === 'free' || lecture.status === 'free' && setting?.access_mode !== 'paid') return 0
  if (setting?.price_egp === 40 || setting?.price_egp === 50 || setting?.price_egp === 60) return setting.price_egp

  const premiumSystems = new Set([
    'Neuroanatomy',
    'Brainstem',
    'Clinical Anatomy',
    'Gastrointestinal Anatomy',
    'Head & Neck Anatomy',
  ])

  // 60 EGP for long lectures or clinically/core-system heavy topics.
  if (lecture.duration >= 55 || premiumSystems.has(lecture.system)) return 60
  // 50 EGP for standard full lectures.
  if (lecture.duration >= 45) return 50
  // 40 EGP for shorter focused lectures.
  return 40
}


function applyLectureSetting<T extends { id: string; title: string; description: string; status: string; videoUrl?: string; pdfUrl?: string; slidesUrl?: string }>(lecture: T, setting?: LectureSetting) {
  if (!setting) return lecture
  return {
    ...lecture,
    title: setting.title_override || lecture.title,
    description: setting.description_override || lecture.description,
    status: setting.access_mode === 'free' ? 'free' : setting.access_mode === 'paid' ? 'purchased' : lecture.status,
  }
}

const copy = {
  en: {
    overview: 'Overview', curriculum: 'Curriculum', anatomate: 'AnatoMate',
    topics: 'Topics', studio: 'KIFARO Studio', library: 'My Library',
    preferences: 'Preferences', search: 'Search courses, topics, or exams',
    hello: 'Good evening',
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
    hello: 'مساء الخير،',
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
  const { progress, update } = useProgress()
  const { settings: lectureSettings } = useLectureSettings()
  const { user, configured, signOut } = useAuth()
  const { isAdmin } = useAdmin(user?.id)
  const [query, setQuery] = useState('')
  const [prefs, setPrefs] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [toast, setToast] = useState('')
  const t = copy[lang]
  const nav = useNavigate()
  const studentName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] || (lang === 'ar' ? 'طالب KIFARO' : 'KIFARO Student')

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.body.dataset.theme = theme
  }, [lang, theme])

  const lectures = useMemo(
    () => anatomateLectures
      .filter((lecture) => lectureSettings.get(lecture.id)?.published ?? true)
      .map((lecture) => ({
        ...applyLectureSetting(lecture, lectureSettings.get(lecture.id)),
        ...(progress[lecture.id] || { progress: 0 }),
      })),
    [progress, lectureSettings],
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

  const links = [
    ['/', t.overview, Home],
    ['/curriculum', t.curriculum, GraduationCap],
    ['/anatomate', t.anatomate, Microscope],
    ['/topics', t.topics, Brain],
    ['/studio', t.studio, Sparkles],
    ['/library', t.library, Library],
    ['/profile', 'My Profile', UserRound],
    ...(isAdmin ? [['/admin', 'Admin Dashboard', ShieldCheck] as const] : []),
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
          {user ? (
            <button className="accountbtn" onClick={() => void signOut()}><LogOut size={17} /><span>Sign out</span></button>
          ) : (
            <button className="accountbtn" onClick={() => nav('/login')}><LogIn size={17} /><span>{configured ? 'Log in' : 'Demo mode'}</span></button>
          )}
          <button className="avatar avatarbtn" onClick={() => nav('/profile')} aria-label="Open profile">{studentName.slice(0, 2).toUpperCase()}</button>
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
          <Route path="/" element={<Dashboard t={t} lectures={filtered} go={nav} studentName={studentName} />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/curriculum" element={<Curriculum lectures={filtered} go={nav} />} />
          <Route path="/anatomate" element={<AnatoMate t={t} go={nav} />} />
          <Route path="/anatomate/year/:year/module/:module" element={<ModulePage progress={progress} update={update} flash={flash} t={t} />} />
          <Route path="/anatomate/lecture/:slug" element={<LecturePage progress={progress} update={update} flash={flash} t={t} />} />
          <Route path="/checkout/:slug" element={<CheckoutPage />} />
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

function Dashboard({ t, lectures, go, studentName }: { t: any; lectures: any[]; go: (path: string) => void; studentName: string }) {
  const current = lectures.find((lecture) => lecture.progress > 0 && !lecture.completed) || lectures[0] || anatomateLectures[0]

  return (
    <div className="page">
      <PageHead eyebrow="Tuesday · September 29" title={t.hello + ' ' + studentName + '.'} body={t.subtitle} />
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
  const { user } = useAuth()
  const { entitlements } = useEntitlements(user?.id)
  const { settings: lectureSettings } = useLectureSettings()
  const { offerFor } = usePricingRules()
  const yearData = anatomateYears.find((item) => String(item.year) === year)
  const moduleData = yearData?.modules.find((item) => item.slug === module)

  if (!yearData || !moduleData) {
    return <div className="page"><PageHead eyebrow="ANATOMATE" title="Module not found" body="This module is not available." /></div>
  }

  const visibleLectures = moduleData.lectures
    .filter((lecture) => lectureSettings.get(lecture.id)?.published ?? true)
    .map((lecture) => applyLectureSetting(lecture, lectureSettings.get(lecture.id)))
  const completed = visibleLectures.filter((lecture) => progress[lecture.id]?.completed).length
  const pct = visibleLectures.length ? Math.round((completed / visibleLectures.length) * 100) : 0

  return (
    <div className="page">
      <PageHead eyebrow={'YEAR ' + yearData.year} title={moduleData.title} body={moduleData.description} />
      <div className="modulehero">
        <div><small>MODULE PROGRESS</small><strong>{pct}%</strong></div>
        <div className="progress"><i style={{ width: pct + '%' }} /></div>
        <span>{completed} of {visibleLectures.length} lectures completed</span>
      </div>

      <div className="list">
        {visibleLectures.map((lecture) => {
          const state = progress[lecture.id] || { progress: 0 }
          return (
            <div className="lessonrow" key={lecture.id}>
              <div className="lectureseq">{lecture.sequence}</div>
              <div className="grow">
                <small>{lecture.system}</small>
                <h3>{lecture.title}</h3>
                <p>{lecture.duration} min · {lecture.status === 'free' ? 'Free preview' : entitlements.has(lecture.id) ? 'Purchased' : offerFor(lecture.id, getLecturePrice(lecture, lectureSettings.get(lecture.id))).price + ' EGP · Locked'}</p>
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
  const nav = useNavigate()
  const { user } = useAuth()
  const { entitlements, entitlementByLecture, refresh: refreshEntitlements, loading: entitlementsLoading } = useEntitlements(user?.id)
  const { settings: lectureSettings } = useLectureSettings()
  const { offerFor } = usePricingRules()
  const baseLecture = getLectureBySlug(slug)
  const lectureSetting = baseLecture ? lectureSettings.get(baseLecture.id) : undefined
  const lecture = baseLecture && (lectureSetting?.published ?? true) ? applyLectureSetting(baseLecture, lectureSetting) : undefined
  const [tab, setTab] = useState<'learn' | 'clinical' | 'pearls' | 'recall' | 'mcq'>('learn')
  const [answer, setAnswer] = useState<number | null>(null)
  const [videoBusy, setVideoBusy] = useState(false)
  const [videoMessage, setVideoMessage] = useState('')

  if (!lecture) {
    return <div className="page"><PageHead eyebrow="ANATOMATE" title="Lecture not found" body="This lecture is not available." /></div>
  }

  const state = progress[lecture.id] || { progress: 0 }
  const quiz = lecture.mcqs[0]
  const purchased = lecture.status === 'free' || entitlements.has(lecture.id)
  const entitlement = entitlementByLecture.get(lecture.id)
  const offer = offerFor(lecture.id, getLecturePrice(lecture, lectureSetting))
  const remainingViews = entitlement?.view_limit == null
    ? null
    : Math.max(0, entitlement.view_limit - entitlement.views_used)

  const openProtectedAsset = async (assetType: 'video' | 'pdf' | 'pptx') => {
    setVideoMessage('')

    if (!supabase || !user) {
      if (assetType === 'video' && lecture.status === 'free' && lecture.videoUrl) {
        window.open(lecture.videoUrl, '_blank', 'noopener,noreferrer')
        return
      }
      setVideoMessage('Please sign in first.')
      return
    }

    const popup = window.open('', '_blank')
    if (assetType === 'video') setVideoBusy(true)

    const { data, error } = await supabase.functions.invoke('lecture-asset', {
      body: { lectureId: lecture.id, assetType },
    })

    if (assetType === 'video') setVideoBusy(false)

    if (error || data?.error) {
      popup?.close()
      setVideoMessage(data?.error || error?.message || 'Could not open protected content.')
      await refreshEntitlements()
      return
    }

    const url = data?.signedUrl as string | undefined
    if (!url) {
      popup?.close()
      setVideoMessage('This file is not available yet.')
      return
    }

    if (popup) popup.location.href = url
    else window.location.href = url
    await refreshEntitlements()
  }

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
          <div className="videobox"><PlayCircle /><span>Lecture video</span><small>{lecture.status === 'free' ? (lecture.videoUrl ? 'Video available' : 'Video link will be added next') : purchased ? 'Protected video access' : 'Purchase required'}</small></div>
          {purchased ? (
            <>
              <button className="primary full assetlink" disabled={videoBusy || (remainingViews !== null && remainingViews <= 0)} onClick={() => void openProtectedAsset('video')}>
                {videoBusy ? 'Opening…' : remainingViews === 0 ? 'View limit reached' : 'Watch video'}
              </button>
              <div className="adminquick">
                <button className="secondary" onClick={() => void openProtectedAsset('pdf')}>Download PDF</button>
                <button className="secondary" onClick={() => void openProtectedAsset('pptx')}>Download PowerPoint</button>
              </div>
              {lecture.status !== 'free' && <small className="assetnote">{entitlement?.view_limit == null ? 'Unlimited views for this purchase.' : remainingViews + ' of ' + entitlement.view_limit + ' views remaining.'}</small>}
              {videoMessage && <div className="authmessage">{videoMessage}</div>}
              <div className="contentbox">
                <Check size={28} />
                <small>{lecture.status === 'free' ? 'FREE PREVIEW' : 'PURCHASE VERIFIED'}</small>
                <h2>{lecture.status === 'free' ? 'Free preview' : 'You own this lecture'}</h2>
                <p>{lecture.status === 'free'
                  ? 'This lecture is currently available without purchase.'
                  : 'Your account has protected access. Video, PDF and PowerPoint links are temporary and generated only when you open them.'}</p>
              </div>
            </>
          ) : (
            <div className="contentbox">
              <Lock size={28} />
              <small>ANATOMATE PREMIUM</small>
              <h2>{entitlementsLoading ? 'Checking purchase…' : 'Lecture files are locked'}</h2>
              <p>Purchase this lecture to unlock its protected PDF and PowerPoint files.</p>
              <div className="price"><strong>{offer.price} EGP</strong><span>{offer.viewLimit == null ? 'unlimited video views' : offer.viewLimit + ' video views'}</span></div>
              <small className="assetnote">Your offer is calculated from your academic year and nationality.</small>
              <button className="primary full" disabled={entitlementsLoading} onClick={() => nav('/checkout/' + lecture.slug)}>
                <CreditCard size={17} /> Buy Lecture
              </button>
            </div>
          )}
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

function CheckoutPage() {
  const { slug } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const { entitlements, loading: entitlementsLoading } = useEntitlements(user?.id)
  const { settings: lectureSettings } = useLectureSettings()
  const { offerFor, loading: offerLoading } = usePricingRules()
  const baseLecture = getLectureBySlug(slug)
  const lectureSetting = baseLecture ? lectureSettings.get(baseLecture.id) : undefined
  const lecture = baseLecture && (lectureSetting?.published ?? true) ? applyLectureSetting(baseLecture, lectureSetting) : undefined

  if (!lecture) {
    return <div className="page"><PageHead eyebrow="KIFARO CHECKOUT" title="Lecture not found" body="This lecture is not available." /></div>
  }

  const offer = offerFor(lecture.id, getLecturePrice(lecture, lectureSetting))

  return (
    <div className="page">
      <PageHead eyebrow="SECURE CHECKOUT" title="Complete your purchase" body="Your lecture will unlock automatically after successful payment once the payment gateway is connected." />
      <div className="contentbox">
        <small>ANATOMATE BY KIFARO</small>
        <h2>{lecture.title}</h2>
        <p>Year {lecture.year} · {lecture.module}</p>
        {!user ? (
          <>
            <div className="price"><strong>{getLecturePrice(lecture, lectureSetting)} EGP</strong><span>Sign in for your academic/nationality offer</span></div>
            <p>Sign in first so the purchase can be permanently attached to your KIFARO account.</p>
            <button className="primary full" onClick={() => nav('/login')}><LogIn size={17} /> Sign in to continue</button>
          </>
        ) : entitlements.has(lecture.id) ? (
          <>
            <div className="price"><strong>Purchased</strong><span>permanent account access</span></div>
            <button className="primary full" onClick={() => nav('/anatomate/lecture/' + lecture.slug)}><Check size={17} /> Open lecture</button>
          </>
        ) : (
          <>
            <div className="price"><strong>{offer.price} EGP</strong><span>{offer.viewLimit == null ? 'Unlimited video views' : offer.viewLimit + ' video views per payment'}</span></div>
            <small className="assetnote">This offer is matched to your academic year and nationality.</small>
            <button className="primary full" disabled><CreditCard size={17} /> {entitlementsLoading || offerLoading ? 'Checking account…' : 'Payment gateway setup in progress'}</button>
          </>
        )}
        <button className="secondary full" onClick={() => nav('/anatomate/lecture/' + lecture.slug)}>Back to lecture</button>
        <small className="assetnote">Purchases are verified from Supabase. Students cannot grant access to themselves.</small>
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
