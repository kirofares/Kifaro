import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

export type LectureProgressState = Record<string, {
  progress: number
  completed?: boolean
  favorite?: boolean
}>

const LOCAL_KEY = 'kifaro-progress'

function readLocal(): LectureProgressState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function useProgress() {
  const { user } = useAuth()
  const [progress, setProgress] = useState<LectureProgressState>(() => readLocal())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !supabase) {
      setProgress(readLocal())
      return
    }

    let active = true
    setLoading(true)

    supabase
      .from('lecture_progress')
      .select('lecture_id, progress, completed, favorite')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) {
          const next: LectureProgressState = {}
          for (const row of data) {
            next[row.lecture_id] = {
              progress: row.progress ?? 0,
              completed: row.completed ?? false,
              favorite: row.favorite ?? false,
            }
          }
          setProgress(next)
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  const update = useCallback(async (
    lectureId: string,
    patch: Partial<LectureProgressState[string]>,
  ) => {
    let nextRow: LectureProgressState[string] = { progress: 0 }

    setProgress((state) => {
      nextRow = { ...(state[lectureId] || { progress: 0 }), ...patch }
      const next = { ...state, [lectureId]: nextRow }
      if (!user) localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
      return next
    })

    if (user && supabase) {
      await supabase.from('lecture_progress').upsert({
        user_id: user.id,
        lecture_id: lectureId,
        progress: nextRow.progress ?? 0,
        completed: Boolean(nextRow.completed),
        favorite: Boolean(nextRow.favorite),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,lecture_id' })
    }
  }, [user])

  return { progress, update, loading }
}
