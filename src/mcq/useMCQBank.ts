import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

export type BankQuestion = {
  id: string
  lecture_id: string
  topic: string
  subtopic: string | null
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  question_type: string | null
  difficulty: number
  source_scope: string | null
  learning_objective: string | null
  image_url: string | null
  image_alt: string | null
}

export type MCQLevel = {
  level_no: number
  label_en: string
  label_ar: string
  short_en: string
  short_ar: string
  description_en: string
  description_ar: string
  pass_threshold: number
}

export type LevelPerformance = {
  difficulty: number
  attempts: number
  correct: number
  score: number
  last_answered_at: string
}

export type ReviewTarget = {
  lecture_id: string
  topic: string
  subtopic: string | null
  learning_objective: string | null
  difficulty: number
  attempts: number
  correct: number
  score: number
  last_answered_at: string
}

export type MasteryRow = {
  lecture_id: string
  topic: string
  attempts: number
  correct: number
  score: number
  last_answered_at: string
}

export function useMCQBank(lectureId?: string) {
  const { user } = useAuth()
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [countLectureIds, setCountLectureIds] = useState<string[]>([])
  const [levels, setLevels] = useState<MCQLevel[]>([])
  const [levelPerformance, setLevelPerformance] = useState<LevelPerformance[]>([])
  const [reviewTargets, setReviewTargets] = useState<ReviewTarget[]>([])
  const [mastery, setMastery] = useState<MasteryRow[]>([])
  const [loading, setLoading] = useState(true)

  const refreshQuestions = useCallback(async () => {
    if (!supabase) {
      setQuestions([])
      setCountLectureIds([])
      setLoading(false)
      return
    }

    setLoading(true)

    // Fetch lightweight lecture IDs in pages so coverage/counts are not capped by
    // Supabase's default row limit.
    const ids: string[] = []
    const pageSize = 1000
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('mcq_questions')
        .select('lecture_id')
        .eq('published', true)
        .eq('quality_status', 'ready')
        .range(from, from + pageSize - 1)

      if (error) break
      const rows = (data || []) as { lecture_id: string }[]
      ids.push(...rows.map((row) => row.lecture_id))
      if (rows.length < pageSize) break
    }
    setCountLectureIds(ids)

    // Only load full question payloads for the lecture currently being opened.
    if (lectureId) {
      const { data } = await supabase
        .from('mcq_questions')
        .select('id, lecture_id, topic, subtopic, question_text, option_a, option_b, option_c, option_d, question_type, difficulty, source_scope, learning_objective, image_url, image_alt')
        .eq('published', true)
        .eq('quality_status', 'ready')
        .eq('lecture_id', lectureId)
        .order('created_at', { ascending: true })

      setQuestions((data || []) as BankQuestion[])
    } else {
      setQuestions([])
    }

    setLoading(false)
  }, [lectureId])

  const refreshMastery = useCallback(async () => {
    if (!supabase || !user) {
      setMastery([])
      return
    }
    const [masteryResult, levelResult, reviewResult] = await Promise.all([
      supabase.rpc('get_my_mcq_mastery'),
      supabase.rpc('get_my_mcq_level_performance'),
      supabase.rpc('get_my_mcq_review_targets'),
    ])
    setMastery((masteryResult.data || []) as MasteryRow[])
    setLevelPerformance((levelResult.data || []) as LevelPerformance[])
    setReviewTargets((reviewResult.data || []) as ReviewTarget[])
  }, [user])

  useEffect(() => {
    void refreshQuestions()
    if (!supabase) return
    supabase
      .from('mcq_levels')
      .select('level_no, label_en, label_ar, short_en, short_ar, description_en, description_ar, pass_threshold')
      .order('level_no')
      .then(({ data }) => setLevels((data || []) as MCQLevel[]))
  }, [refreshQuestions])

  useEffect(() => {
    void refreshMastery()
  }, [refreshMastery])

  const countsByLecture = useMemo(() => {
    const map = new Map<string, number>()
    for (const id of countLectureIds) map.set(id, (map.get(id) || 0) + 1)
    return map
  }, [countLectureIds])

  const submitAnswers = useCallback(async (
    answers: { question_id: string; selected_option: 'A' | 'B' | 'C' | 'D'; response_ms?: number | null }[],
  ) => {
    if (!supabase || !user) return []
    const { data, error } = await supabase.rpc('submit_my_mcq_answers', { p_answers: answers })
    if (error) throw error
    return (data || []) as {
      question_id: string
      is_correct: boolean
      correct_option: 'A' | 'B' | 'C' | 'D'
      explanation: string
      distractor_explanations: Record<string,string>
      learning_objective: string | null
      topic: string
      subtopic: string | null
      difficulty: number
    }[]
  }, [user])

  return {
    questions,
    levels,
    levelPerformance,
    reviewTargets,
    mastery,
    loading,
    countsByLecture,
    submitAnswers,
    refreshQuestions,
    refreshMastery,
  }
}
