-- Phase 1 exam builder tests (tasks 1.1-1.2): migrations 010 + 011.
-- Assert-style, ONE transaction, ROLLED BACK at the end: leaves no data behind (local or staging).
-- It temporarily replaces the teacher PIN hash and clears the login throttle; the rollback restores both.
-- Run it AFTER 005 (it proves the RPCs work for `anon` on a locked-down database) and after 010 + 011.
-- No psql meta-commands: pastes into the Supabase SQL editor.
--
-- Covers AC-1.1 .. AC-1.7, AC-1.10 (server side), every rule of PRD §7.7, token checks on all 7 RPCs,
-- id handling, rollback of failed saves, the cascade chain and v_question_values.
-- Not covered here: AC-1.8 (preview creates no attempt rows: no attempt tables exist before Phase 2,
-- and preview is client-side from admin_get_exam) and AC-1.9 (rendering, client). Parallel behaviour
-- (two saves with the same rev, two create_draft calls) is in tests/tools/concurrency_exam.sh.
begin;

-- ---------- helpers (session-local) ----------
create function pg_temp.err(q text) returns text language plpgsql as $$
declare m text;
begin execute q; return 'OK';
exception when others then get stacked diagnostics m = message_text; return m; end $$;

create function pg_temp.det(q text) returns text language plpgsql as $$
declare m text;
begin execute q; return 'OK';
exception when others then get stacked diagnostics m = pg_exception_detail; return m; end $$;

create function pg_temp.tok() returns text language sql as $$ select current_setting('t.tok') $$;
create function pg_temp.cid(n int) returns uuid language sql as $$ select current_setting('t.c' || n)::uuid $$;

create function pg_temp.get_exam(c uuid) returns jsonb language sql as $$ select public.admin_get_exam(pg_temp.tok(), c) $$;
create function pg_temp.create_draft(c uuid) returns jsonb language sql as $$ select public.admin_create_draft(pg_temp.tok(), c) $$;
create function pg_temp.save(v uuid, rev int, d jsonb) returns int language sql as $$ select public.admin_save_draft(pg_temp.tok(), v, rev, d) $$;
create function pg_temp.publish(v uuid) returns jsonb language sql as $$ select public.admin_publish_version(pg_temp.tok(), v) $$;

create function pg_temp.vid(c uuid, st text) returns uuid language sql as $$
  select v.id from private.exam_versions v join private.exams e on e.id = v.exam_id where e.course_id = c and v.status = st
$$;
create function pg_temp.rev(v uuid) returns int language sql as $$ select draft_rev from private.exam_versions where id = v $$;

-- Content signature without ids (to compare a copy with its source), and the list of all ids.
create function pg_temp.sig(d jsonb) returns text language sql as $$
  select jsonb_build_array(d->'title', d->'title_ar', d->'instructions', d->'instructions_ar', d->'duration_minutes',
    coalesce((select jsonb_agg(jsonb_build_array(s.v->'title', s.v->'title_ar', s.v->'format', s.v->'weight',
        coalesce((select jsonb_agg(jsonb_build_array(q.v->'prompt', q.v->'note', q.v->'options', q.v->'key') order by q.n)
                  from jsonb_array_elements(s.v->'questions') with ordinality as q(v, n)), '[]'::jsonb)) order by s.n)
              from jsonb_array_elements(d->'sections') with ordinality as s(v, n)), '[]'::jsonb))::text
$$;
create function pg_temp.ids(d jsonb) returns text[] language sql as $$
  select coalesce(array_agg(x), '{}'::text[]) from (
    select s->>'id' as x from jsonb_array_elements(d->'sections') s
    union all
    select q->>'id' from jsonb_array_elements(d->'sections') s, jsonb_array_elements(s->'questions') q) t
$$;

-- A valid document: mcq 40 (2 questions), tf 20, fill 20, essay 20. Arabic/English mixed prompt in the first question.
create function pg_temp.base() returns jsonb language sql as $$
select $j${
 "title":"Final Exam","title_ar":"الاختبار النهائي","instructions":"Read each question.","instructions_ar":"اقرأ كل سؤال","duration_minutes":60,
 "sections":[
  {"id":"10000000-0000-0000-0000-000000000001","title":"Section A","title_ar":"القسم أ","format":"mcq","weight":40,"questions":[
    {"id":"20000000-0000-0000-0000-000000000001","prompt":"ما هو ناتج 2+2؟ (what is 2+2?)","note":null,
     "options":[{"id":"a","text":"3"},{"id":"b","text":"4"}],"key":{"correct_option_ids":["b"]}},
    {"id":"20000000-0000-0000-0000-000000000002","prompt":"Pick the primes","note":null,
     "options":[{"id":"a","text":"2"},{"id":"b","text":"3"},{"id":"c","text":"4"}],"key":{"correct_option_ids":["a","b"]}}]},
  {"id":"10000000-0000-0000-0000-000000000002","title":"Section B","format":"tf","weight":20,"questions":[
    {"id":"20000000-0000-0000-0000-000000000003","prompt":"The sky is blue.","note":null,
     "options":[{"id":"true","text":"True"},{"id":"false","text":"False"}],"key":{"correct_option_ids":["true"]}}]},
  {"id":"10000000-0000-0000-0000-000000000003","title":"Section C","format":"fill","weight":20,"questions":[
    {"id":"20000000-0000-0000-0000-000000000004","prompt":"The capital of France is ____","note":null,
     "options":[],"key":{"accepted_answers":["Paris","paris"],"tm_equiv":false}}]},
  {"id":"10000000-0000-0000-0000-000000000004","title":"Section D","format":"essay","weight":20,"questions":[
    {"id":"20000000-0000-0000-0000-000000000005","prompt":"Discuss.","note":"Look for two arguments.","options":[]}]}
 ]}$j$::jsonb
