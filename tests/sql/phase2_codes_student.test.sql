-- Phase 2 tests: exam codes (020, 021, 023) and the student exam RPCs (022).
-- Assert-style, ONE transaction, ROLLED BACK at the end. No psql meta-commands: pastes into the Supabase SQL editor.
-- Run AFTER 005 and 010-023. It temporarily replaces the teacher PIN hash; the rollback restores it.
--
-- Covers: the code format (6 digits), codes persisting and listing until regenerated/revoked, the per-student
-- lockout (5 wrong tries), regenerate/revoke/unlock, the whole student path AS anon (check, start, paper,
-- autosave, tab events, submit, result), and that no answer key or table is reachable by anon.
begin;

create function pg_temp.msg(q text) returns text language plpgsql as $$
declare m text;
begin execute q; return 'OK';
exception when others then get stacked diagnostics m = message_text; return m; end $$;

-- ---------- fixtures ----------
do $$
declare v_cid uuid; v_draft uuid; i int; r jsonb; v_doc jsonb;
begin
  update private.secrets set value = extensions.crypt('p2-test-pin', extensions.gen_salt('bf', 4)) where key = 'teacher_pin_hash';
  delete from private.auth_throttle;
  perform set_config('t.tok', public.teacher_login('p2-test-pin')->>'token', false);
  assert length(current_setting('t.tok')) = 64, 'test login failed';

  insert into public.courses (code, name, eligibility_rule) values ('P2X', 'Phase2 course', 'open') returning id into v_cid;
  perform set_config('t.cid', v_cid::text, false);
  for i in 1 .. 3 loop
    r := public.admin_add_student(current_setting('t.tok'), v_cid, 'P2 Student ' || i);
    perform set_config('t.e' || i, r->>'enrollment_id', false);
  end loop;

  v_draft := (public.admin_create_draft(current_setting('t.tok'), v_cid)->>'id')::uuid;
  v_doc := $j${
   "title":"Final Exam","title_ar":"الاختبار النهائي","instructions":"Read each question.","duration_minutes":60,
   "sections":[
    {"id":"10000000-0000-0000-0000-000000000001","title":"Section A","format":"mcq","weight":40,"questions":[
      {"id":"20000000-0000-0000-0000-000000000001","prompt":"2+2?","note":null,
       "options":[{"id":"a","text":"3"},{"id":"b","text":"4"}],"key":{"correct_option_ids":["b"]}},
      {"id":"20000000-0000-0000-0000-000000000002","prompt":"Pick the primes","note":null,
       "options":[{"id":"a","text":"2"},{"id":"b","text":"3"},{"id":"c","text":"4"}],"key":{"correct_option_ids":["a","b"]}}]},
    {"id":"10000000-0000-0000-0000-000000000002","title":"Section B","format":"tf","weight":20,"questions":[
      {"id":"20000000-0000-0000-0000-000000000003","prompt":"The sky is blue.","note":null,
       "options":[{"id":"true","text":"True"},{"id":"false","text":"False"}],"key":{"correct_option_ids":["true"]}}]},
    {"id":"10000000-0000-0000-0000-000000000003","title":"Section C","format":"fill","weight":20,"questions":[
      {"id":"20000000-0000-0000-0000-000000000004","prompt":"Capital of France ____","note":null,
       "options":[],"key":{"accepted_answers":["Paris"],"tm_equiv":false}}]},
    {"id":"10000000-0000-0000-0000-000000000004","title":"Section D","format":"essay","weight":20,"questions":[
      {"id":"20000000-0000-0000-0000-000000000005","prompt":"Discuss.","note":"two arguments","options":[]}]}
   ]}$j$::jsonb;
  perform public.admin_save_draft(current_setting('t.tok'), v_draft, 0, v_doc);
  perform public.admin_publish_version(current_setting('t.tok'), v_draft);
  assert (select exam_live from public.courses where id = v_cid), 'fixture: exam is live';
end $$;

