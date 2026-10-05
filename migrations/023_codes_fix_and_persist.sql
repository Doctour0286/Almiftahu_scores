-- 023_codes_fix_and_persist.sql (Phase 2 fix)
-- Safe to run on production: additive, idempotent, one transaction. Run AFTER 020, 021, 022.
--
-- WHAT THIS FIXES / CHANGES
--  1. BUG: 021 and 022 read and wrote a table `private.throttle` that no migration ever created
--     (002 created `private.auth_throttle` plus throttle_check/throttle_fail/throttle_clear). Every student
--     code check failed with: relation "private.throttle" does not exist. The student check and the
--     teacher's "Unlock" button now use the 002 throttle helpers.
--  2. SIMPLER CODES (owner request): a code is now 6 digits (for example 483921) instead of 8 letters and
--     digits. Length comes from system parameter `code_length` (default 6, allowed 4..10). Safety is kept by
--     the per-student lockout: `code_max_failures` (default 5) wrong tries lock that student for
--     `code_lock_minutes` (default 10). Codes issued before this migration (8 characters) keep working.
--  3. CODES STAY VISIBLE (owner request, amends D-11 "shown once"): the code is now also stored readable in
--     private.exam_codes.code_plain, so the teacher can see it in the list until it is regenerated or revoked.
--     The table has RLS on and no grants: only the teacher RPCs below can read it. A revoked code's readable
--     copy is erased. The bcrypt hash is still what students are checked against. Codes issued before this
--     migration exist only as hashes and cannot be shown: use "New Code" for those students.
--  4. NEW RPC admin_list_codes(token, course) -> [{enrollment_id, code, created_at}] for active codes.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Readable copy of the code (teacher-only table: RLS on, no grants, see 020)
-- ---------------------------------------------------------------------------------------------
alter table private.exam_codes add column if not exists code_plain text;

-- ---------------------------------------------------------------------------------------------
-- 2. Code generator: N random digits (cryptographic randomness, no modulo bias)
-- ---------------------------------------------------------------------------------------------
create or replace function private.gen_exam_code() returns text
language plpgsql volatile set search_path = public, private, extensions as $$
declare
  v_len int := greatest(4, least(10, private.param('code_length', 6)::int));
  v_res text := '';
  v_b int;
begin
  while length(v_res) < v_len loop
    v_b := get_byte(extensions.gen_random_bytes(1), 0);
    if v_b < 250 then v_res := v_res || (v_b % 10)::text; end if;   -- 250 = 25 * 10: every digit equally likely
  end loop;
  return v_res;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Student verification on the real throttle table (scope 'enr:<enrollment id>')
