-- 011_exam_builder_rpcs.sql  (Phase 1, task 1.2)
-- Exam builder RPCs (PRD §7.6 "Exam builder", §7.7 publish validation). Needs 010.
--
-- Public RPCs (all SECURITY DEFINER, all start with private.require_teacher, all granted to anon
-- explicitly because 005 removed the default grants):
--   admin_get_exam, admin_get_version, admin_create_draft, admin_save_draft,
--   admin_discard_draft, admin_publish_version, admin_patch_text
-- Private helpers (not reachable by the public key):
--   exam_doc, write_exam_content, validate_exam_version, clone_version, prob
--
-- CONVENTIONS (PRD §7.1)
--  * Failures raise E_XXX with a human-readable detail; none of these RPCs must persist state on failure.
--  * admin_publish_version raises E_VALIDATION whose DETAIL is a JSON array of {path, message}
--    (paths are 0-based, e.g. "sections[0].questions[2].options"). The builder UI parses it.
--  * admin_save_draft is LENIENT: it saves incomplete drafts (empty prompts, weight 0, no correct
--    option yet). It only rejects what cannot be stored at all (unknown format, malformed shapes,
--    weight outside 0-100, duration outside 1-600, more than 50 sections / 500 questions).
--    Everything else is checked by validate_exam_version at publish time.
--  * Question ids and section ids sent by the client are kept when they are valid uuids that are
--    not used by another version; otherwise the server assigns new ones. Option ids are the
--    client's own strings ("a", "b", ... or "true"/"false").
--  * attempts_count in admin_get_exam is 0 until Phase 2 creates attempts (Phase 2 redefines it).
--
-- IMPORTANT: 005 revokes EXECUTE on every public function and re-grants only the 16 Phase-0 RPCs.
-- Do NOT re-run 005 after this migration without also re-running this one (its grants would be lost).
-- Safe to re-run itself.

-- =====================================================================================
-- 1. private helpers
-- =====================================================================================
create or replace function private.prob(p_path text, p_msg text) returns jsonb
language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('path', p_path, 'message', p_msg))
$$;

-- Full document of one version, with keys (shape: PRD §7.6 "Draft document shape").
create or replace function private.exam_doc(p_version uuid) returns jsonb
language sql stable security definer set search_path = public, private, extensions as $$
  select jsonb_build_object(
    'id', v.id, 'course_id', e.course_id, 'version_no', v.version_no, 'status', v.status,
    'draft_rev', v.draft_rev, 'published_at', v.published_at,
    'title', v.title, 'title_ar', v.title_ar,
    'instructions', v.instructions, 'instructions_ar', v.instructions_ar,
    'duration_minutes', v.duration_minutes,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', s.id, 'title', s.title, 'title_ar', s.title_ar, 'format', s.format, 'weight', s.weight,
          'questions', coalesce((
            select jsonb_agg(
                     jsonb_build_object('id', q.id, 'prompt', q.prompt, 'note', q.note, 'options', q.options)
                     || case s.format
                          when 'essay' then '{}'::jsonb
                          when 'fill'  then jsonb_build_object('key', jsonb_build_object(
                                              'accepted_answers', to_jsonb(coalesce(k.accepted_answers, '{}'::text[])),
                                              'tm_equiv', coalesce(k.tm_equiv, false)))
                          else              jsonb_build_object('key', jsonb_build_object(
                                              'correct_option_ids', to_jsonb(coalesce(k.correct_option_ids, '{}'::text[]))))
                        end
                     order by q.position, q.id)
            from private.questions q
            left join private.question_keys k on k.question_id = q.id
            where q.section_id = s.id), '[]'::jsonb))
        order by s.position, s.id)
      from private.sections s where s.version_id = v.id), '[]'::jsonb))
  from private.exam_versions v join private.exams e on e.id = v.exam_id
  where v.id = p_version
$$;

-- Replace the content (sections, questions, keys) of a version from a document. Lenient (see header).
create or replace function private.write_exam_content(p_version uuid, p_doc jsonb) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  c_uuid constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  secs jsonb; s jsonb; qs jsonb; q jsonb; opts jsonb; o jsonb; kj jsonb; kc jsonb; ka jsonb;
  si int := -1; qi int; n_q int := 0;
  v_fmt text; v_w numeric; v_id text; v_sid uuid; v_qid uuid; v_path text; v_opts jsonb;
  v_correct text[]; v_accept text[]; v_tm boolean;
