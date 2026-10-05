-- 041_certificate_rpcs.sql (Phase 4, Task 4.2)
-- Certificate approval, revocation, verification, and institution settings RPCs (PRD §7.4, §14.3 Task 4.2).

-- ---------------------------------------------------------------------------------------------
-- 1. admin_list_certificates: eligible students and issued certificates
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_list_certificates(p_token text, p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_eligible jsonb := '[]'::jsonb;
  v_issued jsonb := '[]'::jsonb;
begin
  perform private.require_teacher(p_token);

  if not exists (select 1 from public.courses where id = p_course_id) then
    perform private.fail('E_NOT_FOUND', 'Course not found.');
  end if;

  -- 1. Eligible enrollments: finalized + passed + no certificate row
  select coalesce(jsonb_agg(jsonb_build_object(
    'enrollment_id', e.id,
    'student_id', s.id,
    'sn', e.sn,
    'student_name', s.name,
    'student_name_ar', s.name_ar,
    'missing_arabic_name', (s.name_ar is null or trim(s.name_ar) = ''),
    'final', r.final,
    'band_label', r.band_label,
    'band_label_ar', r.band_label_ar,
    'finalized_at', r.updated_at
  ) order by e.sn), '[]'::jsonb)
  into v_eligible
  from public.enrollments e
  join public.students s on s.id = e.student_id
  join public.enrollment_results r on r.enrollment_id = e.id
  where e.course_id = p_course_id
    and e.active
    and r.status = 'finalized'
    and coalesce(r.passed, false) = true
    and not exists (select 1 from private.certificates c where c.enrollment_id = e.id);

  -- 2. Issued / Revoked certificates for this course
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'enrollment_id', e.id,
    'sn', e.sn,
    'student_name', s.name,
    'student_name_ar', s.name_ar,
    'number', c.number,
    'verify_code', c.verify_code,
    'status', c.status,
    'approved_at', c.approved_at,
    'revoked_at', c.revoked_at,
    'revoke_reason', c.revoke_reason,
    'final', r.final,
    'band_label', r.band_label,
    'band_label_ar', r.band_label_ar,
    'snapshot', c.snapshot
  ) order by c.approved_at desc), '[]'::jsonb)
  into v_issued
  from private.certificates c
  join public.enrollments e on e.id = c.enrollment_id
  join public.students s on s.id = e.student_id
  left join public.enrollment_results r on r.enrollment_id = e.id
  where e.course_id = p_course_id;

  return jsonb_build_object(
    'ok', true,
    'eligible', v_eligible,
    'issued', v_issued
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. admin_approve_certificates: atomic single/bulk approval with frozen snapshot (AC-4.1 - AC-4.3)
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_approve_certificates(p_token text, p_enrollment_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_results jsonb := '[]'::jsonb;
  v_eid uuid;
  v_enr public.enrollments;
  v_course public.courses;
  v_st public.students;
  v_res public.enrollment_results;
  v_year int;
  v_prefix text;
  v_code text;
  v_seq int;
  v_num text;
  v_vcode text;
  v_inst_defaults jsonb;
  v_inst_info jsonb;
  v_course_cert jsonb;
  v_title text;
  v_title_ar text;
  v_inst_name text;
  v_inst_name_ar text;
  v_wording text;
  v_wording_ar text;
  v_signatory jsonb;
  v_logo text;
  v_sig_img text;
  v_snap jsonb;
begin
  perform private.require_teacher(p_token);

  if p_enrollment_ids is null or cardinality(p_enrollment_ids) = 0 then
    perform private.fail('E_VALIDATION', 'No enrollments provided for approval.');
  end if;

  v_year := extract(year from now())::int;

  -- Read institution configurations
  select value into v_inst_info from private.institution_settings where key = 'institution';
  select value into v_inst_defaults from private.institution_settings where key = 'certificate_defaults';
  select trim(both '"' from (value::text)) into v_prefix from private.institution_settings where key = 'number_prefix';
  v_prefix := coalesce(v_prefix, 'MMI');

  foreach v_eid in array p_enrollment_ids loop
    begin
      select * into v_enr from public.enrollments where id = v_eid;
      if not found then
        v_results := v_results || jsonb_build_array(jsonb_build_object('enrollment_id', v_eid, 'ok', false, 'error', 'E_NOT_FOUND'));
        continue;
      end if;

      select * into v_course from public.courses where id = v_enr.course_id;
      select * into v_st from public.students where id = v_enr.student_id;
      select * into v_res from public.enrollment_results where enrollment_id = v_eid;

      -- Check eligibility: finalized and passed
      if v_res.status <> 'finalized' or not coalesce(v_res.passed, false) then
        v_results := v_results || jsonb_build_array(jsonb_build_object('enrollment_id', v_eid, 'ok', false, 'error', 'E_NOT_ELIGIBLE'));
        continue;
      end if;

      -- Check no certificate already exists
      if exists (select 1 from private.certificates where enrollment_id = v_eid) then
        v_results := v_results || jsonb_build_array(jsonb_build_object('enrollment_id', v_eid, 'ok', false, 'error', 'E_ALREADY_APPROVED'));
        continue;
      end if;

      -- Check Arabic name (AC-4.2)
      if v_st.name_ar is null or trim(v_st.name_ar) = '' then
        v_results := v_results || jsonb_build_array(jsonb_build_object('enrollment_id', v_eid, 'ok', false, 'error', 'E_NO_ARABIC_NAME'));
        continue;
      end if;

      -- Number generation: row-lock certificate_counters (AC-4.1)
      v_code := upper(regexp_replace(v_course.code, '[^a-zA-Z0-9]', '', 'g'));
      if v_code = '' then v_code := 'COURSE'; end if;

      insert into private.certificate_counters (course_id, year, last)
      values (v_course.id, v_year, 1)
      on conflict (course_id, year)
      do update set last = certificate_counters.last + 1
      returning last into v_seq;

      v_num := format('%s-%s-%s-%s', v_prefix, v_code, v_year, lpad(v_seq::text, 4, '0'));

      -- 10-character verify code
      v_vcode := upper(substr(md5(random()::text || clock_timestamp()::text || v_num), 1, 10));

      -- Setting resolution (course -> institution -> built-in)
      v_course_cert := coalesce(v_course.cert_settings, '{}'::jsonb);

      v_title := coalesce(v_course_cert->>'title', v_inst_defaults->>'title', 'Certificate of Completion');
      v_title_ar := coalesce(v_course_cert->>'title_ar', v_inst_defaults->>'title_ar', 'شهادة إتمام');

      v_inst_name := coalesce(v_inst_info->>'name', 'Ma''had Miftah al-''Ilm');
      v_inst_name_ar := coalesce(v_inst_info->>'name_ar', 'معهد مفتاح العلم');

      v_signatory := coalesce(
        v_course_cert->'signatory',
        v_inst_defaults->'signatory',
        '{"name":"Musa Aminu Muhammad","name_ar":"موسى أمينو محمد","title":"Mushrif","title_ar":"المشرف"}'::jsonb
      );

      v_wording := coalesce(
        v_course_cert->>'wording',
        v_inst_defaults->>'wording',
        'This is to certify that {name} has successfully completed the course {course} with a final score of {score}% ({band}).'
      );

      v_wording_ar := coalesce(
        v_course_cert->>'wording_ar',
        v_inst_defaults->>'wording_ar',
        'يشهد معهد مفتاح العلم بأن {name_ar} قد أتمّ بنجاح دورة {course_ar} بدرجة نهائية قدرها {score}٪ وتقدير {band_ar}.'
      );

      v_logo := coalesce(v_course_cert->>'logo', v_inst_defaults->>'logo');
      v_sig_img := coalesce(v_course_cert->>'signature_image', v_inst_defaults->>'signature_image');

      -- Interpolate wording placeholders
      v_wording := replace(v_wording, '{name}', v_st.name);
      v_wording := replace(v_wording, '{name_ar}', v_st.name_ar);
      v_wording := replace(v_wording, '{course}', v_course.name);
      v_wording := replace(v_wording, '{course_ar}', coalesce(v_course.name_ar, v_course.name));
      v_wording := replace(v_wording, '{score}', coalesce(v_res.final::text, '0'));
      v_wording := replace(v_wording, '{band}', coalesce(v_res.band_label, 'Pass'));
      v_wording := replace(v_wording, '{band_ar}', coalesce(v_res.band_label_ar, 'ناجح'));
      v_wording := replace(v_wording, '{date}', to_char(now(), 'YYYY-MM-DD'));

      v_wording_ar := replace(v_wording_ar, '{name}', v_st.name);
      v_wording_ar := replace(v_wording_ar, '{name_ar}', v_st.name_ar);
      v_wording_ar := replace(v_wording_ar, '{course}', v_course.name);
      v_wording_ar := replace(v_wording_ar, '{course_ar}', coalesce(v_course.name_ar, v_course.name));
      v_wording_ar := replace(v_wording_ar, '{score}', coalesce(v_res.final::text, '0'));
      v_wording_ar := replace(v_wording_ar, '{band}', coalesce(v_res.band_label, 'Pass'));
      v_wording_ar := replace(v_wording_ar, '{band_ar}', coalesce(v_res.band_label_ar, 'ناجح'));
      v_wording_ar := replace(v_wording_ar, '{date}', to_char(now(), 'YYYY-MM-DD'));

      -- Build immutable snapshot (AC-4.3)
      v_snap := jsonb_build_object(
        'number', v_num,
        'verify_code', v_vcode,
        'student_name', v_st.name,
        'student_name_ar', v_st.name_ar,
        'course_name', v_course.name,
        'course_name_ar', v_course.name_ar,
        'course_code', v_course.code,
        'final', v_res.final,
        'band_label', v_res.band_label,
        'band_label_ar', v_res.band_label_ar,
        'issued_date', to_char(now(), 'YYYY-MM-DD'),
        'title', v_title,
        'title_ar', v_title_ar,
        'institution_name', v_inst_name,
        'institution_name_ar', v_inst_name_ar,
        'wording', v_wording,
        'wording_ar', v_wording_ar,
        'signatory', v_signatory,
        'logo', v_logo,
        'signature_image', v_sig_img
      );

      insert into private.certificates
        (enrollment_id, number, verify_code, status, approved_at, snapshot)
      values
        (v_eid, v_num, v_vcode, 'approved', now(), v_snap);

      update public.enrollment_results
      set has_certificate = true, updated_at = now()
      where enrollment_id = v_eid;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'enrollment_id', v_eid,
        'ok', true,
        'number', v_num,
        'verify_code', v_vcode
      ));
    exception when others then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'enrollment_id', v_eid,
        'ok', false,
        'error', sqlerrm
      ));
    end;
  end loop;

  return v_results;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. admin_revoke_certificate: revoke an approved certificate (AC-4.5)
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_revoke_certificate(p_token text, p_enrollment_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
begin
  perform private.require_teacher(p_token);

  if not exists (select 1 from private.certificates where enrollment_id = p_enrollment_id) then
    perform private.fail('E_NOT_FOUND', 'Certificate not found.');
  end if;

  update private.certificates
  set status = 'revoked',
      revoked_at = now(),
      revoke_reason = nullif(trim(p_reason), '')
  where enrollment_id = p_enrollment_id;

  update public.enrollment_results
  set has_certificate = false, updated_at = now()
  where enrollment_id = p_enrollment_id;

  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. admin_get_institution & admin_save_institution (FR-V8)
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_get_institution(p_token text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_inst jsonb;
  v_pfx text;
  v_defs jsonb;
begin
  perform private.require_teacher(p_token);

  select value into v_inst from private.institution_settings where key = 'institution';
  select trim(both '"' from (value::text)) into v_pfx from private.institution_settings where key = 'number_prefix';
  select value into v_defs from private.institution_settings where key = 'certificate_defaults';

  return jsonb_build_object(
    'ok', true,
    'institution', coalesce(v_inst, '{}'::jsonb),
    'number_prefix', coalesce(v_pfx, 'MMI'),
    'certificate_defaults', coalesce(v_defs, '{}'::jsonb)
  );
end $$;

create or replace function public.admin_save_institution(p_token text, p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_pfx text;
  v_inst jsonb;
  v_defs jsonb;
  v_sig jsonb;
begin
  perform private.require_teacher(p_token);

  if p_settings is null then
    perform private.fail('E_VALIDATION', 'Settings payload required.');
  end if;

  -- Validate number prefix
  v_pfx := upper(trim(p_settings->>'number_prefix'));
  if v_pfx is not null and v_pfx <> '' then
    if v_pfx !~ '^[A-Z0-9]{2,8}$' then
      perform private.fail('E_VALIDATION', 'Certificate prefix must be 2-8 uppercase letters or digits.');
    end if;
    insert into private.institution_settings (key, value, updated_at)
    values ('number_prefix', to_jsonb(v_pfx), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  -- Validate institution info
  v_inst := p_settings->'institution';
  if v_inst is not null then
    insert into private.institution_settings (key, value, updated_at)
    values ('institution', v_inst, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  -- Validate certificate defaults
  v_defs := p_settings->'certificate_defaults';
  if v_defs is not null then
    v_sig := v_defs->'signatory';
    if v_sig is not null and v_sig <> 'null'::jsonb then
      if coalesce(v_sig->>'name', '') = '' or coalesce(v_sig->>'name_ar', '') = '' or
         coalesce(v_sig->>'title', '') = '' or coalesce(v_sig->>'title_ar', '') = '' then
        perform private.fail('E_VALIDATION', 'All four signatory fields (name, name_ar, title, title_ar) are required.');
      end if;
    end if;

    if length(coalesce(v_defs->>'wording', '')) > 600 or length(coalesce(v_defs->>'wording_ar', '')) > 600 then
      perform private.fail('E_VALIDATION', 'Certificate wording must not exceed 600 characters.');
    end if;

    insert into private.institution_settings (key, value, updated_at)
    values ('certificate_defaults', v_defs, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. get_certificate: student fetches approved certificate snapshot (FR-T14)
-- ---------------------------------------------------------------------------------------------
create or replace function public.get_certificate(p_enrollment_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_chk jsonb;
  v_cert private.certificates;
begin
  v_chk := private.verify_student_code(p_enrollment_id, p_code);
  if not (v_chk->>'ok')::boolean then return v_chk; end if;

  select * into v_cert from private.certificates
  where enrollment_id = p_enrollment_id and status = 'approved';

  if not found then
    perform private.fail('E_NO_CERTIFICATE', 'No approved certificate found for this enrollment.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'number', v_cert.number,
    'verify_code', v_cert.verify_code,
    'approved_at', v_cert.approved_at,
    'snapshot', v_cert.snapshot
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 6. verify_certificate: public verification by certificate number (AC-4.4, AC-4.5)
-- ---------------------------------------------------------------------------------------------
create or replace function public.verify_certificate(p_number text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_clean text;
  v_cert private.certificates;
begin
  v_clean := upper(trim(coalesce(p_number, '')));

  select * into v_cert from private.certificates where upper(number) = v_clean;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'status', 'not_found'
    );
  end if;

  if v_cert.status = 'revoked' then
    return jsonb_build_object(
      'ok', true,
      'status', 'revoked',
      'number', v_cert.number,
      'revoked_at', v_cert.revoked_at,
      'revoke_reason', v_cert.revoke_reason
    );
  end if;

  -- Approved certificate: return public fields only (AC-4.4)
  return jsonb_build_object(
    'ok', true,
    'status', 'valid',
    'number', v_cert.number,
    'student_name', v_cert.snapshot->>'student_name',
    'student_name_ar', v_cert.snapshot->>'student_name_ar',
    'course_name', v_cert.snapshot->>'course_name',
    'course_name_ar', v_cert.snapshot->>'course_name_ar',
    'issued_date', v_cert.snapshot->>'issued_date',
    'band_label', v_cert.snapshot->>'band_label',
    'band_label_ar', v_cert.snapshot->>'band_label_ar',
    'title', v_cert.snapshot->>'title',
    'title_ar', v_cert.snapshot->>'title_ar',
    'institution_name', v_cert.snapshot->>'institution_name',
    'institution_name_ar', v_cert.snapshot->>'institution_name_ar'
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Grants to anon
-- ---------------------------------------------------------------------------------------------
grant execute on function public.admin_list_certificates(text, uuid) to anon;
grant execute on function public.admin_approve_certificates(text, uuid[]) to anon;
grant execute on function public.admin_revoke_certificate(text, uuid, text) to anon;
grant execute on function public.admin_get_institution(text) to anon;
grant execute on function public.admin_save_institution(text, jsonb) to anon;
grant execute on function public.get_certificate(uuid, text) to anon;
grant execute on function public.verify_certificate(text) to anon;

-- ---------------------------------------------------------------------------------------------
-- 8. Post-conditions
-- ---------------------------------------------------------------------------------------------
do $$
begin
  assert has_function_privilege('anon', 'public.admin_list_certificates(text, uuid)', 'execute'), 'missing admin_list_certificates grant';
  assert has_function_privilege('anon', 'public.admin_approve_certificates(text, uuid[])', 'execute'), 'missing admin_approve_certificates grant';
  assert has_function_privilege('anon', 'public.admin_revoke_certificate(text, uuid, text)', 'execute'), 'missing admin_revoke_certificate grant';
  assert has_function_privilege('anon', 'public.admin_get_institution(text)', 'execute'), 'missing admin_get_institution grant';
  assert has_function_privilege('anon', 'public.admin_save_institution(text, jsonb)', 'execute'), 'missing admin_save_institution grant';
  assert has_function_privilege('anon', 'public.get_certificate(uuid, text)', 'execute'), 'missing get_certificate grant';
  assert has_function_privilege('anon', 'public.verify_certificate(text)', 'execute'), 'missing verify_certificate grant';
  raise notice '041_certificate_rpcs applied and verified.';
end $$;
