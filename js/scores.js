// Teacher score editor wizard (day picker, then one day at a time).
import { BONUS_UNIT_VALUE, DAY_COUNT, DAY_MAX } from './config.js';
import { sb } from './api.js';
import { renderDirectory, renderLeaderboard, renderTable } from './portal.js';
import { computeTotal, daysToDb, state } from './state.js';

// ---------- Score edit wizard (day picker, then one day at a time, teacher only) ----------
export function openScoreEditor(id) {
  const s = state.allStudents.find(x => x.id === id);
  if (!s) return;
  state.editingStudentId = id;
  state.editingDayIndex = null;
  renderScoreEditor();
  const pickerHint = document.getElementById('editPickerHint');
  if (pickerHint) { pickerHint.textContent = ''; pickerHint.className = 'save-hint'; }
  document.getElementById('scoreEditModal').style.display = 'flex';
}
export function closeScoreEditor() {
  document.getElementById('scoreEditModal').style.display = 'none';
  state.editingStudentId = null;
  state.editingDayIndex = null;
}

export function renderScoreEditor() {
  const s = state.allStudents.find(x => x.id === state.editingStudentId);
  if (!s) { closeScoreEditor(); return; }
  document.getElementById('editModalName').textContent = s.name;
  document.getElementById('editModalTotal').textContent = `Total: ${s.total} / 100`;

  if (state.editingDayIndex === null) {
    renderDayPicker(s);
    return;
  }

  document.getElementById('editPickerView').style.display = 'none';
  document.getElementById('editFormView').style.display = 'block';

  document.getElementById('editDayLabel').textContent = `Day ${state.editingDayIndex + 1}`;
  document.getElementById('editSaveDayLabel').textContent = state.editingDayIndex + 1;
  document.getElementById('editDayMaxLabel').textContent = DAY_MAX;
  document.getElementById('editBonusValLabel').textContent = BONUS_UNIT_VALUE;
  const scoreVal = s.days[state.editingDayIndex];
  const bonusVal = s.bonusUnits[state.editingDayIndex] || 0;
  document.getElementById('editDayScoreInput').value = scoreVal !== null ? scoreVal : '';
  document.getElementById('editDayBonusInput').value = bonusVal || '';
  document.getElementById('editHint').textContent = '';
  document.getElementById('editHint').className = 'save-hint';
}

export function renderDayPicker(s) {
  document.getElementById('editFormView').style.display = 'none';
  document.getElementById('editPickerView').style.display = 'block';

  const dots = document.getElementById('editDayDots');
  dots.innerHTML = Array.from({ length: DAY_COUNT }, (_, i) => {
    const has = s.days[i] !== null;
    return `<button type="button" data-day-dot="${i}" style="width:38px; height:38px; border-radius:50%; border:1.5px solid var(--border-color); background:${has ? 'var(--gold-soft)' : 'var(--card-bg)'}; color:var(--text-muted); font-size:0.8rem; font-weight:700; cursor:pointer;">${i + 1}</button>`;
  }).join('');
  dots.querySelectorAll('[data-day-dot]').forEach(btn => {
    btn.addEventListener('click', () => { state.editingDayIndex = Number(btn.dataset.dayDot); renderScoreEditor(); });
  });
}

export async function saveEditorDay() {
  const s = state.allStudents.find(x => x.id === state.editingStudentId);
  if (!s) return;
  const hint = document.getElementById('editHint');
  const scoreInput = document.getElementById('editDayScoreInput');
  const bonusInput = document.getElementById('editDayBonusInput');

  let hasError = false;
  const sv = scoreInput.value;
  let scoreNum = null;
  if (sv !== '') {
    scoreNum = Number(sv);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > DAY_MAX) { hasError = true; scoreInput.classList.add('invalid'); }
    else scoreInput.classList.remove('invalid');
  } else {
    scoreInput.classList.remove('invalid');
  }
  const bv = bonusInput.value;
  let bonusNum = 0;
  if (bv !== '') {
    bonusNum = Number(bv);
    if (isNaN(bonusNum) || bonusNum < 0) { hasError = true; bonusInput.classList.add('invalid'); }
    else bonusInput.classList.remove('invalid');
  } else {
    bonusInput.classList.remove('invalid');
  }

  if (hasError) {
    hint.textContent = `Fix the highlighted fields (0-${DAY_MAX} for score, bonus \u2265 0).`;
    hint.className = 'save-hint err';
    return;
  }

  const newDays = [...s.days];
  const newBonus = [...s.bonusUnits];
  newDays[state.editingDayIndex] = scoreNum;
  newBonus[state.editingDayIndex] = bonusNum;

  const btn = document.getElementById('editSaveBtn');
  btn.disabled = true;
  hint.textContent = 'Saving...';
  hint.className = 'save-hint';
  try {
    const { error } = await sb.from('students').update({ days: daysToDb(newDays), bonus_units: daysToDb(newBonus) }).eq('id', s.id);
    if (error) throw error;
    s.days = newDays;
    s.bonusUnits = newBonus;
    s.total = computeTotal(newDays, newBonus);
    state.students = state.allStudents.filter(x => x.active);
    renderDirectory(); renderLeaderboard(); renderTable();
    const savedDay = state.editingDayIndex + 1;
    state.editingDayIndex = null;
    renderScoreEditor();
    const pickerHint = document.getElementById('editPickerHint');
    if (pickerHint) { pickerHint.textContent = `Day ${savedDay} saved.`; pickerHint.className = 'save-hint ok'; }
  } catch (e) {
    hint.textContent = 'Could not save: ' + (e && e.message ? e.message : 'try again.');
    hint.className = 'save-hint err';
  } finally {
    btn.disabled = false;
  }
}
document.getElementById('scoreEditClose').addEventListener('click', closeScoreEditor);
document.getElementById('scoreEditModal').addEventListener('click', (e) => { if (e.target.id === 'scoreEditModal') closeScoreEditor(); });
document.getElementById('editBackToDays').addEventListener('click', () => {
  state.editingDayIndex = null;
  renderScoreEditor();
  const pickerHint = document.getElementById('editPickerHint');
  if (pickerHint) { pickerHint.textContent = ''; pickerHint.className = 'save-hint'; }
});
document.getElementById('editSaveBtn').addEventListener('click', saveEditorDay);