-- =====================================================================================
do $$ begin raise notice '== T2.1 a generated code is 6 digits, persists, and is listed =='; end $$;
do $$
declare t text := current_setting('t.tok'); c uuid := current_setting('t.cid')::uuid;
        e1 uuid := current_setting('t.e1')::uuid; r jsonb; v_code text; l jsonb;
begin
  r := public.admin_generate_code(t, e1);
  v_code := r->>'code';
  assert v_code ~ '^[0-9]{6}$', 'code is exactly 6 digits, got ' || coalesce(v_code, 'null');
  perform set_config('t.code1', v_code, false);

  l := public.admin_list_codes(t, c);
  assert jsonb_typeof(l) = 'array', 'admin_list_codes returns an array';
  assert (select count(*) from jsonb_array_elements(l) x where x->>'enrollment_id' = e1::text) = 1, 'student 1 listed once';
  assert (select x->>'code' from jsonb_array_elements(l) x where x->>'enrollment_id' = e1::text) = v_code,
         'listed code equals the generated code';
  assert (select count(*) from jsonb_array_elements(l) x where x->>'enrollment_id' = current_setting('t.e2')) = 0,
         'student without a code is not listed';

  -- listing again later returns the SAME code (it stays until regenerated)
  assert (select x->>'code' from jsonb_array_elements(public.admin_list_codes(t, c)) x where x->>'enrollment_id' = e1::text) = v_code,
         'code is stable across listings';
  assert (select count(*) from private.exam_codes where enrollment_id = e1 and status = 'active') = 1, 'exactly one active row';

  -- the stored hash is real: the plaintext is not the hash
  assert (select code_hash <> v_code and code_hash like '$2%' from private.exam_codes where enrollment_id = e1 and status = 'active'),
         'hash kept alongside the readable code';

  -- 200 generated codes are always 6 digits (and not all identical)
  assert (select bool_and(private.gen_exam_code() ~ '^[0-9]{6}$') from generate_series(1, 200)), 'gen_exam_code format';
  assert (select count(distinct private.gen_exam_code()) from generate_series(1, 200)) > 150, 'gen_exam_code is random';
end $$;

-- =====================================================================================
do $$ begin raise notice '== T2.2 verification: wrong code, lockout after 5, unlock, formatting tolerance =='; end $$;
do $$
declare t text := current_setting('t.tok'); e1 uuid := current_setting('t.e1')::uuid;
        v_code text := current_setting('t.code1'); r jsonb; i int; v_wrong text;
