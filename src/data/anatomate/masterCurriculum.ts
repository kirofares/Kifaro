import type { Lecture } from '../types'
import { year1OrientationLectures, year1FoundationLectures, year1PracticalLectures } from './year1'
import { year2CnsLectures } from './year2'
import { year3AbdomenLectures, year3HeadNeckLectures } from './year3'

type LectureSpec = {
  sequence: number
  title: string
  existingId?: string
  system?: string
}

type ModuleSpec = {
  slug: string
  code: string
  title: string
  semester: number
  description: string
  system: string
  lectures: LectureSpec[]
}

const existingLectures = [
  ...year1OrientationLectures,
  ...year1FoundationLectures,
  ...year1PracticalLectures,
  ...year2CnsLectures,
  ...year3AbdomenLectures,
  ...year3HeadNeckLectures,
]

const existingById = new Map(existingLectures.map((lecture) => [lecture.id, lecture]))

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function makeLecture(year: 1 | 2 | 3, module: ModuleSpec, spec: LectureSpec): Lecture {
  const rich = spec.existingId ? existingById.get(spec.existingId) : undefined
  if (rich) {
    return {
      ...rich,
      year,
      module: module.title,
      sequence: spec.sequence,
      title: spec.title,
      system: spec.system || module.system,
    }
  }

  const id = `y${year}-${module.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(spec.sequence).padStart(2, '0')}`
  return {
    id,
    slug: `${id}-${slugify(spec.title)}`,
    title: spec.title,
    year,
    module: module.title,
    sequence: spec.sequence,
    duration: 50,
    system: spec.system || module.system,
    status: 'purchased',
    description: `${spec.title} — curriculum slot prepared in the Ain Shams-aligned AnatoMate sequence. Video and datashow can be uploaded from the Admin Dashboard.`,
    objectives: [
      `Understand the core anatomy of ${spec.title}`,
      'Identify the clinically important structures and relationships',
      'Apply the anatomy to common examination and clinical scenarios',
    ],
    clinical: ['Applied anatomy and clinically important relationships are covered in the lecture.'],
    pearls: ['Use structure → relationship → function → clinical relevance as the study sequence.'],
    activeRecall: [`Summarize the key anatomical map for ${spec.title} without looking at the slides.`],
    mcqs: [{
      question: `Which KIFARO module contains the lecture “${spec.title}”?`,
      options: [module.title, 'A different academic module', 'A clinical rotation', 'An elective module'],
      answer: 0,
      explanation: `This lecture is organized under ${module.title} in the AnatoMate curriculum.`,
    }],
  }
}

