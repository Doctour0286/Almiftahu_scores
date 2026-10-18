# Al-Miftahu LMS — Product Requirements Document v4

**Status:** DRAFT for owner approval · **Written:** session 20 (18 Oct 2026) · **Supersedes:** nothing. `docs/PRD.md` (v3) stays the reference for Phases 0–4 (security lockdown, exam builder, codes, marking, certificates) and for the working rules in its §0.2. This document governs everything built from here on.

## 0. How to use this document (handoff protocol)

1. Read §0, §3 (state), §4 (decisions), §12 (phase plan), then the epic you are working on.
2. Work the **lowest unfinished phase** in §12. Do not start a phase whose entry gate is unmet.
3. One migration per task, numbered from 060 up, additive, idempotent, with post-conditions that read back from the catalog and a test in `tests/sql/`. Run `tests/tools/run_local_tests.sh` before every push.
4. Commit directly to `main` in small commits (owner rule, `docs/PRD.md` §0.2). `main` must stay deployable: new front-end code lives in `app/` and does not affect the deployed site until the cut-over in P2.
5. Update the tracker (§0.1) and the session log (§15) at the end of every session.
6. Never apply SQL to Supabase yourself. Migrations are run by the owner in the SQL editor, staging first, after a backup. The owner revokes any pasted token at the end of the session.

### 0.1 Tracker

| Phase | Scope | State |
|---|---|---|
| **H** Hardening | `060` staff/audio security, `061` `exam_get_result` fix, test repairs, probe extension | ✅ built and tested locally · ⬜ **owner must apply** (§14) |
| **P1** Foundation | `app/` shell, session auth for staff and students, roster, scores, cohort board | ⬜ |
| **P2** Daily Wird | lessons, review engine, keys, streaks, offline; **cut-over** | ⬜ |
| **P3** Recitation | Storage-backed audio, teacher review queue | ⬜ |
| **P4** Teacher & admin tools | inbox, attendance, nudges, staff/student admin, analytics | ⬜ |
| **P5** Exams & certificates in the new app | reuse existing RPCs | ⬜ |
| **P6** Family & polish | parent link, WhatsApp, pilot, rollout | ⬜ |

## 1. Vision, goals, non-goals

**Vision.** Every student opens the app once a day, spends 10–15 focused minutes on a routine their teachers already trust (new lesson, recent revision, old revision), finishes with a clear "done for today", and leaves with something they genuinely retain. Teachers see at a glance who needs them. The principal sees real progress, not vanity numbers. Everything works on a cheap Android phone on a weak connection.

**Goals.**
- G1. Learning that sticks: measured by delayed-recall quizzes, not time on screen.
- G2. A daily habit students are glad to keep (see the ethics rules in §6.6).
- G3. Teacher time goes to teaching: fast review, one inbox, no spreadsheets.
- G4. One simple app for four actors (student, teacher, admin, public/verifier), at most five tabs each.
- G5. Trustworthy: no default credentials, no spoofable identity, no unauthenticated writes, every claim verified by tests.
- G6. **Never lose data.** All database change is additive and backed up.

**Non-goals (v1).** AI recitation grading; payments or purchasable perks; global public rankings; native store apps; paid WhatsApp Business API; live video classes.

## 2. Users and jobs to be done

| Actor | Job | Success looks like |
|---|---|---|
| **Student** (child to adult, phone-first, often low data) | "Show me what to do today and let me finish it." | Opens app → one tap → done in ≤15 min, knows what's next |
| **Teacher** | "Tell me who needs me, let me respond fast." | Inbox empty by end of day; recitation reviewed < 24 h |
| **Principal/Admin** | "Run the school and prove it works." | Roster, courses, staff, certificates, reports in one place |
| **Parent** (optional) | "Is my child keeping up?" | One WhatsApp message a week |
| **Public/verifier** | "Is this certificate real?" | Scan or type number → valid/invalid |

## 3. Current state (audit, session 20)

