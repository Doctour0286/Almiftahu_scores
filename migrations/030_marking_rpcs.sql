-- 030_marking_rpcs.sql (Phase 3, Task 3.1)
-- Teacher marking, essay evaluation, fill-in review, key correction, and exam results.
-- All admin_* RPCs require teacher token (require_teacher), validate inputs, and are granted to anon.

-- ---------------------------------------------------------------------------------------------
-- 1. Helper: calculate total time away in seconds from attempt_events
-- ---------------------------------------------------------------------------------------------
create or replace function private.calc_time_away_seconds(p_attempt_id uuid)
returns int language plpgsql stable security definer set search_path = public, private, extensions as $$
declare
  r record;
  v_left_at timestamptz := null;
  v_total interval := interval '0 seconds';
  v_submitted_at timestamptz;
begin
  select submitted_at into v_submitted_at from private.attempts where id = p_attempt_id;
  for r in select type, at from private.attempt_events where attempt_id = p_attempt_id order by id loop
    if r.type = 'left' and v_left_at is null then
      v_left_at := r.at;
    elsif r.type = 'returned' and v_left_at is not null then
      v_total := v_total + (r.at - v_left_at);
      v_left_at := null;
    end if;
  end loop;
  if v_left_at is not null then
    v_total := v_total + (coalesce(v_submitted_at, now()) - v_left_at);
  end if;
  return greatest(0, floor(extract(epoch from v_total)))::int;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. admin_marking_overview: essay queue counts and fill questions with unmatched counts
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_marking_overview(p_token text, p_course_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, extensions as $$
declare
  v_essays jsonb := '[]'::jsonb;
  v_fills jsonb := '[]'::jsonb;
  r record;
begin
  perform private.require_teacher(p_token);

  -- Check course exists
  if not exists (select 1 from public.courses where id = p_course_id) then
    perform private.fail('E_NOT_FOUND', 'Course not found.');
  end if;

  -- Essay questions with counts
  for r in
    select
      v.id as version_id,
      v.version_no,
      s.title as section_title,
      q.id as question_id,
      q.prompt,
      coalesce(qv.value, 0) as value,
      count(an.attempt_id) filter (where a.id is not null) as submitted_count,
      count(an.attempt_id) filter (where an.fraction is not null) as marked_count,
      count(an.attempt_id) filter (where an.fraction is null) as pending_count
    from private.exams ex
    join private.exam_versions v on v.exam_id = ex.id
    join private.sections s on s.version_id = v.id and s.format = 'essay'
    join private.questions q on q.section_id = s.id
    left join private.v_question_values qv on qv.version_id = v.id and qv.question_id = q.id
    left join private.attempts a on a.version_id = v.id and not a.superseded and a.status in ('submitted', 'finalized')
    left join private.answers an on an.attempt_id = a.id and an.question_id = q.id
    where ex.course_id = p_course_id
      and v.status in ('live', 'retired')
    group by v.id, v.version_no, s.title, s.position, q.id, q.prompt, q.position, qv.value
    order by v.version_no desc, s.position, q.position
  loop
    v_essays := v_essays || jsonb_build_array(jsonb_build_object(
      'version_id', r.version_id,
      'version_no', r.version_no,
      'section_title', r.section_title,
      'question_id', r.question_id,
      'prompt', r.prompt,
      'value', r.value,
      'submitted_count', r.submitted_count,
      'marked_count', r.marked_count,
      'pending_count', r.pending_count
    ));
  end loop;

  -- Fill-in questions with count of distinct unmatched student responses
  for r in
    select
      v.id as version_id,
      v.version_no,
      s.title as section_title,
      q.id as question_id,
      q.prompt,
      coalesce(count(distinct lower(btrim(an.response->>'text')))
        filter (where a.id is not null
                  and coalesce(btrim(an.response->>'text'), '') <> ''
                  and coalesce(an.fraction, 0) = 0
                  and an.marked_by is distinct from 'teacher'), 0) as unmatched_count
    from private.exams ex
    join private.exam_versions v on v.exam_id = ex.id
    join private.sections s on s.version_id = v.id and s.format = 'fill'
    join private.questions q on q.section_id = s.id
    left join private.attempts a on a.version_id = v.id and not a.superseded and a.status in ('submitted', 'finalized')
    left join private.answers an on an.attempt_id = a.id and an.question_id = q.id
    where ex.course_id = p_course_id
      and v.status in ('live', 'retired')
    group by v.id, v.version_no, s.title, s.position, q.id, q.prompt, q.position
    order by v.version_no desc, s.position, q.position
  loop
    v_fills := v_fills || jsonb_build_array(jsonb_build_object(
      'version_id', r.version_id,
      'version_no', r.version_no,
      'section_title', r.section_title,
      'question_id', r.question_id,
      'prompt', r.prompt,
      'unmatched_count', r.unmatched_count
    ));
  end loop;

  return jsonb_build_object('essays', v_essays, 'fills', v_fills);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. admin_essay_answers: submitted attempts' answers for a given essay question
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_essay_answers(p_token text, p_question_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, extensions as $$
declare
  v_q record;
  v_out jsonb := '[]'::jsonb;
  r record;
begin
  perform private.require_teacher(p_token);

  select q.*, s.format, s.version_id, coalesce(qv.value, 0) as value
  into v_q
  from private.questions q
  join private.sections s on s.id = q.section_id
  left join private.v_question_values qv on qv.version_id = s.version_id and qv.question_id = q.id
  where q.id = p_question_id;

  if not found then perform private.fail('E_NOT_FOUND', 'Question not found.'); end if;
  if v_q.format <> 'essay' then perform private.fail('E_VALIDATION', 'Question is not an essay.'); end if;

  for r in
    select
      a.id as attempt_id,
      e.id as enrollment_id,
      e.sn,
      st.name as student_name,
      st.name_ar as student_name_ar,
      coalesce(an.response->>'text', '') as text,
      an.fraction,
      case when an.fraction is not null then round(an.fraction * v_q.value, 2) else null end as points,
      v_q.value as max_points,
      an.marked_by,
      an.marked_at,
      an.comment,
      a.submitted_at
    from private.attempts a
    join public.enrollments e on e.id = a.enrollment_id
    join public.students st on st.id = e.student_id
    left join private.answers an on an.attempt_id = a.id and an.question_id = p_question_id
    where a.version_id = v_q.version_id
      and not a.superseded
      and a.status in ('submitted', 'finalized')
    order by case when an.fraction is null then 0 else 1 end, e.sn
  loop
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'attempt_id', r.attempt_id,
      'enrollment_id', r.enrollment_id,
      'sn', r.sn,
      'student_name', r.student_name,
      'student_name_ar', r.student_name_ar,
      'text', r.text,
      'fraction', r.fraction,
      'points', r.points,
      'max_points', r.max_points,
      'marked_by', r.marked_by,
      'marked_at', r.marked_at,
      'comment', r.comment,
      'submitted_at', r.submitted_at
    ));
  end loop;

  return jsonb_build_object(
    'question', jsonb_build_object(
      'id', v_q.id,
      'prompt', v_q.prompt,
      'note', v_q.note,
      'max_points', v_q.value
    ),
    'answers', v_out
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. admin_mark_answer: award points to an essay (or override any question mark), try_finalize
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_mark_answer(
  p_token text,
  p_attempt_id uuid,
  p_question_id uuid,
  p_points numeric,
  p_comment text default null
)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_att private.attempts;
  v_val numeric;
  v_fraction numeric;
begin
  perform private.require_teacher(p_token);

  select * into v_att from private.attempts where id = p_attempt_id;
  if not found then perform private.fail('E_NOT_FOUND', 'Attempt not found.'); end if;

  select value into v_val from private.v_question_values
  where version_id = v_att.version_id and question_id = p_question_id;
  if not found then perform private.fail('E_NOT_FOUND', 'Question not found in this exam version.'); end if;

  -- Validate points
  if p_points is null or p_points < 0 then
    perform private.fail('E_VALIDATION', 'Points cannot be negative.');
  end if;

  -- Convert points to fraction (0..1)
  if v_val > 0 then
    v_fraction := greatest(0::numeric, least(1::numeric, p_points / v_val));
  else
    v_fraction := 1::numeric;
  end if;

  -- Store mark
  insert into private.answers (attempt_id, question_id, fraction, marked_by, marked_at, comment)
  values (p_attempt_id, p_question_id, v_fraction, 'teacher', now(), nullif(trim(p_comment), ''))
  on conflict (attempt_id, question_id) do update set
    fraction = excluded.fraction,
    marked_by = 'teacher',
    marked_at = now(),
    comment = excluded.comment;

  -- Trigger finalization check and recompute result
  perform private.try_finalize(p_attempt_id);

  select * into v_att from private.attempts where id = p_attempt_id;

  return jsonb_build_object(
    'ok', true,
    'fraction', v_fraction,
    'points', round(v_fraction * v_val, 2),
    'max_points', v_val,
    'status', v_att.status
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. admin_fill_review: distinct unmatched answers for a fill-in question
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_fill_review(p_token text, p_question_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, extensions as $$
declare
  v_q record;
  v_k record;
  v_out jsonb := '[]'::jsonb;
  r record;
begin
  perform private.require_teacher(p_token);

  select q.*, s.format, s.version_id into v_q
  from private.questions q
  join private.sections s on s.id = q.section_id
  where q.id = p_question_id;

  if not found then perform private.fail('E_NOT_FOUND', 'Question not found.'); end if;
  if v_q.format <> 'fill' then perform private.fail('E_VALIDATION', 'Question is not fill-in-the-blank.'); end if;

  select * into v_k from private.question_keys where question_id = p_question_id;

  for r in
    select
      coalesce(btrim(an.response->>'text'), '') as raw_text,
      count(*) as cnt
    from private.answers an
    join private.attempts a on a.id = an.attempt_id
    where an.question_id = p_question_id
      and not a.superseded
      and a.status in ('submitted', 'finalized')
      and coalesce(btrim(an.response->>'text'), '') <> ''
      and coalesce(an.fraction, 0) = 0
      and an.marked_by is distinct from 'teacher'
    group by coalesce(btrim(an.response->>'text'), '')
    order by count(*) desc, raw_text
  loop
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'text', r.raw_text,
      'count', r.cnt
    ));
  end loop;

  return jsonb_build_object(
    'question_id', v_q.id,
    'prompt', v_q.prompt,
    'accepted_answers', coalesce(v_k.accepted_answers, '{}'::text[]),
    'tm_equiv', coalesce(v_k.tm_equiv, false),
    'unmatched', v_out
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 6. admin_accept_fill_answer: append accepted answer, re-grade non-teacher answers in version
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_accept_fill_answer(
  p_token text,
  p_question_id uuid,
  p_text text
)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_q record;
  v_k record;
  v_norm text;
  v_acc text[];
  r record;
begin
  perform private.require_teacher(p_token);

  v_norm := btrim(coalesce(p_text, ''));
  if v_norm = '' then perform private.fail('E_VALIDATION', 'Accepted answer text cannot be empty.'); end if;

  select q.*, s.version_id, s.format into v_q
  from private.questions q
  join private.sections s on s.id = q.section_id
  where q.id = p_question_id;

  if not found then perform private.fail('E_NOT_FOUND', 'Question not found.'); end if;
  if v_q.format <> 'fill' then perform private.fail('E_VALIDATION', 'Question is not fill-in-the-blank.'); end if;

  select * into v_k from private.question_keys where question_id = p_question_id;
  v_acc := coalesce(v_k.accepted_answers, '{}'::text[]);

  if not (v_norm = any(v_acc)) then
    v_acc := array_append(v_acc, v_norm);
    update private.question_keys set accepted_answers = v_acc where question_id = p_question_id;
  end if;

  -- Re-grade auto-marked answers for this question across all attempts in this version
  update private.answers an set
    fraction = private.grade_fill(an.response->>'text', v_acc, v_k.tm_equiv),
    marked_by = 'auto',
    marked_at = now()
  from private.attempts a
  where an.attempt_id = a.id
    and a.version_id = v_q.version_id
    and an.question_id = p_question_id
    and not a.superseded
    and an.marked_by is distinct from 'teacher';

  -- Re-evaluate finalization for every affected attempt
  for r in
    select distinct a.id
    from private.attempts a
    join private.answers an on an.attempt_id = a.id
    where a.version_id = v_q.version_id
      and an.question_id = p_question_id
      and not a.superseded
      and a.status in ('submitted', 'finalized')
  loop
    perform private.try_finalize(r.id);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'question_id', p_question_id,
    'accepted_answers', v_acc
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 7. admin_correct_key: update key on live/retired version, re-grade auto-marked answers (AC-3.4)
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_correct_key(
  p_token text,
  p_question_id uuid,
  p_new_key jsonb,
  p_confirm boolean default false
)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_q record;
  v_s record;
  v_k record;
  v_count int;
  v_opts text[];
  v_arr text[];
  r record;
begin
  perform private.require_teacher(p_token);

  select q.*, s.format, s.version_id into v_q
  from private.questions q
  join private.sections s on s.id = q.section_id
  where q.id = p_question_id;

  if not found then perform private.fail('E_NOT_FOUND', 'Question not found.'); end if;

  select * into v_s from private.exam_versions where id = v_q.version_id;
  if v_s.status = 'draft' then
    perform private.fail('E_VALIDATION', 'Key correction is for live/retired versions. Edit the draft instead.');
  end if;

  select * into v_k from private.question_keys where question_id = p_question_id;

  -- Count affected attempts (where answer was auto-marked)
  select count(distinct a.id) into v_count
  from private.attempts a
  join private.answers an on an.attempt_id = a.id
  where a.version_id = v_q.version_id
    and an.question_id = p_question_id
    and not a.superseded
    and a.status in ('submitted', 'finalized')
    and an.marked_by is distinct from 'teacher';

  if not coalesce(p_confirm, false) then
    perform private.fail('E_CONFIRM_REQUIRED', v_count::text);
  end if;

  -- Apply key changes based on question format
  if v_q.format in ('mcq', 'tf') then
    if not (p_new_key ? 'correct_option_ids') then
      perform private.fail('E_VALIDATION', 'Missing correct_option_ids.');
    end if;

    v_arr := array(select jsonb_array_elements_text(p_new_key->'correct_option_ids'));
    if v_q.format = 'tf' and cardinality(v_arr) <> 1 then
      perform private.fail('E_VALIDATION', 'True/False requires exactly one correct choice.');
    end if;

    update private.question_keys set correct_option_ids = v_arr where question_id = p_question_id;

    -- Re-grade MCQ / TF
    update private.answers an set
      fraction = private.grade_mcq(
        array(select jsonb_array_elements_text(coalesce(an.response->'selected','[]'::jsonb))),
        v_arr),
      marked_by = 'auto',
      marked_at = now()
    from private.attempts a
    where an.attempt_id = a.id
      and a.version_id = v_q.version_id
      and an.question_id = p_question_id
      and not a.superseded
      and an.marked_by is distinct from 'teacher';

  elsif v_q.format = 'fill' then
    if not (p_new_key ? 'accepted_answers') then
      perform private.fail('E_VALIDATION', 'Missing accepted_answers.');
    end if;

    v_arr := array(select jsonb_array_elements_text(p_new_key->'accepted_answers'));
    update private.question_keys set
      accepted_answers = v_arr,
      tm_equiv = coalesce((p_new_key->>'tm_equiv')::boolean, tm_equiv)
    where question_id = p_question_id;

    select * into v_k from private.question_keys where question_id = p_question_id;

    -- Re-grade Fill
    update private.answers an set
      fraction = private.grade_fill(an.response->>'text', v_k.accepted_answers, v_k.tm_equiv),
      marked_by = 'auto',
      marked_at = now()
    from private.attempts a
    where an.attempt_id = a.id
      and a.version_id = v_q.version_id
      and an.question_id = p_question_id
      and not a.superseded
      and an.marked_by is distinct from 'teacher';
  else
    perform private.fail('E_VALIDATION', 'Cannot correct key on essay questions.');
  end if;

  -- Re-finalize each affected attempt
  for r in
    select distinct a.id
    from private.attempts a
    join private.answers an on an.attempt_id = a.id
    where a.version_id = v_q.version_id
      and an.question_id = p_question_id
      and not a.superseded
      and a.status in ('submitted', 'finalized')
  loop
    perform private.try_finalize(r.id);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'question_id', p_question_id,
    'affected_attempts', v_count
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 8. admin_attempt_detail: full attempt inspector with questions, keys, answers, and event log
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_attempt_detail(p_token text, p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, extensions as $$
declare
  v_att record;
  v_secs jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_sec record;
  v_q record;
  v_qs jsonb;
  v_ans record;
  v_k record;
  r record;
  v_leaves int := 0;
  v_away_sec int := 0;
begin
  perform private.require_teacher(p_token);

  select
    a.*,
    e.sn,
    st.name as student_name,
    st.name_ar as student_name_ar,
    er.status as result_status,
    er.lesson_pct,
    er.exam_pct,
    er.final,
    er.passed,
    er.band_label,
    er.band_label_ar,
    v.version_no
  into v_att
  from private.attempts a
  join public.enrollments e on e.id = a.enrollment_id
  join public.students st on st.id = e.student_id
  left join public.enrollment_results er on er.enrollment_id = e.id
  join private.exam_versions v on v.id = a.version_id
  where a.id = p_attempt_id;

  if not found then perform private.fail('E_NOT_FOUND', 'Attempt not found.'); end if;

  -- Sections and questions
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
      select * into v_ans from private.answers where attempt_id = p_attempt_id and question_id = v_q.id;
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
        'marked_at', v_ans.marked_at,
        'comment', v_ans.comment,
        'flagged', coalesce(v_ans.flagged, false)
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

  -- Attempt events
  for r in select id, type, at from private.attempt_events where attempt_id = p_attempt_id order by id loop
    if r.type = 'left' then v_leaves := v_leaves + 1; end if;
    v_events := v_events || jsonb_build_array(jsonb_build_object(
      'id', r.id,
      'type', r.type,
      'at', r.at
    ));
  end loop;

  v_away_sec := private.calc_time_away_seconds(p_attempt_id);

  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_att.id,
      'enrollment_id', v_att.enrollment_id,
      'sn', v_att.sn,
      'student_name', v_att.student_name,
      'student_name_ar', v_att.student_name_ar,
      'version_id', v_att.version_id,
      'version_no', v_att.version_no,
      'status', v_att.status,
      'started_at', v_att.started_at,
      'submitted_at', v_att.submitted_at,
      'deadline_at', v_att.deadline_at,
      'result_status', v_att.result_status,
      'lesson_pct', v_att.lesson_pct,
      'exam_pct', v_att.exam_pct,
      'final', v_att.final,
      'passed', v_att.passed,
      'band_label', v_att.band_label,
      'band_label_ar', v_att.band_label_ar,
      'tab_leaves', v_leaves,
      'time_away_seconds', v_away_sec
    ),
    'sections', v_secs,
    'events', v_events
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 9. admin_results: results table and CSV export rows (FR-M7)
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_results(p_token text, p_course_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, extensions as $$
declare
  v_out jsonb := '[]'::jsonb;
  r record;
begin
  perform private.require_teacher(p_token);

  if not exists (select 1 from public.courses where id = p_course_id) then
    perform private.fail('E_NOT_FOUND', 'Course not found.');
  end if;

  for r in
    select
      e.id as enrollment_id,
      e.student_id,
      e.sn,
      st.name,
      st.name_ar,
      coalesce(er.status, 'not_started') as status,
      er.lesson_pct,
      er.exam_pct,
      er.final,
      er.passed,
      er.band_label,
      er.band_label_ar,
      er.has_certificate,
      a.id as attempt_id,
      a.status as attempt_status,
      a.started_at,
      a.submitted_at,
      coalesce((select count(*) from private.attempt_events ae where ae.attempt_id = a.id and ae.type = 'left'), 0) as tab_leaves,
      case when a.id is not null then private.calc_time_away_seconds(a.id) else 0 end as time_away_seconds
    from public.enrollments e
    join public.students st on st.id = e.student_id
    left join public.enrollment_results er on er.enrollment_id = e.id
    left join private.attempts a on a.enrollment_id = e.id and not a.superseded
    where e.course_id = p_course_id
      and e.active = true
    order by e.sn
  loop
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'enrollment_id', r.enrollment_id,
      'student_id', r.student_id,
      'sn', r.sn,
      'name', r.name,
      'name_ar', r.name_ar,
      'status', r.status,
      'lesson_pct', r.lesson_pct,
      'exam_pct', r.exam_pct,
      'final', r.final,
      'passed', r.passed,
      'band_label', r.band_label,
      'band_label_ar', r.band_label_ar,
      'has_certificate', r.has_certificate,
      'attempt_id', r.attempt_id,
      'attempt_status', r.attempt_status,
      'started_at', r.started_at,
      'submitted_at', r.submitted_at,
      'tab_leaves', r.tab_leaves,
      'time_away_seconds', r.time_away_seconds
    ));
  end loop;

  return v_out;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 10. Explicit grants to anon (since §8.3 revoked execute by default)
-- ---------------------------------------------------------------------------------------------
grant execute on function public.admin_marking_overview(text, uuid) to anon;
grant execute on function public.admin_essay_answers(text, uuid) to anon;
grant execute on function public.admin_attempt_detail(text, uuid) to anon;
grant execute on function public.admin_mark_answer(text, uuid, uuid, numeric, text) to anon;
grant execute on function public.admin_fill_review(text, uuid) to anon;
grant execute on function public.admin_accept_fill_answer(text, uuid, text) to anon;
grant execute on function public.admin_correct_key(text, uuid, jsonb, boolean) to anon;
grant execute on function public.admin_results(text, uuid) to anon;

-- ---------------------------------------------------------------------------------------------
-- 11. Post-conditions
-- ---------------------------------------------------------------------------------------------
do $$
begin
  assert has_function_privilege('anon', 'public.admin_marking_overview(text, uuid)', 'execute'), 'anon cannot call admin_marking_overview';
  assert has_function_privilege('anon', 'public.admin_essay_answers(text, uuid)', 'execute'), 'anon cannot call admin_essay_answers';
  assert has_function_privilege('anon', 'public.admin_attempt_detail(text, uuid)', 'execute'), 'anon cannot call admin_attempt_detail';
  assert has_function_privilege('anon', 'public.admin_mark_answer(text, uuid, uuid, numeric, text)', 'execute'), 'anon cannot call admin_mark_answer';
  assert has_function_privilege('anon', 'public.admin_fill_review(text, uuid)', 'execute'), 'anon cannot call admin_fill_review';
  assert has_function_privilege('anon', 'public.admin_accept_fill_answer(text, uuid, text)', 'execute'), 'anon cannot call admin_accept_fill_answer';
  assert has_function_privilege('anon', 'public.admin_correct_key(text, uuid, jsonb, boolean)', 'execute'), 'anon cannot call admin_correct_key';
  assert has_function_privilege('anon', 'public.admin_results(text, uuid)', 'execute'), 'anon cannot call admin_results';
  raise notice '030_marking_rpcs applied and verified.';
end $$;