$$;

-- Save a (possibly invalid) doc into course 3's draft, try to publish, return the problem list ('[]' if it published).
create function pg_temp.problems(p_doc jsonb) returns jsonb language plpgsql as $$
declare v uuid := pg_temp.vid(pg_temp.cid(3), 'draft'); m text; d text;
begin
  perform pg_temp.save(v, pg_temp.rev(v), p_doc);
  begin
    perform pg_temp.publish(v);
    return '[]'::jsonb;
  exception when others then
    get stacked diagnostics m = message_text, d = pg_exception_detail;
    if m <> 'E_VALIDATION' then return jsonb_build_array(jsonb_build_object('path', 'UNEXPECTED', 'message', m)); end if;
    return d::jsonb;
  end;
end $$;
create function pg_temp.has_path(p jsonb, path text) returns boolean language sql as $$
  select exists (select 1 from jsonb_array_elements(p) e where e->>'path' = path)
$$;
create function pg_temp.set_at(d jsonb, path text[], v jsonb) returns jsonb language sql as $$ select jsonb_set(d, path, v) $$;

-- ---------- fixtures: a known PIN/token, three courses ----------
do $$
begin
  update private.secrets set value = extensions.crypt('p1-test-pin', extensions.gen_salt('bf', 4)) where key = 'teacher_pin_hash';
  delete from private.auth_throttle;
  perform set_config('t.tok', public.teacher_login('p1-test-pin')->>'token', false);
  assert length(current_setting('t.tok')) = 64, 'test login failed';
end $$;
do $$
declare i int; v_id uuid;
begin
  for i in 1 .. 3 loop
    insert into public.courses (code, name) values ('PX' || i, 'Phase1 course ' || i) returning id into v_id;
    perform set_config('t.c' || i, v_id::text, false);
  end loop;
  assert not (select exam_live from public.courses where id = pg_temp.cid(1)), 'new course has no live exam';
end $$;

-- =====================================================================================
do $$ begin raise notice '== T1.1 every exam RPC rejects a bad token (E_AUTH) =='; end $$;
do $$
declare q text; z text := gen_random_uuid()::text;
begin
  foreach q in array array[
    format('select public.admin_get_exam(%L, %L)', 'garbage', z),
    format('select public.admin_get_version(%L, %L)', 'garbage', z),
    format('select public.admin_create_draft(%L, %L)', 'garbage', z),
    format('select public.admin_save_draft(%L, %L, 0, %L::jsonb)', 'garbage', z, '{}'),
    format('select public.admin_discard_draft(%L, %L)', 'garbage', z),
    format('select public.admin_publish_version(%L, %L)', 'garbage', z),
    format('select public.admin_patch_text(%L, %L, %L, null)', 'garbage', z, 'x'),
    format('select public.admin_get_exam(null, %L)', z),
    format('select public.admin_publish_version(%L, %L)', '', z)
  ] loop
    assert pg_temp.err(q) = 'E_AUTH', 'E_AUTH expected for: ' || q;
  end loop;
end $$;

do $$ begin raise notice '== T1.2 empty exam, create draft, one draft at a time (AC-1.3) =='; end $$;
do $$
declare c uuid := pg_temp.cid(1); d jsonb; z uuid := gen_random_uuid();
begin
  assert pg_temp.get_exam(c) = '{"versions":[],"draft":null}'::jsonb, 'no exam yet: no versions, no draft';
  assert pg_temp.err(format('select pg_temp.get_exam(%L)', z)) = 'E_NOT_FOUND', 'get_exam: unknown course';
  assert pg_temp.err(format('select pg_temp.create_draft(%L)', z)) = 'E_NOT_FOUND', 'create_draft: unknown course';

  d := pg_temp.create_draft(c);
  assert d->>'status' = 'draft' and (d->>'version_no')::int = 1 and (d->>'draft_rev')::int = 0, 'new draft: status, number, rev';
  assert d->>'title' = '' and jsonb_array_length(d->'sections') = 0, 'new draft is empty';
  assert (d->>'course_id')::uuid = c, 'draft knows its course';
  assert pg_temp.err(format('select pg_temp.create_draft(%L)', c)) = 'E_VALIDATION', 'AC-1.3: a second draft is refused';
  assert (select count(*) from private.exam_versions v join private.exams e on e.id = v.exam_id where e.course_id = c) = 1, 'still exactly one version';
  assert (pg_temp.get_exam(c)->'draft'->>'id')::uuid = (d->>'id')::uuid, 'get_exam returns the draft';
  assert jsonb_array_length(pg_temp.get_exam(c)->'versions') = 1, 'one version listed';
  assert (pg_temp.get_exam(c)->'versions'->0->>'attempts_count')::int = 0, 'attempts_count is 0 in Phase 1';
  assert pg_temp.err(format('select public.admin_get_version(%L, %L)', pg_temp.tok(), z)) = 'E_NOT_FOUND', 'get_version: unknown id';
  assert public.admin_get_version(pg_temp.tok(), (d->>'id')::uuid) = d, 'get_version returns the same document';
end $$;

do $$ begin raise notice '== T1.3 save draft: round trip, ids, revision, lenient (AC-1.4) =='; end $$;
do $$
declare c uuid := pg_temp.cid(1); v uuid := pg_temp.vid(pg_temp.cid(1), 'draft'); b jsonb := pg_temp.base();
        r int; d jsonb; bad jsonb; before text; n int;
