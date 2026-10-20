// Vite's base './' emits relative asset URLs on KIFARO's production site.
// Resolve against the page URL and keep probes on the same origin.
export function discoverSiteAssets(html, pageUrl) {
  const base = new URL(pageUrl);
  const assets = new Set();
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1], base);
      if (url.origin !== base.origin || !url.pathname.includes('/assets/')) continue;
      url.hash = '';
      assets.add(url.href);
    } catch {
      // Ignore malformed references; they are not safe HTTP probe targets.
    }
  }
  return [...assets].slice(0, 8);
}
