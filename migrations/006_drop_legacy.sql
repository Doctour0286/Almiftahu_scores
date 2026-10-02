-- 006_drop_legacy: remove the legacy score columns from `students` (PRD v3.1 #7).
-- RUN ONLY >= 7 DAYS AFTER THE PRODUCTION CUT-OVER (runbook step 7 done, no rollback needed).
-- After this, `students` is just the person: id, name, name_ar. Scores live only in `enrollments`.
--
-- What it does, in ONE transaction (any failed check rolls everything back):
--   1. Refuses unless 005 is applied (anon cannot write `students`): never run this on an unlocked DB.
--   2. Redefines private.add_student_enrollment() so it no longer writes the legacy columns
--      (it was the only function that did; everything else already read enrollments only).
--   3. Drops private.sync_legacy_students() (it reads the columns about to go).
--   4. Drops students.sn, students.days, students.bonus_units, students.active.
--   5. Reads the catalog back to prove the columns are gone and `students` is exactly (id, name, name_ar).
-- Idempotent: a second run changes nothing.
-- AFTER THIS migrations/rollback/reverse_sync.sql CANNOT WORK (and could not after 005 anyway).
-- Take a backup first; dropped columns are gone.

begin;

do $$
begin
  if to_regrole('anon') is not null and has_table_privilege('anon', 'public.students', 'UPDATE') then
    raise exception '006 refused: 005_security_lockdown is not applied (anon can still write students).';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'private' and p.proname = 'add_student_enrollment') then
    raise exception '006 refused: private.add_student_enrollment is missing (run 003 first).';
  end if;
end $$;

-- 2. Same function as 003 minus the legacy columns. Student ids stay 's<number>'.
create or replace function private.add_student_enrollment(p_course public.courses, p_name text, p_name_ar text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare v_n bigint; v_id text; v_enr uuid; v_sn int;
begin
  perform pg_advisory_xact_lock(hashtext('mahad_student_id'));
  select coalesce(max(substring(id from '^s([0-9]{1,9})$')::bigint), 0) + 1 into v_n from public.students;
  v_id := 's' || v_n;
  while exists (select 1 from public.students where id = v_id) loop v_n := v_n + 1; v_id := 's' || v_n; end loop;

  insert into public.students (id, name, name_ar) values (v_id, p_name, p_name_ar);

  v_sn := private.next_sn(p_course.id);
  insert into public.enrollments (student_id, course_id, sn, days, bonus_units)
  values (v_id, p_course.id, v_sn, private.blank_days(p_course), private.blank_bonus(p_course))
  returning id into v_enr;

  return jsonb_build_object('enrollment_id', v_enr, 'student_id', v_id, 'sn', v_sn);
end $$;
revoke all on function private.add_student_enrollment(public.courses, text, text) from public, anon, authenticated;

-- 3 + 4.
drop function if exists private.sync_legacy_students();
alter table public.students
  drop column if exists sn,
  drop column if exists days,
  drop column if exists bonus_units,
  drop column if exists active;

-- 5. Post-conditions, read back from the catalog.
do $$
declare v_cols text;
begin
  select string_agg(attname, ',' order by attname) into v_cols
    from pg_attribute where attrelid = 'public.students'::regclass and attnum > 0 and not attisdropped;
  if v_cols is distinct from 'id,name,name_ar' then
    raise exception '006 post-check failed: students columns are %, expected id,name,name_ar', v_cols;
  end if;
  if to_regprocedure('private.sync_legacy_students()') is not null then
    raise exception '006 post-check failed: sync_legacy_students still exists';
  end if;
  if pg_get_functiondef('private.add_student_enrollment(public.courses,text,text)'::regprocedure) like '%public.students (id, sn%' then
    raise exception '006 post-check failed: add_student_enrollment still writes legacy columns';
  end if;
  raise notice '006 applied and verified: students = (id, name, name_ar); sync_legacy_students dropped.';
end $$;

commit;
