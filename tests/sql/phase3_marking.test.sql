-- Phase 3 tests: teacher marking, essay evaluation, fill-in review, key correction, results (030).
-- Assert-style, ONE transaction, ROLLED BACK at the end. No psql meta-commands: pastes into the Supabase SQL editor.
-- Run AFTER 005 and 010-030. It temporarily replaces the teacher PIN hash; rollback restores it.

begin;

create function pg_temp.msg(q text) returns text language plpgsql as $$
declare m text;
begin execute q; return 'OK';
exception when others then get stacked diagnostics m = message_text; return m; end $$;

-- ---------- fixtures ----------
do $$
declare
  v_cid uuid;
  v_draft uuid;
  v_doc jsonb;
  i int;
  r jsonb;
  code text;
  tok text;
  v_e1 uuid;
  v_e2 uuid;
begin
  -- 1. Setup teacher auth
  update private.secrets set value = extensions.crypt('p3-test-pin', extensions.gen_salt('bf', 4)) where key = 'teacher_pin_hash';
  delete from private.auth_throttle;
  perform set_config('t.tok', public.teacher_login('p3-test-pin')->>'token', false);
  assert length(current_setting('t.tok')) = 64, 'test login failed';

  -- 2. Create test course with 50/50 lessons/exam weight
  insert into public.courses (code, name, eligibility_rule, weight_lessons, weight_exam, pass_mark)
  values ('P3C', 'Phase3 Marking Course', 'open', 50, 50, 60)
  returning id into v_cid;
  perform set_config('t.cid', v_cid::text, false);

  -- 3. Add students
  for i in 1 .. 2 loop
    r := public.admin_add_student(current_setting('t.tok'), v_cid, 'Student ' || i);
    perform set_config('t.e' || i, r->>'enrollment_id', false);
  end loop;

  v_e1 := current_setting('t.e1')::uuid;
  v_e2 := current_setting('t.e2')::uuid;

  -- 4. Publish exam: 1 MCQ (weight 30), 1 Fill (weight 30), 1 Essay (weight 40)
  v_draft := (public.admin_create_draft(current_setting('t.tok'), v_cid)->>'id')::uuid;
  v_doc := $j${
   "title":"Phase 3 Exam","duration_minutes":60,
   "sections":[
    {"id":"10000000-0000-0000-0000-000000000001","title":"MCQ Section","format":"mcq","weight":30,"questions":[
      {"id":"20000000-0000-0000-0000-000000000001","prompt":"What is 2+2?","note":null,
       "options":[{"id":"a","text":"3"},{"id":"b","text":"4"}],"key":{"correct_option_ids":["b"]}}
    ]},
    {"id":"10000000-0000-0000-0000-000000000002","title":"Fill Section","format":"fill","weight":30,"questions":[
      {"id":"20000000-0000-0000-0000-000000000002","prompt":"Capital of Nigeria?","note":null,
       "options":[],"key":{"accepted_answers":["Abuja"],"tm_equiv":false}}
    ]},
    {"id":"10000000-0000-0000-0000-000000000003","title":"Essay Section","format":"essay","weight":40,"questions":[
      {"id":"20000000-0000-0000-0000-000000000003","prompt":"Explain justice.","note":null,
       "options":[],"key":{}}
    ]}
   ]
  }$j$::jsonb;

  perform public.admin_save_draft(current_setting('t.tok'), v_draft, 0, v_doc);
  perform public.admin_publish_version(current_setting('t.tok'), v_draft);

  -- 5. Student 1 sits the exam
  code := (public.admin_generate_code(current_setting('t.tok'), v_e1)->>'code');
  tok := (public.exam_start(v_e1, code)->>'attempt_token');

  -- Student 1 answers: MCQ correct (b), Fill wrong/unmatched (Lagos), Essay non-empty (Justice is fairness)
  perform public.exam_save_answers(tok, jsonb_build_array(
    jsonb_build_object('question_id', '20000000-0000-0000-0000-000000000001', 'response', jsonb_build_object('selected', jsonb_build_array('b'))),
    jsonb_build_object('question_id', '20000000-0000-0000-0000-000000000002', 'response', jsonb_build_object('text', 'Lagos')),
    jsonb_build_object('question_id', '20000000-0000-0000-0000-000000000003', 'response', jsonb_build_object('text', 'Justice is fairness.'))
  ));
  perform public.exam_log_event(tok, 'left');
  perform public.exam_log_event(tok, 'returned');
  perform public.exam_submit(tok);

  -- Student 2 sits the exam: blank essay (auto-graded 0)
  code := (public.admin_generate_code(current_setting('t.tok'), v_e2)->>'code');
  tok := (public.exam_start(v_e2, code)->>'attempt_token');
  perform public.exam_save_answers(tok, jsonb_build_array(
    jsonb_build_object('question_id', '20000000-0000-0000-0000-000000000001', 'response', jsonb_build_object('selected', jsonb_build_array('a'))),
    jsonb_build_object('question_id', '20000000-0000-0000-0000-000000000002', 'response', jsonb_build_object('text', 'Lagos'))
  ));
  perform public.exam_submit(tok);
