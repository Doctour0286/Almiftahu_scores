#!/usr/bin/env bash
# Runs every migration + every SQL test against a throwaway LOCAL Postgres (never Supabase).
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres tests/tools/run_local_tests.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${DB:-mahad_test}"
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/tools/supabase_shim.sql
# 005 (lockdown) is applied AFTER the pre-lockdown tests: several of them assert the 000-004 state.
for f in migrations/[0-9]*.sql; do case "$f" in migrations/005_*) continue;; esac; echo ">> $f"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
for f in tests/sql/*.test.sql; do case "$f" in tests/sql/phase0_lockdown.test.sql) continue;; esac; echo ">> $f"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
echo ">> tests/tools/concurrency_sn.sh"; DB="$DB" tests/tools/concurrency_sn.sh
# Lockdown: apply twice (idempotent), then the lockdown tests, then re-run the roster tests AS the locked-down database.
echo ">> migrations/005_security_lockdown.sql (1st run)"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f migrations/005_security_lockdown.sql
echo ">> migrations/005_security_lockdown.sql (2nd run, idempotent)"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f migrations/005_security_lockdown.sql
echo ">> tests/sql/phase0_lockdown.test.sql"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/sql/phase0_lockdown.test.sql
echo ">> tests/tools/concurrency_sn.sh (after lockdown)"; DB="$DB" tests/tools/concurrency_sn.sh
