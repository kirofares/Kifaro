import { useNavigate } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { anatomateYears } from '../data/anatomate'
import { EXAM_CALENDAR, type ExamKind } from '../data/examCalendar'
import { useStudentYear } from '../hooks/useStudentYear'
import { useTr } from '../i18n'

const KIND_LABEL: Record<ExamKind, [string, string]> = {
  mid: ['Mid-module exam', 'امتحان منتصف الموديول'],
  final: ['Final exam', 'الامتحان النهائي'],
  ospe: ['OSPE', 'امتحان OSPE'],
  oral: ['Oral exam', 'الامتحان الشفهي'],
}

const DAY = 24 * 60 * 60 * 1000

/** Countdown to the next module exam for the student's year, with shortcuts to revise for it. */
export default function ExamCountdown() {
  const tr = useTr()
  const nav = useNavigate()
  const { year: studentYear } = useStudentYear()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const next = EXAM_CALENDAR
    .filter((exam) => !studentYear || exam.year === studentYear)
    .map((exam) => ({ ...exam, at: new Date(exam.date + 'T00:00:00').getTime() }))
    .filter((exam) => exam.at >= today.getTime())
    .sort((a, b) => a.at - b.at)[0]
  if (!next) return null

  const module = anatomateYears.find((year) => year.year === next.year)?.modules.find((item) => item.code === next.moduleCode)
  const days = Math.round((next.at - today.getTime()) / DAY)
  const [en, ar] = KIND_LABEL[next.kind]

  return (
    <div className="minicard examcountdown">
      <div className="minihead"><span className="softicon"><CalendarDays /></span><h3>{tr(en, ar)} · {next.moduleCode}</h3></div>
      <p className="countdowndays">{days === 0 ? tr('Today', 'النهارده') : tr(`In ${days} day${days === 1 ? '' : 's'}`, `بعد ${days} يوم`)}</p>
      {module && (
        <div className="duetodayrows">
          <button className="secondary" onClick={() => nav('/anatomate/year/' + next.year + '/module/' + module.slug + '/pearls')}>{tr('Exam Pearls', 'نقاط الامتحان')}</button>
          <button className="secondary" onClick={() => nav('/mcq/exam/' + next.year + '/' + module.slug)}>{tr('Timed exam', 'امتحان بالوقت')}</button>
        </div>
      )}
    </div>
  )
}
