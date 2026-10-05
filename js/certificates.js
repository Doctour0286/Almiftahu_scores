// Certificates administration & institution settings (Phase 4, Tasks 4.3 & 4.6; FR-V1..V3, FR-V8).
import { rpc, errorMessage } from './api.js';
import { currentCourse } from './state.js';
import { showCertificateModal } from './certificateView.js';
import { escapeHtml, escapeAttr, setHint, confirmDialog } from './ui.js';
import { reload } from './main.js';

let certState = {
  tab: 'eligible', // 'eligible' | 'issued'
  eligible: [],
  issued: [],
  selectedIds: new Set(),
};

/**
 * Renders the Certificates management tab (Approval queue & Issued list).
 */
export async function renderCertificatesTab(containerId = 'certificatesArea') {
  const host = document.getElementById(containerId);
  if (!host) return;

  const course = currentCourse();
  if (!course) {
    host.innerHTML = '<div class="empty-state" style="padding:16px;">Select a course first.</div>';
    return;
  }

  host.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; gap:6px;">
        <button class="ghost-btn ${certState.tab === 'eligible' ? 'active-filter' : ''}" id="certTabEligible" type="button">
          Eligible for Approval <span id="certEligibleBadge" style="font-weight:700;"></span>
        </button>
        <button class="ghost-btn ${certState.tab === 'issued' ? 'active-filter' : ''}" id="certTabIssued" type="button">
          Issued Certificates <span id="certIssuedBadge" style="font-weight:700;"></span>
        </button>
      </div>
      <button class="ghost-btn sm" id="certRefreshBtn" type="button" title="Refresh certificates list">
        <svg class="icon sm" viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Refresh
      </button>
    </div>
    <div class="save-hint" id="certStatusHint" style="margin-bottom:10px;"></div>
    <div id="certTabBody">
      <div style="padding:20px; text-align:center; color:var(--text-muted);">Loading certificates…</div>
    </div>
  `;

  document.getElementById('certTabEligible').addEventListener('click', () => {
    certState.tab = 'eligible';
    renderCertificatesTab(containerId);
  });
  document.getElementById('certTabIssued').addEventListener('click', () => {
    certState.tab = 'issued';
    renderCertificatesTab(containerId);
  });
  document.getElementById('certRefreshBtn').addEventListener('click', () => loadAndPaint(containerId));

  await loadAndPaint(containerId);
}

async function loadAndPaint(containerId) {
  const course = currentCourse();
  const hint = document.getElementById('certStatusHint');
  const body = document.getElementById('certTabBody');
  if (!course || !body) return;

  try {
    const res = await rpc('admin_list_certificates', { p_course_id: course.id });
    certState.eligible = res.eligible || [];
    certState.issued = res.issued || [];
    certState.selectedIds.clear();

    const elBadge = document.getElementById('certEligibleBadge');
    if (elBadge) elBadge.textContent = `(${certState.eligible.length})`;
    const isBadge = document.getElementById('certIssuedBadge');
    if (isBadge) isBadge.textContent = `(${certState.issued.length})`;

    if (certState.tab === 'eligible') {
      paintEligible(body, hint);
    } else {
      paintIssued(body, hint);
    }
  } catch (err) {
    if (body) body.innerHTML = `<div class="empty-state" style="color:var(--danger); padding:16px;">Failed to load certificates: ${escapeHtml(errorMessage(err))}</div>`;
  }
}

function paintEligible(body, hint) {
  const eligible = certState.eligible;
  if (!eligible.length) {
    body.innerHTML = `
      <div class="empty-state" style="padding:24px; text-align:center;">
        <svg class="icon" viewBox="0 0 24 24" style="width:36px; height:36px; stroke:var(--text-muted); margin-bottom:8px;"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
        <p>No students currently eligible for certificate approval.</p>
        <p style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">Students appear here once their exam result is finalized and passing, and no certificate has been approved yet.</p>
      </div>
    `;
    return;
  }

  const approvableCount = eligible.filter(e => !e.missing_arabic_name).length;

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
      <div style="font-size:0.8rem; color:var(--text-muted);">
        <b>${eligible.length}</b> eligible student(s) (${approvableCount} ready, ${eligible.length - approvableCount} missing Arabic name)
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="save-btn sm" id="bulkApproveBtn" type="button" disabled>
          Approve Selected (0)
        </button>
      </div>
    </div>
    <div class="table-wrapper" style="max-height:480px; overflow-y:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
        <thead>
          <tr style="background:var(--bg-warm); text-align:left; border-bottom:1.5px solid var(--border-color);">
            <th style="padding:8px 10px; width:36px; text-align:center;">
              <input type="checkbox" id="selectAllEligible" title="Select all with Arabic name">
            </th>
            <th style="padding:8px 10px; width:48px;">S/N</th>
            <th style="padding:8px 10px;">Student Name</th>
            <th style="padding:8px 10px;">Arabic Name</th>
            <th style="padding:8px 10px; width:70px; text-align:right;">Final</th>
            <th style="padding:8px 10px; width:90px;">Band</th>
            <th style="padding:8px 10px; width:110px; text-align:center;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${eligible.map(e => {
            const hasAr = !e.missing_arabic_name;
            return `
              <tr style="border-bottom:1px solid var(--border-color);" data-eid="${escapeAttr(e.enrollment_id)}">
                <td style="padding:8px 10px; text-align:center;">
                  <input type="checkbox" class="eligible-check" data-id="${escapeAttr(e.enrollment_id)}" ${hasAr ? '' : 'disabled title="Cannot approve without Arabic name"'}>
                </td>
                <td style="padding:8px 10px; font-weight:600; color:var(--text-muted);">${e.sn}</td>
                <td style="padding:8px 10px; font-weight:600;">${escapeHtml(e.student_name)}</td>
                <td style="padding:8px 10px;">
                  ${hasAr 
                    ? `<span dir="rtl" style="font-family:'Amiri', serif; font-size:1.05rem;">${escapeHtml(e.student_name_ar)}</span>`
                    : `<span class="badge-flag" style="color:var(--danger); font-size:0.75rem; cursor:pointer; background:rgba(220,38,38,0.1); padding:2px 6px; border-radius:4px;" data-goto-ar="${escapeAttr(e.student_id)}" title="Click to add Arabic name in roster">⚠️ Missing Arabic name</span>`}
                </td>
                <td style="padding:8px 10px; text-align:right; font-weight:700; color:var(--emerald);">${e.final != null ? Number(e.final).toFixed(1) : ''}%</td>
                <td style="padding:8px 10px;">
                  <span style="font-size:0.8rem; font-weight:600; color:#855d14;">${escapeHtml(e.band_label || '')}</span>
                </td>
                <td style="padding:8px 10px; text-align:center;">
                  <button class="save-btn sm approve-single-btn" data-id="${escapeAttr(e.enrollment_id)}" type="button" ${hasAr ? '' : 'disabled title="Add Arabic name first"'}>
                    Approve
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Select all checkbox
  const selectAll = document.getElementById('selectAllEligible');
  const bulkBtn = document.getElementById('bulkApproveBtn');

  function updateBulkBtn() {
    const count = certState.selectedIds.size;
    bulkBtn.disabled = count === 0;
    bulkBtn.textContent = `Approve Selected (${count})`;
    if (selectAll) {
      const approvable = eligible.filter(e => !e.missing_arabic_name);
      selectAll.checked = approvable.length > 0 && certState.selectedIds.size === approvable.length;
    }
  }

  if (selectAll) {
    selectAll.addEventListener('change', () => {
      body.querySelectorAll('.eligible-check:not(:disabled)').forEach(cb => {
        cb.checked = selectAll.checked;
        if (selectAll.checked) certState.selectedIds.add(cb.dataset.id);
        else certState.selectedIds.delete(cb.dataset.id);
      });
      updateBulkBtn();
    });
  }

  body.querySelectorAll('.eligible-check').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) certState.selectedIds.add(cb.dataset.id);
      else certState.selectedIds.delete(cb.dataset.id);
      updateBulkBtn();
    });
  });

  body.querySelectorAll('.approve-single-btn').forEach(btn => {
    btn.addEventListener('click', () => approveCertificates([btn.dataset.id], hint));
  });

  bulkBtn.addEventListener('click', () => {
    const ids = Array.from(certState.selectedIds);
    if (!ids.length) return;
    confirmDialog({
      title: 'Approve Certificates?',
      body: `This will generate official certificate numbers and freeze permanent snapshots for ${ids.length} student(s).`,
      okText: `Approve ${ids.length} Certificate(s)`,
      onOk: () => approveCertificates(ids, hint),
    });
  });

  body.querySelectorAll('[data-goto-ar]').forEach(el => {
    el.addEventListener('click', () => {
      const arMenu = document.getElementById('menuBodyAr');
      const arChevron = document.getElementById('menuChevronAr');
      if (arMenu && !arMenu.classList.contains('open')) {
        arMenu.classList.add('open');
        if (arChevron) arChevron.innerHTML = '&#9662;';
      }
      const arInput = document.querySelector(`input[data-ar-id="${el.dataset.gotoAr}"]`);
      if (arInput) {
        arInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        arInput.focus();
      }
    });
  });
}

