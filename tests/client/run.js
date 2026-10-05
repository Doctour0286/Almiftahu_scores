const fs = require('fs'); const path = require('path');
const { JSDOM } = require('jsdom'); const esbuild = require('esbuild'); const { makeBackend } = require('./fake.js');
const REPO = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0; const failures = [];
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; failures.push(msg); console.log('  FAIL:', msg); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function boot(db, token) {
  const out = esbuild.buildSync({ entryPoints: [REPO + '/js/main.js'], bundle: true, format: 'iife', write: false, logLevel: 'error' }).outputFiles[0].text;
  let html = fs.readFileSync(REPO + '/index.html', 'utf8').replace(/<script type="module"[^>]*><\/script>/, '').replace(/<link[^>]*>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = (i, o) => db.fetch(i, o); w.Headers = Headers; w.Request = Request; w.Response = Response;
  w.WebSocket = class { constructor() { setTimeout(() => this.onerror && this.onerror(new Error('no ws')), 0); } close() {} send() {} addEventListener() {} removeEventListener() {} };
  if (token) w.sessionStorage.setItem('mahad_teacher_token', token);
  w.eval(out);
  return w;
}
const q = (w, s) => w.document.querySelector(s); const qa = (w, s) => [...w.document.querySelectorAll(s)];
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const type = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
async function until(fn, ms = 2000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch (e) {} await sleep(10); } return false; }
const text = (w, s) => (q(w, s) ? q(w, s).textContent.replace(/\s+/g, ' ').trim() : null);
const writes = (db) => db.log.filter(l => l.method !== 'GET' && !l.path.startsWith('/rest/v1/rpc/'));

