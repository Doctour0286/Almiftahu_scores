// 3-Tier Authentication & RBAC (PRD LMS Overhaul)
// Roles: 'student', 'teacher', 'admin'.
// Unique logins (Email & Password), session tokens, and instructor attribution.

import { rpc } from './api.js';

const STORAGE_KEY = 'almiftahu_auth_user';
const TOKEN_KEY = 'almiftahu_auth_token';

// Built-in initial accounts for institutional operation and testing
const DEFAULT_ACCOUNTS = [
  {
    id: 'admin_1',
    email: 'admin@almiftahu.edu',
    password: 'admin',
    role: 'admin',
    name: 'Musa Aminu Muhammad',
    name_ar: 'موسى أمينو محمد',
    title: 'Principal & Mushrif',
    title_ar: 'المشرف العام',
    assigned_courses: ['ALL'],
    created_at: new Date().toISOString()
  },
  {
    id: 'teacher_1',
    email: 'teacher@almiftahu.edu',
    password: 'teacher',
    role: 'teacher',
    name: 'Dr. Ibrahim Al-Madani',
    name_ar: 'د. إبراهيم المدني',
    title: 'Senior Instructor of Seerah & Hadith',
    title_ar: 'أستاذ السيرة والحديث',
    assigned_courses: ['ADAB', 'HADITH', 'FIQH'],
    created_at: new Date().toISOString()
  },
  {
    id: 'student_1',
    email: 'student@almiftahu.edu',
    password: 'student',
    role: 'student',
    name: 'Ahmad Bello',
    name_ar: 'أحمد بللو',
    gender: 'male',
    nationality: 'Nigerian',
    country: 'Saudi Arabia',
    education_level: 'Bachelor Degree',
    sn: 1,
    enrollment_id: 'enr_sample_01',
    created_at: new Date().toISOString()
  }
];

function getStoredUsers() {
  try {
    const raw = localStorage.getItem('almiftahu_all_users');
    if (!raw) {
      localStorage.setItem('almiftahu_all_users', JSON.stringify(DEFAULT_ACCOUNTS));
      return DEFAULT_ACCOUNTS;
    }
    return JSON.parse(raw);
  } catch (_) {
    return DEFAULT_ACCOUNTS;
  }
}

function saveStoredUsers(users) {
  try {
    localStorage.setItem('almiftahu_all_users', JSON.stringify(users));
  } catch (_) {}
}

export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  // Default to student persona for immediate seamless browsing if not logged out explicitly
  const defaultUser = DEFAULT_ACCOUNTS.find(u => u.role === 'student');
  return defaultUser;
}

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
}

export function isAuthenticated() {
  return Boolean(getCurrentUser());
}

export function hasRole(role) {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.role === 'admin') return true; // Admin has universal access
  return user.role === role;
}

export function loginUser(email, password, remember = true) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const users = getStoredUsers();
  const user = users.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);

  if (!user) {
    throw new Error('Invalid email or password. Please verify your credentials.');
  }

  const token = 'token_' + user.role + '_' + Math.random().toString(36).substring(2, 12);
  const safeUser = { ...user };
  delete safeUser.password;

  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(STORAGE_KEY, JSON.stringify(safeUser));
  storage.setItem(TOKEN_KEY, token);

  // Sync token with API client
  sessionStorage.setItem('teacher_session_token', token);

  return safeUser;
}

export function registerStudent(data) {
  const cleanEmail = String(data.email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Email is required.');
  if (!data.password || data.password.length < 4) throw new Error('Password must be at least 4 characters.');
  if (!data.name && !data.name_ar) throw new Error('Student name is required.');

  const users = getStoredUsers();
  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    throw new Error('An account with this email address already exists.');
  }

  const newStudent = {
    id: 'student_' + Math.random().toString(36).substring(2, 9),
    email: cleanEmail,
    password: data.password,
    role: 'student',
    name: data.name || data.name_ar,
    name_ar: data.name_ar || data.name,
    gender: data.gender || 'male',
    nationality: data.nationality || '',
    country: data.country || '',
    education_level: data.education_level || '',
    sn: users.filter(u => u.role === 'student').length + 1,
    created_at: new Date().toISOString()
  };

  users.push(newStudent);
  saveStoredUsers(users);

  return loginUser(cleanEmail, data.password);
}

export function createTeacherAccount(data) {
  if (!hasRole('admin')) {
    throw new Error('Only administrators can create teacher accounts.');
  }

  const cleanEmail = String(data.email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Email is required.');
  if (!data.password) throw new Error('Password is required.');

  const users = getStoredUsers();
  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    throw new Error('A user with this email address already exists.');
  }

  const newTeacher = {
    id: 'teacher_' + Math.random().toString(36).substring(2, 9),
    email: cleanEmail,
    password: data.password,
    role: data.role === 'admin' ? 'admin' : 'teacher',
    name: data.name || '',
    name_ar: data.name_ar || '',
    title: data.title || 'Instructor',
    title_ar: data.title_ar || 'أستاذ',
    assigned_courses: Array.isArray(data.assigned_courses) ? data.assigned_courses : ['ALL'],
    created_at: new Date().toISOString()
  };

  users.push(newTeacher);
  saveStoredUsers(users);
  return newTeacher;
}

export function listTeacherAccounts() {
  const users = getStoredUsers();
  return users.filter(u => u.role === 'teacher' || u.role === 'admin').map(u => {
    const safe = { ...u };
    delete safe.password;
    return safe;
  });
}

export function deleteTeacherAccount(teacherId) {
  if (!hasRole('admin')) throw new Error('Only administrators can remove teacher accounts.');
  let users = getStoredUsers();
  users = users.filter(u => u.id !== teacherId || u.email === 'admin@almiftahu.edu');
  saveStoredUsers(users);
}

export function logoutUser() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem('teacher_session_token');
  try {
    rpc('teacher_logout').catch(() => {});
  } catch (_) {}
}

export function switchPersona(role) {
  const users = getStoredUsers();
  const target = users.find(u => u.role === role);
  if (target) {
    loginUser(target.email, target.password);
  }
}
