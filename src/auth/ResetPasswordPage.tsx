import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useTr } from '../i18n'

export default function ResetPasswordPage() {
  const { user, loading } = useAuth()
  const tr = useTr()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (loading) return <div className="page"><div className="adminpanel">{tr('Checking recovery session…', 'جارٍ التحقق من رابط الاسترجاع…')}</div></div>
  if (!user && !done) return <Navigate to="/login" replace />

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    if (password.length < 8) {
      setMessage(tr('Password must be at least 8 characters.', 'كلمة المرور لازم تكون 8 حروف على الأقل.'))
      return
    }
    if (password !== confirm) {
      setMessage(tr('Passwords do not match.', 'كلمتا المرور غير متطابقتين.'))
      return
    }

    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setMessage(error.message)
    else {
      setDone(true)
      setMessage(tr('Password updated successfully. You can now sign in with your new password.', 'تم تحديث كلمة المرور. تقدر تسجل الدخول بكلمة المرور الجديدة.'))
      await supabase.auth.signOut()
    }
    setBusy(false)
  }

  return (
    <div className="authpage">
      <section className="authbrand">
        <div className="authlogo"><LockKeyhole /></div>
        <span>{tr('KIFARO ACCOUNT SECURITY', 'أمان حساب KIFARO')}</span>
        <h1>{tr('Choose a new password.', 'اختر كلمة مرور جديدة.')}</h1>
        <p>{tr('Your old password is never shown to KIFARO administrators. Reset links let you choose a new password securely.', 'كلمة المرور القديمة لا تظهر أبدًا لإدارة KIFARO. رابط إعادة التعيين بيخليك تختار كلمة مرور جديدة بأمان.')}</p>
      </section>

      <section className="authcard">
        <h2>{tr('Reset password', 'إعادة تعيين كلمة المرور')}</h2>
        <form onSubmit={updatePassword}>
          <label>{tr('New password', 'كلمة المرور الجديدة')}<div className="authinput"><LockKeyhole /><input dir="ltr" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></div></label>
          <label>{tr('Confirm new password', 'تأكيد كلمة المرور الجديدة')}<div className="authinput"><LockKeyhole /><input dir="ltr" type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" /></div></label>
          {message && <div className="authmessage">{message}</div>}
          {!done && <button className="primary authsubmit" disabled={busy}>{busy ? tr('Updating…', 'جارٍ التحديث…') : tr('Set new password', 'حفظ كلمة المرور')}</button>}
          {done && <a className="primary authsubmit" href="#/login">{tr('Go to login', 'الذهاب لتسجيل الدخول')}</a>}
        </form>
      </section>
    </div>
  )
}
