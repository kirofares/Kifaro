// Module exam dates shown as a countdown on Home and Progress.
// Fill this in each term from the faculty's official exam schedule; nothing is shown while it is empty.
//
// Example:
//   { year: 2, moduleCode: 'MCVS-2', kind: 'final', date: '2026-12-14' },
//   { year: 2, moduleCode: 'MCVS-2', kind: 'ospe', date: '2026-12-10' },

export type ExamKind = 'mid' | 'final' | 'ospe' | 'oral'

export type ModuleExam = {
  year: 1 | 2 | 3
  /** Must match a module code in the curriculum, e.g. 'MCVS-2'. */
  moduleCode: string
  kind: ExamKind
  /** Local date of the exam, YYYY-MM-DD. */
  date: string
}

export const EXAM_CALENDAR: ModuleExam[] = []