**What exists.** (a) Supabase database, the asset to protect: courses, students, enrollments, results, exam builder, codes, attempts, marking, certificates, about 60 RPCs, 156 client tests and SQL tests for Phases 0–4. (b) A vanilla-JS portal (`js/`, `verify.html`) wired to those RPCs and no longer loaded by `index.html`. (c) A React/Vite prototype (`src/`, from AI Studio) that `index.html` loads now.

**Findings.**

| ID | Finding | Severity | Status |
|---|---|---|---|
| F-1 | `050` seeded staff accounts with plaintext passwords `admin123` / `teacher123` and compared plaintext | **Critical** if 050 ran on production | Fixed in `060`, owner must apply |
| F-2 | `050` `admin_list_audio_submissions` and `admin_grade_audio` were anon-executable with **no auth check** | **Critical** if 050 ran | Fixed in `060` |
| F-3 | `050` `submit_audio_recitation` trusted a browser-supplied `student_id` and stored unlimited data URLs | High | Dropped in `060`; real student sessions in P1 |
| F-4 | `050` `staff_login` had a "known password" branch. It is guarded by `private.auth_secrets`, a table no migration creates, so it is dead code on this schema | Low (latent) | Removed |
| F-5 | `031` `exam_get_result` referenced `s.format` outside its scope: **any student opening a result after an attempt got a SQL error** | High (functional) | Fixed in `031` and `061`; owner must apply `061` |
| F-6 | `phase4_certificates.test.sql` had never run against the real schema (wrong columns); `phase3` assumed a wrong default; the lockdown test's function count went stale in Phase 3. The certificate logic itself passes once the tests are correct | Medium (assurance) | Tests repaired |
| F-7 | `netlify.toml` publishes `.` with no build, but `index.html` loads `/src/main.tsx`. If Netlify serves `main`, the page is blank | High (deploy) | Open, resolved at cut-over (D-63). Live URL unknown to the author |
| F-8 | The React prototype keeps exams, certificates, student logins (default password `mif2026`) and progress in `localStorage` and `mockData.ts`; lesson content and quiz answers are hardcoded in the client; it reads tables directly, which `005` denies | High (not production-ready) | Replaced in P1–P5 |

## 4. Decisions

| ID | Decision | Why |
|---|---|---|
| **D-60** | The database stays. All change is additive: new tables and functions, no destructive change without a backup and the owner's go. Staging first. | Owner's one hard rule |
| **D-61** | **One session mechanism.** Opaque 256-bit tokens, stored hashed in `private.teacher_sessions`, issued by login RPCs, for staff *and* students. Supabase Auth is **not** used. | The existing mechanism already guards ~60 RPCs and is tested; students often have no email; fewer moving parts. (Earlier chat advice favoured Supabase Auth; reading `002` changed that.) |
| **D-62** | Staff accounts live in `private.staff_accounts` (bcrypt, throttled, `teacher`/`admin` roles). The shared teacher PIN stays until every teacher has an account, then is retired. | Individual accountability, no shared secret |
| **D-63** | New app in `app/` (Vite + React + TypeScript). `js/` and `src/` are frozen. `netlify.toml` gets `build = "npm run build"`, `publish = "app/dist"` at the P2 cut-over, with a Netlify deploy preview first. | Zero risk to what is live until it is replaced |
| **D-64** | Clients never read tables. Every read and write is an RPC with a token or an enrollment+code credential. | Matches `005` |
| **D-65** | Review scheduling is a fixed ladder of 6 boxes, default intervals **1, 3, 7, 14, 30, 60 days**, in `system_params`. A correct recall moves up a box; a miss drops to box 1. | Research found expanding and uniform spacing perform about the same; simple beats clever |
| **D-66** | The engagement ethics rules in §6.6 are binding requirements, not suggestions. | Avoid compulsion and "gamified obligation" |
| **D-67** 🟡 | Defaults pending owner answer on student ages: cohort boards of 10–15, rank private by default, weekly reset, Friday is a rest day (all configurable per course). For students under about 13 the board is off by default. | Safe defaults |
| **D-68** | Recitation is teacher-graded plus a student self-check mode. No automatic speech recognition in v1. | Cost, accuracy (word-level tools miss vowel errors), and the teacher stays the authority |
| **D-69** | Audio lives in a private Supabase Storage bucket (`recitations`), referenced by path; signed URLs; max 90 s and 1.5 MB per clip; Opus where the browser supports it. | Stop storing recordings as table text |
| **D-70** | PWA with an offline cache. **Practice** quizzes may be graded on the device and never touch official scores. **Graded** work (exam, scored quiz) is server-side only. | Weak connectivity without leaking answer keys |
| **D-71** | Notifications in v1 are WhatsApp deep links (`wa.me` with prefilled text) opened by the teacher or the family; no paid API. | Reach without cost |
| **D-72** | Behaviour analytics are first-party (`study_events` in our database), not a third-party SDK. | Children's data stays ours |

