import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { publicAssetUrl } from '../lib/publicAssetUrl'
import { useAuth } from '../auth/AuthContext'
import { useTr } from '../i18n'

type Props = { itemId: string; mediaPath: string; alt: string }

export function ProtectedAssessmentImage(props: Props) {
  const { session } = useAuth()
  // A different station, source or session must never display the old image,
  // even for the render before effects run. Tokens remain in memory only.
  const identity = JSON.stringify([props.itemId, props.mediaPath, session?.access_token ?? null])
  return <AssessmentImage key={identity} {...props} signedIn={Boolean(session)} />
}

function AssessmentImage({ itemId, mediaPath, alt, signedIn }: Props & { signedIn: boolean }) {
  const tr = useTr()
  const isPrivate = mediaPath.startsWith('private:')
  const [url, setUrl] = useState(isPrivate ? '' : publicAssetUrl(mediaPath) || '')
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setFailed(false)
    setUrl('')
    if (!isPrivate) {
      setUrl(publicAssetUrl(mediaPath) || '')
      return () => { active = false }
    }
    if (!supabase || !signedIn) {
      setFailed(true)
      return () => { active = false }
    }
    void supabase.functions.invoke('assessment-media-access', { body: { itemId } })
      .then(({ data, error }) => {
        if (!active) return
        // The current service returns inline images. Never redirect a private
        // reference to a public URL or use the old public asset as a fallback.
        if (error || data?.error || typeof data?.url !== 'string' ||
            !/^data:image\/(?:jpeg|png|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(data.url)) {
          setFailed(true)
          return
        }
        setUrl(data.url)
      })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [itemId, mediaPath, isPrivate, signedIn, retry])

  if (failed) return <div className="assessmentempty" role="alert">
    <p>{tr('Image could not be loaded.', 'تعذر تحميل الصورة.')}</p>
    <button type="button" className="secondary" onClick={() => setRetry(value => value + 1)}>
      {tr('Retry', 'إعادة المحاولة')}
    </button>
  </div>
  if (!url) return <div className="assessmentempty" role="status">
    {tr('Loading image…', 'جارٍ تحميل الصورة…')}
  </div>
  return <img src={url} alt={alt} loading="eager" decoding="async"
    onError={() => { setUrl(''); setFailed(true) }} />
}
