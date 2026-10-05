// Results sub-tab (PRD Phase 3, Task 3.4):
// Results table, attempt detail inspector (with tab leaves and time away), and safe CSV export (AC-3.7).

import { rpc, errorMessage } from './api.js';
import { openByStudentMarking } from './marking.js';
import { currentCourse } from './state.js';
import { arHtml, escapeAttr, escapeHtml, fmtNum, setHint, showStatus } from './ui.js';

let resultsState = {
  courseId: null,
  rows: [],
  filterText: '',
  loading: false,
};

export async function renderResultsTab(containerId = 'resultsArea') {
  const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
  if (!container) return;

  const course = currentCourse();
  if (!course) {
    container.innerHTML = '<div class="empty-state">Select a course to view exam results.</div>';
    return;
  }

  container.innerHTML = '<div class="empty-state"><span class="spinner"></span> Loading exam results…</div>';
  resultsState.courseId = course.id;
  resultsState.loading = true;

  try {
    const list = await rpc('admin_results', { p_course_id: course.id });
    resultsState.rows = Array.isArray(list) ? list : [];
    renderResultsView(container);
  } catch (e) {
    container.innerHTML = `<div class="empty-state err">Failed to load exam results: ${escapeHtml(errorMessage(e))}</div>`;
  } finally {
    resultsState.loading = false;
  }
}

