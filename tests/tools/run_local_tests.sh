#!/usr/bin/env bash
# Runs every migration + every SQL test against a throwaway LOCAL Postgres (never Supabase).
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres tests/tools/run_local_tests.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${DB:-mahad_test}"
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/tools/supabase_shim.sql
# 005 (lockdown) and 006 (drop legacy) are applied AFTER the pre-lockdown tests: several of them assert the 000-004 state.
# Phase 1+ migrations (010 and up) go in after the lockdown stage below: 005 revokes every function grant and re-grants only the 16 Phase-0 RPCs.
for f in migrations/[0-9]*.sql; do case "$f" in migrations/005_*|migrations/006_*|migrations/0[1-9][0-9]_*) continue;; esac; echo ">> $f"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
for f in tests/sql/*.test.sql; do case "$f" in tests/sql/phase0_lockdown.test.sql|tests/sql/phase[1-9]_*) continue;; esac; echo ">> $f"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
echo ">> tests/tools/concurrency_sn.sh"; DB="$DB" tests/tools/concurrency_sn.sh
# Lockdown: apply twice (idempotent), then the lockdown tests, then re-run the roster tests AS the locked-down database.
echo ">> migrations/005_security_lockdown.sql (1st run)"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f migrations/005_security_lockdown.sql
echo ">> migrations/005_security_lockdown.sql (2nd run, idempotent)"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f migrations/005_security_lockdown.sql
echo ">> tests/sql/phase0_lockdown.test.sql"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/sql/phase0_lockdown.test.sql
echo ">> tests/tools/concurrency_sn.sh (after lockdown)"; DB="$DB" tests/tools/concurrency_sn.sh
echo ">> tests/tools/reverse_sync_roundtrip.sh (own database, pre-005 state)"; tests/tools/reverse_sync_roundtrip.sh
# 006 (drop legacy): only valid after 005. Apply twice (idempotent), prove the teacher workflow still runs on the slim table.
echo ">> migrations/006_drop_legacy.sql (1st run)"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f migrations/006_drop_legacy.sql
echo ">> migrations/006_drop_legacy.sql (2nd run, idempotent)"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f migrations/006_drop_legacy.sql
echo ">> tests/sql/phase0_lockdown.test.sql (after 006)"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/sql/phase0_lockdown.test.sql
echo ">> tests/tools/concurrency_sn.sh (after 006)"; DB="$DB" tests/tools/concurrency_sn.sh
# Phase 1+: applied on top of the locked-down, slimmed database. Each migration runs twice (idempotent).
for f in migrations/0[1-9][0-9]_*.sql; do
  [ -e "$f" ] || continue
  echo ">> $f (1st run)"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
  echo ">> $f (2nd run, idempotent)"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
for f in tests/sql/phase[1-9]_*.test.sql; do [ -e "$f" ] || continue; echo ">> $f"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
echo ">> tests/sql/phase0_lockdown.test.sql (after Phase 1 migrations)"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/sql/phase0_lockdown.test.sql
for f in tests/tools/concurrency_exam.sh; do [ -e "$f" ] || continue; echo ">> $f"; DB="$DB" "$f"; done