begin
  secs := coalesce(p_doc->'sections', '[]'::jsonb);
  if jsonb_typeof(secs) <> 'array' then perform private.fail('E_VALIDATION', 'sections must be a list.'); end if;
  if jsonb_array_length(secs) > 50 then perform private.fail('E_VALIDATION', 'A draft can hold at most 50 sections.'); end if;

  delete from private.sections where version_id = p_version;      -- cascades to questions and keys

  for s in select value from jsonb_array_elements(secs) loop
    si := si + 1;
    v_path := format('sections[%s]', si);
    if jsonb_typeof(s) <> 'object' then perform private.fail('E_VALIDATION', v_path || ' must be an object.'); end if;

    v_fmt := s->>'format';
    if v_fmt is null or v_fmt not in ('mcq','tf','fill','essay') then
      perform private.fail('E_VALIDATION', v_path || '.format must be one of mcq, tf, fill, essay.');
    end if;
    if s->'weight' is null or jsonb_typeof(s->'weight') = 'null' then v_w := 0;
    elsif jsonb_typeof(s->'weight') = 'number' then v_w := (s->>'weight')::numeric;
    else perform private.fail('E_VALIDATION', v_path || '.weight must be a number.');
    end if;
    if v_w < 0 or v_w > 100 then perform private.fail('E_VALIDATION', v_path || '.weight must be between 0 and 100.'); end if;

    v_sid := null; v_id := s->>'id';
    if v_id ~ c_uuid then
      if not exists (select 1 from private.sections where id = v_id::uuid) then v_sid := v_id::uuid; end if;
    end if;
    v_sid := coalesce(v_sid, gen_random_uuid());

    insert into private.sections (id, version_id, position, title, title_ar, format, weight)
    values (v_sid, p_version, si, coalesce(s->>'title', ''), nullif(s->>'title_ar', ''), v_fmt, v_w);

    qs := coalesce(s->'questions', '[]'::jsonb);
    if jsonb_typeof(qs) <> 'array' then perform private.fail('E_VALIDATION', v_path || '.questions must be a list.'); end if;
    qi := -1;
    for q in select value from jsonb_array_elements(qs) loop
      qi := qi + 1; n_q := n_q + 1;
      v_path := format('sections[%s].questions[%s]', si, qi);
      if n_q > 500 then perform private.fail('E_VALIDATION', 'A draft can hold at most 500 questions.'); end if;
      if jsonb_typeof(q) <> 'object' then perform private.fail('E_VALIDATION', v_path || ' must be an object.'); end if;

      -- options (mcq / tf only; other formats never store options)
      v_opts := '[]'::jsonb;
      if v_fmt in ('mcq','tf') then
        opts := coalesce(q->'options', '[]'::jsonb);
        if jsonb_typeof(opts) <> 'array' then perform private.fail('E_VALIDATION', v_path || '.options must be a list.'); end if;
        if jsonb_array_length(opts) > 20 then perform private.fail('E_VALIDATION', v_path || ' can have at most 20 options.'); end if;
        for o in select value from jsonb_array_elements(opts) loop
          if jsonb_typeof(o) <> 'object' or coalesce(o->>'id', '') = '' then
            perform private.fail('E_VALIDATION', v_path || '.options: every option needs an id.');
          end if;
          v_opts := v_opts || jsonb_build_array(jsonb_build_object('id', o->>'id', 'text', coalesce(o->>'text', '')));
        end loop;
      end if;

      -- key
      kj := q->'key';
      v_correct := '{}'; v_accept := '{}'; v_tm := false;
      if v_fmt in ('mcq','tf') then
        kc := kj->'correct_option_ids';
        if kc is not null and jsonb_typeof(kc) <> 'null' then
          if jsonb_typeof(kc) <> 'array' then perform private.fail('E_VALIDATION', v_path || '.key.correct_option_ids must be a list.'); end if;
          select coalesce(array_agg(t.x), '{}') into v_correct from jsonb_array_elements_text(kc) as t(x) where t.x is not null;
        end if;
      elsif v_fmt = 'fill' then
        ka := kj->'accepted_answers';
        if ka is not null and jsonb_typeof(ka) <> 'null' then
          if jsonb_typeof(ka) <> 'array' then perform private.fail('E_VALIDATION', v_path || '.key.accepted_answers must be a list.'); end if;
          select coalesce(array_agg(t.x), '{}') into v_accept from jsonb_array_elements_text(ka) as t(x) where t.x is not null;
        end if;
        v_tm := case when jsonb_typeof(kj->'tm_equiv') = 'boolean' then (kj->>'tm_equiv')::boolean else false end;
      end if;

      v_qid := null; v_id := q->>'id';
      if v_id ~ c_uuid then
        if not exists (select 1 from private.questions where id = v_id::uuid) then v_qid := v_id::uuid; end if;
      end if;
      v_qid := coalesce(v_qid, gen_random_uuid());

      insert into private.questions (id, section_id, position, prompt, options, note)
      values (v_qid, v_sid, qi, coalesce(q->>'prompt', ''), v_opts, nullif(q->>'note', ''));
      if v_fmt in ('mcq','tf') then
        insert into private.question_keys (question_id, correct_option_ids) values (v_qid, v_correct);
      elsif v_fmt = 'fill' then
        insert into private.question_keys (question_id, accepted_answers, tm_equiv) values (v_qid, v_accept, v_tm);
      end if;
    end loop;
  end loop;
