-- Phase 0 roster / course / score tests (task 0.2): migration 003.
-- Assert-style. Runs inside ONE transaction that is ROLLED BACK at the end, so it leaves no data
-- behind, on a local database or on staging. It temporarily replaces the teacher PIN hash and
-- clears the login throttle; the rollback restores both.
-- Covers: AC-0.5 (lesson totals), AC-0.7 (distinct S/N, sequential; the parallel version is
-- tests/tools/concurrency_sn.sh), AC-0.8, AC-0.9, AC-0.13 .. AC-0.17.
-- Section T0.13 asserts exact numbers for the local sample students (s1..s4); it is skipped
-- automatically when those rows are not present (e.g. on a staging copy of real data).
\set ON_ERROR_STOP on
begin;

-- ---------- helpers (session-local) ----------
create function pg_temp.err(q text) returns text language plpgsql as $$
declare m text;
begin execute q; return 'OK';
exception when others then get stacked diagnostics m = message_text; return m; end $$;

create function pg_temp.t() returns text language sql as $$ select current_setting('t.tok') $$;

-- admin_save_course wrappers: return the error code (or 'OK') / the error detail
create function pg_temp.save_err(j text, confirm boolean default false, copy_from uuid default null) returns text
language plpgsql as $$
declare m text;
begin perform public.admin_save_course(current_setting('t.tok'), j::jsonb, confirm, copy_from); return 'OK';
exception when others then get stacked diagnostics m = message_text; return m; end $$;

create function pg_temp.save_det(j text, confirm boolean default false) returns text
language plpgsql as $$
declare m text;
begin perform public.admin_save_course(current_setting('t.tok'), j::jsonb, confirm); return 'OK';
exception when others then get stacked diagnostics m = pg_exception_detail; return m; end $$;

create function pg_temp.save(j text, confirm boolean default false, copy_from uuid default null) returns jsonb
language sql as $$ select public.admin_save_course(current_setting('t.tok'), j::jsonb, confirm, copy_from) $$;

create function pg_temp.cid(p_code text) returns uuid language sql as $$ select id from public.courses where code = p_code $$;

do $$
begin
  update private.secrets set value = extensions.crypt('roster-test-pin', extensions.gen_salt('bf', 4))
   where key = 'teacher_pin_hash';
  delete from private.auth_throttle;
  perform set_config('t.tok', public.teacher_login('roster-test-pin')->>'token', false);
  assert length(current_setting('t.tok')) = 64, 'test login failed';
end $$;

\echo '== T0.6 every admin RPC rejects a bad token =='
do $$
declare q text; v_cid text := gen_random_uuid()::text;
begin
  foreach q in array array[
    format('select public.admin_save_course(%L, %L)', 'garbage', '{"code":"ZZ","name":"x"}'),
    format('select public.admin_set_course_status(%L, %L, %L)', 'garbage', v_cid, 'active'),
    format('select public.admin_list_roster(%L, %L)', 'garbage', v_cid),
    format('select public.admin_list_students_all(%L)', 'garbage'),
    format('select public.admin_add_student(%L, %L, %L, null)', 'garbage', v_cid, 'x'),
    format('select public.admin_enroll_student(%L, %L, %L)', 'garbage', v_cid, 's1'),
    format('select public.admin_bulk_seed(%L, %L, %L)', 'garbage', v_cid, 'x'),
    format('select public.admin_update_student(%L, %L, %L, null)', 'garbage', 's1', 'x'),
    format('select public.admin_set_active(%L, %L, true)', 'garbage', v_cid),
    format('select public.admin_delete_student(%L, %L)', 'garbage', 's1'),
    format('select public.admin_save_day(%L, %L, 0, 1, 0)', 'garbage', v_cid),
    format('select public.admin_set_exam_approval(%L, %L, true)', 'garbage', v_cid),
    'select public.admin_list_students_all(null)',
    format('select public.admin_list_students_all(%L)', '')
  ] loop
    assert pg_temp.err(q) = 'E_AUTH', 'expected E_AUTH for: ' || q;
  end loop;
end $$;

\echo '== T0.7 lesson results are maintained (AC-0.5) =='
do $$
declare v_bad int;
begin
  assert (select count(*) from public.enrollment_results) = (select count(*) from public.enrollments),
         'every enrollment has a result row (backfill)';
  -- independent recomputation of the original §3.3 formula from each enrollment's own arrays
  select count(*) into v_bad
  from public.enrollments e
  join public.courses c on c.id = e.course_id and c.lesson_mode = 'scored'
  join public.enrollment_results r on r.enrollment_id = e.id
  where abs(r.lesson_pct - least(100,
          coalesce((select sum(d) from unnest(e.days) d where d >= 0), 0)
        + coalesce((select sum(b) from unnest(e.bonus_units) b where b > 0), 0) * 2)) > 0.0001
     or r.status is distinct from (case when cardinality(e.days) = c.day_count
                                         and not exists (select 1 from unnest(e.days) d where d < 0)
                                        then 'eligible' else 'not_eligible' end);
  assert v_bad = 0, format('%s enrollments have a wrong lesson result', v_bad);
  assert (select count(*) from public.enrollment_results where exam_pct is not null or final is not null) = 0,
         'Phase 0 results carry no exam fields';
end $$;

