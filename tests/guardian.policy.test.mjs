import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const pages = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');

test('Nursing is part of Learn, not a top-level navigation section', () => {
  const nav = app.split('const NAV_SECTIONS: NavSection[] = [')[1]?.split('const IMMERSIVE_ROUTE')[0];
  assert.ok(nav, 'Navigation section could not be located; review this test if app structure changes');
  assert.match(nav, /key:\s*'learn'/);
  assert.match(nav, /path\.startsWith\('\/nursing'\)/);
  assert.doesNotMatch(nav, /key:\s*'nursing'/);
});

test('GitHub Pages deploys from main only, not from unreviewed PRs', () => {
  assert.match(pages, /push:\s*\n\s*branches:\s*\[main\]/);
  assert.doesNotMatch(pages, /pull_request:/);
});

test('Site deployment explicitly declares sandbox payment mode until live launch approval', () => {
  assert.match(pages, /VITE_PAYMOB_TEST_MODE:\s*'true'/);
});
