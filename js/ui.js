// Small UI helpers: status banner, icon, escaping, hints, confirm dialog. Imports nothing from the app.

export function showStatus(msg, isError) {
  document.getElementById('statusArea').innerHTML = `<div class="status-banner${isError ? ' error' : ''}">${iconInfo()}${escapeHtml(msg)}</div>`;
}
export function clearStatus() { document.getElementById('statusArea').innerHTML = ''; }

export function iconInfo() {
  return `<svg class="icon" viewBox="0 0 24 24" style="margin-right:4px;"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none"/></svg>`;
}
export function escapeHtml(str) { return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function escapeAttr(str) { return escapeHtml(str); }
export function cssEscape(str) { return String(str).replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c); }

// Inline hint under a control: cls is '', 'ok' or 'err'.
export function setHint(elOrId, text, cls) {
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) return;
  el.textContent = text;
  el.className = 'save-hint' + (cls ? ' ' + cls : '');
}

// 12 -> "12", 7.5 -> "7.5", 7.333 -> "7.33"
export function fmtNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

// Arabic text renders with dir="auto" and the Amiri face (PRD §9.1 #3).
export function arHtml(text, cls = 'name-ar') {
  return text ? `<span class="${cls}" dir="auto">${escapeHtml(text)}</span>` : '';
}

// ---------- confirm dialog (existing .confirm-overlay), promise based ----------
let pendingResolve = null;
function closeConfirm(result) {
  document.getElementById('confirmOverlay').style.display = 'none';
  const r = pendingResolve; pendingResolve = null;
  if (r) r(result);
}
export function confirmDialog({ title, body, okLabel = 'Confirm' }) {
  if (pendingResolve) closeConfirm(false);
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').textContent = body;
  document.getElementById('confirmOk').textContent = okLabel;
  document.getElementById('confirmOverlay').style.display = 'flex';
  return new Promise(resolve => { pendingResolve = resolve; });
}
document.getElementById('confirmCancel').addEventListener('click', () => closeConfirm(false));
document.getElementById('confirmOk').addEventListener('click', () => closeConfirm(true));
