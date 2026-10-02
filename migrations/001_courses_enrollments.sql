-- 001_courses_enrollments.sql  (Phase 0, task 0.1)
-- Courses, enrollments, public results table, institution settings, first course (ADAB),
-- and an idempotent copy of the legacy `students` rows into enrollments.
-- Additive: the live app keeps reading/writing `students` and is unaffected.

create table if not exists public.courses (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[A-Z0-9-]{2,12}$'),
  name             text not null,
  name_ar          text,
  status           text not null default 'active' check (status in ('active','archived')),
  unit_label       text not null default 'Day' check (char_length(unit_label) between 1 and 30),
  unit_label_ar    text,
  lesson_mode      text not null default 'scored' check (lesson_mode in ('scored','none')),
  eligibility_rule text not null default 'all_units'
                     check (eligibility_rule in ('all_units','teacher_approved','open')),
  day_count        int  not null default 10  check (day_count between 0 and 60),
  day_max          int  not null default 10  check (day_max >= 1),
  bonus_unit_value numeric not null default 2   check (bonus_unit_value >= 0),
  lesson_max       numeric not null default 100 check (lesson_max > 0),
  weight_lessons   numeric not null default 50  check (weight_lessons between 0 and 100),
  weight_exam      numeric not null default 50  check (weight_exam between 0 and 100),
  pass_mark        numeric not null default 60  check (pass_mark between 0 and 100),
  reveal_answers   boolean not null default true,
  exam_live        boolean not null default false,
  cert_settings    jsonb not null default '{}'::jsonb,
  grade_bands      jsonb not null default
    '[{"label":"Excellent","label_ar":"ممتاز","min":90},
      {"label":"Very Good","label_ar":"جيد جداً","min":80},
      {"label":"Good","label_ar":"جيد","min":70},
      {"label":"Pass","label_ar":"مقبول","min":60}]'::jsonb,
  created_at       timestamptz not null default now(),
  constraint weights_sum_100    check (weight_lessons + weight_exam = 100),
  constraint lesson_mode_scored check (lesson_mode = 'none' or day_count >= 1),
  constraint lesson_mode_none   check (lesson_mode = 'scored' or
    (day_count = 0 and weight_lessons = 0 and weight_exam = 100 and eligibility_rule <> 'all_units'))
);

alter table public.students add column if not exists name_ar text;

create table if not exists public.enrollments (
  id               uuid primary key default gen_random_uuid(),
  student_id       text not null references public.students(id) on delete cascade,
  course_id        uuid not null references public.courses(id)  on delete cascade,
  sn               int  not null,
  days             int[] not null,          -- -1 = unset ('{}' when lesson_mode = 'none')
  bonus_units      int[] not null,          -- 0 = none
  active           boolean not null default true,
  exam_approved    boolean not null default false,
  exam_approved_at timestamptz,
  enrolled_at      timestamptz not null default now(),
  unique (student_id, course_id),
  unique (course_id, sn)
);
create index if not exists enrollments_course_idx on public.enrollments(course_id);

create table if not exists public.enrollment_results (
  enrollment_id   uuid primary key references public.enrollments(id) on delete cascade,
  course_id       uuid not null references public.courses(id) on delete cascade,
  status          text not null check (status in
                    ('not_eligible','eligible','in_progress','submitted','finalized')),
  lesson_pct      numeric,
  exam_pct        numeric,
  final           numeric,
  passed          boolean,
  band_label      text,
  band_label_ar   text,
  has_certificate boolean not null default false,
  updated_at      timestamptz not null default now()
);
create index if not exists enrollment_results_course_idx on public.enrollment_results(course_id);

-- New tables must not be writable through the public API, even before lockdown (005).
-- (Supabase grants new public tables to anon/authenticated by default.)
revoke insert, update, delete, truncate on
  public.courses, public.enrollments, public.enrollment_results from anon, authenticated;

-- Institution settings (D-43)
create table if not exists private.institution_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into private.institution_settings(key, value) values
 ('institution',   '{"name":"Ma''had Miftah al-''Ilm","name_ar":"معهد مفتاح العلم"}'),
 ('number_prefix', '"MMI"'),
 ('certificate_defaults', '{"title":"Certificate of Completion","title_ar":"شهادة إتمام",
    "signatory":{"name":"Musa Aminu Muhammad","name_ar":"موسى أمينو محمد","title":"Mushrif","title_ar":"المشرف"}}')
on conflict (key) do nothing;

-- First course (D-04, D-40)
insert into public.courses (code, name, name_ar)
values ('ADAB', 'Al-Aadaab Al-Asharah', 'الآداب العشرة')
on conflict (code) do nothing;

-- Legacy copy. IDEMPOTENT: also used at production cut-over (runbook step 4).
-- WARNING: it overwrites ADAB enrollment scores/active/sn from the legacy `students` table,
-- so run it only while the OLD client is still the one being used (before the new client is live).
create or replace function private.sync_legacy_students() returns int
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_course public.courses; v_n int;
begin
  select * into v_course from public.courses where code = 'ADAB';
  if not found then raise exception 'Course ADAB is missing'; end if;

  if exists (select 1 from public.students where sn is null) then
    raise exception 'students.sn is NULL for some rows; fix the data before migrating';
  end if;
  if exists (select sn from public.students group by sn having count(*) > 1) then
    raise exception 'duplicate students.sn values; fix the data before migrating';
  end if;

  insert into public.enrollments (student_id, course_id, sn, days, bonus_units, active)
  select s.id, v_course.id, s.sn,
    case when s.days is not null and cardinality(s.days) = v_course.day_count
         then s.days else array_fill(-1, array[v_course.day_count]) end,
    case when s.bonus_units is not null and cardinality(s.bonus_units) = v_course.day_count
         then array(select greatest(b, 0) from unnest(s.bonus_units) with ordinality t(b, i) order by i)
         else array_fill(0, array[v_course.day_count]) end,
    coalesce(s.active, true)
  from public.students s
  on conflict (student_id, course_id) do update set
    sn = excluded.sn, days = excluded.days,
    bonus_units = excluded.bonus_units, active = excluded.active;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function private.sync_legacy_students() from public, anon, authenticated;

select private.sync_legacy_students();
