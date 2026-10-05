-- =============================================================================
-- tests/sql/phase4_certificates.test.sql
-- Test suite for Phase 4: Certificates (040_certificates + 041_certificate_rpcs).
-- Safe to run on staging: runs in a single transaction that always rolls back.
-- =============================================================================

begin;

-- ---------- Setup test course, students, attempt, and token ----------
do $$
declare
  cid uuid;
  sid1 text := 'test-cert-student-1';
  sid2 text := 'test-cert-student-2';
  e1 uuid;
  e2 uuid;
  tok text;
  vid uuid;
  sec_mcq uuid;
  qid uuid;
  att1 uuid;
  att2 uuid;
  atok1 text := 'tok-cert-1';
  atok2 text := 'tok-cert-2';
begin
  -- 1. Create teacher session
  tok := 'probe-teacher-token-' || substr(md5(random()::text), 1, 8);
  insert into private.teacher_sessions (token, expires_at)
  values (tok, now() + interval '1 hour');
  perform set_config('t.tok', tok, true);

  -- 2. Create test course (ADAB-like)
  insert into public.courses (
    code, name, name_ar, lesson_mode, eligibility_rule,
    day_count, day_max, bonus_unit_value, lesson_max,
    weight_lessons, weight_exam, pass_mark, grade_bands
  ) values (
    'TCERT', 'Test Certificate Course', 'دورة الشهادة التجريبية', 'scored', 'all_units',
    1, 10, 2, 100,
    50, 50, 60,
    '[{"min":90,"label":"Excellent","label_ar":"ممتاز"},{"min":75,"label":"Very Good","label_ar":"جيد جداً"},{"min":60,"label":"Pass","label_ar":"مقبول"}]'::jsonb
  ) returning id into cid;
  perform set_config('t.cid', cid::text, true);

  -- 3. Create test students (Student 1 initially has no Arabic name to test AC-4.2)
  insert into public.students (id, name, name_ar)
  values (sid1, 'Ibrahim Bello', null)
  on conflict (id) do update set name = excluded.name;

  insert into public.students (id, name, name_ar)
  values (sid2, 'Zainab Umar', 'زينب عمر')
  on conflict (id) do update set name = excluded.name;

  insert into public.enrollments (course_id, student_id, days, bonus_units, active)
  values (cid, sid1, array[10], array[0], true)
  returning id into e1;
  perform set_config('t.e1', e1::text, true);

  insert into public.enrollments (course_id, student_id, days, bonus_units, active)
  values (cid, sid2, array[10], array[0], true)
  returning id into e2;
  perform set_config('t.e2', e2::text, true);

  -- 4. Publish a simple exam version
  insert into private.exams (course_id) values (cid);
  insert into private.exam_versions (
    exam_id, version_num, status, duration_minutes, title, title_ar, draft_rev
  ) values (
    (select id from private.exams where course_id = cid),
    1, 'live', 60, 'Final Exam', 'الاختبار النهائي', 1
  ) returning id into vid;

  insert into private.sections (version_id, position, title, format, weight)
  values (vid, 1, 'Section A', 'mcq', 100)
  returning id into sec_mcq;

  insert into private.questions (id, section_id, position, prompt, options)
  values ('30000000-0000-0000-0000-000000000001', sec_mcq, 1, 'Question 1', '[{"id":"a","text":"Opt A"},{"id":"b","text":"Opt B"}]'::jsonb)
  returning id into qid;

  insert into private.question_keys (question_id, correct_option_ids)
  values (qid, array['a']);

  -- 5. Student codes
  insert into private.exam_codes (enrollment_id, code_hash, code_plain, status)
  values (e1, extensions.crypt('123456', extensions.gen_salt('bf', 4)), '123456', 'active');

  insert into private.exam_codes (enrollment_id, code_hash, code_plain, status)
  values (e2, extensions.crypt('654321', extensions.gen_salt('bf', 4)), '654321', 'active');

  -- 6. Students sit and submit exams (both score 100% on exam -> Final 100 * 50% + 100 * 50% = 100)
  insert into private.attempts (id, enrollment_id, version_id, started_at, deadline_at, submitted_at, status, token_hash)
  values ('40000000-0000-0000-0000-000000000001', e1, vid, now(), now() + interval '1 hour', now(), 'submitted', extensions.crypt(atok1, extensions.gen_salt('bf', 4)))
  returning id into att1;

  insert into private.attempts (id, enrollment_id, version_id, started_at, deadline_at, submitted_at, status, token_hash)
  values ('40000000-0000-0000-0000-000000000002', e2, vid, now(), now() + interval '1 hour', now(), 'submitted', extensions.crypt(atok2, extensions.gen_salt('bf', 4)))
  returning id into att2;

  insert into private.answers (attempt_id, question_id, response, fraction, marked_by)
  values (att1, qid, '{"selected":["a"]}'::jsonb, 1.0, 'auto');

  insert into private.answers (attempt_id, question_id, response, fraction, marked_by)
  values (att2, qid, '{"selected":["a"]}'::jsonb, 1.0, 'auto');

  perform private.try_finalize(att1);
  perform private.try_finalize(att2);