**Open items for the owner**

| ID | Question | Default if unanswered |
|---|---|---|
| O-20 | Age range of most students | Mixed ages, gentle mechanics, boards off under ~13 |
| O-21 | Live URL and where it is hosted (Netlify? AI Studio?) | Assume Netlify |
| O-22 | Did `050` run on production? | Assume yes: apply `060` now |
| O-23 | Create the `recitations` Storage bucket (P3) | Guide provided in P3 |
| O-24 | Video lessons? | Audio + text; optional unlisted-link embeds |
| O-25 | Should a teacher see only their assigned courses? | Yes, enforced in P4 (`assigned_courses` already exists) |

## 5. Information architecture

Maximum five bottom tabs per role. Student and teacher UIs are phone-first; admin is responsive.

- **Student:** Today · Library · Keys · Exams · Me (profile, certificates, language, lite mode).
- **Teacher:** Inbox · Halaqa (class and scores) · Reviews · Exams · More.
- **Admin:** Dashboard · People · Courses and content · Certificates · Settings (institution, audit).
- **Public:** Home (portal and optional cohort board) · Verify certificate.

Languages: English, Hausa, Arabic (full RTL). Every string is a key; no hardcoded text.

## 6. Product specification

### 6.1 The daily Wird

One session per day, 10–15 minutes, four stations:

| Station | Content | Source |
|---|---|---|
| **Sabqi** (recent) | Recall of the last 1–3 lessons: short answers, fill-ins, recitation with text hidden | `review_state` items due in boxes 1–2 |
| **Sabaq** (new) | One lesson: listen/read, 3–5 questions, optional recitation recording | next lesson in the course |
| **Manzil** (old) | Older items due today | boxes 3–6 |
| **Close** | "Done for today" screen, tomorrow's preview, any teacher message | — |

Rules (from hifz practice): if a student is behind, new lessons pause and only review is offered. If an item is missed twice in a row it enters **Repair** (short focused retry) before new content unlocks. A session is complete when the stations are done; there is no "one more round" prompt.

### 6.2 Learning items and mastery

A lesson is composed of **items**: the smallest thing worth remembering (an ayah or phrase to recite, a definition, a fact, a question). Each item has a type (`recite`, `recall`, `mcq`, `fill`), content, and a key (kept private for scored items). `review_state(student, item)` holds `box`, `due_on`, `streak_correct`, `lapses`. Recall and recitation items outnumber multiple-choice. A lesson is **mastered** when all its items are in box ≥ 3. Mastered lessons award a **Key**.

### 6.3 Keys

Each mastered lesson earns a key (مفتاح). A key dims if its items fall overdue, and brightens when revised. Completing the course's required keys unlocks the exam and certificate eligibility (the existing eligibility rules in `courses` still apply; keys feed them, they do not replace them).

### 6.4 Streaks and cohorts

- **Consistency**, not a daily chain: "days this week" out of the course's expected days, with automatic freezes. Rest days (default Friday) never break anything. Nothing can be bought.
- **Cohort board:** a halaqa of 10–15, weekly reset, ranked by *improvement and consistency* as well as score, with a shared goal bar. Rank is private to the student by default; teachers can see all. Boards can be turned off per course.
- **Badges:** earned for behaviours (first recitation, a repaired item, a 4-week run), never for spending.

