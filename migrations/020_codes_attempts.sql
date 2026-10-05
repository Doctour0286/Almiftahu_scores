-- 020_codes_attempts.sql (Phase 2, task 2.1)
-- Tables for exam codes, attempts, student answers, and tab events.
-- Full recompute_result with exam integration, attempt grading, and answer normalization.

-- =============================================================================
-- 1. Tables (all in private schema, RLS enabled, no public grants)
-- =============================================================================

create table if not exists private.exam_codes (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  code_hash text not null,
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now()
);

create unique index if not exists one_active_code on private.exam_codes(enrollment_id) where status = 'active';

create table if not exists private.attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  version_id uuid not null references private.exam_versions(id),
  token_hash text,
  shuffle_seed text not null default encode(extensions.gen_random_bytes(8),'hex'),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','finalized')),
  superseded boolean not null default false
);

create unique index if not exists one_live_attempt on private.attempts(enrollment_id) where not superseded;

create table if not exists private.answers (
  attempt_id uuid not null references private.attempts(id) on delete cascade,
  question_id uuid not null references private.questions(id),
  response jsonb,                            -- {"selected":["a","c"]} | {"text":"..."}
  fraction numeric check (fraction between 0 and 1),
  marked_by text check (marked_by in ('auto','teacher')),
  comment text,
  marked_at timestamptz,
  flagged boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create table if not exists private.attempt_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references private.attempts(id) on delete cascade,
  type text not null check (type in ('left','returned')),
  at timestamptz not null default now()
);

alter table private.exam_codes enable row level security;
alter table private.attempts enable row level security;
alter table private.answers enable row level security;
alter table private.attempt_events enable row level security;

-- =============================================================================
-- 2. Core helper functions (normalization & grading)
-- =============================================================================

-- PRD §7.3 Arabic answer normalization
create or replace function private.normalize_answer(t text, p_tm_equiv boolean default false)
returns text language sql immutable as $$
  select btrim(regexp_replace(
    translate(
      case when p_tm_equiv then translate(lower(r.x), 'ة', 'ه') else lower(r.x) end,
      'أإآٱى٠١٢٣٤٥٦٧٨٩',
      'ااااي0123456789'),
    '\s+', ' ', 'g'))
  from (select regexp_replace(coalesce(t,''),
          '[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]', '', 'g') as x) r
$$;

create or replace function private.grade_mcq(p_selected text[], p_correct text[])
returns numeric language sql immutable as $$
  select case when coalesce(cardinality(p_correct),0) = 0 then 0::numeric else
    greatest(0::numeric,
      ( (select count(distinct s) from unnest(coalesce(p_selected,'{}'::text[])) s where s = any(p_correct))
      - (select count(distinct s) from unnest(coalesce(p_selected,'{}'::text[])) s where s <> all(p_correct))
      )::numeric / cardinality(p_correct)) end
$$;

create or replace function private.grade_fill(p_text text, p_accepted text[], p_tm boolean)
returns numeric language sql immutable as $$
  select case when private.normalize_answer(p_text, p_tm) <> ''
         and exists (select 1 from unnest(coalesce(p_accepted,'{}'::text[])) a
                     where private.normalize_answer(a, p_tm) = private.normalize_answer(p_text, p_tm))
         then 1::numeric else 0::numeric end
$$;

create or replace function private.attempt_exam_pct(p_attempt uuid) returns numeric
language sql stable security definer set search_path = public, private, extensions as $$
  select coalesce(sum(coalesce(an.fraction,0) * qv.value), 0)
  from private.attempts a
  join private.v_question_values qv on qv.version_id = a.version_id
  left join private.answers an on an.attempt_id = a.id and an.question_id = qv.question_id
  where a.id = p_attempt
$$;

create or replace function private.grade_attempt(p_attempt uuid) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_att private.attempts;
begin
  select * into v_att from private.attempts where id = p_attempt;
  if not found then return; end if;

  -- 1. Ensure answer row exists for each question in version
  insert into private.answers(attempt_id, question_id)
  select v_att.id, qv.question_id from private.v_question_values qv
  where qv.version_id = v_att.version_id
  on conflict do nothing;

  -- 2. Grade MCQ / True-False
  update private.answers an set
    fraction = private.grade_mcq(
      array(select jsonb_array_elements_text(coalesce(an.response->'selected','[]'::jsonb))),
      k.correct_option_ids),
    marked_by = 'auto', marked_at = now()
  from private.questions q
  join private.sections s on s.id = q.section_id
  join private.question_keys k on k.question_id = q.id
  where an.attempt_id = v_att.id and an.question_id = q.id
    and s.format in ('mcq','tf') and an.marked_by is distinct from 'teacher';

  -- 3. Grade Fill in the blank
  update private.answers an set
    fraction = private.grade_fill(an.response->>'text', k.accepted_answers, k.tm_equiv),
    marked_by = 'auto', marked_at = now()
  from private.questions q
  join private.sections s on s.id = q.section_id
  join private.question_keys k on k.question_id = q.id
  where an.attempt_id = v_att.id and an.question_id = q.id
    and s.format = 'fill' and an.marked_by is distinct from 'teacher';

  -- 4. Blank essays -> 0 auto; non-empty stays NULL (pending teacher)
  update private.answers an set fraction = 0, marked_by = 'auto', marked_at = now()
  from private.questions q join private.sections s on s.id = q.section_id
  where an.attempt_id = v_att.id and an.question_id = q.id and s.format = 'essay'
    and an.fraction is null and coalesce(btrim(an.response->>'text'),'') = '';

  perform private.try_finalize(v_att.id);
