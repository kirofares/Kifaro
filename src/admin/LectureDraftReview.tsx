import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Presentation,
  RotateCcw,
  Sparkles,
  ThumbsUp,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  buildLecturePdf,
  buildLecturePptx,
  safeLectureFileName,
  type ArtifactDraftContent,
  type VisualDataMap,
} from './lectureArtifacts'

type VisualStatus = 'pending' | 'generating' | 'needs_review' | 'approved' | 'failed'

type VisualRow = {
  id: string
  draft_id: string
  lecture_id: string
  slide_number: number
  status: VisualStatus
  prompt: string
  storage_path: string | null
  model: string | null
  quality: string | null
  error_message: string | null
  generated_at: string | null
  approved_at: string | null
  updated_at: string
}

export type ReviewDraft = {
  id: string
  lecture_id: string
  revision: number
  status: 'draft' | 'needs_changes' | 'approved' | 'superseded' | 'rejected'
  model: string | null
  content: ArtifactDraftContent
  feedback: string | null
  created_at: string
  updated_at: string
  approved_at: string | null
  pptx_path?: string | null
  pdf_path?: string | null
  artifacts_built_at?: string | null
}

type LectureSummary = {
  id: string
  title: string
  year: number
  module: string
  system: string
}

type Props = {
  draft: ReviewDraft
  lecture?: LectureSummary
  feedback: string
  setFeedback: (value: string) => void
  saving: boolean
  onClose: () => void
  onRevise: () => void
  onApproved: () => void | Promise<void>
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Could not read image'))
    reader.readAsDataURL(blob)
  })
}

