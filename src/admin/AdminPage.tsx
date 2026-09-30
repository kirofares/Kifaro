import { useEffect, useMemo, useState } from 'react'
import { Check, CreditCard, GraduationCap, KeyRound, LayoutDashboard, LockOpen, Pencil, Save, Search, ShieldCheck, Users, XCircle } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { anatomateLectures } from '../data/anatomate'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useAdmin } from '../hooks/useAdmin'
import { useLectureSettings } from '../hooks/useLectureSettings'

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
  })

  const load = async () => {
    if (!supabase || !isAdmin) return
    setLoading(true)
    setMessage('')

    const [profilesResult, entitlementsResult, progressResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name, medical_year, faculty, university, nationality, phone_no, email, role, created_at').order('created_at', { ascending: false }),
      supabase.from('lecture_entitlements').select('user_id, lecture_id, price_paid_egp, source, granted_at, revoked_at').order('granted_at', { ascending: false }),
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
    })
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

  if (authLoading || adminLoading) return <div className="page"><div className="adminpanel">Checking admin access…</div></div>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <div className="page"><div className="adminpanel"><ShieldCheck /><h2>Admin access required</h2><p>This area is available only to authorized KIFARO administrators.</p></div></div>

  const grant = async () => {
    if (!supabase || !selectedUser || !selectedLecture) return
    const lecture = anatomateLectures.find((item) => item.id === selectedLecture)
    if (!lecture) return

    setMessage('')
    const { error } = await supabase.from('lecture_entitlements').upsert({
      user_id: selectedUser,
      lecture_id: selectedLecture,
      price_paid_egp: effectivePrice(lecture),
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

    setMessage('')
    const { error } = await supabase.from('lecture_entitlements').upsert({
      user_id: selectedStudentId,
      lecture_id: studentLecture,
      price_paid_egp: effectivePrice(lecture),
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
                  <thead><tr><th>Lecture</th><th>Paid</th><th>Access</th><th>Progress</th><th>Last activity</th><th>Action</th></tr></thead>
                  <tbody>
                    {selectedStudentEntitlements.map((item) => {
                      const progress = selectedStudentProgress.find((p) => p.lecture_id === item.lecture_id)
                      return (
                        <tr key={item.lecture_id}>
                          <td><strong>{lectureFor(item.lecture_id)?.title || item.lecture_id}</strong></td>
                          <td>{item.price_paid_egp} EGP</td>
                          <td>{item.revoked_at ? 'Revoked' : 'Active'}</td>
                          <td>{progress?.completed ? 'Completed' : (progress?.progress ?? 0) + '%'}</td>
                          <td>{progress?.updated_at ? new Date(progress.updated_at).toLocaleDateString() : '—'}</td>
                          <td>{!item.revoked_at && <button className="dangerbtn" onClick={() => void revoke(item.user_id, item.lecture_id)}><XCircle size={16}/>Revoke</button>}</td>
                        </tr>
                      )
                    })}
                    {!selectedStudentEntitlements.length && <tr><td colSpan={6}>No lecture access recorded yet.</td></tr>}
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
                {anatomateLectures.filter((l) => effectiveAccess(l) === 'paid' && isPublished(l.id)).map((l) => <option key={l.id} value={l.id}>Year {l.year} · {(settingFor(l.id)?.title_override || l.title)} · {effectivePrice(l)} EGP</option>)}
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
              <div className="adminpanel admineditor">
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
                  <label className="adminformwide">Video URL<input value={lectureDraft.videoUrl} onChange={(e) => setLectureDraft((d) => ({...d,videoUrl:e.target.value}))} placeholder="https://..."/></label>
                  <label className="adminformwide">PDF URL<input value={lectureDraft.pdfUrl} onChange={(e) => setLectureDraft((d) => ({...d,pdfUrl:e.target.value}))} placeholder="Protected file URL"/></label>
                  <label className="adminformwide">PPTX URL<input value={lectureDraft.pptxUrl} onChange={(e) => setLectureDraft((d) => ({...d,pptxUrl:e.target.value}))} placeholder="Protected file URL"/></label>
                </div>

                <button className="primary" onClick={() => void saveLecture()}><Save size={16}/>Save lecture</button>
              </div>
            )
          })()}
        </>
      )}

      {loading && <div className="adminloading">Refreshing dashboard…</div>}
    </div>
  )
}
