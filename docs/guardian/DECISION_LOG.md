# KIFARO Guardian — Decision Memory

This file is a reviewable decision ledger, **not** an auto-learning authority. Each owner-approved change becomes a dated row with reproducible tests.

| Date | Category | Decision | Enforcement | Status |
|---|---|---|---|---|
| 2026-09 | Brand | KIFARO master brand; AnatoMate is anatomy sub-brand | UI + content review | Prior owner decision |
| 2026-10-02 | Site | Official domain `kifaroedu.com`; GitHub Pages deployment | Availability monitor | Prior owner decision |
| 2026-10-06 | Billing | Paymob primary + Kashier fallback for technical outage only, never retry bank-declined charges | Sandbox transaction + webhook tests required | Prior owner decision |
| 2026-10-08 | Content | First lecture in each block free; drafts require approval before publishing | Paid access/release checks pending | Prior owner decision |
| 2026-10-10 | Navigation | Nursing lectures listed directly under Learn; no four-year nursing structure or top-level tab | `tests/guardian.policy.test.mjs` | Automated code regression |
| 2026-10-11 | Assessment assets | Use approved original anatomy images; do not replace with generated SVG diagrams | Visual/asset regression pending | Prior owner decision |
| 2026-10-12 | Guardian | Auto-detect and propose; owner reviews releases and risky changes | GitHub PR + report/approval gate | Proposed for owner review |

## Feedback event format (append after owner decision)

```json
{
  "date": "YYYY-MM-DD",
  "component": "page / workflow / API / asset",
  "problem": "what failed, with evidence URL or issue",
  "owner_decision": "approved | revised | rejected",
  "desired_behavior": "testable rule",
  "fix_pr": "URL, if applicable",
  "regression_test": "path + test case",
  "production_verified_at": null
}
```

Store issue/PR links and redact personal information, payment data, credentials, and student identities.
