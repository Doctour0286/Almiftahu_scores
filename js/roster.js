// Manage Students tab: add, bulk seed, rename, activate/inactivate, delete.
import { DAY_COUNT } from './config.js';
import { sb } from './api.js';
import { changeTeacherPin, lockNoticeHtml, wirePinForm } from './auth.js';
import { daysToDb, nextSN, state } from './state.js';
import { cssEscape, escapeAttr, escapeHtml, showStatus } from './ui.js';

// ---------- Manage Students tab (teacher) ----------
export function renderManageTab() {
  const area = document.getElementById('manageArea');
  if (!state.teacherUnlocked) { area.innerHTML = lockNoticeHtml(); wirePinForm(); return; }

  area.innerHTML = `
    <div class="teacher-panel">
      <div class="panel-section">
        <h4 class="menu-toggle" id="menuToggleAdd">
          <span><svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add a student</span>
          <span class="menu-chevron" id="menuChevronAdd">&#9656;</span>
        </h4>
        <div class="menu-body" id="menuBodyAdd">
          <div class="add-student-form">
            <input type="text" id="newStudentName" placeholder="Full name">
            <button id="addStudentBtn"><svg class="icon sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add student</button>
          </div>
          <div class="save-hint" id="addHint" style="margin-top:8px;"></div>
        </div>
      </div>
      <div class="panel-section">
        <h4 class="menu-toggle" id="menuToggleSeed">
          <span><svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Bulk seed students</span>
          <span class="menu-chevron" id="menuChevronSeed">&#9656;</span>
        </h4>
        <div class="menu-body" id="menuBodySeed">
          <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:10px;">
            One name per line. Existing students (matched by name) are skipped, so this is safe to run more than once.
          </p>
          <textarea id="seedNames" placeholder="Full Name One&#10;Full Name Two&#10;Full Name Three" style="width:100%; min-height:160px; font-family:monospace; font-size:0.82rem; padding:10px; border:1.5px solid var(--border-color); border-radius:8px; background:var(--bg-warm); color:var(--text-dark); box-sizing:border-box;"></textarea>
          <div style="display:flex; gap:10px; align-items:center; margin-top:10px; flex-wrap:wrap;">
            <button class="save-btn" id="seedRunBtn" type="button">Seed to database</button>
            <span class="save-hint" id="seedHint"></span>
          </div>
          <div id="seedLog" style="margin-top:10px; font-size:0.75rem; color:var(--text-muted); white-space:pre-wrap; max-height:160px; overflow-y:auto;"></div>
        </div>
      </div>
      <div class="panel-section">
        <h4 class="menu-toggle" id="menuTogglePin">
          <span><svg class="icon" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Change teacher PIN</span>
          <span class="menu-chevron" id="menuChevronPin">&#9656;</span>
        </h4>
        <div class="menu-body" id="menuBodyPin">
          <div class="add-student-form">
            <input type="password" inputmode="numeric" id="oldPinInput" placeholder="Current PIN">
            <input type="password" inputmode="numeric" id="newPinInput" placeholder="New PIN">
            <input type="password" inputmode="numeric" id="confirmPinInput" placeholder="Confirm new PIN">
            <button id="changePinBtn"><svg class="icon sm" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>Save PIN</button>
          </div>
          <div class="save-hint" id="pinChangeHint" style="margin-top:8px;"></div>
        </div>
      </div>
      <div id="manageEntryList" class="entry-list"></div>
    </div>`;

  wireMenuToggle('menuToggleAdd', 'menuBodyAdd', 'menuChevronAdd');
  wireMenuToggle('menuToggleSeed', 'menuBodySeed', 'menuChevronSeed');
  wireMenuToggle('menuTogglePin', 'menuBodyPin', 'menuChevronPin');
  document.getElementById('addStudentBtn').addEventListener('click', addStudent);
  document.getElementById('newStudentName').addEventListener('keydown', (e) => { if (e.key === 'Enter') addStudent(); });
  document.getElementById('changePinBtn').addEventListener('click', changeTeacherPin);
  document.getElementById('confirmPinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') changeTeacherPin(); });
  document.getElementById('seedRunBtn').addEventListener('click', bulkSeedStudents);

  renderManageEntryList();
}

export function wireMenuToggle(toggleId, bodyId, chevronId) {
  document.getElementById(toggleId).addEventListener('click', () => {
    const body = document.getElementById(bodyId);
    const open = body.classList.toggle('open');
    document.getElementById(chevronId).innerHTML = open ? '&#9662;' : '&#9656;';
  });
}