function paintIssued(body, hint) {
  const issued = certState.issued;
  if (!issued.length) {
    body.innerHTML = `
      <div class="empty-state" style="padding:24px; text-align:center;">
        <p>No certificates issued for this course yet.</p>
        <p style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">Approve eligible students from the "Eligible for Approval" tab to issue certificates.</p>
      </div>
    `;
    return;
  }

  body.innerHTML = `
    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:10px;">
      Total issued: <b>${issued.length}</b> certificate(s)
    </div>
    <div class="table-wrapper" style="max-height:480px; overflow-y:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
        <thead>
          <tr style="background:var(--bg-warm); text-align:left; border-bottom:1.5px solid var(--border-color);">
            <th style="padding:8px 10px; width:48px;">S/N</th>
            <th style="padding:8px 10px;">Certificate No.</th>
            <th style="padding:8px 10px;">Student Name</th>
            <th style="padding:8px 10px; width:70px; text-align:right;">Final</th>
            <th style="padding:8px 10px; width:80px;">Status</th>
            <th style="padding:8px 10px; width:90px;">Issued Date</th>
            <th style="padding:8px 10px; text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${issued.map(c => {
            const isApproved = c.status === 'approved';
            return `
              <tr style="border-bottom:1px solid var(--border-color); ${!isApproved ? 'opacity:0.7; background:rgba(220,38,38,0.02);' : ''}">
                <td style="padding:8px 10px; font-weight:600; color:var(--text-muted);">${c.sn}</td>
                <td style="padding:8px 10px; font-family:monospace; font-weight:700; color:var(--emerald);">
                  ${escapeHtml(c.number)}
                </td>
                <td style="padding:8px 10px;">
                  <div style="font-weight:600;">${escapeHtml(c.student_name)}</div>
                  ${c.student_name_ar ? `<div dir="rtl" style="font-family:'Amiri', serif; font-size:0.95rem; color:var(--text-muted);">${escapeHtml(c.student_name_ar)}</div>` : ''}
                </td>
                <td style="padding:8px 10px; text-align:right; font-weight:600;">${c.final != null ? Number(c.final).toFixed(1) : ''}%</td>
                <td style="padding:8px 10px;">
                  ${isApproved 
                    ? `<span style="background:rgba(6,95,70,0.1); color:var(--emerald); padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:700;">Approved</span>`
                    : `<span style="background:rgba(220,38,38,0.1); color:var(--danger); padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:700;" title="${escapeAttr(c.revoke_reason || 'Revoked')}">Revoked</span>`}
                </td>
                <td style="padding:8px 10px; font-size:0.78rem; color:var(--text-muted); font-family:monospace;">
                  ${c.approved_at ? c.approved_at.slice(0, 10) : ''}
                </td>
                <td style="padding:8px 10px; text-align:center; white-space:nowrap;">
                  <div style="display:inline-flex; gap:6px;">
                    <button class="ghost-btn sm view-cert-btn" data-id="${escapeAttr(c.id)}" type="button">
                      View / Print
                    </button>
                    ${isApproved ? `
                      <button class="ghost-btn sm danger-text revoke-cert-btn" data-eid="${escapeAttr(c.enrollment_id)}" data-num="${escapeAttr(c.number)}" type="button">
                        Revoke
                      </button>
                    ` : ''}
                    <button class="ghost-btn sm copy-link-btn" data-num="${escapeAttr(c.number)}" type="button" title="Copy verification URL">
                      Copy Link
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  body.querySelectorAll('.view-cert-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cert = issued.find(i => i.id === btn.dataset.id);
      if (cert && cert.snapshot) showCertificateModal(cert.snapshot);
    });
  });

  body.querySelectorAll('.revoke-cert-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const eid = btn.dataset.eid;
      const num = btn.dataset.num;
      promptRevoke(eid, num, hint);
    });
  });

  body.querySelectorAll('.copy-link-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const num = btn.dataset.num;
      const host = window.location.origin;
      const url = `${host}/verify/${num}`;
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy Link'; }, 2000);
      } catch (_) {
        setHint(hint, `URL: ${url}`, 'ok');
      }
    });
  });
}

