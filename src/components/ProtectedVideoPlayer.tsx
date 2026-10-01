import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Lock, Maximize2, PlayCircle, ShieldCheck } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getLectureBySlug } from '../data/anatomate'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'

const OWNER = 'Dr. Kirolus Fares'

const watermarkPositions = [
  { top: '12%', left: '8%' },
  { top: '18%', right: '8%' },
  { top: '45%', left: '34%' },
  { bottom: '18%', left: '10%' },
  { bottom: '13%', right: '9%' },
] as const

export default function ProtectedVideoPlayer() {
  const { slug } = useParams()
  const nav = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const lecture = getLectureBySlug(slug)
  const playerRef = useRef<HTMLDivElement | null>(null)
  const [embedUrl, setEmbedUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [remainingViews, setRemainingViews] = useState<number | null>(null)
  const [watermarkStep, setWatermarkStep] = useState(0)
  const [viewTime, setViewTime] = useState(() => Date.now())

  const studentName = String(user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student')
  const email = String(user?.email || 'student-account')
  const studentId = String(user?.id || 'unknown').slice(0, 8).toUpperCase()
  const currentPosition = watermarkPositions[watermarkStep % watermarkPositions.length]

  const traceLine = useMemo(
    () => `${email} · ID ${studentId} · ${new Date(viewTime).toLocaleString()}`,
    [email, studentId, viewTime],
  )

  useEffect(() => {
    const moveTimer = window.setInterval(() => {
      setWatermarkStep((step) => (step + 1) % watermarkPositions.length)
    }, 20_000)
    const timeTimer = window.setInterval(() => setViewTime(Date.now()), 60_000)
    return () => {
      window.clearInterval(moveTimer)
      window.clearInterval(timeTimer)
    }
  }, [])

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!lecture || !user || !supabase) return
      setLoading(true)
      setMessage('')

      const { data, error } = await supabase.functions.invoke('bunny-video-playback', {
        body: { lectureId: lecture.id },
      })

      if (!active) return

      if (error || data?.error || !data?.embedUrl) {
        const missing = data?.requiredSecrets?.length
          ? ' Bunny Stream security keys still need to be connected by the administrator.'
          : ''
        setMessage((data?.error || error?.message || 'Could not open this video.') + missing)
        setLoading(false)
        return
      }

      setEmbedUrl(String(data.embedUrl))
      setRemainingViews(data?.remainingViews == null ? null : Number(data.remainingViews))
      setLoading(false)
    }

    void load()
    return () => { active = false }
  }, [lecture?.id, user?.id])

  const toggleFullscreen = async () => {
    const player = playerRef.current
    if (!player) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await player.requestFullscreen()
  }

  if (!lecture) {
    return <div className="page"><div className="contentbox"><h2>Video not found</h2></div></div>
  }

  if (authLoading) {
    return <div className="page"><div className="contentbox"><h2>Checking access…</h2></div></div>
  }

  if (!user) {
    return (
      <div className="page">
        <div className="contentbox videolocked">
          <Lock size={34} />
          <h2>Sign in to watch this video</h2>
          <button className="primary" onClick={() => nav('/login')}>Sign in</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page protectedvideopage">
      <div className="protectedvideotop">
        <button className="secondary" onClick={() => nav('/anatomate/lecture/' + lecture.slug)}>
          <ArrowLeft size={17} /> Back
        </button>
        <div>
          <small>ANATOMATE PROTECTED VIDEO</small>
          <h1>{lecture.title}</h1>
          <p>{lecture.module} · Year {lecture.year}</p>
        </div>
        <div className="protectedvideosecure"><ShieldCheck size={18} /> Signed playback</div>
      </div>

      <div className="videoidentity">
        <PlayCircle size={18} />
        <div><strong>{studentName}</strong><span>{email} · ID {studentId}</span></div>
      </div>

      <div ref={playerRef} className="protectedvideoframe" onContextMenu={(event) => event.preventDefault()}>
        {loading && <div className="protectedvideostatus"><PlayCircle size={36} />Preparing secure video…</div>}
        {message && <div className="protectedvideoerror">{message}</div>}
        {!loading && !message && embedUrl && (
          <>
            <iframe
              src={embedUrl}
              title={lecture.title}
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            />
            <div className="videowatermark staticmark">
              <strong>{OWNER}</strong>
              <span>{studentName}</span>
            </div>
            <div className="videowatermark movingmark" style={currentPosition}>
              <strong>{OWNER}</strong>
              <span>{studentName}</span>
              <small>{traceLine}</small>
            </div>
            <button className="videofullscreen" onClick={() => void toggleFullscreen()}>
              <Maximize2 size={17} /> Full screen
            </button>
          </>
        )}
      </div>

      <div className="protectedvideonote">
        <ShieldCheck size={17} />
        <span>
          Protected viewing session. The player link expires automatically and the on-screen watermark identifies the signed-in account.
          {remainingViews !== null ? ' ' + remainingViews + ' paid view' + (remainingViews === 1 ? '' : 's') + ' remain after this session starts.' : ''}
        </span>
      </div>
    </div>
  )
}
