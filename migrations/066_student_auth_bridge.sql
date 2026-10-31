-- 066_student_auth_bridge.sql  (PRD v4 D-74: students sign in with email + password via Supabase Auth)
-- Additive. The old login-code + PIN functions (062) stay until the owner retires them.
-- Why a bridge: Supabase Auth already does verified email change, password change and password reset. It proves WHO the student is (a JWT).
-- This file turns that JWT into the same opaque session token every existing student_* RPC already uses, so none of them change.
--   private.student_auth            : student_id <-> auth.users id (+ must_change flag for the forced first-login password change)
--   public.student_session()        : authenticated only. JWT -> opaque session token. Anon (no/garbage JWT) gets E_AUTH.
--   public.student_password_changed(): authenticated only. Clears must_change once the student has set their own password.
--   public.service_link_student / service_student_link : service_role ONLY (called by the issue-student Edge Function).
--   public.admin_list_student_accounts : staff, shows who has an account and who still has the issued password.
create table if not exists private.student_auth (
  student_id text primary key references public.students(id) on delete cascade,
  auth_user_id uuid not null unique,
  must_change boolean not null default true,
  linked_at timestamptz not null default now()
);
alter table private.student_auth enable row level security;
revoke all on private.student_auth from public, anon, authenticated;

create or replace function public.student_session() returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_uid uuid := auth.uid(); v_map private.student_auth; v_st public.students; v_tok text;
        v_exp timestamptz := now() + private.param('student_session_hours', 12) * interval '1 hour';
begin
  if v_uid is null then perform private.fail('E_AUTH'); end if;
  select * into v_map from private.student_auth where auth_user_id = v_uid;
  if not found then perform private.fail('E_AUTH'); end if;               -- a valid login that is not a student (e.g. staff) gets nothing
  select * into v_st from public.students where id = v_map.student_id;
  if not exists (select 1 from public.enrollments e where e.student_id = v_st.id and e.active) then perform private.fail('E_AUTH'); end if;   -- inactive students cannot start sessions
  delete from private.student_sessions where expires_at < now();
  v_tok := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.student_sessions (token_hash, student_id, expires_at) values (encode(extensions.digest(v_tok, 'sha256'), 'hex'), v_st.id, v_exp);
  return jsonb_build_object('ok', true, 'token', v_tok, 'expires_at', v_exp,
    'student', jsonb_build_object('id', v_st.id, 'name', v_st.name, 'name_ar', v_st.name_ar, 'must_change', v_map.must_change));
end $$;

create or replace function public.student_password_changed() returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
begin
  if auth.uid() is null then perform private.fail('E_AUTH'); end if;
  update private.student_auth set must_change = false where auth_user_id = auth.uid();
  if not found then perform private.fail('E_AUTH'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.service_student_link(p_student_id text) returns jsonb
language sql stable security definer set search_path = public, private, extensions as $$
  select jsonb_build_object('student_exists', exists (select 1 from public.students where id = p_student_id),
                            'auth_user_id', (select auth_user_id from private.student_auth where student_id = p_student_id)) $$;

create or replace function public.service_link_student(p_student_id text, p_auth_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
begin
  if not exists (select 1 from public.students where id = p_student_id) then perform private.fail('E_NOT_FOUND', 'Student not found.'); end if;
  insert into private.student_auth (student_id, auth_user_id, must_change) values (p_student_id, p_auth_user_id, true)
  on conflict (student_id) do update set auth_user_id = excluded.auth_user_id, must_change = true, linked_at = now();
  delete from private.student_sessions where student_id = p_student_id;     -- a reset ends every open session
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_list_student_accounts(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object('student_id', a.student_id, 'must_change', a.must_change, 'linked_at', a.linked_at)) from private.student_auth a), '[]'::jsonb);
end $$;


-- student_me joined the PIN table (062), which email + password students do not have. Same output, but the forced-change flag now comes from whichever login the student uses.
create or replace function public.student_me(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, private, extensions as $$
declare v_sid text := private.require_student(p_token);
begin
  return jsonb_build_object(
    'student', (select jsonb_build_object('id', s.id, 'name', s.name, 'name_ar', s.name_ar,
                       'must_change', coalesce((select a.must_change from private.student_auth a where a.student_id = s.id), (select c.must_change from private.student_credentials c where c.student_id = s.id), false))
                  from public.students s where s.id = v_sid),
    'enrollments', coalesce((select jsonb_agg(jsonb_build_object(
        'enrollment_id', e.id, 'course_id', co.id, 'course_code', co.code, 'course_name', co.name, 'course_name_ar', co.name_ar,
        'days', e.days, 'bonus_units', e.bonus_units) order by co.name)
      from public.enrollments e join public.courses co on co.id = e.course_id
     where e.student_id = v_sid and e.active), '[]'::jsonb));
end $$;
revoke all on function public.student_me(text) from public; grant execute on function public.student_me(text) to anon;

revoke all on function public.student_session(), public.student_password_changed(), public.service_student_link(text), public.service_link_student(text, uuid), public.admin_list_student_accounts(text) from public, anon, authenticated;
grant execute on function public.student_session(), public.student_password_changed() to authenticated;
grant execute on function public.service_student_link(text), public.service_link_student(text, uuid) to service_role;
grant execute on function public.admin_list_student_accounts(text) to anon;
do $$ begin
  assert not has_function_privilege('anon', 'public.student_session()', 'execute'), '066: anon can start a student session';
  assert has_function_privilege('authenticated', 'public.student_session()', 'execute'), '066: authenticated cannot call student_session';
  assert not has_function_privilege('anon', 'public.service_link_student(text, uuid)', 'execute') and not has_function_privilege('authenticated', 'public.service_link_student(text, uuid)', 'execute'), '066: service_link_student is callable by clients';
  assert not has_table_privilege('anon', 'private.student_auth', 'select'), '066: anon can read the account map';
  raise notice '066 applied and verified: student email + password bridge ready.';
end $$;
