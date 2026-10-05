// Course settings (FR-C1..C4, C6, C7, C9): edit the selected course, create a new one (blank or copied
// from an existing course), archive/unarchive. Every write is admin_save_course / admin_set_course_status.
import { rpc, errorMessage } from './api.js';
import { chooseCourse } from './data.js';
import { reload } from './main.js';
import { currentCourse, state } from './state.js';
import { confirmDialog, escapeAttr, escapeHtml, setHint } from './ui.js';

// Built-in defaults for a blank course (D-40).
const BLANK = {
  code: '', name: '', name_ar: '', unit_label: 'Day', unit_label_ar: '', lesson_mode: 'scored',
  eligibility_rule: 'all_units', day_count: 10, day_max: 10, bonus_unit_value: 2, lesson_max: 100,
  weight_lessons: 50, weight_exam: 50, pass_mark: 60,
  grade_bands: [
    { label: 'Excellent', label_ar: 'ممتاز', min: 90 }, { label: 'Very Good', label_ar: 'جيد جداً', min: 80 },
    { label: 'Good', label_ar: 'جيد', min: 70 }, { label: 'Pass', label_ar: 'مقبول', min: 60 },
  ],
};
const FIELDS = Object.keys(BLANK);

const RULES = {
  all_units: 'Every unit marked',
  teacher_approved: 'Teacher approves each student',
  open: 'Open (every active student; the code is the gate)',
};

function valuesFrom(course) {
  const v = {};
  for (const k of FIELDS) v[k] = course[k] === null || course[k] === undefined ? BLANK[k] : course[k];
  v.name_ar = course.name_ar || ''; v.unit_label_ar = course.unit_label_ar || '';
  v.grade_bands = JSON.parse(JSON.stringify(course.grade_bands || BLANK.grade_bands));
  return v;
}

export function renderCourseSettings() {
  const host = document.getElementById('courseSettingsBody');
  if (!host) return;
  const course = currentCourse();
  const creating = !!state.courseDraft;
  if (creating) {
    if (!state.courseDraft.values) state.courseDraft.values = { ...valuesFrom(BLANK), grade_bands: JSON.parse(JSON.stringify(BLANK.grade_bands)) };
    paint(host, state.courseDraft.values, true);
  } else if (course) {
    paint(host, valuesFrom(course), false);
  } else {
    host.innerHTML = `<div class="empty-state" style="padding:16px;">No course yet.</div><button class="save-btn" id="courseNewBtn" type="button">New course</button>`;
    document.getElementById('courseNewBtn').addEventListener('click', startNew);
  }
}

function startNew() {
  state.courseDraft = { copyFrom: '', values: null };
  state.courseFormDirty = true;
  renderCourseSettings();
}
function cancelNew() {
  state.courseDraft = null; state.courseFormDirty = false;
  renderCourseSettings();
}

