import { writeFileSync } from 'node:fs';
import { discoverSiteAssets, fetchAllowed, verifyPublicAsset } from './site-assets.mjs';

const BASES = ['https://kifaroedu.com/', 'https://www.kifaroedu.com/'];
const ORIGINS = BASES.map(base => new URL(base).origin);
const checks = [];
const checked = new Set();
const coverage = [];

async function checkHomepage(url) {
  const item = { url, kind: 'homepage', status: 'FAIL' };
  let response;
  try {
    const fetched = await fetchAllowed(url, ORIGINS);
    response = fetched.response;
    item.http = response.status;
    item.final_url = fetched.url;
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const ct = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (ct !== 'text/html') throw new Error('Expected HTML, got ' + ct);
    const body = await response.text();
    if (!body.toLowerCase().includes('kifaro')) throw new Error('KIFARO brand not found in HTML');
    item.status = 'PASS';
    return { body, url: fetched.url };
  } catch (error) {
    item.reason = String(error?.message || error).slice(0, 300);
    return null;
  } finally {
    await response?.body?.cancel().catch(() => {});
    checks.push(item);
  }
}

for (const base of BASES) {
  const page = await checkHomepage(base);
  if (!page) continue;
  const { assets, discovered, skipped } = discoverSiteAssets(page.body, page.url);
  coverage.push({ url: base, final_url: page.url, discovered, selected: assets.length, skipped_by_limit: skipped });
  if (!assets.some(asset => ['javascript', 'css'].includes(asset.kind))) checks.push({
    url: base, kind: 'asset-discovery', status: 'FAIL',
    reason: 'No same-origin JS/CSS references in HTML; bundle availability could not be verified',
  });
  for (const asset of assets) {
    if (checked.has(asset.url)) continue;
    checked.add(asset.url);
    checks.push(await verifyPublicAsset(asset));
  }
}
const failed = checks.filter(x => x.status === 'FAIL');
const assetsByKind = Object.fromEntries(['javascript', 'css', 'image', 'manifest', 'font'].map(kind => [
  kind, checks.filter(x => x.kind === kind).length,
]));
const report = {
  checked_at: new Date().toISOString(),
  website: 'KIFARO',
  status: failed.length ? 'FAIL' : 'PASS',
  summary: { checks: checks.length, failed: failed.length, warnings: 0, assets_tested: checked.size, assets_by_kind: assetsByKind },
  scope: 'Unauthenticated homepage HTML and explicitly referenced same-origin public assets only. CSS/JS-discovered resources, rendered app images, and private/paid media are untested. Asset probes validate MIME and a nonempty stream, not full file integrity.',
  coverage,
  checks,
};
writeFileSync('guardian-site-result.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
// Deliberately exit 0: a subsequent step records the issue before the workflow is marked failed.
