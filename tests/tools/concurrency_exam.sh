#!/usr/bin/env bash
# AC-1.3 / AC-1.4 under real parallelism (LOCAL throwaway database that already has 010 + 011 applied):
#   * N parallel admin_create_draft calls for one course -> exactly one succeeds, one draft exists
#   * N parallel admin_save_draft calls with the SAME draft_rev -> exactly one succeeds, the rest E_CONFLICT
#   * N parallel admin_publish_version calls for one draft -> exactly one succeeds, exactly one live version
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres DB=mahad_test tests/tools/concurrency_exam.sh
set -euo pipefail
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
DB="${DB:-mahad_test}"; N="${N:-8}"
q() { psql -X -q -t -A -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

TOKEN=$(openssl rand -hex 32)
OUT=$(mktemp -d)
q -c "insert into private.teacher_sessions(token_hash, expires_at)
      values (encode(extensions.digest('$TOKEN','sha256'),'hex'), now() + interval '1 hour')"
CID=$(q -c "insert into public.courses(code,name) values ('CONCX','Concurrency exam') returning id")
trap 'q -c "delete from public.courses where code = '"'CONCX'"'" -c "delete from private.teacher_sessions where token_hash = encode(extensions.digest('"'$TOKEN'"','"'sha256'"'),'"'hex'"')" >/dev/null; rm -rf "$OUT"' EXIT

count_ok()  { grep -L 'ERROR' "$OUT"/$1.* 2>/dev/null | wc -l | tr -d ' '; }   # no ERROR line = the call succeeded
count_err() { grep -l "$2" "$OUT"/$1.* 2>/dev/null | wc -l | tr -d ' '; }

# 1. parallel create_draft
for i in $(seq 1 "$N"); do
  ( q -c "select public.admin_create_draft('$TOKEN', '$CID')" > "$OUT/create.$i" 2>&1 || true ) &
done
wait
OK=$(count_ok create); ERR=$(count_err create E_VALIDATION)
DRAFTS=$(q -c "select count(*) from private.exam_versions v join private.exams e on e.id = v.exam_id where e.course_id = '$CID' and v.status = 'draft'")
[ "$OK" -eq 1 ] && [ "$ERR" -eq $((N - 1)) ] && [ "$DRAFTS" -eq 1 ] \
  || { echo "FAIL create_draft: ok=$OK refused=$ERR drafts=$DRAFTS (want 1, $((N-1)), 1)"; exit 1; }
VID=$(q -c "select v.id from private.exam_versions v join private.exams e on e.id = v.exam_id where e.course_id = '$CID' and v.status = 'draft'")

# 2. parallel save_draft with the same revision (0): one winner, the rest conflict
for i in $(seq 1 "$N"); do
  DOC="{\"title\":\"writer $i\",\"duration_minutes\":30,\"sections\":[{\"title\":\"S\",\"format\":\"essay\",\"weight\":100,\"questions\":[{\"prompt\":\"q from $i\"}]}]}"
  ( q -c "select public.admin_save_draft('$TOKEN', '$VID', 0, '$DOC'::jsonb)" > "$OUT/save.$i" 2>&1 || true ) &
done
wait
OK=$(count_ok save); ERR=$(count_err save E_CONFLICT)
REV=$(q -c "select draft_rev from private.exam_versions where id = '$VID'")
TITLE=$(q -c "select title from private.exam_versions where id = '$VID'")
PROMPT=$(q -c "select q.prompt from private.questions q join private.sections s on s.id = q.section_id where s.version_id = '$VID'")
NQ=$(q -c "select count(*) from private.questions q join private.sections s on s.id = q.section_id where s.version_id = '$VID'")
WID=${TITLE#writer }
[ "$OK" -eq 1 ] && [ "$ERR" -eq $((N - 1)) ] && [ "$REV" -eq 1 ] && [ "$NQ" -eq 1 ] && [ "$PROMPT" = "q from $WID" ] \
  || { echo "FAIL save_draft: ok=$OK conflicts=$ERR rev=$REV questions=$NQ title='$TITLE' prompt='$PROMPT'"; exit 1; }

# 3. parallel publish of the same draft: one winner, exactly one live version
for i in $(seq 1 "$N"); do
  ( q -c "select public.admin_publish_version('$TOKEN', '$VID')" > "$OUT/pub.$i" 2>&1 || true ) &
done
wait
OK=$(count_ok pub); ERR=$(count_err pub E_VALIDATION)
LIVE=$(q -c "select count(*) from private.exam_versions v join private.exams e on e.id = v.exam_id where e.course_id = '$CID' and v.status = 'live'")
FLAG=$(q -c "select exam_live from public.courses where id = '$CID'")
[ "$OK" -eq 1 ] && [ "$ERR" -eq $((N - 1)) ] && [ "$LIVE" -eq 1 ] && [ "$FLAG" = "t" ] \
  || { echo "FAIL publish: ok=$OK refused=$ERR live=$LIVE exam_live=$FLAG"; exit 1; }

echo "OK: $N parallel create_draft / save_draft / publish -> one winner each, no duplicate draft or live version, stale saves get E_CONFLICT"
