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

if (typeof document !== 'undefined' && document.getElementById('confirmCancel')) {
  document.getElementById('confirmCancel').addEventListener('click', () => closeConfirm(false));
  document.getElementById('confirmOk').addEventListener('click', () => closeConfirm(true));
}

// ---------- course unit label (FR-C10) ----------
export function unitName(course) { return (course && course.unit_label) || 'Day'; }

export function unitHtml(course, i) {
  const ar = course && course.unit_label_ar
    ? ` <span dir="auto" style="font-family:'Amiri',serif;">${escapeHtml(course.unit_label_ar)} ${i + 1}</span>` : '';
  return `${escapeHtml(unitName(course))} ${i + 1}${ar}`;
}

// ---------- Image upload helper (Data URL with canvas resizing) ----------
export function readFileAsDataUrl(file, maxWidth = 600) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (typeof window !== 'undefined' && typeof Image !== 'undefined' && typeof document !== 'undefined') {
        try {
          const canvas = document.createElement('canvas');
          if (canvas && canvas.getContext) {
            const img = new Image();
            img.onload = () => {
              let w = img.width;
              let h = img.height;
              if (w <= maxWidth && h <= maxWidth) return resolve(dataUrl);
              if (w > maxWidth) {
                h = Math.round((h * maxWidth) / w);
                w = maxWidth;
              }
              if (h > maxWidth) {
                w = Math.round((w * maxWidth) / h);
                h = maxWidth;
              }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, w, h);
                return resolve(canvas.toDataURL('image/png'));
              }
              resolve(dataUrl);
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
            return;
          }
        } catch (_) {}
      }
      resolve(dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Render image upload widget with live thumbnail, file chooser, and remove button
export function renderImageUploadField({ id, label, value = '', hint = '' }) {
  const hasVal = Boolean(value);
  return `
    <div class="field-row img-upload-row" style="flex-direction:column; align-items:flex-start; margin-bottom:12px;">
      <label for="${id}" style="margin-bottom:4px; font-weight:600; font-size:0.85rem;">${escapeHtml(label)}</label>
      <div style="width:100%; display:flex; align-items:center; gap:12px; flex-wrap:wrap; background:var(--bg-warm); border:1.5px dashed var(--border-color); border-radius:8px; padding:10px 12px; box-sizing:border-box;">
        <div id="${id}Preview" style="display:${hasVal ? 'flex' : 'none'}; align-items:center; justify-content:center; width:80px; height:44px; background:#fff; border:1px solid var(--border-color); border-radius:6px; overflow:hidden; padding:2px; flex-shrink:0;">
          <img src="${escapeAttr(value || '')}" alt="Preview" style="max-width:100%; max-height:100%; object-fit:contain;">
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <label class="ghost-btn sm" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px; margin:0;">
            <span id="${id}BtnText">📁 ${hasVal ? 'Change Image' : 'Upload Image'}</span>
            <input type="file" id="${id}File" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none;">
          </label>
          <button type="button" class="ghost-btn sm" id="${id}RemoveBtn" style="display:${hasVal ? 'inline-block' : 'none'}; color:#dc2626; border-color:rgba(220,38,38,0.3);">
            Remove
          </button>
        </div>
        <input type="hidden" id="${id}" value="${escapeAttr(value || '')}">
        ${hint ? `<div style="font-size:0.75rem; color:var(--text-muted); width:100%; margin-top:2px;">${escapeHtml(hint)}</div>` : ''}
      </div>
    </div>
  `;
}

export function bindImageUpload(id, onChange) {
  const fileInput = document.getElementById(`${id}File`);
  const hiddenInput = document.getElementById(id);
  const preview = document.getElementById(`${id}Preview`);
  const removeBtn = document.getElementById(`${id}RemoveBtn`);
  const btnText = document.getElementById(`${id}BtnText`);

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (dataUrl && hiddenInput) {
          hiddenInput.value = dataUrl;
          if (preview) {
            preview.innerHTML = `<img src="${dataUrl}" alt="Preview" style="max-width:100%; max-height:100%; object-fit:contain;">`;
            preview.style.display = 'flex';
          }
          if (removeBtn) removeBtn.style.display = 'inline-block';
          if (btnText) btnText.textContent = '📁 Change Image';
          if (onChange) onChange(dataUrl);
        }
      } catch (err) {
        console.error('Failed to read image file:', err);
      }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      if (hiddenInput) hiddenInput.value = '';
      if (fileInput) fileInput.value = '';
      if (preview) {
        preview.innerHTML = '';
        preview.style.display = 'none';
      }
      removeBtn.style.display = 'none';
      if (btnText) btnText.textContent = '📁 Upload Image';
      if (onChange) onChange('');
    });
  }
}

