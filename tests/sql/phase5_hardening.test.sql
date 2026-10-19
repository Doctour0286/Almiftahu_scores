-- =============================================================================
-- tests/sql/phase5_hardening.test.sql
-- Proves 060_staff_hardening. State-agnostic: passes on a fresh build AND on a database that was put
-- back into the old (insecure 050) production state and then upgraded (tests/tools/hardening_upgrade_path.sh).
-- Single transaction, always rolled back.
-- =============================================================================
begin;

create function pg_temp.err(q text) returns text language plpgsql as $f$
declare m text;
begin
  execute q;
  return null;
exception when others then
  get stacked diagnostics m = message_text;
  return m;
end $f$;

-- ---------- 1. what the old 050 left behind is dead ----------
do $$
declare r jsonb;
begin
  -- default credentials
  r := public.staff_login('admin@almiftahu.edu', 'admin123');
  assert not (r->>'ok')::boolean and r->>'error' = 'E_AUTH', 'seeded admin default password must not work: ' || r::text;
  r := public.staff_login('ibrahim@almiftahu.edu', 'teacher123');
  assert not (r->>'ok')::boolean and r->>'error' = 'E_AUTH', 'seeded teacher default password must not work: ' || r::text;
  -- the back door: any email + a "known" password
  r := public.staff_login('nobody@example.org', 'teacher123');
  assert not (r->>'ok')::boolean, 'back-door password teacher123 must not work';
  r := public.staff_login('nobody@example.org', '1234');
  assert not (r->>'ok')::boolean, 'back-door password 1234 must not work';
  r := public.staff_login('nobody@example.org', '123456');
  assert not (r->>'ok')::boolean, 'back-door password 123456 must not work';
  r := public.staff_login('', null);
  assert not (r->>'ok')::boolean, 'empty credentials must not work';

  assert not exists (select 1 from private.staff_accounts where password_hash !~ '^\$2[aby]\$'), 'a staff password is stored unhashed';
  assert not exists (select 1 from private.staff_accounts where active and email in
    ('admin@almiftahu.edu','ibrahim@almiftahu.edu','usman@almiftahu.edu')), 'seeded accounts must be inactive';
end $$;

-- ---------- 2. dropped functions really are gone; nothing unauthenticated is left ----------
do $$
begin
  assert to_regprocedure('public.submit_audio_recitation(text, text, uuid, text, text, text, text, int)') is null, 'submit_audio_recitation still exists';
  assert to_regprocedure('public.admin_list_audio_submissions(uuid)') is null, 'unauthenticated audio list still exists';
  assert to_regprocedure('public.admin_grade_audio(uuid, boolean, numeric, text, text)') is null, 'unauthenticated audio grade still exists';
  assert not has_function_privilege('anon', 'private.bootstrap_admin(text, text, text, text)', 'execute'), 'anon can run bootstrap_admin';
  assert not has_function_privilege('anon', 'private.require_admin(text)', 'execute'), 'anon can run private.require_admin';
end $$;

