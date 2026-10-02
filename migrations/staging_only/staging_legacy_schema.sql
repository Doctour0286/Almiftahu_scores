-- STAGING ONLY. Never run on production (those tables already exist there).
-- Recreates the two legacy tables the current Score Portal uses, so 001 has something to copy.
-- Shapes are inferred from index.html; if production differs, prefer a real export/import.
-- Safe to re-run.

create table if not exists public.students (
  id          text primary key,           -- 's' || sn
  sn          int  not null,
  name        text not null,
  days        int[],                      -- -1 = unset
  bonus_units int[],
  active      boolean not null default true
);

create table if not exists public.app_settings (
  key   text primary key,
  value text
);

-- Fill with real data by ONE of:
--  (a) Supabase Dashboard > Table Editor (production) > export students as CSV, then
--      Table Editor (staging) > students > Import CSV. Do the same for app_settings if you
--      want the same PIN on staging (otherwise 002 hashes the legacy fallback "2026").
--  (b) Fake rows, for a quick smoke test only (uncomment):
-- insert into public.students (id, sn, name, days, bonus_units, active) values
--  ('s1', 1, 'Test Student One',   '{10,9,8,7,6,5,4,3,2,1}',          '{0,0,0,0,0,0,0,0,0,0}', true),
--  ('s2', 2, 'Test Student Two',   '{10,10,10,10,10,10,10,10,10,10}', '{1,0,0,0,0,0,0,0,0,2}', true),
--  ('s3', 3, 'Test Student Three', '{5,-1,-1,-1,-1,-1,-1,-1,-1,-1}',  '{0,0,0,0,0,0,0,0,0,0}', true)
-- on conflict (id) do nothing;