\echo '== T0.8 courses: create, validate, unit label, exam-only, copy (AC-0.13/0.14/0.17) =='
do $$
declare r jsonb; c jsonb; v_week uuid; v_copy uuid; v_ad uuid;
begin
  -- blank course gets the D-40 defaults
  c := pg_temp.save('{"code":"BLANK","name":"Blank course"}')->'course';
  assert c->>'unit_label' = 'Day' and (c->>'day_count')::int = 10 and (c->>'weight_lessons')::numeric = 50
     and (c->>'pass_mark')::numeric = 60 and c->>'eligibility_rule' = 'all_units' and c->>'lesson_mode' = 'scored'
     and jsonb_array_length(c->'grade_bands') = 4 and c->>'status' = 'active', 'blank defaults';

  -- AC-0.13: a second course with its own unit label and unit count
  r := pg_temp.save('{"code":"WEEKS","name":"Weekly course","name_ar":"دورة","unit_label":"Week","unit_label_ar":"أسبوع","day_count":8,"day_max":5}');
  v_week := (r->'course'->>'id')::uuid;
  assert r->'course'->>'unit_label' = 'Week' and (r->'course'->>'day_count')::int = 8
     and r->'course'->>'unit_label_ar' = 'أسبوع' and (r->'course'->>'day_max')::int = 5, 'WEEKS course saved';

  -- validation (each must be rejected and create nothing)
  assert pg_temp.save_err('{"code":"bad code","name":"x"}') = 'E_VALIDATION', 'bad code';
  assert pg_temp.save_err('{"code":"lower","name":"x"}') = 'E_VALIDATION', 'lowercase code';
  assert pg_temp.save_err('{"code":"ADAB","name":"dup"}') = 'E_VALIDATION', 'duplicate code (AC-0.17)';
  assert pg_temp.save_err('{"code":"NONAME"}') = 'E_VALIDATION', 'name required';
  assert pg_temp.save_err('{"name":"No code"}') = 'E_VALIDATION', 'code required';
  assert pg_temp.save_err('{"code":"W1","name":"x","weight_lessons":60,"weight_exam":60}') = 'E_VALIDATION', 'weights must sum to 100';
  assert pg_temp.save_err('{"code":"W2","name":"x","day_count":0}') = 'E_VALIDATION', 'scored needs >= 1 unit';
  assert pg_temp.save_err('{"code":"W3","name":"x","day_count":61}') = 'E_VALIDATION', 'max 60 units';
  assert pg_temp.save_err('{"code":"W4","name":"x","pass_mark":101}') = 'E_VALIDATION', 'pass mark range';
  assert pg_temp.save_err('{"code":"W5","name":"x","unit_label":""}') = 'E_VALIDATION', 'unit label required';
  assert pg_temp.save_err('{"code":"W6","name":"x","day_count":"abc"}') = 'E_VALIDATION', 'non-numeric value';
  assert pg_temp.save_err('{"code":"W7","name":"x","lesson_mode":"weird"}') = 'E_VALIDATION', 'bad mode';
  assert pg_temp.save_err('{"code":"W8","name":"x","grade_bands":[{"label":"A","min":90},{"label":"B","min":90}]}') = 'E_VALIDATION', 'duplicate band min';
  assert pg_temp.save_err('{"code":"W9","name":"x","grade_bands":[{"label":"A","min":101}]}') = 'E_VALIDATION', 'band min range';
  assert pg_temp.save_err('{"code":"W10","name":"x","grade_bands":[{"label":"","min":50}]}') = 'E_VALIDATION', 'band label required';
  assert pg_temp.save_err('{"code":"W11","name":"x","lesson_max":0}') = 'E_VALIDATION', 'lesson_max > 0';
  assert pg_temp.save_err('{"code":"W12","name":"x","day_max":0}') = 'E_VALIDATION', 'day_max >= 1';
  assert pg_temp.save_err('{"code":"W13","name":"x","bonus_unit_value":-1}') = 'E_VALIDATION', 'bonus value >= 0';
  assert not exists (select 1 from public.courses where code ~ '^(W[0-9]+|NONAME)$'), 'rejected courses were not created';

  -- AC-0.14: exam-only course: weights forced, rule defaults to open, all_units rejected
  r := pg_temp.save('{"code":"EXAM","name":"Exam only","lesson_mode":"none","weight_lessons":70,"weight_exam":30,"day_count":5}');
  assert (r->'course'->>'weight_lessons')::numeric = 0 and (r->'course'->>'weight_exam')::numeric = 100
     and (r->'course'->>'day_count')::int = 0 and r->'course'->>'eligibility_rule' = 'open', 'exam-only forced values';
  assert pg_temp.save_err('{"code":"EX2","name":"x","lesson_mode":"none","eligibility_rule":"all_units"}') = 'E_VALIDATION', 'none + all_units rejected';
  assert (pg_temp.save('{"code":"EX3","name":"x","lesson_mode":"none","eligibility_rule":"teacher_approved"}')->'course'->>'eligibility_rule') = 'teacher_approved', 'none + teacher_approved allowed';

  -- AC-0.17: copy from an existing course takes its settings but nothing else
  r := pg_temp.save('{"code":"WEEKS2","name":"Copy of weeks"}', false, v_week);
  v_copy := (r->'course'->>'id')::uuid;
  assert r->'course'->>'unit_label' = 'Week' and (r->'course'->>'day_count')::int = 8
     and (r->'course'->>'day_max')::int = 5 and r->'course'->>'unit_label_ar' = 'أسبوع', 'copy takes source settings';
  assert r->'course'->>'name' = 'Copy of weeks' and r->'course'->>'code' = 'WEEKS2', 'copy uses the new code and name';
  assert pg_temp.save_err('{"code":"WEEKS","name":"x"}', false, v_week) = 'E_VALIDATION', 'copy with a used code rejected';
  assert pg_temp.save_err('{"code":"WEEKS3","name":"x"}', false, gen_random_uuid()) = 'E_NOT_FOUND', 'copy from unknown course';
  assert pg_temp.save_err('{"name":"x"}', false, v_week) = 'E_VALIDATION', 'copy still needs a new code';
  -- the copy_exam flag is accepted (no-op until Phase 1)
  perform public.admin_save_course(pg_temp.t(), '{"code":"WEEKS4","name":"x"}'::jsonb, false, v_week, true);

  select id into v_ad from public.courses where code = 'ADAB';
  r := pg_temp.save('{"code":"ADAB2","name":"ADAB copy"}', false, v_ad);
  assert (select count(*) from public.enrollments where course_id = (r->'course'->>'id')::uuid) = 0, 'copy of ADAB brings no students';
  assert (r->'course'->>'name_ar') is not distinct from (select name_ar from public.courses where id = v_ad), 'copy keeps ADAB Arabic name unless overridden';

  -- archive / unarchive
  perform public.admin_set_course_status(pg_temp.t(), v_copy, 'archived');
  assert (select status from public.courses where id = v_copy) = 'archived', 'archived';
  perform public.admin_set_course_status(pg_temp.t(), v_copy, 'active');
  assert (select status from public.courses where id = v_copy) = 'active', 'unarchived';
  assert pg_temp.err(format('select public.admin_set_course_status(%L, %L, %L)', pg_temp.t(), v_copy, 'deleted')) = 'E_VALIDATION', 'bad status';
  assert pg_temp.err(format('select public.admin_set_course_status(%L, %L, %L)', pg_temp.t(), gen_random_uuid(), 'active')) = 'E_NOT_FOUND', 'status of unknown course';
