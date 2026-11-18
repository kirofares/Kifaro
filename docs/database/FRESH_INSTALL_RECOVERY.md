# Fresh database recovery — incomplete, do not deploy

Inspected 2026-11-01. Starting main: `4a22bbd3300f8cd05a1ad5f9f45fd4ada01ec1e0`.
This branch includes PR #74 head `b1b2ba77a6adf19ebc4bf29057adbe44a17e5666`
to retain its paid/year policy and ACL protections. It does not merge either PR.

## 2026-11-18 — Revalidated, extended asset-only proposal

This is a local proposal against unchanged PR #75 head
`3a0ca544baa3b918c33bdd95140befd6b645c122`; it has NOT been pushed.
The November 11 section below is historical evidence, not a claim of new CI runs.

Current read-only catalog evidence is in
`lecture-assets-catalog-evidence-2026-11-18.json`.
All 1,175 commits reachable after fetching available remote branches were searched.
The original six-column CREATE was again found at commit `4031adcb274df16369d2b3af93b2e2c0ebf39f5d`
and in ledger migration `20260930114204_kifaro_backend`. The three path additions
were not located in that reachable history or the available ledger statements.
They remain a catalog-derived reconstruction, not recovered original SQL.

No missing path-specific CHECK, FK, index, default, or grant was found in the current
catalog. The primary key and updated_by FK already come from the base migration;
the provider/status constraints and updated_by index come from subsequent checked-in
migrations. The unrelated `video_storage_path` field remains absent from the replay
baseline and is deliberately not fabricated by this three-column patch.
Production's broad table grants include TRUNCATE for anon/authenticated on
lecture_assets. Those are excess privileges, not prerequisites to copy. This proposal
does not fix that separate live ACL issue or establish an external exploitation path.

New tests snapshot owner, relation ACLs, RLS flags, policies, constraints, indexes,
and existing column definitions before the ALTER; they assert exact preservation
and exactly three new nullable text columns with no defaults or column grants.
The contract test rolls back, then the runner applies the actual bootstrap atomically.
Role tests cover the original readiness projection and, separately, the later
security-invoker view, RPC and insert/update/delete readiness synchronization.
Local guards rejected reruns, populated tables and RLS-disabled tables; failed
transactions left the asset table empty with RLS enabled.

Fresh native PostgreSQL 15.19 and 17.11 clusters gave the same results:

| Scenario | Result on both versions |
| --- | --- |
| Raw PR history | Exit 1 after 8 files; pricing table missing |
| Unmodified PR #75 candidate | Exit 1 after 10 files; video_path missing |
| This proposal, all 52 historical files scheduled | Exit 1 after 15 files; file 16 needs mcq_questions |
| Pricing + exact asset schema/security contract + original/later readiness checks | PASS |
| Separate entitled paid-video runtime probe | FAIL, SQLSTATE 42703: v_ent.view_limit missing |
| PR #74 focused role fixture, fresh and legacy defaults | PASS |
| Same role fixtures after applying exact PR #78 revocation in isolation | PASS |

No historical failure was skipped and no application tables were added to the auth
fixture. Files 16–52 have NOT completed. Full payment, assessment, real Auth,
PostgREST, private storage and Bunny end-to-end behavior are not certified.
The tests use synthetic claims/identities and no production connections or data.
Shell syntax and git whitespace checks passed. No hosted CI was run for this proposal.

PR #74 is already an ancestor of #75; this proposal does not alter its five-table
ACL normalization, academic-year/entitlement policies or protected answer columns.
PR #78 head `a6de7cbb82445e7009bfebe24268f099741f6808` has no asset-table changes;
its exact five-table TRUNCATE revocation is compatible with the focused tests.
Git merge-tree checks of #75 with #78 and current main
`4457b5ad7467e4a6d20fb8019fb4aab524119a85` were conflict-free. This is textual
compatibility, not a successful full combined migration replay. PR #78 does not
cover lecture_assets or supply any of the missing bootstrap columns.

Next dependency: review the recovered MCQ source before enabling it. Its original
published-only SELECT policy must not bypass paid/year restrictions. Review the
missing entitlement columns (view_limit, views_used, offer_academic_year,
offer_nationality), later assessment schema and historical data-generation SQL
as separate changes. Do not remove failing checks to make the workflow green.

Rollback: reverse this patch before any remote update. For this disposable test
workflow, stop/delete only its isolated test cluster and recreate it from the
unchanged PR head. Do not issue DROP COLUMN CASCADE or modify production migration
history. If a future approved commit is pushed, revert that commit and rerun the
baseline; there is no production rollback because this proposal is not applied there.

