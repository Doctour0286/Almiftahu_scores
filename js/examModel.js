// Exam draft model: pure functions only (no DOM, no network). PRD §6.5, §7.6 (document shape), §7.7.
// The server (`011`) stays the authority; validateDoc() mirrors §7.7 so the publish dialog can list
// problems immediately, and a server refusal is shown as returned.

export const FORMATS = ['mcq', 'tf', 'fill', 'essay'];
export const FORMAT_LABEL = { mcq: 'Multiple choice', tf: 'True / False', fill: 'Fill in the blank', essay: 'Essay' };
export const MAX_OPTIONS = 8;

export function uid() {
  const c = typeof crypto !== 'undefined' ? crypto : null;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const h = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${h(8)}-${h(4)}-4${h(3)}-a${h(3)}-${h(12)}`;
}
const optId = () => 'o' + uid().replace(/-/g, '').slice(0, 10);

export const clone = (x) => JSON.parse(JSON.stringify(x));

export function tfOptions() { return [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }]; }

// ---------- factories ----------
export function newQuestion(format) {
  const q = { id: uid(), prompt: '', note: null, options: [] };
  if (format === 'mcq') { q.options = [{ id: optId(), text: '' }, { id: optId(), text: '' }]; q.key = { correct_option_ids: [] }; }
  else if (format === 'tf') { q.options = tfOptions(); q.key = { correct_option_ids: [] }; }
  else if (format === 'fill') q.key = { accepted_answers: [], tm_equiv: false };
  return q;
}
export function newSection(format = 'mcq') {
  return { id: uid(), title: '', title_ar: null, format, weight: 0, questions: [] };
}
export function newOption() { return { id: optId(), text: '' }; }

// Rebuild a question's shape when its section changes format. Prompts (and notes) survive; options and keys do not.
export function convertQuestion(q, format) {
  const out = { id: q.id, prompt: q.prompt || '', note: q.note || null, options: [] };
  if (format === 'mcq') { out.options = [newOption(), newOption()]; out.key = { correct_option_ids: [] }; }
  else if (format === 'tf') { out.options = tfOptions(); out.key = { correct_option_ids: [] }; }
  else if (format === 'fill') out.key = { accepted_answers: [], tm_equiv: false };
  return out;
}
export function convertSection(section, format) {
  section.format = format;
  section.questions = section.questions.map(q => convertQuestion(q, format));
}

// Copy of a question with a new id (option ids are local to a question and stay).
export function duplicateQuestion(q) { const c = clone(q); c.id = uid(); return c; }

export function move(arr, i, dir) {
  const j = i + dir;
  if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) return false;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return true;
}

// ---------- computed values (FR-X4, A.4) ----------
export function questionValue(section) {
  const n = section.questions.length;
  return n ? Number(section.weight || 0) / n : 0;
}
export function weightTotal(doc) { return (doc.sections || []).reduce((a, s) => a + Number(s.weight || 0), 0); }
export function questionCount(doc) { return (doc.sections || []).reduce((a, s) => a + s.questions.length, 0); }
export function isMulti(q) { return !!(q.key && Array.isArray(q.key.correct_option_ids) && q.key.correct_option_ids.length > 1); }

// ---------- what we send on save ----------
// admin_save_draft refuses the WHOLE save for a duration that is not a whole number in 1-600 or a weight
// outside 0-100. While a teacher is typing, that would block autosave, so out-of-range values are sent as
// "unset" (null / 0) and flagged by validateDoc() at publish time instead.
export function docForSave(doc) {
  const d = clone(doc);
  const dur = Number(d.duration_minutes);
  d.duration_minutes = Number.isInteger(dur) && dur >= 1 && dur <= 600 ? dur : null;
  for (const s of d.sections || []) {
    const w = Number(s.weight);
    s.weight = Number.isFinite(w) && w >= 0 && w <= 100 ? w : 0;
  }
  return d;
}

// ---------- publish validation, mirror of §7.7 / 011 ----------
const num = (n) => String(Math.round(n * 1000) / 1000);
export function validateDoc(doc) {
  const p = [];
  const add = (path, message) => p.push({ path, message });
  if (!String(doc.title || '').trim()) add('title', 'Give the exam a title.');
  const dur = Number(doc.duration_minutes);
  if (!(Number.isInteger(dur) && dur >= 1 && dur <= 600)) add('duration_minutes', 'Set the duration between 1 and 600 minutes.');
  const secs = doc.sections || [];
  const total = weightTotal(doc);
  if (!secs.length) add('sections', 'Add at least one section.');
  else if (Math.abs(total - 100) > 0.001) add('sections', `Section weights add up to ${num(total)}; they must add up to 100.`);
  const nq = questionCount(doc);
  if (nq > 200) add('sections', `The exam has ${nq} questions; the maximum is 200.`);
  secs.forEach((s, si) => {
    if (!(Number(s.weight) > 0)) add(`sections[${si}].weight`, `Section ${si + 1} needs a weight above 0.`);
    if (!s.questions.length) add(`sections[${si}].questions`, `Section ${si + 1} has no questions.`);
    s.questions.forEach((q, qi) => {
      const path = `sections[${si}].questions[${qi}]`;
      const lbl = `Section ${si + 1}, question ${qi + 1}`;
      const prompt = String(q.prompt || '');
      if (!prompt.trim()) add(path + '.prompt', `${lbl}: the question text is empty.`);
      else if (prompt.length > 4000) add(path + '.prompt', `${lbl}: the question text is longer than 4,000 characters.`);
      const opts = Array.isArray(q.options) ? q.options : [];
      const correct = (q.key && q.key.correct_option_ids) || [];
      if (s.format === 'mcq') {
        if (opts.length < 2 || opts.length > MAX_OPTIONS) add(path + '.options', `${lbl}: needs 2 to ${MAX_OPTIONS} options (has ${opts.length}).`);
        if (new Set(opts.map(o => o.id)).size !== opts.length) add(path + '.options', `${lbl}: option ids must be unique.`);
        if (opts.some(o => !String(o.text || '').trim())) add(path + '.options', `${lbl}: every option needs text.`);
        if (opts.some(o => String(o.text || '').length > 500)) add(path + '.options', `${lbl}: an option is longer than 500 characters.`);
        if (!correct.length) add(path + '.key', `${lbl}: mark at least one correct option.`);
        else if (correct.some(c => !opts.some(o => o.id === c))) add(path + '.key', `${lbl}: a correct option is not among the options.`);
      } else if (s.format === 'tf') {
        const ids = opts.map(o => o.id).sort().join();
        if (ids !== 'false,true') add(path + '.options', `${lbl}: a true/false question needs exactly the options "true" and "false".`);
        if (!(correct.length === 1 && (correct[0] === 'true' || correct[0] === 'false'))) add(path + '.key', `${lbl}: choose exactly one correct answer (true or false).`);
      } else if (s.format === 'fill') {
        const acc = (q.key && q.key.accepted_answers) || [];
        if (!acc.some(a => String(a).trim())) add(path + '.key', `${lbl}: add at least one accepted answer.`);
        if (acc.some(a => String(a).length > 200)) add(path + '.key', `${lbl}: an accepted answer is longer than 200 characters.`);
      }
    });
  });
  return p;
}

// "sections[1].questions[2].options" -> { si: 1, qi: 2, field: 'options' }
export function parsePath(path) {
  const m = String(path || '').match(/^sections\[(\d+)\](?:\.questions\[(\d+)\])?(?:\.(\w+))?$/);
  if (!m) return { si: null, qi: null, field: String(path || '') };
  return { si: Number(m[1]), qi: m[2] === undefined ? null : Number(m[2]), field: m[3] || '' };
}

// Flat question list (for the preview palette and counts).
export function flatQuestions(doc) {
  const out = [];
  (doc.sections || []).forEach((s, si) => s.questions.forEach((q, qi) => out.push({ s, q, si, qi, n: out.length + 1 })));
  return out;
}
