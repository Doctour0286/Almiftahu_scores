// Public views: directory, leaderboard, full sheet, student score modal.
import { BONUS_UNIT_VALUE, DAY_COUNT } from './config.js';
import { openScoreEditor } from './scores.js';
import { state } from './state.js';
import { escapeAttr, escapeHtml } from './ui.js';

export function renderDirectory() {
  const grid = document.getElementById('studentGrid');
  const term = (document.getElementById('search').value || '').toLowerCase();
  const filtered = state.students.filter(s => s.name.toLowerCase().includes(term));
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">${state.students.length === 0 ? 'No students yet.' : 'No matching students.'}</div>`;
    return;
  }
  grid.innerHTML = filtered.map(s => `
    <div class="student-card" data-id="${escapeAttr(s.id)}">
      <div class="student-info"><h3>${escapeHtml(s.name)}</h3><span>S/N: ${s.sn}</span></div>
      <div class="view-badge">${s.total} / 100</div>
    </div>`).join('');
  grid.querySelectorAll('.student-card').forEach(card => card.addEventListener('click', () => openStudentModal(card.dataset.id)));
}

export function openStudentModal(id) {
  const s = state.students.find(x => x.id === id) || state.allStudents.find(x => x.id === id);
  if (!s) return;
  document.getElementById('modalName').textContent = s.name;
  document.getElementById('modalSN').textContent = `Student S/N: ${s.sn}`;
  document.getElementById('modalTotal').textContent = s.total;
  const grid = document.getElementById('modalScoreGrid');
  const html = s.days.map((score, i) => {
    const bonus = s.bonusUnits[i] || 0;
    const bonusNote = bonus > 0 ? ` <span style="color:var(--gold-ochre); font-weight:600;">+${bonus * BONUS_UNIT_VALUE}</span>` : '';
    return `
    <div class="score-item"><div class="day">Day ${i + 1}</div><div class="val">${score !== null ? score : '-'}${bonusNote}</div></div>`;
  }).join('');
  grid.innerHTML = html;

  const editBtnWrap = document.getElementById('modalEditWrap');
  if (state.teacherUnlocked) {
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

export function renderLeaderboard() {
  const list = document.getElementById('leaderboardList');
  if (state.students.length === 0) { list.innerHTML = `<div class="empty-state">No students yet.</div>`; return; }
  const sorted = [...state.students].sort((a, b) => b.total - a.total);
  list.innerHTML = sorted.map((s, idx) => {
    let badgeClass = '', rankDisplay = idx + 1;
    if (idx === 0) { badgeClass = 'rank-1'; rankDisplay = medalIcon('#B45309'); }
    else if (idx === 1) { badgeClass = 'rank-2'; rankDisplay = medalIcon('#475569'); }
    else if (idx === 2) { badgeClass = 'rank-3'; rankDisplay = medalIcon('#C2410C'); }
    return `
      <div class="leader-item">
        <div class="leader-rank ${badgeClass}">${rankDisplay}</div>
        <div class="leader-name">${escapeHtml(s.name)}</div>
        <div class="leader-score">${s.total} pts</div>
      </div>`;
  }).join('');
}
export function medalIcon(color) {
  return `<svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:${color};fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;"><circle cx="12" cy="15" r="6"/><path d="M9 10.5L7 3h2l3 6 3-6h2l-2 7.5"/></svg>`;
}

export function renderTable() {
  const headerRow = document.getElementById('tableHeader');
  const body = document.getElementById('tableBody');
  const headers = ['S/N', 'Student Name', ...Array.from({length: DAY_COUNT}, (_, i) => 'Day ' + (i + 1)), 'Bonus', 'Total'];
  headerRow.innerHTML = headers.map(h => `<th>${h}</th>`).join('');
  if (state.students.length === 0) { body.innerHTML = `<tr><td colspan="${headers.length}" class="empty-state">No students yet.</td></tr>`; return; }
  body.innerHTML = state.students.map(s => `
    <tr>
      <td>${s.sn}</td>
      <td class="name-cell">${escapeHtml(s.name)}</td>
      ${s.days.map(d => `<td>${d !== null ? d : '-'}</td>`).join('')}
      <td>${s.bonusUnits}</td>
      <td class="total-cell">${s.total}</td>
    </tr>`).join('');
}
document.getElementById('search').addEventListener('input', renderDirectory);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('scoreModal').addEventListener('click', (e) => { if (e.target.id === 'scoreModal') closeModal(); });
