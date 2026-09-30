import { useEffect, useMemo, useState } from 'react'
import { Check, CreditCard, GraduationCap, LayoutDashboard, LockOpen, Search, ShieldCheck, Users, XCircle } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { anatomateLectures } from '../data/anatomate'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useAdmin } from '../hooks/useAdmin'

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
  const [tab, setTab] = useState<Tab>('overview')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedLecture, setSelectedLecture] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    if (!supabase || !isAdmin) return
    setLoading(true)
    setMessage('')

    const [profilesResult, entitlementsResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name, medical_year, faculty, university, nationality, phone_no, email, role, created_at').order('created_at', { ascending: false }),
      supabase.from('lecture_entitlements').select('user_id, lecture_id, price_paid_egp, source, granted_at, revoked_at').order('granted_at', { ascending: false }),
    ])

    if (profilesResult.error) setMessage(profilesResult.error.message)
    if (entitlementsResult.error) setMessage(entitlementsResult.error.message)

    setProfiles((profilesResult.data || []) as Profile[])
    setEntitlements((entitlementsResult.data || []) as Entitlement[])
    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) void load()
    else if (!adminLoading) setLoading(false)
  }, [isAdmin, adminLoading])

  const activePurchases = entitlements.filter((item) => !item.revoked_at)
  const revenue = activePurchases.reduce((sum, item) => sum + Number(item.price_paid_egp || 0), 0)

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) =>
      [p.full_name,p.email,p.faculty,p.university,p.nationality,p.phone_no]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    )
  }, [profiles, query])

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
      price_paid_egp: lecturePrice(lecture),
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
              <thead><tr><th>Student</th><th>Year</th><th>Faculty</th><th>University</th><th>Nationality</th><th>Phone</th><th>Role</th></tr></thead>
              <tbody>
                {filteredProfiles.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.full_name || 'Unnamed'}</strong><small>{p.email || '—'}</small></td>
                    <td>{p.medical_year ? 'Year ' + p.medical_year : '—'}</td>
                    <td>{p.faculty || '—'}</td>
                    <td>{p.university || '—'}</td>
                    <td>{p.nationality || '—'}</td>
                    <td>{p.phone_no || '—'}</td>
                    <td><span className="adminbadge">{p.role}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                {anatomateLectures.filter((l) => l.status !== 'free').map((l) => <option key={l.id} value={l.id}>Year {l.year} · {l.title} · {lecturePrice(l)} EGP</option>)}
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
        <div className="adminpanel">
          <div className="adminpanelhead"><div><h2>Lecture catalog</h2><p>Current automatic prices and publication state.</p></div></div>
          <div className="admintablewrap">
            <table className="admintable">
              <thead><tr><th>Year</th><th>Lecture</th><th>Module</th><th>Duration</th><th>Access</th><th>Price</th></tr></thead>
              <tbody>
                {anatomateLectures.map((lecture) => (
                  <tr key={lecture.id}>
                    <td>Year {lecture.year}</td>
                    <td><strong>{lecture.title}</strong><small>{lecture.system}</small></td>
                    <td>{lecture.module}</td>
                    <td>{lecture.duration} min</td>
                    <td>{lecture.status === 'free' ? 'Free' : 'Paid'}</td>
                    <td><strong>{lecturePrice(lecture) ? lecturePrice(lecture) + ' EGP' : 'Free'}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="adminhint">Pricing is currently automatic. Editable per-lecture prices and publish/unpublish controls are the next admin layer.</p>
        </div>
      )}

      {loading && <div className="adminloading">Refreshing dashboard…</div>}
    </div>
  )
}
