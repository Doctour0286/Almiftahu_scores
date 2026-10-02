// Shared in-memory store plus pure data helpers (no DOM, no network).
import { BONUS_UNIT_VALUE, DAY_COUNT, MAX_TOTAL, TEACHER_SESSION_KEY } from './config.js';

export const state = {
  allStudents: [],   // everything from Supabase (active + inactive)
  students: [],      // active only — used by public views
  entryOpenId: null,
  renamingId: null,   // which student's name is currently being edited inline
  teacherUnlocked: sessionStorage.getItem(TEACHER_SESSION_KEY) === "1",
  pendingConfirm: null,
  seedingInProgress: false,
  teacherPin: "2026", // fallback until loaded from Supabase
  editingStudentId: null, // which student the score-edit wizard is open for
  editingDayIndex: null,  // which day (0-9) the wizard is on; null = day-picker screen
};

  // which day (0-9) the wizard is on; null = day-picker screen

export function computeTotal(days, bonusUnits) {
  const daySum = days.reduce((acc, d) => acc + (typeof d === 'number' ? d : 0), 0);
  const bonusSum = bonusUnits.reduce((acc, b) => acc + (typeof b === 'number' ? b : 0), 0) * BONUS_UNIT_VALUE;
  return Math.min(MAX_TOTAL, daySum + bonusSum);
}

// Postgres integer[] can't hold null mixed with numbers cleanly via the JS
// client here, so "unset" is stored as -1 and translated to null in the
// app; the UI never shows -1, only blank. Same convention for bonus_units.
export function daysToDb(days) {
  return days.map(d => (typeof d === 'number' ? d : -1));
}
export function daysFromDb(days) {
  return (Array.isArray(days) ? days : Array(DAY_COUNT).fill(-1)).map(d => (typeof d === 'number' && d >= 0 ? d : null));
}

export function normalizeStudent(row) {
  const days = daysFromDb(row.days).length === DAY_COUNT ? daysFromDb(row.days) : Array(DAY_COUNT).fill(null);
  const bonusRaw = daysFromDb(row.bonus_units);
  const bonusUnits = bonusRaw.length === DAY_COUNT ? bonusRaw.map(b => (b === null ? 0 : b)) : Array(DAY_COUNT).fill(0);
  return {
    id: row.id, sn: typeof row.sn === 'number' ? row.sn : 0, name: row.name || 'Unknown',
    days, bonusUnits, active: row.active !== false, total: computeTotal(days, bonusUnits)
  };
}

export function nextSN() {
  return state.allStudents.reduce((max, s) => Math.max(max, s.sn), 0) + 1;
}
