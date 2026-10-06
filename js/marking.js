// Marking sub-tab (PRD Phase 3, Tasks 3.1 & 3.3):
// Overview (T11), Essay by question (T12), Essay by student (T13), Fill review (T14), and Mark override (FR-M6).

import { rpc, errorMessage } from './api.js';
import { currentCourse } from './state.js';
import { arHtml, escapeAttr, escapeHtml, setHint, showStatus, formatQuestionResponse, formatQuestionKey, questionStatusBadge } from './ui.js';

let markingState = {
  view: 'overview',        // 'overview' | 'by_question' | 'by_student' | 'fill_review'
  overview: null,
  activeQuestion: null,    // question object for by-question view
  activeQuestionAnswers: [],
  activeQuestionIdx: 0,
  activeAttemptDetail: null, // detail object for by-student view
  activeFillReview: null,
  loading: false,
};

export async function renderMarkingTab(containerId = 'markingArea') {
  const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
  if (!container) return;

  const course = currentCourse();
  if (!course) {
    container.innerHTML = '<div class="empty-state">Select a course to view exam marking.</div>';
    return;
  }

  if (markingState.view === 'by_question') {
    renderByQuestionView(container);
    return;
  }
  if (markingState.view === 'by_student') {
    renderByStudentView(container);
    return;
  }
  if (markingState.view === 'fill_review') {
    renderFillReviewView(container);
    return;
  }

  // Default: Overview
  await loadAndRenderOverview(container);
}

// =============================================================================
// 1. OVERVIEW VIEW (T11)
// =============================================================================

async function loadAndRenderOverview(container) {
  const course = currentCourse();
  container.innerHTML = '<div class="empty-state"><span class="spinner"></span> Loading marking queue…</div>';

  try {
    const data = await rpc('admin_marking_overview', { p_course_id: course.id });
    markingState.overview = data;
    renderOverview(container, data);
  } catch (e) {
    container.innerHTML = `<div class="empty-state err">Failed to load marking overview: ${escapeHtml(errorMessage(e))}</div>`;
  }
}

