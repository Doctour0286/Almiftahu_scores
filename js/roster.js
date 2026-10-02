// Manage tab: add / enroll / bulk seed / Arabic names / rename / eligibility / activate / delete, course settings, PIN.
// Every write is an admin_* RPC (no direct table writes). S/N is assigned by the database.
import { rpc, errorMessage } from './api.js';
import { changeTeacherPin, lockNoticeHtml, wirePinForm } from './auth.js';
import { renderCourseSettings } from './courses.js';
import { reload } from './main.js';
import { openScoreEditor } from './scores.js';
import { currentCourse, findRow, state } from './state.js';
import { arHtml, confirmDialog, cssEscape, escapeAttr, escapeHtml, fmtNum, setHint, showStatus, unitName } from './ui.js';

const section = (id, icon, title, body) => `
  <div class="panel-section">
    <h4 class="menu-toggle" id="menuToggle${id}">
      <span>${icon}${title}</span><span class="menu-chevron" id="menuChevron${id}">&#9656;</span>
    </h4>
    <div class="menu-body" id="menuBody${id}">${body}</div>
  </div>`;
const ICON = {
  plus: '<svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  users: '<svg class="icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  down: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  text: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 7V4h16v3"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  gear: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  lock: '<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
};

export function renderManageTab() {
  const area = document.getElementById('manageArea');
  if (!state.teacherUnlocked) { area.innerHTML = lockNoticeHtml(); wirePinForm(); return; }

  area.innerHTML = `
    <div class="teacher-panel">
      <div class="list-subhead" id="manageCourseLabel"></div>
      ${section('Add', ICON.plus, 'Add a student', `
        <div class="add-student-form">
          <input type="text" id="newStudentName" placeholder="Full name">
          <input type="text" id="newStudentNameAr" placeholder="Name in Arabic (optional)" dir="auto">
          <button id="addStudentBtn"><svg class="icon sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add student</button>
        </div>
        <div class="save-hint" id="addHint" style="margin-top:8px;"></div>`)}
      ${section('Enroll', ICON.users, 'Enroll an existing student', `
        <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:10px;">Add a student who is already in another course. They get a new S/N here.</p>
        <input type="text" id="enrollSearch" placeholder="Search name…" style="width:100%; box-sizing:border-box; margin-bottom:8px; padding:7px 10px; border:1.5px solid var(--border-color); border-radius:6px; background:var(--bg-warm); color:var(--text-dark);">
        <select id="enrollSelect" class="panel-select" size="5" style="width:100%; border-radius:8px;"></select>
        <div style="display:flex; gap:10px; align-items:center; margin-top:10px;"><button class="save-btn" id="enrollBtn" type="button">Enroll</button><span class="save-hint" id="enrollHint"></span></div>`)}
      ${section('Seed', ICON.down, 'Bulk seed students', `
        <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:10px;">
          One name per line. Add the Arabic name after a <b>|</b> (for example <span dir="ltr">Ahmad Bello | أحمد بللو</span>). Existing students (matched by name) are skipped, so this is safe to run more than once.
        </p>
        <textarea id="seedNames" placeholder="Full Name One&#10;Full Name Two | الاسم بالعربية" style="width:100%; min-height:160px; font-family:monospace; font-size:0.82rem; padding:10px; border:1.5px solid var(--border-color); border-radius:8px; background:var(--bg-warm); color:var(--text-dark); box-sizing:border-box;"></textarea>
        <div style="display:flex; gap:10px; align-items:center; margin-top:10px; flex-wrap:wrap;">
          <button class="save-btn" id="seedRunBtn" type="button">Seed to database</button>
          <span class="save-hint" id="seedHint"></span>
        </div>
        <div id="seedLog" style="margin-top:10px; font-size:0.75rem; color:var(--text-muted); white-space:pre-wrap; max-height:160px; overflow-y:auto;"></div>`)}
      ${section('Ar', ICON.text, 'Arabic names <span id="arCount" style="font-weight:400; color:var(--text-muted);"></span>', `<div id="arabicList"></div>`)}
      ${section('Course', ICON.gear, 'Course settings', `<div id="courseSettingsBody"></div>`)}
      ${section('Pin', ICON.lock, 'Change teacher PIN', `
        <div class="add-student-form">
          <input type="password" inputmode="numeric" id="oldPinInput" placeholder="Current PIN" autocomplete="off">
          <input type="password" inputmode="numeric" id="newPinInput" placeholder="New PIN (6+ recommended)" autocomplete="off">
          <input type="password" inputmode="numeric" id="confirmPinInput" placeholder="Confirm new PIN" autocomplete="off">
          <button id="changePinBtn"><svg class="icon sm" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>Save PIN</button>
        </div>
        <div class="save-hint" id="pinChangeHint" style="margin-top:8px;"></div>`)}
      <div id="manageEntryList" class="entry-list"></div>
    </div>`;

  for (const id of ['Add', 'Enroll', 'Seed', 'Ar', 'Course', 'Pin']) wireMenuToggle(`menuToggle${id}`, `menuBody${id}`, `menuChevron${id}`);
  document.getElementById('menuToggleEnroll').addEventListener('click', loadEnrollOptions);
  document.getElementById('addStudentBtn').addEventListener('click', addStudent);
  for (const id of ['newStudentName', 'newStudentNameAr']) document.getElementById(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') addStudent(); });
  document.getElementById('changePinBtn').addEventListener('click', changeTeacherPin);
  document.getElementById('confirmPinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') changeTeacherPin(); });
  document.getElementById('seedRunBtn').addEventListener('click', bulkSeedStudents);
  document.getElementById('enrollSearch').addEventListener('input', fillEnrollOptions);
  document.getElementById('enrollBtn').addEventListener('click', enrollExisting);
  refreshManageLists(true);
}

