export type Session = { kind: 'staff' | 'student'; token: string; name: string; role?: string; mustChange?: boolean };
const K = 'mif.session';
export function loadSession(): Session | null {
  try { const s = sessionStorage.getItem(K); return s ? (JSON.parse(s) as Session) : null; } catch { return null; }
}
export function saveSession(s: Session | null) {
  try { s ? sessionStorage.setItem(K, JSON.stringify(s)) : sessionStorage.removeItem(K); } catch { /* storage unavailable: stay signed in for this tab only */ }
}
