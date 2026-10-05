// In-memory fake of the Supabase backend (PostgREST selects + the Phase-0 RPCs), mirroring 002/003 rules.
const uid = (() => { let n = 0; return (p) => `${p}-0000-0000-0000-${String(++n).padStart(12, '0')}`; })();
class Fail extends Error { constructor(code, detail) { super(code); this.code = code; this.detail = detail || ''; } }

function makeBackend() {
  const db = { courses: [], students: [], enrollments: [], exams: [], codes: [], attempts: [], tokens: new Set(), pin: '1234', fails: 0, lockedUntil: 0, log: [], badLogin: 0 };
  const mkCourse = (o) => ({ id: uid('c'), status: 'active', created_at: new Date(1e12 + db.courses.length * 1000).toISOString(),
    name_ar: null, unit_label: 'Day', unit_label_ar: null, lesson_mode: 'scored', eligibility_rule: 'all_units', day_count: 10, day_max: 10,
    bonus_unit_value: 2, lesson_max: 100, weight_lessons: 50, weight_exam: 50, pass_mark: 60, reveal_answers: true, exam_live: false,
    grade_bands: [{ label: 'Pass', label_ar: 'مقبول', min: 60 }], cert_settings: {}, ...o });
  db.mkCourse = mkCourse;
  const blank = (c) => ({ days: Array(c.day_count).fill(-1), bonus_units: Array(c.day_count).fill(0) });
  db.addStudent = (course, name, ar) => {
    const sid = 's' + (db.students.length + 1000 + Math.floor(Math.random() * 1)); const n = db.students.length + 1;
    const stu = { id: 's' + n, name, name_ar: ar || null }; db.students.push(stu);
    const sn = Math.max(0, ...db.enrollments.filter(e => e.course_id === course.id).map(e => e.sn)) + 1;
    const e = { id: uid('e'), student_id: stu.id, course_id: course.id, sn, active: true, exam_approved: false, ...blank(course) };
    db.enrollments.push(e); return { enrollment_id: e.id, student_id: stu.id, sn };
  };
  const result = (e) => { const c = db.courses.find(x => x.id === e.course_id);
    const complete = c.eligibility_rule === 'all_units' ? e.days.length === c.day_count && e.days.every(d => d >= 0) : c.eligibility_rule === 'teacher_approved' ? e.exam_approved : true;
    return { enrollment_id: e.id, course_id: c.id, status: complete ? 'eligible' : 'not_eligible', lesson_pct: 0 }; };
  const auth = (t) => { if (!t || !db.tokens.has(t)) throw new Fail('E_AUTH'); };
  const courseOf = (id) => { const c = db.courses.find(x => x.id === id); if (!c) throw new Fail('E_NOT_FOUND', 'That course no longer exists.'); return c; };

  const rpcs = {
    teacher_login: ({ p_pin }) => {
      const now = Date.now(); if (db.lockedUntil > now) return { ok: false, error: 'E_LOCKED', detail: String(Math.ceil((db.lockedUntil - now) / 60000)) };
      if (p_pin === db.pin) { db.fails = 0; const t = 'tok' + (db.tokens.size + 1) + Math.random().toString(36).slice(2); db.tokens.add(t); return { ok: true, token: t }; }
      db.badLogin++; if (++db.fails >= 5) { db.lockedUntil = now + 5 * 60000; return { ok: false, error: 'E_LOCKED', detail: '5' }; }
      return { ok: false, error: 'E_AUTH' };
    },
    teacher_logout: ({ p_token }) => { db.tokens.delete(p_token); return null; },
    teacher_ping: ({ p_token }) => !!p_token && db.tokens.has(p_token),
    teacher_change_pin: ({ p_token, p_old, p_new }) => { auth(p_token);
      if (!p_new || p_new.trim().length < 4) throw new Fail('E_VALIDATION', 'PIN must be at least 4 characters.');
      if (p_old !== db.pin) return { ok: false, error: 'E_AUTH', detail: 'current_pin' };
      db.pin = p_new.trim(); return { ok: true }; },
    admin_list_roster: ({ p_token, p_course_id }) => { auth(p_token); courseOf(p_course_id);
      return db.enrollments.filter(e => e.course_id === p_course_id).sort((a, b) => a.sn - b.sn).map(e => { const s = db.students.find(x => x.id === e.student_id); const r = result(e);
        return { enrollment_id: e.id, student_id: s.id, sn: e.sn, name: s.name, name_ar: s.name_ar, active: e.active, days: e.days, bonus_units: e.bonus_units, exam_approved: e.exam_approved, status: r.status, lesson_pct: r.lesson_pct }; }); },
    admin_list_students_all: ({ p_token }) => { auth(p_token); return db.students.map(s => ({ id: s.id, name: s.name, name_ar: s.name_ar })); },
    admin_add_student: ({ p_token, p_course_id, p_name, p_name_ar }) => { auth(p_token); const c = courseOf(p_course_id);
      const name = (p_name || '').trim(); if (!name) throw new Fail('E_VALIDATION', 'Student name is required (up to 200 characters).');
      if (c.status === 'archived') throw new Fail('E_VALIDATION', 'This course is archived; no new enrollments.');
      const dup = db.enrollments.some(e => e.course_id === c.id && db.students.find(s => s.id === e.student_id).name.trim().toLowerCase() === name.toLowerCase());
      return { ...db.addStudent(c, name, (p_name_ar || '').trim() || null), duplicate_name: dup }; },
    admin_enroll_student: ({ p_token, p_course_id, p_student_id }) => { auth(p_token); const c = courseOf(p_course_id);
      if (db.enrollments.some(e => e.course_id === c.id && e.student_id === p_student_id)) throw new Fail('E_VALIDATION', 'That student is already enrolled in this course.');
      const sn = Math.max(0, ...db.enrollments.filter(e => e.course_id === c.id).map(e => e.sn)) + 1;
      const e = { id: uid('e'), student_id: p_student_id, course_id: c.id, sn, active: true, exam_approved: false, ...blank(c) }; db.enrollments.push(e);
      return { enrollment_id: e.id, student_id: p_student_id, sn }; },
    admin_bulk_seed: ({ p_token, p_course_id, p_lines }) => { auth(p_token); const c = courseOf(p_course_id); let added = 0; const skipped = [], invalid = [];
      const seen = new Set(db.enrollments.filter(e => e.course_id === c.id).map(e => db.students.find(s => s.id === e.student_id).name.trim().toLowerCase()));
      for (let line of p_lines.split(/\r?\n/)) { line = line.trim(); if (!line) continue; const i = line.indexOf('|');
        const name = (i >= 0 ? line.slice(0, i) : line).trim(); const ar = i >= 0 ? line.slice(i + 1).trim() || null : null;
        if (!name) { invalid.push(line); continue; } if (seen.has(name.toLowerCase())) { skipped.push(name); continue; }
        db.addStudent(c, name, ar); seen.add(name.toLowerCase()); added++; }
      return { added, skipped, invalid }; },
    admin_update_student: ({ p_token, p_student_id, p_name, p_name_ar }) => { auth(p_token); const s = db.students.find(x => x.id === p_student_id);
      if (!s) throw new Fail('E_NOT_FOUND', 'That student no longer exists.'); if (!(p_name || '').trim()) throw new Fail('E_VALIDATION', 'Student name is required (up to 200 characters).');
      s.name = p_name.trim(); s.name_ar = (p_name_ar || '').trim() || null; return null; },
    admin_set_active: ({ p_token, p_enrollment_id, p_active }) => { auth(p_token); const e = db.enrollments.find(x => x.id === p_enrollment_id); if (!e) throw new Fail('E_NOT_FOUND'); e.active = p_active; return null; },
    admin_delete_student: ({ p_token, p_student_id }) => { auth(p_token);
      if (db.certified && db.certified.has(p_student_id)) throw new Fail('E_HAS_CERTIFICATE', "This student has a certificate and can't be deleted.");
      db.students = db.students.filter(s => s.id !== p_student_id); db.enrollments = db.enrollments.filter(e => e.student_id !== p_student_id); return null; },
    admin_save_day: ({ p_token, p_enrollment_id, p_day_index, p_score, p_bonus }) => { auth(p_token); const e = db.enrollments.find(x => x.id === p_enrollment_id); if (!e) throw new Fail('E_NOT_FOUND');
      const c = db.courses.find(x => x.id === e.course_id);
      if (c.lesson_mode !== 'scored') throw new Fail('E_VALIDATION', 'This course has no lesson scores.');
      if (p_day_index == null || p_day_index < 0 || p_day_index >= c.day_count) throw new Fail('E_VALIDATION', `That ${c.unit_label.toLowerCase()} does not exist in this course.`);
      if (p_score != null && (p_score < 0 || p_score > c.day_max)) throw new Fail('E_VALIDATION', `Score must be between 0 and ${c.day_max} (or blank).`);
      if (p_bonus != null && p_bonus < 0) throw new Fail('E_VALIDATION', 'Bonus units cannot be negative.');
      e.days[p_day_index] = p_score == null ? -1 : p_score; e.bonus_units[p_day_index] = p_bonus == null ? 0 : p_bonus;
      const r = result(e); return { days: e.days, bonus_units: e.bonus_units, lesson_pct: r.lesson_pct, status: r.status }; },
    admin_set_exam_approval: ({ p_token, p_enrollment_id, p_approved }) => { auth(p_token); const e = db.enrollments.find(x => x.id === p_enrollment_id); if (!e) throw new Fail('E_NOT_FOUND'); e.exam_approved = p_approved; return null; },
    admin_set_course_status: ({ p_token, p_course_id, p_status }) => { auth(p_token); courseOf(p_course_id).status = p_status; return null; },
    admin_save_course: ({ p_token, p_course, p_confirm, p_copy_from }) => { auth(p_token); const isNew = !p_course.id;
      if (isNew) { const src = p_copy_from ? courseOf(p_copy_from) : {}; if (!p_course.code || !/^[A-Z0-9-]{2,12}$/.test(p_course.code)) throw new Fail('E_VALIDATION', 'Course code must be 2-12 characters: capital letters, digits, hyphen.');
        if (db.courses.some(c => c.code === p_course.code)) throw new Fail('E_VALIDATION', 'That course code is already in use.');
        const { id, created_at, status, ...inherit } = src; const c = mkCourse({ ...inherit, ...p_course }); if (c.lesson_mode === 'none') { c.day_count = 0; c.weight_lessons = 0; c.weight_exam = 100; } db.courses.push(c); return { course: c, affected: 0 }; }
      const old = courseOf(p_course.id); const n = db.enrollments.filter(e => e.course_id === old.id).length;
      const next = { ...old, ...p_course };
      if (next.lesson_mode !== old.lesson_mode && db.enrollments.some(e => e.course_id === old.id && e.days.some(d => d >= 0))) throw new Fail('E_VALIDATION', "Lesson mode can't change after scoring has started. Create a new course instead.");
      if (next.lesson_mode === 'scored' && next.weight_lessons + next.weight_exam !== 100) throw new Fail('E_VALIDATION', 'Lesson and exam weights must add up to 100.');
      const changed = ['day_count', 'day_max', 'bonus_unit_value', 'lesson_max', 'weight_lessons', 'weight_exam', 'pass_mark', 'eligibility_rule', 'lesson_mode'].some(k => next[k] !== old[k]);
      if (changed && n > 0 && !p_confirm) throw new Fail('E_CONFIRM_REQUIRED', String(n));
      Object.assign(old, next); db.enrollments.filter(e => e.course_id === old.id).forEach(e => { e.days = Array.from({ length: old.day_count }, (_, i) => e.days[i] ?? -1); e.bonus_units = Array.from({ length: old.day_count }, (_, i) => e.bonus_units[i] ?? 0); });
      return { course: old, affected: n }; },
    admin_get_exam: ({ p_token, p_course_id }) => {
      auth(p_token); courseOf(p_course_id);
      let exam = db.exams.find(x => x.course_id === p_course_id);
      if (!exam) { exam = { id: uid('x'), course_id: p_course_id, versions: [] }; db.exams.push(exam); }
      const draft = exam.versions.find(v => v.status === 'draft') || null;
      const versions = exam.versions.map(v => ({
        id: v.id, no: v.version_no, status: v.status, title: v.title, title_ar: v.title_ar,
        duration_minutes: v.duration_minutes, published_at: v.published_at,
        question_count: (v.sections || []).reduce((sum, s) => sum + (s.questions || []).length, 0),
        attempts_count: 0,
      })).reverse();
      return { versions, draft };
    },
    admin_get_version: ({ p_token, p_version_id }) => {
      auth(p_token);
      for (const ex of db.exams) {
        const v = ex.versions.find(x => x.id === p_version_id);
        if (v) return JSON.parse(JSON.stringify(v));
      }
      throw new Fail('E_NOT_FOUND', 'That version no longer exists.');
    },
    admin_create_draft: ({ p_token, p_course_id }) => {
      auth(p_token); courseOf(p_course_id);
      let exam = db.exams.find(x => x.course_id === p_course_id);
      if (!exam) { exam = { id: uid('x'), course_id: p_course_id, versions: [] }; db.exams.push(exam); }
      if (exam.versions.some(v => v.status === 'draft')) throw new Fail('E_VALIDATION', 'A draft already exists for this course.');
      const live = exam.versions.find(v => v.status === 'live');
      const vno = exam.versions.length + 1;
      let draftDoc;
      if (live) {
        draftDoc = JSON.parse(JSON.stringify(live));
        draftDoc.id = uid('v'); draftDoc.status = 'draft'; draftDoc.version_no = vno; draftDoc.draft_rev = 0; draftDoc.published_at = null;
        (draftDoc.sections || []).forEach(s => { s.id = uid('sec'); (s.questions || []).forEach(q => { q.id = uid('q'); }); });
      } else {
        draftDoc = { id: uid('v'), version_no: vno, status: 'draft', title: '', title_ar: null, instructions: null, instructions_ar: null, duration_minutes: 60, draft_rev: 0, sections: [] };
      }
      exam.versions.push(draftDoc);
      return JSON.parse(JSON.stringify(draftDoc));
    },
    admin_save_draft: ({ p_token, p_version_id, p_rev, p_doc }) => {
      auth(p_token);
      for (const ex of db.exams) {
        const v = ex.versions.find(x => x.id === p_version_id);
        if (v) {
          if (v.status !== 'draft') throw new Fail('E_VALIDATION', 'Only drafts can be saved.');
          if (v.draft_rev !== p_rev) throw new Fail('E_CONFLICT', String(v.draft_rev));
          v.title = p_doc.title || ''; v.title_ar = p_doc.title_ar || null;
          v.instructions = p_doc.instructions || null; v.instructions_ar = p_doc.instructions_ar || null;
          v.duration_minutes = p_doc.duration_minutes || 60;
          v.sections = JSON.parse(JSON.stringify(p_doc.sections || []));
          v.draft_rev = (v.draft_rev || 0) + 1;
          return v.draft_rev;
        }
      }
      throw new Fail('E_NOT_FOUND', 'That version no longer exists.');
    },
    admin_discard_draft: ({ p_token, p_version_id }) => {
      auth(p_token);
      for (const ex of db.exams) {
        const idx = ex.versions.findIndex(x => x.id === p_version_id && x.status === 'draft');
        if (idx >= 0) { ex.versions.splice(idx, 1); return null; }
      }
      throw new Fail('E_NOT_FOUND', 'That draft no longer exists.');
    },
    admin_publish_version: ({ p_token, p_version_id }) => {
      auth(p_token);
      for (const ex of db.exams) {
        const v = ex.versions.find(x => x.id === p_version_id && x.status === 'draft');
        if (v) {
          const probs = [];
          if (!v.title || !v.title.trim()) probs.push({ path: 'title', message: 'Exam title cannot be empty.' });
          if (!v.duration_minutes || v.duration_minutes < 1 || v.duration_minutes > 600) probs.push({ path: 'duration_minutes', message: 'Duration must be between 1 and 600 minutes.' });
          if (!v.sections || v.sections.length === 0) probs.push({ path: 'sections', message: 'At least one section is required.' });
          const totalW = (v.sections || []).reduce((sum, s) => sum + (Number(s.weight) || 0), 0);
          if (Math.abs(totalW - 100) > 0.001) probs.push({ path: 'weights', message: 'Section weights must sum to 100.' });
          (v.sections || []).forEach((s, sIdx) => {
            if (!s.questions || s.questions.length === 0) probs.push({ path: `sections[${sIdx}]`, message: 'Every section must have at least one question.' });
            if (!s.weight || s.weight <= 0) probs.push({ path: `sections[${sIdx}].weight`, message: 'Section weight must be greater than 0.' });
            (s.questions || []).forEach((q, qIdx) => {
              if (!q.prompt || !q.prompt.trim()) probs.push({ path: `sections[${sIdx}].questions[${qIdx}].prompt`, message: 'Question prompt cannot be empty.' });
              if (s.format === 'mcq') {
                if (!q.options || q.options.length < 2 || q.options.length > 8) probs.push({ path: `sections[${sIdx}].questions[${qIdx}].options`, message: 'MCQ must have 2 to 8 options.' });
                if (!q.key || !q.key.correct_option_ids || q.key.correct_option_ids.length === 0) probs.push({ path: `sections[${sIdx}].questions[${qIdx}].key`, message: 'At least one correct option must be selected.' });
              }
              if (s.format === 'tf') {
                if (!q.key || !q.key.correct_option_ids || q.key.correct_option_ids.length !== 1) probs.push({ path: `sections[${sIdx}].questions[${qIdx}].key`, message: 'Exactly one correct option required.' });
              }
              if (s.format === 'fill') {
                if (!q.key || !q.key.accepted_answers || q.key.accepted_answers.length === 0 || !q.key.accepted_answers.some(a => a.trim())) probs.push({ path: `sections[${sIdx}].questions[${qIdx}].key`, message: 'At least one accepted answer required.' });
              }
            });
          });
          if (probs.length > 0) throw new Fail('E_VALIDATION', JSON.stringify(probs));
          const prevLive = ex.versions.find(x => x.status === 'live');
          if (prevLive) prevLive.status = 'retired';
          v.status = 'live'; v.published_at = new Date().toISOString();
          const course = db.courses.find(c => c.id === ex.course_id);
          if (course) course.exam_live = true;
          return { id: v.id, version_no: v.version_no, status: 'live', published_at: v.published_at };
        }
      }
      throw new Fail('E_NOT_FOUND', 'That version no longer exists.');
    },
    admin_patch_text: ({ p_token, p_question_id, p_prompt, p_options }) => {
      auth(p_token);
      for (const ex of db.exams) {
        for (const v of ex.versions) {
          for (const s of (v.sections || [])) {
            const q = (s.questions || []).find(x => x.id === p_question_id);
            if (q) {
              if (v.status === 'draft') throw new Fail('E_VALIDATION', 'Drafts are edited with the draft editor.');
              if (!p_prompt || !p_prompt.trim()) throw new Fail('E_VALIDATION', 'Prompt cannot be empty.');
              q.prompt = p_prompt;
              if (p_options) q.options = p_options;
              return { ok: true };
            }
          }
        }
      }
      throw new Fail('E_NOT_FOUND', 'That question no longer exists.');
    },
    admin_generate_code: ({ p_token, p_enrollment_id }) => {
      auth(p_token);
      const enr = db.enrollments.find(e => e.id === p_enrollment_id);
      if (!enr) throw new Fail('E_NOT_FOUND');
      const c = courseOf(enr.course_id);
      if (!c.exam_live) throw new Fail('E_VALIDATION', 'No live exam.');
      const codeStr = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
      db.codes = db.codes.filter(x => !(x.enrollment_id === p_enrollment_id && x.status === 'active'));
      db.codes.push({ id: uid('code'), enrollment_id: p_enrollment_id, code: codeStr, status: 'active' });
      return { code: codeStr };
    },
    admin_generate_codes_bulk: ({ p_token, p_course_id }) => {
      auth(p_token);
      const c = courseOf(p_course_id);
      if (!c.exam_live) throw new Fail('E_VALIDATION', 'No live exam.');
      const out = [];
      const eligible = db.enrollments.filter(e => e.course_id === p_course_id && e.active && !db.codes.some(x => x.enrollment_id === e.id && x.status === 'active')).slice(0, 40);
      eligible.forEach(e => {
        const s = db.students.find(x => x.id === e.student_id);
        const codeStr = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
        db.codes.push({ id: uid('code'), enrollment_id: e.id, code: codeStr, status: 'active' });
        out.push({ enrollment_id: e.id, sn: e.sn, name: s.name, name_ar: s.name_ar, code: codeStr });
      });
      return out;
    },
    admin_list_codes: ({ p_token, p_course_id }) => {
      auth(p_token);
      return db.codes.filter(x => x.status === 'active' && (db.enrollments.find(e => e.id === x.enrollment_id) || {}).course_id === p_course_id)
        .map(x => ({ enrollment_id: x.enrollment_id, code: x.code === undefined ? null : x.code, created_at: '2026-10-05T00:00:00Z' }));
    },
    admin_revoke_code: ({ p_token, p_enrollment_id }) => {
      auth(p_token);
      const ec = db.codes.find(x => x.enrollment_id === p_enrollment_id && x.status === 'active');
      if (ec) ec.status = 'revoked';
      return null;
    },
    admin_clear_lock: ({ p_token }) => {
      auth(p_token);
      return null;
    },
    admin_reset_attempt: ({ p_token, p_enrollment_id }) => {
      auth(p_token);
      const att = db.attempts.find(a => a.enrollment_id === p_enrollment_id && !a.superseded);
      if (att) att.superseded = true;
      return null;
    },
    exam_check: ({ p_enrollment_id, p_code }) => {
      const enr = db.enrollments.find(e => e.id === p_enrollment_id);
      if (!enr || !enr.active) throw new Fail('E_AUTH');
      const c = db.courses.find(x => x.id === enr.course_id);
      if (!c || !c.exam_live) throw new Fail('E_NO_LIVE_EXAM');
      const activeCode = db.codes.find(x => x.enrollment_id === p_enrollment_id && x.status === 'active');
      const cleanInput = (p_code || '').toUpperCase().replace(/[\\s-]+/g, '');
      const cleanStored = (activeCode ? activeCode.code : '').toUpperCase().replace(/[\\s-]+/g, '');
      if (!activeCode || cleanInput !== cleanStored) throw new Fail('E_AUTH');
      const att = db.attempts.find(a => a.enrollment_id === p_enrollment_id && !a.superseded);
      const exam = db.exams.find(x => x.course_id === c.id);
      const liveVer = exam ? exam.versions.find(v => v.status === 'live') : null;
      return {
        ok: true,
        state: att ? att.status : 'not_started',
        remaining_seconds: 3600,
        exam: {
          title: liveVer ? liveVer.title : c.name,
          title_ar: liveVer ? liveVer.title_ar : null,
          duration_minutes: liveVer ? liveVer.duration_minutes : 60,
          instructions: liveVer ? liveVer.instructions : null,
          instructions_ar: liveVer ? liveVer.instructions_ar : null,
          section_count: liveVer ? (liveVer.sections || []).length : 1,
          question_count: liveVer ? (liveVer.sections || []).reduce((sum, s) => sum + (s.questions || []).length, 0) : 1,
        }
      };
    },
    exam_start: ({ p_enrollment_id, p_code }) => {
      const enr = db.enrollments.find(e => e.id === p_enrollment_id);
      if (!enr || !enr.active) throw new Fail('E_AUTH');
      const activeCode = db.codes.find(x => x.enrollment_id === p_enrollment_id && x.status === 'active');
      const cleanInput = (p_code || '').toUpperCase().replace(/[\\s-]+/g, '');
      const cleanStored = (activeCode ? activeCode.code : '').toUpperCase().replace(/[\\s-]+/g, '');
      if (!activeCode || cleanInput !== cleanStored) throw new Fail('E_AUTH');
      let att = db.attempts.find(a => a.enrollment_id === p_enrollment_id && !a.superseded);
      const token = uid('att-tok');
      const now = new Date().toISOString();
      const deadline = new Date(Date.now() + 3600000).toISOString();
      if (!att) {
        att = { id: uid('att'), enrollment_id: p_enrollment_id, token, status: 'in_progress', deadline_at: deadline, answers: {}, flags: {}, superseded: false };
        db.attempts.push(att);
      } else {
        att.token = token;
      }
      return { ok: true, attempt_token: token, deadline_at: att.deadline_at, server_now: now };
    },
    exam_get_paper: ({ p_attempt_token }) => {
      const att = db.attempts.find(a => a.token === p_attempt_token);
      if (!att) throw new Fail('E_SESSION_REPLACED');
      const enr = db.enrollments.find(e => e.id === att.enrollment_id);
      const c = db.courses.find(x => x.id === enr.course_id);
      const exam = db.exams.find(x => x.course_id === c.id);
      const liveVer = exam ? exam.versions.find(v => v.status === 'live') : null;
      return {
        deadline_at: att.deadline_at,
        server_now: new Date().toISOString(),
        sections: liveVer ? liveVer.sections : [{ id: uid('sec'), title: 'Section A', format: 'mcq', weight: 100, questions: [{ id: uid('q'), prompt: 'Test Question', options: [{ id: 'a', text: 'Option A' }] }] }],
        answers: att.answers || {},
        flags: att.flags || {},
      };
    },
    exam_save_answers: ({ p_attempt_token, p_answers }) => {
      const att = db.attempts.find(a => a.token === p_attempt_token);
      if (!att) throw new Fail('E_SESSION_REPLACED');
      (p_answers || []).forEach(a => {
        att.answers[a.question_id] = a.response;
        if (a.flagged !== undefined) att.flags[a.question_id] = a.flagged;
      });
      return { ok: true, saved_at: new Date().toISOString() };
    },
    exam_log_event: () => null,
    exam_submit: ({ p_attempt_token }) => {
      const att = db.attempts.find(a => a.token === p_attempt_token);
      if (!att) throw new Fail('E_SESSION_REPLACED');
      att.status = 'finalized';
      return { ok: true, status: 'finalized', pending_marking: false };
    },
    admin_marking_overview: ({ p_token, p_course_id }) => {
      auth(p_token);
      return {
        essays: [{ id: "q-essay", prompt: "Explain kindness", section_title: "Essay Section", value: 30, submitted_count: 2, marked_count: 1, pending_count: 1 }],
        fills: [{ id: "q-fill", prompt: "Capital of Nigeria is ____", section_title: "Fill Section", value: 20, unmatched_count: 1 }]
      };
    },
    admin_essay_answers: ({ p_token, p_question_id }) => {
      auth(p_token);
      return {
        question: { id: p_question_id, prompt: "Explain kindness", value: 30, section_title: "Essay Section" },
        answers: [{ attempt_id: "att-1", sn: 1, student_name: "Ahmad Bello", text: "Kindness is virtue.", fraction: null, points: null, marked_by: null, comment: "" }]
      };
    },
    admin_attempt_detail: ({ p_token, p_attempt_id }) => {
      auth(p_token);
      return {
        attempt: { id: p_attempt_id, student_name: "Ahmad Bello", sn: 1, status: "submitted", started_at: "2026-10-05T12:00:00Z", submitted_at: "2026-10-05T12:45:00Z", tab_leaves: 0, time_away_seconds: 0 },
        sections: [{ id: "sec-1", title: "Section 1", format: "essay", weight: 100, questions: [{ id: "q-1", prompt: "Explain kindness", value: 30, response: { text: "Kindness is virtue." }, fraction: null, points: null, marked_by: null, comment: "" }] }],
        events: []
      };
    },
    admin_mark_answer: ({ p_token, p_attempt_id, p_question_id, p_points, p_comment }) => {
      auth(p_token);
      return { ok: true, points: p_points, fraction: p_points / 30, status: "finalized" };
    },
    admin_fill_review: ({ p_token, p_question_id }) => {
      auth(p_token);
      return { question_id: p_question_id, prompt: "Capital of Nigeria is ____", accepted_answers: ["Abuja"], unmatched: [{ text: "Lagos", count: 2 }] };
    },
    admin_accept_fill_answer: ({ p_token, p_question_id, p_text }) => {
      auth(p_token);
      return { ok: true };
    },
    admin_correct_key: ({ p_token, p_question_id, p_new_key, p_confirm }) => {
      auth(p_token);
      if (!p_confirm) throw new Fail("E_CONFIRM_REQUIRED");
      return { ok: true, affected_attempts: 1 };
    },
    
    admin_list_certificates: ({ p_token, p_course_id }) => {
      auth(p_token);
      return {
        ok: true,
        eligible: [
          {
            enrollment_id: "enr-1",
            student_id: "st-1",
            sn: 1,
            student_name: "Ahmad Bello",
            student_name_ar: "أحمد بللو",
            missing_arabic_name: false,
            final: 85,
            band_label: "Very Good",
            band_label_ar: "جيد جداً",
            finalized_at: "2026-10-05T13:00:00Z"
          },
          {
            enrollment_id: "enr-2",
            student_id: "st-2",
            sn: 2,
            student_name: "John Doe",
            student_name_ar: "",
            missing_arabic_name: true,
            final: 75,
            band_label: "Good",
            band_label_ar: "جيد",
            finalized_at: "2026-10-05T13:00:00Z"
          }
        ],
        issued: [
          {
            id: "cert-1",
            enrollment_id: "enr-prev",
            sn: 99,
            student_name: "Previous Grad",
            student_name_ar: "خريج سابق",
            number: "MMI-ADAB-2026-0001",
            verify_code: "ABC123XYZ0",
            status: "approved",
            approved_at: "2026-10-05T10:00:00Z",
            revoked_at: null,
            revoke_reason: null,
            final: 92,
            band_label: "Excellent",
            band_label_ar: "ممتاز",
            snapshot: {
              number: "MMI-ADAB-2026-0001",
              student_name: "Previous Grad",
              student_name_ar: "خريج سابق",
              course_name: "Al-Aadaab",
              course_name_ar: "الآداب",
              final: 92,
              band_label: "Excellent",
              band_label_ar: "ممتاز",
              issued_date: "2026-10-05",
              title: "Certificate of Completion",
              title_ar: "شهادة إتمام",
              institution_name: "Ma'had Miftah al-'Ilm",
              institution_name_ar: "معهد مفتاح العلم",
              wording: "Completed course successfully.",
              wording_ar: "أتم الدورة بنجاح.",
              signatory: {
                name: "Musa Aminu Muhammad",
                name_ar: "موسى أمينو محمد",
                title: "Mushrif",
                title_ar: "المشرف"
              }
            }
          }
        ]
      };
    },
    admin_approve_certificates: ({ p_token, p_enrollment_ids }) => {
      auth(p_token);
      return (p_enrollment_ids || []).map((id, i) => ({
        enrollment_id: id,
        ok: true,
        number: `MMI-ADAB-2026-000${i + 2}`,
        verify_code: `VCODE000${i + 2}`,
      }));
    },
    admin_revoke_certificate: ({ p_token, p_enrollment_id, p_reason }) => {
      auth(p_token);
      return { ok: true };
    },
    admin_get_institution: ({ p_token }) => {
      auth(p_token);
      return {
        ok: true,
        number_prefix: "MMI",
        institution: {
          name: "Ma'had Miftah al-'Ilm",
          name_ar: "معهد مفتاح العلم"
        },
        certificate_defaults: {
          title: "Certificate of Completion",
          title_ar: "شهادة إتمام",
          wording: "This is to certify that {name} has completed {course}.",
          wording_ar: "يشهد معهد مفتاح العلم بأن {name_ar} قد أتم {course_ar}.",
          signatory: {
            name: "Musa Aminu Muhammad",
            name_ar: "موسى أمينو محمد",
            title: "Mushrif",
            title_ar: "المشرف"
          }
        }
      };
    },
    admin_save_institution: ({ p_token, p_settings }) => {
      auth(p_token);
      return { ok: true };
    },
    get_certificate: ({ p_enrollment_id, p_code }) => {
      return {
        ok: true,
        number: "MMI-ADAB-2026-0001",
        verify_code: "ABC123XYZ0",
        approved_at: "2026-10-05T10:00:00Z",
        snapshot: {
          number: "MMI-ADAB-2026-0001",
          student_name: "Ahmad Bello",
          student_name_ar: "أحمد بللو",
          course_name: "Al-Aadaab",
          course_name_ar: "الآداب",
          final: 85,
          band_label: "Very Good",
          band_label_ar: "جيد جداً",
          issued_date: "2026-10-05",
          title: "Certificate of Completion",
          title_ar: "شهادة إتمام",
          institution_name: "Ma'had Miftah al-'Ilm",
          institution_name_ar: "معهد مفتاح العلم",
          wording: "Completed course successfully.",
          wording_ar: "أتم الدورة بنجاح.",
          signatory: {
            name: "Musa Aminu Muhammad",
            name_ar: "موسى أمينو محمد",
            title: "Mushrif",
            title_ar: "المشرف"
          }
        }
      };
    },
    verify_certificate: ({ p_number }) => {
      if (p_number === "MMI-REVOKED-2026-0000") {
        return {
          ok: true,
          status: "revoked",
          number: p_number,
          revoked_at: "2026-10-05T12:00:00Z",
          revoke_reason: "Test revocation"
        };
      }
      if (p_number === "MMI-NONEXISTENT") {
        return { ok: true, status: "not_found" };
      }
      return {
        ok: true,
        status: "valid",
        number: p_number || "MMI-ADAB-2026-0001",
        student_name: "Ahmad Bello",
        student_name_ar: "أحمد بللو",
        course_name: "Al-Aadaab",
        course_name_ar: "الآداب",
        issued_date: "2026-10-05",
        band_label: "Very Good",
        band_label_ar: "جيد جداً",
        title: "Certificate of Completion",
        title_ar: "شهادة إتمام",
        institution_name: "Ma'had Miftah al-'Ilm",
        institution_name_ar: "معهد مفتاح العلم"
      };
    },
    admin_results: ({ p_token, p_course_id }) => {
      auth(p_token);
      return [
        { attempt_id: "att-1", enrollment_id: "enr-1", sn: 1, student_name: "Ahmad Bello", student_name_ar: "أحمد بللو", status: "finalized", exam_pct: 90, final: 85, band_label: "Very Good", passed: true, tab_leaves: 0, time_away_seconds: 0, started_at: "2026-10-05T12:00:00Z", submitted_at: "2026-10-05T12:45:00Z", finalized_at: "2026-10-05T13:00:00Z" }
      ];
    },
    exam_get_result: ({ p_enrollment_id, p_code }) => {
      return {
        ok: true,
        status: "finalized",
        attempt_status: "finalized",
        student_name: "Ahmad Bello",
        student_name_ar: "أحمد بللو",
        course_name: "Al-Aadaab",
        lesson_pct: 80,
        exam_pct: 90,
        final: 85,
        passed: true,
        band_label: "Very Good",
        band_label_ar: "جيد جداً",
        has_certificate: false,
        can_review: true,
        reveal_answers: true,
        sections: [
          { id: "sec-1", title: "Section A", format: "mcq", weight: 50, earned_points: 40, max_points: 50, pending_essays: 0, status: "graded" },
          { id: "sec-2", title: "Section B", format: "essay", weight: 50, earned_points: 45, max_points: 50, pending_essays: 0, status: "graded" }
        ]
      };
    },
    exam_get_review: ({ p_enrollment_id, p_code }) => {
      return {
        ok: true,
        sections: [
          {
            id: "sec-1",
            title: "Section A",
            format: "mcq",
            weight: 50,
            questions: [
              { id: "q-1", prompt: "Question 1", max_points: 50, options: [{ id: "a", text: "Option A" }, { id: "b", text: "Option B" }], response: { selected: ["a"] }, key: { correct_option_ids: ["a"] }, fraction: 1, points: 50, marked_by: "auto", comment: null }
            ]
          }
        ]
      };
    },
  };

  const hdr = { 'Content-Type': 'application/json' };
  const jr = (status, body) => new Response(JSON.stringify(body), { status, headers: hdr });
  db.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url); const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : null;
    db.log.push({ method, path: url.pathname, body });
    if (db.down) throw new TypeError('Failed to fetch');
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').pop(); const fn = rpcs[name];
      if (!fn) return jr(404, { code: 'PGRST202', message: 'no function ' + name });
      try { const out = fn(body || {}); return out === null ? new Response(null, { status: 204 }) : jr(200, out); }
      catch (e) { if (e instanceof Fail) return jr(400, { code: 'P0001', message: e.code, details: e.detail, hint: null }); throw e; }
    }
    const m = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (m && method === 'GET') {
      const table = m[1]; let rows;
      if (table === 'courses') rows = db.courses.map(c => ({ ...c })).sort((a, b) => a.created_at.localeCompare(b.created_at));
      else if (table === 'students') rows = db.students.map(s => ({ ...s }));
      else if (table === 'enrollments') rows = db.enrollments.map(e => ({ ...e }));
      else if (table === 'enrollment_results') rows = db.enrollments.map(result);
      else return jr(404, { message: 'no table' });
      for (const [k, v] of url.searchParams) { const f = v.match(/^eq\.(.*)$/); if (f && !['select'].includes(k)) rows = rows.filter(r => String(r[k]) === f[1]); }
      if (table === 'enrollments') rows.sort((a, b) => a.sn - b.sn);
      const off = Number(url.searchParams.get('offset') || 0), lim = Number(url.searchParams.get('limit') || 1000);
      return jr(200, rows.slice(off, off + lim));
    }
    return jr(405, { message: `write not allowed: ${method} ${url.pathname}`, code: 'XX405' });   // any direct table write lands here
  };
  return db;
}
module.exports = { makeBackend };
