#!/usr/bin/env bash
# Runs every migration + every SQL test against a throwaway LOCAL Postgres (never Supabase).
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres tests/tools/run_local_tests.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${DB:-mahad_test}"
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/tools/supabase_shim.sql
for f in migrations/[0-9]*.sql; do echo ">> $f"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
for f in tests/sql/*.test.sql; do echo ">> $f"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
