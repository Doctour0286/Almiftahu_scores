import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { rpc, rpcOk, rpcAs, authPassword, authUpdate, callFunction, RpcError, configured } from './rpc';
import { loadSession, saveSession, type Session } from './session';
import { dicts, errKey, isRtl, type Lang } from './i18n';
import Scores from './Scores';
import Roster from './Roster';
import Lessons from './Lessons';
import InboxView from './Inbox';
import StudentApp from './Student';

type T = (k: string) => string;
type Enrollment = { enrollment_id: string; course_name: string; course_name_ar: string | null; days: number[] | null };
type Student = { id: string; name: string; name_ar: string | null };

export default function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [session, setSession] = useState<Session | null>(loadSession);
  const [view, setView] = useState<'home' | 'staff' | 'student'>('home');
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => { const f = () => setOffline(!navigator.onLine); window.addEventListener('online', f); window.addEventListener('offline', f); return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f); }; }, []);
  const t: T = (k) => dicts[lang][k] ?? dicts.en[k] ?? k;
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr'; }, [lang]);
  const update = (s: Session | null) => { saveSession(s); setSession(s); if (!s) setView('home'); };

  return (
    <main className="shell">
      <header className="top">
        <h1>{t('title')}</h1>
        <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
          <option value="en">English</option><option value="ha">Hausa</option><option value="ar">العربية</option>
        </select>
      </header>
      {offline && <p className="banner" role="status">{t('offline')}</p>}
      {!configured && <p className="err" role="alert">{t('eConfig')}</p>}
      {session?.kind === 'staff' && <StaffHome s={session} t={t} out={() => update(null)} />}
      {session?.kind === 'student' && (session.mustChange
        ? <ChangePassword s={session} t={t} done={() => update({ ...session, mustChange: false })} />
        : <StudentApp s={session} t={t} out={() => update(null)} />)}
      {!session && view === 'home' && (
        <div className="stack">
          <button className="big" onClick={() => setView('student')}>{t('student')}</button>
          <button className="big alt" onClick={() => setView('staff')}>{t('staff')}</button>
        </div>)}
      {!session && view === 'staff' && <StaffLogin t={t} back={() => setView('home')} ok={update} />}
      {!session && view === 'student' && <StudentLogin t={t} back={() => setView('home')} ok={update} />}
    </main>
  );
}

function useAction(t: T) {
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => {
    setErr(''); setBusy(true);
    try { await f(); } catch (e) { setErr(t(errKey(e instanceof RpcError ? e.code : ''))); } finally { setBusy(false); }
  };
  return { err, busy, run };
}

function StaffLogin({ t, back, ok }: { t: T; back: () => void; ok: (s: Session) => void }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const a = useAction(t);
  const submit = (e: FormEvent) => { e.preventDefault(); a.run(async () => {
    const r = await rpcOk<{ token: string; user: { name: string; role: string } }>('staff_login', { p_email: email, p_password: pw });
    ok({ kind: 'staff', token: r.token, name: r.user.name, role: r.user.role });
  }); };
  return (
    <form className="card stack" onSubmit={submit}>
      <label>{t('email')}<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>{t('password')}<input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
      {a.err && <p className="err" role="alert">{a.err}</p>}
      <button className="big" disabled={a.busy}>{t('signIn')}</button>
      <button type="button" className="link" onClick={back}>{t('back')}</button>
    </form>);
}

function StudentLogin({ t, back, ok }: { t: T; back: () => void; ok: (s: Session) => void }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const a = useAction(t);
  const submit = (e: FormEvent) => { e.preventDefault(); a.run(async () => {
    const au = await authPassword(email, pw);
    const r = await rpcAs<{ token: string; student: { name: string; must_change: boolean } }>('student_session', au.access_token);
    ok({ kind: 'student', token: r.token, name: r.student.name, mustChange: r.student.must_change, access: au.access_token, email: au.user.email });
  }); };
  return (
    <form className="card stack" onSubmit={submit}>
      <label>{t('email')}<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>{t('password')}<input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
      {a.err && <p className="err" role="alert">{a.err}</p>}
      <button className="big" disabled={a.busy}>{t('signIn')}</button>
      <button type="button" className="link" onClick={back}>{t('back')}</button>
    </form>);
}