export async function bulkSeedStudents() {
  const btn = document.getElementById('seedRunBtn');
  const hint = document.getElementById('seedHint');
  const logEl = document.getElementById('seedLog');
  const raw = document.getElementById('seedNames').value;
  const names = raw.split('\n').map(n => n.trim()).filter(Boolean);

  logEl.textContent = '';
  const log = (msg) => { logEl.textContent += msg + '\n'; logEl.scrollTop = logEl.scrollHeight; };

  if (names.length === 0) {
    hint.textContent = 'Enter at least one name first.';
    hint.className = 'save-hint err';
    return;
  }

  btn.disabled = true;
  state.seedingInProgress = true;
  hint.textContent = `Seeding...`;
  hint.className = 'save-hint';
  log(`Starting. ${names.length} name(s) in the box.`);

  try {
    log(`Using in-memory student list (${state.allStudents.length} existing).`);
    const existingNames = new Set(state.allStudents.map(s => (s.name || '').trim().toLowerCase()));
    let sn = state.allStudents.reduce((max, s) => Math.max(max, s.sn), 0);

    const toInsert = [];
    let skipped = 0;
    for (const name of names) {
      if (existingNames.has(name.toLowerCase())) {
        log(`Skipped (already exists): ${name}`);
        skipped++;
        continue;
      }
      sn += 1;
      toInsert.push({ id: 's' + sn, sn, name, days: daysToDb(Array(DAY_COUNT).fill(null)), bonus_units: daysToDb(Array(DAY_COUNT).fill(null)), active: true });
      existingNames.add(name.toLowerCase());
    }

    if (toInsert.length > 0) {
      log(`Inserting ${toInsert.length} new student(s) in one batch...`);
      const { error } = await sb.from('students').insert(toInsert);
      if (error) throw error;
      toInsert.forEach(row => log(`Added S/N ${row.sn}: ${row.name}`));
    }

    hint.textContent = `Done — ${toInsert.length} added, ${skipped} skipped.`;
    hint.className = 'save-hint ok';
  } catch (e) {
    hint.textContent = 'Could not seed: ' + (e && e.message ? e.message : 'try again.');
    hint.className = 'save-hint err';
    log('ERROR: ' + (e && e.message ? e.message : String(e)));
    if (e && e.code) log('Error code: ' + e.code);
  } finally {
    btn.disabled = false;
    state.seedingInProgress = false;
    renderManageEntryList(); // refresh just the student list below, not the whole panel/textarea
  }
}

export function renderManageEntryList() {
  const list = document.getElementById('manageEntryList');
  if (!list) return;
  if (state.allStudents.length === 0) { list.innerHTML = `<div class="empty-state">No students yet. Add one above.</div>`; return; }

  const active = state.allStudents.filter(s => s.active);
  const inactive = state.allStudents.filter(s => !s.active);

  let html = '';
  html += `<div class="list-subhead">Active (${active.length})</div>`;
  html += active.length
    ? active.map(manageRowHtml).join('')
    : `<div class="empty-state" style="padding:16px;">No active students.</div>`;

  if (inactive.length > 0) {
    html += `<div class="list-subhead">Inactive (${inactive.length})</div>`;
    html += inactive.map(manageRowHtml).join('');
  }

  list.innerHTML = html;
  state.allStudents.forEach(s => wireManageRow(s.id));
}

export async function addStudent() {
  const input = document.getElementById('newStudentName');
  const hint = document.getElementById('addHint');
  const name = input.value.trim();
  if (!name) { hint.textContent = 'Enter a name first.'; hint.className = 'save-hint err'; return; }
  const sn = nextSN();
  const id = 's' + sn;
  hint.textContent = 'Adding...';
  hint.className = 'save-hint';
  try {
    const { error } = await sb.from('students').insert({ id, sn, name, days: daysToDb(Array(DAY_COUNT).fill(null)), bonus_units: daysToDb(Array(DAY_COUNT).fill(null)), active: true });
    if (error) throw error;
    input.value = '';
    hint.textContent = 'Added ' + name + '.';
    hint.className = 'save-hint ok';
  } catch (e) {
    hint.textContent = 'Could not add student: ' + (e && e.message ? e.message : 'try again.');
    hint.className = 'save-hint err';
  }
}

export function manageRowHtml(s) {
  const isOpen = state.entryOpenId === s.id;
  const isRenaming = state.renamingId === s.id;
  const nameBlock = isRenaming
    ? `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
         <input type="text" id="renameInput-${escapeAttr(s.id)}" value="${escapeAttr(s.name)}" style="flex:1; min-width:160px; padding:6px 10px; border:1.5px solid var(--border-color); border-radius:6px; font-size:0.9rem; font-weight:600; background:var(--bg-warm); color:var(--text-dark);">
         <button class="save-btn" data-save-name="${escapeAttr(s.id)}" style="padding:6px 12px; font-size:0.78rem;">Save</button>
         <button class="ghost-btn" data-cancel-name="${escapeAttr(s.id)}" style="padding:6px 12px; font-size:0.78rem;">Cancel</button>
       </div>`
    : `<div class="entry-row-name">${escapeHtml(s.name)} ${s.active ? '' : '<span class="inactive-pill">Inactive</span>'}
         <button class="ghost-btn" data-edit-name="${escapeAttr(s.id)}" title="Edit name" style="padding:3px 8px; margin-left:4px;"><svg class="icon sm" viewBox="0 0 24 24" style="margin:0;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
       </div>`;
  return `
    <div class="entry-row ${s.active ? '' : 'inactive'}" data-id="${escapeAttr(s.id)}">
      <div class="entry-row-head" data-toggle="${escapeAttr(s.id)}">
        <div>
          ${nameBlock}
          <div class="entry-row-sn">S/N: ${s.sn}</div>
        </div>
        <div class="entry-row-total">${s.total} / 100</div>
      </div>
      <div class="entry-body ${isOpen ? 'open' : ''}" id="mbody-${escapeAttr(s.id)}">
        <div class="entry-footer">
          <div class="entry-footer-actions">
            <button class="ghost-btn" data-toggle-active="${escapeAttr(s.id)}">
              ${s.active
                ? '<svg class="icon sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>Inactivate'
                : '<svg class="icon sm" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>Reactivate'}
            </button>
            <button class="danger-btn" data-delete="${escapeAttr(s.id)}"><svg class="icon sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>Delete</button>
          </div>
          <span class="save-hint" id="mhint-${escapeAttr(s.id)}"></span>
        </div>
      </div>
    </div>`;
}

