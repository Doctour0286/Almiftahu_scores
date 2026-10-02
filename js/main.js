// Entry point: data loading, realtime subscription, tab routing, bootstrap.
import { sb } from './api.js';
import { ENV, IS_PRODUCTION } from './config.js';
import { updateTeacherTabVisibility, updateTeacherTagState } from './auth.js';
import { renderDirectory, renderLeaderboard, renderTable } from './portal.js';
import { renderManageTab } from './roster.js';
import { normalizeStudent, state } from './state.js';
import { clearStatus, showStatus } from './ui.js';

export async function loadTeacherPin() {
  const { data, error } = await sb.from('app_settings').select('value').eq('key', 'teacher_pin').maybeSingle();
  if (!error && data && data.value) state.teacherPin = data.value;
}

export async function loadStudents() {
  const { data, error } = await sb.from('students').select('*').order('sn', { ascending: true });
  if (error) {
    showStatus('Could not load scores: ' + error.message + '. Check your connection and reload.', true);
    return;
  }
  state.allStudents = data.map(normalizeStudent);
  state.students = state.allStudents.filter(s => s.active);
  clearStatus();
  renderAll();
}

export function subscribe() {
  loadTeacherPin();
  loadStudents();
  // Live updates: Supabase Realtime pushes any insert/update/delete on this table.
  sb.channel('students-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
      loadStudents();
    })
    .subscribe();
}

export function renderAll() {
  renderDirectory(); renderLeaderboard(); renderTable();
  const activeId = document.querySelector('.tab-content.active').id;
  if (activeId === 'tab-manage' && !state.seedingInProgress) renderManageTab();
}

export function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  updateTeacherTagState();
  const navBtn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
  if (navBtn) navBtn.classList.add('active');
  if (name === 'manage') renderManageTab();
}

document.querySelectorAll('#navTabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Non-production builds show which database they talk to (PRD §10.2). Never rendered on production.
if (!IS_PRODUCTION) {
  const badge = document.createElement('span');
  badge.className = 'env-badge';
  badge.textContent = ENV.name;
  document.querySelector('header').appendChild(badge);
}

updateTeacherTabVisibility();
subscribe();