end $$;

-- ---------- 1. admin_marking_overview ----------
do $$
declare
  tok text := current_setting('t.tok');
  cid uuid := current_setting('t.cid')::uuid;
  res jsonb;
  essay jsonb;
  fill jsonb;
begin
  res := public.admin_marking_overview(tok, cid);
  assert jsonb_array_length(res->'essays') = 1, 'expected 1 essay question';
  assert jsonb_array_length(res->'fills') = 1, 'expected 1 fill question';

  essay := res->'essays'->0;
  -- Student 1 wrote an essay (pending); Student 2 submitted blank (auto-graded 0)
  assert (essay->>'submitted_count')::int = 2, 'submitted count is 2: ' || essay::text;
  assert (essay->>'marked_count')::int = 1, 'marked count is 1 (blank essay auto-marked): ' || essay::text;
  assert (essay->>'pending_count')::int = 1, 'pending count is 1: ' || essay::text;

  fill := res->'fills'->0;
  assert (fill->>'unmatched_count')::int = 1, '1 distinct unmatched answer (Lagos): ' || fill::text;
end $$;

-- ---------- 2. admin_essay_answers ----------
do $$
declare
  tok text := current_setting('t.tok');
  qid uuid := '20000000-0000-0000-0000-000000000003';
  res jsonb;
  ans jsonb;
begin
  res := public.admin_essay_answers(tok, qid);
  assert jsonb_array_length(res->'answers') = 2, 'expected 2 student answers: ' || res::text;
  ans := res->'answers'->0; -- Student 1 should be first (pending first)
  assert ans->>'text' = 'Justice is fairness.', 'student 1 text matches';
  assert ans->>'fraction' is null, 'student 1 is pending marking';
  assert (ans->>'max_points')::numeric = 40.0, 'max points is 40';
end $$;

-- ---------- 3. admin_mark_answer & finalization ----------
do $$
declare
  tok text := current_setting('t.tok');
  e1 uuid := current_setting('t.e1')::uuid;
  att1 uuid;
  qid uuid := '20000000-0000-0000-0000-000000000003';
  r jsonb;
  er record;
begin
  select id into att1 from private.attempts where enrollment_id = e1 and not superseded;

  -- Award 30 out of 40 points (fraction = 0.75)
  r := public.admin_mark_answer(tok, att1, qid, 30, 'Well explained.');
  assert (r->>'ok')::boolean, 'mark answer ok';
  assert (r->>'fraction')::numeric = 0.75, 'fraction is 0.75';
  assert (r->>'points')::numeric = 30.0, 'points awarded is 30.0';
  assert r->>'status' = 'finalized', 'attempt is now finalized';

  -- Verify enrollment_results updated
  select * into er from public.enrollment_results where enrollment_id = e1;
  assert er.status = 'finalized', 'enrollment result is finalized';
  -- MCQ = 30 points (100%), Fill = 0, Essay = 30 points (75% of 40 = 30 points) -> Total Exam = 60%
  assert er.exam_pct = 60.0, 'exam pct is 60.0: ' || coalesce(er.exam_pct::text, 'null');
  -- Course weight: 50% lessons (0) + 50% exam (60) = final 30.0
  assert er.final = 30.0, 'final combined score is 30.0: ' || coalesce(er.final::text, 'null');
