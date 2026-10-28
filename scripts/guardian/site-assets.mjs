// Discover only resources explicitly referenced by public homepage HTML.
// Vite's relative URLs resolve against the final page URL (including www -> apex).
// Consume whole tags, including unrelated tags, so quoted markup cannot become
// a resource and a quoted '>' cannot truncate src/href attributes.
const TAGS = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:-]*)(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
const ATTR = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+))/g;
export const ASSET_LIMIT = 16;
const PRELOAD_KINDS = new Map([['script', 'javascript'], ['style', 'css'], ['image', 'image'], ['font', 'font']]);
const RAW_TEXT_TAGS = new Set(['script', 'style', 'title', 'textarea', 'xmp', 'iframe', 'noembed', 'noframes']);

function* resourceTags(html) {
  const tokens = new RegExp(TAGS);
  let tag;
  while ((tag = tokens.exec(html))) {
    if (!tag[1] || tag[0].startsWith('</')) continue;
    const name = tag[1].toLowerCase();
    if (RAW_TEXT_TAGS.has(name)) {
      const closing = new RegExp(`</${name}(?=[\\s/>])[^>]*>`, 'gi');
      closing.lastIndex = tokens.lastIndex;
      tokens.lastIndex = closing.exec(html) ? closing.lastIndex : html.length;
    }
    if (['script', 'link', 'img'].includes(name)) yield tag;
  }
}

export function discoverSiteAssets(html, pageUrl) {
  const base = new URL(pageUrl);
  const assets = new Map();
  for (const tag of resourceTags(html)) {
    const name = tag[1].toLowerCase();
    const attrs = Object.create(null);
    for (const a of tag[0].matchAll(ATTR)) {
      const key = a[1].toLowerCase();
      if (!(key in attrs)) attrs[key] = a[2] ?? a[3] ?? a[4] ?? '';
    }
    const rel = (attrs.rel ?? '').toLowerCase().split(/\s+/);
    const as = (attrs.as ?? '').toLowerCase();
    const ref = name === 'link' ? attrs.href : attrs.src;
    if (!ref || /^(?:data:|blob:|javascript:|#)/i.test(ref.trim())) continue;
    let kind;
    if (name === 'script') kind = 'javascript';
    else if (name === 'img') kind = 'image';
    else if (rel.includes('stylesheet')) kind = 'css';
    else if (rel.includes('manifest')) kind = 'manifest';
    else if (rel.some(x => ['icon', 'apple-touch-icon', 'mask-icon'].includes(x))) kind = 'image';
    else if (rel.includes('modulepreload')) kind = 'javascript';
    else if (rel.includes('preload')) kind = PRELOAD_KINDS.get(as);
    if (!kind) continue; // No navigation, document/media links or unknown preloads.
    try {
      const url = new URL(ref.replace(/&amp;/gi, '&'), base);
      if (url.protocol !== 'https:' || url.origin !== base.origin || url.username || url.password) continue;
      url.hash = '';
      if (!assets.has(url.href)) assets.set(url.href, { url: url.href, kind });
    } catch { /* Malformed references are not safe probe targets. */ }
  }
  // Keep the original eight-bundle budget; extras cannot crowd out JS/CSS.
  const all = [...assets.values()];
  const bundles = all.filter(x => ['javascript', 'css'].includes(x.kind));
  const extras = all.filter(x => !['javascript', 'css'].includes(x.kind));
  const selected = [...bundles.slice(0, 8), ...extras.slice(0, ASSET_LIMIT - Math.min(bundles.length, 8))];
  return { assets: selected, discovered: all.length, skipped: all.length - selected.length };
}

export function validAssetContentType(kind, contentType) {
  const ct = (contentType || '').split(';', 1)[0].trim().toLowerCase();
  if (kind === 'javascript') return /^(?:text|application)\/(?:javascript|ecmascript|x-javascript)$/.test(ct);
  if (kind === 'css') return ct === 'text/css';
  if (kind === 'image') return /^image\/[a-z0-9.+-]+$/.test(ct);
  if (kind === 'manifest') return ['application/manifest+json', 'application/json'].includes(ct);
  if (kind === 'font') return /^font\/[a-z0-9.+-]+$/.test(ct) || ['application/font-woff', 'application/x-font-ttf', 'application/x-font-opentype', 'application/vnd.ms-fontobject', 'application/octet-stream'].includes(ct);
  return false;
}

async function cancelBody(response) {
  await response.body?.cancel().catch(() => {});
}

// Validate each hop BEFORE fetching it. Checking response.url after automatic
// redirects is too late: the request may already have reached a foreign host.
export async function fetchAllowed(url, allowedOrigins, request = fetch) {
  const signal = AbortSignal.timeout(15000);
  let target = new URL(url);
  for (let hop = 0; hop <= 5; hop++) {
    if (target.protocol !== 'https:' || !allowedOrigins.includes(target.origin) || target.username || target.password) {
      throw new Error('Redirect target is outside the allowed HTTPS origins');
    }
    const response = await request(target.href, {
      method: 'GET', redirect: 'manual', signal,
      headers: { 'user-agent': 'KIFARO-Guardian/2.0 (+github-actions)' },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await cancelBody(response);
      if (!location) throw new Error('Redirect is missing Location');
      if (hop === 5) throw new Error('Too many redirects');
      target = new URL(location, target);
      continue;
    }
    // Defensive guard for nonstandard fetch implementations.
    const final = new URL(response.url || target.href);
    if (final.protocol !== 'https:' || !allowedOrigins.includes(final.origin) || final.username || final.password) {
      await cancelBody(response);
      throw new Error('Response is outside the allowed HTTPS origins');
    }
    return { response, url: final.href };
  }
}

export async function verifyPublicAsset(asset, request = fetch) {
  const result = { url: asset.url, kind: asset.kind, status: 'FAIL' };
  let response;
  try {
    const fetched = await fetchAllowed(asset.url, [new URL(asset.url).origin], request);
    response = fetched.response;
    result.http = response.status;
    result.final_url = fetched.url;
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const type = response.headers.get('content-type') || '';
    result.content_type = type.split(';', 1)[0].trim().toLowerCase();
    if (!validAssetContentType(asset.kind, type)) throw new Error('Unexpected asset content-type: ' + type);
    if (response.headers.get('content-length') === '0') throw new Error('Empty asset (Content-Length: 0)');
    if (!response.body) throw new Error('Empty response body');
    // Read only the first nonempty chunk, then cancel the remaining download.
    const reader = response.body.getReader();
    try {
      let first;
      do { first = await reader.read(); } while (!first.done && !first.value?.byteLength);
      if (first.done) throw new Error('Empty response body');
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    result.status = 'PASS';
  } catch (error) {
    result.reason = String(error?.message || error).slice(0, 300);
  } finally {
    if (response) await cancelBody(response);
  }
  return result;
}
