# Tests

- `sql/phase0_roster.test.sql` (migration 003) and `sql/phase0_public_access.test.sql` (migration 004): contain **no psql meta-commands**, run in one transaction and **roll back**, so they are safe on staging. Results appear as notices; a failed assertion aborts with an error naming the check. They should paste into the Supabase SQL editor (not yet verified there; if the editor objects, use `psql` as below). The roster test's section T0.13 checks exact numbers and is skipped automatically unless the local sample students exist.
- `sql/phase0_core.test.sql` (migrations 000-002): **LOCAL ONLY, psql only.** It uses `\echo`, changes the teacher PIN, creates sessions and inserts/deletes legacy rows. Never run it on staging or production.
- `tools/run_local_tests.sh`: applies every migration and every test to a throwaway **local** Postgres (never Supabase), using `tools/supabase_shim.sql` to mimic roles, the realtime publication and the legacy tables, then runs `tools/concurrency_sn.sh` (parallel adds must get distinct S/N, AC-0.7).

```
PGHOST=/tmp PGPORT=5433 PGUSER=postgres tests/tools/run_local_tests.sh
```

Staging with `psql`, after applying a migration (replace the URI):

```
psql "postgresql://postgres:<password>@<host>:5432/postgres" -v ON_ERROR_STOP=1 -f tests/sql/phase0_roster.test.sql
```
