# Production cut-over checklist (task 0.8)

Companion to the runbook in `docs/PRD.md` §11 (that is the authority; this file only makes it executable).
Target: **production** Supabase project `vnqgxopexirycynuybyc`. Staging is `pwhrcilahaupsbpjljmc`.
Rule of thumb: **before step 7 everything can be rolled back; after step 7 it is forward-fix only.**

## A. Before the freeze (only what the steps below actually need)

Tests and staging verification are deliberately **last** (section C), by the owner's call (session 10): the staging walkthrough and `005` on staging already worked. The two gates that stay inside the cut-over are step 6 (smoke test, the only rollback point) and step 8 (anon probe on production).

- [ ] Owner: decide **O-10** (production hostname). Until then `js/config.js` treats `localhost`, `127.0.0.1`, `*.localhost` and any host containing `--` as staging and **every other host as production**. Make sure no staging site lives on an ordinary hostname.
- [ ] Owner: decide **D-36** (Netlify) or tell me what serves `main` today, so step 5 is "merge, then wait for *that* deploy".
- [ ] Owner: choose the new teacher passphrase (**O-6**). Keep it out of chat, repo and screenshots.
- [ ] Pick a quiet 30-minute window.

## B. The cut-over (timing starts at step 1)

1. **Freeze.** Tell teachers: no score entry for 30 minutes.
2. **Backup.** Supabase dashboard (production) > Database > Backups, or export `students` and `app_settings` as CSV from Table Editor. Keep the files; this is the last resort after step 7.
3. **Run `000` to `004` on production**, in order, each pasted whole into the SQL editor, each must finish without error:
   `000_setup.sql`, `001_courses_enrollments.sql`, `002_auth.sql`, `003_roster_rpcs.sql`, `004_public_access.sql`.
   Do **not** run anything in `migrations/staging_only/`, `005`, or `rollback/`. Check the **old** site still loads and shows scores (these migrations are additive).
4. **Copy scores forward again** (catches anything entered since step 3):
   `select private.sync_legacy_students();`
   Then `select (select count(*) from public.students) as students, (select count(*) from public.enrollments) as enrollments;` The two numbers must match.
5. **Deploy the new client.** Fast-forward `main` to branch `phase0/0.5-0.6-port` (the branch sits directly on top of `main`) and push; wait for the deploy. Open the live URL: there must be **no STAGING badge**.
   *(Assistant does this on your word. Owner may also do it from GitHub.)*
6. **Smoke test** with the **old** PIN: unlock, open a student, save a score, add a test student, delete it.
   - **Any failure here = roll back:** revert the merge on `main` (assistant), paste `migrations/rollback/reverse_sync.sql` into the SQL editor (must print `... 0 differences remain.`), confirm the old site shows the scores, lift the freeze. Do **not** go on to step 7.
7. **Run `005_security_lockdown.sql`.** It must print `005 applied and verified: ...`. If it errors it changes nothing; stop and paste me the message. From here the old client cannot write and rollback is no longer possible.
8. **Anon probe against production** (publishable key from `js/config.js`):
   `node tests/tools/anon_probe.mjs https://vnqgxopexirycynuybyc.supabase.co <production publishable key>`
   Exit code must be 0 (every probe denied). It cannot change data, so it is safe to run.
9. **Change the PIN** in the app: Manage Students > Change teacher PIN > the new passphrase. Log out and back in with it.
10. **Lift the freeze.** Tell teachers the new PIN privately.

## C. Afterwards (verification and tests, last)

- [ ] Revoke the GitHub access token used for this work.
- [ ] Within the hour: one real score save and one student added, checked by the owner on a phone.
- [ ] Staging: paste `tests/sql/phase0_lockdown.test.sql` (must end `ALL PHASE 0 LOCKDOWN TESTS PASSED`) and run `node tests/tools/anon_probe.mjs https://pwhrcilahaupsbpjljmc.supabase.co <staging publishable key>` (exit 0).
- [ ] Staging: re-run `001_courses_enrollments.sql` once (idempotent) so staging matches production's version of `sync_legacy_students`.
- [ ] Owner: AC-0.12 screenshots (360 / 768 / 1280 px, light and dark).
- [ ] Local: `tests/tools/run_local_tests.sh` and `cd tests/client && npm ci && node run.js`.
- [ ] After **7 days** with no problems, take a backup and run **`migrations/006_drop_legacy.sql`** (written and tested, session 10). It refuses unless `005` is applied, redefines `add_student_enrollment`, drops `sync_legacy_students`, drops `students.sn/days/bonus_units/active`, and prints `006 applied and verified`. After it, `rollback/reverse_sync.sql` is unusable. Then open the app: add a student, save a score.
- [ ] Update the PRD tracker and session log (assistant).

## D. If something looks wrong

| Symptom | Action |
|---|---|
| Step 3 error | Stop. Paste the error. Migrations are written to be re-runnable; do not improvise. |
| Counts differ in step 4 | Stop. Paste both numbers and `select sn,name from public.students where sn is null or id not in (select student_id from public.enrollments);` |
| Step 6 fails | Roll back as written in step 6. |
| Step 7 errors | It changed nothing; stay on the new client, paste the message. |
| Step 8 FAIL line | Paste the output. Do not lift the freeze. |
| After step 10 | Forward-fix only (new migration or client change); backup from step 2 is the last resort. |
