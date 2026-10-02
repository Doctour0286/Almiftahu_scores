-- 003_roster_rpcs.sql  (Phase 0, task 0.2)
-- Course / roster / lesson-score RPCs (PRD §7.6), the Phase-0 (lesson-only) recompute_result,
-- the triggers that keep public.enrollment_results current, and a backfill.
--
-- Additive: the live app still reads/writes `students` and is unaffected. Nothing here is
-- called by the old client. Safe to re-run.
--
-- CONVENTIONS
--  * Every admin RPC takes p_token first and calls private.require_teacher(p_token) (raises E_AUTH).
--  * Failures raise `E_XXX` (message) with a human-readable detail. These RPCs write nothing on
--    failure, so raising (and rolling back) is correct. See PRD §7.1.
--  * p_day_index in admin_save_day is ZERO-BASED (matches the JS arrays); Postgres arrays are 1-based
--    internally.
--  * Legacy `students` columns (sn, days, bonus_units) are stale after cut-over (PRD v3.1 #7). New
--    students get id 's<n>' and legacy sn = n, with unset legacy arrays, so legacy NOT NULL
--    constraints (if any) hold and old-style ids never collide.
--  * `p_copy_exam` in admin_save_course is accepted but is a no-op until Phase 1 (no exam tables).
--  * cert_settings content validation (FR-V7) arrives in Phase 4; Phase 0 only requires a JSON object.

-- =====================================================================================
-- 1. Phase-0 recompute_result (lesson part only). Phase 2 replaces it with the full version.
-- =====================================================================================
create or replace function private.recompute_result(p_enrollment uuid) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  e public.enrollments; c public.courses;
  v_day numeric; v_bonus numeric; v_lesson_pct numeric;
  v_complete boolean; v_status text;
begin
  select * into e from public.enrollments where id = p_enrollment;
  if not found then return; end if;
  select * into c from public.courses where id = e.course_id;

  if c.lesson_mode = 'scored' then
    select coalesce(sum(d), 0) into v_day   from unnest(e.days) d where d >= 0;
    select coalesce(sum(b), 0) * c.bonus_unit_value into v_bonus from unnest(e.bonus_units) b where b > 0;
    v_lesson_pct := least(c.lesson_max, v_day + v_bonus) / c.lesson_max * 100;
  end if;

  v_complete := case c.eligibility_rule
    when 'all_units'        then cardinality(e.days) = c.day_count
                                 and not exists (select 1 from unnest(e.days) d where d < 0)
    when 'teacher_approved' then e.exam_approved
    else true                                             -- 'open'
  end;
  v_status := case when v_complete then 'eligible' else 'not_eligible' end;

  insert into public.enrollment_results as r
    (enrollment_id, course_id, status, lesson_pct, exam_pct, final, passed,
     band_label, band_label_ar, has_certificate, updated_at)
  values (p_enrollment, e.course_id, v_status, v_lesson_pct, null, null, null, null, null, false, now())
  on conflict (enrollment_id) do update set
    course_id = excluded.course_id, status = excluded.status, lesson_pct = excluded.lesson_pct,
    exam_pct = null, final = null, passed = null, band_label = null, band_label_ar = null,
    updated_at = now();
end $$;
revoke all on function private.recompute_result(uuid) from public, anon, authenticated;

-- =====================================================================================
-- 2. Triggers
-- =====================================================================================
create or replace function private.trg_enrollment_recompute() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.recompute_result(new.id);
  return null;
end $$;
revoke all on function private.trg_enrollment_recompute() from public, anon, authenticated;

drop trigger if exists enrollments_recompute on public.enrollments;
create trigger enrollments_recompute
  after insert or update of days, bonus_units, active, exam_approved on public.enrollments
  for each row execute function private.trg_enrollment_recompute();

create or replace function private.trg_course_recompute() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
declare r record;
begin
  for r in select id from public.enrollments where course_id = new.id loop
    perform private.recompute_result(r.id);
  end loop;
  return null;
end $$;
revoke all on function private.trg_course_recompute() from public, anon, authenticated;

drop trigger if exists courses_recompute on public.courses;
create trigger courses_recompute
  after update of day_count, day_max, bonus_unit_value, lesson_max, weight_lessons, weight_exam,
                  pass_mark, grade_bands, eligibility_rule, lesson_mode on public.courses
  for each row execute function private.trg_course_recompute();

-- =====================================================================================
-- 3. Private helpers
-- =====================================================================================

-- Next S/N for a course. Caller MUST hold a row lock on the course (select ... for update).
create or replace function private.next_sn(p_course uuid) returns int
language sql stable as $$
  select coalesce(max(sn), 0) + 1 from public.enrollments where course_id = p_course
$$;

-- Fresh unset score arrays for a course.
create or replace function private.blank_days(p_course public.courses) returns int[]
language sql immutable as $$
  select case when p_course.lesson_mode = 'scored'
              then array_fill(-1, array[p_course.day_count]) else '{}'::int[] end
$$;
create or replace function private.blank_bonus(p_course public.courses) returns int[]
language sql immutable as $$
  select case when p_course.lesson_mode = 'scored'
              then array_fill(0, array[p_course.day_count]) else '{}'::int[] end
$$;

-- Creates a student row + enrollment. Caller holds the course row lock.
-- Student ids stay 's<number>' (legacy-compatible); a transaction-level advisory lock serialises
-- id allocation so two concurrent adds in DIFFERENT courses cannot pick the same id.
create or replace function private.add_student_enrollment(p_course public.courses, p_name text, p_name_ar text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare v_n bigint; v_id text; v_enr uuid; v_sn int;
begin
  perform pg_advisory_xact_lock(hashtext('mahad_student_id'));
  select coalesce(max(substring(id from '^s([0-9]{1,9})$')::bigint), 0) + 1 into v_n from public.students;
  v_id := 's' || v_n;
  while exists (select 1 from public.students where id = v_id) loop v_n := v_n + 1; v_id := 's' || v_n; end loop;

  -- legacy columns: sn mirrors the id number; arrays are the "unset" shape the old app writes
  insert into public.students (id, sn, name, name_ar, days, bonus_units, active)
  values (v_id, v_n::int, p_name, p_name_ar, array_fill(-1, array[10]), array_fill(-1, array[10]), true);

  v_sn := private.next_sn(p_course.id);
  insert into public.enrollments (student_id, course_id, sn, days, bonus_units)
  values (v_id, p_course.id, v_sn, private.blank_days(p_course), private.blank_bonus(p_course))
  returning id into v_enr;

  return jsonb_build_object('enrollment_id', v_enr, 'student_id', v_id, 'sn', v_sn);
end $$;
revoke all on function private.add_student_enrollment(public.courses, text, text) from public, anon, authenticated;

-- Parses and validates grade bands (FR-C6). Returns normalised jsonb array.
create or replace function private.validate_bands(p_bands jsonb) returns jsonb
language plpgsql as $$
declare b jsonb; v_mins numeric[] := '{}'; v_min numeric; v_out jsonb := '[]'; v_label text;
begin
  if jsonb_typeof(p_bands) is distinct from 'array' then
    perform private.fail('E_VALIDATION', 'grade_bands must be a list.');
  end if;
  if jsonb_array_length(p_bands) > 20 then
    perform private.fail('E_VALIDATION', 'At most 20 grade bands.');
  end if;
  for b in select * from jsonb_array_elements(p_bands) loop
    if jsonb_typeof(b) is distinct from 'object' then
      perform private.fail('E_VALIDATION', 'Each grade band must be an object.');
    end if;
    v_label := btrim(coalesce(b->>'label', ''));
    if v_label = '' or char_length(v_label) > 60 then
      perform private.fail('E_VALIDATION', 'Each grade band needs a label (1-60 characters).');
    end if;
    begin v_min := (b->>'min')::numeric;
    exception when others then perform private.fail('E_VALIDATION', 'Grade band "' || v_label || '": min must be a number.'); end;
    if v_min is null or v_min < 0 or v_min > 100 then
      perform private.fail('E_VALIDATION', 'Grade band "' || v_label || '": min must be between 0 and 100.');
    end if;
    if v_min = any(v_mins) then
      perform private.fail('E_VALIDATION', 'Grade band minimums must be unique.');
    end if;
    v_mins := v_mins || v_min;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'label', v_label, 'label_ar', nullif(btrim(coalesce(b->>'label_ar', '')), ''), 'min', v_min));
  end loop;
  return v_out;
