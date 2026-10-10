import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type LectureDocumentVariant = {
  lecture_id: string
  variant_key: string
  label: string
  description: string | null
  sort_order: number
  published: boolean
  available_pdf: boolean
  available_pptx: boolean
}

export function useLectureDocumentVariants(lectureId?: string) {
  const [variants, setVariants] = useState<LectureDocumentVariant[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase || !lectureId) {
      setVariants([])
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    supabase
      .from('lecture_document_variants_public')
      .select('lecture_id,variant_key,label,description,sort_order,published,available_pdf,available_pptx')
      .eq('lecture_id', lectureId)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        setVariants(error ? [] : ((data || []) as LectureDocumentVariant[]))
        setLoading(false)
      })

    return () => { active = false }
  }, [lectureId])

  return { variants, loading }
}
