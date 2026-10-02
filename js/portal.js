// Public views: course switcher, directory, leaderboard, full sheet, student score modal.
import { openScoreEditor } from './scores.js';
import { activeRows, currentCourse, findRow, rankRows, state } from './state.js';
import { arHtml, escapeAttr, escapeHtml, fmtNum, unitHtml } from './ui.js';

const LOADING = `<div class="empty-state">Loading…</div>`;
const isScored = (c) => !!c && c.lesson_mode === 'scored';

// FR-C5: the switcher appears when more than one course is selectable. Visitors see active courses;
// a teacher also sees archived ones (marked) so they can be reopened.
export function renderCourseSwitcher() {
  const wrap = document.getElementById('courseSwitchWrap');
  const sel = document.getElementById('courseSwitch');
  const options = state.courses.filter(c => c.status === 'active' || state.teacherUnlocked || c.id === state.courseId);
  wrap.style.display = options.length > 1 ? 'block' : 'none';
  sel.innerHTML = options.map(c =>
    `<option value="${escapeAttr(c.id)}"${c.id === state.courseId ? ' selected' : ''}>${escapeHtml(c.name)}${c.status === 'archived' ? ' (archived)' : ''}</option>`).join('');
}

export function renderDirectory() {
  const grid = document.getElementById('studentGrid');
  if (!state.loaded) { grid.innerHTML = LOADING; return; }
  const course = currentCourse();
  const rows = activeRows();
  const term = (document.getElementById('search').value || '').trim().toLowerCase();
  const filtered = rows.filter(s => s.name.toLowerCase().includes(term) || s.nameAr.toLowerCase().includes(term));
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">${rows.length === 0 ? 'No students yet.' : 'No matching students.'}</div>`;
    return;
  }
  grid.innerHTML = filtered.map(s => `
    <div class="student-card" data-id="${escapeAttr(s.id)}">
      <div class="student-info"><h3>${escapeHtml(s.name)}</h3>${arHtml(s.nameAr)}<span>S/N: ${s.sn}</span></div>
      ${isScored(course) ? `<div class="view-badge">${fmtNum(s.total)} / ${fmtNum(course.lesson_max)}</div>` : ''}
    </div>`).join('');
  grid.querySelectorAll('.student-card').forEach(card => card.addEventListener('click', () => openStudentModal(card.dataset.id)));
}

export function openStudentModal(id) {
  const s = findRow(id);
  const course = currentCourse();
  if (!s || !course) return;
  document.getElementById('modalName').textContent = s.name + (s.nameAr ? ' — ' + s.nameAr : '');
  document.getElementById('modalSN').textContent = `Student S/N: ${s.sn}`;
  const scored = isScored(course);
  const summary = document.querySelector('#scoreModal .score-summary-box');
  summary.style.display = scored ? '' : 'none';
  document.getElementById('modalTotal').textContent = fmtNum(s.total);
  document.getElementById('modalTotalLbl').textContent = `Total Accumulated Score (max ${fmtNum(course.lesson_max)})`;
  const grid = document.getElementById('modalScoreGrid');
  grid.innerHTML = !scored ? '' : s.days.map((score, i) => {
    const bonus = s.bonusUnits[i] || 0;
    const bonusNote = bonus > 0 ? ` <span style="color:var(--gold-ochre); font-weight:600;">+${fmtNum(bonus * course.bonus_unit_value)}</span>` : '';
    return `
    <div class="score-item"><div class="day">${unitHtml(course, i)}</div><div class="val">${score !== null ? score : '-'}${bonusNote}</div></div>`;
  }).join('');

  const editBtnWrap = document.getElementById('modalEditWrap');
  if (state.teacherUnlocked && scored) {
    editBtnWrap.style.display = 'block';
    editBtnWrap.innerHTML = `<button class="save-btn" id="modalEditBtn" style="width:100%; justify-content:center; margin-top:14px;"><svg class="icon" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Edit scores</button>`;
    document.getElementById('modalEditBtn').addEventListener('click', () => {
      closeModal();
      openScoreEditor(s.id);
    });
  } else {
    editBtnWrap.style.display = 'none';
    editBtnWrap.innerHTML = '';
  }
  document.getElementById('scoreModal').style.display = 'flex';
}
export function closeModal() { document.getElementById('scoreModal').style.display = 'none'; }

// Competition ranking (D-26): ties share a rank, the next rank skips (1, 2, 2, 4).
export function renderLeaderboard() {
  const list = document.getElementById('leaderboardList');
  if (!state.loaded) { list.innerHTML = LOADING; return; }
  const course = currentCourse();
  if (course && !isScored(course)) {          // exam-only course: rankings come with the exam (Phase 3)
    list.innerHTML = `<div class="empty-state">Rankings appear once students have completed the exam.</div>`;
    return;
  }
  const ranked = rankRows(activeRows());
  if (ranked.length === 0) { list.innerHTML = `<div class="empty-state">No students yet.</div>`; return; }
  list.innerHTML = ranked.map(({ row: s, rank }) => {
    let badgeClass = '', rankDisplay = rank;
    if (rank === 1) { badgeClass = 'rank-1'; rankDisplay = medalIcon('#B45309'); }
    else if (rank === 2) { badgeClass = 'rank-2'; rankDisplay = medalIcon('#475569'); }
    else if (rank === 3) { badgeClass = 'rank-3'; rankDisplay = medalIcon('#C2410C'); }
    return `
      <div class="leader-item">
        <div class="leader-rank ${badgeClass}">${rankDisplay}</div>
        <div class="leader-name">${escapeHtml(s.name)}${arHtml(s.nameAr)}</div>
        <div class="leader-score">${fmtNum(s.total)} pts</div>
      </div>`;
  }).join('');
}
export function medalIcon(color) {
  return `<svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:${color};fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;"><circle cx="12" cy="15" r="6"/><path d="M9 10.5L7 3h2l3 6 3-6h2l-2 7.5"/></svg>`;
}

export function renderTable() {
  const headerRow = document.getElementById('tableHeader');
  const body = document.getElementById('tableBody');
  if (!state.loaded) { headerRow.innerHTML = ''; body.innerHTML = `<tr><td class="empty-state">Loading…</td></tr>`; return; }
  const course = currentCourse();
  const scored = isScored(course);
  const heads = ['S/N', 'Student Name'];
  if (scored) {
    for (let i = 0; i < course.day_count; i++) heads.push(unitHtml(course, i));
    heads.push('Bonus', 'Total');
  }
  headerRow.innerHTML = heads.map(h => `<th>${h}</th>`).join('');
  const rows = activeRows();
  if (rows.length === 0) { body.innerHTML = `<tr><td colspan="${heads.length}" class="empty-state">No students yet.</td></tr>`; return; }
  body.innerHTML = rows.map(s => `
    <tr>
      <td>${s.sn}</td>
      <td class="name-cell">${escapeHtml(s.name)}${arHtml(s.nameAr)}</td>
      ${scored ? s.days.map(d => `<td>${d !== null ? d : '-'}</td>`).join('') : ''}
      ${scored ? `<td>${fmtNum(s.bonusPoints)}</td><td class="total-cell">${fmtNum(s.total)}</td>` : ''}
    </tr>`).join('');
}
document.getElementById('search').addEventListener('input', renderDirectory);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('scoreModal').addEventListener('click', (e) => { if (e.target.id === 'scoreModal') closeModal(); });