end $$;

\echo '== T0.9 roster: add / enroll / bulk seed / rename / active / list =='
do $$
declare
  v_week uuid := pg_temp.cid('WEEKS'); v_blank uuid := pg_temp.cid('BLANK'); v_ex uuid := pg_temp.cid('EXAM');
  r jsonb; r2 jsonb; v_maxid bigint; v_sid text; v_enr uuid;
begin
  select max(substring(id from '^s([0-9]+)$')::bigint) into v_maxid from public.students;

  r  := public.admin_add_student(pg_temp.t(), v_week, '  Aisha Bello  ', 'عائشة بللو');
  r2 := public.admin_add_student(pg_temp.t(), v_week, 'Umar Sani');
  assert (r->>'sn')::int = 1 and (r2->>'sn')::int = 2, 'S/N assigned sequentially per course (AC-0.7, sequential)';
  assert r->>'student_id' = 's' || (v_maxid + 1) and r2->>'student_id' = 's' || (v_maxid + 2), 'student ids continue after the max existing id';
  assert (r->>'duplicate_name')::boolean = false, 'no duplicate flagged';
  assert (select name from public.students where id = r->>'student_id') = 'Aisha Bello', 'name trimmed';
  assert (select name_ar from public.students where id = r->>'student_id') = 'عائشة بللو', 'Arabic name stored';
  v_enr := (r->>'enrollment_id')::uuid;
  assert (select days from public.enrollments where id = v_enr) = array_fill(-1, array[8]), 'WEEKS arrays have 8 unset units';
  assert (select bonus_units from public.enrollments where id = v_enr) = array_fill(0, array[8]), 'bonus zeros';
  assert (select status from public.enrollment_results where enrollment_id = v_enr) = 'not_eligible', 'new student not eligible (all_units)';
  assert (select sn is not null and days is not null and bonus_units is not null from public.students where id = r->>'student_id'), 'legacy columns populated';

  -- FR-R7: duplicate name warns, does not block (case-insensitive)
  r := public.admin_add_student(pg_temp.t(), v_week, 'aisha BELLO');
  assert (r->>'duplicate_name')::boolean = true and (r->>'sn')::int = 3, 'duplicate warned, not blocked';

  assert pg_temp.err(format('select public.admin_add_student(%L, %L, %L)', pg_temp.t(), v_week, '   ')) = 'E_VALIDATION', 'blank name';
  assert pg_temp.err(format('select public.admin_add_student(%L, %L, %L)', pg_temp.t(), v_week, repeat('x', 201))) = 'E_VALIDATION', 'name too long';
  assert pg_temp.err(format('select public.admin_add_student(%L, %L, %L)', pg_temp.t(), gen_random_uuid(), 'x')) = 'E_NOT_FOUND', 'unknown course';

  -- exam-only course: empty arrays, no lesson part, 'open' rule -> eligible (AC-0.14/0.16)
  r := public.admin_add_student(pg_temp.t(), v_ex, 'Exam Person');
  v_enr := (r->>'enrollment_id')::uuid;
  assert (select days from public.enrollments where id = v_enr) = '{}'::int[], 'exam-only arrays empty';
  assert (select status from public.enrollment_results where enrollment_id = v_enr) = 'eligible', 'open rule -> eligible';
  assert (select lesson_pct from public.enrollment_results where enrollment_id = v_enr) is null, 'no lesson part';

  -- FR-R2: enroll an existing student in another course -> its own S/N there
  v_sid := (select student_id from public.enrollments where course_id = v_week and sn = 1);
  r := public.admin_enroll_student(pg_temp.t(), v_blank, v_sid);
  assert (r->>'sn')::int = 1 and (select cardinality(days) from public.enrollments where id = (r->>'enrollment_id')::uuid) = 10, 'enrolled in BLANK with its own S/N and 10 units';
  assert pg_temp.err(format('select public.admin_enroll_student(%L, %L, %L)', pg_temp.t(), v_blank, v_sid)) = 'E_VALIDATION', 'double enrollment rejected';
  assert pg_temp.err(format('select public.admin_enroll_student(%L, %L, %L)', pg_temp.t(), v_blank, 'nope')) = 'E_NOT_FOUND', 'unknown student';

  -- FR-R3: bulk seed. BLANK already holds "Aisha Bello". Input has CRLF, blank line, padding, a
  -- repeated name, a name that already exists (different case), an Arabic-only line, an over-long line.
  r := public.admin_bulk_seed(pg_temp.t(), v_blank,
       E'Ahmad Bello | أحمد بللو\r\n\r\n  fatima yusuf  \nAISHA bello\nAhmad bello\n| بلا اسم\nZainab Musa |\n' || repeat('y', 201));
  assert (r->>'added')::int = 3, format('added Ahmad, Fatima, Zainab; got %s', r);
  assert jsonb_array_length(r->'skipped') = 2 and r->'skipped' @> '["AISHA bello"]'::jsonb and r->'skipped' @> '["Ahmad bello"]'::jsonb, format('skipped existing + repeated; got %s', r->'skipped');
  assert jsonb_array_length(r->'invalid') = 2, 'two invalid lines';
  assert (select count(*) from public.enrollments where course_id = v_blank) = 4, 'BLANK now has 4 enrollments';
  assert (select s.name_ar from public.enrollments e join public.students s on s.id = e.student_id where e.course_id = v_blank and s.name = 'Ahmad Bello') = 'أحمد بللو', 'seeded Arabic name';
  assert (select s.name_ar from public.enrollments e join public.students s on s.id = e.student_id where e.course_id = v_blank and s.name = 'Zainab Musa') is null, 'empty Arabic part -> null';
  assert (select array_agg(sn order by sn) from public.enrollments where course_id = v_blank) = array[1,2,3,4], 'S/N contiguous after bulk seed';
  r := public.admin_bulk_seed(pg_temp.t(), v_blank, 'Ahmad Bello');
  assert (r->>'added')::int = 0 and jsonb_array_length(r->'skipped') = 1, 're-seeding the same name adds nothing';
  insert into private.system_params(key, value) values ('bulk_seed_max_lines', 3);
  assert pg_temp.err(format('select public.admin_bulk_seed(%L, %L, %L)', pg_temp.t(), v_blank, E'a\nb\nc\nd')) = 'E_VALIDATION', 'line limit enforced';
  delete from private.system_params where key = 'bulk_seed_max_lines';

  -- rename / Arabic name (FR-R4/R5)
  perform public.admin_update_student(pg_temp.t(), v_sid, ' Aisha B. ', 'عائشة');
  assert (select name from public.students where id = v_sid) = 'Aisha B.' and (select name_ar from public.students where id = v_sid) = 'عائشة', 'renamed';
  perform public.admin_update_student(pg_temp.t(), v_sid, 'Aisha B.', '   ');
  assert (select name_ar from public.students where id = v_sid) is null, 'blank Arabic name clears it';
  assert pg_temp.err(format('select public.admin_update_student(%L, %L, %L)', pg_temp.t(), v_sid, '')) = 'E_VALIDATION', 'blank rename rejected';
  assert pg_temp.err(format('select public.admin_update_student(%L, %L, %L)', pg_temp.t(), 'nope', 'x')) = 'E_NOT_FOUND', 'rename unknown student';

  -- active toggle keeps the row and its result; roster list includes inactive rows, ordered by S/N
  v_enr := (select id from public.enrollments where course_id = v_week and sn = 2);
  perform public.admin_set_active(pg_temp.t(), v_enr, false);
  assert (select active from public.enrollments where id = v_enr) = false and exists (select 1 from public.enrollment_results where enrollment_id = v_enr), 'deactivated, result kept';
  r := public.admin_list_roster(pg_temp.t(), v_week);
  assert jsonb_array_length(r) = 3 and (r->0->>'sn')::int = 1 and (r->2->>'sn')::int = 3, 'roster ordered by S/N';
  assert (select count(*) from jsonb_array_elements(r) x where (x->>'active')::boolean = false) = 1, 'roster includes the inactive row';
  assert r->0 ? 'name_ar' and r->0 ? 'days' and r->0 ? 'status' and r->0 ? 'lesson_pct' and r->0 ? 'exam_approved', 'roster row shape';
  perform public.admin_set_active(pg_temp.t(), v_enr, true);
  assert pg_temp.err(format('select public.admin_set_active(%L, %L, null)', pg_temp.t(), v_enr)) = 'E_VALIDATION', 'active must be boolean';
  assert pg_temp.err(format('select public.admin_set_active(%L, %L, true)', pg_temp.t(), gen_random_uuid())) = 'E_NOT_FOUND', 'unknown enrollment';
  assert pg_temp.err(format('select public.admin_list_roster(%L, %L)', pg_temp.t(), gen_random_uuid())) = 'E_NOT_FOUND', 'roster of unknown course';
  assert jsonb_array_length(public.admin_list_roster(pg_temp.t(), pg_temp.cid('WEEKS2'))) = 0, 'empty roster is []';

  r := public.admin_list_students_all(pg_temp.t());
  assert jsonb_array_length(r) = (select count(*) from public.students), 'all students listed';
  assert r->0 ? 'id' and r->0 ? 'name' and r->0 ? 'name_ar', 'student picker shape';

  -- archived courses accept no new enrollments (D-35)
  perform public.admin_set_course_status(pg_temp.t(), v_ex, 'archived');
  assert pg_temp.err(format('select public.admin_add_student(%L, %L, %L)', pg_temp.t(), v_ex, 'Late')) = 'E_VALIDATION', 'add to archived rejected';
  assert pg_temp.err(format('select public.admin_enroll_student(%L, %L, %L)', pg_temp.t(), v_ex, v_sid)) = 'E_VALIDATION', 'enroll in archived rejected';
  assert pg_temp.err(format('select public.admin_bulk_seed(%L, %L, %L)', pg_temp.t(), v_ex, 'Late')) = 'E_VALIDATION', 'seed archived rejected';
  perform public.admin_set_course_status(pg_temp.t(), v_ex, 'active');
