import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, Lock, Maximize2, ShieldCheck } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getLectureBySlug } from '../data/anatomate'
import { useAuth } from '../auth/AuthContext'
import { useAdmin } from '../hooks/useAdmin'
import { useEntitlements } from '../hooks/useEntitlements'
import { useLectureSettings } from '../hooks/useLectureSettings'
import { supabase } from '../lib/supabase'
import { useTr } from '../i18n'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

const OWNER_WATERMARK = 'Dr. Kirolus Fares'
type ViewerMode = 'datashow' | 'pdf'

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, weight = 600) {
  let size = startSize
  while (size > 12) {
    ctx.font = `${weight} ${size}px Arial, sans-serif`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 1
  }
  return size
}

function paintWatermark(
  canvas: HTMLCanvasElement,
  details: { studentName: string; email: string; studentId: string; viewedAt: string },
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const ownerSize = Math.max(22, Math.round(canvas.width / 25))
  const identity = `${details.studentName} · ${details.email}`
  const trace = `ID ${details.studentId} · ${details.viewedAt}`
  const stepX = Math.max(330, canvas.width / 1.9)
  const stepY = Math.max(210, canvas.height / 3)

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#173b6d'

  for (let y = -stepY; y < canvas.height + stepY; y += stepY) {
    for (let x = -stepX; x < canvas.width + stepX; x += stepX) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(-Math.PI / 7)

      ctx.globalAlpha = 0.13
      ctx.font = `700 ${ownerSize}px Arial, sans-serif`
      ctx.fillText(OWNER_WATERMARK, 0, -ownerSize * 0.45)

      const studentSize = fitText(ctx, identity, stepX * 0.88, Math.max(14, Math.round(ownerSize * 0.48)), 600)
      ctx.globalAlpha = 0.11
      ctx.font = `600 ${studentSize}px Arial, sans-serif`
      ctx.fillText(identity, 0, ownerSize * 0.42)
      ctx.restore()
    }
  }

  ctx.globalAlpha = 0.42
  ctx.fillStyle = '#173b6d'
  const footerOwnerSize = Math.max(17, Math.round(ownerSize * 0.7))
  ctx.font = `700 ${footerOwnerSize}px Arial, sans-serif`
  ctx.fillText(OWNER_WATERMARK, canvas.width / 2, canvas.height - Math.max(54, footerOwnerSize * 2.2))

  const footerStudentSize = fitText(ctx, identity, canvas.width * 0.88, Math.max(13, Math.round(footerOwnerSize * 0.72)), 600)
  ctx.globalAlpha = 0.38
  ctx.font = `600 ${footerStudentSize}px Arial, sans-serif`
  ctx.fillText(identity, canvas.width / 2, canvas.height - Math.max(30, footerStudentSize * 1.4))

  const traceSize = fitText(ctx, trace, canvas.width * 0.88, Math.max(11, Math.round(footerStudentSize * 0.78)), 500)
  ctx.globalAlpha = 0.34
  ctx.font = `500 ${traceSize}px Arial, sans-serif`
  ctx.fillText(trace, canvas.width / 2, canvas.height - Math.max(12, traceSize * 0.45))

  ctx.restore()
}

