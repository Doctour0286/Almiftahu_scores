-- 040_certificates.sql (Phase 4, Task 4.1)
-- Certificate tables and simplified recompute_result (PRD §7.2, §14.3 Task 4.1).

-- ---------------------------------------------------------------------------------------------
-- 1. Certificate tables in private schema
-- ---------------------------------------------------------------------------------------------
create table if not exists private.certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.enrollments(id) on delete restrict,
  number text not null unique,
  verify_code text not null,
  status text not null default 'approved' check (status in ('approved','revoked')),
  approved_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text,
  snapshot jsonb not null
);

create table if not exists private.certificate_counters (
  course_id uuid not null references public.courses(id) on delete cascade,
  year int not null,
  last int not null default 0,
  primary key (course_id, year)
);

-- Defense in depth: RLS enabled, no public permissions
alter table private.certificates enable row level security;
alter table private.certificate_counters enable row level security;
revoke all on private.certificates from public, anon, authenticated;
revoke all on private.certificate_counters from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Simplified recompute_result (drop dynamic to_regclass guard)
-- ---------------------------------------------------------------------------------------------
create or replace function private.recompute_result(p_enrollment uuid) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  e public.enrollments;
  c public.courses;
  v_att private.attempts;
  v_day numeric;
  v_bonus numeric;
  v_lesson_pct numeric;
  v_exam numeric;
  v_final numeric;
  v_passed boolean;
  v_label text;
  v_label_ar text;
  v_status text;
  v_complete boolean;
  v_cert boolean := false;
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

  -- Directly query private.certificates
  select exists (
    select 1 from private.certificates
    where enrollment_id = p_enrollment and status = 'approved'
  ) into v_cert;

  insert into public.enrollment_results as r
    (enrollment_id, course_id, status, lesson_pct, exam_pct, final, passed, band_label, band_label_ar, has_certificate, updated_at)
  values (p_enrollment, e.course_id, v_status, v_lesson_pct, v_exam, v_final, v_passed, v_label, v_label_ar, v_cert, now())
  on conflict (enrollment_id) do update set
    status = excluded.status, lesson_pct = excluded.lesson_pct, exam_pct = excluded.exam_pct,
    final = excluded.final, passed = excluded.passed, band_label = excluded.band_label,
    band_label_ar = excluded.band_label_ar, has_certificate = excluded.has_certificate, updated_at = now();
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Post-conditions
-- ---------------------------------------------------------------------------------------------
do $$
begin
  assert to_regclass('private.certificates') is not null, 'private.certificates table missing';
  assert to_regclass('private.certificate_counters') is not null, 'private.certificate_counters table missing';
  raise notice '040_certificates applied and verified.';
end $$;
