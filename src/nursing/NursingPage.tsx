import { ArrowLeft, BookOpen, Check, ChevronRight, HeartPulse, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useAdmin } from '../hooks/useAdmin'
import { useStudentYear } from '../hooks/useStudentYear'
import { useTr } from '../i18n'
import { supabase } from '../lib/supabase'

// A single Nursing Anatomy course. This is KIFARO's proposed 23-lecture sequence,
// not a verified reproduction of a university syllabus.
// Lecture resource links must only be enabled after their actual files are hosted and reviewed.
const NURSING_LECTURES = [
  ['Anatomical Terminology, Body Regions & Cavities', 'مصطلحات الجسم والمناطق والتجاويف'],
  ['Skin, Fascia & Body Tissues', 'الجلد والأنسجة واللفافات'],
  ['Bones & the Skeletal System', 'العظام والجهاز الهيكلي'],
  ['Joints & Muscular System', 'المفاصل والجهاز العضلي'],
  ['Upper Limb: Bones & Joints', 'الطرف العلوي: العظام والمفاصل'],
  ['Upper Limb: Muscles, Vessels & Nerves', 'الطرف العلوي: العضلات والأوعية والأعصاب'],
  ['Lower Limb: Bones & Joints', 'الطرف السفلي: العظام والمفاصل'],
  ['Lower Limb: Muscles, Vessels & Nerves', 'الطرف السفلي: العضلات والأوعية والأعصاب'],
  ['Thoracic Wall, Pleura & Diaphragm', 'جدار الصدر والجنبة والحجاب الحاجز'],
  ['Heart & Great Vessels', 'القلب والأوعية الدموية الكبرى'],
  ['Arterial, Venous & Lymphatic Systems', 'الجهاز الشرياني والوريدي واللمفاوي'],
  ['Respiratory Tract & Lungs', 'الجهاز التنفسي والرئتان'],
  ['Digestive Tract I: Mouth to Stomach', 'الجهاز الهضمي ١: من الفم إلى المعدة'],
  ['Digestive Tract II: Intestines & Peritoneum', 'الجهاز الهضمي ٢: الأمعاء والبريتون'],
  ['Liver, Gallbladder & Pancreas', 'الكبد والمرارة والبنكرياس'],
  ['Urinary System', 'الجهاز البولي'],
  ['Pelvis & Reproductive Systems', 'الحوض والأجهزة التناسلية'],
  ['Brain & Cranial Nerves', 'المخ والأعصاب القحفية'],
  ['Spinal Cord, Meninges & Peripheral Nerves', 'الحبل الشوكي والسحايا والأعصاب الطرفية'],
  ['Autonomic Nervous System', 'الجهاز العصبي الذاتي'],
  ['Head, Neck & Special Senses', 'الرأس والعنق والحواس الخاصة'],
  ['Endocrine System', 'جهاز الغدد الصماء'],
  ['Applied Anatomy for Nursing & Practical Review', 'التشريح التطبيقي للتمريض والمراجعة العملية'],
] as const

