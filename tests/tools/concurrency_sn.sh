#!/usr/bin/env bash
# AC-0.7: parallel admin_add_student calls must get distinct S/N and distinct student ids.
# Runs against a LOCAL throwaway database that already has migrations applied (see run_local_tests.sh).
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres DB=mahad_test tests/tools/concurrency_sn.sh
set -euo pipefail
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
DB="${DB:-mahad_test}"; N="${N:-12}"
q() { psql -X -q -t -A -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

TOKEN=$(openssl rand -hex 32)
q -c "insert into private.teacher_sessions(token_hash, expires_at)
      values (encode(extensions.digest('$TOKEN','sha256'),'hex'), now() + interval '1 hour')"
CID=$(q -c "insert into public.courses(code,name) values ('CONC','Concurrency') returning id")
CID2=$(q -c "insert into public.courses(code,name) values ('CONC2','Concurrency 2') returning id")
trap 'q -c "delete from public.students where id in (select student_id from public.enrollments where course_id in ('"'$CID'"','"'$CID2'"'))" -c "delete from public.courses where code in ('"'CONC'"','"'CONC2'"')" -c "delete from private.teacher_sessions where token_hash = encode(extensions.digest('"'$TOKEN'"','"'sha256'"'),'"'hex'"')" >/dev/null' EXIT

for i in $(seq 1 "$N"); do
  # alternate two courses so the global student-id allocation is contended across courses too
  C=$CID; [ $((i % 2)) -eq 0 ] && C=$CID2
  q -c "select public.admin_add_student('$TOKEN', '$C', 'Parallel $i')" >/dev/null &
done
wait

TOTAL=$(q -c "select count(*) from public.enrollments where course_id in ('$CID','$CID2')")
DSN1=$(q -c "select count(distinct sn) from public.enrollments where course_id = '$CID'")
CNT1=$(q -c "select count(*) from public.enrollments where course_id = '$CID'")
DSN2=$(q -c "select count(distinct sn) from public.enrollments where course_id = '$CID2'")
CNT2=$(q -c "select count(*) from public.enrollments where course_id = '$CID2'")
DID=$(q -c "select count(distinct student_id) from public.enrollments where course_id in ('$CID','$CID2')")
MAX1=$(q -c "select max(sn) from public.enrollments where course_id = '$CID'")
[ "$TOTAL" -eq "$N" ] && [ "$DSN1" -eq "$CNT1" ] && [ "$DSN2" -eq "$CNT2" ] && [ "$DID" -eq "$N" ] && [ "$MAX1" -eq "$CNT1" ] \
  || { echo "FAIL: total=$TOTAL (want $N) distinct-sn=$DSN1/$CNT1,$DSN2/$CNT2 distinct-ids=$DID"; exit 1; }
echo "OK: $N parallel adds across 2 courses -> distinct, contiguous S/N and distinct student ids"