begin
  v_wrong := case when v_code = '000000' then '111111' else '000000' end;

  r := public.exam_check(e1, v_code);
  assert (r->>'ok')::boolean and r->>'state' = 'not_started', 'correct code works: ' || r::text;
  assert r->'exam'->>'title' = 'Final Exam' and (r->'exam'->>'question_count')::int = 5, 'exam summary returned';
  assert not (r::text like '%correct_option_ids%'), 'exam_check leaks no key';

  -- tolerance: spaces, hyphen, surrounding whitespace
  assert (public.exam_check(e1, substr(v_code, 1, 3) || '-' || substr(v_code, 4))->>'ok')::boolean, 'hyphenated code accepted';
  assert (public.exam_check(e1, ' ' || substr(v_code, 1, 3) || ' ' || substr(v_code, 4) || ' ')->>'ok')::boolean, 'spaced code accepted';

  -- 4 wrong tries -> E_AUTH each time, still not locked
  for i in 1 .. 4 loop
    r := public.exam_check(e1, v_wrong);
    assert r->>'error' = 'E_AUTH', 'wrong try ' || i || ' -> E_AUTH, got ' || r::text;
  end loop;
  -- a CORRECT code in between clears the counter
  assert (public.exam_check(e1, v_code)->>'ok')::boolean, 'correct code accepted before the lock';
  for i in 1 .. 4 loop
    r := public.exam_check(e1, v_wrong);
    assert r->>'error' = 'E_AUTH', 'counter was reset: try ' || i || ' -> E_AUTH, got ' || r::text;
  end loop;
  -- the 5th consecutive failure locks
  r := public.exam_check(e1, v_wrong);
  assert r->>'error' = 'E_LOCKED' and (r->>'detail')::int between 1 and 10, '5th failure locks: ' || r::text;
  -- while locked even the right code is refused
  r := public.exam_check(e1, v_code);
  assert r->>'error' = 'E_LOCKED', 'locked student cannot use the right code: ' || r::text;
  -- another student is not affected
  assert coalesce(public.exam_check(current_setting('t.e2')::uuid, v_wrong)->>'error', '') = 'E_AUTH', 'lock is per student';

  -- teacher unlock
  perform public.admin_clear_lock(t, e1);
  assert (public.exam_check(e1, v_code)->>'ok')::boolean, 'right code works after unlock';

  -- unlock needs the teacher token
  assert pg_temp.msg(format('select public.admin_clear_lock(%L, %L)', 'garbage', e1)) = 'E_AUTH', 'unlock rejects a bad token';

  -- empty / null codes
  assert public.exam_check(e1, '')->>'error' = 'E_AUTH', 'empty code -> E_AUTH';
  assert public.exam_check(e1, null)->>'error' = 'E_AUTH', 'null code -> E_AUTH';
  -- unknown enrollment is indistinguishable from a wrong code
  assert public.exam_check(gen_random_uuid(), v_code)->>'error' = 'E_AUTH', 'unknown enrollment -> E_AUTH';
  delete from private.auth_throttle;
end $$;

-- =====================================================================================
do $$ begin raise notice '== T2.3 regenerate, revoke, bulk, legacy hashed-only codes =='; end $$;
do $$
declare t text := current_setting('t.tok'); c uuid := current_setting('t.cid')::uuid;
        e1 uuid := current_setting('t.e1')::uuid; e2 uuid := current_setting('t.e2')::uuid; e3 uuid := current_setting('t.e3')::uuid;
        old text := current_setting('t.code1'); n text; r jsonb; l jsonb; b jsonb; v_leg text := '482915';
begin
  -- regenerate: the old code stops working, the new one works, the list shows only the new one
  n := public.admin_generate_code(t, e1)->>'code';
  assert n ~ '^[0-9]{6}$', 'regenerated code format';
  assert n <> old, 'regenerated code differs from the old one';
  assert public.exam_check(e1, old)->>'error' = 'E_AUTH', 'old code no longer works';
  assert (public.exam_check(e1, n)->>'ok')::boolean, 'new code works';
  l := public.admin_list_codes(t, c);
  assert (select count(*) from jsonb_array_elements(l) x where x->>'enrollment_id' = e1::text) = 1, 'still one row for the student';
  assert (select x->>'code' from jsonb_array_elements(l) x where x->>'enrollment_id' = e1::text) = n, 'list shows the new code';
  assert (select count(*) from private.exam_codes where enrollment_id = e1) = 2 and
         (select count(*) from private.exam_codes where enrollment_id = e1 and status = 'revoked') = 1, 'old row kept as revoked';
  assert (select code_plain from private.exam_codes where enrollment_id = e1 and status = 'revoked') is null,
         'the readable copy of a revoked code is erased';
  perform set_config('t.code1', n, false);

  -- revoke removes it from the list and from use
  perform public.admin_generate_code(t, e2);
  perform public.admin_revoke_code(t, e2);
  assert (select count(*) from jsonb_array_elements(public.admin_list_codes(t, c)) x where x->>'enrollment_id' = e2::text) = 0,
         'revoked code not listed';

  -- bulk: codes for everyone without an active code, 6 digits, listed, and a 2nd run creates nothing
  b := public.admin_generate_codes_bulk(t, c);
  assert jsonb_array_length(b) = 2, 'bulk covers the 2 students without an active code: ' || b::text;
  assert (select bool_and(x->>'code' ~ '^[0-9]{6}$') from jsonb_array_elements(b) x), 'bulk codes are 6 digits';
  assert (select x->>'code' from jsonb_array_elements(public.admin_list_codes(t, c)) x where x->>'enrollment_id' = e3::text)
       = (select x->>'code' from jsonb_array_elements(b) x where x->>'enrollment_id' = e3::text), 'bulk code is listed';
  assert jsonb_array_length(public.admin_generate_codes_bulk(t, c)) = 0, 'a second bulk run issues nothing';
  assert (select x->>'code' from jsonb_array_elements(public.admin_list_codes(t, c)) x where x->>'enrollment_id' = e1::text) = n,
         'bulk did not disturb an existing code';

  -- legacy code: hash only (issued before 023). Still verifies; the list shows it without a readable value.
  update private.exam_codes set status = 'revoked' where enrollment_id = e3 and status = 'active';
  insert into private.exam_codes (enrollment_id, code_hash, status)
  values (e3, extensions.crypt('4J22MG7Y', extensions.gen_salt('bf', 4)), 'active');
  assert (public.exam_check(e3, '4J22-MG7Y')->>'ok')::boolean, 'an old 8-character code still verifies';
  l := public.admin_list_codes(t, c);
  assert (select count(*) from jsonb_array_elements(l) x where x->>'enrollment_id' = e3::text) = 1, 'legacy code row listed';
  assert (select x->'code' from jsonb_array_elements(l) x where x->>'enrollment_id' = e3::text) = 'null'::jsonb, 'legacy code has no readable value';

  -- admin_list_codes needs the teacher token
  assert pg_temp.msg(format('select public.admin_list_codes(%L, %L)', 'garbage', c)) = 'E_AUTH', 'list rejects a bad token';
  assert pg_temp.msg(format('select public.admin_generate_code(%L, %L)', 'garbage', e1)) = 'E_AUTH', 'generate rejects a bad token';
  delete from private.auth_throttle;
