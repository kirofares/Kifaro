import type { VivaDeck } from './content'

export type VivaAnswer = { text: string; covered: number[]; checked: boolean; hintUsed: boolean }
export type VivaSession = {
  version: number
  deckId: string
  queue: string[]
  index: number
  answers: Record<string, VivaAnswer>
  revealed: boolean
  complete: boolean
  startedAt: string
}

export function newSession(deck: VivaDeck, queue = deck.questions.map((question) => question.id)): VivaSession {
  return { version: deck.version, deckId: deck.id, queue, index: 0, answers: {}, revealed: false, complete: false, startedAt: new Date().toISOString() }
}

export function sessionKey(deck: VivaDeck, userId?: string) {
  return `kifaro-viva:${userId || 'guest'}:${deck.id}`
}

export function parseSession(raw: string | null, deck: VivaDeck): VivaSession | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    const questions = new Map(deck.questions.map((question) => [question.id, question]))
    if (value.version !== deck.version || value.deckId !== deck.id ||
      !Array.isArray(value.queue) || value.queue.length === 0 || value.queue.length > questions.size ||
      !value.queue.every((id: unknown) => typeof id === 'string' && questions.has(id)) ||
      new Set(value.queue).size !== value.queue.length ||
      !Number.isInteger(value.index) || value.index < 0 || value.index >= value.queue.length ||
      typeof value.complete !== 'boolean' || typeof value.revealed !== 'boolean' ||
      typeof value.startedAt !== 'string' || !Number.isFinite(Date.parse(value.startedAt)) ||
      !value.answers || typeof value.answers !== 'object' || Array.isArray(value.answers)) return null
    for (const [id, answer] of Object.entries(value.answers)) {
      const question = questions.get(id)
      const item = answer as VivaAnswer
      if (!question || !value.queue.includes(id) || !item || typeof item.text !== 'string' || item.text.length > 4000 ||
        typeof item.checked !== 'boolean' || typeof item.hintUsed !== 'boolean' || !Array.isArray(item.covered) ||
        new Set(item.covered).size !== item.covered.length ||
        !item.covered.every((index) => Number.isInteger(index) && index >= 0 && index < question.criteria.length) ||
        (item.checked && !item.text.trim())) return null
    }
    if (value.queue.slice(0, value.index).some((id: string) => !value.answers[id]?.checked)) return null
    if (value.revealed && !value.answers[value.queue[value.index]]?.text.trim()) return null
    if (value.complete && (value.index !== value.queue.length - 1 || value.queue.some((id: string) => !value.answers[id]?.checked))) return null
    return value as VivaSession
  } catch {
    return null
  }
}

export function recordAnswer(session: VivaSession, text: string): VivaSession {
  if (session.revealed || session.complete) return session
  const id = session.queue[session.index]
  const previous = session.answers[id]
  return { ...session, answers: { ...session.answers, [id]: { text: text.slice(0, 4000), covered: [], checked: false, hintUsed: previous?.hintUsed || false } } }
}

export function revealAnswer(session: VivaSession): VivaSession {
  const answer = session.answers[session.queue[session.index]]
  return answer?.text.trim() && !session.complete ? { ...session, revealed: true } : session
}

export function useHint(session: VivaSession): VivaSession {
  const id = session.queue[session.index]
  const answer = session.answers[id] || { text: '', covered: [], checked: false, hintUsed: false }
  return { ...session, answers: { ...session.answers, [id]: { ...answer, hintUsed: true } } }
}

export function toggleCriterion(session: VivaSession, criterion: number, count: number): VivaSession {
  if (!session.revealed || session.complete || !Number.isInteger(criterion) || criterion < 0 || criterion >= count) return session
  const id = session.queue[session.index]
  const answer = session.answers[id]
  if (!answer) return session
  const covered = answer.covered.includes(criterion) ? answer.covered.filter((item) => item !== criterion) : [...answer.covered, criterion]
  return { ...session, answers: { ...session.answers, [id]: { ...answer, covered } } }
}

export function advanceSession(session: VivaSession): VivaSession {
  if (!session.revealed || session.complete) return session
  const id = session.queue[session.index]
  const answer = session.answers[id]
  if (!answer?.text.trim()) return session
  const complete = session.index === session.queue.length - 1
  return { ...session, answers: { ...session.answers, [id]: { ...answer, checked: true } }, complete,
    index: complete ? session.index : session.index + 1, revealed: false }
}

export function reviewQueue(session: VivaSession, deck: VivaDeck) {
  return session.queue.filter((id) => {
    const answer = session.answers[id]
    const question = deck.questions.find((item) => item.id === id)
    return question && (!answer?.checked || answer.covered.length < question.criteria.length || answer.hintUsed)
  })
}
