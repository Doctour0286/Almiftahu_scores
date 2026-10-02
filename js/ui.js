// Small UI helpers: status banner, icon, escaping. Pure; imports nothing.

export function showStatus(msg, isError) {
  document.getElementById('statusArea').innerHTML = `<div class="status-banner${isError ? ' error' : ''}">${iconInfo()}${msg}</div>`;
}
export function clearStatus() { document.getElementById('statusArea').innerHTML = ''; }

export function iconInfo() {
  return `<svg class="icon" viewBox="0 0 24 24" style="margin-right:4px;"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none"/></svg>`;
}
export function escapeHtml(str) { return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function escapeAttr(str) { return escapeHtml(str); }
export function cssEscape(str) { return String(str).replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c); }
