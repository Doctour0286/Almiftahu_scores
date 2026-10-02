-- Phase 0 lockdown tests (task 0.7): migration 005. RUN ONLY AFTER 005 HAS BEEN APPLIED.
-- No psql meta-commands. One transaction, ROLLED BACK: leaves no data behind, on local or staging.
-- It temporarily replaces the teacher PIN hash and clears the login throttle (the rollback restores both).
--
-- Two halves:
--   A. what the public key (role anon) can NOT do, and the exact surface it can.
--   B. that the whole teacher workflow still works when called AS anon: RLS on, grants revoked,
--      and every RPC must still read/write through its security-definer owner rights.
--
-- LIMIT: a local Postgres runs migrations as a superuser; Supabase's `postgres` is not one. Both bypass
-- RLS as table owner as long as RLS is not FORCEd, which T0.18 asserts. A staging run of this file
-- (and tests/tools/anon_probe.mjs) is the confirmation on the real platform.
begin;

do $$ begin raise notice '== T0.18 catalog state after 005 =='; end $$;
do $$
declare t text;
begin
  assert not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname in ('public','private') and c.relkind in ('r','p') and c.relforcerowsecurity),
         'RLS must not be FORCEd (owner rights are what the RPCs rely on)';
  assert not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname in ('public','private') and c.relkind in ('r','p') and not c.relrowsecurity),
         'RLS on for every public and private table';
  foreach t in array array['courses','students','enrollments','enrollment_results'] loop
    assert has_table_privilege('anon', 'public.' || t, 'SELECT'), 'anon can select ' || t;
    assert not has_table_privilege('anon', 'public.' || t, 'INSERT,UPDATE,DELETE,TRUNCATE'), 'anon cannot write ' || t;
    assert not has_table_privilege('authenticated', 'public.' || t, 'SELECT'), 'authenticated has nothing on ' || t;
  end loop;
  assert not has_table_privilege('anon', 'public.app_settings', 'SELECT'), 'anon cannot select app_settings';
  assert not exists (select 1 from public.app_settings where key = 'teacher_pin'), 'AC-0.3: plaintext PIN row deleted';
  assert exists (select 1 from private.secrets where key = 'teacher_pin_hash'), 'the hash is kept';
  assert (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
          where p.prokind = 'f' and has_function_privilege('anon', p.oid, 'EXECUTE')) = 16, 'anon executes exactly 16 public functions';
  assert not has_schema_privilege('anon', 'private', 'USAGE'), 'no anon usage on private';
end $$;

-- fixtures + a known teacher PIN (as owner)
do $$
begin
  update private.secrets set value = extensions.crypt('lockdown-pin', extensions.gen_salt('bf', 4)) where key = 'teacher_pin_hash';
  delete from private.auth_throttle;
  insert into public.courses(code, name) values ('LKA', 'Lockdown A');
  insert into public.students(id, sn, name, days, bonus_units, active) values
    ('lk1', 9101, 'Lock Visible',  array_fill(-1, array[10]), array_fill(0, array[10]), true),
    ('lk2', 9102, 'Lock Inactive', array_fill(-1, array[10]), array_fill(0, array[10]), true);
  insert into public.enrollments(student_id, course_id, sn, days, bonus_units, active)
  select v.sid, c.id, v.sn, array_fill(-1, array[10]), array_fill(0, array[10]), v.act
  from (values ('lk1', 1, true), ('lk2', 2, false)) v(sid, sn, act), public.courses c where c.code = 'LKA';
end $$;

do $$ begin raise notice '== T0.19 anon reads: public tables only, active rows only =='; end $$;
set role anon;
do $$
declare ok boolean;
begin
  assert exists (select 1 from public.courses where code = 'LKA'), 'courses readable';
  assert exists (select 1 from public.students where id = 'lk1'), 'active student readable';
  assert not exists (select 1 from public.students where id = 'lk2'), 'AC-0.11: inactive-only student hidden';
  assert not exists (select 1 from public.enrollments where active = false), 'no inactive enrollment visible';
  assert not exists (select 1 from public.enrollment_results r join public.enrollments e on e.id = r.enrollment_id where not e.active),
         'results of inactive enrollments are hidden';
  assert exists (select 1 from public.enrollment_results r join public.enrollments e on e.id = r.enrollment_id where e.student_id = 'lk1'),
         'results of active enrollments readable';

  ok := false; begin perform count(*) from public.app_settings; exception when insufficient_privilege then ok := true; end;
  assert ok, 'app_settings is not readable';
