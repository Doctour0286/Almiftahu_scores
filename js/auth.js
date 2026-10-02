// Teacher mode: PIN unlock/lock, PIN change. (Replaced by server login in task 0.5.)
import { TEACHER_SESSION_KEY } from './config.js';
import { sb } from './api.js';
import { switchTab } from './main.js';
import { state } from './state.js';

// ---------- Teacher toggle ----------
document.getElementById('teacherTag').addEventListener('click', () => {
  if (state.teacherUnlocked) {
    lockTeacherMode();
  } else {
    switchTab('manage');
  }
});

export function lockTeacherMode() {
  state.teacherUnlocked = false;
  sessionStorage.removeItem(TEACHER_SESSION_KEY);
  updateTeacherTabVisibility();
  updateTeacherTagState();
  switchTab('directory');
}

export function updateTeacherTagState() {
  document.getElementById('teacherTag').classList.toggle('on', state.teacherUnlocked);
}

export function updateTeacherTabVisibility() {
  document.getElementById('manageTabBtn').style.display = state.teacherUnlocked ? 'flex' : 'none';
}

export function lockNoticeHtml() {
  return `
    <div class="lock-notice">
      <svg class="icon" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
      <div><b>Teacher Mode</b> is locked. Enter the shared PIN to manage students and scores.</div>
      <div class="pin-form">
        <input type="password" inputmode="numeric" id="pinInput" placeholder="PIN">
        <button id="pinSubmit">Unlock</button>
      </div>
      <div class="pin-error" id="pinError"></div>
    </div>`;
}
export function wirePinForm() {
  document.getElementById('pinSubmit').addEventListener('click', tryUnlock);
  document.getElementById('pinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
}

export function tryUnlock() {
  const val = document.getElementById('pinInput').value;
  if (val === state.teacherPin) {
    state.teacherUnlocked = true;
    sessionStorage.setItem(TEACHER_SESSION_KEY, "1");
    updateTeacherTabVisibility();
    const current = document.querySelector('.tab-content.active').id.replace('tab-', '');
    switchTab(current === 'directory' ? 'manage' : current);
  } else {
    document.getElementById('pinError').textContent = 'Incorrect PIN. Try again.';
  }
}

export async function changeTeacherPin() {
  const oldInput = document.getElementById('oldPinInput');
  const newInput = document.getElementById('newPinInput');
  const confirmInput = document.getElementById('confirmPinInput');
  const hint = document.getElementById('pinChangeHint');
  const oldPin = oldInput.value.trim();
  const newPin = newInput.value.trim();
  const confirmPin = confirmInput.value.trim();

  if (!oldPin) { hint.textContent = 'Enter the current PIN first.'; hint.className = 'save-hint err'; return; }
  if (oldPin !== state.teacherPin) { hint.textContent = 'Current PIN is incorrect.'; hint.className = 'save-hint err'; return; }
  if (!newPin) { hint.textContent = 'Enter a new PIN.'; hint.className = 'save-hint err'; return; }
  if (newPin !== confirmPin) { hint.textContent = 'New PINs do not match.'; hint.className = 'save-hint err'; return; }

  hint.textContent = 'Saving...';
  hint.className = 'save-hint';
  try {
    const { error } = await sb.from('app_settings').upsert({ key: 'teacher_pin', value: newPin }, { onConflict: 'key' });
    if (error) throw error;
    state.teacherPin = newPin;
    oldInput.value = '';
    newInput.value = '';
    confirmInput.value = '';
    hint.textContent = 'PIN updated.';
    hint.className = 'save-hint ok';
  } catch (e) {
    hint.textContent = 'Could not update PIN: ' + (e && e.message ? e.message : 'try again.');
    hint.className = 'save-hint err';
  }
}