-- ---------------------------------------------------------------------------------------------
create or replace function private.verify_student_code(p_enrollment_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_scope  text := 'enr:' || coalesce(p_enrollment_id::text, '');
  v_max    int     := greatest(1, private.param('code_max_failures', 5)::int);
  v_lock   numeric := greatest(1, private.param('code_lock_minutes', 10));
  v_wait   int;
  v_norm   text;
  v_hash   text;
  v_locked int;
begin
  -- An id that is not an enrollment is just a wrong code (and leaves no throttle row behind).
  if p_enrollment_id is null or not exists (select 1 from public.enrollments where id = p_enrollment_id) then
    return jsonb_build_object('ok', false, 'error', 'E_AUTH');
  end if;

  v_wait := private.throttle_check(v_scope);
  if v_wait > 0 then
    return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_wait::text);
  end if;

  -- Normalize: drop spaces and hyphens, upper-case (old 8-character codes keep working).
  v_norm := upper(regexp_replace(coalesce(p_code, ''), '[\s-]+', '', 'g'));
  if v_norm = '' then
    return jsonb_build_object('ok', false, 'error', 'E_AUTH');
  end if;

  select code_hash into v_hash from private.exam_codes
   where enrollment_id = p_enrollment_id and status = 'active';

  if not found or extensions.crypt(v_norm, v_hash) <> v_hash then
    v_locked := private.throttle_fail(v_scope, v_max, v_lock);   -- persists: this function RETURNS, it never raises
    if v_locked > 0 then
      return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_locked::text);
    end if;
    return jsonb_build_object('ok', false, 'error', 'E_AUTH');
  end if;

  perform private.throttle_clear(v_scope);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Teacher RPCs: generate / bulk / revoke store the readable code; unlock uses the real table
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_generate_code(p_token text, p_enrollment_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_enr public.enrollments;
  v_course public.courses;
  v_res public.enrollment_results;
  v_code text;
begin
  perform private.require_teacher(p_token);

  select * into v_enr from public.enrollments where id = p_enrollment_id;
  if not found then perform private.fail('E_NOT_FOUND', 'Enrollment not found.'); end if;

  select * into v_course from public.courses where id = v_enr.course_id;
  if not found or not v_course.exam_live then
    perform private.fail('E_VALIDATION', 'No live exam exists for this course.');
  end if;

  select * into v_res from public.enrollment_results where enrollment_id = p_enrollment_id;
  if v_res.status = 'not_eligible' then
    perform private.fail('E_NOT_ELIGIBLE', 'This student is not yet eligible to sit the exam.');
  end if;

  -- Revoke any active code (and erase its readable copy)
  update private.exam_codes set status = 'revoked', code_plain = null
   where enrollment_id = p_enrollment_id and status = 'active';

  v_code := private.gen_exam_code();
  insert into private.exam_codes (enrollment_id, code_hash, code_plain, status)
  values (p_enrollment_id, extensions.crypt(v_code, extensions.gen_salt('bf', 8)), v_code, 'active');

  return jsonb_build_object('code', v_code);
end $$;

create or replace function public.admin_generate_codes_bulk(p_token text, p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_course public.courses;
  r record;
  v_code text;
  v_out jsonb := '[]'::jsonb;
begin
  perform private.require_teacher(p_token);

  select * into v_course from public.courses where id = p_course_id;
  if not found or not v_course.exam_live then
    perform private.fail('E_VALIDATION', 'No live exam exists for this course.');
  end if;

  for r in
    select e.id as enrollment_id, e.sn, s.name, s.name_ar
    from public.enrollments e
    join public.students s on s.id = e.student_id
    join public.enrollment_results er on er.enrollment_id = e.id
    where e.course_id = p_course_id
      and e.active = true
      and er.status in ('eligible', 'not_started')
      and not exists (select 1 from private.exam_codes ec where ec.enrollment_id = e.id and ec.status = 'active')
    order by e.sn
    limit 40
  loop
    v_code := private.gen_exam_code();
    insert into private.exam_codes (enrollment_id, code_hash, code_plain, status)
    values (r.enrollment_id, extensions.crypt(v_code, extensions.gen_salt('bf', 8)), v_code, 'active');

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'enrollment_id', r.enrollment_id, 'sn', r.sn, 'name', r.name, 'name_ar', r.name_ar, 'code', v_code));
  end loop;

  return v_out;
end $$;

create or replace function public.admin_revoke_code(p_token text, p_enrollment_id uuid)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  update private.exam_codes set status = 'revoked', code_plain = null
   where enrollment_id = p_enrollment_id and status = 'active';
end $$;

create or replace function public.admin_clear_lock(p_token text, p_enrollment_id uuid)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  perform private.throttle_clear('enr:' || p_enrollment_id::text);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. NEW: list the active codes of a course (teacher only)
--    `code` is null for a code issued before this migration (hash only): the teacher uses "New Code".
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_list_codes(p_token text, p_course_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object('enrollment_id', ec.enrollment_id, 'code', ec.code_plain,
                                        'created_at', ec.created_at) order by e.sn)
      from private.exam_codes ec
      join public.enrollments e on e.id = ec.enrollment_id
     where e.course_id = p_course_id and ec.status = 'active'
  ), '[]'::jsonb);
end $$;

revoke all on function public.admin_list_codes(text, uuid) from public, anon, authenticated;
grant execute on function public.admin_list_codes(text, uuid) to anon;

-- ---------------------------------------------------------------------------------------------
-- 6. Post-conditions (the whole migration rolls back if any fails)
-- ---------------------------------------------------------------------------------------------
do $$
declare v_bad text;
begin
  assert exists (select 1 from information_schema.columns
                  where table_schema = 'private' and table_name = 'exam_codes' and column_name = 'code_plain'),
         'exam_codes.code_plain missing';
  assert private.gen_exam_code() ~ '^[0-9]{4,10}$', 'gen_exam_code did not return digits';
  assert to_regclass('private.throttle') is null, 'private.throttle should not exist (the code uses private.auth_throttle)';

  -- No function may still name the non-existent table `private.throttle` (the original bug).
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosrc ~ 'private\.throttle([^_a-z]|$)';
  assert v_bad is null, 'functions still reference private.throttle: ' || v_bad;

  assert has_function_privilege('anon', 'public.admin_list_codes(text, uuid)', 'execute'), 'anon must be able to call admin_list_codes';
  assert not has_table_privilege('anon', 'private.exam_codes', 'select'), 'anon must not read exam_codes';
  raise notice '023_codes_fix_and_persist applied and verified.';
end $$;

commit;
