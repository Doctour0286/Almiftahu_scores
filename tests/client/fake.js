// In-memory fake of the Supabase backend (PostgREST selects + the Phase-0 RPCs), mirroring 002/003 rules.
const uid = (() => { let n = 0; return (p) => `${p}-0000-0000-0000-${String(++n).padStart(12, '0')}`; })();
class Fail extends Error { constructor(code, detail) { super(code); this.code = code; this.detail = detail || ''; } }

function makeBackend() {
  const db = { courses: [], students: [], enrollments: [], tokens: new Set(), pin: '1234', fails: 0, lockedUntil: 0, log: [], badLogin: 0 };
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
