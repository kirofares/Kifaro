#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# This suite creates roles/tables and loads synthetic fixtures. Never accept a
# production connection string, service key, or arbitrary database target.
if [[ "${PGHOST:-}" != '127.0.0.1' || "${PGDATABASE:-}" != 'kifaro_variant_test' ]]; then
  echo 'Use a disposable local PostgreSQL database: PGHOST=127.0.0.1 PGDATABASE=kifaro_variant_test' >&2
  exit 1
fi
psql -X --set=ON_ERROR_STOP=1 --file=tests/sql/variant-catalog-setup.sql
psql -X --set=ON_ERROR_STOP=1 --file=docs/guardian/proposals/secure-lecture-variant-catalog.sql
# Reapplication must fail atomically, not accept an unverified existing catalog.
if psql -X --set=ON_ERROR_STOP=1 --file=docs/guardian/proposals/secure-lecture-variant-catalog.sql; then
  echo 'FAIL: proposal unexpectedly accepted existing objects' >&2
  exit 1
fi
psql -X --set=ON_ERROR_STOP=1 --file=tests/sql/variant-catalog-runtime.sql
psql -X --set=ON_ERROR_STOP=1 --file=docs/guardian/proposals/secure-lecture-variant-containment.sql
psql -X --set=ON_ERROR_STOP=1 --file=tests/sql/variant-catalog-containment.sql