// ---------- Clean human-readable student response & answer key formatting ----------
export function formatQuestionResponse(q) {
  if (!q) return '<span style="color:var(--text-muted); font-style:italic;">No response</span>';

  const isEssay = q.format === 'essay';
  const isFill = q.format === 'fill';
  const isChoice = q.format === 'mcq' || q.format === 'tf';

  if (isEssay) {
    const text = (q.response && q.response.text != null) ? String(q.response.text) : '';
    if (!text.trim()) return '<span style="color:var(--text-muted); font-style:italic;">No text submitted</span>';
    return `<div dir="auto" style="white-space:pre-wrap; line-height:1.6; color:var(--text-dark); font-size:0.92rem;">${escapeHtml(text)}</div>`;
  }

  if (isFill) {
    const text = (q.response && q.response.text != null) ? String(q.response.text) : '';
    if (!text.trim()) return '<span style="color:var(--text-muted); font-style:italic;">No answer submitted (blank)</span>';
    return `<span style="font-weight:700; color:var(--text-dark); font-size:0.95rem;">"${escapeHtml(text)}"</span>`;
  }

  if (isChoice) {
    const selectedIds = (q.response && Array.isArray(q.response.selected)) ? q.response.selected : [];
    if (!selectedIds.length) {
      return '<span style="color:var(--text-muted); font-style:italic;">No option selected</span>';
    }
    const options = Array.isArray(q.options) ? q.options : [];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    return selectedIds.map(selId => {
      const idx = options.findIndex(o => (typeof o === 'object' ? o.id : o) === selId);
      const opt = idx !== -1 ? options[idx] : null;
      const letter = idx !== -1 && idx < letters.length ? letters[idx] : (idx !== -1 ? String(idx + 1) : '');
      const textEn = opt ? (typeof opt === 'object' ? (opt.text || opt.title || '') : String(opt)) : selId;
      const textAr = opt && typeof opt === 'object' ? (opt.text_ar || '') : '';

      return `
        <div style="display:inline-flex; align-items:center; gap:8px; background:var(--bg-card); border:1px solid var(--border-color); padding:4px 10px; border-radius:6px; margin:2px 4px 2px 0;">
          <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:var(--emerald-dark); color:#fff; font-weight:700; font-size:0.75rem;">
            ${letter || '•'}
          </span>
          <span style="font-weight:600; color:var(--text-dark);">${escapeHtml(textEn)}</span>
          ${textAr ? `<span dir="rtl" style="font-family:'Amiri',serif; color:var(--text-muted); margin-left:4px;">(${escapeHtml(textAr)})</span>` : ''}
        </div>
      `;
    }).join(' ');
  }

  // Graceful fallback without raw JSON dump
  if (!q.response) return '<span style="color:var(--text-muted); font-style:italic;">(None)</span>';
  if (typeof q.response === 'string') return `<span>${escapeHtml(q.response)}</span>`;
  if (typeof q.response === 'number' || typeof q.response === 'boolean') return `<span>${String(q.response)}</span>`;
  if (typeof q.response === 'object') {
    const vals = Object.values(q.response).filter(v => v !== null && v !== undefined);
    if (vals.length) return `<span>${vals.map(v => escapeHtml(typeof v === 'object' ? Object.values(v).join(', ') : String(v))).join('; ')}</span>`;
  }
  return '<span style="color:var(--text-muted); font-style:italic;">(None)</span>';
}