### 6.5 Teacher experience

- **Inbox** ("Needs you"): recitations to review, essays to mark, scores to enter, students inactive ≥ 3 days, with one-tap WhatsApp nudge templates (Arabic/Hausa/English).
- **Recitation review:** play (1×–2×), tap rubric tags (memorization, fluency, tajweed), score, optional text or voice reply; next item loads automatically. Target ≤ 30 s per clip.
- **Halaqa:** fast score grid (the layout teachers already know), attendance in one tap per student, student 360° (progress, keys, recitations, exam results, notes).

### 6.6 Engagement ethics (binding)

1. No guilt: no "you'll lose your streak" notifications; reminders are at most one gentle message per day, student-configurable, with quiet hours.
2. A daily cap and an explicit "done for today" state.
3. No purchasable advantage, no ads, no loot-box mechanics.
4. No permanent global rankings; small cohorts, weekly reset, private by default.
5. Reward retention and effort, not time spent.
6. Every mechanic can be turned off per course by an admin.
7. Guardrail metric (§11): signs of streak stress or complaints trigger loosening, not tuning-up.

### 6.7 Exams and certificates

Phases 1–4 of v3 are kept as is (RPCs, rules, tests, verification). P5 rebuilds their UI in `app/`, calling the same RPCs. Student exam entry remains enrollment + code. `exam_get_result` is fixed (F-5).

### 6.8 Family link (P6)

A read-only family code per student shows weekly summary and certificates. A teacher or the family can open a prefilled WhatsApp message with the week's summary. No account creation for parents.

## 7. Functional requirements and acceptance criteria

IDs `FR-<epic>.<n>`; each has an acceptance criterion (`AC`) that is a test.

**E1 Identity and access (P1)**
- FR-1.1 Staff sign in with email + password; session token as in D-61. *AC:* wrong password 5× locks 5 min; deactivated staff lose sessions immediately (tested in `060`).
- FR-1.2 Students sign in with **institution code + 4–6 digit PIN** issued by a teacher; PIN hashed, throttled, resettable by a teacher. *AC:* no student can read or write another student's data (test per RPC).
- FR-1.3 Roles: student, teacher, admin; `assigned_courses` scopes a teacher (P4). *AC:* a teacher token for course A cannot read course B.
- FR-1.4 No default accounts anywhere. *AC:* anon probe 4a passes.

**E2 Content authoring (P2)**
- FR-2.1 Admin creates units and lessons with title (3 languages), text, audio upload, optional resource links, and items (§6.2). *AC:* a lesson with no items cannot be published.
- FR-2.2 Draft → published with immutable published versions (reuses the exam-builder pattern). *AC:* editing a published lesson creates a new version; students mid-lesson are unaffected.
- FR-2.3 Items for scored quizzes keep keys in a private table. *AC:* no RPC returns a key before the student has answered.

**E3 Daily Wird engine (P2)**
- FR-3.1 `wird_today` returns the three stations for the student, deterministic for the day. *AC:* same input, same output; paused-new rule honoured.
- FR-3.2 `wird_answer` records an answer, updates box/due/lapses, appends `study_events`. *AC:* box moves per D-65; double submits are idempotent.
- FR-3.3 Completion awards keys and updates `activity_days`. *AC:* rest days never break consistency.

**E4 Recitation (P3)**
- FR-4.1 Student records in-app (≤ 90 s), preview, submit; works offline and uploads when online. *AC:* an interrupted upload resumes, no duplicates.
- FR-4.2 Teacher review queue with rubric, score, reply. *AC:* turnaround and queue length visible to admin.
- FR-4.3 Self-check mode with no upload. *AC:* never creates a submission.

**E5 Motivation (P2–P4)**
- FR-5.1 Keys, weekly consistency, badges, cohort board per §6.3–6.4. *AC:* with the board off, no rank appears anywhere (UI and RPC outputs).
- FR-5.2 Ethics rules enforced in code and config. *AC:* snapshot test that no notification template contains loss-framing text.

