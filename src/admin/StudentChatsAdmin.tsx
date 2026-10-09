import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BellRing, Clock3, MessageCircle, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

type Session = {
  id: string
  user_id: string
  status: 'pending' | 'active' | 'expired' | 'closed'
  price_egp: number
  opened_at: string | null
  expires_at: string | null
  admin_last_read_at: string | null
  created_at: string
}

type Msg = {
  id: number
  session_id: string
  sender_id: string
  sender_role: 'student' | 'admin'
  message: string
  created_at: string
}

type UnreadRow = {
  session_id: string
  unread_count: number
  latest_student_message_at: string | null
}

export default function StudentChatsAdmin({ onUnreadChange }: { onUnreadChange?: (count: number) => void }) {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [messages, setMessages] = useState<Msg[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [profiles, setProfiles] = useState<Record<string,string>>({})
  const [draft, setDraft] = useState('')
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  )
  const previousUnreadTotal = useRef<number | null>(null)

  const selected = useMemo(() => sessions.find((s) => s.id === selectedId) || null, [sessions, selectedId])
  const active = Boolean(selected?.status === 'active' && selected.expires_at && new Date(selected.expires_at).getTime() > Date.now())
  const totalUnread = useMemo(() => Object.values(unread).reduce((sum, count) => sum + Number(count || 0), 0), [unread])

  const loadUnread = async (profileMap = profiles) => {
    if (!supabase) return
    const { data, error } = await supabase.rpc('get_admin_chat_unread_counts')
    if (error) return

    const rows = (data || []) as UnreadRow[]
    const next: Record<string, number> = {}
    let nextTotal = 0
    for (const row of rows) {
      const count = Number(row.unread_count || 0)
      next[row.session_id] = count
      nextTotal += count
    }

    if (
      previousUnreadTotal.current !== null &&
      nextTotal > previousUnreadTotal.current &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      const newest = rows
        .filter((row) => Number(row.unread_count || 0) > 0)
        .sort((a, b) => new Date(b.latest_student_message_at || 0).getTime() - new Date(a.latest_student_message_at || 0).getTime())[0]
      const chat = sessions.find((s) => s.id === newest?.session_id)
      const studentName = chat ? (profileMap[chat.user_id] || 'Student') : 'Student'
      new Notification('New Ask AnatoMate message', {
        body: studentName + ' sent a new message.',
        tag: newest?.session_id || 'kifaro-chat',
      })
    }

    previousUnreadTotal.current = nextTotal
    setUnread(next)
    onUnreadChange?.(nextTotal)
  }

  const load = async () => {
    if (!supabase) return
    const [s, p] = await Promise.all([
      supabase
        .from('student_chat_sessions')
        .select('id,user_id,status,price_egp,opened_at,expires_at,admin_last_read_at,created_at')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name,email'),
    ])

    const sessionRows = (s.data || []) as Session[]
    setSessions(sessionRows)

    const map: Record<string,string> = {}
    for (const row of (p.data || []) as any[]) map[row.id] = row.full_name || row.email || row.id
    setProfiles(map)

    if (!selectedId && sessionRows[0]) setSelectedId(sessionRows[0].id)
    await loadUnread(map)
  }

  const loadMessages = async (id: string) => {
    if (!supabase || !id) return
    const r = await supabase
      .from('student_chat_messages')
      .select('id,session_id,sender_id,sender_role,message,created_at')
      .eq('session_id', id)
      .order('created_at')

    setMessages((r.data || []) as Msg[])
  }

  const markRead = async (id: string) => {
    if (!supabase || !id) return
    const now = new Date().toISOString()
    await supabase.from('student_chat_sessions').update({ admin_last_read_at: now }).eq('id', id)
    setUnread((current) => {
      const next = { ...current, [id]: 0 }
      const total = Object.values(next).reduce((sum, count) => sum + Number(count || 0), 0)
      previousUnreadTotal.current = total
      onUnreadChange?.(total)
      return next
    })
  }

  useEffect(() => { void load() }, [])

  useEffect(() => {
    if (!selectedId) return
    void loadMessages(selectedId)
    void markRead(selectedId)

    const t = window.setInterval(async () => {
      await load()
      await loadMessages(selectedId)
      await markRead(selectedId)
    }, 5000)

    return () => window.clearInterval(t)
  }, [selectedId])

  const send = async () => {
    if (!supabase || !user || !selected || !active || !draft.trim()) return
    await supabase.from('student_chat_messages').insert({
      session_id: selected.id,
      sender_id: user.id,
      sender_role: 'admin',
      message: draft.trim(),
    })
    setDraft('')
    await loadMessages(selected.id)
  }

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return
    const permission = await Notification.requestPermission()
    setNotificationsEnabled(permission === 'granted')
  }

  return <div className="adminpanel">
    <div className="adminpanelhead">
      <div>
        <h2>Student chats {totalUnread > 0 && <span className="chatunreadbadge">{totalUnread}</span>}</h2>
        <p>Paid 24-hour Ask AnatoMate conversations.</p>
      </div>
      <div className="adminquick">
        <button className="secondary" onClick={() => void enableNotifications()}>
          {notificationsEnabled ? <BellRing size={16}/> : <Bell size={16}/>}
          {notificationsEnabled ? 'Notifications on' : 'Enable notifications'}
        </button>
        <button className="secondary" onClick={() => void load()}>Refresh</button>
      </div>
    </div>

    <div className="adminchatlayout">
      <aside className="adminchatthreads">
        {sessions.map((s) => {
          const count = Number(unread[s.id] || 0)
          return <button key={s.id} className={selectedId===s.id?'active':''} onClick={()=>setSelectedId(s.id)}>
            <div className="adminchatthreadtitle">
              <strong>{profiles[s.user_id] || s.user_id}</strong>
              {count > 0 && <span className="adminchatnew">NEW · {count}</span>}
            </div>
            <small>{new Date(s.created_at).toLocaleString()}</small>
            <span>{s.status}{s.expires_at ? ' · ' + new Date(s.expires_at).toLocaleString() : ''}</span>
          </button>
        })}
        {!sessions.length && <div>No chats yet.</div>}
      </aside>

      <section className="adminchatbox">
        {selected ? <>
          <div className="adminchathead">
            <div><strong>{profiles[selected.user_id] || selected.user_id}</strong><small>{active ? 'Active' : 'Read only'}</small></div>
            <span><Clock3 size={15}/>{selected.expires_at ? new Date(selected.expires_at).toLocaleString() : 'Not activated'}</span>
          </div>
          <div className="adminchatmessages">
            {messages.map((m) => <div key={m.id} className={m.sender_role==='admin'?'adminchatmsg admin':'adminchatmsg student'}>
              <strong>{m.sender_role==='admin'?'You':'Student'}</strong>
              <p>{m.message}</p>
              <small>{new Date(m.created_at).toLocaleString()}</small>
            </div>)}
          </div>
          <div className="adminchatcomposer">
            <textarea rows={2} value={draft} disabled={!active} onChange={(e)=>setDraft(e.target.value)} placeholder={active?'Reply to student…':'Chat is not active.'}/>
            <button className="primary" disabled={!active || !draft.trim()} onClick={()=>void send()}><Send size={16}/>Send</button>
          </div>
        </> : <div className="assessmentempty"><MessageCircle/>Select a chat.</div>}
      </section>
    </div>
  </div>
}