end $$;

-- ---------- 1. admin_list_certificates ----------
do $$
declare
  tok text := current_setting('t.tok');
  cid uuid := current_setting('t.cid')::uuid;
  res jsonb;
  el jsonb;
begin
  res := public.admin_list_certificates(tok, cid);
  assert (res->>'ok')::boolean, 'admin_list_certificates ok';
  assert jsonb_array_length(res->'eligible') = 2, '2 students eligible for certificates';
  assert jsonb_array_length(res->'issued') = 0, '0 certificates issued yet';

  el := res->'eligible'->0;
  assert (el->>'missing_arabic_name')::boolean = true, 'Student 1 flagged missing Arabic name';
end $$;

-- ---------- 2. admin_approve_certificates: AC-4.2 (blocked without Arabic name) ----------
do $$
declare
  tok text := current_setting('t.tok');
  e1 uuid := current_setting('t.e1')::uuid;
  res jsonb;
begin
  res := public.admin_approve_certificates(tok, array[e1]);
  assert (res->0->>'ok')::boolean = false, 'approval refused without Arabic name';
  assert res->0->>'error' = 'E_NO_ARABIC_NAME', 'error is E_NO_ARABIC_NAME: ' || res::text;
end $$;

-- ---------- 3. Provide Arabic name & approve successfully (AC-4.1, AC-4.3) ----------
do $$
declare
  tok text := current_setting('t.tok');
  e1 uuid := current_setting('t.e1')::uuid;
  e2 uuid := current_setting('t.e2')::uuid;
  res jsonb;
  er1 record;
  er2 record;
  c1 record;
  c2 record;
begin
  -- Set Arabic name for student 1
  update public.students set name_ar = 'إبراهيم بللو' where id = 'test-cert-student-1';

  -- Approve student 1 and student 2
  res := public.admin_approve_certificates(tok, array[e1, e2]);
  assert (res->0->>'ok')::boolean = true, 'student 1 approval ok';
  assert (res->1->>'ok')::boolean = true, 'student 2 approval ok';

  -- Check sequential numbers: MMI-TCERT-YYYY-0001 and MMI-TCERT-YYYY-0002
  assert res->0->>'number' ~ '^MMI-TCERT-[0-9]{4}-0001$', 'first cert number is 0001: ' || (res->0->>'number');
  assert res->1->>'number' ~ '^MMI-TCERT-[0-9]{4}-0002$', 'second cert number is 0002: ' || (res->1->>'number');

  -- Verify public.enrollment_results updated
  select * into er1 from public.enrollment_results where enrollment_id = e1;
  assert er1.has_certificate = true, 'er1 has_certificate is true';

  select * into er2 from public.enrollment_results where enrollment_id = e2;
  assert er2.has_certificate = true, 'er2 has_certificate is true';

  -- Verify snapshot immutability (AC-4.3)
  select * into c1 from private.certificates where enrollment_id = e1;
  assert c1.snapshot->>'student_name' = 'Ibrahim Bello', 'snapshot has Latin name';
  assert c1.snapshot->>'student_name_ar' = 'إبراهيم بللو', 'snapshot has Arabic name';
  assert c1.snapshot->>'course_name' = 'Test Certificate Course', 'snapshot has course name';
  assert c1.snapshot ? 'signatory', 'snapshot has signatory block';
  assert c1.verify_code is not null and length(c1.verify_code) = 10, '10-char verify code generated';
end $$;

