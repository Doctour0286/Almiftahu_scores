-- 061_fix_exam_get_result.sql
-- Corrective migration. 031 shipped exam_get_result with `s.format` inside the per-section aggregate,
-- but the loop variable is `v_sec` (the alias `s` only exists in the loop's own SELECT). Any student whose
-- attempt existed hit "missing FROM-clause entry for table s" and could not open their result.
-- Found by running tests/sql/phase2_codes_student.test.sql on a fresh database (session 20); the anon probe
-- cannot see it because it only proves access is DENIED. Same signature, same grant, same return shape.
-- Idempotent (create or replace). 031 has been fixed in place too, so fresh builds are correct.

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
        count(*) filter (where v_sec.format = 'essay' and an.fraction is null)
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

revoke all on function public.exam_get_result(uuid, text) from public;
grant execute on function public.exam_get_result(uuid, text) to anon;

do $$ begin
  assert has_function_privilege('anon', 'public.exam_get_result(uuid, text)', 'execute'), '061: anon lost exam_get_result';
  assert position('filter (where s.format' in pg_get_functiondef('public.exam_get_result(uuid, text)'::regprocedure)) = 0, '061: buggy reference still present';
  raise notice '061 applied and verified: exam_get_result fixed.';
end $$;
