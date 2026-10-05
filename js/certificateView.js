// Certificate view & print rendering (Phase 4, Task 4.4; Appendix B).
// Renders print-ready A4 landscape certificates from the frozen snapshot.

import { createQrSvg } from '../vendor/qrcode.esm.js';
import { escapeHtml } from './ui.js';

const CORNER_SVG = `
<svg viewBox="0 0 50 50" width="44" height="44" style="display:block;">
  <path d="M 2 2 L 48 2 L 48 6 L 6 6 L 6 48 L 2 48 Z" fill="#c5a059" />
  <path d="M 10 10 L 40 10 L 40 13 L 13 13 L 13 40 L 10 40 Z" fill="#065f46" />
  <circle cx="22" cy="22" r="3.5" fill="#c5a059" />
  <circle cx="22" cy="22" r="1.5" fill="#065f46" />
</svg>
`;

/**
 * Builds the complete HTML for a print-ready A4 landscape certificate from snapshot data.
 */
export async function renderCertificateHtml(snapshot) {
  const host = typeof window !== 'undefined' ? window.location.origin : 'https://almiftahu.org';
  const verifyUrl = `${host}/verify/${encodeURIComponent(snapshot.number)}`;
  
  let qrSvg = '';
  try {
    qrSvg = await createQrSvg(verifyUrl, { width: 90, margin: 0 });
  } catch (e) {
    console.error('QR generation failed:', e);
    qrSvg = `<div style="font-size:8pt; border:1px dashed #999; padding:10px;">${escapeHtml(snapshot.number)}</div>`;
  }

  const sig = snapshot.signatory || {};
  const sigName = sig.name || 'Musa Aminu Muhammad';
  const sigNameAr = sig.name_ar || 'موسى أمينو محمد';
  const sigTitle = sig.title || 'Mushrif';
  const sigTitleAr = sig.title_ar || 'المشرف';

  const logoHtml = snapshot.logo 
    ? `<img src="${escapeHtml(snapshot.logo)}" alt="Logo" style="max-height:48px; max-width:140px; margin-bottom:4px; object-fit:contain;">`
    : `<div style="font-size:1.1rem; color:#c5a059; font-weight:700; letter-spacing:2px; margin-bottom:2px;">&#10022; &#10022; &#10022;</div>`;

  const sigImgHtml = snapshot.signature_image
    ? `<img src="${escapeHtml(snapshot.signature_image)}" alt="Signature" style="max-height:40px; max-width:140px; margin-bottom:2px; object-fit:contain;">`
    : `<div style="height:32px;"></div>`;

  return `
  <div class="certificate-sheet" id="certificatePrintArea">
    <div class="certificate-inner-frame"></div>
    
    <!-- 4 Decorative Corner Knots -->
    <div style="position:absolute; top:5mm; left:5mm;">${CORNER_SVG}</div>
    <div style="position:absolute; top:5mm; right:5mm; transform:scaleX(-1);">${CORNER_SVG}</div>
    <div style="position:absolute; bottom:5mm; left:5mm; transform:scaleY(-1);">${CORNER_SVG}</div>
    <div style="position:absolute; bottom:5mm; right:5mm; transform:scale(-1, -1);">${CORNER_SVG}</div>

    <!-- Header Section -->
    <div class="cert-header" style="position:relative; z-index:2; padding:0 30px;">
      ${logoHtml}
      <div style="font-family:'Amiri', serif; font-size:24pt; font-weight:700; color:#065f46; line-height:1.2;">
        ${escapeHtml(snapshot.institution_name_ar || 'معهد مفتاح العلم')}
      </div>
      <div style="font-family:'Inter', sans-serif; font-size:10pt; font-weight:600; letter-spacing:2.5px; text-transform:uppercase; color:#666; margin-top:2px;">
        ${escapeHtml(snapshot.institution_name || "Ma'had Miftah al-'Ilm")}
      </div>
      <div style="margin-top:6px;">
        <div style="font-family:'Amiri', serif; font-size:22pt; font-weight:700; color:#855d14; line-height:1.1;">
          ${escapeHtml(snapshot.title_ar || 'شهادة إتمام')}
        </div>
        <div style="font-family:'Inter', sans-serif; font-size:9.5pt; font-weight:600; letter-spacing:3px; text-transform:uppercase; color:#855d14;">
          ${escapeHtml(snapshot.title || 'Certificate of Completion')}
        </div>
      </div>
    </div>

    <!-- Body / Recipient Section -->
    <div class="cert-body" style="position:relative; z-index:2; padding:0 30px; margin:4px 0;">
      <div dir="rtl" style="font-family:'Amiri', serif; font-size:13pt; line-height:1.6; color:#222; margin-bottom:4px;">
        ${escapeHtml(snapshot.wording_ar || '')}
      </div>

      <div style="margin:4px 0 6px;">
        <div style="font-family:'Amiri', serif; font-size:24pt; font-weight:700; color:#065f46; line-height:1.2;">
          ${escapeHtml(snapshot.student_name_ar || '')}
        </div>
        <div style="font-family:'Inter', sans-serif; font-size:14pt; font-weight:600; color:#111; letter-spacing:0.5px;">
          ${escapeHtml(snapshot.student_name || '')}
        </div>
      </div>

      <div style="font-family:'Amiri', serif; font-size:14pt; font-weight:700; color:#065f46;">
        <span>${escapeHtml(snapshot.course_name_ar || '')}</span>
        ${snapshot.course_name ? `<span style="font-family:'Inter', sans-serif; font-size:12pt; font-weight:600; color:#444; margin-left:8px;">| ${escapeHtml(snapshot.course_name)}</span>` : ''}
      </div>

      <div style="margin-top:4px; font-size:10.5pt; font-weight:600; color:#855d14; background:rgba(197, 160, 89, 0.08); display:inline-block; padding:3px 18px; border-radius:20px; border:1px solid rgba(197, 160, 89, 0.3);">
        <span dir="rtl" style="font-family:'Amiri', serif; font-size:11.5pt;">الدرجة النهائية: ${snapshot.final != null ? Number(snapshot.final).toFixed(1) : ''}٪ (${escapeHtml(snapshot.band_label_ar || '')})</span>
        <span style="margin:0 8px; color:#c5a059;">&bull;</span>
        <span>Final Score: ${snapshot.final != null ? Number(snapshot.final).toFixed(1) : ''}% (${escapeHtml(snapshot.band_label || '')})</span>
      </div>

      <div style="font-family:'Inter', sans-serif; font-size:9.5pt; color:#444; line-height:1.5; max-width:85%; margin:6px auto 0;">
        ${escapeHtml(snapshot.wording || '')}
      </div>
    </div>

    <!-- Footer Row: 3 Columns (Left: Meta, Center: QR, Right: Signatory) -->
    <div class="cert-footer" style="position:relative; z-index:2; display:flex; justify-content:space-between; align-items:flex-end; padding:0 35px 6px;">
      <!-- Left: Date & Certificate Number -->
      <div style="text-align:left; font-size:8.5pt; color:#555; min-width:170px;">
        <div style="font-weight:600; color:#333; margin-bottom:2px;">
          Date: <span style="font-family:monospace; font-size:9pt;">${escapeHtml(snapshot.issued_date || '')}</span>
        </div>
        <div style="font-weight:600; color:#333; margin-bottom:2px;">
          Certificate No: <span style="font-family:monospace; font-weight:700; color:#065f46;">${escapeHtml(snapshot.number || '')}</span>
        </div>
        <div style="font-size:7.5pt; color:#777;">
          Official Document &bull; Ma'had Miftah al-'Ilm
        </div>
      </div>

      <!-- Center: QR Code & Verification link -->
      <div style="text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        <div style="background:#fff; padding:3px; border:1px solid #ddd; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.05); width:74px; height:74px; display:flex; align-items:center; justify-content:center;">
          ${qrSvg}
        </div>
        <div style="font-size:7pt; color:#666; margin-top:3px; max-width:160px; word-break:break-all;">
          Verify at:<br><b style="color:#065f46;">${escapeHtml(verifyUrl.replace(/^https?:\/\//, ''))}</b>
        </div>
      </div>

      <!-- Right: Signatory block -->
      <div style="text-align:right; min-width:170px;">
        ${sigImgHtml}
        <div style="border-top:1.5px solid #065f46; padding-top:4px; margin-top:2px;">
          <div style="font-family:'Amiri', serif; font-size:12.5pt; font-weight:700; color:#065f46; line-height:1.2;">
            ${escapeHtml(sigNameAr)}
          </div>
          <div style="font-family:'Inter', sans-serif; font-size:9pt; font-weight:600; color:#222;">
            ${escapeHtml(sigName)}
          </div>
          <div style="font-size:8pt; color:#666; margin-top:1px;">
            <span style="font-family:'Amiri', serif; font-size:9.5pt;">${escapeHtml(sigTitleAr)}</span> / ${escapeHtml(sigTitle)}
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

/**
 * Opens the certificate preview & print overlay modal with the given snapshot.
 */
export async function showCertificateModal(snapshot) {
  let modal = document.getElementById("certificateModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "certificateModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content certificate-modal-content">
        <div class="cert-action-bar no-print" style="display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:var(--bg-card); border-bottom:1px solid var(--border-color); border-radius:8px 8px 0 0;">
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="save-btn" id="certPrintBtn" type="button" style="display:inline-flex; align-items:center; gap:6px;">
              <svg class="icon" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print / Save as PDF
            </button>
            <span style="font-size:0.8rem; color:var(--text-muted);">(Set orientation to Landscape in print dialog)</span>
          </div>
          <button class="close-btn" id="certCloseBtn" type="button" style="font-size:1.5rem; border:none; background:none; cursor:pointer;">&times;</button>
        </div>
        <div id="certificateRenderWrap" style="overflow-x:auto; padding:16px; display:flex; justify-content:center; background:#525659;"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const closeBtn = document.getElementById("certCloseBtn");
  if (closeBtn && !closeBtn._wired) {
    closeBtn._wired = true;
    closeBtn.addEventListener("click", () => {
      modal.classList.remove("open");
      document.body.classList.remove("printing-certificate");
    });
  }

  const printBtn = document.getElementById("certPrintBtn");
  if (printBtn && !printBtn._wired) {
    printBtn._wired = true;
    printBtn.addEventListener("click", async () => {
      document.body.classList.add("printing-certificate");
      if (typeof document !== "undefined" && document.fonts) {
        try { await document.fonts.ready; } catch (_) {}
      }
      window.print();
    });
  }

  const wrap = document.getElementById('certificateRenderWrap');
  wrap.innerHTML = '<div style="color:#fff; padding:40px;">Generating certificate…</div>';
  modal.classList.add('open');

  const certHtml = await renderCertificateHtml(snapshot);
  wrap.innerHTML = certHtml;
}
