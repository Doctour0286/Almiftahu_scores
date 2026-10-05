// Entry point: session restore, data refresh, realtime, tab routing, bootstrap.
import { sb, events, errorMessage } from './api.js';
import { ENV, IS_PRODUCTION, REALTIME_DEBOUNCE_MS } from './config.js';
import { clearLegacyFlag, onTeacherExpired, restoreSession, updateTeacherTabVisibility, updateTeacherTagState } from './auth.js';
import { chooseCourse, refresh } from './data.js';
import { renderCourseSwitcher, renderDirectory, renderLeaderboard, renderTable } from './portal.js';
import { refreshManageLists, renderManageTab } from './roster.js';
import { renderStudentExamPortal } from './examTaking.js';
import { state } from './state.js';
import { clearStatus, showStatus } from './ui.js';

// Reload from the server and repaint. Used after every write and on realtime events.
export async function reload({ coursesToo = false } = {}) {
  try {
    const applied = await refresh({ coursesToo });
    if (applied) clearStatus();
  } catch (e) {
    if (e.code !== 'E_AUTH') showStatus('Could not load scores: ' + errorMessage(e), true);
    return;
  }
  renderAll();
}

export function renderAll() {
  renderCourseSwitcher(); renderDirectory(); renderLeaderboard(); renderTable();
  const active = document.querySelector('.tab-content.active');
  if (active && active.id === 'tab-manage') {
    // keep typed text: repaint the whole panel only when it is not built for the current lock state
    if (!state.teacherUnlocked) { if (!document.getElementById('pinInput')) renderManageTab(); }
    else if (document.getElementById('manageEntryList')) refreshManageLists();
    else renderManageTab();
  }
  if (active && active.id === 'tab-exam') {
    renderStudentExamPortal();
  }
}

// ---------- realtime: four public tables, debounced, refetching only the selected course (PRD §7.8, §10.5) ----------
let timer = null; let wantCourses = false;
function scheduleReload(table) {
  if (table === 'courses') wantCourses = true;
  clearTimeout(timer);
  timer = setTimeout(() => { const c = wantCourses; wantCourses = false; reload({ coursesToo: c }); }, REALTIME_DEBOUNCE_MS);
}
export function subscribe() {
  let ch = sb.channel('portal-changes');
  for (const table of ['students', 'enrollments', 'courses', 'enrollment_results']) {
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => scheduleReload(table));
  }
  ch.subscribe();
}

export function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  updateTeacherTagState();
  const navBtn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
  if (navBtn) navBtn.classList.add('active');
  if (name === 'manage') renderManageTab();
  if (name === 'exam') renderStudentExamPortal();
}

document.querySelectorAll('#navTabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('courseSwitch').addEventListener('change', async (e) => {
  chooseCourse(e.target.value);
  state.entryOpenId = null; state.renamingId = null; state.courseDraft = null; state.courseFormDirty = false;
  state.loaded = false; renderAll();
  await reload({ coursesToo: false });
});

events.addEventListener('teacher-expired', onTeacherExpired);

// Non-production builds show which database they talk to (PRD §10.2). Never rendered on production.
if (!IS_PRODUCTION) {
  const badge = document.createElement('span');
  badge.className = 'env-badge';
  badge.textContent = ENV.name;
  document.querySelector('header').appendChild(badge);
}

async function start() {
  clearLegacyFlag();
  updateTeacherTabVisibility();
  renderAll();                         // "Loading…" placeholders
  await restoreSession();
  updateTeacherTabVisibility(); updateTeacherTagState();
  await reload({ coursesToo: true });
  subscribe();
}
start();
