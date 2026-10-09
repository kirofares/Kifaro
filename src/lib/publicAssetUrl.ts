const ANATOMATE_ASSET_PREFIX = '/assets/anatomate/'
const ANATOMATE_RAW_BASE = 'https://raw.githubusercontent.com/kirofares/Kifaro/main/public/assets/anatomate/'

export function publicAssetUrl(value: string | null | undefined) {
  if (!value) return ''
  if (/^(https?:|data:|blob:)/i.test(value)) return value

  const normalized = value.startsWith('/') ? value : '/' + value.replace(/^\.\//, '')

  // Anatomy teaching images must work identically on the custom domain,
  // GitHub Pages, PWA and Capacitor Android/iOS. Use the repository-backed
  // canonical URL instead of depending on each host's public-path behavior.
  if (normalized.startsWith(ANATOMATE_ASSET_PREFIX)) {
    return ANATOMATE_RAW_BASE + normalized.slice(ANATOMATE_ASSET_PREFIX.length)
  }

  const clean = normalized.replace(/^\//, '')
  try {
    return new URL(clean, document.baseURI).toString()
  } catch {
    return value
  }
}
