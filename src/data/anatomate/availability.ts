type Readiness = { has_video?: boolean | null; has_datashow?: boolean | null }

/**
 * A lecture is available once it has authored notes or an uploaded video/Datashow.
 * Unauthored curriculum slots are shown as "in production" and left out of progress totals.
 */
export function isLectureAvailable(lecture: { placeholder?: boolean }, readiness?: Readiness) {
  return !lecture.placeholder || Boolean(readiness?.has_video || readiness?.has_datashow)
}
