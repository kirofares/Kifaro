import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Building2, Flag, GraduationCap, LockKeyhole, Mail, Phone, School, Stethoscope, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { ACADEMIC_LEVELS, EGYPTIAN_UNIVERSITIES, FACULTIES, LEARNING_DEPTHS } from '../data/academicOptions'
import { useTr } from '../i18n'

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
  const [preferredLearningDepth, setPreferredLearningDepth] = useState('CORE')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const tr = useTr()

  if (user) return <Navigate to="/" replace />

  const forgotPassword = async () => {
    if (!supabase) return
    if (!email.trim()) {
      setMessage(tr('Enter your email first.', 'اكتب بريدك الإلكتروني أولًا.'))
      return
    }
    setBusy(true)
    setMessage('')
    const redirectTo = window.location.origin + window.location.pathname + '#/reset-password'
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setMessage(error ? error.message : tr('Password reset link sent. Check your email.', 'تم إرسال رابط إعادة تعيين كلمة المرور. راجع بريدك.'))
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
      if (!termsAccepted) {
        setMessage(tr('Please accept the Terms of Use and Privacy Policy.', 'من فضلك وافق على شروط الاستخدام وسياسة الخصوصية.'))
        setBusy(false)
        return
      }
      const result = await signUp({ email, password, fullName, academicYear: faculty === 'Nursing' ? 1 : academicYear, faculty, university, nationality, phoneNo, preferredLearningDepth })
      if (result.error) setMessage(result.error)
      else if (result.needsEmailConfirmation) setMessage(tr('Check your email to confirm your KIFARO account.', 'راجع بريدك لتأكيد حسابك في KIFARO.'))
      else navigate('/')
    }

    setBusy(false)
  }

  return (
    <div className="authpage">
      <section className="authbrand">
        <div className="authlogo"><Stethoscope /></div>
        <span>ANATOMATE BY KIFARO</span>
        <h1>{tr('Your medical learning journey, organized.', 'رحلتك في دراسة الطب، منظمة.')}</h1>
        <p>{tr('Learn anatomy visually, track your progress, revise actively and return exactly where you stopped.', 'اتعلم التشريح بصريًا، تابع تقدمك، راجع بشكل نشط وارجع بالظبط للمكان اللي وقفت عنده.')}</p>
      </section>

      <section className="authcard">
        <div className="authswitch">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>{tr('Log in', 'تسجيل الدخول')}</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>{tr('Create account', 'إنشاء حساب')}</button>
        </div>

        {!configured && <div className="authnotice">{tr('Student accounts are being connected. The public preview is still available.', 'جارٍ ربط حسابات الطلاب. المعاينة العامة لسه متاحة.')}</div>}

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label>{tr('Full name', 'الاسم بالكامل')}<div className="authinput"><UserRound /><input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" /></div></label>
              <label>{tr('Faculty', 'الكلية')}<div className="authinput"><School /><select value={faculty} onChange={(e) => { const selected = e.target.value; setFaculty(selected); if (selected === 'Nursing') setAcademicYear(1) }} required>{FACULTIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></label>
              {faculty !== 'Nursing' && <label>{tr('Academic year', 'السنة الدراسية')}<div className="authinput"><GraduationCap /><select value={academicYear} onChange={(e) => setAcademicYear(Number(e.target.value))}>{ACADEMIC_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}</select></div></label>}
              <label>{tr('Preferred learning depth', 'مستوى التعمق المفضل')}<div className="authinput"><GraduationCap /><select value={preferredLearningDepth} onChange={(e) => setPreferredLearningDepth(e.target.value)}>{LEARNING_DEPTHS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></label>
              <label>{tr('University', 'الجامعة')}<div className="authinput"><Building2 /><select value={university} onChange={(e) => setUniversity(e.target.value)} required><option value="">{tr('Select university', 'اختر الجامعة')}</option>{Object.entries(EGYPTIAN_UNIVERSITIES).map(([group, universities]) => <optgroup key={group} label={group}>{universities.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>)}</select></div></label>
              <label>{tr('Nationality', 'الجنسية')}<div className="authinput"><Flag /><input value={nationality} onChange={(e) => setNationality(e.target.value)} required /></div></label>
              <label>{tr('Phone number', 'رقم الموبايل')}<div className="authinput"><Phone /><input dir="ltr" type="tel" value={phoneNo} onChange={(e) => setPhoneNo(e.target.value)} required autoComplete="tel" placeholder="+20..." /></div></label>
            </>
          )}

          <label>{tr('Email', 'البريد الإلكتروني')}<div className="authinput"><Mail /><input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div></label>
          <label>{tr('Password', 'كلمة المرور')}<div className="authinput"><LockKeyhole /><input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></div></label>
          {mode === 'signup' && (
            <label className="legalconsent">
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
              <span>{tr('I agree to the ', 'أوافق على ')}<Link to="/terms">{tr('Terms of Use', 'شروط الاستخدام')}</Link>{tr(' and ', ' و')}<Link to="/privacy">{tr('Privacy Policy', 'سياسة الخصوصية')}</Link>.</span>
            </label>
          )}
          {mode === 'login' && <button type="button" className="secondary" disabled={busy || !configured} onClick={() => void forgotPassword()}>{tr('Forgot password?', 'نسيت كلمة المرور؟')}</button>}

          {message && <div className="authmessage">{message}</div>}
          <button className="primary authsubmit" disabled={!configured || busy}>{busy ? tr('Please wait…', 'برجاء الانتظار…') : mode === 'login' ? tr('Log in to KIFARO', 'الدخول إلى KIFARO') : tr('Create KIFARO account', 'إنشاء حساب KIFARO')}</button>
        </form>
      </section>
    </div>
  )
}
