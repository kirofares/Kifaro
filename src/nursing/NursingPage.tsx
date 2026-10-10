import { BookOpen, ChevronRight, GraduationCap, HeartPulse, LockKeyhole } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useAdmin } from '../hooks/useAdmin'
import { useStudentYear } from '../hooks/useStudentYear'
import { useTr } from '../i18n'

// Nursing is a separate curriculum, not an alias of Medicine Year 1.
// Only approved nursing lectures will be linked here; placeholders cannot be purchased.
type NursingModule = {
  slug: string
  code: string
  title: string
  titleAr: string
  description: string
  descriptionAr: string
  lectures: { title: string; titleAr: string }[]
}

const NURSING_YEARS: { year: number; modules: NursingModule[] }[] = [
  {
    year: 1,
    modules: [{
      slug: 'general-anatomy',
      code: 'NUR-ANAT-1',
      title: 'General Anatomy for Nursing',
      titleAr: 'التشريح العام للتمريض',
      description: 'Anatomy foundations for first-year nursing students. Course material is being prepared and reviewed.',
      descriptionAr: 'أساسيات التشريح لطلبة الفرقة الأولى تمريض. يجري إعداد ومراجعة المادة العلمية.',
      lectures: [
        { title: 'Anatomical Terminology, Body Regions & Cavities', titleAr: 'مصطلحات الجسم والمناطق والتجاويف' },
        { title: 'Skin, Fascia & Body Tissues', titleAr: 'الجلد والأنسجة واللفافات' },
        { title: 'Bones & the Skeletal System', titleAr: 'العظام والجهاز الهيكلي' },
        { title: 'Joints & Muscular System', titleAr: 'المفاصل والجهاز العضلي' },
      ],
    }],
  },
  { year: 2, modules: [] },
  { year: 3, modules: [] },
  { year: 4, modules: [] },
]

function useNursingAccess() {
  const { user } = useAuth()
  const { isAdmin, loading: adminLoading } = useAdmin(user?.id)
  const { year, faculty, loading: profileLoading } = useStudentYear()
  return {
    user,
    isAdmin,
    year,
    faculty,
    loading: Boolean(user && (adminLoading || profileLoading)),
    allowed: !user || isAdmin || faculty === 'Nursing',
  }
}

function RestrictedMessage() {
  const tr = useTr()
  return (
    <div className="page">
      <div className="pagehead">
        <div><span className="eyebrow">KIFARO · NURSING</span>
          <h1>{tr('Nursing pathway', 'مسار التمريض')}</h1>
          <p>{tr('This pathway is reserved for students registered in Nursing. Your Medicine curriculum remains separate.', 'المسار ده مخصص للطلبة المسجلين في كلية التمريض، ومنهج الطب منفصل عنه.')}</p>
        </div>
      </div>
      <div className="yearcard"><LockKeyhole size={24} /><p>{tr('If your faculty is incorrect, contact KIFARO administration to update it.', 'لو الكلية المسجلة عندك مش صحيحة، تواصل مع إدارة KIFARO لتعديلها.')}</p></div>
    </div>
  )
}

function LoadingAccess() {
  const tr = useTr()
  return <div className="page" role="status">{tr('Loading your academic pathway…', 'جارٍ تحميل مسارك الدراسي…')}</div>
}

export default function NursingPage() {
  const tr = useTr()
  const navigate = useNavigate()
  const access = useNursingAccess()
  if (access.loading) return <LoadingAccess />
  if (!access.allowed) return <RestrictedMessage />

  const visibleYears = access.user && !access.isAdmin
    ? NURSING_YEARS.filter((item) => item.year === access.year)
    : NURSING_YEARS

  return (
    <div className="page">
      <section className="hero compact">
        <div>
          <span className="pill">NURSING BY KIFARO · ANATOMATE</span>
          <h2>{tr('Nursing Anatomy', 'تشريح التمريض')}</h2>
          <p>{tr('Your nursing curriculum, organized by academic year, modules and lectures — with the same learning experience as Medicine.', 'منهج التمريض مرتب حسب الفرقة والموديولات والمحاضرات، بنفس طريقة عرض صفحات الطب، وبشرح عربي مبسط مع المصطلحات التشريحية الإنجليزية.')}</p>
        </div>
        <HeartPulse className="heroicon" />
      </section>

      <div className="yeargrid">
        {visibleYears.map((item) => (
          <section className="yearcard" key={item.year}>
            <div className="yearbadge">{tr('NURSING · YEAR', 'تمريض · الفرقة')} {item.year}</div>
            <h2>{tr('Nursing Year', 'تمريض - الفرقة')} {item.year}</h2>
            <p>{item.modules.length
              ? tr('Modules and lecture sequence for nursing students.', 'الموديولات والمحاضرات المخصصة لطلبة التمريض.')
              : tr('This year is being prepared.', 'جارٍ تجهيز منهج الفرقة دي.')}</p>
            <div className="modulelist">
              {item.modules.length ? item.modules.map((module) => (
                <button className="modulecard" key={module.slug} onClick={() => navigate('/nursing/year/' + item.year + '/module/' + module.slug)}>
                  <div>
                    <small>{module.code} · {module.lectures.length} {tr('curriculum lectures', 'محاضرات في المنهج')}</small>
                    <h3>{tr(module.title, module.titleAr)}</h3>
                    <p>{tr(module.description, module.descriptionAr)}</p>
                    <span className="productionchip">{tr('Coming soon', 'قريبًا')}</span>
                  </div>
                  <ChevronRight className="dirarrow" />
                </button>
              )) : (
                <button className="modulecard" onClick={() => navigate('/nursing/year/' + item.year)}>
                  <div>
                    <small>{tr('Academic year', 'الفرقة الدراسية')} {item.year}</small>
                    <h3>{tr('Coming soon', 'قريبًا')}</h3>
                    <p>{tr('Modules and lectures will appear after academic review.', 'الموديولات والمحاضرات هتظهر بعد المراجعة العلمية.')}</p>
                  </div>
                  <ChevronRight className="dirarrow" />
                </button>
              )}
            </div>
          </section>
        ))}
        {visibleYears.length === 0 && (
          <section className="yearcard"><h2>{tr('Academic year not available', 'الفرقة الدراسية غير متاحة')}</h2>
            <p>{tr('Contact KIFARO to correct your registered nursing year.', 'تواصل مع إدارة KIFARO لتصحيح الفرقة المسجلة.')}</p>
          </section>
        )}
      </div>
    </div>
  )
}