function paint(host, v, creating) {
  const none = v.lesson_mode === 'none';
  const course = currentCourse();
  const ruleOptions = Object.entries(RULES).filter(([k]) => !(none && k === 'all_units'));
  const num = (id, label, val, extra = '') => `<div class="field-row"><label for="${id}">${label}</label><input type="number" id="${id}" value="${escapeAttr(val)}" step="any" ${none ? 'disabled' : ''} ${extra}></div>`;
  const txt = (id, label, val, extra = '') => `<div class="field-row"><label for="${id}">${label}</label><input type="text" id="${id}" value="${escapeAttr(val)}" ${extra}></div>`;
  host.innerHTML = `
    <div class="field-row" style="justify-content:space-between;">
      <b>${creating ? 'New course' : escapeHtml(course.name)}</b>
      ${creating
        ? `<button class="ghost-btn" id="courseCancelBtn" type="button">Cancel</button>`
        : `<span><button class="ghost-btn" id="courseNewBtn" type="button">New course</button>
             <button class="ghost-btn" id="courseArchiveBtn" type="button">${course.status === 'archived' ? 'Unarchive' : 'Archive'}</button></span>`}
    </div>
    ${creating ? `<div class="field-row"><label for="cfCopy">Start from</label>
      <select id="cfCopy" class="panel-select"><option value="">Blank (defaults)</option>
      ${state.courses.map(c => `<option value="${escapeAttr(c.id)}"${state.courseDraft.copyFrom === c.id ? ' selected' : ''}>Copy from ${escapeHtml(c.name)}</option>`).join('')}</select></div>` + (state.courseDraft.copyFrom ? `<div class="field-row"><label for="cfCopyExam">Exam</label><label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; cursor:pointer;"><input type="checkbox" id="cfCopyExam" checked> Also copy the exam as a draft</label></div>` : '') : ''}
    ${txt('cfCode', creating ? 'Code (A-Z, 0-9, -)' : 'Code (fixed)', v.code, creating ? 'maxlength="12" autocapitalize="characters"' : 'readonly')}
    ${txt('cfName', 'Name', v.name)}
    ${txt('cfNameAr', 'Name (Arabic)', v.name_ar, 'dir="auto"')}
    ${txt('cfUnit', 'Unit label (e.g. Day, Week)', v.unit_label, 'maxlength="30"')}
    ${txt('cfUnitAr', 'Unit label (Arabic)', v.unit_label_ar, 'dir="auto"')}
    <div class="field-row"><label for="cfMode">Lesson scores</label>
      <select id="cfMode"><option value="scored"${none ? '' : ' selected'}>Scored units</option><option value="none"${none ? ' selected' : ''}>None (exam only)</option></select></div>
    <div class="field-row"><label for="cfRule">Exam eligibility</label>
      <select id="cfRule">${ruleOptions.map(([k, t]) => `<option value="${k}"${v.eligibility_rule === k ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></div>
    ${num('cfCount', 'Number of units (1-60)', none ? 0 : v.day_count, 'min="1" max="60" step="1"')}
    ${num('cfMax', 'Max score per unit', v.day_max, 'min="1" step="1"')}
    ${num('cfBonus', 'Bonus unit value (pts)', v.bonus_unit_value, 'min="0"')}
    ${num('cfLessonMax', 'Lesson maximum', v.lesson_max, 'min="1"')}
    ${num('cfWL', 'Weight: lessons (%)', none ? 0 : v.weight_lessons, 'min="0" max="100"')}
    ${num('cfWE', 'Weight: exam (%)', none ? 100 : v.weight_exam, 'min="0" max="100"')}
    <div class="field-row"><label for="cfPass">Pass mark (0-100)</label><input type="number" id="cfPass" value="${escapeAttr(v.pass_mark)}" min="0" max="100" step="any"></div>
    <div style="font-size:0.78rem; color:var(--text-muted); margin:10px 0 6px;">Grade bands (minimum final score for each label)</div>
    <div id="cfBands">${v.grade_bands.map((b, i) => `
      <div class="band-row" data-band="${i}">
        <input type="text" class="band-label" placeholder="Label" value="${escapeAttr(b.label || '')}">
        <input type="text" class="band-label-ar" placeholder="Arabic" dir="auto" value="${escapeAttr(b.label_ar || '')}">
        <input type="number" class="band-min" placeholder="Min" min="0" max="100" value="${escapeAttr(b.min ?? '')}">
        <button class="ghost-btn" type="button" data-band-del="${i}" title="Remove">&times;</button>
      </div>`).join('')}</div>
    <button class="ghost-btn" id="cfBandAdd" type="button" style="margin-bottom:12px;">+ Add band</button>
    <div class="entry-footer"><button class="save-btn" id="courseSaveBtn" type="button">${creating ? 'Create course' : 'Save course settings'}</button>
      <span class="save-hint" id="courseHint"></span></div>`;

  host.querySelectorAll('input, select').forEach(el => el.addEventListener('input', () => { state.courseFormDirty = true; }));
  const cancel = document.getElementById('courseCancelBtn'); if (cancel) cancel.addEventListener('click', cancelNew);
  const nw = document.getElementById('courseNewBtn'); if (nw) nw.addEventListener('click', startNew);
  const arch = document.getElementById('courseArchiveBtn'); if (arch) arch.addEventListener('click', toggleArchive);
  document.getElementById('cfMode').addEventListener('change', () => {
    const next = readForm(); next.lesson_mode = document.getElementById('cfMode').value;
    if (next.lesson_mode === 'none' && next.eligibility_rule === 'all_units') next.eligibility_rule = 'open';   // FR-C9
    if (next.lesson_mode === 'scored') { next.day_count = next.day_count || 10; next.weight_lessons = 50; next.weight_exam = 50; }
    if (creating) state.courseDraft.values = next;
    state.courseFormDirty = true;
    paint(host, next, creating);
  });
  const copy = document.getElementById('cfCopy');
  if (copy) copy.addEventListener('change', () => {
    const typed = readForm();
    const src = state.courses.find(c => c.id === copy.value);
    const base = src ? valuesFrom(src) : valuesFrom(BLANK);
    state.courseDraft.copyFrom = copy.value;
    state.courseDraft.values = { ...base, code: typed.code, name: typed.name, name_ar: typed.name_ar };   // code/name are always new (FR-C7)
    paint(host, state.courseDraft.values, true);
  });
  document.getElementById('cfBandAdd').addEventListener('click', () => {
    const next = readForm(); next.grade_bands.push({ label: '', label_ar: '', min: '' });
    if (creating) state.courseDraft.values = next;
    state.courseFormDirty = true; paint(host, next, creating);
  });
  host.querySelectorAll('[data-band-del]').forEach(btn => btn.addEventListener('click', () => {
    const next = readForm(); next.grade_bands.splice(Number(btn.dataset.bandDel), 1);
    if (creating) state.courseDraft.values = next;
    state.courseFormDirty = true; paint(host, next, creating);
  }));
  document.getElementById('courseSaveBtn').addEventListener('click', saveCourse);
}

function readForm() {
  const g = (id) => document.getElementById(id).value;
  const n = (id) => (g(id).trim() === '' ? NaN : Number(g(id)));
  const v = {
    code: g('cfCode').trim().toUpperCase(), name: g('cfName').trim(), name_ar: g('cfNameAr').trim(),
    unit_label: g('cfUnit').trim(), unit_label_ar: g('cfUnitAr').trim(),
    lesson_mode: g('cfMode'), eligibility_rule: g('cfRule'),
    day_count: n('cfCount'), day_max: n('cfMax'), bonus_unit_value: n('cfBonus'), lesson_max: n('cfLessonMax'),
    weight_lessons: n('cfWL'), weight_exam: n('cfWE'), pass_mark: n('cfPass'),
    grade_bands: [...document.querySelectorAll('#cfBands .band-row')].map(r => ({
      label: r.querySelector('.band-label').value.trim(), label_ar: r.querySelector('.band-label-ar').value.trim(),
      min: r.querySelector('.band-min').value.trim() === '' ? '' : Number(r.querySelector('.band-min').value),
    })),
  };
  return v;
}

function clientCheck(v, creating) {
  const none = v.lesson_mode === 'none';
  if (creating && !/^[A-Z0-9-]{2,12}$/.test(v.code)) return 'Course code must be 2-12 characters: capital letters, digits, hyphen.';
  if (!v.name) return 'Course name is required.';
  if (!v.unit_label) return 'Unit label is required.';
  if (!(v.pass_mark >= 0 && v.pass_mark <= 100)) return 'Pass mark must be between 0 and 100.';
  if (!none) {
    if (!Number.isInteger(v.day_count) || v.day_count < 1 || v.day_count > 60) return 'Number of units must be a whole number from 1 to 60.';
    if (!Number.isInteger(v.day_max) || v.day_max < 1) return 'Maximum score per unit must be a whole number, at least 1.';
    if (!(v.bonus_unit_value >= 0)) return 'Bonus unit value cannot be negative.';
    if (!(v.lesson_max > 0)) return 'Lesson maximum must be greater than 0.';
    if (!(v.weight_lessons >= 0 && v.weight_exam >= 0) || v.weight_lessons + v.weight_exam !== 100) return 'Lesson and exam weights must add up to 100.';
  }
  const mins = v.grade_bands.map(b => b.min);
  if (v.grade_bands.some(b => !b.label || typeof b.min !== 'number' || !(b.min >= 0 && b.min <= 100))) return 'Each grade band needs a label and a minimum between 0 and 100.';
  if (new Set(mins).size !== mins.length) return 'Grade band minimums must be unique.';
  return '';
}

async function saveCourse() {
  const creating = !!state.courseDraft;
  const v = readForm();
  const problem = clientCheck(v, creating);
  if (problem) return setHint('courseHint', problem, 'err');
  const none = v.lesson_mode === 'none';
  const course = currentCourse();
  const payload = {
    name: v.name, name_ar: v.name_ar, unit_label: v.unit_label, unit_label_ar: v.unit_label_ar,
    lesson_mode: v.lesson_mode, eligibility_rule: v.eligibility_rule, pass_mark: v.pass_mark, grade_bands: v.grade_bands,
    day_count: none ? 0 : v.day_count, day_max: none ? course ? course.day_max : 10 : v.day_max,
    bonus_unit_value: none ? 0 : v.bonus_unit_value, lesson_max: none ? 100 : v.lesson_max,
    weight_lessons: none ? 0 : v.weight_lessons, weight_exam: none ? 100 : v.weight_exam,
  };
  if (creating) payload.code = v.code; else { payload.id = course.id; payload.code = course.code; }
  const copyFrom = creating && state.courseDraft.copyFrom ? state.courseDraft.copyFrom : null;
  const copyExam = creating && copyFrom ? !!(document.getElementById('cfCopyExam') && document.getElementById('cfCopyExam').checked) : false;

  const btn = document.getElementById('courseSaveBtn');
  btn.disabled = true; setHint('courseHint', 'Saving...', '');
  try {
    const call = (confirm) => rpc('admin_save_course', { p_course: payload, p_confirm: confirm, p_copy_from: copyFrom, p_copy_exam: copyExam });
    let res;
    try { res = await call(false); }
    catch (e) {
      if (e.code !== 'E_CONFIRM_REQUIRED') throw e;
      const n = Number(e.detail) || 0;       // AC-0.9: say how many students are affected
      const shrink = !creating && course && !none && v.day_count < course.day_count;
      const ok = await confirmDialog({
        title: 'Change scoring settings?',
        body: `This affects ${n} student${n === 1 ? '' : 's'} and recomputes all their results.` +
          (shrink ? ` Scores in the ${course.day_count - v.day_count} removed unit(s) will be deleted.` : '') + ' Continue?',
        okLabel: 'Apply changes',
      });
      if (!ok) { setHint('courseHint', 'Not saved.', ''); return; }
      res = await call(true);
    }
    state.courseFormDirty = false;
    state.courseDraft = null;
    chooseCourse(res.course.id);
    await reload({ coursesToo: true });
    setHint('courseHint', creating ? 'Course created.' : `Saved (${res.affected} enrollment${res.affected === 1 ? '' : 's'} recomputed).`, 'ok');
  } catch (e) {
    setHint('courseHint', 'Could not save: ' + errorMessage(e), 'err');
  } finally {
    const b = document.getElementById('courseSaveBtn'); if (b) b.disabled = false;
  }
}

async function toggleArchive() {
  const course = currentCourse();
  if (!course) return;
  const archiving = course.status !== 'archived';
  if (archiving) {
    const ok = await confirmDialog({ title: `Archive ${course.name}?`, body: 'Archived courses accept no new students and are hidden from visitors. You can unarchive it later.', okLabel: 'Archive' });
    if (!ok) return;
  }
  try {
    await rpc('admin_set_course_status', { p_course_id: course.id, p_status: archiving ? 'archived' : 'active' });
    await reload({ coursesToo: true });
  } catch (e) {
    setHint('courseHint', 'Could not update: ' + errorMessage(e), 'err');
  }
}