-- ---------- 4. get_certificate & verify_certificate (AC-4.4, FR-T14) ----------
do $$
declare
  e1 uuid := current_setting('t.e1')::uuid;
  cert record;
  st_cert jsonb;
  ver jsonb;
begin
  select * into cert from private.certificates where enrollment_id = e1;

  -- 4a. get_certificate with student code
  st_cert := public.get_certificate(e1, '123456');
  assert (st_cert->>'ok')::boolean, 'get_certificate ok';
  assert st_cert->>'number' = cert.number, 'certificate number matches';

  -- 4b. verify_certificate (publicly callable)
  ver := public.verify_certificate(cert.number);
  assert (ver->>'ok')::boolean and ver->>'status' = 'valid', 'verify valid certificate ok';
  assert ver->>'student_name' = 'Ibrahim Bello', 'verify returned student name';
  assert ver ? 'issued_date' and ver ? 'band_label', 'verify returned public metadata';
  assert not (ver ? 'final') and not (ver ? 'snapshot'), 'verify does not leak private score or full paper';

  -- 4c. Unknown number
  ver := public.verify_certificate('MMI-NONEXISTENT-2026-9999');
  assert (ver->>'ok')::boolean and ver->>'status' = 'not_found', 'unknown certificate reports not_found';
end $$;

-- ---------- 5. admin_revoke_certificate (AC-4.5) ----------
do $$
declare
  tok text := current_setting('t.tok');
  e1 uuid := current_setting('t.e1')::uuid;
  cert record;
  ver jsonb;
  m text;
  er record;
begin
  select * into cert from private.certificates where enrollment_id = e1;

  -- Revoke certificate
  perform public.admin_revoke_certificate(tok, e1, 'Testing revocation workflow');

  -- Public verification now shows revoked
  ver := public.verify_certificate(cert.number);
  assert ver->>'status' = 'revoked', 'verify reports revoked';
  assert ver->>'revoke_reason' = 'Testing revocation workflow', 'revocation reason returned';

  -- Student cannot fetch revoked certificate
  m := null;
  begin
    perform public.get_certificate(e1, '123456');
  exception when others then get stacked diagnostics m = message_text;
  end;
  assert m = 'E_NO_CERTIFICATE', 'get_certificate refuses revoked certificate';

  -- has_certificate updated on enrollment_results
  select * into er from public.enrollment_results where enrollment_id = e1;
  assert er.has_certificate = false, 'has_certificate is now false after revoke';
end $$;

-- ---------- 6. admin_get_institution & admin_save_institution (FR-V8) ----------
do $$
declare
  tok text := current_setting('t.tok');
  inst jsonb;
  m text;
begin
  inst := public.admin_get_institution(tok);
  assert (inst->>'ok')::boolean, 'admin_get_institution ok';
  assert inst->>'number_prefix' = 'MMI', 'number prefix is MMI';

  -- Overlength wording validation
  m := null;
  begin
    perform public.admin_save_institution(tok, jsonb_build_object(
      'certificate_defaults', jsonb_build_object('wording', repeat('x', 700))
    ));
  exception when others then get stacked diagnostics m = message_text;
  end;
  assert m = 'E_VALIDATION', 'rejects wording > 600 chars: ' || coalesce(m, 'null');
end $$;

-- ---------- 7. Security: anon cannot call admin_* RPCs ----------
set role anon;
do $$
declare
  cid uuid := current_setting('t.cid')::uuid;
  e1 uuid := current_setting('t.e1')::uuid;
  m text;
begin
  m := null;
  begin perform public.admin_list_certificates('bad-token', cid); exception when others then get stacked diagnostics m = message_text; end;
  assert m = 'E_AUTH', 'admin_list_certificates denied to anon: ' || coalesce(m, 'null');

  m := null;
  begin perform public.admin_approve_certificates('bad-token', array[e1]); exception when others then get stacked diagnostics m = message_text; end;
  assert m = 'E_AUTH', 'admin_approve_certificates denied to anon: ' || coalesce(m, 'null');

  m := null;
  begin perform public.admin_revoke_certificate('bad-token', e1, 'test'); exception when others then get stacked diagnostics m = message_text; end;
  assert m = 'E_AUTH', 'admin_revoke_certificate denied to anon: ' || coalesce(m, 'null');
end $$;
reset role;

rollback;

do $$ begin raise notice 'ALL PHASE 4 CERTIFICATE TESTS PASSED'; end $$;
