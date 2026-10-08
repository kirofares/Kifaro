# Lecture slide protection: release gate

This change is **not approved for production UI** until all checks pass.

## Functional
- Signed-out request to `lecture-slide` must return 401 (or gateway JWT rejection).
- Signed-in student without entitlement requesting a paid lecture must return 403.
- Entitled student can request page=0 and receives a positive pageCount.
- Entitled student can request page=1 and receives a single-page PDF with their identity embedded.
- Requesting pageCount+1 returns 404.
- Free published lecture works for signed-in student.
- Admin access works.
- Revoked access must fail even after a previous successful request.
- PDF and PPTX original asset requests must remain admin-only.
- Check all three academic years and the Android WebView.

## Performance and security
- Measure p95 latency and memory on the largest PDFs; the current function downloads and parses the full original on each page request. Add a private, access-controlled derived-page cache if needed; never public URLs.
- Test a 30+ page lecture, rapid next/previous navigation, expired sessions and concurrent users.
- Check that source PDFs and service-role credentials are not exposed in network responses.
- Confirm per-page files can still be saved by a legitimate student; watermarking deters redistribution but cannot eliminate copying.
- Confirm checkout, manual payment approvals and assessment access remain unchanged.

## Rollout
1. Test the isolated deployed Edge Function with dedicated paid, unpaid, free and admin test accounts.
2. Fix any defects; build and test the frontend branch.
3. Merge only after review and use staged rollout with rollback to the existing viewer.
