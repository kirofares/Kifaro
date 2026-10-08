import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { buildSchedules, isDue, type ReviewEvent } from './schedule'

/** Counts what the signed-in student should revise today: due flashcards and open weak points. */
export function useDueToday() {
  const { user } = useAuth()
  const [state, setState] = useState({ dueCards: 0, weakPoints: 0, loaded: false })

  useEffect(() => {
    if (!user || !supabase) {
      setState({ dueCards: 0, weakPoints: 0, loaded: false })
      return
    }
    let active = true
    const client = supabase
    void Promise.all([
      client.from('flashcard_reviews').select('flashcard_id,rating,reviewed_at').eq('user_id', user.id),
      client.rpc('get_my_active_weaknesses'),
    ]).then(([reviews, weaknesses]) => {
      if (!active) return
      const schedules = buildSchedules((reviews.data || []) as ReviewEvent[])
      let dueCards = 0
      for (const schedule of schedules.values()) if (isDue(schedule)) dueCards += 1
      setState({ dueCards, weakPoints: (weaknesses.data || []).length, loaded: !reviews.error })
    })
    return () => { active = false }
  }, [user])

  return state
}
