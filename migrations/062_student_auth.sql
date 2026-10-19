-- 062_student_auth.sql  (PRD v4, Phase 1 / D-61, FR-1.2)
-- Student sign-in by login code + PIN. Own session table, so a student token can never satisfy a staff guard
-- (private.require_teacher / require_admin read private.teacher_sessions only). Additive and idempotent.
--   * private.student_credentials : one row per student (login_code, bcrypt PIN hash). Created by a teacher.
--   * private.student_sessions    : opaque token, stored hashed, 12 h expiry.
--   * admin_set_student_pin (teacher/admin) · student_login · student_logout · student_change_pin · student_me
-- Identity always comes from the token, never from an argument, so one student cannot reach another's data.

create table if not exists private.student_credentials (
  student_id text primary key references public.students(id) on delete cascade,
  login_code text not null unique,
  pin_hash   text not null,
  must_change boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists private.student_sessions (
  token_hash text primary key,
  student_id text not null references public.students(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_student_sessions_student on private.student_sessions(student_id);
alter table private.student_credentials enable row level security;
alter table private.student_sessions    enable row level security;
revoke all on private.student_credentials, private.student_sessions from public, anon, authenticated;

create or replace function private.valid_student_pin(p text) returns void language plpgsql as $$
begin
  if p is null or p !~ '^[0-9]{4,6}$' then perform private.fail('E_VALIDATION', 'PIN must be 4 to 6 digits.'); end if;
end $$;

-- student_id behind a valid, unexpired student token; E_AUTH otherwise
create or replace function private.require_student(p_token text) returns text
language plpgsql security definer set search_path = public, private, extensions as $$
declare v text;
begin
  select student_id into v from private.student_sessions
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and expires_at > now();
  if v is null then perform private.fail('E_AUTH'); end if;
  return v;
end $$;

create or replace function public.admin_set_student_pin(p_token text, p_student_id text, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare v_pin text := p_pin; v_code text; v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_try int := 0;
begin
  perform private.require_teacher(p_token);
  if not exists (select 1 from public.students where id = p_student_id) then perform private.fail('E_NOT_FOUND', 'Student not found.'); end if;
  if v_pin is null then v_pin := lpad((get_byte(extensions.gen_random_bytes(2), 0) * 256 + get_byte(extensions.gen_random_bytes(2), 1))::text, 4, '0'); v_pin := right(v_pin, 4); end if;
  perform private.valid_student_pin(v_pin);
  select login_code into v_code from private.student_credentials where student_id = p_student_id;
  while v_code is null loop
    v_try := v_try + 1; if v_try > 20 then perform private.fail('E_INTERNAL', 'Could not allocate a login code.'); end if;
    v_code := 'MIF-' || (select string_agg(substr(v_alpha, 1 + get_byte(extensions.gen_random_bytes(1), 0) % 32, 1), '') from generate_series(1, 6));
    if exists (select 1 from private.student_credentials where login_code = v_code) then v_code := null; end if;
  end loop;
  insert into private.student_credentials (student_id, login_code, pin_hash, must_change)
  values (p_student_id, v_code, extensions.crypt(v_pin, extensions.gen_salt('bf', 8)), true)
  on conflict (student_id) do update set pin_hash = excluded.pin_hash, must_change = true, updated_at = now();
  delete from private.student_sessions where student_id = p_student_id;
  return jsonb_build_object('ok', true, 'login_code', v_code, 'pin', v_pin, 'must_change', true);   -- shown once to the teacher
end $$;

create or replace function public.student_login(p_code text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_code text := upper(btrim(coalesce(p_code, ''))); v_cred private.student_credentials; v_st public.students;
  v_scope text; v_mins int; v_tok text; v_exp timestamptz := now() + private.param('student_session_hours', 12) * interval '1 hour';
  v_max int := private.param('student_login_max_failures', 5)::int; v_lock numeric := private.param('student_lock_minutes', 5);
begin
  if v_code = '' or char_length(v_code) > 40 then return jsonb_build_object('ok', false, 'error', 'E_AUTH'); end if;
  v_scope := 'student:' || v_code;
  v_mins := private.throttle_check(v_scope);
  if v_mins > 0 then return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_mins::text); end if;
  select * into v_cred from private.student_credentials where login_code = v_code;
  if not found then
    perform extensions.crypt(coalesce(p_pin, ''), extensions.gen_salt('bf', 8));   -- equalise timing; unknown codes are not throttled
    return jsonb_build_object('ok', false, 'error', 'E_AUTH');
  end if;
  if extensions.crypt(coalesce(p_pin, ''), v_cred.pin_hash) <> v_cred.pin_hash then
    v_mins := private.throttle_fail(v_scope, v_max, v_lock);
    if v_mins > 0 then return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_mins::text); end if;
    return jsonb_build_object('ok', false, 'error', 'E_AUTH');
  end if;
  perform private.throttle_clear(v_scope);
  delete from private.student_sessions where expires_at < now();
  v_tok := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.student_sessions (token_hash, student_id, expires_at) values (encode(extensions.digest(v_tok, 'sha256'), 'hex'), v_cred.student_id, v_exp);
  select * into v_st from public.students where id = v_cred.student_id;
  return jsonb_build_object('ok', true, 'token', v_tok, 'expires_at', v_exp,
    'student', jsonb_build_object('id', v_st.id, 'name', v_st.name, 'name_ar', v_st.name_ar, 'must_change', v_cred.must_change));
end $$;

create or replace function public.student_logout(p_token text) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
begin
  delete from private.student_sessions where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.student_change_pin(p_token text, p_old text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_sid text := private.require_student(p_token); v_cred private.student_credentials; v_scope text; v_mins int;
        v_max int := private.param('student_login_max_failures', 5)::int; v_lock numeric := private.param('student_lock_minutes', 5);
begin
  select * into v_cred from private.student_credentials where student_id = v_sid;
  v_scope := 'student:' || v_cred.login_code;
  v_mins := private.throttle_check(v_scope);
  if v_mins > 0 then return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_mins::text); end if;
  perform private.valid_student_pin(p_new);
  if extensions.crypt(coalesce(p_old, ''), v_cred.pin_hash) <> v_cred.pin_hash then
    v_mins := private.throttle_fail(v_scope, v_max, v_lock);
    if v_mins > 0 then return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_mins::text); end if;
    return jsonb_build_object('ok', false, 'error', 'E_AUTH', 'detail', 'current_pin');
  end if;
  perform private.throttle_clear(v_scope);
  update private.student_credentials set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 8)), must_change = false, updated_at = now() where student_id = v_sid;
  delete from private.student_sessions where student_id = v_sid and token_hash <> encode(extensions.digest(p_token, 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

-- the signed-in student's own profile and enrollments (lesson scores are the student's own legacy day marks)
create or replace function public.student_me(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, private, extensions as $$
declare v_sid text := private.require_student(p_token);
begin
  return jsonb_build_object(
    'student', (select jsonb_build_object('id', s.id, 'name', s.name, 'name_ar', s.name_ar, 'must_change', c.must_change)
                  from public.students s join private.student_credentials c on c.student_id = s.id where s.id = v_sid),
    'enrollments', coalesce((select jsonb_agg(jsonb_build_object(
        'enrollment_id', e.id, 'course_id', co.id, 'course_code', co.code, 'course_name', co.name, 'course_name_ar', co.name_ar,
        'days', e.days, 'bonus_units', e.bonus_units) order by co.name)
      from public.enrollments e join public.courses co on co.id = e.course_id
     where e.student_id = v_sid and e.active), '[]'::jsonb));
end $$;

revoke all on function public.admin_set_student_pin(text, text, text), public.student_login(text, text), public.student_logout(text),
  public.student_change_pin(text, text, text), public.student_me(text) from public;
revoke all on function private.require_student(text), private.valid_student_pin(text) from public, anon, authenticated;
grant execute on function public.admin_set_student_pin(text, text, text), public.student_login(text, text), public.student_logout(text),
  public.student_change_pin(text, text, text), public.student_me(text) to anon;

do $$ begin
  assert has_function_privilege('anon', 'public.student_login(text, text)', 'execute'), '062: anon lost student_login';
  assert not has_function_privilege('anon', 'private.require_student(text)', 'execute'), '062: anon can run require_student';
  assert not has_table_privilege('anon', 'private.student_credentials', 'select'), '062: anon can read credentials';
  raise notice '062 applied and verified: student login ready.';
end $$;