-- ---------- 3. bootstrap -> login -> roles ----------
do $$
declare r jsonb; adm text; tch text; pin_tok text; m text; v_id uuid;
begin
  assert private.bootstrap_admin('Owner@Example.org', 'a long passphrase 1', 'The Owner', 'المالك') like 'admin ready:%', 'bootstrap failed';
  assert pg_temp.err($q$ select private.bootstrap_admin('bad', 'a long passphrase 1', 'x', 'x') $q$) like '%invalid email%', 'bootstrap accepted a bad email';
  assert pg_temp.err($q$ select private.bootstrap_admin('o2@example.org', 'short', 'x', 'x') $q$) like 'E_VALIDATION', 'bootstrap accepted a short password';

  -- wrong password / right password (email is case-insensitive)
  r := public.staff_login('owner@example.org', 'wrong wrong wrong');
  assert r->>'error' = 'E_AUTH', 'wrong password must be E_AUTH';
  r := public.staff_login('OWNER@example.org', 'a long passphrase 1');
  assert (r->>'ok')::boolean and length(r->>'token') = 64, 'admin login failed: ' || r::text;
  assert r->'user'->>'role' = 'admin' and r->'user' ? 'name_ar' and not (r->'user' ? 'password_hash'), 'login payload shape';
  adm := r->>'token';
  perform set_config('t.adm', adm, true);

  -- admin can list staff, and the list never carries a hash
  r := public.admin_list_staff(adm);
  assert jsonb_array_length(r) >= 1, 'admin_list_staff empty';
  assert position('password' in r::text) = 0, 'staff list leaks a password field';

  -- create a teacher as admin
  r := public.admin_save_staff(adm, null, jsonb_build_object('email','Teach@Example.org','name','Ustadh T','name_ar','الأستاذ','role','teacher','password','teacher passphrase 1'));
  assert (r->>'ok')::boolean, 'create teacher failed: ' || r::text;
  v_id := (r->>'id')::uuid;
  assert pg_temp.err(format($q$ select public.admin_save_staff(%L, null, %L::jsonb) $q$, adm, '{"email":"teach@example.org","name":"dup","password":"another passphrase 1"}')) = 'E_VALIDATION', 'duplicate email accepted';
  assert pg_temp.err(format($q$ select public.admin_save_staff(%L, null, %L::jsonb) $q$, adm, '{"email":"weak@example.org","name":"w","password":"short"}')) = 'E_VALIDATION', 'weak password accepted';

  r := public.staff_login('teach@example.org', 'teacher passphrase 1');
  assert (r->>'ok')::boolean, 'teacher login failed';
  tch := r->>'token';

  -- a teacher session is a normal admin_* session, but NOT an admin session
  assert pg_temp.err(format($q$ select public.admin_list_staff(%L) $q$, tch)) = 'E_AUTH', 'teacher reached admin_list_staff';
  assert pg_temp.err(format($q$ select public.admin_save_staff(%L, null, %L::jsonb) $q$, tch, '{"email":"x@example.org","name":"x","password":"another passphrase 1"}')) = 'E_AUTH', 'teacher created staff';
  assert public.teacher_ping(tch), 'teacher staff session must satisfy the existing admin_* guard (teacher_ping)';

  -- a PIN session is not an admin either
  update private.secrets set value = extensions.crypt('p5-pin', extensions.gen_salt('bf', 4)) where key = 'teacher_pin_hash';
  delete from private.auth_throttle;
  pin_tok := public.teacher_login('p5-pin')->>'token';
  assert length(pin_tok) = 64, 'PIN login still works (existing workflow)';
  assert pg_temp.err(format($q$ select public.admin_list_staff(%L) $q$, pin_tok)) = 'E_AUTH', 'PIN session reached admin_list_staff';
  assert pg_temp.err(format($q$ select public.staff_change_password(%L, 'x', 'whatever passphrase 1') $q$, pin_tok)) = 'E_AUTH', 'PIN session changed a staff password';
  perform set_config('t.tch', tch, true);
  perform set_config('t.pin', pin_tok, true);
  perform set_config('t.tid', v_id::text, true);
end $$;

-- ---------- 4. throttle, last-admin rule, password change, deactivation ----------
do $$
declare r jsonb; adm text := current_setting('t.adm'); tch text := current_setting('t.tch'); tid uuid := current_setting('t.tid')::uuid; me uuid;
begin
  -- lock after 5 failures; correct password is refused while locked
  for i in 1 .. 4 loop
    assert public.staff_login('teach@example.org', 'nope nope nope')->>'error' = 'E_AUTH', 'failure ' || i;
  end loop;
  assert public.staff_login('teach@example.org', 'nope nope nope')->>'error' = 'E_LOCKED', '5th failure must lock';
  assert public.staff_login('teach@example.org', 'teacher passphrase 1')->>'error' = 'E_LOCKED', 'correct password while locked must be refused';
  delete from private.auth_throttle;

  -- last active admin cannot be removed or demoted
  select id into me from private.staff_accounts where email = 'owner@example.org';
  assert pg_temp.err(format($q$ select public.admin_save_staff(%L, %L, '{"active":false}') $q$, adm, me)) = 'E_VALIDATION', 'last admin was deactivated';
  assert pg_temp.err(format($q$ select public.admin_save_staff(%L, %L, '{"role":"teacher"}') $q$, adm, me)) = 'E_VALIDATION', 'last admin was demoted';

  -- change own password: wrong old, then right; old password dies, other sessions die, this one lives
  r := public.staff_change_password(tch, 'not the password', 'new teacher passphrase 2');
  assert not (r->>'ok')::boolean and r->>'detail' = 'current_password', 'wrong current password: ' || r::text;
  delete from private.auth_throttle;
  r := public.staff_change_password(tch, 'teacher passphrase 1', 'new teacher passphrase 2');
  assert (r->>'ok')::boolean, 'change password failed: ' || r::text;
  assert not (public.staff_login('teach@example.org', 'teacher passphrase 1')->>'ok')::boolean, 'old password still works';
  assert (public.staff_login('teach@example.org', 'new teacher passphrase 2')->>'ok')::boolean, 'new password does not work';
  assert public.teacher_ping(tch), 'the session that changed the password must survive';

  -- admin deactivates the teacher: sessions end immediately, login refused
  delete from private.auth_throttle;
  r := public.staff_login('teach@example.org', 'new teacher passphrase 2');
  tch := r->>'token';
  assert public.teacher_ping(tch), 'fresh teacher session';
  perform public.admin_save_staff(adm, tid, '{"active":false}');
  assert not public.teacher_ping(tch), 'deactivated teacher session must end';
  assert not (public.staff_login('teach@example.org', 'new teacher passphrase 2')->>'ok')::boolean, 'deactivated teacher can log in';
