import part01 from './part01'
import part02 from './part02'
import part03 from './part03'
import s2p1 from './s2p1'
import s2p2 from './s2p2'
import s2p3 from './s2p3'
import s2p4 from './s2p4'

export const examSpriteUrl = 'data:image/jpeg;base64,' + part01 + part02 + part03
const examSprite2Url = 'data:image/webp;base64,' + s2p1 + s2p2 + s2p3 + s2p4

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
