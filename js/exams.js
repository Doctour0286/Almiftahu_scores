// Exams sub-tab (tasks 1.3-1.6): versions list, draft editor with autosave and revision conflicts (FR-X15/16),
// four question editors, preview as student (no attempt, nothing sent), publish dialog (FR-X12).
// Every call is an admin_* RPC from migration 011. The draft lives in `X.draft` (the §7.6 document, with keys).
import { rpc, errorMessage } from './api.js';
import { EXAM_AUTOSAVE_MS } from './config.js';
import {
  FORMATS, FORMAT_LABEL, MAX_OPTIONS, convertSection, docForSave, duplicateQuestion, flatQuestions, isMulti,
  move, newOption, newQuestion, newSection, parsePath, questionCount, questionValue, validateDoc, weightTotal,
} from './examModel.js';
import { reload } from './main.js';
import { currentCourse } from './state.js';
import { arHtml, confirmDialog, cssEscape, escapeAttr, escapeHtml, fmtNum } from './ui.js';

const X = {
  courseId: null, loaded: false, loading: false, unavailable: false, error: '', note: '',
  versions: [], draft: null, rev: 0,
  view: 'list',                     // list | draft | version | preview
  viewDoc: null, preview: null,
  dirty: false, seq: 0, saving: false, again: false, savePromise: null, saveState: 'saved', saveError: '', conflict: false,
  timer: null, retry: null, openQ: null,
};

const host = () => document.getElementById('manageExamsPane') || document.getElementById('examBuilderArea');
const $ = (id) => document.getElementById(id);
const dirAuto = 'dir="auto"';

// A missing 011 (production before the migration is applied) must not break the tab.
const backendMissing = (e) => e && e.code === 'E_SERVER' && /could not find the function|PGRST202|schema cache|does not exist/i.test(`${e.message} ${e.detail}`);

// ---------- lifecycle ----------
export function resetExamBuilder() {
  // Called on course switch and on lock. A pending edit is sent once (fire and forget) before it is dropped.
  if (X.dirty && X.draft && !X.conflict) saveNow();
  clearTimeout(X.timer); clearTimeout(X.retry);
  Object.assign(X, { courseId: null, loaded: false, loading: false, unavailable: false, error: '', note: '', versions: [], view: 'list', viewDoc: null, preview: null, openQ: null });
  if (!X.saving) { X.draft = null; X.dirty = false; X.saveState = 'saved'; X.conflict = false; }
}

export async function renderExamsPane() {
  const el = host(); if (!el) return;
  const course = currentCourse();
  if (!course) { el.innerHTML = '<div class="empty-state">No course selected.</div>'; return; }
  if (X.courseId !== course.id) { resetExamBuilder(); X.courseId = course.id; X.draft = null; X.dirty = false; X.conflict = false; X.saveState = 'saved'; }
  if (!X.loaded && !X.loading) { paint(); await loadExam(); return; }
  paint();
}

async function loadExam({ keepView = false } = {}) {
  const course = currentCourse(); if (!course) return;
  X.loading = true; X.error = '';
  paint();
  try {
    const res = await rpc('admin_get_exam', { p_course_id: course.id });
    if (X.courseId !== course.id) return;
    X.versions = res.versions || [];
    X.unavailable = false;
    if (res.draft && !(X.dirty && X.draft && X.draft.id === res.draft.id)) { X.draft = res.draft; X.rev = res.draft.draft_rev; X.dirty = false; X.conflict = false; X.saveState = 'saved'; }
    if (!res.draft) { X.draft = null; X.dirty = false; }
    if (!keepView) X.view = 'list';
    X.loaded = true;
  } catch (e) {
    if (backendMissing(e)) X.unavailable = true;
    else if (e.code !== 'E_AUTH') X.error = errorMessage(e);
    X.loaded = true;
  } finally { X.loading = false; paint(); }
}

// ---------- painting ----------
function paint() {
  const el = host(); if (!el) return;
  if (X.loading && !X.loaded) { el.innerHTML = '<div class="empty-state">Loading…</div>'; return; }
  if (X.unavailable) { el.innerHTML = '<div class="empty-state" id="examUnavailable">The exam builder is not available on this database yet. It will appear once the exam migrations (010 and 011) have been applied.</div>'; return; }
  if (X.error) { el.innerHTML = `<div class="status-banner error">${escapeHtml(X.error)}</div><button class="ghost-btn" id="examRetry" type="button">Try again</button>`; $('examRetry').addEventListener('click', () => { X.loaded = false; renderExamsPane(); }); return; }
  if (X.view === 'draft' && X.draft) paintEditor(el);
  else if (X.view === 'version' && X.viewDoc) paintVersion(el);
  else if (X.view === 'preview' && X.preview) paintPreview(el);
  else paintList(el);
}

const STATUS_LABEL = { draft: 'Draft', live: 'Live', retired: 'Retired' };
const fmtDate = (s) => { try { return s ? new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''; } catch (e) { return ''; } };

