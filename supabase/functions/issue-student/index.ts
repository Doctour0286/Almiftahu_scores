// issue-student: creates (or resets) a student's email + password account. Called by the staff app's "Access" tab.
// The service-role key lives ONLY here (Supabase injects it); it never reaches a browser.
// Deploy:  supabase functions deploy issue-student --no-verify-jwt     (we authenticate the caller ourselves: a valid staff session)
// Secrets: STUDENT_EMAIL_DOMAIN   e.g. students.yourdomain.org  (a domain you control, or a reserved one such as students.invalid; see docs/PRD-LMS-v4.md section 14b)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';   // no 0/O/1/l/I: it will be read off a card

function randomPassword(n = 10): string {
  const out: string[] = []; const buf = new Uint32Array(n * 2); crypto.getRandomValues(buf);
  for (let i = 0; out.length < n; i++) { if (buf[i] < Math.floor(0x100000000 / ALPHABET.length) * ALPHABET.length) out.push(ALPHABET[buf[i] % ALPHABET.length]); if (i >= buf.length - 1) { crypto.getRandomValues(buf); i = -1; } }
  return out.join('');
}
async function emailFor(studentId: string, domain: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mif:' + studentId));
  return `s-${[...new Uint8Array(d)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('')}@${domain}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'E_METHOD' });
  try {
    const { teacher_token, student_id } = await req.json();
    if (typeof teacher_token !== 'string' || typeof student_id !== 'string' || !teacher_token || !student_id) return reply(400, { error: 'E_VALIDATION' });
    const url = Deno.env.get('SUPABASE_URL')!; const anon = Deno.env.get('SUPABASE_ANON_KEY')!; const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const domain = Deno.env.get('STUDENT_EMAIL_DOMAIN');
    if (!domain) return reply(500, { error: 'E_CONFIG', detail: 'STUDENT_EMAIL_DOMAIN is not set' });

    // 1. the caller must hold a valid staff session (same check every admin_* RPC makes)
    const ping = await fetch(`${url}/rest/v1/rpc/teacher_ping`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: teacher_token }) });
    if (!ping.ok || (await ping.json()) !== true) return reply(401, { error: 'E_AUTH' });

    const admin = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });
    const link = await admin.rpc('service_student_link', { p_student_id: student_id });
    if (link.error) return reply(500, { error: 'E_INTERNAL' });
    if (!link.data?.student_exists) return reply(404, { error: 'E_NOT_FOUND' });

    const password = randomPassword(10);
    let userId: string | null = link.data.auth_user_id ?? null; let email: string;
    if (userId) {                                    // reset: keep whatever email the student has verified, change only the password
      const upd = await admin.auth.admin.updateUserById(userId, { password });
      if (upd.error || !upd.data.user) return reply(500, { error: 'E_INTERNAL' });
      email = upd.data.user.email ?? '';
    } else {
      email = await emailFor(student_id, domain);
      const made = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { student_id } });
      if (made.error || !made.data.user) return reply(409, { error: 'E_CONFLICT', detail: made.error?.message ?? 'create failed' });
      userId = made.data.user.id;
    }
    const linked = await admin.rpc('service_link_student', { p_student_id: student_id, p_auth_user_id: userId });
    if (linked.error) return reply(500, { error: 'E_INTERNAL' });
    return reply(200, { ok: true, email, password });   // shown once to the teacher; never stored or logged
  } catch {
    return reply(400, { error: 'E_VALIDATION' });
  }
});
