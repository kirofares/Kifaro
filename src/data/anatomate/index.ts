import { year1FoundationLectures } from './year1'
import { year2CnsLectures } from './year2'
import type { Lecture } from '../types'

export const anatomateLectures: Lecture[] = [
  ...year1FoundationLectures,
  ...year2CnsLectures,
]

export const anatomateYears = [
  {
    year: 1,
    label: 'Year 1',
    modules: [
      {
        slug: 'foundations',
        title: 'General Anatomy Foundations',
        description: 'The anatomical language and core concepts used throughout medical school.',
        lectures: year1FoundationLectures,
        status: 'available',
      },
      {
        slug: 'locomotor',
        title: 'Locomotor & Skin',
        description: 'Regional musculoskeletal anatomy and integumentary integration.',
        lectures: [],
        status: 'coming-soon',
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
        description: 'Advanced regional anatomy with clinically oriented head and neck relationships.',
        lectures: [],
        status: 'coming-soon',
      },
      {
        slug: 'thorax-abdomen',
        title: 'Thorax & Abdomen',
        description: 'Integrated visceral and regional anatomy for clinical application.',
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