begin
  -- lenient: an incomplete draft saves (empty title, weight 0, empty prompt, no options, no key)
  r := pg_temp.save(v, 0, '{"title":"","sections":[{"title":"","format":"mcq","weight":0,"questions":[{"prompt":""}]}]}'::jsonb);
  assert r = 1, 'first save returns rev 1';
  d := pg_temp.get_exam(c)->'draft';
  assert (d->>'draft_rev')::int = 1 and jsonb_array_length(d->'sections') = 1, 'incomplete draft stored';
  assert d->'sections'->0->'questions'->0->'key' = '{"correct_option_ids":[]}'::jsonb, 'mcq without key: empty correct list';

  -- full document: exact round trip incl. Arabic, ids preserved
  r := pg_temp.save(v, 1, b);
  assert r = 2, 'second save returns rev 2';
  d := pg_temp.get_exam(c)->'draft';
  assert pg_temp.sig(d) = pg_temp.sig(b), 'content round-trips exactly (Arabic, keys, options, notes)';
  assert pg_temp.ids(d) = pg_temp.ids(b), 'client-supplied ids are kept';
  assert d->'sections'->0->'questions'->0->>'prompt' = 'ما هو ناتج 2+2؟ (what is 2+2?)', 'mixed Arabic/English prompt intact';
  assert d->'sections'->3->'questions'->0->'key' is null, 'essay has no key';
  assert d->'sections'->2->'questions'->0->'key'->'accepted_answers' = '["Paris","paris"]'::jsonb, 'fill key stored';
  assert (d->>'draft_rev')::int = 2, 'rev is 2';

  -- stale revision (AC-1.4): E_CONFLICT, detail = current rev, nothing changed
  assert pg_temp.err(format('select pg_temp.save(%L, 1, %L::jsonb)', v, pg_temp.set_at(b, '{title}', '"STALE"')::text)) = 'E_CONFLICT', 'AC-1.4: stale rev refused';
  assert pg_temp.det(format('select pg_temp.save(%L, 1, %L::jsonb)', v, b::text)) = '2', 'E_CONFLICT detail carries the current rev';
  assert pg_temp.err(format('select pg_temp.save(%L, null, %L::jsonb)', v, b::text)) = 'E_CONFLICT', 'null rev is a conflict';
  assert pg_temp.get_exam(c)->'draft'->>'title' = 'Final Exam' and pg_temp.rev(v) = 2, 'a refused save changes nothing';

  -- malformed documents are refused AND leave the stored draft untouched (the delete is rolled back)
  before := pg_temp.sig(pg_temp.get_exam(c)->'draft');
  foreach bad in array array[
    pg_temp.set_at(b, '{sections,0,format}', '"xyz"'),
    pg_temp.set_at(b, '{sections,0,weight}', '150'),
    pg_temp.set_at(b, '{sections,0,weight}', '-1'),
    pg_temp.set_at(b, '{sections,0,weight}', '"forty"'),
    pg_temp.set_at(b, '{duration_minutes}', '0'),
    pg_temp.set_at(b, '{duration_minutes}', '601'),
    pg_temp.set_at(b, '{duration_minutes}', '1.5'),
    pg_temp.set_at(b, '{duration_minutes}', '"60"'),
    pg_temp.set_at(b, '{sections}', '{"a":1}'),
    pg_temp.set_at(b, '{sections,0,questions}', '"x"'),
    pg_temp.set_at(b, '{sections,0,questions,0,options}', '"x"'),
    pg_temp.set_at(b, '{sections,0,questions,0,options}', '[{"text":"no id"}]'),
    pg_temp.set_at(b, '{sections,0,questions,0,key,correct_option_ids}', '"b"'),
    pg_temp.set_at(b, '{sections,2,questions,0,key,accepted_answers}', '"Paris"'),
    '[]'::jsonb, '"text"'::jsonb
  ] loop
    assert pg_temp.err(format('select pg_temp.save(%L, 2, %L::jsonb)', v, bad::text)) = 'E_VALIDATION', 'E_VALIDATION expected for ' || left(bad::text, 80);
    assert pg_temp.rev(v) = 2 and pg_temp.sig(pg_temp.get_exam(c)->'draft') = before, 'failed save left the draft intact: ' || left(bad::text, 80);
  end loop;
  assert pg_temp.err(format('select public.admin_save_draft(%L, %L, 2, null)', pg_temp.tok(), v)) = 'E_VALIDATION', 'null document refused';
  assert pg_temp.err(format('select public.admin_save_draft(%L, %L, 2, %L::jsonb)', pg_temp.tok(), gen_random_uuid(), b::text)) = 'E_NOT_FOUND', 'unknown version';

  -- limits: 51 sections and 501 questions are refused
  assert pg_temp.err(format('select pg_temp.save(%L, 2, %L::jsonb)', v,
           jsonb_build_object('sections', (select jsonb_agg('{"format":"essay","weight":1,"questions":[]}'::jsonb) from generate_series(1, 51)))::text)) = 'E_VALIDATION', '51 sections refused';
  assert pg_temp.err(format('select pg_temp.save(%L, 2, %L::jsonb)', v,
           jsonb_build_object('sections', jsonb_build_array(jsonb_build_object('format', 'essay', 'weight', 100,
             'questions', (select jsonb_agg('{"prompt":"q"}'::jsonb) from generate_series(1, 501)))))::text)) = 'E_VALIDATION', '501 questions refused';

  -- ids: duplicates inside one document and ids owned by another version get fresh ids (no PK errors)
  d := pg_temp.set_at(b, '{sections,1,id}', '"10000000-0000-0000-0000-000000000001"');
  d := pg_temp.set_at(d, '{sections,1,questions,0,id}', '"20000000-0000-0000-0000-000000000001"');
  d := pg_temp.set_at(d, '{sections,2,questions,0,id}', '"not-a-uuid"');
  r := pg_temp.save(v, 2, d);
  d := pg_temp.get_exam(c)->'draft';
  select count(distinct x), count(*) into n, r from unnest(pg_temp.ids(d)) x;
  assert n = r and r = 9, 'duplicate / invalid ids were replaced: all 9 ids distinct and present';
  assert d->'sections'->0->>'id' = '10000000-0000-0000-0000-000000000001', 'first use of an id keeps it';
  assert pg_temp.sig(d) = pg_temp.sig(b), 'content unaffected by id replacement';

  -- leave the draft at the valid base document for the next tests
  r := pg_temp.save(v, pg_temp.rev(v), b);
  assert pg_temp.sig(pg_temp.get_exam(c)->'draft') = pg_temp.sig(b), 'draft is the base document again';