export function NursingYearPage() {
  const tr = useTr()
  const navigate = useNavigate()
  const { year } = useParams()
  const access = useNursingAccess()
  if (access.loading) return <LoadingAccess />
  if (!access.allowed) return <RestrictedMessage />
  const item = NURSING_YEARS.find((entry) => String(entry.year) === year)
  if (!item || (access.user && !access.isAdmin && access.year !== item.year)) return <RestrictedMessage />

  return <div className="page">
    <div className="pagehead"><div><span className="eyebrow">NURSING BY KIFARO</span>
      <h1>{tr('Nursing Year', 'تمريض - الفرقة')} {item.year}</h1>
      <p>{tr('Modules and lectures are added after review and approval.', 'بنضيف الموديولات والمحاضرات بعد المراجعة والاعتماد.')}</p>
    </div></div>
    <div className="yearcard">
      <div className="yearbadge">{tr('YEAR', 'الفرقة')} {item.year}</div>
      <div className="modulelist">
        {item.modules.length ? item.modules.map((module) => (
          <button className="modulecard" key={module.slug} onClick={() => navigate('/nursing/year/' + item.year + '/module/' + module.slug)}>
            <div><small>{module.code}</small><h3>{tr(module.title, module.titleAr)}</h3>
              <p>{tr(module.description, module.descriptionAr)}</p><span className="productionchip">{tr('In production', 'قيد الإنتاج')}</span></div>
            <ChevronRight className="dirarrow" />
          </button>
        )) : <p>{tr('Coming soon — this nursing year is being prepared.', 'قريبًا — جاري تجهيز منهج الفرقة دي.')}</p>}
      </div>
    </div>
  </div>
}

export function NursingModulePage() {
  const tr = useTr()
  const { year, module } = useParams()
  const access = useNursingAccess()
  if (access.loading) return <LoadingAccess />
  if (!access.allowed) return <RestrictedMessage />
  const item = NURSING_YEARS.find((entry) => String(entry.year) === year)
  if (!item || (access.user && !access.isAdmin && access.year !== item.year)) return <RestrictedMessage />
  const selected = item.modules.find((entry) => entry.slug === module)
  if (!selected) return <RestrictedMessage />

  return <div className="page">
    <div className="pagehead"><div>
      <span className="eyebrow">{tr('NURSING YEAR', 'تمريض - الفرقة')} {item.year} · {selected.code}</span>
      <h1>{tr(selected.title, selected.titleAr)}</h1>
      <p>{tr(selected.description, selected.descriptionAr)}</p>
    </div></div>
    <div className="modulehero">
      <div><small>{tr('LECTURE STATUS', 'حالة المحاضرات')}</small><strong>0%</strong></div>
      <div className="progress"><i style={{ width: '0%' }} /></div>
      <span>{tr('No nursing lectures are published yet. Access and payment are disabled until approved files are uploaded.', 'لسه مفيش محاضرات تمريض منشورة. المشاهدة والدفع مقفولين لحد رفع الملفات المعتمدة.')}</span>
    </div>
    <div className="list">
      {selected.lectures.map((lecture, index) => (
        <div className="lessonrow" key={index}>
          <div className="softicon"><BookOpen /></div>
          <div className="grow">
            <small><GraduationCap size={13} /> {tr('Lecture', 'محاضرة')} {index + 1}</small>
            <h3>{tr(lecture.title, lecture.titleAr)}</h3>
            <p>{tr('Content awaiting approval', 'المحتوى تحت المراجعة')} · <span className="productionchip">{tr('Coming soon', 'قريبًا')}</span></p>
          </div>
        </div>
      ))}
    </div>
  </div>
}
