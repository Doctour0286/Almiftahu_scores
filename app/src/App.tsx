import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { rpc, rpcOk, RpcError, configured } from './rpc';
import { loadSession, saveSession, type Session } from './session';
import { dicts, errKey, isRtl, type Lang } from './i18n';
import Scores from './Scores';

type T = (k: string) => string;
type Enrollment = { enrollment_id: string; course_name: string; course_name_ar: string | null; days: number[] | null };
type Student = { id: string; name: string; name_ar: string | null };

export default function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [session, setSession] = useState<Session | null>(loadSession);
  const [view, setView] = useState<'home' | 'staff' | 'student'>('home');
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
      {!configured && <p className="err" role="alert">{t('eConfig')}</p>}
      {session?.kind === 'staff' && <StaffHome s={session} t={t} out={() => update(null)} />}
      {session?.kind === 'student' && (session.mustChange
        ? <ChangePin s={session} t={t} done={() => update({ ...session, mustChange: false })} />
        : <StudentHome s={session} t={t} out={() => update(null)} />)}
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
  const [code, setCode] = useState(''); const [pin, setPin] = useState(''); const a = useAction(t);
  const submit = (e: FormEvent) => { e.preventDefault(); a.run(async () => {
    const r = await rpcOk<{ token: string; student: { name: string; must_change: boolean } }>('student_login', { p_code: code, p_pin: pin });
    ok({ kind: 'student', token: r.token, name: r.student.name, mustChange: r.student.must_change });
  }); };
  return (
    <form className="card stack" onSubmit={submit}>
      <label>{t('code')}<input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="username" required /></label>
      <label>{t('pin')}<input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} required /></label>
      {a.err && <p className="err" role="alert">{a.err}</p>}
      <button className="big" disabled={a.busy}>{t('signIn')}</button>
      <button type="button" className="link" onClick={back}>{t('back')}</button>
    </form>);
}

function ChangePin({ s, t, done }: { s: Session; t: T; done: () => void }) {
  const [oldPin, setOld] = useState(''); const [newPin, setNew] = useState(''); const a = useAction(t);
  const submit = (e: FormEvent) => { e.preventDefault(); a.run(async () => { await rpcOk('student_change_pin', { p_token: s.token, p_old: oldPin, p_new: newPin }); done(); }); };
  return (
    <form className="card stack" onSubmit={submit}>
      <p>{t('welcome')}, {s.name}. {t('mustChange')}</p>
      <label>{t('oldPin')}<input type="password" inputMode="numeric" pattern="[0-9]*" value={oldPin} onChange={(e) => setOld(e.target.value)} required /></label>
      <label>{t('newPin')}<input type="password" inputMode="numeric" pattern="[0-9]{4,6}" value={newPin} onChange={(e) => setNew(e.target.value)} required /></label>
      {a.err && <p className="err" role="alert">{a.err}</p>}
      <button className="big" disabled={a.busy}>{t('savePin')}</button>
    </form>);
}

function StudentHome({ s, t, out }: { s: Session; t: T; out: () => void }) {
  const [rows, setRows] = useState<Enrollment[] | null>(null); const a = useAction(t);
  useEffect(() => { a.run(async () => { setRows((await rpc<{ enrollments: Enrollment[] }>('student_me', { p_token: s.token })).enrollments); }); }, []);
  useEffect(() => { if (a.err === t('eAuth')) out(); }, [a.err]);
  return (
    <section className="stack">
      <div className="bar"><strong>{t('welcome')}, {s.name}</strong><button className="link" onClick={() => { rpc('student_logout', { p_token: s.token }).catch(() => {}); out(); }}>{t('signOut')}</button></div>
      {a.err && <p className="err" role="alert">{a.err}</p>}
      {rows === null && !a.err && <p>{t('loading')}</p>}
      {rows?.length === 0 && <p>{t('noCourses')}</p>}
      {rows?.map((r) => (
        <article className="card" key={r.enrollment_id}>
          <h2>{r.course_name}</h2>
          <p className="muted">{t('marks')}: {(r.days ?? []).reduce((x, y) => x + (y > 0 ? y : 0), 0)}</p>
        </article>))}
    </section>);
}

function StaffHome({ s, t, out }: { s: Session; t: T; out: () => void }) {
  const [tab, setTab] = useState<'scores' | 'access'>('scores');
  return (
    <section className="stack">
      <div className="bar"><strong>{t('welcome')}, {s.name}</strong>
        <button className="link" onClick={() => { rpc('teacher_logout', { p_token: s.token }).catch(() => {}); out(); }}>{t('signOut')}</button></div>
      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'scores'} onClick={() => setTab('scores')}>{t('scores')}</button>
        <button role="tab" aria-selected={tab === 'access'} onClick={() => setTab('access')}>{t('access')}</button>
      </nav>
      {tab === 'scores' ? <Scores token={s.token} t={t} onAuthError={out} /> : <StudentAccess s={s} t={t} out={out} />}
    </section>);
}

function StudentAccess({ s, t, out }: { s: Session; t: T; out: () => void }) {
  const [list, setList] = useState<Student[] | null>(null); const [q, setQ] = useState('');
  const [issued, setIssued] = useState<{ name: string; login_code: string; pin: string } | null>(null); const a = useAction(t);
  useEffect(() => { a.run(async () => { setList(await rpc<Student[]>('admin_list_students_all', { p_token: s.token })); }); }, []);
  useEffect(() => { if (a.err === t('eAuth')) out(); }, [a.err]);
  const shown = useMemo(() => (list ?? []).filter((x) => (x.name + ' ' + (x.name_ar ?? '')).toLowerCase().includes(q.toLowerCase())), [list, q]);
  const issue = (st: Student) => a.run(async () => {
    const r = await rpc<{ login_code: string; pin: string }>('admin_set_student_pin', { p_token: s.token, p_student_id: st.id });
    setIssued({ name: st.name, login_code: r.login_code, pin: r.pin });
  });
  return (
    <section className="stack">
      <input type="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      {a.err && <p className="err" role="alert">{a.err}</p>}
      {list === null && !a.err && <p>{t('loading')}</p>}
      <ul className="list">{shown.map((x) => (
        <li key={x.id}><span>{x.name}{x.name_ar ? ` · ${x.name_ar}` : ''}</span><button onClick={() => issue(x)} disabled={a.busy}>{t('issue')}</button></li>))}</ul>
      {issued && (
        <div className="modal" role="dialog" aria-modal="true"><div className="card stack">
          <h2>{issued.name}</h2><p>{t('issued')}</p>
          <p className="cred"><span>{t('code')}</span><b>{issued.login_code}</b></p>
          <p className="cred"><span>{t('pin')}</span><b>{issued.pin}</b></p>
          <button className="big" onClick={() => setIssued(null)}>{t('done')}</button>
        </div></div>)}
    </section>);
}
