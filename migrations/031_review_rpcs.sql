-- 031_review_rpcs.sql (Phase 3, Task 3.2)
-- Student answer review (exam_get_review) and extended result breakdown (exam_get_result).
-- Also cleans up any stray permissive policies on public.students to enforce AC-0.11 lockdown.
-- Callable by anon under student code verification.

-- ---------------------------------------------------------------------------------------------
-- 0. RLS Lockdown Cleanup: ensure ONLY read_students applies to public.students (AC-0.11)
-- ---------------------------------------------------------------------------------------------
do $$
declare
  r record;
begin
  -- Drop any stray or duplicate policies on public.students (e.g. Supabase default UI policies)
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'students' and policyname <> 'read_students'
  loop
    raise notice 'Dropping extra policy on public.students: %', r.policyname;
    execute format('drop policy if exists %I on public.students', r.policyname);
  end loop;
end $$;

drop policy if exists read_students on public.students;
create policy read_students on public.students
  for select to anon
  using (exists (select 1 from public.enrollments e
                 where e.student_id = public.students.id and e.active));

-- ---------------------------------------------------------------------------------------------
-- 1. Extended exam_get_result: includes section breakdown and review readiness
-- ---------------------------------------------------------------------------------------------
create or replace function public.exam_get_result(p_enrollment_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_chk jsonb;
  v_enr public.enrollments;
  v_course public.courses;
  v_st public.students;
  v_res public.enrollment_results;
  v_att private.attempts;
  v_secs jsonb := '[]'::jsonb;
  v_sec record;
  v_sec_earned numeric;
  v_sec_max numeric;
  v_sec_pending int;
  v_can_review boolean := false;
begin
  v_chk := private.verify_student_code(p_enrollment_id, p_code);
  if not (v_chk->>'ok')::boolean then return v_chk; end if;

  select * into v_enr from public.enrollments where id = p_enrollment_id;
  if not found then perform private.fail('E_NOT_FOUND', 'Enrollment not found.'); end if;

  select * into v_course from public.courses where id = v_enr.course_id;
  select * into v_st from public.students where id = v_enr.student_id;
  select * into v_res from public.enrollment_results where enrollment_id = p_enrollment_id;
  if not found then perform private.fail('E_NOT_FOUND', 'Result not found.'); end if;

  select * into v_att from private.attempts
  where enrollment_id = p_enrollment_id and not superseded
  order by started_at desc limit 1;

  if found and v_att.id is not null then
    -- Section score breakdown
    for v_sec in
      select s.id, s.title, s.title_ar, s.format, s.weight
      from private.sections s
      where s.version_id = v_att.version_id
      order by s.position
    loop
      select
        coalesce(sum(coalesce(an.fraction, 0) * qv.value), 0),
        coalesce(sum(qv.value), 0),
        count(*) filter (where s.format = 'essay' and an.fraction is null)
      into v_sec_earned, v_sec_max, v_sec_pending
      from private.questions q
      join private.v_question_values qv on qv.version_id = v_att.version_id and qv.question_id = q.id
      left join private.answers an on an.attempt_id = v_att.id and an.question_id = q.id
      where q.section_id = v_sec.id;

      v_secs := v_secs || jsonb_build_array(jsonb_build_object(
        'id', v_sec.id,
        'title', v_sec.title,
        'title_ar', v_sec.title_ar,
        'format', v_sec.format,
        'weight', v_sec.weight,
        'earned_points', round(v_sec_earned, 2),
        'max_points', round(v_sec_max, 2),
        'pending_essays', v_sec_pending,
        'status', case when v_sec_pending > 0 then 'pending_marking' else 'graded' end
      ));
    end loop;

    v_can_review := (v_att.status = 'finalized') and coalesce(v_course.reveal_answers, false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', v_res.status,
    'student_name', v_st.name,
    'student_name_ar', v_st.name_ar,
    'course_name', v_course.name,
    'course_name_ar', v_course.name_ar,
    'lesson_pct', v_res.lesson_pct,
    'exam_pct', v_res.exam_pct,
    'final', v_res.final,
    'passed', v_res.passed,
    'band_label', v_res.band_label,
    'band_label_ar', v_res.band_label_ar,
    'has_certificate', v_res.has_certificate,
    'attempt_status', case when v_att.id is not null then v_att.status else null end,
    'can_review', v_can_review,
    'reveal_answers', coalesce(v_course.reveal_answers, false),
    'sections', v_secs
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. exam_get_review: questions, student answers, keys, marks, comments (AC-3.5)
-- ---------------------------------------------------------------------------------------------
create or replace function public.exam_get_review(p_enrollment_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_chk jsonb;
  v_enr public.enrollments;
  v_course public.courses;
  v_att private.attempts;
  v_secs jsonb := '[]'::jsonb;
  v_sec record;
  v_q record;
  v_qs jsonb;
  v_ans record;
  v_k record;
begin
  v_chk := private.verify_student_code(p_enrollment_id, p_code);
  if not (v_chk->>'ok')::boolean then return v_chk; end if;

  select * into v_enr from public.enrollments where id = p_enrollment_id;
  if not found then perform private.fail('E_NOT_FOUND', 'Enrollment not found.'); end if;

  select * into v_course from public.courses where id = v_enr.course_id;

  select * into v_att from private.attempts
  where enrollment_id = p_enrollment_id and not superseded
  order by started_at desc limit 1;

  if not found or v_att.id is null then
    perform private.fail('E_NOT_FOUND', 'No exam attempt found.');
  end if;

  if v_att.status <> 'finalized' then
    perform private.fail('E_NOT_READY', 'Your result is still being marked.');
  end if;

  if not coalesce(v_course.reveal_answers, false) then
    perform private.fail('E_REVIEW_DISABLED', 'Answer review is not available for this course.');
  end if;

  -- Build review questions
  for v_sec in
    select id, title, title_ar, format, weight
    from private.sections
    where version_id = v_att.version_id
    order by position
  loop
    v_qs := '[]'::jsonb;
    for v_q in
      select q.id, q.prompt, q.note, q.options, coalesce(qv.value, 0) as value
      from private.questions q
      left join private.v_question_values qv on qv.version_id = v_att.version_id and qv.question_id = q.id
      where q.section_id = v_sec.id
      order by q.position
    loop
      select * into v_ans from private.answers where attempt_id = v_att.id and question_id = v_q.id;
      select * into v_k from private.question_keys where question_id = v_q.id;

      v_qs := v_qs || jsonb_build_array(jsonb_build_object(
        'id', v_q.id,
        'prompt', v_q.prompt,
        'note', v_q.note,
        'format', v_sec.format,
        'max_points', v_q.value,
        'options', v_q.options,
        'key', case when v_k.question_id is not null then jsonb_build_object(
          'correct_option_ids', v_k.correct_option_ids,
          'accepted_answers', v_k.accepted_answers,
          'tm_equiv', v_k.tm_equiv
        ) else null end,
        'response', v_ans.response,
        'fraction', v_ans.fraction,
        'points', case when v_ans.fraction is not null then round(v_ans.fraction * v_q.value, 2) else null end,
        'marked_by', v_ans.marked_by,
        'comment', v_ans.comment
      ));
    end loop;

    v_secs := v_secs || jsonb_build_array(jsonb_build_object(
      'id', v_sec.id,
      'title', v_sec.title,
      'title_ar', v_sec.title_ar,
      'format', v_sec.format,
      'weight', v_sec.weight,
      'questions', v_qs
    ));
  end loop;

  return jsonb_build_object(
    'ok', true,
    'sections', v_secs
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Grants to anon
-- ---------------------------------------------------------------------------------------------
grant execute on function public.exam_get_result(uuid, text) to anon;
grant execute on function public.exam_get_review(uuid, text) to anon;

-- ---------------------------------------------------------------------------------------------
-- 4. Post-conditions
-- ---------------------------------------------------------------------------------------------
do $$
begin
  assert has_function_privilege('anon', 'public.exam_get_result(uuid, text)', 'execute'), 'anon cannot call exam_get_result';
  assert has_function_privilege('anon', 'public.exam_get_review(uuid, text)', 'execute'), 'anon cannot call exam_get_review';
  raise notice '031_review_rpcs applied and verified.';
end $$;
