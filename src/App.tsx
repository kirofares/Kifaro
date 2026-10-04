import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import {
  BookOpen, Brain, Check, ChevronRight, Clock3, GraduationCap,
  Home, Library, Menu, Microscope, Palette,
  CreditCard, Download, FileText, Lock, LogIn, LogOut, PlayCircle, Search, Settings, ShieldCheck, Sparkles, Star, Stethoscope, UserRound, X,
} from 'lucide-react'
import { anatomateLectures, anatomateYears, getLectureBySlug } from './data/anatomate'
import { getStudyResources, type StudyResource } from './data/anatomate/studyResources'
import { getVivaDeck } from './viva/content'
import './viva/viva.css'
import AuthPage from './auth/AuthPage'
import ProfilePage from './auth/ProfilePage'
import ResetPasswordPage from './auth/ResetPasswordPage'
import LegalPage from './components/LegalPage'
import { useAdmin } from './hooks/useAdmin'
import { useAuth } from './auth/AuthContext'
import { useProgress, type LectureProgressState as ProgressState } from './hooks/useProgress'
import { useEntitlements } from './hooks/useEntitlements'
import { useLectureSettings, type LectureSetting } from './hooks/useLectureSettings'
import { usePricingRules } from './hooks/usePricingRules'
import { useAssetReadiness } from './hooks/useAssetReadiness'
import { supabase } from './lib/supabase'
import { LangProvider, useTr, type Lang } from './i18n'

type Theme = 'blue' | 'teal' | 'violet' | 'forest'

type LecturePrice = 0 | 40 | 50 | 60

// After a deploy the old chunk files are gone, so a tab opened before it can fail to load a lazy page.
// Reload once to pick up the new build instead of showing the error screen.
function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() => load().catch((error) => {
    const key = 'kifaro-chunk-reload'
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      window.location.reload()
      return new Promise<{ default: T }>(() => undefined)
    }
    throw error
  }).then((module) => {
    sessionStorage.removeItem('kifaro-chunk-reload')
    return module
  }))
}

// Heavy pages (PDF rendering, admin tools) load on demand to keep the first load small.
const AdminPage = lazyPage(() => import('./admin/AdminPage'))
const DatashowViewer = lazyPage(() => import('./components/DatashowViewer'))
const ProtectedVideoPlayer = lazyPage(() => import('./components/ProtectedVideoPlayer'))
const VivaPage = lazyPage(() => import('./viva/VivaPage'))

const CURRENT_APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'
// Set VITE_PAYMOB_TEST_MODE=true in the build env while Paymob runs against its sandbox.
const PAYMOB_TEST_MODE = import.meta.env.VITE_PAYMOB_TEST_MODE === 'true'
const LATEST_RELEASE_API = 'https://api.github.com/repos/kirofares/Kifaro/releases/latest'
const LATEST_APK_URL = 'https://github.com/kirofares/Kifaro/releases/latest/download/AnatoMate.apk'

function compareVersions(a: string, b: string) {
  const pa = a.replace(/^v/i, '').split('.').map((part) => Number(part) || 0)
  const pb = b.replace(/^v/i, '').split('.').map((part) => Number(part) || 0)
  const max = Math.max(pa.length, pb.length)
  for (let i = 0; i < max; i += 1) {
    const av = pa[i] || 0
    const bv = pb[i] || 0
    if (av !== bv) return av > bv ? 1 : -1
  }
  return 0
}

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
    preferences: 'Preferences', search: 'Search lectures, modules, or systems',
    morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', nameSep: ', ',
    subtitle: 'Continue your medical journey with one focused step at a time.',
    continue: 'Continue Learning', open: 'Open AnatoMate', browse: 'Browse your pathways',
    pickUp: 'Pick up where you left off', startHere: 'Start your first lecture',
    resume: 'Continue', start: 'Start',
    yourYears: 'Your progress by year', year: 'Year', complete: 'Complete', inProgress: 'In progress', notStarted: 'Not started',
    downloadAndroid: 'Download Android App',
    min: 'min', lecture: 'Lecture',
    activeNow: 'In progress', noneActive: 'No lectures in progress yet.',
    favorites: 'Favorites', noFavorites: 'Save lectures to find them here.',
    overall: 'Overall progress', completedOf: 'lectures completed',
    profile: 'My Profile', admin: 'Admin Dashboard', signOut: 'Sign out', logIn: 'Log in', demo: 'Demo mode',
    openMenu: 'Open menu', closeMenu: 'Close menu', openProfile: 'Open profile',
    privacy: 'Privacy', terms: 'Terms', refunds: 'Refunds',
    mark: 'Mark as complete', fav: 'Add to favorites', unfav: 'Remove favorite',
    theme: 'Theme color', language: 'Language', saved: 'Saved to favorites',
    removed: 'Removed from favorites', done: 'Lesson completed',
    anatomyTitle: 'Learn anatomy as a living system.',
    anatomyBody: 'Visual, clinically connected anatomy designed for real understanding — not memorization alone.',
  },
  ar: {
    overview: 'الرئيسية', curriculum: 'المنهج', anatomate: 'AnatoMate',
    topics: 'الموضوعات', studio: 'KIFARO Studio', library: 'مكتبتي',
    preferences: 'التفضيلات', search: 'ابحث في المحاضرات أو الموديولات أو الأجهزة',
    morning: 'صباح الخير', afternoon: 'مساء الخير', evening: 'مساء الخير', nameSep: '، ',
    subtitle: 'كمّل رحلتك الطبية بخطوة مركزة كل مرة.',
    continue: 'متابعة التعلم', open: 'افتح AnatoMate', browse: 'استعرض مساراتك',
    pickUp: 'كمّل من حيث توقفت', startHere: 'ابدأ أول محاضرة',
    resume: 'متابعة', start: 'ابدأ',
    yourYears: 'تقدمك حسب السنة', year: 'السنة', complete: 'مكتمل', inProgress: 'جارٍ', notStarted: 'لم يبدأ',
    downloadAndroid: 'حمّل تطبيق أندرويد',
    min: 'دقيقة', lecture: 'محاضرة',
    activeNow: 'قيد الدراسة', noneActive: 'لا توجد محاضرات قيد الدراسة بعد.',
    favorites: 'المفضلة', noFavorites: 'احفظ المحاضرات لتجدها هنا.',
    overall: 'التقدم الكلي', completedOf: 'محاضرة مكتملة',
    profile: 'ملفي الشخصي', admin: 'لوحة الإدارة', signOut: 'تسجيل الخروج', logIn: 'تسجيل الدخول', demo: 'وضع تجريبي',
    openMenu: 'فتح القائمة', closeMenu: 'إغلاق القائمة', openProfile: 'فتح الملف الشخصي',
    privacy: 'الخصوصية', terms: 'الشروط', refunds: 'الاسترداد',
    mark: 'تحديد كمكتمل', fav: 'أضف للمفضلة', unfav: 'إزالة من المفضلة',
    theme: 'لون الواجهة', language: 'اللغة', saved: 'تمت الإضافة للمفضلة',
    removed: 'تمت الإزالة من المفضلة', done: 'تم إكمال المحاضرة',
    anatomyTitle: 'تعلّم التشريح كنظام حي مترابط.',
    anatomyBody: 'تشريح بصري مرتبط سريريًا، مصمم للفهم الحقيقي وليس للحفظ فقط.',
  },
}