(async () => {
  const db = makeBackend();
  const adab = db.mkCourse({ code: 'ADAB', name: 'Al-Aadaab Al-Asharah', name_ar: 'الآداب العشرة' }); db.courses.push(adab);
  const mk = (name, tens, bonus = 0, ar = null) => { const r = db.addStudent(adab, name, ar); const e = db.enrollments.find(x => x.id === r.enrollment_id); for (let i = 0; i < tens; i++) e.days[i] = 10; if (bonus) e.bonus_units[9] = bonus; return e; };
  mk('Pat', 9, 0, 'باتي'); mk('Quinn', 8); mk('Rae', 8); mk('Sam', 7, 1); const inactive = mk('Tess', 3); inactive.active = false;

  const w = await boot(db);
  console.log('== public view');
  ok(await until(() => qa(w, '.student-card').length === 4), 'directory shows 4 active students (inactive hidden)');
  ok(!qa(w, '.student-card').some(c => c.textContent.includes('Tess')), 'inactive student hidden from public');
  ok(q(w, '#courseSwitchWrap').style.display === 'none', 'course switcher hidden with one course');
  ok(text(w, '.student-card .view-badge') === '90 / 100', 'badge shows total / lesson_max');
  ok(qa(w, '.student-card').some(c => c.querySelector('.name-ar') && c.textContent.includes('باتي')), 'Arabic name shown');
  click(w, q(w, '[data-tab="leaderboard"]'));
  const ranks = qa(w, '.leader-item').map(i => i.querySelector('.leader-rank').textContent.trim() || 'medal');
  const rankClasses = qa(w, '.leader-rank').map(e => e.className.replace('leader-rank', '').trim());
  ok(rankClasses.join() === 'rank-1,rank-2,rank-2,', `ties share a rank (classes: ${rankClasses.join('|')})`);
  ok(qa(w, '.leader-rank')[3].textContent.trim() === '4', 'next rank skips (1,2,2,4)');
  ok(qa(w, '.leader-score').map(e => e.textContent).join() === '90 pts,80 pts,80 pts,72 pts', 'leaderboard scores (bonus included)');
  click(w, q(w, '[data-tab="overview"]'));
  const cells = qa(w, '#tableBody tr').map(r => [...r.querySelectorAll('td')].map(td => td.textContent.trim()));
  ok(cells[3][cells[3].length - 2] === '2' && cells[3][cells[3].length - 1] === '72', `Bonus column is a number (got "${cells[3] && cells[3][cells[3].length - 2]}")`);
  ok(qa(w, '#tableHeader th').length === 14, 'full sheet headers: S/N, name, 10 units, Bonus, Total');
  type(w, q(w, '#search'), 'qui'); click(w, q(w, '[data-tab="directory"]'));
  ok(qa(w, '.student-card').length === 1, 'search filters'); type(w, q(w, '#search'), '');
  click(w, qa(w, '.student-card')[0]); ok(q(w, '#scoreModal').style.display === 'flex' && qa(w, '#modalScoreGrid .score-item').length === 10, 'student modal opens with 10 unit tiles'); ok(q(w, '#modalEditWrap').style.display === 'none', 'no edit button for public'); click(w, q(w, '#modalClose'));

  console.log('== teacher login');
  click(w, q(w, '#teacherTag'));
  ok(!!q(w, '#pinInput'), 'lock notice shown');
  for (let i = 0; i < 2; i++) { q(w, '#pinInput').value = 'nope'; click(w, q(w, '#pinSubmit')); await until(() => text(w, '#pinError')); }
  ok(text(w, '#pinError') === 'Incorrect PIN. Try again.', 'wrong PIN message');
  for (let i = 0; i < 3; i++) { q(w, '#pinInput').value = 'nope'; click(w, q(w, '#pinSubmit')); await sleep(30); await until(() => text(w, '#pinError')); }
  ok(/Too many attempts\. Try again in 5 minutes\./.test(text(w, '#pinError') || ''), 'lockout after 5 failures: ' + text(w, '#pinError'));
  db.lockedUntil = 0; db.fails = 0;
  q(w, '#pinInput').value = '1234'; click(w, q(w, '#pinSubmit'));
  ok(await until(() => q(w, '#manageEntryList') && q(w, '#manageTabBtn').style.display === 'flex'), 'unlocked with correct PIN');
  ok(!!w.sessionStorage.getItem('mahad_teacher_token'), 'token in sessionStorage'); ok(w.localStorage.length === 0, 'nothing in localStorage (AC-0.10)');
  ok(qa(w, '#manageEntryList .entry-row').length === 5, 'teacher roster includes inactive (5 rows)');

  console.log('== add / seed / rename / Arabic');
  q(w, '#newStudentName').value = 'Uma'; q(w, '#newStudentNameAr').value = 'أمة'; click(w, q(w, '#addStudentBtn'));
  ok(await until(() => /Added Uma \(S\/N 6\)/.test(text(w, '#addHint') || '')), 'add student: S/N from server ' + text(w, '#addHint'));
  q(w, '#newStudentName').value = 'uma'; click(w, q(w, '#addStudentBtn'));
  ok(await until(() => /same name/.test(text(w, '#addHint') || '')), 'duplicate-name warning (FR-R7)');
  q(w, '#seedNames').value = 'Vic | فيك\nWes\nquinn\n |bad'; click(w, q(w, '#seedRunBtn'));
  ok(await until(() => /Done/.test(text(w, '#seedHint') || '')), 'seed completes: ' + text(w, '#seedHint'));
  ok(/2 added, 1 skipped, 1 invalid/.test(text(w, '#seedHint')), 'seed counts: ' + text(w, '#seedHint'));
  ok(/Skipped \(already exists\): quinn/.test(q(w, '#seedLog').textContent), 'seed log lists skipped');
  ok(db.students.find(s => s.name === 'Vic').name_ar === 'فيك', 'Arabic name after | saved');
  ok(/missing/.test(text(w, '#arCount') || ''), 'Arabic-names count: ' + text(w, '#arCount'));
  const ar = q(w, '[data-ar-input]'); const arId = ar.dataset.arInput; ar.value = 'اسم'; click(w, q(w, `[data-ar-save="${arId}"]`));
  ok(await until(() => !q(w, `[data-ar-input="${arId}"]`)), 'Arabic name saved, row leaves the list');
  const row = qa(w, '#manageEntryList .entry-row').find(r => r.textContent.includes('Rae'));
  click(w, row.querySelector('[data-edit-name]')); const rid = row.dataset.id;
  type(w, q(w, `#renameInput-${rid}`), 'Rae Z'); type(w, q(w, `#renameArInput-${rid}`), 'راي'); click(w, q(w, `[data-save-name="${rid}"]`));
  ok(await until(() => db.students.some(s => s.name === 'Rae Z' && s.name_ar === 'راي')), 'rename EN+AR via admin_update_student');

  console.log('== score editor');
  click(w, qa(w, '#manageEntryList .entry-row').find(r => r.textContent.includes('Uma')).querySelector('.entry-row-head'));
  const uma = db.students.find(s => s.name === 'Uma'); const umaEnr = db.enrollments.find(e => e.student_id === uma.id);
  click(w, q(w, `[data-edit-scores="${umaEnr.id}"]`));
  ok(q(w, '#scoreEditModal').style.display === 'flex' && qa(w, '#editDayDots button').length === 10, 'editor opens with 10 unit dots');
  click(w, qa(w, '#editDayDots button')[2]);
  const before = db.log.length; q(w, '#editDayScoreInput').value = '11'; click(w, q(w, '#editSaveBtn'));
  ok(/Fix the highlighted fields/.test(text(w, '#editHint')) && db.log.length === before, 'out-of-range score blocked client-side, no request');
  q(w, '#editDayScoreInput').value = '7.5'; click(w, q(w, '#editSaveBtn')); ok(db.log.length === before, 'non-integer blocked');
  q(w, '#editDayScoreInput').value = '8'; q(w, '#editDayBonusInput').value = '1'; click(w, q(w, '#editSaveBtn'));
  ok(await until(() => umaEnr.days[2] === 8 && umaEnr.bonus_units[2] === 1), 'admin_save_day stored 8 + 1 bonus');
  const call = db.log.filter(l => l.path.endsWith('/admin_save_day')).pop().body;
  ok(call.p_day_index === 2 && call.p_score === 8 && call.p_bonus === 1 && typeof call.p_token === 'string' && call.p_token.length > 5, 'RPC payload zero-based index + token');
  ok(await until(() => /Day 3 saved/.test(text(w, '#editPickerHint') || '')), 'saved hint'); ok(/Total: 10 \/ 100/.test(text(w, '#editModalTotal')), 'total updated: ' + text(w, '#editModalTotal'));
  click(w, q(w, '#scoreEditClose'));

  console.log('== eligibility + activate');
  ok(/not eligible yet \(1\/10 days marked\)/.test(qa(w, '.elig-line').map(e => e.textContent).find(t => /1\/10/.test(t)) || ''), 'eligibility reason shown (all_units)');
  const sam = db.enrollments.find(e => db.students.find(s => s.id === e.student_id).name === 'Sam');
  click(w, q(w, `[data-toggle-active="${sam.id}"]`)); ok(await until(() => sam.active === false), 'inactivate via admin_set_active');
  click(w, q(w, `[data-toggle-active="${sam.id}"]`)); ok(await until(() => sam.active === true), 'reactivate');

  console.log('== course settings');
  click(w, q(w, '#menuToggleCourse')); ok(q(w, '#cfCode').value === 'ADAB' && q(w, '#cfUnit').value === 'Day', 'course form shows current course');
  type(w, q(w, '#cfCount'), '12'); click(w, q(w, '#courseSaveBtn'));
  ok(await until(() => q(w, '#confirmOverlay').style.display === 'flex'), 'scoring change needs confirmation (AC-0.9)');
  ok(/affects 9 students/.test(text(w, '#confirmBody')), 'confirm names the affected count: ' + text(w, '#confirmBody'));
  click(w, q(w, '#confirmCancel')); ok(await until(() => /Not saved/.test(text(w, '#courseHint') || '')) && adab.day_count === 10, 'cancel leaves course unchanged');
  click(w, q(w, '#courseSaveBtn')); await until(() => q(w, '#confirmOverlay').style.display === 'flex'); click(w, q(w, '#confirmOk'));
  ok(await until(() => adab.day_count === 12 && db.enrollments.every(e => e.days.length === 12)), 'confirmed: course + all arrays resized to 12');
  ok(await until(() => qa(w, '#editDayDots').length >= 0 && /Saved \(9/.test(text(w, '#courseHint') || '')), 'saved hint: ' + text(w, '#courseHint'));
  type(w, q(w, '#cfCount'), '8'); click(w, q(w, '#courseSaveBtn')); await until(() => q(w, '#confirmOverlay').style.display === 'flex');
  ok(/removed unit\(s\) will be deleted/.test(text(w, '#confirmBody')), 'shrinking warns about deleted scores'); click(w, q(w, '#confirmCancel')); await sleep(30);
  click(w, q(w, '#courseCancelBtn') || q(w, '#courseNewBtn')); // new course
  ok(!!q(w, '#cfCopy'), 'new-course form offers Blank/Copy');
  type(w, q(w, '#cfCode'), 'wk1'); type(w, q(w, '#cfName'), 'Weekly Fiqh'); type(w, q(w, '#cfUnit'), 'Week'); type(w, q(w, '#cfCount'), '6');
  click(w, q(w, '#courseSaveBtn'));
  ok(await until(() => db.courses.length === 2), 'second course created from the UI (AC-0.13)');
  const wk = db.courses[1]; ok(wk.code === 'WK1' && wk.unit_label === 'Week' && wk.day_count === 6, 'new course values: ' + JSON.stringify([wk.code, wk.unit_label, wk.day_count]));
  ok(await until(() => q(w, '#courseSwitchWrap').style.display === 'block' && q(w, '#courseSwitch').value === wk.id), 'switcher appears and selects the new course');
  click(w, q(w, '[data-tab="overview"]')); ok(qa(w, '#tableHeader th').some(t => t.textContent === 'Week 6') , 'Full Sheet uses unit label "Week"');
  click(w, q(w, '[data-tab="manage"]'));
  q(w, '#newStudentName').value = 'Zed'; click(w, q(w, '#addStudentBtn')); ok(await until(() => /Added Zed \(S\/N 1\)/.test(text(w, '#addHint') || '')), 'per-course S/N restarts at 1');
  click(w, q(w, '#menuToggleEnroll')); ok(await until(() => qa(w, '#enrollSelect option').length > 3), 'enroll list loads other-course students');
  q(w, '#enrollSelect').value = db.students.find(s => s.name === 'Pat').id; click(w, q(w, '#enrollBtn')); ok(await until(() => /Enrolled \(S\/N 2\)/.test(text(w, '#enrollHint') || '')), 'enroll existing student gets a new S/N');
  // copy-from + exam-only
  click(w, q(w, '#courseNewBtn')); q(w, '#cfCopy').value = adab.id; q(w, '#cfCopy').dispatchEvent(new w.Event('change'));
  ok(q(w, '#cfUnit').value === 'Day' && q(w, '#cfCode').value === '' && q(w, '#cfCount').value === '8' || q(w, '#cfCount').value === '12', 'copy-from prefills settings, code/name blank');
  q(w, '#cfMode').value = 'none'; q(w, '#cfMode').dispatchEvent(new w.Event('change'));
  ok(q(w, '#cfRule').value === 'open' && !qa(w, '#cfRule option').some(o => o.value === 'all_units') && q(w, '#cfCount').disabled, 'exam-only: rule preselects open, all_units removed, unit fields disabled');
  type(w, q(w, '#cfCode'), 'EX1'); type(w, q(w, '#cfName'), 'Exam only'); click(w, q(w, '#courseSaveBtn'));
  ok(await until(() => db.courses.length === 3 && db.courses[2].lesson_mode === 'none'), 'exam-only course created'); click(w, q(w, '[data-tab="leaderboard"]'));
  ok(/Rankings appear once students have completed the exam/.test(text(w, '#leaderboardList')), 'exam-only leaderboard note');
  click(w, q(w, '[data-tab="manage"]')); // archive
  click(w, q(w, '#courseArchiveBtn')); ok(await until(() => q(w, '#confirmOverlay').style.display === 'flex'), 'archive asks for confirmation'); click(w, q(w, '#confirmOk'));
  ok(await until(() => db.courses[2].status === 'archived'), 'archived via admin_set_course_status');
  q(w, '#courseSwitch').value = adab.id; q(w, '#courseSwitch').dispatchEvent(new w.Event('change')); ok(await until(() => qa(w, '#manageEntryList .entry-row').length >= 8), 'switch back to first course');

  console.log('== PIN change + delete');
  click(w, q(w, '#menuTogglePin'));
  q(w, '#oldPinInput').value = 'bad'; q(w, '#newPinInput').value = 'abcdef'; q(w, '#confirmPinInput').value = 'abcdef'; click(w, q(w, '#changePinBtn'));
  ok(await until(() => /Current PIN is incorrect/.test(text(w, '#pinChangeHint') || '')), 'wrong current PIN message');
  q(w, '#newPinInput').value = 'abc'; q(w, '#confirmPinInput').value = 'abc'; click(w, q(w, '#changePinBtn')); ok(/at least 4/.test(text(w, '#pinChangeHint')), 'short PIN rejected client-side');
  q(w, '#oldPinInput').value = '1234'; q(w, '#newPinInput').value = 'abcdef'; q(w, '#confirmPinInput').value = 'abcdef'; click(w, q(w, '#changePinBtn'));
  ok(await until(() => db.pin === 'abcdef'), 'PIN changed via teacher_change_pin');
  const tess = db.enrollments.find(e => db.students.find(s => s.id === e.student_id).name === 'Tess'); const tessId = tess.student_id;
  click(w, q(w, `[data-delete="${tess.id}"]`)); ok(await until(() => q(w, '#confirmOverlay').style.display === 'flex'), 'delete asks for confirmation'); click(w, q(w, '#confirmOk'));
  ok(await until(() => !db.students.some(s => s.id === tessId)), 'deleted via admin_delete_student');
  db.certified = new Set([db.students.find(s => s.name === 'Pat').id]); const pat = db.enrollments.find(e => e.course_id === adab.id && db.students.find(s => s.id === e.student_id).name === 'Pat');
  click(w, q(w, `[data-delete="${pat.id}"]`)); await until(() => q(w, '#confirmOverlay').style.display === 'flex'); click(w, q(w, '#confirmOk'));
  ok(await until(() => /certificate and can't be deleted/.test(text(w, '#statusArea') || '')), 'delete blocked with certificate message: ' + text(w, '#statusArea'));

  console.log('== exam builder (versions, draft, preview, publish)');
  click(w, q(w, '#menuToggleExam')); 
  ok(await until(() => q(w, '#examNewDraft') || q(w, '#examContinue')), 'exam builder section loaded');
  const draftBtn = q(w, '#examNewDraft') || q(w, '#examContinue');
  click(w, draftBtn);
  ok(await until(() => q(w, '#exTitle') && q(w, '#examAddSection')), 'draft editor opened');
  type(w, q(w, '#exTitle'), 'Midterm Exam');
  type(w, q(w, '#exDur'), '60');
  click(w, q(w, '#examAddSection'));
  ok(await until(() => qa(w, '.exam-section').length === 1), 'section added');
  type(w, q(w, '[data-f="s.weight"]'), '100');
  type(w, q(w, '[data-f="s.title"]'), 'Basics');
  click(w, q(w, '[data-act="q-add"]'));
  ok(await until(() => qa(w, '.exam-q').length === 1), 'question added');
  type(w, q(w, '[data-f="q.prompt"]'), 'What is the first pillar of Islam?');
  type(w, qa(w, 'input[data-f="q.opt"]')[0], 'Shahada');
  type(w, qa(w, 'input[data-f="q.opt"]')[1], 'Salah');
  const chk = qa(w, 'input[data-f="q.correct"]')[0]; chk.checked = true; chk.dispatchEvent(new w.Event('input', { bubbles: true }));
  click(w, q(w, '#examPreviewBtn'));
  ok(await until(() => q(w, '#previewBanner')), 'preview view opened');
  click(w, q(w, '#pvClose'));
  ok(await until(() => q(w, '#examPublishBtn')), 'preview closed back to draft editor');
  click(w, q(w, '#examPublishBtn'));
  ok(await until(() => q(w, '#pubGo')), 'publish dialog opened');
  click(w, q(w, '#pubGo'));
  ok(await until(() => qa(w, '.exam-version[data-status="live"]').length === 1), 'exam published as Live version');
  ok(adab.exam_live === true, 'course has exam_live = true');

  console.log('== exam codes & slips');
  adab.eligibility_rule = 'open';
  q(w, '#courseSwitch').dispatchEvent(new w.Event('change')); await sleep(50);
  click(w, q(w, "#menuToggleCodes"));
  ok(await until(() => q(w, "#bulkGenCodesBtn")), "codes section opened and has bulk generate button");
  click(w, q(w, "#bulkGenCodesBtn"));
  ok(await until(() => q(w, "#codeSlipsModal") && q(w, "#codeSlipsModal").style.display === "flex"), "slips modal opened automatically after bulk generation");
  const slipCards = qa(w, ".code-slip-card");
  ok(slipCards.length > 0, "code slips rendered");
  const firstEnrWithCode = db.enrollments.find(e => e.course_id === adab.id && e.active && db.codes.some(c => c.enrollment_id === e.id && c.status === "active"));
  const activeStudentCode = db.codes.find(c => c.enrollment_id === firstEnrWithCode.id && c.status === "active").code;
  ok(activeStudentCode && activeStudentCode.length >= 8, "generated code found in db: " + activeStudentCode);
  click(w, q(w, "#closeSlipsBtn"));
  ok(q(w, "#codeSlipsModal").style.display === "none", "slips modal closed");

  click(w, q(w, "#printEligibilityListBtn"));
  ok(await until(() => q(w, "#eligibilityListModal") && q(w, "#eligibilityListModal").style.display === "flex"), "eligibility list modal opened");
  ok(qa(w, ".eligibility-table tbody tr").length > 0, "eligibility table rendered rows");
  ok(!qa(w, ".eligibility-table th").some(th => th.textContent.includes("Exam Code")), "exam code column hidden by default");
  const codesChk = q(w, "#includeCodesCheck");
  codesChk.checked = true;
  codesChk.dispatchEvent(new w.Event("change", { bubbles: true }));
  ok(await until(() => qa(w, ".eligibility-table th").some(th => th.textContent.includes("Exam Code"))), "exam code column displayed when toggled on");
  click(w, q(w, "#closeEligModalBtn"));
  ok(q(w, "#eligibilityListModal").style.display === "none", "eligibility modal closed");

  console.log('== student exam taking portal');
  click(w, q(w, '.tab-btn[data-tab="exam"]'));
  ok(await until(() => q(w, "#examCodeInput") && q(w, "#examCheckBtn")), "exam tab loaded with code entry input");
  q(w, "#examStudentSelect").value = firstEnrWithCode.id;
  q(w, "#examCodeInput").value = activeStudentCode;
  click(w, q(w, "#examCheckBtn"));
  ok(await until(() => q(w, "#startExamBtn")), "code verified and start exam button displayed");
  click(w, q(w, "#startExamBtn"));
  ok(await until(() => q(w, ".student-exam-wrap")), "exam player loaded");
  const opt = q(w, 'input[name^="opt_"]');
  if (opt) {
    click(w, opt);
    ok(await until(() => q(w, "#studentAutosaveIndicator")), "question answered and save indicator present");
  }
  click(w, q(w, "#submitExamTopBtn"));
  ok(await until(() => q(w, "#confirmSubmitBtn")), "submit confirmation modal opened");
  click(w, q(w, "#confirmSubmitBtn"));
  ok(await until(() => q(w, "#finishExamBtn")), "exam submitted successfully and score/finish screen reached");
  click(w, q(w, "#finishExamBtn"));
  ok(await until(() => q(w, "#examCodeInput")), "returned to exam entry screen");
  click(w, q(w, '.tab-btn[data-tab="manage"]'));

  console.log('== session expiry, logout, reload');
  db.tokens.clear();
  const target = qa(w, '#manageEntryList .entry-row')[0]; click(w, target.querySelector('[data-toggle-active]') || target.querySelector('.entry-row-head'));
  click(w, q(w, `[data-toggle-active="${target.dataset.id}"]`) );
  ok(await until(() => q(w, '#manageTabBtn').style.display === 'none'), 'E_AUTH from server locks teacher mode');
  ok(/teacher session ended/.test(text(w, '#statusArea') || ''), 'expiry message shown'); ok(!w.sessionStorage.getItem('mahad_teacher_token'), 'token cleared');
  ok(await until(() => qa(w, '.student-card').length > 0), 'public data reloaded after lock');
  click(w, q(w, '#teacherTag')); q(w, '#pinInput').value = 'abcdef'; click(w, q(w, '#pinSubmit')); ok(await until(() => q(w, '#manageTabBtn').style.display === 'flex'), 're-login with the new PIN');
  const tok = w.sessionStorage.getItem('mahad_teacher_token'); click(w, q(w, '#teacherTag'));
  ok(await until(() => q(w, '#manageTabBtn').style.display === 'none'), 'lock button locks'); ok(await until(() => db.log.some(l => l.path.endsWith('/teacher_logout'))), 'teacher_logout called'); ok(!db.tokens.has(tok), 'server session deleted');
  ok(!w.sessionStorage.getItem('mahad_teacher_token'), 'token removed on lock');
  // reload resumes a valid session
  click(w, q(w, '#teacherTag')); q(w, '#pinInput').value = 'abcdef'; click(w, q(w, '#pinSubmit')); await until(() => q(w, '#manageTabBtn').style.display === 'flex');
  const store = w.sessionStorage.getItem('mahad_teacher_token');
  const w2 = await boot(db, store);
  ok(await until(() => q(w2, '#manageTabBtn').style.display === 'flex'), 'reload resumes a valid session (teacher_ping)');
  ok(await until(() => qa(w2, '#studentGrid .student-card').length > 0), 'reloaded page shows data');
  const w3 = await boot(db, 'garbage-token');
  ok(await until(() => qa(w3, '#studentGrid .student-card').length > 0) && q(w3, '#manageTabBtn').style.display === 'none', 'a garbage stored token is rejected and cleared');
  ok(!w3.sessionStorage.getItem('mahad_teacher_token'), 'garbage token removed from sessionStorage');
  console.log('== network failure + no direct writes');
  click(w2, q(w2, '[data-tab="manage"]')); ok(await until(() => q(w2, '#addStudentBtn')), 'second window on manage tab');
  db.down = true; q(w2, '#newStudentName').value = 'Net'; click(w2, q(w2, '#addStudentBtn'));
  ok(await until(() => /Could not reach the server/.test(text(w2, '#addHint') || '')), 'network failure message: ' + text(w2, '#addHint'));
  db.down = false;
  ok(writes(db).length === 0, `no direct table writes anywhere (${writes(db).length} found: ${JSON.stringify(writes(db).slice(0, 2))})`);
  const pubReads = db.log.filter(l => l.method === 'GET'); ok(pubReads.every(l => /^\/rest\/v1\/(courses|students|enrollments|enrollment_results)$/.test(l.path)), 'public reads only touch the four public tables');
  ok(!db.log.some(l => l.path.includes('app_settings')), 'app_settings never read');
  console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log(failures); process.exit(1); } process.exit(0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
