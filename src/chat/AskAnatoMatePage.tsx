import { useEffect, useMemo, useState } from 'react'
import { Clock3, MessageCircle, Plus, Send, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useTr } from '../i18n'
import { supabase } from '../lib/supabase'

type ChatSession = {
  id: string
  user_id: string
  status: 'pending' | 'active' | 'expired' | 'closed'
  price_egp: number
  opened_at: string | null
  expires_at: string | null
  created_at: string
}

type ChatMessage = {
  id: number
  session_id: string
  sender_id: string
  sender_role: 'student' | 'admin'
  message: string
  created_at: string
}

function timeLeft(expiresAt: string | null) {
  if (!expiresAt) return ''
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return hours + 'h ' + minutes + 'm'
}

export default function AskAnatoMatePage() {
  const { user } = useAuth()
  const tr = useTr()
  const nav = useNavigate()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const selected = useMemo(
    () => sessions.find((item) => item.id === selectedId) || null,
    [sessions, selectedId],
  )
  const isActive = Boolean(selected?.status === 'active' && selected.expires_at && new Date(selected.expires_at).getTime() > Date.now())

  const loadSessions = async () => {
    if (!supabase || !user) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('student_chat_sessions')
      .select('id,user_id,status,price_egp,opened_at,expires_at,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const rows = (data || []) as ChatSession[]
    setSessions(rows)
    if (!selectedId && rows[0]) setSelectedId(rows[0].id)
    setLoading(false)
  }

  const loadMessages = async (sessionId: string) => {
    if (!supabase || !sessionId) return
    const { data, error } = await supabase
      .from('student_chat_messages')
      .select('id,session_id,sender_id,sender_role,message,created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (!error) setMessages((data || []) as ChatMessage[])
  }

  useEffect(() => {
    void loadSessions()
  }, [user?.id])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    void loadMessages(selectedId)
    const timer = window.setInterval(() => {
      void loadSessions()
      void loadMessages(selectedId)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [selectedId, user?.id])

  const startChat = async () => {
    if (!supabase || !user || busy) return
    setBusy(true)
    setMessage('')

    const existing = sessions.find((item) =>
      item.status === 'active' &&
      item.expires_at &&
      new Date(item.expires_at).getTime() > Date.now()
    )
    if (existing) {
      setSelectedId(existing.id)
      setBusy(false)
      return
    }

    const pending = sessions.find((item) => item.status === 'pending')
    if (pending) {
      setSelectedId(pending.id)
      setBusy(false)
      nav('/manual-payment?target=chat&chat=' + pending.id + '&product=chat&amount=5')
      return
    }

    const { data, error } = await supabase
      .from('student_chat_sessions')
      .insert({ user_id: user.id, status: 'pending', price_egp: 5 })
      .select('id')
      .single()

    setBusy(false)
    if (error || !data?.id) {
      setMessage(error?.message || tr('Could not create chat session.', 'تعذر إنشاء جلسة الشات.'))
      return
    }

    nav('/manual-payment?target=chat&chat=' + data.id + '&product=chat&amount=5')
  }

  const send = async () => {
    if (!supabase || !user || !selected || !isActive || !draft.trim() || busy) return
    setBusy(true)
    const text = draft.trim()
    const { error } = await supabase.from('student_chat_messages').insert({
      session_id: selected.id,
      sender_id: user.id,
      sender_role: 'student',
      message: text,
    })
    setBusy(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setDraft('')
    await loadMessages(selected.id)
  }

  if (!user) {
    return (
      <div className="page">
        <div className="contentbox askchatintro">
          <MessageCircle size={34}/>
          <h1>{tr('Ask AnatoMate', 'اسأل AnatoMate')}</h1>
          <p>{tr('Sign in first to open a private student chat.', 'سجل الدخول أولًا لفتح شات خاص بالطالب.')}</p>
          <button className="primary" onClick={() => nav('/login')}>{tr('Sign in', 'تسجيل الدخول')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page askchatpage">
      <div className="pagehead">
        <div>
          <span className="eyebrow">ASK ANATOMATE</span>
          <h1>{tr('Questions & Student Chat', 'الأسئلة والشات مع الطالب')}</h1>
          <p>{tr(
            'Open one private chat for 5 EGP. It stays active for 24 hours after payment approval.',
            'افتح شات خاص بـ 5 جنيه. يفضل فعال لمدة 24 ساعة من وقت تأكيد الدفع.'
          )}</p>
        </div>
        <button className="primary asknewchat" onClick={() => void startChat()} disabled={busy}>
          <Plus size={17}/>{tr('Open chat · 5 EGP', 'افتح شات · 5 جنيه')}
        </button>
      </div>

      <div className="askchatlayout">
        <aside className="askthreads">
          <div className="askthreadhead">
            <strong>{tr('Your chats', 'محادثاتك')}</strong>
            <span>{sessions.length}</span>
          </div>
          {loading ? <div className="assessmentempty">{tr('Loading…', 'جارٍ التحميل…')}</div> : sessions.length ? sessions.map((item) => {
            const active = item.status === 'active' && item.expires_at && new Date(item.expires_at).getTime() > Date.now()
            return (
              <button key={item.id} className={selectedId === item.id ? 'askthread active' : 'askthread'} onClick={() => setSelectedId(item.id)}>
                <div>
                  <strong>{active ? tr('Active chat', 'شات فعال') : item.status === 'pending' ? tr('Awaiting payment', 'في انتظار الدفع') : tr('Previous chat', 'شات سابق')}</strong>
                  <small>{new Date(item.created_at).toLocaleString()}</small>
                </div>
                <span className={active ? 'chatstatus active' : 'chatstatus'}>{active ? timeLeft(item.expires_at) : item.status}</span>
              </button>
            )
          }) : <div className="assessmentempty">{tr('No chats yet.', 'لا توجد محادثات بعد.')}</div>}
        </aside>

        <section className="askconversation">
          {!selected ? (
            <div className="askempty">
              <MessageCircle size={38}/>
              <h2>{tr('Ask any anatomy question', 'اسأل أي سؤال في التشريح')}</h2>
              <p>{tr('Open a 24-hour chat for 5 EGP and continue the same conversation during the active window.', 'افتح شات لمدة 24 ساعة بـ5 جنيه وكمل في نفس المحادثة طول فترة التفعيل.')}</p>
              <button className="primary" onClick={() => void startChat()}><Plus size={17}/>{tr('Open chat', 'افتح شات')}</button>
            </div>
          ) : (
            <>
              <div className="askconversationhead">
                <div>
                  <strong>{tr('Private student chat', 'شات خاص بالطالب')}</strong>
                  <small>{selected.opened_at ? tr('Opened ', 'بدأ ') + new Date(selected.opened_at).toLocaleString() : tr('Waiting for payment approval', 'في انتظار تأكيد الدفع')}</small>
                </div>
                <div className="asktimer">
                  <Clock3 size={16}/>
                  <span>{isActive ? timeLeft(selected.expires_at) : selected.status === 'pending' ? tr('Pending', 'قيد الانتظار') : tr('Read only', 'للقراءة فقط')}</span>
                </div>
              </div>

              <div className="askmessages">
                {messages.length ? messages.map((item) => (
                  <div key={item.id} className={item.sender_role === 'admin' ? 'askmsg admin' : 'askmsg student'}>
                    <div className="askmsgmeta">
                      <strong>{item.sender_role === 'admin' ? 'AnatoMate' : tr('You', 'أنت')}</strong>
                      <span>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p>{item.message}</p>
                  </div>
                )) : (
                  <div className="askempty compact">
                    <ShieldCheck size={28}/>
                    <p>{isActive ? tr('Your chat is active. Send your first question.', 'الشات فعال. ابعت أول سؤال.') : tr('Messages will appear here after the chat is activated.', 'الرسائل هتظهر هنا بعد تفعيل الشات.')}</p>
                  </div>
                )}
              </div>

              {selected.status === 'pending' ? (
                <div className="askpaynotice">
                  <p>{tr('Complete the 5 EGP payment to activate this chat for 24 hours.', 'كمّل دفع 5 جنيه لتفعيل الشات لمدة 24 ساعة.')}</p>
                  <button className="primary" onClick={() => nav('/manual-payment?target=chat&chat=' + selected.id + '&product=chat&amount=5')}>
                    {tr('Complete payment', 'استكمال الدفع')}
                  </button>
                </div>
              ) : (
                <div className="askcomposer">
                  <textarea
                    rows={2}
                    maxLength={4000}
                    value={draft}
                    disabled={!isActive}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={isActive ? tr('Type your question…', 'اكتب سؤالك…') : tr('This chat is no longer active.', 'انتهت مدة هذا الشات.')}
                  />
                  <button className="primary" disabled={!isActive || !draft.trim() || busy} onClick={() => void send()}><Send size={17}/>{tr('Send', 'إرسال')}</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {message && <div className="authmessage">{message}</div>}
    </div>
  )
}
