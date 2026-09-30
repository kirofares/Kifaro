import { useEffect, useState } from 'react'
import { Building2, Check, Flag, GraduationCap, Mail, Phone, Save, School, UserRound } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import { ACADEMIC_LEVELS, EGYPTIAN_UNIVERSITIES, FACULTIES } from '../data/academicOptions'

type ProfileForm = {
  full_name: string
  medical_year: number
  faculty: string
  university: string
  nationality: string
  phone_no: string
  email: string
}

const emptyProfile: ProfileForm = {
  full_name: '',
  medical_year: 1,
  faculty: 'Medicine',
  university: '',
  nationality: 'Egyptian',
  phone_no: '',
  email: '',
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const [form, setForm] = useState<ProfileForm>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user || !supabase) {
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, medical_year, faculty, university, nationality, phone_no, email')
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
        })
      }
      setLoading(false)
    }

    void load()
  }, [user])

  if (authLoading) return <div className="page"><div className="profilecard">Loading profile…</div></div>
  if (!user) return <Navigate to="/login" replace />

  const updateField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase) return

    setSaving(true)
    setMessage('')

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        medical_year: form.medical_year,
        faculty: form.faculty,
        university: form.university.trim(),
        nationality: form.nationality.trim(),
        phone_no: form.phone_no.trim(),
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
      },
    })

    setMessage(authError ? authError.message : 'Profile updated successfully.')
    setSaving(false)
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <span className="eyebrow">STUDENT ACCOUNT</span>
          <h1>My Profile</h1>
          <p>Keep your academic and contact details up to date.</p>
        </div>
      </div>

      <form className="profilecard" onSubmit={save}>
        <div className="profilesection">
          <div className="profileavatar"><UserRound /></div>
          <div>
            <small>KIFARO STUDENT</small>
            <h2>{form.full_name || 'Student profile'}</h2>
            <p>{form.email}</p>
          </div>
        </div>

        {loading ? (
          <div className="profileloading">Loading your details…</div>
        ) : (
          <div className="profilegrid">
            <label>
              Full name
              <div className="authinput"><UserRound /><input value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} required /></div>
            </label>

            <label>
              Academic year
              <div className="authinput"><GraduationCap /><select value={form.medical_year} onChange={(e) => updateField('medical_year', Number(e.target.value))}>
                {ACADEMIC_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
              </select></div>
            </label>

            <label>
              Faculty
              <div className="authinput"><School /><select value={form.faculty} onChange={(e) => updateField('faculty', e.target.value)}>
                {FACULTIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select></div>
            </label>

            <label>
              University
              <div className="authinput"><Building2 /><select value={form.university} onChange={(e) => updateField('university', e.target.value)} required><option value="">Select university</option>{Object.entries(EGYPTIAN_UNIVERSITIES).map(([group, universities]) => <optgroup key={group} label={group}>{universities.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>)}</select></div>
            </label>

            <label>
              Nationality
              <div className="authinput"><Flag /><input value={form.nationality} onChange={(e) => updateField('nationality', e.target.value)} required /></div>
            </label>

            <label>
              Phone no
              <div className="authinput"><Phone /><input type="tel" value={form.phone_no} onChange={(e) => updateField('phone_no', e.target.value)} required /></div>
            </label>

            <label className="profilewide">
              Email
              <div className="authinput readonly"><Mail /><input value={form.email} readOnly /></div>
              <small>Email belongs to your login account. Secure email-change confirmation can be added separately.</small>
            </label>
          </div>
        )}

        {message && <div className={message.includes('successfully') ? 'profilemessage success' : 'profilemessage'}>{message.includes('successfully') && <Check size={17} />}{message}</div>}

        <button className="primary profilesave" disabled={loading || saving} type="submit">
          <Save size={17} /> {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
