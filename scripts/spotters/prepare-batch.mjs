import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile, realpath } from 'node:fs/promises'
import { resolve, dirname, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const literal = value => value == null ? 'NULL' : "'" + String(value).replaceAll("'", "''") + "'"
const required = (value, label) => { if (typeof value !== 'string' || !value.trim()) throw Error(`Missing ${label}`) }
function review(value, hash, label) {
  if (!value || value.status !== 'approved' || value.asset_sha256 !== hash) throw Error(`${label} must approve these exact bytes`)
  required(value.reviewer, `${label}.reviewer`)
  required(value.evidence, `${label}.evidence`)
  if (!Number.isFinite(Date.parse(value.reviewed_at))) throw Error(`${label}.reviewed_at must be a date`)
}
function mimeOf(bytes) {
  if (bytes.subarray(0,3).equals(Buffer.from([255,216,255]))) return 'image/jpeg'
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png'
  if (bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP') return 'image/webp'
  throw Error('Replacement must be a JPEG, PNG or WebP raster; SVG/HTML are not accepted')
}
const snapshotFields = ['year','module_code','lecture_id','title','stem','instructions','content','quality_status','image_status']
function unchanged(row) {
  return snapshotFields.map(key => key === 'content'
    ? `content IS NOT DISTINCT FROM ${literal(JSON.stringify(row[key]))}::jsonb`
    : `${key} IS NOT DISTINCT FROM ${literal(row[key])}`).join(' AND ')
}
function requireRow(condition) {
  return `PERFORM 1 FROM public.assessment_items WHERE ${condition} FOR UPDATE;\nIF NOT FOUND THEN RAISE EXCEPTION 'Assessment snapshot changed; refresh and review the batch'; END IF;`
}

// This module never connects to a database. It only prepares local review SQL.
// Neither the normal CLI nor importing this module can apply a batch.
export async function prepareBatch(manifest, snapshot, root) {
  if (manifest.version !== 1 || !Array.isArray(manifest.items) || !manifest.items.length || manifest.items.length > 10) {
    throw Error('A batch must contain 1–10 explicitly reviewed items (version 1)')
  }
  required(manifest.batch_id, 'batch_id')
  const ids = new Set(), keys = new Map(), forward = [], reverse = [], summary = []
  for (const entry of manifest.items) {
    if (!/^[0-9a-f-]{36}$/i.test(entry.item_id) || ids.has(entry.item_id)) throw Error('Invalid or duplicate item ID')
    ids.add(entry.item_id)
    const matches = snapshot.filter(row => row.id === entry.item_id)
    if (matches.length !== 1) throw Error('Missing or duplicate snapshot item')
    const row = matches[0]
    if (row.assessment_type !== 'spotter' || row.published !== true || row.quality_status !== 'ready') throw Error('Only published, ready Spotters can enter a batch')
    for (const field of [...snapshotFields,'media_url','media_alt','updated_at']) if (!(field in row)) throw Error(`Missing snapshot field ${field}`)
    if (entry.expected_media_url !== row.media_url || entry.expected_updated_at !== row.updated_at) throw Error('Manifest snapshot mismatch')
    const asset = entry.asset
    if (!asset || !/^spotter-reviewed\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/.test(asset.key) || asset.key.includes('..')) throw Error('Use a new spotter-reviewed/ asset key')
    required(asset.file, 'asset.file')
    const path = await realpath(resolve(root, asset.file)), rel = relative(await realpath(root), path)
    if (rel.startsWith('..') || isAbsolute(rel)) throw Error('Asset must stay inside the manifest directory')
    const bytes = await readFile(path), hash = sha256(bytes)
    if (bytes.length > 5 * 1024 * 1024 || bytes.length < 16) throw Error('Invalid asset size (16 bytes–5 MiB)')
    if (asset.sha256 !== hash) throw Error('Asset SHA-256 mismatch')
    if (keys.has(asset.key) && keys.get(asset.key) !== hash) throw Error('Asset key reused for different bytes')
    keys.set(asset.key, hash)
    const mime = mimeOf(bytes)
    if (asset.mime_type !== mime) throw Error('Asset MIME does not match bytes')
    if (!['specimen_photo','radiograph','histology_micrograph','licensed_atlas'].includes(asset.kind)) throw Error('Unaccepted image category')
    required(asset.source_url, 'asset.source_url'); required(asset.creator, 'asset.creator')
    required(asset.license, 'asset.license'); required(asset.license_evidence, 'asset.license_evidence')
    if (asset.commercial_use !== true || asset.adaptations_allowed !== true) throw Error('Commercial and adaptation rights must be verified')
    review(entry.rights_review, hash, 'rights_review')
    review(entry.science_review, hash, 'science_review')
    review(entry.question_review, hash, 'question_review')
    if (entry.question_review.snapshot_sha256 !== sha256(JSON.stringify(row))) throw Error('Question review does not match snapshot')
    if (entry.question_review.answers_unchanged !== true || entry.question_review.no_answer_leakage !== true) throw Error('Question/label/answer compatibility is unapproved')
    required(entry.question_review.label_mapping, 'question_review.label_mapping')
    for (const device of ['mobile','desktop']) review(entry[`${device}_review`], hash, `${device}_review`)
    required(entry.media_alt, 'media_alt'); required(asset.credit_line, 'asset.credit_line')
    if (!entry.media_alt.includes(asset.credit_line)) throw Error('Visible caption must include attribution')
    const newRef = `private:${asset.key}`, content = 'base64:' + bytes.toString('base64')
    const base = `id = ${literal(row.id)}::uuid AND assessment_type = 'spotter' AND published = true AND ${unchanged(row)}`
    forward.push(requireRow(`${base} AND media_url IS NOT DISTINCT FROM ${literal(row.media_url)} AND media_alt IS NOT DISTINCT FROM ${literal(row.media_alt)} AND updated_at = ${literal(row.updated_at)}::timestamptz`))
    forward.push(`INSERT INTO public.protected_media_assets (asset_key, source_path, mime_type, content) VALUES (${literal(asset.key)}, ${literal(asset.source_url)}, ${literal(mime)}, ${literal(content)}) ON CONFLICT (asset_key) DO NOTHING;\nPERFORM 1 FROM public.protected_media_assets WHERE asset_key = ${literal(asset.key)} AND mime_type = ${literal(mime)} AND content = ${literal(content)};\nIF NOT FOUND THEN RAISE EXCEPTION 'Asset key collision'; END IF;`)
    forward.push(`UPDATE public.assessment_items SET media_url = ${literal(newRef)}, media_alt = ${literal(entry.media_alt)} WHERE id = ${literal(row.id)}::uuid;`)
    reverse.unshift(`${requireRow(`${base} AND media_url = ${literal(newRef)} AND media_alt = ${literal(entry.media_alt)}`)}\nUPDATE public.assessment_items SET media_url = ${literal(row.media_url)}, media_alt = ${literal(row.media_alt)} WHERE id = ${literal(row.id)}::uuid;`)
    summary.push({ item_id: row.id, previous_ref: row.media_url, new_ref: newRef, sha256: hash, bytes: bytes.length })
  }
  const sql = statements => {
    const body = statements.join('\n')
    let tag = '$spotter_batch$'
    while (body.includes(tag)) tag = tag.replace(/\$$/, '_x$')
    return `-- REVIEW ONLY. No production authorization is implied.\n-- Ends in ROLLBACK. Test in disposable staging first.\nBEGIN;\nDO ${tag}\nBEGIN\n${body}\nEND\n${tag};\nROLLBACK;\n`
  }
  return { forwardSql: sql(forward), rollbackSql: sql(reverse), summary }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [manifestPath, snapshotPath, outputPath] = process.argv.slice(2)
    if (!manifestPath || !snapshotPath || !outputPath) throw Error('Usage: node scripts/spotters/prepare-batch.mjs MANIFEST.json SNAPSHOT.json OUTPUT_DIRECTORY')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'))
    const result = await prepareBatch(manifest, snapshot, dirname(resolve(manifestPath)))
    await mkdir(outputPath, { recursive: true, mode: 0o700 })
    // Exclusive creates prevent overwriting a previously reviewed batch.
    for (const [name, data] of [['forward.sql', result.forwardSql], ['rollback.sql', result.rollbackSql], ['summary.json', JSON.stringify(result.summary, null, 2)]]) {
      await writeFile(resolve(outputPath, name), data, { flag: 'wx', mode: 0o600 })
    }
    console.log(`Prepared ${result.summary.length} items for review; no database operations executed.`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