end $$;

-- ---------- 5. audio RPCs need a session; grading is server-attributed and validated ----------
do $$
declare cid uuid; sub uuid; adm text := current_setting('t.adm'); pin_tok text := current_setting('t.pin'); r jsonb;
begin
  insert into public.courses (code, name, eligibility_rule, weight_lessons, weight_exam, pass_mark)
  values ('P5AUD', 'Phase5 Audio', 'open', 50, 50, 60) returning id into cid;
  insert into public.students (id, name) values ('p5-aud-student', 'Audio Student') on conflict (id) do nothing;
  insert into private.audio_submissions (lesson_id, lesson_title, course_id, student_id, student_name, audio_url)
  values ('l1', 'Lesson 1', cid, 'p5-aud-student', 'Audio Student', 'data:audio/webm;base64,AAAA') returning id into sub;

  -- no token / bad token
  assert pg_temp.err($q$ select public.admin_list_audio_submissions(null, null) $q$) = 'E_AUTH', 'audio list without a token';
  assert pg_temp.err($q$ select public.admin_list_audio_submissions('not-a-token', null) $q$) = 'E_AUTH', 'audio list with a bad token';
  assert pg_temp.err(format($q$ select public.admin_grade_audio(null, %L, true, 10, 'x') $q$, sub)) = 'E_AUTH', 'grade without a token';

  -- with a valid session (PIN or staff) it works
  r := public.admin_list_audio_submissions(pin_tok, cid);
  assert jsonb_array_length(r) = 1 and r->0->>'status' = 'pending', 'PIN session can list: ' || r::text;

  -- validation: score range, feedback length
  assert pg_temp.err(format($q$ select public.admin_grade_audio(%L, %L, true, 999, 'x') $q$, adm, sub)) = 'E_VALIDATION', 'score above max accepted';
  assert pg_temp.err(format($q$ select public.admin_grade_audio(%L, %L, true, -1, 'x') $q$, adm, sub)) = 'E_VALIDATION', 'negative score accepted';

  r := public.admin_grade_audio(adm, sub, true, 18, 'Mashallah');
  assert (r->>'ok')::boolean, 'grade failed';
  r := public.admin_list_audio_submissions(adm, cid);
  assert r->0->>'status' = 'approved' and (r->0->>'score')::numeric = 18, 'grade not stored';
  assert r->0->>'graded_by' = 'The Owner', 'graded_by must come from the session, got: ' || (r->0->>'graded_by');
  r := public.admin_grade_audio(adm, gen_random_uuid(), true, 5, '');
  assert r->>'error' = 'E_NOT_FOUND', 'unknown submission';
end $$;

-- ---------- 6. nothing unexpected is open to anon ----------
do $$
declare v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname !~ '^(admin_|teacher_|exam_|staff_|student_|get_certificate$|verify_certificate$)';
  assert v_bad is null, 'unexpected anon-executable functions: ' || coalesce(v_bad, '');
  -- and every admin_* function that anon can run takes a token as its first argument
  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.proname like 'admin\_%' and has_function_privilege('anon', p.oid, 'execute')
     and (p.pronargs = 0 or (pg_get_function_identity_arguments(p.oid)) !~ '^p_token text');
  assert v_bad is null, 'admin_* function without a leading p_token: ' || coalesce(v_bad, '');
end $$;

do $$ begin raise notice '== ALL PHASE 5 HARDENING TESTS PASSED (transaction rolled back) =='; end $$;
rollback;
