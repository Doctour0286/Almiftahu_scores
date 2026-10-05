// Exam Codes management for Teachers (PRD Phase 2, FR-K1 to FR-K9).
// Single generation, bulk generation (chunked 40 per call), revoke, clear lock, reset attempt, and printable slips.

import { rpc, errorMessage } from './api.js';
import { reload } from './main.js';
import { currentCourse, state } from './state.js';
import { arHtml, confirmDialog, escapeAttr, escapeHtml, setHint, showStatus } from './ui.js';

// Active exam codes of the current course, loaded from the server (admin_list_codes) so they stay visible
// until a new code is generated: enrollment id -> code string, or null for a code issued before codes could be
// shown (hash only; the teacher uses "New Code" for those).
let activeCodes = {};
let codesLoadedFor = null;   // course id whose codes are in activeCodes
let codesLoading = false;

async function refreshCodes(containerId) {
  const course = currentCourse();
  if (!course || codesLoading) return;
  codesLoading = true;
  try {
    const list = await rpc('admin_list_codes', { p_course_id: course.id });
    activeCodes = {};
    (list || []).forEach(x => { activeCodes[x.enrollment_id] = x.code || null; });
  } catch (e) {
    showStatus('Could not load exam codes: ' + errorMessage(e), true);
  } finally {
    codesLoadedFor = course.id;   // also after an error, so a failure cannot loop
    codesLoading = false;
  }
  renderCodesManagement(containerId);
}

function currentSlips() {
  const course = currentCourse();
  return (state.rows || []).filter(r => r.active && activeCodes[r.id]).map(r => ({
    sn: r.sn, name: r.name, name_ar: r.nameAr, code: activeCodes[r.id], course_name: course ? course.name : '',
  }));
}