**E6 Teacher and admin tools (P4)**
- FR-6.1 Inbox, nudges, attendance, student 360°. FR-6.2 Staff admin (uses `admin_list_staff`, `admin_save_staff`). FR-6.3 Student import (CSV), course and content admin. FR-6.4 Audit log of admin actions. FR-6.5 Analytics: weekly active learners, review completion, lesson difficulty, recitation turnaround.

**E7 Exams and certificates (P5)** — port existing RPCs; *AC:* the 156 existing client-side behaviours reproduced in `app/` tests; all Phase 1–4 SQL tests stay green.

**E8 Offline and performance (P1–P6)**
- FR-8.1 Installable PWA; lessons cached after first open; answers/recordings queue offline. *AC:* airplane-mode test completes a Wird and syncs.
- FR-8.2 **Lite mode** (text + audio only). *AC:* first load under about 150 KB of JavaScript, usable on a throttled 2G profile.
- FR-8.3 Tested on Tecno/Infinix/Itel-class Android devices or emulation profiles.

**E9 Family and sharing (P6)** — §6.8; prefilled WhatsApp share for results and certificates.

## 8. Data model

Existing tables are kept as is (`courses`, `students`, `enrollments`, `enrollment_results`, `exams*`, `attempts`, `answers`, `attempt_events`, `exam_codes`, `certificates`, `certificate_counters`, `institution_settings`, `system_params`, `auth_throttle`, `teacher_sessions`, `staff_accounts`, `audio_submissions`, `lesson_quiz_attempts`). Retired when replaced: the shared PIN secret (after P4), the legacy `students` columns (`006`), `lesson_quiz_attempts` (superseded by `review_state`/`study_events`), and every use of `localStorage`/mock data in `app/`.

New, all in `private` (RLS on, no direct grants) and reached by RPC only. Sketches; final DDL is written per migration.

| Table | Key columns |
|---|---|
| `units` | `id`, `course_id`, `position`, `title`, `title_ar`, `title_ha` |
| `lessons` | `id`, `unit_id`, `position`, `status` (draft/published), `version`, titles, `body`, `audio_path`, `est_minutes` |
| `lesson_items` | `id`, `lesson_id`, `type` (recite/recall/mcq/fill), `prompt`, `options`, `position`, `scored` |
| `item_keys` | `item_id`, `accepted`/`correct_option_ids` (private; never returned before answering) |
| `student_credentials` | `student_id`, `pin_hash`, `must_change`, `updated_at` |
| `review_state` | `student_id`, `item_id`, `box`, `due_on`, `streak_correct`, `lapses`, `last_seen_at` |
| `study_events` | append-only: `student_id`, `kind`, `ref`, `at`, `meta` |
| `activity_days` | `student_id`, `day`, `wird_done`, `minutes` |
| `keys_earned` | `student_id`, `lesson_id`, `earned_at`, `strength` |
| `halaqat`, `halaqa_members` | cohorts: `id`, `course_id`, `name`, `teacher_id`; membership |
| `cohort_week_scores` | `halaqa_id`, `week`, `student_id`, `effort`, `improvement`, `rank_visible` |
| `badges`, `student_badges` | catalogue and awards |
| `recitations` | replaces `audio_submissions` in P3: `student_id`, `lesson_id`, `storage_path`, `duration_s`, `status`, rubric, score, `reviewed_by`, `reviewed_at` |
| `announcements`, `attendance`, `audit_log`, `nudge_log` | as named |

Backups: a full `pg_dump`/Supabase backup before each production migration; every migration idempotent with catalog post-checks (as in `005`, `060`).

## 9. API surface (RPC catalogue)

Convention: first argument is the session token (`p_token`) for staff and student RPCs; exam code RPCs keep `(enrollment_id, code)`. Errors raise `E_*` codes; failures that must persist a counter return `{ok:false, error}` (see `002`).