Approval proposal: push only this reviewed patch and evidence to existing branch
fix/fresh-database-bootstrap, keep PR #75 Draft, and let its PostgreSQL 15/17 CI
record the remaining failure. No new PR, merge, deployment or production SQL.

## 2026-11-11 — Asset readiness candidate

Reviewed on PR #75 head `3a0ca544baa3b918c33bdd95140befd6b645c122`.
The sections below this update record the earlier November 1 investigation.

| Object | Source and decision |
| --- | --- |
| Original `lecture_assets` | Git commit `4031adcb274df16369d2b3af93b2e2c0ebf39f5d` and Supabase ledger `20260930114204_kifaro_backend` contain the same six-column CREATE. The checked-in migration already creates the table, its lecture ID primary key and its updated-by FK to auth.users. |
| `video_path`, `pdf_path`, `pptx_path` | No original addition located in reachable Git history (1,175 commits examined) or the recorded CREATE/ALTER statements on this table in the Supabase ledger. Read-only catalog inspection showed all three are nullable text with no default and no path-specific constraint or index. Reconstruct only those three columns. |
| Readiness projection and access | The repo already supplies the admin-only raw SELECT policy in `20261001124500`, the earlier admin write policies and the ID/boolean projection in `20261001231000`. The later `20261006171500` switches the projection to an invoker view backed by the public readiness table. |
| Other columns | The catalog also has nullable text `video_storage_path`. It is a distinct field consumed later and is outside this view's dependencies. Bunny fields and their constraints already have a subsequent checked-in ALTER. |

Only the candidate runner injects `supabase/bootstrap/lecture-asset-paths.sql`,
immediately before the unchanged readiness migration. The ALTER is atomic, fails if a
target column already exists, and requires an empty RLS-enabled test table. It adds
no grants, policies, defaults, backfill, copied URLs or storage objects.

### Local verification

Both native servers used pgcrypto and the repository's synthetic auth platform.
Each strict run began in its own disposable cluster and exited 1 on its first
migration error. Counts exclude fixture and bootstrap scripts.

| Test | PostgreSQL 15.19 | PostgreSQL 17.11 |
| --- | --- | --- |
| Raw historical chain | 8 files, missing pricing table | Same |
| Previously committed PR candidate | 10 files, missing video_path | Same |
| Patched candidate, 52 historical files in scope | 15 completed. File 16, `20261006181500_mcq_mastery_tracking.sql:2`, failed on missing `public.mcq_questions` | Same |
| Pricing role tests and new asset readiness tests | Passed | Passed |
| Five-table assessment role fixture, fresh and legacy ACL modes | Both passed | Both passed |
| Separate paid-video runtime call on the partial schema | Failed, SQLSTATE 42703, record `v_ent` has no field `view_limit` | Same |

The asset test runs immediately after the original readiness view. It checks the
exact public projection, different blank/NULL path combinations, anonymous and
student flags, hidden raw rows even for an entitled student, refusal of student
writes, no-entitlement and original-PPTX denials, and positive administrator
read/insert/update. Test data rolls back. The existing Guardian/Auth/Viva unit
suites also passed locally (38/38). No hosted workflow run is attributed to this patch.

To reproduce the strict result, run `bash scripts/test-fresh-database.sh candidate`
with the loopback settings and pristine cluster in `.github/workflows/fresh-database.yml`.
For the independent runtime probe on the stopped cluster, seed a synthetic
authenticated user, a paid lecture with a nonblank video path and an active video
entitlement in a transaction. Set the authenticated role and the matching JWT subject,
then call `public.consume_lecture_asset(lecture_id, 'video')`. The call reaches the
missing entitlement field. The live catalog describes `view_limit` as nullable
integer with no default and `views_used` as non-null integer default 0. Neither was
added by this patch. Actual Supabase playback, signing and billing were not tested.

The next replay dependency has archived source in
`supabase/bootstrap/recovered/20261006173405_add_anatomate_question_bank.sql`.
Its initial SELECT policy uses only `published = true`. Review that policy against
paid/year access before enabling the table, and review the later assessment
data-generation operations separately. The full chain is still blocked.

## Evidence recovered (November 1)

A complete clone exposed 1,154 reachable commits and 75 SQL-changing commits.
Searching all reachable history for creation of pricing rules, MCQs and the private
admin helper found only PR #74's synthetic test definitions, not their original SQL.
The pricing UI first appeared at `2b6a852581f185a1df907c6710f68a237a988173`;
the database-backed MCQ hook appeared at `65f939392fefcb7f5fa17a60e28c54ce889c086d`.
Neither commit contains its corresponding table creation.