export function wireManageRow(id) {
  const row = document.querySelector(`#manageEntryList .entry-row[data-id="${cssEscape(id)}"]`);
  if (!row) return;
  row.querySelector('.entry-row-head').addEventListener('click', (e) => {
    if (e.target.closest('[data-edit-name]') || e.target.closest('[data-save-name]') || e.target.closest('[data-cancel-name]') || state.renamingId === id) return;
    state.entryOpenId = state.entryOpenId === id ? null : id;
    renderManageEntryList();
  });
  const editBtn = row.querySelector(`[data-edit-name="${cssEscape(id)}"]`);
  if (editBtn) editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.renamingId = id;
    renderManageEntryList();
    const inp = document.getElementById(`renameInput-${id}`);
    if (inp) { inp.focus(); inp.select(); }
  });
  const saveNameBtn = row.querySelector(`[data-save-name="${cssEscape(id)}"]`);
  if (saveNameBtn) saveNameBtn.addEventListener('click', (e) => { e.stopPropagation(); saveStudentName(id); });
  const cancelNameBtn = row.querySelector(`[data-cancel-name="${cssEscape(id)}"]`);
  if (cancelNameBtn) cancelNameBtn.addEventListener('click', (e) => { e.stopPropagation(); state.renamingId = null; renderManageEntryList(); });
  const renameInput = row.querySelector(`#renameInput-${cssEscape(id)}`);
  if (renameInput) {
    renameInput.addEventListener('click', (e) => e.stopPropagation());
    renameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveStudentName(id);
      if (e.key === 'Escape') { state.renamingId = null; renderManageEntryList(); }
    });
  }
  const toggleBtn = row.querySelector(`[data-toggle-active="${cssEscape(id)}"]`);
  if (toggleBtn) toggleBtn.addEventListener('click', () => toggleActive(id));
  const deleteBtn = row.querySelector(`[data-delete="${cssEscape(id)}"]`);
  if (deleteBtn) deleteBtn.addEventListener('click', () => confirmDelete(id));
}

export async function saveStudentName(id) {
  const inp = document.getElementById(`renameInput-${id}`);
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) { inp.classList.add('invalid'); return; }
  try {
    const { error } = await sb.from('students').update({ name }).eq('id', id);
    if (error) throw error;
    const s = state.allStudents.find(x => x.id === id);
    if (s) s.name = name;
    state.renamingId = null;
    renderManageEntryList();
  } catch (e) {
    const hint = document.getElementById(`mhint-${id}`);
    if (hint) { hint.textContent = 'Could not rename: ' + (e && e.message ? e.message : 'try again.'); hint.className = 'save-hint err'; }
  }
}

export async function toggleActive(id) {
  const s = state.allStudents.find(x => x.id === id);
  if (!s) return;
  const hint = document.getElementById(`mhint-${id}`);
  try {
    const { error } = await sb.from('students').update({ active: !s.active }).eq('id', id);
    if (error) throw error;
    s.active = !s.active;
    state.entryOpenId = null;
    renderManageEntryList();
  } catch (e) {
    if (hint) { hint.textContent = 'Could not update: ' + (e && e.message ? e.message : 'try again.'); hint.className = 'save-hint err'; }
  }
}

export function confirmDelete(id) {
  const s = state.allStudents.find(x => x.id === id);
  if (!s) return;
  state.pendingConfirm = id;
  document.getElementById('confirmTitle').textContent = 'Delete ' + s.name + '?';
  document.getElementById('confirmBody').textContent = 'This permanently removes this student and all their scores. This cannot be undone.';
  document.getElementById('confirmOverlay').style.display = 'flex';
}

document.getElementById('confirmCancel').addEventListener('click', () => {
  state.pendingConfirm = null;
  document.getElementById('confirmOverlay').style.display = 'none';
});
document.getElementById('confirmOk').addEventListener('click', async () => {
  if (!state.pendingConfirm) return;
  const id = state.pendingConfirm;
  document.getElementById('confirmOverlay').style.display = 'none';
  state.pendingConfirm = null;
  try {
    const { error } = await sb.from('students').delete().eq('id', id);
    if (error) throw error;
  } catch (e) {
    showStatus('Could not delete student: ' + (e && e.message ? e.message : 'try again.'), true);
  }
});
