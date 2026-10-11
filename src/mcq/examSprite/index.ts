import part01 from './part01'
import part02 from './part02'
import part03 from './part03'
import s2p1 from './s2p1'
import s2p2 from './s2p2'
import s2p4 from './s2p4'
import s3p1 from './s3p1'
import s3p2 from './s3p2'
import s3p3 from './s3p3'
import s3p4 from './s3p4'
import s3p5 from './s3p5'
import s3p6 from './s3p6'
import s3p7 from './s3p7'
import s3p8 from './s3p8'
import s3p9 from './s3p9'

export const examSpriteUrl = 'data:image/jpeg;base64,' + part01 + part02 + part03
const examSprite2Url = 'data:image/webp;base64,' + s2p1 + s2p2 + s2p4
const examSprite3Url = 'data:image/webp;base64,' + s3p1 + s3p2 + s3p3 + s3p4 + s3p5 + s3p6 + s3p7 + s3p8 + s3p9

const legacyImageSlots: Record<string, number> = {
  '/assets/anatomate/y1/lecture-01/anatomical-position-regions-exam.svg': 1,
  '/assets/anatomate/y1/lecture-01/anatomical-planes-exam.svg': 2,
  '/assets/anatomate/y1/lecture-01/directional-terms-exam.svg': 3,
  '/assets/anatomate/y1/lecture-01/body-cavities-exam.svg': 4,
  '/assets/anatomate/y1/lecture-02/bone-classification-exam.svg': 5,
  '/assets/anatomate/y1/lecture-02/bone-markings-exam.svg': 6,
  '/assets/anatomate/y1/lecture-02/humerus-landmarks.svg': 7,
  '/assets/anatomate/y1/lecture-02/long-bone-anatomy.svg': 8,
  '/assets/anatomate/y1/lecture-02/joint-types-exam.svg': 9,
  '/assets/anatomate/y1/lecture-03/synovial-joint-anatomy-exam.svg': 10,
  '/assets/anatomate/y1/lecture-03/synovial-joint-types-exam.svg': 11,
  '/assets/anatomate/y1/lecture-03/accessory-structures-exam.svg': 12,
  '/assets/anatomate/y1/lecture-03/joint-movements-exam.svg': 13,
  '/assets/anatomate/y1/lecture-09/active-passive-exam.svg': 14,
  '/assets/anatomate/y1/lecture-04/line-of-pull-exam.svg': 15,
  '/assets/anatomate/y1/lecture-20/aneuploidy-exam-v2.svg': 101,
  '/assets/anatomate/y1/lecture-13/oocyte-coverings-exam.svg': 102,
  '/assets/anatomate/y1/lecture-16/body-axes-membranes-exam.svg': 103,
  '/assets/anatomate/y1/lecture-22/clavicle-relations-fracture-exam.svg': 104,
  '/assets/anatomate/y1/lecture-15/twins-exam-v2.svg': 105,
  '/assets/anatomate/y1/lecture-22/clavicle-siding-exam.svg': 106,
  '/assets/anatomate/y1/lecture-08/gray-white-exam.svg': 107,
  '/assets/anatomate/y1/lecture-20/critical-periods-exam-v2.svg': 108,
  '/assets/anatomate/y1/lecture-05/fascial-spread-exam.svg': 109,
  '/assets/anatomate/y1/lecture-09/venous-access-exam.svg': 201,
  '/assets/anatomate/y1/lecture-04/muscle-architecture-exam.svg': 202,
  '/assets/anatomate/y1/lecture-18/lateral-folding-exam.svg': 203,
  '/assets/anatomate/y1/lecture-08/ans-exam.svg': 204,
  '/assets/anatomate/y1/lecture-13/pronuclei-zygote-exam.svg': 205,
  '/assets/anatomate/y1/lecture-13/polyspermy-block-exam.svg': 206,
  '/assets/anatomate/y1/lecture-14/trophoblast-layers-exam.svg': 207,
  '/assets/anatomate/y1/lecture-17/neural-tube-defects-exam.svg': 208,
  '/assets/anatomate/y1/lecture-19/fetal-circulation-exam.svg': 209,
  '/assets/anatomate/y1/lecture-18/cephalocaudal-folding-exam.svg': 210,
  '/assets/anatomate/y1/lecture-07/regional-drainage-exam.svg': 211,
  '/assets/anatomate/y1/lecture-12/mitosis-vs-meiosis-exam.svg': 212,
  '/assets/anatomate/y1/lecture-11/developmental-processes-exam.svg': 213,
  '/assets/anatomate/y1/lecture-14/cleavage-sequence-exam.svg': 214,
  '/assets/anatomate/y1/lecture-15/chorionic-villi-exam-v2.svg': 215,
  '/assets/anatomate/y1/lecture-17/neural-crest-migration-exam.svg': 216,
  '/assets/anatomate/y1/lecture-07/lymph-node-flow-exam.svg': 217,
  '/assets/anatomate/y1/lecture-17/neuropore-closure-exam.svg': 218,
  '/assets/anatomate/y1/lecture-15/extraembryonic-cavities-exam-v2.svg': 219,
}

export function examSpriteSlotForPath(path: string | null | undefined): number | null {
  if (!path) return null
  if (path.startsWith('sprite:')) {
    const value = Number(path.slice('sprite:'.length))
    return Number.isFinite(value) ? value : null
  }
  return legacyImageSlots[path] ?? null
}

export function examSpriteStyle(slot: number) {
  if (slot >= 201 && slot <= 219) {
    const index = slot - 201
    const col = index % 5
    const row = Math.floor(index / 5)
    return {
      backgroundImage: `url("${examSprite3Url}")`,
      backgroundSize: '500% 400%',
      backgroundPosition: `${(col / 4) * 100}% ${(row / 3) * 100}%`,
      backgroundRepeat: 'no-repeat',
    } as const
  }

  if (slot >= 101 && slot <= 109) {
    const index = slot - 101
    const col = index % 3
    const row = Math.floor(index / 3)
    return {
      backgroundImage: `url("${examSprite2Url}")`,
      backgroundSize: '300% 300%',
      backgroundPosition: `${(col / 2) * 100}% ${(row / 2) * 100}%`,
      backgroundRepeat: 'no-repeat',
    } as const
  }

  const index = Math.max(1, Math.min(16, slot)) - 1
  const col = index % 4
  const row = Math.floor(index / 4)
  return {
    backgroundImage: `url("${examSpriteUrl}")`,
    backgroundSize: '400% 400%',
    backgroundPosition: `${(col / 3) * 100}% ${(row / 3) * 100}%`,
    backgroundRepeat: 'no-repeat',
  } as const
}
