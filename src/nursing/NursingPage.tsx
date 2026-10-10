import { ArrowLeft, BookOpen, ChevronRight, HeartPulse, LockKeyhole } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useAdmin } from '../hooks/useAdmin'
import { useStudentYear } from '../hooks/useStudentYear'
import { useTr } from '../i18n'

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

function useNursingAccess() {
  const { user } = useAuth()
  const { isAdmin, loading: adminLoading } = useAdmin(user?.id)
  const { faculty, loading: profileLoading } = useStudentYear()
  return {
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