function paintList(el) {
  const course = currentCourse();
  const hasDraft = !!X.draft;
  const live = X.versions.find(v => v.status === 'live');
  el.innerHTML = `
    <div class="list-subhead">Exam: ${escapeHtml(course.name)}</div>
    ${X.note ? `<div class="status-banner" id="examNote">${escapeHtml(X.note)}</div>` : ''}
    <div class="exam-actions">
      ${hasDraft ? '<button class="save-btn" id="examContinue" type="button">Continue draft</button>'
        : `<button class="save-btn" id="examNewDraft" type="button">${live ? 'New draft from live version' : 'New draft'}</button>`}
      <span class="save-hint" id="examListHint"></span>
    </div>
    ${X.versions.length ? `<div class="entry-list" id="examVersions">${X.versions.map(v => `
      <div class="entry-row exam-version" data-version="${escapeAttr(v.id)}" data-status="${v.status}">
        <div class="entry-row-head">
          <div><div class="entry-row-name">Version ${v.no} <span class="status-chip ${v.status}">${STATUS_LABEL[v.status] || v.status}</span></div>
            <div class="entry-row-sn" ${dirAuto}>${escapeHtml(v.title || '(untitled)')}${v.published_at ? ' · published ' + escapeHtml(fmtDate(v.published_at)) : ''}</div></div>
          <div class="entry-footer-actions"><span class="entry-row-sn">${v.question_count} question${v.question_count === 1 ? '' : 's'}${v.duration_minutes ? ' · ' + v.duration_minutes + ' min' : ''}</span>
            <button class="ghost-btn" type="button" data-open-version="${escapeAttr(v.id)}" data-status="${v.status}">${v.status === 'draft' ? 'Edit' : 'View'}</button></div>
        </div>
      </div>`).join('')}</div>` : '<div class="empty-state">No exam yet. Create a draft to start writing one.</div>'}`;
  const nd = $('examNewDraft'); if (nd) nd.addEventListener('click', createDraft);
  const cd = $('examContinue'); if (cd) cd.addEventListener('click', () => { X.view = 'draft'; paint(); });
  el.querySelectorAll('[data-open-version]').forEach(b => b.addEventListener('click', () => openVersion(b.dataset.openVersion, b.dataset.status)));
}

async function createDraft() {
  const course = currentCourse(); const hint = $('examListHint');
  if (hint) hint.textContent = 'Creating…';
  try {
    X.draft = await rpc('admin_create_draft', { p_course_id: course.id });
    X.rev = X.draft.draft_rev; X.dirty = false; X.conflict = false; X.saveState = 'saved'; X.openQ = null; X.view = 'draft';
    await loadExam({ keepView: true });
  } catch (e) {
    if (hint) { hint.textContent = 'Could not create a draft: ' + errorMessage(e); hint.className = 'save-hint err'; }
    if (e.code === 'E_VALIDATION') await loadExam();
  }
}

async function openVersion(id, status) {
  if (status === 'draft' && X.draft && X.draft.id === id) { X.view = 'draft'; return paint(); }
  try {
    const doc = await rpc('admin_get_version', { p_version_id: id });
    if (doc.status === 'draft') { X.draft = doc; X.rev = doc.draft_rev; X.dirty = false; X.conflict = false; X.view = 'draft'; }
    else { X.viewDoc = doc; X.view = 'version'; }
    paint();
  } catch (e) { const h = $('examListHint'); if (h) { h.textContent = errorMessage(e); h.className = 'save-hint err'; } }
}

// ---------- editor ----------
function secHtml(s, si) {
  
  return `
  <div class="exam-section" id="sec-${si}" data-s="${si}">
    <div class="exam-section-head">
      <span class="exam-section-no">Section ${si + 1}</span>
      <span class="exam-tools">
        <button class="ghost-btn" type="button" data-act="sec-up" data-s="${si}" title="Move up" aria-label="Move section up">&uarr;</button>
        <button class="ghost-btn" type="button" data-act="sec-down" data-s="${si}" title="Move down" aria-label="Move section down">&darr;</button>
        <button class="danger-btn" type="button" data-act="sec-del" data-s="${si}">Delete</button>
      </span>
    </div>
    <div class="field-row"><label for="st-${si}">Title</label><input type="text" id="st-${si}" data-f="s.title" data-s="${si}" value="${escapeAttr(s.title || '')}" ${dirAuto}></div>
    <div class="field-row"><label for="sta-${si}">Title (Arabic)</label><input type="text" id="sta-${si}" data-f="s.title_ar" data-s="${si}" value="${escapeAttr(s.title_ar || '')}" dir="auto"></div>
    <div class="field-row"><label for="sf-${si}">Format</label>
      <select id="sf-${si}" data-f="s.format" data-s="${si}">${FORMATS.map(f => `<option value="${f}"${s.format === f ? ' selected' : ''}>${FORMAT_LABEL[f]}</option>`).join('')}</select></div>
    <div class="field-row"><label for="sw-${si}">Weight (% of exam)</label><input type="number" id="sw-${si}" data-f="s.weight" data-s="${si}" min="0" max="100" step="any" value="${escapeAttr(s.weight ?? 0)}">
      <span class="save-hint" id="sval-${si}">${valueText(s)}</span></div>
    <div class="exam-questions" id="sq-${si}">${s.questions.map((q, qi) => qRowHtml(s, q, si, qi)).join('')}</div>
    <button class="ghost-btn" type="button" data-act="q-add" data-s="${si}">+ Add ${FORMAT_LABEL[s.format].toLowerCase()} question</button>
  </div>`;
}
const valueText = (s) => s.questions.length ? `each question = ${fmtNum(questionValue(s))} pts` : 'no questions yet';
const snippet = (q) => { const t = String(q.prompt || '').replace(/\s+/g, ' ').trim(); return t ? (t.length > 70 ? t.slice(0, 70) + '…' : t) : '(empty question)'; };

