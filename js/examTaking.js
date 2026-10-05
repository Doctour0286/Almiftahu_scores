// Student Exam Taking flow (PRD Phase 2, P5-P10).
// Verification (exam_check), instructions (P6), exam screen (P7) with timer & autosave,
// event logging, submission (exam_submit), and results (exam_get_result).

import { rpc, errorMessage } from './api.js';
import { currentCourse, state } from './state.js';
import { arHtml, escapeAttr, escapeHtml, setHint, showStatus } from './ui.js';

let currentSession = {
  enrollmentId: null,
  code: null,
  attemptToken: null,
  deadlineAt: null,
  serverOffsetMs: 0,
  paper: null,         // { sections: [...], answers: {}, flags: {} }
  currentSecIdx: 0,
  currentQIdx: 0,
  saveQueue: {},       // { [question_id]: { response, flagged } }
  saveTimer: null,
  timerInterval: null,
  isSubmitting: false,
};

export function renderStudentExamPortal(containerId = 'studentExamArea') {
  const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
  if (!container) return;

  // Restore attempt token from sessionStorage if present
  const storedToken = sessionStorage.getItem('mahad_attempt_token');
  if (storedToken && !currentSession.attemptToken) {
    currentSession.attemptToken = storedToken;
    resumeActiveExam(container);
    return;
  }

  if (currentSession.paper && currentSession.attemptToken) {
    renderExamScreen(container);
    return;
  }

  renderExamEntry(container);
}

// =============================================================================
// 1. SCREEN P5: EXAM ENTRY
// =============================================================================

