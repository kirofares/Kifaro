// Leitner-style spaced repetition built from the flashcard_reviews history.
// Each consecutive "know" moves a card up one box; a "review" sends it back to box 0.
// Higher boxes come back after longer gaps, so well-known cards stop crowding the queue.

export type Rating = 'know' | 'review'
export type ReviewEvent = { flashcard_id: string; rating: Rating; reviewed_at: string }

export type CardSchedule = {
  box: number
  lastReviewedAt: number
  dueAt: number
}

const DAY = 24 * 60 * 60 * 1000

/** Days until the next review for each box: box 0 is due again right away. */
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30]
const MAX_BOX = BOX_INTERVAL_DAYS.length - 1

/** Builds each reviewed card's schedule. `history` may be in any order. */
export function buildSchedules(history: ReviewEvent[]): Map<string, CardSchedule> {
  const byCard = new Map<string, ReviewEvent[]>()
  for (const event of history) {
    const list = byCard.get(event.flashcard_id)
    if (list) list.push(event)
    else byCard.set(event.flashcard_id, [event])
  }

  const schedules = new Map<string, CardSchedule>()
  for (const [cardId, events] of byCard) {
    events.sort((a, b) => Date.parse(a.reviewed_at) - Date.parse(b.reviewed_at))
    let box = 0
    for (const event of events) box = event.rating === 'know' ? Math.min(box + 1, MAX_BOX) : 0
    const lastReviewedAt = Date.parse(events[events.length - 1].reviewed_at)
    schedules.set(cardId, { box, lastReviewedAt, dueAt: lastReviewedAt + BOX_INTERVAL_DAYS[box] * DAY })
  }
  return schedules
}

/** A reviewed card is due once its interval has passed; cards never reviewed are "new", not due. */
export function isDue(schedule: CardSchedule | undefined, now = Date.now()) {
  return Boolean(schedule && schedule.dueAt <= now)
}
