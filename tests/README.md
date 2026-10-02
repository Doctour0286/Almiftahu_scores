# Tests

All SQL tests are **psql scripts** (they use `\echo`), not plain SQL: the Supabase SQL editor cannot run them. Use `psql` with the project's connection string (Dashboard > Connect), or the local runner below.

- `sql/phase0_core.test.sql` (migrations 000-002): **LOCAL ONLY.** It changes the teacher PIN, creates sessions and inserts/deletes legacy rows. Never run it on staging or production.
- `sql/phase0_roster.test.sql` (migration 003): runs in one transaction and **rolls back**, so it is safe on staging (it temporarily swaps the PIN hash inside the transaction). Section T0.13 checks exact numbers and is skipped automatically unless the local sample students exist.
- `tools/run_local_tests.sh`: applies every migration and every test to a throwaway **local** Postgres (never Supabase), using `tools/supabase_shim.sql` to mimic roles and the legacy tables, then runs `tools/concurrency_sn.sh` (parallel adds must get distinct S/N, AC-0.7).

```
PGHOST=/tmp PGPORT=5433 PGUSER=postgres tests/tools/run_local_tests.sh
```

Staging, after applying a migration (replace the URI):

```
psql "postgresql://postgres:<password>@<host>:5432/postgres" -v ON_ERROR_STOP=1 -f tests/sql/phase0_roster.test.sql
```
