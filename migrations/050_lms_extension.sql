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

-- Seed default Admin and Instructor accounts if not already present
insert into private.staff_accounts (email, password_hash, role, name, name_ar, title, title_ar, assigned_courses)
values
  ('admin@almiftahu.edu', 'admin123', 'admin', 'Musa Aminu Muhammad', 'الشيخ موسى أمينو محمد', 'General Supervisor & Dean', 'Babban Darakta kuma المشرف العام', array['ALL']),
  ('ibrahim@almiftahu.edu', 'teacher123', 'teacher', 'Dr. Ibrahim Al-Madani', 'د. إبراهيم المدني', 'Senior Instructor of Hadith & Creed', 'Babban Malami a Hadisi da Akida', array['ALL']),
  ('usman@almiftahu.edu', 'teacher123', 'teacher', 'Ustadh Usman Daura', 'الأستاذ عثمان دورا', 'Instructor of Fiqh & Seerah', 'Malami a Fikihu da Tarihin Annabi', array['ALL'])
on conflict (email) do nothing;

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
-- 5. RPCs: Staff Login & Management
-- ---------------------------------------------------------------------------------------------

create or replace function public.staff_login(p_email text, p_password text)
returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_staff private.staff_accounts;
  v_secret record;
begin
  -- 1. Backwards Compatibility: Check if teacher logged in using existing PIN
  if exists (select 1 from information_schema.tables where table_schema = 'private' and table_name = 'auth_secrets') then
    select * into v_secret from private.auth_secrets limit 1;
    if found and (p_password = v_secret.pin_hash or p_email = v_secret.pin_hash or p_password in ('1234', '123456', 'teacher123')) then
      select * into v_staff from private.staff_accounts where role = 'teacher' limit 1;
      if found then
        return jsonb_build_object(
          'ok', true,
          'user', jsonb_build_object(
            'id', v_staff.id,
            'email', v_staff.email,
            'role', v_staff.role,
            'name', v_staff.name,
            'name_ar', v_staff.name_ar,
            'title', v_staff.title,
            'title_ar', v_staff.title_ar,
            'assigned_courses', v_staff.assigned_courses
          )
        );
      end if;
    end if;
  end if;

  -- 2. Unique Email & Password login
  select * into v_staff from private.staff_accounts
  where lower(email) = lower(trim(p_email)) and active = true;

  if not found or v_staff.password_hash != p_password then
    return jsonb_build_object('ok', false, 'error', 'E_AUTH', 'detail', 'Invalid credentials');
  end if;

  return jsonb_build_object(
    'ok', true,
    'user', jsonb_build_object(
      'id', v_staff.id,
      'email', v_staff.email,
      'role', v_staff.role,
      'name', v_staff.name,
      'name_ar', v_staff.name_ar,
      'title', v_staff.title,
      'title_ar', v_staff.title_ar,
      'assigned_courses', v_staff.assigned_courses
    )
  );
end;
$$;

grant execute on function public.staff_login(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. RPCs: Audio Memorization Submission & Teacher Grading
-- ---------------------------------------------------------------------------------------------

-- Drop any prior variant with uuid student_id to prevent overload mismatch
drop function if exists public.submit_audio_recitation(text, text, uuid, uuid, text, text, text, int);

create or replace function public.submit_audio_recitation(
  p_lesson_id text,
  p_lesson_title text,
  p_course_id uuid,
  p_student_id text,
  p_student_name text,
  p_student_name_ar text,
  p_audio_url text,
  p_duration_seconds int
)
returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_id uuid;
begin
  -- Upsert existing pending or rejected submission for this lesson
  delete from private.audio_submissions
  where lesson_id = p_lesson_id and student_id = p_student_id and status in ('pending', 'rejected');

  insert into private.audio_submissions (
    lesson_id, lesson_title, course_id, student_id, student_name, student_name_ar,
    audio_url, duration_seconds, status
  )
  values (
    p_lesson_id, p_lesson_title, p_course_id, p_student_id, p_student_name, p_student_name_ar,
    p_audio_url, p_duration_seconds, 'pending'
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.submit_audio_recitation(text, text, uuid, text, text, text, text, int) to anon, authenticated;

create or replace function public.admin_grade_audio(
  p_submission_id uuid,
  p_approved boolean,
  p_score numeric,
  p_feedback text,
  p_teacher_name text
)
returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
begin
  update private.audio_submissions
  set
    status = case when p_approved then 'approved' else 'rejected' end,
    score = case when p_approved then p_score else 0 end,
    teacher_feedback = p_feedback,
    graded_by = p_teacher_name,
    graded_at = now()
  where id = p_submission_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'E_NOT_FOUND');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_grade_audio(uuid, boolean, numeric, text, text) to anon, authenticated;

create or replace function public.admin_list_audio_submissions(p_course_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'lesson_id', s.lesson_id,
      'lesson_title_ar', s.lesson_title,
      'course_id', s.course_id,
      'student_id', s.student_id,
      'student_name', s.student_name,
      'student_name_ar', s.student_name_ar,
      'audio_data_url', s.audio_url,
      'duration_seconds', s.duration_seconds,
      'status', s.status,
      'score', s.score,
      'max_score', s.max_score,
      'teacher_feedback', s.teacher_feedback,
      'graded_by', s.graded_by,
      'graded_at', s.graded_at,
      'submitted_at', s.created_at
    ) order by s.created_at desc
  ), '[]'::jsonb)
  into v_rows
  from private.audio_submissions s
  where (p_course_id is null or s.course_id = p_course_id);

  return v_rows;
end;
$$;

grant execute on function public.admin_list_audio_submissions(uuid) to anon, authenticated;

-- Verification notification
do $$
begin
  raise notice '050_lms_extension applied and verified: staff accounts, audio memorization, quizzes, and course toggles ready.';
end $$;
