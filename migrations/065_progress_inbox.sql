-- 065_progress_inbox.sql  (PRD v4 Phase 2/4). Additive and idempotent.
--  * student_progress now also returns the real week (Mon..Sun with done / rest / today flags) and marks a key 'overdue' when any of its
--    items is more than 3 days past due, so the app can dim it. Existing fields are unchanged.
--  * teacher_inbox (staff only): who needs attention today. Students on a course that has published lessons who have been inactive 3+ days
--    (or never started), and students in Repair. Read-only; it never changes anything.
create or replace function public.student_progress(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, private, extensions as $$
declare v_sid text := private.require_student(p_token); v_today date := private.today(); v_mon date := date_trunc('week', private.today())::date;
begin
  return jsonb_build_object(
    'keys', coalesce((select jsonb_agg(jsonb_build_object('lesson_id', k.lesson_id, 'title', l.title, 'title_ar', l.title_ar, 'earned_at', k.earned_at,
          'overdue', exists (select 1 from private.lesson_items li join private.review_state rs on rs.item_id = li.id
                              where li.lesson_id = k.lesson_id and rs.student_id = v_sid and rs.due_on < v_today - 3)) order by k.earned_at)
                        from private.keys_earned k join private.lessons l on l.id = k.lesson_id where k.student_id = v_sid), '[]'::jsonb),
    'lessons_total', (select count(*) from private.lessons l join public.enrollments e on e.course_id = l.course_id and e.student_id = v_sid and e.active where l.status = 'published'),
    'week_days_done', (select count(*) from private.activity_days a where a.student_id = v_sid and a.day between v_mon and v_mon + 6 and a.items_done > 0 and extract(isodow from a.day) <> 5),
    'week_days_expected', 6,
    'week', (select jsonb_agg(jsonb_build_object('day', d, 'done', exists (select 1 from private.activity_days a where a.student_id = v_sid and a.day = d and a.items_done > 0),
                'rest', extract(isodow from d) = 5, 'today', d = v_today) order by d) from (select (v_mon + g)::date as d from generate_series(0, 6) g) w),
    'today_items', coalesce((select items_done from private.activity_days where student_id = v_sid and day = v_today), 0));
end $$;

create or replace function public.teacher_inbox(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, private, extensions as $$
declare v_today date := private.today();
begin
  perform private.require_teacher(p_token);
  return jsonb_build_object(
    'summary', jsonb_build_object(
      'enrolled', (select count(distinct e.student_id) from public.enrollments e where e.active and exists (select 1 from private.lessons l where l.course_id = e.course_id and l.status = 'published')),
      'active_today', (select count(distinct a.student_id) from private.activity_days a where a.day = v_today and a.items_done > 0)),
    'inactive', coalesce((select jsonb_agg(x order by (x->>'days_since')::int desc nulls first) from (
        select jsonb_build_object('student_id', s.id, 'name', s.name, 'name_ar', s.name_ar, 'days_since', v_today - max(a.day), 'last_day', max(a.day)) as x
          from public.students s join public.enrollments e on e.student_id = s.id and e.active
          left join private.activity_days a on a.student_id = s.id and a.items_done > 0
         where exists (select 1 from private.lessons l where l.course_id = e.course_id and l.status = 'published')
         group by s.id, s.name, s.name_ar having max(a.day) is null or v_today - max(a.day) >= 3 limit 100) q), '[]'::jsonb),
    'repair', coalesce((select jsonb_agg(jsonb_build_object('student_id', s.id, 'name', s.name, 'name_ar', s.name_ar, 'items', n) order by n desc) from (
        select rs.student_id, count(*) as n from private.review_state rs where rs.misses >= 2 group by rs.student_id) r join public.students s on s.id = r.student_id), '[]'::jsonb));
end $$;

revoke all on function public.student_progress(text), public.teacher_inbox(text) from public;
grant execute on function public.student_progress(text), public.teacher_inbox(text) to anon;
do $$ begin assert has_function_privilege('anon', 'public.teacher_inbox(text)', 'execute'), '065: anon lost teacher_inbox'; raise notice '065 applied and verified: progress detail and inbox ready.'; end $$;