end $$;

-- =====================================================================================
do $$ begin raise notice '== T2.4 the whole student path, AS anon =='; end $$;
select set_config('t.code1', current_setting('t.code1'), false);
set role anon;
do $$
declare e1 uuid := current_setting('t.e1')::uuid; code text := current_setting('t.code1');
        r jsonb; tok text; paper jsonb; q jsonb; s jsonb; ans jsonb := '[]'::jsonb; m text;
begin
  r := public.exam_check(e1, code);
  assert (r->>'ok')::boolean and r->>'state' = 'not_started', 'anon exam_check ok: ' || r::text;

  r := public.exam_start(e1, code);
  assert (r->>'ok')::boolean and length(r->>'attempt_token') >= 20, 'exam_start returns a token: ' || r::text;
  tok := r->>'attempt_token';

  assert public.exam_check(e1, code)->>'state' = 'in_progress', 'state is in_progress after start';

  paper := public.exam_get_paper(tok);
  assert jsonb_array_length(paper->'sections') = 4, 'paper has 4 sections';
  assert not (paper::text like '%correct_option_ids%' or paper::text like '%accepted_answers%' or paper::text like '%"key"%'),
         'the paper contains no answer key';

  for s in select * from jsonb_array_elements(paper->'sections') loop
    for q in select * from jsonb_array_elements(s->'questions') loop
      ans := ans || jsonb_build_array(jsonb_build_object('question_id', q->>'id',
        'response', case s->>'format'
          when 'fill' then jsonb_build_object('text', 'Paris')
          when 'essay' then jsonb_build_object('text', 'because')
          when 'tf' then jsonb_build_object('selected', jsonb_build_array('true'))
          else jsonb_build_object('selected', jsonb_build_array('b')) end,
        'flagged', false));
    end loop;
  end loop;
  r := public.exam_save_answers(tok, ans);
  assert (r->>'ok')::boolean, 'autosave ok: ' || r::text;
  perform public.exam_log_event(tok, 'left');
  perform public.exam_log_event(tok, 'returned');
  perform public.exam_log_event(tok, 'bogus');

  m := null;
  begin perform public.exam_get_paper('not-a-real-token-not-a-real-token'); exception when others then get stacked diagnostics m = message_text; end;
  assert m = 'E_SESSION_REPLACED', 'a bad attempt token is refused: ' || coalesce(m, 'null');

  -- resuming with the code issues a new token and retires the old one
  r := public.exam_start(e1, code);
  assert (r->>'ok')::boolean and r->>'attempt_token' <> tok, 'resume gives a new token';
  m := null;
  begin perform public.exam_get_paper(tok); exception when others then get stacked diagnostics m = message_text; end;
  assert m = 'E_SESSION_REPLACED', 'the old token is dead after resume';
  tok := r->>'attempt_token';
  assert public.exam_get_paper(tok)->'answers' <> '{}'::jsonb, 'saved answers come back on resume';

  r := public.exam_submit(tok);
  assert (r->>'ok')::boolean and (r->>'pending_marking')::boolean, 'submit ok, the essay is pending: ' || r::text;

  -- calling submit again is idempotent (AC-2.8)
  r := public.exam_submit(tok);
  assert (r->>'ok')::boolean and (r->>'pending_marking')::boolean, 'second submit is idempotent: ' || r::text;

  m := null;
  begin perform public.exam_start(e1, code); exception when others then get stacked diagnostics m = message_text; end;
  assert m = 'E_ATTEMPT_EXISTS', 'cannot start a second attempt: ' || coalesce(m, 'null');

  r := public.exam_get_result(e1, code);
  assert r ? 'status' and r ? 'final', 'result returned: ' || r::text;
  assert not (r::text like '%correct_option_ids%'), 'result leaks no key';
