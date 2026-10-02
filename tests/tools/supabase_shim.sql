-- LOCAL TEST SHIM ONLY. Mimics the parts of a Supabase project the migrations rely on
-- (roles, `extensions` schema) plus the legacy tables the live app uses today.
-- Never run this on Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists extensions;
grant usage on schema public to anon, authenticated;

create table public.students (
  id text primary key, sn int, name text,
  days int[], bonus_units int[], active boolean default true
);
create table public.app_settings (key text primary key, value text);
-- sample rows in the shapes the live app writes
insert into public.students(id, sn, name, days, bonus_units, active) values
 ('s1', 1,'Ahmad Bello','{10,9,8,7,6,5,4,3,2,1}','{0,0,0,0,0,0,0,0,0,0}', true),
 ('s2', 2,'Fatima Yusuf','{10,10,10,10,10,10,10,10,10,10}','{1,0,0,0,0,0,0,0,0,2}', true),
 ('s3', 3,'Musa Ibrahim','{5,-1,-1,-1,-1,-1,-1,-1,-1,-1}','{-1,-1,-1,-1,-1,-1,-1,-1,-1,-1}', true),
 ('s4', 4,'Inactive Person','{1,1,1,1,1,1,1,1,1,1}','{0,0,0,0,0,0,0,0,0,0}', false);
insert into public.app_settings values ('teacher_pin','test-pin-1234');
-- Supabase ships this publication; the live app already subscribes to `students`.
create publication supabase_realtime for table public.students;
