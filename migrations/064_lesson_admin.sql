-- 064_lesson_admin.sql  (PRD v4 Phase 2: lesson editor support). Additive and idempotent.
--   admin_get_lesson       : one lesson with its items AND answers, for staff only (students never get this).
--   admin_delete_lesson    : refused once any student has progress on the lesson (history is never destroyed).
--   admin_set_lesson_position : reorder; the student's next NEW lesson is the lowest position they have not started.
create or replace function public.admin_get_lesson(p_token text, p_lesson_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private, extensions as $$
declare l private.lessons;
begin
  perform private.require_teacher(p_token);
  select * into l from private.lessons where id = p_lesson_id;
  if l.id is null then perform private.fail('E_NOT_FOUND', 'Lesson not found.'); end if;
  return jsonb_build_object('id', l.id, 'course_id', l.course_id, 'position', l.position, 'title', l.title, 'title_ar', l.title_ar, 'body', l.body, 'status', l.status,
    'locked', exists (select 1 from private.review_state rs join private.lesson_items li on li.id = rs.item_id where li.lesson_id = l.id),
    'items', coalesce((select jsonb_agg(jsonb_build_object('type', li.type, 'prompt', li.prompt, 'options', li.options, 'answer', li.answer, 'alts', to_jsonb(li.alts)) order by li.position)
                         from private.lesson_items li where li.lesson_id = l.id), '[]'::jsonb));
end $$;

create or replace function public.admin_delete_lesson(p_token text, p_lesson_id uuid) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  if not exists (select 1 from private.lessons where id = p_lesson_id) then perform private.fail('E_NOT_FOUND', 'Lesson not found.'); end if;
  if exists (select 1 from private.review_state rs join private.lesson_items li on li.id = rs.item_id where li.lesson_id = p_lesson_id) then
    perform private.fail('E_VALIDATION', 'Students already have progress on this lesson. Unpublish it instead.'); end if;
  delete from private.lessons where id = p_lesson_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_set_lesson_position(p_token text, p_lesson_id uuid, p_position int) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);
  if p_position is null or p_position < 1 or p_position > 1000 then perform private.fail('E_VALIDATION', 'Position must be between 1 and 1000.'); end if;
  update private.lessons set position = p_position where id = p_lesson_id;
  if not found then perform private.fail('E_NOT_FOUND', 'Lesson not found.'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.admin_get_lesson(text, uuid), public.admin_delete_lesson(text, uuid), public.admin_set_lesson_position(text, uuid, int) from public;
grant execute on function public.admin_get_lesson(text, uuid), public.admin_delete_lesson(text, uuid), public.admin_set_lesson_position(text, uuid, int) to anon;
do $$ begin
  assert has_function_privilege('anon', 'public.admin_get_lesson(text, uuid)', 'execute'), '064: anon lost admin_get_lesson';
  raise notice '064 applied and verified: lesson admin ready.';
end $$;
