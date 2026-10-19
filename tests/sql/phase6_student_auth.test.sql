-- tests/sql/phase6_student_auth.test.sql: proves 062 (student login by code + PIN). One transaction, rolled back.
begin;
create function pg_temp.err(q text) returns text language plpgsql as $f$
declare m text; begin execute q; return null; exception when others then get stacked diagnostics m = message_text; return m; end $f$;

do $$
declare t text; cid uuid; r jsonb; a_code text; a_pin text; b_code text; b_pin text; sa text; sb text; ea uuid; eb uuid;
begin
  update private.secrets set value = extensions.crypt('p6-pin', extensions.gen_salt('bf', 4)) where key = 'teacher_pin_hash';
  delete from private.auth_throttle;
  t := public.teacher_login('p6-pin')->>'token';
  insert into public.courses (code, name, name_ar, eligibility_rule, weight_lessons, weight_exam, pass_mark)
  values ('P6C', 'Phase6', 'المرحلة', 'open', 50, 50, 60) returning id into cid;
  ea := (public.admin_add_student(t, cid, 'Aisha Musa', 'عائشة')->>'enrollment_id')::uuid;
  eb := (public.admin_add_student(t, cid, 'Bello Sani')->>'enrollment_id')::uuid;
  perform public.admin_save_day(t, ea, 0, 7, 0);
  perform set_config('t.ta', t, true); perform set_config('t.ea', ea::text, true); perform set_config('t.eb', eb::text, true);

  -- credentials need a staff session; PIN format is validated
  assert pg_temp.err(format($q$ select public.admin_set_student_pin(null, %L) $q$, (select student_id from public.enrollments where id = ea))) = 'E_AUTH', 'set pin without token';
  assert pg_temp.err(format($q$ select public.admin_set_student_pin(%L, 'nope-id') $q$, t)) = 'E_NOT_FOUND', 'unknown student';
  assert pg_temp.err(format($q$ select public.admin_set_student_pin(%L, %L, 'abcd') $q$, t, (select student_id from public.enrollments where id = ea))) = 'E_VALIDATION', 'non-digit PIN accepted';
  assert pg_temp.err(format($q$ select public.admin_set_student_pin(%L, %L, '12') $q$, t, (select student_id from public.enrollments where id = ea))) = 'E_VALIDATION', 'short PIN accepted';

  r := public.admin_set_student_pin(t, (select student_id from public.enrollments where id = ea));
  assert (r->>'ok')::boolean and r->>'login_code' ~ '^MIF-[A-Z2-9]{6}$' and r->>'pin' ~ '^[0-9]{4}$', 'generated credentials shape: ' || r::text;
  a_code := r->>'login_code'; a_pin := r->>'pin';
  r := public.admin_set_student_pin(t, (select student_id from public.enrollments where id = eb), '654321');
  b_code := r->>'login_code'; b_pin := '654321';
  assert a_code <> b_code, 'login codes must be unique';
  assert (public.admin_set_student_pin(t, (select student_id from public.enrollments where id = ea), '1111')->>'login_code') = a_code, 'login code must be stable on reset';
  a_pin := '1111';
  assert not exists (select 1 from private.student_credentials where pin_hash !~ '^\$2[aby]\$'), 'a PIN is stored unhashed';

  -- login
  assert public.student_login(a_code, 'wrong')->>'error' = 'E_AUTH', 'wrong pin';
  assert public.student_login('MIF-NOPE22', a_pin)->>'error' = 'E_AUTH', 'unknown code';
  assert public.student_login('', null)->>'error' = 'E_AUTH', 'empty';
  r := public.student_login(lower(a_code), a_pin);   -- case-insensitive code
  assert (r->>'ok')::boolean and length(r->>'token') = 64 and (r->'student'->>'must_change')::boolean, 'login: ' || r::text;
  sa := r->>'token';
  sb := public.student_login(b_code, b_pin)->>'token';
  perform set_config('t.sa', sa, true); perform set_config('t.sb', sb, true);
  perform set_config('t.acode', a_code, true);

  -- isolation: identity comes from the token only
  r := public.student_me(sa);
  assert r->'student'->>'name' = 'Aisha Musa' and jsonb_array_length(r->'enrollments') = 1, 'me (A): ' || r::text;
  assert (r->'enrollments'->0->'days'->>0)::int = 7, 'A sees her own marks';
  assert position('pin' in r::text) = 0 and position('hash' in r::text) = 0, 'student_me leaks credentials';
  assert public.student_me(sb)->'student'->>'name' = 'Bello Sani', 'me (B) must be B';
  assert (public.student_me(sb)->'enrollments'->0->'days'->>0)::int is distinct from 7, 'B must not see A''s marks';
  assert pg_temp.err($q$ select public.student_me('garbage') $q$) = 'E_AUTH', 'garbage token';
  assert pg_temp.err($q$ select public.student_me(null) $q$) = 'E_AUTH', 'null token';

  -- a student token is not a staff token, and a staff token is not a student token
  assert pg_temp.err(format($q$ select public.admin_list_roster(%L, %L) $q$, sa, cid)) = 'E_AUTH', 'student token reached a staff RPC';
  assert pg_temp.err(format($q$ select public.admin_set_student_pin(%L, %L) $q$, sa, (select student_id from public.enrollments where id = eb))) = 'E_AUTH', 'student set a PIN';
  assert pg_temp.err(format($q$ select public.student_me(%L) $q$, t)) = 'E_AUTH', 'staff token accepted as a student';
