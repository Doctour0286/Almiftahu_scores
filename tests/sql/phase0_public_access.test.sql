-- Phase 0 public-access tests (task 0.3): migration 004. No psql meta-commands: also runs in the
-- Supabase SQL editor. Runs in one transaction that is ROLLED BACK (it enables RLS and grants SELECT
-- to anon inside the transaction only, to prove the policies work before 005 does it for real).
begin;

do $$ begin raise notice '== T0.15 realtime publication =='; end $$;
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'no supabase_realtime publication: skipped'; return;
  end if;
  foreach t in array array['students', 'enrollments', 'courses', 'enrollment_results'] loop
    assert exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t),
           t || ' must be published';
  end loop;
  assert not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'private'),
         'private tables are never published';
end $$;

do $$ begin raise notice '== T0.16 policies exist but RLS is still off (live app unaffected) =='; end $$;
do $$
begin
  assert (select count(*) from pg_policies where schemaname = 'public'
            and policyname in ('read_courses', 'read_students', 'read_enroll', 'read_results')) = 4, 'four read policies';
  assert not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and c.relname in ('students', 'enrollments', 'courses', 'enrollment_results')
                       and c.relrowsecurity), 'RLS must NOT be enabled by 004 (that is 005)';
end $$;

do $$ begin raise notice '== T0.17 policies behave correctly once RLS is on (AC-0.11) =='; end $$;
-- fixtures (as superuser): course CA, course CB
insert into public.courses(code, name) values ('PA1', 'Public A'), ('PA2', 'Public B');
insert into public.students(id, sn, name, days, bonus_units, active) values
  ('pa1', 9001, 'Inactive Only',  array_fill(-1, array[10]), array_fill(0, array[10]), true),
  ('pa2', 9002, 'Active One',     array_fill(-1, array[10]), array_fill(0, array[10]), true),
  ('pa3', 9003, 'Mixed',          array_fill(-1, array[10]), array_fill(0, array[10]), true);
insert into public.enrollments(student_id, course_id, sn, days, bonus_units, active)
select v.sid, c.id, v.sn, array_fill(-1, array[10]), array_fill(0, array[10]), v.act
from (values ('pa1','PA1',1,false), ('pa2','PA1',2,true), ('pa3','PA1',3,true), ('pa3','PA2',1,false)) v(sid, code, sn, act)
join public.courses c on c.code = v.code;

alter table public.courses            enable row level security;
alter table public.students           enable row level security;
alter table public.enrollments        enable row level security;
alter table public.enrollment_results enable row level security;
alter table public.app_settings       enable row level security;
grant select on public.courses, public.students, public.enrollments, public.enrollment_results to anon;

set role anon;
do $$
declare ok_denied boolean;
begin
  assert (select count(*) from public.courses where code in ('PA1', 'PA2')) = 2, 'courses are public';
  assert not exists (select 1 from public.students where id = 'pa1'), 'AC-0.11: inactive-only student is hidden';
  assert exists (select 1 from public.students where id = 'pa2'), 'active student visible';
  assert exists (select 1 from public.students where id = 'pa3'), 'student with one active enrollment visible';
  assert (select count(*) from public.enrollments where student_id = 'pa3') = 1, 'only the active enrollment of a mixed student is visible';
  assert not exists (select 1 from public.enrollments where active = false), 'no inactive enrollment is visible';
  assert (select count(*) from public.enrollment_results r join public.enrollments e on e.id = r.enrollment_id
          where e.student_id in ('pa1', 'pa2', 'pa3')) = 2, 'results visible only for the two active enrollments';
  assert not exists (select 1 from public.enrollment_results r where not exists (select 1 from public.enrollments e where e.id = r.enrollment_id)),
         'no result row without a visible enrollment';
  -- app_settings: RLS on and no policy. Real Supabase grants anon SELECT by default (-> 0 rows); the
  -- local shim grants nothing (-> permission denied). Either way the PIN row is unreachable.
  begin
    assert (select count(*) from public.app_settings) = 0, 'app_settings: RLS on and no policy -> no rows';
  exception when insufficient_privilege then null;
  end;

  ok_denied := false; begin insert into public.students(id, sn, name) values ('hack', 1, 'x'); exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot insert students';
  ok_denied := false; begin update public.students set name = 'x'; exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot update students';
  ok_denied := false; begin delete from public.app_settings; exception when insufficient_privilege then ok_denied := true; end;
  assert ok_denied, 'anon cannot delete app_settings';
end $$;
reset role;

rollback;
do $$ begin raise notice '== ALL PHASE 0 PUBLIC-ACCESS TESTS PASSED (transaction rolled back) =='; end $$;
