// Shared in-memory store plus pure data helpers (no DOM, no network).
// Shared mutable values live on one exported object: ES modules cannot reassign an imported binding.

export const state = {
  loaded: false,            // first data load finished (until then views show "Loading…")
  courses: [],              // every course, oldest first
  courseId: null,           // selected course
  rows: [],                 // enrollments of the selected course (teacher: incl. inactive; public: active only)
  teacherUnlocked: false,   // true only after teacher_login / a successful teacher_ping
  entryOpenId: null,        // roster row currently expanded
  renamingId: null,         // roster row whose names are being edited
  courseDraft: null,        // course form state (null = editing the selected course; {copyFrom} = creating)
  courseFormDirty: false,
  editingEnrollmentId: null,// score editor: which enrollment
  editingDayIndex: null,    // score editor: which unit (0-based); null = unit-picker screen
};

export function currentCourse() {
  return state.courses.find(c => c.id === state.courseId) || null;
}
export function activeRows() { return state.rows.filter(r => r.active); }
export function findRow(enrollmentId) { return state.rows.find(r => r.id === enrollmentId) || null; }

// ---------- lesson maths (PRD §5.1) ----------
// lesson = min(lesson_max, sum(recorded unit scores) + sum(bonus units) * bonus_unit_value)
export function lessonPoints(days, bonusUnits, course) {
  if (!course || course.lesson_mode !== 'scored') return 0;
  const daySum = days.reduce((a, d) => a + (typeof d === 'number' ? d : 0), 0);
  const bonusSum = bonusUnits.reduce((a, b) => a + (typeof b === 'number' && b > 0 ? b : 0), 0) * Number(course.bonus_unit_value);
  return Math.min(Number(course.lesson_max), daySum + bonusSum);
}
export function bonusPoints(bonusUnits, course) {
  if (!course) return 0;
  return bonusUnits.reduce((a, b) => a + (typeof b === 'number' && b > 0 ? b : 0), 0) * Number(course.bonus_unit_value);
}

// Database arrays: days use -1 for "unset"; bonus uses 0 for "none". The app uses null / 0.
export function daysFromDb(days, count) {
  const src = Array.isArray(days) ? days : [];
  return Array.from({ length: count }, (_, i) => (typeof src[i] === 'number' && src[i] >= 0 ? src[i] : null));
}
export function bonusFromDb(bonus, count) {
  const src = Array.isArray(bonus) ? bonus : [];
  return Array.from({ length: count }, (_, i) => (typeof src[i] === 'number' && src[i] > 0 ? src[i] : 0));
}

// One normalized row per enrollment. `raw` comes either from admin_list_roster (has name/status
// inline) or from the public reads (already merged by the loader into the same field names).
export function normalizeRow(raw, course) {
  const count = course.lesson_mode === 'scored' ? course.day_count : 0;
  const days = daysFromDb(raw.days, count);
  const bonusUnits = bonusFromDb(raw.bonus_units, count);
  return {
    id: raw.enrollment_id,
    studentId: raw.student_id,
    sn: typeof raw.sn === 'number' ? raw.sn : 0,
    name: raw.name || 'Unknown',
    nameAr: raw.name_ar || '',
    active: raw.active !== false,
    examApproved: !!raw.exam_approved,
    status: raw.status || 'not_eligible',
    days, bonusUnits,
    total: lessonPoints(days, bonusUnits, course),
    bonusPoints: bonusPoints(bonusUnits, course),
    lessonPct: typeof raw.lesson_pct === "number" ? raw.lesson_pct : null,
    examPct: typeof raw.exam_pct === "number" ? raw.exam_pct : null,
    final: typeof raw.final === "number" ? raw.final : null,
    passed: raw.passed !== undefined ? raw.passed : null,
    bandLabel: raw.band_label || "",
    bandLabelAr: raw.band_label_ar || "",
    hasCertificate: !!raw.has_certificate,
  };
}

// Competition ranking (D-26): tied totals share a rank, the next rank skips (1, 2, 2, 4).
export function rankRows(rows, course = null) {
  const isExamMode = !!course && !!course.exam_live;
  if (isExamMode) {
    const finalized = rows.filter(r => r.status === "finalized" && typeof r.final === "number");
    const sorted = [...finalized].sort((a, b) => b.final - a.final || a.sn - b.sn);
    let rank = 0, prev = null;
    return sorted.map((r, i) => {
      if (prev === null || r.final !== prev) { rank = i + 1; prev = r.final; }
      return { row: r, rank };
    });
  }
  const sorted = [...rows].sort((a, b) => b.total - a.total || a.sn - b.sn);
  let rank = 0, prev = null;
  return sorted.map((r, i) => {
    if (prev === null || r.total !== prev) { rank = i + 1; prev = r.total; }
    return { row: r, rank };
  });
}