function renderResultsView(container) {
  const course = currentCourse();
  const rows = resultsState.rows;
  const filter = (resultsState.filterText || '').toLowerCase().trim();

  const filtered = rows.filter(r =>
    (r.student_name || '').toLowerCase().includes(filter) ||
    (r.student_name_ar || '').includes(filter) ||
    String(r.sn).includes(filter)
  );

  const total = rows.length;
  const finalized = rows.filter(r => r.status === 'finalized').length;
  const pending = rows.filter(r => r.status === 'submitted').length;
  const inProgress = rows.filter(r => r.status === 'in_progress').length;

  container.innerHTML = `
    <div class="results-tab-wrap">
      <!-- Summary metrics -->
      <div style="display:flex; gap:12px; margin-bottom:18px; flex-wrap:wrap;">
        <div style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:8px; padding:10px 14px; flex:1; min-width:140px;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Total Attempts</div>
          <div style="font-size:1.3rem; font-weight:700; color:var(--text-dark);">${total}</div>
        </div>
        <div style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:8px; padding:10px 14px; flex:1; min-width:140px;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Finalized</div>
          <div style="font-size:1.3rem; font-weight:700; color:var(--emerald-dark);">${finalized}</div>
        </div>
        <div style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:8px; padding:10px 14px; flex:1; min-width:140px;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Pending Marking</div>
          <div style="font-size:1.3rem; font-weight:700; color:${pending > 0 ? 'var(--gold-ochre)' : 'var(--text-muted)'};">${pending}</div>
        </div>
        <div style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:8px; padding:10px 14px; flex:1; min-width:140px;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">In Progress</div>
          <div style="font-size:1.3rem; font-weight:700; color:${inProgress > 0 ? '#3b82f6' : 'var(--text-muted)'};">${inProgress}</div>
        </div>
      </div>

      <!-- Controls: search & CSV download -->
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px; flex-wrap:wrap;">
        <input type="text" id="resultsSearchInput" placeholder="Filter by student name or S/N…"
          value="${escapeAttr(resultsState.filterText)}"
          style="flex:1; min-width:220px; padding:8px 12px; border:1.5px solid var(--border-color); border-radius:6px; background:var(--bg-warm); color:var(--text-dark);">

        <button class="save-btn sm" id="exportCsvBtn" style="display:inline-flex; align-items:center; gap:6px;">
          <svg class="icon sm" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV (Excel &amp; Sheets)
        </button>
      </div>

      <!-- Results Table -->
      ${filtered.length === 0 ? `
        <div class="empty-state">${rows.length === 0 ? 'No exam attempts recorded yet.' : 'No matching exam attempts.'}</div>
      ` : `
        <div class="table-wrapper" style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px; overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
            <thead>
              <tr style="background:var(--bg-warm); border-bottom:1px solid var(--border-color); text-align:left;">
                <th style="padding:10px 12px; width:50px;">S/N</th>
                <th style="padding:10px 12px;">Student Name</th>
                <th style="padding:10px 12px; width:90px;">Status</th>
                <th style="padding:10px 12px; width:70px; text-align:right;">Exam %</th>
                <th style="padding:10px 12px; width:70px; text-align:right;">Final</th>
                <th style="padding:10px 12px; width:110px;">Band</th>
                <th style="padding:10px 12px; width:70px; text-align:center;">Leaves</th>
                <th style="padding:10px 12px; width:80px; text-align:right;">Time Away</th>
                <th style="padding:10px 12px; width:130px; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(r => {
                const statusColor = r.status === 'finalized' ? 'var(--emerald-dark)' : (r.status === 'submitted' ? 'var(--gold-ochre)' : '#3b82f6');
                const timeAway = r.time_away_seconds ? `${Math.floor(r.time_away_seconds / 60)}m ${r.time_away_seconds % 60}s` : '0s';
                return `
                  <tr style="border-bottom:1px solid var(--border-color);">
                    <td style="padding:10px 12px; color:var(--text-muted); font-weight:600;">${r.sn}</td>
                    <td style="padding:10px 12px; font-weight:600;">
                      ${escapeHtml(r.student_name)}
                      ${r.student_name_ar ? `<span dir="rtl" style="font-family:'Amiri',serif; margin-left:6px; color:var(--text-muted);">(${escapeHtml(r.student_name_ar)})</span>` : ''}
                    </td>
                    <td style="padding:10px 12px;">
                      <span style="font-size:0.75rem; font-weight:600; color:${statusColor}; text-transform:uppercase;">
                        ${escapeHtml(r.status || 'none')}
                      </span>
                    </td>
                    <td style="padding:10px 12px; text-align:right; font-weight:600;">
                      ${r.exam_pct !== null && r.exam_pct !== undefined ? fmtNum(r.exam_pct) + '%' : '-'}
                    </td>
                    <td style="padding:10px 12px; text-align:right; font-weight:700; color:var(--emerald-dark);">
                      ${r.final !== null && r.final !== undefined ? fmtNum(r.final) : '-'}
                    </td>
                    <td style="padding:10px 12px;">
                      ${r.band_label ? `<span class="band-tag" style="font-size:0.75rem;">${escapeHtml(r.band_label)}</span>` : '-'}
                    </td>
                    <td style="padding:10px 12px; text-align:center; color:${(r.tab_leaves || 0) > 0 ? '#b45309' : 'var(--text-muted)'};">
                      ${r.tab_leaves || 0}
                    </td>
                    <td style="padding:10px 12px; text-align:right; color:var(--text-muted); font-size:0.8rem;">
                      ${timeAway}
                    </td>
                    <td style="padding:10px 12px; text-align:right;">
                      <button class="ghost-btn sm" data-inspect-attempt="${escapeAttr(r.attempt_id)}">
                        Detail
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
      <div id="attemptDetailModalWrap"></div>
    </div>
  `;

  // Filter input listener
  const filterInput = document.getElementById('resultsSearchInput');
  if (filterInput) {
    filterInput.addEventListener('input', (e) => {
      resultsState.filterText = e.target.value;
      renderResultsView(container);
      const reInp = document.getElementById('resultsSearchInput');
      if (reInp) {
        reInp.focus();
        reInp.selectionStart = reInp.selectionEnd = reInp.value.length;
      }
    });
  }

  // Export CSV button
  document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
    downloadResultsCsv(course, rows);
  });

  // Inspect detail buttons
  container.querySelectorAll('[data-inspect-attempt]').forEach(btn => {
    btn.addEventListener('click', () => {
      openAttemptDetailModal(btn.dataset.inspectAttempt);
    });
  });
}

