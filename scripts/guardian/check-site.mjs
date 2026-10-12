import { writeFileSync } from 'node:fs';

const BASES = ['https://kifaroedu.com/', 'https://www.kifaroedu.com/'];
const REQUEST_TIMEOUT_MS = 15000;
const checks = [];

async function check(url, kind, expectHtml = false) {
  const item = { url, kind, status: 'FAIL' };
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'user-agent': 'KIFARO-Guardian/1.0 (+github-actions)' },
    });
    item.http = response.status;
    item.final_url = response.url;
    if (!response.ok) throw new Error('HTTP ' + response.status);
    if (!response.url.startsWith('https://')) throw new Error('Redirected away from HTTPS');
    const ct = response.headers.get('content-type') || '';
    if (expectHtml && !ct.includes('text/html')) throw new Error('Expected HTML, got ' + ct);
    const body = expectHtml ? await response.text() : '';
    if (expectHtml && !body.toLowerCase().includes('kifaro')) throw new Error('KIFARO brand not found in HTML');
    item.status = 'PASS';
    checks.push(item);
    return body;
  } catch (error) {
    item.reason = String(error?.message || error).slice(0, 300);
    checks.push(item);
    return null;
  }
}

for (const base of BASES) {
  const html = await check(base, 'homepage', true);
  if (!html) continue;
  const paths = [...new Set(
    [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(m => m[1])
  )].slice(0, 8);
  if (!paths.length) checks.push({
    url: base, kind: 'asset-discovery', status: 'WARN',
    reason: 'No /assets/ references in HTML; asset test skipped',
  });
  for (const path of paths) await check(new URL(path, base).toString(), 'asset');
}
const failed = checks.filter(x => x.status === 'FAIL');
const unknown = checks.filter(x => x.status === 'WARN');
const report = {
  checked_at: new Date().toISOString(),
  website: 'KIFARO',
  status: failed.length ? 'FAIL' : unknown.length ? 'WARN' : 'PASS',
  summary: { checks: checks.length, failed: failed.length, warnings: unknown.length },
  checks,
};
writeFileSync('guardian-site-result.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
// Deliberately exit 0: a subsequent step records the issue before the workflow is marked failed.