// Repaint only the data-driven parts so typed text in the forms survives realtime refreshes.
export function refreshManageLists(force = false) {
  const course = currentCourse();
  const label = document.getElementById('manageCourseLabel');
  if (label) label.textContent = course ? `Course: ${course.name}${course.status === 'archived' ? ' (archived)' : ''}` : 'No course selected';
  renderManageEntryList();
  renderArabicNames();
  if (force || !state.courseFormDirty) renderCourseSettings();
}

export function wireMenuToggle(toggleId, bodyId, chevronId) {
  document.getElementById(toggleId).addEventListener('click', () => {
    const open = document.getElementById(bodyId).classList.toggle('open');
    document.getElementById(chevronId).innerHTML = open ? '&#9662;' : '&#9656;';
  });
}

// ---------- add / enroll ----------
export async function addStudent() {
  const input = document.getElementById('newStudentName');
  const inputAr = document.getElementById('newStudentNameAr');
  const hint = document.getElementById('addHint');
  const course = currentCourse();
  const name = input.value.trim();
  if (!name) return setHint(hint, 'Enter a name first.', 'err');
  if (!course) return setHint(hint, 'Select a course first.', 'err');
  setHint(hint, 'Adding...', '');
  try {
    const res = await rpc('admin_add_student', { p_course_id: course.id, p_name: name, p_name_ar: inputAr.value.trim() || null });
    input.value = ''; inputAr.value = '';
    await reload();
    setHint('addHint', `Added ${name} (S/N ${res.sn}).` + (res.duplicate_name ? ' Note: a student with the same name is already in this course.' : ''), res.duplicate_name ? '' : 'ok');
  } catch (e) {
    setHint(hint, 'Could not add student: ' + errorMessage(e), 'err');
  }
}

let allStudents = [];
async function loadEnrollOptions() {
  try { allStudents = await rpc('admin_list_students_all'); } catch (e) { setHint('enrollHint', errorMessage(e), 'err'); return; }
  fillEnrollOptions();
}
function fillEnrollOptions() {
  const sel = document.getElementById('enrollSelect');
  if (!sel) return;
  const term = document.getElementById('enrollSearch').value.trim().toLowerCase();
  const enrolled = new Set(state.rows.map(r => r.studentId));
  const list = allStudents.filter(s => !enrolled.has(s.id) && (s.name.toLowerCase().includes(term) || (s.name_ar || '').toLowerCase().includes(term)));
  sel.innerHTML = list.length
    ? list.map(s => `<option value="${escapeAttr(s.id)}">${escapeHtml(s.name)}${s.name_ar ? ' — ' + escapeHtml(s.name_ar) : ''}</option>`).join('')
    : `<option disabled>No students to enroll</option>`;
}
async function enrollExisting() {
  const sel = document.getElementById('enrollSelect');
  const course = currentCourse();
  if (!course || !sel.value) return setHint('enrollHint', 'Pick a student first.', 'err');
  setHint('enrollHint', 'Enrolling...', '');
  try {
    const res = await rpc('admin_enroll_student', { p_course_id: course.id, p_student_id: sel.value });
    await reload();
    fillEnrollOptions();
    setHint('enrollHint', `Enrolled (S/N ${res.sn}).`, 'ok');
  } catch (e) {
    setHint('enrollHint', 'Could not enroll: ' + errorMessage(e), 'err');
  }
}