| Group | RPCs | Auth |
|---|---|---|
| Public | `verify_certificate`, `public_board` (P1, no names beyond what the school allows) | none |
| Staff auth | `staff_login`, `staff_change_password`, `teacher_login` (legacy PIN), `teacher_ping/logout` | — / session |
| Staff admin | `admin_list_staff`, `admin_save_staff` | admin |
| Student auth (P1) | `student_login(institution_code, pin)`, `student_logout`, `student_change_pin`, `admin_set_student_pin` | — / student / teacher |
| Content (P2) | `admin_save_lesson`, `admin_publish_lesson`, `admin_list_lessons`, `student_library`, `student_lesson` | admin / student |
| Wird (P2) | `wird_today`, `wird_answer`, `wird_complete`, `student_keys`, `student_progress` | student |
| Recitation (P3) | `recitation_upload_ticket`, `recitation_submit`, `admin_review_queue`, `admin_review_recitation`, `student_recitations` | student / teacher |
| Cohort (P2) | `student_board`, `admin_save_halaqa` | student / admin |
| Teacher (P4) | `teacher_inbox`, `teacher_attendance`, `teacher_student_360`, `admin_analytics` | teacher / admin |
| Exams/certs | existing 41 RPCs | existing |

## 10. Security and privacy

- Anon surface is an explicit allow-list (name families asserted in `phase0_lockdown.test.sql`); every `admin_*` takes a leading `p_token` (asserted in `phase5_hardening.test.sql`).
- Passwords and PINs bcrypt-hashed (cost 10), throttled per account, constant-time-ish for unknown emails; sessions hashed, 8-hour expiry, invalidated on password change, role change or deactivation.
- Students are children: collect the minimum (name, class, scores, recordings); recordings in a private bucket with signed, short-lived URLs; no third-party trackers; retention and deletion path defined in P4; admin audit log.
- Rate limiting at the edge (Cloudflare or Netlify) for login endpoints is recommended; the database throttle is the backstop.
- Secrets: only the publishable key in the client; never a `service_role` key; the anon probe refuses one.
- Every phase ends with the anon probe against staging, then production.

## 11. Metrics and guardrails

| Measure | Target direction |
|---|---|
| Weekly active learners / enrolled | up |
| Wird completion rate (days done / expected days) | up |
| 30- and 90-day delayed-recall score | **the learning measure** |
| Recitation review turnaround | < 24 h |
| Exam pass rate and certificate issuance | up |
| Guardrail: stress/complaint signals about streaks or boards, teacher-reported | **any rise ⇒ loosen mechanics** |

## 12. Phase plan

Each phase ends with: all SQL tests green, new RPCs in the probe, a staging run, then production by the owner.

### Phase H — Hardening (built; owner applies)
Deliverables: `060_staff_hardening.sql`, `061_fix_exam_get_result.sql`, in-place fixes to `031` and `050`, repaired tests, `phase5_hardening.test.sql`, `hardening_upgrade_path.sh`, extended `anon_probe.mjs`. **Exit gate:** owner applies `060` + `061`, runs `private.bootstrap_admin(...)`, anon probe 0 failures, an admin can log in via `staff_login`.

### Phase 1 — Foundation
**Entry:** Phase H exit gate. **Tasks:**
- P1.1 `app/` scaffold: Vite, React, TypeScript, router, i18n (en/ha/ar, RTL), design tokens (emerald/gold), error boundaries, typed RPC client with generated types; no `localStorage` data.
- P1.2 `07x` student credentials: `student_credentials`, `student_login`, `admin_set_student_pin`, throttle, tests that no student reaches another's data.
- P1.3 Staff login screen + session handling (expiry, refresh via `teacher_ping`).
- P1.4 Roster, score entry grid and leaderboard at parity with `js/` (reuse `admin_*` RPCs).
- P1.5 Netlify deploy **preview** from `app/` (production untouched).
**Exit:** teacher completes a week of score entry in `app/`; student logs in with code + PIN; parity checklist signed off.

### Phase 2 — Daily Wird, then cut-over
**Entry:** P1 exit. **Tasks:** P2.1 content tables and RPCs (E2); P2.2 `review_state` engine and `wird_*` RPCs with the ladder (D-65) and tests including the paused-new and Repair rules; P2.3 student Today/Library/Keys UI; P2.4 consistency, keys, cohort board with the ethics config; P2.5 PWA + offline queue + lite mode; P2.6 content import from the existing ADAB curriculum; **P2.7 cut-over:** switch `netlify.toml` to build `app/`, redirect rules, keep `js/` and `src/` in git history only. **Exit:** one halaqa completes a 2-week pilot; delayed-recall quiz shows retention data; rollback plan rehearsed.

