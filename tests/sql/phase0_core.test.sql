-- Phase 0 core tests (tasks 0.1): migrations 000, 001, 002.
-- Assert-style. Run AFTER the migrations on a database that contains the legacy sample rows
-- from tests/tools/supabase_shim.sql (locally) or a staging copy of production data.
-- Staging note: T0.3 totals assume the sample data; on a real copy only the generic checks apply.
\set ON_ERROR_STOP on
\echo '== T0.1 setup =='
do $$
declare v_code text; v_detail text;
begin
  begin perform private.fail('E_TEST', 'hello');
  exception when others then get stacked diagnostics v_code = message_text, v_detail = pg_exception_detail; end;
  assert v_code = 'E_TEST' and v_detail = 'hello', 'private.fail must raise message=code, detail=detail';

  -- regression: a null/omitted detail must still surface the E_ code as the message
  v_code := null;
  begin perform private.fail('E_NODETAIL'); exception when others then get stacked diagnostics v_code = message_text; end;
  assert v_code = 'E_NODETAIL', 'fail() without detail must raise message=code';

  assert private.param('nonexistent_key', 7) = 7, 'param default';
  insert into private.system_params(key, value) values ('t0_key', 3);
  assert private.param('t0_key', 7) = 3, 'param override';
  delete from private.system_params where key = 't0_key';
end $$;

