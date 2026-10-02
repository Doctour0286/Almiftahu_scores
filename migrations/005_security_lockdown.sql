-- 005_security_lockdown.sql  (Phase 0, task 0.7)
-- PRD §8.3, with the v3.4/v3.5 policy fixes already in 004.
--
--   *** DO NOT RUN BEFORE THE NEW CLIENT IS DEPLOYED (cut-over runbook step 7). ***
--   The live (old) client writes `students` / `app_settings` directly and reads the plaintext PIN.
--   After this migration it can do neither. Order is mandatory: 000-004, deploy new client, THEN 005.
--
-- What it does
--   1. Tables:     anon/authenticated lose everything on public tables; anon gets SELECT on exactly
--                  courses, students, enrollments, enrollment_results. RLS on (read policies from 004).
--                  app_settings: RLS on, no policy, no grant.
--   2. Private:    RLS on every private table; every grant on private objects removed.
--   3. Functions:  EXECUTE removed from everyone, then granted to anon for exactly the 16 Phase-0 RPCs
--                  (4 auth + 12 admin). Admin RPCs are safe to expose: each starts with require_teacher().
--   4. Defaults:   future public tables/sequences/functions are no longer auto-granted to anon/authenticated.
--   5. Secrets:    deletes the plaintext `teacher_pin` row (the bcrypt hash in private.secrets stays).
--   6. Verifies:   preflight (refuses to run if 004 / 002 / 003 are missing) and post-conditions read back
--                  from the catalog. Any failure RAISES, which rolls the whole migration back.
--
-- One transaction. Idempotent: safe to run twice.
-- New RPCs in later phases must add their own `grant execute ... to anon` in the migration that
-- creates them (the blanket revoke below does not apply to functions created afterwards, but the
-- default-privilege change in step 4 means they start with NO grant for anon).

begin;

-- ---------- 0. preflight: refuse to lock down an incomplete setup ----------
do $$
declare
  v_missing text;
begin
  -- 004 policies must exist, otherwise enabling RLS would hide every row from the public portal.
  select string_agg(p, ', ') into v_missing
  from unnest(array['read_courses','read_students','read_enroll','read_results']) p
  where not exists (select 1 from pg_policies where schemaname = 'public' and policyname = p);
  if v_missing is not null then
    raise exception '005 preflight: read policies missing (%). Run 004_public_access.sql first.', v_missing;
  end if;

  -- The PIN hash must exist, otherwise deleting the plaintext row would lock every teacher out.
  if not exists (select 1 from private.secrets where key = 'teacher_pin_hash') then
    raise exception '005 preflight: private.secrets has no teacher_pin_hash. Run 002_auth.sql first.';
  end if;

  -- All 16 RPCs must exist, otherwise the grants below would fail half way.
  select string_agg(f, ', ') into v_missing
  from unnest(array[
    'public.teacher_login(text)', 'public.teacher_logout(text)', 'public.teacher_ping(text)',
    'public.teacher_change_pin(text,text,text)',
    'public.admin_save_course(text,jsonb,boolean,uuid,boolean)', 'public.admin_set_course_status(text,uuid,text)',
    'public.admin_list_roster(text,uuid)', 'public.admin_list_students_all(text)',
    'public.admin_add_student(text,uuid,text,text)', 'public.admin_enroll_student(text,uuid,text)',
    'public.admin_bulk_seed(text,uuid,text)', 'public.admin_update_student(text,text,text,text)',
    'public.admin_set_active(text,uuid,boolean)', 'public.admin_delete_student(text,text)',
    'public.admin_save_day(text,uuid,integer,integer,integer)', 'public.admin_set_exam_approval(text,uuid,boolean)'
  ]) f
  where to_regprocedure(f) is null;
  if v_missing is not null then
    raise exception '005 preflight: RPCs missing (%). Run 002 and 003 first.', v_missing;
  end if;
end $$;

-- ---------- 1. public tables ----------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.courses, public.students, public.enrollments, public.enrollment_results to anon;

alter table public.courses            enable row level security;
alter table public.students           enable row level security;
alter table public.enrollments        enable row level security;
alter table public.enrollment_results enable row level security;
alter table public.app_settings       enable row level security;   -- no policy -> no public access

-- Any other table that happens to exist in public (leftovers, extension tables) is locked too:
-- RLS on + no policy + no grant = invisible to the public key.
do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity loop
    raise notice 'locking unexpected public table: %', r.relname;
    execute format('alter table public.%I enable row level security', r.relname);
  end loop;
end $$;

-- ---------- 2. private schema: defense in depth ----------
revoke all     on schema   private                 from public, anon, authenticated;
revoke all     on all tables    in schema private  from public, anon, authenticated;
revoke all     on all sequences in schema private  from public, anon, authenticated;
revoke execute on all functions in schema private  from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'private' loop
    execute format('alter table private.%I enable row level security', r.tablename);
  end loop;
end $$;

