#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Deliberately refuses arbitrary database URLs, hostaddr/service overrides and
# production names. Each invocation requires a new disposable local cluster.
if [[ "${PGHOST:-}" != '127.0.0.1' || "${PGDATABASE:-}" != 'kifaro_grants_test' ||
      -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" || -n "${PGSERVICEFILE:-}" || -n "${PGOPTIONS:-}" ]]; then
  echo 'Use a new local cluster: PGHOST=127.0.0.1 PGDATABASE=kifaro_grants_test; no connection overrides.' >&2
  exit 1
fi
mode="${1:-fresh}"
case "$mode" in fresh|legacy|replay) ;; *) echo 'Expected fresh, legacy or replay' >&2; exit 1;; esac
psql -X --set=ON_ERROR_STOP=1 --file=tests/sql/assessment-grants-platform.sql
if [[ "$mode" == replay ]]; then
  # Diagnostic only: do not conceal the repository's known fresh-install blocker
  # behind prerequisite fixtures, skip a failed file, or treat it as readiness.
  log=$(mktemp)
  trap 'rm -f "$log"' EXIT
  count=0
  for migration in supabase/migrations/*.sql; do
    if ! psql -X --set=ON_ERROR_STOP=1 --single-transaction --file="$migration" >"$log" 2>&1; then
      cat "$log"
      if [[ "$migration" == 'supabase/migrations/20261001124500_separate_video_datashow_access.sql' ]] &&
         grep -Fq 'relation "public.lecture_pricing_rules" does not exist' "$log"; then
        echo "KNOWN FRESH-INSTALL BLOCKER after $count files: missing public.lecture_pricing_rules; replay NOT complete."
        exit 0
      fi
      echo "Unexpected replay failure: $migration" >&2
      exit 1
    fi
    count=$((count + 1))
  done
  echo 'Replay now succeeds: remove/update the known-blocker diagnostic and certify the complete history.' >&2
  exit 1
fi
if [[ "$mode" == legacy ]]; then
  psql -X --set=ON_ERROR_STOP=1 <<'SQL'
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
SQL
fi
psql -X --set=ON_ERROR_STOP=1 --file=tests/sql/assessment-grants-setup.sql
psql -X --set=ON_ERROR_STOP=1 --file=tests/sql/assessment-grants-runtime.sql
echo "PASS: five-table role regression ($mode); focused fixture, not full migration replay."