end $$;

do $$ begin raise notice '== T1.4 publish validation: every rule of PRD §7.7 (AC-1.2) =='; end $$;
do $$
declare c3 uuid := pg_temp.cid(3); b jsonb := pg_temp.base(); p jsonb; spec record;
begin
  perform pg_temp.create_draft(c3);
  perform pg_temp.save(pg_temp.vid(c3, 'draft'), 0, b);   -- ids of course 1's draft are replaced here (owned by another version)
  assert pg_temp.sig(pg_temp.get_exam(c3)->'draft') = pg_temp.sig(b), 'course 3 draft holds the base document';

  -- each row: description, mutated doc, expected path
  for spec in select * from (values
    ('1 empty title',               pg_temp.set_at(b, '{title}', '"   "'),                                   'title'),
    ('1 no duration',               pg_temp.set_at(b, '{duration_minutes}', 'null'),                         'duration_minutes'),
    ('2 no sections',               pg_temp.set_at(b, '{sections}', '[]'),                                   'sections'),
    ('2 empty section',             pg_temp.set_at(b, '{sections,3,questions}', '[]'),                       'sections[3].questions'),
    ('2 weight 0',                  pg_temp.set_at(pg_temp.set_at(b, '{sections,0,weight}', '0'), '{sections,1,weight}', '60'), 'sections[0].weight'),
    ('3 weights sum to 90',         pg_temp.set_at(b, '{sections,0,weight}', '30'),                          'sections'),
    ('3 weights sum to 110',        pg_temp.set_at(b, '{sections,0,weight}', '50'),                          'sections'),
    ('4 201 questions',             jsonb_build_object('title','T','duration_minutes',60,'sections', jsonb_build_array(jsonb_build_object(
                                      'title','S','format','essay','weight',100,
                                      'questions',(select jsonb_agg(jsonb_build_object('prompt','q'||i)) from generate_series(1,201) i)))), 'sections'),
    ('4 prompt over 4000',          pg_temp.set_at(b, '{sections,0,questions,0,prompt}', to_jsonb(repeat('x', 4001))), 'sections[0].questions[0].prompt'),
    ('4 option over 500',           pg_temp.set_at(b, '{sections,0,questions,0,options,0,text}', to_jsonb(repeat('x', 501))), 'sections[0].questions[0].options'),
    ('4 accepted answer over 200',  pg_temp.set_at(b, '{sections,2,questions,0,key,accepted_answers}', to_jsonb(array[repeat('x', 201)])), 'sections[2].questions[0].key'),
    ('5 empty prompt',              pg_temp.set_at(b, '{sections,1,questions,0,prompt}', '"  "'),            'sections[1].questions[0].prompt'),
    ('5 empty essay prompt',        pg_temp.set_at(b, '{sections,3,questions,0,prompt}', '""'),              'sections[3].questions[0].prompt'),
    ('6 mcq one option',            pg_temp.set_at(b, '{sections,0,questions,0,options}', '[{"id":"a","text":"x"}]'), 'sections[0].questions[0].options'),
    ('6 mcq nine options',          pg_temp.set_at(b, '{sections,0,questions,0,options}', (select jsonb_agg(jsonb_build_object('id', chr(96 + i), 'text', 't' || i)) from generate_series(1, 9) i)), 'sections[0].questions[0].options'),
    ('6 mcq duplicate ids',         pg_temp.set_at(b, '{sections,0,questions,0,options}', '[{"id":"a","text":"x"},{"id":"a","text":"y"}]'), 'sections[0].questions[0].options'),
    ('6 mcq blank option text',     pg_temp.set_at(b, '{sections,0,questions,0,options,1,text}', '" "'),     'sections[0].questions[0].options'),
    ('6 mcq no correct option',     pg_temp.set_at(b, '{sections,0,questions,0,key,correct_option_ids}', '[]'), 'sections[0].questions[0].key'),
    ('6 mcq correct not an option', pg_temp.set_at(b, '{sections,0,questions,0,key,correct_option_ids}', '["z"]'), 'sections[0].questions[0].key'),
    ('7 tf wrong option ids',       pg_temp.set_at(b, '{sections,1,questions,0,options}', '[{"id":"a","text":"True"},{"id":"b","text":"False"}]'), 'sections[1].questions[0].options'),
    ('7 tf three options',          pg_temp.set_at(b, '{sections,1,questions,0,options}', '[{"id":"true","text":"T"},{"id":"false","text":"F"},{"id":"maybe","text":"M"}]'), 'sections[1].questions[0].options'),
    ('7 tf both correct',           pg_temp.set_at(b, '{sections,1,questions,0,key,correct_option_ids}', '["true","false"]'), 'sections[1].questions[0].key'),
    ('7 tf none correct',           pg_temp.set_at(b, '{sections,1,questions,0,key,correct_option_ids}', '[]'), 'sections[1].questions[0].key'),
    ('8 fill no answers',           pg_temp.set_at(b, '{sections,2,questions,0,key,accepted_answers}', '[]'), 'sections[2].questions[0].key'),
    ('8 fill blank answers only',   pg_temp.set_at(b, '{sections,2,questions,0,key,accepted_answers}', '["", "  "]'), 'sections[2].questions[0].key')
  ) as t(descr, doc, path) loop
    p := pg_temp.problems(spec.doc);
    assert pg_temp.has_path(p, spec.path), 'AC-1.2 rule ' || spec.descr || ': expected path ' || spec.path || ', got ' || p::text;
    assert not pg_temp.has_path(p, 'UNEXPECTED'), 'AC-1.2 rule ' || spec.descr || ': unexpected error ' || p::text;
    assert (select every(e->>'message' <> '') from jsonb_array_elements(p) e), 'every problem carries a message: ' || spec.descr;
  end loop;

  -- several problems are reported together, each with its own path
  p := pg_temp.problems(pg_temp.set_at(pg_temp.set_at(pg_temp.set_at(b, '{title}', '""'), '{sections,0,questions,0,prompt}', '""'), '{sections,2,questions,0,key,accepted_answers}', '[]'));
  assert jsonb_array_length(p) = 3 and pg_temp.has_path(p, 'title') and pg_temp.has_path(p, 'sections[0].questions[0].prompt')
         and pg_temp.has_path(p, 'sections[2].questions[0].key'), 'three problems, three paths: ' || p::text;

  -- a failed publish changes nothing
  assert (select status from private.exam_versions where id = pg_temp.vid(c3, 'draft')) = 'draft', 'still a draft';
  assert not (select exam_live from public.courses where id = c3), 'exam_live still false';
  assert pg_temp.vid(c3, 'live') is null, 'no live version';

  -- an essay without key and a tf/mcq/fill that satisfy every rule publish (the base document is valid)
  assert pg_temp.problems(b) = '[]'::jsonb, 'the valid base document publishes';
  assert pg_temp.vid(c3, 'live') is not null and (select exam_live from public.courses where id = c3), 'course 3 is live now';
