-- 063_wird_core.sql  (PRD v4 Phase 2: lessons, review engine, keys, consistency)
-- Additive and idempotent. All tables private; reached only through RPCs. Student identity always comes from the token.
-- Ladder (D-65): box 1..6, intervals 1,3,7,14,30,60 days (system_params wird_ladder is not used yet; constants here).
-- A miss drops the item to box 1 (due tomorrow); two misses in a row put it in Repair, which pauses NEW lessons (PRD 6.1).

create table if not exists private.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null default 1,
  title text not null, title_ar text, body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);
create table if not exists private.lesson_items (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references private.lessons(id) on delete cascade,
  position int not null default 1,
  type text not null check (type in ('recall', 'mcq')),
  prompt text not null check (char_length(prompt) between 1 and 1000),
  options jsonb,                                   -- mcq: [{"id":"a","text":"..."}]
  answer text not null,                            -- recall: expected text; mcq: the correct option id. NEVER returned before answering
  alts text[] not null default '{}'
);
create table if not exists private.review_state (
  student_id text not null references public.students(id) on delete cascade,
  item_id uuid not null references private.lesson_items(id) on delete cascade,
  box int not null default 0 check (box between 0 and 6),
  due_on date not null, lapses int not null default 0, misses int not null default 0, last_seen date,
  primary key (student_id, item_id)
);
create table if not exists private.study_events (
  id bigserial primary key, student_id text not null references public.students(id) on delete cascade,
  kind text not null, item_id uuid, at timestamptz not null default now(), day date not null, meta jsonb not null default '{}'
);
create index if not exists idx_study_events_day on private.study_events(student_id, day, kind);
create table if not exists private.activity_days (student_id text not null references public.students(id) on delete cascade, day date not null, items_done int not null default 0, primary key (student_id, day));
create table if not exists private.keys_earned (student_id text not null references public.students(id) on delete cascade, lesson_id uuid not null references private.lessons(id) on delete cascade, earned_at timestamptz not null default now(), primary key (student_id, lesson_id));
alter table private.lessons enable row level security; alter table private.lesson_items enable row level security; alter table private.review_state enable row level security;
alter table private.study_events enable row level security; alter table private.activity_days enable row level security; alter table private.keys_earned enable row level security;
revoke all on private.lessons, private.lesson_items, private.review_state, private.study_events, private.activity_days, private.keys_earned from public, anon, authenticated;

create or replace function private.today() returns date language sql stable as $$ select (now() at time zone 'Africa/Lagos')::date $$;
create or replace function private.norm(x text) returns text language sql immutable as $$
  select lower(regexp_replace(regexp_replace(btrim(coalesce(x, '')), '[\u064B-\u065F\u0670\u0640]', '', 'g'), '\s+', ' ', 'g')) $$;
create or replace function private.ladder(p_box int) returns int language sql immutable as $$ select (array[1,3,7,14,30,60])[least(greatest(p_box,1),6)] $$;

