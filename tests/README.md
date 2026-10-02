# Tests

- `sql/*.test.sql`: assert-style SQL tests. On staging, run them in the Supabase SQL editor after the matching migration.
- `tools/run_local_tests.sh`: applies every migration and test to a throwaway **local** Postgres (never Supabase), using `tools/supabase_shim.sql` to mimic roles and legacy tables.

```
PGHOST=/tmp PGPORT=5433 PGUSER=postgres tests/tools/run_local_tests.sh
```
