# Fresh database recovery — incomplete, do not deploy

Inspected 2026-11-01. Starting main: `4a22bbd3300f8cd05a1ad5f9f45fd4ada01ec1e0`.
This branch includes PR #74 head `b1b2ba77a6adf19ebc4bf29057adbe44a17e5666`
to retain its paid/year policy and ACL protections. It does not merge either PR.

## Evidence recovered

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

## Verification and honest readiness

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

## Next required evidence/review

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
