// Teacher mode: server-verified login (teacher_login), session token in sessionStorage, logout, PIN change.
import { rpc, getToken, setToken, clearToken, errorMessage } from './api.js';
import { LEGACY_TEACHER_FLAG_KEY } from './config.js';
import { refresh } from './data.js';
import { renderAll, switchTab } from './main.js';
import { state } from './state.js';
import { setHint, showStatus } from './ui.js';

// ---------- Teacher toggle ----------
document.getElementById('teacherTag').addEventListener('click', () => {
  if (state.teacherUnlocked) lockTeacherMode();
  else switchTab('manage');
});

// Drop the v3 bare "unlocked" flag if an old tab left it behind (no PIN or token is ever stored in localStorage).
export function clearLegacyFlag() {
  try { sessionStorage.removeItem(LEGACY_TEACHER_FLAG_KEY); localStorage.removeItem(LEGACY_TEACHER_FLAG_KEY); } catch (e) { /* ignore */ }
}

// Resume a session after a reload in the same tab. True only if the server still accepts the token.
export async function restoreSession() {
  if (!getToken()) return false;
  try {
    if (await rpc('teacher_ping')) { state.teacherUnlocked = true; return true; }
  } catch (e) { /* network error: stay locked, keep the token for the next try */ return false; }
  clearToken();
  return false;
}

// Lock locally (no server call): used on logout and when the server says the session is gone.
function lockLocal() {
  state.teacherUnlocked = false;
  state.editingEnrollmentId = null; state.editingDayIndex = null; state.renamingId = null; state.entryOpenId = null;
  state.courseDraft = null; state.courseFormDirty = false;
  clearToken();
  updateTeacherTabVisibility();
  updateTeacherTagState();
  document.getElementById('scoreEditModal').style.display = 'none';
}

export async function lockTeacherMode() {
  rpc('teacher_logout').catch(() => { /* the token is dropped locally either way */ });
  lockLocal();
  switchTab('directory');
  try { await refresh({ coursesToo: false }); } catch (e) { /* public data reloads on the next event */ }
  renderAll();
}

// An admin call was rejected with E_AUTH (expired or revoked session).
export async function onTeacherExpired() {
  if (!state.teacherUnlocked) return;
  lockLocal();
  switchTab('directory');
  showStatus('Your teacher session ended. Tap Teacher and enter the PIN again.', true);
  try { await refresh({ coursesToo: false }); } catch (e) { /* ignore */ }
  renderAll();
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
        <input type="password" inputmode="numeric" id="pinInput" placeholder="PIN" autocomplete="off">
        <button id="pinSubmit">Unlock</button>
      </div>
      <div class="pin-error" id="pinError"></div>
    </div>`;
}
export function wirePinForm() {
  document.getElementById('pinSubmit').addEventListener('click', tryUnlock);
  document.getElementById('pinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
}

let unlocking = false;
export async function tryUnlock() {
  if (unlocking) return;
  const input = document.getElementById('pinInput');
  const errEl = document.getElementById('pinError');
  const btn = document.getElementById('pinSubmit');
  unlocking = true; btn.disabled = true; errEl.textContent = '';
  try {
    const res = await rpc('teacher_login', { p_pin: input.value });
    setToken(res.token);
    state.teacherUnlocked = true;
    updateTeacherTabVisibility();
    updateTeacherTagState();
    await refresh({ coursesToo: false });          // now loads the full roster (incl. inactive)
    renderAll();
    const current = document.querySelector('.tab-content.active').id.replace('tab-', '');
    switchTab(current === 'directory' ? 'manage' : current);
  } catch (e) {
    if (state.teacherUnlocked && e.code !== 'E_AUTH') {
      // logged in, but the roster load failed: keep the session, tell the teacher
      errEl.textContent = errorMessage(e);
    } else {
      state.teacherUnlocked = false;
      updateTeacherTabVisibility(); updateTeacherTagState();
      errEl.textContent = errorMessage(e, { E_AUTH: 'Incorrect PIN. Try again.' });
    }
  } finally {
    unlocking = false;
    const b = document.getElementById('pinSubmit'); if (b) b.disabled = false;
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

  if (!oldPin) return setHint(hint, 'Enter the current PIN first.', 'err');
  if (!newPin) return setHint(hint, 'Enter a new PIN.', 'err');
  if (newPin.length < 4) return setHint(hint, 'The new PIN must be at least 4 characters (6 or more is recommended).', 'err');
  if (newPin !== confirmPin) return setHint(hint, 'New PINs do not match.', 'err');

  setHint(hint, 'Saving...', '');
  try {
    await rpc('teacher_change_pin', { p_old: oldPin, p_new: newPin });
    oldInput.value = ''; newInput.value = ''; confirmInput.value = '';
    setHint(hint, 'PIN updated. Other teacher sessions were signed out.', 'ok');
  } catch (e) {
    if (e.code === 'E_AUTH' && e.detail === 'current_pin') setHint(hint, 'Current PIN is incorrect.', 'err');
    else if (e.code === 'E_AUTH') setHint(hint, '', '');              // session gone: onTeacherExpired handles it
    else setHint(hint, 'Could not update PIN: ' + errorMessage(e), 'err');
  }
}