// =============================================================================
// SAFE CSV EXPORT (AC-3.7)
// =============================================================================

export function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '';
  let s = String(val);
  // Formula injection defense: neutralize any cell starting with =, +, -, @, \t, \r
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  // Escape quotes if comma, newline or quotes exist
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function downloadResultsCsv(course, rows) {
  const headers = [
    'S/N', 'Student Name', 'Arabic Name', 'Status', 'Exam %', 'Final Score',
    'Grade Band', 'Arabic Grade Band', 'Passed', 'Tab Leaves', 'Time Away (s)',
    'Started At', 'Submitted At', 'Finalized At',
  ];

  const csvRows = [headers.map(sanitizeCsvCell).join(',')];

  rows.forEach(r => {
    csvRows.push([
      r.sn,
      r.student_name,
      r.student_name_ar || '',
      r.status,
      r.exam_pct !== null && r.exam_pct !== undefined ? r.exam_pct : '',
      r.final !== null && r.final !== undefined ? r.final : '',
      r.band_label || '',
      r.band_label_ar || '',
      r.passed === true ? 'Yes' : (r.passed === false ? 'No' : ''),
      r.tab_leaves || 0,
      r.time_away_seconds || 0,
      r.started_at || '',
      r.submitted_at || '',
      r.finalized_at || '',
    ].map(sanitizeCsvCell).join(','));
  });

  // Prepend UTF-8 BOM (\uFEFF) for Arabic compatibility in Excel/Sheets
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const courseCode = (course.code || 'course').toLowerCase().replace(/[^a-z0-9]/g, '_');
  a.download = `results_${courseCode}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =============================================================================
// ATTEMPT DETAIL MODAL
// =============================================================================

async function openAttemptDetailModal(attemptId) {
  const wrap = document.getElementById('attemptDetailModalWrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="modal-overlay" style="display:flex;">
      <div class="modal-content" style="max-width:800px; max-height:90vh; overflow-y:auto; padding:24px;">
        <span class="spinner"></span> Loading attempt inspection…
      </div>
    </div>
  `;

  try {
    const detail = await rpc('admin_attempt_detail', { p_attempt_id: attemptId });
    renderAttemptDetailModal(wrap, detail);
  } catch (e) {
    wrap.innerHTML = `
      <div class="modal-overlay" style="display:flex;">
        <div class="modal-content" style="max-width:500px; padding:24px; text-align:center;">
          <h4 style="color:#b91c1c;">Inspection Failed</h4>
          <p style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(errorMessage(e))}</p>
          <button class="ghost-btn" id="closeErrModalBtn">Close</button>
        </div>
      </div>
    `;
    document.getElementById('closeErrModalBtn')?.addEventListener('click', () => { wrap.innerHTML = ''; });
  }
}

