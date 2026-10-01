import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export type LectureEntitlement = {
  lecture_id: string
  price_paid_egp: number
  view_limit: number | null
  views_used: number
  revoked_at: string | null
  video_access: boolean
  datashow_access: boolean
  product_type: 'video' | 'datashow' | 'bundle'
}

export function useEntitlements(userId?: string) {
  const [rows, setRows] = useState<LectureEntitlement[]>([])
  const [loading, setLoading] = useState(Boolean(userId))

  const refresh = async () => {
    if (!supabase || !userId) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('lecture_entitlements')
      .select('lecture_id, price_paid_egp, view_limit, views_used, revoked_at, video_access, datashow_access, product_type')
      .eq('user_id', userId)
      .is('revoked_at', null)

    if (!error) setRows((data || []) as LectureEntitlement[])
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [userId])

  const entitlements = useMemo(() => new Set(rows.map((row) => row.lecture_id)), [rows])
  const videoEntitlements = useMemo(() => new Set(rows.filter((row) => row.video_access).map((row) => row.lecture_id)), [rows])
  const datashowEntitlements = useMemo(() => new Set(rows.filter((row) => row.datashow_access).map((row) => row.lecture_id)), [rows])
  const entitlementByLecture = useMemo(() => new Map(rows.map((row) => [row.lecture_id, row])), [rows])

  return { entitlements, videoEntitlements, datashowEntitlements, entitlementByLecture, rows, loading, refresh }
}
