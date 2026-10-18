-- 060_staff_hardening.sql  (PRD v4, Phase H: hardening)
-- Fixes the security holes that 050_lms_extension introduced. 050 has been edited in place so a fresh
-- build never creates them; THIS file repairs a database where the old 050 already ran.
--
-- What was wrong (all verified by reading 050):
--   1. Three staff accounts were seeded with the plaintext passwords admin123 / teacher123, and
--      staff_login compared passwords in plaintext.
--   2. staff_login accepted '1234', '123456' and 'teacher123' for ANY email whenever the PIN table existed
--      (a back door), and it returned no session token, so it could not guard anything.
--   3. admin_list_audio_submissions and admin_grade_audio were executable by anon with NO auth check:
--      anyone holding the publishable key could read every recording and grade it.
--   4. submit_audio_recitation trusted a student_id sent by the browser and stored unlimited-size data URLs.
--
-- What this does:
--   * Deactivates the seeded default accounts, hashes every remaining password (bcrypt, cost 10).
--   * staff_login: hashed compare, per-account throttle, no back door, issues a session in the SAME
--     private.teacher_sessions table every admin_* RPC already trusts (adds staff_id + role columns).
--   * Adds admin_list_staff / admin_save_staff / staff_change_password (admin role required).
--   * Adds private.bootstrap_admin(...) to be run by the OWNER in the SQL editor (never executable by anon).
--   * Audio RPCs now require a staff session. submit_audio_recitation is DROPPED until students have
--     real sessions (PRD v4 Phase 3); the old signatures are dropped so no insecure overload survives.
--
-- AFTER RUNNING: every staff account is inactive until you create your admin:
--   select private.bootstrap_admin('you@example.org', '<a long passphrase>', 'Your Name', 'اسمك');
-- The PIN login (teacher_login) is untouched and keeps working for the existing teacher workflow.
-- Idempotent. Safe on a database where 050 never ran (creates what it needs).

-- ---------------------------------------------------------------------------------------------
-- 0. Tables and columns this file needs (no-ops where 050 already created them)
-- ---------------------------------------------------------------------------------------------
create table if not exists private.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('teacher', 'admin')),
  name text not null,
  name_ar text not null,
  title text default 'Instructor',
  title_ar text default 'Malami Mai Bada Horon',
  assigned_courses text[] default array['ALL'],
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table private.staff_accounts enable row level security;
revoke all on private.staff_accounts from public, anon, authenticated;

alter table private.teacher_sessions add column if not exists staff_id uuid references private.staff_accounts(id) on delete cascade;
alter table private.teacher_sessions add column if not exists role text check (role in ('teacher', 'admin'));
create index if not exists idx_teacher_sessions_staff on private.teacher_sessions(staff_id);

-- ---------------------------------------------------------------------------------------------
-- 1. Neutralise what 050 seeded
-- ---------------------------------------------------------------------------------------------
do $$
declare v_off int; v_hashed int;
begin
  -- plaintext defaults must be caught BEFORE hashing destroys the evidence
  update private.staff_accounts
     set active = false
   where active and password_hash in ('admin123', 'teacher123', '1234', '123456', 'password', 'mif2026');
  get diagnostics v_off = row_count;

  update private.staff_accounts
     set password_hash = extensions.crypt(password_hash, extensions.gen_salt('bf', 10))
   where password_hash !~ '^\$2[aby]\$';
  get diagnostics v_hashed = row_count;

  if v_off > 0 or v_hashed > 0 then
    raise notice '060: deactivated % default-password account(s); hashed % stored password(s).', v_off, v_hashed;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Session helpers
-- ---------------------------------------------------------------------------------------------
create or replace function private.require_admin(p_token text) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
begin
  if p_token is null or not exists (
    select 1
      from private.teacher_sessions s
      join private.staff_accounts a on a.id = s.staff_id
     where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
       and s.expires_at > now()
       and s.role = 'admin' and a.role = 'admin' and a.active
  ) then
    perform private.fail('E_AUTH');
  end if;
