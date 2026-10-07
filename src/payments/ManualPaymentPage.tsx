import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Copy, FileCheck2, Landmark, Phone, ReceiptText, Upload } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { anatomateLectures } from '../data/anatomate'
import { useTr } from '../i18n'
import { supabase } from '../lib/supabase'

type Channel = {
  id: string
  label: string
  destination: string
  account_name: string | null
  instructions: string | null
}

type ManualRequest = {
  id: string
  reference_code: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  amount_egp: number
  payment_method: string
  transfer_reference: string
  admin_note: string | null
  created_at: string
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100)
}

export default function ManualPaymentPage() {
  const nav = useNavigate()
  const tr = useTr()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const target = params.get('target') === 'module' ? 'module' : 'lecture'
  const lectureId = params.get('lecture') || ''
  const moduleCode = (params.get('module') || '').toUpperCase()
  const productType = params.get('product') || ''
  const requestedYear = Number(params.get('year') || 0) || null
  const requestedAmount = Number(params.get('amount') || 0)
  const requestedViewLimit = Number(params.get('viewLimit') || 0) || null

  const [channels, setChannels] = useState<Channel[]>([])
  const [channelId, setChannelId] = useState('')
  const [transferReference, setTransferReference] = useState('')
  const [studentNote, setStudentNote] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [existing, setExisting] = useState<ManualRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const lecture = useMemo(
    () => anatomateLectures.find((item) => item.id === lectureId),
    [lectureId],
  )

  const title = target === 'lecture'
    ? lecture?.title || lectureId
    : tr(
        (requestedYear ? 'Year ' + requestedYear + ' · ' : '') + 'Module ' + moduleCode,
        (requestedYear ? 'السنة ' + requestedYear + ' · ' : '') + 'موديول ' + moduleCode
      )

  const amount = existing?.amount_egp || requestedAmount
  const selectedChannel = channels.find((item) => item.id === channelId)

  const load = async () => {
    if (!supabase || !user) {
      setLoading(false)
      return
    }

    setLoading(true)
    const requestQuery = supabase
      .from('manual_payment_requests')
      .select('id, reference_code, status, amount_egp, payment_method, transfer_reference, admin_note, created_at')
      .eq('user_id', user.id)
      .eq('target_type', target)
      .eq('product_type', productType)
      .order('created_at', { ascending: false })
      .limit(1)

    if (target === 'lecture') requestQuery.eq('lecture_id', lectureId)
    else {
      requestQuery.eq('module_code', moduleCode)
      if (requestedYear) requestQuery.eq('academic_year', requestedYear)
    }

    const [channelResult, requestResult] = await Promise.all([
      supabase
        .from('manual_payment_channels')
        .select('id, label, destination, account_name, instructions')
        .eq('active', true)
        .order('sort_order'),
      requestQuery,
    ])

    const nextChannels = (channelResult.data || []) as Channel[]
    setChannels(nextChannels)
    if (!channelId && nextChannels[0]) setChannelId(nextChannels[0].id)
    setExisting(((requestResult.data || [])[0] || null) as ManualRequest | null)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [user?.id, target, lectureId, moduleCode, productType, requestedYear])

  const copyDestination = async () => {
    if (!selectedChannel?.destination) return
    await navigator.clipboard?.writeText(selectedChannel.destination)
    setMessage(tr('Payment destination copied.', 'تم نسخ بيانات التحويل.'))
  }

  const submit = async () => {
    if (!supabase || !user || busy) return
    if (!channelId || !selectedChannel) {
      setMessage(tr('Choose a payment method first.', 'اختر طريقة الدفع أولًا.'))
      return
    }
    if (!transferReference.trim()) {
      setMessage(tr('Enter the transaction reference from InstaPay or your wallet.', 'اكتب رقم العملية من InstaPay أو المحفظة.'))
      return
    }
    if (!receipt) {
      setMessage(tr('Upload the payment receipt screenshot or PDF.', 'ارفع صورة أو PDF لإيصال التحويل.'))
      return
    }
    if (receipt.size > 5 * 1024 * 1024) {
      setMessage(tr('Receipt must be 5 MB or smaller.', 'حجم الإيصال لازم يكون 5 ميجا أو أقل.'))
      return
    }
    if (!requestedAmount || requestedAmount <= 0) {
      setMessage(tr('This product does not have a valid payment amount.', 'لا يوجد مبلغ دفع صحيح لهذا المنتج.'))
      return
    }

    setBusy(true)
    setMessage('')

    const requestId = crypto.randomUUID()
    const path = `${user.id}/${requestId}/${Date.now()}-${safeFileName(receipt.name)}`

    const upload = await supabase.storage
      .from('manual-payment-receipts')
      .upload(path, receipt, { upsert: false, contentType: receipt.type || undefined })

    if (upload.error) {
      setBusy(false)
      setMessage(upload.error.message)
      return
    }

    const payload = {
      id: requestId,
      user_id: user.id,
      target_type: target,
      lecture_id: target === 'lecture' ? lectureId : null,
      module_code: target === 'module' ? moduleCode : null,
      academic_year: target === 'module' ? requestedYear : null,
      product_type: productType,
      amount_egp: requestedAmount,
      view_limit: requestedViewLimit,
      payment_method: channelId,
      transfer_reference: transferReference.trim(),
      receipt_path: path,
      student_note: studentNote.trim() || null,
    }

    const { data, error } = await supabase
      .from('manual_payment_requests')
      .insert(payload)
      .select('id, reference_code, status, amount_egp, payment_method, transfer_reference, admin_note, created_at')
      .single()

    setBusy(false)

    if (error) {
      setMessage(error.message.includes('manual_payment_one_pending_per_product')
        ? tr('You already have a pending payment for this product.', 'عندك بالفعل طلب دفع قيد المراجعة لنفس المنتج.')
        : error.message)
      return
    }

    setExisting(data as ManualRequest)
    setMessage(tr('Payment submitted. Access will open after admin verification.', 'تم إرسال الدفع. سيتم فتح المحتوى بعد مراجعة التحويل.'))
  }

  if (!user) {
    return (
      <div className="page">
        <div className="contentbox manualpaymentbox">
          <ReceiptText size={34} />
          <h1>{tr('Manual payment', 'الدفع اليدوي')}</h1>
          <p>{tr('Sign in first so the payment can be linked to your KIFARO account.', 'سجل الدخول أولًا عشان الدفع يتربط بحسابك في KIFARO.')}</p>
          <button className="primary full" onClick={() => nav('/login')}>{tr('Sign in', 'تسجيل الدخول')}</button>
        </div>
      </div>
    )
  }

  const statusLabel = existing?.status === 'approved'
    ? tr('Approved — access is active', 'تمت الموافقة — الوصول مفتوح')
    : existing?.status === 'rejected'
      ? tr('Rejected', 'مرفوض')
      : existing?.status === 'pending'
        ? tr('Pending verification', 'قيد المراجعة')
        : ''

  return (
    <div className="page">
      <div className="contentbox manualpaymentbox">
        <div className="manualpaymenthero">
          <div className="manualpaymenticon"><Landmark /></div>
          <div>
            <small>KIFARO TEMPORARY PAYMENT</small>
            <h1>{tr('Pay by InstaPay or Mobile Wallet', 'ادفع عن طريق InstaPay أو محفظة الموبايل')}</h1>
            <p>{title} · <strong>{productType.toUpperCase()}</strong></p>
          </div>
        </div>

        <div className="price">
          <strong><bdi>{amount || '—'} {tr('EGP', 'ج.م')}</bdi></strong>
          <span>{tr('Transfer the exact amount only.', 'حوّل المبلغ بالضبط فقط.')}</span>
        </div>

        {existing?.status === 'pending' || existing?.status === 'approved' ? (
          <div className={existing.status === 'approved' ? 'manualstatus approved' : 'manualstatus pending'}>
            <CheckCircle2 />
            <div>
              <strong>{statusLabel}</strong>
              <span>{tr('Order', 'رقم الطلب')}: <bdi>{existing.reference_code}</bdi></span>
              <small>{tr('Transaction reference', 'رقم العملية')}: <bdi>{existing.transfer_reference}</bdi></small>
            </div>
          </div>
        ) : (
          <>
            {loading ? (
              <div className="manualstatus pending">{tr('Loading payment methods…', 'جارٍ تحميل طرق الدفع…')}</div>
            ) : channels.length === 0 ? (
              <div className="authmessage">{tr('Manual payment methods are being configured. Please try again shortly.', 'طرق الدفع اليدوي يتم تجهيزها حاليًا. حاول مرة أخرى بعد قليل.')}</div>
            ) : (
              <>
                <div className="paymentmethodchooser manualchannels">
                  {channels.map((channel) => (
                    <button key={channel.id} className={channelId === channel.id ? 'selected' : ''} onClick={() => setChannelId(channel.id)}>
                      {channel.id === 'wallet' ? <Phone size={20}/> : <Landmark size={20}/>}
                      <div><strong>{channel.label}</strong><span>{channel.account_name || tr('Manual transfer', 'تحويل يدوي')}</span></div>
                    </button>
                  ))}
                </div>

                {selectedChannel && (
                  <div className="manualdestination">
                    <small>{tr('Send payment to', 'حوّل إلى')}</small>
                    <strong><bdi>{selectedChannel.destination}</bdi></strong>
                    {selectedChannel.account_name && <span>{selectedChannel.account_name}</span>}
                    {selectedChannel.instructions && <p>{selectedChannel.instructions}</p>}
                    <button className="secondary" onClick={() => void copyDestination()}><Copy size={16}/>{tr('Copy', 'نسخ')}</button>
                  </div>
                )}

                <div className="manualsteps">
                  <div><span>1</span><p>{tr('Transfer the exact amount using the selected method.', 'حوّل المبلغ بالضبط بالطريقة المختارة.')}</p></div>
                  <div><span>2</span><p>{tr('Copy the transaction reference from the transfer receipt.', 'انسخ رقم العملية من إيصال التحويل.')}</p></div>
                  <div><span>3</span><p>{tr('Upload the receipt and submit it for verification.', 'ارفع الإيصال وابعت الطلب للمراجعة.')}</p></div>
                </div>

                <div className="manualform">
                  <label>
                    {tr('Transaction reference', 'رقم العملية')}
                    <input value={transferReference} onChange={(e) => setTransferReference(e.target.value)} placeholder="e.g. 457812963" />
                  </label>
                  <label>
                    {tr('Receipt screenshot / PDF', 'صورة الإيصال أو PDF')}
                    <span className="manualupload">
                      <Upload size={18}/>
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} />
                      <b>{receipt?.name || tr('Choose file', 'اختر ملف')}</b>
                    </span>
                  </label>
                  <label>
                    {tr('Note (optional)', 'ملاحظة (اختياري)')}
                    <textarea value={studentNote} onChange={(e) => setStudentNote(e.target.value)} rows={3} />
                  </label>
                </div>

                <button className="primary full" disabled={busy} onClick={() => void submit()}>
                  <FileCheck2 size={18}/>{busy ? tr('Submitting…', 'جارٍ الإرسال…') : tr('I have paid — submit for verification', 'تم الدفع — إرسال للمراجعة')}
                </button>
              </>
            )}
          </>
        )}

        {existing?.status === 'rejected' && (
          <div className="authmessage">
            <strong>{statusLabel}</strong>
            {existing.admin_note && <span> · {existing.admin_note}</span>}
          </div>
        )}

        {message && <div className="authmessage">{message}</div>}
        <button className="secondary full" onClick={() => nav(-1)}>{tr('Back', 'رجوع')}</button>
        <small className="assetnote">{tr('Access is never opened from a screenshot alone. The transfer is verified first by the KIFARO admin.', 'الوصول لا يُفتح بناءً على صورة الإيصال فقط. يتم التحقق من التحويل أولًا بواسطة إدارة KIFARO.')}</small>
      </div>
    </div>
  )
}
