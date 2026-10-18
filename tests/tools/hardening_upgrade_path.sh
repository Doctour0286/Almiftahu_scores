#!/usr/bin/env bash
# Recreates the PRODUCTION state (original insecure 050 applied), proves the holes are open, applies 060
# (twice), and re-runs the hardening test. Uses throwaway databases only. Needs a built $SRC database
# (run tests/tools/run_local_tests.sh first). Usage: PGHOST=localhost PGUSER=postgres tests/tools/hardening_upgrade_path.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
SRC="${SRC:-mahad_test}"; DB="${DB:-mahad_upgrade}"
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB template $SRC"
echo ">> recreate the old production state (original 050)"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/fixtures/050_original_insecure.sql 2>&1 | grep -v NOTICE || true
echo ">> prove the holes are open BEFORE the fix"
# (the 050 "back door" branch is guarded by private.auth_secrets, which no migration creates, so it is dead on this schema)
open=$(psql -d "$DB" -tAc "select (public.staff_login('admin@almiftahu.edu','admin123')->>'ok')::boolean")
anon=$(psql -d "$DB" -tAc "set role anon; select jsonb_typeof(public.admin_list_audio_submissions(null::uuid))" | tail -1)
[ "$open" = "t" ] && [ "$anon" = "array" ] || { echo "FAIL: could not reproduce the vulnerable state (open=$open anon=$anon)"; exit 1; }
echo "   confirmed: the default admin password works and anon can list recordings"
for i in 1 2; do echo ">> migrations/060_staff_hardening.sql (run $i)"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f migrations/060_staff_hardening.sql 2>&1 | grep -E "ERROR|NOTICE:  060" || true; done
echo ">> hardening test on the upgraded database"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/sql/phase5_hardening.test.sql 2>&1 | grep -E "ERROR|PASSED"
psql -q -d postgres -c "drop database $DB"
echo "UPGRADE PATH OK"