end $$;

-- ---------- 4. admin_fill_review & admin_accept_fill_answer ----------
do $$
declare
  tok text := current_setting('t.tok');
  e1 uuid := current_setting('t.e1')::uuid;
  qid uuid := '20000000-0000-0000-0000-000000000002';
  rev jsonb;
  r jsonb;
  er record;
begin
  rev := public.admin_fill_review(tok, qid);
  assert jsonb_array_length(rev->'unmatched') = 1, '1 unmatched entry: ' || rev::text;
  assert rev->'unmatched'->0->>'text' = 'Lagos', 'unmatched text is Lagos';
  assert (rev->'unmatched'->0->>'count')::int = 2, 'both students answered Lagos';

  -- Accept "Lagos" as valid alternative answer
  r := public.admin_accept_fill_answer(tok, qid, 'Lagos');
  assert (r->>'ok')::boolean, 'accept fill answer ok';

  -- Student 1 recomputed: Fill now gives 30 points (100%) -> Total Exam = 30 + 30 + 30 = 90%
  select * into er from public.enrollment_results where enrollment_id = e1;
  assert er.exam_pct = 90.0, 're-graded exam pct is 90.0: ' || coalesce(er.exam_pct::text, 'null');
  assert er.final = 45.0, 're-graded final score is 45.0: ' || coalesce(er.final::text, 'null');
end $$;

-- ---------- 5. admin_correct_key (AC-3.4) ----------
do $$
declare
  tok text := current_setting('t.tok');
  qid uuid := '20000000-0000-0000-0000-000000000001'; -- MCQ question
  m text;
  r jsonb;
begin
  -- Without confirm, raises E_CONFIRM_REQUIRED
  m := null;
  begin
    perform public.admin_correct_key(tok, qid, jsonb_build_object('correct_option_ids', jsonb_build_array('a')), false);
  exception when others then get stacked diagnostics m = message_text;
  end;
  assert m = 'E_CONFIRM_REQUIRED', 'refuses key correction without confirmation: ' || coalesce(m, 'null');

  -- With confirm = true
  r := public.admin_correct_key(tok, qid, jsonb_build_object('correct_option_ids', jsonb_build_array('a')), true);
  assert (r->>'ok')::boolean and (r->>'affected_attempts')::int = 2, 'key corrected with confirm';
end $$;

-- ---------- 6. admin_attempt_detail & admin_results ----------
do $$
declare
  tok text := current_setting('t.tok');
  cid uuid := current_setting('t.cid')::uuid;
  e1 uuid := current_setting('t.e1')::uuid;
  att1 uuid;
  det jsonb;
  res jsonb;
begin
  select id into att1 from private.attempts where enrollment_id = e1 and not superseded;

  det := public.admin_attempt_detail(tok, att1);
  assert det ? 'attempt' and det ? 'sections' and det ? 'events', 'attempt detail structure ok';
  assert (det->'attempt'->>'tab_leaves')::int = 1, '1 tab leave recorded';
  assert jsonb_array_length(det->'sections') = 3, '3 sections present';

  res := public.admin_results(tok, cid);
  assert jsonb_array_length(res) = 2, 'results table has 2 rows';
  assert res->0->>'status' in ('submitted', 'finalized'), 'row has status';
  assert res->0 ? 'time_away_seconds', 'row has time_away_seconds';
end $$;

-- ---------- 7. Security: public anon cannot call admin_* RPCs ----------
set role anon;
do $$
declare
  cid uuid := current_setting('t.cid')::uuid;
  m text;
begin
  m := null;
  begin perform public.admin_marking_overview('bad-token', cid); exception when others then get stacked diagnostics m = message_text; end;
  assert m = 'E_AUTH', 'admin_marking_overview refused to anon: ' || coalesce(m, 'null');

  m := null;
  begin perform public.admin_results('bad-token', cid); exception when others then get stacked diagnostics m = message_text; end;
  assert m = 'E_AUTH', 'admin_results refused to anon: ' || coalesce(m, 'null');
end $$;
reset role;

rollback;
do $$ begin raise notice 'ALL PHASE 3 MARKING TESTS PASSED'; end $$;