-- ---------- staff: author lessons ----------
create or replace function public.admin_save_lesson(p_token text, p_lesson_id uuid, p_course_id uuid, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare v_id uuid := p_lesson_id; it jsonb; i int := 0; v_title text := btrim(coalesce(p_data->>'title', ''));
begin
  perform private.require_teacher(p_token);
  if v_title = '' or char_length(v_title) > 200 then perform private.fail('E_VALIDATION', 'A lesson title is required.'); end if;
  if jsonb_typeof(coalesce(p_data->'items', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_data->'items', '[]'::jsonb)) > 60 then perform private.fail('E_VALIDATION', 'Items must be a list of at most 60.'); end if;
  if v_id is null then
    if not exists (select 1 from public.courses where id = p_course_id) then perform private.fail('E_NOT_FOUND', 'Course not found.'); end if;
    insert into private.lessons (course_id, position, title, title_ar, body)
    values (p_course_id, coalesce(nullif(p_data->>'position', '')::int, (select coalesce(max(position), 0) + 1 from private.lessons where course_id = p_course_id)),
            v_title, nullif(btrim(p_data->>'title_ar'), ''), coalesce(p_data->>'body', '')) returning id into v_id;
  else
    if not exists (select 1 from private.lessons where id = v_id) then perform private.fail('E_NOT_FOUND', 'Lesson not found.'); end if;
    update private.lessons set title = v_title, title_ar = nullif(btrim(p_data->>'title_ar'), ''), body = coalesce(p_data->>'body', body) where id = v_id;
    if p_data ? 'items' then
      if exists (select 1 from private.review_state rs join private.lesson_items li on li.id = rs.item_id where li.lesson_id = v_id) then
        perform private.fail('E_VALIDATION', 'Students already have progress on this lesson; its items are locked.'); end if;
      delete from private.lesson_items where lesson_id = v_id;
    end if;
  end if;
  if p_data ? 'items' then
    for it in select * from jsonb_array_elements(p_data->'items') loop
      i := i + 1;
      if coalesce(it->>'type', 'recall') not in ('recall', 'mcq') or btrim(coalesce(it->>'prompt', '')) = '' or btrim(coalesce(it->>'answer', '')) = '' then
        perform private.fail('E_VALIDATION', 'Item ' || i || ' needs a prompt and an answer.'); end if;
      if coalesce(it->>'type', 'recall') = 'mcq' and (jsonb_typeof(it->'options') <> 'array' or jsonb_array_length(it->'options') < 2
         or not exists (select 1 from jsonb_array_elements(it->'options') o where o->>'id' = it->>'answer')) then
        perform private.fail('E_VALIDATION', 'Item ' || i || ': a multiple-choice item needs 2+ options and a valid answer id.'); end if;
      insert into private.lesson_items (lesson_id, position, type, prompt, options, answer, alts)
      values (v_id, i, coalesce(it->>'type', 'recall'), btrim(it->>'prompt'), it->'options', btrim(it->>'answer'),
              coalesce(array(select jsonb_array_elements_text(coalesce(it->'alts', '[]'::jsonb))), '{}'));
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.admin_publish_lesson(p_token text, p_lesson_id uuid, p_publish boolean)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  if not exists (select 1 from private.lessons where id = p_lesson_id) then perform private.fail('E_NOT_FOUND', 'Lesson not found.'); end if;
  if p_publish and not exists (select 1 from private.lesson_items where lesson_id = p_lesson_id) then perform private.fail('E_VALIDATION', 'A lesson with no items cannot be published.'); end if;
  update private.lessons set status = case when p_publish then 'published' else 'draft' end where id = p_lesson_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_list_lessons(p_token text, p_course_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'position', l.position, 'title', l.title, 'title_ar', l.title_ar, 'status', l.status,
      'items', (select count(*) from private.lesson_items where lesson_id = l.id),
      'learners', (select count(distinct rs.student_id) from private.review_state rs join private.lesson_items li on li.id = rs.item_id where li.lesson_id = l.id)) order by l.position)
    from private.lessons l where l.course_id = p_course_id), '[]'::jsonb);
end $$;

-- ---------- student: today's Wird ----------
create or replace function private.item_json(i private.lesson_items) returns jsonb language sql immutable as $$
  select jsonb_build_object('id', i.id, 'type', i.type, 'prompt', i.prompt, 'options', i.options) $$;   -- no answer, by construction

create or replace function public.student_wird_today(p_token text) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_sid text := private.require_student(p_token); v_today date := private.today(); v_repair int; v_overdue int; v_paused boolean;
        v_lesson private.lessons; v_new jsonb := null; v_sabqi jsonb; v_manzil jsonb; v_done int;