end $$;

do $$ begin raise notice '== T1.5 publish: live state, retire, locks (AC-1.3, AC-1.6) =='; end $$;
do $$
declare c uuid := pg_temp.cid(1); v1 uuid := pg_temp.vid(pg_temp.cid(1), 'draft'); r jsonb; live_before text; z uuid := gen_random_uuid();
begin
  assert pg_temp.err(format('select pg_temp.publish(%L)', z)) = 'E_NOT_FOUND', 'publish: unknown version';
  r := pg_temp.publish(v1);
  assert r->>'status' = 'live' and (r->>'version_no')::int = 1 and (r->>'id')::uuid = v1, 'publish returns the live version';
  assert (select status from private.exam_versions where id = v1) = 'live' and (select published_at from private.exam_versions where id = v1) is not null, 'live with published_at';
  assert (select exam_live from public.courses where id = c), 'AC-1.6: courses.exam_live = true';
  assert (select count(*) from private.exam_versions v join private.exams e on e.id = v.exam_id where e.course_id = c and v.status = 'live') = 1, 'exactly one live';
  assert pg_temp.get_exam(c)->'draft' = 'null'::jsonb, 'no draft any more';

  -- a live version cannot be republished, edited through save_draft, or discarded
  assert pg_temp.err(format('select pg_temp.publish(%L)', v1)) = 'E_VALIDATION', 'cannot publish a live version';
  assert pg_temp.err(format('select pg_temp.save(%L, 0, %L::jsonb)', v1, pg_temp.base()::text)) = 'E_VALIDATION', 'cannot save into a live version';
  assert pg_temp.err(format('select public.admin_discard_draft(%L, %L)', pg_temp.tok(), v1)) = 'E_VALIDATION', 'cannot discard a live version';

  -- AC-1.3: the database itself refuses a second live version and a second draft
  assert (select coalesce(pg_temp.err(format('insert into private.exam_versions(exam_id, version_no, status) select exam_id, 99, %L from private.exam_versions where id = %L', 'live', v1)), '') ) like '%one_live_per_exam%',
         'AC-1.3: unique index blocks a second live version';
  assert (select pg_temp.err(format('insert into private.exam_versions(exam_id, version_no, status) select exam_id, 98, %L from private.exam_versions where id = %L', 'draft', v1))) = 'OK',
         'one draft is allowed next to the live version';
  delete from private.exam_versions where version_no = 98;

  live_before := pg_temp.sig(private.exam_doc(v1));
  assert live_before = pg_temp.sig(pg_temp.base()), 'live content equals what was published';
end $$;