function qRowHtml(s, q, si, qi) {
  const open = X.openQ === q.id;
  return `
  <div class="exam-q${open ? ' open' : ''}" id="q-${escapeAttr(q.id)}" data-s="${si}" data-q="${qi}">
    <div class="exam-q-head">
      <button class="exam-q-toggle" type="button" data-act="q-toggle" data-s="${si}" data-q="${qi}" aria-expanded="${open}"><b>${qi + 1}.</b> <span class="q-snippet" ${dirAuto}>${escapeHtml(snippet(q))}</span></button>
      <span class="exam-tools">
        <button class="ghost-btn" type="button" data-act="q-up" data-s="${si}" data-q="${qi}" title="Move up" aria-label="Move question up">&uarr;</button>
        <button class="ghost-btn" type="button" data-act="q-down" data-s="${si}" data-q="${qi}" title="Move down" aria-label="Move question down">&darr;</button>
        <button class="ghost-btn" type="button" data-act="q-dup" data-s="${si}" data-q="${qi}">Duplicate</button>
        <button class="danger-btn" type="button" data-act="q-del" data-s="${si}" data-q="${qi}">Delete</button>
      </span>
    </div>
    ${open ? `<div class="exam-q-body">${qEditorHtml(s, q, si, qi)}</div>` : ''}
  </div>`;
}

function qEditorHtml(s, q, si, qi) {
  const at = `data-s="${si}" data-q="${qi}"`;
  const prompt = `<div class="field-row"><label for="qp-${si}-${qi}">Question</label><textarea id="qp-${si}-${qi}" rows="3" data-f="q.prompt" ${at} ${dirAuto}>${escapeHtml(q.prompt || '')}</textarea></div>`;
  if (s.format === 'mcq') {
    const correct = new Set(q.key.correct_option_ids);
    return prompt + `<div class="exam-opts" id="qo-${si}-${qi}">${q.options.map((o, oi) => `
      <div class="exam-opt" data-o="${oi}">
        <input type="checkbox" data-f="q.correct" ${at} data-o="${oi}" ${correct.has(o.id) ? 'checked' : ''} aria-label="Option ${oi + 1} is correct" title="Correct answer">
        <input type="text" data-f="q.opt" ${at} data-o="${oi}" value="${escapeAttr(o.text || '')}" placeholder="Option ${oi + 1}" ${dirAuto}>
        <button class="ghost-btn" type="button" data-act="o-del" ${at} data-o="${oi}" aria-label="Remove option ${oi + 1}">&times;</button>
      </div>`).join('')}</div>
      <div class="field-row"><button class="ghost-btn" type="button" data-act="o-add" ${at} ${q.options.length >= MAX_OPTIONS ? 'disabled' : ''}>+ Add option</button>
      <span class="save-hint" id="qmulti-${si}-${qi}">${isMulti(q) ? 'Several correct answers: students must select all that apply.' : 'Tick the box beside each correct option.'}</span></div>`;
  }
  if (s.format === 'tf') {
    const c = q.key.correct_option_ids[0];
    return prompt + `<div class="field-row" role="radiogroup" aria-label="Correct answer">${['true', 'false'].map(v => `
      <label class="exam-radio"><input type="radio" name="tf-${si}-${qi}" data-f="q.tf" ${at} value="${v}" ${c === v ? 'checked' : ''}> ${v === 'true' ? 'True' : 'False'} is correct</label>`).join('')}</div>`;
  }
  if (s.format === 'fill') {
    return prompt + `<div class="field-row"><label for="qa-${si}-${qi}">Accepted answers<br><small>one per line</small></label><textarea id="qa-${si}-${qi}" rows="3" data-f="q.accepted" ${at} dir="auto">${escapeHtml((q.key.accepted_answers || []).join('\n'))}</textarea></div>
      <div class="field-row"><label class="exam-radio"><input type="checkbox" data-f="q.tm" ${at} ${q.key.tm_equiv ? 'checked' : ''}> Treat ة and ه as equal</label></div>
      <div class="save-hint">Tip: put ____ in the question where the blank goes; otherwise the answer box appears below it.</div>`;
  }
  return prompt + `<div class="field-row"><label for="qn-${si}-${qi}">Guidance note<br><small>for the teacher, optional</small></label><textarea id="qn-${si}-${qi}" rows="2" data-f="q.note" ${at} ${dirAuto}>${escapeHtml(q.note || '')}</textarea></div>`;
}

