import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

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
  const { user } = useAuth()
  const [rows, setRows] = useState<PricingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{ medical_year: number | null; nationality: string | null } | null>(null)

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

  useEffect(() => {
    let active = true
    const loadProfile = async () => {
      if (!supabase || !user?.id) {
        if (active) setProfile(null)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('medical_year, nationality')
        .eq('id', user.id)
        .maybeSingle()
      if (active) setProfile(data ? {
        medical_year: data.medical_year == null ? null : Number(data.medical_year),
        nationality: data.nationality == null ? null : String(data.nationality),
      } : null)
    }
    void loadProfile()
    return () => { active = false }
  }, [user?.id])

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
    const candidates = (byLecture.get(lectureId) || []).filter((item) => item.product_type === productType)
    const nationality = String(profile?.nationality || '').trim().toLowerCase()
    const matched = candidates.filter((rule) => {
      if (!profile) return rule.academic_year == null && rule.nationality_match === '*'
      const nationalityRule = String(rule.nationality_match || '*').trim()
      const nationalityMatches =
        nationalityRule === '*' ||
        nationalityRule.toLowerCase() === nationality ||
        (nationalityRule === 'NON_EGYPTIAN' && !['egyptian', 'egypt'].includes(nationality))
      const yearMatches = rule.academic_year == null || rule.academic_year === profile.medical_year
      return nationalityMatches && yearMatches
    }).sort((a, b) => ruleScore(b) - ruleScore(a))
    const rule = matched[0] || null

    return {
      price: rule ? Number(rule.price_egp) : fallbackPrice,
      viewLimit: rule?.view_limit ?? null,
      rule,
    }
  }

  return { rows, byLecture, loading, refresh, offerFor }
}