do $$ begin raise notice '== T1.6 new draft from live: copy with new ids, edit, publish, old version retired (AC-1.5, AC-1.6) =='; end $$;
do $$
declare c uuid := pg_temp.cid(1); v1 uuid := pg_temp.vid(pg_temp.cid(1), 'live'); d jsonb; v2 uuid; snap1 jsonb; r jsonb; rev int; n int;
begin
  snap1 := private.exam_doc(v1);
  d := pg_temp.create_draft(c);
  v2 := (d->>'id')::uuid;
  assert (d->>'version_no')::int = 2 and d->>'status' = 'draft' and (d->>'draft_rev')::int = 0, 'draft is version 2';
  assert pg_temp.sig(d) = pg_temp.sig(snap1), 'AC-1.5: the draft has the live content (incl. keys)';
  assert not (pg_temp.ids(d) && pg_temp.ids(snap1)), 'AC-1.5: every section and question id is new';
  assert array_length(pg_temp.ids(d), 1) = 9, 'nine ids in the copy';
  assert private.exam_doc(v1) = snap1, 'AC-1.5: the live version is untouched';
  assert (select count(*) from private.exam_versions where id in (v1, v2)) = 2 and pg_temp.vid(c, 'live') = v1, 'v1 still live while v2 is a draft';

  -- edit the draft: change a prompt, add an essay question, keep keys
  d := pg_temp.set_at(d, '{sections,0,questions,0,prompt}', '"What is 2+2? (v2)"');
  d := pg_temp.set_at(d, '{sections,3,questions,1}', '{"prompt":"Second essay","note":null}');
  rev := pg_temp.save(v2, 0, d);
  assert private.exam_doc(v1) = snap1, 'editing the draft does not touch the live version';
  r := pg_temp.publish(v2);
  assert (r->>'version_no')::int = 2, 'v2 published';
  assert (select status from private.exam_versions where id = v1) = 'retired', 'AC-1.6: previous live is retired';
  assert (select status from private.exam_versions where id = v2) = 'live', 'v2 is live';
  assert (select count(*) from private.exam_versions v join private.exams e on e.id = v.exam_id where e.course_id = c and v.status = 'live') = 1, 'exactly one live';
  assert (select exam_live from public.courses where id = c), 'exam_live stays true';
  assert private.exam_doc(v1) = (snap1 || '{"status":"retired"}'::jsonb), 'the retired version content is unchanged';
  assert jsonb_array_length(pg_temp.get_exam(c)->'versions') = 2 and pg_temp.get_exam(c)->'versions'->0->>'status' = 'live'
         and (pg_temp.get_exam(c)->'versions'->0->>'question_count')::int = 6 and (pg_temp.get_exam(c)->'versions'->1->>'question_count')::int = 5,
         'versions list: newest first, live then retired, with question counts';
end $$;

do $$ begin raise notice '== T1.7 typo patch (AC-1.7) =='; end $$;
do $$
declare c uuid := pg_temp.cid(1); vl uuid := pg_temp.vid(pg_temp.cid(1), 'live'); vr uuid;
        qm uuid; qt uuid; qf uuid; qe uuid; qr uuid; qd uuid; before jsonb; after jsonb; r jsonb; bad jsonb;
begin
  select id into vr from private.exam_versions v where v.exam_id = (select id from private.exams where course_id = c) and status = 'retired';
  select q.id into qm from private.questions q join private.sections s on s.id = q.section_id where s.version_id = vl and s.format = 'mcq' and q.position = 1;
  select q.id into qt from private.questions q join private.sections s on s.id = q.section_id where s.version_id = vl and s.format = 'tf';
  select q.id into qf from private.questions q join private.sections s on s.id = q.section_id where s.version_id = vl and s.format = 'fill';
  select q.id into qe from private.questions q join private.sections s on s.id = q.section_id where s.version_id = vl and s.format = 'essay' and q.position = 0;
  select q.id into qr from private.questions q join private.sections s on s.id = q.section_id where s.version_id = vr and s.format = 'mcq' and q.position = 0;
  before := private.exam_doc(vl);

  -- allowed: text only
  r := public.admin_patch_text(pg_temp.tok(), qm, 'Pick the prime numbers', '[{"id":"a","text":"two"},{"id":"b","text":"three"},{"id":"c","text":"four"}]'::jsonb);
  assert r->>'prompt' = 'Pick the prime numbers', 'patch returns the new text';
  assert (select prompt from private.questions where id = qm) = 'Pick the prime numbers', 'prompt patched';
  assert (select options from private.questions where id = qm) = '[{"id":"a","text":"two"},{"id":"b","text":"three"},{"id":"c","text":"four"}]'::jsonb, 'option texts patched, ids kept';
  after := private.exam_doc(vl);
  assert after #> '{sections,0,questions,1,key}' = before #> '{sections,0,questions,1,key}', 'keys untouched by a patch';
  assert (after->'sections'->0->>'weight') = (before->'sections'->0->>'weight') and after->>'draft_rev' = before->>'draft_rev', 'weights and structure untouched';

  -- refused: any change to option ids, order or count
  foreach bad in array array[
    '[{"id":"x","text":"two"},{"id":"b","text":"three"},{"id":"c","text":"four"}]'::jsonb,       -- renamed id
    '[{"id":"b","text":"three"},{"id":"a","text":"two"},{"id":"c","text":"four"}]'::jsonb,       -- reordered
    '[{"id":"a","text":"two"},{"id":"b","text":"three"}]'::jsonb,                                -- option removed
    '[{"id":"a","text":"two"},{"id":"b","text":"three"},{"id":"c","text":"four"},{"id":"d","text":"five"}]'::jsonb, -- option added
    '[{"text":"two"},{"id":"b","text":"three"},{"id":"c","text":"four"}]'::jsonb,                 -- missing id
    '[{"id":"a","text":" "},{"id":"b","text":"three"},{"id":"c","text":"four"}]'::jsonb,         -- blank mcq text
    '"nope"'::jsonb, 'null'::jsonb
  ] loop
    assert pg_temp.err(format('select public.admin_patch_text(%L, %L, %L, %L::jsonb)', pg_temp.tok(), qm, 'x', bad::text)) = 'E_VALIDATION',
           'AC-1.7: refused ' || bad::text;
  end loop;
  assert pg_temp.err(format('select public.admin_patch_text(%L, %L, %L, null)', pg_temp.tok(), qm, 'x')) = 'E_VALIDATION', 'mcq needs its options';
  assert pg_temp.err(format('select public.admin_patch_text(%L, %L, %L, %L::jsonb)', pg_temp.tok(), qm, '   ', '[{"id":"a","text":"two"},{"id":"b","text":"three"},{"id":"c","text":"four"}]')) = 'E_VALIDATION', 'empty prompt refused';
  assert pg_temp.err(format('select public.admin_patch_text(%L, %L, %L, %L::jsonb)', pg_temp.tok(), qm, repeat('x', 4001), '[{"id":"a","text":"two"},{"id":"b","text":"three"},{"id":"c","text":"four"}]')) = 'E_VALIDATION', 'long prompt refused';
  assert private.exam_doc(vl) = after, 'refused patches changed nothing';

  -- tf: texts may be patched, ids may not; fill/essay: prompt only
  r := public.admin_patch_text(pg_temp.tok(), qt, 'The sky is blue (patched).', '[{"id":"true","text":"Yes"},{"id":"false","text":"No"}]'::jsonb);
  assert (select options from private.questions where id = qt) = '[{"id":"true","text":"Yes"},{"id":"false","text":"No"}]'::jsonb, 'tf option texts patched';
  assert pg_temp.err(format('select public.admin_patch_text(%L, %L, %L, %L::jsonb)', pg_temp.tok(), qt, 'x', '[{"id":"false","text":"No"},{"id":"true","text":"Yes"}]')) = 'E_VALIDATION', 'tf reorder refused';
  perform public.admin_patch_text(pg_temp.tok(), qf, 'The capital of France is ______', null);
  perform public.admin_patch_text(pg_temp.tok(), qe, 'Discuss briefly.', '[]'::jsonb);
  assert (select prompt from private.questions where id = qf) = 'The capital of France is ______' and (select prompt from private.questions where id = qe) = 'Discuss briefly.', 'fill and essay prompts patched';
  assert pg_temp.err(format('select public.admin_patch_text(%L, %L, %L, %L::jsonb)', pg_temp.tok(), qf, 'x', '[{"id":"a","text":"x"}]')) = 'E_VALIDATION', 'fill has no options';
  assert (select accepted_answers from private.question_keys where question_id = qf) = array['Paris','paris'], 'fill key untouched';

  -- retired versions can be patched too; drafts and unknown questions cannot
  perform public.admin_patch_text(pg_temp.tok(), qr, 'What is 2+2? (typo fixed)', '[{"id":"a","text":"3"},{"id":"b","text":"four"}]'::jsonb);
  assert (select prompt from private.questions where id = qr) = 'What is 2+2? (typo fixed)', 'retired version patched';
  perform pg_temp.create_draft(c);
  select q.id into qd from private.questions q join private.sections s on s.id = q.section_id where s.version_id = pg_temp.vid(c, 'draft') limit 1;
  assert pg_temp.err(format('select public.admin_patch_text(%L, %L, %L, null)', pg_temp.tok(), qd, 'x')) = 'E_VALIDATION', 'a draft question is not patchable';
  assert pg_temp.err(format('select public.admin_patch_text(%L, %L, %L, null)', pg_temp.tok(), gen_random_uuid(), 'x')) = 'E_NOT_FOUND', 'unknown question';