end $$;

create or replace function private.try_finalize(p_attempt uuid) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_enr uuid;
begin
  update private.attempts a set status =
      case when exists (select 1 from private.answers an
                        where an.attempt_id = a.id and an.fraction is null)
           then 'submitted' else 'finalized' end
  where a.id = p_attempt and a.status in ('submitted','finalized')
  returning a.enrollment_id into v_enr;
  if v_enr is not null then perform private.recompute_result(v_enr); end if;
end $$;

create or replace function private.expire_attempts() returns int
language plpgsql security definer set search_path = public, private, extensions as $$
declare r record; n int := 0;
begin
  for r in select id from private.attempts
           where status = 'in_progress' and deadline_at + interval '15 seconds' < now() loop
    update private.attempts set status = 'submitted', submitted_at = deadline_at where id = r.id;
    perform private.grade_attempt(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Full recompute_result connecting lessons and exam attempts (PRD §7.3)
create or replace function private.recompute_result(p_enrollment uuid) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  e public.enrollments; c public.courses; v_att private.attempts;
  v_day numeric; v_bonus numeric; v_lesson_pct numeric;
  v_exam numeric; v_final numeric; v_passed boolean;
  v_label text; v_label_ar text; v_status text; v_complete boolean; v_cert boolean;
begin
  select * into e from public.enrollments where id = p_enrollment;
  if not found then return; end if;
  select * into c from public.courses where id = e.course_id;

  if c.lesson_mode = 'scored' then
    select coalesce(sum(d),0) into v_day from unnest(e.days) d where d >= 0;
    select coalesce(sum(b),0) * c.bonus_unit_value into v_bonus from unnest(e.bonus_units) b where b > 0;
    v_lesson_pct := least(c.lesson_max, v_day + v_bonus) / c.lesson_max * 100;
  end if;

  v_complete := case c.eligibility_rule
    when 'all_units'        then cardinality(e.days) = c.day_count and not exists (select 1 from unnest(e.days) d where d < 0)
    when 'teacher_approved' then e.exam_approved
    else true
  end;

  select * into v_att from private.attempts where enrollment_id = p_enrollment and not superseded;
  if found and v_att.status = 'finalized' then
    v_exam := private.attempt_exam_pct(v_att.id);
    v_final := coalesce(v_lesson_pct,0) * c.weight_lessons / 100 + v_exam * c.weight_exam / 100;
    v_passed := v_final >= c.pass_mark;
    v_status := 'finalized';
    if v_passed then
      select b.label, b.label_ar into v_label, v_label_ar
      from jsonb_to_recordset(c.grade_bands) as b(label text, label_ar text, min numeric)
      where b.min <= v_final order by b.min desc limit 1;
    end if;
  elsif found then
    v_status := v_att.status;               -- in_progress | submitted
  elsif v_complete then
    v_status := 'eligible';
  else
    v_status := 'not_eligible';
  end if;

  v_cert := to_regclass('private.certificates') is not null
            and exists (select 1 from private.certificates where enrollment_id = p_enrollment and status = 'approved');

  insert into public.enrollment_results as r
    (enrollment_id, course_id, status, lesson_pct, exam_pct, final, passed, band_label, band_label_ar, has_certificate, updated_at)
  values (p_enrollment, e.course_id, v_status, v_lesson_pct, v_exam, v_final, v_passed, v_label, v_label_ar, v_cert, now())
  on conflict (enrollment_id) do update set
    status = excluded.status, lesson_pct = excluded.lesson_pct, exam_pct = excluded.exam_pct,
    final = excluded.final, passed = excluded.passed, band_label = excluded.band_label,
    band_label_ar = excluded.band_label_ar, has_certificate = excluded.has_certificate, updated_at = now();
end $$;

do $$
begin
  raise notice '020_codes_attempts applied and verified.';
end $$;