end $$;
reset role;

do $$
declare e1 uuid := current_setting('t.e1')::uuid;
begin
  assert (select count(*) from private.attempt_events where attempt_id = (select id from private.attempts where enrollment_id = e1)) = 2,
         'exactly the 2 valid tab events were stored';
  assert (select status from private.attempts where enrollment_id = e1 and not superseded) = 'submitted', 'attempt is submitted (essay pending)';
  -- 4 auto-marked sections are 3 of 5 questions; MCQ q1 right (1), MCQ q2 only 1 of 2 correct picks wrong shape, tf right, fill right
  assert (select count(*) from private.answers where attempt_id = (select id from private.attempts where enrollment_id = e1) and fraction is not null) = 4,
         '4 auto-marked answers, 1 essay left to mark';
  assert (select fraction from private.answers a join private.questions q on q.id = a.question_id
          where a.attempt_id = (select id from private.attempts where enrollment_id = e1) and q.prompt = 'Capital of France ____') = 1,
         'fill-in answer marked correct';
end $$;

-- =====================================================================================
do $$ begin raise notice '== T2.5 what anon can and cannot reach =='; end $$;
set role anon;
do $$
declare m text; fn text;
begin
  foreach fn in array array['select count(*) from private.exam_codes', 'select count(*) from private.attempts',
                            'select count(*) from private.answers', 'select count(*) from private.auth_throttle',
                            'select code_plain from private.exam_codes'] loop
    m := null; begin execute fn; exception when others then get stacked diagnostics m = message_text; end;
    assert m is not null and m ilike '%permission denied%', 'anon cannot run: ' || fn || ' (' || coalesce(m, 'no error') || ')';
  end loop;
  m := null; begin perform private.verify_student_code(gen_random_uuid(), '123456'); exception when others then get stacked diagnostics m = message_text; end;
  assert m is not null and m ilike '%permission denied%', 'anon cannot call private.verify_student_code directly';
  m := null; begin perform public.admin_list_codes('garbage', gen_random_uuid()); exception when others then get stacked diagnostics m = message_text; end;
  assert m = 'E_AUTH', 'anon + garbage token cannot list codes';
end $$;
reset role;

rollback;
do $$ begin raise notice 'ALL PHASE 2 CODES + STUDENT TESTS PASSED'; end $$;