// ---------- bulk seed (FR-R3) ----------
export async function bulkSeedStudents() {
  const btn = document.getElementById('seedRunBtn');
  const hint = document.getElementById('seedHint');
  const logEl = document.getElementById('seedLog');
  const raw = document.getElementById('seedNames').value;
  const count = raw.split('\n').map(n => n.trim()).filter(Boolean).length;
  const course = currentCourse();
  logEl.textContent = '';
  const log = (msg) => { logEl.textContent += msg + '\n'; logEl.scrollTop = logEl.scrollHeight; };
  if (count === 0) return setHint(hint, 'Enter at least one name first.', 'err');
  if (!course) return setHint(hint, 'Select a course first.', 'err');

  btn.disabled = true;
  setHint(hint, 'Seeding...', '');
  log(`Starting. ${count} line(s) in the box.`);
  try {
    const res = await rpc('admin_bulk_seed', { p_course_id: course.id, p_lines: raw });
    res.skipped.forEach(n => log(`Skipped (already exists): ${n}`));
    res.invalid.forEach(n => log(`Invalid line (name missing or too long): ${n}`));
    log(`Added ${res.added} new student(s).`);
    await reload();
    setHint('seedHint', `Done — ${res.added} added, ${res.skipped.length} skipped${res.invalid.length ? `, ${res.invalid.length} invalid` : ''}.`, 'ok');
  } catch (e) {
    setHint(hint, 'Could not seed: ' + errorMessage(e), 'err');
    log('ERROR: ' + errorMessage(e) + (e.code ? ` (${e.code})` : ''));
  } finally {
    btn.disabled = false;
  }
}

// ---------- Arabic names screen (FR-R5) ----------
export function renderArabicNames() {
  const host = document.getElementById('arabicList');
  if (!host) return;
  const typed = {};
  host.querySelectorAll('input[data-ar-input]').forEach(i => { typed[i.dataset.arInput] = i.value; });
  const missing = state.rows.filter(r => !r.nameAr);
  document.getElementById('arCount').textContent = missing.length ? `(${missing.length} missing)` : '';
  if (missing.length === 0) { host.innerHTML = `<div class="empty-state" style="padding:16px;">Every student in this course has an Arabic name.</div>`; return; }
  host.innerHTML = missing.map(r => `
    <div class="field-row" data-ar-row="${escapeAttr(r.id)}">
      <label style="min-width:0; flex:1 1 100%; color:var(--text-dark); font-weight:600;">${escapeHtml(r.name)} <span style="color:var(--text-muted); font-weight:400;">S/N ${r.sn}</span></label>
      <input type="text" dir="auto" data-ar-input="${escapeAttr(r.id)}" placeholder="الاسم بالعربية" value="${escapeAttr(typed[r.id] || '')}">
      <button class="save-btn" type="button" data-ar-save="${escapeAttr(r.id)}" style="padding:6px 12px; font-size:0.78rem;">Save</button>
      <span class="save-hint" data-ar-hint="${escapeAttr(r.id)}"></span>
    </div>`).join('');
  host.querySelectorAll('[data-ar-save]').forEach(b => b.addEventListener('click', () => saveArabicName(b.dataset.arSave)));
  host.querySelectorAll('input[data-ar-input]').forEach(i => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveArabicName(i.dataset.arInput); }));
}
async function saveArabicName(enrollmentId) {
  const row = findRow(enrollmentId);
  const input = document.querySelector(`input[data-ar-input="${cssEscape(enrollmentId)}"]`);
  const hint = document.querySelector(`[data-ar-hint="${cssEscape(enrollmentId)}"]`);
  if (!row || !input) return;
  const ar = input.value.trim();
  if (!ar) return setHint(hint, 'Type the Arabic name first.', 'err');
  setHint(hint, 'Saving...', '');
  try {
    await rpc('admin_update_student', { p_student_id: row.studentId, p_name: row.name, p_name_ar: ar });
    await reload();
  } catch (e) {
    setHint(hint, errorMessage(e), 'err');
  }
}

