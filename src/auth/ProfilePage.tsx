import { useEffect, useState } from 'react'
import { Building2, Check, Flag, GraduationCap, Mail, Phone, Save, School, UserRound } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import { ACADEMIC_LEVELS, EGYPTIAN_UNIVERSITIES, FACULTIES, LEARNING_DEPTHS } from '../data/academicOptions'
import { useTr } from '../i18n'

type ProfileForm = {
  full_name: string
  medical_year: number
  faculty: string
  university: string
  nationality: string
  phone_no: string
  email: string
  preferred_learning_depth: string
}

const emptyProfile: ProfileForm = {
  full_name: '',
  medical_year: 1,
  faculty: 'Medicine',
  university: '',
  nationality: 'Egyptian',
  phone_no: '',
  email: '',
  preferred_learning_depth: 'CORE',
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const tr = useTr()
  const [form, setForm] = useState<ProfileForm>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!user || !supabase) {
      setLoading(false)
      return
    }

    const client = supabase

    const load = async () => {
      setLoading(true)
      const { data, error } = await client
        .from('profiles')
        .select('full_name, medical_year, faculty, university, nationality, phone_no, email, preferred_learning_depth')
        .eq('id', user.id)
        .single()

      if (error) {
        setMessage(error.message)
      } else if (data) {
        setForm({
          full_name: data.full_name || (user.user_metadata?.full_name as string) || '',
          medical_year: data.medical_year || 1,
          faculty: data.faculty || 'Medicine',
          university: data.university || '',
          nationality: data.nationality || 'Egyptian',
          phone_no: data.phone_no || '',
          email: data.email || user.email || '',
          preferred_learning_depth: data.preferred_learning_depth || 'CORE',
        })
      }
      setLoading(false)
    }

    void load()
  }, [user])

  if (authLoading) return <div className="page"><div className="profilecard">{tr('Loading profile…', 'جارٍ تحميل الملف الشخصي…')}</div></div>
  if (!user) return <Navigate to="/login" replace />

  const updateField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase) return

    setSaving(true)
    setMessage('')
    setSuccess(false)

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        medical_year: form.medical_year,
        faculty: form.faculty,
        university: form.university.trim(),
        nationality: form.nationality.trim(),
        phone_no: form.phone_no.trim(),
        preferred_learning_depth: form.preferred_learning_depth,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (profileError) {
      setMessage(profileError.message)
      setSaving(false)
      return
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        full_name: form.full_name.trim(),
        medical_year: form.medical_year,
        faculty: form.faculty,
        university: form.university.trim(),
        nationality: form.nationality.trim(),
        phone_no: form.phone_no.trim(),
        preferred_learning_depth: form.preferred_learning_depth,
      },
    })

    setSuccess(!authError)
    setMessage(authError ? authError.message : tr('Profile updated successfully.', 'تم تحديث الملف الشخصي بنجاح.'))
    setSaving(false)
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <span className="eyebrow">{tr('STUDENT ACCOUNT', 'حساب الطالب')}</span>
          <h1>{tr('My Profile', 'ملفي الشخصي')}</h1>
          <p>{tr('Keep your academic and contact details up to date.', 'حدّث بياناتك الدراسية وبيانات التواصل.')}</p>
        </div>
      </div>

      <form className="profilecard" onSubmit={save}>
        <div className="profilesection">
          <div className="profileavatar"><UserRound /></div>
          <div>
            <small>{tr('KIFARO STUDENT', 'طالب KIFARO')}</small>
            <h2>{form.full_name || tr('Student profile', 'ملف الطالب')}</h2>
            <p dir="ltr">{form.email}</p>
          </div>
        </div>

        {loading ? (
          <div className="profileloading">{tr('Loading your details…', 'جارٍ تحميل بياناتك…')}</div>
        ) : (
          <div className="profilegrid">
            <label>
              {tr('Full name', 'الاسم بالكامل')}
              <div className="authinput"><UserRound /><input value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} required /></div>
            </label>

            <label>
              {tr('Academic year', 'السنة الدراسية')}
              <div className="authinput"><GraduationCap /><select value={form.medical_year} onChange={(e) => updateField('medical_year', Number(e.target.value))}>
                {ACADEMIC_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
              </select></div>
            </label>

            <label>
              {tr('Faculty', 'الكلية')}
              <div className="authinput"><School /><select value={form.faculty} onChange={(e) => updateField('faculty', e.target.value)}>
                {FACULTIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select></div>
            </label>

            <label>
              {tr('Preferred learning depth', 'مستوى التعمق المفضل')}
              <div className="authinput"><GraduationCap /><select value={form.preferred_learning_depth} onChange={(e) => updateField('preferred_learning_depth', e.target.value)}>
                {LEARNING_DEPTHS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select></div>
            </label>

            <label>
              {tr('University', 'الجامعة')}
              <div className="authinput"><Building2 /><select value={form.university} onChange={(e) => updateField('university', e.target.value)} required><option value="">{tr('Select university', 'اختر الجامعة')}</option>{Object.entries(EGYPTIAN_UNIVERSITIES).map(([group, universities]) => <optgroup key={group} label={group}>{universities.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>)}</select></div>
            </label>

            <label>
              {tr('Nationality', 'الجنسية')}
              <div className="authinput"><Flag /><input value={form.nationality} onChange={(e) => updateField('nationality', e.target.value)} required /></div>
            </label>

            <label>
              {tr('Phone number', 'رقم الموبايل')}
              <div className="authinput"><Phone /><input dir="ltr" type="tel" value={form.phone_no} onChange={(e) => updateField('phone_no', e.target.value)} required /></div>
            </label>

            <label className="profilewide">
              {tr('Email', 'البريد الإلكتروني')}
              <div className="authinput readonly"><Mail /><input dir="ltr" value={form.email} readOnly /></div>
              <small>{tr('Your email is tied to your login and can\'t be changed here.', 'البريد الإلكتروني مرتبط بحساب الدخول ولا يمكن تغييره من هنا.')}</small>
            </label>
          </div>
        )}

        {message && <div className={success ? 'profilemessage success' : 'profilemessage'}>{success && <Check size={17} />}{message}</div>}

        <button className="primary profilesave" disabled={loading || saving} type="submit">
          <Save size={17} /> {saving ? tr('Saving…', 'جارٍ الحفظ…') : tr('Save changes', 'حفظ التغييرات')}
        </button>
      </form>
    </div>
  )
}