end $$;

\echo '== T0.10 lesson scores (AC-0.8) and eligibility rules (AC-0.16) =='
do $$
declare
  v_score uuid; v_enr uuid; v_enr2 uuid; r jsonb; i int; v_ex uuid := pg_temp.cid('EXAM');
begin
  v_score := (pg_temp.save('{"code":"SCORE","name":"Scoring course"}')->'course'->>'id')::uuid;
  v_enr  := (public.admin_add_student(pg_temp.t(), v_score, 'Score Student')->>'enrollment_id')::uuid;
  v_enr2 := (public.admin_add_student(pg_temp.t(), v_score, 'Other Student')->>'enrollment_id')::uuid;

  -- save a day: arrays updated at the right (zero-based) position, neighbours untouched
  r := public.admin_save_day(pg_temp.t(), v_enr, 0, 7, 1);
  assert (select days[1] from public.enrollments where id = v_enr) = 7 and (select days[2] from public.enrollments where id = v_enr) = -1, 'day 0 saved';
  assert (select bonus_units[1] from public.enrollments where id = v_enr) = 1, 'bonus saved';
  assert (r->>'lesson_pct')::numeric = 9 and r->>'status' = 'not_eligible', 'returns recomputed lesson (7 + 1*2 = 9)';
  perform public.admin_save_day(pg_temp.t(), v_enr, 9, 10, null);
  assert (select days from public.enrollments where id = v_enr) = '{7,-1,-1,-1,-1,-1,-1,-1,-1,10}' and
         (select bonus_units from public.enrollments where id = v_enr) = '{1,0,0,0,0,0,0,0,0,0}', 'last day saved; null bonus = 0';
  perform public.admin_save_day(pg_temp.t(), v_enr, 4, 3, 0);
  assert (select days from public.enrollments where id = v_enr) = '{7,-1,-1,-1,3,-1,-1,-1,-1,10}', 'middle day saved';
  perform public.admin_save_day(pg_temp.t(), v_enr, 0, null, 0);
  assert (select days[1] from public.enrollments where id = v_enr) = -1 and (select bonus_units[1] from public.enrollments where id = v_enr) = 0, 'null score unsets the day';
  assert (select days from public.enrollments where id = v_enr2) = array_fill(-1, array[10]), 'other enrollment untouched';

  -- AC-0.8: out-of-range inputs rejected, and nothing changes
  assert pg_temp.err(format('select public.admin_save_day(%L, %L, 1, 11, 0)', pg_temp.t(), v_enr)) = 'E_VALIDATION', 'score above day_max';
  assert pg_temp.err(format('select public.admin_save_day(%L, %L, 1, -1, 0)', pg_temp.t(), v_enr)) = 'E_VALIDATION', 'negative score';
  assert pg_temp.err(format('select public.admin_save_day(%L, %L, 1, 5, -1)', pg_temp.t(), v_enr)) = 'E_VALIDATION', 'negative bonus';
  assert pg_temp.err(format('select public.admin_save_day(%L, %L, -1, 5, 0)', pg_temp.t(), v_enr)) = 'E_VALIDATION', 'day index below range';
  assert pg_temp.err(format('select public.admin_save_day(%L, %L, 10, 5, 0)', pg_temp.t(), v_enr)) = 'E_VALIDATION', 'day index above range';
  assert pg_temp.err(format('select public.admin_save_day(%L, %L, null, 5, 0)', pg_temp.t(), v_enr)) = 'E_VALIDATION', 'null day index';
  assert pg_temp.err(format('select public.admin_save_day(%L, %L, 1, 5, 0)', pg_temp.t(), gen_random_uuid())) = 'E_NOT_FOUND', 'unknown enrollment';
  assert (select days from public.enrollments where id = v_enr) = '{-1,-1,-1,-1,3,-1,-1,-1,-1,10}', 'rejected saves changed nothing';

  -- A-62: lesson capped at 100 (days 95 + 3 bonus units x 2 = 101) and eligibility flips (all_units)
  for i in 0..8 loop perform public.admin_save_day(pg_temp.t(), v_enr2, i, 10, case when i = 0 then 3 else 0 end); end loop;
  assert (select status from public.enrollment_results where enrollment_id = v_enr2) = 'not_eligible', '9 of 10 marked: not eligible';
  r := public.admin_save_day(pg_temp.t(), v_enr2, 9, 5, 0);
  assert (r->>'lesson_pct')::numeric = 100 and r->>'status' = 'eligible', 'A-62: capped at 100, all units marked -> eligible';
  r := public.admin_save_day(pg_temp.t(), v_enr2, 3, null, 0);
  assert r->>'status' = 'not_eligible' and (r->>'lesson_pct')::numeric = 91, 'unsetting a unit makes it not_eligible (85 + 6 = 91)';
  -- A-63: 90 + 5 bonus units x 2 = 100
  perform public.admin_save_day(pg_temp.t(), v_enr2, 3, 10, 0);
  perform public.admin_save_day(pg_temp.t(), v_enr2, 9, 0, 5);
  assert (select lesson_pct from public.enrollment_results where enrollment_id = v_enr2) = 100, 'A-63: 90 + 10 = 100';

  -- FR-S5: exam-only course has no lesson scores
  assert pg_temp.err(format('select public.admin_save_day(%L, %L, 0, 1, 0)', pg_temp.t(),
         (select id from public.enrollments where course_id = v_ex limit 1))) = 'E_VALIDATION', 'exam-only: save_day rejected';

  -- eligibility rules: teacher_approved
  declare v_appr uuid; v_e uuid; begin
    v_appr := (pg_temp.save('{"code":"APPR","name":"Approval course","eligibility_rule":"teacher_approved"}')->'course'->>'id')::uuid;
    v_e := (public.admin_add_student(pg_temp.t(), v_appr, 'Approve Me')->>'enrollment_id')::uuid;
    assert (select status from public.enrollment_results where enrollment_id = v_e) = 'not_eligible', 'unapproved -> not_eligible';
    perform public.admin_set_exam_approval(pg_temp.t(), v_e, true);
    assert (select status from public.enrollment_results where enrollment_id = v_e) = 'eligible'
       and (select exam_approved_at from public.enrollments where id = v_e) is not null, 'approved -> eligible (units irrelevant, A-66)';
    perform public.admin_set_exam_approval(pg_temp.t(), v_e, false);
    assert (select status from public.enrollment_results where enrollment_id = v_e) = 'not_eligible'
       and (select exam_approved_at from public.enrollments where id = v_e) is null, 'withdrawn -> not_eligible';
    assert pg_temp.err(format('select public.admin_set_exam_approval(%L, %L, null)', pg_temp.t(), v_e)) = 'E_VALIDATION', 'approval must be boolean';
    assert pg_temp.err(format('select public.admin_set_exam_approval(%L, %L, true)', pg_temp.t(), v_enr)) = 'E_VALIDATION', 'approval on an all_units course rejected';
    assert pg_temp.err(format('select public.admin_set_exam_approval(%L, %L, true)', pg_temp.t(), gen_random_uuid())) = 'E_NOT_FOUND', 'approval of unknown enrollment';
  end;

  -- eligibility rule: open (lessons irrelevant)
  declare v_o uuid; v_oe uuid; begin
    v_o := (pg_temp.save('{"code":"OPENR","name":"Open course","eligibility_rule":"open"}')->'course'->>'id')::uuid;
    v_oe := (public.admin_add_student(pg_temp.t(), v_o, 'Open Student')->>'enrollment_id')::uuid;
    assert (select status from public.enrollment_results where enrollment_id = v_oe) = 'eligible', 'open rule: eligible with no scores';
  end;