// ---------- roster list ----------
export function renderManageEntryList() {
  const list = document.getElementById('manageEntryList');
  if (!list) return;
  if (state.rows.length === 0) { list.innerHTML = `<div class="empty-state">No students yet. Add one above.</div>`; return; }
  const active = state.rows.filter(s => s.active);
  const inactive = state.rows.filter(s => !s.active);
  let html = `<div class="list-subhead">Active (${active.length})</div>`;
  html += active.length ? active.map(manageRowHtml).join('') : `<div class="empty-state" style="padding:16px;">No active students.</div>`;
  if (inactive.length > 0) html += `<div class="list-subhead">Inactive (${inactive.length})</div>` + inactive.map(manageRowHtml).join('');
  list.innerHTML = html;
  state.rows.forEach(s => wireManageRow(s.id));
}

// FR-K1 / FR-C9: why a student can or cannot sit the exam, by the course's rule.
function eligibilityLine(s, course) {
  if (!course) return '';
  const ok = s.status === 'eligible';
  if (course.eligibility_rule === 'teacher_approved') return s.examApproved ? 'Exam: approved by teacher' : 'Exam: awaiting teacher approval';
  if (course.eligibility_rule === 'open') return 'Exam: open to every active student';
  if (ok) return 'Exam: eligible (every unit marked)';
  const marked = s.days.filter(d => d !== null).length;
  return `Exam: not eligible yet (${marked}/${course.day_count} ${unitName(course).toLowerCase()}s marked)`;
}

export function manageRowHtml(s) {
  const course = currentCourse();
  const isOpen = state.entryOpenId === s.id;
  const isRenaming = state.renamingId === s.id;
  const inputStyle = 'min-width:160px; padding:6px 10px; border:1.5px solid var(--border-color); border-radius:6px; font-size:0.9rem; background:var(--bg-warm); color:var(--text-dark);';
  const nameBlock = isRenaming
    ? `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
         <input type="text" id="renameInput-${escapeAttr(s.id)}" value="${escapeAttr(s.name)}" style="flex:1; font-weight:600; ${inputStyle}">
         <input type="text" dir="auto" id="renameArInput-${escapeAttr(s.id)}" value="${escapeAttr(s.nameAr)}" placeholder="الاسم بالعربية" style="flex:1; ${inputStyle}">
         <button class="save-btn" data-save-name="${escapeAttr(s.id)}" style="padding:6px 12px; font-size:0.78rem;">Save</button>
         <button class="ghost-btn" data-cancel-name="${escapeAttr(s.id)}" style="padding:6px 12px; font-size:0.78rem;">Cancel</button>
       </div>`
    : `<div class="entry-row-name">${escapeHtml(s.name)} ${s.active ? '' : '<span class="inactive-pill">Inactive</span>'}
         <button class="ghost-btn" data-edit-name="${escapeAttr(s.id)}" title="Edit names" style="padding:3px 8px; margin-left:4px;"><svg class="icon sm" viewBox="0 0 24 24" style="margin:0;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
       </div>${arHtml(s.nameAr)}`;
  const scored = course && course.lesson_mode === 'scored';
  return `
    <div class="entry-row ${s.active ? '' : 'inactive'}" data-id="${escapeAttr(s.id)}">
      <div class="entry-row-head" data-toggle="${escapeAttr(s.id)}">
        <div>
          ${nameBlock}
          <div class="entry-row-sn">S/N: ${s.sn}</div>
        </div>
        ${scored ? `<div class="entry-row-total">${fmtNum(s.total)} / ${fmtNum(course.lesson_max)}</div>` : ''}
      </div>
      <div class="entry-body ${isOpen ? 'open' : ''}" id="mbody-${escapeAttr(s.id)}">
        <div class="elig-line">${escapeHtml(eligibilityLine(s, course))}</div>
        <div class="entry-footer">
          <div class="entry-footer-actions">
            ${scored ? `<button class="ghost-btn" data-edit-scores="${escapeAttr(s.id)}">Edit scores</button>` : ''}
            ${course && course.eligibility_rule === 'teacher_approved'
              ? `<button class="ghost-btn" data-approve="${escapeAttr(s.id)}">${s.examApproved ? 'Withdraw approval' : 'Approve for exam'}</button>` : ''}
            <button class="ghost-btn" data-toggle-active="${escapeAttr(s.id)}">
              ${s.active
                ? '<svg class="icon sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>Inactivate'
                : '<svg class="icon sm" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>Reactivate'}
            </button>
            <button class="danger-btn" data-delete="${escapeAttr(s.id)}"><svg class="icon sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>Delete</button>
          </div>
          <span class="save-hint" id="mhint-${escapeAttr(s.id)}"></span>
        </div>
      </div>
    </div>`;
}