export default function LectureDraftReview({
  draft,
  lecture,
  feedback,
  setFeedback,
  saving,
  onClose,
  onRevise,
  onApproved,
}: Props) {
  const [visuals, setVisuals] = useState<Map<number, VisualRow>>(new Map())
  const [visualData, setVisualData] = useState<VisualDataMap>(new Map())
  const [visualBusy, setVisualBusy] = useState<number | null>(null)
  const [batchVisualBusy, setBatchVisualBusy] = useState(false)
  const [artifactBusy, setArtifactBusy] = useState(false)
  const [approveBusy, setApproveBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pptxPath, setPptxPath] = useState(draft.pptx_path || '')
  const [pdfPath, setPdfPath] = useState(draft.pdf_path || '')
  const [artifactsBuiltAt, setArtifactsBuiltAt] = useState(draft.artifacts_built_at || '')

  const slides = draft.content?.slides || []
  const requiredVisualSlides = useMemo(
    () => slides
      .map((slide, index) => ({ slide, slideNumber: Number(slide.slide_number || index + 1) }))
      .filter(({ slide }) => Boolean(slide.visual_required)),
    [slides]
  )

  const loadVisuals = async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('lecture_draft_visuals')
      .select('id, draft_id, lecture_id, slide_number, status, prompt, storage_path, model, quality, error_message, generated_at, approved_at, updated_at')
      .eq('draft_id', draft.id)
      .order('slide_number', { ascending: true })

    if (error) {
      setMessage(error.message)
      return
    }

    const rows = (data || []) as VisualRow[]
    const map = new Map<number, VisualRow>()
    rows.forEach((row) => map.set(Number(row.slide_number), row))
    setVisuals(map)

    const loaded = new Map<number, string>()
    await Promise.all(rows.filter((row) => Boolean(row.storage_path)).map(async (row) => {
      const { data: blob, error: downloadError } = await supabase!.storage
        .from('kifaro-content')
        .download(row.storage_path!)
      if (!downloadError && blob) {
        try {
          loaded.set(Number(row.slide_number), await blobToDataUrl(blob))
        } catch {
          // Keep the metadata visible even if the preview cannot be decoded.
        }
      }
    }))
    setVisualData(loaded)
  }

  useEffect(() => {
    setMessage('')
    setPptxPath(draft.pptx_path || '')
    setPdfPath(draft.pdf_path || '')
    setArtifactsBuiltAt(draft.artifacts_built_at || '')
    void loadVisuals()
  }, [draft.id])

  const approvedVisualCount = requiredVisualSlides.filter(({ slideNumber }) => visuals.get(slideNumber)?.status === 'approved').length
  const allVisualsApproved = requiredVisualSlides.length === 0 || approvedVisualCount === requiredVisualSlides.length
  const artifactsReady = Boolean(pptxPath && pdfPath)

  const generateVisual = async (slideNumber: number) => {
    if (!supabase) return
    setVisualBusy(slideNumber)
    setMessage('Generating anatomy visual for slide ' + slideNumber + '…')
    const { data, error } = await supabase.functions.invoke('lecture-content-generator', {
      body: { action: 'generate_visual', draftId: draft.id, slideNumber },
    })
    setVisualBusy(null)

    if (error || data?.error) {
      setMessage(data?.error || error?.message || 'Could not generate this visual.')
      return
    }

    setPptxPath('')
    setPdfPath('')
    setArtifactsBuiltAt('')
    setMessage('Visual generated. Review it before approval.')
    await loadVisuals()
  }

  const generateAllVisuals = async () => {
    if (!supabase || !requiredVisualSlides.length) return
    const pending = requiredVisualSlides.filter(({ slideNumber }) => visuals.get(slideNumber)?.status !== 'approved')
    if (!pending.length) {
      setMessage('All required visuals are already approved.')
      return
    }

    setBatchVisualBusy(true)
    setMessage('Generating ' + pending.length + ' required anatomy visuals…')

    try {
      for (let index = 0; index < pending.length; index += 1) {
        const slideNumber = pending[index].slideNumber
        setVisualBusy(slideNumber)
        setMessage('Generating visual ' + (index + 1) + ' of ' + pending.length + ' · slide ' + slideNumber + '…')
        const { data, error } = await supabase.functions.invoke('lecture-content-generator', {
          body: { action: 'generate_visual', draftId: draft.id, slideNumber },
        })
        if (error || data?.error) throw new Error(data?.error || error?.message || 'Could not generate slide ' + slideNumber + ' visual.')
      }

      setPptxPath('')
      setPdfPath('')
      setArtifactsBuiltAt('')
      setMessage('All requested visuals were generated. Review and approve each image.')
      await loadVisuals()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Visual generation stopped because of an error.')
      await loadVisuals()
    } finally {
      setVisualBusy(null)
      setBatchVisualBusy(false)
    }
  }

  const approveVisual = async (visual: VisualRow) => {
    if (!supabase) return
    setVisualBusy(visual.slide_number)
    setMessage('Approving slide ' + visual.slide_number + ' visual…')
    const { data, error } = await supabase.functions.invoke('lecture-content-generator', {
      body: { action: 'approve_visual', visualId: visual.id },
    })
    setVisualBusy(null)

    if (error || data?.error) {
      setMessage(data?.error || error?.message || 'Could not approve this visual.')
      return
    }

    setMessage('Visual approved.')
    await loadVisuals()
  }

  const buildArtifacts = async () => {
    if (!supabase) return
    if (!allVisualsApproved) {
      setMessage('Approve every required visual before building PPTX/PDF.')
      return
    }

    setArtifactBusy(true)
    setMessage('Building AnatoMate PPTX and PDF preview…')

    try {
      const pptxBlob = await buildLecturePptx(draft.content, visualData)
      const pdfBlob = buildLecturePdf(draft.content, visualData)
      const pptxName = safeLectureFileName(draft.content?.lecture_title || lecture?.title || draft.lecture_id, draft.revision, 'pptx')
      const pdfName = safeLectureFileName(draft.content?.lecture_title || lecture?.title || draft.lecture_id, draft.revision, 'pdf')
      const base = 'drafts/' + draft.id + '/artifacts'
      const nextPptxPath = base + '/' + pptxName
      const nextPdfPath = base + '/' + pdfName

      const [pptxUpload, pdfUpload] = await Promise.all([
        supabase.storage.from('kifaro-content').upload(nextPptxPath, pptxBlob, {
          contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          cacheControl: '3600',
          upsert: true,
        }),
        supabase.storage.from('kifaro-content').upload(nextPdfPath, pdfBlob, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: true,
        }),
      ])

      if (pptxUpload.error) throw pptxUpload.error
      if (pdfUpload.error) throw pdfUpload.error

      const builtAt = new Date().toISOString()
      const { error: saveError } = await supabase
        .from('lecture_drafts')
        .update({
          pptx_path: nextPptxPath,
          pdf_path: nextPdfPath,
          artifacts_built_at: builtAt,
          updated_at: builtAt,
        })
        .eq('id', draft.id)

      if (saveError) throw saveError

      setPptxPath(nextPptxPath)
      setPdfPath(nextPdfPath)
      setArtifactsBuiltAt(builtAt)
      setMessage('PPTX and PDF preview built. You can now give final approval.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not build lecture files.')
    } finally {
      setArtifactBusy(false)
    }
  }

  const openArtifact = async (path: string, fileName: string, openInNewTab = false) => {
    if (!supabase || !path) return
    setMessage('Opening generated file…')
    const { data: blob, error } = await supabase.storage.from('kifaro-content').download(path)
    if (error || !blob) {
      setMessage(error?.message || 'Could not open generated file.')
      return
    }

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = openInNewTab ? '' : fileName
    if (openInNewTab) {
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
    }
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    setMessage('')
  }

  const approveDraft = async () => {
    if (!supabase) return
    if (!allVisualsApproved) {
      setMessage('Approve every required visual first.')
      return
    }
    if (!artifactsReady) {
      setMessage('Build the PPTX and PDF preview before final approval.')
      return
    }

    setApproveBusy(true)
    setMessage('Applying final approval…')
    const { data, error } = await supabase.functions.invoke('lecture-content-generator', {
      body: { action: 'approve', draftId: draft.id },
    })
    setApproveBusy(false)

    if (error || data?.error) {
      const missing = Array.isArray(data?.missingVisualSlides) ? ' Missing slides: ' + data.missingVisualSlides.join(', ') + '.' : ''
      setMessage((data?.error || error?.message || 'Could not approve this lecture.') + missing)
      return
    }

    setMessage('Approved. The final PPTX/PDF are attached and publishing is unlocked.')
    await onApproved()
  }

  return (
    <div className="draftmodalbackdrop" onClick={onClose}>
      <section className="draftmodal" onClick={(event) => event.stopPropagation()}>
        <div className="draftmodalhead">
          <div>
            <span className="eyebrow">AI LECTURE REVIEW</span>
            <h2>{draft.content?.lecture_title || lecture?.title || draft.lecture_id}</h2>
            <p>Revision {draft.revision} · {slides.length} slides · {draft.model || 'AI model'} · Nothing is visible to students until you publish.</p>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X/></button>
        </div>

        <div className="draftsummary">
          <div><small>SLIDES</small><strong>{slides.length}</strong></div>
          <div><small>VISUALS</small><strong>{approvedVisualCount}/{requiredVisualSlides.length}</strong></div>
          <div><small>MCQs</small><strong>{draft.content?.mcqs?.length || 0}</strong></div>
          <div><small>CASES</small><strong>{draft.content?.cases?.length || 0}</strong></div>
          <div><small>OSCE</small><strong>{draft.content?.osce?.length || 0}</strong></div>
        </div>

        {requiredVisualSlides.length > 0 && (
          <div className="draftbatchvisuals">
            <div><Sparkles size={18}/><span><strong>Visual production</strong><small>Generate all required images now, then approve them one by one.</small></span></div>
            <button className="secondary" disabled={batchVisualBusy || visualBusy !== null || saving} onClick={() => void generateAllVisuals()}>
              {batchVisualBusy ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>}
              {batchVisualBusy ? 'Generating visuals…' : 'Generate all missing visuals'}
            </button>
          </div>
        )}

        {message && <div className="adminmessage"><Sparkles size={16}/>{message}</div>}

        <div className="draftobjectives">
          <h3>Learning objectives</h3>
          <ul>{(draft.content?.learning_objectives || []).map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>

        <div className="draftslides">
          {slides.map((slide, index) => {
            const slideNumber = Number(slide.slide_number || index + 1)
            const visual = visuals.get(slideNumber)
            const preview = visualData.get(slideNumber)
            const busy = visualBusy === slideNumber
            return (
              <article key={index} className="draftslide">
                <div className="draftslidenumber">{slideNumber}</div>
                <div className="grow">
                  <small>{(slide.type || 'concept').replace(/_/g, ' ')}</small>
                  <h3>{slide.title || 'Untitled slide'}</h3>
                  {slide.subtitle && <p className="draftsubtitle">{slide.subtitle}</p>}
                  <ul>{(slide.body_points || []).map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}</ul>
                  {slide.highlight && <div className="drafthighlight">{slide.highlight}</div>}
                  {slide.clinical_application && <div className="draftclinical"><strong>Clinical:</strong> {slide.clinical_application}</div>}

                  {slide.visual_required && (
                    <div className="draftvisualreview">
                      <div className="draftvisualbrief">
                        <strong><ImageIcon size={15}/>Visual brief</strong>
                        <p>{slide.visual_brief || 'Visual required'}</p>
                        {slide.visual_labels?.length ? <span>Structures: {slide.visual_labels.join(' · ')}</span> : null}
                      </div>

                      {preview && (
                        <div className="draftvisualpreview">
                          <img src={preview} alt={'Generated anatomy visual for slide ' + slideNumber}/>
                          <span className={'visualreviewbadge ' + (visual?.status || 'pending')}>
                            {visual?.status === 'approved' ? <Check size={13}/> : null}
                            {(visual?.status || 'pending').replace(/_/g, ' ')}
                          </span>
                        </div>
                      )}

                      {visual?.error_message && <div className="visualerror">{visual.error_message}</div>}

                      <div className="draftvisualactions">
                        {!visual || visual.status === 'failed' || visual.status === 'pending' ? (
                          <button className="secondary" disabled={busy || batchVisualBusy || saving} onClick={() => void generateVisual(slideNumber)}>
                            {busy ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>}
                            {busy ? 'Generating…' : 'Generate visual'}
                          </button>
                        ) : (
                          <>
                            <button className="secondary" disabled={busy || batchVisualBusy || saving} onClick={() => void generateVisual(slideNumber)}>
                              {busy ? <LoaderCircle className="spin" size={16}/> : <RotateCcw size={16}/>}
                              {busy ? 'Generating…' : 'Regenerate'}
                            </button>
                            {visual.status === 'needs_review' && (
                              <button className="primary" disabled={busy || batchVisualBusy || saving} onClick={() => void approveVisual(visual)}>
                                <CheckCircle2 size={16}/>Approve visual
                              </button>
                            )}
                            {visual.status === 'approved' && <span className="visualapproved"><CheckCircle2 size={16}/>Visual approved</span>}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {slide.source_tags?.length ? <div className="draftsources">{slide.source_tags.join(' · ')}</div> : null}
                </div>
              </article>
            )
          })}
        </div>

        <section className="artifactreview">
          <div>
            <Presentation size={20}/>
            <span>
              <strong>PPTX + PDF preview</strong>
              <small>{artifactsReady ? 'Built ' + (artifactsBuiltAt ? new Date(artifactsBuiltAt).toLocaleString() : '') : 'Build after all required visuals are approved.'}</small>
            </span>
          </div>
          <div className="artifactstatus">
            {pptxPath
              ? <button className="ready" onClick={() => void openArtifact(pptxPath, safeLectureFileName(draft.content?.lecture_title || lecture?.title || draft.lecture_id, draft.revision, 'pptx'))}><Presentation size={14}/>Download PPTX</button>
              : <span><Presentation size={14}/>PPTX pending</span>}
            {pdfPath
              ? <button className="ready" onClick={() => void openArtifact(pdfPath, safeLectureFileName(draft.content?.lecture_title || lecture?.title || draft.lecture_id, draft.revision, 'pdf'), true)}><FileText size={14}/>Open PDF</button>
              : <span><FileText size={14}/>PDF pending</span>}
          </div>
          <button className="secondary" disabled={!allVisualsApproved || artifactBusy || saving} onClick={() => void buildArtifacts()}>
            {artifactBusy ? <LoaderCircle className="spin" size={16}/> : <Presentation size={16}/>}
            {artifactBusy ? 'Building files…' : artifactsReady ? 'Rebuild PPTX/PDF' : 'Build PPTX/PDF'}
          </button>
        </section>

        <div className="draftreviewbox">
          <label>
            Requested changes
            <textarea
              rows={4}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Example: reduce the first 5 slides, add more clinical anatomy of the axilla, replace the brachial plexus case, and simplify slide 18."
            />
          </label>
          <div>
            <button className="secondary" disabled={!lecture || !feedback.trim() || saving || visualBusy !== null || batchVisualBusy || artifactBusy || approveBusy} onClick={onRevise}>
              <RotateCcw size={17}/>Generate revised version
            </button>
            <button className="primary" disabled={!allVisualsApproved || !artifactsReady || saving || visualBusy !== null || batchVisualBusy || artifactBusy || approveBusy || draft.status === 'approved'} onClick={() => void approveDraft()}>
              {approveBusy ? <LoaderCircle className="spin" size={17}/> : <ThumbsUp size={17}/>}
              {draft.status === 'approved' ? 'Approved' : approveBusy ? 'Approving…' : 'Final approval'}
            </button>
          </div>
          <p>Final approval attaches the reviewed PPTX/PDF to the lecture. Publishing still requires a separate Publish action.</p>
        </div>
      </section>
    </div>
  )
}
