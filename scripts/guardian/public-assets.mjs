// Only same-origin resources explicitly linked from the delivered HTML are probed.
// No authenticated routes, media download URLs, or guessed private paths.
const TAGS = /<(script|link|img)\b[^>]*>/gi;
const ATTR = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+))/g;

export function discoverPublicAssets(html, deliveredPageUrl, limit = 16) {
  const origin = new URL(deliveredPageUrl).origin;
  const assets = [];
  const seen = new Set();
  for (const tag of html.matchAll(TAGS)) {
    const name = tag[1].toLowerCase();
    const attrs = {};
    for (const a of tag[0].matchAll(ATTR)) {
      attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
    }
    const rel = (attrs.rel ?? '').toLowerCase().split(/\s+/);
    const href = name === 'link' ? attrs.href : attrs.src;
    if (!href || /^(?:data:|blob:|javascript:|#)/i.test(href)) continue;
    if (name === 'link' && !rel.some(x => [
      'stylesheet', 'icon', 'apple-touch-icon', 'manifest',
      'modulepreload', 'preload'
    ].includes(x))) continue;
    let resolved;
    try { resolved = new URL(href, deliveredPageUrl); } catch { continue; }
    if (resolved.origin !== origin || resolved.protocol !== 'https:') continue;
    const path = resolved.pathname.toLowerCase();
    let kind;
    if (name === 'script' || /\.(?:m?js)$/.test(path)) kind = 'javascript';
    else if (rel.includes('stylesheet') || /\.css$/.test(path)) kind = 'css';
    else if (rel.includes('manifest') || /\.(?:webmanifest|json)$/.test(path)) kind = 'manifest';
    else if (name === 'img' || /\.(?:svg|png|jpe?g|gif|webp|avif|ico)$/.test(path)) kind = 'image';
    else if (/\.(?:woff2?|ttf|otf)$/.test(path)) kind = 'font';
    else continue; // Don't probe unknown preloads or off-site resources.
    const url = resolved.href;
    if (!seen.has(url)) {
      assets.push({ url, kind });
      seen.add(url);
    }
    if (assets.length >= limit) break;
  }
  return assets;
}

export function validAssetContentType(kind, contentType) {
  const ct = (contentType || '').split(';', 1)[0].trim().toLowerCase();
  if (!ct || ct === 'text/html' || ct === 'application/xhtml+xml') return false;
  if (kind === 'javascript') return /javascript|ecmascript/.test(ct);
  if (kind === 'css') return ct === 'text/css';
  if (kind === 'image') return ct.startsWith('image/');
  if (kind === 'manifest') return ct === 'application/manifest+json' || ct === 'application/json';
  if (kind === 'font') return ct.startsWith('font/') || ct === 'application/octet-stream';
  return false;
}

export async function verifyPublicAsset(asset, request = fetch) {
  const result = { url: asset.url, kind: asset.kind, status: 'FAIL' };
  try {
    const response = await request(asset.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'KIFARO-Guardian/2.0 (+github-actions)' },
    });
    result.http = response.status;
    result.final_url = response.url;
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const actual = new URL(response.url || asset.url);
    if (actual.protocol !== 'https:' || actual.origin !== new URL(asset.url).origin) {
      throw new Error('Asset redirected away from the verified HTTPS origin');
    }
    const type = response.headers.get('content-type') || '';
    result.content_type = type.split(';', 1)[0];
    if (!validAssetContentType(asset.kind, type)) throw new Error('Unexpected asset content-type: ' + type);
    if (response.headers.get('content-length') === '0') throw new Error('Empty asset (Content-Length: 0)');
    // Read only the first chunk; avoid downloading full images or large JS bundles.
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      try {
        const first = await reader.read();
        if (first.done || !first.value?.byteLength) throw new Error('Empty response body');
      } finally {
        await reader.cancel().catch(() => {});
      }
    } else {
      if (!(await response.arrayBuffer()).byteLength) throw new Error('Empty response body');
    }
    result.status = 'PASS';
  } catch (e) {
    result.reason = String(e?.message || e).slice(0, 250);
  }
  return result;
}