end $$;
revoke all on function private.validate_bands(jsonb) from public, anon, authenticated;

-- =====================================================================================
-- 4. Courses
-- =====================================================================================

-- p_course keys (all optional on update; code + name required on insert):
--   id, code, name, name_ar, unit_label, unit_label_ar, lesson_mode, eligibility_rule, day_count,
--   day_max, bonus_unit_value, lesson_max, weight_lessons, weight_exam, pass_mark, reveal_answers,
--   grade_bands, cert_settings.   (status is changed with admin_set_course_status.)
-- Insert + p_copy_from: the source course supplies every setting not given in p_course (FR-C7).
-- Returns {course, affected}.
create or replace function public.admin_save_course(
  p_token text, p_course jsonb, p_confirm boolean default false,
  p_copy_from uuid default null, p_copy_exam boolean default false)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_id uuid; old public.courses; b public.courses; src public.courses; c public.courses;
  v_is_new boolean; v_count int := 0; v_changed boolean := false; v_locked boolean;
  v_code text; v_name text; v_mode text; v_rule text; v_dc int; v_dm int; v_bv numeric; v_lm numeric;
  v_wl numeric; v_we numeric; v_pm numeric; v_unit text; v_reveal boolean; v_bands jsonb; v_cert jsonb;
  v_name_ar text; v_unit_ar text;
