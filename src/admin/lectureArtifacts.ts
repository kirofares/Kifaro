import pptxgen from 'pptxgenjs'
import { jsPDF } from 'jspdf'

export type ArtifactSlide = {
  slide_number?: number
  type?: string
  title?: string
  subtitle?: string
  body_points?: string[]
  highlight?: string
  clinical_application?: string
  visual_required?: boolean
  visual_brief?: string
  visual_labels?: string[]
  source_tags?: string[]
  speaker_notes?: string
}

export type ArtifactDraftContent = {
  lecture_title?: string
  academic_year?: number
  module?: string
  system?: string
  estimated_minutes?: number
  learning_objectives?: string[]
  slides?: ArtifactSlide[]
  active_recall?: string[]
  mcqs?: Array<Record<string, unknown>>
  cases?: Array<Record<string, unknown>>
  osce?: Array<Record<string, unknown>>
  exam_pearls?: string[]
  key_takeaways?: string[]
  qa_checklist?: string[]
}

export type VisualDataMap = Map<number, string>

const C = {
  primary: '21B5EB',
  deep: '0D70B8',
  text: '123658',
  muted: '5C7589',
  soft: 'E7F6FD',
  white: 'FFFFFF',
  line: 'D7E8F1',
  clinical: 'EAF7F0',
  clinicalText: '28694B',
  warm: 'FFF6E4',
  warmText: '7B5A17',
}

const PX = {
  width: 13.333,
  height: 7.5,
}

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function addWatermark(slide: any, pptx: any) {
  slide.addText('Dr. Kirolus Fares', {
    x: 2.0, y: 3.0, w: 9.4, h: 0.8,
    fontFace: 'Aptos',
    fontSize: 25,
    bold: true,
    color: 'CDE7F3',
    transparency: 76,
    align: 'center',
    rotate: 340,
    margin: 0,
  })
  slide.addText('AnatoMate by KIFARO', {
    x: 0.55, y: 7.08, w: 2.8, h: 0.18,
    fontFace: 'Aptos',
    fontSize: 7.5,
    bold: true,
    color: C.muted,
    margin: 0,
  })
  slide.addText(String(slide._slideNum || ''), {
    x: 12.3, y: 7.06, w: 0.45, h: 0.18,
    fontFace: 'Aptos',
    fontSize: 7,
    color: C.muted,
    align: 'right',
    margin: 0,
  })
  void pptx
}

function addTopTitle(slide: any, title: string, subtitle?: string) {
  slide.addShape('rect', { x: 0, y: 0, w: PX.width, h: 0.12, line: { color: C.primary, transparency: 100 }, fill: { color: C.primary } })
  slide.addText(title || 'AnatoMate', {
    x: 0.7, y: 0.42, w: 11.95, h: 0.48,
    fontFace: 'Aptos',
    fontSize: 24,
    bold: true,
    color: C.text,
    margin: 0,
    breakLine: false,
    fit: 'shrink',
  })
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.72, y: 0.94, w: 11.7, h: 0.26,
      fontFace: 'Aptos',
      fontSize: 10,
      color: C.muted,
      margin: 0,
      fit: 'shrink',
    })
  }
}

function addSourceLine(slide: any, sources?: string[]) {
  const sourceText = (sources || []).filter(Boolean).join(' · ')
  if (!sourceText) return
  slide.addText(sourceText, {
    x: 3.2, y: 7.05, w: 8.7, h: 0.18,
    fontFace: 'Aptos',
    fontSize: 6.5,
    italic: true,
    color: '7B91A3',
    align: 'right',
    margin: 0,
    fit: 'shrink',
  })
}

function addBodyPoints(slide: any, points: string[], x: number, y: number, w: number, h: number, fontSize = 17) {
  const rows = points.filter(Boolean).slice(0, 8).map((point) => '• ' + cleanText(point)).join('\n')
  if (!rows) return
  slide.addText(rows, {
    x, y, w, h,
    fontFace: 'Aptos',
    fontSize,
    color: C.text,
    breakLine: false,
    valign: 'mid',
    margin: 0.08,
    paraSpaceAfterPt: 9,
    breakLineOnOverflow: false,
    fit: 'shrink',
  })
}