export function wireManageRow(id) {
  const row = document.querySelector(`#manageEntryList .entry-row[data-id="${cssEscape(id)}"]`);
  if (!row) return;
  const q = (sel) => row.querySelector(sel);
  q('.entry-row-head').addEventListener('click', (e) => {
    if (e.target.closest('[data-edit-name]') || e.target.closest('[data-save-name]') || e.target.closest('[data-cancel-name]') || state.renamingId === id) return;
    state.entryOpenId = state.entryOpenId === id ? null : id;
    renderManageEntryList();
  });
  const editBtn = q(`[data-edit-name]`);
  if (editBtn) editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.renamingId = id;
    renderManageEntryList();
    const inp = document.getElementById(`renameInput-${id}`);
    if (inp) { inp.focus(); inp.select(); }
  });
  const saveNameBtn = q(`[data-save-name]`);
  if (saveNameBtn) saveNameBtn.addEventListener('click', (e) => { e.stopPropagation(); saveStudentName(id); });
  const cancelNameBtn = q(`[data-cancel-name]`);
  if (cancelNameBtn) cancelNameBtn.addEventListener('click', (e) => { e.stopPropagation(); state.renamingId = null; renderManageEntryList(); });
  for (const sel of [`#renameInput-${cssEscape(id)}`, `#renameArInput-${cssEscape(id)}`]) {
    const inp = q(sel);
    if (!inp) continue;
    inp.addEventListener('click', (e) => e.stopPropagation());
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveStudentName(id);
      if (e.key === 'Escape') { state.renamingId = null; renderManageEntryList(); }
    });
  }
  const scoresBtn = q(`[data-edit-scores]`);
  if (scoresBtn) scoresBtn.addEventListener('click', () => openScoreEditor(id));
  const approveBtn = q(`[data-approve]`);
  if (approveBtn) approveBtn.addEventListener('click', () => toggleApproval(id));
  const toggleBtn = q(`[data-toggle-active]`);
  if (toggleBtn) toggleBtn.addEventListener('click', () => toggleActive(id));
  const deleteBtn = q(`[data-delete]`);
  if (deleteBtn) deleteBtn.addEventListener('click', () => confirmDelete(id));
}

function rowHint(id, text) { setHint(document.getElementById(`mhint-${id}`), text, 'err'); }

export async function saveStudentName(id) {
  const s = findRow(id);
  const inp = document.getElementById(`renameInput-${id}`);
  const inpAr = document.getElementById(`renameArInput-${id}`);
  if (!s || !inp) return;
  const name = inp.value.trim();
  if (!name) { inp.classList.add('invalid'); return; }
  try {
    await rpc('admin_update_student', { p_student_id: s.studentId, p_name: name, p_name_ar: inpAr ? inpAr.value.trim() : s.nameAr });
    state.renamingId = null;
    await reload();
  } catch (e) {
    rowHint(id, 'Could not rename: ' + errorMessage(e));
  }
}

export async function toggleActive(id) {
  const s = findRow(id);
  if (!s) return;
  try {
    await rpc('admin_set_active', { p_enrollment_id: s.id, p_active: !s.active });
    state.entryOpenId = null;
    await reload();
  } catch (e) {
    rowHint(id, 'Could not update: ' + errorMessage(e));
  }
}

async function toggleApproval(id) {
  const s = findRow(id);
  if (!s) return;
  try {
    await rpc('admin_set_exam_approval', { p_enrollment_id: s.id, p_approved: !s.examApproved });
    await reload();
  } catch (e) {
    rowHint(id, 'Could not update: ' + errorMessage(e));
  }
}

export async function confirmDelete(id) {
  const s = findRow(id);
  if (!s) return;
  const ok = await confirmDialog({
    title: 'Delete ' + s.name + '?',
    body: 'This permanently removes this student from every course and deletes all their scores. This cannot be undone.',
    okLabel: 'Delete',
  });
  if (!ok) return;
  try {
    await rpc('admin_delete_student', { p_student_id: s.studentId });
    state.entryOpenId = null;
    await reload();
  } catch (e) {
    showStatus('Could not delete student: ' + errorMessage(e), true);
  }
}
