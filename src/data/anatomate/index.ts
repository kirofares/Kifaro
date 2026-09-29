import { year1OrientationLectures, year1FoundationLectures, year1PracticalLectures } from './year1'
import { year2CnsLectures } from './year2'
import { year3AbdomenLectures, year3HeadNeckLectures } from './year3'
import type { Lecture } from '../types'

export const anatomateLectures: Lecture[] = [
  ...year1OrientationLectures,
  ...year1FoundationLectures,
  ...year1PracticalLectures,
  ...year2CnsLectures,
  ...year3AbdomenLectures,
  ...year3HeadNeckLectures,
]

export const anatomateYears = [
  {
    year: 1,
    label: 'Year 1',
    modules: [
      {
        slug: 'orientation',
        title: 'AnatoMate Orientation',
        description: 'How AnatoMate works and how to study anatomy efficiently.',
        lectures: year1OrientationLectures,
        status: 'available',
      },
      {
        slug: 'foundations',
        title: 'General Anatomy Foundations',
        description: 'The anatomical language and core concepts used throughout medical school.',
        lectures: year1FoundationLectures,
        status: 'available',
      },
      {
        slug: 'upper-limb-practical',
        title: 'Upper Limb Practical',
        description: 'Visual practical anatomy and bone identification.',
        lectures: year1PracticalLectures,
        status: 'available',
      },
    ],
  },
  {
    year: 2,
    label: 'Year 2',
    modules: [
      {
        slug: 'cns',
        title: 'Central Nervous System',
        description: 'Neurodevelopment, meninges, CSF, spinal cord, major tracts and brainstem.',
        lectures: year2CnsLectures,
        status: 'available',
      },
    ],
  },
  {
    year: 3,
    label: 'Year 3',
    modules: [
      {
        slug: 'head-neck',
        title: 'Head & Neck',
        description: 'Oral cavity, palate, tongue, pharynx and oesophagus.',
        lectures: year3HeadNeckLectures,
        status: 'available',
      },
      {
        slug: 'abdomen',
        title: 'Abdomen',
        description: 'Abdominal wall, inguinal region, peritoneum and gastrointestinal anatomy.',
        lectures: year3AbdomenLectures,
        status: 'available',
      },
      {
        slug: 'thorax',
        title: 'Thorax',
        description: 'Thoracic wall, mediastinum, lungs, heart and major thoracic structures.',
        lectures: [],
        status: 'coming-soon',
      },
      {
        slug: 'pelvis-perineum',
        title: 'Pelvis & Perineum',
        description: 'Pelvic organs, spaces, vessels, nerves and clinically important relationships.',
        lectures: [],
        status: 'coming-soon',
      },
    ],
  },
]

export const getLectureBySlug = (slug?: string) =>
  anatomateLectures.find((lecture) => lecture.slug === slug)