begin
  perform private.require_teacher(p_token);
  if p_course is null or jsonb_typeof(p_course) <> 'object' then
    perform private.fail('E_VALIDATION', 'Course data is missing.');
  end if;

  v_is_new := coalesce(p_course->>'id', '') = '';
  if v_is_new then
    if p_copy_from is not null then
      select * into src from public.courses where id = p_copy_from;
      if not found then perform private.fail('E_NOT_FOUND', 'The course to copy from no longer exists.'); end if;
      b := src;
    end if;                                              -- else b stays all-null: defaults below
  else
    v_id := (p_course->>'id')::uuid;
    select * into old from public.courses where id = v_id for update;
    if not found then perform private.fail('E_NOT_FOUND', 'That course no longer exists.'); end if;
    b := old;
  end if;

  -- ---- resolve every field: given value -> base (existing/copied) -> built-in default ----
  v_code := coalesce(p_course->>'code', b.code);
  v_name := btrim(coalesce(p_course->>'name', b.name, ''));
  v_name_ar := case when p_course ? 'name_ar' then nullif(btrim(coalesce(p_course->>'name_ar','')), '') else b.name_ar end;
  v_unit := btrim(coalesce(p_course->>'unit_label', b.unit_label, 'Day'));
  v_unit_ar := case when p_course ? 'unit_label_ar' then nullif(btrim(coalesce(p_course->>'unit_label_ar','')), '') else b.unit_label_ar end;
  v_mode := coalesce(p_course->>'lesson_mode', b.lesson_mode, 'scored');
  v_rule := coalesce(p_course->>'eligibility_rule', b.eligibility_rule, 'all_units');
  v_dc := coalesce((p_course->>'day_count')::int, b.day_count, 10);
  v_dm := coalesce((p_course->>'day_max')::int, b.day_max, 10);
  v_bv := coalesce((p_course->>'bonus_unit_value')::numeric, b.bonus_unit_value, 2);
  v_lm := coalesce((p_course->>'lesson_max')::numeric, b.lesson_max, 100);
  v_wl := coalesce((p_course->>'weight_lessons')::numeric, b.weight_lessons, 50);
  v_we := coalesce((p_course->>'weight_exam')::numeric, b.weight_exam, 50);
  v_pm := coalesce((p_course->>'pass_mark')::numeric, b.pass_mark, 60);
  v_reveal := coalesce((p_course->>'reveal_answers')::boolean, b.reveal_answers, true);
  v_bands := coalesce(p_course->'grade_bands', b.grade_bands,
    '[{"label":"Excellent","label_ar":"ممتاز","min":90},{"label":"Very Good","label_ar":"جيد جداً","min":80},
      {"label":"Good","label_ar":"جيد","min":70},{"label":"Pass","label_ar":"مقبول","min":60}]'::jsonb);
  v_cert := coalesce(p_course->'cert_settings', b.cert_settings, '{}'::jsonb);

  -- ---- validation (FR-C1) ----
  if v_code is null or v_code !~ '^[A-Z0-9-]{2,12}$' then
    perform private.fail('E_VALIDATION', 'Course code must be 2-12 characters: capital letters, digits, hyphen.');
  end if;
  if v_name = '' or char_length(v_name) > 200 then
    perform private.fail('E_VALIDATION', 'Course name is required (up to 200 characters).');
  end if;
  if char_length(v_unit) not between 1 and 30 then
    perform private.fail('E_VALIDATION', 'Unit label must be 1-30 characters.');
  end if;
  if v_mode not in ('scored', 'none') then perform private.fail('E_VALIDATION', 'Lesson mode must be scored or none.'); end if;
  if v_rule not in ('all_units', 'teacher_approved', 'open') then
    perform private.fail('E_VALIDATION', 'Eligibility rule must be all_units, teacher_approved or open.');
  end if;
  if v_pm < 0 or v_pm > 100 then perform private.fail('E_VALIDATION', 'Pass mark must be between 0 and 100.'); end if;
  if jsonb_typeof(v_cert) is distinct from 'object' then
    perform private.fail('E_VALIDATION', 'Certificate settings must be an object.');
  end if;
  v_bands := private.validate_bands(v_bands);

  if v_mode = 'none' then
    v_dc := 0; v_wl := 0; v_we := 100;                    -- fixed for exam-only courses (D-42)
    if v_rule = 'all_units' then
      if p_course ? 'eligibility_rule' then
        perform private.fail('E_VALIDATION', 'An exam-only course cannot use the all_units rule.');
      end if;
      v_rule := 'open';                                   -- sensible default (FR-C9)
    end if;
  else
    if v_dc not between 1 and 60 then perform private.fail('E_VALIDATION', 'Number of units must be between 1 and 60.'); end if;
    if v_dm < 1 then perform private.fail('E_VALIDATION', 'Maximum score per unit must be at least 1.'); end if;
    if v_bv < 0 then perform private.fail('E_VALIDATION', 'Bonus unit value cannot be negative.'); end if;
    if v_lm <= 0 then perform private.fail('E_VALIDATION', 'Lesson maximum must be greater than 0.'); end if;
    if v_wl < 0 or v_wl > 100 or v_we < 0 or v_we > 100 or v_wl + v_we <> 100 then
      perform private.fail('E_VALIDATION', 'Lesson and exam weights must add up to 100.');
    end if;
  end if;

  -- ---- insert ----
  if v_is_new then
    if coalesce(p_course->>'code', '') = '' or coalesce(p_course->>'name', '') = '' then
      perform private.fail('E_VALIDATION', 'A new course needs a code and a name.');
    end if;
    -- p_copy_exam: Phase 1 (exam tables do not exist yet) - intentionally ignored here.
    insert into public.courses (code, name, name_ar, unit_label, unit_label_ar, lesson_mode, eligibility_rule,
        day_count, day_max, bonus_unit_value, lesson_max, weight_lessons, weight_exam, pass_mark,
        reveal_answers, cert_settings, grade_bands)
    values (v_code, v_name, v_name_ar, v_unit, v_unit_ar, v_mode, v_rule, v_dc, v_dm, v_bv, v_lm, v_wl, v_we,
        v_pm, v_reveal, v_cert, v_bands)
    returning * into c;
    return jsonb_build_object('course', to_jsonb(c), 'affected', 0);
  end if;

  -- ---- update ----
  select count(*) into v_count from public.enrollments where course_id = v_id;

  -- FR-C8: lesson mode locks once scoring has started
  if v_mode <> old.lesson_mode then
    v_locked := exists (select 1 from public.enrollments e
                        where e.course_id = v_id
                          and (exists (select 1 from unnest(e.days) d where d >= 0)
                               or exists (select 1 from unnest(e.bonus_units) x where x > 0)));
    if not v_locked and to_regclass('private.attempts') is not null then
      -- dynamic: private.attempts does not exist until Phase 2, and a static reference would fail to plan
      execute 'select exists (select 1 from private.attempts a join public.enrollments e on e.id = a.enrollment_id '
              'where e.course_id = $1)' into v_locked using v_id;
    end if;
    if v_locked then
      perform private.fail('E_VALIDATION',
        'Lesson mode can''t change after scoring has started. Create a new course instead.');
    end if;
  end if;

  -- FR-C2 / FR-C9: scoring-affecting change with enrollments present needs explicit confirmation
  v_changed := (v_dc, v_dm, v_bv, v_lm, v_wl, v_we, v_pm, v_rule, v_mode)
            is distinct from
               (old.day_count, old.day_max, old.bonus_unit_value, old.lesson_max, old.weight_lessons,
                old.weight_exam, old.pass_mark, old.eligibility_rule, old.lesson_mode);
  if v_changed and v_count > 0 and not coalesce(p_confirm, false) then
    perform private.fail('E_CONFIRM_REQUIRED', v_count::text);
  end if;

  update public.courses set
    code = v_code, name = v_name, name_ar = v_name_ar, unit_label = v_unit, unit_label_ar = v_unit_ar,
    lesson_mode = v_mode, eligibility_rule = v_rule, day_count = v_dc, day_max = v_dm,
    bonus_unit_value = v_bv, lesson_max = v_lm, weight_lessons = v_wl, weight_exam = v_we,
    pass_mark = v_pm, reveal_answers = v_reveal, cert_settings = v_cert, grade_bands = v_bands
  where id = v_id returning * into c;

  -- FR-C3: resize every enrollment's arrays (new entries unset / 0; removed entries dropped)
  if v_dc <> old.day_count or v_mode <> old.lesson_mode then
    update public.enrollments e set
      days        = array(select coalesce(e.days[i], -1)        from generate_series(1, c.day_count) i),
      bonus_units = array(select coalesce(e.bonus_units[i], 0)  from generate_series(1, c.day_count) i)
    where e.course_id = v_id;
  end if;

  return jsonb_build_object('course', to_jsonb(c), 'affected', v_count);