end $$;

-- the staff account behind a session, or null for PIN sessions
create or replace function private.session_staff(p_token text) returns private.staff_accounts
language sql stable security definer set search_path = public, private, extensions as $$
  select a.*
    from private.teacher_sessions s
    join private.staff_accounts a on a.id = s.staff_id
   where s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and s.expires_at > now() and a.active
$$;

create or replace function private.valid_staff_password(p text) returns void
language plpgsql as $$
declare v_min int := private.param('staff_password_min_length', 10)::int;
begin
  if p is null or char_length(p) < v_min or char_length(p) > 128 then
    perform private.fail('E_VALIDATION', 'Password must be ' || v_min || ' to 128 characters.');
  end if;
end $$;

-- Owner-only: create or reset an admin from the SQL editor (runs as postgres; anon cannot reach private.*)
create or replace function private.bootstrap_admin(p_email text, p_password text, p_name text, p_name_ar text)
returns text language plpgsql security definer set search_path = public, private, extensions as $$
declare v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bootstrap_admin: invalid email'; end if;
  perform private.valid_staff_password(p_password);
  insert into private.staff_accounts (email, password_hash, role, name, name_ar, title, title_ar, assigned_courses, active)
  values (v_email, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), 'admin',
          btrim(p_name), coalesce(nullif(btrim(p_name_ar), ''), btrim(p_name)),
          'Administrator', 'المشرف', array['ALL'], true)
  on conflict (email) do update
     set password_hash = excluded.password_hash, role = 'admin', active = true,
         name = excluded.name, name_ar = excluded.name_ar;
  delete from private.teacher_sessions where staff_id = (select id from private.staff_accounts where email = v_email);
  return 'admin ready: ' || v_email;
end $$;
revoke all on function private.bootstrap_admin(text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. staff_login (same name and argument list as 050, so the existing client keeps its call)
-- ---------------------------------------------------------------------------------------------
create or replace function public.staff_login(p_email text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_acc   private.staff_accounts;
  v_scope text;
  v_mins  int;
  v_token text;
  v_max   int         := private.param('staff_login_max_failures', 5)::int;
  v_lock  numeric     := private.param('staff_lock_minutes', 5);
  v_exp   timestamptz := now() + private.param('teacher_session_hours', 8) * interval '1 hour';
begin
  if v_email = '' or char_length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'error', 'E_AUTH');
  end if;
  v_scope := 'staff:' || v_email;

  v_mins := private.throttle_check(v_scope);
  if v_mins > 0 then
    return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_mins::text);
  end if;

  select * into v_acc from private.staff_accounts where email = v_email and active;
  if found and extensions.crypt(coalesce(p_password, ''), v_acc.password_hash) = v_acc.password_hash then
    perform private.throttle_clear(v_scope);
    delete from private.teacher_sessions where expires_at < now();
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    insert into private.teacher_sessions (token_hash, expires_at, staff_id, role)
    values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_exp, v_acc.id, v_acc.role);
    return jsonb_build_object(
      'ok', true, 'token', v_token, 'expires_at', v_exp,
      'user', jsonb_build_object(
        'id', v_acc.id, 'email', v_acc.email, 'role', v_acc.role,
        'name', v_acc.name, 'name_ar', v_acc.name_ar,
        'title', v_acc.title, 'title_ar', v_acc.title_ar,
        'assigned_courses', v_acc.assigned_courses));
  end if;

  if not found then
    perform extensions.crypt(coalesce(p_password, ''), extensions.gen_salt('bf', 10));  -- equalise timing
    return jsonb_build_object('ok', false, 'error', 'E_AUTH');
  end if;

  v_mins := private.throttle_fail(v_scope, v_max, v_lock);
  if v_mins > 0 then
    return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_mins::text);
  end if;
  return jsonb_build_object('ok', false, 'error', 'E_AUTH');
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Staff management (admin role only)
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_list_staff(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, private, extensions as $$
begin
  perform private.require_admin(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id, 'email', a.email, 'role', a.role, 'name', a.name, 'name_ar', a.name_ar,
             'title', a.title, 'title_ar', a.title_ar, 'assigned_courses', a.assigned_courses,
             'active', a.active, 'created_at', a.created_at) order by a.created_at)
      from private.staff_accounts a), '[]'::jsonb);
