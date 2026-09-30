import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export type LectureSetting = {
  lecture_id: string
  title_override: string | null
  description_override: string | null
  price_egp: number | null
  access_mode: 'free' | 'paid' | null
  published: boolean
  video_url: string | null
  pdf_url: string | null
  pptx_url: string | null
  updated_at: string
  updated_by: string | null
}

export function useLectureSettings() {
  const [rows, setRows] = useState<LectureSetting[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!supabase) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('lecture_settings')
      .select('lecture_id, title_override, description_override, price_egp, access_mode, published, video_url, pdf_url, pptx_url, updated_at, updated_by')

    if (!error) setRows((data || []) as LectureSetting[])
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const settings = useMemo(() => new Map(rows.map((row) => [row.lecture_id, row])), [rows])

  return { settings, rows, loading, refresh }
}