end $$;

do $$ begin raise notice '== T1.8 discard draft =='; end $$;
do $$
declare c uuid := pg_temp.cid(1); v3 uuid := pg_temp.vid(pg_temp.cid(1), 'draft'); live uuid := pg_temp.vid(pg_temp.cid(1), 'live'); n int; d jsonb;
begin
  assert v3 is not null, 'the draft from the patch test exists';
  select count(*) into n from private.sections where version_id = v3;
  assert n = 4, 'the draft has its own sections';
  perform public.admin_discard_draft(pg_temp.tok(), v3);
  assert pg_temp.vid(c, 'draft') is null and pg_temp.get_exam(c)->'draft' = 'null'::jsonb, 'draft gone';
  assert not exists (select 1 from private.sections where version_id = v3) and not exists (select 1 from private.exam_versions where id = v3), 'its sections are gone too (cascade)';
  assert pg_temp.err(format('select public.admin_discard_draft(%L, %L)', pg_temp.tok(), v3)) = 'E_NOT_FOUND', 'discarding twice: not found';
  assert pg_temp.vid(c, 'live') = live and (select exam_live from public.courses where id = c), 'live version and exam_live unaffected';
  d := pg_temp.create_draft(c);
  assert (d->>'version_no')::int = 3, 'a new draft can be created again';
  perform public.admin_discard_draft(pg_temp.tok(), (d->>'id')::uuid);
end $$;

do $$ begin raise notice '== T1.9 copy an exam into another course as a draft (AC-1.10, server side of task 1.7) =='; end $$;
do $$
declare c1 uuid := pg_temp.cid(1); c2 uuid := pg_temp.cid(2); src uuid := pg_temp.vid(pg_temp.cid(1), 'live'); d jsonb; dst uuid; snap jsonb;
begin
  snap := private.exam_doc(src);
  d := pg_temp.create_draft(c2);                       -- empty draft in course 2
  dst := (d->>'id')::uuid;
  perform private.clone_version(src, dst);
  d := private.exam_doc(dst);
  assert d->>'status' = 'draft' and (d->>'course_id')::uuid = c2, 'AC-1.10: the copy is a draft of the new course';
  assert pg_temp.sig(d) = pg_temp.sig(snap), 'AC-1.10: content and keys copied';
  assert not (pg_temp.ids(d) && pg_temp.ids(snap)), 'AC-1.10: new ids';
  assert private.exam_doc(src) = snap, 'AC-1.10: the source is untouched';
  assert not (select exam_live from public.courses where id = c2) and pg_temp.vid(c2, 'live') is null, 'AC-1.10: the new course is not live';
  assert not exists (select 1 from public.enrollments where course_id = c2), 'no roster copied (none exists)';
  perform pg_temp.publish(dst);                        -- the copy is publishable on its own
  assert (select exam_live from public.courses where id = c2), 'the copy publishes in its own course';
  assert (select count(*) from private.exam_versions where id = src and status = 'live') = 1, 'source still live in course 1';