end $$;

-- PRD §7.7. Returns a JSON array of {path, message}; empty array = publishable.
create or replace function private.validate_exam_version(p_version uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private, extensions as $$
declare
  v private.exam_versions;
  sec record; q record; k private.question_keys;
  p jsonb := '[]'::jsonb;
  si int := -1; qi int; n_sec int; w_sum numeric; n_total int;
  v_path text; v_lbl text;
  n_opts int; n_ids int; n_blank int; n_correct int; n_fill int;
  v_ids text[]; v_correct text[]; v_bad text;
begin
  select * into v from private.exam_versions where id = p_version;
  if not found then return private.prob('', 'This version no longer exists.'); end if;

  -- 1. title, duration
  if btrim(coalesce(v.title, '')) = '' then p := p || private.prob('title', 'Give the exam a title.'); end if;
  if v.duration_minutes is null or v.duration_minutes < 1 or v.duration_minutes > 600 then
    p := p || private.prob('duration_minutes', 'Set the duration between 1 and 600 minutes.');
  end if;

  -- 2-3. sections, weights
  select count(*), coalesce(sum(weight), 0) into n_sec, w_sum from private.sections where version_id = p_version;
  if n_sec = 0 then
    p := p || private.prob('sections', 'Add at least one section.');
  elsif abs(w_sum - 100) > 0.001 then
    p := p || private.prob('sections', format('Section weights add up to %s; they must add up to 100.', trim_scale(w_sum)));
  end if;

  -- 4. size limit
  select count(*) into n_total from private.questions qq join private.sections ss on ss.id = qq.section_id where ss.version_id = p_version;
  if n_total > 200 then p := p || private.prob('sections', format('The exam has %s questions; the maximum is 200.', n_total)); end if;

  for sec in select * from private.sections where version_id = p_version order by position, id loop
    si := si + 1;
    v_lbl := format('Section %s', si + 1);
    if sec.weight <= 0 then p := p || private.prob(format('sections[%s].weight', si), v_lbl || ' needs a weight above 0.'); end if;
    if not exists (select 1 from private.questions where section_id = sec.id) then
      p := p || private.prob(format('sections[%s].questions', si), v_lbl || ' has no questions.');
    end if;

    qi := -1;
    for q in select * from private.questions where section_id = sec.id order by position, id loop
      qi := qi + 1;
      v_path := format('sections[%s].questions[%s]', si, qi);
      v_lbl  := format('Section %s, question %s', si + 1, qi + 1);
      select * into k from private.question_keys where question_id = q.id;

      -- 4/5. prompt
      if btrim(q.prompt) = '' then p := p || private.prob(v_path || '.prompt', v_lbl || ': the question text is empty.');
      elsif length(q.prompt) > 4000 then p := p || private.prob(v_path || '.prompt', v_lbl || ': the question text is longer than 4,000 characters.');
      end if;

      if sec.format = 'mcq' then
        -- 6. mcq
        n_opts := case when jsonb_typeof(q.options) = 'array' then jsonb_array_length(q.options) else 0 end;
        if n_opts < 2 or n_opts > 8 then
          p := p || private.prob(v_path || '.options', format('%s: needs 2 to 8 options (has %s).', v_lbl, n_opts));
        end if;
        select count(distinct o.value->>'id'),
               coalesce(array_agg(o.value->>'id'), '{}'::text[]),
               count(*) filter (where btrim(coalesce(o.value->>'text', '')) = '')
          into n_ids, v_ids, n_blank
          from jsonb_array_elements(case when jsonb_typeof(q.options) = 'array' then q.options else '[]'::jsonb end) as o(value);
        if n_ids <> cardinality(v_ids) then p := p || private.prob(v_path || '.options', v_lbl || ': option ids must be unique.'); end if;
        if n_blank > 0 then p := p || private.prob(v_path || '.options', v_lbl || ': every option needs text.'); end if;
        if exists (select 1 from jsonb_array_elements(case when jsonb_typeof(q.options) = 'array' then q.options else '[]'::jsonb end) as o(value)
                   where length(coalesce(o.value->>'text', '')) > 500) then
          p := p || private.prob(v_path || '.options', v_lbl || ': an option is longer than 500 characters.');
        end if;
        v_correct := coalesce(k.correct_option_ids, '{}'::text[]);
        if cardinality(v_correct) = 0 then
          p := p || private.prob(v_path || '.key', v_lbl || ': mark at least one correct option.');
        else
          select string_agg(c, ', ') into v_bad from unnest(v_correct) c where c <> all (v_ids);
          if v_bad is not null then p := p || private.prob(v_path || '.key', v_lbl || ': a correct option is not among the options.'); end if;
        end if;

      elsif sec.format = 'tf' then
        -- 7. tf
        select coalesce(array_agg(o.value->>'id' order by o.value->>'id'), '{}'::text[]) into v_ids
          from jsonb_array_elements(case when jsonb_typeof(q.options) = 'array' then q.options else '[]'::jsonb end) as o(value);
        if v_ids <> array['false','true'] then
          p := p || private.prob(v_path || '.options', v_lbl || ': a true/false question needs exactly the options "true" and "false".');
        end if;
        v_correct := coalesce(k.correct_option_ids, '{}'::text[]);
        select count(distinct c) into n_correct from unnest(v_correct) c;
        if n_correct <> 1 or cardinality(v_correct) <> 1 or not (v_correct <@ array['true','false']) then
          p := p || private.prob(v_path || '.key', v_lbl || ': choose exactly one correct answer (true or false).');
        end if;

      elsif sec.format = 'fill' then
        -- 8. fill
        select count(*) filter (where btrim(a) <> '') into n_fill from unnest(coalesce(k.accepted_answers, '{}'::text[])) a;
        if n_fill < 1 then p := p || private.prob(v_path || '.key', v_lbl || ': add at least one accepted answer.'); end if;
        if exists (select 1 from unnest(coalesce(k.accepted_answers, '{}'::text[])) a where length(a) > 200) then
          p := p || private.prob(v_path || '.key', v_lbl || ': an accepted answer is longer than 200 characters.');
        end if;
      end if;
      -- 9. essay: no key required
    end loop;
  end loop;
  return p;
end $$;

-- Copy title/instructions/duration and all content of p_src onto p_dst with NEW ids for sections and
-- questions (option ids are local to a question and stay). Used by create_draft and (task 1.7) by
-- "copy exam into a new course". p_dst must already exist and be empty.
create or replace function private.clone_version(p_src uuid, p_dst uuid) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare s record; q record; v_sid uuid; v_qid uuid;
begin
  update private.exam_versions d
     set title = x.title, title_ar = x.title_ar, instructions = x.instructions,
         instructions_ar = x.instructions_ar, duration_minutes = x.duration_minutes
    from private.exam_versions x
   where x.id = p_src and d.id = p_dst;

  for s in select * from private.sections where version_id = p_src order by position, id loop
    insert into private.sections (version_id, position, title, title_ar, format, weight)
    values (p_dst, s.position, s.title, s.title_ar, s.format, s.weight) returning id into v_sid;
    for q in select * from private.questions where section_id = s.id order by position, id loop
      insert into private.questions (section_id, position, prompt, options, note)
      values (v_sid, q.position, q.prompt, q.options, q.note) returning id into v_qid;
      insert into private.question_keys (question_id, correct_option_ids, accepted_answers, tm_equiv)
      select v_qid, k.correct_option_ids, k.accepted_answers, k.tm_equiv
        from private.question_keys k where k.question_id = q.id;
    end loop;
  end loop;
end $$;

revoke all on function private.prob(text, text)                  from public, anon, authenticated;
revoke all on function private.exam_doc(uuid)                    from public, anon, authenticated;
revoke all on function private.write_exam_content(uuid, jsonb)   from public, anon, authenticated;
revoke all on function private.validate_exam_version(uuid)       from public, anon, authenticated;
revoke all on function private.clone_version(uuid, uuid)         from public, anon, authenticated;

-- =====================================================================================
-- 2. public RPCs
-- =====================================================================================

-- Versions list + the current draft (with keys), or null.
create or replace function public.admin_get_exam(p_token text, p_course_id uuid) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_exam uuid; v_draft uuid;
begin
  perform private.require_teacher(p_token);
  if not exists (select 1 from public.courses where id = p_course_id) then
    perform private.fail('E_NOT_FOUND', 'That course no longer exists.');
  end if;
  select id into v_exam from private.exams where course_id = p_course_id;
  if v_exam is null then return jsonb_build_object('versions', '[]'::jsonb, 'draft', null); end if;
  select id into v_draft from private.exam_versions where exam_id = v_exam and status = 'draft';
  return jsonb_build_object(
    'versions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'no', v.version_no, 'status', v.status, 'title', v.title, 'title_ar', v.title_ar,
               'duration_minutes', v.duration_minutes, 'published_at', v.published_at,
               'question_count', (select count(*) from private.questions q join private.sections s on s.id = q.section_id where s.version_id = v.id),
               'attempts_count', 0)                      -- Phase 2 replaces this with the real count
             order by v.version_no desc)
      from private.exam_versions v where v.exam_id = v_exam), '[]'::jsonb),
    'draft', case when v_draft is null then null else private.exam_doc(v_draft) end);