async function approveCertificates(enrollmentIds, hint) {
  setHint(hint, 'Approving certificate(s)…');
  try {
    const res = await rpc('admin_approve_certificates', { p_enrollment_ids: enrollmentIds });
    const successList = (Array.isArray(res) ? res : []).filter(r => r.ok);
    const failList = (Array.isArray(res) ? res : []).filter(r => !r.ok);

    if (failList.length) {
      const errMsgs = failList.map(f => errorMessage({ code: f.error })).join(', ');
      setHint(hint, `Approved ${successList.length}, but failed ${failList.length}: ${errMsgs}`, 'err');
    } else {
      setHint(hint, `Successfully approved ${successList.length} certificate(s)!`, 'ok');
    }

    // Refresh certificates tab and main public data
    await renderCertificatesTab();
    reload({ coursesToo: false });
  } catch (err) {
    setHint(hint, 'Approval failed: ' + errorMessage(err), 'err');
  }
}

function promptRevoke(enrollmentId, certNumber, hint) {
  const reason = window.prompt(`Revoke certificate ${certNumber}?\n\nEnter reason for revocation:`, 'Administrative revocation');
  if (reason === null) return; // user cancelled

  revokeCertificate(enrollmentId, reason.trim() || 'Administrative revocation', hint);
}

