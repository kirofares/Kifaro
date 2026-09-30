import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export default function ResetPasswordPage() {
  const { user, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (loading) return <div className="page"><div className="adminpanel">Checking recovery session…</div></div>
  if (!user && !done) return <Navigate to="/login" replace />

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setMessage('Passwords do not match.')
      return
    }

    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setMessage(error.message)
    else {
      setDone(true)
      setMessage('Password updated successfully. You can now sign in with your new password.')
      await supabase.auth.signOut()
    }
    setBusy(false)
  }

  return (
    <div className="authpage">
      <section className="authbrand">
        <div className="authlogo"><LockKeyhole /></div>
        <span>KIFARO ACCOUNT SECURITY</span>
        <h1>Choose a new password.</h1>
        <p>Your old password is never shown to KIFARO administrators. Reset links let you choose a new password securely.</p>
      </section>

      <section className="authcard">
        <h2>Reset password</h2>
        <form onSubmit={updatePassword}>
          <label>New password<div className="authinput"><LockKeyhole /><input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></div></label>
          <label>Confirm new password<div className="authinput"><LockKeyhole /><input type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" /></div></label>
          {message && <div className="authmessage">{message}</div>}
          {!done && <button className="primary authsubmit" disabled={busy}>{busy ? 'Updating…' : 'Set new password'}</button>}
          {done && <a className="primary authsubmit" href="#/login">Go to login</a>}
        </form>
      </section>
    </div>
  )
}
