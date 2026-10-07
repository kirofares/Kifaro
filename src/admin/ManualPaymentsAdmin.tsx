import { useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, RefreshCw, Save, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'

type PaymentRequest = {
  id: string
  reference_code: string
  user_id: string
  target_type: 'lecture' | 'module'
  lecture_id: string | null
  module_code: string | null
  academic_year: number | null
  product_type: string
  amount_egp: number
  payment_method: string
  transfer_reference: string
  receipt_path: string | null
  student_note: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
}

type Channel = {
  id: string
  label: string
  destination: string
  account_name: string | null
  instructions: string | null
  active: boolean
  sort_order: number
}

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  phone_no: string | null
}

export default function ManualPaymentsAdmin({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth()
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [filter, setFilter] = useState<'pending'|'all'|'approved'|'rejected'>('pending')
  const [notes, setNotes] = useState<Record<string,string>>({})
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    if (!supabase) return
    setMessage('')
    const [requestResult, channelResult, profileResult] = await Promise.all([
      supabase.from('manual_payment_requests').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('manual_payment_channels').select('id,label,destination,account_name,instructions,active,sort_order').order('sort_order'),
      supabase.from('profiles').select('id,full_name,email,phone_no'),
    ])
    if (requestResult.error) setMessage(requestResult.error.message)
    if (channelResult.error) setMessage(channelResult.error.message)
    setRequests((requestResult.data || []) as PaymentRequest[])
    setChannels((channelResult.data || []) as Channel[])
    setProfiles((profileResult.data || []) as Profile[])
  }

  useEffect(() => { void load() }, [])

  const profileMap = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles])
  const visible = filter === 'all' ? requests : requests.filter((item) => item.status === filter)
  const pendingCount = requests.filter((item) => item.status === 'pending').length

  const review = async (id: string, action: 'approve'|'reject') => {
    if (!supabase || busy) return
    if (action === 'approve' && !window.confirm('Approve this verified transfer and unlock access?')) return
    setBusy(id)
    setMessage('')
    const { error } = await supabase.rpc('review_manual_payment_request', {
      p_request_id: id,
      p_action: action,
      p_note: notes[id]?.trim() || null,
    })
    setBusy('')
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage(action === 'approve' ? 'Payment approved and access granted.' : 'Payment rejected.')
    await load()
    onChanged?.()
  }

  const openReceipt = async (path: string | null) => {
    if (!supabase || !path) return
    const { data, error } = await supabase.storage.from('manual-payment-receipts').createSignedUrl(path, 300)
    if (error || !data?.signedUrl) {
      setMessage(error?.message || 'Could not open receipt.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const patchChannel = (id: string, patch: Partial<Channel>) => {
    setChannels((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const saveChannel = async (channel: Channel) => {
    if (!supabase || !user) return
    setBusy('channel:' + channel.id)
    const { error } = await supabase.from('manual_payment_channels').upsert({
      ...channel,
      destination: channel.destination.trim(),
      account_name: channel.account_name?.trim() || null,
      instructions: channel.instructions?.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    setBusy('')
    setMessage(error ? error.message : channel.label + ' settings saved.')
    if (!error) await load()
  }

  return (
    <div className="manualadmin">
      <section className="adminpanel manualrequestpanel">
        <div className="adminpanelhead">
          <div>
            <h2>Manual payment requests</h2>
            <p>Confirm the transfer in your InstaPay/wallet app before approving. Pending requests: <strong>{pendingCount}</strong>.</p>
          </div>
          <button className="secondary" onClick={() => void load()}><RefreshCw size={16}/>Refresh</button>
        </div>

        <div className="manualfilters" role="tablist" aria-label="Payment status filter">
          {(['pending','all','approved','rejected'] as const).map((item) => (
            <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
              {item === 'pending' ? 'Pending' : item === 'all' ? 'All' : item === 'approved' ? 'Approved' : 'Rejected'}
            </button>
          ))}
        </div>

        {message && <div className="adminmessage">{message}</div>}

        <div className="manualrequestlist">
          {visible.length ? visible.map((item) => {
            const profile = profileMap.get(item.user_id)
            const accessName = item.target_type === 'module' ? item.module_code : item.lecture_id
            return (
              <article className="manualrequestcard" key={item.id}>
                <div className="manualrequesttop">
                  <div>
                    <small>ORDER</small>
                    <strong>{item.reference_code}</strong>
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <span className={'adminbadge manual-' + item.status}>{item.status}</span>
                </div>

                <div className="manualrequestgrid">
                  <div>
                    <small>STUDENT</small>
                    <strong>{profile?.full_name || 'Student'}</strong>
                    <span>{profile?.email || item.user_id}</span>
                    {profile?.phone_no && <span>{profile.phone_no}</span>}
                  </div>
                  <div>
                    <small>ACCESS</small>
                    <strong>{accessName || '—'}</strong>
                    <span>{item.product_type} · Year {item.academic_year || '—'}</span>
                  </div>
                  <div>
                    <small>AMOUNT</small>
                    <strong>{Number(item.amount_egp)} EGP</strong>
                    <span>{item.payment_method}</span>
                  </div>
                  <div>
                    <small>TRANSACTION REFERENCE</small>
                    <strong>{item.transfer_reference}</strong>
                    {item.student_note && <span>{item.student_note}</span>}
                  </div>
                </div>

                <div className="manualrequestactions">
                  <button className="secondary" disabled={!item.receipt_path} onClick={() => void openReceipt(item.receipt_path)}>
                    <ExternalLink size={15}/>Open receipt
                  </button>

                  {item.status === 'pending' ? (
                    <div className="manualreview">
                      <input
                        value={notes[item.id] || ''}
                        onChange={(e) => setNotes((current) => ({...current,[item.id]:e.target.value}))}
                        placeholder="Admin note (optional)"
                      />
                      <button className="primary" disabled={busy === item.id} onClick={() => void review(item.id,'approve')}>
                        <Check size={15}/>Approve & unlock
                      </button>
                      <button className="secondary danger" disabled={busy === item.id} onClick={() => void review(item.id,'reject')}>
                        <X size={15}/>Reject
                      </button>
                    </div>
                  ) : (
                    <div className="manualreviewed">
                      {item.admin_note && <span>{item.admin_note}</span>}
                      <small>{item.reviewed_at ? new Date(item.reviewed_at).toLocaleString() : '—'}</small>
                    </div>
                  )}
                </div>
              </article>
            )
          }) : (
            <div className="manualempty">No manual payment requests in this view.</div>
          )}
        </div>
      </section>

      <details className="adminpanel manualchannelsettings">
        <summary>Payment channel settings</summary>
        <p>Students only see channels marked Active. Keep these settings collapsed during normal payment review.</p>
        <div className="manualchanneladmin">
          {channels.map((channel) => (
            <div className="manualchannelrow" key={channel.id}>
              <div><strong>{channel.label}</strong><small>{channel.id}</small></div>
              <label>Destination<input value={channel.destination} onChange={(e) => patchChannel(channel.id,{destination:e.target.value})} placeholder={channel.id.startsWith('instapay') ? 'InstaPay address / mobile' : 'Wallet mobile number'} /></label>
              <label>Account name<input value={channel.account_name || ''} onChange={(e) => patchChannel(channel.id,{account_name:e.target.value})} placeholder="Recipient name" /></label>
              <label>Instructions<input value={channel.instructions || ''} onChange={(e) => patchChannel(channel.id,{instructions:e.target.value})} /></label>
              <label className="manualtoggle"><input type="checkbox" checked={channel.active} onChange={(e) => patchChannel(channel.id,{active:e.target.checked})}/>Active</label>
              <button className="primary" disabled={busy === 'channel:' + channel.id || !channel.destination.trim()} onClick={() => void saveChannel(channel)}><Save size={16}/>Save</button>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