end $$;

\echo '== T0.11 course changes: confirmation, recompute, resize, locks (AC-0.9, 0.15) =='
do $$
declare
  v_upd uuid; v_e1 uuid; v_e2 uuid; r jsonb; v_c uuid; v_e uuid;
begin
  v_upd := (pg_temp.save('{"code":"UPD","name":"Updatable"}')->'course'->>'id')::uuid;
  v_e1 := (public.admin_add_student(pg_temp.t(), v_upd, 'U One')->>'enrollment_id')::uuid;
  v_e2 := (public.admin_add_student(pg_temp.t(), v_upd, 'U Two')->>'enrollment_id')::uuid;
  perform public.admin_save_day(pg_temp.t(), v_e1, 0, 9, 1);       -- lesson = 9 + 2 = 11

  -- AC-0.9: scoring changes need confirmation, report the affected count, and change nothing until confirmed
  assert pg_temp.save_err(format('{"id":"%s","day_max":20}', v_upd)) = 'E_CONFIRM_REQUIRED', 'day_max change needs confirm';
  assert pg_temp.save_det(format('{"id":"%s","day_max":20}', v_upd)) = '2', 'detail = affected enrollments';
  assert (select day_max from public.courses where id = v_upd) = 10, 'unconfirmed change was not applied';
  assert pg_temp.save_err(format('{"id":"%s","pass_mark":70}', v_upd)) = 'E_CONFIRM_REQUIRED', 'pass mark change needs confirm';
  assert pg_temp.save_err(format('{"id":"%s","weight_lessons":60,"weight_exam":40}', v_upd)) = 'E_CONFIRM_REQUIRED', 'weights change needs confirm';
  assert pg_temp.save_err(format('{"id":"%s","bonus_unit_value":3}', v_upd)) = 'E_CONFIRM_REQUIRED', 'bonus value change needs confirm';
  assert pg_temp.save_err(format('{"id":"%s","lesson_max":50}', v_upd)) = 'E_CONFIRM_REQUIRED', 'lesson_max change needs confirm';
  assert pg_temp.save_err(format('{"id":"%s","day_count":12}', v_upd)) = 'E_CONFIRM_REQUIRED', 'day_count change needs confirm';
  assert pg_temp.save_err(format('{"id":"%s","eligibility_rule":"open"}', v_upd)) = 'E_CONFIRM_REQUIRED', 'rule change needs confirm';
  assert pg_temp.save_err(format('{"id":"%s","day_max":20}', v_upd), true) = 'OK', 'confirmed change applies';
  assert (select day_max from public.courses where id = v_upd) = 20, 'day_max now 20';
  -- AC-0.15: display-only / non-scoring fields never need confirmation
  assert pg_temp.save_err(format('{"id":"%s","unit_label":"Lesson","unit_label_ar":"درس","name":"Updated","reveal_answers":false}', v_upd)) = 'OK', 'unit label, name, reveal: no confirm';
  assert (select unit_label from public.courses where id = v_upd) = 'Lesson' and (select reveal_answers from public.courses where id = v_upd) = false, 'display fields saved';
  assert pg_temp.save_err(format('{"id":"%s","name_ar":"دورة"}', v_upd)) = 'OK', 'set Arabic name';
  assert (select name_ar from public.courses where id = v_upd) = 'دورة', 'Arabic name saved';
  assert pg_temp.save_err(format('{"id":"%s","name_ar":""}', v_upd)) = 'OK', 'clear Arabic name';
  assert (select name_ar from public.courses where id = v_upd) is null, 'Arabic name cleared';
  assert pg_temp.save_err(format('{"id":"%s","grade_bands":[{"label":"Top","min":95}]}', v_upd)) = 'OK', 'bands saved without confirm';
  assert (select jsonb_array_length(grade_bands) from public.courses where id = v_upd) = 1, 'bands replaced';

  -- recompute on course change: lesson_max 100 -> 50 doubles the percentage (11/50 = 22%)
  assert (select lesson_pct from public.enrollment_results where enrollment_id = v_e1) = 11, 'lesson_pct before = 11';
  perform pg_temp.save(format('{"id":"%s","lesson_max":50}', v_upd), true);
  assert (select lesson_pct from public.enrollment_results where enrollment_id = v_e1) = 22, 'results recomputed for all enrollments of the course';
  perform pg_temp.save(format('{"id":"%s","lesson_max":100}', v_upd), true);

  -- FR-C3: resize arrays (grow keeps values, shrink drops the tail)
  r := pg_temp.save(format('{"id":"%s","day_count":12}', v_upd), true);
  assert (r->>'affected')::int = 2, 'affected count returned';
  assert (select days from public.enrollments where id = v_e1) = '{9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1}'
     and (select bonus_units from public.enrollments where id = v_e1) = '{1,0,0,0,0,0,0,0,0,0,0,0}', 'grown to 12, values kept';
  assert (select status from public.enrollment_results where enrollment_id = v_e1) = 'not_eligible', 'new unset units -> not_eligible';
  perform pg_temp.save(format('{"id":"%s","day_count":8}', v_upd), true);
  assert (select days from public.enrollments where id = v_e1) = '{9,-1,-1,-1,-1,-1,-1,-1}' and
         (select cardinality(bonus_units) from public.enrollments where id = v_e1) = 8, 'shrunk to 8, head kept';
  perform public.admin_save_day(pg_temp.t(), v_e2, 7, 4, 0);
  assert pg_temp.err(format('select public.admin_save_day(%L, %L, 8, 4, 0)', pg_temp.t(), v_e2)) = 'E_VALIDATION', 'index 8 invalid after shrink';

  -- rule change recomputes eligibility (U One has unset units; 'open' makes everyone eligible)
  perform pg_temp.save(format('{"id":"%s","eligibility_rule":"open"}', v_upd), true);
  assert (select count(*) from public.enrollment_results where course_id = v_upd and status = 'eligible') = 2, 'open rule -> both eligible';

  -- FR-C8: lesson mode locks once a score exists...
  assert pg_temp.save_err(format('{"id":"%s","lesson_mode":"none"}', v_upd), true) = 'E_VALIDATION', 'lesson mode locked after scoring (AC-0.15)';
  -- ...and also when only bonus units exist
  v_c := (pg_temp.save('{"code":"LOCKB","name":"Bonus lock"}')->'course'->>'id')::uuid;
  v_e := (public.admin_add_student(pg_temp.t(), v_c, 'B')->>'enrollment_id')::uuid;
  perform public.admin_save_day(pg_temp.t(), v_e, 0, null, 2);
  assert pg_temp.save_err(format('{"id":"%s","lesson_mode":"none"}', v_c), true) = 'E_VALIDATION', 'bonus-only also locks the mode';

  -- ...but with no scores recorded the mode can change, both ways, resizing arrays
  v_c := (pg_temp.save('{"code":"FLIP","name":"Flip mode"}')->'course'->>'id')::uuid;
  v_e := (public.admin_add_student(pg_temp.t(), v_c, 'F')->>'enrollment_id')::uuid;
  assert pg_temp.save_err(format('{"id":"%s","lesson_mode":"none"}', v_c)) = 'E_CONFIRM_REQUIRED', 'mode change needs confirm';
  r := pg_temp.save(format('{"id":"%s","lesson_mode":"none"}', v_c), true)->'course';
  assert (r->>'day_count')::int = 0 and (r->>'weight_lessons')::numeric = 0 and (r->>'weight_exam')::numeric = 100
     and r->>'eligibility_rule' = 'open', 'scored -> none: forced values';
  assert (select days from public.enrollments where id = v_e) = '{}'::int[] and (select status from public.enrollment_results where enrollment_id = v_e) = 'eligible'
     and (select lesson_pct from public.enrollment_results where enrollment_id = v_e) is null, 'arrays emptied, lesson part gone';
  r := pg_temp.save(format('{"id":"%s","lesson_mode":"scored","day_count":4,"weight_lessons":50,"weight_exam":50,"eligibility_rule":"all_units"}', v_c), true)->'course';
  assert (select days from public.enrollments where id = v_e) = '{-1,-1,-1,-1}' and (select status from public.enrollment_results where enrollment_id = v_e) = 'not_eligible', 'none -> scored: 4 unset units';

  -- ...and the lock also honours attempts once Phase 2 creates private.attempts (simulated here)
  v_c := (pg_temp.save('{"code":"ATT","name":"Attempt lock"}')->'course'->>'id')::uuid;
  v_e := (public.admin_add_student(pg_temp.t(), v_c, 'A')->>'enrollment_id')::uuid;
  create table private.attempts (enrollment_id uuid not null);
  insert into private.attempts values (v_e);
  assert pg_temp.save_err(format('{"id":"%s","lesson_mode":"none"}', v_c), true) = 'E_VALIDATION', 'an existing attempt locks the mode';
  drop table private.attempts;
  assert pg_temp.save_err(format('{"id":"%s","lesson_mode":"none"}', v_c), true) = 'OK', 'without attempts or scores the mode can change';

  -- code uniqueness on update, id handling
  assert pg_temp.save_err(format('{"id":"%s","code":"ADAB"}', v_upd), true) = 'E_VALIDATION', 'code collision on update';
  assert pg_temp.save_err(format('{"id":"%s","code":"UPD","name":"same code is fine"}', v_upd)) = 'OK', 'keeping own code is fine';
  assert pg_temp.save_err(format('{"id":"%s","name":"x"}', gen_random_uuid())) = 'E_NOT_FOUND', 'unknown course id';
  assert pg_temp.save_err('{"id":"garbage","name":"x"}') = 'E_VALIDATION', 'malformed course id';