function addCallout(slide: any, label: string, text: string, x: number, y: number, w: number, h: number, kind: 'clinical' | 'highlight') {
  if (!text) return
  const fill = kind === 'clinical' ? C.clinical : C.soft
  const textColor = kind === 'clinical' ? C.clinicalText : C.deep
  slide.addShape('roundRect', {
    x, y, w, h,
    rectRadius: 0.08,
    line: { color: kind === 'clinical' ? 'CBE7D8' : 'C6E9F7', width: 1 },
    fill: { color: fill },
  })
  slide.addText(label.toUpperCase(), {
    x: x + 0.18, y: y + 0.11, w: w - 0.36, h: 0.18,
    fontFace: 'Aptos',
    fontSize: 8,
    bold: true,
    color: textColor,
    charSpacing: 0.7,
    margin: 0,
  })
  slide.addText(cleanText(text), {
    x: x + 0.18, y: y + 0.33, w: w - 0.36, h: h - 0.42,
    fontFace: 'Aptos',
    fontSize: 11.5,
    color: textColor,
    margin: 0,
    fit: 'shrink',
    valign: 'mid',
  })
}

function addGeneratedImage(slide: any, dataUrl: string, x: number, y: number, w: number, h: number) {
  slide.addShape('roundRect', {
    x: x - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06,
    line: { color: 'CBE4EF', width: 1 },
    fill: { color: 'F9FCFE' },
  })
  slide.addImage({ data: dataUrl, x, y, w, h })
}

function addVisualLabels(slide: any, labels: string[], x: number, y: number, w: number, h: number) {
  const clean = labels.filter(Boolean).slice(0, 9)
  if (!clean.length) return
  slide.addShape('roundRect', {
    x, y, w, h,
    line: { color: 'D6EAF3', width: 1 },
    fill: { color: 'F7FBFD' },
  })
  slide.addText('STRUCTURES TO IDENTIFY', {
    x: x + 0.14, y: y + 0.1, w: w - 0.28, h: 0.18,
    fontFace: 'Aptos', fontSize: 7.5, bold: true, color: C.deep, margin: 0,
  })
  slide.addText(clean.map((label) => '• ' + cleanText(label)).join('\n'), {
    x: x + 0.14, y: y + 0.34, w: w - 0.28, h: h - 0.43,
    fontFace: 'Aptos', fontSize: 9.5, color: C.text, margin: 0, fit: 'shrink',
  })
}

function addContentSlide(pptx: any, item: ArtifactSlide, index: number, visualData?: string) {
  const slide = pptx.addSlide()
  slide.background = { color: C.white }
  const type = item.type || 'concept'
  const subtitle = type === 'clinical_bridge' ? 'Clinical Bridge' : type === 'quick_check' ? 'Quick Check' : type === 'exam_pearls' ? 'AnatoMate Exam Pearls' : undefined
  addTopTitle(slide, cleanText(item.title) || 'AnatoMate', cleanText(item.subtitle) || subtitle)
  addWatermark(slide, pptx)

  const hasImage = Boolean(visualData)
  if (hasImage) {
    addGeneratedImage(slide, visualData!, 0.7, 1.38, 6.0, 4.35)
    addBodyPoints(slide, item.body_points || [], 7.05, 1.38, 5.55, 3.5, 15.5)
    addVisualLabels(slide, item.visual_labels || [], 0.7, 5.88, 6.0, 0.82)
    if (item.highlight) addCallout(slide, 'High-yield', cleanText(item.highlight), 7.05, 5.02, 5.55, 0.72, 'highlight')
    if (item.clinical_application) addCallout(slide, 'Clinical application', cleanText(item.clinical_application), 7.05, 5.82, 5.55, 0.86, 'clinical')
  } else {
    addBodyPoints(slide, item.body_points || [], 0.85, 1.5, 11.6, item.clinical_application || item.highlight ? 3.7 : 4.75, 18)
    if (item.highlight) addCallout(slide, 'High-yield', cleanText(item.highlight), 0.85, 5.28, 5.55, 0.98, 'highlight')
    if (item.clinical_application) addCallout(slide, 'Clinical application', cleanText(item.clinical_application), 6.65, 5.28, 5.8, 0.98, 'clinical')
  }

  addSourceLine(slide, item.source_tags)
  if (item.speaker_notes) slide.addNotes(cleanText(item.speaker_notes))
  slide.addText(String(index + 1), {
    x: 12.45, y: 7.06, w: 0.3, h: 0.16,
    fontFace: 'Aptos', fontSize: 7, color: C.muted, align: 'right', margin: 0,
  })
}

