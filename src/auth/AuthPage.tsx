import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Building2, Flag, GraduationCap, LockKeyhole, Mail, Phone, School, Stethoscope, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { ACADEMIC_LEVELS, EGYPTIAN_UNIVERSITIES, FACULTIES } from '../data/academicOptions'

export default function AuthPage() {
  const { configured, user, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [academicYear, setAcademicYear] = useState(1)
  const [faculty, setFaculty] = useState('Medicine')
  const [university, setUniversity] = useState('')
  const [nationality, setNationality] = useState('Egyptian')
  const [phoneNo, setPhoneNo] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const forgotPassword = async () => {
    if (!supabase) return
    if (!email.trim()) {
      setMessage('Enter your email first.')
      return
    }
    setBusy(true)
    setMessage('')
    const redirectTo = window.location.origin + window.location.pathname + '#/reset-password'
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setMessage(error ? error.message : 'Password reset link sent. Check your email.')
    setBusy(false)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    if (mode === 'login') {
      const result = await signIn(email, password)
      if (result.error) setMessage(result.error)
      else navigate('/')
    } else {
      const result = await signUp({ email, password, fullName, academicYear, faculty, university, nationality, phoneNo })
      if (result.error) setMessage(result.error)
      else if (result.needsEmailConfirmation) setMessage('Check your email to confirm your KIFARO account.')
      else navigate('/')
    }

    setBusy(false)
  }

  return (
    <div className="authpage">
      <section className="authbrand">
        <div className="authlogo"><Stethoscope /></div>
        <span>ANATOMATE BY KIFARO</span>
        <h1>Your medical learning journey, organized.</h1>
        <p>Learn anatomy visually, track your progress, revise actively and return exactly where you stopped.</p>
      </section>

      <section className="authcard">
        <div className="authswitch">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button>
        </div>

        {!configured && <div className="authnotice">Student accounts are being connected. The public preview is still available.</div>}

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label>Full name<div className="authinput"><UserRound /><input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" /></div></label>
              <label>Academic year<div className="authinput"><GraduationCap /><select value={academicYear} onChange={(e) => setAcademicYear(Number(e.target.value))}>{ACADEMIC_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}</select></div></label>
              <label>Faculty<div className="authinput"><School /><select value={faculty} onChange={(e) => setFaculty(e.target.value)} required>{FACULTIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></label>
              <label>University<div className="authinput"><Building2 /><select value={university} onChange={(e) => setUniversity(e.target.value)} required><option value="">Select university</option>{Object.entries(EGYPTIAN_UNIVERSITIES).map(([group, universities]) => <optgroup key={group} label={group}>{universities.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>)}</select></div></label>
              <label>Nationality<div className="authinput"><Flag /><input value={nationality} onChange={(e) => setNationality(e.target.value)} required /></div></label>
              <label>Phone no<div className="authinput"><Phone /><input type="tel" value={phoneNo} onChange={(e) => setPhoneNo(e.target.value)} required autoComplete="tel" placeholder="+20..." /></div></label>
            </>
          )}

          <label>Email<div className="authinput"><Mail /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div></label>
          <label>Password<div className="authinput"><LockKeyhole /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></div></label>
          {mode === 'login' && <button type="button" className="secondary" disabled={busy || !configured} onClick={() => void forgotPassword()}>Forgot password?</button>}

          {message && <div className="authmessage">{message}</div>}
          <button className="primary authsubmit" disabled={!configured || busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in to KIFARO' : 'Create KIFARO account'}</button>
        </form>
      </section>
    </div>
  )
}