function paintEditor(el) {
  const d = X.draft;
  const total = weightTotal(d);
  el.innerHTML = `
    <div class="exam-topbar">
      <button class="ghost-btn" type="button" id="examBack">&larr; Versions</button>
      <span class="status-chip draft">Draft v${d.version_no}</span>
      <span class="save-hint" id="examSaveState" role="status" aria-live="polite"></span>
      <span class="exam-tools">
        <button class="ghost-btn" type="button" id="examPreviewBtn">Preview</button>
        <button class="danger-btn" type="button" id="examDiscardBtn">Discard</button>
        <button class="save-btn" type="button" id="examPublishBtn">Publish</button>
      </span>
    </div>
    <div id="examConflict"></div>
    <div class="panel-section">
      <div class="field-row"><label for="exTitle">Title</label><input type="text" id="exTitle" data-f="d.title" value="${escapeAttr(d.title || '')}" ${dirAuto}></div>
      <div class="field-row"><label for="exTitleAr">Title (Arabic)</label><input type="text" id="exTitleAr" data-f="d.title_ar" value="${escapeAttr(d.title_ar || '')}" dir="auto"></div>
      <div class="field-row"><label for="exDur">Time limit (minutes)</label><input type="number" id="exDur" data-f="d.duration_minutes" min="1" max="600" step="1" value="${escapeAttr(d.duration_minutes ?? '')}"></div>
      <div class="field-row"><label for="exInstr">Instructions</label><textarea id="exInstr" rows="3" data-f="d.instructions" ${dirAuto}>${escapeHtml(d.instructions || '')}</textarea></div>
      <div class="field-row"><label for="exInstrAr">Instructions (Arabic)</label><textarea id="exInstrAr" rows="3" data-f="d.instructions_ar" dir="auto">${escapeHtml(d.instructions_ar || '')}</textarea></div>
    </div>
    <div class="list-subhead">Sections <span id="examWeightBadge" class="weight-badge ${Math.abs(total - 100) < 0.001 ? 'ok' : 'warn'}">${fmtNum(total)} / 100</span></div>
    <div id="examSections">${d.sections.map((s, si) => secHtml(s, si)).join('') || '<div class="empty-state" style="padding:16px;">No sections yet.</div>'}</div>
    <div class="field-row" style="margin-top:12px;">
      <select id="examNewFormat" class="panel-select">${FORMATS.map(f => `<option value="${f}">${FORMAT_LABEL[f]}</option>`).join('')}</select>
      <button class="save-btn" type="button" id="examAddSection">+ Add section</button>
    </div>
    <div class="save-hint" id="examEditorHint"></div>`;
  paintSaveState(); paintConflict();
  $('examBack').addEventListener('click', backToList);
  $('examPreviewBtn').addEventListener('click', openPreview);
  $('examDiscardBtn').addEventListener('click', discardDraft);
  $('examPublishBtn').addEventListener('click', openPublish);
  $('examAddSection').addEventListener('click', () => { const s = newSection($('examNewFormat').value); X.draft.sections.push(s); touch(); repaintEditor(); });
}

function repaintEditor() { if (X.view === 'draft' && X.draft && host()) paintEditor(host()); }

// Event delegation for everything inside the editor.
function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b || !X.draft || X.view !== 'draft') return;
  const si = Number(b.dataset.s), qi = Number(b.dataset.q), oi = Number(b.dataset.o);
  const d = X.draft; const act = b.dataset.act; const s = d.sections[si]; const q = s && s.questions[qi];
  if (act === 'sec-up' || act === 'sec-down') { if (move(d.sections, si, act === 'sec-up' ? -1 : 1)) { touch(); repaintEditor(); } return; }
  if (act === 'sec-del') {
    confirmDialog({ title: 'Delete this section?', body: `Its ${s.questions.length} question${s.questions.length === 1 ? '' : 's'} will be removed from the draft.`, okLabel: 'Delete section' })
      .then(ok => { if (ok) { d.sections.splice(si, 1); touch(); repaintEditor(); } });
    return;
  }
  if (act === 'q-add') { const nq = newQuestion(s.format); s.questions.push(nq); X.openQ = nq.id; touch(); repaintEditor(); const t = $(`qp-${si}-${s.questions.length - 1}`); if (t) t.focus(); return; }
  if (act === 'q-toggle') { X.openQ = X.openQ === q.id ? null : q.id; repaintEditor(); return; }
  if (act === 'q-up' || act === 'q-down') { if (move(s.questions, qi, act === 'q-up' ? -1 : 1)) { touch(); repaintEditor(); } return; }
  if (act === 'q-dup') { const c = duplicateQuestion(q); s.questions.splice(qi + 1, 0, c); X.openQ = c.id; touch(); repaintEditor(); return; }
  if (act === 'q-del') { s.questions.splice(qi, 1); if (X.openQ === q.id) X.openQ = null; touch(); repaintEditor(); return; }
  if (act === 'o-add') { if (q.options.length < MAX_OPTIONS) { q.options.push(newOption()); touch(); repaintEditor(); } return; }
  if (act === 'o-del') {
    const gone = q.options[oi]; q.options.splice(oi, 1);
    q.key.correct_option_ids = q.key.correct_option_ids.filter(id => id !== gone.id);
    touch(); repaintEditor();
  }
}