-- ---------- 3. functions: nothing executable by default, grant the 16 explicitly ----------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.teacher_login(text)                                         to anon;
grant execute on function public.teacher_logout(text)                                        to anon;
grant execute on function public.teacher_ping(text)                                          to anon;
grant execute on function public.teacher_change_pin(text, text, text)                        to anon;
grant execute on function public.admin_save_course(text, jsonb, boolean, uuid, boolean)      to anon;
grant execute on function public.admin_set_course_status(text, uuid, text)                   to anon;
grant execute on function public.admin_list_roster(text, uuid)                               to anon;
grant execute on function public.admin_list_students_all(text)                               to anon;
grant execute on function public.admin_add_student(text, uuid, text, text)                   to anon;
grant execute on function public.admin_enroll_student(text, uuid, text)                      to anon;
grant execute on function public.admin_bulk_seed(text, uuid, text)                           to anon;
grant execute on function public.admin_update_student(text, text, text, text)                to anon;
grant execute on function public.admin_set_active(text, uuid, boolean)                       to anon;
grant execute on function public.admin_delete_student(text, text)                            to anon;
grant execute on function public.admin_save_day(text, uuid, int, int, int)                   to anon;
grant execute on function public.admin_set_exam_approval(text, uuid, boolean)                to anon;

-- ---------- 4. default privileges: future objects start with no anon/authenticated grant ----------
-- Supabase installs schema-level default ACLs for the roles that create objects (postgres, and
-- supabase_admin for extensions). Revoke them for each role we are allowed to alter; skip the rest.
do $$
declare r text;
begin
  foreach r in array array[current_user::text, 'postgres', 'supabase_admin'] loop
    begin
      execute format('alter default privileges for role %I in schema public revoke all on tables    from anon, authenticated', r);
      execute format('alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated', r);
      execute format('alter default privileges for role %I in schema public revoke execute on functions from public, anon, authenticated', r);
    exception when others then
      raise notice 'default privileges for role %: skipped (%)', r, sqlerrm;
    end;
  end loop;
end $$;

-- ---------- 5. plaintext PIN ----------
delete from public.app_settings where key = 'teacher_pin';

-- ---------- 6. post-conditions: read the result back from the catalog ----------
do $$
declare
  v_bad text;
  v_expected_fn text[] := array[
    'teacher_login','teacher_logout','teacher_ping','teacher_change_pin',
    'admin_save_course','admin_set_course_status','admin_list_roster','admin_list_students_all',
    'admin_add_student','admin_enroll_student','admin_bulk_seed','admin_update_student',
    'admin_set_active','admin_delete_student','admin_save_day','admin_set_exam_approval'];
  v_read_tables text[] := array['courses','students','enrollments','enrollment_results'];
begin
  -- a) anon: SELECT on exactly the four public read tables, nothing else, on every public table/view
  select string_agg(c.relname || ':' || p, ', ') into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
  where c.relkind in ('r','p','v','m','f')
    and has_table_privilege('anon', c.oid, p)
    and not (p = 'SELECT' and c.relname = any (v_read_tables));
  if v_bad is not null then raise exception '005 post-check: anon still has table privileges: %', v_bad; end if;

  select string_agg(t, ', ') into v_bad from unnest(v_read_tables) t
  where not has_table_privilege('anon', 'public.' || t, 'SELECT');
  if v_bad is not null then raise exception '005 post-check: anon lost SELECT on: %', v_bad; end if;

  -- b) authenticated: no table privilege at all on public tables
  select string_agg(c.relname || ':' || p, ', ') into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
  where c.relkind in ('r','p','v','m','f') and has_table_privilege('authenticated', c.oid, p);
  if v_bad is not null then raise exception '005 post-check: authenticated still has table privileges: %', v_bad; end if;

  -- c) RLS enabled on every table in public and private
  select string_agg(n.nspname || '.' || c.relname, ', ') into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','private') and c.relkind in ('r','p') and not c.relrowsecurity;
  if v_bad is not null then raise exception '005 post-check: RLS is off on: %', v_bad; end if;

  -- d) EXECUTE: anon may run exactly the 16 RPCs in public (has_function_privilege includes PUBLIC grants)
  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where p.prokind in ('f','p')
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname <> all (v_expected_fn);
  if v_bad is not null then raise exception '005 post-check: anon can still execute: %', v_bad; end if;

  select string_agg(f, ', ') into v_bad from unnest(v_expected_fn) f
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
                    where p.proname = f and has_function_privilege('anon', p.oid, 'EXECUTE'));
  if v_bad is not null then raise exception '005 post-check: RPC not callable by anon: %', v_bad; end if;

  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where p.prokind in ('f','p') and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v_bad is not null then raise exception '005 post-check: authenticated can execute public functions: %', v_bad; end if;

  -- e) private schema unreachable
  if has_schema_privilege('anon', 'private', 'USAGE') or has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception '005 post-check: anon/authenticated have USAGE on schema private';
  end if;
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'private'
  where has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v_bad is not null then raise exception '005 post-check: private functions executable: %', v_bad; end if;

  -- f) the PIN is gone from every readable place (AC-0.3)
  if exists (select 1 from public.app_settings where key = 'teacher_pin') then
    raise exception '005 post-check: plaintext teacher_pin row still present';
  end if;

  raise notice '005 applied and verified: anon can read 4 tables, run 16 RPCs, nothing else; plaintext PIN removed.';
end $$;

commit;
