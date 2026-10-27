# Spotter SVG decoding repair — review only

Review date: 28 October 2026 (Africa/Cairo). Base:
`4a22bbd3300f8cd05a1ad5f9f45fd4ada01ec1e0`. Related: #70 and #43.

## Confirmed defect and narrow repair

All 15 assets identified in the private 22 October register contain exactly one
unescaped `&` in an SVG text node. Fourteen occur in headings; one occurs in a
regional label. This is invalid XML. Every original fails both ElementTree
parsing and Chromium image decoding, with `naturalWidth = 0`.

The patch changes that single character encoding to `&amp;` in each existing
asset. The displayed character stays `&`. No path, line, arrow, marker, numeric
label, coordinate, style or anatomical wording changes. Reversing only the
entity encoding reproduces each original SHA-256 byte for byte. The manifest
contains public paths and hashes only, not assessment identifiers or answers.

Read-only production HTTP requests returned 200 and `image/svg+xml` for all 15
URLs; every response matched the corresponding original hash. Thus a successful
HTTP response does not establish that an image can render. Browser comparisons
used those exact bytes on a local HTTP server, not a signed-in production session.

## Current inventory and reconciliation

The current read-only inventory still contains 223 published Spotters: 170 public
SVG references and 53 private references. Eighteen references changed since the
22 October snapshot independently of this work. Of the historical 15 affected
assessments, 12 still reference the malformed public assets; three now reference
private images. Their public files remain accessible and are included in this
syntax-only repair. This does not certify those three replacement images.

The question-to-file crosswalk is delivered privately. Do not commit paid
questions, options, answer keys, exports or private review screenshots here.

## Verification

- `python3 tests/spotter-svg-xml.test.py`: validates all 15 repaired XML documents,
  expected hashes, exact reversal to original bytes, and original parse failure.
  Included in the existing CI workflow.
- `tests/spotter-svg.browser.mjs`: 120 cases, comprising original and repaired
  assets at 1440×900, 360×800, 390×844 and 844×390. Chromium 134.0.6998.35,
  installed Playwright 1.62.1, actual base-branch `ProtectedAssessmentImage`
  function and stylesheet, local HTTP assets. All 60 originals fail decoding;
  all 60 repaired cases decode, render with `object-fit: contain`, and have no
  horizontal page overflow. Mobile contexts enable touch and device scaling.
- Visual inspection of all 15 repaired assets at desktop and 390px, and nine
  numeric-mismatch samples across nine modules.
- Existing Guardian 21, Auth 11 and Viva 6 tests passed. Typecheck, production
  build and `git diff --check` passed. Build retains its large-chunk warning.

Run the browser harness from the repository root with a locally installed
Playwright and Chromium. Optional environment variables: `PLAYWRIGHT_MODULE`,
`CHROMIUM_EXECUTABLE`, `SVG_REVIEW_OUTPUT`. Keep output outside the public
repository; screenshots and JSON are optional local review evidence, not CI
artifacts. The harness extracts the current inline component, so a later
component refactor requires adapting the harness explicitly.

## Numeric-label sample and mobile limits

Before this repair, 116 currently parseable public assessments trigger the
numeric-marker screen. After the 12 currently referenced files become parseable,
eight additional items trigger it, making 124. These are different denominators
from the historical 118; they do not imply that the repair removed labels.

Nine purposively selected samples cover the nine modules with numeric-marker
warnings (one per module, deterministic UUID order). All nine visibly lack at
least one offered numeric distractor; these are real visual omissions, not just
an XML text-extraction artifact. Two samples have two visible markers for four
numeric choices; seven have three for four. The stored keyed label is present
in every sample. This does not establish anatomical correctness of the key or
the pointer. All nine need coordinated editorial/scientific review before
adding markers or revising choices. No answer indices were changed.

Decode success is not a readability approval. At 390px the rendered numeric
labels are approximately 5.5–7.5 CSS px; some auxiliary text is smaller. The
existing diagrams need a separate zoom/readability review. The repair preserves
their existing sizes. Native Android/iOS, physical phones, Safari, real paid
sessions and the full assessment route were not tested by this harness.

## Boundaries and release gates

This branch is a review candidate only: no merge, deployment, database write,
image-reference migration, access change or scientific sign-off. Existing
main-only deployment triggers were inspected. Production rollout still requires
the owner's authorization and scientific/device review. Rollback is a git revert
of the patch; there is no database migration to reverse.

The wider repository scan found 36 other malformed SVGs outside these 15. Their
dependencies across other content types were not inventoried; no claim is made
that all site media are fixed. Track separately without expanding this patch.
This work does not complete the original-anatomy replacement project or close #43.