function onInput(e) {
  const t = e.target; const f = t.dataset && t.dataset.f; if (!f || !X.draft || X.view !== 'draft') return;
  const d = X.draft; const si = Number(t.dataset.s), qi = Number(t.dataset.q), oi = Number(t.dataset.o);
  const s = d.sections[si]; const q = s && s.questions[qi];
  const nz = (v) => (v.trim() === '' ? null : v);
  if (f === 'd.title') d.title = t.value;
  else if (f === 'd.title_ar') d.title_ar = nz(t.value);
  else if (f === 'd.instructions') d.instructions = nz(t.value);
  else if (f === 'd.instructions_ar') d.instructions_ar = nz(t.value);
  else if (f === 'd.duration_minutes') d.duration_minutes = t.value.trim() === '' ? null : Number(t.value);
  else if (f === 's.title') s.title = t.value;
  else if (f === 's.title_ar') s.title_ar = nz(t.value);
  else if (f === 's.weight') { s.weight = t.value.trim() === '' ? 0 : Number(t.value); }
  else if (f === 's.format') {
    if (e.type !== 'change') return;
    const apply = () => { convertSection(s, t.value); touch(); repaintEditor(); };
    if (s.questions.length) {
      const prev = s.format; t.value = prev;
      confirmDialog({ title: 'Change the format?', body: `The options and answers of this section's ${s.questions.length} question(s) will be reset. The question text is kept.`, okLabel: 'Change format' })
        .then(ok => { if (ok) { const sel = $(`sf-${si}`); apply.call(null, (t.value = sel ? sel.value : t.value)); } });
      // the confirmed value is read from the select the user chose: restore it for the callback below
      pendingFormat = { si, value: e.target.dataset.pending };
      return;
    }
    apply(); return;
  }
  else if (f === 'q.prompt') { q.prompt = t.value; const sn = document.querySelector(`#q-${cssEscape(q.id)} .q-snippet`); if (sn) sn.textContent = snippet(q); }
  else if (f === 'q.note') q.note = nz(t.value);
  else if (f === 'q.opt') q.options[oi].text = t.value;
  else if (f === 'q.correct') {
    const id = q.options[oi].id; const set = new Set(q.key.correct_option_ids);
    if (t.checked) set.add(id); else set.delete(id);
    q.key.correct_option_ids = q.options.map(o => o.id).filter(x => set.has(x));
    const m = $(`qmulti-${si}-${qi}`); if (m) m.textContent = isMulti(q) ? 'Several correct answers: students must select all that apply.' : 'Tick the box beside each correct option.';
  }
  else if (f === 'q.tf') q.key.correct_option_ids = [t.value];
  else if (f === 'q.accepted') q.key.accepted_answers = t.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  else if (f === 'q.tm') q.key.tm_equiv = t.checked;
  touch(); refreshDerived();
}
let pendingFormat = null; // eslint-disable-line no-unused-vars

function refreshDerived() {
  const d = X.draft; if (!d) return;
  const total = weightTotal(d); const b = $('examWeightBadge');
  if (b) { b.textContent = `${fmtNum(total)} / 100`; b.className = 'weight-badge ' + (Math.abs(total - 100) < 0.001 ? 'ok' : 'warn'); }
  d.sections.forEach((s, si) => { const v = $(`sval-${si}`); if (v) v.textContent = valueText(s); });
}

// ---------- autosave (FR-X15, FR-X16) ----------
function touch() {
  X.dirty = true; X.seq++; X.saveError = '';
  if (X.conflict) { paintSaveState(); return; }
  X.saveState = 'unsaved'; paintSaveState();
  clearTimeout(X.timer); X.timer = setTimeout(() => { saveNow(); }, EXAM_AUTOSAVE_MS);
}