const isNativeApp = Capacitor.isNativePlatform()
const isIOSDevice = typeof navigator !== 'undefined'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
// The APK download only makes sense for web visitors on non-iOS devices.
const showAndroidDownload = !isNativeApp && !isIOSDevice

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
  const [profileName, setProfileName] = useState('')
  const { isAdmin } = useAdmin(user?.id)
  const [query, setQuery] = useState('')
  const [prefs, setPrefs] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [toast, setToast] = useState('')
  const [showOpeningSplash, setShowOpeningSplash] = useState(isNativeApp)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const t = copy[lang]
  const nav = useNavigate()
  const metadataName = (user?.user_metadata?.full_name as string | undefined)?.trim() || ''
  const studentName = (profileName || metadataName).split(' ')[0] || ''

  useEffect(() => {
    if (!user || !supabase) {
      setProfileName('')
      return
    }

    let active = true
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setProfileName((data?.full_name as string | undefined)?.trim() || '')
      })

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.body.dataset.theme = theme
  }, [lang, theme])

  useEffect(() => {
    if (!showOpeningSplash) return
    const timer = window.setTimeout(() => setShowOpeningSplash(false), 1400)
    return () => window.clearTimeout(timer)
  }, [showOpeningSplash])

  useEffect(() => {
    // Only the installed Android app can be out of date; web visitors always get the latest build.
    if (!isNativeApp) return
    let active = true
    fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Release check failed')))
      .then((release) => {
        if (!active) return
        const latest = String(release?.tag_name || '').replace(/^v/i, '')
        if (!latest) return
        setLatestVersion(latest)
        setUpdateAvailable(compareVersions(latest, CURRENT_APP_VERSION) > 0)
      })
      .catch(() => {
        if (active) setUpdateAvailable(false)
      })

    return () => { active = false }
  }, [])

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
    ['/profile', t.profile, UserRound],
    ...(isAdmin ? [['/admin', t.admin, ShieldCheck] as const] : []),
  ] as const

  if (showOpeningSplash) {
    return (
      <div className="nativebrandedsplash" role="presentation">
        <div className="nativebrandedsplashglow" />
        <img src="/anatomate-logo.svg" alt="" />
        <h1>AnatoMate</h1>
        <p>by KIFARO</p>
        <span>Anatomy Made Simple</span>
      </div>
    )
  }

  return (
    <LangProvider value={lang}>
    <div className="shell">
      {updateAvailable && (
        <div className="appupdatebar">
          <div>
            <strong>{lang === 'ar' ? `إصدار AnatoMate ${latestVersion} متاح` : `AnatoMate ${latestVersion} is available`}</strong>
            <span>{lang === 'ar' ? `أنت تستخدم الإصدار ${CURRENT_APP_VERSION}.` : `You are using version ${CURRENT_APP_VERSION}.`}</span>
          </div>
          <a href={LATEST_APK_URL} target="_blank" rel="noreferrer">
            <Download size={17} /> {lang === 'ar' ? 'حدّث AnatoMate' : 'Update AnatoMate'}
          </a>
        </div>
      )}
      <header className="topbar">
        <button className="icon mobile" onClick={() => setDrawer(true)} aria-label={t.openMenu}><Menu /></button>
        <button className="brand" onClick={() => nav('/')}>
          <span className="brandmark"><Stethoscope /></span><strong>KIFARO</strong>
        </button>

        <div className="search">
          <Search size={18} />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} />
        </div>

        <div className="actions">
          <button className="prefbtn" onClick={() => setPrefs(true)}><Palette size={18} /><span>{t.preferences}</span></button>
          {user ? (
            <button className="accountbtn" onClick={() => void signOut()}><LogOut size={17} /><span>{t.signOut}</span></button>
          ) : (
            <button className="accountbtn" onClick={() => nav('/login')}><LogIn size={17} /><span>{configured ? t.logIn : t.demo}</span></button>
          )}
          <button className="avatar avatarbtn" onClick={() => nav('/profile')} aria-label={t.openProfile}>
            {studentName ? studentName.slice(0, 2).toUpperCase() : <UserRound size={18} />}
          </button>
        </div>
      </header>

      <aside className={drawer ? 'sidebar open' : 'sidebar'}>
        <div className="mobile sidehead">
          <strong>KIFARO</strong>
          <button className="icon" onClick={() => setDrawer(false)} aria-label={t.closeMenu}><X /></button>
        </div>
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink end={to === '/'} to={to} key={to} onClick={() => setDrawer(false)}>
              <Icon size={19} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidefoot">
          <NavLink to="/preferences" onClick={() => setDrawer(false)}><Settings size={19} /><span>{t.preferences}</span></NavLink>
          {/* The top bar hides account actions on phones, so offer them in the drawer. */}
          {user ? (
            <button className="mobile sideaccount" onClick={() => { setDrawer(false); void signOut() }}><LogOut size={19} /><span>{t.signOut}</span></button>
          ) : (
            <button className="mobile sideaccount" onClick={() => { setDrawer(false); nav('/login') }}><LogIn size={19} /><span>{configured ? t.logIn : t.demo}</span></button>
          )}
        </div>
      </aside>

      {drawer && <div className="backdrop" onClick={() => setDrawer(false)} />}

      <main className="main">
        <Suspense fallback={<div className="page pageloading" role="status">{lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</div>}>
        <Routes>
          <Route path="/" element={<Dashboard t={t} lang={lang} lectures={filtered} allLectures={lectures} go={nav} studentName={studentName} />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          {/* The admin dashboard is English-only, so keep it left-to-right even in Arabic mode. */}
          <Route path="/admin" element={<div dir="ltr" lang="en"><AdminPage /></div>} />
          <Route path="/curriculum" element={<Curriculum lectures={filtered} go={nav} />} />
          <Route path="/anatomate" element={<AnatoMate t={t} go={nav} />} />
          <Route path="/anatomate/year/:year/module/:module" element={<ModulePage progress={progress} update={update} flash={flash} t={t} />} />
          <Route path="/anatomate/lecture/:slug" element={<LecturePage progress={progress} update={update} flash={flash} t={t} />} />
          <Route path="/anatomate/lecture/:slug/viva" element={<VivaPage />} />
          <Route path="/anatomate/lecture/:slug/datashow" element={<DatashowViewer mode="datashow" />} />
          <Route path="/anatomate/lecture/:slug/pdf" element={<DatashowViewer mode="pdf" />} />
          <Route path="/anatomate/lecture/:slug/video" element={<ProtectedVideoPlayer />} />
          <Route path="/checkout/:slug" element={<CheckoutPage />} />
          <Route path="/payment/return" element={<PaymentReturnPage />} />
          <Route path="/privacy" element={<LegalPage kind="privacy" />} />
          <Route path="/terms" element={<LegalPage kind="terms" />} />
          <Route path="/refund" element={<LegalPage kind="refund" />} />
          <Route path="/topics" element={<Topics lectures={filtered} go={nav} />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/library" element={<LibraryPage lectures={lectures} update={update} flash={flash} t={t} go={nav} />} />
          <Route path="/preferences" element={<Prefs lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} t={t} />} />
          <Route path="*" element={<NotFound go={nav} />} />
        </Routes>
        </Suspense>
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

      <ContactChannels />

      <footer className="sitefooter">
        <button onClick={() => nav('/privacy')}>{t.privacy}</button>
        <button onClick={() => nav('/terms')}>{t.terms}</button>
        <button onClick={() => nav('/refund')}>{t.refunds}</button>
        <span>© 2026 KIFARO · AnatoMate</span>
      </footer>

      {toast && <div className="toast"><Check size={18} />{toast}</div>}
    </div>
    </LangProvider>
  )
}

