-- tests/sql/phase7_wird.test.sql: proves 063 (lessons, review engine, keys, consistency). One transaction, rolled back.
begin;
create function pg_temp.err(q text) returns text language plpgsql as $f$
declare m text; begin execute q; return null; exception when others then get stacked diagnostics m = message_text; return m; end $f$;
create function pg_temp.next_day() returns void language sql as $f$   -- simulate "tomorrow" by moving stored dates back one day
  update private.review_state set due_on = due_on - 1, last_seen = last_seen - 1;
  update private.study_events set day = day - 1;
  update private.activity_days set day = day - 1;
$f$;

do $$
declare t text; c1 uuid; c2 uuid; ea uuid; eb uuid; sidA text; sidB text; sa text; sb text; l1 uuid; l2 uuid; r jsonb; td jsonb; i1 uuid; i2 uuid; i3 uuid;
begin
  update private.secrets set value = extensions.crypt('p7-pin', extensions.gen_salt('bf', 4)) where key = 'teacher_pin_hash';
  delete from private.auth_throttle;
  t := public.teacher_login('p7-pin')->>'token';
  insert into public.courses (code, name, eligibility_rule, weight_lessons, weight_exam, pass_mark) values ('P7C', 'Phase7 A', 'open', 50, 50, 60) returning id into c1;
  insert into public.courses (code, name, eligibility_rule, weight_lessons, weight_exam, pass_mark) values ('P7D', 'Phase7 B', 'open', 50, 50, 60) returning id into c2;
  ea := (public.admin_add_student(t, c1, 'Wird A')->>'enrollment_id')::uuid;
  eb := (public.admin_add_student(t, c2, 'Wird B')->>'enrollment_id')::uuid;
  select student_id into sidA from public.enrollments where id = ea; select student_id into sidB from public.enrollments where id = eb;
  sa := public.student_login(public.admin_set_student_pin(t, sidA, '1234')->>'login_code', '1234')->>'token';
  sb := public.student_login(public.admin_set_student_pin(t, sidB, '1234')->>'login_code', '1234')->>'token';

  -- authoring rules
  assert pg_temp.err(format($q$ select public.admin_save_lesson(null, null, %L, '{"title":"x"}') $q$, c1)) = 'E_AUTH', 'authoring needs a staff token';
  assert pg_temp.err(format($q$ select public.admin_save_lesson(%L, %L, null, '{"title":""}') $q$, t, null)) = 'E_VALIDATION', 'empty title accepted';
  assert pg_temp.err(format($q$ select public.admin_save_lesson(%L, null, %L, %L::jsonb) $q$, t, c1,
    '{"title":"bad mcq","items":[{"type":"mcq","prompt":"p","answer":"z","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}]}]}')) = 'E_VALIDATION', 'mcq with an answer outside its options accepted';
  l1 := (public.admin_save_lesson(t, null, c1, $j${"title":"Lesson 1","body":"Read this.","items":[
     {"type":"recall","prompt":"Say bismillah","answer":"Bismillah","alts":["باسم الله"]},
     {"type":"recall","prompt":"Praise","answer":"الحمد لله"},
     {"type":"mcq","prompt":"Pick b","answer":"b","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}]}]}$j$::jsonb)->>'id')::uuid;
  l2 := (public.admin_save_lesson(t, null, c1, '{"title":"Lesson 2","items":[{"type":"recall","prompt":"Second","answer":"two"}]}')->>'id')::uuid;
  assert pg_temp.err(format($q$ select public.admin_publish_lesson(%L, %L, true) $q$, t, (public.admin_save_lesson(t, null, c1, '{"title":"empty"}')->>'id')::uuid)) = 'E_VALIDATION', 'a lesson with no items was published';
  perform public.admin_publish_lesson(t, l1, true);   -- l2 stays draft

  -- what a student sees: no answers, no drafts, nothing from other courses
  td := public.student_wird_today(sa);
  assert td->'sabaq'->>'title' = 'Lesson 1' and jsonb_array_length(td->'sabaq'->'items') = 3, 'A sees lesson 1: ' || td::text;
  assert position('"answer"' in td::text) = 0 and position('alts' in td::text) = 0 and position('Bismillah' in td::text) = 0, 'today leaks an answer';
  assert public.student_wird_today(sb)->'sabaq' = 'null'::jsonb, 'B is not enrolled in course A';
  select (x->>'id')::uuid into i1 from jsonb_array_elements(td->'sabaq'->'items') x where x->>'prompt' = 'Say bismillah';
  select (x->>'id')::uuid into i2 from jsonb_array_elements(td->'sabaq'->'items') x where x->>'prompt' = 'Praise';
  select (x->>'id')::uuid into i3 from jsonb_array_elements(td->'sabaq'->'items') x where x->>'prompt' = 'Pick b';
  assert pg_temp.err(format($q$ select public.student_wird_answer(%L, %L, 'x') $q$, sb, i1)) = 'E_NOT_FOUND', 'B answered an item from a course he is not in';
  assert pg_temp.err(format($q$ select public.student_wird_answer(%L, %L, 'x') $q$, sa, (select id from private.lesson_items where lesson_id = l2 limit 1))) = 'E_NOT_FOUND', 'A answered an item of a draft lesson';

  -- grading is forgiving about case, spacing and Arabic vowel marks; alternates work; mcq is by id
  r := public.student_wird_answer(sa, i1, '  bismillah ');
  assert (r->>'correct')::boolean and (r->>'box')::int = 1 and (r->>'due_on')::date = private.today() + 1, 'first correct -> box 1, due tomorrow: ' || r::text;
  assert (public.student_wird_answer(sa, i2, 'الْحَمْدُ لِلَّهِ')->>'correct')::boolean, 'harakat must be ignored';
  assert (public.student_wird_answer(sa, i3, 'b')->>'correct')::boolean, 'mcq by id';
  r := public.student_wird_answer(sa, i1, 'something else');   -- same item, same day: first result stands, nothing changes
  assert (r->>'repeat')::boolean and (r->>'correct')::boolean and (r->>'box')::int = 1, 'same-day repeat must be idempotent: ' || r::text;
  assert (select items_done from private.activity_days where student_id = sidA) = 3, 'activity counted once per item';
  assert (public.student_wird_today(sa)->>'items_done_today')::int = 3, 'today count';

  -- next day: all three are due in Sabqi; a miss drops to box 1, two misses in a row = Repair and pause NEW work
  perform pg_temp.next_day();
  td := public.student_wird_today(sa);
  assert jsonb_array_length(td->'sabqi') = 3 and jsonb_array_length(td->'manzil') = 0, 'sabqi has the 3 due items: ' || td::text;
  perform public.admin_publish_lesson(t, l2, true);
  assert (public.student_wird_today(sa)->'sabaq'->>'title') = 'Lesson 2', 'new lesson offered when nothing is in repair';
  r := public.student_wird_answer(sa, i2, 'wrong');
  assert not (r->>'correct')::boolean and (r->>'box')::int = 1 and (r->>'answer') = 'الحمد لله', 'miss -> box 1, answer revealed after answering';
  perform pg_temp.next_day();
  r := public.student_wird_answer(sa, i2, 'wrong again');
  assert (select misses from private.review_state where student_id = sidA and item_id = i2) = 2, 'two misses in a row';
  td := public.student_wird_today(sa);
  assert (td->>'paused_new')::boolean and td->>'repair' = '1' and td->'sabaq' = 'null'::jsonb, 'Repair must pause new lessons: ' || td::text;
  perform pg_temp.next_day();
  perform public.student_wird_answer(sa, i2, 'الحمد لله');   -- repaired
  assert not (public.student_wird_today(sa)->>'paused_new')::boolean, 'repair cleared';

  -- keys: a lesson's key is earned when every item has reached box 3
  assert jsonb_array_length(public.student_progress(sa)->'keys') = 0, 'no key yet';
  update private.review_state set box = 3, due_on = private.today() where student_id = sidA and item_id in (i1, i3);
  update private.review_state set box = 2, due_on = private.today() where student_id = sidA and item_id = i2;
  perform pg_temp.next_day(); update private.review_state set due_on = private.today();
  r := public.student_wird_answer(sa, i2, 'الحمد لله');
  assert (r->>'box')::int = 3 and (r->>'key_earned')::boolean, 'key earned at box 3 everywhere: ' || r::text;
  assert jsonb_array_length(public.student_progress(sa)->'keys') = 1 and (public.student_progress(sa)->>'lessons_total')::int = 2, 'progress: ' || public.student_progress(sa)::text;
  assert (public.student_wird_answer(sa, i2, 'x')->>'key_earned')::boolean is false, 'key is awarded once';

  -- consistency: Friday is a rest day and never counts
  declare v_before int := (public.student_progress(sa)->>'week_days_done')::int; v_fri date := date_trunc('week', private.today())::date + 4;
  begin
    insert into private.activity_days (student_id, day, items_done) values (sidA, v_fri, 5) on conflict (student_id, day) do nothing;
    assert (public.student_progress(sa)->>'week_days_done')::int = v_before, 'Friday must not count toward the week';
    assert (public.student_progress(sa)->>'week_days_expected')::int = 6, 'six expected days';
  end;

  -- items are locked once students have progress; text edits are still allowed
  assert pg_temp.err(format($q$ select public.admin_save_lesson(%L, %L, null, '{"title":"x","items":[{"prompt":"p","answer":"a"}]}') $q$, t, l1)) = 'E_VALIDATION', 'items edited under live progress';
  assert (public.admin_save_lesson(t, l1, null, '{"title":"Lesson 1 (renamed)"}')->>'ok')::boolean, 'title-only edit allowed';
  assert (select count(*) from jsonb_array_elements(public.admin_list_lessons(t, c1)) x where x->>'title' like 'Lesson 1%' and (x->>'learners')::int = 1 and (x->>'items')::int = 3) = 1, 'lesson list shape';
  assert pg_temp.err(format($q$ select public.admin_list_lessons(%L, %L) $q$, sa, c1)) = 'E_AUTH', 'a student token reached admin_list_lessons';
end $$;

do $$ begin raise notice '== ALL PHASE 7 WIRD TESTS PASSED (transaction rolled back) =='; end $$;
rollback;
