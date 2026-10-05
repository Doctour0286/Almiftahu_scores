#!/usr/bin/env node
// Anon-probe (PRD Appendix C.1, task 0.7). Uses ONLY the publishable (anon) key, exactly like a stranger
// with the browser dev tools open. Every probe must come back denied / empty / E_AUTH.
//
//   node tests/tools/anon_probe.mjs <SUPABASE_URL> <PUBLISHABLE_KEY>
//   (or env SUPABASE_URL and SUPABASE_ANON_KEY)
//
// Run it against staging after 005, then against production after cut-over step 7 (runbook step 8).
// Exit code 0 = every probe passed, 1 = at least one FAIL, 2 = could not run.
//
// SAFE TO RUN AGAINST PRODUCTION even if the lockdown has NOT been applied, because no probe can change data:
//   - inserts send `{}` (violates NOT NULL, so no row can ever be created);
//   - updates and deletes use a filter that matches no row;
//   - admin RPCs get an all-zero id and a bad/absent token, and the first thing each one does is the token check;
//   - the PIN login is never called (a wrong PIN would count toward the real teacher's lockout).
// A write that is "allowed" therefore shows up as a FAIL ("reached the database") without doing damage.
//
// Needs Node 18+ (global fetch). No dependencies.

const base = (process.argv[2] || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.argv[3] || process.env.SUPABASE_ANON_KEY || '';
if (!base || !key) {
  console.error('usage: node tests/tools/anon_probe.mjs <SUPABASE_URL> <PUBLISHABLE_KEY>');
  process.exit(2);
}
if (/service_role/i.test(key) || (key.split('.').length === 3 && /"role"\s*:\s*"service_role"/.test(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')))) {
  console.error('REFUSING: that looks like a service_role key. This probe must only ever use the publishable/anon key.');
  process.exit(2);
}

// Supabase serves PostgREST under /rest/v1. A bare local PostgREST has no prefix: PROBE_REST_PATH=''.
const restPath = process.env.PROBE_REST_PATH !== undefined ? process.env.PROBE_REST_PATH : '/rest/v1';

const ZERO = '00000000-0000-0000-0000-000000000000';
const results = [];
const record = (status, name, detail = '') => {
  results.push({ status, name, detail });
  console.log(`${status.padEnd(4)}  ${name}${detail ? '\n      ' + detail : ''}`);
};

async function call(method, path, { body, headers = {} } = {}) {
  const res = await fetch(base + restPath + path, {
    method,
    headers: { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { status: res.status, json, text };
}

// "Denied" = the request never reached table data: an auth/permission/not-exposed error.
// A constraint error (23xxx) or a 2xx means the privilege check PASSED, which is a failure here.
// NOTE: a bare 404 is NOT proof of denial: a mistyped URL is also a 404 (PGRST125) and would make every
// probe "pass" vacuously. Only a database/PostgREST permission or not-in-schema-cache code counts.
const DENIED_CODES = new Set(['42501', 'PGRST205', 'PGRST202', 'PGRST106', 'PGRST301', '42883', '3F000']);
const isDenied = (r) => r.status >= 400 && ((r.json && DENIED_CODES.has(r.json.code)) || [401, 403].includes(r.status));
const describe = (r) => `HTTP ${r.status} ${r.text.slice(0, 160).replace(/\s+/g, ' ')}`;

function expectDenied(name, r) {
  if (isDenied(r)) record('PASS', name);
  else record('FAIL', name, `NOT denied: ${describe(r)}`);
}

// ---------- 0. canary: is this really a PostgREST API at this URL? ----------
{
  let r;
  try { r = await call('GET', '/courses?select=id&limit=1'); }
  catch (e) { console.error(`CANNOT RUN: no connection to ${base} (${e.message})`); process.exit(2); }
  if (r.status === 404 && r.json && r.json.code === 'PGRST125') {
    console.error(`CANNOT RUN: ${base}${restPath} is not a PostgREST root (invalid path). Check the URL, or set PROBE_REST_PATH.`);
    process.exit(2);
  }
  if (!r.json && r.status >= 400) {
    console.error(`CANNOT RUN: unexpected non-API response from ${base}${restPath}: HTTP ${r.status} ${r.text.slice(0, 120)}`);
    process.exit(2);
  }
  record('PASS', `0. API reachable (HTTP ${r.status} from ${base}${restPath})`);
}

// ---------- 1. private schema and private functions ----------
for (const t of ['secrets', 'teacher_sessions', 'auth_throttle', 'system_params', 'institution_settings',
  'exams', 'exam_versions', 'sections', 'questions', 'question_keys', 'v_question_values']) {   // the last six: Phase 1 (AC-1.1); "not in schema cache" counts as denied too
  expectDenied(`1. read private.${t}`, await call('GET', `/${t}?select=*&limit=1`, { headers: { 'Accept-Profile': 'private' } }));
}
for (const [fn, args] of [['fail', { p_code: 'E_X' }], ['require_teacher', { p_token: 'x' }], ['param', { p_key: 'x', p_default: 1 }],
  ['recompute_result', { p_enrollment: ZERO }], ['sync_legacy_students', {}], ['next_sn', { p_course: ZERO }],
  ['exam_doc', { p_version: ZERO }], ['validate_exam_version', { p_version: ZERO }], ['clone_version', { p_src: ZERO, p_dst: ZERO }]]) {
  expectDenied(`1. call private.${fn}()`, await call('POST', `/rpc/${fn}`, { body: args, headers: { 'Content-Profile': 'private' } }));
}
// the same names without a schema header resolve in `public` and must not exist there for anon
for (const fn of ['recompute_result', 'sync_legacy_students', 'require_teacher']) {
  expectDenied(`1. public.${fn}() is not exposed`, await call('POST', `/rpc/${fn}`, { body: {} }));
}

// ---------- 2. writes on the five tables ----------
const writeTargets = {
  students:           { pk: 'id',            patch: { name: 'probe' } },
  enrollments:        { pk: 'id',            patch: { active: true } },
  courses:            { pk: 'id',            patch: { name: 'probe' } },
  enrollment_results: { pk: 'enrollment_id', patch: { status: 'eligible' } },
  app_settings:       { pk: 'key',           patch: { value: 'probe' } },
};
for (const [t, { pk, patch }] of Object.entries(writeTargets)) {
  const none = pk === 'key' ? '__probe_no_such_key__' : (pk === 'id' && t === 'students' ? '__probe_no_such_id__' : ZERO);
  expectDenied(`2. INSERT into ${t}`, await call('POST', `/${t}`, { body: {}, headers: { Prefer: 'return=minimal' } }));
  expectDenied(`2. UPDATE ${t}`, await call('PATCH', `/${t}?${pk}=eq.${none}`, { body: patch, headers: { Prefer: 'return=representation' } }));
  expectDenied(`2. DELETE from ${t}`, await call('DELETE', `/${t}?${pk}=eq.${none}`, { headers: { Prefer: 'return=representation' } }));
}

// ---------- 3. no PIN anywhere ----------
{
  const r = await call('GET', '/app_settings?select=*');
  if (isDenied(r) || (r.status === 200 && Array.isArray(r.json) && r.json.length === 0)) record('PASS', '3. app_settings returns nothing');
  else record('FAIL', '3. app_settings returns nothing', describe(r));
}
async function fetchAll(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await call('GET', path, { headers: { 'Range-Unit': 'items', Range: `${from}-${from + 999}` } });
    if (r.status !== 200 && r.status !== 206) return { error: describe(r), rows: out };
    out.push(...r.json);
    if (r.json.length < 1000) return { rows: out };
  }
}
const readable = {};
for (const t of ['courses', 'students', 'enrollments', 'enrollment_results']) {
  readable[t] = await fetchAll(`/${t}?select=*`);
  if (readable[t].error) {
    record('FAIL', `3. public read of ${t} works (the portal needs it)`, readable[t].error);
    continue;
  }
  record('PASS', `3. public read of ${t} works (${readable[t].rows.length} rows)`);
  const blob = JSON.stringify(readable[t].rows);
  if (/teacher_pin|\$2[abxy]\$\d\d\$/i.test(blob)) record('FAIL', `3. no PIN or hash in ${t}`, 'found "teacher_pin" or a bcrypt hash');
  else record('PASS', `3. no PIN or hash in ${t}`);
}

// ---------- 4. admin RPCs: missing / empty / random token -> E_AUTH ----------
const adminCalls = {
  admin_save_course:        { p_course: {} },
  admin_set_course_status:  { p_course_id: ZERO, p_status: 'archived' },
  admin_list_roster:        { p_course_id: ZERO },
  admin_list_students_all:  {},
  admin_add_student:        { p_course_id: ZERO, p_name: 'probe' },
  admin_enroll_student:     { p_course_id: ZERO, p_student_id: '__probe_no_such_id__' },
  admin_bulk_seed:          { p_course_id: ZERO, p_lines: '' },
  admin_update_student:     { p_student_id: '__probe_no_such_id__', p_name: 'probe' },
  admin_set_active:         { p_enrollment_id: ZERO, p_active: true },
  admin_delete_student:     { p_student_id: '__probe_no_such_id__' },
  admin_save_day:           { p_enrollment_id: ZERO, p_day_index: 0, p_score: 0, p_bonus: 0 },
  admin_set_exam_approval:  { p_enrollment_id: ZERO, p_approved: false },
};
// Phase 1 (011): the exam builder RPCs. Present only after 011, detected by a harmless call with a garbage token
// (every admin RPC checks the token first, so this cannot read or change anything). PROBE_PHASE1=1 forces them on.
const PHASE1_CALLS = {
  admin_get_exam:        { p_course_id: ZERO },
  admin_get_version:     { p_version_id: ZERO },
  admin_create_draft:    { p_course_id: ZERO },
  admin_save_draft:      { p_version_id: ZERO, p_rev: 0, p_doc: {} },
  admin_discard_draft:   { p_version_id: ZERO },
  admin_publish_version: { p_version_id: ZERO },
  admin_patch_text:      { p_question_id: ZERO, p_prompt: 'probe', p_options: null },
};
{
  const r = await call('POST', '/rpc/admin_get_exam', { body: { p_token: 'probe-garbage', p_course_id: ZERO } });
  const present = r.status === 400 && r.json && r.json.message === 'E_AUTH';
  if (present || process.env.PROBE_PHASE1 === '1') Object.assign(adminCalls, PHASE1_CALLS);
  record('PASS', `4. Phase 1 exam builder RPCs ${present ? 'are installed and are probed below' : 'are not installed (set PROBE_PHASE1=1 to probe them anyway)'}`);
}
// Phase 2 (020-023): teacher code RPCs. Same detection trick (a garbage token is refused before anything is read or changed).
// PROBE_PHASE2=1 forces them on.
const PHASE2_CALLS = {
  admin_generate_code:       { p_enrollment_id: ZERO },
  admin_generate_codes_bulk: { p_course_id: ZERO },
  admin_revoke_code:         { p_enrollment_id: ZERO },
  admin_clear_lock:          { p_enrollment_id: ZERO },
  admin_reset_attempt:       { p_enrollment_id: ZERO },
  admin_list_codes:          { p_course_id: ZERO },   // 023
};
const PHASE3_CALLS = {
  admin_marking_overview:    { p_course_id: ZERO },
  admin_essay_answers:       { p_question_id: ZERO },
  admin_attempt_detail:      { p_attempt_id: ZERO },
  admin_mark_answer:         { p_attempt_id: ZERO, p_question_id: ZERO, p_points: 0, p_comment: null },
  admin_fill_review:         { p_question_id: ZERO },
  admin_accept_fill_answer:  { p_question_id: ZERO, p_text: "sample" },
  admin_correct_key:         { p_question_id: ZERO, p_new_key: {}, p_confirm: false },
  admin_results:             { p_course_id: ZERO },
};
const STUDENT_RPCS = ['exam_check', 'exam_start', 'exam_get_paper', 'exam_save_answers', 'exam_log_event', 'exam_submit', 'exam_get_result'];
let phase2 = false;
{
  const r = await call('POST', '/rpc/admin_generate_code', { body: { p_token: 'probe-garbage', p_enrollment_id: ZERO } });
  phase2 = (r.status === 400 && r.json && r.json.message === 'E_AUTH') || process.env.PROBE_PHASE2 === '1';
  if (phase2) Object.assign(adminCalls, PHASE2_CALLS);
  record('PASS', `4. Phase 2 code RPCs ${phase2 ? 'are installed and are probed below' : 'are not installed (set PROBE_PHASE2=1 to probe them anyway)'}`);
}
let phase3 = false;
{
  const r = await call('POST', '/rpc/admin_marking_overview', { body: { p_token: 'probe-garbage', p_course_id: ZERO } });
  phase3 = (r.status === 400 && r.json && r.json.message === 'E_AUTH') || process.env.PROBE_PHASE3 === '1';
  if (phase3) { Object.assign(adminCalls, PHASE3_CALLS); if (!STUDENT_RPCS.includes('exam_get_review')) STUDENT_RPCS.push('exam_get_review'); }
  record('PASS', `4. Phase 3 marking RPCs ${phase3 ? 'are installed and are probed below' : 'are not installed (set PROBE_PHASE3=1 to probe them anyway)'}`);
}
for (const [fn, args] of Object.entries(adminCalls)) {
  for (const [label, tok] of [['no token', null], ['empty token', ''], ['random token', 'probe-' + Math.random().toString(36).slice(2)]]) {
    const r = await call('POST', `/rpc/${fn}`, { body: { p_token: tok, ...args } });
    const msg = r.json && r.json.message;
    if (r.status === 400 && msg === 'E_AUTH') record('PASS', `4. ${fn} with ${label} -> E_AUTH`);
    else record('FAIL', `4. ${fn} with ${label} -> E_AUTH`, describe(r));
  }
}
{
  const r = await call('POST', '/rpc/teacher_ping', { body: { p_token: 'probe-garbage' } });
  if (r.status === 200 && r.json === false) record('PASS', '4. teacher_ping(garbage) is false');
  else record('FAIL', '4. teacher_ping(garbage) is false', describe(r));
  const r2 = await call('POST', '/rpc/teacher_logout', { body: { p_token: 'probe-garbage' } });
  if (r2.status < 300) record('PASS', '4. teacher_logout(garbage) is harmless');
  else record('FAIL', '4. teacher_logout(garbage) is harmless', describe(r2));
}

// ---------- 5. inactive students and enrollments are invisible (AC-0.11) ----------
{
  const r = await call('GET', '/enrollments?active=eq.false&select=id');
  if (r.status === 200 && Array.isArray(r.json) && r.json.length === 0) record('PASS', '5. no inactive enrollment is readable');
  else record('FAIL', '5. no inactive enrollment is readable', describe(r));

  const enr = readable.enrollments && !readable.enrollments.error ? readable.enrollments.rows : null;
  if (enr) {
    const activeStudents = new Set(enr.map((e) => e.student_id));
    const orphans = (readable.students.rows || []).filter((s) => !activeStudents.has(s.id));
    if (orphans.length === 0) record('PASS', '5. every readable student has a readable (active) enrollment');
    else record('FAIL', '5. every readable student has a readable (active) enrollment', `${orphans.length} student(s) visible with no active enrollment`);
    const enrIds = new Set(enr.map((e) => e.id));
    const strayResults = (readable.enrollment_results.rows || []).filter((x) => !enrIds.has(x.enrollment_id));
    if (strayResults.length === 0) record('PASS', '5. every readable result belongs to a readable enrollment');
    else record('FAIL', '5. every readable result belongs to a readable enrollment', `${strayResults.length} result(s) of hidden enrollments`);
  }
}

// ---------- 6. exam_* RPCs: Phase 2, not applicable yet ----------
if (!phase2) {
  record('SKIP', '6. exam_* wrong-code probes', 'Phase 2 is not installed');
} else {
  // A wrong code for an id that is not an enrollment is refused WITHOUT leaving a throttle row, so this is harmless.
  const codeCalls = ['exam_check', 'exam_start', 'exam_get_result'];
  if (phase3) codeCalls.push('exam_get_review');
  for (const fn of codeCalls) {
    const r = await call('POST', `/rpc/${fn}`, { body: { p_enrollment_id: ZERO, p_code: '000000' } });
    if (r.status === 200 && r.json && r.json.ok === false && r.json.error === 'E_AUTH') record('PASS', `6. ${fn} with an unknown enrollment -> E_AUTH`);
    else record('FAIL', `6. ${fn} with an unknown enrollment -> E_AUTH`, describe(r));
  }
  // A made-up attempt token never opens anything.
  const tokenCalls = {
    exam_get_paper:    { p_attempt_token: 'probe-garbage-attempt-token-0000' },
    exam_save_answers: { p_attempt_token: 'probe-garbage-attempt-token-0000', p_answers: [] },
    exam_log_event:    { p_attempt_token: 'probe-garbage-attempt-token-0000', p_type: 'left' },
    exam_submit:       { p_attempt_token: 'probe-garbage-attempt-token-0000' },
  };
  for (const [fn, args] of Object.entries(tokenCalls)) {
    const r = await call('POST', `/rpc/${fn}`, { body: args });
    if (r.status === 400 && r.json && r.json.message === 'E_SESSION_REPLACED') record('PASS', `6. ${fn} with a garbage attempt token -> E_SESSION_REPLACED`);
    else record('FAIL', `6. ${fn} with a garbage attempt token -> E_SESSION_REPLACED`, describe(r));
  }
}

// ---------- 7. the whole exposed surface is exactly what we expect ----------
{
  const r = await call('GET', '/');
  const expectedTables = new Set(['courses', 'students', 'enrollments', 'enrollment_results']);
  const expectedRpc = new Set(['teacher_login', 'teacher_logout', 'teacher_ping', 'teacher_change_pin', ...Object.keys(adminCalls), ...(phase2 ? STUDENT_RPCS : [])]);
  if (r.status === 200 && r.json && r.json.paths) {
    const paths = Object.keys(r.json.paths).filter((p) => p !== '/');
    const extraTables = paths.filter((p) => !p.startsWith('/rpc/') && !expectedTables.has(p.slice(1)));
    const extraRpc = paths.filter((p) => p.startsWith('/rpc/') && !expectedRpc.has(p.slice(5)));
    const missingRpc = [...expectedRpc].filter((f) => !paths.includes('/rpc/' + f));
    if (extraTables.length === 0 && extraRpc.length === 0) record('PASS', '7. exposed tables and RPCs are exactly the expected set');
    else record('FAIL', '7. exposed tables and RPCs are exactly the expected set', `unexpected: ${[...extraTables, ...extraRpc].join(', ')}`);
    if (missingRpc.length) record('FAIL', `7. all ${expectedRpc.size} RPCs are reachable by anon`, `missing: ${missingRpc.join(', ')}`);
    else record('PASS', `7. all ${expectedRpc.size} RPCs are reachable by anon`);
  } else {
    record('SKIP', '7. OpenAPI surface listing', `not available to the public key (${r.status}); steps 1-5 already cover it`);
  }
}

// ---------- summary ----------
const n = (s) => results.filter((x) => x.status === s).length;
console.log(`\n${n('PASS')} passed, ${n('FAIL')} failed, ${n('SKIP')} skipped  (${base})`);
if (n('FAIL')) {
  console.log('LOCKDOWN IS NOT COMPLETE. Do not lift the freeze. See the FAIL lines above.');
  process.exit(1);
}
console.log('All probes denied or empty, as required.');