function paintSaveState() {
  const el = $('examSaveState'); if (!el) return;
  const m = { saved: ['Saved ✓', 'ok'], saving: ['Saving…', ''], unsaved: ['Unsaved changes', ''], error: ['Not saved: ' + X.saveError, 'err'], conflict: ['Not saved: changed elsewhere', 'err'] }[X.saveState];
  el.textContent = m[0]; el.className = 'save-hint ' + m[1];
}
function paintConflict() {
  const el = $('examConflict'); if (!el) return;
  if (!X.conflict) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="status-banner error" id="examConflictBanner">This draft was changed somewhere else (another window or another teacher). Your edits here were not saved.
    <button class="ghost-btn" type="button" id="examReload" style="display:inline-flex; margin-left:8px;">Reload the latest</button></div>`;
  $('examReload').addEventListener('click', reloadDraft);
}

export async function saveNow() {
  clearTimeout(X.timer); X.timer = null; clearTimeout(X.retry); X.retry = null;
  if (X.saving) { X.again = true; return X.savePromise; }
  if (!X.draft || !X.dirty) return !X.conflict;
  if (X.conflict) return false;
  X.saving = true; X.saveState = 'saving'; paintSaveState();
  X.savePromise = (async () => {
    let ok = true;
    do {
      X.again = false;
      const seq = X.seq; const draft = X.draft; const id = draft.id;
      try {
        const rev = await rpc('admin_save_draft', { p_version_id: id, p_rev: X.rev, p_doc: docForSave(draft) });
        X.rev = rev; if (X.draft === draft) draft.draft_rev = rev;
        if (X.seq === seq || X.draft !== draft) { X.dirty = X.seq !== seq && X.draft === draft; X.saveState = X.dirty ? 'unsaved' : 'saved'; }
        else X.again = true;
        if (X.dirty && !X.again) X.again = true;
      } catch (e) {
        ok = false; X.again = false;
        if (e.code === 'E_CONFLICT') { X.conflict = true; X.saveState = 'conflict'; }
        else if (e.code === 'E_AUTH') { X.saveState = 'unsaved'; }
        else {
          X.saveError = errorMessage(e); X.saveState = 'error';
          if (e.code === 'E_NETWORK' || e.code === 'E_SERVER') { X.saveError += ' Retrying…'; X.retry = setTimeout(() => { saveNow(); }, 5000); }
        }
      }
    } while (X.again);
    X.saving = false; paintSaveState(); paintConflict();
    return ok && !X.conflict;
  })();
  return X.savePromise;
}

async function reloadDraft() {
  X.dirty = false; X.conflict = false; X.draft = null;
  await loadExam({ keepView: true });
  X.view = X.draft ? 'draft' : 'list'; paint();
}

window.addEventListener('beforeunload', (e) => { if (X.dirty && X.draft) { e.preventDefault(); e.returnValue = ''; } });

async function flushOrAsk() {
  if (!X.dirty) return true;
  const ok = await saveNow();
  if (ok) return true;
  return confirmDialog({ title: 'Leave without saving?', body: 'Your latest changes could not be saved. If you leave now they will be lost.', okLabel: 'Leave anyway' });
}

async function backToList() {
  if (!(await flushOrAsk())) return;
  X.view = 'list'; X.preview = null; X.viewDoc = null;
  await loadExam();
}

async function discardDraft() {
  const ok = await confirmDialog({ title: 'Discard this draft?', body: 'The draft and everything in it will be deleted. The live version is not affected.', okLabel: 'Discard draft' });
  if (!ok) return;
  clearTimeout(X.timer);
  try {
    await rpc('admin_discard_draft', { p_version_id: X.draft.id });
    X.draft = null; X.dirty = false; X.conflict = false; X.view = 'list'; X.note = 'Draft discarded.';
    await loadExam(); X.note = '';
  } catch (e) { const h = $('examEditorHint'); if (h) { h.textContent = 'Could not discard: ' + errorMessage(e); h.className = 'save-hint err'; } }
}

// ---------- read-only version view ----------
function readOnlyDoc(d) {
  return `<div class="panel-section">
      <div class="entry-row-name" ${dirAuto}>${escapeHtml(d.title || '(untitled)')} ${arHtml(d.title_ar)}</div>
      <div class="entry-row-sn">${d.duration_minutes ? d.duration_minutes + ' minutes' : 'no time limit set'} · ${questionCount(d)} questions</div>
      ${d.instructions ? `<p class="exam-text" ${dirAuto}>${escapeHtml(d.instructions)}</p>` : ''}${d.instructions_ar ? `<p class="exam-text" dir="auto">${escapeHtml(d.instructions_ar)}</p>` : ''}
    </div>
    ${d.sections.map((s, si) => `<div class="exam-section"><div class="exam-section-head"><b>Section ${si + 1}: ${escapeHtml(s.title || '')}</b>
      <span class="save-hint">${FORMAT_LABEL[s.format]} · ${fmtNum(s.weight)}% · ${valueText(s)}</span></div>
      ${s.questions.map((q, qi) => `<div class="exam-q open"><div class="exam-q-body"><div class="exam-text" ${dirAuto}><b>${qi + 1}.</b> ${escapeHtml(q.prompt)}</div>
        ${s.format === 'mcq' || s.format === 'tf' ? `<ul class="exam-ro-opts">${q.options.map(o => `<li class="${q.key.correct_option_ids.includes(o.id) ? 'correct' : ''}" ${dirAuto}>${q.key.correct_option_ids.includes(o.id) ? '✓ ' : ''}${escapeHtml(o.text)}</li>`).join('')}</ul>` : ''}
        ${s.format === 'fill' ? `<div class="save-hint">Accepted: <span dir="auto">${escapeHtml((q.key.accepted_answers || []).join(' · '))}</span>${q.key.tm_equiv ? ' (ة = ه)' : ''}</div>` : ''}
        ${s.format === 'essay' && q.note ? `<div class="save-hint" ${dirAuto}>Note: ${escapeHtml(q.note)}</div>` : ''}</div></div>`).join('')}</div>`).join('')}`;
}
function paintVersion(el) {
  const d = X.viewDoc;
  el.innerHTML = `<div class="exam-topbar"><button class="ghost-btn" type="button" id="examBack">&larr; Versions</button>
      <span class="status-chip ${d.status}">${STATUS_LABEL[d.status]} v${d.version_no}</span><span class="save-hint">Read only. To change a published exam, create a new draft.</span>
      <span class="exam-tools"><button class="ghost-btn" type="button" id="examPreviewBtn">Preview</button></span></div>${readOnlyDoc(d)}`;
  $('examBack').addEventListener('click', () => { X.view = 'list'; X.viewDoc = null; paint(); });
  $('examPreviewBtn').addEventListener('click', () => { X.preview = { doc: d, idx: -1, answers: {}, from: 'version' }; X.view = 'preview'; paint(); });
}

// ---------- preview as student (task 1.5): client-side only, creates nothing, sends nothing ----------
async function openPreview() {
  X.preview = { doc: X.draft, idx: -1, answers: {}, from: 'draft' };
  X.view = 'preview'; paint();
}
function previewQuestionHtml(item, ans) {
  const { s, q } = item; const name = `pv-${q.id}`;
  const multi = s.format === 'mcq' && isMulti(q);
  const blank = String(q.prompt || '').includes('____');
  let body = '';
  if (s.format === 'mcq' || s.format === 'tf') {
    body = `<fieldset class="exam-fieldset"><legend class="exam-text" ${dirAuto}>${escapeHtml(q.prompt)}</legend>${multi ? '<div class="save-hint">Select all that apply.</div>' : ''}
      ${q.options.map(o => `<label class="exam-choice"><input type="${multi ? 'checkbox' : 'radio'}" name="${escapeAttr(name)}" value="${escapeAttr(o.id)}" data-pv="${escapeAttr(q.id)}" ${[].concat(ans || []).includes(o.id) ? 'checked' : ''}> <span ${dirAuto}>${escapeHtml(o.text)}</span></label>`).join('')}</fieldset>`;
  } else if (s.format === 'fill') {
    body = `<div class="exam-text" ${dirAuto}>${escapeHtml(q.prompt)}</div><input type="text" class="exam-fill" data-pv="${escapeAttr(q.id)}" dir="auto" maxlength="500" value="${escapeAttr(ans || '')}" aria-label="Your answer"${blank ? '' : ''}>`;
  } else {
    body = `<div class="exam-text" ${dirAuto}>${escapeHtml(q.prompt)}</div><textarea class="exam-essay" rows="6" data-pv="${escapeAttr(q.id)}" dir="auto" aria-label="Your answer">${escapeHtml(ans || '')}</textarea>`;
  }
  return body;
}
function paintPreview(el) {
  const P = X.preview; const d = P.doc; const items = flatQuestions(d);
  const banner = '<div class="status-banner" id="previewBanner">Preview: nothing is saved</div>';
  const close = () => { X.view = P.from === 'draft' && X.draft ? 'draft' : (P.from === 'version' ? 'version' : 'list'); X.preview = null; paint(); };
  if (P.idx < 0) {
    el.innerHTML = `${banner}<div class="panel-section exam-start"><h4 ${dirAuto}>${escapeHtml(d.title || '(untitled exam)')}</h4>${arHtml(d.title_ar)}
      <p class="exam-text">${d.duration_minutes ? d.duration_minutes + ' minutes' : 'No time limit set'} · ${items.length} question${items.length === 1 ? '' : 's'} in ${d.sections.length} section${d.sections.length === 1 ? '' : 's'}</p>
      ${d.instructions ? `<p class="exam-text" ${dirAuto}>${escapeHtml(d.instructions)}</p>` : ''}${d.instructions_ar ? `<p class="exam-text" dir="auto">${escapeHtml(d.instructions_ar)}</p>` : ''}
      <div class="entry-footer"><button class="ghost-btn" type="button" id="pvClose">Close preview</button>
      <button class="save-btn" type="button" id="pvStart" ${items.length ? '' : 'disabled'}>Start</button></div></div>`;
    $('pvClose').addEventListener('click', close);
    $('pvStart').addEventListener('click', () => { P.idx = 0; paint(); });
    return;
  }
  const item = items[P.idx];
  el.innerHTML = `${banner}
    <div class="exam-run-head"><span class="exam-timer" aria-label="Time limit">${d.duration_minutes ? String(d.duration_minutes).padStart(2, '0') + ':00' : '--:--'}</span><span class="save-hint">Preview</span>
      <button class="ghost-btn" type="button" id="pvClose">Close preview</button></div>
    <div class="panel-section">
      <div class="list-subhead" ${dirAuto}>${escapeHtml(item.s.title || 'Section ' + (item.si + 1))} · ${FORMAT_LABEL[item.s.format]} · Q ${item.n} of ${items.length}</div>
      <div id="pvQuestion">${previewQuestionHtml(item, P.answers[item.q.id])}</div>
      <div class="entry-footer" style="margin-top:16px;"><button class="ghost-btn" type="button" id="pvPrev" ${P.idx === 0 ? 'disabled' : ''}>&lsaquo; Previous</button>
        <button class="ghost-btn" type="button" id="pvNext" ${P.idx === items.length - 1 ? 'disabled' : ''}>Next &rsaquo;</button></div>
      <div class="exam-palette" role="group" aria-label="Question palette">${items.map((it, i) => {
        const a = P.answers[it.q.id]; const done = Array.isArray(a) ? a.length > 0 : !!(a && String(a).trim());
        return `<button type="button" class="pal${done ? ' done' : ''}${i === P.idx ? ' cur' : ''}" data-pv-go="${i}" aria-label="Question ${i + 1}${done ? ', answered' : ''}">${i + 1}</button>`;
      }).join('')}</div>
    </div>`;
  $('pvClose').addEventListener('click', close);
  $('pvPrev').addEventListener('click', () => { P.idx--; paint(); });
  $('pvNext').addEventListener('click', () => { P.idx++; paint(); });
  el.querySelectorAll('[data-pv-go]').forEach(b => b.addEventListener('click', () => { P.idx = Number(b.dataset.pvGo); paint(); }));
  el.querySelectorAll('[data-pv]').forEach(inp => inp.addEventListener('input', () => {
    const id = inp.dataset.pv;
    if (inp.type === 'checkbox') P.answers[id] = [...el.querySelectorAll(`[data-pv="${cssEscape(id)}"]:checked`)].map(x => x.value);
    else if (inp.type === 'radio') P.answers[id] = [inp.value];
    else P.answers[id] = inp.value;
    const pal = el.querySelector(`[data-pv-go="${P.idx}"]`);
    if (pal) { const a = P.answers[id]; pal.classList.toggle('done', Array.isArray(a) ? a.length > 0 : !!String(a).trim()); }
  }));
}

// ---------- publish dialog (task 1.6, FR-X12) ----------
let pubEl = null;
function pubOverlay() {
  if (pubEl) return pubEl;
  pubEl = document.createElement('div');
  pubEl.className = 'modal-overlay'; pubEl.id = 'examPublishModal';
  pubEl.innerHTML = '<div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="pubTitle"><button class="close-btn" id="pubClose" type="button" aria-label="Close">&times;</button><div id="pubBody"></div></div>';
  document.body.appendChild(pubEl);
  $('pubClose').addEventListener('click', closePublish);
  pubEl.addEventListener('click', (e) => { if (e.target === pubEl) closePublish(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pubEl.style.display === 'flex') closePublish(); });
  return pubEl;
}
function closePublish() { if (pubEl) pubEl.style.display = 'none'; }

async function openPublish() {
  const o = pubOverlay(); o.style.display = 'flex';
  $('pubBody').innerHTML = '<div class="empty-state" style="padding:20px;">Saving your draft…</div>';
  const saved = await saveNow();
  if (!saved) { $('pubBody').innerHTML = `<div class="modal-header"><h3 id="pubTitle">Can't publish yet</h3></div><p class="exam-text">${X.conflict ? 'This draft changed somewhere else. Close this and reload the latest first.' : 'Your latest changes could not be saved: ' + escapeHtml(X.saveError || 'try again')}</p>`; return; }
  renderPublish(validateDoc(X.draft), '');
}
function renderPublish(problems, serverMsg) {
  const d = X.draft; const live = X.versions.find(v => v.status === 'live');
  const list = problems.length
    ? `<ul class="exam-problems" id="pubProblems">${problems.map(p => `<li><button type="button" class="exam-jump" data-jump="${escapeAttr(p.path)}">${escapeHtml(p.message)}</button></li>`).join('')}</ul>`
    : `<p class="exam-text">This makes version ${d.version_no} live right away.${live ? ` Version ${live.no} will be retired; attempts already in progress keep the version they started on.` : ''}</p>`;
  $('pubBody').innerHTML = `<div class="modal-header"><h3 id="pubTitle">${problems.length ? 'Fix these before publishing' : `Publish version ${d.version_no}?`}</h3></div>
    ${serverMsg ? `<div class="status-banner error">${escapeHtml(serverMsg)}</div>` : ''}${list}
    <div class="confirm-actions" style="margin-top:14px;"><button class="ghost-btn" type="button" id="pubCancel">${problems.length ? 'Close' : 'Cancel'}</button>
      ${problems.length ? '' : '<button class="save-btn" type="button" id="pubGo">Publish</button>'}</div><div class="save-hint" id="pubHint" style="margin-top:8px;"></div>`;
  $('pubCancel').addEventListener('click', closePublish);
  const go = $('pubGo'); if (go) go.addEventListener('click', doPublish);
  $('pubBody').querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => { closePublish(); jumpTo(b.dataset.jump); }));
}
async function doPublish() {
  const go = $('pubGo'); go.disabled = true; $('pubHint').textContent = 'Publishing…';
  try {
    const res = await rpc('admin_publish_version', { p_version_id: X.draft.id });
    closePublish();
    X.draft = null; X.dirty = false; X.saveState = 'saved'; X.view = 'list'; X.note = `Version ${res.version_no} is live.`;
    await loadExam(); X.note = '';
    reload({ coursesToo: true });
  } catch (e) {
    if (e.code === 'E_VALIDATION') {
      let probs = null; try { const j = JSON.parse(e.detail); if (Array.isArray(j)) probs = j; } catch (x) { /* plain message */ }
      if (probs) return renderPublish(probs, 'The server found problems with this draft.');
    }
    go.disabled = false; $('pubHint').textContent = 'Could not publish: ' + errorMessage(e); $('pubHint').className = 'save-hint err';
  }
}

