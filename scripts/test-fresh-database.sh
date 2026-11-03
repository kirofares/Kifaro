#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export LC_ALL=C
mode="${1:-candidate}"
case "$mode" in raw|candidate) ;; *) echo 'Expected raw or candidate' >&2; exit 2;; esac
if [[ "${PGHOST:-}" != 127.0.0.1 || "${PGDATABASE:-}" != kifaro_bootstrap_test ||
      -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" || -n "${PGSERVICEFILE:-}" || -n "${PGOPTIONS:-}" ]]; then
  echo 'Requires disposable loopback database kifaro_bootstrap_test without connection overrides' >&2
  exit 2
fi
psql=(psql -X --set=ON_ERROR_STOP=1)
# Reject populated databases BEFORE any setup/DDL. The CI database is disposable.
"${psql[@]}" <<'SQL'
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname NOT IN ('pg_catalog','information_schema')
             AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S'))
     OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','private','storage'))
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')) THEN
    RAISE EXCEPTION 'Not an empty disposable cluster/database: refusing bootstrap';
  END IF;
END $$;
SQL
"${psql[@]}" --file=tests/sql/assessment-grants-platform.sql
count=0
for migration in supabase/migrations/*.sql; do
  if [[ "$mode" == candidate && "$migration" == supabase/migrations/20261001124500_separate_video_datashow_access.sql ]]; then
    "${psql[@]}" --single-transaction --file=supabase/bootstrap/pricing-prerequisites.sql
    "${psql[@]}" --single-transaction --file=tests/sql/bootstrap-pricing-security.sql
  fi
  echo "REPLAY $migration"
  if ! "${psql[@]}" --single-transaction --file="$migration"; then
    echo "BLOCKED after $count files at $migration; fresh-install readiness NOT achieved" >&2
    if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
      echo "**BLOCKED:** $mode replay stopped after $count files at $migration. Full fresh installation has NOT passed." >> "$GITHUB_STEP_SUMMARY"
    fi
    exit 1
  fi
  count=$((count+1))
done
echo "PASS: all $count historical migrations replayed ($mode); platform is synthetic, not Supabase integration certification"
