-- tests/sql/phase10_student_bridge.test.sql: proves 066 (JWT -> student session). One transaction, rolled back.
begin;
create function pg_temp.err(q text) returns text language plpgsql as $f$
declare m text; begin execute q; return null; exception when others then get stacked diagnostics m = message_text; return m; end $f$;
create function pg_temp.as_user(u uuid) returns void language sql as $f$ select set_config('request.jwt.claim.sub', coalesce(u::text, ''), true) $f$;
do $$
declare t text; c uuid; sidA text; sidB text; ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); r jsonb; ta text; tb text; r2 jsonb;
begin
  update private.secrets set value = extensions.crypt('p10-pin', extensions.gen_salt('bf', 4)) where key = 'teacher_pin_hash';
  delete from private.auth_throttle; t := public.teacher_login('p10-pin')->>'token';
  insert into public.courses (code, name, eligibility_rule, weight_lessons, weight_exam, pass_mark) values ('P10C', 'Phase10', 'open', 50, 50, 60) returning id into c;
  r := public.admin_add_student(t, c, 'Bridge A'); sidA := (select student_id from public.enrollments where id = (r->>'enrollment_id')::uuid);
  r := public.admin_add_student(t, c, 'Bridge B'); sidB := (select student_id from public.enrollments where id = (r->>'enrollment_id')::uuid);

  -- no JWT, a JWT for nobody, and a staff-like login with no student mapping are all refused
  perform pg_temp.as_user(null);
  assert pg_temp.err($q$ select public.student_session() $q$) = 'E_AUTH', 'no JWT';
  perform pg_temp.as_user(ua);
  assert pg_temp.err($q$ select public.student_session() $q$) = 'E_AUTH', 'unmapped user';
  assert pg_temp.err($q$ select public.student_password_changed() $q$) = 'E_AUTH', 'unmapped user cannot clear the flag';

  -- the service link (what the Edge Function does)
  assert not (public.service_student_link('nope')->>'student_exists')::boolean, 'unknown student';
  assert pg_temp.err($q$ select public.service_link_student('nope', gen_random_uuid()) $q$) = 'E_NOT_FOUND', 'link to an unknown student';
  perform public.service_link_student(sidA, ua); perform public.service_link_student(sidB, ub);
  assert (public.service_student_link(sidA)->>'auth_user_id')::uuid = ua, 'link readable by the service';

  -- JWT -> session; the session works with every existing student RPC; identity is the mapped student only
  perform pg_temp.as_user(ua); r := public.student_session();
  assert (r->>'ok')::boolean and length(r->>'token') = 64 and r->'student'->>'name' = 'Bridge A' and (r->'student'->>'must_change')::boolean, 'session A: ' || r::text;
  ta := r->>'token';
  perform pg_temp.as_user(ub); tb := public.student_session()->>'token';
  assert ta <> tb, 'distinct tokens';
  assert public.student_me(ta)->'student'->>'name' = 'Bridge A' and public.student_me(tb)->'student'->>'name' = 'Bridge B', 'tokens map to their own student';
  assert pg_temp.err(format($q$ select public.admin_list_roster(%L, %L) $q$, ta, c)) = 'E_AUTH', 'a student session reached a staff RPC';

  -- forced first-login password change is tracked; clearing it is per-user
  perform pg_temp.as_user(ua); perform public.student_password_changed();
  assert not (public.student_session()->'student'->>'must_change')::boolean, 'flag cleared for A';
  perform pg_temp.as_user(ub); assert (public.student_session()->'student'->>'must_change')::boolean, 'B still must change';

  -- a reset (re-link) ends open sessions and sets the flag again
  perform public.service_link_student(sidA, ua);
  assert pg_temp.err(format($q$ select public.student_me(%L) $q$, ta)) = 'E_AUTH', 're-link must end sessions';
  perform pg_temp.as_user(ua); assert (public.student_session()->'student'->>'must_change')::boolean, 'must_change set again';

  -- inactive students cannot start a session
  perform public.admin_set_active(t, (select id from public.enrollments where student_id = sidB), false);
  perform pg_temp.as_user(ub);
  assert pg_temp.err($q$ select public.student_session() $q$) = 'E_AUTH', 'inactive student started a session';

  -- staff view and privileges
  perform pg_temp.as_user(null);
  assert jsonb_array_length(public.admin_list_student_accounts(t)) = 2, 'account list';
  assert pg_temp.err(format($q$ select public.admin_list_student_accounts(%L) $q$, ta)) = 'E_AUTH', 'student token listed accounts';
  assert not has_function_privilege('anon', 'public.student_session()', 'execute') and has_function_privilege('authenticated', 'public.student_session()', 'execute'), 'student_session privileges';
  assert not has_function_privilege('anon', 'public.service_link_student(text, uuid)', 'execute') and not has_function_privilege('authenticated', 'public.service_link_student(text, uuid)', 'execute')
     and has_function_privilege('service_role', 'public.service_link_student(text, uuid)', 'execute'), 'service_link privileges';
end $$;
do $$ begin raise notice '== ALL PHASE 10 STUDENT BRIDGE TESTS PASSED (transaction rolled back) =='; end $$;
rollback;
