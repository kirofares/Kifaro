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

type PublicLectureSetting = Omit<LectureSetting, 'video_url' | 'pdf_url' | 'pptx_url'>
type LectureAsset = Pick<LectureSetting, 'lecture_id' | 'video_url' | 'pdf_url' | 'pptx_url'>

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

    const [settingsResult, assetsResult] = await Promise.all([
      supabase
        .from('lecture_settings_public')
        .select('lecture_id, title_override, description_override, price_egp, access_mode, published, updated_at, updated_by'),
      supabase
        .from('lecture_assets')
        .select('lecture_id, video_url, pdf_url, pptx_url'),
    ])

    if (!settingsResult.error) {
      const assets = new Map(
        ((assetsResult.data || []) as LectureAsset[]).map((row) => [row.lecture_id, row]),
      )

      const merged = ((settingsResult.data || []) as PublicLectureSetting[]).map((row) => ({
        ...row,
        video_url: assets.get(row.lecture_id)?.video_url ?? null,
        pdf_url: assets.get(row.lecture_id)?.pdf_url ?? null,
        pptx_url: assets.get(row.lecture_id)?.pptx_url ?? null,
      }))

      setRows(merged)
    }

    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const settings = useMemo(() => new Map(rows.map((row) => [row.lecture_id, row])), [rows])

  return { settings, rows, loading, refresh }
}
