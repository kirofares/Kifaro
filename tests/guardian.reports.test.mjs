import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const gate = fileURLToPath(new URL('../scripts/guardian/assert-reports.mjs', import.meta.url));
const summarize = fileURLToPath(new URL('../scripts/guardian/summarize-audit.mjs', import.meta.url));

function runFixture(t, audit, site) {
  const dir = mkdtempSync(join(tmpdir(), 'kifaro-guardian-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'guardian-audit-raw.json'), JSON.stringify(audit));
  const summary = spawnSync(process.execPath, [summarize], { cwd: dir, encoding: 'utf8' });
  assert.equal(summary.status, 0, summary.stderr);
  const reports = ['guardian-audit-result.json'];
  if (site !== undefined) {
    writeFileSync(join(dir, 'guardian-site-result.json'), JSON.stringify(site));
    reports.push('guardian-site-result.json');
  }
  return spawnSync(process.execPath, [gate, ...reports], { cwd: dir, encoding: 'utf8' });
}

const cleanAudit = { metadata: { vulnerabilities: { high: 0, critical: 0 } }, vulnerabilities: {} };

test('PR dependency gate rejects the three high findings even without a site report', t => {
  const result = runFixture(t, {
    metadata: { vulnerabilities: { high: 3, critical: 0 } },
    vulnerabilities: Object.fromEntries(['image-size', 'pdfjs-dist', 'pptxgenjs'].map(name => [name, { severity: 'high' }])),
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /FAIL/);
});

test('PR dependency gate accepts a clean audit without requiring live-site requests', t => {
  assert.equal(runFixture(t, cleanAudit).status, 0);
});

test('registry failure is UNKNOWN and cannot pass the gate', t => {
  const result = runFixture(t, { error: { code: 'E503' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /UNKNOWN/);
});

test('a failing live-site report still blocks a clean dependency audit', t => {
  assert.equal(runFixture(t, cleanAudit, { status: 'FAIL' }).status, 1);
});

test('existing site coverage warnings remain visible without being treated as a failure', t => {
  const result = runFixture(t, cleanAudit, { status: 'WARN' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /WARN/);
});

test('missing, corrupt, empty, and unrecognized reports cannot pass', t => {
  const dir = mkdtempSync(join(tmpdir(), 'kifaro-guardian-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const raw of ['{', '{}', 'null', '{"status":"unexpected"}']) {
    writeFileSync(join(dir, 'report.json'), raw);
    assert.equal(spawnSync(process.execPath, [gate, 'report.json'], { cwd: dir }).status, 1);
  }
  assert.equal(spawnSync(process.execPath, [gate, 'missing.json'], { cwd: dir }).status, 1);
  assert.equal(spawnSync(process.execPath, [gate], { cwd: dir }).status, 1);
});