// Jump from a problem to its field (§9.4.3).
function jumpTo(path) {
  const { si, qi, field } = parsePath(path);
  if (si === null) {
    const id = { title: 'exTitle', duration_minutes: 'exDur' }[field];
    const el = id ? $(id) : $('examSections'); if (el) { if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); if (el.focus) el.focus(); } return;
  }
  const s = X.draft.sections[si]; if (!s) return;
  if (qi !== null && s.questions[qi]) { X.openQ = s.questions[qi].id; repaintEditor(); const el = $(`q-${s.questions[qi].id}`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); const f = $(`qp-${si}-${qi}`); if (f && field === 'prompt') f.focus(); return; }
  const el = $(field === 'weight' ? `sw-${si}` : `sec-${si}`); if (el) { if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); if (el.focus) el.focus(); }
}

// ---------- wiring (delegated, once) ----------
document.addEventListener('click', (e) => { if (e.target.closest('#manageExamsPane') || e.target.closest('#examBuilderArea')) onClick(e); });
document.addEventListener('input', (e) => { if (e.target.closest('#manageExamsPane') || e.target.closest('#examBuilderArea')) onInput(e); });
document.addEventListener('change', (e) => { if (e.target.closest('#manageExamsPane') || e.target.closest('#examBuilderArea')) onInput(e); });