end $$;

\echo '== T0.12 delete student (FR-R6) =='
do $$
declare v_c uuid := pg_temp.cid('UPD'); r jsonb; v_sid text; v_enr uuid;
begin
  r := public.admin_add_student(pg_temp.t(), v_c, 'To Delete');
  v_sid := r->>'student_id'; v_enr := (r->>'enrollment_id')::uuid;
  perform public.admin_delete_student(pg_temp.t(), v_sid);
  assert not exists (select 1 from public.students where id = v_sid)
     and not exists (select 1 from public.enrollments where id = v_enr)
     and not exists (select 1 from public.enrollment_results where enrollment_id = v_enr), 'student, enrollments and results removed';
  assert pg_temp.err(format('select public.admin_delete_student(%L, %L)', pg_temp.t(), v_sid)) = 'E_NOT_FOUND', 'second delete -> E_NOT_FOUND';

  -- a certificate row (Phase 4: FK ... on delete restrict) blocks deletion
  create table private.certificates (id serial primary key, enrollment_id uuid not null references public.enrollments(id) on delete restrict);
  r := public.admin_add_student(pg_temp.t(), v_c, 'Certified');
  v_sid := r->>'student_id'; v_enr := (r->>'enrollment_id')::uuid;
  insert into private.certificates(enrollment_id) values (v_enr);
  assert pg_temp.err(format('select public.admin_delete_student(%L, %L)', pg_temp.t(), v_sid)) = 'E_HAS_CERTIFICATE', 'certified student cannot be deleted';
  assert exists (select 1 from public.students where id = v_sid) and exists (select 1 from public.enrollments where id = v_enr), 'student and enrollment still there';
  drop table private.certificates;