end $$;
reset role;

do $$ begin raise notice '== T0.20 anon writes denied on every table (AC-0.2) =='; end $$;
set role anon;
do $$
declare ok boolean; t text; col text;
begin
  foreach t in array array['students','enrollments','courses','enrollment_results','app_settings'] loop
    ok := false; begin execute format('insert into public.%I select * from public.%I limit 0', t, t) ; exception when insufficient_privilege then ok := true; end;
    assert ok, 'anon cannot insert into ' || t;
    select attname into col from pg_attribute where attrelid = ('public.' || t)::regclass and attnum = 1;
    ok := false; begin execute format('update public.%I set %I = %I where false', t, col, col); exception when insufficient_privilege then ok := true; end;
    assert ok, 'anon cannot update ' || t;
    ok := false; begin execute format('delete from public.%I where false', t); exception when insufficient_privilege then ok := true; end;
    assert ok, 'anon cannot delete from ' || t;
    ok := false; begin execute format('truncate public.%I', t); exception when insufficient_privilege then ok := true; end;
    assert ok, 'anon cannot truncate ' || t;
  end loop;
end $$;
reset role;

do $$ begin raise notice '== T0.21 anon cannot reach private (AC-0.1) =='; end $$;
set role anon;
do $$
declare ok boolean; t text;
begin
  foreach t in array array['secrets','teacher_sessions','auth_throttle','system_params','institution_settings'] loop
    ok := false; begin execute format('select 1 from private.%I', t); exception when insufficient_privilege then ok := true; end;
    assert ok, 'anon cannot read private.' || t;
  end loop;
  ok := false; begin perform private.fail('E_X'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon cannot call private.fail';
  ok := false; begin perform private.require_teacher('x'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon cannot call private.require_teacher';
  ok := false; begin perform private.param('x', 1); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon cannot call private.param';
  ok := false; begin perform private.sync_legacy_students(); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon cannot call private.sync_legacy_students';
end $$;
reset role;

do $$ begin raise notice '== T0.22 admin RPCs reject missing / empty / garbage tokens (AC-0.4) =='; end $$;
set role anon;
do $$
declare
  v_tok text; v_code text; n int := 0; v_id uuid := gen_random_uuid();
  v_calls text[]; i int;
begin
  foreach v_tok in array array[null, '', 'garbage-token'] loop
    v_calls := array[
      format('select public.admin_save_course(%L, ''{"code":"ZZ","name":"z"}''::jsonb)', v_tok),
      format('select public.admin_set_course_status(%L, %L, ''archived'')', v_tok, v_id),
      format('select public.admin_list_roster(%L, %L)', v_tok, v_id),
      format('select public.admin_list_students_all(%L)', v_tok),
      format('select public.admin_add_student(%L, %L, ''x'')', v_tok, v_id),
      format('select public.admin_enroll_student(%L, %L, ''s1'')', v_tok, v_id),
      format('select public.admin_bulk_seed(%L, %L, ''x'')', v_tok, v_id),
      format('select public.admin_update_student(%L, ''s1'', ''x'')', v_tok),
      format('select public.admin_set_active(%L, %L, false)', v_tok, v_id),
      format('select public.admin_delete_student(%L, ''s1'')', v_tok),
      format('select public.admin_save_day(%L, %L, 0, 5, 0)', v_tok, v_id),
      format('select public.admin_set_exam_approval(%L, %L, true)', v_tok, v_id)];
    for i in 1 .. array_length(v_calls, 1) loop
      v_code := null;
      begin execute v_calls[i]; v_code := 'OK'; exception when others then get stacked diagnostics v_code = message_text; end;
      assert v_code = 'E_AUTH', format('admin call %s with token %L must be E_AUTH, got %s', i, v_tok, v_code);
      n := n + 1;
    end loop;
  end loop;
  assert n = 36, 'all 12 admin RPCs x 3 bad tokens were exercised';
  assert public.teacher_ping(null) = false and public.teacher_ping('garbage') = false, 'ping with a bad token is false';
  perform public.teacher_logout('garbage');  -- harmless
  assert (public.teacher_login('definitely-wrong')->>'error') = 'E_AUTH', 'wrong PIN is E_AUTH (not an exception)';
end $$;
reset role;

do $$ begin raise notice '== T0.23 the whole teacher workflow works AS ANON under RLS =='; end $$;
delete from private.auth_throttle;   -- the wrong-PIN probe above counted one failure
set role anon;
do $$
declare
  r jsonb; v_tok text; v_course uuid; v_sid text; v_enr uuid; v_n int;
begin
  r := public.teacher_login('lockdown-pin');
  assert (r->>'ok')::boolean, 'login works';
  v_tok := r->>'token';
  assert public.teacher_ping(v_tok) = true, 'ping true for a live session';

  -- course
  r := public.admin_save_course(v_tok, '{"code":"LKB","name":"Lockdown B","unit_label":"Week","day_count":4}'::jsonb);
  v_course := (r->'course'->>'id')::uuid;
  assert v_course is not null, 'course created through the RPC';
  assert exists (select 1 from public.courses where id = v_course), 'anon can read the new course';

  -- roster
  r := public.admin_add_student(v_tok, v_course, 'Zaynab Lock', 'زينب');
  v_sid := r->>'student_id'; v_enr := (r->>'enrollment_id')::uuid;
  assert (r->>'sn')::int = 1, 'S/N assigned in the DB';
  assert exists (select 1 from public.students where id = v_sid), 'new active student visible to anon';

  r := public.admin_bulk_seed(v_tok, v_course, E'Bulk One | واحد\nBulk Two');
  assert (r->>'added')::int = 2, 'bulk seed works';
  assert jsonb_array_length(public.admin_list_roster(v_tok, v_course)) = 3, 'roster lists 3';
  assert jsonb_array_length(public.admin_list_students_all(v_tok)) >= 3, 'student picker works';

  perform public.admin_update_student(v_tok, v_sid, 'Zaynab Locked', 'زينب');
  assert (select name from public.students where id = v_sid) = 'Zaynab Locked', 'rename works';

  -- scores + recompute trigger (writes enrollment_results, which anon cannot write itself)
  perform public.admin_save_day(v_tok, v_enr, 0, 8, 1);
  assert (select lesson_pct from public.enrollment_results where enrollment_id = v_enr) is not null, 'results recomputed under RLS';
  assert (select days[1] from public.enrollments where id = v_enr) = 8, 'score stored';

  -- eligibility rule + approval
  perform public.admin_save_course(v_tok, jsonb_build_object('id', v_course, 'code', 'LKB', 'name', 'Lockdown B',
          'unit_label', 'Week', 'day_count', 4, 'eligibility_rule', 'teacher_approved'), true);   -- AC-0.9: confirm required
  perform public.admin_set_exam_approval(v_tok, v_enr, true);
  assert (select status from public.enrollment_results where enrollment_id = v_enr) = 'eligible', 'approval -> eligible';

  -- inactive student disappears from the public view (AC-0.11), reappears when reactivated
  perform public.admin_set_active(v_tok, v_enr, false);
  assert not exists (select 1 from public.students where id = v_sid), 'inactivated student hidden from anon';
  assert not exists (select 1 from public.enrollments where id = v_enr), 'inactivated enrollment hidden from anon';
  assert exists (select 1 from jsonb_array_elements(public.admin_list_roster(v_tok, v_course)) e where e->>'student_id' = v_sid or e->>'id' = v_enr::text),
         'teacher still sees inactive rows';
  perform public.admin_set_active(v_tok, v_enr, true);
  assert exists (select 1 from public.students where id = v_sid), 'reactivated student visible again';

  -- archive, PIN change, delete
  perform public.admin_set_course_status(v_tok, v_course, 'archived');
  perform public.admin_delete_student(v_tok, v_sid);
  assert not exists (select 1 from public.enrollments where id = v_enr), 'delete cascades';
  assert not exists (select 1 from public.enrollment_results where enrollment_id = v_enr), 'results cascade';

  perform public.teacher_change_pin(v_tok, 'lockdown-pin', 'lockdown-pin-2');
  assert public.teacher_ping(v_tok) = true, 'the session that changed the PIN survives';
  assert (public.teacher_login('lockdown-pin-2')->>'ok')::boolean, 'new PIN works';
  assert (public.teacher_login('lockdown-pin')->>'error') = 'E_AUTH', 'old PIN rejected';

  perform public.teacher_logout(v_tok);
  assert public.teacher_ping(v_tok) = false, 'logout ends the session';
end $$;
reset role;

rollback;
do $$ begin raise notice '== ALL PHASE 0 LOCKDOWN TESTS PASSED (transaction rolled back) =='; end $$;
