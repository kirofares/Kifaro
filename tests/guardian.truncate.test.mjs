import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('../supabase/migrations/20261104070141_revoke_public_truncate_from_assessment_tables.sql', import.meta.url), 'utf8');

test('migration only revokes TRUNCATE for public client roles', () => {
  assert.match(sql, /REVOKE TRUNCATE ON TABLE public\.%I FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(sql, /\bDROP\s+(?:TABLE|VIEW)|\bDELETE\s+FROM|\bTRUNCATE\s+TABLE/i);
  assert.doesNotMatch(sql, /\bGRANT\s+TRUNCATE/i);
});
test('all five assessment tables are protected and verified', () => {
  for (const table of ['mcq_stages','mcq_levels','module_products','module_entitlements','lecture_module_map']) {
    assert.ok(sql.includes("'" + table + "'"), table);
  }
  assert.match(sql, /has_table_privilege\('anon'/);
  assert.match(sql, /has_table_privilege\('authenticated'/);
});
