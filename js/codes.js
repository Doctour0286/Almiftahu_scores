// Exam Codes management for Teachers (PRD Phase 2, FR-K1 to FR-K9).
// Single generation, bulk generation (chunked 40 per call), revoke, clear lock, reset attempt, and printable slips.

import { rpc, errorMessage } from './api.js';
import { reload } from './main.js';
import { currentCourse, state } from './state.js';
import { arHtml, confirmDialog, escapeHtml, setHint, showStatus } from './ui.js';

let generatedSlips = []; // [{ sn, name, name_ar, code, course_name }]

export function renderCodesManagement(containerId = 'codesArea') {
  const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
  if (!container) return;

  const course = currentCourse();
  if (!course) {
    container.innerHTML = '<div class="empty-state">Select a course first.</div>';
    return;
  }

  const rows = state.rows || [];
  const eligibleWithoutCode = rows.filter(r => r.active && r.status === 'eligible');

  container.innerHTML = `
    <div class="codes-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
      <div>
        <h4 style="font-size:1.05rem; font-weight:700; color:var(--emerald-dark); margin:0;">Exam Codes & Student Eligibility</h4>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
          Course: <b>${escapeHtml(course.name)}</b> &bull; ${course.exam_live ? '<span class="status-chip live">Exam Live</span>' : '<span class="status-chip none">No Live Exam (codes cannot be used yet)</span>'}
        </p>
      </div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <button class="save-btn sm" id="bulkGenCodesBtn" ${!course.exam_live ? 'disabled title="Publish an exam version first"' : ''}>
          <svg class="icon sm" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
          Bulk Generate Codes (${eligibleWithoutCode.length} eligible)
        </button>
        ${generatedSlips.length > 0 ? `
          <button class="ghost-btn sm" id="printSlipsBtn">
            <svg class="icon sm" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print Code Slips (${generatedSlips.length})
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Student Codes Table -->
    <div class="table-wrapper">
      <table class="exam-versions-table">
        <thead>
          <tr>
            <th style="width:50px;">S/N</th>
            <th>Student Name</th>
            <th>Exam Status</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0 ? `
            <tr><td colspan="4" class="empty-state">No students enrolled in this course yet.</td></tr>
          ` : rows.map(r => `
            <tr class="code-row ${r.active ? '' : 'inactive-row'}">
              <td><b>#${r.sn}</b></td>
              <td>
                <div style="font-weight:600; color:var(--emerald-dark);">${escapeHtml(r.name)} ${arHtml(r.nameAr)}</div>
                ${!r.active ? '<span class="inactive-pill">Inactive</span>' : ''}
              </td>
              <td>${renderEligibilityChip(r, course)}</td>
              <td style="text-align:right;">
                <div style="display:inline-flex; gap:6px; align-items:center;">
                  ${r.status === 'eligible' ? `
                    <button class="save-btn sm" data-gen-code="${r.id}" ${!course.exam_live ? 'disabled' : ''}>Generate Code</button>
                  ` : ''}
                  ${r.status === 'not_eligible' ? `
                    <span style="font-size:0.75rem; color:var(--text-muted);">Awaiting eligibility</span>
                  ` : ''}
                  ${['in_progress', 'submitted', 'finalized'].includes(r.status) ? `
                    <button class="ghost-btn sm danger" data-reset-att="${r.id}" title="Allow re-sit">Reset Attempt</button>
                  ` : ''}
                  <button class="ghost-btn sm" data-regen-code="${r.id}" title="Issue new code (revokes old)" ${!course.exam_live ? 'disabled' : ''}>New Code</button>
                  <button class="ghost-btn sm" data-clear-lock="${r.id}" title="Clear lockout">Unlock</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  wireCodesEvents(container);
}

function renderEligibilityChip(r, course) {
  const s = r.status;
  if (s === 'not_eligible') {
    if (course.eligibility_rule === 'all_units') {
      const marked = (r.days || []).filter(d => typeof d === 'number' && d >= 0).length;
      return `<span class="exam-badge retired">${marked}/${course.day_count} units marked</span>`;
    } else if (course.eligibility_rule === 'teacher_approved') {
      return `<span class="exam-badge retired">Awaiting teacher approval</span>`;
    }
    return `<span class="exam-badge retired">Not Eligible</span>`;
  }
  if (s === 'eligible') {
    return `<span class="exam-badge draft">Eligible (Ready for Code)</span>`;
  }
  if (s === 'in_progress') {
    return `<span class="exam-badge live">In Progress</span>`;
  }
  if (s === 'submitted') {
    return `<span class="exam-badge draft">Submitted (Pending Marking)</span>`;
  }
  if (s === 'finalized') {
    return `<span class="exam-badge live">Marked ✓</span>`;
  }
  return `<span class="exam-badge">${escapeHtml(s)}</span>`;
}

function wireCodesEvents(container) {
  // Single code generation
  container.querySelectorAll('[data-gen-code], [data-regen-code]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const enrId = btn.dataset.genCode || btn.dataset.regenCode;
      const isRegen = !!btn.dataset.regenCode;
      if (isRegen) {
        const ok = await confirmDialog({
          title: 'Generate new exam code?',
          body: 'This will revoke any existing active code immediately. (Does not affect existing student attempts).',
          okLabel: 'Generate New Code',
        });
        if (!ok) return;
      }

      btn.disabled = true;
      try {
        const res = await rpc('admin_generate_code', { p_enrollment_id: enrId });
        const student = (state.rows || []).find(r => r.id === enrId);
        showSingleCodeModal(student, res.code);
        await reload();
      } catch (e) {
        showStatus('Could not generate code: ' + errorMessage(e), true);
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Reset attempt
  container.querySelectorAll('[data-reset-att]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const enrId = btn.dataset.resetAtt;
      const ok = await confirmDialog({
        title: 'Reset student attempt?',
        body: 'This marks the student\'s previous attempt superseded and allows them to sit the exam again with a new code. Previous scores will be recalculated.',
        okLabel: 'Reset Attempt',
      });
      if (!ok) return;

      try {
        await rpc('admin_reset_attempt', { p_enrollment_id: enrId });
        showStatus('Attempt reset successfully.', false);
        await reload();
      } catch (e) {
        showStatus('Could not reset attempt: ' + errorMessage(e), true);
      }
    });
  });

  // Clear lockout
  container.querySelectorAll('[data-clear-lock]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const enrId = btn.dataset.clearLock;
      try {
        await rpc('admin_clear_lock', { p_enrollment_id: enrId });
        showStatus('Lockout counter cleared for student.', false);
      } catch (e) {
        showStatus('Could not clear lock: ' + errorMessage(e), true);
      }
    });
  });

  // Bulk generate codes
  const bulkBtn = document.getElementById('bulkGenCodesBtn');
  if (bulkBtn) {
    bulkBtn.addEventListener('click', async () => {
      const course = currentCourse();
      if (!course) return;

      bulkBtn.disabled = true;
      showStatus('Generating codes in bulk…', false);

      let totalGenerated = 0;
      let allGenerated = [];

      try {
        while (true) {
          const chunk = await rpc('admin_generate_codes_bulk', { p_course_id: course.id });
          if (!chunk || chunk.length === 0) break;
          totalGenerated += chunk.length;
          chunk.forEach(item => {
            allGenerated.push({
              sn: item.sn,
              name: item.name,
              name_ar: item.name_ar,
              code: item.code,
              course_name: course.name,
            });
          });
          if (chunk.length < 40) break; // done
        }

        generatedSlips = allGenerated;
        showStatus(`Generated ${totalGenerated} exam codes successfully.`, false);
        await reload();
        renderCodesManagement(container);

        if (allGenerated.length > 0) {
          openCodeSlipsModal(allGenerated);
        }
      } catch (e) {
        showStatus('Bulk generation error: ' + errorMessage(e), true);
      } finally {
        bulkBtn.disabled = false;
      }
    });
  }

  // Print slips button
  const printBtn = document.getElementById('printSlipsBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      if (generatedSlips.length > 0) {
        openCodeSlipsModal(generatedSlips);
      }
    });
  }
}

function showSingleCodeModal(student, code) {
  let modal = document.getElementById('singleCodeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'singleCodeModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width:440px; text-align:center;">
      <button class="close-btn" id="closeSingleCodeModal">&times;</button>
      <div class="modal-header">
        <h3 style="color:var(--emerald-dark);">Exam Code Generated</h3>
        <p>${student ? escapeHtml(student.name) : 'Student'} &bull; S/N #${student ? student.sn : '--'}</p>
      </div>

      <div style="background:var(--gold-soft); border:2px dashed var(--gold-ochre); border-radius:10px; padding:20px; margin:16px 0;">
        <span style="font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); font-weight:700;">Student Code</span>
        <div style="font-size:2rem; font-weight:800; letter-spacing:4px; color:var(--emerald-dark); margin:8px 0; font-family:monospace;">
          ${escapeHtml(code)}
        </div>
        <p style="font-size:0.75rem; color:var(--text-muted); margin:0;">
          Write down or share this code with the student. Plaintext is only shown once.
        </p>
      </div>

      <div style="display:flex; justify-content:center; gap:8px;">
        <button class="save-btn" id="copyCodeBtn">Copy Code</button>
        <button class="ghost-btn" id="doneCodeBtn">Done</button>
      </div>
      <div class="save-hint" id="copyCodeHint" style="margin-top:8px;"></div>
    </div>
  `;

  modal.style.display = 'flex';
  const close = () => { modal.style.display = 'none'; };
  document.getElementById('closeSingleCodeModal').addEventListener('click', close);
  document.getElementById('doneCodeBtn').addEventListener('click', close);

  document.getElementById('copyCodeBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      setHint('copyCodeHint', 'Copied to clipboard ✓', 'ok');
    } catch (e) {
      setHint('copyCodeHint', code, '');
    }
  });
}

