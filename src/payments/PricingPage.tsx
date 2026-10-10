import { useEffect, useState } from 'react'
import { BookOpenCheck, ChevronRight, CreditCard, LockKeyhole, RotateCcw, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useTr } from '../i18n'
import { supabase } from '../lib/supabase'

type Offer = {
  academic_year: number
  module_code: string
  product_type: 'mcq' | 'cases' | 'osce'
  price_egp: number | string
  question_count: number | string
}

const productOrder = ['mcq', 'cases', 'osce'] as const

export default function PricingPage() {
  const nav = useNavigate()
  const tr = useTr()
  const { user } = useAuth()
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError('')
      if (!supabase) throw new Error('Learning database is not configured')
      const { data, error: rpcError } = await supabase.rpc('get_public_module_prices')
      if (rpcError) throw rpcError
      if (!cancelled) {
        setOffers((data || []) as Offer[])
        setLoading(false)
      }
    }
    void run().catch((err: unknown) => {
      if (!cancelled) {
        setOffers([])
        setError(err instanceof Error ? err.message : 'Could not retrieve prices')
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [retry])

  const labels: Record<Offer['product_type'], string> = {
    mcq: tr('MCQ Bank', 'بنك أسئلة MCQ'),
    cases: tr('Clinical Cases', 'الحالات السريرية'),
    osce: tr('OSCE, OSPE & Spotters', 'محطات OSCE وOSPE وSpotters'),
  }
  const paths: Record<Offer['product_type'], string> = {
    mcq: '/mcq',
    cases: '/cases',
    osce: '/osce',
  }

  return (
    <div className="page pricingpage">
      <div className="pagehead">
        <div>
          <span className="eyebrow">KIFARO — ANATOMATE</span>
          <h1>{tr('Transparent course pricing', 'أسعار واضحة قبل الاشتراك')}</h1>
          <p>{tr(
            'Choose your academic year and module. See the current price and the number of ready published questions before you pay.',
            'اختار سنتك وموديولك وشوف السعر وعدد الأسئلة الجاهزة والمنشورة قبل ما تدفع.'
          )}</p>
        </div>
      </div>
      <section className="pricinginformation">
        <p><ShieldCheck size={19}/>{tr(
          'Assessment purchases unlock the selected module and product for 6 months after payment approval.',
          'شراء التقييمات بيفتح القسم المختار داخل الموديول لمدة ٦ شهور بعد تأكيد الدفع.'
        )}</p>
        <p><CreditCard size={19}/>{tr(
          'Manual payment via InstaPay or mobile wallet is currently available. Access opens only after transfer verification.',
          'الدفع المتاح حاليًا عن طريق InstaPay أو محفظة الموبايل، والمحتوى بيفتح بعد مراجعة التحويل.'
        )}</p>
        <p><LockKeyhole size={19}/>{tr(
          'Buying MCQs, Cases or practical stations does not include videos or datashow lectures.',
          'شراء MCQ أو Cases أو المحطات العملية لا يشمل الفيديوهات أو عروض المحاضرات.'
        )}</p>
      </section>

      {loading ? <div className="assessmentempty" role="status">{tr('Checking current prices…', 'جارٍ تحميل الأسعار الحالية…')}</div>
        : error ? <div className="assessmentempty">
            <p>{tr('Prices are temporarily unavailable. No payment can be started from this page.', 'تعذر عرض الأسعار حاليًا. لا يمكن بدء الدفع من هذه الصفحة.')}</p>
            <small>{error}</small>
            <button className="secondary" type="button" onClick={() => setRetry((value) => value + 1)}><RotateCcw size={16}/>{tr('Retry', 'إعادة المحاولة')}</button>
          </div>
        : offers.length === 0 ? <div className="assessmentempty">{tr('No assessment products are currently available.', 'لا توجد منتجات تقييمات متاحة حاليًا.')}</div>
        : <div className="pricingyearsections">
            {[...new Set(offers.map((offer) => offer.academic_year))].sort((a,b) => a-b).map((year) => (
              <section className="section" key={year}>
                <div className="sectiontitle"><h2>{tr('Medical Year ', 'سنة طب ')}{year}</h2></div>
                <div className="pricinggrid">
                  {[...new Set(offers.filter((offer) => offer.academic_year === year).map((offer) => offer.module_code))].map((moduleCode) => (
                    <article className="pricingmodule" key={moduleCode}>
                      <div className="pricingmodulehead"><BookOpenCheck size={23}/><h3>{moduleCode}</h3></div>
                      {productOrder.map((kind) => {
                        const offer = offers.find((row) => row.academic_year === year && row.module_code === moduleCode && row.product_type === kind)
                        if (!offer) return null
                        return <div className="pricingrow" key={kind}>
                          <div><strong>{labels[kind]}</strong><small>{Number(offer.question_count).toLocaleString()} {tr('ready questions / stations', 'سؤال أو محطة جاهزة')}</small></div>
                          <span><bdi>{Number(offer.price_egp).toLocaleString()} {tr('EGP', 'ج.م')}</bdi></span>
                        </div>
                      })}
                      <button className="secondary" type="button" onClick={() => nav(user ? '/assessments' : '/login')}>
                        {tr('View module and access', 'شوف الموديول وطريقة الاشتراك')} <ChevronRight size={16}/>
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>}

      <p className="assetnote">{tr(
        'Prices and content counts are refreshed from the platform database. Each purchase is limited to your registered academic year. Check the final order details before transfer.',
        'الأسعار وأعداد المحتوى بتتحدث من قاعدة بيانات المنصة. الشراء متاح لسنتك المسجلة فقط. راجع تفاصيل الطلب قبل التحويل.'
      )}</p>
      <button className="secondary" type="button" onClick={() => nav('/refund')}>{tr('Read the refund policy', 'اقرأ سياسة الاسترداد')}</button>
    </div>
  )
}
