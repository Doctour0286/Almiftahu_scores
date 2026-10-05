-- 012_copy_exam_draft.sql  (Phase 1, task 1.7)
-- Wire p_copy_exam in admin_save_course using private.clone_version (FR-C7).

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

    insert into public.courses (code, name, name_ar, unit_label, unit_label_ar, lesson_mode, eligibility_rule,
        day_count, day_max, bonus_unit_value, lesson_max, weight_lessons, weight_exam, pass_mark,
        reveal_answers, cert_settings, grade_bands)
    values (v_code, v_name, v_name_ar, v_unit, v_unit_ar, v_mode, v_rule, v_dc, v_dm, v_bv, v_lm, v_wl, v_we,
        v_pm, v_reveal, v_cert, v_bands)
    returning * into c;

    -- Task 1.7 (FR-C7): copy exam as draft if requested
    if p_copy_from is not null and coalesce(p_copy_exam, false) then
      declare
        v_src_exam uuid;
        v_src_ver uuid;
        v_dst_exam uuid;
        v_dst_ver uuid;
      begin
        select id into v_src_exam from private.exams where course_id = p_copy_from;
        if v_src_exam is not null then
          select id into v_src_ver from private.exam_versions where exam_id = v_src_exam and status = 'live';
          if v_src_ver is null then
            select id into v_src_ver from private.exam_versions where exam_id = v_src_exam and status = 'draft';
          end if;
          if v_src_ver is not null then
            insert into private.exams (course_id) values (c.id) returning id into v_dst_exam;
            insert into private.exam_versions (exam_id, version_no, status) values (v_dst_exam, 1, 'draft') returning id into v_dst_ver;
            perform private.clone_version(v_src_ver, v_dst_ver);
          end if;
        end if;
      end;
    end if;

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

  -- Recompute results for every enrollment
  perform private.recompute_result(e.id) from public.enrollments e where e.course_id = v_id;

  return jsonb_build_object('course', to_jsonb(c), 'affected', v_count);
end $$;

grant execute on function public.admin_save_course(text, jsonb, boolean, uuid, boolean) to anon;

do $$
begin
  raise notice '012_copy_exam_draft applied and verified.';
end $$;