\echo '== T0.2 courses =='
do $$
declare c public.courses; v_failed int := 0;
begin
  select * into c from public.courses where code = 'ADAB';
  assert found, 'ADAB seeded';
  assert c.name = 'Al-Aadaab Al-Asharah' and c.name_ar = 'الآداب العشرة', 'ADAB names';
  assert c.unit_label = 'Day' and c.lesson_mode = 'scored' and c.eligibility_rule = 'all_units', 'ADAB modes';
  assert c.day_count = 10 and c.day_max = 10 and c.bonus_unit_value = 2 and c.lesson_max = 100, 'ADAB scoring';
  assert c.weight_lessons = 50 and c.weight_exam = 50 and c.pass_mark = 60 and c.exam_live = false, 'ADAB D-40 defaults';
  assert jsonb_array_length(c.grade_bands) = 4, 'ADAB bands';

  -- constraints
  begin insert into public.courses(code,name) values ('bad code','x'); exception when check_violation then v_failed := v_failed+1; end;
  begin insert into public.courses(code,name,weight_lessons,weight_exam) values ('W1','x',60,60); exception when check_violation then v_failed := v_failed+1; end;
  begin insert into public.courses(code,name,lesson_mode,day_count,weight_lessons,weight_exam,eligibility_rule)
        values ('N1','x','none',0,0,100,'all_units'); exception when check_violation then v_failed := v_failed+1; end;
  begin insert into public.courses(code,name,lesson_mode,day_count) values ('N2','x','scored',0); exception when check_violation then v_failed := v_failed+1; end;
  begin insert into public.courses(code,name) values ('ADAB','dup'); exception when unique_violation then v_failed := v_failed+1; end;
  assert v_failed = 5, format('expected 5 rejected inserts, got %s', v_failed);

  -- a valid exam-only course is accepted
  insert into public.courses(code,name,lesson_mode,day_count,weight_lessons,weight_exam,eligibility_rule)
  values ('EXONLY','Exam only','none',0,0,100,'open');
  delete from public.courses where code = 'EXONLY';

  assert (select count(*) from private.institution_settings) = 3, 'institution settings seeded';
  assert (select value #>> '{}' from private.institution_settings where key='number_prefix') = 'MMI', 'prefix';
  assert (select value #>> '{signatory,name_ar}' from private.institution_settings where key='certificate_defaults') = 'موسى أمينو محمد', 'signatory';
end $$;

\echo '== T0.3 legacy copy =='
do $$
declare v_course uuid; n_before int; n_after int;
begin
  select id into v_course from public.courses where code = 'ADAB';
  assert (select count(*) from public.enrollments where course_id = v_course) = (select count(*) from public.students),
         'every legacy student has an ADAB enrollment';
  assert (select days from public.enrollments where student_id='s1') = '{10,9,8,7,6,5,4,3,2,1}', 's1 days copied';
  assert (select days from public.enrollments where student_id='s3') = '{5,-1,-1,-1,-1,-1,-1,-1,-1,-1}', 's3 unset days kept as -1';
  assert (select bonus_units from public.enrollments where student_id='s3') = '{0,0,0,0,0,0,0,0,0,0}', 'legacy -1 bonus becomes 0';
  assert (select bonus_units from public.enrollments where student_id='s2') = '{1,0,0,0,0,0,0,0,0,2}', 's2 bonus kept';
  assert (select active from public.enrollments where student_id='s4') = false, 'inactive flag kept';
  assert (select sn from public.enrollments where student_id='s2') = 2, 'sn kept';

  -- idempotent
  select count(*) into n_before from public.enrollments;
  perform private.sync_legacy_students();
  perform private.sync_legacy_students();
  select count(*) into n_after from public.enrollments;
  assert n_before = n_after, 're-running sync must not duplicate';

  -- picks up new + changed legacy rows
  insert into public.students(id, sn, name, days, bonus_units, active) values ('s5', 5, 'New Student', null, null, true);
  update public.students set days = '{1,1,1,1,1,1,1,1,1,1}' where id = 's3';
  perform private.sync_legacy_students();
  assert (select days from public.enrollments where student_id='s5') = array_fill(-1, array[10]), 'null legacy days -> all unset';
  assert (select bonus_units from public.enrollments where student_id='s5') = array_fill(0, array[10]), 'null legacy bonus -> zeros';
  assert (select days from public.enrollments where student_id='s3') = '{1,1,1,1,1,1,1,1,1,1}', 'changed legacy row re-synced';
  -- cleanup so later tests see the original data
  delete from public.students where id = 's5';
  update public.students set days = '{5,-1,-1,-1,-1,-1,-1,-1,-1,-1}' where id = 's3';
  perform private.sync_legacy_students();
end $$;

\echo '== T0.4 auth =='
do $$
declare r jsonb; tok text; tok2 text; v_code text; i int;
begin
  -- PIN hashed from legacy row; plaintext row intentionally still present until 005
  assert (select value from private.secrets where key='teacher_pin_hash') like '$2%', 'bcrypt hash stored';
  assert (select value from private.secrets where key='teacher_pin_hash') <> 'test-pin-1234', 'not plaintext';
  assert exists (select 1 from public.app_settings where key='teacher_pin'), 'plaintext row retained for the live client (removed by 005)';

  -- wrong PIN: returned, not raised, and PERSISTED
  r := public.teacher_login('nope');
  assert r->>'ok' = 'false' and r->>'error' = 'E_AUTH', 'wrong pin -> E_AUTH result';
  assert (select failed_count from private.auth_throttle where scope='teacher') = 1, 'failure persisted';
  r := public.teacher_login(null);
  assert r->>'error' = 'E_AUTH', 'null pin -> E_AUTH';

  -- correct PIN works, resets counter, token stored only as sha256
  r := public.teacher_login('test-pin-1234');
  assert r->>'ok' = 'true', 'login ok';
  tok := r->>'token';
  assert length(tok) = 64, 'token is 256 bits hex';
  assert not exists (select 1 from private.auth_throttle where scope='teacher'), 'counter cleared on success';
  assert not exists (select 1 from private.teacher_sessions where token_hash = tok), 'raw token not stored';
  assert exists (select 1 from private.teacher_sessions where token_hash = encode(extensions.digest(tok,'sha256'),'hex')), 'hash stored';
  assert (select expires_at from private.teacher_sessions limit 1) between now() + interval '7 hours 59 minutes' and now() + interval '8 hours 1 minute', '8h expiry';

  -- ping / require_teacher
  assert public.teacher_ping(tok) = true, 'ping valid';
  assert public.teacher_ping('garbage') = false and public.teacher_ping(null) = false and public.teacher_ping('') = false, 'ping invalid';
  perform private.require_teacher(tok);
  begin perform private.require_teacher('garbage'); exception when others then get stacked diagnostics v_code = message_text; end;
  assert v_code = 'E_AUTH', 'garbage token -> E_AUTH';
  v_code := null;
  begin perform private.require_teacher(null); exception when others then get stacked diagnostics v_code = message_text; end;
  assert v_code = 'E_AUTH', 'null token -> E_AUTH';

  -- expired session rejected
  update private.teacher_sessions set expires_at = now() - interval '1 second';
  assert public.teacher_ping(tok) = false, 'expired -> invalid';
  delete from private.teacher_sessions;

  -- lockout: 5 failures lock, even the right PIN is refused, then it recovers
  for i in 1..4 loop r := public.teacher_login('bad'); assert r->>'error' = 'E_AUTH', 'fail '||i; end loop;
  r := public.teacher_login('bad');
  assert r->>'error' = 'E_LOCKED' and (r->>'detail')::int between 4 and 5, '5th failure locks for ~5 min';
  r := public.teacher_login('test-pin-1234');
  assert r->>'error' = 'E_LOCKED', 'correct PIN refused while locked';
  update private.auth_throttle set locked_until = now() - interval '1 second' where scope='teacher';
  r := public.teacher_login('test-pin-1234');
  assert r->>'ok' = 'true', 'login works after lock expires';
  tok := r->>'token';

  -- logout
  perform public.teacher_logout(tok);
  assert public.teacher_ping(tok) = false, 'logout kills session';
end $$;

do $$
declare r jsonb; tok text; tok_other text; v_code text; i int;
begin
  tok       := public.teacher_login('test-pin-1234')->>'token';
  tok_other := public.teacher_login('test-pin-1234')->>'token';

  -- change PIN: validation + wrong current PIN
  begin perform public.teacher_change_pin(tok, 'test-pin-1234', 'abc'); exception when others then get stacked diagnostics v_code = message_text; end;
  assert v_code = 'E_VALIDATION', 'short new PIN rejected';
  r := public.teacher_change_pin(tok, 'wrong', 'a-strong-passphrase');
  assert r->>'error' = 'E_AUTH' and r->>'detail' = 'current_pin', 'wrong current pin';
  v_code := null;
  begin perform public.teacher_change_pin('garbage', 'test-pin-1234', 'a-strong-passphrase'); exception when others then get stacked diagnostics v_code = message_text; end;
  assert v_code = 'E_AUTH', 'change_pin needs a valid session';

  -- success: new PIN works, old doesn't, other sessions die, caller survives
  perform private.throttle_clear('teacher');
  r := public.teacher_change_pin(tok, 'test-pin-1234', 'a-strong-passphrase');
  assert r->>'ok' = 'true', 'change ok';
  assert public.teacher_ping(tok) = true, 'caller session survives';
  assert public.teacher_ping(tok_other) = false, 'other sessions invalidated';
  assert public.teacher_login('test-pin-1234')->>'error' = 'E_AUTH', 'old PIN rejected';
  assert public.teacher_login('a-strong-passphrase')->>'ok' = 'true', 'new PIN accepted';

  -- wrong current PIN also feeds the throttle (cannot brute-force through change_pin)
  perform private.throttle_clear('teacher');
  for i in 1..5 loop r := public.teacher_change_pin(tok, 'guess'||i, 'another-passphrase'); end loop;
  assert r->>'error' = 'E_LOCKED', 'change_pin guesses lock the throttle too';
  perform private.throttle_clear('teacher');
end $$;

\echo '== T0.5 anon access =='
set role anon;
do $$
declare ok_denied boolean; r jsonb;
begin
  -- the four auth RPCs are callable
  r := public.teacher_login('definitely-wrong');
  assert r->>'error' = 'E_AUTH', 'anon can call teacher_login';
  assert public.teacher_ping('x') = false, 'anon can call teacher_ping';

  -- private schema and functions are unreachable
  ok_denied := false; begin perform 1 from private.secrets; exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot read private.secrets';
  ok_denied := false; begin perform 1 from private.teacher_sessions; exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot read private.teacher_sessions';
  ok_denied := false; begin perform private.require_teacher('x'); exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot call private functions';
  ok_denied := false; begin perform private.sync_legacy_students(); exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot call sync_legacy_students';

  -- new tables are not writable by anon (even before lockdown 005)
  ok_denied := false; begin insert into public.courses(code,name) values ('HACK','x'); exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot insert courses';
  ok_denied := false; begin update public.enrollments set active = false; exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot update enrollments';
  ok_denied := false; begin delete from public.enrollment_results; exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot delete results';
end $$;
reset role;

\echo '== ALL PHASE 0 CORE TESTS PASSED =='
