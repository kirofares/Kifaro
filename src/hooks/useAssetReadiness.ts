import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export type LectureAssetReadiness = {
  lecture_id: string
  has_video: boolean
  has_datashow: boolean
  has_pdf: boolean
  has_pptx: boolean
}

export function useAssetReadiness() {
  const [rows, setRows] = useState<LectureAssetReadiness[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!supabase) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .rpc('get_lecture_asset_readiness')

    if (!error) setRows((data || []) as LectureAssetReadiness[])
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const byLecture = useMemo(
    () => new Map(rows.map((row) => [row.lecture_id, row])),
    [rows],
  )

  return { rows, byLecture, loading, refresh }
}