exception
  when unique_violation then
    perform private.fail('E_VALIDATION', 'That course code is already in use.');
  when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then
    perform private.fail('E_VALIDATION', 'One of the course values is not a valid number, yes/no, or id.');
  when check_violation then
    perform private.fail('E_VALIDATION', 'The course settings are inconsistent (check the weights, unit count and eligibility rule).');
end $$;

create or replace function public.admin_set_course_status(p_token text, p_course_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  if p_status not in ('active', 'archived') then
    perform private.fail('E_VALIDATION', 'Status must be active or archived.');
  end if;
  update public.courses set status = p_status where id = p_course_id;
  if not found then perform private.fail('E_NOT_FOUND', 'That course no longer exists.'); end if;
end $$;

-- =====================================================================================
-- 5. Roster
-- =====================================================================================

create or replace function public.admin_list_roster(p_token text, p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  if not exists (select 1 from public.courses where id = p_course_id) then
    perform private.fail('E_NOT_FOUND', 'That course no longer exists.');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'enrollment_id', e.id, 'student_id', s.id, 'sn', e.sn, 'name', s.name, 'name_ar', s.name_ar,
      'active', e.active, 'days', e.days, 'bonus_units', e.bonus_units,
      'exam_approved', e.exam_approved, 'status', r.status, 'lesson_pct', r.lesson_pct,
      'exam_pct', r.exam_pct, 'final', r.final, 'passed', r.passed,
      'band_label', r.band_label, 'band_label_ar', r.band_label_ar, 'has_certificate', coalesce(r.has_certificate, false)
    ) order by e.sn)
    from public.enrollments e
    join public.students s on s.id = e.student_id
    left join public.enrollment_results r on r.enrollment_id = e.id
    where e.course_id = p_course_id), '[]'::jsonb);
