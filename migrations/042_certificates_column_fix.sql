-- 042_certificates_column_fix.sql
-- Fixes missing columns on private.certificates if 040 was executed when private.certificates
-- was already pre-created with minimal columns by hotfix_certificates_table.sql.

alter table private.certificates add column if not exists number text;
alter table private.certificates add column if not exists verify_code text;
alter table private.certificates add column if not exists approved_at timestamptz not null default now();
alter table private.certificates add column if not exists revoked_at timestamptz;
alter table private.certificates add column if not exists revoke_reason text;
alter table private.certificates add column if not exists snapshot jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'certificates_number_key') then
    alter table private.certificates add constraint certificates_number_key unique (number);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'certificates_enrollment_id_key') then
    alter table private.certificates add constraint certificates_enrollment_id_key unique (enrollment_id);
  end if;
end $$;

-- Verify
do $$
begin
  assert exists (
    select 1 from information_schema.columns 
    where table_schema = 'private' and table_name = 'certificates' and column_name = 'number'
  ), 'private.certificates.number column missing';
  raise notice '042_certificates_column_fix applied successfully.';
end $$;