end $$;

\echo '== T0.13 exact numbers for the local sample data (skipped on real data) =='
do $$
declare v_ad uuid := pg_temp.cid('ADAB'); r jsonb;
begin
  if not exists (select 1 from public.students where id = 's1' and name = 'Ahmad Bello')
     or not exists (select 1 from public.students where id = 's4' and name = 'Inactive Person') then
    raise notice 'sample students not found: T0.13 skipped'; return;
  end if;
  assert (select lesson_pct from public.enrollment_results where enrollment_id = (select id from public.enrollments where student_id='s1' and course_id=v_ad)) = 55, 's1 = 55';
  assert (select lesson_pct from public.enrollment_results where enrollment_id = (select id from public.enrollments where student_id='s2' and course_id=v_ad)) = 100, 's2 = 100 (capped, 106 raw)';
  assert (select lesson_pct from public.enrollment_results where enrollment_id = (select id from public.enrollments where student_id='s3' and course_id=v_ad)) = 5, 's3 = 5';
  assert (select status from public.enrollment_results where enrollment_id = (select id from public.enrollments where student_id='s3' and course_id=v_ad)) = 'not_eligible', 's3 has unset units';
  assert (select status from public.enrollment_results where enrollment_id = (select id from public.enrollments where student_id='s1' and course_id=v_ad)) = 'eligible', 's1 fully marked';
  r := public.admin_list_roster(pg_temp.t(), v_ad);
  assert (select count(*) from jsonb_array_elements(r)) >= 4 and (select bool_or(not (x->>'active')::boolean) from jsonb_array_elements(r) x), 'ADAB roster lists the inactive student';