const year1Modules: ModuleSpec[] = [
  {
    slug: 'orientation',
    code: 'ORIENTATION',
    title: 'AnatoMate Orientation',
    semester: 0,
    description: 'How KIFARO and AnatoMate work, and how to study anatomy efficiently.',
    system: 'Orientation',
    lectures: [
      { sequence: 1, title: 'Welcome to AnatoMate', existingId: 'y1-orientation-01' },
      { sequence: 2, title: 'How to Study Anatomy', existingId: 'y1-orientation-02' },
    ],
  },
  {
    slug: 'iae-1',
    code: 'IAE-1',
    title: 'IAE-1 — Introduction to Anatomy & Embryology',
    semester: 1,
    description: 'General anatomy language and principles followed by the core embryology foundation.',
    system: 'General Anatomy & Embryology',
    lectures: [
      { sequence: 1, title: 'Introduction to Anatomy & Anatomical Terminology', existingId: 'y1-found-01' },
      { sequence: 2, title: 'Introduction to the Skeleton', existingId: 'y1-found-02' },
      { sequence: 3, title: 'Joints & Arthrology', existingId: 'y1-found-03' },
      { sequence: 4, title: 'Muscles & Myology', existingId: 'y1-found-04' },
      { sequence: 5, title: 'Fascia, Spaces & Anatomical Compartments', existingId: 'y1-found-05' },
      { sequence: 6, title: 'Blood Vessels & General Circulation', existingId: 'y1-found-06' },
      { sequence: 7, title: 'Lymphatic System', existingId: 'y1-found-07' },
      { sequence: 8, title: 'Introduction to the Nervous System', existingId: 'y1-found-08' },
      { sequence: 9, title: 'Surface & Living Anatomy' },
      { sequence: 10, title: 'General Anatomy Integration & Clinical Applications', existingId: 'y1-found-10' },
      { sequence: 11, title: 'Introduction to Embryology' },
      { sequence: 12, title: 'Gametogenesis' },
      { sequence: 13, title: 'Fertilization' },
      { sequence: 14, title: 'First Week of Development' },
      { sequence: 15, title: 'Second Week of Development' },
      { sequence: 16, title: 'Third Week of Development — Gastrulation' },
      { sequence: 17, title: 'Neurulation & Neural Crest' },
      { sequence: 18, title: 'Embryonic Folding' },
      { sequence: 19, title: 'Placenta & Fetal Membranes' },
      { sequence: 20, title: 'Congenital Anomalies & Clinical Embryology' },
    ],
  },
  {
    slug: 'mls-1',
    code: 'MLS-1',
    title: 'MLS-1 — Locomotor System & Skin',
    semester: 2,
    description: 'Upper limb, lower limb, back, vertebral column, skin and integrated locomotor anatomy.',
    system: 'Locomotor System',
    lectures: [
      { sequence: 21, title: 'Upper Limb Overview & Osteology' },
      { sequence: 22, title: 'Clavicle' },
      { sequence: 23, title: 'Scapula Practical', existingId: 'y1-practical-scapula' },
      { sequence: 24, title: 'Humerus' },
      { sequence: 25, title: 'Radius & Ulna' },
      { sequence: 26, title: 'Bones of the Hand' },
      { sequence: 27, title: 'Pectoral Region & Breast' },
      { sequence: 28, title: 'Axilla' },
      { sequence: 29, title: 'Brachial Plexus' },
      { sequence: 30, title: 'Scapular Region' },
      { sequence: 31, title: 'Shoulder Joint' },
      { sequence: 32, title: 'Arm' },
      { sequence: 33, title: 'Cubital Fossa' },
      { sequence: 34, title: 'Forearm — Flexor Compartment' },
      { sequence: 35, title: 'Forearm — Extensor Compartment' },
      { sequence: 36, title: 'Wrist & Hand' },
      { sequence: 37, title: 'Upper Limb Vessels & Lymphatics' },
      { sequence: 38, title: 'Upper Limb Nerves & Clinical Anatomy' },
      { sequence: 39, title: 'Lower Limb Overview & Osteology' },
      { sequence: 40, title: 'Hip Bone & Femur' },
      { sequence: 41, title: 'Tibia, Fibula & Patella' },
      { sequence: 42, title: 'Bones of the Foot' },
      { sequence: 43, title: 'Gluteal Region' },
      { sequence: 44, title: 'Hip Joint' },
      { sequence: 45, title: 'Thigh — Anterior & Medial Compartments' },
      { sequence: 46, title: 'Thigh — Posterior Compartment' },
      { sequence: 47, title: 'Femoral Triangle & Adductor Canal' },
      { sequence: 48, title: 'Popliteal Fossa' },
      { sequence: 49, title: 'Knee Joint' },
      { sequence: 50, title: 'Leg Compartments' },
      { sequence: 51, title: 'Ankle & Foot' },
      { sequence: 52, title: 'Lower Limb Vessels & Lymphatics' },
      { sequence: 53, title: 'Lower Limb Nerves & Clinical Anatomy' },
      { sequence: 54, title: 'Vertebral Column' },
      { sequence: 55, title: 'Back Muscles & Suboccipital Region' },
      { sequence: 56, title: 'Spinal Nerves & Dermatomes' },
      { sequence: 57, title: 'Skin & Integumentary System', existingId: 'y1-found-09' },
      { sequence: 58, title: 'Surface & Living Anatomy of the Limbs' },
      { sequence: 59, title: 'Locomotor Clinical Integration' },
      { sequence: 60, title: 'MLS-1 Revision & Exam Pearls' },
    ],
  },
]

