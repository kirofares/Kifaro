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
  correct_option: 'A' | 'B' | 'C' | 'D'
  explanation: string
  question_type: string | null
  difficulty: number
  source_scope: string | null
  learning_objective: string | null
  image_url: string | null
  image_alt: string | null
  distractor_explanations: Record<string,string>
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

export function useMCQBank() {
  const { user } = useAuth()
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [levels, setLevels] = useState<MCQLevel[]>([])
  const [levelPerformance, setLevelPerformance] = useState<LevelPerformance[]>([])
  const [reviewTargets, setReviewTargets] = useState<ReviewTarget[]>([])
  const [mastery, setMastery] = useState<MasteryRow[]>([])
  const [loading, setLoading] = useState(true)

  const refreshQuestions = useCallback(async () => {
    if (!supabase) {
      setQuestions([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('mcq_questions')
      .select('id, lecture_id, topic, subtopic, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, question_type, difficulty, source_scope, learning_objective, image_url, image_alt, distractor_explanations')
      .eq('published', true)
      .order('created_at', { ascending: true })
    setQuestions((data || []) as BankQuestion[])
    setLoading(false)
  }, [])

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
    for (const q of questions) map.set(q.lecture_id, (map.get(q.lecture_id) || 0) + 1)
    return map
  }, [questions])

  const recordAttempt = useCallback(async (
    question: BankQuestion,
    selectedOption: 'A' | 'B' | 'C' | 'D',
    responseMs?: number,
  ) => {
    if (!supabase || !user) return
    await supabase.from('mcq_attempts').insert({
      user_id: user.id,
      question_id: question.id,
      lecture_id: question.lecture_id,
      selected_option: selectedOption,
      is_correct: selectedOption === question.correct_option,
      response_ms: responseMs ?? null,
    })
  }, [user])

  return {
    questions,
    levels,
    levelPerformance,
    reviewTargets,
    mastery,
    loading,
    countsByLecture,
    recordAttempt,
    refreshQuestions,
    refreshMastery,
  }
}
