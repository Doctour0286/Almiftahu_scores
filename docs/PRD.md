# Product Requirements Document (PRD)

## Ma'had Miftah al-'Ilm: Courses, Exams & Certificates Platform

| | |
|---|---|
| **Document version** | 3.9 |
| **Date** | 2 October 2026 |
| **Supersedes** | `exam-system-plan.md` (v1) and `exam-system-plan-v2.md` |
| **Product** | Extension of the existing "Ma'had Miftah al-'Ilm: Score Portal" (single-file web app) |
| **Hosting** | Netlify (recommended, D-36) + Supabase (Postgres, RPC, Realtime) |

---

# 0. READ THIS FIRST (Handoff Protocol)

## 0.1 Purpose of this document
This PRD is the **single source of truth** for the project. It is written so that **any engineer or AI assistant can pick it up cold and continue exactly where the previous session stopped**, without re-asking questions that are already settled.

## 0.2 Instructions to the assistant continuing this work

1. **Read §0, §3 (current state), §4 (decisions), and the phase you are working on (§11) in full** before doing anything. Skim the rest, then use it as reference.
2. **Do not re-ask settled decisions.** Every decision in §4 marked ✅ was explicitly chosen by the owner. Items marked 🟡 are assistant-proposed defaults: use them unless the owner changes them, and mention when you rely on one.
3. **Check the status tracker (§0.3) and the session log (§0.4).** Then ask the owner one short question: "The tracker says we're at <phase/task>. Is that still accurate?" Proceed from there.
4. **Plan before implementing** (the owner explicitly asked for this working style). For any non-trivial task, briefly state the plan, then implement. Do not make large changes without agreeing the approach.
5. **Never break the existing app.** The current Score Portal is live. Phase 0 must leave its look and behavior unchanged (§11, Phase 0).
6. **You cannot run the owner's Supabase.** Deliver SQL as numbered migration files in `/migrations/`. The owner runs them in the Supabase SQL editor and pastes back the output or errors. Never ask for, accept, or embed the `service_role` key anywhere in client code.
7. **Deliver complete files, not diffs,** into `/mnt/user-data/outputs/` (or the project folder the owner indicates), and present them.
8. **Update this document at the end of every session:** the tracker (§0.3), the session log (§0.4), and any decision or open item that changed. A PRD that is out of date defeats its purpose.
9. **Preserve the visual identity** (emerald and gold, Amiri + Inter, existing component classes). See §9.1.
10. **Security rules are non-negotiable** (§8). If a request conflicts with them, say so and propose a safe alternative.
11. **Repository workflow (v3.1, amended sessions 4 and 8):** the project lives in a GitHub repo. The owner has asked for commits **directly to `main`** (no branches or PRs); keep `main` deployable. If the owner shares a scoped, short-lived access token for a session, use it per command (auth header), never write it into git config, remote URLs, or any committed file, and never put secrets in the repo. **Session 8 exception (owner's choice):** the 0.5-0.6 client port stays on branch `phase0/0.5-0.6-port` until the production cut-over, because it calls RPCs that exist only on staging and `main` must stay deployable. Never merge a branch whose own commit message says WIP.
12. **Never run lockdown (`005`) before the new client is deployed** (§11, Phase 0 cut-over runbook).

## 0.3 Status tracker (update every session)

Legend: ⬜ not started · 🟦 in progress · ✅ done · ⛔ blocked

| Phase | Name | Status | Notes | Last updated |
|---|---|---|---|---|
| Planning | Requirements & decisions | ✅ | PRD v3.2 complete (§9-14, Appendices A-D; review fixes and v3.2 flexibility changes in §14.3). Open items in §14.1 are non-blocking for Phase 0 | 2 Oct 2026 |
| 0 | Foundation (security, courses, modular refactor) | 🟦 | 0.0 baseline on `main` ✅. 0.1 core migrations `000`-`002` ✅ (run on staging by the owner, session 5). 0.2 `003_roster_rpcs` ✅ (run on staging by the owner, session 5). 0.3 `004_public_access` ✅ (run on staging by the owner, session 6, ran successfully). 0.4 modular client ✅ (session 7: `index.html` split into `css/base.css` + `js/*.js`, vendored `supabase-js` 2.117.2, `js/config.js`; behavior verified identical to the original in jsdom; **owner still to do the AC-0.12 screenshot comparison in a real browser**). 0.5 teacher features + 0.6 public views **built and verified in jsdom (85 assertions) on branch `phase0/0.5-0.6-port`, NOT on `main`** (session 8; the client calls RPCs that exist only on staging). 0.7 (session 9): `005_security_lockdown`, its test and `tests/tools/anon_probe.mjs` **authored and verified on a local Postgres 16 + PostgREST 16.4, not yet run on staging**. 0.7 staging (session 10): owner reports **`005` ran successfully on staging and the walkthrough worked** (screenshots on `localhost:8000`, STAGING badge; lockdown test and anon-probe output not yet pasted). `migrations/rollback/reverse_sync.sql` **written and tested** (session 10). Remaining Phase 0: owner pastes lockdown-test + anon-probe output, `sync_legacy_students` fix applied (v3.9 item 2), cut-over checklist `docs/CUTOVER.md` written, AC-0.12 screenshots, production cut-over (0.8). **Session 11 (5 Oct 2026): owner reports the production cut-over (0.8) is done and everything works.** Not independently verified by the assistant (no access to Supabase or the live site from its sandbox); step-level results (smoke test, `005` message, anon probe exit code, PIN change) were not pasted. `main` = `phase0/0.5-0.6-port` = `72bcdf8` at session start | 5 Oct 2026 |
| 1 | Exam builder (versions, sections, questions) | ⬜ | | |
| 2 | Codes & taking the exam | ⬜ | | |
| 3 | Marking, scoring & leaderboard | ⬜ | | |
| 4 | Certificates | ⬜ | Needs institution defaults entered (logo, signatory, wording); per-course overrides optional | |
| 5 | Polish | ⬜ | | |

**Current task pointer:** *Phase 0 task 0.8 (production cut-over) reported done by the owner (session 11). Remaining Phase 0 close-out, per `docs/CUTOVER.md` section C: confirm the anon probe on production exited 0 and the PIN was changed; revoke the GitHub token; owner phone check of a real score save + student add; staging lockdown test + anon probe output; re-run `001` on staging; AC-0.12 screenshots; local test suites. **After 7 days of no problems (about 12 Oct 2026 if the cut-over was 5 Oct): take a backup, then run `migrations/006_drop_legacy.sql`** (irreversible; disables `reverse_sync.sql`). Then mark Phase 0 ✅ and start Phase 1 (exam builder, §11).*

## 0.4 Session log (append-only)

| # | Date | Summary | Files produced | Next step |
|---|---|---|---|---|
| 1 | 2 Oct 2026 | Reviewed existing app. Ran requirements discussion. Produced plan v1, v2, and this PRD | `exam-system-plan.md`, `exam-system-plan-v2.md`, `PRD.md` | Owner reviews PRD, answers §14 items, approves start of Phase 0 |
| 2 | 2 Oct 2026 | Read all uploads; verified GitHub access; owner chose staging project + defaults; completed PRD (§9-14, Appendices A-D); fixed migration numbering, Phase-0 `recompute_result`, `read_students` policy | `PRD.md` (v3.1) | Owner reviews v3.1, answers O-4/O-7/O-8 when convenient, approves Phase 0 start |
| 3 | 2 Oct 2026 | Owner asked that everything be configurable and a new course creatable any time. Audited the plan; added per-course unit label, lesson mode, eligibility rule, per-course certificate settings with institution defaults, create-course-from-existing, and a system-parameters table | `PRD.md` (v3.2) | Owner reviews v3.2, agrees Netlify (D-36), creates staging project, approves Phase 0 start |
| 4 | 2 Oct 2026 | Read PRD and `index.html`; baseline commit to `main` (task 0.0); wrote `000`-`002` plus local SQL tests and runner (task 0.1). Found and fixed three defects in the v3.2 reference SQL (see §14.3, v3.3) | `migrations/000-002`, `tests/sql/phase0_core.test.sql`, `tests/tools/*`, this PRD (v3.3) | Owner runs `000`-`002` on staging and pastes output; then task 0.2 |
| 5 | 2 Oct 2026 | Owner confirmed `000`-`002` ran on staging. Wrote `003`: 12 course/roster/score RPCs, Phase-0 `recompute_result`, triggers, backfill. 167 assertion lines in the roster test file (plus a parallel S/N test) written; they caught one defect (see §14.3, v3.4). Owner ran `003` on staging; pasting the psql-only test into the SQL editor failed on `\set`, so the newer tests were made meta-command-free. Then task 0.3: wrote `004` (realtime publication + inert read policies) and found the PRD's `read_students` policy fails (see v3.5). Fixed `tests/README.md` | `migrations/003_roster_rpcs.sql`, `tests/sql/phase0_roster.test.sql`, `tests/tools/concurrency_sn.sh`, `migrations/004_public_access.sql`, `tests/sql/phase0_public_access.test.sql`, `tests/README.md`, this PRD (v3.5) | Owner applies `004` on staging and pastes output; then task 0.4 |
| 6 | 2 Oct 2026 | Read the repo and PRD; owner confirmed `004` ran successfully on staging. Updated tracker and pointer | `docs/PRD.md` | Agree the task 0.4 plan, then implement |
| 7 | 2 Oct 2026 | Read repo and PRD; agreed the task 0.4 plan; owner confirmed the project hard-coded in `index.html` is **production** and supplied the staging URL and publishable key. Task 0.4: split the inline `<style>` and `<script>` into `css/base.css` and `js/{config,api,state,ui,portal,scores,auth,roster,main}.js` with an AST-based splitter (no hand retyping); shared `let` variables became one exported `state` object (ES modules cannot reassign imported bindings); vendored `supabase-js` 2.117.2; `config.js` selects the environment (deviation recorded in v3.6); staging badge. Verified in jsdom with a fake PostgREST backend: original script vs new modules gave **byte-identical** results over a 35-step scripted session (all DOM snapshots, every network request, final data), plus ESLint `no-undef` clean. No real browser was available | `css/base.css`, `js/*.js`, `vendor/*`, `index.html` (now a shell), this PRD (v3.6) | Owner: AC-0.12 screenshots in a real browser, answer O-10; then agree the task 0.5 plan |
| 8 | 2 Oct 2026 | Read repo and PRD. **Found `main` broken:** PR #3 (a WIP checkpoint whose own message said not to merge) had landed a half-ported client; ES modules failed to load (12 missing exports). With the owner's go-ahead reverted it on `main` (`63a592b`, tree identical to the 0.4 commit; WIP kept at `ddf676f`). Agreed the port plan; owner chose to hold the finished port on a branch until production has `000`-`004`. Tasks 0.5+0.6: completed the RPC data layer (`api.js` `rpc()` + error map, `data.js`) and ported `auth`, `roster`, `scores`, `portal`, `main`; new `courses.js`. Verified in jsdom against an in-memory fake of the REST/RPC API (85 assertions) plus ESLint `no-undef`. No real browser, no real Postgres, no live Realtime | `js/*.js` (new/changed: api, config, data, state, ui, auth, roster, scores, portal, main, courses), `index.html`, `css/base.css`, `tests/client/*`, this PRD (v3.7) | Owner: staging walkthrough of branch `phase0/0.5-0.6-port`, AC-0.12 screenshots, O-10; then task 0.7 (`005`, anon-probe) |
| 9 | 2 Oct 2026 | Read repo and PRD with a short-lived scoped token (per-command auth header; remote URL stays token-free). Re-verified the branch: `tests/client` 85/85, local SQL suite green. Task 0.7 authoring: **`005_security_lockdown`** (§8.3 plus preflight, post-conditions read back from the catalog, rollback of the whole transaction on any failure, idempotent; locks unexpected extra public tables too; removes default grants for future objects; deletes the plaintext PIN row); **`phase0_lockdown.test.sql`** (what anon cannot do, and the entire teacher workflow executed *as anon* under RLS); **`anon_probe.mjs`** (Appendix C.1, zero dependencies, cannot change data). Verified against a real PostgREST: locked DB 82 pass / 0 fail; unlocked DB fails on exactly the legacy `students`/`app_settings` writes, the readable PIN, inactive enrollments and extra surface; data byte-identical after probing. Three defects found in my own test tooling (§14.3, v3.8) | `migrations/005_security_lockdown.sql`, `tests/sql/phase0_lockdown.test.sql`, `tests/tools/anon_probe.mjs`, `tests/tools/supabase_shim.sql`, `tests/tools/run_local_tests.sh`, `tests/sql/phase0_public_access.test.sql`, `tests/README.md`, this PRD (v3.8) | Owner: staging walkthrough, then `005` + lockdown test + probe on staging and paste output; assistant: `reverse_sync.sql` |
| 10 | 2 Oct 2026 | Read repo and PRD with a short-lived scoped token (per-command auth header). Owner reported `005` ran successfully on staging and the walkthrough worked (screenshots reviewed: staging badge, course settings, Arabic name, scores; course shown as archived). Authored **`migrations/rollback/reverse_sync.sql`** (ADAB `enrollments` back into legacy `students`; one atomic DO block; refuses after `005`, if ADAB settings differ from what the old client hard-codes, or on malformed arrays; reads back its own result) and **`tests/tools/reverse_sync_roundtrip.sh`** (own throwaway DB at the pre-`005` state; 17 checks: copy, idempotence, round trip, other-course student untouched, both refusals). The round trip exposed a hazard in the forward copy (v3.9 item 2). Local Postgres 16 installed in the session container; full local suite re-run green | `migrations/rollback/reverse_sync.sql`, `tests/tools/reverse_sync_roundtrip.sh`, `tests/tools/run_local_tests.sh`, `tests/README.md`, `migrations/001_courses_enrollments.sql` (sync fix), `docs/CUTOVER.md`, this PRD (v3.9) | Owner: section A of `docs/CUTOVER.md`; assistant: run section B with the owner |
| 11 | 5 Oct 2026 | Read repo and PRD with a short-lived scoped token (per-command auth header). Noticed `main` and `phase0/0.5-0.6-port` were both at `72bcdf8` (the runbook expected the branch to be merged only at step 5) and flagged the deploy risk. Owner then reported the production cut-over finished and everything works. No code or migration changes this session; tracker and pointer updated from the owner's report | `docs/PRD.md` | Owner: section C of `docs/CUTOVER.md`, then `006` after 7 quiet days; assistant: verify `006` preconditions with the owner, then plan Phase 1 |

## 0.5 Conventions in this document
- **IDs:** `D-xx` decisions, `FR-xx` functional requirements, `NFR-xx` non-functional, `AC-x.y` acceptance criteria, `E_XXX` error codes.
- **MUST / SHOULD / MAY** follow their usual RFC meaning.
- **✅ Confirmed** = owner chose it. **🟡 Proposed** = assistant default, changeable.
- Code samples are **reference implementations**: validate on a copy of the database before production.

## 0.6 Starter prompt for a new chat
> You are continuing development of the Ma'had Miftah al-'Ilm Score Portal. The attached `PRD.md` is the single source of truth. Read §0, §3, §4 and the section for the phase named in the tracker. Do not re-ask any ✅ decision. The tracker says we are at **[phase/task]**. Confirm that with me in one sentence, then propose a short plan for the next task before implementing. Deliver complete files and update the tracker and session log in the PRD when we finish. I will attach the current project files.

---

# 1. Product Overview

## 1.1 Background
The Score Portal is a static, single-page app for one madrasa course. It lets visitors browse students and scores, see a leaderboard and a full score sheet, and lets a teacher (shared PIN) enter daily scores and manage students. Data lives in Supabase.

## 1.2 What we are building
1. **Courses** as a first-class concept. A student can be enrolled in several courses, including concurrently. The first course is **الآداب العشرة | Al-Aadaab Al-Asharah**. Courses are **continuously open** (rolling enrollment).
2. **An exam per course**, always available to eligible students. Eligible students (per the course's eligibility rule, D-42; by default all lessons marked) receive a unique **exam code** from the teacher and sit one timed attempt. MCQ and fill-in-the-blank are auto-marked. Essays are marked by the teacher.
3. **A combined score** (lessons + exam, teacher-configurable split) driving a continuously updated leaderboard of students with fully marked exams.
4. **Certificates** prepared automatically when a student passes, released after teacher approval, publicly verifiable.
5. **A security foundation:** server-verified teacher authentication, locked-down tables, and server-side marking so answer keys never reach the browser.

## 1.3 Goals
- G1. Students can sit the exam reliably on a phone, in Arabic and English, even with an unstable connection.
- G2. No student can read answer keys, forge marks, or skip the code check using browser tools.
- G3. The teacher can author, version, and publish an exam, issue codes, mark essays, and approve certificates without touching the database.
- G4. Existing scores, students, and look-and-feel are preserved.

## 1.4 Non-goals (v1)
Individual teacher accounts · student passwords/accounts · multiple exams per course · question pools/randomized selection · proctoring/camera · push notifications · server-generated PDFs · payments · hosting lesson content · attempt time-extension accommodations (backlog, §13).

## 1.5 Users

| Persona | Needs | Context |
|---|---|---|
| **Student** | Find themselves, see scores, sit the exam with a code, see results/review, get certificate | Mostly phone, possibly unstable connection, reads Arabic and English |
| **Teacher / Admin** | Manage roster, scores, exam content, codes, marking, certificates | Shared PIN, phone or laptop, multiple teachers may share it |
| **Public visitor / verifier** | Browse portal, verify a certificate's authenticity | Anonymous |

## 1.6 Success criteria
- A student with a valid code can complete the exam, lose connectivity for up to several minutes mid-exam, and lose no more than the last few seconds of work.
- Using only the public API key, it is **impossible** to read `question_keys`, write to any table, or read another student's answers (verified by SQL tests, AC-0.x).
- Leaderboard updates within ~5 seconds of an exam being fully marked.
- The teacher can mark an essay question for ~50 students in a single continuous flow ("by question" view).
- Existing Score Portal looks and behaves identically after Phase 0.

---

# 2. Glossary

| Term | Meaning |
|---|---|
| **Course** | A programme of lessons, one exam, and a certificate, with its own settings and roster |
| **Student** | A person (one row), regardless of how many courses they join |
| **Enrollment** | A student's participation in one course. Holds lesson scores and S/N for that course |
| **Lesson unit** (schema name: *day*) | One scored lesson unit. Default 10 per course, each 0-10, plus optional "bonus units". Its display name ("Day", "Week", "Lesson"…) is the course's `unit_label` (D-41). A course may also have **no** lesson units (`lesson_mode = none`, D-42) |
| **Eligibility rule** | Per-course rule deciding who may sit the exam: `all_units` (every unit marked), `teacher_approved` (teacher flags each student), or `open` (every active enrollee; the code is the gate) |
| **Institution settings** | Defaults shared by all courses (institution name, certificate title/signatory/logo, certificate number prefix). Courses may override the certificate parts (D-43) |
| **Exam** | The single exam of a course. Its content lives in **versions** |
| **Exam version** | An immutable-ish snapshot of exam content: `draft` → `live` → `retired`. One live at a time |
| **Section** | A group of questions with one format and one weight (% of the exam) |
| **Question value** | `section weight ÷ number of questions in the section` (computed) |
| **Exam code** | Secret issued to one enrollment to start the exam; also the student's credential for results/review/certificate |
| **Attempt** | A student's single sitting, pinned to the exam version they started on |
| **Fully marked / finalized** | Attempt with every auto question graded and every non-empty essay scored by the teacher |
| **Final score** | Combined lesson + exam score (§5.4) |
| **Grade band** | Label (e.g. "Excellent") from configurable score thresholds |
| **Certificate snapshot** | Frozen copy of the result stored at approval time |
| **Teacher session token** | Short-lived random token returned by server-side PIN verification |
| **RPC** | A Postgres function called through Supabase (`sb.rpc(...)`) |
| **Mushrif (المشرف)** | The signatory's title: supervisor |

---

# 3. Current State (As-Is)

*Derived from reading the uploaded `index.html` (1,009 lines, ≈54 KB). Keep this section accurate while migrating.*

## 3.1 Technology
- Single file `index.html`: HTML + CSS + one `<script type="module">`. Vanilla JS, **no framework, no build step**.
- Supabase JS v2 loaded from `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`.
- Supabase project URL: `https://vnqgxopexirycynuybyc.supabase.co`. The **publishable (anon) key is embedded in the source** (public by design). The `service_role` key MUST NEVER be placed in the client.
- Fonts: Google Fonts `Amiri` (Arabic/serif display) and `Inter` (UI).
- **Since task 0.4 (v3.6)** the code is no longer one file: `index.html` is a shell that links `css/base.css` and loads `js/main.js` (ES modules, no inline script). `supabase-js` is vendored at 2.117.2 (`vendor/`), not loaded from the CDN. On `main` behavior, data access (direct `sb.from(...)` calls) and the client-side PIN check are still the 0.4 versions; branch `phase0/0.5-0.6-port` (v3.7) replaces them with RPCs and server login. The URL and key above are now the `production` entry in `js/config.js`.

## 3.2 Database (inferred from code)

| Table | Columns | Notes |
|---|---|---|
| `students` | `id` text (e.g. `'s12'`, = `'s' + sn`), `sn` int, `name` text, `days` int[10], `bonus_units` int[10], `active` bool | `-1` in arrays means "unset". `days` unset → `null` in app. Bonus unset → treated as 0 |
| `app_settings` | `key` text, `value` text | Row `teacher_pin` holds the PIN **in plaintext, readable by the public key**. App falls back to `"2026"` |

- **Realtime:** channel `students-changes` listens to `postgres_changes` (`*`) on `students`; any event reloads all students.
- **No Row-Level Security protections** are evident: the public key reads and writes tables directly.

## 3.3 Constants and scoring
```
DAY_COUNT = 10        DAY_MAX = 10        BONUS_UNIT_VALUE = 2        MAX_TOTAL = 100
total = min(100, sum(days that are numbers) + sum(bonusUnits) * 2)
```

## 3.4 UI structure
- **Header:** Bismillah (Amiri), Arabic title `معهد مفتاح العلم`, subtitle "Ma'had Miftah al-'Ilm • Score Portal", and a "Teacher" pill (top right) that toggles teacher mode.
- **Tabs (`#navTabs`):** `directory` · `leaderboard` · `overview` (labelled "Full Sheet") · `manage` (hidden until teacher unlock, labelled "Manage Students").
- **Directory:** search box + student cards (name, S/N, `total / 100`). Clicking opens a **score modal** (Day 1-10 grid with bonus shown as `+N`, total). If teacher is unlocked, the modal shows an "Edit scores" button.
- **Leaderboard:** active students sorted by `total` desc, top-3 medals, **no tie handling**.
- **Full Sheet:** table of S/N, Name, Day 1-10, Bonus, Total.
- **Teacher mode:** header pill and Manage tab. Unlock state is `sessionStorage['mahad_teacher_unlocked'] = '1'` (a **boolean flag only, no token**). PIN compared in the browser against the fetched `teacher_pin`.
- **Score editor (modal):** pick a day (10 dots, filled when scored) → form (score 0-10 integer, bonus units integer ≥ 0) → "Save Day N". Saves by updating the whole `days` and `bonus_units` arrays directly.
- **Manage Students panel:** collapsible sections: *Add a student* (id = `'s'+nextSN()`), *Bulk seed students* (one name per line, skips existing names case-insensitively, logs progress), *Change teacher PIN* (client-side check). Below: entry list with per-student rename (inline), activate/deactivate, delete (confirm overlay, hard delete).
- **Public views show only `active` students.** Manage shows all.

## 3.5 Known quirks (fix during Phase 0)
1. Full Sheet "Bonus" column prints the raw bonus **array** (`${s.bonusUnits}`) instead of a number. Fix: show total bonus points.
2. Leaderboard has no tie handling. Fix: tied scores share rank (D-26).
3. `nextSN()` is `max(sn)+1` computed client-side, a race condition if two teachers add students simultaneously. Fix: assign S/N in the database inside the RPC.
4. PIN stored in plaintext and readable by anyone. Fix: §6.
5. Hard delete removes all of a student's scores with only a confirm dialog. Keep the confirm, but block deletion when a certificate exists (FR-R6).

## 3.6 Design tokens (must be preserved)
```
--bg-warm #FBF9F5   --card-bg #FFFFFF   --emerald-dark #0F4C3A   --emerald-light #1A6B53
--gold-ochre #C59849   --gold-soft #F6EFE0   --text-dark #1C2826   --text-muted #6B7280
--border-color #E6E1D5   --radius 12px   --danger #B3261E   --danger-soft #FBEAE9
```
Dark mode via `@media (prefers-color-scheme: dark)` on `:root:not([data-theme="light"])` and explicit `:root[data-theme="dark"]`.
Reusable classes: `.tab-btn`, `.student-card`, `.leader-item`, `.table-wrapper`, `.modal-overlay` / `.modal-content`, `.confirm-overlay`, `.save-btn`, `.ghost-btn`, `.danger-btn`, `.save-hint` (`.ok` / `.err`), `.status-banner` (`.error`), `.empty-state`, `.teacher-panel`, `.panel-section`, `.menu-toggle`, `.lock-notice`, `svg.icon` (inline SVG icons, 18px, stroke 1.8).
Helpers: `escapeHtml`, `escapeAttr`, `showStatus(msg, isError)`, `clearStatus()`.

---

# 4. Decisions Log

## 4.1 Locked decisions

| ID | Decision | Status |
|---|---|---|
| D-01 | **Course-based, not semester-based.** A certificate is issued per course | ✅ |
| D-02 | Courses are **continuously open**: rolling enrollment, no "completed" state, **no score locking** | ✅ |
| D-03 | A student may be enrolled in **several courses, including concurrently** | ✅ |
| D-04 | First course: **الآداب العشرة / Al-Aadaab Al-Asharah**. Short code `ADAB` | ✅ name · ✅ code (D-40) |
| D-05 | **One exam per course**, rewritten over time through **versions** | ✅ |
| D-06 | The exam is **always open**: an eligible student with a valid code can sit it any time. No sessions, no open/close, no pause | ✅ |
| D-07 | **Editing a live exam is versioned**: structural/key/weight changes create a new version; past attempts keep the version they took. Typo fixes may be patched in place; a wrong key may be corrected with explicit re-grade | ✅ versioned · 🟡 patch details |
| D-08 | Teacher auth: **shared PIN, verified on the server** (hashed, throttled, session token). A strong passphrase is recommended over `2026` | ✅ · 🟡 recommendation |
| D-09 | No per-teacher accountability (marking/approval not attributed to individuals) | ✅ |
| D-10 | Students identify with **name + code**, with **per-student lockout** | ✅ · 🟡 limits (5 failures → 10 min) |
| D-11 | Codes are issued **per eligible student**; teacher can generate, bulk-generate, regenerate (old revoked), print slips. Stored **hashed**, shown **once**. Stay valid for results/review/certificate after use. Regenerating does **not** grant a re-sit | 🟡 |
| D-12 | **Default eligibility** = every lesson unit of the enrollment has a recorded score (bonus irrelevant). Other rules per course: see D-42 | ✅ default |
| D-13 | Formats v1: **MCQ (single or multiple correct), fill-in-the-blank, essay**; plus **True/False** (as a 2-option MCQ) | ✅ MCQ/fill/essay · 🟡 T/F |
| D-14 | **Section weight splits equally across its questions** | ✅ |
| D-15 | Multi-answer MCQ: **partial credit, 1:1 penalty**, floored at 0 (§5.2) | ✅ |
| D-16 | Fill-in: auto-match against accepted answers with **Arabic/English normalization**; teacher review queue that can add accepted answers and re-grade | 🟡 |
| D-17 | Essays: teacher gives a **score (0 to question value) + optional comment**, per question | ✅ |
| D-18 | **One overall time limit** for the exam, configurable per exam version | ✅ |
| D-19 | **Shuffle options only** (per attempt, seeded). Question order fixed | ✅ |
| D-20 | **Log tab-leave events**, shown to the teacher, **no penalty** | ✅ |
| D-21 | Student sees results **immediately after submission**; essays show "pending" | ✅ |
| D-22 | **Correct answers revealed to each student after their own exam is fully marked.** Course-level toggle to disable | ✅ · 🟡 toggle |
| D-23 | **Combined score** = lessons and exam with a **teacher-configurable split** | ✅ |
| D-24 | **Single pass mark** on the combined score, configurable | ✅ |
| D-25 | **Leaderboard lists only students whose exam is fully marked**, updated continuously. While a course has no live exam, it shows the lesson ranking as today | ✅ first part · 🟡 second |
| D-26 | Tied scores **share a rank** (1, 2, 2, 4) | 🟡 |
| D-27 | Content language: **Arabic and English mixed** within an exam. Auto direction per element | ✅ · 🟡 mechanism |
| D-28 | Certificates **auto-prepared on pass; teacher approves** before release. Numbering `{PREFIX}-{COURSECODE}-{YEAR}-{SEQ4}` (prefix `MMI` by default, institution setting, D-43). **Snapshot** stored at approval. **Public verification** by number | ✅ flow · 🟡 rest |
| D-29 | **Grade bands configurable** per course. Defaults: Excellent ≥ 90, Very Good ≥ 80, Good ≥ 70, Pass ≥ pass mark | ✅ configurable · 🟡 defaults |
| D-30 | Separate **Arabic name field** (`name_ar`) on students, used on certificates | ✅ |
| D-31 | **Institution-default** signatory: **Musa Aminu Muhammad, Mushrif (المشرف)**. Arabic spelling proposed: **موسى أمينو محمد**. Logo file exists. Individual courses may override (D-43) | ✅ name/title/logo · 🟡 Arabic spelling |
| D-32 | Hosting **Netlify or Vercel** (static). **No build step**: ES modules served as static files | ✅ hosting · 🟡 no build |
| D-33 | **Privacy:** public sees final score + band + certificate status. Exam breakdown, answers, comments visible only to the student (via name + code) and the teacher | 🟡 |
| D-34 | UI language stays **English**; Arabic content supported; visual identity unchanged | 🟡 |
| D-35 | Archived course: hidden from the main switcher (shown under "Archived"), no new enrollments/codes, existing results and certificate verification remain valid | 🟡 |
| D-36 | **Hosting: Netlify** (static, no build). `main` = production, every PR gets a deploy preview. Vercel remains an equivalent alternative | 🟡 recommended by assistant, awaiting owner agreement |
| D-37 | **Two Supabase projects: staging and production.** Environment chosen by hostname in `js/config.js`; previews and localhost always use staging | ✅ staging project (owner) · 🟡 mechanism |
| D-38 | ~~Work in pull requests from short-lived branches~~ **Owner override (session 4): commit and push directly to `main`; no branches/PRs.** SQL is still delivered as numbered migration files in `/migrations/`; the owner runs them (staging first). Because `main` is production, SQL migrations are NOT auto-applied: only the owner applies them | ✅ (session 4) |
| D-39 | **Vendor pinned `supabase-js`** (and the QR library) under `/vendor` instead of loading a floating CDN version | 🟡 |
| D-40 | **First-course defaults accepted:** short code `ADAB`, split 50/50, pass mark 60%, exam duration 60 min, bands Excellent ≥ 90 / Very Good ≥ 80 / Good ≥ 70 / Pass ≥ pass mark | ✅ (session 2) |
| D-41 | **Unit label per course:** each course names its lesson unit (`unit_label`, default "Day", optional Arabic label). All UI text ("Day 3", "Full Sheet" headers, score editor) uses it | ✅ (session 3) |
| D-42 | **Lesson mode and eligibility are per-course settings.** `lesson_mode`: `scored` or `none` (exam-only course; weights fixed 0/100, so final = exam %). `eligibility_rule`: `all_units`, `teacher_approved`, or `open`. `lesson_mode` locks once any score or attempt exists (create a new course instead) | ✅ modes asked · 🟡 `open` rule and lock |
| D-43 | **Per-course certificate settings with institution defaults.** Resolution per field: course value → institution default → built-in constant. Settings: title, wording (EN/AR, placeholders), signatory block, signature image, logo, number prefix (institution only). Resolved values are frozen in the snapshot at approval | ✅ (session 3) · 🟡 details |
| D-44 | **Create course from existing:** copies settings (scoring, bands, certificate settings) and, optionally, the exam as a new **draft**; never copies roster, scores, codes, attempts, or certificates | ✅ (session 3) |
| D-45 | **System parameters** (lockout thresholds, session length, grace period, code length, bulk chunk size, input limits) live in `private.system_params`, read through `private.param(key, default)`. Editable by SQL in v1; a settings screen is backlog | ✅ centralised · 🟡 SQL-only editing |

## 4.2 Superseded decisions (history, do not implement)
| Earlier answer | Replaced by |
|---|---|
| "Reveal answers after the teacher closes the exam" | D-22 (exam never closes) |
| "Hide leaderboard until results are published" | D-25 (continuous, per fully-marked student) |
| "Lesson ranking until the exam opens, then hidden" | D-25 (exam is always open once a version is live) |
| Course lifecycle `draft/active/completed/archived` with score locking | D-02, D-35 (`active` / `archived` only) |
| Exam `draft/open/closed` | D-05/D-06 (versions: `draft/live/retired`) |
| Certificate status `eligible` stored in DB | "Eligible" is **derived** (passed + finalized + no certificate row); stored statuses are `approved` / `revoked` only |

---

# 5. Business Rules & Formulas

## 5.1 Lesson score (per enrollment)
```
daySum    = sum of recorded day scores (unset days count as 0)
bonusSum  = sum of bonus units × course.bonus_unit_value
lesson    = min(course.lesson_max, daySum + bonusSum)
lesson%   = lesson ÷ course.lesson_max × 100
```
Defaults reproduce today's behavior: `day_count=10`, `day_max=10`, `bonus_unit_value=2`, `lesson_max=100`.
If `lesson_mode = none` there is no lesson part: `lesson%` is null, `weight_lessons = 0`, `weight_exam = 100`, and `final = exam%`.

## 5.2 Exam scoring
**Question value** (computed, never stored):
```
value(q) = section.weight ÷ count(questions in q's section)        // exam total = 100
```
Section weights MUST sum to **100** (±0.001) for a version to be published. Marks are stored as a **fraction 0-1** of the question's value; points are derived (`fraction × value`). Rounding is for **display only** (1-2 decimals).

**MCQ (single and multi), 1:1 penalty:**
```
fraction = max(0, (correct_picks − wrong_picks) ÷ number_of_correct_options)
```
Single-answer MCQ and True/False use the same formula (n = 1). A blank answer = 0.

**Fill in the blank:** `fraction = 1` if the normalized response equals any normalized accepted answer (and is non-empty), else `0`. Normalization in §7.3.

**Essay:** `fraction = points ÷ value(q)`, set by the teacher; `points` clamped to `[0, value(q)]`. An **empty** essay is auto-marked 0 and does not block finalization.

**Exam %** = `Σ fraction × value ÷ 100 × 100` for the attempt's own version.

## 5.3 Attempt lifecycle
```
(none) --start--> in_progress --submit/deadline--> submitted --all marked--> finalized
                                                      |  (no manual items pending → immediately finalized)
reset by teacher: current attempt becomes superseded=true; student may start one new attempt
```
- **One non-superseded attempt per enrollment**, across all exam versions.
- `deadline_at = started_at + version.duration_minutes`. Answers received up to `deadline_at + 15 s` grace are accepted; later ones rejected.
- Expired in-progress attempts are auto-submitted (lazily on any access and by a scheduled sweep).

## 5.4 Combined score, pass, band
```
final   = lesson% × weight_lessons/100  +  exam% × weight_exam/100        // weights sum to 100
passed  = final ≥ pass_mark
band    = highest grade_band with min ≤ final   (only meaningful if passed; else none)
```
Example: lessons 86/100, exam 72, split 50/50 → **79.0**. Split 60/40 → 51.6 + 28.8 = **80.4**.

## 5.5 Result states (per enrollment)
| State | Condition | Leaderboard? |
|---|---|---|
| `not_eligible` | The course's eligibility rule is not met (a lesson unit unset, or not teacher-approved) | Only in lesson-ranking mode |
| `eligible` | Eligibility rule met, no attempt | No (exam mode) |
| `in_progress` / `submitted` | Attempt not finalized | No (exam mode) |
| `finalized` | Attempt fully marked | **Yes** |

**Leaderboard modes:** if `courses.exam_live = false` → **lesson mode** (today's behavior; for a `lesson_mode = none` course it shows only the empty-state note of FR-L3). If `exam_live = true` → **exam mode** (only `finalized` students, by `final` desc, ties share rank, with a note if none yet).

## 5.6 Certificates
- **Certificate-eligible** = `finalized AND passed AND no certificate row`.
- Approval creates a certificate row (`approved`) with number, verify code, and a **snapshot** (§6.8). Revocation sets `revoked`.
- Issued certificates are **never** affected by later changes to course settings, weights, pass mark, or exam versions.

---

# 6. Functional Requirements

## 6.1 Teacher authentication (FR-A)
| ID | Requirement |
|---|---|
| FR-A1 | Teacher mode MUST be unlocked by calling `teacher_login(pin)`. The PIN is verified **on the server** against a bcrypt hash |
| FR-A2 | Success returns a random session token (≥ 256 bits) with an expiry (default 8 h). The server stores only its SHA-256 hash |
| FR-A3 | Every admin RPC MUST take the token and reject missing, invalid, or expired tokens with `E_AUTH` |
| FR-A4 | Failed logins are throttled: 5 failures → locked for 5 minutes (global scope; optionally per-IP via `request.headers`). Message: "Too many attempts. Try again in N minutes." |
| FR-A5 | "Lock teacher mode" calls `teacher_logout` and deletes the session |
| FR-A6 | Teacher can change the PIN (requires current PIN via server). Minimum length 6 recommended (UI hint, server minimum 4) |
| FR-A7 | The plaintext PIN row MUST be removed from `app_settings`. The existing PIN value is hashed into the private secrets table first (migration `002`); the plaintext row is deleted by the lockdown migration `005`, because the live client reads it (and falls back to `2026` when it is missing) until the new client is deployed (v3.3) |
| FR-A8 | The token is kept in `sessionStorage` (never `localStorage`); closing the tab ends the session |

## 6.2 Courses (FR-C)
| ID | Requirement |
|---|---|
| FR-C1 | Teacher can create/edit a course: `code` (unique, `[A-Z0-9-]{2,12}`), `name`, `name_ar`, **`unit_label`** (1-30 chars, default `Day`) and optional `unit_label_ar`, **`lesson_mode`** (`scored` \| `none`), **`eligibility_rule`** (`all_units` \| `teacher_approved` \| `open`), `day_count` (1-60 when scored; 0 when `none`), `day_max` (≥1), `bonus_unit_value` (≥0), `lesson_max` (>0), `weight_lessons` + `weight_exam` (= 100; fixed at 0 / 100 when `lesson_mode = none`), `pass_mark` (0-100), `reveal_answers` (bool), `grade_bands`, and certificate settings (FR-V7). Creating a course is available at any time and needs no code change or migration |
| FR-C2 | Changing `day_count`, `day_max`, `bonus_unit_value`, `lesson_max`, weights, or pass mark when enrollments exist MUST show a confirmation stating how many students are affected, then **recompute all results** |
| FR-C3 | Changing `day_count` resizes every enrollment's `days`/`bonus_units` arrays (new entries unset/0; removed entries dropped, with an explicit warning). Certified students are unaffected (snapshots) |
| FR-C4 | Course can be **archived**/unarchived (D-35) |
| FR-C5 | A course switcher appears in the public portal when more than one non-archived course exists; selection is remembered in `sessionStorage` |
| FR-C6 | Grade bands editor: list of `{label, label_ar, min}`; validation: unique `min`, 0-100 |
| FR-C7 | **Create course from existing:** the New Course form offers *Blank* (defaults of D-40) or *Copy from <course>*. Copy takes all scoring settings, grade bands, `reveal_answers`, unit label, lesson mode, eligibility rule, and certificate settings; the teacher must give a new `code` and `name`. Optional checkbox **"Also copy the exam as a draft"** (appears once exams exist, Phase 1): the source's live version (or its draft if none is live) becomes a new **draft** with new ids in the new course, never live. **Never copied:** roster, scores, approvals, codes, attempts, answers, certificates, counters |
| FR-C8 | `lesson_mode` is **locked** once any enrollment in the course has a recorded unit score or any attempt exists (`E_VALIDATION`: "Lesson mode can't change after scoring has started. Create a new course instead."). `unit_label` is a display name and is always editable |
| FR-C9 | **Eligibility rules:** `all_units` = every unit of the enrollment marked; `teacher_approved` = teacher toggles *Approved for exam* per enrollment (`admin_set_exam_approval`); `open` = every active enrollment is eligible (issuing a code is the teacher's gate). Changing the rule shows a confirmation with the number of affected enrollments (FR-C2). Codes already issued and attempts in progress are unaffected. Choosing `lesson_mode = none` preselects `open` (the database forbids `all_units` without lesson units) |
| FR-C10 | **Unit labels everywhere:** every screen that says "Day N" uses the course's `unit_label` (English) and `unit_label_ar` when present. For `lesson_mode = none`, the score grid, score editor, Bonus column, and lesson badge are not rendered |

## 6.3 Roster & students (FR-R)
| ID | Requirement |
|---|---|
| FR-R1 | Teacher can add a student to a course: `name` (required), `name_ar` (optional). A new person row is created and enrolled. S/N = next per-course number, assigned **in the database** |
| FR-R2 | Teacher can **enroll an existing student** in another course (searchable list); the student gets a new per-course S/N |
| FR-R3 | **Bulk seed:** one student per line; optional Arabic name after `|` (e.g. `Ahmad Bello | أحمد بللو`). Existing names (case-insensitive, trimmed) in that course are skipped. Progress log retained |
| FR-R4 | Teacher can rename (EN and AR) and toggle **active** per enrollment. Inactive enrollments are hidden from public views and excluded from leaderboards, but kept in data |
| FR-R5 | Bulk **Arabic-name entry** screen: table of students missing `name_ar`, editable inline |
| FR-R6 | Hard **delete** of a student: confirm dialog (existing); **blocked** with a clear message if the student has any approved/revoked certificate |
| FR-R7 | Manual add warns (does not block) if the same name already exists in the course |

## 6.4 Lesson scores (FR-S)
| ID | Requirement |
|---|---|
| FR-S1 | Existing day-picker + per-day form is preserved: score integer `0..day_max` (blank = unset), bonus units integer ≥ 0 |
| FR-S2 | Saving calls `admin_save_day` (server validates ranges against the course) instead of overwriting arrays from the client |
| FR-S3 | Saving recomputes `enrollment_results` (lesson part and, if applicable, combined) |
| FR-S4 | A student whose lessons become incomplete after a code was issued can no longer **start** an exam; an in-progress attempt is unaffected |
| FR-S5 | When `lesson_mode = none`, no score editor is offered and `admin_save_day` returns `E_VALIDATION`. Roster rows instead show the eligibility control required by the course's rule (FR-C9) |

## 6.5 Exam builder (FR-X)
| ID | Requirement |
|---|---|
| FR-X1 | Each course has at most one exam, with versions `draft`/`live`/`retired`. At most one `draft` and one `live` at a time |
| FR-X2 | "New draft" copies the live version (or starts empty if none). Teacher edits the draft only |
| FR-X3 | Draft fields: title (EN/AR), instructions (EN/AR), `duration_minutes` (1-600) |
| FR-X4 | Sections: title (EN/AR), **format** (`mcq`, `tf`, `fill`, `essay`), **weight** (0-100), order. Live indicator of total weight and each question's computed value |
| FR-X5 | MCQ questions: prompt, 2-8 options (text), at least one **correct** flag, `multi_answer` determined by number of correct options (>1 ⇒ multi) |
| FR-X6 | T/F questions: prompt and a single correct choice (True/False) |
| FR-X7 | Fill-in questions: prompt (supports a `____` marker; otherwise the input appears below), list of **accepted answers**, optional "treat ة and ه as equal" |
| FR-X8 | Essay questions: prompt only (optional guidance note for the teacher) |
| FR-X9 | Prompts and options support **Arabic, English, and mixed text**; direction auto-detected on render (FR-T3). Plain text only in v1 (line breaks preserved), no HTML |
| FR-X10 | Reorder sections and questions (up/down controls; drag optional), duplicate question, delete question (draft only) |
| FR-X11 | **Preview as student** renders the draft exactly as the exam screen would, with no attempt created |
| FR-X12 | **Publish** validates (§7.7), makes the draft `live`, retires the previous live version, sets `courses.exam_live = true`. In-progress attempts keep their version |
| FR-X13 | **Typo patch** on a live/retired version: edit prompt/option **text** only (not keys, weights, structure) via `admin_patch_text` |
| FR-X14 | **Correct key & re-grade:** on a live/retired version, teacher may change a question's key and re-grade that version's auto-marked answers, after an explicit confirmation showing the number of affected attempts. Essay marks untouched |
| FR-X15 | Drafts use optimistic concurrency (`draft_rev`); a save based on a stale revision is rejected (`E_CONFLICT`) and the UI offers a reload |
| FR-X16 | Draft autosave (debounced ~2 s) with a visible "Saved ✓ / Saving… / Unsaved changes" indicator. Leaving with unsaved changes prompts |

## 6.6 Exam codes & eligibility (FR-K)
| ID | Requirement |
|---|---|
| FR-K1 | Teacher sees, per enrollment in a course, a status: **Not eligible** (reason by rule: *n/N {unit} marked* or *awaiting teacher approval*) · **Eligible (no code)** · **Code issued** · **In progress** · **Submitted (pending marking)** · **Marked** · **Locked** |
| FR-K2 | **Generate code** for one enrollment: allowed only if eligible and exam is live. Returns the plaintext code **once**; stores only a bcrypt hash |
| FR-K3 | **Bulk generate** for all eligible enrollments without an active code; returns a list `{sn, name, code}` for printing/copying. Plaintext is never retrievable afterwards |
| FR-K4 | **Regenerate:** creates a new code and revokes the old one immediately. Does **not** alter attempts or grant a re-sit |
| FR-K5 | **Print code slips:** printable sheet (cards) of name, S/N, course, code, and short instructions. Generated client-side from the one-time response |
| FR-K6 | **Reset attempt:** marks the current attempt superseded (kept for history), recomputes results, and allows one new attempt. Requires confirmation. Typically followed by regenerating the code |
| FR-K7 | **Clear lockout** for an enrollment |
| FR-K8 | Code format: 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L), displayed `XXXX-XXXX`. Input is case-insensitive, ignores spaces and hyphens |
| FR-K9 | Failed verification is counted **per enrollment**; 5 failures → locked 10 minutes; counter resets on success. Message does not reveal whether the name or the code was wrong |

## 6.6.1 Exam taking: student (FR-T)
| ID | Requirement |
|---|---|
| FR-T1 | **Entry:** Exam tab → (course, if more than one) → search/select **name** from enrolled active students → enter **code** → server checks (`exam_check`) |
| FR-T2 | **Instructions screen** shows title, duration, sections/questions count, instructions, rules, and a **Start** button. The timer starts at Start, not at login. If an attempt is already `in_progress` the button reads **Resume** and shows remaining time |
| FR-T3 | **Direction:** every prompt, option, and text input uses `dir="auto"`; Arabic content uses Amiri; mixed content renders correctly |
| FR-T4 | **Exam screen:** sticky header (timer, autosave state, section title), question area, Previous/Next, **question palette** (answered / unanswered / flagged), **flag for review**, section navigation |
| FR-T5 | **Autosave:** answers saved on change (debounced ~1.5 s) and by a periodic sync (~20 s); batch RPC. Failures queue locally (localStorage keyed by attempt id) and retry with backoff; visible "Offline: your answers are safe, reconnecting…" notice |
| FR-T6 | **Timer:** counts down using server time offset; warnings at 5 min and 1 min (announced via `aria-live`); at 0 the client calls `exam_submit`. Server enforces the deadline regardless of the client |
| FR-T7 | **Submit:** confirmation dialog showing unanswered count and flagged count; irreversible |
| FR-T8 | **Shuffled options** per attempt (server-side, seeded); reload keeps the same order. Client sends option **ids**, never positions |
| FR-T9 | **Tab-leave logging:** `visibilitychange`/`pagehide`/`blur` → `exam_log_event('left')`; return → `'returned'`. Not shown to the student, no penalty |
| FR-T10 | **Single active session per attempt:** a new login/resume issues a new attempt token and invalidates the old one; the old tab shows "This exam was opened elsewhere" |
| FR-T11 | **Result screen** (immediately after submit): per-section earned/possible for auto-marked sections; essay sections "Pending marking"; total marked **provisional** until finalized |
| FR-T12 | **Returning later:** name + code → status page: pending marking, or final exam score, final combined score, band, pass/fail, and **answer review** if allowed (D-22, FR-T13) |
| FR-T13 | **Answer review** (only when attempt is finalized AND `course.reveal_answers`): each question with the student's answer, correct answer, marks earned, essay comment |
| FR-T14 | **Certificate access:** when approved, the status page offers "View certificate" |
| FR-T15 | No exam content is exposed before Start. After submission the paper is not re-served except through the review (FR-T13) |

## 6.7 Marking (FR-M)
| ID | Requirement |
|---|---|
| FR-M1 | **Marking queue** per course with counts: essays awaiting marking, fill-in answers needing review |
| FR-M2 | **By-question view:** pick an essay question → list every submitted answer (student name, text, `dir="auto"`), input for points (0..value, step 0.25 default, decimals allowed), optional comment, **Save & next**. Shows progress "n of N marked" |
| FR-M3 | **By-student view:** open one attempt → all essay answers → mark each |
| FR-M4 | Saving a mark sets `fraction`, `marked_by='teacher'`, stores comment, and re-evaluates finalization → recompute result → leaderboard updates |
| FR-M5 | **Fill-in review:** for each fill question, list distinct unmatched answers with counts. "Accept" appends to accepted answers and **re-grades all attempts of that version** |
| FR-M6 | Teacher can **override** any auto-marked answer's fraction (with comment); override sets `marked_by='teacher'` |
| FR-M7 | **Results view:** table of enrollments with status, exam %, final, band, pass/fail, tab-leave count and total time away; CSV export; per-attempt detail |

## 6.8 Leaderboard & portal (FR-L / FR-P)
| ID | Requirement |
|---|---|
| FR-L1 | Leaderboard per selected course in the two modes of §5.5 (a `lesson_mode = none` course has no lesson mode) |
| FR-L2 | Exam mode lists: rank, name, final score (1 decimal), band label. Ties share rank |
| FR-L3 | Exam mode with no finalized students shows: "Rankings appear once students have completed the exam." |
| FR-L4 | Updates in near real time via `enrollment_results` realtime |
| FR-P1 | **Directory** card badge: shows `lesson / lesson_max` before results (omitted when `lesson_mode = none`); **final score + band** once finalized (D-33). Chip for status where useful ("Exam pending") |
| FR-P2 | **Student modal** (public) shows the lesson units grid (labelled with the course's unit label; omitted when `lesson_mode = none`) and, when finalized, final score + band + "Certificate issued" indicator. **No** exam breakdown (D-33) |
| FR-P3 | **Full Sheet** adds Exam % and Final columns (blank until finalized) and fixes the Bonus column (§3.5) |
| FR-P4 | All public views are course-scoped via the course switcher |

## 6.9 Certificates (FR-V)
| ID | Requirement |
|---|---|
| FR-V1 | Teacher's **Certificates** area lists certificate-eligible enrollments with name (EN/AR), final score, band, date finalized, and a flag if `name_ar` is missing |
| FR-V2 | **Approve** one or many. Server assigns number `{PREFIX}-{COURSECODE}-{YYYY}-{SEQ4}` (per course per year counter), a 10-char verify code, and the **snapshot** (§7.4). Approval is **blocked** if `name_ar` is missing (UI links to the Arabic-name editor) |
| FR-V3 | **Revoke** with a reason; verification shows "Revoked" |
| FR-V4 | **Student view:** after name + code, "View certificate" renders a print-ready A4 landscape certificate from the snapshot. Print/Save as PDF through the browser |
| FR-V5 | **Public verification:** `/verify/<number>` → `verify.html` calls `verify_certificate(number)` → shows name (EN/AR), course, issue date, band, status (Valid/Revoked). Nothing else |
| FR-V6 | Certificate content & layout: Appendix B |
| FR-V7 | **Per-course certificate settings** (all optional, stored in `courses.cert_settings`): `title`/`title_ar`, `wording`/`wording_ar` (placeholders `{name} {name_ar} {course} {course_ar} {score} {band} {band_ar} {date}`; plain text, ≤ 600 chars; unknown placeholders rejected), `signatory` block (`name`, `name_ar`, `title`, `title_ar`, **all four required if the block is present**; it overrides the institution signatory as a whole), `signature_image`, `logo`. Image values are relative repo paths matching `^assets/[A-Za-z0-9._-]+\.(png\|svg\|jpe?g\|webp)$` |
| FR-V8 | **Institution settings** (teacher, Institution sub-tab): institution name EN/AR, **certificate number prefix** (`[A-Z0-9]{2,8}`, default `MMI`), and certificate defaults of the same shape as FR-V7. **Resolution per field:** course value → institution default → built-in constant (Appendix B). At approval the resolved values are frozen into the snapshot |

## 6.10 Non-functional requirements (NFR)
| ID | Requirement |
|---|---|
| NFR-1 | **Performance:** initial portal load < 3 s on a typical mobile connection; exam screen interactions < 100 ms (local); autosave payloads small (changed answers only) |
| NFR-2 | **Scale assumptions:** ≤ 500 enrollments per course; ≤ 100 concurrent exam-takers; autosave ≈ 1 request / 20-30 s per student on average. Must run on Supabase free/pro tier |
| NFR-3 | **Browsers:** current Chrome/Edge/Firefox/Safari; Android Chrome and iOS Safari 15+ |
| NFR-4 | **Accessibility:** keyboard operable; visible focus; modal focus trap and Esc to close; WCAG AA contrast in light and dark; timer warnings via `aria-live="polite"`; RTL-correct text |
| NFR-5 | **Reliability:** no data loss on reload during an attempt; idempotent save/submit; double-submit safe |
| NFR-6 | **Security:** §8 |
| NFR-7 | **Privacy:** D-33. Tab-leave logs and answers visible to teacher only. No analytics/trackers |
| NFR-8 | **Observability:** client errors surface as friendly messages (error-code map §8.5); server errors raised with stable codes; no PII in logs |
| NFR-9 | **Data retention:** attempts, answers, events, certificates kept indefinitely unless the teacher deletes a student |
| NFR-10 | **Time:** all timestamps `timestamptz` (UTC). Display in the browser's local time |

---

# 7. Data Model & Server Logic

*All SQL below is **reference implementation**. Run on a copy/staging database first. File names indicate the intended migration order, **renumbered by phase in v3.1** (§11, Appendix D).*

## 7.1 Conventions
- **Two schemas.** `public` is exposed through the Supabase API and contains only **public-read portal tables** and **RPC functions**. `private` is **not exposed** and contains everything sensitive (exam content, keys, codes, attempts, answers, sessions, secrets, certificates). RLS is *also* enabled on `private` tables (defense in depth) with no policies.
- All RPCs are `SECURITY DEFINER`, owned by `postgres`, with `SET search_path = public, private, extensions`. Execute rights are revoked from everyone and granted only to the roles that need them (§8.3).
- Primary keys are `uuid` (`gen_random_uuid()`), except `students.id` which stays **text** (`'s' || number`) for backwards compatibility.
- Errors are raised with `raise exception using errcode = 'P0001', message = 'E_CODE', detail = '...'`. The client maps `error.message` to friendly text (§8.5).
- Timestamps are `timestamptz`.
- **Failures that must persist state are returned, not raised (v3.3).** A raised exception rolls back the whole RPC, including any counter update. So wrong-PIN / wrong-code paths update the throttle and **return** `{ok:false, error:'E_…', detail}`; only failures that write nothing raise. `api.js` converts `ok:false` results into `ApiError`. Applies to `teacher_login`, `teacher_change_pin`, and (Phase 2) `exam_check` / `exam_start` / `exam_get_result` / `exam_get_review` / `get_certificate`.
- `private.fail(code, detail)` coalesces a null detail to `''` (`RAISE ... DETAIL = NULL` is an error in Postgres).

## 7.2 Schema (reference DDL)

### Migration `000_setup.sql`
```sql
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.fail(p_code text, p_detail text default null)
returns void language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = p_detail;
end $$;
```

### Migration `001_courses_enrollments.sql`
```sql
create table public.courses (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[A-Z0-9-]{2,12}$'),
  name             text not null,
  name_ar          text,
  status           text not null default 'active' check (status in ('active','archived')),
  unit_label       text not null default 'Day' check (char_length(unit_label) between 1 and 30),   -- v3.2 (D-41)
  unit_label_ar    text,
  lesson_mode      text not null default 'scored' check (lesson_mode in ('scored','none')),         -- v3.2 (D-42)
  eligibility_rule text not null default 'all_units' check (eligibility_rule in ('all_units','teacher_approved','open')),
  day_count        int  not null default 10  check (day_count between 0 and 60),   -- 0 only when lesson_mode = 'none'
  day_max          int  not null default 10  check (day_max >= 1),
  bonus_unit_value numeric not null default 2 check (bonus_unit_value >= 0),
  lesson_max       numeric not null default 100 check (lesson_max > 0),
  weight_lessons   numeric not null default 50 check (weight_lessons between 0 and 100),
  weight_exam      numeric not null default 50 check (weight_exam between 0 and 100),
  pass_mark        numeric not null default 60 check (pass_mark between 0 and 100),
  reveal_answers   boolean not null default true,
  exam_live        boolean not null default false,
  cert_settings    jsonb not null default '{}'::jsonb,   -- v3.2 (D-43), shape in FR-V7
  grade_bands      jsonb not null default
    '[{"label":"Excellent","label_ar":"ممتاز","min":90},
      {"label":"Very Good","label_ar":"جيد جداً","min":80},
      {"label":"Good","label_ar":"جيد","min":70},
      {"label":"Pass","label_ar":"مقبول","min":60}]'::jsonb,
  created_at       timestamptz not null default now(),
  constraint weights_sum_100 check (weight_lessons + weight_exam = 100),
  constraint lesson_mode_scored check (lesson_mode = 'none' or day_count >= 1),
  constraint lesson_mode_none   check (lesson_mode = 'scored' or
    (day_count = 0 and weight_lessons = 0 and weight_exam = 100 and eligibility_rule <> 'all_units'))
);

alter table public.students add column if not exists name_ar text;

create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  student_id  text not null references public.students(id) on delete cascade,
  course_id   uuid not null references public.courses(id)  on delete cascade,
  sn          int  not null,
  days        int[] not null,            -- -1 = unset ('{}' when lesson_mode = 'none')
  bonus_units int[] not null,            -- -1 or 0 = none
  active      boolean not null default true,
  exam_approved    boolean not null default false,   -- v3.2: used when eligibility_rule = 'teacher_approved'
  exam_approved_at timestamptz,
  enrolled_at timestamptz not null default now(),
  unique (student_id, course_id),
  unique (course_id, sn)
);

create table public.enrollment_results (
  enrollment_id uuid primary key references public.enrollments(id) on delete cascade,
  course_id     uuid not null references public.courses(id) on delete cascade,
  status        text not null check (status in
                  ('not_eligible','eligible','in_progress','submitted','finalized')),
  lesson_pct    numeric,          -- null when lesson_mode = 'none'
  exam_pct      numeric,          -- null until finalized
  final         numeric,          -- null until finalized
  passed        boolean,
  band_label    text,
  band_label_ar text,
  has_certificate boolean not null default false,
  updated_at    timestamptz not null default now()
);

-- Seed the first course and copy existing data (adjust values if the owner changes them)
insert into public.courses (code, name, name_ar)
values ('ADAB', 'Al-Aadaab Al-Asharah', 'الآداب العشرة');

insert into public.enrollments (student_id, course_id, sn, days, bonus_units, active)
select s.id, (select id from public.courses where code = 'ADAB'),
       s.sn, s.days, s.bonus_units, s.active
from public.students s;
-- Keep legacy columns (days, bonus_units, sn, active) on students until Phase 0 is verified; then drop.
```

### v3.2 additions: institution settings and system parameters
```sql
-- in 000_setup.sql (after the private schema exists)
create table private.system_params (
  key text primary key, value numeric not null, note text,
  updated_at timestamptz not null default now()
);                                                   -- empty by default: built-in defaults apply
create or replace function private.param(p_key text, p_default numeric) returns numeric
language sql stable as $$
  select coalesce((select value from private.system_params where key = p_key), p_default)
$$;

-- in 001_courses_enrollments.sql
create table private.institution_settings (
  key text primary key, value jsonb not null, updated_at timestamptz not null default now()
);
insert into private.institution_settings(key, value) values
 ('institution',   '{"name":"Ma''had Miftah al-''Ilm","name_ar":"معهد مفتاح العلم"}'),
 ('number_prefix', '"MMI"'),
 ('certificate_defaults', '{"title":"Certificate of Completion","title_ar":"شهادة إتمام",
    "signatory":{"name":"Musa Aminu Muhammad","name_ar":"موسى أمينو محمد","title":"Mushrif","title_ar":"المشرف"}}')
on conflict (key) do nothing;
```
Reference SQL elsewhere in §7 shows literal limits (5 failures, 15 s, 8 h…). **Implement them through `private.param()`** (Appendix D.3 lists keys and defaults).

### Migration `002_auth.sql`
```sql
create table private.secrets (
  key text primary key, value text not null, updated_at timestamptz not null default now()
);
create table private.teacher_sessions (
  token_hash text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table private.auth_throttle (
  scope text primary key, failed_count int not null default 0,
  locked_until timestamptz, updated_at timestamptz not null default now()
);

-- Move the existing PIN: hash it, then delete the plaintext row.
insert into private.secrets (key, value)
select 'teacher_pin_hash', extensions.crypt(value, extensions.gen_salt('bf'))
from public.app_settings where key = 'teacher_pin'
on conflict (key) do nothing;
-- (If no row existed the app used the fallback "2026": insert crypt('2026', gen_salt('bf')) and tell the owner to change it immediately.)
delete from public.app_settings where key = 'teacher_pin';

create or replace function private.require_teacher(p_token text) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
begin
  if p_token is null or not exists (
    select 1 from private.teacher_sessions
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and expires_at > now()
  ) then perform private.fail('E_AUTH'); end if;
end $$;

create or replace function public.teacher_login(p_pin text) returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_t record; v_hash text; v_token text; v_exp timestamptz := now() + interval '8 hours';
begin
  select * into v_t from private.auth_throttle where scope = 'teacher';
  if v_t.locked_until is not null and v_t.locked_until > now() then
    perform private.fail('E_LOCKED', ceil(extract(epoch from v_t.locked_until - now())/60)::text);
  end if;
  select value into v_hash from private.secrets where key = 'teacher_pin_hash';
  if v_hash is not null and extensions.crypt(coalesce(p_pin,''), v_hash) = v_hash then
    delete from private.auth_throttle where scope = 'teacher';
    delete from private.teacher_sessions where expires_at < now();
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    insert into private.teacher_sessions(token_hash, expires_at)
      values (encode(extensions.digest(v_token,'sha256'),'hex'), v_exp);
    return jsonb_build_object('token', v_token, 'expires_at', v_exp);
  end if;
  insert into private.auth_throttle(scope, failed_count) values ('teacher', 1)
  on conflict (scope) do update set
    failed_count = case when private.auth_throttle.failed_count + 1 >= 5 then 0
                        else private.auth_throttle.failed_count + 1 end,
    locked_until = case when private.auth_throttle.failed_count + 1 >= 5
                        then now() + interval '5 minutes' else null end,
    updated_at = now();
  perform private.fail('E_AUTH');
end $$;
```
*(Remaining auth RPCs: `teacher_logout`, `teacher_ping`, `teacher_change_pin`, see §7.6.)*

### Migration `010_exam_tables.sql` (Phase 1)
```sql
create table private.exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references public.courses(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table private.exam_versions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references private.exams(id) on delete cascade,
  version_no int not null,
  status text not null check (status in ('draft','live','retired')),
  title text not null default '', title_ar text,
  instructions text, instructions_ar text,
  duration_minutes int check (duration_minutes between 1 and 600),
  draft_rev int not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (exam_id, version_no)
);
create unique index one_live_per_exam  on private.exam_versions(exam_id) where status = 'live';
create unique index one_draft_per_exam on private.exam_versions(exam_id) where status = 'draft';

create table private.sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references private.exam_versions(id) on delete cascade,
  position int not null,
  title text not null, title_ar text,
  format text not null check (format in ('mcq','tf','fill','essay')),
  weight numeric not null check (weight > 0 and weight <= 100)
);

create table private.questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references private.sections(id) on delete cascade,
  position int not null,
  prompt text not null,
  options jsonb not null default '[]',      -- [{"id":"a","text":"..."}]  (mcq/tf only)
  note text                                  -- teacher-only guidance (essay), never sent to students
);

create table private.question_keys (
  question_id uuid primary key references private.questions(id) on delete cascade,
  correct_option_ids text[],                 -- mcq / tf
  accepted_answers   text[],                 -- fill
  tm_equiv boolean not null default false    -- fill: treat ة and ه as equal
);

create view private.v_question_values as
select q.id as question_id, q.section_id, s.version_id, s.format,
       s.weight / count(*) over (partition by q.section_id) as value
from private.questions q join private.sections s on s.id = q.section_id;
```

### Migration `020_codes_attempts.sql` (Phase 2)
```sql
create table private.exam_codes (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  code_hash text not null,
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now()
);
create unique index one_active_code on private.exam_codes(enrollment_id) where status = 'active';

create table private.attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  version_id uuid not null references private.exam_versions(id),
  token_hash text,
  shuffle_seed text not null default encode(extensions.gen_random_bytes(8),'hex'),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','finalized')),
  superseded boolean not null default false
);
create unique index one_live_attempt on private.attempts(enrollment_id) where not superseded;

create table private.answers (
  attempt_id uuid not null references private.attempts(id) on delete cascade,
  question_id uuid not null references private.questions(id),
  response jsonb,                            -- {"selected":["a","c"]} | {"text":"..."}
  fraction numeric check (fraction between 0 and 1),
  marked_by text check (marked_by in ('auto','teacher')),
  comment text, marked_at timestamptz,
  flagged boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create table private.attempt_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references private.attempts(id) on delete cascade,
  type text not null check (type in ('left','returned')),
  at timestamptz not null default now()
);
```

### Migration `040_certificates.sql` (Phase 4)
```sql
create table private.certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.enrollments(id) on delete restrict,
  number text not null unique,
  verify_code text not null,
  status text not null default 'approved' check (status in ('approved','revoked')),
  approved_at timestamptz not null default now(),
  revoked_at timestamptz, revoke_reason text,
  snapshot jsonb not null
);
create table private.certificate_counters (
  course_id uuid not null references public.courses(id) on delete cascade,
  year int not null, last int not null default 0,
  primary key (course_id, year)
);
```
`on delete restrict` makes deleting a certified student fail; the RPC maps it to `E_HAS_CERTIFICATE`.

## 7.3 Core server functions (reference)

### Answer normalization (single source of truth; JS preview MUST match, see test vectors Appendix A)
```sql
create or replace function private.normalize_answer(t text, p_tm_equiv boolean default false)
returns text language sql immutable as $$
  select btrim(regexp_replace(
    translate(
      case when p_tm_equiv then translate(lower(r.x), 'ة', 'ه') else lower(r.x) end,
      'أإآٱى٠١٢٣٤٥٦٧٨٩',
      'ااااي0123456789'),
    '\s+', ' ', 'g'))
  from (select regexp_replace(coalesce(t,''),
          '[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]', '', 'g') as x) r
$$;
```
Rules: strip tashkeel (U+064B-065F, U+0670), tatweel (U+0640), Quranic marks (U+06D6-06ED); `أ إ آ ٱ → ا`; `ى → ي`; Arabic-Indic digits → ASCII; lowercase; collapse whitespace; trim. `ة`/`ه` unified **only** when the question's `tm_equiv` is true.

### Grading
```sql
create or replace function private.grade_mcq(p_selected text[], p_correct text[])
returns numeric language sql immutable as $$
  select case when coalesce(cardinality(p_correct),0) = 0 then 0::numeric else
    greatest(0::numeric,
      ( (select count(distinct s) from unnest(coalesce(p_selected,'{}'::text[])) s where s = any(p_correct))
      - (select count(distinct s) from unnest(coalesce(p_selected,'{}'::text[])) s where s <> all(p_correct))
      )::numeric / cardinality(p_correct)) end
$$;

create or replace function private.grade_fill(p_text text, p_accepted text[], p_tm boolean)
returns numeric language sql immutable as $$
  select case when private.normalize_answer(p_text, p_tm) <> ''
         and exists (select 1 from unnest(coalesce(p_accepted,'{}'::text[])) a
                     where private.normalize_answer(a, p_tm) = private.normalize_answer(p_text, p_tm))
         then 1::numeric else 0::numeric end
$$;
```

### Attempt grading and finalization
```sql
create or replace function private.attempt_exam_pct(p_attempt uuid) returns numeric
language sql stable security definer set search_path = public, private, extensions as $$
  select coalesce(sum(coalesce(an.fraction,0) * qv.value), 0)
  from private.attempts a
  join private.v_question_values qv on qv.version_id = a.version_id
  left join private.answers an on an.attempt_id = a.id and an.question_id = qv.question_id
  where a.id = p_attempt
$$;  -- section weights sum to 100, so this equals exam %

create or replace function private.grade_attempt(p_attempt uuid) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_att private.attempts;
begin
  select * into v_att from private.attempts where id = p_attempt;
  -- 1. ensure a row exists for every question in the version
  insert into private.answers(attempt_id, question_id)
  select v_att.id, qv.question_id from private.v_question_values qv
  where qv.version_id = v_att.version_id
  on conflict do nothing;

  -- 2. MCQ / T-F
  update private.answers an set
    fraction = private.grade_mcq(
      array(select jsonb_array_elements_text(coalesce(an.response->'selected','[]'::jsonb))),
      k.correct_option_ids),
    marked_by = 'auto', marked_at = now()
  from private.questions q
  join private.sections s on s.id = q.section_id
  join private.question_keys k on k.question_id = q.id
  where an.attempt_id = v_att.id and an.question_id = q.id
    and s.format in ('mcq','tf') and an.marked_by is distinct from 'teacher';

  -- 3. Fill in the blank
  update private.answers an set
    fraction = private.grade_fill(an.response->>'text', k.accepted_answers, k.tm_equiv),
    marked_by = 'auto', marked_at = now()
  from private.questions q
  join private.sections s on s.id = q.section_id
  join private.question_keys k on k.question_id = q.id
  where an.attempt_id = v_att.id and an.question_id = q.id
    and s.format = 'fill' and an.marked_by is distinct from 'teacher';

  -- 4. Essays: blank → 0 (auto); non-empty stays NULL (pending teacher)
  update private.answers an set fraction = 0, marked_by = 'auto', marked_at = now()
  from private.questions q join private.sections s on s.id = q.section_id
  where an.attempt_id = v_att.id and an.question_id = q.id and s.format = 'essay'
    and an.fraction is null and coalesce(btrim(an.response->>'text'),'') = '';

  perform private.try_finalize(v_att.id);
end $$;

create or replace function private.try_finalize(p_attempt uuid) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_enr uuid;
begin
  update private.attempts a set status =
      case when exists (select 1 from private.answers an
                        where an.attempt_id = a.id and an.fraction is null)
           then 'submitted' else 'finalized' end
  where a.id = p_attempt and a.status in ('submitted','finalized')
  returning a.enrollment_id into v_enr;
  if v_enr is not null then perform private.recompute_result(v_enr); end if;
end $$;
```

### Expiry
```sql
create or replace function private.expire_attempts() returns int
language plpgsql security definer set search_path = public, private, extensions as $$
declare r record; n int := 0;
begin
  for r in select id from private.attempts
           where status = 'in_progress' and deadline_at + interval '15 seconds' < now() loop
    update private.attempts set status = 'submitted', submitted_at = deadline_at where id = r.id;
    perform private.grade_attempt(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
-- Phase 2: enable pg_cron (Dashboard → Database → Extensions), then:
-- select cron.schedule('expire-attempts', '* * * * *', 'select private.expire_attempts()');
-- Also call expire for the single attempt at the start of every token-based student RPC (lazy path).
```

### Result recomputation (maintains public `enrollment_results`)
```sql
create or replace function private.recompute_result(p_enrollment uuid) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  e public.enrollments; c public.courses; v_att private.attempts;
  v_day numeric; v_bonus numeric; v_lesson_pct numeric;
  v_exam numeric; v_final numeric; v_passed boolean;
  v_label text; v_label_ar text; v_status text; v_complete boolean; v_cert boolean;
begin
  select * into e from public.enrollments where id = p_enrollment;
  if not found then return; end if;
  select * into c from public.courses where id = e.course_id;

  if c.lesson_mode = 'scored' then                       -- v3.2: lesson part only for scored courses
    select coalesce(sum(d),0) into v_day   from unnest(e.days) d where d >= 0;
    select coalesce(sum(b),0) * c.bonus_unit_value into v_bonus from unnest(e.bonus_units) b where b > 0;
    v_lesson_pct := least(c.lesson_max, v_day + v_bonus) / c.lesson_max * 100;
  end if;
  v_complete := case c.eligibility_rule                  -- v3.2 (D-42)
    when 'all_units'        then cardinality(e.days) = c.day_count
                                 and not exists (select 1 from unnest(e.days) d where d < 0)
    when 'teacher_approved' then e.exam_approved
    else true                                            -- 'open'
  end;

  select * into v_att from private.attempts where enrollment_id = p_enrollment and not superseded;
  if found and v_att.status = 'finalized' then
    v_exam  := private.attempt_exam_pct(v_att.id);
    v_final := coalesce(v_lesson_pct,0) * c.weight_lessons / 100 + v_exam * c.weight_exam / 100;
    v_passed := v_final >= c.pass_mark;
    v_status := 'finalized';
    if v_passed then
      select b.label, b.label_ar into v_label, v_label_ar
      from jsonb_to_recordset(c.grade_bands) as b(label text, label_ar text, min numeric)
      where b.min <= v_final order by b.min desc limit 1;
    end if;
  elsif found then v_status := v_att.status;               -- in_progress | submitted
  elsif v_complete then v_status := 'eligible';
  else v_status := 'not_eligible'; end if;

  v_cert := to_regclass('private.certificates') is not null
            and exists (select 1 from private.certificates where enrollment_id = p_enrollment and status = 'approved');

  insert into public.enrollment_results as r
    (enrollment_id, course_id, status, lesson_pct, exam_pct, final, passed, band_label, band_label_ar, has_certificate, updated_at)
  values (p_enrollment, e.course_id, v_status, v_lesson_pct, v_exam, v_final, v_passed, v_label, v_label_ar, v_cert, now())
  on conflict (enrollment_id) do update set
    status = excluded.status, lesson_pct = excluded.lesson_pct, exam_pct = excluded.exam_pct,
    final = excluded.final, passed = excluded.passed, band_label = excluded.band_label,
    band_label_ar = excluded.band_label_ar, has_certificate = excluded.has_certificate, updated_at = now();
end $$;
-- Note: to_regclass check lets this function exist before Phase 4. Simplify after 040 is applied.
-- v3.1: this FULL version needs private.attempts (Phase 2). Phase 0 ships a lesson-only version (see §11); this one replaces it in migration 020.
```
**Triggers:** after insert/update of `days, bonus_units, active, exam_approved` on `public.enrollments` → `recompute_result(new.id)`. After update of course scoring or eligibility settings (`day_count, day_max, bonus_unit_value, lesson_max, weights, pass_mark, grade_bands, eligibility_rule`) on `public.courses` → recompute for all enrollments of that course.

## 7.4 Certificate snapshot (stored at approval)
```json
{
  "student_name": "…", "student_name_ar": "…",
  "course_name": "Al-Aadaab Al-Asharah", "course_name_ar": "الآداب العشرة", "course_code": "ADAB",
  "final": 79.0, "lesson_pct": 86.0, "exam_pct": 72.0,
  "weights": {"lessons": 50, "exam": 50}, "pass_mark": 60,
  "band_label": "Good", "band_label_ar": "جيد",
  "exam_version_no": 2, "exam_finalized_at": "2026-10-20T10:12:00Z",
  "approved_at": "2026-10-21T08:00:00Z",
  "certificate": {"title": "Certificate of Completion", "title_ar": "شهادة إتمام",
                  "wording": "…resolved text…", "wording_ar": "…resolved text…",
                  "logo": "assets/logo.svg", "signature_image": null},
  "unit_label": "Day",
  "signatory": {"name": "Musa Aminu Muhammad", "name_ar": "موسى أمينو محمد", "title": "Mushrif", "title_ar": "المشرف"},
  "institution": {"name": "Ma'had Miftah al-'Ilm", "name_ar": "معهد مفتاح العلم"}
}
```
The `certificate`, `signatory`, and `institution` blocks are **resolved at approval time** (course `cert_settings` → `private.institution_settings` → built-in constants, FR-V8) and frozen, so later changes to course or institution settings never alter issued certificates.

## 7.5 Option shuffling (deterministic per attempt)
Server sorts each question's options by `md5(attempt.shuffle_seed || question_id || option_id)`. Same attempt → same order on every reload. `tf` questions are **not** shuffled (True before False).

## 7.6 RPC catalog

**Conventions:** admin RPCs take `p_token` as the first argument and call `private.require_teacher(p_token)`. Student RPCs take either `(p_enrollment_id, p_code)` or `p_attempt_token`. Complex returns are `jsonb`. "→" shows return shape.

### Auth (callable by `anon`)
| RPC | Args | Returns / behavior |
|---|---|---|
| `teacher_login` | `p_pin` | → `{token, expires_at}`. Throttled (FR-A4). Errors `E_AUTH`, `E_LOCKED` |
| `teacher_logout` | `p_token` | Deletes session |
| `teacher_ping` | `p_token` | → boolean (is session valid). Used on page load to restore teacher mode |
| `teacher_change_pin` | `p_token, p_old, p_new` | Verifies old, enforces min length, stores new bcrypt hash, **invalidates all other sessions** |

### Courses & roster
| RPC | Args | Behavior |
|---|---|---|
| `admin_save_course` | `p_token, p_course jsonb, p_confirm bool=false` | Insert (no `id`) or update. Validates (FR-C1, FR-C8, FR-V7). Insert also accepts `p_copy_from uuid`, `p_copy_exam bool` (FR-C7). If scoring-affecting fields change and enrollments exist and `p_confirm=false` → `E_CONFIRM_REQUIRED` (detail = affected count). On confirm: resize arrays (FR-C3), recompute all |
| `admin_set_course_status` | `p_token, p_course_id, p_status` | `active`/`archived` |
| `admin_list_roster` | `p_token, p_course_id` | → rows (incl. inactive): enrollment, student (EN/AR names), S/N, days, bonus, eligibility, code status, lock state, attempt status, result, tab-leave summary |
| `admin_list_students_all` | `p_token` | → `[{id, name, name_ar}]` for the "enroll existing student" picker |
| `admin_add_student` | `p_token, p_course_id, p_name, p_name_ar` | Creates student `s<seq>` + enrollment with next S/N (inside the function, row-locked) |
| `admin_enroll_student` | `p_token, p_course_id, p_student_id` | New enrollment with next S/N |
| `admin_bulk_seed` | `p_token, p_course_id, p_lines text` | Parses lines (`Name | الاسم`), skips existing names (case-insensitive) → `{added, skipped[], invalid[]}` |
| `admin_update_student` | `p_token, p_student_id, p_name, p_name_ar` | Rename |
| `admin_set_active` | `p_token, p_enrollment_id, p_active` | Toggle |
| `admin_delete_student` | `p_token, p_student_id` | Hard delete; `E_HAS_CERTIFICATE` if a certificate exists |
| `admin_save_day` | `p_token, p_enrollment_id, p_day_index, p_score, p_bonus` | Validates `0 ≤ score ≤ day_max` (or null), `bonus ≥ 0`, index in range; updates arrays atomically; trigger recomputes |
| `admin_set_exam_approval` | `p_token, p_enrollment_id, p_approved` | Sets `exam_approved` (used by `teacher_approved` courses); recompute. `E_VALIDATION` if the course's rule is not `teacher_approved` |

### Exam builder
| RPC | Args | Behavior |
|---|---|---|
| `admin_get_exam` | `p_token, p_course_id` | → `{versions:[{id, no, status, title, published_at, attempts_count}], draft: {...full doc with keys...}|null}` |
| `admin_get_version` | `p_token, p_version_id` | → full doc incl. keys (read-only view of live/retired) |
| `admin_create_draft` | `p_token, p_course_id` | Creates exam row if missing; draft = copy of live (new uuids) or empty. `E_VALIDATION` if a draft already exists |
| `admin_save_draft` | `p_token, p_version_id, p_rev int, p_doc jsonb` | Replaces draft content in a transaction. `E_CONFLICT` if `p_rev` ≠ stored `draft_rev`. → new rev. Lenient: saves incomplete drafts (strict checks only on publish) |
| `admin_discard_draft` | `p_token, p_version_id` | Deletes the draft |
| `admin_publish_version` | `p_token, p_version_id` | Runs §7.7 validation → `E_VALIDATION` with a list of problems; else live ⇐ draft, previous live → retired, `courses.exam_live = true` |
| `admin_patch_text` | `p_token, p_question_id, p_prompt, p_options jsonb` | Text-only patch (FR-X13); option **ids and count** must not change |
| `admin_correct_key` | `p_token, p_question_id, p_key jsonb, p_confirm bool=false` | FR-X14. Without confirm → `E_CONFIRM_REQUIRED` (detail = affected attempts). Re-grades non-teacher-marked answers of that question; re-finalizes; recomputes results |

**Draft document shape (`p_doc`):**
```json
{
  "title": "Final Exam", "title_ar": "الاختبار النهائي",
  "instructions": "…", "instructions_ar": "…", "duration_minutes": 60,
  "sections": [{
    "id": "uuid", "title": "Section A", "title_ar": null, "format": "mcq", "weight": 40,
    "questions": [{
      "id": "uuid", "prompt": "…", "note": null,
      "options": [{"id":"a","text":"…"},{"id":"b","text":"…"}],
      "key": {"correct_option_ids": ["a"]}            // mcq / tf
      // fill: "key": {"accepted_answers": ["…"], "tm_equiv": false}
      // essay: no key
    }]
  }]
}
```
Question and option order = array order.

### Codes
| RPC | Args | Behavior |
|---|---|---|
| `admin_generate_code` | `p_token, p_enrollment_id` | Requires eligible + `exam_live`. Generates §FR-K8 code, revokes any active code, stores bcrypt hash → `{code}` (plaintext once) |
| `admin_generate_codes_bulk` | `p_token, p_course_id` | For every eligible enrollment without an active code → `[{enrollment_id, sn, name, name_ar, code}]` |
| `admin_revoke_code` | `p_token, p_enrollment_id` | Revokes active code |
| `admin_clear_lock` | `p_token, p_enrollment_id` | Clears throttle row `enr:<id>` |
| `admin_reset_attempt` | `p_token, p_enrollment_id` | Current attempt → `superseded = true`; recompute |

### Marking & results
| RPC | Args | Behavior |
|---|---|---|
| `admin_marking_overview` | `p_token, p_course_id` | → essay questions (grouped by version) with `{submitted, marked, pending}` counts; fill questions with unmatched-answer counts |
| `admin_essay_answers` | `p_token, p_question_id` | → submitted attempts' answers for that question: student, text, current mark, comment |
| `admin_attempt_detail` | `p_token, p_attempt_id` | → all questions, responses, keys, marks, tab-leave events |
| `admin_mark_answer` | `p_token, p_attempt_id, p_question_id, p_points, p_comment` | Converts points → fraction using the question value; clamps; `marked_by='teacher'`; `try_finalize` |
| `admin_fill_review` | `p_token, p_question_id` | → distinct unmatched answers with counts |
| `admin_accept_fill_answer` | `p_token, p_question_id, p_text` | Appends to accepted answers, re-grades that question across the version's attempts |
| `admin_results` | `p_token, p_course_id` | → rows for the Results table and CSV export |

### Certificates
| RPC | Args | Behavior |
|---|---|---|
| `admin_list_certificates` | `p_token, p_course_id` | → `{eligible: [...], issued: [...]}` with flags (e.g. missing Arabic name) |
| `admin_approve_certificates` | `p_token, p_enrollment_ids uuid[]` | Per id: verifies finalized + passed + no cert + `name_ar` present; assigns number (counter row-locked), verify code, snapshot; sets `has_certificate` → `[{id, ok|error}]` |
| `admin_revoke_certificate` | `p_token, p_enrollment_id, p_reason` | Sets `revoked` |
| `admin_get_institution` | `p_token` | → institution name, number prefix, certificate defaults |
| `admin_save_institution` | `p_token, p_settings jsonb` | Validates (FR-V7/V8); affects only certificates approved afterwards |

### Student (callable by `anon`)
| RPC | Args | Behavior |
|---|---|---|
| `exam_check` | `p_enrollment_id, p_code` | Verifies code (counts failures, lockout) → `{state: not_started|in_progress|submitted|finalized, exam:{title, duration, sections, questions, instructions}, remaining_seconds?}`. Errors `E_AUTH` (generic), `E_LOCKED`, `E_NOT_ELIGIBLE`, `E_NO_LIVE_EXAM` |
| `exam_start` | `p_enrollment_id, p_code` | Starts (creates attempt on the live version, deadline) or resumes. New attempt token each call (hash replaces old). → `{attempt_token, deadline_at, server_now}`. `E_ATTEMPT_EXISTS` if already submitted |
| `exam_get_paper` | `p_attempt_token` | → sections/questions/options (shuffled, no keys), saved answers, flags, `deadline_at`, `server_now`. `E_SESSION_REPLACED`, `E_EXPIRED` |
| `exam_save_answers` | `p_attempt_token, p_answers jsonb` | Batch `[{question_id, response, flagged}]`; validates ownership, sizes (fill ≤ 500 chars, essay ≤ 20,000); rejects after `deadline + 15 s` (`E_ATTEMPT_CLOSED`) |
| `exam_log_event` | `p_attempt_token, p_type` | Inserts `left`/`returned`; rate-limited (max 200 events per attempt) |
| `exam_submit` | `p_attempt_token` | Idempotent. Sets submitted, `grade_attempt` → `{status, sections:[{title, earned, possible, pending}], pending_marking}` |
| `exam_get_result` | `p_enrollment_id, p_code` | → status, provisional or final scores, per-section summary, pass/fail/band, `has_certificate`. `E_NOT_READY` fields when pending |
| `exam_get_review` | `p_enrollment_id, p_code` | Only if attempt `finalized` and `course.reveal_answers`; else `E_NOT_READY` / `E_REVIEW_DISABLED`. → questions + student answers + keys + marks + comments |
| `get_certificate` | `p_enrollment_id, p_code` | → snapshot + number + verify URL (approved only) |
| `verify_certificate` | `p_number` | → `{valid|revoked|not_found, student_name, student_name_ar, course_name, course_name_ar, issued_at, band}` only |

## 7.7 Publish validation (FR-X12)
A draft MUST satisfy **all** of the following; failures are returned as a list of `{path, message}`:
1. `title` non-empty; `duration_minutes` 1-600.
2. At least 1 section; every section has ≥ 1 question and `weight > 0`.
3. Section weights sum to 100 (±0.001).
4. Total questions ≤ 200. Prompt ≤ 4,000 chars; option text ≤ 500; accepted answer ≤ 200.
5. Every prompt non-empty.
6. **mcq:** 2-8 options, unique option ids, non-empty texts, ≥ 1 correct, correct ids ⊆ option ids.
7. **tf:** exactly two options (`true`, `false`), exactly one correct.
8. **fill:** ≥ 1 non-empty accepted answer.
9. **essay:** no key required.

## 7.8 Realtime
Add to the `supabase_realtime` publication: `public.students`, `public.enrollments`, `public.courses`, `public.enrollment_results`. The client subscribes with `postgres_changes` on these tables (as the current app does for `students`) and refetches the affected course. Private tables are never published.

---

# 8. Security

## 8.1 Threat model

| Threat | Mitigation |
|---|---|
| Student reads answer keys via dev tools/API | Keys only in `private.question_keys`; `private` not exposed; no public RPC returns keys except `exam_get_review` after finalization |
| Student forges marks / submits to others | All marking server-side; writes only via RPCs requiring an attempt token bound to one attempt |
| Student guesses another's code | 8-char code from 31-symbol alphabet (≈ 40 bits), bcrypt-hashed, per-enrollment lockout (5 → 10 min) |
| Someone locks others out maliciously | Short lockout; teacher can clear; failed counts visible to teacher |
| Anyone writes to tables with the public key | `REVOKE` write privileges; RLS on; only RPCs write |
| PIN brute force | bcrypt + 5-failure lockout; recommend ≥ 6-char passphrase; optional per-IP throttling |
| Stolen teacher token | 8 h expiry, hashed server-side, `sessionStorage` only, invalidated on PIN change/logout |
| Timer tampering | Deadline enforced server-side; client clock display-only |
| XSS via exam/student text | All interpolated text through `escapeHtml`; plain text only; no `innerHTML` with unescaped data; CSP header recommended |
| Certificate forgery | Number + verify code stored server-side; public verification page; revocation |
| Malicious certificate settings (markup or path injection through wording/images) | Plain text only, escaped on render; placeholder whitelist; image paths restricted by regex to `assets/`; length limits (FR-V7) |
| Answer-sharing between students | Shuffled options, versioned exams, review toggle (D-22) |

## 8.2 Access model
- **`anon` role (everyone):** `SELECT` on `courses`, `students`, `enrollments` (active only), `enrollment_results`; `EXECUTE` on the public RPCs listed in §7.6 (auth + student + `verify_certificate`).
- **Admin RPCs** are also granted to `anon` (there are no user accounts) but **self-protect** via `require_teacher(p_token)`.
- Nothing else is accessible. `private` schema: no grants.

## 8.3 Lockdown SQL (Migration `005_security_lockdown.sql`; run **last** in Phase 0, after the client uses RPCs)
```sql
-- Tables
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.courses, public.students, public.enrollments, public.enrollment_results to anon;

alter table public.courses            enable row level security;
alter table public.students           enable row level security;
alter table public.enrollments        enable row level security;
alter table public.enrollment_results enable row level security;
create policy read_courses  on public.courses            for select to anon using (true);
create policy read_students on public.students           for select to anon
  using (exists (select 1 from public.enrollments e where e.student_id = public.students.id and e.active));  -- v3.1: do not expose inactive-only students
create policy read_enroll   on public.enrollments        for select to anon using (active);
create policy read_results  on public.enrollment_results for select to anon
  using (exists (select 1 from public.enrollments e where e.id = public.enrollment_results.enrollment_id and e.active));
alter table public.app_settings enable row level security;   -- no policy → no public access

-- Private schema: defense in depth
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname = 'private' loop
    execute format('alter table private.%I enable row level security', r.tablename);
  end loop; end $$;

-- Functions: nothing executable by default, grant explicitly
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
grant execute on function public.teacher_login(text) to anon;
-- …repeat for every RPC in §7.6 (auth, admin_*, exam_*, get_certificate, verify_certificate)
```
**Important:** the existing app writes directly to `students`/`app_settings`. Applying this migration **before** the client is ported to RPCs will break teacher functions. Order is mandatory (§11, Phase 0).

## 8.4 Authentication flows
**Teacher:** PIN → `teacher_login` → token in `sessionStorage['mahad_teacher_token']` → every admin call passes it → on page load `teacher_ping(token)` restores or clears teacher mode → logout/expiry clears the token. Any `E_AUTH` from an admin call locks the UI and prompts for the PIN.

**Student (exam):** pick enrollment → enter code → `exam_check` (verification + lockout) → `exam_start` returns attempt token (kept in `sessionStorage['mahad_attempt_token']`) → `exam_get_paper`/`exam_save_answers`/`exam_submit` use the token. Result/review/certificate re-verify with `(enrollment_id, code)`; the code is held in memory only for the visit, never persisted.

## 8.5 Error codes (server → client)

| Code | Meaning | Client message (default) |
|---|---|---|
| `E_AUTH` | Invalid PIN/code/token | "Incorrect PIN." / "Name or code is incorrect." / "Please unlock teacher mode again." |
| `E_LOCKED` | Throttled; `detail` = minutes | "Too many attempts. Try again in N minutes." |
| `E_NOT_FOUND` | Missing record | "That item no longer exists. Refresh and try again." |
| `E_VALIDATION` | Bad input; `detail` = message/list | Show detail next to the field |
| `E_CONFLICT` | Stale draft revision | "This draft was changed elsewhere. Reload to continue." |
| `E_CONFIRM_REQUIRED` | Needs explicit confirmation; `detail` = count | Show confirm dialog with the count, then retry with `p_confirm=true` |
| `E_NOT_ELIGIBLE` | Lessons incomplete | "You can sit the exam once all your lessons are marked (x of N done)." |
| `E_NO_LIVE_EXAM` | No published version | "The exam isn't available yet." |
| `E_ATTEMPT_EXISTS` | Already submitted | "You've already submitted this exam. View your result." |
| `E_ATTEMPT_CLOSED` | Save after deadline+grace | "Time is up. Your exam has been submitted." |
| `E_EXPIRED` | Attempt past deadline | Same as above |
| `E_SESSION_REPLACED` | New session started elsewhere | "This exam was opened on another device or tab." |
| `E_NOT_READY` | Marking not finished | "Your result is still being marked." |
| `E_REVIEW_DISABLED` | Course has review off | "Answer review isn't available for this course." |
| `E_HAS_CERTIFICATE` | Delete blocked | "This student has a certificate and can't be deleted." |
| `E_NO_ARABIC_NAME` | Approval blocked | "Add the student's Arabic name first." |

## 8.6 Recommended hardening
- HTTP headers (Netlify `_headers` / Vercel `vercel.json`): `Content-Security-Policy` allowing only own origin, `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`, and the Supabase project URL (`connect-src` + `wss:`); `X-Content-Type-Options: nosniff`; `Referrer-Policy: same-origin`.
- Choose a **strong PIN/passphrase** at cut-over (FR-A6).
- Separate **staging** and **production** Supabase projects.
- Enable Supabase backups (or take a manual export) before every migration.

---

# 9. UI / UX Specification

## 9.1 Principles
1. **Same identity.** Emerald and gold, Amiri + Inter, existing component classes (§3.6). New screens are built from the existing classes first; new classes only when nothing fits.
2. **Mobile-first.** Base layout is 360-400 px wide. Desktop (≥ 720 px) adds two-column layouts only for the exam palette, marking, and the draft editor.
3. **English UI, Arabic content** (D-34). Arabic text always renders with `dir="auto"` and Amiri; UI chrome stays LTR.
4. **Every async action has visible state:** button disabled + label change ("Saving…"), result shown in `.save-hint` (`.ok` / `.err`) or the `.status-banner`.
5. **Destructive actions confirm** through the existing `.confirm-overlay`, stating the number of records affected.
6. **No dead ends.** Every error has a plain-language message (§8.5) and a next step (retry, reload, unlock).

## 9.2 Information architecture

**Header:** Bismillah, Arabic title, subtitle, **course switcher** (a `<select>` styled as a pill, hidden when only one non-archived course exists, FR-C5), **Teacher** pill.

**Public tabs:** `Directory` · `Leaderboard` · `Full Sheet` · **`Exam`** (new).

**Teacher tab:** `Manage` (hidden until unlocked). It contains a horizontally scrollable **sub-navigation**:

| Sub-tab | Content | Phase |
|---|---|---|
| Roster | Course roster, add / enroll / bulk seed, Arabic names, activate, delete | 0 |
| Course | Course settings (FR-C1), grade bands, archive | 0 |
| Exams | Versions list, draft editor, preview, publish | 1 |
| Codes | Eligibility table, generate / regenerate, slips, locks, reset attempt | 2 |
| Marking | Marking overview, essay queue, fill review | 3 |
| Results | Results table, CSV, attempt detail | 3 |
| Certificates | Eligible list, approve, revoke, issued list | 4 |
| Account | Change PIN | 0 |
| Institution | Institution name, certificate number prefix, certificate defaults (title, wording, signatory, logo) | 4 |

Sub-tabs for features that do not exist yet are **not rendered** (no "coming soon" placeholders).

## 9.3 Screen inventory

### Public
| ID | Screen | Key elements | Data source |
|---|---|---|---|
| P1 | Directory | Search, cards (name, S/N, badge: `lesson / max` or final + band, "Exam pending" chip) | `enrollments`, `students`, `enrollment_results` |
| P2 | Student modal | Units grid (course's unit label), bonus, lesson total; when finalized: final + band, "Certificate issued". **No exam breakdown** (D-33) | same |
| P3 | Leaderboard | Lesson mode or exam mode (§5.5), medals for ranks 1-3, shared ranks | `enrollment_results` |
| P4 | Full Sheet | S/N, Name, {Unit} 1…N, Bonus (number), Lesson, Exam %, Final | same |
| P5 | Exam entry | Course (if several) → name search → code input → Continue | `exam_check` |
| P6 | Instructions | Title, duration, counts, instructions, rules, **Start / Resume** | `exam_check` result |
| P7 | Exam screen | §9.4.1 | `exam_get_paper`, `exam_save_answers` |
| P8 | Submit confirm | Unanswered + flagged counts, irreversible warning | local |
| P9 | Result (post-submit) | Per-section earned/possible, essays "Pending marking", provisional total | `exam_submit` result |
| P10 | Status / review | Pending, or final + band + pass/fail + answer review (if allowed) + "View certificate" | `exam_get_result`, `exam_get_review` |
| P11 | Certificate view | Print-ready A4 landscape (Appendix B) | `get_certificate` |
| P12 | Verify page | `verify.html`: Valid / Revoked / Not found | `verify_certificate` |

### Teacher
| ID | Screen | Key elements |
|---|---|---|
| T1 | Unlock | PIN field, error + lockout message (existing lock notice) |
| T2 | Roster | Active / Inactive lists, per-row: names (EN/AR), S/N, lesson total, eligibility chip; actions: rename, active toggle, delete |
| T3 | Add / enroll / bulk seed | Add form (name, optional Arabic name), "Enroll existing student" picker, bulk textarea with `Name | الاسم` lines and log |
| T4 | Arabic names | Table of enrollments missing `name_ar`, inline edit, "n missing" counter |
| T5 | Course settings | Fields of FR-C1 (unit label, lesson mode, eligibility rule), grade bands editor (FR-C6), certificate settings (Phase 4), archive button, confirm dialog with affected count. **New course** button → *Blank* or *Copy from…* (FR-C7). Lesson mode shown read-only once locked (FR-C8) |
| T6 | Exam versions | List (version no, status, published date, attempt count), **New draft**, **View** (read-only for live/retired) |
| T7 | Draft editor | §9.4.3 |
| T8 | Preview | Student exam screen in preview mode (banner "Preview: nothing is saved") |
| T9 | Codes | Status table (FR-K1), filters, bulk generate, per-row generate/regenerate/clear lock/reset attempt |
| T10 | Code slips | Printable cards, generated client-side from the one-time response |
| T11 | Marking overview | Counts per essay question and per fill question |
| T12 | Essay by question | §9.4.2 |
| T13 | Essay by student | One attempt, all essays |
| T14 | Fill review | Distinct unmatched answers with counts, **Accept** |
| T15 | Results | Table + CSV export |
| T16 | Attempt detail | Questions, responses, keys, marks, tab-leave events |
| T17 | Certificates | Eligible list (flags for missing Arabic name), bulk approve, issued list, revoke |

## 9.4 Key layouts

### 9.4.1 Exam screen (mobile)
```
┌──────────────────────────────┐
│ 42:15        ● Saved   [Submit]│  sticky header: timer, autosave state
├──────────────────────────────┤
│ Section A · MCQ   Q 3 of 12  │
│                               │
│ ما حكم ...؟                   │  prompt (dir=auto)
│  ( ) option 1                 │  radio (single) / checkbox (multi)
│  ( ) option 2                 │
│  ( ) option 3                 │
│                               │
│ [⚑ Flag for review]           │
├──────────────────────────────┤
│ [‹ Previous]        [Next ›]  │
│ ▢1 ■2 ▣3 ▢4 ▢5 ... palette    │  answered ■, unanswered ▢, flagged ▣
└──────────────────────────────┘
```
- Timer turns amber at 5 min and red at 1 min, plus a one-time `aria-live="polite"` announcement.
- Palette opens as a bottom sheet on mobile, a persistent right column on desktop.
- Multi-answer questions show "Select all that apply" above the options.
- Fill-in: single-line input (`dir="auto"`, max 500 chars). Essay: textarea with live character count (max 20,000).
- The offline notice is a persistent banner under the header: "Offline: your answers are safe, reconnecting…".

### 9.4.2 Essay marking, by question (desktop two-column, mobile stacked)
```
Question 4 of 6 essays · 34 of 52 marked          [By student ⇄]
─────────────────────────────────────────────────────────────
Prompt: ...
─────────────────────────────────────────────────────────────
Ahmad Bello · S/N 12
┌──────────────────────────────────────────────┐
│ student's answer (dir=auto, preserves lines)  │
└──────────────────────────────────────────────┘
Points [ 3.5 ] / 5      Comment (optional) [____________]
                      [Save & next ›]   [Skip]
```
Keyboard: `Enter` in the points field saves and advances. Points step 0.25, accepts decimals, clamped to `[0, value]`.

### 9.4.3 Draft editor
- Top bar: title, status chip ("Draft v3"), autosave indicator (FR-X16), **Preview**, **Publish**.
- Left (desktop) / accordion (mobile): sections list with weight total badge (green at 100, amber otherwise).
- Section card: title, format, weight, computed **"each question = n points"**, question list with up/down, duplicate, delete.
- Question editor opens inline: prompt textarea, options (mcq/tf), correct toggles, accepted answers (fill), note (essay).
- Publish dialog lists validation problems as `Section › Question: message` links that jump to the field.

## 9.5 States and copy

| Situation | Behavior / text |
|---|---|
| Loading | Existing skeleton text: "Loading…" in the container |
| No students | "No students yet." (existing) |
| No live exam | Exam tab: "The exam isn't available yet." |
| Not eligible (`all_units`) | "You can sit the exam once all your lessons are marked (x of N done)." (uses the course's unit label if it reads better, e.g. "weeks") |
| Not eligible (`teacher_approved`) | "Your teacher hasn't approved you for this exam yet." |
| Wrong name/code | "Name or code is incorrect." (never says which) |
| Locked | "Too many attempts. Try again in N minutes." |
| Time up | "Time is up. Your exam has been submitted." |
| Pending result | "Your result is still being marked. Come back later with your name and code." |
| Leaderboard empty (exam mode) | "Rankings appear once students have completed the exam." |

**Default exam rules text** (editable per version in `instructions`):
1. You have one attempt. The timer starts when you press Start and cannot be paused.
2. Your answers save automatically. If you lose connection, keep going: they sync when you are back online.
3. If time runs out, your exam is submitted automatically.
4. Do not share the exam or your code.
5. The teacher can see when the exam page is left or reopened. *(🟡 transparency line, see O-7)*

## 9.6 Accessibility (NFR-4, concrete)
- All interactive elements reachable by keyboard; visible focus ring using `--gold-ochre`.
- Modals trap focus, close on `Esc`, return focus to the opener.
- Radio / checkbox groups use `fieldset` + `legend` (the prompt).
- Timer text is not the only warning: colour **and** an `aria-live` message.
- Minimum touch target 44 × 44 px for exam controls.
- Contrast WCAG AA in light and dark; amber/red timer states checked in both.
- Arabic text minimum 1.1 rem in Amiri for readability.

---

# 10. Technical Architecture

## 10.1 Repository layout (no build step, plain ES modules)
```
/
├── index.html              shell: header, tabs, containers, modals; loads /js/main.js
├── verify.html             public certificate verification page
├── css/
│   ├── base.css            extracted from today's <style> (tokens, components)
│   ├── exam.css            exam screens
│   └── print.css           certificate + code slips (@media print)
├── js/
│   ├── config.js           environment selection (§10.2)
│   ├── api.js              Supabase client + rpc() wrapper + error map
│   ├── state.js            tiny store (course, teacher session, data caches)
│   ├── data.js             load courses + enrollments of the selected course (public reads / admin_list_roster)
│   ├── ui.js               escapeHtml/escapeAttr, showStatus, modals, icons, confirm
│   ├── main.js             bootstrap, tab routing, realtime
│   ├── portal.js           directory, leaderboard, full sheet, student modal
│   ├── auth.js             teacher login/logout/ping, PIN change
│   ├── roster.js           roster, add/enroll/seed, Arabic names
│   ├── scores.js           score editor wizard
│   ├── courses.js          course settings, grade bands
│   ├── examBuilder.js      versions, draft editor, preview, publish   (Phase 1)
│   ├── codes.js            eligibility, codes, slips                  (Phase 2)
│   ├── exam.js             student exam flow                          (Phase 2)
│   ├── normalize.js        JS mirror of private.normalize_answer      (Phase 2)
│   ├── marking.js          essay queue, fill review                   (Phase 3)
│   ├── results.js          results table, CSV                         (Phase 3)
│   ├── certificates.js     approval UI                                (Phase 4)
│   └── certificateView.js  render + print                             (Phase 4)
├── vendor/                 pinned third-party files (supabase-js, qrcode)
├── migrations/             numbered SQL (Appendix D); rollback/ subfolder
├── tests/
│   ├── sql/                assert-style SQL tests, run in the SQL editor
│   ├── js/normalize.test.html   browser-run vectors (Appendix A)
│   └── tools/              anon_probe.mjs (C.1), run_local_tests.sh, supabase_shim.sql, concurrency_sn.sh; load-test scripts later
├── docs/                   PRD.md, exam-system-plan-v2.md (history)
├── _redirects  _headers  netlify.toml
└── README.md
```
Modules import each other with relative paths. `index.html` contains **no inline scripts**, which lets the CSP drop `'unsafe-inline'` for scripts (§8.6).

## 10.2 Environments and configuration (D-37)
- Two Supabase projects: **staging** and **production**. Both URLs and publishable keys live in `js/config.js` (public by design). The `service_role` key appears nowhere in the repo or client.
- Environment is chosen by hostname: production domain → production; everything else (`localhost`, Netlify deploy previews and branch deploys) → **staging**. This guarantees a preview build can never write to live data.
- The environment name is shown as a small badge in the header on non-production, so nobody mistakes staging for the real portal.
- **Temporary deviation (v3.6, until O-10 is answered):** the production hostname is unknown, so `config.js` currently treats only `localhost`, `127.0.0.1`, `[::1]`, `*.localhost`, `file://` and hostnames containing `--` (Netlify deploy-preview and branch-deploy hosts) as **staging**, and every other host as production. This is the opposite default to the rule above, chosen so that pushing 0.4 cannot silently repoint the live site at staging. When the production domain is known, switch to a `PRODUCTION_HOSTS` allow-list so unknown hosts fall back to staging as intended.

## 10.3 `api.js` contract
```js
rpc(name, args)          // sb.rpc wrapper
// - adds p_token automatically for admin_* (from sessionStorage)
// - on error: throws ApiError {code, detail, message}; code = server E_* or 'E_NETWORK'
// - on E_AUTH from an admin_* call: emits 'teacher-expired' (UI locks teacher mode)
// - student calls with idempotent semantics (save, submit, log) may retry with backoff
```
The error-code → message map from §8.5 lives here as one object.

## 10.4 Client storage (exhaustive list)
| Key | Store | Content | Lifetime |
|---|---|---|---|
| `mahad_teacher_token` | sessionStorage | teacher session token | tab |
| `mahad_attempt_token` | sessionStorage | attempt token | tab |
| `mahad_course_id` | sessionStorage | selected course | tab |
| `mahad_queue_<attemptId>` | localStorage | pending unsent answers only | until acknowledged |

No codes, PINs, or tokens are written to `localStorage`. Codes are held in memory for the visit (§8.4). The old `mahad_teacher_unlocked` flag is removed.

## 10.5 Rendering and safety rules
- Template strings plus `escapeHtml` / `escapeAttr` for **every** interpolated value (existing pattern). Exam text is plain text only.
- Event delegation on containers instead of per-render listeners where lists are re-rendered often.
- Realtime events are **debounced (~500 ms)** and refetch only the selected course.
- Public reads select explicit columns, not `*`.

## 10.6 Hosting and deployment (D-36)
**Recommendation: Netlify.** Static site, no build command, publish directory `/`.
- `main` → production. Every pull request → **deploy preview** (pointing at staging, §10.2).
- `_redirects`: `/verify/*  /verify.html  200` so `/verify/MMI-ADAB-2026-0007` works.
- `_headers`: CSP and security headers (Appendix D).
- Both platforms would work; Vercel needs an equivalent `vercel.json` rewrite and headers block. Switching later is low-cost because nothing in the app depends on the host.

## 10.7 Third-party code
- `supabase-js` is pinned to an **exact version** and vendored under `/vendor` (D-39), removing the runtime dependency on a CDN and the risk of a floating `@2` upgrading unexpectedly.
- QR codes (Phase 4) use a small vendored MIT library, no external service, so the verification URL is never sent to a third party.
- Fonts stay on Google Fonts (existing). Self-hosting is a Phase 5 option.

---

# 11. Phase Plan

**Working agreement for every phase** (supports §0.2 rules 4, 6, 7, 8):
- Each task is one branch + one pull request into `main`, with a short plan stated first.
- SQL ships as numbered files in `/migrations/` (Appendix D). The owner runs them in the **staging** SQL editor first, pastes back output, and only then on production.
- A phase is **done** when: its AC items pass on staging, the PR is merged, production is deployed, the owner signs off, and this PRD's tracker and session log are updated.

## Phase 0: Foundation (security, courses, modular refactor)

**Goal:** the portal looks and behaves exactly as before, but runs on server-verified auth, locked-down tables, and the course/enrollment model.

| Task | Deliverable | Notes |
|---|---|---|
| **0.0 Preparation** | Staging Supabase project created; production backup exported; Netlify site connected to the repo; baseline commit (unchanged `index.html`, PRD, plan) on `main`; owner picks the new passphrase (never shared in chat) | Owner actions: staging project, Netlify account, passphrase. Copy production `students` + `app_settings` into staging (CSV or `pg_dump`) |
| **0.1 Core migrations** | `000_setup` (incl. `system_params` + `param()`), `001_courses_enrollments` (incl. `enrollment_results`, all v3.2 course columns, `institution_settings` seed, seed course `ADAB`, idempotent copy of students → enrollments), `002_auth` (PIN hash, sessions, throttle, `teacher_login/logout/ping/change_pin`) | Run on staging; SQL tests T0.1-T0.4 |
| **0.2 Roster & scoring RPCs** | `003_roster_rpcs`: `admin_save_course`, `admin_set_course_status`, `admin_list_roster`, `admin_list_students_all`, `admin_add_student`, `admin_enroll_student`, `admin_bulk_seed`, `admin_update_student`, `admin_set_active`, `admin_delete_student`, `admin_save_day`, `admin_set_exam_approval`; **Phase-0 `recompute_result`** (lesson part only, see note below) + triggers + backfill of `enrollment_results` | S/N assigned inside the DB with a row lock |
| **0.3 Public access prep** | `004_public_access`: realtime publication entries, `read_*` policies prepared but **not yet restricting writes** | Lockdown itself is `005`, applied last |
| **0.4 Modular client** | `index.html` split into `css/` + `js/` modules (§10.1) with **no behavior change**; `config.js`; vendored `supabase-js` | Visual regression screenshots (AC-0.12). ✅ done in session 7 except the owner's real-browser screenshot comparison |
| **0.5 Port teacher features** | Server login, session token, every write via RPC, `name_ar` fields, bulk Arabic-name screen, Course settings screen (unit label, lesson mode, eligibility rule, create-from-existing for settings), eligibility control in the roster, PIN change via `teacher_change_pin` | Replaces all `sb.from(...).insert/update/delete` calls |
| **0.6 Port public views** | Course switcher (hidden with one course), reads from `enrollments`/`students`/`enrollment_results`, **tie handling**, **Bonus column fix**, realtime on new tables | Quirks §3.5 items 1, 2, 3 fixed |
| **0.7 Staging regression** | Full run of Appendix C checklist on staging, anon-probe script, owner walkthrough. **Also authors `005_security_lockdown`** (no earlier task owns it; it must re-grant every Phase-0 RPC) and dry-runs it on staging after the new client works | Gate for cut-over |
| **0.8 Production cut-over** | Runbook below | Short teacher-freeze window |
| **0.9 Cleanup** | `006_drop_legacy`: drop legacy columns on `students` (`days`, `bonus_units`, `sn`, `active`) **after 7 days** of stable operation | Until dropped, legacy columns are stale and must not be trusted |

**Phase-0 `recompute_result` note.** The reference function in §7.3 declares `private.attempts` variables, which do not exist until Phase 2, so it would fail at creation. Phase 0 ships a **lesson-only** version (status `eligible` / `not_eligible`, `lesson_pct`, no exam fields). Phase 2's migration `CREATE OR REPLACE`s it with the full version.

**Policy fix.** The §8.3 policy `read_students ... using (true)` would expose names of students whose only enrollments are inactive. Use instead:
```sql
create policy read_students on public.students for select to anon
  using (exists (select 1 from public.enrollments e where e.student_id = public.students.id and e.active));
```

### Production cut-over runbook (task 0.8)
1. Announce a **30-minute freeze** to teachers (no score entry).
2. Take a fresh backup/export of production.
3. Run `000`-`004` on production (additive; the old app still reads `students`).
4. Re-run the **idempotent copy step** from `001` so enrollments match the latest scores.
5. Merge the PR to `main` → Netlify deploys the new client.
6. Smoke test: unlock with the old PIN, open a student, save a score, add and delete a test student.
7. Run `005_security_lockdown` (also deletes the plaintext PIN row). From now on the old client cannot write.
8. Run the anon-probe (Appendix C) against production; all probes must be denied.
9. Owner changes the PIN to the new passphrase through the app.
10. Lift the freeze.

**Rollback (before step 7):** revert the merge on `main`, run `migrations/rollback/reverse_sync.sql` (copies `enrollments` scores back into `students`), reopen. **After step 7:** forward-fix only; the backup from step 2 is the last resort.

### Acceptance criteria, Phase 0
| ID | Criterion |
|---|---|
| AC-0.1 | Using only the public key, no table or function in `private` is reachable |
| AC-0.2 | Using only the public key, insert/update/delete on `students`, `enrollments`, `courses`, `enrollment_results`, `app_settings` all fail |
| AC-0.3 | No readable row contains the PIN or its hash |
| AC-0.4 | 5 wrong PINs lock login for 5 minutes with the specified message; a garbage token on any `admin_*` RPC returns `E_AUTH` |
| AC-0.5 | For every existing student, the lesson total shown in Directory, Leaderboard, and Full Sheet equals the pre-migration total |
| AC-0.6 | Tied scores share rank (1, 2, 2, 4); the Bonus column shows a number |
| AC-0.7 | Two simultaneous "add student" calls receive different S/N values |
| AC-0.8 | `admin_save_day` rejects a score above `day_max`, a negative bonus, and an out-of-range day index |
| AC-0.9 | Changing `day_count` or any scoring field with enrollments present requires confirmation and shows the affected count |
| AC-0.10 | The teacher token exists only in `sessionStorage`; closing the tab ends the session |
| AC-0.11 | Students whose enrollments are all inactive are not visible via the public key |
| AC-0.12 | Layout and behavior match the original at 360, 768, and 1280 px in light and dark mode (screenshot comparison) |
| AC-0.13 | A second course can be created from the UI with no code or SQL change, with its own unit label (e.g. "Week") and `day_count`; the portal shows the course switcher and every label uses the new unit label |
| AC-0.14 | An exam-only course (`lesson_mode = none`) can be created: weights are forced to 0/100, no score editor, grid, bonus column, or lesson badge is rendered; its enrollments follow the chosen eligibility rule |
| AC-0.15 | Changing `lesson_mode` after any score is recorded is rejected (`E_VALIDATION`); changing `unit_label` always works |
| AC-0.16 | `eligibility_rule = teacher_approved`: toggling *Approved for exam* flips an enrollment between `not_eligible` and `eligible`; `open` makes every active enrollment eligible; `all_units` behaves as in AC-0.5 |
| AC-0.17 | *Copy from…* copies settings, bands, and certificate settings into a new course and copies **no** students, scores, or approvals; reusing an existing course `code` is rejected |

## Phase 1: Exam builder

| Task | Deliverable |
|---|---|
| 1.1 | Migration `010_exam_tables` (§7.2 exam tables, indexes `one_live_per_exam`, `one_draft_per_exam`, `v_question_values`) |
| 1.2 | Migration `011_exam_builder_rpcs`: `admin_get_exam`, `admin_get_version`, `admin_create_draft`, `admin_save_draft`, `admin_discard_draft`, `admin_publish_version`, `admin_patch_text`; publish validation (§7.7) |
| 1.3 | Exams sub-tab: versions list, draft editor with autosave and `draft_rev` conflict handling (FR-X15/16) |
| 1.4 | Question editors for mcq, tf, fill, essay; reorder, duplicate, delete; computed question values |
| 1.5 | Preview as student (no attempt created) |
| 1.6 | Publish dialog with validation list |
| 1.7 | "Also copy the exam as a draft" option in *Create course from existing* (FR-C7) |

*Moved to Phase 3:* `admin_correct_key` (FR-X14) and fill-in re-grade, because they operate on attempts that do not exist until Phase 2.

| ID | Criterion |
|---|---|
| AC-1.1 | Public key cannot read any exam table or key |
| AC-1.2 | Publish is rejected, with a path-specific message, for each rule in §7.7 |
| AC-1.3 | A second draft cannot be created while one exists; at most one live version per course |
| AC-1.4 | A save based on a stale `draft_rev` returns `E_CONFLICT` and the UI offers reload |
| AC-1.5 | "New draft" copies the live version with new ids; the live version is untouched |
| AC-1.6 | Publishing retires the previous live version and sets `courses.exam_live = true` |
| AC-1.7 | `admin_patch_text` rejects any change to option ids or option count |
| AC-1.8 | Preview creates no attempt rows |
| AC-1.9 | Mixed Arabic/English prompts render with correct direction in editor and preview |
| AC-1.10 | Copying an exam into a new course yields a **draft** with new ids; the source exam and the new course's live state are untouched; rosters and attempts are not copied |

## Phase 2: Codes & taking the exam

| Task | Deliverable |
|---|---|
| 2.1 | Migration `020_codes_attempts` (§7.2 tables) + full `recompute_result`, `attempt_exam_pct`, `grade_*`, `normalize_answer`, `try_finalize`, `expire_attempts` |
| 2.2 | Migration `021_code_rpcs`: generate, bulk generate, revoke, clear lock, reset attempt |
| 2.3 | Migration `022_student_rpcs`: `exam_check/start/get_paper/save_answers/log_event/submit/get_result` |
| 2.4 | Expiry: `pg_cron` sweep each minute + lazy expiry in every token-based RPC |
| 2.5 | Codes sub-tab, code slips (print), eligibility statuses (FR-K1) |
| 2.6 | Student exam UI: entry, instructions, exam screen, autosave queue, timer, tab events, single-session, submit, result screen |
| 2.7 | `normalize.js` + browser test page using Appendix A vectors |
| 2.8 | Load test: 100 simulated students autosaving every 20 s for 60 minutes against staging |

**Implementation note, bulk generation.** bcrypt is deliberately slow. Generating hundreds of codes in one call can exceed the API statement timeout. `admin_generate_codes_bulk` therefore processes **at most 40 enrollments per call**, and the client loops until none remain.

| ID | Criterion |
|---|---|
| AC-2.1 | Code format and alphabet per FR-K8; only a bcrypt hash is stored; plaintext returned once |
| AC-2.2 | 5 wrong codes lock the enrollment for 10 min; the error never says which of name/code was wrong; teacher can clear the lock |
| AC-2.3 | An ineligible enrollment cannot get a code and cannot start (`E_NOT_ELIGIBLE`) |
| AC-2.4 | Calling `exam_start` again resumes the same attempt with a **new** token; the old token gets `E_SESSION_REPLACED` |
| AC-2.5 | Option order is identical across reloads of one attempt and differs between attempts; the client only ever sends option ids |
| AC-2.6 | A save arriving after `deadline + 15 s` is rejected; an expired attempt is auto-submitted even if the browser is closed |
| AC-2.7 | Network inspection of the whole flow shows no answer key and no other student's data |
| AC-2.8 | `exam_submit` is idempotent; double-clicking Submit produces one submission |
| AC-2.9 | Going offline for several minutes mid-exam, then reloading, loses at most the last few seconds of work |
| AC-2.10 | MCQ and fill grading match Appendix A vectors in SQL **and** JS |
| AC-2.11 | `reset attempt` supersedes the old attempt (kept) and allows exactly one new attempt; `regenerate` alone never allows a re-sit |
| AC-2.12 | Until an attempt is finalized, the student does not appear in exam-mode leaderboard |
| AC-2.13 | Bulk generation for 200 eligible enrollments completes via chunked calls with no timeout |
| AC-2.14 | Load test: no errors at 100 concurrent students; p95 save latency under 1 s |
| AC-2.15 | In a `teacher_approved` course, code generation and `exam_start` succeed only for approved enrollments; withdrawing approval blocks a *new* start but not an in-progress attempt |
| AC-2.16 | In an exam-only (`lesson_mode = none`) course, an eligible enrollment can sit the exam and `final` equals `exam%` |

## Phase 3: Marking, scoring & leaderboard

| Task | Deliverable |
|---|---|
| 3.1 | Migration `030_marking_rpcs`: `admin_marking_overview`, `admin_essay_answers`, `admin_attempt_detail`, `admin_mark_answer`, `admin_fill_review`, `admin_accept_fill_answer`, `admin_correct_key`, `admin_results`, mark override (FR-M6) |
| 3.2 | Migration `031_review_rpcs`: `exam_get_review`, extended `exam_get_result` |
| 3.3 | Marking sub-tab: overview, by-question and by-student essay marking, fill review |
| 3.4 | Results sub-tab: table, attempt detail (with tab-leave count and time away), **CSV export** |
| 3.5 | Student status page and answer review (FR-T12/T13) |
| 3.6 | Portal: exam-mode leaderboard, directory badges (final + band), Full Sheet Exam/Final columns |

**CSV safety:** any exported cell beginning with `=`, `+`, `-`, or `@` is prefixed with `'` so spreadsheet software cannot execute it as a formula (student-supplied text can reach the export).

| ID | Criterion |
|---|---|
| AC-3.1 | Scoring a student's last pending essay finalizes the attempt and updates the leaderboard within ~5 s |
| AC-3.2 | Final score equals the §5.4 formulas for the Appendix A worked examples |
| AC-3.3 | Accepting a fill-in answer re-grades every attempt of that version; teacher-marked answers are untouched |
| AC-3.4 | `admin_correct_key` requires confirmation showing affected attempts, re-grades auto-marked answers only |
| AC-3.5 | Review is unavailable until finalized and when `reveal_answers` is off (`E_NOT_READY` / `E_REVIEW_DISABLED`) |
| AC-3.6 | Exam mode lists only finalized students; ties share rank; empty state text per §9.5 |
| AC-3.7 | CSV opens correctly with Arabic text in Excel and Google Sheets; formula-leading cells are neutralized |
| AC-3.8 | Changing weights or pass mark shows the warning and recomputes live results |

## Phase 4: Certificates

| Task | Deliverable |
|---|---|
| 4.1 | Migration `040_certificates` (§7.2 tables) + `recompute_result` simplified (drop `to_regclass` guard) |
| 4.2 | Migration `041_certificate_rpcs`: list, approve (single/bulk), revoke, `get_certificate`, `verify_certificate` |
| 4.3 | Certificates sub-tab (approval and issued lists, missing-Arabic-name flags) |
| 4.4 | Certificate view with print stylesheet; QR via vendored library |
| 4.5 | `verify.html` + `_redirects` rule |
| 4.6 | Certificate settings UI: per-course (Course settings) and institution defaults (Institution sub-tab), with live preview; `admin_get/save_institution` |

**Precondition:** the production **custom domain** is configured before the first certificate is approved (O-8), because the verification URL is printed on every certificate.

| ID | Criterion |
|---|---|
| AC-4.1 | Number format `MMI-{CODE}-{YYYY}-{SEQ4}`; two simultaneous approvals never get the same number |
| AC-4.2 | Approval is blocked without `name_ar` (`E_NO_ARABIC_NAME`) |
| AC-4.3 | Snapshot is unchanged after later edits to weights, pass mark, bands, or exam versions |
| AC-4.4 | `verify_certificate` returns only name (EN/AR), course, date, band, status |
| AC-4.5 | Revoked certificates verify as "Revoked" and cannot be fetched by the student as valid |
| AC-4.6 | A student with a certificate cannot be deleted (`E_HAS_CERTIFICATE`) |
| AC-4.7 | The certificate prints on one A4 landscape page in Chrome, Edge, and Safari with correct Arabic shaping and no browser headers/footers |
| AC-4.8 | The QR code resolves to the verification page of that exact certificate |
| AC-4.9 | Two courses with different signatories, titles, and wording issue correct certificates at the same time |
| AC-4.10 | Field resolution is course → institution → built-in; clearing a course field falls back correctly |
| AC-4.11 | Unknown placeholders, over-length wording, a partial signatory block, and image paths outside `assets/` are rejected |
| AC-4.12 | Editing course or institution certificate settings (or the number prefix) never changes an already-approved certificate |

## Phase 5: Polish (optional items)

Bulk question import from pasted text · accessibility audit (keyboard and screen reader pass on every student screen) · performance pass · self-hosted fonts · optional "your result is ready" message link · README and teacher quick-start guide · backup and restore procedure documented.

---

# 12. Testing Strategy

| Layer | Method | Where |
|---|---|---|
| Database logic | Assert-style SQL files (`do $$ begin assert ...; end $$;`) run in the staging SQL editor; each phase adds a file | `tests/sql/` |
| Grading and normalization | Appendix A vectors run in SQL **and** in a browser test page; both must agree | `tests/sql/`, `tests/js/` |
| Access control | **Anon-probe:** a script using only the public key that attempts every forbidden read/write and expects denial | `tests/tools/` |
| Concurrency | Parallel calls for S/N assignment and certificate numbering | `tests/tools/` |
| Load | Simulated students (autosave every ~20 s) | `tests/tools/` |
| UI regression | Screenshot comparison at 360 / 768 / 1280 px, light + dark | manual + saved images |
| Devices | Android Chrome, iOS Safari 15+, desktop Chrome/Edge/Firefox/Safari | manual |
| Connectivity | DevTools offline and "Slow 3G" during an exam | manual |
| RTL | Mixed Arabic/English prompts, options, and answers on every exam screen | manual |

Every defect found in production gets a regression test added to the matching layer.

---

# 13. Backlog (explicitly out of v1)

System-parameters editing screen (v1: edit `private.system_params` by SQL, D-45) · image upload for logo/signature (v1: files committed under `/assets`) · Time-extension accommodations for individual students · matching and ordering question formats · question pools / randomized selection · per-teacher accounts · student accounts · server-generated PDF certificates · push or email notifications · multiple exams per course · proctoring · richer text (images, formulas) in questions · analytics dashboards · self-service enrollment.

---

# 14. Open Items, Risks, and Review Notes

## 14.1 Open items (none block Phase 0)

| ID | Item | Current default | Needed by |
|---|---|---|---|
| O-1 | Arabic spelling of signatory (institution default) | موسى أمينو محمد 🟡 | Phase 4 |
| O-2 | Signature image, or printed name only (institution default; per-course override possible) | Printed name only 🟡 | Phase 4 |
| O-3 | Logo file (SVG or high-res PNG), to be committed under `/assets` | none | Phase 4 |
| O-4 | Certificate wording and **grammatical gender** in the default Arabic text (all-male cohort, or mixed?). Wording is now editable per course, so this only sets the default | Masculine forms 🟡 | Phase 4 |
| O-5 | Confirm D-33 privacy (only final score + band public) | As written 🟡 | Phase 3 |
| O-6 | New passphrase to replace `2026` | Owner chooses; never pasted into chat | Phase 0 cut-over |
| O-7 | Tell students that leaving the exam page is logged (recommended for transparency, no penalty) | Disclose 🟡 | Phase 2 |
| O-8 | **Custom domain** for production before issuing certificates (the printed verification URL must stay valid) | none yet | Phase 4 |
| O-9 | Staging Supabase project created | ✅ done (staging URL and publishable key in `js/config.js`) | Phase 0.0 |
| O-10 | **Production hostname** (where the live portal is served) so `config.js` can use a `PRODUCTION_HOSTS` allow-list (§10.2) | Unknown hosts currently resolve to production (v3.6 deviation) | Before task 0.8 |

Confirmed this session: staging project will be created (D-37); defaults for the first course accepted (ADAB, 50/50, pass 60%, 60 minutes, bands 90/80/70/pass); hosting recommendation Netlify pending owner agreement (D-36).

## 14.2 Risks (additions to v2 §15)

| Risk | Mitigation |
|---|---|
| Scores diverge between old app and new tables during cut-over | Short freeze, idempotent re-copy step, reverse-sync rollback script |
| bcrypt makes bulk code generation time out | Chunks of ≤ 40 per call |
| CDN outage or floating dependency version breaks the portal | Vendor pinned `supabase-js` |
| Verification URL printed on certificates breaks if the domain changes | Custom domain before first approval (O-8) |
| Anyone can trigger the 5-minute teacher login lockout by guessing | Accepted; strong passphrase, short lockout; optional per-IP throttling later |
| SQL errors on production | Staging first, backup before each migration, one migration per run |
| Preview deploys touching live data | Hostname-based environment selection (§10.2) |
| CSV export used to inject spreadsheet formulas | Neutralize leading `= + - @` (Phase 3) |

## 14.3 Change log
### v3.9 (session 10: rollback script; branch `phase0/0.5-0.6-port`)
1. **Gap closed:** `migrations/rollback/reverse_sync.sql` now exists (v3.8 item 8). Mirror of `private.sync_legacy_students()`: copies `sn`, `days`, `bonus_units`, `active` of every ADAB enrollment into `students`. Names are not copied (they already live in `students`). Single DO block, so atomic; idempotent; verified by `tests/tools/reverse_sync_roundtrip.sh`. Preconditions that make it refuse: `005` applied (anon has lost write on `students`); ADAB not `scored` / 10 units / max 10 / bonus 2 (the old client hard-codes these, so copying would corrupt scores); malformed arrays.
2. **Hazard found in `private.sync_legacy_students()` (001), FIXED in this version (owner: "proceed"):** it enrols **every** `students` row into ADAB. At the first cut-over that is correct (all legacy rows are ADAB students). After a rollback, a second run of step 4 would also enrol students that the new client created for **other** courses (their `students` row exists because `admin_add_student` writes one). Fix applied in `001`: a student with no ADAB enrollment but with an enrollment in another course is skipped (legacy students with no enrollment, and students already in ADAB, are copied as before); `create or replace`, so re-running `001` on staging is safe. Covered by `tests/tools/reverse_sync_roundtrip.sh` (T4).
3. **Harmless normalisation:** legacy bonus `-1` ("unset", written by `admin_add_student`) becomes `0` after the forward copy and stays `0` after the reverse copy. The old client treats both as "no bonus" (`daysFromDb` maps `-1` to null, then `|| 0`), so the first reverse run touches those rows once.
4. **`migrations/006_drop_legacy.sql` authored and tested** (session 10). One transaction; refuses unless `005` is applied; redefines `private.add_student_enrollment` (the only writer of the legacy columns) without them; drops `private.sync_legacy_students`; drops `students.sn/days/bonus_units/active`; reads the catalog back (`students` must be exactly `id,name,name_ar`). Idempotent. Local runner now applies it after `005` (twice) and re-runs the lockdown test, including the full teacher workflow as anon, and the S/N concurrency test on the slim table; the lockdown test fixture works before and after `006`. Run it >= 7 days after cut-over, after a backup.
### v3.8 (session 9: task 0.7 authoring; branch `phase0/0.5-0.6-port`)
1. **`005_security_lockdown.sql` as built.** One transaction. *Preflight* refuses to run if the `004` policies, the PIN hash or any of the 16 RPCs is missing (a missing hash would lock every teacher out once the plaintext row is deleted). Then: revoke all on public tables and sequences from `anon`/`authenticated`, `SELECT` on exactly the four public read tables, RLS on every public and private table (unexpected extra public tables are locked, not skipped), blanket `EXECUTE` revoke then 16 explicit grants, default privileges for future objects revoked (`postgres`, current role, `supabase_admin` where allowed), plaintext `teacher_pin` row deleted. *Post-conditions* are read back from the catalog (`has_table_privilege`, `has_function_privilege` including the PUBLIC pseudo-grant, `pg_class.relrowsecurity`) and any mismatch RAISES, rolling back everything. Idempotent: re-running it also revokes anything granted in the meantime (tested with a planted leak).
2. **Defect in the test tooling (mine): the local shim was unrealistically closed.** Real Supabase grants `anon`/`authenticated` everything on every new public table, sequence and function; the shim granted nothing, so any "anon cannot write" test passed vacuously. `tests/tools/supabase_shim.sql` now mimics those default ACLs. This immediately exposed that `phase0_public_access.test.sql` (T0.17) only simulated half of `005` (the `GRANT`, not the `REVOKE`); it now does both.
3. **Defect in the probe (mine): a mistyped URL made every probe "pass".** A bare 404 was treated as denial, but a wrong URL is also a 404 (`PGRST125`). Fixed: only permission / not-in-schema-cache codes count as denial, and a canary aborts with exit 2 if the URL is not a PostgREST root. The REST prefix is `/rest/v1` on Supabase; `PROBE_REST_PATH=''` for a bare local PostgREST.
4. **Probe safety property (verified):** it cannot change data even against an unlocked database (inserts send `{}` and violate NOT NULL; updates/deletes use a filter that matches nothing; admin RPCs get an all-zero id and a bad token; `teacher_login` is never called because a wrong PIN counts toward the real teacher's lockout). Checked by hashing every table before and after a run against an unlocked database with a plaintext PIN: identical. It refuses a key that looks like `service_role`.
5. **`tests/sql/phase0_lockdown.test.sql`:** catalog state; anon reads only active rows (AC-0.11); anon writes denied on all five tables incl. TRUNCATE (AC-0.2); private unreachable (AC-0.1); 12 admin RPCs x 3 bad tokens = `E_AUTH` (AC-0.4); and the **whole teacher workflow executed as `anon`** (login, create course, add/bulk-seed/rename/score/approve/deactivate/reactivate/archive/delete, PIN change, logout), which proves RLS plus revoked grants do not break the `security definer` RPCs or the recompute triggers. Fails if `005` is not applied (checked). Rolled back; staging-safe, no meta-commands.
6. **Runner order:** `run_local_tests.sh` applies `005` only after the pre-lockdown tests (several assert the `000`-`004` state), applies it twice, runs the lockdown test, then re-runs the parallel S/N test against the locked database.
7. **What this does NOT prove (do on staging):** the local Postgres runs migrations as a superuser (Supabase's `postgres` is not; both bypass RLS as table owner provided RLS is not FORCEd, which T0.18 asserts); local PostgREST has no Supabase gateway (no key-to-role mapping, no `/rest/v1`, OpenAPI exposure differs, probe item 7 may SKIP); **live Realtime with RLS on has not been exercised** (the `students` policy now evaluates a sub-select per event); the lockdown test has not been pasted into the real SQL editor. Extension-owned functions in `public` on a real project could make the `REVOKE` warn; the post-check would then name them and roll back.
8. **Gap found:** `migrations/rollback/reverse_sync.sql` is named in §11 (rollback) and D.1 but does not exist in the repo. It must exist before task 0.8.
### v3.7 (session 8: tasks 0.5 + 0.6, client port; branch `phase0/0.5-0.6-port`)
1. **Incident and rule.** PR #3 merged a WIP checkpoint into `main` ("NOT main... Do not merge"), leaving 5 of 9 modules on the old API and 12 imports unresolved, so the live portal could not load. Reverted (`63a592b`). Rule: before any merge or push to `main`, run `tests/client` and the import check; never merge a WIP commit.
2. **Module layout as built:** `api.js` (client, `rpc()` wrapper, `ApiError`, error map, sessionStorage token, `teacher-expired` event, `fetchAll`), `data.js` (courses + rows; public reads use explicit columns and active rows only; a teacher gets `admin_list_roster`; newest load wins), `courses.js` (new), `state.js` (`state.rows` = one normalized row per **enrollment**, plus `rankRows`, `lessonPoints`, `normalizeRow`), `ui.js` (+ promise-based `confirmDialog`, `setHint`, `unitHtml`).
3. **Identity rule.** Rows are keyed by *enrollment id* (`row.id`); person-level calls use `row.studentId`. Rename, Arabic name and delete act on the person: delete removes the student from **every** course (the confirm text says so); inactivate acts on the enrollment.
4. **Behavior added or fixed:** server login with 5-attempt lockout message; session resume via `teacher_ping` after reload; `E_AUTH` from any admin call locks teacher mode and says why; PIN change via `teacher_change_pin` (client minimum 4, 6+ recommended in the hint); S/N assigned by the DB (AC-0.7 path); duplicate-name warning; bulk seed `Name | Arabic`; Arabic-names screen (FR-R5); enroll existing student (FR-R2); eligibility line and *Approve for exam* (FR-C9); course settings with create-blank / copy-from / archive and the confirm-with-count flow (AC-0.9, shrinking `day_count` warns that scores are deleted); course switcher (hidden with one selectable course; teachers also see archived ones); unit labels everywhere (FR-C10, Arabic label shown beside the English one); tie-aware ranks 1,2,2,4 (D-26); Bonus column shows bonus points (§3.5 #1); "Loading…" until the first load; realtime on the four public tables, 500 ms debounce, refetching only the selected course (repaints only data-driven parts so typed form text survives).
5. **Deliberately not in 0.5/0.6** (their phases own them): exam-mode leaderboard, exam %/final columns, band and certificate indicators, status chips (Phases 2-4). `reveal_answers` and `cert_settings` are not sent by the course form, so the server keeps existing values. The course `code` is read-only after creation.
6. **Verification and its limit.** `tests/client` (jsdom + in-memory fake of the REST/RPC API, 85 assertions): public views, ties, login/lockout/resume/expiry, every roster RPC, score validation, course create/copy/exam-only/archive, PIN change, delete incl. certificate block, network failure, and that **no direct table write is ever issued**. ESLint `no-undef` clean. The fake re-implements `002`/`003` by hand: it proves the client calls the RPCs correctly, not that the SQL is right. Not covered: real browser layout, live Realtime, real Postgres, hence task 0.7 on staging.
7. **Config note:** a Netlify deploy preview or branch deploy has `--` in its hostname and therefore uses **staging** (v3.6 deviation); the production domain would use production and fail until `000`-`004` are applied there.

### v3.6 (session 7: task 0.4, modular client)
1. **Module layout as built:** `css/base.css`; `js/config.js` (environments, constants), `api.js` (client only; the `rpc()` wrapper of §10.3 arrives with task 0.5), `state.js` (shared `state` object plus pure data helpers `computeTotal`, `daysToDb`, `daysFromDb`, `normalizeStudent`, `nextSN`), `ui.js` (status banner, icon, escaping), `portal.js`, `scores.js`, `auth.js`, `roster.js`, `main.js` (data loading, realtime, tab routing, bootstrap). `courses.js` and the later modules are created in their own tasks. `index.html` has no inline script or style.
2. **Shared mutable state became `state.<name>`.** ES modules cannot reassign an imported `let`, so `allStudents`, `students`, `entryOpenId`, `renamingId`, `teacherUnlocked`, `pendingConfirm`, `seedingInProgress`, `teacherPin`, `editingStudentId` and `editingDayIndex` live on one exported object. Rule for later tasks: never destructure these into locals that outlive an `await`.
3. **Module cycles are intentional and safe:** `main`, `auth`, `portal`, `scores` and `roster` import each other's *function declarations* (used only at call time). Do not export or read a non-function binding across that cycle at module top level. `config.js`, `ui.js` and `state.js` have no cycles.
4. **Environment selection deviates from §10.2 for now** (see §10.2 and O-10). Staging shows a red `staging` badge in the header; production renders exactly as before.
5. **Vendored `supabase-js` 2.117.2** bundled to one minified ES module (`vendor/README.md` documents the rebuild). The previous floating `@2` CDN import is gone.
6. **Verification method and its limit.** A jsdom harness (outside the repo) ran the original inline script (CDN import pointed at the vendored bundle) and the new modules against the same fake PostgREST backend through 35 scripted steps (search, modals, wrong and right PIN, add, bulk seed, rename, inactivate, score editor incl. invalid and cleared values, PIN change, delete, lock). All snapshots, every request (method, URL, body, key) and the final data were byte-identical; ESLint `no-undef` is clean. Not covered: real-browser layout, CSS loading and fonts, and live Realtime delivery, hence the owner's AC-0.12 screenshot step. Note the original's known races (client-side `nextSN`, no tie handling, raw bonus array) are preserved on purpose; they are fixed in 0.5/0.6.
7. **PRD fix:** the §11 task table referred to the screenshot criterion as AC-0.13; it is AC-0.12 (AC-0.13 is the second-course criterion).

### v3.5 (session 5: task 0.3, `004_public_access`)
1. **PRD policy SQL was broken.** `read_students ... where e.student_id = id` binds `id` to `enrollments.id`; Postgres rejects it at creation (`operator does not exist: text = uuid`). Verified. Fixed in §8.3, §11 and `004` by qualifying columns (`public.students.id`, `public.enrollment_results.enrollment_id`). Rule: in policy and subquery SQL, always qualify columns whose names exist in both tables.
2. **Policies are created in `004` but inert:** RLS is enabled only by `005`. `tests/sql/phase0_public_access.test.sql` turns RLS on inside a rolled-back transaction and proves AC-0.11 (inactive-only students hidden), that only active enrollments and their results are visible, and that anon cannot write.
3. **Realtime:** `004` adds `students`, `enrollments`, `courses`, `enrollment_results` to `supabase_realtime` if not already there (skips cleanly if the publication is absent or FOR ALL TABLES).
4. **Task ownership gap closed:** `005_security_lockdown` is authored in task 0.7 (§11 table).
5. **Tests** `phase0_roster` and `phase0_public_access` have no psql meta-commands (SQL-editor friendly, unverified there); `phase0_core` remains local-only (README).

### v3.4 (session 5: task 0.2, `003_roster_rpcs`; the defect below was caught by `tests/sql/phase0_roster.test.sql`)
1. **A guarded reference to a future table still fails at plan time.** `to_regclass('private.attempts') is not null and exists (select ... from private.attempts ...)` errors with "relation does not exist" in Phase 0, because PL/pgSQL plans the whole statement. The FR-C8 lesson-mode lock therefore checks attempts through `execute` (dynamic SQL). Rule for later migrations: never reference a not-yet-created table statically, even behind a guard.
2. **API contract choices fixed by `003`:** `admin_save_day.p_day_index` is **zero-based** (matches the JS arrays); `admin_save_course` returns `{course, affected}`; `admin_add_student` returns `{enrollment_id, student_id, sn, duplicate_name}`; `admin_bulk_seed` returns `{added, skipped[], invalid[]}`; `admin_save_day` returns `{days, bonus_units, lesson_pct, status}`. `E_CONFIRM_REQUIRED` fires for changes to units, max score, bonus value, lesson max, weights, pass mark, eligibility rule or lesson mode when enrollments exist (detail = count); grade bands, names, unit labels and `reveal_answers` never need confirmation.
3. **Legacy columns for new students:** `students.sn` mirrors the numeric part of the new id and the legacy arrays are written as unset, so a legacy NOT NULL constraint holds. These columns are stale by design (v3.1 #7) and dropped in `006`.
4. `p_copy_exam` is accepted and ignored until Phase 1. Certificate-settings content validation (FR-V7) arrives in Phase 4; Phase 0 only requires a JSON object.
5. New system parameter `bulk_seed_max_lines` (Appendix D.3).
6. `tests/README.md` corrected: SQL tests are psql scripts, `phase0_core` is local-only (it changes the PIN), `phase0_roster` rolls back and is staging-safe.

### v3.3 (session 4: defects found while implementing task 0.1; all covered by `tests/sql/phase0_core.test.sql`)
1. **`private.fail()` broke on a null detail.** `RAISE ... DETAIL = NULL` errors in Postgres, so every bare `fail('E_AUTH')` surfaced as "RAISE statement option cannot be null" instead of `E_AUTH`. Fixed with `coalesce(p_detail,'')`.
2. **Login throttling never persisted.** The reference `teacher_login` updated the failure counter and then raised `E_AUTH`; the raise rolled the update back (verified: 0 rows after 6 failures), so the 5-failure lockout could not trigger. Failure paths now return `{ok:false,error,detail}` (§7.1 convention). Wrong current PIN in `teacher_change_pin` also feeds the throttle.
3. **Cut-over order weakened the live app.** `002` deleted the plaintext PIN at runbook step 3, while the old client (live until step 5) falls back to `2026` when the row is missing. Deletion moved to `005`.
4. Added `private.sync_legacy_students()` (idempotent copy, used at cut-over step 4) and revoked write access on the new public tables immediately (before `005`).

### v3.2 (flexibility, requested by owner in session 3)
1. **Unit label per course** (D-41, FR-C10): "Day" is no longer hardcoded in UI text.
2. **Lesson mode and eligibility rule per course** (D-42, FR-C8/C9): supports exam-only courses and teacher-approved eligibility; new `exam_approved` on enrollments; result state `not_eligible` renamed **`not_eligible`**.
3. **Per-course certificate settings with institution defaults** (D-43, FR-V7/V8): title, wording, signatory, signature image, logo; certificate number prefix is institution-wide; resolved values frozen in the snapshot.
4. **Create course from existing** (D-44, FR-C7): settings copy now, exam-draft copy from Phase 1.
5. **System parameters table** (D-45, Appendix D.3): limits centralised so no code change is needed to tune them.
6. Added AC-0.13 to AC-0.17, AC-1.10, AC-2.15/2.16, AC-4.9 to AC-4.12; Appendix A vectors A-65/A-66; Appendix B resolution rules.

### v3.1 (review fixes)
1. **Migration numbering** was inconsistent (`007` lockdown ran in Phase 0 but sat after Phase 1-2 files). Migrations are now numbered by phase (Appendix D); the headings in §7 and §8.3 were updated.
2. **`recompute_result`** referenced Phase 2 tables and would fail in Phase 0. Phase 0 now ships a lesson-only version (§11).
3. **`read_students` policy** exposed inactive students; replaced (§11, Phase 0).
4. **`admin_correct_key`** and fill-in re-grade moved from the builder to Phase 3, since they need attempts.
5. **`exam_check`** returns exam *metadata* (title, duration, counts, instructions) before Start, never questions; FR-T15 is read as "no question content before Start".
6. **Bulk code generation** chunked (§11, Phase 2).
7. **Legacy `students` columns** stay stale after cut-over and are dropped in `006` after 7 days; nothing may read them meanwhile.

---

# Appendix A: Test Vectors

These vectors are the contract for `private.normalize_answer`, `grade_mcq`, `grade_fill`, and the scoring formulas. **SQL and JS must both pass every row.** They were verified against a reference implementation when this PRD was written.

## A.1 Answer normalization

Default `tm_equiv = false` unless stated.

| # | Input | Expected output | Rule exercised |
|---|---|---|---|
| A-1 | `"  The   Quick  "` | `the quick` | trim, collapse spaces, lowercase |
| A-2 | `"HELLO"` | `hello` | case-insensitive |
| A-3 | `"مُحَمَّدٌ"` | `محمد` | tashkeel stripped |
| A-4 | `"الـــرحمن"` | `الرحمن` | tatweel stripped |
| A-5 | `"أحمد"`, `"إحمد"`, `"آحمد"`, `"ٱحمد"` | all `احمد` | alef variants |
| A-6 | `"مصطفى"` | `مصطفي` | alef maqsura → ya |
| A-7 | `"١٢٣"` | `123` | Arabic-Indic digits |
| A-8 | `"Surah ٢"` | `surah 2` | mixed text and digit |
| A-9 | `"مدرسة"` | `مدرسة` | ta marbuta kept by default |
| A-10 | `"مدرسة"` with `tm_equiv = true` | `مدرسه` | ة → ه when enabled |
| A-11 | `"مدرسه"` with `tm_equiv = true` | `مدرسه` | equals A-10 |
| A-12 | `"  Al-Adab   الآداب "` | `al-adab الاداب` | mixed script, آ → ا |
| A-13 | `""` | `` | empty |
| A-14 | `null` | `` | null treated as empty |
| A-15 | `"الصَّلاة"` | `الصلاة` | shadda + fatha stripped |

**Known limitation and recommendation (🟡).** Text pasted from PDFs or some websites may contain Arabic *presentation forms* (U+FE70-FEFF), e.g. `"اﻟﺼﻼة"`, which the PRD's reference function leaves unchanged, so it would not match `"الصلاة"`. Recommended: apply Unicode **NFKC** as the first step in both SQL (`normalize(t, NFKC)`) and JS (`String.prototype.normalize('NFKC')`). With it:

| # | Input | Expected |
|---|---|---|
| A-16 | `"اﻟﺼﻼة"` (contains U+FEDF U+FEBC U+FEFC) | `الصلاة` |

Hamza on waw/ya (ؤ, ئ) and bare hamza (ء) are intentionally **not** unified; the teacher adds accepted variants through the fill-in review queue.

## A.2 MCQ grading: `fraction = max(0, (correct − wrong) ÷ n_correct)`

| # | Correct set | Selected | Expected fraction |
|---|---|---|---|
| A-20 | {a, c} | {a, c} | 1.0 |
| A-21 | {a, c} | {a} | 0.5 |
| A-22 | {a, c} | {a, b} | 0 |
| A-23 | {a, c} | {a, b, d} | 0 (floored) |
| A-24 | {a, c} | {} | 0 |
| A-25 | {b} | {b} | 1.0 |
| A-26 | {b} | {a} | 0 |
| A-27 | {b} | {a, b} | 0 |
| A-28 | {a, b} | {a, b, c} | 0.5 |
| A-29 | {a, b, c} | {a, b} | 0.667 (2 ÷ 3) |
| A-30 | {a, c} | {a, a, c} (duplicate id) | 1.0 (duplicates counted once) |

Worked points: a 5-point question with selection {a} on correct set {a, c} earns **2.5**.

## A.3 Fill-in grading
| # | Accepted | Response | Expected |
|---|---|---|---|
| A-40 | [`الصلاة`] | ` الصَّلاة ` | 1 |
| A-41 | [`Prayer`, `Salah`] | `salah` | 1 |
| A-42 | [`الصلاة`] | `` | 0 (empty never matches) |
| A-43 | [`مدرسة`], `tm_equiv=false` | `مدرسه` | 0 |
| A-44 | [`مدرسة`], `tm_equiv=true` | `مدرسه` | 1 |

## A.4 Question value and exam percentage
| # | Setup | Expected |
|---|---|---|
| A-50 | Section weight 40, 8 questions | each question = 5.0 points |
| A-51 | Section weight 30, 4 questions; sections 40 + 30 + 30 | total 100; weights valid |
| A-52 | Weights 40 + 30 + 20 | publish rejected (sum 90) |
| A-53 | Earned fractions 1, 0.5, 0 on three 5-point questions | exam points 7.5 of 15 |

## A.5 Combined score, pass, band
| # | Lessons (days + bonus) | Exam % | Split L/E | Expected final |
|---|---|---|---|---|
| A-60 | days 86, no bonus (`lesson_max` 100) | 72 | 50/50 | **79.0** |
| A-61 | same | 72 | 60/40 | **80.4** (51.6 + 28.8) |
| A-62 | days 95 + 3 bonus units × 2 = 101 | 70 | 50/50 | lesson capped at 100 → **85.0** |
| A-63 | days 90 + 5 bonus units × 2 = 100 | 80 | 50/50 | **90.0** → band Excellent (≥ 90) |
| A-64 | any | any | pass mark 60 | final 59.99 → **not passed**, no band; 60.00 → passed, band "Pass" |
| A-65 | `lesson_mode = none` (weights 0 / 100), no lesson units | 72 | 0/100 | **72.0** (`final = exam%`) |
| A-66 | `eligibility_rule = teacher_approved`, 5 of 10 units marked, approved by teacher | n/a | n/a | status `eligible` (rule met); the count of marked units is irrelevant under this rule |

Bands use the highest band whose `min ≤ final`.

## A.6 Ranking ties
Scores 90, 85, 85, 70 → ranks **1, 2, 2, 4**.

## A.7 Attempt timing
Attempt started 10:00:00, 60-minute exam → `deadline_at` 11:00:00. Save at 11:00:14 accepted. Save at 11:00:16 rejected (`E_ATTEMPT_CLOSED`).

---

# Appendix B: Certificate Content & Layout

## B.1 Format
A4 **landscape** (297 × 210 mm), single page, printable from the browser (`@page { size: A4 landscape; margin: 0 }`) and savable as PDF via the print dialog. Content is rendered from the stored **snapshot** (§7.4), never from live data.

## B.2 Elements (top to bottom)
1. Border: thin gold outer rule, emerald inner rule, corner ornaments (inline SVG, no images required).
2. Logo (centered, top; resolved `logo` setting) and institution lines: **معهد مفتاح العلم** (Amiri) and "Ma'had Miftah al-'Ilm".
3. Title: resolved `title` / `title_ar` (built-in default: **شهادة إتمام** / "Certificate of Completion").
4. Arabic wording block, then English wording block (below).
5. Student name, large: Arabic (Amiri) above, Latin (Inter) below.
6. Course: **الآداب العشرة | Al-Aadaab Al-Asharah**.
7. Result line: final score (one decimal) and grade band, Arabic and English.
8. Footer row, three columns:
   - Left: issue date, certificate number (`MMI-ADAB-2026-0007`).
   - Center: QR code + short text "Verify at <host>/verify/<number>".
   - Right: signature block: resolved signatory block (signature image if provided) · default: **موسى أمينو محمد** · "Musa Aminu Muhammad" · **المشرف** / "Mushrif".

## B.3 Built-in default wording (🟡, see O-4); editable per course (FR-V7)
- **English:** "This is to certify that **{name}** has successfully completed the course **{course}** with a final score of **{score}%** ({band})."
- **Arabic (masculine default):** "يشهد معهد مفتاح العلم بأن **{name_ar}** قد أتمّ بنجاح دورة **{course_ar}** بدرجة نهائية قدرها **{score}٪** وتقدير **{band_ar}**."

Arabic grammatical gender must be settled with the owner (O-4) before Phase 4; if the cohort is mixed, the snapshot needs a `gender` value or a neutral phrasing.

## B.3.1 Setting resolution
| Field | 1st: course `cert_settings` | 2nd: institution default | 3rd: built-in |
|---|---|---|---|
| title / title_ar | if set | `certificate_defaults.title(_ar)` | "Certificate of Completion" / شهادة إتمام |
| wording / wording_ar | if set | `certificate_defaults.wording(_ar)` | B.3 text |
| signatory (whole block) | if set (all four fields) | `certificate_defaults.signatory` | none (approval blocked until one exists) |
| logo, signature_image | if set | `certificate_defaults.logo` / `.signature_image` | no image |
| number prefix | n/a | `number_prefix` | `MMI` |
| institution name EN/AR | n/a | `institution` | Ma'had Miftah al-'Ilm / معهد مفتاح العلم |

Allowed placeholders in wording: `{name} {name_ar} {course} {course_ar} {score} {band} {band_ar} {date}`. Replacement values are inserted as escaped text.

## B.4 Print rules
- `print.css` hides everything except the certificate root; colors forced with `-webkit-print-color-adjust: exact`.
- Fonts must be loaded before `window.print()` (await `document.fonts.ready`).
- Arabic text uses `dir="rtl"` on its blocks; numerals in the Arabic line may use Arabic-Indic digits (🟡 configurable).
- The certificate is shown in an in-app overlay; the student's code stays in memory only (§8.4).

---

# Appendix C: Verification Checklists

## C.1 Anon-probe (run against staging, then production, after lockdown)
Script: `node tests/tools/anon_probe.mjs <SUPABASE_URL> <PUBLISHABLE_KEY>` (Node 18+, no dependencies; exit 0 = all denied, 1 = a probe failed, 2 = could not run). It implements items 1-5 and 7 below, cannot change data even if the lockdown is missing, and prints `SKIP` for items that need later phases. Item 6 (wrong exam code) arrives with Phase 2.
Using only the publishable key, every item must be **denied or empty**:
1. Read any `private.*` table; call any `private.*` function.
2. `insert/update/delete` on `students`, `enrollments`, `courses`, `enrollment_results`, `app_settings`.
3. `select` from `app_settings` returns nothing; no `teacher_pin` anywhere.
4. Call any `admin_*` RPC with no token, an empty token, and a random token → `E_AUTH`.
5. Read inactive students or their enrollments.
6. Call an `exam_*` RPC with a wrong code → generic `E_AUTH`; five times → `E_LOCKED`.
7. (Phase 1+) read any exam table or `question_keys`.
8. (Phase 2+) `exam_get_paper` response contains no key fields; no other student's answers are reachable.

## C.2 Phase 0 regression checklist (staging, then after cut-over)
| Area | Check |
|---|---|
| Public | Directory search; student modal; Leaderboard order and ties; Full Sheet columns (Bonus is a number) |
| Data | Totals for all students equal the pre-migration export (script comparison) |
| Teacher | Unlock with PIN; wrong PIN message; 5-failure lockout; lock mode; reload keeps session in the same tab only |
| Scores | Save a day (score + bonus); invalid values rejected; totals update everywhere |
| Roster | Add student; duplicate-name warning; bulk seed with `Name | الاسم`; rename; Arabic name; inactivate/reactivate; delete with confirm |
| Courses | Create a second course (blank and copy-from); edit settings, unit label, lesson mode, eligibility rule; `day_count` change shows affected count and resizes arrays |
| PIN | Change PIN; old sessions invalidated |
| Realtime | Edit in one browser, see the update in another within seconds |
| Look | Screenshots at 360 / 768 / 1280 px, light and dark, match the original |
| Env | Staging badge visible on previews; production shows none |

---

# Appendix D: Migrations, Deployment Files, and Hardening

## D.1 Migration order (renumbered by phase in v3.1)

| File | Phase | Contents | Notes |
|---|---|---|---|
| `000_setup.sql` | 0 | extensions, `private` schema, `private.fail`, `system_params` + `param()` | |
| `001_courses_enrollments.sql` | 0 | courses (incl. v3.2 columns), enrollments, `enrollment_results`, `institution_settings` + seed, seed `ADAB`, copy students → enrollments | Copy step is idempotent (re-run at cut-over) |
| `002_auth.sql` | 0 | secrets, sessions, throttle (+ helpers), `require_teacher`, `teacher_login/logout/ping/change_pin`, PIN hashing | Plaintext row is **kept** (live client needs it); removed by `005`. If no PIN row existed, hash `2026` and rotate immediately |
| `003_roster_rpcs.sql` | 0 | course/roster/score RPCs, lesson-only `recompute_result`, triggers, backfill | Idempotent. `p_day_index` is zero-based. New students get id `s<max+1>` and filled legacy columns; no `students.sn` collisions |
| `004_public_access.sql` | 0 | realtime publication, read policies (prepared) | Idempotent. Policies exist but RLS stays off until `005`; skips the publication step with a notice if `supabase_realtime` is absent |
| `005_security_lockdown.sql` | 0 | revoke/RLS/grants (§8.3), **delete plaintext `teacher_pin` row**, re-grant `execute` on every Phase-0 RPC after the blanket revoke | **Run last in Phase 0**, after the new client is live |
| `006_drop_legacy.sql` | 0 | drop legacy `students` columns | ≥ 7 days after cut-over |
| `010_exam_tables.sql` | 1 | exams, versions, sections, questions, keys, values view | |
| `011_exam_builder_rpcs.sql` | 1 | builder RPCs, publish validation | |
| `020_codes_attempts.sql` | 2 | codes, attempts, answers, events; full `recompute_result`; grading/normalize | |
| `021_code_rpcs.sql` | 2 | generate (chunked bulk), revoke, clear lock, reset | |
| `022_student_rpcs.sql` | 2 | `exam_*` student RPCs, expiry, pg_cron schedule | Enable `pg_cron` first |
| `030_marking_rpcs.sql` | 3 | marking, fill review, correct key, results | |
| `031_review_rpcs.sql` | 3 | `exam_get_review`, extended `exam_get_result` | |
| `040_certificates.sql` | 4 | certificates, counters | |
| `041_certificate_rpcs.sql` | 4 | list/approve/revoke/get/verify, `admin_get/save_institution` | |
| `rollback/reverse_sync.sql` | 0 | enrollments → legacy students | Rollback only before `005` |

Each lockdown-related grant for a new RPC is added in the **same migration that creates it** (explicit `grant execute ... to anon`), since §8.3 revokes execute by default.

## D.2 Netlify files

`_redirects`
```
/verify/*   /verify.html   200
```

`netlify.toml`
```toml
[build]
  publish = "."
  # no build command: static files only
```

`_headers` (starting point; tighten after Phase 0 when inline scripts are gone)
```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```
`'unsafe-inline'` remains for **styles** only, because the existing UI uses inline `style` attributes. Scripts are external modules, so no `'unsafe-inline'` for scripts. If `supabase-js` is vendored (D-39), no CDN host is needed in `script-src`.

## D.3 System parameters (D-45)
Fixed defaults in v1, centralised in `private.system_params` and read with `private.param(key, default)`. To change one, insert/update a row in the SQL editor; no deploy needed.

| Key | Default | Used by |
|---|---|---|
| `teacher_login_max_failures` | 5 | `teacher_login` |
| `teacher_lock_minutes` | 5 | `teacher_login` |
| `teacher_session_hours` | 8 | `teacher_login` |
| `enrollment_max_failures` | 5 | `exam_check/start` |
| `enrollment_lock_minutes` | 10 | `exam_check/start` |
| `attempt_grace_seconds` | 15 | `exam_save_answers`, `expire_attempts` |
| `code_length` | 8 | code generation (alphabet fixed, FR-K8) |
| `code_bulk_chunk` | 40 | `admin_generate_codes_bulk` |
| `pin_min_length` | 4 | `teacher_change_pin` |
| `max_events_per_attempt` | 200 | `exam_log_event` |
| `max_fill_chars` / `max_essay_chars` | 500 / 20000 | `exam_save_answers` |
| `bulk_seed_max_lines` | 1000 | `admin_bulk_seed` |

## D.4 Hardening checklist
- Strong passphrase at cut-over (O-6).
- Separate staging and production projects (D-37); deploy previews use staging.
- Backup/export before every migration; one migration file per run.
- Repo contains no secrets: only publishable keys. A `.gitignore` excludes `.env*`.
- Branch protection on `main` (PR required) once the first PR is merged.
- Supabase: confirm `pg_cron` and daily backups are enabled before Phase 2.