const year2Modules: ModuleSpec[] = [
  {
    slug: 'mbl-2',
    code: 'MBL-2',
    title: 'MBL-2 — Blood & Lymphatic System',
    semester: 1,
    description: 'Lymphatic channels, organs, territories and clinically important drainage patterns.',
    system: 'Blood & Lymphatic',
    lectures: [
      { sequence: 1, title: 'Introduction to the Lymphatic System' },
      { sequence: 2, title: 'Thoracic Duct & Right Lymphatic Duct' },
      { sequence: 3, title: 'Lymph Nodes' },
      { sequence: 4, title: 'Spleen' },
      { sequence: 5, title: 'Thymus' },
      { sequence: 6, title: 'Major Lymphatic Territories & Clinical Lymphatics' },
    ],
  },
  {
    slug: 'mrs-2',
    code: 'MRS-2',
    title: 'MRS-2 — Respiratory System',
    semester: 1,
    description: 'Upper and lower respiratory anatomy, thoracic wall, pleura, lungs and diaphragm.',
    system: 'Respiratory System',
    lectures: [
      { sequence: 7, title: 'Overview of Respiratory Anatomy' },
      { sequence: 8, title: 'Nose & Nasal Cavity' },
      { sequence: 9, title: 'Paranasal Sinuses' },
      { sequence: 10, title: 'Larynx — Framework' },
      { sequence: 11, title: 'Larynx — Muscles & Interior' },
      { sequence: 12, title: 'Trachea & Main Bronchi' },
      { sequence: 13, title: 'Thoracic Wall' },
      { sequence: 14, title: 'Pleura' },
      { sequence: 15, title: 'Lungs' },
      { sequence: 16, title: 'Bronchopulmonary Segments' },
      { sequence: 17, title: 'Diaphragm & Respiratory Mechanics — Anatomical Basis' },
    ],
  },
  {
    slug: 'mcvs-2',
    code: 'MCVS-2',
    title: 'MCVS-2 — Cardiovascular System',
    semester: 1,
    description: 'Mediastinum, pericardium, heart chambers, valves, coronary circulation and great vessels.',
    system: 'Cardiovascular System',
    lectures: [
      { sequence: 18, title: 'Introduction to the Mediastinum' },
      { sequence: 19, title: 'Pericardium' },
      { sequence: 20, title: 'Heart — External Anatomy' },
      { sequence: 21, title: 'Right Atrium & Right Ventricle' },
      { sequence: 22, title: 'Left Atrium & Left Ventricle' },
      { sequence: 23, title: 'Heart Valves' },
      { sequence: 24, title: 'Coronary Circulation' },
      { sequence: 25, title: 'Conducting System of the Heart' },
      { sequence: 26, title: 'Great Vessels' },
      { sequence: 27, title: 'Major Arterial & Venous Patterns' },
      { sequence: 28, title: 'Development of the Heart & Fetal Circulation' },
    ],
  },
  {
    slug: 'mcns-2',
    code: 'MCNS-2',
    title: 'MCNS-2 — Central Nervous System',
    semester: 2,
    description: 'Development, meninges, CSF, spinal cord, tracts, brainstem and major brain structures.',
    system: 'Central Nervous System',
    lectures: [
      { sequence: 29, title: 'Organization of the Central Nervous System' },
      { sequence: 30, title: 'Development of the Central Nervous System', existingId: 'y2-cns-30' },
      { sequence: 31, title: 'Meninges', existingId: 'y2-cns-31' },
      { sequence: 32, title: 'Ventricular System & Cerebrospinal Fluid', existingId: 'y2-cns-32' },
      { sequence: 33, title: 'Spinal Cord — External Anatomy', existingId: 'y2-cns-33' },
      { sequence: 34, title: 'Spinal Cord — Internal Structure', existingId: 'y2-cns-34' },
      { sequence: 35, title: 'Ascending Tracts', existingId: 'y2-cns-35' },
      { sequence: 36, title: 'Descending Tracts', existingId: 'y2-cns-36' },
      { sequence: 37, title: 'Medulla Oblongata', existingId: 'y2-cns-37' },
      { sequence: 38, title: 'Pons', existingId: 'y2-cns-38' },
      { sequence: 39, title: 'Midbrain' },
      { sequence: 40, title: 'Cranial Nerve Nuclei — Introduction & Organization' },
      { sequence: 41, title: 'Cerebellum' },
      { sequence: 42, title: 'Thalamus' },
      { sequence: 43, title: 'Hypothalamus' },
      { sequence: 44, title: 'Cerebral Hemispheres' },
      { sequence: 45, title: 'Internal Capsule & Basal Ganglia' },
      { sequence: 46, title: 'Limbic System' },
      { sequence: 47, title: 'Blood Supply of the Brain' },
    ],
  },
  {
    slug: 'mss-2',
    code: 'MSS-2',
    title: 'MSS-2 — Special Senses',
    semester: 2,
    description: 'Orbit, eye, visual pathway, ear and auditory/vestibular pathways.',
    system: 'Special Senses',
    lectures: [
      { sequence: 48, title: 'Orbit & Orbital Walls' },
      { sequence: 49, title: 'Eyeball — Coats & Chambers' },
      { sequence: 50, title: 'Extraocular Muscles' },
      { sequence: 51, title: 'Lacrimal Apparatus' },
      { sequence: 52, title: 'Visual Pathway' },
      { sequence: 53, title: 'External & Middle Ear' },
      { sequence: 54, title: 'Inner Ear' },
      { sequence: 55, title: 'Auditory & Vestibular Pathways' },
    ],
  },
  {
    slug: 'mem-2',
    code: 'MEM-2',
    title: 'MEM-2 — Endocrine System & Metabolism',
    semester: 2,
    description: 'Anatomy of the major endocrine glands with developmental and clinical integration.',
    system: 'Endocrine System',
    lectures: [
      { sequence: 56, title: 'Pituitary Gland' },
      { sequence: 57, title: 'Thyroid Gland' },
      { sequence: 58, title: 'Parathyroid Glands' },
      { sequence: 59, title: 'Suprarenal (Adrenal) Glands' },
      { sequence: 60, title: 'Development & Integrated Anatomy of Endocrine Glands' },
    ],
  },
]

