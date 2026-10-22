# Spotter image replacement preparation (#43)

Status: engineering preparation only. No production records, protected assets,
purchases or public images were changed. No replacement is scientifically
approved by this work. Do not close #43 or infer production authorization.

## Verified inventory, 22 October 2026

The first read-only live inventory contained 223 published Spotters: 189 public
SVG references and 34 private references. A later read during this review found
188 public SVG references and 35 private references (23 distinct raster assets).
One record changed concurrently outside this branch; the final private register
uses the refreshed snapshot. The October 10 count of 223 public references is
historical. Refresh again before selecting any batch.

`assessment-media-access` reads `protected_media_assets`, not Storage objects.
That table has RLS enabled, no client SELECT grants and no client policies in
the inspected live project. The service checks authenticated identity,
publication/readiness, trusted profile year and an unrevoked, unexpired `osce`
entitlement for the same module and year. A private reference alone does not
establish anatomical accuracy, ownership or licensing.

All 188 currently referenced SVG files exist at main `4a22bbd3300f8cd05a1ad5f9f45fd4ada01ec1e0`.
15 fail XML parsing (16 before the concurrent change). In 118 of the remaining items, at least one numeric answer
option is not present as an SVG text marker. This is a structural screening
result requiring editorial review, not 118 proven wrong answer keys.
Spotter drill is mentioned in #43 but no `/spotters/drill` route exists in the
inspected main. Do not claim a drill regression pass.

The detailed 223-item register and source/rights findings are delivered privately.
Do not commit paid stems, answer keys, database snapshots, image bytes or batch
SQL to this public repository or upload them as public CI artifacts.

## Image approval

Every replacement needs an identifiable original source, creator, file hash,
image type, reuse terms and evidence permitting commercial display and any
crop/label adaptation. Preserve required attribution visibly in `media_alt`
(rendered as the figure caption). Public-domain/CC0 originals can remain
available from their original provider; protection controls KIFARO's serving
path and paid questions, not exclusivity or prevention of screenshots.

Record consent provenance where applicable. A slide deck, Adobe share URL or
PNG extension does not demonstrate source ownership or specimen authenticity.
Do not use generated diagrams as specimen photographs. BlueLink's current
published permission is educational/non-commercial; paid KIFARO reuse needs
separate written permission. Visible Human is a potential public-domain source
for sections, but each selected slice still needs level/orientation and question
matching. Exact Wikimedia image pages, not category pages, supply file licenses.

Scientific review must cover laterality, view/level, anatomical relationships,
variations, pathology, pointer endpoints and all answer-option labels. A
replacement cannot silently change the answer index. Reject labelled teaching
posters that reveal answers. The current planner intentionally changes only
`media_url` and `media_alt`; items needing new wording/options/answers require a
separate coordinated editorial change and are blocked from image-only batches.

## Prepare a reviewed batch

1. Export the read-only query in `scripts/spotters/inventory.sql` privately.
2. Start from `scripts/spotters/batch.example.json`. Use an opaque new asset key
   beneath `spotter-reviewed/` and a relative raster file beside the manifest.
3. Hash the exact final bytes with SHA-256. Each review records that hash,
   reviewer, date and evidence. The question review also records
   `sha256(JSON.stringify(snapshotRow))`; retain the export field order.
4. Record mobile and desktop image-level approvals after testing the final
   labelled image, not a template. Existing automated fixture checks do not
   satisfy image-level approval.
5. Run locally:

   ```sh
   node scripts/spotters/prepare-batch.mjs /private/batch.json /private/snapshot.json /private/output
   ```

The tool performs **no network operations**. Missing approvals/rights, stale
snapshots, changed bytes, invalid MIME, duplicate IDs or more than ten items fail
before output. The forward and rollback SQL both end in `ROLLBACK`. Keep them
outside the repository. A real operator must review, validate in disposable
staging and receive production authorization before committing any transaction.
Do not put this SQL in automatically applied Supabase migrations.

The forward SQL locks and compares each complete question snapshot before
inserting a new asset and changing its reference. A key collision with different
bytes aborts. A rerun against changed rows aborts. Rollback checks question
content and replacement references and restores only prior media fields. It
leaves asset bytes for investigation and does not touch purchases.

## Verification gates

- `npm run test:assessment-media`: behavioral tests of the actual Edge entrypoint
  with an in-memory adapter; visitors, unpaid, paid, wrong year/module/product,
  revoked/expired/exact-expiry access, admin, missing/unpublished images; batch
  validation and transactional SQL guards. These are not live-user tests.
- `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/assessment-image.browser.mjs`:
  actual React component and stylesheet at 360, 390 and 1440 px, mocked service.
  Covers pending/denied/retry/stale response/sign-out/decode failure, no public
  fallback and image containment. Install an available Chromium via Playwright.
- Full existing Guardian/Auth/Viva tests, TypeScript and production build.
- Staging release gate: seed disposable paid/unpaid/wrong-year accounts and a
  reviewed image; verify real Auth, RLS, endpoint, direct asset-table denial,
  allowed/denied responses, expiry and revoked access. Verify actual file decode,
  label readability, portrait/landscape, touch use and current browsers. Test a
  failed multi-item batch rollback and successful rollback before release.
- The existing endpoint returns image data URLs. Already delivered image bytes
  cannot be revoked from a student's device; do not claim DRM or instant remote
  deletion. The UI clears images on session/station changes and denies fallback.

### Results for this preparation

40 service/batch tests passed. The browser harness passed 30 checks across
360/390/1440 px using Chromium 134 (Playwright 1.51.1). Guardian (21), Auth (9)
and Viva (6) tests passed, as did TypeScript and the production build. These
counts are local fixture checks; real paid/unpaid staging sessions, real-image
mobile readability, native Android/iOS, SQL execution and production rollout
remain unverified release gates. No real student was impersonated.

## Controlled rollout and cleanup

Start with a small approved cohort (up to 10), verify every reference and compare
counts, then expand by module. Pause on any blank image, pointer mismatch or
entitlement regression. Keep public images until every dependent assessment,
MCQ and lecture reference is checked; deleting by Spotter count alone is unsafe.
Only a separately authorized cleanup may remove obsolete public copies and
verify CDN/Pages behavior. Previously public files remain retrievable from git
history; protection must use new reviewed bytes and private keys.

## Source pages inspected

- https://github.com/kirofares/Kifaro/issues/43
- https://sites.google.com/a/umich.edu/bluelink/resources/bluelink
- https://www.nlm.nih.gov/research/visible/visible_human.html
- https://commons.wikimedia.org/wiki/File:Scapula_-_posterior_view.jpg
- https://commons.wikimedia.org/wiki/File:Scapula_-_anterior_view.jpg
- https://commons.wikimedia.org/wiki/File:LeftScapulaLateral.jpg
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/changelog
