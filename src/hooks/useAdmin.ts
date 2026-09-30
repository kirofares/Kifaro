import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useAdmin(userId?: string) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(Boolean(userId))

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!supabase || !userId) {
        if (active) {
          setIsAdmin(false)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (active) {
        setIsAdmin(!error && data?.role === 'admin')
        setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [userId])

  return { isAdmin, loading }
}