const year3Modules: ModuleSpec[] = [
  {
    slug: 'mgl-3',
    code: 'MGL-3',
    title: 'MGL-3 — Gastrointestinal System & Liver',
    semester: 1,
    description: 'Upper GIT, abdominal wall, peritoneum, gastrointestinal viscera, hepatobiliary system and abdominal neurovascular anatomy.',
    system: 'Gastrointestinal System',
    lectures: [
      { sequence: 1, title: 'Oral Cavity', existingId: 'y3-hn-01', system: 'Upper GIT' },
      { sequence: 2, title: 'Palate', existingId: 'y3-hn-02', system: 'Upper GIT' },
      { sequence: 3, title: 'Tongue', existingId: 'y3-hn-03', system: 'Upper GIT' },
      { sequence: 4, title: 'Salivary Glands', system: 'Upper GIT' },
      { sequence: 5, title: 'Pharynx', existingId: 'y3-hn-04', system: 'Upper GIT' },
      { sequence: 6, title: 'Oesophagus — Cervical & Thoracic Parts', existingId: 'y3-hn-05', system: 'Upper GIT' },
      { sequence: 7, title: 'Introduction to Abdomen & Abdominal Regions', existingId: 'y3-abd-01' },
      { sequence: 8, title: 'Anterior Abdominal Wall', existingId: 'y3-abd-02' },
      { sequence: 9, title: 'Rectus Sheath', existingId: 'y3-abd-05' },
      { sequence: 10, title: 'Inguinal Canal', existingId: 'y3-abd-03' },
      { sequence: 11, title: 'Inguinal Hernias — Applied Anatomy', existingId: 'y3-abd-04' },
      { sequence: 12, title: 'Peritoneum & Peritoneal Cavity', existingId: 'y3-abd-06' },
      { sequence: 13, title: 'Peritoneal Folds, Mesenteries & Omenta' },
      { sequence: 14, title: 'Lesser Sac & Epiploic Foramen' },
      { sequence: 15, title: 'Abdominal Oesophagus', existingId: 'y3-abd-09' },
      { sequence: 16, title: 'Stomach', existingId: 'y3-abd-10' },
      { sequence: 17, title: 'Duodenum' },
      { sequence: 18, title: 'Jejunum & Ileum' },
      { sequence: 19, title: 'Cecum & Vermiform Appendix', existingId: 'y3-abd-13' },
      { sequence: 20, title: 'Colon' },
      { sequence: 21, title: 'Rectum & Anal Canal' },
      { sequence: 22, title: 'Liver — Gross Anatomy' },
      { sequence: 23, title: 'Liver — Relations, Ligaments & Segmentation' },
      { sequence: 24, title: 'Gallbladder & Biliary Apparatus' },
      { sequence: 25, title: 'Pancreas' },
      { sequence: 26, title: 'Spleen' },
      { sequence: 27, title: 'Portal Vein & Portosystemic Anastomoses' },
      { sequence: 28, title: 'Abdominal Aorta & Major Branches' },
      { sequence: 29, title: 'IVC & Abdominal Venous Drainage' },
      { sequence: 30, title: 'Lymphatic Drainage of GIT' },
      { sequence: 31, title: 'Autonomic Innervation of GIT' },
      { sequence: 32, title: 'Posterior Abdominal Wall' },
      { sequence: 33, title: 'Integrated Clinical Anatomy of the Abdomen & GIT' },
    ],
  },
  {
    slug: 'mug-3',
    code: 'MUG-3',
    title: 'MUG-3 — Urogenital System',
    semester: 1,
    description: 'Urinary system, pelvis, reproductive organs, perineum and integrated urogenital anatomy.',
    system: 'Urogenital System',
    lectures: [
      { sequence: 1, title: 'Introduction to Urinary System' },
      { sequence: 2, title: 'Kidneys — External Anatomy & Relations' },
      { sequence: 3, title: 'Kidney — Internal Anatomy' },
      { sequence: 4, title: 'Renal Blood Supply' },
      { sequence: 5, title: 'Ureters' },
      { sequence: 6, title: 'Urinary Bladder' },
      { sequence: 7, title: 'Male & Female Urethra' },
      { sequence: 8, title: 'Introduction to Bony Pelvis' },
      { sequence: 9, title: 'Pelvic Walls & Fascia' },
      { sequence: 10, title: 'Pelvic Floor' },
      { sequence: 11, title: 'Pelvic Peritoneum & Spaces' },
      { sequence: 12, title: 'Pelvic Vessels & Lymphatics' },
      { sequence: 13, title: 'Pelvic Autonomic Nervous System' },
      { sequence: 14, title: 'Male Reproductive System — Overview' },
      { sequence: 15, title: 'Testis & Epididymis' },
      { sequence: 16, title: 'Spermatic Cord' },
      { sequence: 17, title: 'Vas Deferens & Seminal Vesicles' },
      { sequence: 18, title: 'Prostate' },
      { sequence: 19, title: 'Male External Genitalia' },
      { sequence: 20, title: 'Female Reproductive System — Overview' },
      { sequence: 21, title: 'Ovary' },
      { sequence: 22, title: 'Uterine Tube' },
      { sequence: 23, title: 'Uterus' },
      { sequence: 24, title: 'Supports of the Uterus' },
      { sequence: 25, title: 'Vagina' },
      { sequence: 26, title: 'Female External Genitalia' },
      { sequence: 27, title: 'Perineum' },
      { sequence: 28, title: 'Ischioanal Fossa' },
      { sequence: 29, title: 'Male Perineum' },
      { sequence: 30, title: 'Female Perineum' },
      { sequence: 31, title: 'Integrated Clinical Anatomy of Pelvis & Urogenital System' },
    ],
  },
]

const buildModule = (year: 1 | 2 | 3, module: ModuleSpec) => ({
  ...module,
  status: 'available' as const,
  lectures: module.lectures.map((spec, index) => {
    const lecture = makeLecture(year, module, spec)
    // The opening lecture of every block is a free sample of the full lesson.
    return index === 0 ? { ...lecture, status: 'free' as const } : lecture
  }),
})

export const anatomateYears = [
  {
    year: 1 as const,
    label: 'Year 1',
    modules: year1Modules.map((module) => buildModule(1, module)),
  },
  {
    year: 2 as const,
    label: 'Year 2',
    modules: year2Modules.map((module) => buildModule(2, module)),
  },
  {
    year: 3 as const,
    label: 'Year 3',
    modules: year3Modules.map((module) => buildModule(3, module)),
  },
]

export const anatomateLectures: Lecture[] = anatomateYears.flatMap((year) =>
  year.modules.flatMap((module) => module.lectures),
)

export const getLectureBySlug = (slug?: string) =>
  anatomateLectures.find((lecture) => lecture.slug === slug)
