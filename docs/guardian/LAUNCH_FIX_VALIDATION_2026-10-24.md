# Launch checkout and assessment follow-up — 2026-10-24

Historical evidence for the original PR head. The [27 October review](PR71_REVIEW_2026-10-27.md) supersedes the original readiness criteria and test counts below; it adds PDF/Bunny resource checks, assessment entitlement-year matching, and webhook fixes.

Prepared 24 October 2026, Africa/Cairo (UTC+03:00). Base: `4a22bbd3300f8cd05a1ad5f9f45fd4ada01ec1e0`.
Status: proposed code fix; production behavior remains unverified for this change.

## Change and impact

- `paymob-create-checkout` now reads `lecture_assets` on the server before creating a provider intention. It rejects a video without a protected video reference/ready Bunny video, datashow without a PDF/PPTX reference, and a bundle unless both are ready. Missing metadata returns 409; lookup errors return 503. Client readiness flags cannot override it.
- Existing server-owned academic year, price, entitlement and free-lecture checks remain in place. No schema, prices, publication, access grants or Nursing structure changes.
- Direct assessment links wait for authentication and show a sign-in action to guests. Authenticated errors distinguish expired sessions, denied access, unavailable content, throttling and network failures in English/Arabic. Route/account changes remount protected state; stale responses are ignored. Switching language does not restart an assessment.
- This supports the content-readiness work in [#41](https://github.com/kirofares/Kifaro/issues/41). Public-image protection remains in [#70](https://github.com/kirofares/Kifaro/pull/70) / [#43](https://github.com/kirofares/Kifaro/issues/43); the exposed-view review remains in [#65](https://github.com/kirofares/Kifaro/pull/65) / [#47](https://github.com/kirofares/Kifaro/issues/47).

## Regression evidence

Local Node 24.22.1, Linux, 24 October 2026:

- 24 checkout tests execute the actual Edge handler with fake database/auth/provider adapters. They cover guest, invalid session, wrong server year, forged client year/readiness, free/unpublished lectures, absent/unready formats, database failure, already owned access, and server-derived price/year in signed checkout state. Rejections assert that the provider was not called.
- 13 assessment tests execute the actual component logic with isolated hook/JSX adapters: authentication hydration, guest sign-in, status-specific feedback, retries, empty results, Arabic/language changes and stale-response suppression.
- Full Guardian suite: 58 tests; auth: 11; Viva: 6. TypeScript, production bundle and whitespace checks are required before review.
- These are local regression tests, not real student sessions, real payment requests, browser end-to-end tests, RLS tests or production verification. CI results belong to the PR head and must be checked independently.

## Remaining release gates

The policy in `REVIEW_POLICY.md` requires owner approval and a controlled release for billing/privileged functions. This change creates no live payment, merges nothing and deploys nothing.

| Gate | Required evidence before claiming completion |
| --- | --- |
| Checkout isolation | On staging/sandbox using actual guest, correct-year and wrong-year accounts: guest 401, wrong year 403 even with forged body; neither creates an intention. Correct-year ready product uses the server price and year. |
| Product readiness | For video, datashow and bundle: absent required format returns 409 before provider contact; metadata lookup failure returns 503. Ready product creates only a sandbox intention. Free first lecture remains free. |
| Delivery and payment completion | Validate actual file/object existence and content quality separately, then sandbox webhook/entitlement isolation and permitted playback. A nonempty metadata path does not prove the backing object exists or that content is complete. No readiness guarantee for an intention created before metadata changes is introduced here. |
| Assessment | Real browser guest deep link shows sign-in; direct API remains denied. Correct-year subscriber can load; wrong-year/unsubscribed cannot receive questions/answers. Check account switching, session expiry and a timed assessment. UI feedback alone is not authorization proof. |
| Production | After approval, deploy the Edge function and frontend from the reviewed commit, record version/deployment IDs and time, rerun the relevant role matrix with controlled test accounts. A frontend build does not deploy an Edge function. |

No suitable role-test accounts or payment sandbox execution evidence was supplied for this work. Do not close the launch findings based on these unit tests. Approved source assets and the remaining content completion work are separate dependencies.

## Rollback

Record the prior frontend deployment and Edge function version before release. If a regression is found, revert this PR and redeploy the prior versions under the release owner. Rolling back the checkout guard reopens the missing-format purchase gap; keep affected products unavailable through the approved publication/payment controls until verified. No database rollback is needed because this PR contains no migration.