end $$;

create or replace function public.admin_save_staff(p_token text, p_id uuid, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_row   private.staff_accounts;
  v_email text; v_role text; v_active boolean; v_courses text[]; v_pw text;
  v_id    uuid := p_id;
begin
  perform private.require_admin(p_token);
  if p_data is null or jsonb_typeof(p_data) <> 'object' then perform private.fail('E_VALIDATION', 'Missing data.'); end if;
  v_pw := nullif(p_data->>'password', '');

  if p_id is null then
    v_email := lower(btrim(coalesce(p_data->>'email', '')));
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then perform private.fail('E_VALIDATION', 'A valid email is required.'); end if;
    if exists (select 1 from private.staff_accounts where email = v_email) then perform private.fail('E_VALIDATION', 'That email is already in use.'); end if;
    v_role := coalesce(p_data->>'role', 'teacher');
    if v_role not in ('teacher', 'admin') then perform private.fail('E_VALIDATION', 'Role must be teacher or admin.'); end if;
    if btrim(coalesce(p_data->>'name', '')) = '' then perform private.fail('E_VALIDATION', 'Name is required.'); end if;
    perform private.valid_staff_password(v_pw);
    v_courses := coalesce(array(select jsonb_array_elements_text(p_data->'assigned_courses')), array['ALL']);
    insert into private.staff_accounts (email, password_hash, role, name, name_ar, title, title_ar, assigned_courses, active)
    values (v_email, extensions.crypt(v_pw, extensions.gen_salt('bf', 10)), v_role,
            btrim(p_data->>'name'), coalesce(nullif(btrim(p_data->>'name_ar'), ''), btrim(p_data->>'name')),
            coalesce(nullif(btrim(p_data->>'title'), ''), 'Instructor'),
            coalesce(nullif(btrim(p_data->>'title_ar'), ''), 'مدرس'),
            case when cardinality(v_courses) = 0 then array['ALL'] else v_courses end,
            coalesce((p_data->>'active')::boolean, true))
    returning id into v_id;
    return jsonb_build_object('ok', true, 'id', v_id);
  end if;

  select * into v_row from private.staff_accounts where id = p_id for update;
  if not found then perform private.fail('E_NOT_FOUND', 'Staff account not found.'); end if;

  v_role   := coalesce(p_data->>'role', v_row.role);
  v_active := coalesce((p_data->>'active')::boolean, v_row.active);
  if v_role not in ('teacher', 'admin') then perform private.fail('E_VALIDATION', 'Role must be teacher or admin.'); end if;
  if v_row.role = 'admin' and v_row.active and not (v_role = 'admin' and v_active)
     and not exists (select 1 from private.staff_accounts where role = 'admin' and active and id <> p_id) then
    perform private.fail('E_VALIDATION', 'There must be at least one active admin.');
  end if;
  if p_data ? 'assigned_courses' then
    v_courses := coalesce(array(select jsonb_array_elements_text(p_data->'assigned_courses')), array['ALL']);
    if cardinality(v_courses) = 0 then v_courses := array['ALL']; end if;
  else
    v_courses := v_row.assigned_courses;
  end if;
  if v_pw is not null then perform private.valid_staff_password(v_pw); end if;

  update private.staff_accounts
     set role = v_role, active = v_active, assigned_courses = v_courses,
         name    = coalesce(nullif(btrim(p_data->>'name'), ''), name),
         name_ar = coalesce(nullif(btrim(p_data->>'name_ar'), ''), name_ar),
         title   = coalesce(nullif(btrim(p_data->>'title'), ''), title),
         title_ar= coalesce(nullif(btrim(p_data->>'title_ar'), ''), title_ar),
         password_hash = case when v_pw is null then password_hash else extensions.crypt(v_pw, extensions.gen_salt('bf', 10)) end
   where id = p_id;

  -- a password reset, a role change or a deactivation ends that person's sessions
  if v_pw is not null or v_role <> v_row.role or not v_active then
    delete from private.teacher_sessions where staff_id = p_id;
  end if;
  return jsonb_build_object('ok', true, 'id', p_id);
end $$;

create or replace function public.staff_change_password(p_token text, p_old text, p_new text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_acc private.staff_accounts; v_scope text; v_mins int;
  v_max int     := private.param('staff_login_max_failures', 5)::int;
  v_lock numeric := private.param('staff_lock_minutes', 5);
begin
  v_acc := private.session_staff(p_token);
  if v_acc.id is null then perform private.fail('E_AUTH'); end if;   -- PIN sessions have no password to change
  v_scope := 'staff:' || v_acc.email;

  v_mins := private.throttle_check(v_scope);
  if v_mins > 0 then return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_mins::text); end if;

  perform private.valid_staff_password(p_new);
  if extensions.crypt(coalesce(p_old, ''), v_acc.password_hash) <> v_acc.password_hash then
    v_mins := private.throttle_fail(v_scope, v_max, v_lock);
    if v_mins > 0 then return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_mins::text); end if;
    return jsonb_build_object('ok', false, 'error', 'E_AUTH', 'detail', 'current_password');
  end if;

  perform private.throttle_clear(v_scope);
  update private.staff_accounts set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)) where id = v_acc.id;
  delete from private.teacher_sessions
   where staff_id = v_acc.id and token_hash <> encode(extensions.digest(p_token, 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Audio: drop the unauthenticated and spoofable RPCs, re-create the staff ones behind a session
-- ---------------------------------------------------------------------------------------------
drop function if exists public.submit_audio_recitation(text, text, uuid, text, text, text, text, int);
drop function if exists public.submit_audio_recitation(text, text, uuid, uuid, text, text, text, int);
drop function if exists public.admin_list_audio_submissions(uuid);
drop function if exists public.admin_grade_audio(uuid, boolean, numeric, text, text);

do $$ begin
  if to_regclass('private.audio_submissions') is null then
    create table private.audio_submissions (
      id uuid primary key default gen_random_uuid(),
      lesson_id text not null, lesson_title text not null,
      course_id uuid not null references public.courses(id) on delete cascade,
      student_id text references public.students(id) on delete set null,
      student_name text not null, student_name_ar text,
      audio_url text not null, duration_seconds int default 0,
      status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
      score numeric(5,2), max_score numeric(5,2) default 20.00,
      teacher_feedback text, graded_by text, graded_at timestamptz,
      created_at timestamptz not null default now());
    alter table private.audio_submissions enable row level security;
    revoke all on private.audio_submissions from public, anon, authenticated;
  end if;
end $$;

create or replace function public.admin_list_audio_submissions(p_token text, p_course_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'lesson_id', s.lesson_id, 'lesson_title_ar', s.lesson_title, 'course_id', s.course_id,
      'student_id', s.student_id, 'student_name', s.student_name, 'student_name_ar', s.student_name_ar,
      'audio_data_url', s.audio_url, 'duration_seconds', s.duration_seconds, 'status', s.status,
      'score', s.score, 'max_score', s.max_score, 'teacher_feedback', s.teacher_feedback,
      'graded_by', s.graded_by, 'graded_at', s.graded_at, 'submitted_at', s.created_at) order by s.created_at desc)
    from private.audio_submissions s
   where p_course_id is null or s.course_id = p_course_id), '[]'::jsonb);