async function revokeCertificate(enrollmentId, reason, hint) {
  setHint(hint, 'Revoking certificate…');
  try {
    await rpc('admin_revoke_certificate', {
      p_enrollment_id: enrollmentId,
      p_reason: reason,
    });
    setHint(hint, 'Certificate revoked.', 'ok');
    await renderCertificatesTab();
    reload({ coursesToo: false });
  } catch (err) {
    setHint(hint, 'Revocation failed: ' + errorMessage(err), 'err');
  }
}

/**
 * Institution Settings UI (Phase 4, Task 4.6; FR-V8).
 */
export async function renderInstitutionSettings(containerId = 'institutionSettingsBody') {
  const host = document.getElementById(containerId);
  if (!host) return;

  host.innerHTML = '<div style="padding:16px; color:var(--text-muted);">Loading institution settings…</div>';

  try {
    const data = await rpc('admin_get_institution');
    const inst = data.institution || {};
    const defs = data.certificate_defaults || {};
    const sig = defs.signatory || {};
    const pfx = data.number_prefix || 'MMI';

    host.innerHTML = `
      <div class="institution-form" style="max-width:720px;">
        <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:14px;">
          Global defaults for certificates across all courses. Individual courses can override wording, title, or signatories in Course Settings.
        </p>

        <div style="font-size:0.85rem; font-weight:700; color:var(--emerald); margin-bottom:8px; border-bottom:1px solid var(--border-color); padding-bottom:4px;">
          Institution Profile & Numbering
        </div>

        <div class="field-row">
          <label for="instName">Institution Name (EN)</label>
          <input type="text" id="instName" value="${escapeAttr(inst.name || "Ma'had Miftah al-'Ilm")}">
        </div>

        <div class="field-row">
          <label for="instNameAr">Institution Name (Arabic)</label>
          <input type="text" id="instNameAr" dir="auto" value="${escapeAttr(inst.name_ar || "معهد مفتاح العلم")}">
        </div>

        <div class="field-row">
          <label for="instPrefix">Certificate Number Prefix</label>
          <input type="text" id="instPrefix" maxlength="8" style="text-transform:uppercase; font-family:monospace;" value="${escapeAttr(pfx)}">
        </div>
        <p style="font-size:0.75rem; color:var(--text-muted); margin:-4px 0 14px;">
          2 to 8 uppercase alphanumeric characters (e.g. MMI). Produces numbers like <code>MMI-ADAB-2026-0001</code>.
        </p>

        <div style="font-size:0.85rem; font-weight:700; color:var(--emerald); margin:16px 0 8px; border-bottom:1px solid var(--border-color); padding-bottom:4px;">
          Default Certificate Wording & Titles
        </div>

        <div class="field-row">
          <label for="instTitle">Certificate Title (EN)</label>
          <input type="text" id="instTitle" value="${escapeAttr(defs.title || "Certificate of Completion")}">
        </div>

        <div class="field-row">
          <label for="instTitleAr">Certificate Title (Arabic)</label>
          <input type="text" id="instTitleAr" dir="auto" value="${escapeAttr(defs.title_ar || "شهادة إتمام")}">
        </div>

        <div class="field-row" style="flex-direction:column; align-items:flex-start;">
          <label for="instWording" style="margin-bottom:4px;">Default English Wording</label>
          <textarea id="instWording" maxlength="600" style="width:100%; min-height:70px; font-size:0.85rem; padding:8px; border:1.5px solid var(--border-color); border-radius:6px; box-sizing:border-box;">${escapeHtml(defs.wording || "This is to certify that {name} has successfully completed the course {course} with a final score of {score}% ({band}).")}</textarea>
        </div>

        <div class="field-row" style="flex-direction:column; align-items:flex-start;">
          <label for="instWordingAr" style="margin-bottom:4px;">Default Arabic Wording</label>
          <textarea id="instWordingAr" maxlength="600" dir="auto" style="width:100%; min-height:70px; font-size:0.95rem; font-family:'Amiri', serif; padding:8px; border:1.5px solid var(--border-color); border-radius:6px; box-sizing:border-box;">${escapeHtml(defs.wording_ar || "يشهد معهد مفتاح العلم بأن {name_ar} قد أتمّ بنجاح دورة {course_ar} بدرجة نهائية قدرها {score}٪ وتقدير {band_ar}.")}</textarea>
        </div>
        <p style="font-size:0.75rem; color:var(--text-muted); margin:-4px 0 14px;">
          Placeholders: <code>{name}</code>, <code>{name_ar}</code>, <code>{course}</code>, <code>{course_ar}</code>, <code>{score}</code>, <code>{band}</code>, <code>{band_ar}</code>, <code>{date}</code>.
        </p>

        <div style="font-size:0.85rem; font-weight:700; color:var(--emerald); margin:16px 0 8px; border-bottom:1px solid var(--border-color); padding-bottom:4px;">
          Default Signatory Block
        </div>

        <div class="field-row">
          <label for="instSigName">Signatory Name (EN)</label>
          <input type="text" id="instSigName" value="${escapeAttr(sig.name || "Musa Aminu Muhammad")}">
        </div>

        <div class="field-row">
          <label for="instSigNameAr">Signatory Name (Arabic)</label>
          <input type="text" id="instSigNameAr" dir="auto" value="${escapeAttr(sig.name_ar || "موسى أمينو محمد")}">
        </div>

        <div class="field-row">
          <label for="instSigTitle">Signatory Title (EN)</label>
          <input type="text" id="instSigTitle" value="${escapeAttr(sig.title || "Mushrif")}">
        </div>

        <div class="field-row">
          <label for="instSigTitleAr">Signatory Title (Arabic)</label>
          <input type="text" id="instSigTitleAr" dir="auto" value="${escapeAttr(sig.title_ar || "المشرف")}">
        </div>

        <div class="field-row">
          <label for="instLogo">Logo Path (optional)</label>
          <input type="text" id="instLogo" placeholder="assets/logo.png" value="${escapeAttr(defs.logo || '')}">
        </div>

        <div class="field-row">
          <label for="instSigImg">Signature Image Path (optional)</label>
          <input type="text" id="instSigImg" placeholder="assets/signature.png" value="${escapeAttr(defs.signature_image || '')}">
        </div>

        <div class="entry-footer" style="margin-top:16px; display:flex; gap:10px; align-items:center;">
          <button class="save-btn" id="saveInstBtn" type="button">Save Institution Settings</button>
          <button class="ghost-btn" id="previewInstCertBtn" type="button">Preview Sample Certificate</button>
          <span class="save-hint" id="instHint"></span>
        </div>
      </div>
    `;

    document.getElementById('saveInstBtn').addEventListener('click', saveInstitution);
    document.getElementById('previewInstCertBtn').addEventListener('click', () => {
      const g = (id) => document.getElementById(id).value.trim();
      const sampleSnap = {
        number: `${g('instPrefix') || 'MMI'}-SAMPLE-2026-0001`,
        student_name: 'Ahmad Bello',
        student_name_ar: 'أحمد بللو',
        course_name: currentCourse() ? currentCourse().name : 'Sample Islamic Studies',
        course_name_ar: currentCourse() && currentCourse().name_ar ? currentCourse().name_ar : 'دراسات إسلامية',
        final: 94.5,
        band_label: 'Excellent',
        band_label_ar: 'ممتاز',
        issued_date: new Date().toISOString().slice(0, 10),
        title: g('instTitle') || 'Certificate of Completion',
        title_ar: g('instTitleAr') || 'شهادة إتمام',
        institution_name: g('instName') || "Ma'had Miftah al-'Ilm",
        institution_name_ar: g('instNameAr') || 'معهد مفتاح العلم',
        wording: g('instWording')
          .replace('{name}', 'Ahmad Bello')
          .replace('{course}', 'Sample Islamic Studies')
          .replace('{score}', '94.5')
          .replace('{band}', 'Excellent')
          .replace('{date}', new Date().toISOString().slice(0, 10)),
        wording_ar: g('instWordingAr')
          .replace('{name_ar}', 'أحمد بللو')
          .replace('{course_ar}', 'دراسات إسلامية')
          .replace('{score}', '94.5')
          .replace('{band_ar}', 'ممتاز')
          .replace('{date}', new Date().toISOString().slice(0, 10)),
        signatory: {
          name: g('instSigName') || 'Musa Aminu Muhammad',
          name_ar: g('instSigNameAr') || 'موسى أمينو محمد',
          title: g('instSigTitle') || 'Mushrif',
          title_ar: g('instSigTitleAr') || 'المشرف',
        },
        logo: g('instLogo') || null,
        signature_image: g('instSigImg') || null,
      };
      showCertificateModal(sampleSnap);
    });
  } catch (err) {
    host.innerHTML = `<div class="empty-state" style="color:var(--danger); padding:16px;">Failed to load institution settings: ${escapeHtml(errorMessage(err))}</div>`;
  }
}

