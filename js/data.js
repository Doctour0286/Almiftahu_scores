// Data loading: courses, and the enrollments of the selected course.
//  - Public visitors read the four public tables with explicit columns (PRD §10.5), active rows only.
//  - An unlocked teacher gets the full roster (incl. inactive) from admin_list_roster.
import { sb, rpc, fetchAll } from './api.js';
import { COURSE_KEY } from './config.js';
import { state, currentCourse, normalizeRow } from './state.js';

const COURSE_COLUMNS = 'id,code,name,name_ar,status,unit_label,unit_label_ar,lesson_mode,eligibility_rule,' +
  'day_count,day_max,bonus_unit_value,lesson_max,weight_lessons,weight_exam,pass_mark,reveal_answers,' +
  'exam_live,grade_bands,created_at';

let loadSeq = 0;   // a newer load supersedes an older one that is still in flight

function remembered() { try { return sessionStorage.getItem(COURSE_KEY); } catch (e) { return null; } }
function remember(id) { try { sessionStorage.setItem(COURSE_KEY, id); } catch (e) { /* ignore */ } }

export function chooseCourse(id) {
  state.courseId = id;
  if (id) remember(id);
}

async function fetchCourses() {
  const courses = await fetchAll(() => sb.from('courses').select(COURSE_COLUMNS).order('created_at').order('id'));
  state.courses = courses.map(c => ({
    ...c,
    day_count: Number(c.day_count), day_max: Number(c.day_max),
    bonus_unit_value: Number(c.bonus_unit_value), lesson_max: Number(c.lesson_max),
    weight_lessons: Number(c.weight_lessons), weight_exam: Number(c.weight_exam), pass_mark: Number(c.pass_mark),
  }));
  // keep the selection if it still exists, else the remembered one, else the first active course
  const ids = new Set(state.courses.map(c => c.id));
  let pick = ids.has(state.courseId) ? state.courseId : remembered();
  if (!ids.has(pick)) pick = (state.courses.find(c => c.status === 'active') || state.courses[0] || {}).id || null;
  chooseCourse(pick);
}

async function fetchRowsPublic(course) {
  const [enr, stu, res] = await Promise.all([
    fetchAll(() => sb.from('enrollments').select('id,student_id,sn,days,bonus_units,active')
      .eq('course_id', course.id).eq('active', true).order('sn').order('id')),
    fetchAll(() => sb.from('students').select('id,name,name_ar').order('id')),
    fetchAll(() => sb.from('enrollment_results').select('enrollment_id,status,lesson_pct,exam_pct,final,passed,band_label,band_label_ar,has_certificate')
      .eq('course_id', course.id).order('enrollment_id')),
  ]);
  const names = new Map(stu.map(s => [s.id, s]));
  const results = new Map(res.map(r => [r.enrollment_id, r]));
  return enr.filter(e => names.has(e.student_id)).map(e => normalizeRow({
    enrollment_id: e.id, student_id: e.student_id, sn: e.sn, days: e.days, bonus_units: e.bonus_units,
    active: e.active, name: names.get(e.student_id).name, name_ar: names.get(e.student_id).name_ar,
    status: (results.get(e.id) || {}).status,
  }, course));
}

async function fetchRowsTeacher(course) {
  const list = await rpc('admin_list_roster', { p_course_id: course.id });
  return list.map(r => normalizeRow(r, course));
}

// Reload courses and the selected course's rows. Resolves false if a newer load took over.
export async function refresh({ coursesToo = true } = {}) {
  const seq = ++loadSeq;
  if (coursesToo || !state.courses.length) await fetchCourses();
  if (seq !== loadSeq) return false;
  const course = currentCourse();
  const rows = course ? (state.teacherUnlocked ? await fetchRowsTeacher(course) : await fetchRowsPublic(course)) : [];
  if (seq !== loadSeq) return false;
  state.rows = rows;
  state.loaded = true;
  return true;
}