function addCover(pptx: any, content: ArtifactDraftContent) {
  const slide = pptx.addSlide()
  slide.background = { color: C.primary }
  slide.addShape('rect', { x: 0, y: 0, w: PX.width, h: PX.height, line: { color: C.primary, transparency: 100 }, fill: { color: C.primary } })
  slide.addShape('rect', { x: 0, y: 0, w: 0.18, h: PX.height, line: { color: C.deep, transparency: 100 }, fill: { color: C.deep } })
  slide.addText('AnatoMate', {
    x: 0.85, y: 0.65, w: 3.1, h: 0.5,
    fontFace: 'Aptos', fontSize: 27, bold: true, color: C.white, margin: 0,
  })
  slide.addText('by KIFARO', {
    x: 0.88, y: 1.14, w: 1.7, h: 0.25,
    fontFace: 'Aptos', fontSize: 10, bold: true, color: 'DDF4FC', margin: 0,
  })
  slide.addText(cleanText(content.lecture_title) || 'Anatomy Lecture', {
    x: 0.85, y: 2.15, w: 11.4, h: 1.5,
    fontFace: 'Aptos', fontSize: 34, bold: true, color: C.white, margin: 0, fit: 'shrink',
  })
  slide.addText([content.module, content.system].filter(Boolean).join(' · '), {
    x: 0.88, y: 3.82, w: 10.8, h: 0.38,
    fontFace: 'Aptos', fontSize: 15, color: 'E8F7FD', margin: 0, fit: 'shrink',
  })
  slide.addText('Year ' + String(content.academic_year || '') + (content.estimated_minutes ? ' · ' + content.estimated_minutes + ' min' : ''), {
    x: 0.88, y: 4.35, w: 4.0, h: 0.34,
    fontFace: 'Aptos', fontSize: 12, bold: true, color: C.white, margin: 0,
  })
  slide.addText('Dr. Kirolus Fares', {
    x: 0.88, y: 6.35, w: 3.5, h: 0.35,
    fontFace: 'Aptos', fontSize: 14, bold: true, color: C.white, margin: 0,
  })
  slide.addText('Anatomy • Clinical relevance • Active recall', {
    x: 0.88, y: 6.76, w: 5.8, h: 0.25,
    fontFace: 'Aptos', fontSize: 9, color: 'DDF4FC', margin: 0,
  })
  slide.addText('Dr. Kirolus Fares', {
    x: 5.15, y: 3.05, w: 7.0, h: 0.8,
    fontFace: 'Aptos', fontSize: 24, bold: true, color: C.white, transparency: 88, rotate: 340, align: 'center', margin: 0,
  })
}

function addObjectives(pptx: any, objectives: string[]) {
  const slide = pptx.addSlide()
  slide.background = { color: C.white }
  addTopTitle(slide, 'Learning Objectives', 'By the end of this lecture, you should be able to…')
  addWatermark(slide, pptx)
  const items = objectives.filter(Boolean).slice(0, 7)
  items.forEach((objective, index) => {
    const y = 1.45 + index * 0.72
    slide.addShape('ellipse', {
      x: 0.9, y, w: 0.44, h: 0.44,
      line: { color: C.primary, width: 1 },
      fill: { color: C.primary },
    })
    slide.addText(String(index + 1), {
      x: 0.9, y: y + 0.06, w: 0.44, h: 0.24,
      fontFace: 'Aptos', fontSize: 10.5, bold: true, color: C.white, align: 'center', margin: 0,
    })
    slide.addText(cleanText(objective), {
      x: 1.55, y: y - 0.02, w: 10.8, h: 0.52,
      fontFace: 'Aptos', fontSize: 15, color: C.text, margin: 0, valign: 'mid', fit: 'shrink',
    })
  })
}

function addEndingSlide(pptx: any, title: string, items: string[], kind: 'pearls' | 'summary') {
  const slide = pptx.addSlide()
  slide.background = { color: kind === 'pearls' ? C.soft : C.white }
  addTopTitle(slide, title)
  addWatermark(slide, pptx)
  const clean = items.filter(Boolean).slice(0, 10)
  addBodyPoints(slide, clean, 0.95, 1.45, 11.4, 4.9, 18)
  slide.addShape('roundRect', {
    x: 0.95, y: 6.32, w: 11.4, h: 0.48,
    line: { color: C.primary, width: 1 },
    fill: { color: kind === 'pearls' ? C.white : C.soft },
  })
  slide.addText(kind === 'pearls' ? 'Exam rule: understand the relationship before memorizing the label.' : 'Close the slides and reconstruct the anatomical map from memory.', {
    x: 1.2, y: 6.45, w: 10.9, h: 0.18,
    fontFace: 'Aptos', fontSize: 9.5, bold: true, color: C.deep, align: 'center', margin: 0,
  })
}

