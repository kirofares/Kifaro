import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { prepareBatch, sha256 } from '../scripts/spotters/prepare-batch.mjs'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'spotter-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  // Minimal test bytes, deliberately never a publishable anatomical image.
  const bytes = Buffer.from([255,216,255,...Array(30).fill(0),255,217])
  await writeFile(join(root, 'test.jpg'), bytes)
  const hash = sha256(bytes)
  const row = { id: '00000000-0000-4000-8000-000000000001', year: 1, module_code: 'TEST', lecture_id: null,
    title: 'Fixture', stem: 'Fixture', instructions: null, content: { questions: [] }, quality_status: 'ready',
    image_status: 'ready', assessment_type: 'spotter', published: true, media_url: '/assets/fixture.svg',
    media_alt: null, updated_at: '2026-10-22T12:00:00Z' }
  const review = () => ({ status: 'approved', asset_sha256: hash, reviewer: 'TEST FIXTURE', evidence: 'test fixture only', reviewed_at: '2026-10-22' })
  const entry = { item_id: row.id, expected_media_url: row.media_url, expected_updated_at: row.updated_at,
    asset: { file: 'test.jpg', key: 'spotter-reviewed/test/one.jpg', sha256: hash, mime_type: 'image/jpeg',
      kind: 'specimen_photo', source_url: 'https://example.invalid/test', creator: 'TEST', license: 'TEST ONLY',
      license_evidence: 'test fixture', commercial_use: true, adaptations_allowed: true, credit_line: 'Credit: TEST' },
    media_alt: 'Test fixture. Credit: TEST', rights_review: review(), science_review: review(),
    question_review: { ...review(), snapshot_sha256: sha256(JSON.stringify(row)), answers_unchanged: true,
      no_answer_leakage: true, label_mapping: 'test fixture' }, mobile_review: review(), desktop_review: review() }
  return { root, snapshot: [row], manifest: { version: 1, batch_id: 'TEST', items: [entry] }, entry, row }
}
test('prepares guarded reversible SQL, preserves questions and never commits or deletes', async t => {
  const f = await fixture(t), result = await prepareBatch(f.manifest, f.snapshot, f.root)
  assert.equal(result.summary.length, 1)
  for (const sql of [result.forwardSql, result.rollbackSql]) {
    assert.match(sql, /FOR UPDATE/); assert.match(sql, /RAISE EXCEPTION/)
    assert.ok(sql.endsWith('ROLLBACK;\n')); assert.doesNotMatch(sql, /\bCOMMIT\b|\bDELETE\b|module_entitlements/)
    assert.doesNotMatch(sql, /SET (?:stem|content|published|quality_status)/)
  }
  assert.match(result.forwardSql, /Asset key collision/)
  assert.match(result.rollbackSql, /media_url = '\/assets\/fixture.svg'/)
})
for (const [name, mutate] of [
  ['missing science sign-off', f => { f.entry.science_review.status = 'pending' }],
  ['missing commercial rights', f => { f.entry.asset.commercial_use = false }],
  ['missing adaptation rights', f => { f.entry.asset.adaptations_allowed = false }],
  ['changed bytes', f => { f.entry.asset.sha256 = '0'.repeat(64) }],
  ['stale reviewer image', f => { f.entry.rights_review.asset_sha256 = '0'.repeat(64) }],
  ['stale question snapshot', f => { f.row.stem = 'changed' }],
  ['answer leakage', f => { f.entry.question_review.no_answer_leakage = false }],
  ['unreviewed mobile', f => { f.entry.mobile_review = null }],
  ['unreviewed desktop', f => { f.entry.desktop_review = null }],
  ['wrong current media', f => { f.row.media_url = 'private:newer' }],
  ['changed timestamp', f => { f.row.updated_at = '2026-10-23' }],
  ['duplicate item', f => { f.manifest.items.push(f.entry) }],
  ['empty batch', f => { f.manifest.items = [] }],
  ['oversize batch', f => { f.manifest.items = Array(11).fill(f.entry) }],
  ['unpublished item', f => { f.row.published = false }],
  ['missing attribution', f => { f.entry.media_alt = 'no credit' }],
  ['generated diagram', f => { f.entry.asset.kind = 'generated_diagram' }],
]) test(`blocks ${name}`, async t => {
  const f = await fixture(t); mutate(f)
  await assert.rejects(prepareBatch(f.manifest, f.snapshot, f.root))
})
test('handles quote and DO-block delimiter in source metadata as data', async t => {
  const f = await fixture(t); f.entry.asset.source_url = "https://example.invalid/quote'/$spotter_batch$/"
  const result = await prepareBatch(f.manifest, f.snapshot, f.root)
  assert.match(result.forwardSql, /DO \$spotter_batch_x\$/)
  assert.match(result.forwardSql, /quote''/)
})
test('rejects HTML disguised as image/jpeg', async t => {
  const f = await fixture(t); const bytes = Buffer.from('<html>not a photograph</html>')
  await writeFile(join(f.root, 'test.jpg'), bytes); f.entry.asset.sha256 = sha256(bytes)
  await assert.rejects(prepareBatch(f.manifest, f.snapshot, f.root), /raster/)
})