type NursingFileKind = 'visual_pdf' | 'visual_pptx' | 'workbook_pdf' | 'workbook_docx'
type NursingFileRecord = {
  lecture_id: string
  file_kind: NursingFileKind
  original_name: string
  storage_path: string
}
const NURSING_FILE_KINDS: { kind: NursingFileKind; label: string; accept: string; ext: string }[] = [
  { kind: 'visual_pdf', label: 'عرض المحاضرة PDF', accept: '.pdf,application/pdf', ext: 'pdf' },
  { kind: 'visual_pptx', label: 'عرض المحاضرة PowerPoint', accept: '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' },
  { kind: 'workbook_pdf', label: 'كراسة المراجعة PDF', accept: '.pdf,application/pdf', ext: 'pdf' },
  { kind: 'workbook_docx', label: 'كراسة المراجعة Word', accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
]

function NursingAdminUploadPanel({ year, moduleSlug, lectures, userId }: {
  year: number
  moduleSlug: string
  lectures: typeof NURSING_LECTURES
  userId: string
}) {
  const [records, setRecords] = useState<NursingFileRecord[]>([])
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const lectureId = (index: number) => `nursing-y${year}-${moduleSlug}-${String(index + 1).padStart(2, '0')}`

  const refresh = async () => {
    if (!supabase) return
    const ids = lectures.map((_, i) => lectureId(i))
    const { data, error } = await supabase.from('nursing_lecture_files')
      .select('lecture_id,file_kind,original_name,storage_path')
      .in('lecture_id', ids)
    if (!error) setRecords((data || []) as NursingFileRecord[])
    else setNotice('تعذر قراءة حالة ملفات التمريض: ' + error.message)
  }

  useEffect(() => { void refresh() }, [year, moduleSlug, lectures.length])

  const uploadFile = async (index: number, kind: NursingFileKind, file?: File) => {
    if (!file || !supabase) return
    const type = NURSING_FILE_KINDS.find((item) => item.kind === kind)
    if (!type || !file.name.toLowerCase().endsWith('.' + type.ext)) {
      setNotice('نوع الملف غير صحيح. الرجاء اختيار ' + type?.ext.toUpperCase())
      return
    }
    if (file.size <= 0 || file.size > 50 * 1024 * 1024) {
      setNotice('حجم الملف يجب أن يكون أكبر من صفر ولا يزيد عن 50 ميجابايت.')
      return
    }

    const id = lectureId(index)
    const slot = id + ':' + kind
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
    const storagePath = `nursing/year-${year}/${moduleSlug}/lecture-${String(index + 1).padStart(2, '0')}/${kind}/${Date.now()}-${safeName}`
    setBusy(slot)
    setNotice('جارٍ رفع ' + file.name + ' إلى التخزين الخاص…')
    try {
      const { error: storageError } = await supabase.storage.from('kifaro-content')
        .upload(storagePath, file, { upsert: false, contentType: file.type || undefined })
      if (storageError) throw storageError
      const { error: recordError } = await supabase.from('nursing_lecture_files')
        .upsert({
          lecture_id: id,
          file_kind: kind,
          storage_path: storagePath,
          original_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
          uploaded_by: userId,
          uploaded_at: new Date().toISOString(),
        }, { onConflict: 'lecture_id,file_kind' })
      if (recordError) throw recordError
      await refresh()
      setNotice('تم حفظ ' + file.name + ' في التخزين الخاص بنجاح. النشر للطلبة يتطلب تفعيل العارض المحمي.')
    } catch (error) {
      setNotice('فشل تسجيل الملف: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setBusy('')
    }
  }

  if (!supabase) return null
  return (
    <section className="yearcard">
      <div className="yearbadge">ADMIN ONLY · NURSING FILES</div>
      <h2>رفع محاضرات التمريض</h2>
      <p>أربع ملفات لكل محاضرة (PDF / PPTX / Workbook PDF / Word). تُحفظ في التخزين الخاص. لا يتم فتح أي ملف للطلاب بمجرد رفعه دون تفعيل صلاحية العرض.</p>
      {notice && <p role="status" className="authmessage">{notice}</p>}
      <div className="modulelist">
        {lectures.map((lecture, index) => (
          <div className="modulecard" key={index} style={{cursor: 'default', display: 'block'}}>
            <h3>Lecture {String(index + 1).padStart(2, '0')} · {lecture[0]}</h3>
            <p>{lecture[1]}</p>
            <div className="adminformgrid">
              {NURSING_FILE_KINDS.map((fileType) => {
                const existing = records.find((record) => record.lecture_id === lectureId(index) && record.file_kind === fileType.kind)
                const disabled = Boolean(busy)
                return (
                  <label key={fileType.kind} className="adminformwide">
                    {fileType.label}
                    <span className={existing ? 'readinessbadge ready' : 'readinessbadge missing'}>
                      {existing ? <><Check size={13}/> تم الرفع: {existing.original_name}</> : 'لم يُرفع بعد'}
                    </span>
                    <input
                      type="file"
                      accept={fileType.accept}
                      disabled={disabled}
                      onChange={(event) => {
                        const selected = event.target.files?.[0]
                        event.target.value = ''
                        void uploadFile(index, fileType.kind, selected)
                      }}
                    />
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function useNursingAccess() {
  const { user } = useAuth()
  const { isAdmin, loading: adminLoading } = useAdmin(user?.id)
  const { faculty, loading: profileLoading } = useStudentYear()
  return {
    user,
    isAdmin,
    loading: Boolean(user && (adminLoading || profileLoading)),
    allowed: !user || isAdmin || faculty === 'Nursing',
  }
}

function RestrictedMessage() {
  const tr = useTr()
  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <span className="eyebrow">KIFARO · NURSING</span>
          <h1>{tr('Nursing Anatomy', 'تشريح التمريض')}</h1>
          <p>{tr('This course is for students registered in Nursing. Medicine content remains separate.', 'المنهج ده مخصص للطلبة المسجلين في التمريض، ومنهج الطب منفصل عنه.')}</p>
        </div>
      </div>
      <div className="yearcard"><LockKeyhole size={24} /><p>{tr('Contact KIFARO administration if your registered faculty needs correction.', 'تواصل مع إدارة KIFARO لو الكلية المسجلة عندك محتاجة تعديل.')}</p></div>
    </div>
  )
}

function LoadingAccess() {
  const tr = useTr()
  return <div className="page" role="status">{tr('Loading your course…', 'جارٍ تحميل المنهج…')}</div>
}

export default function NursingPage() {
  const tr = useTr()
  const navigate = useNavigate()
  const access = useNursingAccess()

  if (access.loading) return <LoadingAccess />
  if (!access.allowed) return <RestrictedMessage />

  return (
    <div className="page">
      <section className="hero compact">
        <div>
          <span className="pill">ANATOMATE BY KIFARO · NURSING</span>
          <h2>{tr('Nursing Anatomy', 'تشريح التمريض')}</h2>
          <p>{tr('One complete anatomy course, organized directly into lectures. Simple Arabic explanations with essential English medical terms.', 'منهج تشريح واحد مقسّم مباشرة إلى محاضرات، بشرح عربي مبسط مع أهم المصطلحات الطبية بالإنجليزي.')}</p>
        </div>
        <HeartPulse className="heroicon" />
      </section>

      <div className="modulehero">
        <div>
          <small>{tr('NURSING ANATOMY COURSE', 'منهج تشريح التمريض')}</small>
          <strong>{NURSING_LECTURES.length} {tr('lectures', 'محاضرة')}</strong>
        </div>
        <span>{tr('KIFARO proposed learning sequence. Lecture files, study workbooks and assessments are published only after review and hosting; no payment is available for unpublished content.', 'دي الخطة التعليمية المقترحة من KIFARO وليست التوصيف الرسمي للجامعة. ملفات المحاضرات والـWorkbook والأسئلة هتتفتح بعد المراجعة والرفع الفعلي، ومفيش دفع للمحتوى غير المنشور.')}</span>
      </div>

      <div className="modulelist">
        {NURSING_LECTURES.map(([title, titleAr], index) => (
          <button
            className="modulecard nursinglecturecard"
            key={title}
            onClick={() => navigate('/nursing/lecture/' + (index + 1))}
          >
            <span className="lectureseq">{String(index + 1).padStart(2, '0')}</span>
            <div className="grow">
              <small>{tr('LECTURE', 'المحاضرة')} {String(index + 1).padStart(2, '0')}</small>
              <h3>{tr(title, titleAr)}</h3>
              <span className="productionchip">{tr('Coming soon', 'قريبًا')}</span>
            </div>
            <ChevronRight className="dirarrow" />
          </button>
        ))}
      </div>
      {access.isAdmin && access.user && (
        <NursingAdminUploadPanel year={1} moduleSlug="general-anatomy" lectures={NURSING_LECTURES} userId={access.user.id} />
      )}
    </div>
  )
}

export function NursingLecturePage() {
  const tr = useTr()
  const navigate = useNavigate()
  const { number } = useParams()
  const access = useNursingAccess()
  if (access.loading) return <LoadingAccess />
  if (!access.allowed) return <RestrictedMessage />

  const index = Number(number) - 1
  const lecture = Number.isInteger(index) ? NURSING_LECTURES[index] : undefined
  if (!lecture) return (
    <div className="page">
      <h1>{tr('Lecture not found', 'المحاضرة غير موجودة')}</h1>
      <button className="secondary" onClick={() => navigate('/nursing')}>{tr('Back to Nursing Anatomy', 'العودة لمنهج التمريض')}</button>
    </div>
  )

  return (
    <div className="page">
      <button className="secondary" onClick={() => navigate('/nursing')}><ArrowLeft size={16} /> {tr('All Nursing lectures', 'كل محاضرات التمريض')}</button>
      <div className="pagehead section">
        <div>
          <span className="eyebrow">ANATOMATE · NURSING · {tr('LECTURE', 'محاضرة')} {String(index + 1).padStart(2, '0')}</span>
          <h1>{tr(lecture[0], lecture[1])}</h1>
          <p>{tr('Nursing Anatomy', 'تشريح التمريض')}</p>
        </div>
      </div>
      <div className="productionnotice">
        <BookOpen size={24} />
        <p>{tr('Coming soon. The PDF presentation, workbook and assessments are not available online yet. They will be enabled only once their approved files are uploaded and checked.', 'قريبًا. ملفات المحاضرة والـWorkbook والأسئلة مش متاحة على الموقع حاليًا. هنفعّلها بعد رفع النسخ المعتمدة واختبارها.')}</p>
      </div>
    </div>
  )
}