function renderOverview(container, data) {
  const essays = data.essays || [];
  const fills = data.fills || [];

  const totalPendingEssays = essays.reduce((sum, e) => sum + (e.pending_count || 0), 0);
  const totalUnmatchedFills = fills.reduce((sum, f) => sum + (f.unmatched_count || 0), 0);

  // Update badge in manage tab accordion if element exists
  const badge = document.getElementById('markingBadge');
  if (badge) {
    const totalPending = totalPendingEssays + totalUnmatchedFills;
    badge.textContent = totalPending > 0 ? `(${totalPending} pending)` : '';
    badge.style.color = totalPending > 0 ? 'var(--gold-ochre)' : 'var(--text-muted)';
  }

  if (essays.length === 0 && fills.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No active exam attempts requiring marking or review for this course.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="marking-overview-wrap">
      <div class="marking-stats-bar" style="display:flex; gap:14px; margin-bottom:20px; flex-wrap:wrap;">
        <div class="stat-pill" style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:8px; padding:10px 16px; flex:1; min-width:180px;">
          <div style="font-size:0.78rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Pending Essays</div>
          <div style="font-size:1.4rem; font-weight:700; color:${totalPendingEssays > 0 ? 'var(--gold-ochre)' : 'var(--emerald-dark)'};">${totalPendingEssays}</div>
        </div>
        <div class="stat-pill" style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:8px; padding:10px 16px; flex:1; min-width:180px;">
          <div style="font-size:0.78rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Unmatched Fill-ins</div>
          <div style="font-size:1.4rem; font-weight:700; color:${totalUnmatchedFills > 0 ? '#b45309' : 'var(--emerald-dark)'};">${totalUnmatchedFills}</div>
        </div>
      </div>

      <!-- Essay Queue -->
      <div class="marking-section" style="margin-bottom:24px;">
        <h4 style="margin:0 0 10px; font-size:1rem; color:var(--emerald-dark);">
          Essay Questions (Manual Marking)
        </h4>
        ${essays.length === 0 ? '<p style="font-size:0.85rem; color:var(--text-muted);">No essay questions in this exam.</p>' : `
          <div class="marking-queue-list">
            ${essays.map(q => {
              const pending = q.pending_count || 0;
              const submitted = q.submitted_count || 0;
              const marked = q.marked_count || 0;
              return `
                <div class="marking-q-card" style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px; padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                  <div style="flex:1; min-width:240px;">
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">
                      ${escapeHtml(q.section_title || 'Essay Section')} • Max: <b>${q.value} pts</b>
                    </div>
                    <div dir="auto" style="font-weight:600; font-size:0.92rem; color:var(--text-dark); margin-bottom:6px;">
                      ${escapeHtml(q.prompt)}
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">
                      Progress: <b>${marked} / ${submitted}</b> marked
                      ${pending > 0 ? `<span style="display:inline-block; background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:0.75rem; margin-left:8px; font-weight:600;">${pending} awaiting marking</span>` : '<span style="display:inline-block; background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:12px; font-size:0.75rem; margin-left:8px; font-weight:600;">All marked ✓</span>'}
                    </div>
                  </div>
                  <div>
                    <button class="save-btn sm" data-mark-q="${escapeAttr(q.id)}">
                      ${pending > 0 ? 'Mark Essays &rarr;' : 'Review Marks'}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Fill-in Review -->
      <div class="marking-section">
        <h4 style="margin:0 0 10px; font-size:1rem; color:var(--emerald-dark);">
          Fill-in-the-Blank Review
        </h4>
        ${fills.length === 0 ? '<p style="font-size:0.85rem; color:var(--text-muted);">No fill-in questions with student responses.</p>' : `
          <div class="marking-queue-list">
            ${fills.map(q => {
              const unmatched = q.unmatched_count || 0;
              return `
                <div class="marking-q-card" style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px; padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                  <div style="flex:1; min-width:240px;">
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">
                      ${escapeHtml(q.section_title || 'Fill Section')} • Max: <b>${q.value} pts</b>
                    </div>
                    <div dir="auto" style="font-weight:600; font-size:0.92rem; color:var(--text-dark); margin-bottom:6px;">
                      ${escapeHtml(q.prompt)}
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">
                      ${unmatched > 0 ? `<span style="color:#b45309; font-weight:600;">${unmatched} distinct unmatched answers submitted</span>` : '<span style="color:var(--emerald-dark); font-weight:600;">No unmatched answers</span>'}
                    </div>
                  </div>
                  <div>
                    <button class="ghost-btn sm" data-review-fill="${escapeAttr(q.id)}">
                      Review Answers &rarr;
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  // Wire buttons
  container.querySelectorAll('[data-mark-q]').forEach(btn => {
    btn.addEventListener('click', () => {
      openByQuestionMarking(container, btn.dataset.markQ);
    });
  });

  container.querySelectorAll('[data-review-fill]').forEach(btn => {
    btn.addEventListener('click', () => {
      openFillReview(container, btn.dataset.reviewFill);
    });
  });
}

// =============================================================================
// 2. BY-QUESTION ESSAY MARKING VIEW (T12)
// =============================================================================

async function openByQuestionMarking(container, questionId) {
  markingState.loading = true;
  container.innerHTML = '<div class="empty-state"><span class="spinner"></span> Loading essay answers…</div>';

  try {
    const res = await rpc('admin_essay_answers', { p_question_id: questionId });
    markingState.activeQuestion = res.question;
    markingState.activeQuestionAnswers = res.answers || [];
    markingState.activeQuestionIdx = 0;

    // Find first pending answer
    const firstPendingIdx = markingState.activeQuestionAnswers.findIndex(a => a.fraction === null);
    if (firstPendingIdx !== -1) markingState.activeQuestionIdx = firstPendingIdx;

    markingState.view = 'by_question';
    renderByQuestionView(container);
  } catch (e) {
    showStatus('Failed to load essay answers: ' + errorMessage(e), true);
    markingState.view = 'overview';
    renderMarkingTab(container);
  } finally {
    markingState.loading = false;
  }
}

function renderByQuestionView(container) {
  const q = markingState.activeQuestion;
  const answers = markingState.activeQuestionAnswers;
  const currentIdx = markingState.activeQuestionIdx;
  const ans = answers[currentIdx];

  const total = answers.length;
  const markedCount = answers.filter(a => a.fraction !== null).length;

  container.innerHTML = `
    <div class="marking-by-q-wrap" style="max-width:700px; margin:0 auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <button class="ghost-btn sm" id="backToOverviewBtn">&larr; Back to Queue</button>
        <span style="font-size:0.82rem; color:var(--text-muted);">
          Marked: <b>${markedCount} / ${total}</b>
        </span>
      </div>

      <!-- Question Card -->
      <div class="marking-q-header" style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;">
          <span>${escapeHtml(q.section_title || 'Essay')}</span>
          <span>Max Score: <b>${q.value} pts</b></span>
        </div>
        <div dir="auto" style="font-weight:600; font-size:1.05rem; line-height:1.4; color:var(--emerald-dark);">
          ${escapeHtml(q.prompt)}
        </div>
        ${q.note ? `<div dir="auto" style="margin-top:6px; font-size:0.82rem; color:var(--text-muted); font-style:italic;">Note: ${escapeHtml(q.note)}</div>` : ''}
      </div>

      ${!ans ? `
        <div class="empty-state">No submissions found for this question.</div>
      ` : `
        <!-- Answer Box -->
        <div class="student-answer-card" style="background:var(--card-bg); border:1.5px solid var(--border-color); border-radius:8px; padding:20px; margin-bottom:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:10px; margin-bottom:14px;">
            <div>
              <span style="font-weight:700; color:var(--text-dark);">${escapeHtml(ans.student_name)}</span>
              ${ans.student_name_ar ? `<span dir="rtl" style="font-family:'Amiri',serif; margin-left:6px; color:var(--text-muted);">(${escapeHtml(ans.student_name_ar)})</span>` : ''}
              <span style="font-size:0.78rem; color:var(--text-muted); margin-left:8px;">S/N: ${ans.sn}</span>
            </div>
            <div style="font-size:0.78rem;">
              Answer <b>${currentIdx + 1}</b> of <b>${total}</b>
            </div>
          </div>

          <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:6px;">Student Response:</div>
          <div dir="auto" style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:6px; padding:14px; font-size:1rem; line-height:1.6; white-space:pre-wrap; min-height:80px; margin-bottom:18px;">
            ${escapeHtml(ans.text || '(No text submitted)')}
          </div>

          <!-- Scoring Form -->
          <div class="scoring-form" style="background:var(--card-bg); border-top:1px solid var(--border-color); padding-top:16px;">
            <div style="display:flex; gap:16px; align-items:flex-end; flex-wrap:wrap; margin-bottom:14px;">
              <div style="flex:0 0 160px;">
                <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px; color:var(--text-dark);">
                  Points (0 - ${q.value})
                </label>
                <input type="number" id="essayPointsInput" min="0" max="${q.value}" step="0.25"
                  value="${ans.points !== null && ans.points !== undefined ? ans.points : ''}"
                  placeholder="0 - ${q.value}"
                  style="width:100%; box-sizing:border-box; padding:8px 10px; border:1.5px solid var(--border-color); border-radius:6px; font-size:1.1rem; font-weight:700;">
              </div>
              <div style="flex:1; min-width:200px;">
                <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px; color:var(--text-dark);">
                  Teacher Comment (Optional)
                </label>
                <input type="text" id="essayCommentInput"
                  value="${escapeAttr(ans.comment || '')}"
                  placeholder="Feedback for the student…"
                  style="width:100%; box-sizing:border-box; padding:8px 10px; border:1.5px solid var(--border-color); border-radius:6px; font-size:0.88rem;">
              </div>
            </div>

            ${ans.fraction !== null ? `
              <div style="font-size:0.78rem; color:var(--emerald-dark); margin-bottom:10px;">
                Currently marked: <b>${ans.points} / ${q.value} pts</b> (${Math.round(ans.fraction * 100)}%) by ${escapeHtml(ans.marked_by || 'teacher')}
              </div>
            ` : ''}

            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; gap:8px;">
                <button class="save-btn" id="saveAndNextBtn">Save &amp; Next &rarr;</button>
                <button class="ghost-btn" id="saveOnlyBtn">Save</button>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="ghost-btn sm" id="prevAnswerBtn"${currentIdx === 0 ? ' disabled' : ''}>&larr; Prev</button>
                <button class="ghost-btn sm" id="nextAnswerBtn"${currentIdx === total - 1 ? ' disabled' : ''}>Next &rarr;</button>
              </div>
            </div>
            <div class="save-hint" id="essayMarkHint" style="margin-top:8px;"></div>
          </div>
        </div>
      `}
    </div>
  `;

  // Wire buttons
  document.getElementById('backToOverviewBtn')?.addEventListener('click', () => {
    markingState.view = 'overview';
    renderMarkingTab(container);
  });

  document.getElementById('prevAnswerBtn')?.addEventListener('click', () => {
    if (markingState.activeQuestionIdx > 0) {
      markingState.activeQuestionIdx--;
      renderByQuestionView(container);
    }
  });

  document.getElementById('nextAnswerBtn')?.addEventListener('click', () => {
    if (markingState.activeQuestionIdx < answers.length - 1) {
      markingState.activeQuestionIdx++;
      renderByQuestionView(container);
    }
  });

  document.getElementById('saveOnlyBtn')?.addEventListener('click', () => {
    saveEssayMark(container, false);
  });

  document.getElementById('saveAndNextBtn')?.addEventListener('click', () => {
    saveEssayMark(container, true);
  });
}

async function saveEssayMark(container, goNext) {
  const ans = markingState.activeQuestionAnswers[markingState.activeQuestionIdx];
  const q = markingState.activeQuestion;
  const ptsInp = document.getElementById('essayPointsInput');
  const commentInp = document.getElementById('essayCommentInput');
  const hint = document.getElementById('essayMarkHint');

  const pts = parseFloat(ptsInp.value);
  if (isNaN(pts) || pts < 0 || pts > q.value) {
    return setHint(hint, `Points must be between 0 and ${q.value}.`, 'err');
  }

  setHint(hint, 'Saving mark…', '');
  try {
    const res = await rpc('admin_mark_answer', {
      p_attempt_id: ans.attempt_id,
      p_question_id: q.id,
      p_points: pts,
      p_comment: commentInp ? commentInp.value : '',
    });

    ans.fraction = res.fraction;
    ans.points = res.points;
    ans.comment = commentInp ? commentInp.value : '';
    ans.marked_by = 'teacher';

    setHint(hint, 'Saved ✓', 'ok');
    if (goNext && markingState.activeQuestionIdx < markingState.activeQuestionAnswers.length - 1) {
      markingState.activeQuestionIdx++;
      renderByQuestionView(container);
    } else {
      setTimeout(() => renderByQuestionView(container), 400);
    }
  } catch (e) {
    setHint(hint, errorMessage(e), 'err');
  }
}

// =============================================================================
// 3. BY-STUDENT MARKING VIEW (T13 / FR-M3)
// =============================================================================

export async function openByStudentMarking(container, attemptId) {
  markingState.loading = true;
  container.innerHTML = '<div class="empty-state"><span class="spinner"></span> Loading attempt details…</div>';

  try {
    const res = await rpc('admin_attempt_detail', { p_attempt_id: attemptId });
    markingState.activeAttemptDetail = res;
    markingState.view = 'by_student';
    renderByStudentView(container);
  } catch (e) {
    showStatus('Failed to load attempt: ' + errorMessage(e), true);
    markingState.view = 'overview';
    renderMarkingTab(container);
  } finally {
    markingState.loading = false;
  }
}

function renderByStudentView(container) {
  const detail = markingState.activeAttemptDetail;
  if (!detail || !detail.attempt) {
    container.innerHTML = '<div class="empty-state">No attempt loaded.</div>';
    return;
  }

  const att = detail.attempt;
  const sections = detail.sections || [];

  container.innerHTML = `
    <div class="marking-by-student-wrap" style="max-width:760px; margin:0 auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <button class="ghost-btn sm" id="studentBackToOverviewBtn">&larr; Back to Marking Queue</button>
        <span class="status-chip" style="background:${att.status === 'finalized' ? '#d1fae5' : '#fef3c7'}; color:${att.status === 'finalized' ? '#065f46' : '#92400e'}; padding:4px 10px; border-radius:12px; font-weight:600; font-size:0.78rem;">
          ${escapeHtml(att.status.toUpperCase())}
        </span>
      </div>

      <!-- Student Header -->
      <div class="attempt-student-header" style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="margin:0 0 4px; color:var(--emerald-dark); font-size:1.25rem;">
              ${escapeHtml(att.student_name)} ${att.student_name_ar ? `<span dir="rtl" style="font-family:'Amiri',serif;">(${escapeHtml(att.student_name_ar)})</span>` : ''}
            </h3>
            <div style="font-size:0.82rem; color:var(--text-muted);">
              Student S/N: <b>${att.sn}</b>
            </div>
          </div>
          <div style="font-size:0.82rem; color:var(--text-muted); text-align:right;">
            <div>Tab Leaves: <b>${att.tab_leaves || 0}</b></div>
            <div>Time Away: <b>${att.time_away_seconds || 0}s</b></div>
          </div>
        </div>
      </div>

      <!-- Sections & Questions -->
      ${sections.map((sec, secIdx) => `
        <div class="marking-sec-block" style="margin-bottom:24px;">
          <div style="background:var(--card-bg); border-left:4px solid var(--emerald-dark); border-bottom:1px solid var(--border-color); padding:10px 14px; margin-bottom:12px; font-weight:700; color:var(--emerald-dark);">
            ${escapeHtml(sec.title)} (${sec.format.toUpperCase()} • Weight: ${sec.weight}%)
          </div>

          <div class="marking-sec-questions">
            ${(sec.questions || []).map((q, qIdx) => {
              const ansText = q.response && q.response.text !== undefined ? q.response.text : '';
              const isEssay = sec.format === 'essay';
              return `
                <div class="student-q-item" style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:14px;" data-q-id="${escapeAttr(q.id)}">
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; color:var(--text-muted); margin-bottom:6px;">
                    <span>Question ${qIdx + 1} (${sec.format.toUpperCase()})</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                      ${questionStatusBadge(q)}
                      <span>Max Value: <b>${q.value != null ? q.value : (q.max_points || 0)} pts</b></span>
                    </div>
                  </div>

                  <div dir="auto" style="font-weight:600; font-size:0.95rem; margin-bottom:10px; color:var(--text-dark);">
                    ${escapeHtml(q.prompt)}
                  </div>

                  <!-- Student Answer Display (human-readable) -->
                  <div style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:6px; padding:10px 12px; margin-bottom:10px;">
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px; font-weight:600;">Student Response:</div>
                    <div>
                      ${formatQuestionResponse(q)}
                    </div>
                  </div>

                  <!-- Correct key if auto -->
                  ${q.key ? formatQuestionKey(q) : ""}

                  <!-- Mark Input -->
                  <div style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; border-top:1px solid var(--border-color); padding-top:10px;">
                    <div style="flex:0 0 130px;">
                      <label style="display:block; font-size:0.78rem; font-weight:600; margin-bottom:2px;">Points (0-${q.value})</label>
                      <input type="number" class="st-pts-inp" min="0" max="${q.value}" step="0.25"
                        value="${q.points !== null && q.points !== undefined ? q.points : ''}"
                        placeholder="0 - ${q.value}"
                        style="width:100%; box-sizing:border-box; padding:6px 8px; border:1px solid var(--border-color); border-radius:6px; font-weight:600;">
                    </div>
                    <div style="flex:1; min-width:180px;">
                      <label style="display:block; font-size:0.78rem; font-weight:600; margin-bottom:2px;">Teacher Comment</label>
                      <input type="text" class="st-cmt-inp"
                        value="${escapeAttr(q.comment || '')}"
                        placeholder="Feedback…"
                        style="width:100%; box-sizing:border-box; padding:6px 8px; border:1px solid var(--border-color); border-radius:6px; font-size:0.85rem;">
                    </div>
                    <div>
                      <button class="save-btn sm st-save-btn" data-qid="${escapeAttr(q.id)}" data-max="${q.value}">
                        Save Mark
                      </button>
                    </div>
                  </div>
                  <div class="save-hint st-q-hint" style="margin-top:6px;"></div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('studentBackToOverviewBtn')?.addEventListener('click', () => {
    markingState.view = 'overview';
    renderMarkingTab(container);
  });

  // Wire per-question save buttons
  container.querySelectorAll('.st-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const qid = btn.dataset.qid;
      const maxVal = parseFloat(btn.dataset.max);
      const card = btn.closest('.student-q-item');
      const ptsInp = card.querySelector('.st-pts-inp');
      const cmtInp = card.querySelector('.st-cmt-inp');
      const hint = card.querySelector('.st-q-hint');

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
      } catch (e) {
        setHint(hint, errorMessage(e), 'err');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// =============================================================================
// 4. FILL-IN-THE-BLANK REVIEW (T14)
// =============================================================================

async function openFillReview(container, questionId) {
  markingState.loading = true;
  container.innerHTML = '<div class="empty-state"><span class="spinner"></span> Loading fill answers…</div>';

  try {
    const res = await rpc('admin_fill_review', { p_question_id: questionId });
    markingState.activeFillReview = res;
    markingState.view = 'fill_review';
    renderFillReviewView(container);
  } catch (e) {
    showStatus('Failed to load fill review: ' + errorMessage(e), true);
    markingState.view = 'overview';
    renderMarkingTab(container);
  } finally {
    markingState.loading = false;
  }
}

function renderFillReviewView(container) {
  const data = markingState.activeFillReview;
  const unmatched = data.unmatched || [];
  const accepted = data.accepted_answers || [];

  container.innerHTML = `
    <div class="fill-review-wrap" style="max-width:700px; margin:0 auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <button class="ghost-btn sm" id="fillBackOverviewBtn">&larr; Back to Queue</button>
        <span style="font-size:0.82rem; color:var(--text-muted);">
          Unmatched: <b>${unmatched.length}</b> distinct
        </span>
      </div>

      <!-- Question Prompt Card -->
      <div style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:18px;">
        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Fill-in-the-Blank Question</div>
        <div dir="auto" style="font-weight:600; font-size:1rem; color:var(--emerald-dark); margin-bottom:8px;">
          ${escapeHtml(data.prompt)}
        </div>
        <div style="font-size:0.82rem; color:var(--text-muted);">
          Currently Accepted Answers:
          <span style="color:var(--emerald-dark); font-weight:600;">
            ${accepted.map(a => `"${escapeHtml(a)}"`).join(', ') || 'None'}
          </span>
        </div>
      </div>

      <!-- Unmatched List -->
      ${unmatched.length === 0 ? `
        <div class="empty-state">
          No unmatched answers submitted for this question. All answers either matched or were left blank.
        </div>
      ` : `
        <div class="unmatched-list" style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
          <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
            <thead>
              <tr style="background:var(--bg-warm); border-bottom:1px solid var(--border-color); text-align:left;">
                <th style="padding:10px 14px;">Student Text</th>
                <th style="padding:10px 14px; width:100px; text-align:center;">Count</th>
                <th style="padding:10px 14px; width:130px; text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${unmatched.map(item => `
                <tr style="border-bottom:1px solid var(--border-color);">
                  <td dir="auto" style="padding:10px 14px; font-weight:600;">
                    ${escapeHtml(item.text)}
                  </td>
                  <td style="padding:10px 14px; text-align:center; color:var(--text-muted);">
                    ${item.count}
                  </td>
                  <td style="padding:10px 14px; text-align:right;">
                    <button class="save-btn sm" data-accept-text="${escapeAttr(item.text)}">
                      + Accept &amp; Re-grade
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
      <div class="save-hint" id="fillReviewHint" style="margin-top:12px;"></div>
    </div>
  `;

  document.getElementById('fillBackOverviewBtn')?.addEventListener('click', () => {
    markingState.view = 'overview';
    renderMarkingTab(container);
  });

  container.querySelectorAll('[data-accept-text]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.acceptText;
      const hint = document.getElementById('fillReviewHint');
      btn.disabled = true;
      setHint(hint, `Accepting "${text}" and re-grading attempts…`, '');
      try {
        await rpc('admin_accept_fill_answer', {
          p_question_id: data.question_id,
          p_text: text,
        });
        setHint(hint, `Accepted "${text}" and re-graded attempts ✓`, 'ok');
        setTimeout(() => openFillReview(container, data.question_id), 600);
      } catch (e) {
        setHint(hint, errorMessage(e), 'err');
        btn.disabled = false;
      }
    });
  });
}
