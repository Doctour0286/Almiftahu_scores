-- ROLLBACK ONLY (cut-over runbook, "Rollback (before step 7)"). NOT a numbered migration: never run it
-- as part of the normal 000-006 sequence.
--
-- What it does: copies the ADAB course scores from `enrollments` back into the legacy `students`
-- columns (sn, days, bonus_units, active), so the OLD client (reverted on `main`) shows every score
-- entered through the new client since the copy at runbook step 4. It is the mirror of
-- private.sync_legacy_students() (001).
--
-- Use: after reverting the merge on `main`, paste this whole file into the Supabase SQL editor and
-- run it. It is ONE statement (a DO block), so it either completes or changes nothing. It prints
-- how many legacy rows it changed. Running it twice is harmless (second run changes 0 rows).
--
-- It refuses to run (and changes nothing) when:
--   * 005_security_lockdown has already been applied (anon can no longer write `students`, so the old
--     client cannot work anyway; after step 7 the runbook says forward-fix only), or
--   * course ADAB no longer has the shape the old client hard-codes (10 scored units, max 10 each,
--     bonus unit worth 2), because copying would silently corrupt the legacy scores, or
--   * any ADAB enrollment does not have 10-element arrays.
--
-- Not copied, on purpose: names (`name`, `name_ar` already live in `students`), students enrolled
-- only in other courses (the old app does not know them), exam data (does not exist before Phase 2).

do $$
declare
  v_c       public.courses;
  v_total   int;
  v_changed int;
  v_left    int;
begin
  -- 1. Only valid before 005.
  if to_regrole('anon') is not null
     and not has_table_privilege('anon', 'public.students', 'UPDATE') then
    raise exception 'reverse_sync refused: 005_security_lockdown is already applied (anon cannot write students). Rollback is only supported before runbook step 7; forward-fix or restore the step-2 backup instead.';
  end if;

  -- 2. ADAB must still look like what the old client hard-codes.
  select * into v_c from public.courses where code = 'ADAB';
  if not found then raise exception 'reverse_sync refused: course ADAB is missing'; end if;
  if v_c.lesson_mode <> 'scored' or v_c.day_count <> 10 or v_c.day_max <> 10 or v_c.bonus_unit_value <> 2 then
    raise exception 'reverse_sync refused: ADAB settings differ from what the old client assumes (need lesson_mode=scored, day_count=10, day_max=10, bonus_unit_value=2; found %, %, %, %). Change them back first.',
      v_c.lesson_mode, v_c.day_count, v_c.day_max, v_c.bonus_unit_value;
  end if;

  -- 3. Every ADAB enrollment must have well-formed arrays.
  if exists (select 1 from public.enrollments e
             where e.course_id = v_c.id
               and (cardinality(e.days) is distinct from 10 or cardinality(e.bonus_units) is distinct from 10)) then
    raise exception 'reverse_sync refused: some ADAB enrollments do not have 10-element days/bonus_units arrays';
  end if;

  select count(*) into v_total from public.enrollments where course_id = v_c.id;

  -- 4. The copy. Only rows that actually differ are written.
  update public.students s
     set sn          = e.sn,
         days        = e.days,
         bonus_units = e.bonus_units,
         active      = e.active
    from public.enrollments e
   where e.student_id = s.id
     and e.course_id  = v_c.id
     and (s.sn, s.days, s.bonus_units, s.active) is distinct from (e.sn, e.days, e.bonus_units, e.active);
  get diagnostics v_changed = row_count;

  -- 5. Read it back: nothing may still differ.
  select count(*) into v_left
    from public.enrollments e join public.students s on s.id = e.student_id
   where e.course_id = v_c.id
     and (s.sn, s.days, s.bonus_units, s.active) is distinct from (e.sn, e.days, e.bonus_units, e.active);
  if v_left <> 0 then
    raise exception 'reverse_sync failed its own check: % rows still differ', v_left;
  end if;

  raise notice 'reverse_sync done: % ADAB enrollments checked, % legacy students rows updated, 0 differences remain.', v_total, v_changed;
end $$;
