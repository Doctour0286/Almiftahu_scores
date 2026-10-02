# Client tests (task 0.5/0.6)

Scripted sessions of the real `js/` modules in jsdom, against `fake.js`: an in-memory stand-in for the
PostgREST tables and the Phase-0 RPCs. Any direct table write (`POST/PATCH/DELETE /rest/v1/<table>`) is
rejected and fails the run, so the suite also proves no `sb.from(...).insert/update/delete` is left.

    cd tests/client && npm install && npm test && npm run lint

**Limits (read before trusting a green run):** `fake.js` re-implements the rules of `002`/`003` by hand, so it
shows the client uses the RPCs correctly, not that the SQL is right (that is `tests/sql/`). There is no real
browser (layout, fonts, CSS) and no live Realtime. The staging walkthrough (task 0.7) covers those.
