import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CreditCard, LockKeyhole, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
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
}

export function useModuleAccess() {
  const { user } = useAuth()
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
        .select('module_code, product_type, academic_year, revoked_at')
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
      .filter((item) => !item.revoked_at)
      .map((item) => item.module_code + '::' + item.product_type),
  ), [entitlements])

  const hasAccess = useCallback(
    (moduleCode: string, productType: ModuleProductType) =>
      owned.has(moduleCode + '::' + productType),
    [owned],
  )

  const priceFor = useCallback(
    (moduleCode: string, productType: ModuleProductType) =>
      Number(products.find((item) => item.module_code === moduleCode && item.product_type === productType)?.price_egp || 0),
    [products],
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
  const { user } = useAuth()
  const { loading, hasAccess, priceFor, buy } = useModuleAccess()
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
      <span className="eyebrow">ONE-TIME MODULE ACCESS</span>
      <h2>{labels[productType]} · {moduleCode}</h2>
      <p>{tr(
        'Pay once and keep access to this assessment section for the entire module.',
        'ادفع مرة واحدة واحتفظ بالوصول لهذا القسم من التقييمات لكل الموديول.'
      )}</p>
      <div className="moduleprice"><strong>{price || (productType === 'cases' ? 200 : 100)} EGP</strong><span>{tr('one-time payment', 'دفع مرة واحدة')}</span></div>
      <div className="modulepaywallbenefit"><ShieldCheck size={18}/>{tr('Permanent module access after successful payment', 'فتح الموديول بشكل دائم بعد نجاح الدفع')}</div>
      {message && <div className="authmessage">{message}</div>}
      <button className="primary" onClick={() => void start()} disabled={busy}>
        <CreditCard size={18}/>{busy ? tr('Opening payment…', 'جارٍ فتح الدفع…') : tr('Unlock module', 'افتح الموديول')}
      </button>
    </section>
  )
}
