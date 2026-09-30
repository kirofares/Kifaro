import { useEffect, useMemo, useState } from 'react'
import { Check, CreditCard, GraduationCap, KeyRound, LayoutDashboard, LockOpen, Pencil, Save, Search, ShieldCheck, Users, XCircle } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { anatomateLectures } from '../data/anatomate'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useAdmin } from '../hooks/useAdmin'
import { useLectureSettings } from '../hooks/useLectureSettings'
import { usePricingRules, type PricingRule } from '../hooks/usePricingRules'

type Profile = {
  id: string
  full_name: string | null
  medical_year: number | null
  faculty: string | null
  university: string | null
  nationality: string | null
  phone_no: string | null
  email: string | null
  role: string
  created_at: string
}

type Entitlement = {
  user_id: string
  lecture_id: string
  price_paid_egp: number
  source: string
  granted_at: string
  revoked_at: string | null
  view_limit: number | null
  views_used: number
  offer_academic_year: number | null
  offer_nationality: string | null
}

type ProgressRow = {
  user_id: string
  lecture_id: string
  progress: number
  completed: boolean
  favorite: boolean
  updated_at: string
}

type Tab = 'overview' | 'students' | 'purchases' | 'lectures'

function pricingRuleScore(rule: PricingRule) {
  const yearScore = rule.academic_year == null ? 0 : 20
  const nationalityScore = rule.nationality_match === '*' ? 0 : rule.nationality_match === 'NON_EGYPTIAN' ? 5 : 10
  return yearScore + nationalityScore + Number(rule.priority || 0)
}

function ruleMatchesStudent(rule: PricingRule, profile: Profile) {
  const nationality = (profile.nationality || '').trim().toLowerCase()
  const nationalityRule = rule.nationality_match.trim()
  const nationalityMatches =
    nationalityRule === '*' ||
    nationalityRule.toLowerCase() === nationality ||
    (nationalityRule === 'NON_EGYPTIAN' && !['egyptian', 'egypt'].includes(nationality))

  return (rule.academic_year == null || rule.academic_year === profile.medical_year) && nationalityMatches
}

