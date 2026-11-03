# Lecture variant read-access fix — 2026-11-03

## Result
Applied to the Anatomate production project using migration
`20261103075805_restrict_lecture_variant_view_to_read_access`.

The view `public.lecture_document_variants_public` now grants SELECT only to
`anon` and `authenticated`. The source table, its admin-only RLS policy, view
projection, and published-row filter are unchanged.

## Evidence
Before the change, both API roles had effective INSERT/UPDATE/DELETE privileges
on the automatically updatable view. Its original migration revoked privileges
from PUBLIC, but retained the direct role grants created by default privileges.
A read-only EXPLAIN under anon confirmed that UPDATE could be planned against
the source relation; no write was executed.

After the change:
- SELECT succeeds for anon and authenticated, exposing the existing 10 published metadata rows.
- The read-only regression SQL checks the frontend's eight-column projection and
  confirms SQLSTATE 42501 for INSERT, UPDATE and DELETE planning under both roles.
- Table-level and column-level write permissions are absent for both API roles.
- The source table remains protected by RLS; its authenticated admin access path is preserved.
- Source content count and fingerprint match before/after exactly; no content rows were changed.

The runtime tests were executed on the production database in a read-only
transaction. This is not a browser journey test or a full migration-history replay.

## Scope and remaining work
This mitigates a confirmed authorization defect. It does not establish past
exploitation or a data breach. This is an application grant issue, not the
Supabase Storage S3 vendor advisory.

The Supabase security-definer-view advisor remains because the existing
safe-column metadata projection still intentionally reads as its owner.
The broader RLS-safe catalog redesign in PR #65 is separate and was not deployed.
Other advisor findings were not silently disabled or marked resolved.

All four existing Storage buckets were private at inspection. The deployed
Bunny playback function authenticates users, checks video entitlement in the
database, then issues a 30-minute signed provider embed URL. These observations
do not certify Bunny's account-level token enforcement or the managed Storage
server patch version.

## Recovery
If metadata reads regress, restore only the necessary SELECT grants and inspect
the calling query. Do not restore public write privileges as a rollback.
Administrative edits belong on the source table through its existing admin RLS
path. No frontend build or Pages deployment is needed for this database fix.
