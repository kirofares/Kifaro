import { writeFileSync } from 'node:fs';
import { discoverPublicAssets, verifyPublicAsset } from './public-assets.mjs';

const BASES = ['https://kifaroedu.com/', 'https://www.kifaroedu.com/'];
const results = [];
const checked = new Set();

for (const base of BASES) {
  const homepage = { url: base, kind: 'homepage', status: 'FAIL' };
  let html, deliveredUrl;
  try {
    const response = await fetch(base, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'KIFARO-Guardian/2.0 (+github-actions)' },
    });
    homepage.http = response.status;
    homepage.final_url = response.url;
    if (!response.ok) throw new Error('HTTP ' + response.status);
    if (!response.url.startsWith('https://')) throw new Error('Homepage redirected away from HTTPS');
    if (!(response.headers.get('content-type') ?? '').includes('text/html')) {
      throw new Error('Homepage did not return HTML');
    }
    html = await response.text();
    if (!html.toLowerCase().includes('kifaro')) throw new Error('Brand not found in HTML');
    deliveredUrl = response.url;
    homepage.status = 'PASS';
  } catch (e) {
    homepage.reason = String(e?.message || e).slice(0, 250);
  }
  results.push(homepage);
  if (!html) continue;

  const assets = discoverPublicAssets(html, deliveredUrl, 16);
  if (!assets.length) {
    results.push({ url: deliveredUrl, kind: 'asset-discovery', status: 'WARN',
      reason: 'No same-origin script/link/image assets discovered; resource checks not performed' });
  }
  for (const asset of assets) {
    // Both hostnames can redirect to the same canonical site. Avoid duplicate checks.
    if (checked.has(asset.url)) continue;
    checked.add(asset.url);
    results.push(await verifyPublicAsset(asset));
  }
}

const failed = results.filter(x => x.status === 'FAIL');
const warnings = results.filter(x => x.status === 'WARN');
const assetsTested = results.filter(x => ['javascript','css','image','manifest','font'].includes(x.kind)).length;
const report = {
  checked_at: new Date().toISOString(),
  website: 'KIFARO',
  status: failed.length ? 'FAIL' : warnings.length ? 'WARN' : assetsTested === 0 ? 'WARN' : 'PASS',
  summary: { checks: results.length, failed: failed.length, warnings: warnings.length, assets_tested: assetsTested },
  scope: 'Unauthenticated homepage HTML + explicitly referenced public assets only; private media untested',
  checks: results,
};
writeFileSync('guardian-site-result.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
// Report failure is enforced after GitHub Issues have been updated.
