import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export type PricingRule = {
  id: string
  lecture_id: string
  academic_year: number | null
  nationality_match: string
  price_egp: number
  view_limit: number | null
  enabled: boolean
  priority: number
  updated_at: string
  product_type: 'video' | 'datashow' | 'bundle'
}

export type LectureOffer = {
  price: number
  viewLimit: number | null
  rule: PricingRule | null
}

function ruleScore(rule: PricingRule) {
  const yearScore = rule.academic_year == null ? 0 : 20
  const nationalityScore =
    rule.nationality_match === '*' ? 0 :
    rule.nationality_match === 'NON_EGYPTIAN' ? 5 : 10
  return yearScore + nationalityScore + Number(rule.priority || 0)
}

export function usePricingRules() {
  const [rows, setRows] = useState<PricingRule[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!supabase) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('lecture_pricing_rules')
      .select('id, lecture_id, academic_year, nationality_match, price_egp, view_limit, enabled, priority, updated_at, product_type')
      .eq('enabled', true)

    if (!error) setRows((data || []) as PricingRule[])
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const byLecture = useMemo(() => {
    const map = new Map<string, PricingRule[]>()
    for (const row of rows) {
      const list = map.get(row.lecture_id) || []
      list.push(row)
      map.set(row.lecture_id, list)
    }
    for (const list of map.values()) list.sort((a, b) => ruleScore(b) - ruleScore(a))
    return map
  }, [rows])

  const offerFor = (lectureId: string, fallbackPrice: number, productType: 'video' | 'datashow' | 'bundle' = 'bundle'): LectureOffer => {
    const rule = byLecture.get(lectureId)?.filter((item) => item.product_type === productType)[0] || null
    return {
      price: rule ? Number(rule.price_egp) : fallbackPrice,
      viewLimit: rule?.view_limit ?? null,
      rule,
    }
  }

  return { rows, byLecture, loading, refresh, offerFor }
}