end $$;

create or replace function public.admin_grade_audio(
  p_token text, p_submission_id uuid, p_approved boolean, p_score numeric, p_feedback text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare v_sub private.audio_submissions; v_by text;
begin
  perform private.require_teacher(p_token);
  select * into v_sub from private.audio_submissions where id = p_submission_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'E_NOT_FOUND'); end if;
  if coalesce(p_approved, false) and (p_score is null or p_score < 0 or p_score > coalesce(v_sub.max_score, 20)) then
    perform private.fail('E_VALIDATION', 'Score must be between 0 and ' || coalesce(v_sub.max_score, 20) || '.');
  end if;
  if char_length(coalesce(p_feedback, '')) > 2000 then perform private.fail('E_VALIDATION', 'Feedback is too long.'); end if;
  v_by := coalesce((private.session_staff(p_token)).name, 'Teacher');   -- from the session, never from the client
  update private.audio_submissions
     set status = case when p_approved then 'approved' else 'rejected' end,
         score = case when p_approved then p_score else 0 end,
         teacher_feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
         graded_by = v_by, graded_at = now()
   where id = p_submission_id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Grants: explicit, never implicit (005 removed the defaults)
-- ---------------------------------------------------------------------------------------------
revoke all on function public.staff_login(text, text)                                     from public;
revoke all on function public.admin_list_staff(text)                                      from public;
revoke all on function public.admin_save_staff(text, uuid, jsonb)                         from public;
revoke all on function public.staff_change_password(text, text, text)                     from public;
revoke all on function public.admin_list_audio_submissions(text, uuid)                    from public;
revoke all on function public.admin_grade_audio(text, uuid, boolean, numeric, text)       from public;
revoke all on function private.require_admin(text)                                        from public, anon, authenticated;
revoke all on function private.session_staff(text)                                        from public, anon, authenticated;
revoke all on function private.valid_staff_password(text)                                 from public, anon, authenticated;