export async function buildLecturePptx(content: ArtifactDraftContent, visualData: VisualDataMap) {
  const pptx: any = new (pptxgen as any)()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'Dr. Kirolus Fares'
  pptx.company = 'KIFARO'
  pptx.subject = 'AnatoMate anatomy lecture'
  pptx.title = cleanText(content.lecture_title) || 'AnatoMate Lecture'
  pptx.lang = 'en-US'
  pptx.theme = {
    headFontFace: 'Aptos',
    bodyFontFace: 'Aptos',
    lang: 'en-US',
  }

  addCover(pptx, content)
  addObjectives(pptx, content.learning_objectives || [])

  const slides = content.slides || []
  const contentSlides = slides.filter((slide, index) => {
    const type = slide.type || ''
    if (index === 0 && type === 'cover') return false
    if (type === 'objectives') return false
    if (type === 'exam_pearls' || type === 'summary') return false
    return true
  })

  contentSlides.forEach((item, index) => {
    const slideNumber = Number(item.slide_number || index + 1)
    addContentSlide(pptx, item, index + 2, visualData.get(slideNumber))
  })

  const pearls = content.exam_pearls || slides.find((slide) => slide.type === 'exam_pearls')?.body_points || []
  if (pearls.length) addEndingSlide(pptx, 'AnatoMate Exam Pearls', pearls, 'pearls')

  const takeaways = content.key_takeaways || slides.find((slide) => slide.type === 'summary')?.body_points || []
  if (takeaways.length) addEndingSlide(pptx, 'Key Takeaways', takeaways, 'summary')

  const result = await pptx.write({ outputType: 'blob', compression: true })
  return result as Blob
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ] as [number, number, number]
}

function pdfText(doc: any, text: string, x: number, y: number, maxWidth: number, fontSize: number, color: string, bold = false) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(fontSize)
  doc.setTextColor(...hexToRgb(color))
  const rows = doc.splitTextToSize(cleanText(text), maxWidth)
  doc.text(rows, x, y)
  return rows.length
}

function addPdfWatermark(doc: any) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(25)
  doc.setTextColor(220, 237, 245)
  doc.text('Dr. Kirolus Fares', 360, 220, { align: 'center', angle: 20 })
  doc.setFontSize(7)
  doc.setTextColor(...hexToRgb(C.muted))
  doc.text('AnatoMate by KIFARO', 28, 390)
}

function addPdfHeader(doc: any, title: string, subtitle?: string) {
  doc.setFillColor(...hexToRgb(C.primary))
  doc.rect(0, 0, 720, 7, 'F')
  pdfText(doc, title, 38, 44, 645, 21, C.text, true)
  if (subtitle) pdfText(doc, subtitle, 39, 62, 620, 9, C.muted)
}