export function formatQuestionKey(q) {
  if (!q.key) return '';
  const isFill = q.format === 'fill';
  const isChoice = q.format === 'mcq' || q.format === 'tf';

  if (isFill) {
    const answers = Array.isArray(q.key.accepted_answers) ? q.key.accepted_answers : [];
    if (!answers.length) return '';
    return `
      <div style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">
        <span style="color:var(--emerald-dark); font-weight:600;">Accepted Answer(s):</span>
        ${answers.map(a => `<b style="color:var(--text-dark); margin-left:4px;">"${escapeHtml(a)}"</b>`).join(' or ')}
      </div>
    `;
  }

  if (isChoice) {
    const correctIds = Array.isArray(q.key.correct_option_ids) ? q.key.correct_option_ids : [];
    if (!correctIds.length) return '';
    const options = Array.isArray(q.options) ? q.options : [];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    return `
      <div style="font-size:0.8rem; color:var(--text-muted); margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
        <span style="color:var(--emerald-dark); font-weight:600;">Correct Answer:</span>
        ${correctIds.map(cId => {
          const idx = options.findIndex(o => (typeof o === 'object' ? o.id : o) === cId);
          const opt = idx !== -1 ? options[idx] : null;
          const letter = idx !== -1 && idx < letters.length ? letters[idx] : (idx !== -1 ? String(idx + 1) : '');
          const textEn = opt ? (typeof opt === 'object' ? (opt.text || opt.title || '') : String(opt)) : cId;
          const textAr = opt && typeof opt === 'object' ? (opt.text_ar || '') : '';
          return `
            <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(6,95,70,0.08); border:1px solid rgba(6,95,70,0.25); color:var(--emerald-dark); padding:2px 8px; border-radius:6px; font-weight:600;">
              <b>${letter ? letter + '.' : ''}</b> ${escapeHtml(textEn)} ${textAr ? `(${escapeHtml(textAr)})` : ''}
            </span>
          `;
        }).join(' ')}
      </div>
    `;
  }

  return '';
}

export function questionStatusBadge(q) {
  if (q.format === 'essay' && q.marked_by !== 'teacher' && (q.fraction === null || q.fraction === undefined)) {
    return '<span style="background:rgba(217,119,6,0.12); color:#b45309; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.75rem;">⏳ Pending Marking</span>';
  }
  if (q.fraction === 1 || q.fraction === 1.0) {
    return '<span style="background:rgba(6,95,70,0.12); color:var(--emerald-dark); padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.75rem;">✓ Correct</span>';
  }
  if (q.fraction === 0 || q.fraction === 0.0) {
    return '<span style="background:rgba(220,38,38,0.12); color:#dc2626; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.75rem;">✗ Incorrect</span>';
  }
  if (typeof q.fraction === 'number' && q.fraction > 0 && q.fraction < 1) {
    return `<span style="background:rgba(217,119,6,0.12); color:#b45309; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.75rem;">Partial (${Math.round(q.fraction * 100)}%)</span>`;
  }
  return '';
}

// Format security & tab events cleanly without awkward JSON or raw codes
export function formatSecurityEvent(ev) {
  const type = ev.type || ev.event_type || '';
  let label = type;
  let color = 'var(--text-dark)';
  let icon = 'ℹ️';

  if (type === 'left' || type === 'tab_left' || type === 'tab_switch' || type === 'visibility_hidden') {
    label = 'Left Exam Window / Switched Tab';
    color = '#dc2626';
    icon = '⚠️';
  } else if (type === 'returned' || type === 'tab_return' || type === 'visibility_visible') {
    label = 'Returned to Exam Window';
    color = '#059669';
    icon = '✓';
  } else if (type === 'fullscreen_exit') {
    label = 'Exited Fullscreen Mode';
    color = '#dc2626';
    icon = '⚠️';
  } else if (type === 'copy') {
    label = 'Copy Attempt Blocked';
    color = '#b45309';
    icon = '🛡️';
  } else if (type === 'paste') {
    label = 'Paste Attempt Blocked';
    color = '#b45309';
    icon = '🛡️';
  } else if (type === 'contextmenu') {
    label = 'Right-click Attempt Blocked';
    color = '#b45309';
    icon = '🛡️';
  } else {
    label = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  return `<span style="color:${color}; font-weight:600;">${icon} ${escapeHtml(label)}</span>`;
}
