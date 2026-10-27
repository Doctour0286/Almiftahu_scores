-- tests/sql/phase8_lesson_admin.test.sql: proves 064. One transaction, rolled back.
begin;
create function pg_temp.err(q text) returns text language plpgsql as $f$
declare m text; begin execute q; return null; exception when others then get stacked diagnostics m = message_text; return m; end $f$;
do $$
declare t text; c uuid; e uuid; sid text; sa text; la uuid; lb uuid; r jsonb; td jsonb; it uuid;
begin
  update private.secrets set value = extensions.crypt('p8-pin', extensions.gen_salt('bf', 4)) where key = 'teacher_pin_hash';
  delete from private.auth_throttle; t := public.teacher_login('p8-pin')->>'token';
  insert into public.courses (code, name, eligibility_rule, weight_lessons, weight_exam, pass_mark) values ('P8C', 'Phase8', 'open', 50, 50, 60) returning id into c;
  e := (public.admin_add_student(t, c, 'Edit Student')->>'enrollment_id')::uuid; select student_id into sid from public.enrollments where id = e;
  sa := public.student_login(public.admin_set_student_pin(t, sid, '1234')->>'login_code', '1234')->>'token';
  la := (public.admin_save_lesson(t, null, c, '{"title":"A","items":[{"type":"mcq","prompt":"pick","answer":"c","options":[{"id":"a","text":"x"},{"id":"b","text":"y"},{"id":"c","text":"z"}]},{"prompt":"recall","answer":"yes","alts":["y"]}]}')->>'id')::uuid;
  lb := (public.admin_save_lesson(t, null, c, '{"title":"B","items":[{"prompt":"b1","answer":"b"}]}')->>'id')::uuid;
  perform public.admin_publish_lesson(t, la, true); perform public.admin_publish_lesson(t, lb, true);

  -- staff see answers; students and strangers cannot call it
  r := public.admin_get_lesson(t, la);
  assert r->>'title' = 'A' and not (r->>'locked')::boolean and jsonb_array_length(r->'items') = 2 and r->'items'->0->>'answer' = 'c' and r->'items'->1->'alts'->>0 = 'y', 'get_lesson shape: ' || r::text;
  assert pg_temp.err(format($q$ select public.admin_get_lesson(%L, %L) $q$, sa, la)) = 'E_AUTH', 'student reached admin_get_lesson';
  assert pg_temp.err(format($q$ select public.admin_get_lesson(null, %L) $q$, la)) = 'E_AUTH', 'no token';
  assert pg_temp.err(format($q$ select public.admin_get_lesson(%L, gen_random_uuid()) $q$, t)) = 'E_NOT_FOUND', 'unknown lesson';

  -- editing before progress replaces items; reordering decides which lesson is NEW first
  assert (public.admin_save_lesson(t, la, null, '{"title":"A2","items":[{"prompt":"only","answer":"one"}]}')->>'ok')::boolean, 'edit items before progress';
  assert jsonb_array_length(public.admin_get_lesson(t, la)->'items') = 1, 'items replaced';
  assert public.student_wird_today(sa)->'sabaq'->>'title' = 'A2', 'lowest position first';
  perform public.admin_set_lesson_position(t, lb, 0 + 0 + 1); perform public.admin_set_lesson_position(t, la, 5);
  assert public.student_wird_today(sa)->'sabaq'->>'title' = 'B', 'reorder must change the next new lesson';
  assert pg_temp.err(format($q$ select public.admin_set_lesson_position(%L, %L, 0) $q$, t, la)) = 'E_VALIDATION', 'position 0 accepted';

  -- once a student has progress: locked, and cannot be deleted
  select (x->>'id')::uuid into it from jsonb_array_elements(public.student_wird_today(sa)->'sabaq'->'items') x limit 1;
  perform public.student_wird_answer(sa, it, 'b');
  assert (public.admin_get_lesson(t, lb)->>'locked')::boolean, 'locked after progress';
  assert pg_temp.err(format($q$ select public.admin_delete_lesson(%L, %L) $q$, t, lb)) = 'E_VALIDATION', 'deleted a lesson with student progress';
  r := public.admin_delete_lesson(t, la);
  assert (r->>'ok')::boolean, 'untouched lesson can be deleted';
  assert not exists (select 1 from private.lessons where id = la), 'lesson row must be gone';
  assert pg_temp.err(format($q$ select public.admin_delete_lesson(%L, %L) $q$, sa, lb)) = 'E_AUTH', 'student deleted a lesson';
end $$;
do $$ begin raise notice '== ALL PHASE 8 LESSON ADMIN TESTS PASSED (transaction rolled back) =='; end $$;
rollback;
