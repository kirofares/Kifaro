import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
// Static guardrails supplement tests/sql/variant-catalog-runtime.sql. They do
// not establish real JWT identity, endpoint authorization or production safety.
const sql = read('docs/guardian/proposals/secure-lecture-variant-catalog.sql').replace(/--[^\n]*/g, '');
const hook = read('src/hooks/useLectureDocumentVariants.ts');
const fields = ['lecture_id','variant_key','label','description','sort_order','published','available_pdf','available_pptx'];

test('catalog and view have the exact frontend field allowlist', () => {
  const columns = sql.match(/CREATE TABLE public\.lecture_document_variant_catalog\s*\(([\s\S]+?)\n\);/)?.[1];
  assert.ok(columns);
  const names = columns.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('PRIMARY KEY'))
    .map(line => line.split(/\s+/)[0]);
  assert.deepEqual(names, fields);
  const selected = sql.match(/AS SELECT ([\s\S]+?)\s+FROM public\.lecture_document_variant_catalog/)?.[1];
  assert.ok(selected);
  assert.deepEqual(selected.split(',').map(s => s.trim()), fields);
  assert.deepEqual(hook.match(/\.select\('([^']+)'\)/)?.[1].split(','), fields);
});

test('invoker view and published-only catalog have read-only client grants', () => {
  assert.match(sql, /WITH \(security_invoker = true\)/);
  assert.match(sql, /ALTER TABLE public\.lecture_document_variant_catalog ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FOR SELECT\s+TO anon, authenticated USING \(published IS TRUE\)/);
  for (const name of ['lecture_document_variant_catalog', 'lecture_document_variants_public']) {
    assert.ok(sql.includes(`REVOKE ALL ON public.${name} FROM PUBLIC, anon, authenticated;`));
    assert.ok(sql.includes(`GRANT SELECT ON public.${name} TO anon, authenticated;`));
  }
  assert.doesNotMatch(sql, /GRANT\s+(ALL|INSERT|UPDATE|DELETE|TRUNCATE)/i);
});

test('privileged sync is internal and covers all source mutations', () => {
  assert.match(sql, /CREATE FUNCTION private\.sync_lecture_document_variant_catalog\(\)/);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private\.sync_lecture_document_variant_catalog\(\)\s+FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON public\.lecture_document_variants/);
  assert.match(sql, /AFTER TRUNCATE ON public\.lecture_document_variants\s+FOR EACH STATEMENT/);
  assert.match(sql, /OLD\.lecture_id, OLD\.variant_key\) IS DISTINCT FROM \(NEW\.lecture_id, NEW\.variant_key/);
});

test('proposal fails on object drift and serializes backfill with source writes', () => {
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS|CREATE OR REPLACE FUNCTION|DROP POLICY|DROP TRIGGER/);
  assert.match(sql, /BEGIN;[\s\S]+SET LOCAL lock_timeout = '5s'/);
  assert.match(sql, /LOCK TABLE public\.lecture_document_variants IN SHARE ROW EXCLUSIVE MODE/);
  assert.ok(sql.indexOf('LOCK TABLE') < sql.indexOf('CREATE TABLE'));
  assert.match(sql, /COMMIT;\s*$/);
});

test('CI preserves current main checks and runs real local PostgreSQL tests', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /node-version: '22'/);
  assert.match(ci, /run: npm ci\n/);
  for (const name of ['guardian', 'auth', 'viva']) assert.ok(ci.includes(`npm run test:${name}`));
  assert.ok(ci.includes("postgres: ['15', '17']"));
  assert.ok(ci.includes('bash scripts/guardian/test-variant-rls.sh'));
  const sqlJob = ci.split('  variant-rls:')[1];
  assert.doesNotMatch(sqlJob, /secrets\.|SUPABASE|DATABASE_URL/);
});
