import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { GraduationCap, LockKeyhole, Mail, Stethoscope, UserRound } from 'lucide-react'
import { useAuth } from './AuthContext'

export default function AuthPage() {
  const { configured, user, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [medicalYear, setMedicalYear] = useState(1)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    if (mode === 'login') {
      const result = await signIn(email, password)
      if (result.error) setMessage(result.error)
      else navigate('/')
    } else {
      const result = await signUp(email, password, fullName, medicalYear)
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
              <label>Full name<div className="authinput"><UserRound /><input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div></label>
              <label>Medical year<div className="authinput"><GraduationCap /><select value={medicalYear} onChange={(e) => setMedicalYear(Number(e.target.value))}><option value={1}>Year 1</option><option value={2}>Year 2</option><option value={3}>Year 3</option></select></div></label>
            </>
          )}

          <label>Email<div className="authinput"><Mail /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div></label>
          <label>Password<div className="authinput"><LockKeyhole /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></div></label>

          {message && <div className="authmessage">{message}</div>}
          <button className="primary authsubmit" disabled={!configured || busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in to KIFARO' : 'Create KIFARO account'}</button>
        </form>
      </section>
    </div>
  )
}
