import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useEntitlements(userId?: string) {
  const [lectureIds, setLectureIds] = useState<string[]>([])
  const [loading, setLoading] = useState(Boolean(userId))

  const refresh = async () => {
    if (!supabase || !userId) {
      setLectureIds([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('lecture_entitlements')
      .select('lecture_id, revoked_at')
      .eq('user_id', userId)
      .is('revoked_at', null)

    if (!error) setLectureIds((data || []).map((row) => row.lecture_id))
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [userId])

  const entitlements = useMemo(() => new Set(lectureIds), [lectureIds])

  return { entitlements, loading, refresh }
}
