import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Building2, Flag, GraduationCap, LockKeyhole, Mail, Phone, School, Stethoscope, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { ACADEMIC_LEVELS, EGYPTIAN_UNIVERSITIES, FACULTIES, LEARNING_DEPTHS } from '../data/academicOptions'
import { useTr } from '../i18n'
import { authFailure, emailRateLimit, EmailRequestGate, type AuthFailure } from './emailRequestGate'

// In-memory only: survives route remounts, without storing email addresses on disk.
const emailGate = new EmailRequestGate()

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
  const submitting = useRef(false)
  const [, refresh] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => refresh((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const emailState = emailGate.state(email)
  const emailBlocked = emailState.inFlight || emailState.seconds > 0 || emailState.quotaBlocked
  const showEmailError = (error: AuthFailure) => {
    const limit = emailRateLimit(error)
    if (limit.seconds) {
      setMessage(tr('Email requests were temporarily limited. Please wait before trying again.', 'تم تقييد طلبات الإيميل مؤقتًا. انتظر قبل المحاولة مجددًا.'))
    } else if (!limit.limited) {
      setMessage(tr('Unable to complete this request. Check your details and connection, then try again.', 'تعذر إكمال الطلب. راجع البيانات والاتصال ثم حاول مرة أخرى.'))
    }
  }
  const changeMode = (next: 'login' | 'signup') => {
    if (submitting.current) return
    setMode(next)
    setMessage('')
  }


  if (user) return <Navigate to="/" replace />

  const forgotPassword = async () => {
    if (!supabase || !configured || submitting.current) return
    const requestedEmail = email.trim()
    if (!requestedEmail) {
      setMessage(tr('Enter your email first.', 'اكتب بريدك الإلكتروني أولًا.'))
      return
    }
    if (!emailGate.begin(requestedEmail, 'recovery')) return
    submitting.current = true
    setBusy(true)
    setMessage('')
    try {
      const redirectTo = window.location.origin + window.location.pathname + '#/reset-password'
      const { error } = await supabase.auth.resetPasswordForEmail(requestedEmail, { redirectTo })
      const failure = error ? authFailure(error) : undefined
      emailGate.finish(requestedEmail, 'recovery', failure)
      if (failure) showEmailError(failure)
      else setMessage(tr('If this email has an account, check your inbox and spam folder for a reset link.', 'لو البريد مرتبط بحساب، راجع الوارد والرسائل غير المرغوب فيها لرابط استعادة كلمة المرور.'))
    } catch (error) {
      const failure = authFailure(error)
      emailGate.finish(requestedEmail, 'recovery', failure)
      showEmailError(failure)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!configured || submitting.current) return
    if (mode === 'signup' && !termsAccepted) {
      setMessage(tr('Please accept the Terms of Use and Privacy Policy.', 'من فضلك وافق على شروط الاستخدام وسياسة الخصوصية.'))
      return
    }
    const requestedEmail = email.trim()
    const requestedMode = mode
    if (requestedMode === 'signup' && !emailGate.begin(requestedEmail, 'signup')) return
    submitting.current = true
    setBusy(true)
    setMessage('')
    try {
      if (requestedMode === 'login') {
        const result = await signIn(requestedEmail, password)
        if (result.error) setMessage(result.error)
        else navigate('/')
      } else {
        const result = await signUp({ email: requestedEmail, password, fullName, academicYear: faculty === 'Nursing' ? 1 : academicYear, faculty, university, nationality, phoneNo, preferredLearningDepth })
        const failure = result.authError ?? (result.error ? { message: result.error } : undefined)
        emailGate.finish(requestedEmail, 'signup', failure, Date.now(), Boolean(result.needsEmailConfirmation))
        if (failure) showEmailError(failure)
        else if (!result.needsEmailConfirmation) navigate('/')
      }
    } catch (error) {
      const failure = authFailure(error)
      if (requestedMode === 'signup') {
        emailGate.finish(requestedEmail, 'signup', failure)
        showEmailError(failure)
      } else {
        setMessage(tr('Unable to log in right now. Please wait and try again.', 'تعذر تسجيل الدخول حاليًا. انتظر ثم حاول مرة أخرى.'))
      }
    } finally {
      submitting.current = false
      setBusy(false)
    }
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
          <button className={mode === 'login' ? 'active' : ''} disabled={busy} onClick={() => changeMode('login')}>{tr('Log in', 'تسجيل الدخول')}</button>
          <button className={mode === 'signup' ? 'active' : ''} disabled={busy} onClick={() => changeMode('signup')}>{tr('Create account', 'إنشاء حساب')}</button>
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

          <label>{tr('Email', 'البريد الإلكتروني')}<div className="authinput"><Mail /><input dir="ltr" type="email" value={email} disabled={busy} onChange={(e) => { setEmail(e.target.value); setMessage('') }} required autoComplete="email" /></div></label>
          <label>{tr('Password', 'كلمة المرور')}<div className="authinput"><LockKeyhole /><input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></div></label>
          {mode === 'signup' && (
            <label className="legalconsent">
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
              <span>{tr('I agree to the ', 'أوافق على ')}<Link to="/terms">{tr('Terms of Use', 'شروط الاستخدام')}</Link>{tr(' and ', ' و')}<Link to="/privacy">{tr('Privacy Policy', 'سياسة الخصوصية')}</Link>.</span>
            </label>
          )}
          {mode === 'login' && <button type="button" className="secondary" disabled={busy || !configured || emailBlocked} onClick={() => void forgotPassword()}>{tr('Forgot password?', 'نسيت كلمة المرور؟')}</button>}

          {message && <div className="authmessage" role="status">{message}</div>}
          {mode === 'signup' && emailState.awaitingConfirmation && <div className="authmessage" role="status">{tr('Your signup request was accepted. Check your inbox and spam folder to confirm your account, then log in. If already confirmed, log in. No need to create the account again. If nothing arrives, try password recovery later or contact support.', 'تم قبول طلب التسجيل. راجع الوارد والرسائل غير المرغوب فيها لتأكيد حسابك ثم سجل الدخول. لو أكدته بالفعل، سجل الدخول. لا تحتاج لإنشاء الحساب مرة أخرى. لو الرسالة لم تصل، جرّب استعادة كلمة المرور لاحقًا أو تواصل مع الدعم.')}</div>}
          {emailState.seconds > 0 && <div className="authmessage" role="timer">{tr(`Wait ${emailState.seconds} seconds before another email request. Other sending limits may still apply.`, `انتظر ${emailState.seconds} ثانية قبل طلب إيميل آخر. قد تستمر حدود إرسال أخرى.`)}</div>}
          {emailState.quotaBlocked && <div className="authmessage" role="status">
            {tr('Email requests are temporarily limited. The server did not provide a retry time. Wait before trying again; check your inbox and spam folder. If this continues, contact support.', 'طلبات الإيميل محدودة مؤقتًا. الخادم لم يحدد وقتًا لإعادة المحاولة. انتظر قبل المحاولة وراجع الوارد والرسائل غير المرغوب فيها. لو المشكلة استمرت، تواصل مع الدعم.')}
            <button type="button" className="secondary" disabled={busy} onClick={() => { emailGate.allowManualRetry(); refresh((value) => value + 1) }}>{tr('I have waited — enable retry', 'انتظرت — إتاحة المحاولة مجددًا')}</button>
          </div>}
          <button className="primary authsubmit" disabled={!configured || busy || (mode === 'signup' && (emailBlocked || emailState.awaitingConfirmation))}>{busy ? tr('Please wait…', 'برجاء الانتظار…') : mode === 'login' ? tr('Log in to KIFARO', 'الدخول إلى KIFARO') : tr('Create KIFARO account', 'إنشاء حساب KIFARO')}</button>
        </form>
      </section>
    </div>
  )
}