async function saveInstitution() {
  const hint = document.getElementById('instHint');
  const g = (id) => document.getElementById(id).value.trim();

  const prefix = g('instPrefix').toUpperCase();
  if (prefix && !/^[A-Z0-9]{2,8}$/.test(prefix)) {
    return setHint(hint, 'Prefix must be 2 to 8 uppercase letters or digits.', 'err');
  }

  const wording = g('instWording');
  const wordingAr = g('instWordingAr');
  if (wording.length > 600 || wordingAr.length > 600) {
    return setHint(hint, 'Certificate wording must not exceed 600 characters.', 'err');
  }

  const sigName = g('instSigName');
  const sigNameAr = g('instSigNameAr');
  const sigTitle = g('instSigTitle');
  const sigTitleAr = g('instSigTitleAr');

  let signatory = null;
  if (sigName || sigNameAr || sigTitle || sigTitleAr) {
    if (!sigName || !sigNameAr || !sigTitle || !sigTitleAr) {
      return setHint(hint, 'All four signatory fields (EN/AR name and EN/AR title) are required if signatory is provided.', 'err');
    }
    signatory = {
      name: sigName,
      name_ar: sigNameAr,
      title: sigTitle,
      title_ar: sigTitleAr,
    };
  }

  setHint(hint, 'Saving institution settings…');

  const payload = {
    number_prefix: prefix || 'MMI',
    institution: {
      name: g('instName'),
      name_ar: g('instNameAr'),
    },
    certificate_defaults: {
      title: g('instTitle'),
      title_ar: g('instTitleAr'),
      wording,
      wording_ar: wordingAr,
      signatory,
      logo: g('instLogo') || null,
      signature_image: g('instSigImg') || null,
    },
  };

  try {
    await rpc('admin_save_institution', { p_settings: payload });
    setHint(hint, 'Institution settings saved successfully!', 'ok');
  } catch (err) {
    setHint(hint, 'Save failed: ' + errorMessage(err), 'err');
  }
}
