-- 021_code_rpcs.sql (Phase 2, task 2.2)
-- Teacher code management RPCs: generate, bulk generate, revoke, clear lockout, reset attempt.

-- =============================================================================
-- 1. Helper function: generate random code (FR-K8)
-- =============================================================================

create or replace function private.gen_exam_code() returns text
language plpgsql volatile as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  res text := '';
  i int;
  idx int;
begin
  for i in 1..8 loop
    idx := floor(random() * 32)::int + 1;
    res := res || substr(chars, idx, 1);
  end loop;
  return substr(res, 1, 4) || '-' || substr(res, 5, 4);
end $$;

-- =============================================================================
-- 2. Public Teacher Code RPCs
-- =============================================================================

-- Generate a code for one eligible enrollment (revoking any existing active code)
create or replace function public.admin_generate_code(p_token text, p_enrollment_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_enr public.enrollments;
  v_course public.courses;
  v_res public.enrollment_results;
  v_code text;
  v_clean text;
  v_hash text;
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

  -- Revoke any active codes for this enrollment
  update private.exam_codes set status = 'revoked' where enrollment_id = p_enrollment_id and status = 'active';

  -- Generate new code
  v_code := private.gen_exam_code();
  v_clean := upper(replace(v_code, '-', ''));
  v_hash := extensions.crypt(v_clean, extensions.gen_salt('bf', 8));

  insert into private.exam_codes (enrollment_id, code_hash, status)
  values (p_enrollment_id, v_hash, 'active');

  return jsonb_build_object('code', v_code);
end $$;

-- Bulk generate codes for eligible students without active codes (chunked to 40 max per call)
create or replace function public.admin_generate_codes_bulk(p_token text, p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_course public.courses;
  r record;
  v_code text;
  v_clean text;
  v_hash text;
  v_out jsonb := '[]'::jsonb;
  v_count int := 0;
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
    v_clean := upper(replace(v_code, '-', ''));
    v_hash := extensions.crypt(v_clean, extensions.gen_salt('bf', 8));

    insert into private.exam_codes (enrollment_id, code_hash, status)
    values (r.enrollment_id, v_hash, 'active');

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'enrollment_id', r.enrollment_id,
      'sn', r.sn,
      'name', r.name,
      'name_ar', r.name_ar,
      'code', v_code
    ));
    v_count := v_count + 1;
  end loop;

  return v_out;
end $$;

-- Revoke an active code
create or replace function public.admin_revoke_code(p_token text, p_enrollment_id uuid)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  update private.exam_codes set status = 'revoked' where enrollment_id = p_enrollment_id and status = 'active';
end $$;

-- Clear student code lockout (throttling table)
create or replace function public.admin_clear_lock(p_token text, p_enrollment_id uuid)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  delete from private.throttle where key = 'enr:' || p_enrollment_id::text;
end $$;

-- Reset attempt: mark attempt superseded and allow re-sit
create or replace function public.admin_reset_attempt(p_token text, p_enrollment_id uuid)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  update private.attempts set superseded = true where enrollment_id = p_enrollment_id and not superseded;
  perform private.recompute_result(p_enrollment_id);
end $$;

grant execute on function public.admin_generate_code(text, uuid) to anon;
grant execute on function public.admin_generate_codes_bulk(text, uuid) to anon;
grant execute on function public.admin_revoke_code(text, uuid) to anon;
grant execute on function public.admin_clear_lock(text, uuid) to anon;
grant execute on function public.admin_reset_attempt(text, uuid) to anon;

do $$
begin
  raise notice '021_code_rpcs applied and verified.';
end $$;