end $$;

-- Any single version with keys (read-only for live/retired; drafts are edited via admin_save_draft).
create or replace function public.admin_get_version(p_token text, p_version_id uuid) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare d jsonb;
begin
  perform private.require_teacher(p_token);
  d := private.exam_doc(p_version_id);
  if d is null then perform private.fail('E_NOT_FOUND', 'That exam version no longer exists.'); end if;
  return d;
end $$;

-- New draft = copy of the live version (new ids) or empty. One draft at a time (AC-1.3).
create or replace function public.admin_create_draft(p_token text, p_course_id uuid) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_exam uuid; v_live uuid; v_new uuid; v_no int;
begin
  perform private.require_teacher(p_token);
  perform 1 from public.courses where id = p_course_id for update;      -- serialises with publish and other create_draft calls
  if not found then perform private.fail('E_NOT_FOUND', 'That course no longer exists.'); end if;

  insert into private.exams (course_id) values (p_course_id) on conflict (course_id) do nothing;
  select id into v_exam from private.exams where course_id = p_course_id;

  if exists (select 1 from private.exam_versions where exam_id = v_exam and status = 'draft') then
    perform private.fail('E_VALIDATION', 'A draft already exists for this exam. Continue editing it, or discard it first.');
  end if;

  select coalesce(max(version_no), 0) + 1 into v_no from private.exam_versions where exam_id = v_exam;
  insert into private.exam_versions (exam_id, version_no, status) values (v_exam, v_no, 'draft') returning id into v_new;

  select id into v_live from private.exam_versions where exam_id = v_exam and status = 'live';
  if v_live is not null then perform private.clone_version(v_live, v_new); end if;

  return private.exam_doc(v_new);
