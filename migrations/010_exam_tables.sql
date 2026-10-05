-- 010_exam_tables.sql  (Phase 1, task 1.1)
-- Exam content tables (PRD §7.2): exams, versions, sections, questions, keys, plus the
-- computed-question-value view. Everything lives in the PRIVATE schema.
--
-- Safe to run on a database that already went through 005 (lockdown), and safe to re-run.
-- Nothing in this file is reachable by the public key: no grants, RLS on, no policies, and the
-- private schema itself has no USAGE for anon/authenticated (AC-1.1). The RPCs that read and write
-- these tables arrive in 011.
--
-- DEVIATION from the PRD §7.2 reference DDL (recorded in PRD v3.10):
--   sections.weight is `>= 0 and <= 100` instead of `> 0 and <= 100`.
--   FR-X16/§7.6 promise that drafts save while incomplete ("strict checks only on publish"), and a
--   freshly added section has no weight yet. With the original `> 0` check such a draft could not be
--   saved, and publish rule 2 ("weight > 0") could never fire. Publish (011) still rejects weight 0.

-- ---------- tables ----------
create table if not exists private.exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references public.courses(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists private.exam_versions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references private.exams(id) on delete cascade,
  version_no int not null,
  status text not null check (status in ('draft','live','retired')),
  title text not null default '', title_ar text,
  instructions text, instructions_ar text,
  duration_minutes int check (duration_minutes between 1 and 600),
  draft_rev int not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (exam_id, version_no)
);
create unique index if not exists one_live_per_exam  on private.exam_versions(exam_id) where status = 'live';
create unique index if not exists one_draft_per_exam on private.exam_versions(exam_id) where status = 'draft';

create table if not exists private.sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references private.exam_versions(id) on delete cascade,
  position int not null,
  title text not null default '', title_ar text,
  format text not null check (format in ('mcq','tf','fill','essay')),
  weight numeric not null default 0 check (weight >= 0 and weight <= 100)
);
create index if not exists sections_version_idx on private.sections(version_id, position);

create table if not exists private.questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references private.sections(id) on delete cascade,
  position int not null,
  prompt text not null default '',
  options jsonb not null default '[]',      -- [{"id":"a","text":"..."}]  (mcq/tf only)
  note text                                  -- teacher-only guidance (essay), never sent to students
);
create index if not exists questions_section_idx on private.questions(section_id, position);

create table if not exists private.question_keys (
  question_id uuid primary key references private.questions(id) on delete cascade,
  correct_option_ids text[],                 -- mcq / tf
  accepted_answers   text[],                 -- fill
  tm_equiv boolean not null default false    -- fill: treat ة and ه as equal
);

-- Value of each question = section weight / number of questions in that section (FR-X4).
create or replace view private.v_question_values as
select q.id as question_id, q.section_id, s.version_id, s.format,
       s.weight / count(*) over (partition by q.section_id) as value
from private.questions q join private.sections s on s.id = q.section_id;

-- ---------- lock everything (defense in depth, same posture as 005) ----------
alter table private.exams          enable row level security;
alter table private.exam_versions  enable row level security;
alter table private.sections       enable row level security;
alter table private.questions      enable row level security;
alter table private.question_keys  enable row level security;

revoke all on private.exams, private.exam_versions, private.sections, private.questions,
              private.question_keys, private.v_question_values
  from public, anon, authenticated;

-- ---------- post-conditions (any failure raises and rolls this migration back) ----------
do $$
declare v_bad text;
begin
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'private'
  where c.relname in ('exams','exam_versions','sections','questions','question_keys','v_question_values')
    and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('authenticated', c.oid, 'SELECT')
         or has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE')
         or has_table_privilege('anon', c.oid, 'DELETE'));
  if v_bad is not null then raise exception '010 post-check: public roles have access to: %', v_bad; end if;

  select string_agg(c.relname, ', ') into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'private'
  where c.relname in ('exams','exam_versions','sections','questions','question_keys') and not c.relrowsecurity;
  if v_bad is not null then raise exception '010 post-check: RLS is off on: %', v_bad; end if;

  if has_schema_privilege('anon', 'private', 'USAGE') or has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception '010 post-check: anon/authenticated have USAGE on schema private';
  end if;

  raise notice '010 applied and verified: 5 exam tables + v_question_values in private, RLS on, no public access.';
end $$;
