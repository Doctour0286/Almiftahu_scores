#!/usr/bin/env bash
# Rollback script test: migrations/rollback/reverse_sync.sql (runbook rollback before step 7).
# Builds its OWN throwaway local database at the pre-005 state (000-004), simulates new-client
# activity, then checks: the copy, idempotence, the full round trip back through
# private.sync_legacy_students(), other courses untouched, and both refusal paths.
# Usage: PGHOST=localhost PGPORT=5432 PGUSER=postgres tests/tools/reverse_sync_roundtrip.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
DB="${DB:-mahad_revsync}"
q()  { psql -X -q -t -A -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
FAILS=0
ok()   { echo "  ok   $1"; }
bad()  { echo "  FAIL $1"; FAILS=$((FAILS+1)); }
eq()   { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (got '$2', want '$3')"; fi; }
run_rs() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f migrations/rollback/reverse_sync.sql 2>&1; }
changed() { sed -n 's/.*legacy students rows updated.*/&/p' | sed -E 's/.*checked, ([0-9]+) legacy.*/\1/'; }
snap_students()    { q -c "select md5(string_agg(concat_ws('|',id,sn,days::text,bonus_units::text,active::text,name), ';' order by id)) from public.students"; }
snap_enrollments() { q -c "select md5(string_agg(concat_ws('|',student_id,course_id,sn,days::text,bonus_units::text,active::text), ';' order by student_id,course_id)) from public.enrollments"; }

psql -X -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/tools/supabase_shim.sql
for f in migrations/00[0-4]_*.sql; do psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" >/dev/null 2>&1; done

echo "== setup: legacy rows exactly as the old app wrote them, then the step-4 copy"
q -c "truncate public.students cascade" >/dev/null   # the shim may seed rows; this test owns its data
q -c "insert into public.students(id,sn,name,days,bonus_units,active) values
 ('s1',1,'A','{10,9,8,7,6,5,4,3,2,1}','{0,0,0,0,0,0,0,0,0,0}',true),
 ('s2',2,'B','{10,10,10,10,10,10,10,10,10,10}','{1,0,0,0,0,0,0,0,0,2}',true),
 ('s3',3,'C','{5,-1,-1,-1,-1,-1,-1,-1,-1,-1}','{-1,-1,-1,-1,-1,-1,-1,-1,-1,-1}',false)" >/dev/null
q -c "select private.sync_legacy_students()" >/dev/null
eq "3 ADAB enrollments after step-4 copy" "$(q -c "select count(*) from public.enrollments")" "3"

echo "== T1 immediately after the copy: only the harmless bonus -1 -> 0 normalisation differs"
OUT=$(run_rs); eq "rows updated" "$(echo "$OUT" | changed)" "1"
eq "s3 days/active/sn untouched, bonus now zeros" "$(q -c "select days::text||active::text||sn::text||bonus_units::text from public.students where id='s3'")" "{5,-1,-1,-1,-1,-1,-1,-1,-1,-1}false3{0,0,0,0,0,0,0,0,0,0}"

echo "== simulate the new client: scores edited, a student deactivated, a student added, another course"
CID=$(q -c "select id from public.courses where code='ADAB'")
q -c "update public.enrollments set days='{10,9,10,7,6,5,4,3,2,1}', bonus_units='{0,1,0,0,0,0,0,0,0,0}' where student_id='s1'" >/dev/null
q -c "update public.enrollments set active=false where student_id='s2'" >/dev/null
q -c "insert into public.students(id,sn,name,days,bonus_units,active) values ('s4',4,'D','{-1,-1,-1,-1,-1,-1,-1,-1,-1,-1}','{-1,-1,-1,-1,-1,-1,-1,-1,-1,-1}',true)" >/dev/null
q -c "insert into public.enrollments(student_id,course_id,sn,days,bonus_units) values ('s4','$CID',4,'{7,8,-1,-1,-1,-1,-1,-1,-1,-1}','{0,0,0,0,0,0,0,0,0,0}')" >/dev/null
q -c "insert into public.courses(code,name) values ('OTH','Other')" >/dev/null
q -c "insert into public.students(id,sn,name,days,bonus_units,active) values ('s5',5,'E','{1,1,1,1,1,1,1,1,1,1}','{0,0,0,0,0,0,0,0,0,0}',true)" >/dev/null
q -c "insert into public.enrollments(student_id,course_id,sn,days,bonus_units) select 's5', id, 1, '{3,3,3,3,3,3,3,3,3,3}','{0,0,0,0,0,0,0,0,0,0}' from public.courses where code='OTH'" >/dev/null
q -c "insert into public.enrollments(student_id,course_id,sn,days,bonus_units) select 's1', id, 2, '{9,9,9,9,9,9,9,9,9,9}','{0,0,0,0,0,0,0,0,0,0}' from public.courses where code='OTH'" >/dev/null
S5=$(q -c "select md5(concat_ws('|',id,sn,days::text,bonus_units::text,active::text,name)) from public.students where id='s5'")
ENR_BEFORE=$(snap_enrollments)

echo "== T2 reverse sync copies the new-client state"
OUT=$(run_rs); eq "rows updated (s1, s2, s4)" "$(echo "$OUT" | changed)" "3"
eq "s1 scores copied (ADAB, not the OTH row)" "$(q -c "select days::text||bonus_units::text from public.students where id='s1'")" "{10,9,10,7,6,5,4,3,2,1}{0,1,0,0,0,0,0,0,0,0}"
eq "s2 deactivated"                             "$(q -c "select active from public.students where id='s2'")" "f"
eq "s4 (added by new client) scores copied"     "$(q -c "select days::text from public.students where id='s4'")" "{7,8,-1,-1,-1,-1,-1,-1,-1,-1}"
eq "s5 (other course only) untouched"           "$(q -c "select md5(concat_ws('|',id,sn,days::text,bonus_units::text,active::text,name)) from public.students where id='s5'")" "$S5"
eq "names untouched"                            "$(q -c "select string_agg(name,'' order by id) from public.students")" "ABCDE"

echo "== T3 idempotent"
A=$(snap_students); OUT=$(run_rs); eq "second run updates 0 rows" "$(echo "$OUT" | changed)" "0"; eq "students unchanged by second run" "$(snap_students)" "$A"

echo "== T4 round trip: re-copying forward reproduces the enrollments of the legacy students exactly"
snap_legacy_enr() { q -c "select md5(string_agg(concat_ws('|',student_id,course_id,sn,days::text,bonus_units::text,active::text), ';' order by student_id,course_id)) from public.enrollments where student_id in ('s1','s2','s3','s4')"; }
LEG_BEFORE=$(snap_legacy_enr)
q -c "select private.sync_legacy_students()" >/dev/null
eq "enrollments of s1-s4 identical after reverse then forward sync" "$(snap_legacy_enr)" "$LEG_BEFORE"
# v3.9 fix: the forward copy must not enrol a student who is only in another course (s5) into ADAB.
SPUR=$(q -c "select count(*) from public.enrollments e join public.courses c on c.id=e.course_id where c.code='ADAB' and e.student_id='s5'")
eq "forward sync did not enrol the other-course-only student in ADAB" "$SPUR" "0"
q -c "delete from public.enrollments where student_id='s5' and course_id='$CID'" >/dev/null   # undo, keep later steps clean

echo "== T5 refuses when ADAB no longer matches the old client's assumptions"
BEFORE=$(snap_students)
q -c "update public.enrollments set days='{1,1,1,1,1,1,1,1,1,1}' where student_id='s1' and course_id='$CID'" >/dev/null
q -c "update public.courses set day_max=20 where code='ADAB'" >/dev/null
if OUT=$(run_rs); then bad "should have refused (day_max=20)"; else echo "$OUT" | grep -q "settings differ" && ok "refused: settings differ" || bad "wrong refusal: $OUT"; fi
eq "nothing changed by the refused run" "$(snap_students)" "$BEFORE"
q -c "update public.courses set day_max=10 where code='ADAB'" >/dev/null

echo "== T6 refuses after 005 (simulated by removing anon write on students)"
q -c "revoke update on public.students from anon" >/dev/null
if OUT=$(run_rs); then bad "should have refused (005 applied)"; else echo "$OUT" | grep -q "005_security_lockdown is already applied" && ok "refused: 005 applied" || bad "wrong refusal: $OUT"; fi
eq "nothing changed by the refused run" "$(snap_students)" "$BEFORE"
q -c "grant update on public.students to anon" >/dev/null

echo "== T7 works again once the cause is fixed"
OUT=$(run_rs); eq "updates the one differing row (s1)" "$(echo "$OUT" | changed)" "1"

psql -X -q -d postgres -c "drop database $DB" >/dev/null
[ "$FAILS" -eq 0 ] && echo "ALL REVERSE-SYNC TESTS PASSED" || { echo "$FAILS FAILED"; exit 1; }
