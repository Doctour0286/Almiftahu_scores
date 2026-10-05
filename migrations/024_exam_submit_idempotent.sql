-- 024_exam_submit_idempotent.sql
-- Fix AC-2.8: make exam_submit idempotent on retry / double-click.
-- Does not fail with E_SESSION_REPLACED if the attempt was already submitted or finalized with this token.

create or replace function public.exam_submit(p_attempt_token text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_att private.attempts;
  v_pending boolean;
  r record;
begin
  if p_attempt_token is null or length(p_attempt_token) < 20 then
    perform private.fail('E_SESSION_REPLACED', 'Invalid session.');
  end if;

  -- 1. Look for in_progress attempt matching the token
  for r in select * from private.attempts where status = 'in_progress' and not superseded loop
    if extensions.crypt(p_attempt_token, r.token_hash) = r.token_hash then
      v_att := r;
      exit;
    end if;
  end loop;

  if v_att.id is not null then
    update private.attempts set
      status = 'submitted',
      submitted_at = coalesce(submitted_at, now())
    where id = v_att.id;

    perform private.grade_attempt(v_att.id);

    select exists (select 1 from private.answers where attempt_id = v_att.id and fraction is null)
    into v_pending;

    select * into v_att from private.attempts where id = v_att.id;

    return jsonb_build_object(
      'ok', true,
      'status', case when v_pending then 'submitted' else 'finalized' end,
      'pending_marking', v_pending
    );
  end if;

  -- 2. Idempotency check (AC-2.8): already submitted or finalized with this token
  for r in select * from private.attempts where status in ('submitted', 'finalized') and not superseded loop
    if extensions.crypt(p_attempt_token, r.token_hash) = r.token_hash then
      select exists (select 1 from private.answers where attempt_id = r.id and fraction is null)
      into v_pending;
      return jsonb_build_object(
        'ok', true,
        'status', r.status,
        'pending_marking', v_pending
      );
    end if;
  end loop;

  perform private.fail('E_SESSION_REPLACED', 'Session expired or resumed elsewhere.');
end $$;

grant execute on function public.exam_submit(text) to anon;

do $$
begin
  assert has_function_privilege('anon', 'public.exam_submit(text)', 'execute'), 'anon must execute exam_submit';
  raise notice '024_exam_submit_idempotent applied and verified.';
end $$;