### Phase 3 — Recitation
**Entry:** P2 exit, Storage bucket created (O-23). **Tasks:** upload tickets and signed URLs, recorder component with offline queue, `recitations` table, review queue RPCs, rubric UI, self-check mode, migration of any existing `audio_submissions` rows to Storage (no data loss: copy, verify, only then mark migrated). **Exit:** median teacher review ≤ 30 s per clip in the pilot.

### Phase 4 — Teacher and admin tools
Inbox, nudges (WhatsApp templates), attendance, student 360°, staff and student admin UIs, course scoping (O-25), audit log, analytics dashboard, retirement of the shared PIN. **Exit:** every teacher has an individual account; PIN login disabled by a setting.

### Phase 5 — Exams and certificates in `app/`
Port builder, codes, student exam player with autosave and offline tolerance, marking, certificates, verification. Reuse all RPCs; add Playwright end-to-end tests for the exam flow. **Exit:** one full exam cycle with real students, certificates issued and verified.

### Phase 6 — Family and polish
Family link, WhatsApp summaries and certificate sharing, accessibility pass (contrast, font scaling, screen reader), performance budget check, load test, full rollout. **Exit:** go-live checklist, owner sign-off.

## 13. Technical architecture

```
app/                      Vite + React + TS (new)
  src/ui/                 design system (tokens, components, RTL)
  src/features/           student/ teacher/ admin/ public/ exams/
  src/lib/rpc.ts          typed RPC client (only network access point)
  src/lib/offline.ts      IndexedDB queue, cache, sync
migrations/               060+ (additive, idempotent)
tests/sql/ tests/tools/   SQL tests, upgrade-path test, anon probe
js/ src/                  frozen legacy (removed at P2 cut-over)
```

- Hosting: Netlify (build `npm run build`, publish `app/dist`), env vars for the Supabase URL and publishable key.
- Types generated from the database; no hand-written response shapes.
- Tests: SQL tests (existing + per phase), upgrade-path test, anon probe, Vitest for logic, Playwright for end-to-end and offline, a throttled-2G performance check.
- CI (GitHub Actions): lint, typecheck, unit tests, SQL suite on a Postgres service, bundle-size budget.

## 14. Owner runbook for Phase H (do in this order)

1. Back up the production database (Supabase dashboard → Database → Backups, or a `pg_dump`).
2. SQL editor, **staging first**, then production: run `migrations/060_staff_hardening.sql`, then `migrations/061_fix_exam_get_result.sql`. Each prints a `NOTICE ... applied and verified`. Both are safe to run twice.
3. Create your admin (choose a long passphrase; it is only ever typed into the SQL editor):
   `select private.bootstrap_admin('you@example.org', '<long passphrase>', 'Your Name', 'اسمك');`
4. Run `node tests/tools/anon_probe.mjs <SUPABASE_URL> <PUBLISHABLE_KEY>`. Expect 0 failures, including the new 4a/4b/4c checks.
5. Know what changes for users: the three seeded staff accounts are disabled; the old audio submit and list calls no longer work until P3 (the prototype's recitation screen will show an error); `teacher_login` with the PIN is unchanged.
6. Revoke the GitHub token used for this session.

## 15. Session log

| # | Date | Work |
|---|---|---|
| 20 | 2026-10-18 | Surveyed repo, upload and database design; web research on engagement, spaced retrieval, hifz method, Nigerian mobile context; found F-1…F-8; built `060`, `061`, repaired tests, added `phase5_hardening.test.sql`, `hardening_upgrade_path.sh`, extended probe; wrote this PRD. **Local verification only:** the SQL suite ran on a local PostgreSQL 16; nothing was applied to Supabase; the live site and the extended probe were not run against production. |
