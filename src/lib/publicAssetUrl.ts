export function publicAssetUrl(value: string | null | undefined) {
  if (!value) return ''
  if (/^(https?:|data:|blob:)/i.test(value)) return value
  const clean = value.replace(/^\.\//, '').replace(/^\//, '')
  try {
    return new URL(clean, document.baseURI).toString()
  } catch {
    return value
  }
}