end $$;

create or replace function public.admin_list_students_all(p_token text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'name_ar', name_ar)
                                    order by lower(name), id) from public.students), '[]'::jsonb);
end $$;

-- FR-R1 / FR-R7. Returns {enrollment_id, student_id, sn, duplicate_name}.
create or replace function public.admin_add_student(p_token text, p_course_id uuid, p_name text, p_name_ar text default null)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare c public.courses; v_name text := btrim(coalesce(p_name, '')); v_ar text := nullif(btrim(coalesce(p_name_ar, '')), '');
        v_dup boolean; v_res jsonb;
begin
  perform private.require_teacher(p_token);
  if v_name = '' or char_length(v_name) > 200 or char_length(coalesce(v_ar, '')) > 200 then
    perform private.fail('E_VALIDATION', 'Student name is required (up to 200 characters).');
  end if;
  select * into c from public.courses where id = p_course_id for update;       -- serialises S/N allocation
  if not found then perform private.fail('E_NOT_FOUND', 'That course no longer exists.'); end if;
  if c.status = 'archived' then perform private.fail('E_VALIDATION', 'This course is archived; no new enrollments.'); end if;

  select exists (select 1 from public.enrollments e join public.students s on s.id = e.student_id
                 where e.course_id = c.id and lower(btrim(s.name)) = lower(v_name)) into v_dup;
  v_res := private.add_student_enrollment(c, v_name, v_ar);
  return v_res || jsonb_build_object('duplicate_name', v_dup);
