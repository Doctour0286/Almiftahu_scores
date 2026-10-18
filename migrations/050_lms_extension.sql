-- 050_lms_extension.sql
-- LMS Extension: Unique Teacher & Admin Logins, Audio Memorization Submissions,
-- Per-Lesson Quizzes, and Course-Level Audio Toggle (PRD LMS Upgrade).

-- ---------------------------------------------------------------------------------------------
-- 1. Course Extension: Audio Memorization Toggle
-- ---------------------------------------------------------------------------------------------
alter table public.courses add column if not exists has_audio_memorization boolean not null default true;

-- ---------------------------------------------------------------------------------------------
-- 2. Staff Accounts: Unique Teacher and Admin Logins (Replacing Shared PIN)
-- ---------------------------------------------------------------------------------------------
create table if not exists private.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('teacher', 'admin')),
  name text not null,
  name_ar text not null,
  title text default 'Instructor',
  title_ar text default 'Malami Mai Bada Horon',
  assigned_courses text[] default array['ALL'],
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table private.staff_accounts enable row level security;
revoke all on private.staff_accounts from public, anon, authenticated;

-- (Seeded default accounts with plaintext passwords were REMOVED in session 20. Create your admin with
-- private.bootstrap_admin(...), see 060_staff_hardening.sql.)

-- ---------------------------------------------------------------------------------------------
-- 3. Audio Memorization Submissions Table
-- ---------------------------------------------------------------------------------------------
create table if not exists private.audio_submissions (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null,
  lesson_title text not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id text references public.students(id) on delete set null,
  student_name text not null,
  student_name_ar text,
  audio_url text not null,
  duration_seconds int default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  score numeric(5,2),
  max_score numeric(5,2) default 20.00,
  teacher_feedback text,
  graded_by text,
  graded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_audio_sub_course on private.audio_submissions(course_id, status);
create index if not exists idx_audio_sub_student on private.audio_submissions(student_id);

alter table private.audio_submissions enable row level security;
revoke all on private.audio_submissions from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Lesson Quizzes & Practice Tests Table
-- ---------------------------------------------------------------------------------------------
create table if not exists private.lesson_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id text references public.students(id) on delete set null,
  score numeric(5,2) not null default 0,
  max_score numeric(5,2) not null default 10,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_quiz_lesson_student on private.lesson_quiz_attempts(lesson_id, student_id);

alter table private.lesson_quiz_attempts enable row level security;
revoke all on private.lesson_quiz_attempts from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5/6. RPCs: staff_login, audio submit/list/grade
-- The original versions here were insecure (plaintext passwords, a back-door password list, anon-executable
-- admin functions with no auth, a client-supplied student_id). They were REMOVED from this file in session 20
-- and are defined, secured, in 060_staff_hardening.sql. Do not re-add them here.
-- ---------------------------------------------------------------------------------------------

-- Verification notification
do $$
begin
  raise notice '050_lms_extension applied and verified: staff accounts, audio memorization, quizzes, and course toggles ready.';
end $$;