export function buildLecturePdf(content: ArtifactDraftContent, visualData: VisualDataMap) {
  const doc: any = new (jsPDF as any)({ orientation: 'landscape', unit: 'pt', format: [720, 405], compress: true })
  doc.setProperties({
    title: cleanText(content.lecture_title) || 'AnatoMate Lecture',
    subject: 'AnatoMate anatomy lecture',
    author: 'Dr. Kirolus Fares',
    creator: 'KIFARO',
  })

  doc.setFillColor(...hexToRgb(C.primary))
  doc.rect(0, 0, 720, 405, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('AnatoMate', 48, 52)
  doc.setFontSize(9)
  doc.text('by KIFARO', 49, 70)
  pdfText(doc, cleanText(content.lecture_title) || 'Anatomy Lecture', 48, 150, 610, 29, C.white, true)
  pdfText(doc, [content.module, content.system].filter(Boolean).join(' · '), 49, 220, 590, 11, 'E8F7FD')
  pdfText(doc, 'Year ' + String(content.academic_year || '') + (content.estimated_minutes ? ' · ' + content.estimated_minutes + ' min' : ''), 49, 250, 300, 10, C.white, true)
  pdfText(doc, 'Dr. Kirolus Fares', 49, 354, 250, 11, C.white, true)

  doc.addPage([720, 405], 'landscape')
  addPdfHeader(doc, 'Learning Objectives', 'By the end of this lecture, you should be able to…')
  addPdfWatermark(doc)
  let oy = 98
  ;(content.learning_objectives || []).filter(Boolean).slice(0, 7).forEach((objective, index) => {
    doc.setFillColor(...hexToRgb(C.primary))
    doc.circle(48, oy - 5, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(String(index + 1), 48, oy - 2, { align: 'center' })
    const lines = pdfText(doc, objective, 72, oy, 600, 11.5, C.text)
    oy += Math.max(39, lines * 13 + 12)
  })

  const slides = (content.slides || []).filter((slide, index) => {
    const type = slide.type || ''
    return !(index === 0 && type === 'cover') && type !== 'objectives' && type !== 'exam_pearls' && type !== 'summary'
  })

  slides.forEach((slide, index) => {
    doc.addPage([720, 405], 'landscape')
    addPdfHeader(doc, cleanText(slide.title) || 'AnatoMate', cleanText(slide.subtitle))
    addPdfWatermark(doc)
    const slideNumber = Number(slide.slide_number || index + 1)
    const image = visualData.get(slideNumber)

    if (image) {
      doc.setDrawColor(...hexToRgb(C.line))
      doc.roundedRect(36, 78, 326, 238, 6, 6, 'S')
      doc.addImage(image, 'PNG', 39, 81, 320, 232, undefined, 'FAST')
      let y = 95
      for (const point of (slide.body_points || []).filter(Boolean).slice(0, 7)) {
        const lines = pdfText(doc, '• ' + point, 390, y, 286, 10.4, C.text)
        y += lines * 11.5 + 8
      }
      if (slide.visual_labels?.length) {
        doc.setFillColor(247, 251, 253)
        doc.roundedRect(36, 326, 326, 46, 6, 6, 'F')
        pdfText(doc, 'Structures: ' + slide.visual_labels.slice(0, 8).join(' · '), 48, 345, 302, 7.5, C.deep, true)
      }
    } else {
      let y = 102
      for (const point of (slide.body_points || []).filter(Boolean).slice(0, 8)) {
        const lines = pdfText(doc, '• ' + point, 48, y, 620, 12.2, C.text)
        y += lines * 14 + 9
      }
    }

    if (slide.clinical_application) {
      doc.setFillColor(...hexToRgb(C.clinical))
      doc.roundedRect(image ? 390 : 48, 320, image ? 286 : 620, 48, 6, 6, 'F')
      pdfText(doc, 'CLINICAL  ' + slide.clinical_application, image ? 402 : 60, 340, image ? 260 : 595, 8.2, C.clinicalText, true)
    } else if (slide.highlight) {
      doc.setFillColor(...hexToRgb(C.soft))
      doc.roundedRect(image ? 390 : 48, 320, image ? 286 : 620, 48, 6, 6, 'F')
      pdfText(doc, 'HIGH-YIELD  ' + slide.highlight, image ? 402 : 60, 340, image ? 260 : 595, 8.2, C.deep, true)
    }

    if (slide.source_tags?.length) {
      pdfText(doc, slide.source_tags.join(' · '), 375, 391, 305, 6.2, '7B91A3')
    }
  })

  const endings: Array<{title: string; items: string[]}> = [
    { title: 'AnatoMate Exam Pearls', items: content.exam_pearls || [] },
    { title: 'Key Takeaways', items: content.key_takeaways || [] },
  ]
  for (const ending of endings) {
    if (!ending.items.length) continue
    doc.addPage([720, 405], 'landscape')
    addPdfHeader(doc, ending.title)
    addPdfWatermark(doc)
    let y = 98
    for (const point of ending.items.filter(Boolean).slice(0, 10)) {
      const lines = pdfText(doc, '• ' + point, 48, y, 620, 12, C.text)
      y += lines * 14 + 8
    }
  }

  return doc.output('blob') as Blob
}

export function safeLectureFileName(title: string, revision: number, extension: 'pptx' | 'pdf') {
  const safe = cleanText(title)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'AnatoMate-Lecture'
  return safe + '-Revision-' + revision + '.' + extension
}