begin
  select count(*) into v_repair from private.review_state rs join private.lesson_items li on li.id = rs.item_id
    join private.lessons l on l.id = li.lesson_id join public.enrollments e on e.course_id = l.course_id and e.student_id = v_sid and e.active
   where rs.student_id = v_sid and rs.misses >= 2 and l.status = 'published';
  select count(*) into v_overdue from private.review_state rs where rs.student_id = v_sid and rs.due_on < v_today - 3;
  v_paused := v_repair > 0 or v_overdue >= 12;

  select coalesce(jsonb_agg(private.item_json(li) order by rs.misses desc, rs.due_on, li.position), '[]'::jsonb) into v_sabqi from (
    select rs.*, li.id as lid from private.review_state rs join private.lesson_items li on li.id = rs.item_id join private.lessons l on l.id = li.lesson_id
      join public.enrollments e on e.course_id = l.course_id and e.student_id = v_sid and e.active
     where rs.student_id = v_sid and rs.due_on <= v_today and rs.box <= 2 and l.status = 'published'
       and not exists (select 1 from private.study_events se where se.student_id = v_sid and se.item_id = rs.item_id and se.day = v_today and se.kind = 'answer')
     order by rs.misses desc, rs.due_on limit 6) rs join private.lesson_items li on li.id = rs.lid;
  select coalesce(jsonb_agg(private.item_json(li) order by rs.due_on, li.position), '[]'::jsonb) into v_manzil from (
    select rs.*, li.id as lid from private.review_state rs join private.lesson_items li on li.id = rs.item_id join private.lessons l on l.id = li.lesson_id
      join public.enrollments e on e.course_id = l.course_id and e.student_id = v_sid and e.active
     where rs.student_id = v_sid and rs.due_on <= v_today and rs.box >= 3 and l.status = 'published'
       and not exists (select 1 from private.study_events se where se.student_id = v_sid and se.item_id = rs.item_id and se.day = v_today and se.kind = 'answer')
     order by rs.due_on limit 6) rs join private.lesson_items li on li.id = rs.lid;

  -- one NEW lesson per day: the first published lesson the student has not started; none while paused
  select l.* into v_lesson from private.lessons l join public.enrollments e on e.course_id = l.course_id and e.student_id = v_sid and e.active
   where l.status = 'published' and not exists (select 1 from private.review_state rs join private.lesson_items li on li.id = rs.item_id where li.lesson_id = l.id and rs.student_id = v_sid)
   order by l.position, l.created_at limit 1;
  if v_lesson.id is not null and (not v_paused or exists (select 1 from private.study_events se join private.lesson_items li on li.id = se.item_id where se.student_id = v_sid and se.day = v_today and li.lesson_id = v_lesson.id)) then
    v_new := jsonb_build_object('lesson_id', v_lesson.id, 'title', v_lesson.title, 'title_ar', v_lesson.title_ar, 'body', v_lesson.body,
      'items', (select coalesce(jsonb_agg(private.item_json(li) order by li.position), '[]'::jsonb) from private.lesson_items li where li.lesson_id = v_lesson.id
                 and not exists (select 1 from private.study_events se where se.student_id = v_sid and se.item_id = li.id and se.day = v_today and se.kind = 'answer')));
  end if;
  select coalesce(items_done, 0) into v_done from private.activity_days where student_id = v_sid and day = v_today;
  return jsonb_build_object('day', v_today, 'paused_new', v_paused, 'repair', v_repair, 'items_done_today', coalesce(v_done, 0),
    'sabqi', v_sabqi, 'sabaq', v_new, 'manzil', v_manzil);
end $$;

create or replace function public.student_wird_answer(p_token text, p_item_id uuid, p_response text) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_sid text := private.require_student(p_token); v_today date := private.today(); li private.lesson_items; v_ok boolean; v_rs private.review_state;
        v_ev private.study_events; v_box int; v_key boolean := false; v_lesson uuid;
