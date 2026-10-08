import { useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CreditCard, LockKeyhole, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useAdmin } from '../hooks/useAdmin'
import { useStudentYear } from '../hooks/useStudentYear'
import { useTr } from '../i18n'

export type ModuleProductType = 'mcq' | 'cases' | 'osce'

type ModuleProduct = {
  module_code: string
  academic_year: number
  product_type: ModuleProductType
  price_egp: number
  enabled: boolean
}

type ModuleEntitlement = {
  module_code: string
  product_type: ModuleProductType
  academic_year: number
  revoked_at: string | null
  expires_at: string
}

export function useModuleAccess() {
  const { user } = useAuth()
  const { isAdmin } = useAdmin(user?.id)
  const { year } = useStudentYear()
  const [products, setProducts] = useState<ModuleProduct[]>([])
  const [entitlements, setEntitlements] = useState<ModuleEntitlement[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!supabase || !user || !year) {
      setProducts([])
      setEntitlements([])
      setLoading(false)
      return
    }

    setLoading(true)
    const [productsResult, entitlementsResult] = await Promise.all([
      supabase
        .from('module_products')
        .select('module_code, academic_year, product_type, price_egp, enabled')
        .eq('academic_year', year)
        .eq('enabled', true),
      supabase
        .from('module_entitlements')
        .select('module_code, product_type, academic_year, revoked_at, expires_at')
        .eq('user_id', user.id)
        .eq('academic_year', year),
    ])

    setProducts((productsResult.data || []) as ModuleProduct[])
    setEntitlements((entitlementsResult.data || []) as ModuleEntitlement[])
    setLoading(false)
  }, [user?.id, year])

  useEffect(() => { void refresh() }, [refresh])

  const owned = useMemo(() => new Set(
    entitlements
      .filter((item) => !item.revoked_at && new Date(item.expires_at).getTime() > Date.now())
      .map((item) => item.academic_year + '::' + item.module_code + '::' + item.product_type),
  ), [entitlements])

  const hasAccess = useCallback(
    (moduleCode: string, productType: ModuleProductType) =>
      isAdmin || Boolean(year && owned.has(year + '::' + moduleCode + '::' + productType)),
    [owned, isAdmin, year],
  )

  const priceFor = useCallback(
    (moduleCode: string, productType: ModuleProductType) =>
      Number(products.find((item) =>
        item.academic_year === year
        && item.module_code === moduleCode
        && item.product_type === productType
      )?.price_egp || 0),
    [products, year],
  )

  const buy = useCallback(async (moduleCode: string, productType: ModuleProductType) => {
    if (!supabase || !user) throw new Error('Please log in first.')
    const { data, error } = await supabase.functions.invoke('paymob-module-checkout', {
      body: { moduleCode, productType },
    })
    if (error) throw error
    if (!data?.checkoutUrl) throw new Error(data?.error || 'Could not start payment.')
    window.location.href = String(data.checkoutUrl)
  }, [user])

  return { year, products, entitlements, loading, hasAccess, priceFor, buy, refresh }
}


export function ModuleProductSummary({
  moduleCode,
  productType,
}: {
  moduleCode: string
  productType: ModuleProductType
}) {
  const tr = useTr()
  const { loading, hasAccess, priceFor } = useModuleAccess()
  if (loading) return <span className="moduleproductsummary loading">{tr('Checking…', 'جارٍ الفحص…')}</span>
  if (hasAccess(moduleCode, productType)) {
    return <span className="moduleproductsummary owned"><ShieldCheck size={14}/>{tr('Unlocked', 'مفتوح')}</span>
  }
  const fallback = productType === 'cases' ? 200 : 100
  return <span className="moduleproductsummary"><LockKeyhole size={14}/>{priceFor(moduleCode, productType) || fallback} EGP</span>
}

export function ModuleAccessGate({
  moduleCode,
  productType,
  children,
}: {
  moduleCode: string
  productType: ModuleProductType
  children: ReactNode
}) {
  const tr = useTr()
  const nav = useNavigate()
  const { user } = useAuth()
  const { year, loading, hasAccess, priceFor, buy } = useModuleAccess()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (loading) return <div className="modulepaywall loading">{tr('Checking access…', 'جارٍ فحص صلاحية الدخول…')}</div>
  if (hasAccess(moduleCode, productType)) return <>{children}</>

  const price = priceFor(moduleCode, productType)
  const labels = {
    mcq: tr('MCQ Bank', 'بنك MCQ'),
    cases: tr('Clinical Cases', 'الحالات السريرية'),
    osce: 'OSCE / OSPE',
  }

  const start = async () => {
    if (!user) {
      setMessage(tr('Log in first to purchase this module.', 'سجل الدخول أولًا لشراء هذا الموديول.'))
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await buy(moduleCode, productType)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr('Could not start payment.', 'تعذر بدء عملية الدفع.'))
      setBusy(false)
    }
  }

  return (
    <section className="modulepaywall">
      <div className="modulepaywallicon"><LockKeyhole /></div>
      <span className="eyebrow">ONE-TIME MODULE ACCESS · YEAR {year || '—'}</span>
      <h2>{labels[productType]} · {moduleCode}</h2>
      <p>{tr(
        'Pay once and get access to this assessment section for 6 months.',
        'ادفع مرة واحدة وخد وصول لهذا القسم من التقييمات لمدة 6 شهور.'
      )}</p>
      <div className="moduleprice"><strong>{price || (productType === 'cases' ? 200 : 100)} EGP</strong><span>{tr('6-month access', 'وصول لمدة 6 شهور')}</span></div>
      <div className="modulepaywallbenefit"><ShieldCheck size={18}/>{tr('6 months of module access after successful payment', 'فتح الموديول لمدة 6 شهور بعد نجاح الدفع')}</div>
      {message && <div className="authmessage">{message}</div>}
      <div className="manualcheckoutnotice compact">
        <ShieldCheck size={18}/>
        <div>
          <strong>{tr('Manual payment is currently available', 'الدفع اليدوي هو المتاح حاليًا')}</strong>
          <span>{tr('InstaPay / mobile wallet · verified before access opens', 'InstaPay / محفظة موبايل · يتم التحقق قبل فتح الوصول')}</span>
        </div>
      </div>
      <button
        className="primary"
        onClick={() => nav(
          '/manual-payment?target=module&module=' + encodeURIComponent(moduleCode)
          + '&product=' + encodeURIComponent(productType)
          + '&year=' + encodeURIComponent(String(year || ''))
          + '&amount=' + encodeURIComponent(String(price || (productType === 'cases' ? 200 : 100)))
        )}
      >
        <CreditCard size={18}/>{tr('Continue to manual payment', 'كمّل للدفع اليدوي')}
      </button>
      <small>{tr('Card and automated gateway payments are hidden until they are enabled.', 'الدفع بالبطاقات وبوابة الدفع مخفيين مؤقتًا لحد تفعيلهم.')}</small>
    </section>
  )
}
