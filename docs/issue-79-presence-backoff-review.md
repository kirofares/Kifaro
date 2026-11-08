# Issue 79: presence retry mitigation — review before deployment

Prepared 8 November 2026. Base: `4457b5ad7467e4a6d20fb8019fb4aab524119a85` (main fetched before editing).

## Verified scope

Issue [#79](https://github.com/kirofares/Kifaro/issues/79) remains open. Its latest [8 November update](https://github.com/kirofares/Kifaro/issues/79#issuecomment-6718189093) reports 174 GET/POST 402 responses versus 26 in the preceding equal 24-hour window, including 128 presence calls. The 35 HTTP 200 responses are OPTIONS only. These are sampled log records, not a complete student traffic census. This change does not establish recovery or diagnose the underlying 402 restriction.

The current tracker ignored resolved RPC errors and called on startup, every 30 seconds, and on route/visibility events. Supabase JS **2.118.0**, pinned by the existing lockfile, normally resolves a failed RPC with top-level `status` and `error`; catching exceptions alone would miss HTTP 402. No dependency version is changed.

## Proposed behavior

- One presence request in flight per tracker. Use the actual SDK `status` and `error`; only error-free 2xx responses count as success. Catch thrown failures without forwarding payloads to logging/error reporting.
- Replace the interval with a single scheduled retry. Every trigger checks the same monotonic deadline; route/visibility/online event bursts cannot bypass it.
- Failed attempts wait 60, 120, 240, 480, then 600 seconds. Add 0–20% positive jitter, capped at 600 seconds. Subsequent failures stay capped. All RPC/network failures receive this treatment, including 402; no assumption about the billing cause is encoded.
- On successful recovery, reset the failure count and return to a 30-second cadence. Healthy route events coalesce until the next heartbeat, which samples the latest route.
- Hidden/offline tabs skip calls; becoming visible/online resumes only when the deadline permits. A 15-second abort signal bounds a stalled fetch. Cleanup cancels timers, aborts work and prevents late completions from restarting the tracker.
- Preserve the existing session identifier. Send pathname plus the HashRouter route without query parameters or non-route OAuth fragments. Add no logs, user/account identifiers, credentials, storage keys, database changes or changes to authentication/content access.

## Verification

Run `npm run test:presence`, `npm run typecheck`, `npm run build` and `node --test tests/*.test.mjs`.

Local results on Node 24.22.1: **11/11 presence tests passed, 49/49 total tests passed, TypeScript passed, production build passed**. Vite reported bundles above its 500 kB advisory threshold. GitHub CI runs separately on Node 22; its result must be checked on the PR. Existing local dependencies were reused after confirming the lockfile matches; no install or lockfile update was needed.

The 11 new tests exercise the production module with a virtual clock and browser event harness. Coverage includes resolved 402 (even without an error body), thrown/rejected errors, status 0/503, error payloads, event bursts, overlapping calls, request abort, hidden/offline behavior, recovery/reset, cleanup/restart, jitter ceiling, blocked storage and sensitive URL stripping. An integration test uses the installed **real Supabase JS client**, with mocked HTTP fetch returning JSON/plain-text 402 followed by 204. It does not contact production or use student accounts.

Under continuous immediate failure, zero jitter and a visible online tab, the tested inclusive hour contains **9 attempts versus 121** from the old 30-second heartbeat alone: **92.6% fewer**. The test also injects 9,600 route/visibility/online events that do not create extra calls. This is a deterministic test result, not an observed production traffic improvement.

The new suite is included in KIFARO CI. A green build/test result cannot establish production API availability, billing recovery, or successful student login/content delivery.

## Application risks and limits

- Presence is best-effort telemetry. During failures, the admin live visitor count can undercount because its SQL considers only the last two minutes. Recovery detection can take up to ten minutes plus request time in a visible online tab; browser timer throttling, sleep or offline periods can extend this.
- Healthy route telemetry can lag by 30 seconds plus request duration. URL query details are intentionally no longer recorded.
- Suppression is per loaded tab; separate tabs/devices and page reloads do not share a circuit breaker. A reload starts a fresh tracker. This avoids new shared/persisted state but does not eliminate all failed requests across the fleet.
- Aborting a request cannot undo an RPC already executed server-side. The existing RPC upserts by session ID.
- Tests simulate transport and browser events, including an actual SDK adapter. They are not a full browser/native-device end-to-end test or a production student journey.
- No merge, deployment, subscription change or Supabase settings mutation has been performed. Owner approval is required before merge; merging main triggers the existing deployment workflow. Rollback after an approved release would restore the previous tracker and its higher failed-request rate; it would not resolve a Supabase restriction.

## Evidence required before a subscription decision

Collect these privately and record only sanitized conclusions:

1. **Usage:** select the correct organization, billing period and project; compare actual consumption with each displayed quota, particularly cached/uncached egress, database/storage size, MAU, Realtime and Edge Functions. Check all projects contributing to organization totals. The number of 402 requests alone is not evidence of which quota was exceeded.
2. **Billing:** confirm the actual plan, billing-cycle reset timestamp, outstanding/failed invoices and payment-method status; check Spend Cap only if applicable. Do not copy card details, invoices or tokens into GitHub.
3. **Fair Use:** read the explicit active restriction reason and affected scope; distinguish an active restriction from an expired-grace-period warning. Record notification date, grace expiry, reset/removal conditions and whether other projects are restricted.
4. **Response evidence:** capture a sanitized 402 body/error code, request ID and timestamp from an authorized reproduction; correlate it with gateway logs and the dashboard notice. If no definitive reason is exposed, seek Supabase support clarification before recommending a paid remedy.
5. **Recovery:** after a separately approved root-cause remedy, verify real anonymous GET and authorized test-user login, lecture metadata, readiness and protected asset delivery. Review several observation windows separating GET/POST successes from OPTIONS. Use approved test identities and payment sandbox only where needed.

Supabase documents HTTP 402 as a possible organization Fair Use restriction, with quota and billing-related causes; the status alone does not prove which applies here. The exact account evidence above has **not been obtained in this code-change task**. An upgrade is therefore not yet justified by this review.

References: [Billing FAQ / Fair Use](https://supabase.com/docs/guides/platform/billing-faq#how-is-the-fair-use-policy-applied), [Usage / Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [JavaScript RPC](https://supabase.com/docs/reference/javascript/rpc). The current changelog was reviewed; this patch keeps the existing SDK and changes no API/schema configuration.