end $$;

-- Replace the draft's content. Optimistic concurrency on draft_rev (AC-1.4). Returns the new revision.
create or replace function public.admin_save_draft(p_token text, p_version_id uuid, p_rev int, p_doc jsonb) returns int
language plpgsql security definer set search_path = public, private, extensions as $$
declare v private.exam_versions; v_dur int; d jsonb; v_rev int;
begin
  perform private.require_teacher(p_token);
  select * into v from private.exam_versions where id = p_version_id for update;
  if not found then perform private.fail('E_NOT_FOUND', 'That draft no longer exists.'); end if;
  if v.status <> 'draft' then
    perform private.fail('E_VALIDATION', 'Only a draft can be edited. Create a new draft to change a published exam.');
  end if;
  if p_rev is distinct from v.draft_rev then
    perform private.fail('E_CONFLICT', coalesce(v.draft_rev::text, ''));
  end if;
  if p_doc is null or jsonb_typeof(p_doc) <> 'object' then perform private.fail('E_VALIDATION', 'The draft must be an object.'); end if;

  d := p_doc->'duration_minutes';
  if d is null or jsonb_typeof(d) = 'null' then v_dur := null;
  elsif jsonb_typeof(d) = 'number' and (d #>> '{}')::numeric = trunc((d #>> '{}')::numeric)
        and (d #>> '{}')::numeric between 1 and 600 then v_dur := (d #>> '{}')::int;
  else perform private.fail('E_VALIDATION', 'duration_minutes must be a whole number between 1 and 600.');
  end if;

  perform private.write_exam_content(p_version_id, p_doc);
  update private.exam_versions
     set title = coalesce(p_doc->>'title', ''), title_ar = nullif(p_doc->>'title_ar', ''),
         instructions = nullif(p_doc->>'instructions', ''), instructions_ar = nullif(p_doc->>'instructions_ar', ''),
         duration_minutes = v_dur, draft_rev = draft_rev + 1
   where id = p_version_id
   returning draft_rev into v_rev;
  return v_rev;
end $$;

create or replace function public.admin_discard_draft(p_token text, p_version_id uuid) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare v private.exam_versions;
begin
  perform private.require_teacher(p_token);
  select * into v from private.exam_versions where id = p_version_id for update;
  if not found then perform private.fail('E_NOT_FOUND', 'That draft no longer exists.'); end if;
  if v.status <> 'draft' then perform private.fail('E_VALIDATION', 'Only a draft can be discarded.'); end if;
  delete from private.exam_versions where id = p_version_id;             -- cascades to sections, questions, keys
end $$;

-- Validate (§7.7); then live <= draft, previous live -> retired, courses.exam_live = true (AC-1.6).
create or replace function public.admin_publish_version(p_token text, p_version_id uuid) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare v private.exam_versions; v_course uuid; v_problems jsonb;
begin
  perform private.require_teacher(p_token);
  select e.course_id into v_course
    from private.exam_versions ev join private.exams e on e.id = ev.exam_id where ev.id = p_version_id;
  if v_course is null then perform private.fail('E_NOT_FOUND', 'That draft no longer exists.'); end if;

  perform 1 from public.courses where id = v_course for update;          -- same lock order as admin_create_draft
  select * into v from private.exam_versions where id = p_version_id for update;
  if not found then perform private.fail('E_NOT_FOUND', 'That draft no longer exists.'); end if;
  if v.status <> 'draft' then perform private.fail('E_VALIDATION', 'Only a draft can be published.'); end if;

  v_problems := private.validate_exam_version(p_version_id);
  if jsonb_array_length(v_problems) > 0 then perform private.fail('E_VALIDATION', v_problems::text); end if;

  update private.exam_versions set status = 'retired' where exam_id = v.exam_id and status = 'live';
  update private.exam_versions set status = 'live', published_at = now() where id = p_version_id;
  update public.courses set exam_live = true where id = v_course and not exam_live;

  return jsonb_build_object('id', p_version_id, 'version_no', v.version_no, 'status', 'live', 'published_at', now());
end $$;

-- Typo patch on a live/retired version (FR-X13): prompt and option TEXT only. Option ids, their
-- order and their count must stay exactly as they are (AC-1.7).
create or replace function public.admin_patch_text(p_token text, p_question_id uuid, p_prompt text, p_options jsonb default null)
returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare r record; i int; n int; o jsonb; ex jsonb; v_txt text; v_new jsonb := '[]'::jsonb;
begin
  perform private.require_teacher(p_token);
  select q.options as options, s.format as format, v.status as status into r
    from private.questions q
    join private.sections s on s.id = q.section_id
    join private.exam_versions v on v.id = s.version_id
   where q.id = p_question_id
     for update of q;
  if not found then perform private.fail('E_NOT_FOUND', 'That question no longer exists.'); end if;
  if r.status = 'draft' then
    perform private.fail('E_VALIDATION', 'Drafts are edited with the draft editor. Text patches are for published versions.');
  end if;
  if btrim(coalesce(p_prompt, '')) = '' then perform private.fail('E_VALIDATION', 'The question text cannot be empty.'); end if;
  if length(p_prompt) > 4000 then perform private.fail('E_VALIDATION', 'The question text is longer than 4,000 characters.'); end if;

  if r.format in ('mcq', 'tf') then
    if p_options is null or jsonb_typeof(p_options) <> 'array' then
      perform private.fail('E_VALIDATION', 'Send the options as a list.');
    end if;
    n := jsonb_array_length(r.options);
    if jsonb_array_length(p_options) <> n then perform private.fail('E_VALIDATION', 'The number of options cannot be changed.'); end if;
    for i in 0 .. n - 1 loop
      o := p_options -> i;  ex := r.options -> i;
      if jsonb_typeof(o) <> 'object' or (o ->> 'id') is distinct from (ex ->> 'id') then
        perform private.fail('E_VALIDATION', 'Option ids and their order cannot be changed.');
      end if;
      v_txt := coalesce(o ->> 'text', '');
      if r.format = 'mcq' and btrim(v_txt) = '' then perform private.fail('E_VALIDATION', 'Every option needs text.'); end if;
      if length(v_txt) > 500 then perform private.fail('E_VALIDATION', 'An option is longer than 500 characters.'); end if;
      v_new := v_new || jsonb_build_array(jsonb_build_object('id', ex ->> 'id', 'text', v_txt));
    end loop;
  elsif p_options is not null and not (jsonb_typeof(p_options) = 'array' and jsonb_array_length(p_options) = 0) then
    perform private.fail('E_VALIDATION', 'This question type has no options.');
  end if;

  update private.questions set prompt = p_prompt, options = v_new where id = p_question_id;
  return jsonb_build_object('id', p_question_id, 'prompt', p_prompt, 'options', v_new);
end $$;

-- =====================================================================================
-- 3. grants (005 removed the defaults, so every new RPC needs its own)
-- =====================================================================================
revoke all on function public.admin_get_exam(text, uuid)                       from public, anon, authenticated;
revoke all on function public.admin_get_version(text, uuid)                    from public, anon, authenticated;
revoke all on function public.admin_create_draft(text, uuid)                   from public, anon, authenticated;
revoke all on function public.admin_save_draft(text, uuid, int, jsonb)         from public, anon, authenticated;
revoke all on function public.admin_discard_draft(text, uuid)                  from public, anon, authenticated;
revoke all on function public.admin_publish_version(text, uuid)                from public, anon, authenticated;
revoke all on function public.admin_patch_text(text, uuid, text, jsonb)        from public, anon, authenticated;

grant execute on function public.admin_get_exam(text, uuid)                    to anon;
grant execute on function public.admin_get_version(text, uuid)                 to anon;
grant execute on function public.admin_create_draft(text, uuid)                to anon;
grant execute on function public.admin_save_draft(text, uuid, int, jsonb)      to anon;
grant execute on function public.admin_discard_draft(text, uuid)               to anon;
grant execute on function public.admin_publish_version(text, uuid)             to anon;
grant execute on function public.admin_patch_text(text, uuid, text, jsonb)     to anon;

-- =====================================================================================
-- 4. post-conditions (read back from the catalog; any failure raises and rolls back)
-- =====================================================================================
do $$
declare v_bad text;
begin
  select string_agg(f, ', ') into v_bad from unnest(array[
    'admin_get_exam','admin_get_version','admin_create_draft','admin_save_draft',
    'admin_discard_draft','admin_publish_version','admin_patch_text']) f
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
                    where p.proname = f and has_function_privilege('anon', p.oid, 'EXECUTE'));
  if v_bad is not null then raise exception '011 post-check: not callable by anon: %', v_bad; end if;

  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'private'
  where has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v_bad is not null then raise exception '011 post-check: private functions executable by public roles: %', v_bad; end if;

  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where p.prokind in ('f','p') and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v_bad is not null then raise exception '011 post-check: authenticated can execute public functions: %', v_bad; end if;

  raise notice '011 applied and verified: 7 exam builder RPCs callable by anon (each checks the teacher token); helpers private.';
end $$;
