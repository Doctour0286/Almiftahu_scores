# Tests

- `sql/phase0_roster.test.sql` (migration 003) and `sql/phase0_public_access.test.sql` (migration 004): contain **no psql meta-commands**, run in one transaction and **roll back**, so they are safe on staging. Results appear as notices; a failed assertion aborts with an error naming the check. They should paste into the Supabase SQL editor (not yet verified there; if the editor objects, use `psql` as below). The roster test's section T0.13 checks exact numbers and is skipped automatically unless the local sample students exist.
- `sql/phase0_core.test.sql` (migrations 000-002): **LOCAL ONLY, psql only.** It uses `\echo`, changes the teacher PIN, creates sessions and inserts/deletes legacy rows. Never run it on staging or production.
- `sql/phase0_lockdown.test.sql` (migration 005): **run only after `005` is applied.** No meta-commands, one transaction, rolls back, staging-safe. Proves what the public key cannot do and runs the whole teacher workflow as `anon` under RLS. It fails if `005` has not been applied.
- `tools/anon_probe.mjs`: Appendix C.1, the stranger's-eye check. `node tests/tools/anon_probe.mjs <SUPABASE_URL> <PUBLISHABLE_KEY>`. Uses only the publishable key, needs Node 18+, cannot change data (see the header of the file), refuses a `service_role` key, exits 0/1/2. Run it after `005` on staging, then on production (runbook step 8). Against a bare local PostgREST use `PROBE_REST_PATH=''`.
- `tools/run_local_tests.sh`: applies every migration and every test to a throwaway **local** Postgres (never Supabase), using `tools/supabase_shim.sql` to mimic roles, the realtime publication and the legacy tables, then runs `tools/concurrency_sn.sh` (parallel adds must get distinct S/N, AC-0.7). `005` is applied after the pre-lockdown tests (twice, to prove idempotence), followed by the lockdown test and the S/N test again. The shim mimics Supabase's default grants (anon gets everything on new public objects) so lockdown tests cannot pass vacuously.

```
PGHOST=/tmp PGPORT=5433 PGUSER=postgres tests/tools/run_local_tests.sh
```

Staging with `psql`, after applying a migration (replace the URI):

```
psql "postgresql://postgres:<password>@<host>:5432/postgres" -v ON_ERROR_STOP=1 -f tests/sql/phase0_roster.test.sql
```
