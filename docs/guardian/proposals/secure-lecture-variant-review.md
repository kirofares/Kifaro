# PR #65: lecture variant metadata review and release gates

Status: review-only SQL, not a migration, not deployed. No paid environment is
created by this PR. Production SQL, merge/release, or paid Staging creation needs
separate owner authorization. Issue #47 remains unresolved until live verification.

## Baseline reviewed on 2026-10-22

- main: `4a22bbd3300f8cd05a1ad5f9f45fd4ada01ec1e0` (includes PR #69).
- Previous PR head: `47df4b232e38b94a97d20ae278ae8b7cd82a4afe`.
- Incorporate main without rewriting the review branch's history. CI keeps Node
  22, `npm ci`, Guardian, Auth, Viva, typecheck and build. Guardian's glob already
  includes the proposal contract test; do not run it twice.
- Add independent PostgreSQL 15/17 service jobs running actual SQL and SET ROLE
  assertions. They require no Supabase credentials and cannot deploy this proposal.

## Findings and bounded fixes

| Finding | Impact and action |
| --- | --- |
| Existing definer view reads an admin-only source | Keep the eight-field API, but point an invoker view at a separate RLS-protected catalog. Never grant students source access to fix an empty list. |
| Original proposal revoked only PUBLIC on the existing view | Explicitly revoke all table-level anon/authenticated grants too, then grant SELECT only. Test against permissive legacy default grants. |
| `CREATE TABLE IF NOT EXISTS` / replace function could reuse unverified objects | Use one-shot CREATE statements, fail on collisions, and roll back atomically. No silent adoption of extra columns, permissive policies, function owners or stale triggers. |
| Row triggers do not handle TRUNCATE | Add a statement trigger that clears the catalog; test both TRUNCATE and transaction rollback. Clients cannot truncate either table. |
| Initial copy can race with writes | Hold SHARE ROW EXCLUSIVE on the source through backfill and view swap, with a 5-second lock timeout and 60-second statement timeout. Retry only after inspection; do not partially apply. |
| Public-safe column names do not guarantee public-safe contents | Labels, descriptions and IDs are public for every published variant, even paid or other-year lectures. Review their contents for private paths, URLs, PII or answer text. No automatic text sanitization is claimed. |
| Publication is independent of entitlement | Preserve the existing public metadata behavior. Metadata visibility and file-availability booleans must NEVER grant file access or bypass year/subscription checks. Source `published` defaults to true in the old migration; privileged importers must explicitly mark drafts false. This PR does not change that default. |
| Privileged synchronization needs elevated write access | Keep a narrowly scoped SECURITY DEFINER trigger in private, empty search_path, fully qualified tables, no dynamic SQL, no EXECUTE for PUBLIC/anon/authenticated. Ordinary admin writes use the original source RLS; do not add an auth.uid requirement that breaks trusted imports/maintenance. Verify owner and schema CREATE privileges on Staging. |
| Viewer returns an empty list on metadata error | A successful UI render is not a permission test; inspect HTTP errors and compare exact expected rows. |
| Deployed dependencies absent from repository | The actual private.is_admin implementation and lecture-watermarked-pdf endpoint are not defined here. The viewer calls the latter with variantKey. Genuine Auth and protected-content verification remains mandatory. |

The SQL does not modify source rows, source grants, source policies, payments,
year rules, storage policies or file-serving functions. No breach is established
by the advisor warning or this code review.

## What the automated tests establish

`scripts/guardian/test-variant-rls.sh` is for a **new disposable local database**
only (`PGHOST=127.0.0.1`, `PGDATABASE=kifaro_variant_test`). It creates synthetic
roles/data, loads the real source migration, applies the exact proposal, verifies
reapplication fails, executes the role/synchronization checks, and rehearses
emergency containment. It never resets or drops an existing database.

The fixture's private.is_admin reads synthetic trusted app_metadata. It is NOT
proof of the deployed role implementation, Supabase Auth JWT validation,
PostgREST behavior, inherited production grants, concurrent connections, or file
access. Student and admin are identities within the `authenticated` database
role, not additional PostgreSQL roles. Never test student/admin paths using a
service-role key, postgres, the table owner or BYPASSRLS.

Local validation: Guardian 26/26, Auth 11/11, Viva 6/6; TypeScript and production
build passed on Node 24.19.0. The exact SQL suite also passed on embedded
PostgreSQL 17.5 (PGlite), including rejected reapplication and containment.
Native PostgreSQL 15/17 and Node 22 are enforced by GitHub Actions; check the
current commit's run results before treating those gates as passed.

## Staging prerequisites (no paid creation authorized)

1. Use an existing approved isolated Staging project, or obtain cost approval
   before creating one. Do not use production as a test substitute. The last
   issue report said no branch was available; this review did not provision one.
2. Inspect current PG version (15+), exact view column names/types/order,
   definitions/owners/reloptions, relation and column ACLs, inherited grants,
   RLS policies, private schema ACLs, function owners and source triggers.
   Confirm no client can CREATE in private or alter/disable the sync trigger.
   Reject unexpected column grants or inherited write privileges; do not merely
   assume table-level REVOKE removed them. Check default grants to other roles.
3. Capture schema-only definitions and ACLs for these objects, source row backup,
   exact published-view baseline, policy definitions and is_admin implementation.
   Keep any real private paths/PII out of GitHub logs and artifacts. Rehearse
   restoring backups on the disposable environment.
4. Create synthetic published and unpublished variants, empty/null/nonempty PDF
   and PPTX paths, two lecture IDs, and a label/description approved for public
   display. Use separate entitled, unentitled, wrong-year and expired-subscription
   students, a real admin, and anon. Also test anonymous Auth users if enabled.
5. After approval, use `supabase migration new <name>` to obtain a migration name,
   copy the reviewed SQL into that generated file, and apply only on Staging.
   This docs proposal is intentionally outside `supabase/migrations`.

## Role matrix: execute through PostgREST with real sessions

| Operation | anon | student (`authenticated`) | admin (`authenticated`) |
| --- | --- | --- | --- |
| View SELECT with the exact React projection, lecture filter and sort | Only published metadata | Same published metadata | Same published metadata |
| Catalog direct SELECT / `select=*` | Only published, exactly eight fields | Same | Same; drafts accessed via source only |
| Private source SELECT | Permission denied | Successful empty result under existing RLS | Published and draft records |
| Source INSERT / UPDATE / DELETE | Denied | INSERT denied; UPDATE/DELETE affect zero rows | Allowed; catalog reflects committed changes |
| View/catalog INSERT, UPDATE, DELETE, TRUNCATE | Denied | Denied | Denied; write source instead |
| Internal sync function direct call / RPC | Unavailable or denied | Unavailable or denied | Unavailable or denied |
| Private paths/source_name via metadata select | No such fields, no secret values in free text | Same | Same public endpoint contract |
| Protected PDF/datashow with variantKey | Denied | Allow only entitled/free eligible requests; deny wrong year, expired/no entitlement and drafts | Verify intended admin access |

For source SELECT, distinguish zero rows caused by RLS from HTTP 403 caused by
missing grants. For mutations assert exact row counts and unchanged data, not
just status codes. Try a guessed draft key/lecture ID directly; frontend hiding
is not authorization. Use expired/invalid tokens and forged user_metadata admin
claims. Verify real is_admin ignores user-editable authorization claims.

Additional required scenarios:

- Compare sorted public-view rows/types/booleans before and after; published
  variants remain selectable and open correctly in the actual viewer.
- Admin INSERT; label/description/order/path UPDATE; publish/unpublish; change
  both key fields; DELETE; rollback each mutation; confirm no stale rows.
- Staging-only privileged TRUNCATE and rollback on synthetic data. Never do this
  to production content as a test.
- Two connections: hold a source write lock and confirm proposal times out with
  no partial objects; release and retry. Write/update/delete during backfill and
  compare source projection vs catalog after commit. Measure lock duration on
  realistic volume and schedule a short maintenance window if needed.
- Confirm no unpublished or secret-path values reach PostgREST, GraphQL if
  enabled, Realtime publications if configured, logs or caches. Keep catalog out
  of replication/publications unless intentionally reviewed.
- Test no-store/cache invalidation and JWT refresh behavior where applicable;
  existing cached metadata is not revoked merely by a DB policy change.
- Run Supabase security advisors; verify invoker setting, source policies and
  role behavior. An absent advisor warning alone is not a release pass.

## Safe rollback / containment

1. **Failure before COMMIT:** execute ROLLBACK (or close the failed session).
   PostgreSQL rolls back table/function/trigger/view/grant changes as one unit.
   Verify baseline definition/ACLs and no partial catalog before retrying.
2. **Security concern after commit:** with owner approval run the review-only
   `secure-lecture-variant-containment.sql`. It revokes client SELECT on BOTH the
   view and catalog, preventing a direct-catalog bypass. Source rows and admin
   access remain intact. Expect variant listing to be unavailable; this is
   containment, not a zero-downtime restoration. Handle caches separately.
3. **Availability issue:** diagnose the exact error. Prefer a validated forward
   repair of grants, trigger or backfill. Do not grant students source SELECT,
   disable RLS, or blindly restore SECURITY DEFINER to make the UI work.
4. Pause source writes during repair; retain a fresh backup, compare every source
   row's eight-field projection against the catalog, and rerun the full role/API
   matrix. Regrant SELECT on both catalog and view to anon/authenticated only
   after validation and approval. Source metadata remains authoritative.
5. If a full schema reversal is required, prepare a baseline-specific reviewed
   script using captured definitions/ACLs and dependencies; remove triggers only
   after detaching the view safely, and never use DROP CASCADE. Restoring the old
   definer view reintroduces the known risk and requires explicit risk acceptance;
   no automatic unsafe down migration is supplied.
6. Record the approved commit/migration, backup ID, evidence, operator and outcome.
   Recheck advisor and viewer after any rollback/repair. Do not close #47 while
   production still has the original view or lacks verified role evidence.

References:
- https://github.com/kirofares/Kifaro/pull/65
- https://github.com/kirofares/Kifaro/issues/47#issuecomment-6263646080
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/functions