function openCodeSlipsModal(slips) {
  let modal = document.getElementById('codeSlipsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'codeSlipsModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width:850px; width:95%; max-height:90vh; overflow-y:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="margin:0; color:var(--emerald-dark);">Print Exam Code Slips</h3>
        <div style="display:flex; gap:8px;">
          <button class="save-btn sm" id="triggerPrintBtn">
            <svg class="icon sm" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print Sheet
          </button>
          <button class="ghost-btn sm" id="closeSlipsBtn">Close</button>
        </div>
      </div>

      <div class="slips-grid" id="slipsPrintArea" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:12px;">
        ${slips.map(s => `
          <div class="code-slip-card" style="border:1.5px dashed var(--gold-ochre); border-radius:8px; padding:12px; background:var(--bg-warm); text-align:center;">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">${escapeHtml(s.course_name || 'Course')}</div>
            <div style="font-weight:700; font-size:1rem; color:var(--emerald-dark); margin:4px 0 2px;">${escapeHtml(s.name)} ${arHtml(s.name_ar)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px;">Student S/N: <b>#${s.sn}</b></div>
            <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:6px; padding:6px; font-family:monospace; font-size:1.25rem; font-weight:800; color:var(--emerald-dark); letter-spacing:2px;">
              ${escapeHtml(s.code)}
            </div>
            <p style="font-size:0.68rem; color:var(--text-muted); margin:6px 0 0;">Enter this code on the Exam tab to sit your test.</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  modal.style.display = 'flex';
  document.getElementById('closeSlipsBtn').addEventListener('click', () => { modal.style.display = 'none'; });
  document.getElementById('triggerPrintBtn').addEventListener('click', () => {
    window.print();
  });
}