begin
  select li2.* into li from private.lesson_items li2 join private.lessons l on l.id = li2.lesson_id join public.enrollments e on e.course_id = l.course_id and e.student_id = v_sid and e.active
   where li2.id = p_item_id and l.status = 'published';
  if li.id is null then perform private.fail('E_NOT_FOUND', 'Item not available.'); end if;
  if char_length(coalesce(p_response, '')) > 1000 then perform private.fail('E_VALIDATION', 'Answer is too long.'); end if;
  -- idempotent per item per day: a repeat returns the first result and changes nothing
  select * into v_ev from private.study_events where student_id = v_sid and item_id = p_item_id and day = v_today and kind = 'answer' order by id limit 1;
  select * into v_rs from private.review_state where student_id = v_sid and item_id = p_item_id;
  if v_ev.id is not null then
    return jsonb_build_object('ok', true, 'repeat', true, 'correct', (v_ev.meta->>'correct')::boolean, 'answer', li.answer, 'box', v_rs.box, 'due_on', v_rs.due_on, 'key_earned', false);
  end if;
  if li.type = 'mcq' then v_ok := private.norm(p_response) = private.norm(li.answer);
  else v_ok := private.norm(p_response) <> '' and (private.norm(p_response) = private.norm(li.answer) or private.norm(p_response) = any (select private.norm(a) from unnest(li.alts) a)); end if;

  if v_rs.item_id is null then insert into private.review_state (student_id, item_id, box, due_on, last_seen) values (v_sid, p_item_id, 0, v_today, v_today) returning * into v_rs; end if;
  v_box := case when v_ok then least(v_rs.box + 1, 6) else 1 end;
  update private.review_state set box = v_box, due_on = v_today + private.ladder(v_box), last_seen = v_today,
         misses = case when v_ok then 0 else misses + 1 end, lapses = lapses + case when v_ok or v_rs.box = 0 then 0 else 1 end
   where student_id = v_sid and item_id = p_item_id returning * into v_rs;
  insert into private.study_events (student_id, kind, item_id, day, meta) values (v_sid, 'answer', p_item_id, v_today, jsonb_build_object('correct', v_ok));
  insert into private.activity_days (student_id, day, items_done) values (v_sid, v_today, 1) on conflict (student_id, day) do update set items_done = private.activity_days.items_done + 1;
  -- a key is earned when every item of the lesson has reached box 3
  v_lesson := li.lesson_id;
  if not exists (select 1 from private.lesson_items x where x.lesson_id = v_lesson and not exists (select 1 from private.review_state r where r.item_id = x.id and r.student_id = v_sid and r.box >= 3)) then
    insert into private.keys_earned (student_id, lesson_id) values (v_sid, v_lesson) on conflict do nothing; get diagnostics v_key = row_count;
  end if;
  return jsonb_build_object('ok', true, 'correct', v_ok, 'answer', li.answer, 'box', v_rs.box, 'due_on', v_rs.due_on, 'key_earned', v_key);
end $$;

-- keys, and weekly consistency (Mon..Sun in Lagos time; Friday is a rest day and never counts against anyone)
create or replace function public.student_progress(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, private, extensions as $$
declare v_sid text := private.require_student(p_token); v_mon date := date_trunc('week', private.today())::date;
begin
  return jsonb_build_object(
    'keys', coalesce((select jsonb_agg(jsonb_build_object('lesson_id', k.lesson_id, 'title', l.title, 'title_ar', l.title_ar, 'earned_at', k.earned_at) order by k.earned_at)
                        from private.keys_earned k join private.lessons l on l.id = k.lesson_id where k.student_id = v_sid), '[]'::jsonb),
    'lessons_total', (select count(*) from private.lessons l join public.enrollments e on e.course_id = l.course_id and e.student_id = v_sid and e.active where l.status = 'published'),
    'week_days_done', (select count(*) from private.activity_days a where a.student_id = v_sid and a.day between v_mon and v_mon + 6 and a.items_done > 0 and extract(isodow from a.day) <> 5),
    'week_days_expected', 6, 'today_items', coalesce((select items_done from private.activity_days where student_id = v_sid and day = private.today()), 0));
end $$;

revoke all on function public.admin_save_lesson(text, uuid, uuid, jsonb), public.admin_publish_lesson(text, uuid, boolean), public.admin_list_lessons(text, uuid),
  public.student_wird_today(text), public.student_wird_answer(text, uuid, text), public.student_progress(text) from public;
revoke all on function private.today(), private.norm(text), private.ladder(int), private.item_json(private.lesson_items) from public, anon, authenticated;
grant execute on function public.admin_save_lesson(text, uuid, uuid, jsonb), public.admin_publish_lesson(text, uuid, boolean), public.admin_list_lessons(text, uuid),
  public.student_wird_today(text), public.student_wird_answer(text, uuid, text), public.student_progress(text) to anon;
do $$ begin
  assert not has_table_privilege('anon', 'private.lesson_items', 'select'), '063: anon can read lesson items (answers)';
  assert has_function_privilege('anon', 'public.student_wird_today(text)', 'execute'), '063: anon lost student_wird_today';
  raise notice '063 applied and verified: Wird core ready.';
end $$;