function ContactChannels() {
  const tr = useTr()
  const channels = [
    {
      name: 'Facebook',
      handle: 'AnatoMate',
      href: 'https://www.facebook.com/profile.php?id=61594048447607&mibextid=ZbWKwL',
      icon: <Facebook size={21} />,
      className: 'facebook',
    },
    {
      name: 'Instagram',
      handle: '@anatomate130',
      href: 'https://www.instagram.com/anatomate130?stkn=MWt0a2dwbGZkeGdobQ==',
      icon: <Instagram size={21} />,
      className: 'instagram',
    },
    {
      name: 'TikTok',
      handle: '@anatomate130',
      href: 'https://www.tiktok.com/@anatomate130',
      icon: <span className="tiktokglyph">♪</span>,
      className: 'tiktok',
    },
    {
      name: 'WhatsApp',
      handle: '+20 10 5555 2867',
      href: 'https://wa.me/201055552867',
      icon: <MessageCircle size={21} />,
      className: 'whatsapp',
    },
    {
      name: tr('Phone', 'الهاتف'),
      handle: '+20 10 5555 2867',
      href: 'tel:+201055552867',
      icon: <Phone size={21} />,
      className: 'phone',
    },
  ]

  return (
    <section className="contactchannels" aria-label={tr('Contact channels', 'قنوات التواصل')}>
      <div className="contactinner">
        <div className="contactintro">
          <span className="contacteyebrow">ANATOMATE BY KIFARO</span>
          <h2>{tr('Stay connected with AnatoMate', 'خليك على تواصل مع AnatoMate')}</h2>
          <p>{tr(
            'Follow new lectures, revision content, announcements and student updates through our official channels.',
            'تابع المحاضرات الجديدة والمراجعات والإعلانات وتحديثات الطلاب من خلال قنواتنا الرسمية.'
          )}</p>
        </div>

        <div className="channelgrid">
          {channels.map((channel) => (
            <a
              key={channel.name}
              className={'channelcard ' + channel.className}
              href={channel.href}
              target={channel.href.startsWith('http') ? '_blank' : undefined}
              rel={channel.href.startsWith('http') ? 'noreferrer' : undefined}
            >
              <span className="channelicon">{channel.icon}</span>
              <span className="channelcopy">
                <small>{channel.name}</small>
                <strong dir="ltr">{channel.handle}</strong>
              </span>
              <ChevronRight size={18} />
            </a>
          ))}
        </div>

        <div className="contactsignature">
          <span>KIFARO</span>
          <small>{tr('Medical education, connected.', 'تعليم طبي متصل بيك.')}</small>
        </div>
      </div>
    </section>
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

function Dashboard({ t, lang, lectures, allLectures, go, studentName }: { t: any; lang: Lang; lectures: any[]; allLectures: any[]; go: (path: string) => void; studentName: string }) {
  const active = allLectures.filter((lecture) => lecture.progress > 0 && !lecture.completed)
  const favorites = allLectures.filter((lecture) => lecture.favorite)
  const completedCount = allLectures.filter((lecture) => lecture.completed).length
  const current = active[0] || allLectures.find((lecture) => !lecture.completed) || allLectures[0] || anatomateLectures[0]
  const started = (current.progress || 0) > 0
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? t.morning : hour < 18 ? t.afternoon : t.evening
  const dateLabel = now.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const yearStats = anatomateYears.map((year) => {
    const yearLectures = allLectures.filter((lecture) => lecture.year === year.year)
    const done = yearLectures.filter((lecture) => lecture.completed).length
    const touched = yearLectures.some((lecture) => lecture.progress > 0)
    const pct = yearLectures.length ? Math.round((done / yearLectures.length) * 100) : 0
    const status = pct === 100 ? t.complete : touched ? t.inProgress : t.notStarted
    return { year: year.year, pct, status }
  })
  const titles = (items: any[]) => items.slice(0, 2).map((lecture) => lecture.title).join(' · ')

  return (
    <div className="page">
      <PageHead eyebrow={dateLabel} title={studentName ? greeting + t.nameSep + studentName : greeting} body={t.subtitle} />
      <div className="dashgrid">
        <div>
          <section className="section">
            <div className="sectiontitle"><div><span>{t.continue}</span><h2>{started ? t.pickUp : t.startHere}</h2></div></div>
            <div className="continuecard">
              <div className="softicon"><Brain /></div>
              <div className="grow">
                <small>{current.module}</small>
                <h3>{current.title}</h3>
                <div className="meta"><span><Clock3 size={14} /><bdi>{current.duration} {t.min}</bdi></span><bdi dir="ltr">{current.progress || 0}%</bdi></div>
                <div className="progress"><i style={{ width: (current.progress || 0) + '%' }} /></div>
              </div>
              <button className="primary" onClick={() => go('/anatomate/lecture/' + current.slug)}>{started ? t.resume : t.start} <ChevronRight size={17} className="dirarrow" /></button>
            </div>
          </section>

          <section className="hero">
            <div>
              <span className="pill">ANATOMATE BY KIFARO</span>
              <h2>{t.anatomyTitle}</h2>
              <p>{t.anatomyBody}</p>
              <div className="heroactions">
                <button className="lightbtn" onClick={() => go('/anatomate')}>{t.open}<ChevronRight size={17} className="dirarrow" /></button>
                {showAndroidDownload && (
                  <a className="lightbtn downloadappbtn" href={LATEST_APK_URL} target="_blank" rel="noreferrer">
                    <Download size={17} /> {t.downloadAndroid}
                  </a>
                )}
              </div>
            </div>
            <Microscope className="heroicon" />
          </section>

          <section className="section">
            <div className="sectiontitle"><h2>{t.yourYears}</h2></div>
            <div className="pathmap">
              {yearStats.map((item) => (
                <button className="pathcard clickable" key={item.year} onClick={() => go('/anatomate')}>
                  <small><bdi dir="ltr">{item.pct}%</bdi></small><h3>{t.year} {item.year}</h3>
                  <span>{item.status}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="sectiontitle"><h2>{t.browse}</h2></div>
            <div className="cards">{lectures.slice(0, 3).map((lecture) => <Course key={lecture.id} l={lecture} go={go} t={t} />)}</div>
          </section>
        </div>

        <aside className="rightcol">
          <Mini icon={<BookOpen />} title={t.activeNow} body={active.length ? titles(active) : t.noneActive} />
          <Mini icon={<Star />} title={t.favorites} body={favorites.length ? titles(favorites) : t.noFavorites} />
          <Mini icon={<Sparkles />} title={t.overall} body={<><bdi dir="ltr">{completedCount} / {allLectures.length}</bdi> {t.completedOf}</>} />
        </aside>
      </div>
    </div>
  )
}

function NotFound({ go }: { go: (path: string) => void }) {
  const tr = useTr()
  return (
    <div className="page">
      <PageHead eyebrow="404" title={tr('Page not found', 'الصفحة غير موجودة')} body={tr('This link may be outdated or mistyped.', 'ربما يكون الرابط قديمًا أو مكتوبًا بشكل خاطئ.')} />
      <button className="primary" onClick={() => go('/')}><Home size={17} /> {tr('Back to overview', 'العودة للرئيسية')}</button>
    </div>
  )
}

function Curriculum({ lectures, go }: { lectures: any[]; go: (path: string) => void }) {
  const tr = useTr()
  return (
    <div className="page">
      <PageHead eyebrow={tr('ANATOMATE CURRICULUM', 'منهج ANATOMATE')} title={tr('Curriculum', 'المنهج')} body={tr('Structured by academic year, module and lecture sequence.', 'مرتب حسب السنة الدراسية والموديول وتسلسل المحاضرات.')} />
      <div className="list">
        {lectures.map((lecture) => (
          <button className="lessonrow clickable" key={lecture.id} onClick={() => go('/anatomate/lecture/' + lecture.slug)}>
            <div className="softicon"><GraduationCap /></div>
            <div className="grow">
              <small>{tr('Year', 'السنة')} {lecture.year} · {tr('Lecture', 'محاضرة')} {lecture.sequence}</small>
              <h3>{lecture.title}</h3>
              <p>{lecture.module} · <bdi>{lecture.duration} {tr('min', 'دقيقة')}</bdi></p>
              <div className="progress"><i style={{ width: (lecture.progress || 0) + '%' }} /></div>
            </div>
            <ChevronRight className="dirarrow" />
          </button>
        ))}
      </div>
    </div>
  )
}

function AnatoMate({ t, go }: { t: any; go: (path: string) => void }) {
  const tr = useTr()
  return (
    <div className="page">
      <section className="hero compact">
        <div><span className="pill">ANATOMATE BY KIFARO</span><h2>{t.anatomyTitle}</h2><p>{t.anatomyBody}</p></div>
        <Microscope className="heroicon" />
      </section>

      <div className="yeargrid">
        {anatomateYears.map((year) => (
          <section className="yearcard" key={year.year}>
            <div className="yearbadge">{tr('YEAR', 'السنة')} {year.year}</div>
            <h2>{tr('Medical Year', 'السنة الطبية')} {year.year}</h2>
            <p>{tr('Structured anatomy curriculum organized by modules.', 'منهج تشريح منظم حسب الموديولات.')}</p>
            <div className="modulelist">
              {year.modules.map((module) => (
                <button
                  key={module.slug}
                  className="modulecard"
                  onClick={() => go('/anatomate/year/' + year.year + '/module/' + module.slug)}
                >
                  <div>
                    <small>
                      {module.semester === 0 ? tr('Orientation', 'تمهيدي') : tr('Semester', 'الترم') + ' ' + module.semester}
                      {' · '}<bdi>{module.code}</bdi>{' · '}{module.lectures.length} {tr('lectures', 'محاضرات')}
                    </small>
                    <h3>{module.title}</h3>
                    <p>{module.description}</p>
                  </div>
                  <ChevronRight className="dirarrow" />
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
  const tr = useTr()
  const yearData = anatomateYears.find((item) => String(item.year) === year)
  const moduleData = yearData?.modules.find((item) => item.slug === module)

  if (!yearData || !moduleData) {
    return <div className="page"><PageHead eyebrow="ANATOMATE" title={tr('Module not found', 'الموديول غير موجود')} body={tr('This module is not available.', 'هذا الموديول غير متاح.')} /></div>
  }

  const visibleLectures = moduleData.lectures
    .filter((lecture) => lectureSettings.get(lecture.id)?.published ?? true)
    .map((lecture) => applyLectureSetting(lecture, lectureSettings.get(lecture.id)))
  const completed = visibleLectures.filter((lecture) => progress[lecture.id]?.completed).length
  const pct = visibleLectures.length ? Math.round((completed / visibleLectures.length) * 100) : 0

  return (
    <div className="page">
      <PageHead eyebrow={tr('YEAR', 'السنة') + ' ' + yearData.year} title={moduleData.title} body={moduleData.description} />
      <div className="modulehero">
        <div><small>{tr('MODULE PROGRESS', 'تقدم الموديول')}</small><strong><bdi dir="ltr">{pct}%</bdi></strong></div>
        <div className="progress"><i style={{ width: pct + '%' }} /></div>
        <span>{tr(`${completed} of ${visibleLectures.length} lectures completed`, `${completed} من ${visibleLectures.length} محاضرات مكتملة`)}</span>
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
                <p><bdi>{lecture.duration} {tr('min', 'دقيقة')}</bdi> · {lecture.status === 'free' ? tr('Free preview', 'معاينة مجانية') : entitlements.has(lecture.id) ? tr('Purchased', 'تم الشراء') : <><bdi>{offerFor(lecture.id, getLecturePrice(lecture, lectureSettings.get(lecture.id))).price} {tr('EGP', 'ج.م')}</bdi> · {tr('Locked', 'مقفلة')}</>}</p>
                <div className="progress"><i style={{ width: (state.progress || 0) + '%' }} /></div>
              </div>
              <button
                className="icon star"
                aria-label={tr('Toggle favorite', 'تبديل المفضلة')}
                onClick={() => {
                  update(lecture.id, { favorite: !state.favorite })
                  flash(state.favorite ? t.removed : t.saved)
                }}
              >
                <Star fill={state.favorite ? 'currentColor' : 'none'} />
              </button>
              <button className="secondary" onClick={() => nav('/anatomate/lecture/' + lecture.slug)}>{tr('Open', 'فتح')}</button>
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
  const { isAdmin } = useAdmin(user?.id)
  const { entitlementByLecture, refresh: refreshEntitlements, loading: entitlementsLoading } = useEntitlements(user?.id)
  const { settings: lectureSettings } = useLectureSettings()
  const { offerFor } = usePricingRules()
  const { byLecture: assetReadiness } = useAssetReadiness()
  const baseLecture = getLectureBySlug(slug)
  const lectureSetting = baseLecture ? lectureSettings.get(baseLecture.id) : undefined
  const lecture = baseLecture && (lectureSetting?.published ?? true) ? applyLectureSetting(baseLecture, lectureSetting) : undefined
  const [tab, setTab] = useState<'learn' | 'clinical' | 'pearls' | 'recall' | 'mcq'>('learn')
  const [answer, setAnswer] = useState<number | null>(null)
  const [videoBusy, setVideoBusy] = useState(false)
  const [videoMessage, setVideoMessage] = useState('')
  const tr = useTr()

  if (!lecture) {
    return <div className="page"><PageHead eyebrow="ANATOMATE" title={tr('Lecture not found', 'المحاضرة غير موجودة')} body={tr('This lecture is not available.', 'هذه المحاضرة غير متاحة.')} /></div>
  }

  const state = progress[lecture.id] || { progress: 0 }
  const quiz = lecture.mcqs[0]
  const recallResources = getStudyResources(lecture.id, 'recall')
  const mcqResources = getStudyResources(lecture.id, 'mcq')
  const entitlement = entitlementByLecture.get(lecture.id)
  const videoUnlocked = lecture.status === 'free' || Boolean(entitlement?.video_access) || isAdmin
  const datashowUnlocked = Boolean(entitlement?.datashow_access) || isAdmin
  const readiness = assetReadiness.get(lecture.id)
  const videoAvailable = Boolean(readiness?.has_video || (lecture.status === 'free' && lecture.videoUrl))
  const datashowAvailable = Boolean(readiness?.has_datashow)
  const bundleAvailable = videoAvailable && datashowAvailable
  const videoBasePrice = getLecturePrice(lecture, lectureSetting)
  const datashowBasePrice = Math.max(30, videoBasePrice)
  const bundleBasePrice = videoBasePrice + datashowBasePrice
  const videoOffer = offerFor(lecture.id, videoBasePrice, 'video')
  const datashowOffer = offerFor(lecture.id, datashowBasePrice, 'datashow')
  const bundleOffer = offerFor(lecture.id, bundleBasePrice, 'bundle')
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
      setVideoMessage(tr('Please sign in first.', 'من فضلك سجّل الدخول أولًا.'))
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
      setVideoMessage(data?.error || error?.message || tr('Could not open protected content.', 'تعذّر فتح المحتوى المحمي.'))
      await refreshEntitlements()
      return
    }

    const url = data?.signedUrl as string | undefined
    if (!url) {
      popup?.close()
      setVideoMessage(tr('This file is not available yet.', 'هذا الملف غير متاح بعد.'))
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
          <span className="eyebrow">{tr('YEAR', 'السنة')} {lecture.year} · {tr('LECTURE', 'محاضرة')} {lecture.sequence}</span>
          <h1>{lecture.title}</h1>
          <p>{lecture.module} · <bdi>{lecture.duration} {tr('min', 'دقيقة')}</bdi> · {lecture.system}</p>
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
          <div className="videobox">
            <PlayCircle />
            <span>{tr('Lecture video', 'فيديو المحاضرة')}</span>
            <small>{!videoAvailable ? tr('Coming soon', 'قريبًا') : videoUnlocked ? tr('Video access available', 'الفيديو متاح لك') : tr('Video purchase required', 'يتطلب شراء الفيديو')}</small>
          </div>

          {videoAvailable && videoUnlocked ? (
            <button
              className="primary full assetlink"
              disabled={videoBusy || (remainingViews !== null && remainingViews <= 0)}
              onClick={() => {
                if (readiness?.has_video) nav('/anatomate/lecture/' + lecture.slug + '/video')
                else void openProtectedAsset('video')
              }}
            >
              {videoBusy ? tr('Opening…', 'جارٍ الفتح…') : remainingViews === 0 ? tr('View limit reached', 'وصلت للحد الأقصى للمشاهدات') : tr('Watch video', 'شاهد الفيديو')}
            </button>
          ) : videoAvailable ? (
            <div className="contentbox compactpurchase">
              <Lock size={24} />
              <small>{tr('VIDEO ACCESS', 'الوصول للفيديو')}</small>
              <div className="price"><strong><bdi>{videoOffer.price} {tr('EGP', 'ج.م')}</bdi></strong><span>{videoOffer.viewLimit == null ? tr('video access', 'وصول للفيديو') : tr(videoOffer.viewLimit + ' video views', videoOffer.viewLimit + ' مشاهدات للفيديو')}</span></div>
              <button className="primary full" disabled={entitlementsLoading} onClick={() => nav('/checkout/' + lecture.slug + '?product=video')}>
                <CreditCard size={17} /> {tr('Unlock Video', 'افتح الفيديو')}
              </button>
            </div>
          ) : (
            <div className="contentbox compactpurchase unavailableproduct">
              <Clock3 size={24} />
              <small>{tr('VIDEO', 'الفيديو')}</small>
              <h3>{tr('Coming soon', 'قريبًا')}</h3>
              <p>{tr('The video for this lecture will be available soon.', 'فيديو هذه المحاضرة سيكون متاحًا قريبًا.')}</p>
            </div>
          )}

          <div className="datashowcard">
            <div className="datashowcardhead">
              <BookOpen size={24} />
              <div><strong>{tr('Datashow', 'الداتاشو')}</strong><small>{tr('Protected slide viewer · watermarked', 'عارض شرائح محمي · بعلامة مائية')}</small></div>
            </div>
            {datashowAvailable && datashowUnlocked ? (
              <div className="protectedviewerbuttons">
                <button className="primary full" onClick={() => nav('/anatomate/lecture/' + lecture.slug + '/datashow')}>
                  <BookOpen size={17} /> {tr('Open Datashow', 'افتح الداتاشو')}
                </button>
                <button className="secondary full" onClick={() => nav('/anatomate/lecture/' + lecture.slug + '/pdf')}>
                  <FileText size={17} /> {tr('Open PDF Viewer', 'افتح عارض PDF')}
                </button>
              </div>
            ) : datashowAvailable ? (
              <>
                <div className="price"><strong><bdi>{datashowOffer.price} {tr('EGP', 'ج.م')}</bdi></strong><span>{tr('viewer-only access', 'عرض فقط بدون تحميل')}</span></div>
                <button className="secondary full" disabled={entitlementsLoading} onClick={() => nav('/checkout/' + lecture.slug + '?product=datashow')}>
                  <Lock size={17} /> {tr('Unlock Datashow', 'افتح الداتاشو')}
                </button>
              </>
            ) : (
              <div className="unavailableproduct">
                <Clock3 size={20} />
                <strong>{tr('Datashow coming soon', 'الداتاشو قريبًا')}</strong>
                <small>{tr('The slides for this lecture will be available soon.', 'شرائح هذه المحاضرة ستكون متاحة قريبًا.')}</small>
              </div>
            )}
            <small className="assetnote">{tr('Datashow and PDF open inside KIFARO only. Every displayed page carries “Dr. Kirolus Fares” plus the signed-in student\'s identity and viewing time.', 'الداتاشو والـ PDF يفتحوا داخل KIFARO فقط. كل صفحة معروضة تحمل اسم “Dr. Kirolus Fares” مع بيانات الطالب المسجّل ووقت المشاهدة.')}</small>
          </div>

          {bundleAvailable && !videoUnlocked && !datashowUnlocked && (
            <div className="contentbox compactpurchase">
              <small>{tr('BEST VALUE', 'الأوفر')}</small>
              <h3>{tr('Video + Datashow Bundle', 'باقة الفيديو + الداتاشو')}</h3>
              <div className="price"><strong><bdi>{bundleOffer.price} {tr('EGP', 'ج.م')}</bdi></strong><span>{tr('both access types', 'الاتنين معًا')}</span></div>
              <button className="primary full" onClick={() => nav('/checkout/' + lecture.slug + '?product=bundle')}>
                <CreditCard size={17} /> {tr('View Bundle', 'عرض الباقة')}
              </button>
            </div>
          )}

          {isAdmin && (
            <div className="adminoriginals">
              <small>{tr('ADMIN ORIGINAL FILES', 'الملفات الأصلية (للإدارة)')}</small>
              <div className="adminquick">
                <button className="secondary" onClick={() => void openProtectedAsset('pdf')}>{tr('Original PDF', 'ملف PDF الأصلي')}</button>
                <button className="secondary" onClick={() => void openProtectedAsset('pptx')}>{tr('Original PowerPoint', 'ملف PowerPoint الأصلي')}</button>
              </div>
            </div>
          )}

          {lecture.status !== 'free' && videoUnlocked && <small className="assetnote">{entitlement?.view_limit == null ? tr('Unlimited video views for this purchase.', 'مشاهدات غير محدودة للفيديو مع هذا الشراء.') : tr(remainingViews + ' of ' + entitlement.view_limit + ' video views remaining.', 'متبقي ' + remainingViews + ' من ' + entitlement.view_limit + ' مشاهدات.')}</small>}
          {videoMessage && <div className="authmessage">{videoMessage}</div>}

          <div className="lectureprogress">
            <small>{tr('YOUR PROGRESS', 'تقدمك')}</small>
            <div className="progress"><i style={{ width: (state.progress || 0) + '%' }} /></div>
            <span>{state.completed ? tr('Completed', 'مكتملة') : <>{tr('', 'مكتمل ')}<bdi dir="ltr">{state.progress || 0}%</bdi>{tr(' complete', '')}</>}</span>
          </div>
        </aside>

        <section className="lecturecontent">
          <p className="lead">{lecture.description}</p>
          {getVivaDeck(lecture.id) && <div className="viva-launch">
            <div><h2>KIFARO Viva</h2><p>{tr('5 short questions · Free self-assessment pilot', '٥ أسئلة قصيرة · تجربة مجانية بتقييم ذاتي')}</p></div>
            <button className="primary" onClick={() => nav(`/anatomate/lecture/${lecture.slug}/viva`)}><Brain size={18} />{tr('Test me on this lecture', 'امتحنّي في المحاضرة دي')}</button>
          </div>}
          <div className="tabs">
            <button className={tab === 'learn' ? 'active' : ''} onClick={() => setTab('learn')}>{tr('Learning objectives', 'أهداف المحاضرة')}</button>
            <button className={tab === 'clinical' ? 'active' : ''} onClick={() => setTab('clinical')}>{tr('Clinical relevance', 'الأهمية الإكلينيكية')}</button>
            <button className={tab === 'pearls' ? 'active' : ''} onClick={() => setTab('pearls')}>{tr('Exam Pearls', 'نقاط الامتحان')}</button>
            <button className={tab === 'recall' ? 'active' : ''} onClick={() => setTab('recall')}>{tr('Active Recall', 'استرجاع نشط')}</button>
            <button className={tab === 'mcq' ? 'active' : ''} onClick={() => setTab('mcq')}>{tr('MCQ Challenge', 'تحدي MCQ')}</button>
          </div>

          {tab === 'learn' && <ContentList title={tr('Learning objectives', 'أهداف المحاضرة')} items={lecture.objectives} />}
          {tab === 'clinical' && <ContentList title={tr('Clinical relevance', 'الأهمية الإكلينيكية')} items={lecture.clinical} />}
          {tab === 'pearls' && <ContentList title={tr('AnatoMate Exam Pearls', 'نقاط الامتحان من AnatoMate')} items={lecture.pearls} />}
          {tab === 'recall' && (
            <div className="studytabstack">
              <ContentList title={tr('Active Recall', 'استرجاع نشط')} items={lecture.activeRecall} />
              <StudyResourcePanel
                title={tr('Active Recall Visuals', 'صور الاسترجاع النشط')}
                resources={recallResources}
                lectureSlug={lecture.slug}
                available={datashowAvailable}
                unlocked={datashowUnlocked}
                go={nav}
              />
            </div>
          )}
          {tab === 'mcq' && (
            <div className="studytabstack">
              {quiz && (
                <div className="contentbox">
                  <h2>{tr('MCQ Challenge', 'تحدي MCQ')}</h2>
                  <div className="quiz">
                    <p>{quiz.question}</p>
                    {quiz.options.map((option, index) => (
                      <button key={option} className={answer === index ? 'selected' : ''} onClick={() => setAnswer(index)}>
                        <span>{String.fromCharCode(65 + index)}</span>{option}
                      </button>
                    ))}
                    {answer !== null && (
                      <div className={answer === quiz.answer ? 'feedback ok' : 'feedback bad'}>
                        {answer === quiz.answer ? tr('Correct. ', 'إجابة صحيحة. ') : tr('Not quite. ', 'ليست الإجابة الصحيحة. ')}<span dir="auto">{quiz.explanation}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <StudyResourcePanel
                title={tr('MCQ & Spotter Visuals', 'صور MCQ وSpotters')}
                resources={mcqResources}
                lectureSlug={lecture.slug}
                available={datashowAvailable}
                unlocked={datashowUnlocked}
                go={nav}
              />
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
  const [searchParams, setSearchParams] = useSearchParams()
  const { entitlementByLecture, loading: entitlementsLoading } = useEntitlements(user?.id)
  const { settings: lectureSettings } = useLectureSettings()
  const { offerFor, loading: offerLoading } = usePricingRules()
  const { byLecture: assetReadiness } = useAssetReadiness()
  const baseLecture = getLectureBySlug(slug)
  const lectureSetting = baseLecture ? lectureSettings.get(baseLecture.id) : undefined
  const lecture = baseLecture && (lectureSetting?.published ?? true) ? applyLectureSetting(baseLecture, lectureSetting) : undefined
  const requested = searchParams.get('product')
  const product = requested === 'video' || requested === 'datashow' || requested === 'bundle' ? requested : 'bundle'
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState('')
  const tr = useTr()

  if (!lecture) {
    return <div className="page"><PageHead eyebrow={tr('KIFARO CHECKOUT', 'الدفع في KIFARO')} title={tr('Lecture not found', 'المحاضرة غير موجودة')} body={tr('This lecture is not available.', 'هذه المحاضرة غير متاحة.')} /></div>
  }

  const basePrice = getLecturePrice(lecture, lectureSetting)
  const datashowBasePrice = Math.max(30, basePrice)
  const videoOffer = offerFor(lecture.id, basePrice, 'video')
  const datashowOffer = offerFor(lecture.id, datashowBasePrice, 'datashow')
  const bundleOffer = offerFor(lecture.id, basePrice + datashowBasePrice, 'bundle')
  const offers = { video: videoOffer, datashow: datashowOffer, bundle: bundleOffer }
  const offer = offers[product]
  const readiness = assetReadiness.get(lecture.id)
  const videoAvailable = Boolean(readiness?.has_video || (lecture.status === 'free' && lecture.videoUrl))
  const datashowAvailable = Boolean(readiness?.has_datashow)
  const availability = { video: videoAvailable, datashow: datashowAvailable, bundle: videoAvailable && datashowAvailable }
  const selectedAvailable = availability[product]
  const entitlement = entitlementByLecture.get(lecture.id)
  const ownsSelected =
    product === 'video' ? Boolean(entitlement?.video_access) :
    product === 'datashow' ? Boolean(entitlement?.datashow_access) :
    Boolean(entitlement?.video_access && entitlement?.datashow_access)

  const startPayment = async () => {
    if (!supabase || !user || paymentBusy) return
    setPaymentBusy(true)
    setPaymentMessage('')

    const popup = window.open('', '_self')
    const { data, error } = await supabase.functions.invoke('paymob-create-checkout', {
      body: { lectureId: lecture.id, productType: product },
    })

    if (error || data?.error || !data?.checkoutUrl) {
      setPaymentBusy(false)
      setPaymentMessage(data?.error || error?.message || tr('Could not start Paymob checkout.', 'تعذّر بدء الدفع عبر Paymob.'))
      return
    }

    if (popup) popup.location.href = String(data.checkoutUrl)
    else window.location.href = String(data.checkoutUrl)
  }

  return (
    <div className="page">
      <PageHead eyebrow={tr('SECURE CHECKOUT', 'دفع آمن')} title={tr('Choose your access', 'اختر نوع الوصول')} body={tr('Video and Datashow are separate products. Bundle unlocks both.', 'الفيديو والداتاشو منتجان منفصلان، والباقة تفتح الاتنين.')} />

      <div className="productchooser">
        <button disabled={!videoAvailable} className={product === 'video' ? 'selected' : ''} onClick={() => setSearchParams({ product: 'video' })}>
          <PlayCircle size={24} /><strong>{tr('Video', 'الفيديو')}</strong><span>{videoAvailable ? <bdi>{videoOffer.price} {tr('EGP', 'ج.م')}</bdi> : tr('Coming soon', 'قريبًا')}</span>
        </button>
        <button disabled={!datashowAvailable} className={product === 'datashow' ? 'selected' : ''} onClick={() => setSearchParams({ product: 'datashow' })}>
          <BookOpen size={24} /><strong>{tr('Datashow', 'الداتاشو')}</strong><span>{datashowAvailable ? <bdi>{datashowOffer.price} {tr('EGP', 'ج.م')}</bdi> : tr('Coming soon', 'قريبًا')}</span>
        </button>
        <button disabled={!availability.bundle} className={product === 'bundle' ? 'selected' : ''} onClick={() => setSearchParams({ product: 'bundle' })}>
          <Sparkles size={24} /><strong>{tr('Bundle', 'الباقة')}</strong><span>{availability.bundle ? <bdi>{bundleOffer.price} {tr('EGP', 'ج.م')}</bdi> : tr('Not ready', 'غير جاهزة')}</span>
        </button>
      </div>

      <div className="contentbox">
        <small>ANATOMATE BY KIFARO</small>
        <h2>{lecture.title}</h2>
        <p>{tr('Year', 'السنة')} {lecture.year} · {lecture.module}</p>

        <div className="price">
          <strong><bdi>{offer.price} {tr('EGP', 'ج.م')}</bdi></strong>
          <span>{product === 'datashow' ? tr('viewer-only Datashow access', 'وصول للداتاشو (عرض فقط)') : product === 'bundle' ? tr('video + Datashow access', 'وصول للفيديو + الداتاشو') : offer.viewLimit == null ? tr('video access', 'وصول للفيديو') : tr(offer.viewLimit + ' video views', offer.viewLimit + ' مشاهدات للفيديو')}</span>
        </div>

        {product !== 'video' && (
          <div className="watermarkpromise">
            <ShieldCheck size={22} />
            <div><strong>{tr('Protected Datashow + PDF Viewer', 'داتاشو وعارض PDF محميين')}</strong><p>{tr('No student PowerPoint or original PDF download. Content opens inside KIFARO with “Dr. Kirolus Fares” plus the student\'s identity and viewing time on every displayed page.', 'لا يوجد تحميل لملف PowerPoint أو PDF الأصلي. المحتوى يفتح داخل KIFARO، وكل صفحة معروضة تحمل اسم “Dr. Kirolus Fares” مع بيانات الطالب ووقت المشاهدة.')}</p></div>
          </div>
        )}

        {!selectedAvailable ? (
          <div className="unavailablecheckout">
            <Clock3 size={24} />
            <strong>{tr('This option is not available yet.', 'هذا الاختيار غير متاح بعد.')}</strong>
            <p>{tr('Checkout opens as soon as this lecture\'s content is ready.', 'الدفع هيتفتح أول ما محتوى المحاضرة يبقى جاهز.')}</p>
          </div>
        ) : !user ? (
          <>
            <p>{tr('Sign in first so the purchase can be permanently attached to your KIFARO account.', 'سجّل الدخول أولًا علشان الشراء يتربط بحسابك في KIFARO بشكل دائم.')}</p>
            <button className="primary full" onClick={() => nav('/login')}><LogIn size={17} /> {tr('Sign in to continue', 'سجّل الدخول للمتابعة')}</button>
          </>
        ) : ownsSelected ? (
          <>
            <div className="price"><strong>{tr('Purchased', 'تم الشراء')}</strong><span>{tr('access is active', 'الوصول مفعّل')}</span></div>
            <button className="primary full" onClick={() => nav(product === 'datashow' ? '/anatomate/lecture/' + lecture.slug + '/datashow' : '/anatomate/lecture/' + lecture.slug)}>
              <Check size={17} /> {tr('Open content', 'افتح المحتوى')}
            </button>
          </>
        ) : (
          <>
            <small className="assetnote">{tr('Your price is matched to your academic year and nationality. Paymob confirms payment server-to-server before KIFARO unlocks access.', 'السعر محسوب حسب سنتك الدراسية وجنسيتك. Paymob بيأكد الدفع مع السيرفر قبل ما KIFARO يفتح المحتوى.')}</small>
            <button className="primary full" disabled={paymentBusy || entitlementsLoading || offerLoading} onClick={() => void startPayment()}>
              <CreditCard size={17} /> {paymentBusy ? tr('Opening Paymob…', 'جارٍ فتح Paymob…') : entitlementsLoading || offerLoading ? tr('Checking account…', 'جارٍ التحقق من الحساب…') : tr('Pay securely with Paymob', 'ادفع بأمان عبر Paymob')}
            </button>
            {PAYMOB_TEST_MODE && <small className="paymenttestnote">{tr('Paymob is currently in TEST MODE — no real money is charged during testing.', 'بوابة Paymob حاليًا في وضع التجربة — مفيش فلوس حقيقية بتتخصم.')}</small>}
            {paymentMessage && <div className="authmessage">{paymentMessage}</div>}
          </>
        )}

        <button className="secondary full" onClick={() => nav('/anatomate/lecture/' + lecture.slug)}>{tr('Back to lecture', 'العودة للمحاضرة')}</button>
        <small className="assetnote">{tr('Every purchase is verified on our servers before access is granted.', 'كل عملية شراء بيتم التحقق منها على السيرفر قبل فتح المحتوى.')}</small>
      </div>
    </div>
  )
}

function PaymentReturnPage() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const [checking, setChecking] = useState(true)
  const tr = useTr()
  const [status, setStatus] = useState<'checking' | 'signin' | 'confirmed' | 'pending' | 'failed'>('checking')
  const successHint = params.get('success')
  const transactionId = params.get('id')

  useEffect(() => {
    let active = true
    const verify = async () => {
      if (!user) {
        if (active) {
          setChecking(false)
          setStatus('signin')
        }
        return
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (!active) return
        await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 800 : 1600))
        if (!supabase) break
        const { data } = await supabase
          .from('lecture_entitlements')
          .select('lecture_id, source, granted_at')
          .eq('user_id', user.id)
          .is('revoked_at', null)
          .order('granted_at', { ascending: false })
          .limit(1)

        if (data?.length && String(data[0].source || '').startsWith('paymob:')) {
          if (active) {
            setChecking(false)
            setStatus('confirmed')
          }
          return
        }
      }

      if (active) {
        setChecking(false)
        setStatus(successHint === 'true' ? 'pending' : 'failed')
      }
    }

    void verify()
    return () => { active = false }
  }, [user?.id, successHint])

  return (
    <div className="page">
      <div className="contentbox paymentreturn">
        <div className={checking ? 'paymentreturnicon checking' : 'paymentreturnicon'}>{checking ? <Clock3 size={30}/> : <ShieldCheck size={30}/>}</div>
        <small>PAYMOB · KIFARO</small>
        <h2>{checking ? tr('Checking payment', 'جارٍ التحقق من الدفع') : tr('Payment status', 'حالة الدفع')}</h2>
        <p>{{
          checking: tr('Confirming payment with Paymob…', 'جارٍ تأكيد الدفع مع Paymob…'),
          signin: tr('Sign in to see your purchased content.', 'سجّل الدخول لتشوف المحتوى اللي اشتريته.'),
          confirmed: tr('Payment confirmed. Your KIFARO access is active.', 'تم تأكيد الدفع. وصولك في KIFARO مفعّل.'),
          pending: tr('Paymob accepted the payment. KIFARO is still waiting for the secure server confirmation; refresh My Library in a moment.', 'تم قبول الدفع من Paymob، وKIFARO لسه مستني التأكيد من السيرفر. حدّث صفحة مكتبتي بعد شوية.'),
          failed: tr('Payment was not confirmed. No access has been granted.', 'لم يتم تأكيد الدفع، ولم يُفتح أي محتوى.'),
        }[status]}</p>
        {transactionId && <small className="assetnote">{tr('Transaction reference:', 'رقم العملية:')} <bdi>{transactionId}</bdi></small>}
        <div className="paymentreturnactions">
          <button className="primary" onClick={() => nav('/library')}><Library size={17}/> {tr('My Library', 'مكتبتي')}</button>
          <button className="secondary" onClick={() => nav('/anatomate')}><BookOpen size={17}/> AnatoMate</button>
        </div>
      </div>
    </div>
  )
}

function StudyResourcePanel({
  title,
  resources,
  lectureSlug,
  available,
  unlocked,
  go,
}: {
  title: string
  resources: StudyResource[]
  lectureSlug: string
  available: boolean
  unlocked: boolean
  go: (path: string) => void
}) {
  const tr = useTr()
  if (!resources.length) return null

  return (
    <div className="contentbox studyresources">
      <div className="studyresourceshead">
        <div>
          <small>{tr('END-OF-LECTURE STUDY IMAGES', 'صور المراجعة في نهاية المحاضرة')}</small>
          <h2>{title}</h2>
        </div>
        <span>{resources.length} {resources.length === 1 ? tr('visual', 'صورة') : tr('visuals', 'صور')}</span>
      </div>
      <p className="studyresourcesnote">
        {tr(
          'Open the original study slide inside KIFARO. It stays view-only and carries the same personal watermark as the Datashow.',
          'افتح شريحة المراجعة الأصلية داخل KIFARO. تظل للعرض فقط وتحمل نفس العلامة المائية الشخصية الخاصة بالداتاشو.'
        )}
      </p>
      <div className="studyresourcegrid">
        {resources.map((resource) => {
          const target = unlocked
            ? '/anatomate/lecture/' + lectureSlug + '/datashow?page=' + resource.page
            : '/checkout/' + lectureSlug + '?product=datashow'
          return (
            <button
              key={resource.page + '-' + resource.title}
              className={unlocked ? 'studyresourcecard' : 'studyresourcecard locked'}
              disabled={!available}
              onClick={() => go(target)}
            >
              <span className="studyresourceicon">{unlocked ? <BookOpen size={21} /> : <Lock size={20} />}</span>
              <span className="studyresourcecopy">
                <strong>{resource.title}</strong>
                <small>
                  {available
                    ? (unlocked
                      ? tr('Open protected slide ', 'افتح الشريحة المحمية ') + resource.page
                      : tr('Unlock Datashow to open', 'افتح الداتاشو للوصول'))
                    : tr('Study slide not uploaded yet', 'شريحة المراجعة لم تُرفع بعد')}
                </small>
              </span>
              {available && <ChevronRight size={18} />}
            </button>
          )
        })}
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
          <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><p dir="auto">{item}</p></div>
        ))}
      </div>
    </div>
  )
}

function Topics({ lectures, go }: { lectures: any[]; go: (path: string) => void }) {
  const tr = useTr()
  return (
    <div className="page">
      <PageHead eyebrow="ANATOMATE" title={tr('Topics', 'الموضوعات')} body={tr('Review anatomy by region, system and clinical relevance.', 'راجع التشريح حسب المنطقة والجهاز والأهمية الإكلينيكية.')} />
      <div className="topicgrid">
        {lectures.map((lecture, index) => (
          <button className="topiccard clickable" key={lecture.id} onClick={() => go('/anatomate/lecture/' + lecture.slug)}>
            <span className="topicindex">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <small>{lecture.system}</small><h3>{lecture.title}</h3><p>{lecture.description}</p>
              <div className="tags"><span>{tr('Year', 'السنة')} {lecture.year}</span><span><bdi>{lecture.duration} {tr('min', 'دقيقة')}</bdi></span><span>{tr('Lecture', 'محاضرة')} {lecture.sequence}</span></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function Studio() {
  const tr = useTr()
  const tools = [
    [tr('Flashcards', 'بطاقات المراجعة'), tr('Rapid active-recall decks from your modules.', 'بطاقات استرجاع سريعة من موديولاتك.')],
    [tr('Revision Builder', 'منشئ المراجعة'), tr('Build a focused revision session.', 'جهّز جلسة مراجعة مركزة.')],
    [tr('Exam Preparation', 'التحضير للامتحان'), tr('Practice clinically oriented MCQs.', 'تدرب على أسئلة MCQ إكلينيكية.')],
    [tr('Saved Notes', 'الملاحظات المحفوظة'), tr('Keep important concepts in one place.', 'احتفظ بالمفاهيم المهمة في مكان واحد.')],
  ]
  return (
    <div className="page">
      <PageHead eyebrow={tr('TOOLS', 'الأدوات')} title="KIFARO Studio" body={tr('Study tools that turn content into active revision.', 'أدوات مذاكرة بتحوّل المحتوى لمراجعة نشطة.')} />
      <div className="toolgrid">
        {tools.map(([title, body]) => (
          <div className="toolcard" key={title}><div className="softicon"><Sparkles /></div><h3>{title}</h3><p>{body}</p><button className="secondary" disabled>{tr('Coming soon', 'قريبًا')}</button></div>
        ))}
      </div>
    </div>
  )
}

function LibraryPage({ lectures, update, flash, t, go }: { lectures: any[]; update: any; flash: any; t: any; go: (path: string) => void }) {
  const favorites = lectures.filter((lecture) => lecture.favorite)
  const visible = favorites.length ? favorites : lectures.slice(0, 3)
  const tr = useTr()
  return (
    <div className="page">
      <PageHead eyebrow={tr('MY LIBRARY', 'مكتبتي')} title={t.library} body={tr('Favorites and saved learning items.', 'المفضلة والمحتوى المحفوظ.')} />
      <div className="cards wide">
        {visible.map((lecture) => (
          <div className="coursecard" key={lecture.id}>
            <div className="cover"><Library /><span>{tr('YEAR', 'السنة')} {lecture.year}</span></div>
            <div className="cardbody">
              <small>{lecture.module}</small><h3>{lecture.title}</h3><p>{lecture.system}</p>
              <div className="cardactions">
                <button className="secondary" onClick={() => go('/anatomate/lecture/' + lecture.slug)}>{tr('Open', 'فتح')}</button>
                <button
                  className="icon star"
                  aria-label={tr('Toggle favorite', 'تبديل المفضلة')}
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
  const themeNames: Record<Theme, [string, string]> = {
    blue: ['KIFARO Blue', 'أزرق KIFARO'], teal: ['Teal', 'فيروزي'], violet: ['Violet', 'بنفسجي'], forest: ['Forest', 'أخضر'],
  }
  return (
    <div className="prefscontent">
      <section>
        <h3>{t.theme}</h3>
        <div className="optionlist">
          {(['blue', 'teal', 'violet', 'forest'] as Theme[]).map((item) => (
            <button key={item} className={theme === item ? 'selected' : ''} onClick={() => setTheme(item)}>
              <span className={'swatch ' + item} />
              {themeNames[item][lang === 'ar' ? 1 : 0]}
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

function Course({ l, go, t }: { l: any; go: (path: string) => void; t: any }) {
  return (
    <button className="coursecard clickable" onClick={() => go('/anatomate/lecture/' + l.slug)}>
      <div className="cover"><Microscope /><span>{t.lecture} {l.sequence}</span></div>
      <div className="cardbody">
        <small>{l.module}</small><h3>{l.title}</h3><p>{l.system}</p>
        <div className="meta"><bdi>{l.duration} {t.min}</bdi><bdi dir="ltr">{l.progress || 0}%</bdi></div>
        <div className="progress"><i style={{ width: (l.progress || 0) + '%' }} /></div>
      </div>
    </button>
  )
}

function Mini({ icon, title, body }: { icon: any; title: string; body: ReactNode }) {
  return <div className="minicard"><div className="minihead"><span className="softicon">{icon}</span><h3>{title}</h3></div><p>{body}</p></div>
}
