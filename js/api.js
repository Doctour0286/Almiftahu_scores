// Supabase client + the rpc() wrapper and error map (PRD §10.3, §8.5).
// supabase-js is vendored at an exact version (D-39); there is no CDN at runtime.
import { createClient } from '../vendor/supabase-js-2.117.2.esm.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, TEACHER_TOKEN_KEY, PAGE_SIZE } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // No user accounts: never persist or refresh an auth session.
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ---------- teacher token (sessionStorage only; closing the tab ends the session) ----------
export function getToken() { try { return sessionStorage.getItem(TEACHER_TOKEN_KEY) || ''; } catch (e) { return ''; } }
export function setToken(t) { try { sessionStorage.setItem(TEACHER_TOKEN_KEY, t); } catch (e) { /* storage blocked */ } }
export function clearToken() { try { sessionStorage.removeItem(TEACHER_TOKEN_KEY); } catch (e) { /* ignore */ } }

// Other modules listen for 'teacher-expired' (an admin call was rejected with E_AUTH).
export const events = new EventTarget();

// ---------- errors ----------
export class ApiError extends Error {
  constructor(code, detail, message) {
    super(message || code);
    this.name = 'ApiError';
    this.code = code;            // server E_* code, 'E_NETWORK' or 'E_SERVER'
    this.detail = detail || '';  // server detail (minutes, count, human text)
  }
}

function toApiError(error) {
  const msg = String((error && error.message) || '');
  if (/^E_[A-Z_]+$/.test(msg)) return new ApiError(msg, error.details || '');
  if (!error.code) return new ApiError('E_NETWORK', msg);                 // fetch failed before any response
  return new ApiError('E_SERVER', msg, msg);
}

// Default client messages (PRD §8.5). `ctx` can override per call site: { E_AUTH: '...' }.
const MESSAGES = {
  E_AUTH: 'Please unlock teacher mode again.',
  E_LOCKED: (d) => `Too many attempts. Try again in ${d || 'a few'} minutes.`,
  E_NOT_FOUND: 'That item no longer exists. Refresh and try again.',
  E_VALIDATION: (d) => d || 'Please check the highlighted values and try again.',
  E_CONFIRM_REQUIRED: 'This change needs confirmation.',
  E_HAS_CERTIFICATE: "This student has a certificate and can't be deleted.",
  E_NETWORK: 'Could not reach the server. Check your connection and try again.',
  E_SESSION_REPLACED: 'This exam was opened on another device or tab.',
  E_ATTEMPT_EXISTS: 'You have already submitted this exam.',
  E_ATTEMPT_CLOSED: 'Time is up. Your exam has been submitted.',
  E_EXPIRED: 'Time is up. Your exam has been submitted.',
  E_NO_LIVE_EXAM: "The exam isn't available yet.",
  E_NOT_ELIGIBLE: 'You are not yet eligible to sit this exam.',
  E_NOT_READY: 'Your result is still being marked.',
  E_REVIEW_DISABLED: "Answer review isn't available for this course.",
  E_NO_ARABIC_NAME: "Add the student's Arabic name first.",
};
export function errorMessage(err, ctx = {}) {
  if (!err) return 'Something went wrong. Try again.';
  const code = err.code;
  const m = ctx[code] !== undefined ? ctx[code] : MESSAGES[code];
  if (typeof m === 'function') return m(err.detail);
  if (m) return m;
  return err.message || 'Something went wrong. Try again.';
}

// ---------- rpc ----------
const TOKEN_RPCS = new Set(['teacher_logout', 'teacher_ping', 'teacher_change_pin']);

export async function rpc(name, args = {}) {
  const isAdmin = name.startsWith('admin_');
  const payload = (isAdmin || TOKEN_RPCS.has(name)) ? { p_token: getToken(), ...args } : args;
  let res;
  try {
    res = await sb.rpc(name, payload);
  } catch (e) {
    throw new ApiError('E_NETWORK', String(e && e.message));
  }
  let err = null;
  if (res.error) err = toApiError(res.error);
  else if (res.data && typeof res.data === 'object' && res.data.ok === false) {
    // teacher_login / teacher_change_pin report failures as data so the throttle counter persists
    err = new ApiError(res.data.error, res.data.detail);
  }
  if (err) {
    const sessionGone = err.code === 'E_AUTH' && (isAdmin || (name === 'teacher_change_pin' && err.detail !== 'current_pin'));
    if (sessionGone) events.dispatchEvent(new Event('teacher-expired'));
    throw err;
  }
  return res.data;
}

// ---------- paged select (PostgREST caps a response at PAGE_SIZE rows) ----------
export async function fetchAll(makeQuery) {
  const out = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let res;
    try { res = await makeQuery().range(from, from + PAGE_SIZE - 1); }
    catch (e) { throw new ApiError('E_NETWORK', String(e && e.message)); }
    if (res.error) throw toApiError(res.error);
    out.push(...res.data);
    if (res.data.length < PAGE_SIZE) return out;
  }
}
