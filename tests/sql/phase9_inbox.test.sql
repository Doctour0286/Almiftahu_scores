-- tests/sql/phase9_inbox.test.sql: proves 065. One transaction, rolled back.
begin;
create function pg_temp.err(q text) returns text language plpgsql as $f$
declare m text; begin execute q; return null; exception when others then get stacked diagnostics m = message_text; return m; end $f$;
do $$
declare t text; c uuid; sid text[]; sa text; l uuid; it uuid; r jsonb; p jsonb; fri jsonb; i int;
begin
  update private.secrets set value = extensions.crypt('p9-pin', extensions.gen_salt('bf', 4)) where key = 'teacher_pin_hash';
  delete from private.auth_throttle; t := public.teacher_login('p9-pin')->>'token';
  insert into public.courses (code, name, eligibility_rule, weight_lessons, weight_exam, pass_mark) values ('P9C', 'Phase9', 'open', 50, 50, 60) returning id into c;
  for i in 1 .. 3 loop
    r := public.admin_add_student(t, c, 'Inbox ' || i);
    sid := sid || (select student_id from public.enrollments where id = (r->>'enrollment_id')::uuid);
  end loop;
  l := (public.admin_save_lesson(t, null, c, '{"title":"L","items":[{"prompt":"q","answer":"a"}]}')->>'id')::uuid; perform public.admin_publish_lesson(t, l, true);
  select id into it from private.lesson_items where lesson_id = l;
  sa := public.student_login(public.admin_set_student_pin(t, sid[1], '1234')->>'login_code', '1234')->>'token';

  -- access
  assert pg_temp.err(format($q$ select public.teacher_inbox(%L) $q$, sa)) = 'E_AUTH', 'student reached the inbox';
  assert pg_temp.err($q$ select public.teacher_inbox(null) $q$) = 'E_AUTH', 'no token';

  -- nobody has started: all three are inactive with no last day
  r := public.teacher_inbox(t);
  assert jsonb_array_length(r->'inactive') >= 3 and (r->'summary'->>'active_today')::int = 0, 'all unstarted: ' || r::text;

  -- student 1 answers today (active), student 2 was active 5 days ago, student 3 never
  perform public.student_wird_answer(sa, it, 'a');
  insert into private.activity_days (student_id, day, items_done) values (sid[2], private.today() - 5, 2);
  r := public.teacher_inbox(t);
  assert not exists (select 1 from jsonb_array_elements(r->'inactive') x where x->>'student_id' = sid[1]), 'an active student is not inactive';
  assert (select (x->>'days_since')::int from jsonb_array_elements(r->'inactive') x where x->>'student_id' = sid[2]) = 5, 'days since last activity';
  assert (select x->'days_since' from jsonb_array_elements(r->'inactive') x where x->>'student_id' = sid[3]) = 'null'::jsonb, 'never started = null';
  assert (r->'summary'->>'active_today')::int = 1, 'active today count';
  update private.activity_days set day = private.today() - 2 where student_id = sid[2];
  assert not exists (select 1 from jsonb_array_elements(public.teacher_inbox(t)->'inactive') x where x->>'student_id' = sid[2]), '2 days is not yet inactive';

  -- repair list
  update private.review_state set misses = 2 where student_id = sid[1];
  assert exists (select 1 from jsonb_array_elements(public.teacher_inbox(t)->'repair') x where x->>'student_id' = sid[1] and (x->>'items')::int = 1), 'repair list';

  -- progress: the real week, rest day, today flag, overdue key
  p := public.student_progress(sa);
  assert jsonb_array_length(p->'week') = 7 and (select count(*) from jsonb_array_elements(p->'week') x where (x->>'today')::boolean) = 1, 'week shape: ' || p::text;
  select x into fri from jsonb_array_elements(p->'week') x where extract(isodow from (x->>'day')::date) = 5;
  assert (fri->>'rest')::boolean, 'Friday is a rest day';
  assert (select (x->>'done')::boolean from jsonb_array_elements(p->'week') x where (x->>'today')::boolean), 'today is marked done';
  assert (p->>'week_days_expected')::int = 6 and p ? 'keys' and p ? 'lessons_total', 'old fields kept';
  insert into private.keys_earned (student_id, lesson_id) values (sid[1], l);
  assert not (public.student_progress(sa)->'keys'->0->>'overdue')::boolean, 'fresh key is not overdue';
  update private.review_state set due_on = private.today() - 10 where student_id = sid[1];
  assert (public.student_progress(sa)->'keys'->0->>'overdue')::boolean, 'a key with items 10 days overdue must dim';
end $$;
do $$ begin raise notice '== ALL PHASE 9 INBOX TESTS PASSED (transaction rolled back) =='; end $$;
rollback;