end $$;

do $$ begin raise notice '== T1.10 computed question values (v_question_values) =='; end $$;
do $$
declare live uuid := pg_temp.vid(pg_temp.cid(3), 'live');
begin
  assert (select sum(value) from private.v_question_values where version_id = live) = 100, 'values add up to 100';
  assert (select count(*) from private.v_question_values where version_id = live) = 5, 'one row per question';
  assert (select value from private.v_question_values v join private.sections s on s.id = v.section_id where v.version_id = live and s.format = 'mcq' limit 1) = 20, 'mcq: weight 40 over 2 questions = 20 each';
  assert (select value from private.v_question_values v join private.sections s on s.id = v.section_id where v.version_id = live and s.format = 'essay' limit 1) = 20, 'essay: weight 20 over 1 question = 20';
end $$;

do $$ begin raise notice '== T1.11 foreign keys: deleting a course removes its whole exam =='; end $$;
do $$
declare c2 uuid := pg_temp.cid(2); n int;
begin
  assert (select count(*) from private.exams where course_id = c2) = 1, 'course 2 has an exam';
  delete from public.courses where id = c2;
  assert not exists (select 1 from private.exams where course_id = c2), 'exam gone';
  assert not exists (select 1 from private.exam_versions v where not exists (select 1 from private.exams e where e.id = v.exam_id)), 'no orphan versions';
  assert not exists (select 1 from private.sections s where not exists (select 1 from private.exam_versions v where v.id = s.version_id)), 'no orphan sections';
  assert not exists (select 1 from private.questions q where not exists (select 1 from private.sections s where s.id = q.section_id)), 'no orphan questions';
  assert not exists (select 1 from private.question_keys k where not exists (select 1 from private.questions q where q.id = k.question_id)), 'no orphan keys';
end $$;

-- =====================================================================================
do $$ begin raise notice '== T1.12 the public key (AC-1.1) =='; end $$;
do $$
declare fn text;
begin
  perform set_config('t.live', pg_temp.vid(pg_temp.cid(1), 'live')::text, false);
  perform set_config('t.c1text', pg_temp.cid(1)::text, false);
  -- checked as the owner (resolving names inside `private` needs rights anon rightly lacks)
  foreach fn in array array['private.exam_doc(uuid)', 'private.validate_exam_version(uuid)', 'private.clone_version(uuid,uuid)',
                            'private.write_exam_content(uuid,jsonb)', 'private.prob(text,text)'] loop
    assert not has_function_privilege('anon', fn::regprocedure, 'EXECUTE'), 'anon cannot execute ' || fn;
    assert not has_function_privilege('authenticated', fn::regprocedure, 'EXECUTE'), 'authenticated cannot execute ' || fn;
  end loop;
  foreach fn in array array['public.admin_get_exam(text,uuid)', 'public.admin_get_version(text,uuid)', 'public.admin_create_draft(text,uuid)',
                            'public.admin_save_draft(text,uuid,integer,jsonb)', 'public.admin_discard_draft(text,uuid)',
                            'public.admin_publish_version(text,uuid)', 'public.admin_patch_text(text,uuid,text,jsonb)'] loop
    assert has_function_privilege('anon', fn::regprocedure, 'EXECUTE'), 'anon can execute ' || fn;
    assert not has_function_privilege('authenticated', fn::regprocedure, 'EXECUTE'), 'authenticated cannot execute ' || fn;
  end loop;
end $$;
set role anon;
do $$
declare ok boolean; t text; m text; d jsonb; fn text;
begin
  -- no table, view or helper of the exam schema is reachable
  foreach t in array array['exams','exam_versions','sections','questions','question_keys','v_question_values'] loop
    ok := false; begin execute format('select count(*) from private.%I', t); exception when insufficient_privilege then ok := true; end;
    assert ok, 'AC-1.1: anon cannot read private.' || t;
    ok := false; begin execute format('insert into private.%I select * from private.%I limit 0', t, t); exception when insufficient_privilege then ok := true; end;
    assert ok, 'anon cannot write private.' || t;
  end loop;
  ok := false; begin perform private.exam_doc(current_setting('t.live')::uuid); exception when insufficient_privilege then ok := true; end;
  assert ok, 'private.exam_doc is not callable as anon';

  -- the 7 RPCs ARE callable by anon (grants survived 005), and refuse a bad token
  d := public.admin_get_exam(current_setting('t.tok'), current_setting('t.c1text')::uuid);
  assert jsonb_array_length(d->'versions') = 2, 'anon + valid teacher token: get_exam works';
  d := public.admin_get_version(current_setting('t.tok'), current_setting('t.live')::uuid);
  assert d->>'status' = 'live', 'anon + valid teacher token: get_version works';
  for fn in select unnest(array['admin_get_exam', 'admin_get_version']) loop
    m := null; begin execute format('select public.%I($1, $2)', fn) using 'garbage', current_setting('t.live')::uuid; exception when others then get stacked diagnostics m = message_text; end;
    assert m = 'E_AUTH', 'anon + garbage token: ' || fn || ' -> E_AUTH';
  end loop;
end $$;
reset role;

rollback;
do $$ begin raise notice 'ALL PHASE 1 EXAM BUILDER TESTS PASSED'; end $$;
