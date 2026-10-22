import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { discoverSiteAssets as discover } from '../scripts/guardian/site-assets.mjs';

const discoverSiteAssets = (html, url) => discover(html, url).assets.map(x => x.url);

test('discovers Vite relative JS and CSS emitted with base ./', () => {
  assert.deepEqual(discoverSiteAssets(`
    <script type="module" crossorigin src="./assets/index-test.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-test.css">
  `, 'https://kifaroedu.com/'), [
    'https://kifaroedu.com/assets/index-test.js',
    'https://kifaroedu.com/assets/index-test.css',
  ]);
});

test('supports root paths, plain relative paths and same-origin absolute URLs without duplicates', () => {
  assert.deepEqual(discoverSiteAssets(`
    <script src='/assets/app.js'></script>
    <script src='assets/app.js#module'></script>
    <link rel="modulepreload" HREF = "https://kifaroedu.com/assets/app.js">
    <link rel="stylesheet" href="./assets/app.css?v=2">
  `, 'https://kifaroedu.com/'), [
    'https://kifaroedu.com/assets/app.js',
    'https://kifaroedu.com/assets/app.css?v=2',
  ]);
});

test('resolves relative assets beneath a project-site path', () => {
  assert.deepEqual(discoverSiteAssets('<script src="./assets/app.js"></script>',
    'https://example.github.io/Kifaro/'), ['https://example.github.io/Kifaro/assets/app.js']);
});

test('does not probe external, protocol-relative external, malformed or non-asset URLs', () => {
  assert.deepEqual(discoverSiteAssets(`
    <script src="https://other.example/assets/app.js"></script>
    <script src="//other.example/assets/app.js"></script>
    <script src="javascript:alert('/assets/')"></script>
    <link href="http://[invalid/assets/app.css">
    <link href="/manifest.webmanifest">
  `, 'https://kifaroedu.com/'), []);
});

test('limits probes to eight distinct assets', () => {
  const html = Array.from({ length: 12 }, (_, i) => `<script src="./assets/${i}.js"></script>`).join('');
  assert.equal(discoverSiteAssets(html, 'https://kifaroedu.com/').length, 8);
});

function runSiteCheck(html, assetStatus = 200, redirectWww = false, scenario = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'kifaro-site-test-'));
  const mock = `globalThis.fetch = async (url, options) => {
    if (options.redirect !== 'manual') throw new Error('Redirects must be manual');
    const u = String(url);
    const isAsset = new URL(u).pathname !== '/';
    if (${redirectWww} && u === 'https://www.kifaroedu.com/') {
      return new Response(null, {status:302, headers:{location:'https://kifaroedu.com/'}});
    }
    const scenario = ${JSON.stringify(scenario)};
    const ext = new URL(u).pathname.split('.').pop();
    const mime = {js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json',woff2:'font/woff2'}[ext];
    const body = isAsset ? (scenario.emptyAssets ? '' : 'asset bytes') : ${JSON.stringify(html)};
    const response = new Response(body, {
      status: isAsset ? ${assetStatus} : 200,
      headers: {'content-type': isAsset ? (scenario.assetType ?? mime ?? 'application/octet-stream') : 'text/html'}
    });
    Object.defineProperty(response, 'url', {value:u});
    return response;
  };`;
  try {
    const result = spawnSync(process.execPath, [
      '--import', `data:text/javascript,${encodeURIComponent(mock)}`,
      fileURLToPath(new URL('../scripts/guardian/check-site.mjs', import.meta.url)),
    ], { cwd: directory, encoding: 'utf8', timeout: 5000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(readFileSync(join(directory, 'guardian-site-result.json'), 'utf8'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('monitor actually requests relative assets on both hostnames', () => {
  const report = runSiteCheck('<title>KIFARO</title><script src="./assets/app.js"></script>');
  assert.equal(report.status, 'PASS');
  assert.equal(report.checks.filter(c => c.kind === 'javascript' && c.http === 200).length, 2);
});

test('missing asset references fail monitoring instead of silently skipping checks', () => {
  const report = runSiteCheck('<title>KIFARO</title>');
  assert.equal(report.status, 'FAIL');
  assert.equal(report.checks.filter(c => c.kind === 'asset-discovery' && c.status === 'FAIL').length, 2);
});

test('a broken relative JavaScript bundle fails monitoring', () => {
  const report = runSiteCheck('<title>KIFARO</title><script src="./assets/app.js"></script>', 404);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.checks.filter(c => c.kind === 'javascript' && c.status === 'FAIL').length, 2);
});

test('monitor resolves assets against the final URL after the www redirect', () => {
  const report = runSiteCheck('<title>KIFARO</title><script src="./assets/app.js"></script>', 200, true);
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.checks.filter(c => c.kind === 'javascript').map(c => c.url), [
    'https://kifaroedu.com/assets/app.js',
  ]);
});

test('monitor reports JS, CSS, icon, image, manifest and font once across canonical hosts', () => {
  const report = runSiteCheck('<title>KIFARO</title>'
    + '<script src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css">'
    + '<link rel="icon" href="./icons/app.svg"><link rel="apple-touch-icon" href="./icons/app.svg">'
    + '<img src="./hero.png"><link rel="manifest" href="./manifest.webmanifest">'
    + '<link rel="preload" as="font" href="./assets/font.woff2">', 200, true);
  assert.equal(report.status, 'PASS');
  assert.equal(report.summary.assets_tested, 6);
  assert.equal(report.summary.checks, 8);
  assert.deepEqual(report.summary.assets_by_kind, {javascript:1, css:1, image:2, manifest:1, font:1});
  assert.ok(report.coverage.every(x => x.discovered === 6 && x.skipped_by_limit === 0));
  assert.match(report.scope, /private\/paid media are untested/);
});

test('an icon alone cannot hide missing application bundles', () => {
  const report = runSiteCheck('<title>KIFARO</title><link rel="icon" href="./icon.svg">', 200, true);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.checks.filter(x => x.kind === 'asset-discovery').length, 2);
});

for (const scenario of [{assetType:'text/html'}, {emptyAssets:true}]) {
  test(`monitor and report gate fail on bad public asset: ${JSON.stringify(scenario)}`, () => {
    const report = runSiteCheck('<title>KIFARO</title><script src="./assets/app.js"></script><img src="./hero.png">', 200, true, scenario);
    assert.equal(report.status, 'FAIL');
    assert.equal(report.summary.failed, 2);
    const gate = spawnSync(process.execPath, [
      fileURLToPath(new URL('../scripts/guardian/assert-reports.mjs', import.meta.url)),
      '/dev/stdin',
    ], {input:JSON.stringify(report), encoding:'utf8'});
    assert.equal(gate.status, 1);
  });
}
