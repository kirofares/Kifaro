# KIFARO Continuous Guardian — Review & Release Policy (v1)

Scope: `kifaroedu.com`, the public `kirofares/Kifaro` repository, student-facing navigation and lessons, payments and authorizations, Android/iOS/PWA, Supabase ("Anatomate"), and linked media/documents.

## Immutable owner decisions until explicitly revised

1. KIFARO is the master identity; AnatoMate by KIFARO is the anatomy pathway.
2. Nursing is inside **Learn**, and its curriculum is a direct lecture list; do not reintroduce the four-year division or a top-level Nursing tab.
3. Respect the approved lecture/module ordering and titles. In reviews, do not infer lecture identity from stale numbers alone. Approved introductory variants may coexist.
4. Reuse approved original medical illustrations. Do not silently replace originals with diagrammatic SVG placeholders or generate replacements.
5. A draft, broken asset, placeholder, incomplete assessment, or "Coming soon" lecture must not be sold as complete.
6. First lecture in each block remains free; price or promotion changes require owner approval.
7. Payment access is granted only after server-side verified payment confirmation. Paymob + Kashier failover may cover technical outages, not declined transactions. Do not retry a bank-declined payment automatically.
8. Protect PDF/PPT/video and private student data: require authorized access, validated ownership, and private storage or short-lived authorized links as applicable. A watermark alone is not access control.
9. Retain Dropbox as the established file archive; never move/delete source assets or expose shared editable links without approval.
10. Security changes to RLS, exposed views, privileged functions, billing and publication are high risk. Run read-only audits first; implement changes in reviewable migrations/PRs, verify with least privilege, and require owner approval.
11. All proposed code changes must be tested and reviewed in a PR; do not push directly to `main`.
12. In reviews, explicitly distinguish `verified`, `suspected`, `untested`, and `not accessible`. Do not claim a deployment or file upload succeeded without positive evidence.

## Review matrix

| Frequency | Checks | Outcomes |
|---|---|---|
| Every PR | Build; type check; learning/navigation regressions; safety invariants; dependency audit | Block bad PR; request corrections |
| Daily | Both hostnames HTTPS, homepage, referenced assets; repository PRs/issues; Supabase advisors; error trends if permissioned | One idempotent issue per finding category; priority and remediation proposal |
| Weekly | Logged-out / student / admin role tests; payment sandbox webhook, fraud resistance, entitlement isolation, complete PDFs/PPTs and image quality, accessibility and mobile UX | Human-reviewed recommendations/PRs |
| Monthly | Performance trends, backup + restore exercise, DNS/cert/redirect review, permissions and secrets rotation review, Android/PWA release parity | Owner decision list |

Automated Github workflow covers only public site/asset checks and dependency tests in v1. Authenticated journeys, visual image matching, proprietary Dropbox file verification, active Supabase advisory checks, and payment provider integrations require connected service permissions/test accounts or additional runners. Do **not** label them as passed until tested.

## Allowed automation

- Automated: detect, categorize, deduplicate findings; open/update issues; create dependency-update PRs; run CI; gather evidence; record feedback.
- PR only: isolated fixes that have passing regression tests and no customer-data, payout, pricing, authorization, deletion or irreversible effect.
- Owner approval + manual controlled release: changes to `main`, production deployments, RLS, functions with privileged execution, access grants, pricing/payment, lecture publication, source asset removal, and media access policies.
- Never: store production credentials in GitHub source, send personal/student records to an LLM, issue live payment transactions as a test, disable security checks to turn results green.

## Findings lifecycle

`NEW -> TRIAGED -> REPRODUCED -> FIX_PROPOSED -> TESTED -> OWNER_APPROVED -> MERGED -> VERIFIED_IN_PRODUCTION -> CLOSED`.

Any failed test, rollback event or owner rejection must generate a new regression case. If root cause remains unknown, record uncertainty, do not fabricate a fix.

## Owner proposal format

Proposed change; affected pages/roles; evidence; severity and likelihood; before/after design; impact on students; security risk; estimated cost; regression evidence; rollback path; explicit **Approve / Revise / Reject** decision.

Never use LLM opinions as scientific validation of medical content. A domain expert reviews anatomy and clinical material. 
