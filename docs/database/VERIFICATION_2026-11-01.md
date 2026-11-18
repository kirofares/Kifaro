# Verification at 4664263364f2fb66dfaf00f8a6812f45eb491759

Full workflow: https://github.com/kirofares/Kifaro/actions/runs/41293031527

| Check | Result |
| --- | --- |
| Native PostgreSQL 15.19 full candidate replay | FAIL after 10 successful files |
| Native PostgreSQL 17.11 full candidate replay | FAIL after 10 successful files |
| KIFARO CI | PASS: https://github.com/kirofares/Kifaro/actions/runs/41293031483 |
| Continuous Guardian | PASS: https://github.com/kirofares/Kifaro/actions/runs/41293031404 |
| Focused assessment grants matrix | PASS: https://github.com/kirofares/Kifaro/actions/runs/41293031488 ; not full-schema certification |
| Local Guardian/Auth/Viva | 38 passed, 0 failed after installing locked dependencies |
| Local repeat-bootstrap guard | PASS: rejects existing helper/pricing objects; transaction rolled back |

Both native PostgreSQL logs show:

    psql:supabase/migrations/20261001231000_lecture_asset_readiness.sql:10: ERROR: column "video_path" does not exist
    BLOCKED after 10 files at supabase/migrations/20261001231000_lecture_asset_readiness.sql; fresh-install readiness NOT achieved
    Process completed with exit code 1.

The new pricing role checks completed successfully before this failure on both versions.
The replay did not continue past the failing file. Later MCQ/assessment prerequisites
remain unreached and unverified in the full replay. The archive contains their
canonical historical source, but does not automatically activate it.

No production data/schema changes, deployment, merge, or production migration-history
edits were performed. All production queries were read-only metadata inspection.

Read FRESH_INSTALL_RECOVERY.md for the outstanding canonical asset/view-limit source
and explicit catalog-reconstruction review required before completing the baseline.
