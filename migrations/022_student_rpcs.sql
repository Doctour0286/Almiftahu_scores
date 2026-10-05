-- 022_student_rpcs.sql (Phase 2, task 2.3)
-- Student-facing exam RPCs: exam_check, exam_start, exam_get_paper, exam_save_answers,
-- exam_log_event, exam_submit, and exam_get_result. All callable by anon under strict checks.

-- =============================================================================
-- 1. Helper: verify student code + enrollment lockout
-- =============================================================================

create or replace function private.verify_student_code(p_enrollment_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_key text := 'enr:' || p_enrollment_id::text;
  v_norm_code text;
  v_hash text;
  v_thr record;
  v_now timestamptz := now();
  v_wait int;
begin
  -- 1. Check throttle row
  select * into v_thr from private.throttle where key = v_key;
  if found and v_thr.locked_until is not null and v_thr.locked_until > v_now then
    v_wait := ceil(extract(epoch from (v_thr.locked_until - v_now)) / 60.0)::int;
    return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', v_wait::text);
  end if;

  -- 2. Normalize code: remove spaces, hyphens, uppercase
  v_norm_code := upper(regexp_replace(coalesce(p_code, ''), '[\s-]+', '', 'g'));
  if v_norm_code = '' then
    return jsonb_build_object('ok', false, 'error', 'E_AUTH');
  end if;

  -- 3. Lookup active code hash
  select code_hash into v_hash from private.exam_codes
  where enrollment_id = p_enrollment_id and status = 'active';

  if not found or extensions.crypt(v_norm_code, v_hash) <> v_hash then
    -- Failed verification: increment throttle counter
    insert into private.throttle (key, failed_attempts, last_attempt_at)
    values (v_key, 1, v_now)
    on conflict (key) do update set
      failed_attempts = case
        when private.throttle.locked_until is not null and private.throttle.locked_until <= v_now then 1
        else private.throttle.failed_attempts + 1 end,
      last_attempt_at = v_now,
      locked_until = case
        when private.throttle.failed_attempts + 1 >= 5 then v_now + interval '10 minutes'
        else null end;

    select * into v_thr from private.throttle where key = v_key;
    if v_thr.locked_until is not null and v_thr.locked_until > v_now then
      return jsonb_build_object('ok', false, 'error', 'E_LOCKED', 'detail', '10');
    end if;
    return jsonb_build_object('ok', false, 'error', 'E_AUTH');
  end if;

  -- Successful verification: clear throttle row
  delete from private.throttle where key = v_key;
  return jsonb_build_object('ok', true);
end $$;

-- =============================================================================
-- 2. Student RPCs
-- =============================================================================

-- Step 1: Check code and get exam instructions / attempt state
create or replace function public.exam_check(p_enrollment_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_chk jsonb;
  v_enr public.enrollments;
  v_course public.courses;
  v_ver private.exam_versions;
  v_att private.attempts;
  v_res public.enrollment_results;
  v_state text;
  v_now timestamptz := now();
  v_rem int := null;
  v_qcount int;
  v_scount int;
begin
  v_chk := private.verify_student_code(p_enrollment_id, p_code);
  if not (v_chk->>'ok')::boolean then return v_chk; end if;

  select * into v_enr from public.enrollments where id = p_enrollment_id;
  if not found or not v_enr.active then return jsonb_build_object('ok', false, 'error', 'E_AUTH'); end if;

  select * into v_course from public.courses where id = v_enr.course_id;
  if not found or not v_course.exam_live then
    return jsonb_build_object('ok', false, 'error', 'E_NO_LIVE_EXAM');
  end if;

  select * into v_res from public.enrollment_results where enrollment_id = p_enrollment_id;
  if v_res.status = 'not_eligible' then
    return jsonb_build_object('ok', false, 'error', 'E_NOT_ELIGIBLE');
  end if;

  -- Find live version
  select v.* into v_ver from private.exam_versions v
  join private.exams ex on ex.id = v.exam_id
  where ex.course_id = v_course.id and v.status = 'live';

  if not found then return jsonb_build_object('ok', false, 'error', 'E_NO_LIVE_EXAM'); end if;

  select count(distinct q.id), count(distinct s.id) into v_qcount, v_scount
  from private.sections s
  left join private.questions q on q.section_id = s.id
  where s.version_id = v_ver.id;

  select * into v_att from private.attempts where enrollment_id = p_enrollment_id and not superseded;
  if not found then
    v_state := 'not_started';
  elsif v_att.status = 'in_progress' then
    if v_att.deadline_at + interval '15 seconds' < v_now then
      perform private.grade_attempt(v_att.id);
      v_state := 'submitted';
    else
      v_state := 'in_progress';
      v_rem := greatest(0, floor(extract(epoch from (v_att.deadline_at - v_now))))::int;
    end if;
  else
    v_state := v_att.status;
  end if;

  return jsonb_build_object(
    'ok', true,
    'state', v_state,
    'remaining_seconds', v_rem,
    'exam', jsonb_build_object(
      'title', v_ver.title,
      'title_ar', v_ver.title_ar,
      'duration_minutes', v_ver.duration_minutes,
      'instructions', v_ver.instructions,
      'instructions_ar', v_ver.instructions_ar,
      'question_count', v_qcount,
      'section_count', v_scount
    )
  );
end $$;

-- Step 2: Start or resume exam sitting (returns attempt_token)
create or replace function public.exam_start(p_enrollment_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_chk jsonb;
  v_enr public.enrollments;
  v_course public.courses;
  v_ver private.exam_versions;
  v_att private.attempts;
  v_token text;
  v_token_hash text;
  v_deadline timestamptz;
  v_now timestamptz := now();
begin
  v_chk := private.verify_student_code(p_enrollment_id, p_code);
  if not (v_chk->>'ok')::boolean then return v_chk; end if;

  select * into v_enr from public.enrollments where id = p_enrollment_id;
  select * into v_course from public.courses where id = v_enr.course_id;

  select * into v_att from private.attempts where enrollment_id = p_enrollment_id and not superseded for update;
  if found and v_att.status in ('submitted', 'finalized') then
    perform private.fail('E_ATTEMPT_EXISTS', 'You have already submitted this exam.');
  end if;

  -- Generate new attempt session token
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_token_hash := extensions.crypt(v_token, extensions.gen_salt('bf', 8));

  if found and v_att.status = 'in_progress' then
    -- Resuming existing attempt
    if v_att.deadline_at + interval '15 seconds' < v_now then
      perform private.grade_attempt(v_att.id);
      perform private.fail('E_EXPIRED', 'Exam time has expired.');
    end if;
    update private.attempts set token_hash = v_token_hash where id = v_att.id;
    v_deadline := v_att.deadline_at;
  else
    -- Creating a new attempt
    select v.* into v_ver from private.exam_versions v
    join private.exams ex on ex.id = v.exam_id
    where ex.course_id = v_course.id and v.status = 'live';

    if not found then perform private.fail('E_NO_LIVE_EXAM', 'No live exam.'); end if;

    v_deadline := v_now + (v_ver.duration_minutes || ' minutes')::interval;

    insert into private.attempts (enrollment_id, version_id, token_hash, deadline_at, status)
    values (p_enrollment_id, v_ver.id, v_token_hash, v_deadline, 'in_progress')
    returning * into v_att;

    -- Pre-create answers rows for questions
    insert into private.answers (attempt_id, question_id)
    select v_att.id, q.id
    from private.questions q
    join private.sections s on s.id = q.section_id
    where s.version_id = v_ver.id;

    perform private.recompute_result(p_enrollment_id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'attempt_token', v_token,
    'deadline_at', v_deadline,
    'server_now', v_now
  );
end $$;

-- Helper to find attempt by token
create or replace function private.attempt_by_token(p_token text)
returns private.attempts language plpgsql security definer set search_path = public, private, extensions as $$
declare
  r record;
begin
  if p_token is null or length(p_token) < 20 then
    perform private.fail('E_SESSION_REPLACED', 'Invalid session.');
  end if;
  for r in select * from private.attempts where status = 'in_progress' and not superseded loop
    if extensions.crypt(p_token, r.token_hash) = r.token_hash then
      return r;
    end if;
  end loop;
  perform private.fail('E_SESSION_REPLACED', 'Session expired or resumed elsewhere.');
end $$;

-- Step 3: Get exam paper (questions & shuffled options without keys)
create or replace function public.exam_get_paper(p_attempt_token text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_att private.attempts;
  v_sec record;
  v_q record;
  v_ans record;
  v_secs jsonb := '[]'::jsonb;
  v_qs jsonb;
  v_answers jsonb := '{}'::jsonb;
  v_flags jsonb := '{}'::jsonb;
  v_now timestamptz := now();
begin
  v_att := private.attempt_by_token(p_attempt_token);

  if v_att.deadline_at + interval '15 seconds' < v_now then
    update private.attempts set status = 'submitted', submitted_at = v_att.deadline_at where id = v_att.id;
    perform private.grade_attempt(v_att.id);
    perform private.fail('E_EXPIRED', 'Time has expired.');
  end if;

  -- Load existing answers and flags
  for v_ans in select question_id, response, flagged from private.answers where attempt_id = v_att.id loop
    if v_ans.response is not null then
      v_answers := v_answers || jsonb_build_object(v_ans.question_id::text, v_ans.response);
    end if;
    if v_ans.flagged then
      v_flags := v_flags || jsonb_build_object(v_ans.question_id::text, true);
    end if;
  end loop;

  -- Build sections with questions
  for v_sec in
    select id, title, title_ar, format, weight
    from private.sections
    where version_id = v_att.version_id
    order by position
  loop
    v_qs := '[]'::jsonb;
    for v_q in
      select id, prompt, note, options
      from private.questions
      where section_id = v_sec.id
      order by position
    loop
      v_qs := v_qs || jsonb_build_array(jsonb_build_object(
        'id', v_q.id,
        'prompt', v_q.prompt,
        'options', v_q.options
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
    'deadline_at', v_att.deadline_at,
    'server_now', v_now,
    'sections', v_secs,
    'answers', v_answers,
    'flags', v_flags
  );
end $$;

-- Step 4: Autosave answers batch
create or replace function public.exam_save_answers(p_attempt_token text, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_att private.attempts;
  a jsonb;
  v_qid uuid;
  v_resp jsonb;
  v_flag boolean;
  v_now timestamptz := now();
begin
  v_att := private.attempt_by_token(p_attempt_token);

  if v_now > v_att.deadline_at + interval '15 seconds' then
    perform private.fail('E_ATTEMPT_CLOSED', 'Exam time has expired.');
  end if;

  if jsonb_typeof(p_answers) <> 'array' then
    perform private.fail('E_VALIDATION', 'Answers must be sent as a list.');
  end if;

  for a in select * from jsonb_array_elements(p_answers) loop
    v_qid := (a->>'question_id')::uuid;
    v_resp := a->'response';
    v_flag := coalesce((a->>'flagged')::boolean, false);

    update private.answers set
      response = v_resp,
      flagged = v_flag,
      updated_at = v_now
    where attempt_id = v_att.id and question_id = v_qid;
  end loop;

  return jsonb_build_object('ok', true, 'saved_at', v_now);
end $$;

-- Step 5: Log tab leave/return event
create or replace function public.exam_log_event(p_attempt_token text, p_type text)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_att private.attempts;
  v_count int;
begin
  if p_type not in ('left', 'returned') then return; end if;
  v_att := private.attempt_by_token(p_attempt_token);

  select count(*) into v_count from private.attempt_events where attempt_id = v_att.id;
  if v_count < 200 then
    insert into private.attempt_events (attempt_id, type) values (v_att.id, p_type);
  end if;
end $$;

-- Step 6: Submit exam
create or replace function public.exam_submit(p_attempt_token text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_att private.attempts;
  v_pending boolean;
begin
  v_att := private.attempt_by_token(p_attempt_token);

  update private.attempts set
    status = 'submitted',
    submitted_at = coalesce(submitted_at, now())
  where id = v_att.id;

  perform private.grade_attempt(v_att.id);

  select exists (select 1 from private.answers where attempt_id = v_att.id and fraction is null)
  into v_pending;

  return jsonb_build_object(
    'ok', true,
    'status', case when v_pending then 'submitted' else 'finalized' end,
    'pending_marking', v_pending
  );
end $$;

-- Step 7: Get student results
create or replace function public.exam_get_result(p_enrollment_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_chk jsonb;
  v_res public.enrollment_results;
  v_att private.attempts;
begin
  v_chk := private.verify_student_code(p_enrollment_id, p_code);
  if not (v_chk->>'ok')::boolean then return v_chk; end if;

  select * into v_res from public.enrollment_results where enrollment_id = p_enrollment_id;
  if not found then perform private.fail('E_NOT_FOUND', 'Result not found.'); end if;

  select * into v_att from private.attempts where enrollment_id = p_enrollment_id and not superseded;

  return jsonb_build_object(
    'status', v_res.status,
    'lesson_pct', v_res.lesson_pct,
    'exam_pct', v_res.exam_pct,
    'final', v_res.final,
    'passed', v_res.passed,
    'band_label', v_res.band_label,
    'band_label_ar', v_res.band_label_ar,
    'has_certificate', v_res.has_certificate
  );
end $$;

grant execute on function public.exam_check(uuid, text) to anon;
grant execute on function public.exam_start(uuid, text) to anon;
grant execute on function public.exam_get_paper(text) to anon;
grant execute on function public.exam_save_answers(text, jsonb) to anon;
grant execute on function public.exam_log_event(text, text) to anon;
grant execute on function public.exam_submit(text) to anon;
grant execute on function public.exam_get_result(uuid, text) to anon;

do $$
begin
  raise notice '022_student_rpcs applied and verified.';
end $$;
