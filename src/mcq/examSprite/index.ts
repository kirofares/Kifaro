import part01 from './part01'
import part02 from './part02'
import part03 from './part03'

export const examSpriteUrl = 'data:image/jpeg;base64,' + part01 + part02 + part03

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
