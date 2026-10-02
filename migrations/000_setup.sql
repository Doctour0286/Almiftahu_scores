-- 000_setup.sql  (Phase 0, task 0.1)
-- Extensions, the `private` schema, error helper, system parameters.
-- Safe to re-run.

create schema if not exists extensions;                       -- already exists on Supabase
create extension if not exists pgcrypto with schema extensions;

-- Fail early with a clear message if pgcrypto lives somewhere else in this project.
do $$ begin
  if to_regprocedure('extensions.crypt(text,text)') is null then
    raise exception 'pgcrypto functions not found in schema "extensions". '
      'Move it with: alter extension pgcrypto set schema extensions;';
  end if;
end $$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Stable error helper. Client maps error.message (E_XXX) to friendly text (PRD §8.5).
-- NOTE: RAISE ... DETAIL = NULL is itself an error in Postgres, so a null detail is coalesced
-- to ''. (The PRD reference version passed it through and broke every bare fail('E_AUTH').)
create or replace function private.fail(p_code text, p_detail text default null)
returns void language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, '');
end $$;

-- System parameters (D-45). Empty by default: built-in defaults apply.
create table if not exists private.system_params (
  key        text primary key,
  value      numeric not null,
  note       text,
  updated_at timestamptz not null default now()
);

create or replace function private.param(p_key text, p_default numeric)
returns numeric language sql stable as $$
  select coalesce((select value from private.system_params where key = p_key), p_default)
$$;
