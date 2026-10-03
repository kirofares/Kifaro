export type StudyResourceKind = 'recall' | 'mcq'

export type StudyResource = {
  page: number
  title: string
  kinds: StudyResourceKind[]
}

// Curated end-of-lecture study visuals. Page numbers refer to the protected
// lecture PDF/Datashow so students can open the original slide without
// creating a separate downloadable copy.
export const studyResourcesByLecture: Record<string, StudyResource[]> = {
  // Year 1 — General Anatomy Foundations
  'y1-found-01': [
    { page: 38, title: 'Active Recall / MCQs', kinds: ['recall', 'mcq'] },
  ],
  'y1-found-02': [
    { page: 33, title: 'Image-Based Spotters', kinds: ['mcq'] },
    { page: 34, title: 'MCQs & Active Recall', kinds: ['recall', 'mcq'] },
  ],
  'y1-found-03': [
    { page: 18, title: 'Clinical Cases & MCQs', kinds: ['mcq'] },
  ],
  'y1-found-04': [
    { page: 30, title: 'Image-Based Spotters', kinds: ['mcq'] },
    { page: 31, title: 'MCQs & Active Recall', kinds: ['recall', 'mcq'] },
  ],
  'y1-found-05': [
    { page: 18, title: 'Image-Based Spotter', kinds: ['mcq'] },
    { page: 19, title: 'Active Recall', kinds: ['recall'] },
    { page: 21, title: 'Summary + 3 MCQs', kinds: ['mcq'] },
  ],
  'y1-found-06': [
    { page: 16, title: 'Summary & Active Recall', kinds: ['recall'] },
    { page: 17, title: 'MCQs', kinds: ['mcq'] },
  ],
  'y1-found-07': [
    { page: 17, title: 'MCQs — The Lymphatic System', kinds: ['mcq'] },
  ],
  'y1-found-08': [
    { page: 19, title: 'MCQs & Active Recall', kinds: ['recall', 'mcq'] },
  ],
  'y1-found-09': [
    { page: 23, title: 'MCQs & Clinical Cases', kinds: ['mcq'] },
  ],
  'y1-found-10': [
    { page: 19, title: 'AnatoMate Exam Challenge', kinds: ['mcq'] },
  ],

  // Year 2 — CNS (compiled lectures currently available)
  'y2-cns-30': [
    { page: 49, title: 'Active Recall', kinds: ['recall'] },
    { page: 50, title: 'MCQ Challenge', kinds: ['mcq'] },
  ],
  'y2-cns-31': [
    { page: 36, title: 'Active Recall', kinds: ['recall'] },
    { page: 37, title: 'MCQ Challenge', kinds: ['mcq'] },
  ],
  'y2-cns-32': [
    { page: 39, title: 'Exam Pearls + Active Recall + MCQ', kinds: ['recall', 'mcq'] },
  ],
  'y2-cns-33': [
    { page: 40, title: 'Active Recall', kinds: ['recall'] },
    { page: 41, title: 'MCQ Challenge', kinds: ['mcq'] },
  ],
  'y2-cns-34': [
    { page: 39, title: 'Master Image + Active Recall', kinds: ['recall'] },
  ],

  // Year 3 — Abdomen
  'y3-abd-02': [
    { page: 26, title: 'Active Recall', kinds: ['recall'] },
    { page: 27, title: 'MCQs — Abdominal Wall', kinds: ['mcq'] },
  ],
  'y3-abd-03': [
    { page: 30, title: 'MCQ Challenge — Inguinal Canal', kinds: ['mcq'] },
  ],
  'y3-abd-06': [
    { page: 22, title: 'MCQ Challenge — Peritoneum', kinds: ['mcq'] },
  ],
  'y3-abd-10': [
    { page: 44, title: 'Active Recall — Stomach', kinds: ['recall'] },
    { page: 45, title: 'MCQ Challenge — Stomach', kinds: ['mcq'] },
  ],
  'y3-abd-13': [
    { page: 26, title: 'Exam Pearls + Active Recall', kinds: ['recall'] },
    { page: 27, title: 'MCQ Challenge + Summary', kinds: ['mcq'] },
  ],

  // Year 3 — Head & Neck
  'y3-hn-01': [
    { page: 27, title: 'Active Recall — Oral Cavity', kinds: ['recall'] },
    { page: 28, title: 'Oral Cavity MCQs', kinds: ['mcq'] },
  ],
  'y3-hn-02': [
    { page: 41, title: 'Active Recall — Identify & Explain', kinds: ['recall'] },
    { page: 42, title: 'MCQ Challenge — Palate', kinds: ['mcq'] },
  ],
  'y3-hn-03': [
    { page: 28, title: 'Active Recall — Tongue', kinds: ['recall'] },
    { page: 28, title: 'Clinical Recall / MCQ — Tongue', kinds: ['mcq'] },
  ],
  'y3-hn-04': [
    { page: 11, title: 'Exam Pearls + Active Recall — Pharynx', kinds: ['recall'] },
  ],
}

export function getStudyResources(lectureId: string, kind: StudyResourceKind) {
  return (studyResourcesByLecture[lectureId] || []).filter((item) => item.kinds.includes(kind))
}