Read-only access to the actual `supabase_migrations.schema_migrations` ledger recovered:

| Object | Canonical evidence | Treatment |
| --- | --- | --- |
| `private.is_admin()` | `20260930114254_harden_kifaro_rls`; live pg_get_functiondef agrees | Helper body restored in fresh-only candidate |
| `mcq_questions` | `20261006173405_add_anatomate_question_bank` | Exact source archived; not yet activated |
| Assessment learning-point/case columns | `20261007003409_case_four_level_learning_point_model` | Exact source archived, includes data generation; review before activation |
| Assessment/MCQ quality and image columns | `20261007055624_case_and_image_quality_gate` | Exact source archived, includes data rewrites; review before activation |
| `lecture_pricing_rules` | Original CREATE absent from Git and recorded production migration statements; current columns/constraints/indexes/RLS/ACL read from catalogs | Explicitly reconstructed candidate, not claimed original |
| `lecture_assets.video_path` and related storage/view-limit prerequisites | Referenced by checked-in SQL but original additions not recovered | Remaining reconstruction/source approval needed |

`recovered/` SQL is source evidence, not a deployment directory. In particular,
the historical RLS file drops a public helper that legacy numbered policies still
reference; replaying it blindly is unsafe. Do not concatenate archived migrations.
Only catalog metadata and migration source were inspected; no student/payment rows
were exported. No production DDL/DML, migration-history repair, or deployment ran.

## Candidate and safety boundaries

`supabase/bootstrap/pricing-prerequisites.sql` runs only in the explicit disposable
test runner, after the first eight files and before the formerly failing ALTER.
It is outside `supabase/migrations`, so Supabase db push does not apply it.
No historical migration is changed by this work beyond inherited PR #74 changes.
The runner refuses non-loopback/non-test database names, connection overrides,
pre-existing app relations, schemas and roles. The bootstrap additionally refuses
existing helper/pricing objects and populated foundational tables.
It does not truncate, drop tables, backfill production, or replace an existing helper.

The reconstructed pricing table retains catalog constraints and matching-year/
nationality policies, RLS, and admin-only writes. It intentionally excludes the
production's excess anon/ALL/TRUNCATE grants. The audit trigger is installed by
the existing later security migration, not fabricated here. The helper receives
schema USAGE and EXECUTE needed by later existing anonymous/admin predicates;
PUBLIC receives no EXECUTE. These ACL differences are deliberate and reviewable.

## November 1 verification

Local isolated engine: PostgreSQL 18.6 / PGlite 0.5.14, installed in temporary scratch,
using the real pgcrypto extension and synthetic Supabase auth/roles. All migration
files are attempted in lexical order; each file is atomic and replay stops at its
first failure. No failed file is skipped and no missing app table is hidden in the
platform fixture.

| Check | Result |
| --- | --- |
| Unchanged historical replay | BLOCKED after 8 files: missing pricing table at `20261001124500_separate_video_datashow_access.sql` |
| Candidate replay | BLOCKED after 10 files: `20261001231000_lecture_asset_readiness.sql`, missing `video_path` |
| New pricing role probes | PASS: RLS, no guest SELECT, no student TRUNCATE, no PUBLIC helper EXECUTE, own-year selection, denied student price insert, no-identity selection denied |
| Shell syntax / whitespace | PASS |
| Native PostgreSQL 15/17 | Dedicated strict GitHub Actions matrix; consult actual run before claiming results |
| Full fresh database / Supabase integration / complete payment and assessment regression on full schema | NOT PASSED |

The new workflow **fails** at the remaining blocker. PR #74's older green
known-blocker diagnostic remains a separate test and does not certify this work.
The focused assessment role fixture still does not represent a complete installation.
PL/pgSQL can defer column resolution until invocation, so passing a migration file
does not prove all routines are executable (notably asset view-limit fields).

## November 1 follow-up items

Obtain the original pre-October storage/pricing/view-limit SQL or approve a reviewed
catalog-derived reconstruction of the missing asset and entitlement columns,
constraints, indexes, grants and policies. Then activate the recovered MCQ and
assessment definitions at their actual dependency points, excluding/reviewing
historical content-generation operations. Continue strict replay to the end;
run PR #74's authorization probes against the resulting full schema, not just its
focused fixture, and exercise real Supabase Auth/PostgREST/storage separately.
Also reconcile numbered legacy schema defaults with the later backend's CREATE
TABLE IF NOT EXISTS declarations (these do not add missing columns or replace
earlier checks/defaults). Do not certify fresh-install readiness until resolved.

Any production ACL cleanup is a separate forward migration requiring owner approval.
Owner approval is required before merge or any production application.