function renderCodeCell(r) {
  if (!(r.id in activeCodes)) return '<span style="color:var(--text-muted);">&mdash;</span>';
  const code = activeCodes[r.id];
  if (!code) {
    return '<span style="font-size:0.75rem; color:var(--text-muted);" title="Issued before codes could be shown. Click New Code to issue one you can see.">Issued earlier (hidden)</span>';
  }
  return `<span class="exam-code-value" style="font-family:monospace; font-weight:800; font-size:1.05rem; letter-spacing:2px; color:var(--emerald-dark);">${escapeHtml(code)}</span>
    <button class="ghost-btn sm" data-copy-code="${escapeAttr(code)}" title="Copy code">Copy</button>`;
}

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
        <button class="ghost-btn sm" id="printEligibilityListBtn">
          <svg class="icon sm" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Print Eligibility List
        </button>
        ${currentSlips().length > 0 ? `
          <button class="ghost-btn sm" id="printSlipsBtn">
            <svg class="icon sm" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print Code Slips (${currentSlips().length})
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
            <th>Exam Code</th>
            <th>Exam Status</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0 ? `
            <tr><td colspan="5" class="empty-state">No students enrolled in this course yet.</td></tr>
          ` : rows.map(r => `
            <tr class="code-row ${r.active ? '' : 'inactive-row'}">
              <td><b>#${r.sn}</b></td>
              <td>
                <div style="font-weight:600; color:var(--emerald-dark);">${escapeHtml(r.name)} ${arHtml(r.nameAr)}</div>
                ${!r.active ? '<span class="inactive-pill">Inactive</span>' : ''}
              </td>
              <td>${renderCodeCell(r)}</td>
              <td>${renderEligibilityChip(r, course)}</td>
              <td style="text-align:right;">
                <div style="display:inline-flex; gap:6px; align-items:center;">
                  ${r.status !== 'not_eligible' && !(r.id in activeCodes) ? `
                    <button class="save-btn sm" data-gen-code="${r.id}" ${!course.exam_live ? 'disabled' : ''}>Generate Code</button>
                  ` : ''}
                  ${r.status === 'not_eligible' ? `
                    <span style="font-size:0.75rem; color:var(--text-muted);">Awaiting eligibility</span>
                  ` : ''}
                  ${['in_progress', 'submitted', 'finalized'].includes(r.status) ? `
                    <button class="ghost-btn sm danger" data-reset-att="${r.id}" title="Allow re-sit">Reset Attempt</button>
                  ` : ''}
                  ${r.status !== 'not_eligible' && (r.id in activeCodes) ? `
                    <button class="ghost-btn sm" data-regen-code="${r.id}" title="Issue new code (revokes old)" ${!course.exam_live ? 'disabled' : ''}>New Code</button>
                  ` : ''}
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
  if (codesLoadedFor !== course.id && !codesLoading) refreshCodes(containerId);
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
  // Copy a listed code
  container.querySelectorAll('[data-copy-code]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copyCode);
        showStatus('Code copied ✓', false);
      } catch (e) {
        showStatus('Code: ' + btn.dataset.copyCode, false);
      }
    });
  });

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
        activeCodes[enrId] = res.code;
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
            activeCodes[item.enrollment_id] = item.code;
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

  const printEligBtn = document.getElementById("printEligibilityListBtn");
  if (printEligBtn) {
    printEligBtn.addEventListener("click", () => {
      openEligibilityModal();
    });
  }

  // Print slips button
  const printBtn = document.getElementById('printSlipsBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const slips = currentSlips();
      if (slips.length > 0) openCodeSlipsModal(slips);
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
          Share this code with the student. It stays in the list until you generate a new one.
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


// =============================================================================
// PRINTABLE ELIGIBILITY LIST MODAL
// =============================================================================
export function openEligibilityModal() {
  const course = currentCourse();
  if (!course) return;

  const allRows = (state.rows || []).slice().sort((a, b) => a.sn - b.sn);
  let onlyEligible = false;
  let includeCodes = false;

  let modal = document.getElementById("eligibilityListModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "eligibilityListModal";
    modal.className = "modal-overlay";
    document.body.appendChild(modal);
  }

  function renderModalBody() {
    const rows = onlyEligible ? allRows.filter(r => r.active && r.status === "eligible") : allRows;
    const eligibleCount = allRows.filter(r => r.active && r.status === "eligible").length;
    const notEligibleCount = allRows.filter(r => r.active && r.status === "not_eligible").length;
    const activeTotal = allRows.filter(r => r.active).length;

    const ruleLabel = course.eligibility_rule === "all_units"
      ? `All ${course.day_count} ${(course.unit_label || "unit").toLowerCase()}s completed`
      : (course.eligibility_rule === "teacher_approved" ? "Teacher Approval Required" : "Open to All Enrolled");

    modal.innerHTML = `
      <div class="modal-content" style="max-width:980px; width:96%; max-height:92vh; overflow-y:auto; padding:24px;">
        <!-- Screen Actions (Hidden on Print) -->
        <div class="no-print" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:10px; border-bottom:1.5px solid var(--border-color); padding-bottom:14px;">
          <div>
            <h3 style="margin:0; color:var(--emerald-dark); font-size:1.2rem;">Print Exam Eligibility List</h3>
            <p style="margin:3px 0 0; font-size:0.8rem; color:var(--text-muted);">
              Course: <b>${escapeHtml(course.name)}</b> &bull; Printable exam roster and invigilator check-in sheet
            </p>
          </div>
          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
            <label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; font-weight:600; color:var(--text-dark); cursor:pointer;">
              <input type="checkbox" id="eligFilterCheck" ${onlyEligible ? "checked" : ""}>
              Eligible Only (${eligibleCount})
            </label>
            <label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; font-weight:600; color:var(--text-dark); cursor:pointer;">
              <input type="checkbox" id="includeCodesCheck" ${includeCodes ? "checked" : ""}>
              Include Exam Codes
            </label>
            <button class="save-btn sm" id="triggerPrintEligBtn">
              <svg class="icon sm" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print List
            </button>
            <button class="ghost-btn sm" id="closeEligModalBtn">Close</button>
          </div>
        </div>

        <!-- Printable Document Area -->
        <div class="eligibility-print-doc" id="eligibilityPrintArea">
          <!-- Institutional Header -->
          <div style="text-align:center; margin-bottom:16px; border-bottom:2px double var(--gold-ochre); padding-bottom:12px;">
            <div style="font-family:'Amiri',serif; font-size:1.35rem; color:var(--emerald-dark); margin-bottom:4px;">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
            <div style="font-size:1.15rem; font-weight:800; color:var(--emerald-dark); text-transform:uppercase; letter-spacing:1px;">
              Ma'had Miftah al-'Ilm &bull; معهد مفتاح العلم
            </div>
            <div style="font-size:1.35rem; font-weight:700; color:var(--emerald-dark); margin:6px 0 2px; font-family:'Amiri',serif;">
              كشف أهلية وحضور اختبار المقرر
            </div>
            <div style="font-size:0.95rem; font-weight:700; color:var(--gold-ochre); text-transform:uppercase; letter-spacing:0.5px;">
              Exam Eligibility & Hall Check-in Roster
            </div>
          </div>

          <!-- Course & Roster Metadata Bar -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; font-size:0.85rem; background:var(--bg-warm); border:1px solid var(--border-color); border-radius:6px; padding:10px 14px; flex-wrap:wrap; gap:10px;">
            <div>
              <div>Course: <b>${escapeHtml(course.name)}</b> ${course.name_ar ? `(${escapeHtml(course.name_ar)})` : ""}</div>
              <div>Course Code: <b>${escapeHtml(course.code)}</b> &bull; Eligibility Rule: <b>${escapeHtml(ruleLabel)}</b></div>
            </div>
            <div style="text-align:right;">
              <div>Date Generated: <b>${new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</b></div>
              <div>Status: <b>${activeTotal} Active Enrolled &bull; ${eligibleCount} Eligible &bull; ${notEligibleCount} Awaiting</b></div>
            </div>
          </div>

          <!-- Roster Table -->
          <table class="eligibility-table" style="width:100%; border-collapse:collapse; margin-top:8px;">
            <thead>
              <tr style="background:var(--emerald-dark); color:white; font-size:0.8rem; text-align:left;">
                <th style="padding:8px 6px; border:1px solid var(--border-color); width:40px; text-align:center;">S/N</th>
                <th style="padding:8px; border:1px solid var(--border-color);">Student Name (English)</th>
                <th style="padding:8px; border:1px solid var(--border-color); text-align:right;">الاسم بالعربية</th>
                <th style="padding:8px; border:1px solid var(--border-color); text-align:center; width:90px;">Progress</th>
                <th style="padding:8px; border:1px solid var(--border-color); text-align:center; width:70px;">Score</th>
                <th style="padding:8px; border:1px solid var(--border-color); text-align:center; width:110px;">Eligibility</th>
                ${includeCodes ? `<th style="padding:8px; border:1px solid var(--border-color); text-align:center; width:110px;">Exam Code</th>` : ""}
                <th style="padding:8px; border:1px solid var(--border-color); text-align:center; width:120px;">Candidate Signature</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? `
                <tr><td colspan="${includeCodes ? 8 : 7}" style="padding:20px; text-align:center; color:var(--text-muted);">No students matching selection.</td></tr>
              ` : rows.map(r => {
                const marked = (r.days || []).filter(d => typeof d === "number" && d >= 0).length;
                const totalPts = typeof r.total === "number" ? r.total : (r.score !== undefined ? r.score : "--");
                const isElig = r.status === "eligible";
                const isFinal = r.status === "finalized";
                const code = activeCodes[r.id];
                return `
                  <tr style="font-size:0.85rem; border-bottom:1px solid var(--border-color);">
                    <td style="padding:6px; border:1px solid var(--border-color); text-align:center; font-weight:700;">#${r.sn}</td>
                    <td style="padding:6px 8px; border:1px solid var(--border-color); font-weight:600; color:var(--text-dark);">${escapeHtml(r.name)}</td>
                    <td style="padding:6px 8px; border:1px solid var(--border-color); text-align:right; font-family:'Amiri',serif; font-size:0.95rem;">${escapeHtml(r.nameAr || "--")}</td>
                    <td style="padding:6px; border:1px solid var(--border-color); text-align:center; font-size:0.8rem;">${marked}/${course.day_count} ${(course.unit_label || "unit").toLowerCase()}s</td>
                    <td style="padding:6px; border:1px solid var(--border-color); text-align:center; font-weight:600;">${totalPts}</td>
                    <td style="padding:6px; border:1px solid var(--border-color); text-align:center;">
                      ${isElig ? `<span style="color:var(--emerald-light); font-weight:700;">Eligible ✓</span>` : (isFinal ? `<span style="color:var(--emerald-dark); font-weight:700;">Completed</span>` : `<span style="color:var(--text-muted); font-size:0.75rem;">Awaiting</span>`)}
                    </td>
                    ${includeCodes ? `
                      <td style="padding:6px; border:1px solid var(--border-color); text-align:center; font-family:monospace; font-weight:800;">
                        ${code ? `<span style="letter-spacing:1px; color:var(--emerald-dark);">${escapeHtml(code)}</span>` : (isElig ? `<span style="color:var(--text-muted); font-size:0.75rem;">[Pending Code]</span>` : `<span style="color:var(--text-muted); font-size:0.75rem;">--</span>`)}
                      </td>
                    ` : ""}
                    <td style="padding:6px; border:1px solid var(--border-color); text-align:center;">
                      <div style="border-bottom:1px dotted #888; height:22px; width:90%; margin:0 auto;"></div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>

          <!-- Invigilator Verification Sign-off -->
          <div style="display:flex; justify-content:space-between; margin-top:36px; padding-top:14px; font-size:0.82rem; color:var(--text-dark);">
            <div style="width:260px;">
              <div style="border-bottom:1.5px solid #555; height:30px; margin-bottom:6px;"></div>
              <div>Invigilator / Examiner Name & Signature</div>
            </div>
            <div style="width:200px; text-align:right;">
              <div style="border-bottom:1.5px solid #555; height:30px; margin-bottom:6px;"></div>
              <div>Official Stamp / Date</div>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.style.display = "flex";

    // Wire controls
    document.getElementById("closeEligModalBtn").addEventListener("click", () => {
      modal.style.display = "none";
    });
    document.getElementById("triggerPrintEligBtn").addEventListener("click", () => {
      window.print();
    });
    const filterChk = document.getElementById("eligFilterCheck");
    if (filterChk) {
      filterChk.addEventListener("change", (e) => {
        onlyEligible = e.target.checked;
        renderModalBody();
      });
    }
    const codesChk = document.getElementById("includeCodesCheck");
    if (codesChk) {
      codesChk.addEventListener("change", (e) => {
        includeCodes = e.target.checked;
        renderModalBody();
      });
    }
  }

  renderModalBody();
}