export default function DatashowViewer({ mode = 'datashow' }: { mode?: ViewerMode }) {
  const { slug } = useParams()
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedPage = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
  const { user, loading: authLoading } = useAuth()
  const tr = useTr()
  const { isAdmin, loading: adminLoading } = useAdmin(user?.id)
  const { entitlementByLecture, loading: entitlementLoading } = useEntitlements(user?.id)
  const { settings: lectureSettings, loading: lectureSettingsLoading } = useLectureSettings()
  const lecture = getLectureBySlug(slug)
  const setting = lecture ? lectureSettings.get(lecture.id) : undefined
  const entitlement = lecture ? entitlementByLecture.get(lecture.id) : undefined
  const isFree = Boolean(lecture && setting?.published !== false &&
    (setting?.access_mode === 'free' || (lecture.status === 'free' && setting?.access_mode !== 'paid')))
  const hasAccess = Boolean(isAdmin || isFree || entitlement?.datashow_access)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [documentProxy, setDocumentProxy] = useState<any>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [message, setMessage] = useState('')
  const [watermarkTick, setWatermarkTick] = useState(() => Date.now())

  const documentLabel = mode === 'pdf' ? 'PDF' : 'Datashow'
  const docLabel = mode === 'pdf' ? 'PDF' : tr('Datashow', 'الداتاشو')
  const displayName = String(user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student')
  const email = String(user?.email || 'student-account')
  const studentId = String(user?.id || 'unknown').slice(0, 8).toUpperCase()
  const viewedAt = new Date(watermarkTick).toLocaleString()

  useEffect(() => {
    const timer = window.setInterval(() => setWatermarkTick(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const blockProtectedShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && (key === 's' || key === 'p')) {
        event.preventDefault()
      }
    }
    const blockDrag = (event: DragEvent) => event.preventDefault()

    window.addEventListener('keydown', blockProtectedShortcuts)
    window.addEventListener('dragstart', blockDrag)
    return () => {
      window.removeEventListener('keydown', blockProtectedShortcuts)
      window.removeEventListener('dragstart', blockDrag)
    }
  }, [])

  useEffect(() => {
    if (!lecture || !user || !hasAccess || !supabase) return
    let active = true
    const getCount = async () => {
      setLoading(true)
      setMessage('')
      const { data, error } = await supabase.functions.invoke('lecture-slide', {
        body: { lectureId: lecture.id, page: 0 },
      })
      if (!active) return
      if (error || !Number.isInteger(data?.pageCount) || data.pageCount < 1) {
        setMessage(error?.message || 'Unable to load lecture page count.')
        setLoading(false)
        return
      }
      setPageCount(data.pageCount)
      setPageNumber(Math.min(Math.max(1, requestedPage), data.pageCount))
      setLoading(false)
    }
    void getCount()
    return () => { active = false }
  }, [lecture?.id, user?.id, hasAccess, requestedPage])

  useEffect(() => {
    if (!lecture || !user || !hasAccess || !supabase || !pageCount) return
    let active = true
    let task: any
    const load = async () => {
      setLoading(true)
      setMessage('')
      setDocumentProxy(null)
      try {
        const { data, error } = await supabase.functions.invoke('lecture-slide', {
          body: { lectureId: lecture.id, page: pageNumber },
        })
        if (!active) return
        if (error || !(data instanceof Blob)) throw new Error(error?.message || 'Unable to load protected slide.')
        task = pdfjsLib.getDocument({ data: await data.arrayBuffer() })
        const pdf = await task.promise
        if (active) setDocumentProxy(pdf)
      } catch (err) {
        if (active) setMessage(err instanceof Error ? err.message : 'Unable to load protected slide.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false; try { task?.destroy?.() } catch {} }
  }, [lecture?.id, user?.id, hasAccess, pageNumber, pageCount])

  useEffect(() => {
    if (!documentProxy || !canvasRef.current) return
    let cancelled = false
    const render = async () => {
      setRendering(true)
      try {
        const page = await documentProxy.getPage(1)
        const base = page.getViewport({ scale: 1 })
        const available = Math.min(1280, Math.max(320, (stageRef.current?.clientWidth || 900) - 32))
        const viewport = page.getViewport({ scale: Math.max(0.7, available / base.width) })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context) return
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = '100%'
        canvas.style.height = 'auto'
        await page.render({ canvasContext: context, viewport }).promise
        if (!cancelled) paintWatermark(canvas, { studentName: displayName, email, studentId, viewedAt })
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Unable to render slide.')
      } finally {
        if (!cancelled) setRendering(false)
      }
    }
    void render()
    return () => { cancelled = true }
  }, [documentProxy, watermarkTick, displayName, email, studentId])


  const toggleFullscreen = async () => {
    const target = stageRef.current
    if (!target) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await target.requestFullscreen()
  }

  if (!lecture) {
    return <div className="page"><div className="contentbox"><h2>{tr(documentLabel + ' not found', docLabel + ' غير موجود')}</h2></div></div>
  }

  if (authLoading || adminLoading || entitlementLoading || lectureSettingsLoading) {
    return <div className="page"><div className="contentbox"><h2>{tr('Checking access…', 'جارٍ التحقق من الصلاحية…')}</h2></div></div>
  }

  if (!user) {
    return (
      <div className="page">
        <div className="contentbox datashowlocked">
          <Lock size={34} />
          <h2>{tr('Sign in to open this ' + documentLabel, 'سجّل الدخول لفتح ' + docLabel)}</h2>
          <button className="primary" onClick={() => nav('/login')}>{tr('Sign in', 'تسجيل الدخول')}</button>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="page">
        <div className="contentbox datashowlocked">
          <Lock size={34} />
          <small>ANATOMATE {documentLabel.toUpperCase()}</small>
          <h2>{tr(documentLabel + ' access is locked', docLabel + ' مقفل')}</h2>
          <p>{tr('This protected viewer is available after purchasing the Datashow or Bundle option.', 'العارض المحمي متاح بعد شراء الداتاشو أو الباقة.')}</p>
          <button className="primary" onClick={() => nav('/checkout/' + lecture.slug + '?product=datashow')}>{tr('Unlock Datashow', 'افتح الداتاشو')}</button>
          <button className="secondary" onClick={() => nav('/anatomate/lecture/' + lecture.slug)}>{tr('Back to lecture', 'العودة للمحاضرة')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page datashowpage">
      <div className="datashowtop">
        <button className="secondary" onClick={() => nav('/anatomate/lecture/' + lecture.slug)}><ArrowLeft size={17} className="dirarrow" /> {tr('Back', 'رجوع')}</button>
        <div>
          <small>{tr('ANATOMATE ' + documentLabel.toUpperCase() + ' VIEWER · VIEW ONLY', 'عارض ' + docLabel + ' · عرض فقط')}</small>
          <h1>{lecture.title}</h1>
        </div>
        <div className="datashowsecure"><ShieldCheck size={18} /> {tr('Personally watermarked', 'بعلامة مائية شخصية')}</div>
      </div>

      <div className="vieweridentity">
        <FileText size={17} />
        <span>{displayName}</span>
        <small><bdi>{email}</bdi> · ID <bdi>{studentId}</bdi></small>
      </div>

      <div
        ref={stageRef}
        className="datashowstage"
        onContextMenu={(event) => event.preventDefault()}
      >
        {loading && <div className="datashowstatus">{tr('Loading protected ' + documentLabel + '…', 'جارٍ تحميل ' + docLabel + ' المحمي…')}</div>}
        {message && <div className="authmessage">{message}</div>}
        {!loading && !message && (
          <>
            <canvas
              ref={canvasRef}
              draggable={false}
              className={rendering ? 'datashowcanvas rendering' : 'datashowcanvas'}
            />
            <div className="datashowcontrols">
              <button
                className="secondary"
                disabled={pageNumber <= 1 || rendering}
                onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
              >
                <ChevronLeft size={18} className="dirarrow" /> {tr('Previous', 'السابق')}
              </button>
              <span>{mode === 'pdf' ? tr('Page', 'صفحة') : tr('Slide', 'شريحة')} <bdi dir="ltr">{pageNumber} / {pageCount || '—'}</bdi></span>
              <button
                className="secondary"
                disabled={pageNumber >= pageCount || rendering}
                onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))}
              >
                {tr('Next', 'التالي')} <ChevronRight size={18} className="dirarrow" />
              </button>
              <button className="secondary" onClick={() => void toggleFullscreen()}><Maximize2 size={18} /> {tr('Full screen', 'ملء الشاشة')}</button>
            </div>
          </>
        )}
      </div>

      <p className="datashownote">
        {tr(
          `Viewer-only access. Each requested page is delivered individually with a personal watermark; screen capture is still possible. Every displayed ${mode === 'pdf' ? 'page' : 'slide'} carries “${OWNER_WATERMARK}”, the signed-in student identity, a trace ID and viewing time.`,
          `عرض فقط. كل صفحة تُرسل منفصلة بعلامة مائية شخصية، مع بقاء إمكانية تصوير الشاشة. كل ${mode === 'pdf' ? 'صفحة' : 'شريحة'} معروضة تحمل “${OWNER_WATERMARK}” وبيانات الطالب المسجّل ورقم تتبع ووقت المشاهدة.`,
        )}
      </p>
    </div>
  )
}