function ChangePassword({ s, t, done }: { s: Session; t: T; done: () => void }) {
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const a = useAction(t);
  const submit = (e: FormEvent) => { e.preventDefault(); a.run(async () => {
    if (pw.length < 8) throw new RpcError('E_VALIDATION');
    if (pw !== pw2) throw new RpcError('E_MISMATCH');
    await authUpdate(s.access!, { password: pw });
    await rpcAs('student_password_changed', s.access!); done();
  }); };
  return (
    <form className="card stack" onSubmit={submit}>
      <p>{t('welcome')}, {s.name}. {t('mustChangePw')}</p>
      <label>{t('newPassword')}<input type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
      <label>{t('repeatPassword')}<input type="password" autoComplete="new-password" minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} required /></label>
      {a.err && <p className="err" role="alert">{a.err}</p>}
      <button className="big" disabled={a.busy}>{t('savePassword')}</button>
    </form>);
}

function StaffHome({ s, t, out }: { s: Session; t: T; out: () => void }) {
  const [tab, setTab] = useState<'inbox' | 'scores' | 'roster' | 'lessons' | 'access'>('inbox');
  return (
    <section className="stack">
      <div className="bar"><strong>{t('welcome')}, {s.name}</strong>
        <button className="link" onClick={() => { rpc('teacher_logout', { p_token: s.token }).catch(() => {}); out(); }}>{t('signOut')}</button></div>
      <div className="app-s">{tab === 'inbox' ? <InboxView token={s.token} t={t} onAuthError={out} /> : tab === 'scores' ? <Scores token={s.token} t={t} onAuthError={out} /> : tab === 'roster' ? <Roster token={s.token} t={t} onAuthError={out} /> : tab === 'lessons' ? <Lessons token={s.token} t={t} onAuthError={out} /> : <StudentAccess s={s} t={t} out={out} />}</div>
      <nav className="bottom" role="tablist">
        {([['inbox','inbox'],['scores','scores'],['roster','roster'],['lessons','lessons'],['access','navAccess']] as const).map(([id, k]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{t(k)}</button>)}
      </nav>
    </section>);
}

function StudentAccess({ s, t, out }: { s: Session; t: T; out: () => void }) {
  const [list, setList] = useState<Student[] | null>(null); const [q, setQ] = useState(''); const [linked, setLinked] = useState<Set<string>>(new Set());
  const [issued, setIssued] = useState<{ name: string; email: string; password: string } | null>(null); const a = useAction(t);
  const load = () => a.run(async () => {
    setList(await rpc<Student[]>('admin_list_students_all', { p_token: s.token }));
    setLinked(new Set((await rpc<{ student_id: string }[]>('admin_list_student_accounts', { p_token: s.token }).catch(() => [])).map((x) => x.student_id)));
  });
  useEffect(() => { load(); }, []);
  useEffect(() => { if (a.err === t('eAuth')) out(); }, [a.err]);
  const shown = useMemo(() => (list ?? []).filter((x) => (x.name + ' ' + (x.name_ar ?? '')).toLowerCase().includes(q.toLowerCase())), [list, q]);
  const issue = (st: Student) => { if (linked.has(st.id) && !window.confirm(t('confirmReset'))) return; a.run(async () => {
    const r = await callFunction<{ email: string; password: string }>('issue-student', { teacher_token: s.token, student_id: st.id });
    setIssued({ name: st.name, email: r.email, password: r.password }); setLinked((p) => new Set(p).add(st.id));
  }); };
  return (
    <section className="stack">
      <input type="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      {a.err && <p className="err" role="alert">{a.err}</p>}
      {list === null && !a.err && <p>{t('loading')}</p>}
      <ul className="plist">{shown.map((x) => (
        <li key={x.id} className="prow"><span className="av" aria-hidden="true">{x.name.trim().charAt(0).toUpperCase()}</span>
          <span className="who"><b>{x.name}</b>{x.name_ar && <span className="ar" dir="rtl" lang="ar">{x.name_ar}</span>}</span>
          {linked.has(x.id) && <span className="chip soft">{t('hasAccount')}</span>}
          <button className="ghost sm" onClick={() => issue(x)} disabled={a.busy}>{linked.has(x.id) ? t('resetPw') : t('issue')}</button></li>))}</ul>
      {issued && (
        <div className="modal" role="dialog" aria-modal="true"><div className="card stack">
          <h2>{issued.name}</h2><p>{t('issuedPw')}</p>
          <p className="cred"><span>{t('email')}</span><b style={{ letterSpacing: 0, fontSize: '1rem', overflowWrap: 'anywhere' }}>{issued.email}</b></p>
          <p className="cred"><span>{t('password')}</span><b>{issued.password}</b></p>
          <button className="big" onClick={() => setIssued(null)}>{t('done')}</button>
        </div></div>)}
    </section>);
}
