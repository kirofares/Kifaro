import part01 from './part01'
import part02 from './part02'
import part03 from './part03'

export const examSpriteUrl = 'data:image/jpeg;base64,' + part01 + part02 + part03

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