end $$;

-- FR-R2
create or replace function public.admin_enroll_student(p_token text, p_course_id uuid, p_student_id text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare c public.courses; v_enr uuid; v_sn int;
begin
  perform private.require_teacher(p_token);
  select * into c from public.courses where id = p_course_id for update;
  if not found then perform private.fail('E_NOT_FOUND', 'That course no longer exists.'); end if;
  if c.status = 'archived' then perform private.fail('E_VALIDATION', 'This course is archived; no new enrollments.'); end if;
  if not exists (select 1 from public.students where id = p_student_id) then
    perform private.fail('E_NOT_FOUND', 'That student no longer exists.');
  end if;
  if exists (select 1 from public.enrollments where course_id = c.id and student_id = p_student_id) then
    perform private.fail('E_VALIDATION', 'That student is already enrolled in this course.');
  end if;
  v_sn := private.next_sn(c.id);
  insert into public.enrollments (student_id, course_id, sn, days, bonus_units)
  values (p_student_id, c.id, v_sn, private.blank_days(c), private.blank_bonus(c))
  returning id into v_enr;
  return jsonb_build_object('enrollment_id', v_enr, 'student_id', p_student_id, 'sn', v_sn);
end $$;

-- FR-R3. One student per line; optional Arabic name after '|'. Returns {added, skipped[], invalid[]}.
create or replace function public.admin_bulk_seed(p_token text, p_course_id uuid, p_lines text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  c public.courses; v_line text; v_pos int; v_name text; v_ar text; v_key text;
  v_seen text[] := '{}'; v_added int := 0; v_skipped jsonb := '[]'; v_invalid jsonb := '[]';
  v_max int := private.param('bulk_seed_max_lines', 1000)::int; v_lines text[];
begin
  perform private.require_teacher(p_token);
  select * into c from public.courses where id = p_course_id for update;
  if not found then perform private.fail('E_NOT_FOUND', 'That course no longer exists.'); end if;
  if c.status = 'archived' then perform private.fail('E_VALIDATION', 'This course is archived; no new enrollments.'); end if;

  v_lines := regexp_split_to_array(coalesce(p_lines, ''), E'\r?\n');
  if cardinality(v_lines) > v_max then
    perform private.fail('E_VALIDATION', 'Too many lines (maximum ' || v_max || ' per import).');
  end if;

  -- names already in this course (case-insensitive, trimmed)
  select coalesce(array_agg(lower(btrim(s.name))), '{}') into v_seen
  from public.enrollments e join public.students s on s.id = e.student_id where e.course_id = c.id;

  foreach v_line in array v_lines loop
    v_line := btrim(v_line);
    continue when v_line = '';
    v_pos := position('|' in v_line);
    if v_pos > 0 then
      v_name := btrim(substr(v_line, 1, v_pos - 1));
      v_ar   := nullif(btrim(substr(v_line, v_pos + 1)), '');
    else
      v_name := v_line; v_ar := null;
    end if;
    if v_name = '' or char_length(v_name) > 200 or char_length(coalesce(v_ar, '')) > 200 then
      v_invalid := v_invalid || to_jsonb(v_line);
      continue;
    end if;
    v_key := lower(v_name);
    if v_key = any(v_seen) then
      v_skipped := v_skipped || to_jsonb(v_name);
      continue;
    end if;
    perform private.add_student_enrollment(c, v_name, v_ar);
    v_seen := v_seen || v_key;
    v_added := v_added + 1;
  end loop;
  return jsonb_build_object('added', v_added, 'skipped', v_skipped, 'invalid', v_invalid);
end $$;

-- FR-R4 / FR-R5. A blank Arabic name clears it.
create or replace function public.admin_update_student(p_token text, p_student_id text, p_name text, p_name_ar text default null)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
declare v_name text := btrim(coalesce(p_name, '')); v_ar text := nullif(btrim(coalesce(p_name_ar, '')), '');
begin
  perform private.require_teacher(p_token);
  if v_name = '' or char_length(v_name) > 200 or char_length(coalesce(v_ar, '')) > 200 then
    perform private.fail('E_VALIDATION', 'Student name is required (up to 200 characters).');
  end if;
  update public.students set name = v_name, name_ar = v_ar where id = p_student_id;
  if not found then perform private.fail('E_NOT_FOUND', 'That student no longer exists.'); end if;
end $$;

create or replace function public.admin_set_active(p_token text, p_enrollment_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  if p_active is null then perform private.fail('E_VALIDATION', 'Active must be true or false.'); end if;
  update public.enrollments set active = p_active where id = p_enrollment_id;
  if not found then perform private.fail('E_NOT_FOUND', 'That enrollment no longer exists.'); end if;
end $$;

-- FR-R6. A restrict-FK from private.certificates (Phase 4) surfaces as E_HAS_CERTIFICATE.
create or replace function public.admin_delete_student(p_token text, p_student_id text)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  begin
    delete from public.students where id = p_student_id;
  exception when foreign_key_violation then
    perform private.fail('E_HAS_CERTIFICATE', 'This student has a certificate and can''t be deleted.');
  end;
  if not found then perform private.fail('E_NOT_FOUND', 'That student no longer exists.'); end if;
end $$;

-- =====================================================================================
-- 6. Lesson scores
-- =====================================================================================

-- FR-S1/S2/S5. p_day_index is ZERO-BASED. p_score null = unset; p_bonus null = 0.
create or replace function public.admin_save_day(
  p_token text, p_enrollment_id uuid, p_day_index int, p_score int, p_bonus int)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare e public.enrollments; c public.courses; v_res public.enrollment_results;
begin
  perform private.require_teacher(p_token);
  select * into e from public.enrollments where id = p_enrollment_id for update;
  if not found then perform private.fail('E_NOT_FOUND', 'That enrollment no longer exists.'); end if;
  select * into c from public.courses where id = e.course_id;

  if c.lesson_mode <> 'scored' then
    perform private.fail('E_VALIDATION', 'This course has no lesson scores.');
  end if;
  if p_day_index is null or p_day_index < 0 or p_day_index >= c.day_count
     or cardinality(e.days) <> c.day_count or cardinality(e.bonus_units) <> c.day_count then
    perform private.fail('E_VALIDATION', 'That ' || lower(c.unit_label) || ' does not exist in this course.');
  end if;
  if p_score is not null and (p_score < 0 or p_score > c.day_max) then
    perform private.fail('E_VALIDATION', 'Score must be between 0 and ' || c.day_max || ' (or blank).');
  end if;
  if p_bonus is not null and p_bonus < 0 then
    perform private.fail('E_VALIDATION', 'Bonus units cannot be negative.');
  end if;

  update public.enrollments set
    days        = e.days[1:p_day_index]        || array[coalesce(p_score, -1)] || e.days[p_day_index + 2:],
    bonus_units = e.bonus_units[1:p_day_index] || array[coalesce(p_bonus, 0)]  || e.bonus_units[p_day_index + 2:]
  where id = e.id
  returning * into e;                                    -- trigger has recomputed enrollment_results

  select * into v_res from public.enrollment_results where enrollment_id = e.id;
  return jsonb_build_object('days', e.days, 'bonus_units', e.bonus_units,
                            'lesson_pct', v_res.lesson_pct, 'status', v_res.status);
end $$;

-- FR-C9. Only meaningful for eligibility_rule = teacher_approved.
create or replace function public.admin_set_exam_approval(p_token text, p_enrollment_id uuid, p_approved boolean)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
declare c public.courses;
begin
  perform private.require_teacher(p_token);
  if p_approved is null then perform private.fail('E_VALIDATION', 'Approved must be true or false.'); end if;
  select c2.* into c from public.enrollments e join public.courses c2 on c2.id = e.course_id where e.id = p_enrollment_id;
  if not found then perform private.fail('E_NOT_FOUND', 'That enrollment no longer exists.'); end if;
  if c.eligibility_rule <> 'teacher_approved' then
    perform private.fail('E_VALIDATION', 'This course does not use teacher approval for the exam.');
  end if;
  update public.enrollments set exam_approved = p_approved,
         exam_approved_at = case when p_approved then now() else null end
  where id = p_enrollment_id;
end $$;

-- =====================================================================================
-- 7. Grants: only the RPCs below are callable through the API (005 re-grants after its blanket revoke)
-- =====================================================================================
revoke all on function public.admin_save_course(text, jsonb, boolean, uuid, boolean)       from public, anon, authenticated;
revoke all on function public.admin_set_course_status(text, uuid, text)                    from public, anon, authenticated;
revoke all on function public.admin_list_roster(text, uuid)                                from public, anon, authenticated;
revoke all on function public.admin_list_students_all(text)                                from public, anon, authenticated;
revoke all on function public.admin_add_student(text, uuid, text, text)                    from public, anon, authenticated;
revoke all on function public.admin_enroll_student(text, uuid, text)                       from public, anon, authenticated;
revoke all on function public.admin_bulk_seed(text, uuid, text)                            from public, anon, authenticated;
revoke all on function public.admin_update_student(text, text, text, text)                 from public, anon, authenticated;
revoke all on function public.admin_set_active(text, uuid, boolean)                        from public, anon, authenticated;
revoke all on function public.admin_delete_student(text, text)                             from public, anon, authenticated;
revoke all on function public.admin_save_day(text, uuid, int, int, int)                    from public, anon, authenticated;
revoke all on function public.admin_set_exam_approval(text, uuid, boolean)                 from public, anon, authenticated;

grant execute on function public.admin_save_course(text, jsonb, boolean, uuid, boolean)    to anon;
grant execute on function public.admin_set_course_status(text, uuid, text)                 to anon;
grant execute on function public.admin_list_roster(text, uuid)                             to anon;
grant execute on function public.admin_list_students_all(text)                             to anon;
grant execute on function public.admin_add_student(text, uuid, text, text)                 to anon;
grant execute on function public.admin_enroll_student(text, uuid, text)                    to anon;
grant execute on function public.admin_bulk_seed(text, uuid, text)                         to anon;
grant execute on function public.admin_update_student(text, text, text, text)              to anon;
grant execute on function public.admin_set_active(text, uuid, boolean)                     to anon;
grant execute on function public.admin_delete_student(text, text)                          to anon;
grant execute on function public.admin_save_day(text, uuid, int, int, int)                 to anon;
grant execute on function public.admin_set_exam_approval(text, uuid, boolean)              to anon;

-- =====================================================================================
-- 8. Backfill enrollment_results for every existing enrollment (idempotent)
-- =====================================================================================
do $$ declare r record; begin
  for r in select id from public.enrollments loop perform private.recompute_result(r.id); end loop;
end $$;