function renderAttemptDetailModal(wrap, detail) {
  const att = detail.attempt || {};
  const sections = detail.sections || [];
  const events = detail.events || [];

  wrap.innerHTML = `
    <div class="modal-overlay" style="display:flex;" id="detailModalOverlay">
      <div class="modal-content" style="max-width:840px; max-height:90vh; overflow-y:auto; padding:26px;">
        <button class="close-btn" id="detailModalCloseBtn">&times;</button>

        <div style="border-bottom:1.5px solid var(--border-color); padding-bottom:14px; margin-bottom:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="margin:0 0 4px; color:var(--emerald-dark); font-size:1.3rem;">
                ${escapeHtml(att.student_name)} ${att.student_name_ar ? `<span dir="rtl" style="font-family:'Amiri',serif;">(${escapeHtml(att.student_name_ar)})</span>` : ''}
              </h3>
              <div style="font-size:0.82rem; color:var(--text-muted);">
                S/N: <b>${att.sn}</b> • Attempt: <span style="font-family:monospace;">${att.id}</span>
              </div>
            </div>
            <div style="text-align:right;">
              <span class="status-chip" style="background:${att.status === 'finalized' ? '#d1fae5' : '#fef3c7'}; color:${att.status === 'finalized' ? '#065f46' : '#92400e'}; padding:4px 10px; border-radius:12px; font-weight:600; font-size:0.8rem;">
                ${escapeHtml((att.status || '').toUpperCase())}
              </span>
            </div>
          </div>
        </div>

        <!-- Security & Timing Metrics -->
        <div style="display:flex; gap:12px; background:var(--bg-warm); border:1px solid var(--border-color); border-radius:8px; padding:12px 16px; margin-bottom:20px; flex-wrap:wrap; font-size:0.82rem;">
          <div style="flex:1; min-width:120px;">
            <div style="color:var(--text-muted);">Started At</div>
            <b>${att.started_at ? new Date(att.started_at).toLocaleTimeString() : '-'}</b>
          </div>
          <div style="flex:1; min-width:120px;">
            <div style="color:var(--text-muted);">Submitted At</div>
            <b>${att.submitted_at ? new Date(att.submitted_at).toLocaleTimeString() : '-'}</b>
          </div>
          <div style="flex:1; min-width:100px;">
            <div style="color:var(--text-muted);">Tab Leaves</div>
            <b style="color:${(att.tab_leaves || 0) > 0 ? '#b45309' : 'inherit'};">${att.tab_leaves || 0} times</b>
          </div>
          <div style="flex:1; min-width:120px;">
            <div style="color:var(--text-muted);">Time Away</div>
            <b style="color:${(att.time_away_seconds || 0) > 0 ? '#b45309' : 'inherit'};">${att.time_away_seconds || 0} seconds</b>
          </div>
        </div>

        <!-- Section by section questions inspection & scoring -->
        ${sections.map((sec, sIdx) => `
          <div style="margin-bottom:20px; border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
            <div style="background:var(--bg-warm); padding:10px 14px; font-weight:700; color:var(--emerald-dark); font-size:0.9rem; border-bottom:1px solid var(--border-color);">
              ${escapeHtml(sec.title)} (${sec.format.toUpperCase()} • Weight: ${sec.weight}%)
            </div>
            <div style="padding:14px;">
              ${(sec.questions || []).map((q, qIdx) => {
                const isEssay = sec.format === 'essay';
                const pts = q.points !== null && q.points !== undefined ? q.points : (q.fraction !== null ? Math.round(q.fraction * q.value * 100) / 100 : null);
                return `
                  <div class="modal-q-item" style="border-bottom:1px solid var(--border-color); padding-bottom:14px; margin-bottom:14px;" data-detail-qid="${escapeAttr(q.id)}">
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">
                      <span>Q${qIdx + 1} (${sec.format.toUpperCase()})</span>
                      <span>Max: <b>${q.value} pts</b></span>
                    </div>
                    <div dir="auto" style="font-weight:600; font-size:0.92rem; margin-bottom:8px;">
                      ${escapeHtml(q.prompt)}
                    </div>

                    <!-- Student response -->
                    <div style="background:var(--bg-warm); border-radius:6px; padding:8px 12px; margin-bottom:8px; font-size:0.85rem;">
                      <span style="color:var(--text-muted); font-size:0.75rem;">Student Response:</span>
                      <div dir="auto" style="margin-top:2px; font-weight:600;">
                        ${isEssay ? escapeHtml((q.response && q.response.text) || '(Empty)') : `<code>${escapeHtml(JSON.stringify(q.response || {}))}</code>`}
                      </div>
                    </div>

                    <!-- Correct key if auto -->
                    ${q.key ? `
                      <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px;">
                        Answer Key: <code>${escapeHtml(JSON.stringify(q.key))}</code>
                      </div>
                    ` : ''}

                    <!-- Points editor (allows marking and overrides FR-M6) -->
                    <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; margin-top:8px;">
                      <div style="width:120px;">
                        <label style="display:block; font-size:0.75rem; font-weight:600; margin-bottom:2px;">Points (0-${q.value})</label>
                        <input type="number" class="modal-pts-inp" min="0" max="${q.value}" step="0.25"
                          value="${pts !== null ? pts : ''}"
                          style="width:100%; box-sizing:border-box; padding:5px 8px; border:1px solid var(--border-color); border-radius:6px; font-size:0.9rem; font-weight:600;">
                      </div>
                      <div style="flex:1; min-width:180px;">
                        <label style="display:block; font-size:0.75rem; font-weight:600; margin-bottom:2px;">Teacher Comment</label>
                        <input type="text" class="modal-cmt-inp"
                          value="${escapeAttr(q.comment || '')}"
                          placeholder="Feedback…"
                          style="width:100%; box-sizing:border-box; padding:5px 8px; border:1px solid var(--border-color); border-radius:6px; font-size:0.82rem;">
                      </div>
                      <button class="save-btn sm modal-q-save-btn" data-qid="${escapeAttr(q.id)}" data-max="${q.value}">
                        ${q.marked_by === 'teacher' ? 'Update Mark' : (isEssay ? 'Mark Essay' : 'Override Mark')}
                      </button>
                    </div>
                    <div class="save-hint modal-q-hint" style="margin-top:4px;"></div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}

        <!-- Security Events log -->
        ${events.length > 0 ? `
          <div style="margin-top:20px;">
            <h5 style="margin:0 0 8px; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase;">Security &amp; Visibility Events</h5>
            <div style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:6px; max-height:160px; overflow-y:auto; padding:8px 12px; font-size:0.78rem; font-family:monospace;">
              ${events.map(ev => `
                <div style="border-bottom:1px solid var(--border-color); padding:4px 0; display:flex; justify-content:space-between;">
                  <span>${escapeHtml(ev.event_type)}: ${escapeHtml(JSON.stringify(ev.payload || {}))}</span>
                  <span style="color:var(--text-muted);">${new Date(ev.created_at).toLocaleTimeString()}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div style="margin-top:20px; text-align:right;">
          <button class="ghost-btn" id="detailModalCloseBtnBottom">Close</button>
        </div>
      </div>
    </div>
  `;

  const close = () => { wrap.innerHTML = ''; };
  document.getElementById('detailModalCloseBtn')?.addEventListener('click', close);
  document.getElementById('detailModalCloseBtnBottom')?.addEventListener('click', close);
  document.getElementById('detailModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'detailModalOverlay') close();
  });

  // Wire per-question save buttons in modal
  wrap.querySelectorAll('.modal-q-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const qid = btn.dataset.qid;
      const maxVal = parseFloat(btn.dataset.max);
      const card = btn.closest('.modal-q-item');
      const ptsInp = card.querySelector('.modal-pts-inp');
      const cmtInp = card.querySelector('.modal-cmt-inp');
      const hint = card.querySelector('.modal-q-hint');

      const pts = parseFloat(ptsInp.value);
      if (isNaN(pts) || pts < 0 || pts > maxVal) {
        return setHint(hint, `Points must be between 0 and ${maxVal}.`, 'err');
      }

      btn.disabled = true;
      setHint(hint, 'Saving mark…', '');
      try {
        await rpc('admin_mark_answer', {
          p_attempt_id: att.id,
          p_question_id: qid,
          p_points: pts,
          p_comment: cmtInp ? cmtInp.value : '',
        });
        setHint(hint, 'Saved ✓', 'ok');
        // Refresh underlying results tab
        renderResultsTab();
      } catch (e) {
        setHint(hint, errorMessage(e), 'err');
      } finally {
        btn.disabled = false;
      }
    });
  });
}