function lecturePrice(lecture: { status: string; duration: number; system: string }) {
  if (lecture.status === 'free') return 0
  const premiumSystems = new Set(['Neuroanatomy','Brainstem','Clinical Anatomy','Gastrointestinal Anatomy','Head & Neck Anatomy'])
  if (lecture.duration >= 55 || premiumSystems.has(lecture.system)) return 60
  if (lecture.duration >= 45) return 50
  return 40
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, loading: adminLoading } = useAdmin(user?.id)
  const { settings, refresh: refreshLectureSettings } = useLectureSettings()
  const { rows: pricingRules, refresh: refreshPricingRules } = usePricingRules()
  const [tab, setTab] = useState<Tab>('overview')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [studentLecture, setStudentLecture] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedLecture, setSelectedLecture] = useState('')
  const [message, setMessage] = useState('')
  const [editingLecture, setEditingLecture] = useState('')
  const [lectureDraft, setLectureDraft] = useState({
    title: '', description: '', price: 50, access: 'paid' as 'free' | 'paid', published: true,
    videoUrl: '', pdfUrl: '', pptxUrl: '',
    videoPath: '', pdfPath: '', pptxPath: '',
  })
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pptxFile, setPptxFile] = useState<File | null>(null)
  const [assetUploading, setAssetUploading] = useState<'video' | 'pdf' | 'pptx' | ''>('')
  const [editingRuleId, setEditingRuleId] = useState('')
  const [ruleYear, setRuleYear] = useState(0)
  const [ruleNationality, setRuleNationality] = useState('*')
  const [ruleCustomNationality, setRuleCustomNationality] = useState('')
  const [rulePrice, setRulePrice] = useState(50)
  const [ruleViews, setRuleViews] = useState<number | ''>(3)

  const load = async () => {
    if (!supabase || !isAdmin) return
    setLoading(true)
    setMessage('')

    const [profilesResult, entitlementsResult, progressResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name, medical_year, faculty, university, nationality, phone_no, email, role, created_at').order('created_at', { ascending: false }),
      supabase.from('lecture_entitlements').select('user_id, lecture_id, price_paid_egp, source, granted_at, revoked_at, view_limit, views_used, offer_academic_year, offer_nationality').order('granted_at', { ascending: false }),
      supabase.from('lecture_progress').select('user_id, lecture_id, progress, completed, favorite, updated_at').order('updated_at', { ascending: false }),
    ])

    if (profilesResult.error) setMessage(profilesResult.error.message)
    if (entitlementsResult.error) setMessage(entitlementsResult.error.message)
    if (progressResult.error) setMessage(progressResult.error.message)

    setProfiles((profilesResult.data || []) as Profile[])
    setEntitlements((entitlementsResult.data || []) as Entitlement[])
    setProgressRows((progressResult.data || []) as ProgressRow[])
    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) void load()
    else if (!adminLoading) setLoading(false)
  }, [isAdmin, adminLoading])

  const activePurchases = entitlements.filter((item) => !item.revoked_at)
  const revenue = activePurchases.reduce((sum, item) => sum + Number(item.price_paid_egp || 0), 0)
  const selectedStudent = profiles.find((p) => p.id === selectedStudentId)
  const selectedStudentEntitlements = entitlements.filter((item) => item.user_id === selectedStudentId)
  const selectedStudentActive = selectedStudentEntitlements.filter((item) => !item.revoked_at)
  const selectedStudentProgress = progressRows.filter((item) => item.user_id === selectedStudentId)
  const selectedStudentSpend = selectedStudentActive.reduce((sum, item) => sum + Number(item.price_paid_egp || 0), 0)

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) =>
      [p.full_name,p.email,p.faculty,p.university,p.nationality,p.phone_no]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    )
  }, [profiles, query])

  const settingFor = (lectureId: string) => settings.get(lectureId)

  const effectivePrice = (lecture: (typeof anatomateLectures)[number]) =>
    settingFor(lecture.id)?.price_egp ?? lecturePrice(lecture)

  const effectiveAccess = (lecture: (typeof anatomateLectures)[number]) =>
    settingFor(lecture.id)?.access_mode ?? (lecture.status === 'free' ? 'free' : 'paid')

  const isPublished = (lectureId: string) => settingFor(lectureId)?.published ?? true

  const offerForStudent = (lecture: (typeof anatomateLectures)[number], profile?: Profile) => {
    const rule = profile
      ? pricingRules
          .filter((item) => item.lecture_id === lecture.id && ruleMatchesStudent(item, profile))
          .sort((a, b) => pricingRuleScore(b) - pricingRuleScore(a))[0]
      : undefined

    return {
      price: rule ? Number(rule.price_egp) : effectivePrice(lecture),
      viewLimit: rule?.view_limit ?? null,
      rule,
    }
  }

  const resetRuleDraft = () => {
    setEditingRuleId('')
    setRuleYear(0)
    setRuleNationality('*')
    setRuleCustomNationality('')
    setRulePrice(50)
    setRuleViews(3)
  }

  const startEditRule = (rule: PricingRule) => {
    setEditingRuleId(rule.id)
    setRuleYear(rule.academic_year || 0)
    if (rule.nationality_match === '*' || rule.nationality_match === 'Egyptian' || rule.nationality_match === 'NON_EGYPTIAN') {
      setRuleNationality(rule.nationality_match)
      setRuleCustomNationality('')
    } else {
      setRuleNationality('CUSTOM')
      setRuleCustomNationality(rule.nationality_match)
    }
    setRulePrice(Number(rule.price_egp))
    setRuleViews(rule.view_limit ?? '')
  }

  const startEditLecture = (lecture: (typeof anatomateLectures)[number]) => {
    const setting = settingFor(lecture.id)
    setEditingLecture(lecture.id)
    setLectureDraft({
      title: setting?.title_override || lecture.title,
      description: setting?.description_override || lecture.description,
      price: setting?.price_egp ?? lecturePrice(lecture),
      access: setting?.access_mode ?? (lecture.status === 'free' ? 'free' : 'paid'),
      published: setting?.published ?? true,
      videoUrl: setting?.video_url || lecture.videoUrl || '',
      pdfUrl: setting?.pdf_url || lecture.pdfUrl || '',
      pptxUrl: setting?.pptx_url || lecture.slidesUrl || '',
      videoPath: setting?.video_path || '',
      pdfPath: setting?.pdf_path || '',
      pptxPath: setting?.pptx_path || '',
    })
    resetRuleDraft()
    window.setTimeout(() => {
      document.getElementById('lecture-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  const saveLecture = async () => {
    if (!supabase || !user || !editingLecture) return
    setMessage('')

    const now = new Date().toISOString()
    const { error: settingsError } = await supabase.from('lecture_settings').upsert({
      lecture_id: editingLecture,
      title_override: lectureDraft.title.trim() || null,
      description_override: lectureDraft.description.trim() || null,
      price_egp: lectureDraft.access === 'free' ? 0 : lectureDraft.price,
      access_mode: lectureDraft.access,
      published: lectureDraft.published,
      updated_at: now,
      updated_by: user.id,
    }, { onConflict: 'lecture_id' })

    if (settingsError) {
      setMessage(settingsError.message)
      return
    }

    const { error: assetsError } = await supabase.from('lecture_assets').upsert({
      lecture_id: editingLecture,
      video_url: lectureDraft.videoUrl.trim() || null,
      pdf_url: lectureDraft.pdfUrl.trim() || null,
      pptx_url: lectureDraft.pptxUrl.trim() || null,
      video_path: lectureDraft.videoPath.trim() || null,
      pdf_path: lectureDraft.pdfPath.trim() || null,
      pptx_path: lectureDraft.pptxPath.trim() || null,
      updated_at: now,
      updated_by: user.id,
    }, { onConflict: 'lecture_id' })

    if (assetsError) setMessage(assetsError.message)
    else {
      setMessage('Lecture settings saved securely.')
      await refreshLectureSettings()
      setEditingLecture('')
    }
  }

  const uploadProtectedAsset = async (kind: 'video' | 'pdf' | 'pptx') => {
    if (!supabase || !editingLecture) return
    const file = kind === 'video' ? videoFile : kind === 'pdf' ? pdfFile : pptxFile
    if (!file) return

    setAssetUploading(kind)
    setMessage('')

    const extension = file.name.includes('.') ? file.name.split('.').pop() : kind
    const safeBase = file.name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || kind
    const path = editingLecture + '/' + kind + '/' + Date.now() + '-' + safeBase + '.' + extension

    const { error: uploadError } = await supabase.storage
      .from('kifaro-content')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })

    if (uploadError) {
      setMessage(uploadError.message)
      setAssetUploading('')
      return
    }

    setLectureDraft((draft) => ({
      ...draft,
      ...(kind === 'video' ? { videoPath: path } : kind === 'pdf' ? { pdfPath: path } : { pptxPath: path }),
    }))
    if (kind === 'video') setVideoFile(null)
    if (kind === 'pdf') setPdfFile(null)
    if (kind === 'pptx') setPptxFile(null)
    setMessage(kind.toUpperCase() + ' uploaded to private storage. Click Save lecture to attach it.')
    setAssetUploading('')
  }

  const savePricingRule = async () => {
    if (!supabase || !user || !editingLecture) return
    const nationalityMatch = ruleNationality === 'CUSTOM' ? ruleCustomNationality.trim() : ruleNationality
    if (!nationalityMatch) {
      setMessage('Enter a nationality or choose a nationality group.')
      return
    }
    if (rulePrice < 0) {
      setMessage('Price cannot be negative.')
      return
    }
    if (ruleViews !== '' && Number(ruleViews) < 1) {
      setMessage('Views must be at least 1, or leave blank for unlimited.')
      return
    }

    const payload = {
      lecture_id: editingLecture,
      academic_year: ruleYear === 0 ? null : ruleYear,
      nationality_match: nationalityMatch,
      price_egp: rulePrice,
      view_limit: ruleViews === '' ? null : Number(ruleViews),
      enabled: true,
      priority: 0,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }

    const result = editingRuleId
      ? await supabase.from('lecture_pricing_rules').update(payload).eq('id', editingRuleId)
      : await supabase.from('lecture_pricing_rules').insert(payload)

    if (result.error) setMessage(result.error.message)
    else {
      setMessage('Pricing and view rule saved.')
      resetRuleDraft()
      await refreshPricingRules()
    }
  }

  const deletePricingRule = async (id: string) => {
    if (!supabase) return
    const { error } = await supabase.from('lecture_pricing_rules').delete().eq('id', id)
    if (error) setMessage(error.message)
    else {
      setMessage('Pricing rule deleted.')
      if (editingRuleId === id) resetRuleDraft()
      await refreshPricingRules()
    }
  }

  if (authLoading || adminLoading) return <div className="page"><div className="adminpanel">Checking admin access…</div></div>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <div className="page"><div className="adminpanel"><ShieldCheck /><h2>Admin access required</h2><p>This area is available only to authorized KIFARO administrators.</p></div></div>

  const grant = async () => {
    if (!supabase || !selectedUser || !selectedLecture) return
    const lecture = anatomateLectures.find((item) => item.id === selectedLecture)
    if (!lecture) return

    const profile = profiles.find((p) => p.id === selectedUser)
    if (!profile) return
    const offer = offerForStudent(lecture, profile)

    setMessage('')
    const { error } = await supabase.from('lecture_entitlements').upsert({
      user_id: selectedUser,
      lecture_id: selectedLecture,
      price_paid_egp: offer.price,
      view_limit: offer.viewLimit,
      views_used: 0,
      offer_academic_year: profile.medical_year,
      offer_nationality: profile.nationality,
      source: 'admin',
      revoked_at: null,
      granted_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lecture_id' })

    if (error) setMessage(error.message)
    else {
      setMessage('Lecture access granted.')
      await load()
    }
  }

  const grantForStudent = async () => {
    if (!selectedStudentId || !studentLecture) return
    setSelectedUser(selectedStudentId)
    setSelectedLecture(studentLecture)

    if (!supabase) return
    const lecture = anatomateLectures.find((item) => item.id === studentLecture)
    if (!lecture) return

    const profile = profiles.find((p) => p.id === selectedStudentId)
    if (!profile) return
    const offer = offerForStudent(lecture, profile)

    setMessage('')
    const { error } = await supabase.from('lecture_entitlements').upsert({
      user_id: selectedStudentId,
      lecture_id: studentLecture,
      price_paid_egp: offer.price,
      view_limit: offer.viewLimit,
      views_used: 0,
      offer_academic_year: profile.medical_year,
      offer_nationality: profile.nationality,
      source: 'admin',
      revoked_at: null,
      granted_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lecture_id' })

    if (error) setMessage(error.message)
    else {
      setMessage('Lecture access granted.')
      setStudentLecture('')
      await load()
    }
  }

  const sendPasswordReset = async (email: string | null) => {
    if (!supabase || !email) return
    setMessage('')
    const redirectTo = window.location.origin + window.location.pathname + '#/reset-password'
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setMessage(error ? error.message : 'Password reset email sent.')
  }

  const revoke = async (userId: string, lectureId: string) => {
    if (!supabase) return
    setMessage('')
    const { error } = await supabase
      .from('lecture_entitlements')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('lecture_id', lectureId)

    if (error) setMessage(error.message)
    else {
      setMessage('Lecture access revoked.')
      await load()
    }
  }

  const nameForUser = (id: string) => profiles.find((p) => p.id === id)?.full_name || profiles.find((p) => p.id === id)?.email || id
  const lectureFor = (id: string) => anatomateLectures.find((l) => l.id === id)

  return (
    <div className="page adminpage">
      <div className="pagehead">
        <div>
          <span className="eyebrow">KIFARO ADMIN</span>
          <h1>Admin Dashboard</h1>
          <p>Manage students, purchases, lecture access and the academic catalog from one place.</p>
        </div>
      </div>

      <div className="admintabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><LayoutDashboard size={17}/>Overview</button>
        <button className={tab === 'students' ? 'active' : ''} onClick={() => setTab('students')}><Users size={17}/>Students</button>
        <button className={tab === 'purchases' ? 'active' : ''} onClick={() => setTab('purchases')}><CreditCard size={17}/>Purchases</button>
        <button className={tab === 'lectures' ? 'active' : ''} onClick={() => setTab('lectures')}><GraduationCap size={17}/>Lectures</button>
      </div>

      {message && <div className="adminmessage"><Check size={17}/>{message}</div>}

      {tab === 'overview' && (
        <>
          <div className="adminstats">
            <div><small>STUDENTS</small><strong>{profiles.filter((p) => p.role === 'student').length}</strong><span>registered accounts</span></div>
            <div><small>ACTIVE PURCHASES</small><strong>{activePurchases.length}</strong><span>lecture entitlements</span></div>
            <div><small>RECORDED REVENUE</small><strong>{revenue} EGP</strong><span>from entitlement records</span></div>
            <div><small>LECTURES</small><strong>{anatomateLectures.length}</strong><span>current catalog</span></div>
          </div>

          <div className="adminpanel">
            <h2>Quick access</h2>
            <div className="adminquick">
              <button onClick={() => setTab('students')}><Users/>Manage students</button>
              <button onClick={() => setTab('purchases')}><LockOpen/>Grant lecture access</button>
              <button onClick={() => setTab('lectures')}><GraduationCap/>Review lecture pricing</button>
            </div>
          </div>
        </>
      )}

      {tab === 'students' && (
        <div className="adminpanel">
          <div className="adminpanelhead">
            <div><h2>Students</h2><p>Search and review student academic/contact information.</p></div>
            <div className="adminsearch"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, university…" /></div>
          </div>
          <div className="admintablewrap">
            <table className="admintable">
              <thead><tr><th>Student</th><th>Year</th><th>Faculty</th><th>University</th><th>Nationality</th><th>Phone</th><th>Role</th><th>Account</th></tr></thead>
              <tbody>
                {filteredProfiles.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.full_name || 'Unnamed'}</strong><small>{p.email || '—'}</small></td>
                    <td>{p.medical_year === 7 ? 'Post Graduate' : p.medical_year ? 'Year ' + p.medical_year : '—'}</td>
                    <td>{p.faculty || '—'}</td>
                    <td>{p.university || '—'}</td>
                    <td>{p.nationality || '—'}</td>
                    <td>{p.phone_no || '—'}</td>
                    <td><span className="adminbadge">{p.role}</span></td>
                    <td>
                      <div className="adminquick">
                        <button className="secondary" onClick={() => setSelectedStudentId(p.id)}>View</button>
                        <button className="secondary" disabled={!p.email} onClick={() => void sendPasswordReset(p.email)}><KeyRound size={15}/>Reset</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedStudent && (
            <div className="adminpanel admineditor">
              <div className="adminpanelhead">
                <div>
                  <small>STUDENT DETAILS</small>
                  <h2>{selectedStudent.full_name || selectedStudent.email || 'Student'}</h2>
                  <p>{selectedStudent.email || '—'} · {selectedStudent.phone_no || 'No phone'}</p>
                </div>
                <button className="secondary" onClick={() => setSelectedStudentId('')}>Close</button>
              </div>

              <div className="adminstats">
                <div><small>ACTIVE LECTURES</small><strong>{selectedStudentActive.length}</strong><span>current access</span></div>
                <div><small>RECORDED SPEND</small><strong>{selectedStudentSpend} EGP</strong><span>active entitlements</span></div>
                <div><small>COMPLETED</small><strong>{selectedStudentProgress.filter((x) => x.completed).length}</strong><span>lectures completed</span></div>
                <div><small>LAST ACTIVITY</small><strong>{selectedStudentProgress[0]?.updated_at ? new Date(selectedStudentProgress[0].updated_at).toLocaleDateString() : '—'}</strong><span>latest progress update</span></div>
              </div>

              <div className="adminformgrid">
                <label>Academic level<input readOnly value={selectedStudent.medical_year === 7 ? 'Post Graduate' : selectedStudent.medical_year ? 'Year ' + selectedStudent.medical_year : '—'} /></label>
                <label>Faculty<input readOnly value={selectedStudent.faculty || '—'} /></label>
                <label>University<input readOnly value={selectedStudent.university || '—'} /></label>
                <label>Nationality<input readOnly value={selectedStudent.nationality || '—'} /></label>
              </div>

              <div className="admingrant">
                <select value={studentLecture} onChange={(e) => setStudentLecture(e.target.value)}>
                  <option value="">Grant another lecture…</option>
                  {anatomateLectures
                    .filter((l) => effectiveAccess(l) === 'paid' && isPublished(l.id) && !selectedStudentActive.some((x) => x.lecture_id === l.id))
                    .map((l) => <option key={l.id} value={l.id}>Year {l.year} · {settingFor(l.id)?.title_override || l.title} · {effectivePrice(l)} EGP</option>)}
                </select>
                <button className="primary" disabled={!studentLecture} onClick={() => void grantForStudent()}><LockOpen size={17}/>Grant access</button>
                <button className="secondary" disabled={!selectedStudent.email} onClick={() => void sendPasswordReset(selectedStudent.email)}><KeyRound size={16}/>Send password reset</button>
              </div>

              <div className="admintablewrap">
                <table className="admintable">
                  <thead><tr><th>Lecture</th><th>Paid</th><th>Views</th><th>Access</th><th>Progress</th><th>Last activity</th><th>Action</th></tr></thead>
                  <tbody>
                    {selectedStudentEntitlements.map((item) => {
                      const progress = selectedStudentProgress.find((p) => p.lecture_id === item.lecture_id)
                      return (
                        <tr key={item.lecture_id}>
                          <td><strong>{lectureFor(item.lecture_id)?.title || item.lecture_id}</strong></td>
                          <td>{item.price_paid_egp} EGP</td>
                          <td>{item.views_used} / {item.view_limit == null ? '∞' : item.view_limit}</td>
                          <td>{item.revoked_at ? 'Revoked' : 'Active'}</td>
                          <td>{progress?.completed ? 'Completed' : (progress?.progress ?? 0) + '%'}</td>
                          <td>{progress?.updated_at ? new Date(progress.updated_at).toLocaleDateString() : '—'}</td>
                          <td>{!item.revoked_at && <button className="dangerbtn" onClick={() => void revoke(item.user_id, item.lecture_id)}><XCircle size={16}/>Revoke</button>}</td>
                        </tr>
                      )
                    })}
                    {!selectedStudentEntitlements.length && <tr><td colSpan={7}>No lecture access recorded yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'purchases' && (
        <>
          <div className="adminpanel">
            <h2>Grant lecture access</h2>
            <p>Use this for manual payments, complimentary access or support cases.</p>
            <div className="admingrant">
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                <option value="">Select student</option>
                {profiles.filter((p) => p.role === 'student').map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email} — {p.email}</option>)}
              </select>
              <select value={selectedLecture} onChange={(e) => setSelectedLecture(e.target.value)}>
                <option value="">Select lecture</option>
                {anatomateLectures.filter((l) => effectiveAccess(l) === 'paid' && isPublished(l.id)).map((l) => {
                  const profile = profiles.find((p) => p.id === selectedUser)
                  const offer = offerForStudent(l, profile)
                  return <option key={l.id} value={l.id}>Year {l.year} · {(settingFor(l.id)?.title_override || l.title)} · {offer.price} EGP · {offer.viewLimit == null ? '∞ views' : offer.viewLimit + ' views'}</option>
                })}
              </select>
              <button className="primary" disabled={!selectedUser || !selectedLecture} onClick={() => void grant()}><LockOpen size={17}/>Grant access</button>
            </div>
          </div>

          <div className="adminpanel">
            <h2>Purchase & access history</h2>
            <div className="admintablewrap">
              <table className="admintable">
                <thead><tr><th>Student</th><th>Lecture</th><th>Paid</th><th>Source</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {entitlements.map((item) => (
                    <tr key={item.user_id + item.lecture_id}>
                      <td>{nameForUser(item.user_id)}</td>
                      <td>{lectureFor(item.lecture_id)?.title || item.lecture_id}</td>
                      <td>{item.price_paid_egp} EGP</td>
                      <td>{item.source}</td>
                      <td>{item.revoked_at ? 'Revoked' : 'Active'}</td>
                      <td>{!item.revoked_at && <button className="dangerbtn" onClick={() => void revoke(item.user_id, item.lecture_id)}><XCircle size={16}/>Revoke</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'lectures' && (
        <>
          <div className="adminpanel">
            <div className="adminpanelhead"><div><h2>Lecture catalog</h2><p>Edit pricing, access, publishing and student file links.</p></div></div>
            <div className="admintablewrap">
              <table className="admintable">
                <thead><tr><th>Year</th><th>Lecture</th><th>Module</th><th>Access</th><th>Price</th><th>Published</th><th>Action</th></tr></thead>
                <tbody>
                  {anatomateLectures.map((lecture) => (
                    <tr key={lecture.id}>
                      <td>Year {lecture.year}</td>
                      <td><strong>{settingFor(lecture.id)?.title_override || lecture.title}</strong><small>{lecture.system}</small></td>
                      <td>{lecture.module}</td>
                      <td>{effectiveAccess(lecture) === 'free' ? 'Free' : 'Paid'}</td>
                      <td><strong>{effectiveAccess(lecture) === 'free' ? 'Free' : effectivePrice(lecture) + ' EGP'}</strong></td>
                      <td>{isPublished(lecture.id) ? 'Published' : 'Hidden'}</td>
                      <td><button className="secondary" onClick={() => startEditLecture(lecture)}><Pencil size={15}/>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {editingLecture && (() => {
            const lecture = anatomateLectures.find((item) => item.id === editingLecture)
            if (!lecture) return null
            return (
              <div id="lecture-editor" className="adminpanel admineditor">
                <div className="adminpanelhead">
                  <div><h2>Edit lecture</h2><p>Year {lecture.year} · {lecture.module}</p></div>
                  <button className="secondary" onClick={() => setEditingLecture('')}>Cancel</button>
                </div>

                <div className="adminformgrid">
                  <label>Title<input value={lectureDraft.title} onChange={(e) => setLectureDraft((d) => ({...d,title:e.target.value}))}/></label>
                  <label>Access<select value={lectureDraft.access} onChange={(e) => setLectureDraft((d) => ({...d,access:e.target.value as 'free'|'paid'}))}><option value="paid">Paid</option><option value="free">Free</option></select></label>
                  <label>Price<select disabled={lectureDraft.access === 'free'} value={lectureDraft.price} onChange={(e) => setLectureDraft((d) => ({...d,price:Number(e.target.value)}))}><option value={40}>40 EGP</option><option value={50}>50 EGP</option><option value={60}>60 EGP</option></select></label>
                  <label>Published<select value={lectureDraft.published ? 'yes' : 'no'} onChange={(e) => setLectureDraft((d) => ({...d,published:e.target.value === 'yes'}))}><option value="yes">Published</option><option value="no">Unpublished</option></select></label>
                  <label className="adminformwide">Description<textarea rows={4} value={lectureDraft.description} onChange={(e) => setLectureDraft((d) => ({...d,description:e.target.value}))}/></label>
                  <label className="adminformwide">Legacy/free preview video URL<input value={lectureDraft.videoUrl} onChange={(e) => setLectureDraft((d) => ({...d,videoUrl:e.target.value}))} placeholder="Optional. Do not use for paid content."/></label>

                  <label className="adminformwide">Protected video path<input readOnly value={lectureDraft.videoPath} placeholder="No private video uploaded yet"/></label>
                  <label className="adminformwide">Upload protected video
                    <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setVideoFile(e.target.files?.[0] || null)}/>
                  </label>
                  <div className="adminformwide adminquick">
                    <button className="secondary" disabled={!videoFile || Boolean(assetUploading)} onClick={() => void uploadProtectedAsset('video')}>{assetUploading === 'video' ? 'Uploading…' : 'Upload video privately'}</button>
                    {videoFile && <small>{videoFile.name}</small>}
                  </div>

                  <label className="adminformwide">Protected PDF path<input readOnly value={lectureDraft.pdfPath} placeholder="No private PDF uploaded yet"/></label>
                  <label className="adminformwide">Upload protected PDF
                    <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)}/>
                  </label>
                  <div className="adminformwide adminquick">
                    <button className="secondary" disabled={!pdfFile || Boolean(assetUploading)} onClick={() => void uploadProtectedAsset('pdf')}>{assetUploading === 'pdf' ? 'Uploading…' : 'Upload PDF privately'}</button>
                    {pdfFile && <small>{pdfFile.name}</small>}
                  </div>

                  <label className="adminformwide">Protected PPTX path<input readOnly value={lectureDraft.pptxPath} placeholder="No private PowerPoint uploaded yet"/></label>
                  <label className="adminformwide">Upload protected PowerPoint
                    <input type="file" accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(e) => setPptxFile(e.target.files?.[0] || null)}/>
                  </label>
                  <div className="adminformwide adminquick">
                    <button className="secondary" disabled={!pptxFile || Boolean(assetUploading)} onClick={() => void uploadProtectedAsset('pptx')}>{assetUploading === 'pptx' ? 'Uploading…' : 'Upload PowerPoint privately'}</button>
                    {pptxFile && <small>{pptxFile.name}</small>}
                  </div>
                </div>

                <button className="primary" onClick={() => void saveLecture()}><Save size={16}/>Save lecture</button>

                <div className="adminpanel">
                  <div className="adminpanelhead">
                    <div>
                      <h2>Price & view rules</h2>
                      <p>Set different offers by academic year and nationality. More specific rules override general rules.</p>
                    </div>
                  </div>

                  <div className="adminformgrid">
                    <label>Academic year
                      <select value={ruleYear} onChange={(e) => setRuleYear(Number(e.target.value))}>
                        <option value={0}>Any academic year</option>
                        <option value={1}>Year 1</option><option value={2}>Year 2</option><option value={3}>Year 3</option>
                        <option value={4}>Year 4</option><option value={5}>Year 5</option><option value={6}>Year 6</option>
                        <option value={7}>Post Graduate</option>
                      </select>
                    </label>
                    <label>Nationality
                      <select value={ruleNationality} onChange={(e) => setRuleNationality(e.target.value)}>
                        <option value="*">Any nationality</option>
                        <option value="Egyptian">Egyptian</option>
                        <option value="NON_EGYPTIAN">Non-Egyptian</option>
                        <option value="CUSTOM">Specific nationality</option>
                      </select>
                    </label>
                    {ruleNationality === 'CUSTOM' && <label>Specific nationality<input value={ruleCustomNationality} onChange={(e) => setRuleCustomNationality(e.target.value)} placeholder="e.g. British"/></label>}
                    <label>Price (EGP)<input type="number" min={0} step={1} value={rulePrice} onChange={(e) => setRulePrice(Number(e.target.value))}/></label>
                    <label>Video views per payment<input type="number" min={1} value={ruleViews} placeholder="Blank = unlimited" onChange={(e) => setRuleViews(e.target.value === '' ? '' : Number(e.target.value))}/></label>
                  </div>

                  <div className="adminquick">
                    <button className="primary" onClick={() => void savePricingRule()}><Save size={16}/>{editingRuleId ? 'Update rule' : 'Add rule'}</button>
                    {editingRuleId && <button className="secondary" onClick={resetRuleDraft}>Cancel edit</button>}
                  </div>

                  <div className="admintablewrap">
                    <table className="admintable">
                      <thead><tr><th>Academic year</th><th>Nationality</th><th>Price</th><th>Views/payment</th><th>Action</th></tr></thead>
                      <tbody>
                        {pricingRules.filter((rule) => rule.lecture_id === editingLecture).map((rule) => (
                          <tr key={rule.id}>
                            <td>{rule.academic_year === 7 ? 'Post Graduate' : rule.academic_year ? 'Year ' + rule.academic_year : 'Any'}</td>
                            <td>{rule.nationality_match === '*' ? 'Any' : rule.nationality_match === 'NON_EGYPTIAN' ? 'Non-Egyptian' : rule.nationality_match}</td>
                            <td><strong>{Number(rule.price_egp)} EGP</strong></td>
                            <td>{rule.view_limit == null ? 'Unlimited' : rule.view_limit}</td>
                            <td><div className="adminquick"><button className="secondary" onClick={() => startEditRule(rule)}><Pencil size={14}/>Edit</button><button className="dangerbtn" onClick={() => void deletePricingRule(rule.id)}><XCircle size={14}/>Delete</button></div></td>
                          </tr>
                        ))}
                        {!pricingRules.some((rule) => rule.lecture_id === editingLecture) && <tr><td colSpan={5}>No custom rules yet. Base lecture price applies with unlimited views.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}

      {loading && <div className="adminloading">Refreshing dashboard…</div>}
    </div>
  )
}