end $$;

\echo '== T0.14 anon access to the new surface =='
set role anon;
do $$
declare ok_denied boolean; v_code text;
begin
  -- the 12 RPCs are callable by anon but self-protect with the token
  begin perform public.admin_list_students_all('not-a-token');
  exception when others then get stacked diagnostics v_code = message_text; end;
  assert v_code = 'E_AUTH', 'anon can call admin RPCs but gets E_AUTH without a valid token';

  -- helpers and trigger functions live in private: unreachable
  ok_denied := false; begin perform private.recompute_result(gen_random_uuid()); exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot call private.recompute_result';
  ok_denied := false; begin perform private.next_sn(gen_random_uuid()); exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot call private.next_sn';
  ok_denied := false; begin perform private.add_student_enrollment(null, 'x', null); exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot call private.add_student_enrollment';

  -- still no direct writes
  ok_denied := false; begin insert into public.enrollments(student_id, course_id, sn, days, bonus_units) values ('s1', gen_random_uuid(), 1, '{}', '{}'); exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot insert enrollments';
  ok_denied := false; begin update public.courses set name = 'hacked'; exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot update courses';
end $$;
reset role;

rollback;
\echo '== ALL PHASE 0 ROSTER TESTS PASSED (transaction rolled back) =='
