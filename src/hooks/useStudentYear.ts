import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

export function useStudentYear() {
  const { user } = useAuth()
  const metadataYear = Number(user?.user_metadata?.medical_year || 0) || null
  const [year, setYear] = useState<number | null>(metadataYear)
  const [loading, setLoading] = useState(Boolean(user && supabase))

  useEffect(() => {
    if (!user || !supabase) {
      setYear(metadataYear)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    supabase
      .from('profiles')
      .select('medical_year')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setYear(Number(data?.medical_year || metadataYear || 0) || null)
        setLoading(false)
      })

    return () => { active = false }
  }, [user?.id, metadataYear])

  return { year, loading }
}
