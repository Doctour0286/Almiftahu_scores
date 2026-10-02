// Teacher score editor wizard (unit picker, then one unit at a time). Every save is admin_save_day:
// the server validates the ranges against the course and recomputes the result (FR-S2, FR-S3).
import { rpc, errorMessage } from './api.js';
import { renderAll } from './main.js';
import { bonusFromDb, currentCourse, daysFromDb, findRow, lessonPoints, bonusPoints, state } from './state.js';
import { fmtNum, setHint, unitName } from './ui.js';

export function openScoreEditor(enrollmentId) {
  const course = currentCourse();
  if (!findRow(enrollmentId) || !course || course.lesson_mode !== 'scored') return;
  state.editingEnrollmentId = enrollmentId;
  state.editingDayIndex = null;
  renderScoreEditor();
  setHint('editPickerHint', '', '');
  document.getElementById('scoreEditModal').style.display = 'flex';
}
export function closeScoreEditor() {
  document.getElementById('scoreEditModal').style.display = 'none';
  state.editingEnrollmentId = null;
  state.editingDayIndex = null;
}

export function renderScoreEditor() {
  const s = findRow(state.editingEnrollmentId);
  const course = currentCourse();
  if (!s || !course || course.lesson_mode !== 'scored') { closeScoreEditor(); return; }
  const unit = unitName(course);
  document.getElementById('editModalName').textContent = s.name;
  document.getElementById('editModalTotal').textContent = `Total: ${fmtNum(s.total)} / ${fmtNum(course.lesson_max)}`;
  document.getElementById('editPickHelp').textContent = `Select a ${unit.toLowerCase()} to edit`;

  if (state.editingDayIndex === null) { renderDayPicker(s, course); return; }

  document.getElementById('editPickerView').style.display = 'none';
  document.getElementById('editFormView').style.display = 'block';
  const i = state.editingDayIndex;
  document.getElementById('editDayLabel').textContent = `${unit} ${i + 1}`;
  document.getElementById('editSaveText').textContent = `Save ${unit} ${i + 1}`;
  document.getElementById('editBackToDays').textContent = `\u2190 ${unit}s`;
  document.getElementById('editScoreLabel').innerHTML = `Score (0-<span id="editDayMaxLabel">${fmtNum(course.day_max)}</span>)`;
  document.getElementById('editBonusLabel').innerHTML = `Bonus units for this ${escapeText(unit.toLowerCase())} (each = <span id="editBonusValLabel">${fmtNum(course.bonus_unit_value)}</span> pts)`;
  const scoreInput = document.getElementById('editDayScoreInput');
  scoreInput.max = course.day_max; scoreInput.placeholder = `0-${fmtNum(course.day_max)}`;
  scoreInput.value = s.days[i] !== null ? s.days[i] : '';
  scoreInput.classList.remove('invalid');
  const bonusInput = document.getElementById('editDayBonusInput');
  bonusInput.value = s.bonusUnits[i] || '';
  bonusInput.classList.remove('invalid');
  setHint('editHint', '', '');
}
const escapeText = (t) => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function renderDayPicker(s, course) {
  document.getElementById('editFormView').style.display = 'none';
  document.getElementById('editPickerView').style.display = 'block';
  const dots = document.getElementById('editDayDots');
  dots.innerHTML = Array.from({ length: course.day_count }, (_, i) => {
    const has = s.days[i] !== null;
    return `<button type="button" data-day-dot="${i}" style="width:38px; height:38px; border-radius:50%; border:1.5px solid var(--border-color); background:${has ? 'var(--gold-soft)' : 'var(--card-bg)'}; color:var(--text-muted); font-size:0.8rem; font-weight:700; cursor:pointer;">${i + 1}</button>`;
  }).join('');
  dots.querySelectorAll('[data-day-dot]').forEach(btn => {
    btn.addEventListener('click', () => { state.editingDayIndex = Number(btn.dataset.dayDot); renderScoreEditor(); });
  });
}

export async function saveEditorDay() {
  const s = findRow(state.editingEnrollmentId);
  const course = currentCourse();
  if (!s || !course) return;
  const idx = state.editingDayIndex;
  const scoreInput = document.getElementById('editDayScoreInput');
  const bonusInput = document.getElementById('editDayBonusInput');

  // Client-side check for fast feedback; the server enforces the same rules (AC-0.8).
  let hasError = false;
  let scoreNum = null;
  if (scoreInput.value !== '') {
    scoreNum = Number(scoreInput.value);
    hasError = !Number.isInteger(scoreNum) || scoreNum < 0 || scoreNum > course.day_max;
  }
  scoreInput.classList.toggle('invalid', hasError && scoreInput.value !== '');
  let bonusNum = 0, bonusBad = false;
  if (bonusInput.value !== '') {
    bonusNum = Number(bonusInput.value);
    bonusBad = !Number.isInteger(bonusNum) || bonusNum < 0;
  }
  bonusInput.classList.toggle('invalid', bonusBad);
  if (hasError || bonusBad) {
    setHint('editHint', `Fix the highlighted fields (whole numbers: 0-${fmtNum(course.day_max)} for score, bonus \u2265 0).`, 'err');
    return;
  }

  const btn = document.getElementById('editSaveBtn');
  btn.disabled = true;
  setHint('editHint', 'Saving...', '');
  try {
    const res = await rpc('admin_save_day', { p_enrollment_id: s.id, p_day_index: idx, p_score: scoreNum, p_bonus: bonusNum });
    const count = course.day_count;
    s.days = daysFromDb(res.days, count);
    s.bonusUnits = bonusFromDb(res.bonus_units, count);
    s.total = lessonPoints(s.days, s.bonusUnits, course);
    s.bonusPoints = bonusPoints(s.bonusUnits, course);
    if (res.status) s.status = res.status;
    renderAll();
    state.editingDayIndex = null;
    renderScoreEditor();
    setHint('editPickerHint', `${unitName(course)} ${idx + 1} saved.`, 'ok');
  } catch (e) {
    setHint('editHint', 'Could not save: ' + errorMessage(e), 'err');
  } finally {
    btn.disabled = false;
  }
}
document.getElementById('scoreEditClose').addEventListener('click', closeScoreEditor);
document.getElementById('scoreEditModal').addEventListener('click', (e) => { if (e.target.id === 'scoreEditModal') closeScoreEditor(); });
document.getElementById('editBackToDays').addEventListener('click', () => {
  state.editingDayIndex = null;
  renderScoreEditor();
  setHint('editPickerHint', '', '');
});
document.getElementById('editSaveBtn').addEventListener('click', saveEditorDay);
