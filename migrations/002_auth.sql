-- 002_auth.sql  (Phase 0, task 0.1)
-- Server-verified teacher authentication (FR-A1..A8).
--
-- DESIGN NOTES (deviations from the PRD reference SQL, both on purpose):
--  1. Failure paths that must PERSIST state (wrong PIN -> failure counter) RETURN
--     {ok:false, error, detail} instead of raising. A raised exception rolls back the whole
--     RPC, including the counter update, so a raising version never locks anyone out.
--     Client contract (api.js): if result.ok === false, throw ApiError(result.error, result.detail).
--     Genuine errors that write nothing (E_AUTH on a bad admin token, E_VALIDATION) still raise.
--  2. The plaintext PIN row is HASHED here but NOT deleted here. The live (old) client reads that
--     row and falls back to "2026" when it is missing, so deleting it at runbook step 3 would
--     silently weaken the live app until the new client ships. Deletion happens in 005 (lockdown).

create table if not exists private.secrets (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
create table if not exists private.teacher_sessions (
  token_hash text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists private.auth_throttle (
  scope        text primary key,
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

-- Hash the existing PIN (cost 10). Skip empty values: the old app treats '' as "use 2026".
insert into private.secrets (key, value)
select 'teacher_pin_hash', extensions.crypt(value, extensions.gen_salt('bf', 10))
from public.app_settings
where key = 'teacher_pin' and coalesce(value, '') <> ''
on conflict (key) do nothing;

-- No usable PIN row existed: the old app used its built-in fallback "2026". Mirror that, and
-- tell the owner to rotate it at cut-over (O-6).
do $$ begin
  if not exists (select 1 from private.secrets where key = 'teacher_pin_hash') then
    insert into private.secrets (key, value)
    values ('teacher_pin_hash', extensions.crypt('2026', extensions.gen_salt('bf', 10)));
    raise notice 'No teacher_pin row found: hashed the legacy fallback "2026". CHANGE THE PIN at cut-over.';
  end if;
end $$;

-- ---------- throttle helpers (reused by exam code checks in Phase 2) ----------
-- minutes remaining if locked, else 0
create or replace function private.throttle_check(p_scope text) returns int
language sql stable as $$
  select coalesce((select ceil(extract(epoch from locked_until - now()) / 60)::int
                   from private.auth_throttle
                   where scope = p_scope and locked_until > now()), 0)
$$;

-- records one failure; returns lock minutes if THIS failure triggered a lock, else 0
create or replace function private.throttle_fail(p_scope text, p_max int, p_lock_minutes numeric)
returns int language plpgsql as $$
declare v_count int;
begin
  insert into private.auth_throttle(scope, failed_count) values (p_scope, 1)
  on conflict (scope) do update
    set failed_count = case when private.auth_throttle.locked_until is not null
                                 and private.auth_throttle.locked_until <= now()
                            then 1 else private.auth_throttle.failed_count + 1 end,
        locked_until = case when private.auth_throttle.locked_until <= now() then null
                            else private.auth_throttle.locked_until end,
        updated_at = now()
  returning failed_count into v_count;
  if v_count >= p_max then
    update private.auth_throttle
       set failed_count = 0, locked_until = now() + p_lock_minutes * interval '1 minute'
     where scope = p_scope;
    return ceil(p_lock_minutes)::int;
  end if;
  return 0;
end $$;

create or replace function private.throttle_clear(p_scope text) returns void
language sql as $$ delete from private.auth_throttle where scope = p_scope $$;

-- ---------- session check used by every admin_* RPC ----------
create or replace function private.require_teacher(p_token text) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
begin
  if p_token is null or not exists (
    select 1 from private.teacher_sessions
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and expires_at > now()
  ) then
    perform private.fail('E_AUTH');
  end if;
end $$;

-- ---------- public RPCs ----------
create or replace function public.teacher_login(p_pin text) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_hash text; v_token text; v_mins int;
  v_max  int     := private.param('teacher_login_max_failures', 5)::int;
  v_lock numeric := private.param('teacher_lock_minutes', 5);
  v_exp  timestamptz := now() + private.param('teacher_session_hours', 8) * interval '1 hour';
begin
  v_mins := private.throttle_check('teacher');
  if v_mins > 0 then
    return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_mins::text);
  end if;

  select value into v_hash from private.secrets where key = 'teacher_pin_hash';
  if v_hash is not null and extensions.crypt(coalesce(p_pin, ''), v_hash) = v_hash then
    perform private.throttle_clear('teacher');
    delete from private.teacher_sessions where expires_at < now();
    v_token := encode(extensions.gen_random_bytes(32), 'hex');           -- 256 bits
    insert into private.teacher_sessions(token_hash, expires_at)
      values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_exp);
    return jsonb_build_object('ok', true, 'token', v_token, 'expires_at', v_exp);
  end if;

  v_mins := private.throttle_fail('teacher', v_max, v_lock);
  if v_mins > 0 then
    return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_mins::text);
  end if;
  return jsonb_build_object('ok', false, 'error', 'E_AUTH');
end $$;

create or replace function public.teacher_logout(p_token text) returns void
language sql security definer set search_path = public, private, extensions as $$
  delete from private.teacher_sessions
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

create or replace function public.teacher_ping(p_token text) returns boolean
language sql stable security definer set search_path = public, private, extensions as $$
  select p_token is not null and exists (
    select 1 from private.teacher_sessions
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and expires_at > now())
$$;

-- Wrong current PIN returns {ok:false,error:'E_AUTH',detail:'current_pin'} (persisting the throttle).
-- A missing/expired token raises E_AUTH (nothing to persist).
create or replace function public.teacher_change_pin(p_token text, p_old text, p_new text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_hash text; v_mins int;
  v_max  int     := private.param('teacher_login_max_failures', 5)::int;
  v_lock numeric := private.param('teacher_lock_minutes', 5);
  v_min_len int  := private.param('pin_min_length', 4)::int;
begin
  perform private.require_teacher(p_token);

  v_mins := private.throttle_check('teacher');
  if v_mins > 0 then
    return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_mins::text);
  end if;

  if p_new is null or char_length(btrim(p_new)) < v_min_len then
    perform private.fail('E_VALIDATION', 'PIN must be at least ' || v_min_len || ' characters.');
  end if;

  select value into v_hash from private.secrets where key = 'teacher_pin_hash';
  if v_hash is null or extensions.crypt(coalesce(p_old, ''), v_hash) <> v_hash then
    v_mins := private.throttle_fail('teacher', v_max, v_lock);
    if v_mins > 0 then
      return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_mins::text);
    end if;
    return jsonb_build_object('ok', false, 'error', 'E_AUTH', 'detail', 'current_pin');
  end if;

  perform private.throttle_clear('teacher');
  update private.secrets
     set value = extensions.crypt(btrim(p_new), extensions.gen_salt('bf', 10)), updated_at = now()
   where key = 'teacher_pin_hash';
  -- invalidate every OTHER session
  delete from private.teacher_sessions
   where token_hash <> encode(extensions.digest(p_token, 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

-- Only these four are callable through the API. (005 re-grants them after its blanket revoke.)
revoke all on function public.teacher_login(text)                  from public;
revoke all on function public.teacher_logout(text)                 from public;
revoke all on function public.teacher_ping(text)                   from public;
revoke all on function public.teacher_change_pin(text, text, text) from public;
grant execute on function public.teacher_login(text)                  to anon;
grant execute on function public.teacher_logout(text)                 to anon;
grant execute on function public.teacher_ping(text)                   to anon;
grant execute on function public.teacher_change_pin(text, text, text) to anon;