grant execute on function public.staff_login(text, text)                                  to anon;
grant execute on function public.admin_list_staff(text)                                   to anon;
grant execute on function public.admin_save_staff(text, uuid, jsonb)                      to anon;
grant execute on function public.staff_change_password(text, text, text)                  to anon;
grant execute on function public.admin_list_audio_submissions(text, uuid)                 to anon;
grant execute on function public.admin_grade_audio(text, uuid, boolean, numeric, text)    to anon;

-- ---------------------------------------------------------------------------------------------
-- 7. Post-conditions (read back from the catalog; any failure rolls the whole file back)
-- ---------------------------------------------------------------------------------------------
do $$
declare v_bad text;
begin
  assert not exists (select 1 from private.staff_accounts where password_hash !~ '^\$2[aby]\$'), '060: a staff password is still stored unhashed';
  assert not exists (select 1 from private.staff_accounts where active and email in
    ('admin@almiftahu.edu', 'ibrahim@almiftahu.edu', 'usman@almiftahu.edu')
    and (extensions.crypt('admin123', password_hash) = password_hash or extensions.crypt('teacher123', password_hash) = password_hash)),
    '060: a seeded account with a known password is still active';
  assert position('teacher123' in pg_get_functiondef('public.staff_login(text, text)'::regprocedure)) = 0, '060: staff_login still contains the back door';
  assert to_regprocedure('public.submit_audio_recitation(text, text, uuid, text, text, text, text, int)') is null, '060: spoofable submit RPC still exists';
  assert to_regprocedure('public.admin_list_audio_submissions(uuid)') is null, '060: unauthenticated audio list still exists';
  assert to_regprocedure('public.admin_grade_audio(uuid, boolean, numeric, text, text)') is null, '060: unauthenticated audio grade still exists';
  assert has_function_privilege('anon', 'public.staff_login(text, text)', 'execute'), '060: anon lost staff_login';
  assert not has_function_privilege('anon', 'private.bootstrap_admin(text, text, text, text)', 'execute'), '060: anon can run bootstrap_admin';
  -- every public function anon can run must either be one of the original 16, a Phase 1-4 RPC, or one of ours
  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname !~ '^(admin_|teacher_|exam_|staff_|get_certificate$|verify_certificate$)';
  assert v_bad is null, '060: unexpected anon-executable function(s): ' || coalesce(v_bad, '');
  raise notice '060 applied and verified. Staff accounts are inactive until you run private.bootstrap_admin(...).';
end $$;