function renderExamEntry(container) {
  const course = currentCourse();
  const rows = (state.rows || []).filter(r => r.active);

  container.innerHTML = `
    <div class="exam-entry-card" style="max-width:520px; margin:20px auto; background:var(--card-bg); border-radius:var(--radius); border:1.5px solid var(--border-color); padding:26px; box-shadow:0 8px 24px rgba(0,0,0,0.04);">
      <div style="text-align:center; margin-bottom:20px;">
        <span class="bismillah" style="font-size:1.3rem;">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
        <h3 style="color:var(--emerald-dark); margin:6px 0 2px; font-family:'Amiri',serif; font-size:1.6rem;">
          ${escapeHtml(course ? course.name : 'Course Examination')}
        </h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">Enter your student details and exam code to continue.</p>
      </div>

      <div class="draft-field" style="margin-bottom:14px;">
        <label>Select Your Name <span class="req">*</span></label>
        <select id="examStudentSelect" class="panel-select" style="width:100%;">
          <option value="">-- Choose your name --</option>
          ${rows.map(r => `
            <option value="${r.id}" ${currentSession.enrollmentId === r.id ? 'selected' : ''}>
              #${r.sn} - ${escapeHtml(r.name)} ${r.nameAr ? '(' + escapeHtml(r.nameAr) + ')' : ''}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="draft-field" style="margin-bottom:18px;">
        <label>Exam Code <span class="req">*</span></label>
        <input type="text" id="examCodeInput" placeholder="XXXX-XXXX" maxlength="12" style="letter-spacing:2px; font-family:monospace; font-size:1.1rem; text-align:center; text-transform:uppercase;" value="${escapeAttr(currentSession.code || '')}">
        <p style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">Obtained from your teacher. Format: 8 letters and numbers.</p>
      </div>

      <div style="text-align:center;">
        <button class="save-btn" id="examCheckBtn" style="width:100%; justify-content:center; padding:12px; font-size:0.95rem;">
          Continue &rarr;
        </button>
      </div>
      <div class="save-hint err" id="examEntryHint" style="margin-top:10px; text-align:center;"></div>
    </div>
  `;

  document.getElementById('examCheckBtn').addEventListener('click', () => handleExamCheck(container));
  document.getElementById('examCodeInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleExamCheck(container);
  });
}

async function handleExamCheck(container) {
  const enrSelect = document.getElementById('examStudentSelect');
  const codeInp = document.getElementById('examCodeInput');
  const hint = document.getElementById('examEntryHint');

  const enrId = enrSelect ? enrSelect.value : null;
  const rawCode = codeInp ? codeInp.value.trim() : '';

  if (!enrId) return setHint(hint, 'Please select your name from the list.', 'err');
  if (!rawCode) return setHint(hint, 'Please enter your exam code.', 'err');

  setHint(hint, 'Checking exam code…', '');
  const btn = document.getElementById('examCheckBtn');
  if (btn) btn.disabled = true;

  try {
    const res = await rpc('exam_check', { p_enrollment_id: enrId, p_code: rawCode });
    currentSession.enrollmentId = enrId;
    currentSession.code = rawCode;

    if (res.state === 'submitted' || res.state === 'finalized') {
      renderStudentResult(container, res);
      return;
    }

    renderExamInstructions(container, res.exam, res.state, res.remaining_seconds);
  } catch (e) {
    if (e.code === 'E_NO_LIVE_EXAM') {
      setHint(hint, "The exam isn't available yet.", 'err');
    } else if (e.code === 'E_NOT_ELIGIBLE') {
      setHint(hint, 'You are not yet eligible to sit this exam.', 'err');
    } else if (e.code === 'E_AUTH') {
      setHint(hint, 'Name or code is incorrect.', 'err');
    } else if (e.code === 'E_LOCKED') {
      setHint(hint, `Too many failed attempts. Try again in ${e.detail || 10} minutes.`, 'err');
    } else {
      setHint(hint, errorMessage(e), 'err');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// =============================================================================
// 2. SCREEN P6: INSTRUCTIONS
// =============================================================================

function renderExamInstructions(container, exam, stateMode, remainingSeconds) {
  const isResume = stateMode === 'in_progress';
  const duration = exam.duration_minutes || 60;

  container.innerHTML = `
    <div class="exam-instructions-card" style="max-width:620px; margin:20px auto; background:var(--card-bg); border-radius:var(--radius); border:1.5px solid var(--border-color); padding:28px; box-shadow:0 8px 24px rgba(0,0,0,0.04);">
      <div style="border-bottom:2px solid var(--gold-ochre); padding-bottom:14px; margin-bottom:18px;">
        <h3 style="color:var(--emerald-dark); margin:0 0 4px; font-family:'Amiri',serif; font-size:1.8rem;">
          ${escapeHtml(exam.title || 'Course Examination')} ${arHtml(exam.title_ar)}
        </h3>
        <div style="display:flex; gap:16px; font-size:0.85rem; color:var(--text-muted); flex-wrap:wrap; margin-top:8px;">
          <span>⏱️ Duration: <b>${duration} Minutes</b></span>
          <span>📋 Sections: <b>${exam.section_count || 1}</b></span>
          <span>❓ Questions: <b>${exam.question_count || 0}</b></span>
        </div>
      </div>

      ${exam.instructions ? `
        <div class="exam-instructions-text" style="background:var(--bg-warm); padding:14px; border-radius:8px; border:1px solid var(--border-color); margin-bottom:18px; font-size:0.88rem; line-height:1.5;">
          <b>Teacher Instructions:</b><br>${escapeHtml(exam.instructions)}
          ${exam.instructions_ar ? `<div dir="auto" style="margin-top:6px; font-family:'Amiri',serif;">${escapeHtml(exam.instructions_ar)}</div>` : ''}
        </div>
      ` : ''}

      <div style="margin-bottom:20px;">
        <h5 style="color:var(--text-dark); margin:0 0 8px; font-size:0.92rem;">Important Rules:</h5>
        <ol style="font-size:0.82rem; color:var(--text-muted); line-height:1.6; padding-left:18px; margin:0;">
          <li>You have one attempt. The timer starts when you press Start and cannot be paused.</li>
          <li>Your answers save automatically. If you lose connection, keep going: they sync when back online.</li>
          <li>If time runs out, your exam is submitted automatically.</li>
          <li>Do not share the exam or your code with anyone.</li>
          <li>The teacher can see when the exam page is left or reopened.</li>
        </ol>
      </div>

      ${isResume ? `
        <div class="status-banner" style="margin-bottom:16px;">
          You have an exam in progress. Remaining time: <b>${Math.ceil((remainingSeconds || 0) / 60)} minutes</b>.
        </div>
      ` : ''}

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <button class="ghost-btn" id="instrBackBtn">&larr; Back</button>
        <button class="save-btn" id="startExamBtn" style="padding:12px 24px; font-size:1rem;">
          ${isResume ? 'Resume Exam &rarr;' : 'Start Exam Now &rarr;'}
        </button>
      </div>
      <div class="save-hint err" id="startExamHint" style="margin-top:10px; text-align:center;"></div>
    </div>
  `;

  document.getElementById('instrBackBtn').addEventListener('click', () => {
    renderExamEntry(container);
  });

  document.getElementById('startExamBtn').addEventListener('click', async () => {
    const hint = document.getElementById('startExamHint');
    const btn = document.getElementById('startExamBtn');
    btn.disabled = true;
    setHint(hint, 'Starting exam session…', '');

    try {
      const res = await rpc('exam_start', {
        p_enrollment_id: currentSession.enrollmentId,
        p_code: currentSession.code,
      });

      currentSession.attemptToken = res.attempt_token;
      currentSession.deadlineAt = new Date(res.deadline_at).getTime();
      const serverTime = new Date(res.server_now).getTime();
      currentSession.serverOffsetMs = serverTime - Date.now();
      sessionStorage.setItem('mahad_attempt_token', res.attempt_token);

      // Load paper
      const paper = await rpc('exam_get_paper', { p_attempt_token: res.attempt_token });
      currentSession.paper = paper;

      renderExamScreen(container);
    } catch (e) {
      setHint(hint, errorMessage(e), 'err');
      btn.disabled = false;
    }
  });
}

// =============================================================================
// 3. SCREEN P7: EXAM SCREEN
// =============================================================================

function renderExamScreen(container) {
  const paper = currentSession.paper;
  if (!paper) return;

  const sections = paper.sections || [];
  const sec = sections[currentSession.currentSecIdx] || sections[0];
  const questions = (sec && sec.questions) || [];
  const q = questions[currentSession.currentQIdx] || questions[0];

  container.innerHTML = `
    <div class="student-exam-wrap">
      <!-- Sticky Exam Header: Timer, Autosave State, Submit -->
      <div class="student-exam-header">
        <div style="display:flex; align-items:center; gap:12px;">
          <div id="examCountdownTimer" class="exam-timer-chip">--:--</div>
          <span id="studentAutosaveIndicator" class="student-save-status">● Saved ✓</span>
        </div>
        <div>
          <button class="save-btn sm" id="submitExamTopBtn" style="background:var(--emerald-light);">Submit Exam</button>
        </div>
      </div>

      <!-- Section Tabs Navigation -->
      <div class="exam-sec-nav">
        ${sections.map((s, idx) => `
          <button class="sec-nav-tab ${idx === currentSession.currentSecIdx ? 'active' : ''}" data-nav-sec="${idx}">
            ${escapeHtml(s.title || 'Section ' + String.fromCharCode(65 + idx))}
          </button>
        `).join('')}
      </div>

      <!-- Current Question Card -->
      <div class="exam-active-q-wrap" id="activeQuestionWrap">
        ${renderActiveQuestion(sec, q, currentSession.currentQIdx, questions.length)}
      </div>

      <!-- Bottom Bar: Prev / Next / Palette -->
      <div class="exam-bottom-bar">
        <div style="display:flex; gap:8px;">
          <button class="ghost-btn sm" id="qPrevBtn" ${currentSession.currentQIdx === 0 && currentSession.currentSecIdx === 0 ? 'disabled' : ''}>&larr; Prev</button>
          <button class="ghost-btn sm" id="qNextBtn">Next &rarr;</button>
        </div>
        <div class="palette-btn-wrap">
          <button class="ghost-btn sm" id="togglePaletteBtn">Question Palette ☰</button>
        </div>
      </div>

      <!-- Questions Palette Sheet -->
      <div id="examPaletteModal" class="modal-overlay">
        <div class="modal-content" style="max-width:480px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="margin:0; color:var(--emerald-dark);">Question Palette</h4>
            <button class="close-btn" id="closePaletteBtn">&times;</button>
          </div>
          <div class="palette-legend" style="display:flex; gap:12px; font-size:0.75rem; color:var(--text-muted); margin-bottom:12px;">
            <span><span class="pal-dot answered"></span> Answered</span>
            <span><span class="pal-dot"></span> Unanswered</span>
            <span><span class="pal-dot flagged"></span> Flagged ⚑</span>
          </div>
          <div class="palette-grid" style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px;">
            ${renderPaletteItems()}
          </div>
        </div>
      </div>
    </div>
  `;

  startCountdownTimer();
  wireVisibilityEventLogging();
  wireExamScreenEvents(container);
}

function renderActiveQuestion(sec, q, qIdx, totalQs) {
  if (!q) return '<div class="empty-state">No question found.</div>';

  const savedAnswer = currentSession.paper.answers[q.id];
  const isFlagged = !!currentSession.paper.flags[q.id];
  const format = sec.format;

  return `
    <div class="active-question-card" data-qid="${q.id}">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-weight:700; color:var(--emerald-dark); font-size:0.95rem;">
          Question ${qIdx + 1} of ${totalQs} &bull; <span style="font-weight:400; color:var(--text-muted);">${sec.format.toUpperCase()}</span>
        </span>
        <button class="ghost-btn sm ${isFlagged ? 'flagged-btn' : ''}" id="flagQuestionBtn">
          ${isFlagged ? '⚑ Flagged' : '⚐ Flag for review'}
        </button>
      </div>

      <div class="active-q-prompt" dir="auto" style="font-size:1.05rem; font-weight:600; line-height:1.6; margin-bottom:16px;">
        ${escapeHtml(q.prompt || '')}
      </div>

      <div class="active-q-controls">
        ${format === 'mcq' ? renderStudentMcq(q, savedAnswer) : ''}
        ${format === 'tf' ? renderStudentTf(q, savedAnswer) : ''}
        ${format === 'fill' ? renderStudentFill(q, savedAnswer) : ''}
        ${format === 'essay' ? renderStudentEssay(q, savedAnswer) : ''}
      </div>
    </div>
  `;
}

function renderStudentMcq(q, saved) {
  const selected = (saved && saved.selected) || [];
  const options = q.options || [];

  return `
    <div class="student-options-list">
      ${options.map(opt => {
        const checked = selected.includes(opt.id);
        return `
          <label class="student-opt-label ${checked ? 'selected' : ''}">
            <input type="checkbox" class="student-mcq-chk" value="${escapeAttr(opt.id)}" ${checked ? 'checked' : ''}>
            <span class="opt-id-tag">${opt.id}</span>
            <span dir="auto" style="flex:1;">${escapeHtml(opt.text || opt.id)}</span>
          </label>
        `;
      }).join('')}
    </div>
  `;
}

function renderStudentTf(q, saved) {
  const selected = (saved && saved.selected && saved.selected[0]) || '';
  return `
    <div class="student-options-list">
      <label class="student-opt-label ${selected === 'true' ? 'selected' : ''}">
        <input type="radio" name="student_tf_${q.id}" value="true" class="student-tf-radio" ${selected === 'true' ? 'checked' : ''}>
        <span>True &bull; صحيح</span>
      </label>
      <label class="student-opt-label ${selected === 'false' ? 'selected' : ''}">
        <input type="radio" name="student_tf_${q.id}" value="false" class="student-tf-radio" ${selected === 'false' ? 'checked' : ''}>
        <span>False &bull; خطأ</span>
      </label>
    </div>
  `;
}

function renderStudentFill(q, saved) {
  const text = (saved && saved.text) || '';
  return `
    <div>
      <input type="text" class="student-fill-input" dir="auto" maxlength="500" value="${escapeAttr(text)}" placeholder="Type your answer here...">
    </div>
  `;
}

function renderStudentEssay(q, saved) {
  const text = (saved && saved.text) || '';
  return `
    <div>
      <textarea class="student-essay-textarea" dir="auto" rows="6" maxlength="20000" placeholder="Type your essay answer here...">${escapeHtml(text)}</textarea>
      <div style="font-size:0.75rem; color:var(--text-muted); text-align:right; margin-top:4px;">
        <span id="essayCharCount">${text.length}</span> / 20,000 characters
      </div>
    </div>
  `;
}

function renderPaletteItems() {
  const sections = currentSession.paper?.sections || [];
  let html = '';
  let overallIdx = 1;

  sections.forEach((sec, sIdx) => {
    (sec.questions || []).forEach((q, qIdx) => {
      const isAnswered = currentSession.paper.answers[q.id] !== undefined;
      const isFlagged = !!currentSession.paper.flags[q.id];
      const isCurrent = sIdx === currentSession.currentSecIdx && qIdx === currentSession.currentQIdx;

      html += `
        <button class="palette-cell ${isAnswered ? 'answered' : ''} ${isFlagged ? 'flagged' : ''} ${isCurrent ? 'current' : ''}" data-goto-sec="${sIdx}" data-goto-q="${qIdx}">
          ${overallIdx}
        </button>
      `;
      overallIdx++;
    });
  });

  return html;
}

function wireExamScreenEvents(container) {
  // Navigation tabs
  container.querySelectorAll('[data-nav-sec]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSession.currentSecIdx = Number(btn.dataset.navSec);
      currentSession.currentQIdx = 0;
      renderExamScreen(container);
    });
  });

  // Prev / Next
  const prevBtn = document.getElementById('qPrevBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentSession.currentQIdx > 0) {
        currentSession.currentQIdx--;
      } else if (currentSession.currentSecIdx > 0) {
        currentSession.currentSecIdx--;
        const prevSec = currentSession.paper.sections[currentSession.currentSecIdx];
        currentSession.currentQIdx = (prevSec.questions || []).length - 1;
      }
      renderExamScreen(container);
    });
  }

  const nextBtn = document.getElementById('qNextBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const sec = currentSession.paper.sections[currentSession.currentSecIdx];
      if (currentSession.currentQIdx < (sec.questions || []).length - 1) {
        currentSession.currentQIdx++;
      } else if (currentSession.currentSecIdx < currentSession.paper.sections.length - 1) {
        currentSession.currentSecIdx++;
        currentSession.currentQIdx = 0;
      }
      renderExamScreen(container);
    });
  }

  // Palette modal
  const palBtn = document.getElementById('togglePaletteBtn');
  const palModal = document.getElementById('examPaletteModal');
  if (palBtn && palModal) {
    palBtn.addEventListener('click', () => { palModal.style.display = 'flex'; });
    document.getElementById('closePaletteBtn').addEventListener('click', () => { palModal.style.display = 'none'; });
    palModal.querySelectorAll('[data-goto-sec]').forEach(b => {
      b.addEventListener('click', () => {
        currentSession.currentSecIdx = Number(b.dataset.gotoSec);
        currentSession.currentQIdx = Number(b.dataset.gotoQ);
        palModal.style.display = 'none';
        renderExamScreen(container);
      });
    });
  }

  // Flag toggle
  const flagBtn = document.getElementById('flagQuestionBtn');
  if (flagBtn) {
    flagBtn.addEventListener('click', () => {
      const qWrap = document.querySelector('.active-question-card');
      const qid = qWrap?.dataset.qid;
      if (!qid) return;
      currentSession.paper.flags[qid] = !currentSession.paper.flags[qid];
      queueAnswerSave(qid, currentSession.paper.answers[qid], currentSession.paper.flags[qid]);
      renderExamScreen(container);
    });
  }

  // Answer inputs
  const activeCard = document.querySelector('.active-question-card');
  const qid = activeCard?.dataset.qid;

  // MCQ
  container.querySelectorAll('.student-mcq-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      const selected = [...container.querySelectorAll('.student-mcq-chk:checked')].map(c => c.value);
      const resp = { selected };
      currentSession.paper.answers[qid] = resp;
      queueAnswerSave(qid, resp, currentSession.paper.flags[qid]);
    });
  });

  // TF
  container.querySelectorAll('.student-tf-radio').forEach(r => {
    r.addEventListener('change', () => {
      const resp = { selected: [r.value] };
      currentSession.paper.answers[qid] = resp;
      queueAnswerSave(qid, resp, currentSession.paper.flags[qid]);
    });
  });

  // Fill
  const fillInp = container.querySelector('.student-fill-input');
  if (fillInp) {
    fillInp.addEventListener('input', () => {
      const resp = { text: fillInp.value };
      currentSession.paper.answers[qid] = resp;
      queueAnswerSave(qid, resp, currentSession.paper.flags[qid]);
    });
  }

  // Essay
  const essayInp = container.querySelector('.student-essay-textarea');
  if (essayInp) {
    essayInp.addEventListener('input', () => {
      const resp = { text: essayInp.value };
      currentSession.paper.answers[qid] = resp;
      const cnt = document.getElementById('essayCharCount');
      if (cnt) cnt.textContent = essayInp.value.length;
      queueAnswerSave(qid, resp, currentSession.paper.flags[qid]);
    });
  }

  // Submit button
  const submitBtn = document.getElementById('submitExamTopBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      openSubmitConfirmModal(container);
    });
  }
}

// Queue autosave batch with 2s debounce
function queueAnswerSave(qid, response, flagged) {
  currentSession.saveQueue[qid] = { question_id: qid, response, flagged };
  const ind = document.getElementById('studentAutosaveIndicator');
  if (ind) ind.innerHTML = '<span style="color:var(--gold-ochre);">● Saving…</span>';

  clearTimeout(currentSession.saveTimer);
  currentSession.saveTimer = setTimeout(() => {
    flushAnswerSaves();
  }, 2000);
}

async function flushAnswerSaves() {
  const items = Object.values(currentSession.saveQueue);
  if (items.length === 0 || !currentSession.attemptToken) return;

  try {
    await rpc('exam_save_answers', {
      p_attempt_token: currentSession.attemptToken,
      p_answers: items,
    });
    currentSession.saveQueue = {};
    const ind = document.getElementById('studentAutosaveIndicator');
    if (ind) ind.innerHTML = '<span style="color:var(--emerald-light);">● Saved ✓</span>';
  } catch (e) {
    const ind = document.getElementById('studentAutosaveIndicator');
    if (ind) ind.innerHTML = '<span style="color:var(--danger);">● Offline (answers kept locally)</span>';
  }
}

// Countdown timer with amber/red warnings
function startCountdownTimer() {
  clearInterval(currentSession.timerInterval);
  updateTimerDisplay();

  currentSession.timerInterval = setInterval(() => {
    const now = Date.now() + currentSession.serverOffsetMs;
    const remaining = Math.max(0, Math.floor((currentSession.deadlineAt - now) / 1000));
    updateTimerDisplay(remaining);

    if (remaining <= 0) {
      clearInterval(currentSession.timerInterval);
      handleAutoSubmitOnTimeUp();
    }
  }, 1000);
}

function updateTimerDisplay(secondsLeft = null) {
  const el = document.getElementById('examCountdownTimer');
  if (!el) return;

  if (secondsLeft === null) {
    const now = Date.now() + currentSession.serverOffsetMs;
    secondsLeft = Math.max(0, Math.floor((currentSession.deadlineAt - now) / 1000));
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  el.textContent = str;

  if (secondsLeft <= 60) {
    el.className = 'exam-timer-chip red';
  } else if (secondsLeft <= 300) {
    el.className = 'exam-timer-chip amber';
  } else {
    el.className = 'exam-timer-chip';
  }
}

function wireVisibilityEventLogging() {
  document.addEventListener('visibilitychange', () => {
    if (!currentSession.attemptToken) return;
    const type = document.hidden ? 'left' : 'returned';
    rpc('exam_log_event', {
      p_attempt_token: currentSession.attemptToken,
      p_type: type,
    }).catch(() => {});
  });
}

// Submit confirmation modal (P8)
function openSubmitConfirmModal(container) {
  let modal = document.getElementById('submitConfirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'submitConfirmModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const sections = currentSession.paper?.sections || [];
  let totalQs = 0;
  let answeredCount = 0;
  let flaggedCount = 0;

  sections.forEach(s => {
    (s.questions || []).forEach(q => {
      totalQs++;
      if (currentSession.paper.answers[q.id]) answeredCount++;
      if (currentSession.paper.flags[q.id]) flaggedCount++;
    });
  });

  const unanswered = totalQs - answeredCount;

  modal.innerHTML = `
    <div class="modal-content" style="max-width:440px; text-align:center;">
      <h3 style="color:var(--emerald-dark); margin:0 0 8px;">Submit Examination?</h3>
      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:16px;">
        Once submitted, your answers will be graded and you cannot make further changes.
      </p>

      <div style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:8px; padding:14px; margin-bottom:18px;">
        <div style="display:flex; justify-content:space-around;">
          <div>
            <div style="font-size:1.4rem; font-weight:700; color:var(--emerald-dark);">${answeredCount}/${totalQs}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Answered</div>
          </div>
          ${unanswered > 0 ? `
            <div>
              <div style="font-size:1.4rem; font-weight:700; color:var(--danger);">${unanswered}</div>
              <div style="font-size:0.75rem; color:var(--danger);">Unanswered</div>
            </div>
          ` : ''}
          ${flaggedCount > 0 ? `
            <div>
              <div style="font-size:1.4rem; font-weight:700; color:var(--gold-ochre);">${flaggedCount}</div>
              <div style="font-size:0.75rem; color:var(--gold-ochre);">Flagged ⚑</div>
            </div>
          ` : ''}
        </div>
      </div>

      <div style="display:flex; justify-content:center; gap:10px;">
        <button class="ghost-btn" id="cancelSubmitBtn">Keep Reviewing</button>
        <button class="save-btn" id="confirmSubmitBtn" style="background:var(--emerald-dark);">Confirm & Submit</button>
      </div>
      <div class="save-hint err" id="submitModalHint" style="margin-top:8px;"></div>
    </div>
  `;

  modal.style.display = 'flex';
  document.getElementById('cancelSubmitBtn').addEventListener('click', () => { modal.style.display = 'none'; });

  document.getElementById('confirmSubmitBtn').addEventListener('click', async () => {
    const hint = document.getElementById('submitModalHint');
    const btn = document.getElementById('confirmSubmitBtn');
    btn.disabled = true;
    setHint(hint, 'Submitting exam…', '');

    try {
      await flushAnswerSaves();
      const res = await rpc('exam_submit', { p_attempt_token: currentSession.attemptToken });
      clearInterval(currentSession.timerInterval);
      sessionStorage.removeItem('mahad_attempt_token');
      modal.style.display = 'none';

      renderStudentResult(container, res);
    } catch (e) {
      setHint(hint, errorMessage(e), 'err');
      btn.disabled = false;
    }
  });
}

async function handleAutoSubmitOnTimeUp() {
  if (currentSession.isSubmitting) return;
  currentSession.isSubmitting = true;

  try {
    await flushAnswerSaves();
    const res = await rpc('exam_submit', { p_attempt_token: currentSession.attemptToken });
    sessionStorage.removeItem('mahad_attempt_token');
    showStatus('Time is up! Your exam has been submitted automatically.', false);
    const container = document.getElementById('studentExamArea') || document.querySelector('.container');
    if (container) renderStudentResult(container, res);
  } catch (e) {
    showStatus('Time up: exam closed.', true);
  }
}

// Results view (P9 / P10)
function renderStudentResult(container, res) {
  container.innerHTML = `
    <div class="student-result-card" style="max-width:540px; margin:20px auto; background:var(--card-bg); border-radius:var(--radius); border:1.5px solid var(--border-color); padding:28px; text-align:center;">
      <span style="font-size:2.5rem;">🎉</span>
      <h3 style="color:var(--emerald-dark); margin:8px 0 4px;">Examination Submitted!</h3>
      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:20px;">
        Your submission has been safely recorded on the server.
      </p>

      ${res.pending_marking ? `
        <div class="status-banner" style="margin-bottom:20px; text-align:left;">
          <b>Pending Manual Marking:</b> Some questions (such as essays) require manual evaluation by your teacher.
          Your final combined score and grade band will appear on the leaderboard once marking is complete.
        </div>
      ` : `
        <div class="score-summary-box" style="margin-bottom:20px;">
          <div class="total-lbl">Exam Status</div>
          <div class="total-val" style="font-size:1.6rem; color:var(--emerald-dark); margin:6px 0;">Finalized</div>
          <p style="font-size:0.8rem; color:var(--gold-ochre); margin:0;">Check the Directory or Leaderboard for your updated standing.</p>
        </div>
      `}

      <button class="save-btn" id="finishExamBtn" style="margin:0 auto;">Return to Score Portal</button>
    </div>
  `;

  document.getElementById('finishExamBtn').addEventListener('click', () => {
    currentSession = {
      enrollmentId: null, code: null, attemptToken: null, deadlineAt: null,
      serverOffsetMs: 0, paper: null, currentSecIdx: 0, currentQIdx: 0,
      saveQueue: {}, saveTimer: null, timerInterval: null, isSubmitting: false,
    };
    try { sessionStorage.removeItem('mahad_attempt_token'); } catch (_) {}
    renderExamEntry(container);
  });
}

async function resumeActiveExam(container) {
  try {
    const token = currentSession.attemptToken;
    const paper = await rpc('exam_get_paper', { p_attempt_token: token });
    currentSession.paper = paper;
    currentSession.deadlineAt = new Date(paper.deadline_at).getTime();
    currentSession.serverOffsetMs = new Date(paper.server_now).getTime() - Date.now();
    renderExamScreen(container);
  } catch (e) {
    sessionStorage.removeItem('mahad_attempt_token');
    currentSession.attemptToken = null;
    renderExamEntry(container);
  }
}