end $$;

do $$
declare sa text := current_setting('t.sa'); sb text := current_setting('t.sb'); acode text := current_setting('t.acode'); r jsonb; t text := current_setting('t.ta');
begin
  -- change PIN: wrong old, bad new, then ok; old PIN dies, other sessions die, this one lives
  assert public.student_change_pin(sa, '0000', '2222')->>'detail' = 'current_pin', 'wrong old pin';
  assert pg_temp.err(format($q$ select public.student_change_pin(%L, '1111', 'abcd') $q$, sa)) = 'E_VALIDATION', 'bad new pin';
  delete from private.auth_throttle;
  assert (public.student_change_pin(sa, '1111', '2222')->>'ok')::boolean, 'change pin';
  assert not (public.student_login(acode, '1111')->>'ok')::boolean, 'old pin still works';
  assert not (public.student_me(sa)->'student'->>'must_change')::boolean, 'must_change cleared';
  assert (public.student_login(acode, '2222')->>'ok')::boolean, 'new pin works';

  -- lockout after 5 failures; correct PIN refused while locked
  delete from private.auth_throttle;
  for i in 1 .. 4 loop assert public.student_login(acode, '9999')->>'error' = 'E_AUTH'; end loop;
  assert public.student_login(acode, '9999')->>'error' = 'E_LOCKED', '5th failure locks';
  assert public.student_login(acode, '2222')->>'error' = 'E_LOCKED', 'locked even with the right pin';
  delete from private.auth_throttle;

  -- teacher reset ends the student's sessions; logout ends one; expiry ends one
  r := public.student_login(acode, '2222'); sa := r->>'token';
  perform public.admin_set_student_pin(t, (select student_id from public.enrollments where id = current_setting('t.ea')::uuid), '3333');
  assert pg_temp.err(format($q$ select public.student_me(%L) $q$, sa)) = 'E_AUTH', 'reset must end sessions';
  sa := public.student_login(acode, '3333')->>'token';
  perform public.student_logout(sa);
  assert pg_temp.err(format($q$ select public.student_me(%L) $q$, sa)) = 'E_AUTH', 'logout must end the session';
  sa := public.student_login(acode, '3333')->>'token';
  update private.student_sessions set expires_at = now() - interval '1 minute' where token_hash = encode(extensions.digest(sa, 'sha256'), 'hex');
  assert pg_temp.err(format($q$ select public.student_me(%L) $q$, sa)) = 'E_AUTH', 'expired session accepted';
  assert (public.student_me(sb)->'student'->>'name') = 'Bello Sani', 'B unaffected by A''s changes';
end $$;

do $$ begin raise notice '== ALL PHASE 6 STUDENT AUTH TESTS PASSED (transaction rolled back) =='; end $$;
rollback;
