import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, Maximize2, ShieldCheck } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getLectureBySlug } from '../data/anatomate'
import { useAuth } from '../auth/AuthContext'
import { useAdmin } from '../hooks/useAdmin'
import { useEntitlements } from '../hooks/useEntitlements'
import { supabase } from '../lib/supabase'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

const WATERMARK = 'Dr. Kirolus Fares'

function paintWatermark(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const fontSize = Math.max(22, Math.round(canvas.width / 24))
  const stepX = Math.max(260, canvas.width / 2.2)
  const stepY = Math.max(180, canvas.height / 3.3)

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${fontSize}px Arial, sans-serif`

  for (let y = -stepY; y < canvas.height + stepY; y += stepY) {
    for (let x = -stepX; x < canvas.width + stepX; x += stepX) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(-Math.PI / 7)
      ctx.globalAlpha = 0.14
      ctx.fillStyle = '#173b6d'
      ctx.fillText(WATERMARK, 0, 0)
      ctx.restore()
    }
  }

  ctx.globalAlpha = 0.34
  ctx.font = `600 ${Math.max(18, Math.round(fontSize * 0.72))}px Arial, sans-serif`
  ctx.fillStyle = '#173b6d'
  ctx.fillText(WATERMARK, canvas.width / 2, canvas.height - Math.max(28, fontSize))
  ctx.restore()
}

export default function DatashowViewer() {
  const { slug } = useParams()
  const nav = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, loading: adminLoading } = useAdmin(user?.id)
  const { entitlementByLecture, loading: entitlementLoading } = useEntitlements(user?.id)
  const lecture = getLectureBySlug(slug)
  const entitlement = lecture ? entitlementByLecture.get(lecture.id) : undefined
  const hasAccess = Boolean(isAdmin || entitlement?.datashow_access)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [documentProxy, setDocumentProxy] = useState<any>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    let loadingTask: any

    const load = async () => {
      if (!lecture || !user || !hasAccess || !supabase) return

      setLoading(true)
      setMessage('')

      const { data, error } = await supabase.functions.invoke('lecture-asset', {
        body: { lectureId: lecture.id, assetType: 'datashow' },
      })

      if (!active) return

      if (error || data?.error || !data?.signedUrl) {
        setMessage(data?.error || error?.message || 'Datashow is not available yet.')
        setLoading(false)
        return
      }

      try {
        const response = await fetch(data.signedUrl, { cache: 'no-store' })
        if (!response.ok) throw new Error('Could not load the datashow.')
        const bytes = await response.arrayBuffer()
        loadingTask = pdfjsLib.getDocument({ data: bytes })
        const pdf = await loadingTask.promise
        if (!active) return
        setDocumentProxy(pdf)
        setPageCount(pdf.numPages)
        setPageNumber(1)
      } catch (err) {
        if (active) setMessage(err instanceof Error ? err.message : 'Could not load the datashow.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
      try { loadingTask?.destroy?.() } catch {}
    }
  }, [lecture?.id, user?.id, hasAccess])

  useEffect(() => {
    let cancelled = false

    const renderPage = async () => {
      if (!documentProxy || !canvasRef.current) return
      setRendering(true)
      try {
        const page = await documentProxy.getPage(pageNumber)
        if (cancelled || !canvasRef.current) return

        const baseViewport = page.getViewport({ scale: 1 })
        const availableWidth = Math.min(1280, Math.max(320, (stageRef.current?.clientWidth || 900) - 32))
        const scale = Math.max(0.7, availableWidth / baseViewport.width)
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = '100%'
        canvas.style.height = 'auto'

        await page.render({ canvasContext: context, viewport }).promise
        if (!cancelled) paintWatermark(canvas)
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Could not render this slide.')
      } finally {
        if (!cancelled) setRendering(false)
      }
    }

    void renderPage()
    return () => { cancelled = true }
  }, [documentProxy, pageNumber])

  const toggleFullscreen = async () => {
    const target = stageRef.current
    if (!target) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await target.requestFullscreen()
  }

  if (!lecture) {
    return <div className="page"><div className="contentbox"><h2>Datashow not found</h2></div></div>
  }

  if (authLoading || adminLoading || entitlementLoading) {
    return <div className="page"><div className="contentbox"><h2>Checking access…</h2></div></div>
  }

  if (!user) {
    return (
      <div className="page">
        <div className="contentbox datashowlocked">
          <Lock size={34} />
          <h2>Sign in to open this datashow</h2>
          <button className="primary" onClick={() => nav('/login')}>Sign in</button>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="page">
        <div className="contentbox datashowlocked">
          <Lock size={34} />
          <small>ANATOMATE DATASHOW</small>
          <h2>Datashow access is locked</h2>
          <p>This viewer is available after purchasing the Datashow or Bundle option.</p>
          <button className="primary" onClick={() => nav('/checkout/' + lecture.slug + '?product=datashow')}>Unlock Datashow</button>
          <button className="secondary" onClick={() => nav('/anatomate/lecture/' + lecture.slug)}>Back to lecture</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page datashowpage">
      <div className="datashowtop">
        <button className="secondary" onClick={() => nav('/anatomate/lecture/' + lecture.slug)}><ArrowLeft size={17} /> Back</button>
        <div>
          <small>ANATOMATE VIEWER · VIEW ONLY</small>
          <h1>{lecture.title}</h1>
        </div>
        <div className="datashowsecure"><ShieldCheck size={18} /> Watermarked</div>
      </div>

      <div
        ref={stageRef}
        className="datashowstage"
        onContextMenu={(event) => event.preventDefault()}
      >
        {loading && <div className="datashowstatus">Loading protected datashow…</div>}
        {message && <div className="authmessage">{message}</div>}
        {!loading && !message && (
          <>
            <canvas ref={canvasRef} className={rendering ? 'datashowcanvas rendering' : 'datashowcanvas'} />
            <div className="datashowcontrols">
              <button
                className="secondary"
                disabled={pageNumber <= 1 || rendering}
                onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
              >
                <ChevronLeft size={18} /> Previous
              </button>
              <span>Slide {pageNumber} / {pageCount || '—'}</span>
              <button
                className="secondary"
                disabled={pageNumber >= pageCount || rendering}
                onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))}
              >
                Next <ChevronRight size={18} />
              </button>
              <button className="secondary" onClick={() => void toggleFullscreen()}><Maximize2 size={18} /> Full screen</button>
            </div>
          </>
        )}
      </div>
      <p className="datashownote">Viewer-only access. The original PowerPoint file is not delivered to the student. Every displayed slide carries the watermark “{WATERMARK}”.</p>
    </div>
  )
}
