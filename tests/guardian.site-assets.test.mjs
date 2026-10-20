import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { discoverSiteAssets } from '../scripts/guardian/site-assets.mjs';

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
    <link HREF = "https://kifaroedu.com/assets/app.js">
    <link href="./assets/app.css?v=2">
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

function runSiteCheck(html, assetStatus = 200, redirectWww = false) {
  const directory = mkdtempSync(join(tmpdir(), 'kifaro-site-test-'));
  const mock = `globalThis.fetch = async (url) => ({
    ok: !String(url).includes('/assets/') || ${assetStatus} === 200,
    status: String(url).includes('/assets/') ? ${assetStatus} : 200,
    url: ${redirectWww} ? String(url).replace('www.kifaroedu.com', 'kifaroedu.com') : String(url),
    headers: new Headers({'content-type':'text/html'}),
    text: async () => ${JSON.stringify(html)}
  });`;
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
  assert.equal(report.checks.filter(c => c.kind === 'asset' && c.http === 200).length, 2);
});

test('missing asset references fail monitoring instead of silently skipping checks', () => {
  const report = runSiteCheck('<title>KIFARO</title>');
  assert.equal(report.status, 'FAIL');
  assert.equal(report.checks.filter(c => c.kind === 'asset-discovery' && c.status === 'FAIL').length, 2);
});

test('a broken relative JavaScript bundle fails monitoring', () => {
  const report = runSiteCheck('<title>KIFARO</title><script src="./assets/app.js"></script>', 404);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.checks.filter(c => c.kind === 'asset' && c.status === 'FAIL').length, 2);
});

test('monitor resolves assets against the final URL after the www redirect', () => {
  const report = runSiteCheck('<title>KIFARO</title><script src="./assets/app.js"></script>', 200, true);
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.checks.filter(c => c.kind === 'asset').map(c => c.url), [
    'https://kifaroedu.com/assets/app.js',
    'https://kifaroedu.com/assets/app.js',
  ]);
});
