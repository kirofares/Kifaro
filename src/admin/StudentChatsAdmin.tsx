import { useEffect, useMemo, useState } from 'react'
import { Clock3, MessageCircle, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

type Session = {
  id:string
  user_id:string
  status:'pending'|'active'|'expired'|'closed'
  price_egp:number
  opened_at:string|null
  expires_at:string|null
  created_at:string
}
type Msg={id:number;session_id:string;sender_id:string;sender_role:'student'|'admin';message:string;created_at:string}

export default function StudentChatsAdmin(){
  const {user}=useAuth()
  const [sessions,setSessions]=useState<Session[]>([])
  const [messages,setMessages]=useState<Msg[]>([])
  const [selectedId,setSelectedId]=useState('')
  const [profiles,setProfiles]=useState<Record<string,string>>({})
  const [draft,setDraft]=useState('')

  const selected=useMemo(()=>sessions.find(s=>s.id===selectedId)||null,[sessions,selectedId])
  const active=Boolean(selected?.status==='active'&&selected.expires_at&&new Date(selected.expires_at).getTime()>Date.now())

  const load=async()=>{
    if(!supabase)return
    const [s,p]=await Promise.all([
      supabase.from('student_chat_sessions').select('id,user_id,status,price_egp,opened_at,expires_at,created_at').order('created_at',{ascending:false}),
      supabase.from('profiles').select('id,full_name,email')
    ])
    setSessions((s.data||[]) as Session[])
    const map:Record<string,string>={}
    for(const row of (p.data||[]) as any[]) map[row.id]=row.full_name||row.email||row.id
    setProfiles(map)
    if(!selectedId&&(s.data||[])[0]) setSelectedId((s.data as any[])[0].id)
  }

  const loadMessages=async(id:string)=>{
    if(!supabase||!id)return
    const r=await supabase.from('student_chat_messages').select('id,session_id,sender_id,sender_role,message,created_at').eq('session_id',id).order('created_at')
    setMessages((r.data||[]) as Msg[])
  }

  useEffect(()=>{void load()},[])
  useEffect(()=>{
    if(!selectedId)return
    void loadMessages(selectedId)
    const t=window.setInterval(()=>{void load();void loadMessages(selectedId)},5000)
    return()=>window.clearInterval(t)
  },[selectedId])

  const send=async()=>{
    if(!supabase||!user||!selected||!active||!draft.trim())return
    await supabase.from('student_chat_messages').insert({session_id:selected.id,sender_id:user.id,sender_role:'admin',message:draft.trim()})
    setDraft('')
    await loadMessages(selected.id)
  }

  return <div className="adminpanel">
    <div className="adminpanelhead"><div><h2>Student chats</h2><p>Paid 24-hour Ask AnatoMate conversations.</p></div><button className="secondary" onClick={()=>void load()}>Refresh</button></div>
    <div className="adminchatlayout">
      <aside className="adminchatthreads">
        {sessions.map(s=><button key={s.id} className={selectedId===s.id?'active':''} onClick={()=>setSelectedId(s.id)}>
          <strong>{profiles[s.user_id]||s.user_id}</strong>
          <small>{new Date(s.created_at).toLocaleString()}</small>
          <span>{s.status}{s.expires_at?' · '+new Date(s.expires_at).toLocaleString():''}</span>
        </button>)}
        {!sessions.length&&<div>No chats yet.</div>}
      </aside>
      <section className="adminchatbox">
        {selected?<><div className="adminchathead"><div><strong>{profiles[selected.user_id]||selected.user_id}</strong><small>{active?'Active':'Read only'}</small></div><span><Clock3 size={15}/>{selected.expires_at?new Date(selected.expires_at).toLocaleString():'Not activated'}</span></div>
        <div className="adminchatmessages">{messages.map(m=><div key={m.id} className={m.sender_role==='admin'?'adminchatmsg admin':'adminchatmsg student'}><strong>{m.sender_role==='admin'?'You':'Student'}</strong><p>{m.message}</p><small>{new Date(m.created_at).toLocaleString()}</small></div>)}</div>
        <div className="adminchatcomposer"><textarea rows={2} value={draft} disabled={!active} onChange={e=>setDraft(e.target.value)} placeholder={active?'Reply to student…':'Chat is not active.'}/><button className="primary" disabled={!active||!draft.trim()} onClick={()=>void send()}><Send size={16}/>Send</button></div></>:<div className="assessmentempty"><MessageCircle/>Select a chat.</div>}
      </section>
    </div>
  </div>
}
