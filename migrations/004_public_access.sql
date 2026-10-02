-- 004_public_access.sql  (Phase 0, task 0.3)
-- 1. Realtime: publish the new public tables (PRD §7.8). `students` is already published for the live app.
-- 2. Read policies (PRD §8.3, with the v3.4 fixes) are CREATED here but do nothing yet: RLS stays
--    disabled until 005 (lockdown), so the live app is unaffected. 005 enables RLS and the grants.
-- Additive and idempotent. Private tables are never published.
--
-- v3.4 FIX: the PRD policy `exists (select 1 from enrollments e where e.student_id = id ...)` binds the
-- bare `id` to enrollments.id (inner scope wins), not students.id, so it errors or matches nothing once
-- RLS is on. All columns below are table-qualified.

-- ---------- 1. realtime publication ----------
do $$
declare t text; v_all boolean;
begin
  select puballtables into v_all from pg_publication where pubname = 'supabase_realtime';
  if not found then
    raise notice 'Publication supabase_realtime not found (not a Supabase project?): realtime step skipped.';
    return;
  end if;
  if v_all then
    raise notice 'supabase_realtime is FOR ALL TABLES: nothing to add.';
    return;
  end if;
  foreach t in array array['students', 'enrollments', 'courses', 'enrollment_results'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- 2. read policies (inert until RLS is enabled by 005) ----------
drop policy if exists read_courses  on public.courses;
drop policy if exists read_students on public.students;
drop policy if exists read_enroll   on public.enrollments;
drop policy if exists read_results  on public.enrollment_results;

create policy read_courses on public.courses
  for select to anon using (true);

-- AC-0.11: a student whose enrollments are all inactive is invisible
create policy read_students on public.students
  for select to anon
  using (exists (select 1 from public.enrollments e
                 where e.student_id = public.students.id and e.active));

create policy read_enroll on public.enrollments
  for select to anon using (active);

create policy read_results on public.enrollment_results
  for select to anon
  using (exists (select 1 from public.enrollments e
                 where e.id = public.enrollment_results.enrollment_id and e.active));
