import { useEffect, useState } from 'react';
import { rpc, authUpdate, RpcError } from './rpc';
import { errKey } from './i18n';
import TodayView from './Today';
import type { Session } from './session';

type T = (k: string) => string;
type Today = { items_done_today: number; sabqi: unknown[]; sabaq: { items: unknown[] } | null; manzil: unknown[] };
type Progress = { week: { day: string; done: boolean; rest: boolean; today: boolean }[]; keys: { lesson_id: string; title: string; overdue: boolean }[]; lessons_total: number; week_days_done: number; week_days_expected: number };
type Enrollment = { enrollment_id: string; course_name: string; days: number[] | null };

const Key = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="7.5" cy="12" r="4" /><path d="M11.5 12H21M18 12v4M21 12v3" /></svg>);

function Ring({ done, total }: { done: number; total: number }) {
  const C = 2 * Math.PI * 56; const f = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div className="ring"><svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
      <circle cx="66" cy="66" r="56" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="12" />
      <circle cx="66" cy="66" r="56" fill="none" stroke="#e0b84a" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - f)} transform="rotate(-90 66 66)" /></svg>
      <div className="ring-t"><b>{done}/{total}</b><small>questions</small></div></div>);
}

// Student app (concept A, PRD v4 §5): bottom navigation with Today · Keys · Courses · Me. One big daily action.
export default function StudentApp({ s, t, out }: { s: Session; t: T; out: () => void }) {
  const [tab, setTab] = useState<'today' | 'keys' | 'courses' | 'me'>('today');
  const [session, setSession] = useState(false); const [n, setN] = useState(0);
  const [today, setToday] = useState<Today | null>(null); const [prog, setProg] = useState<Progress | null>(null); const [err, setErr] = useState('');
  const fail = (e: unknown) => { const c = e instanceof RpcError ? e.code : ''; if (c === 'E_AUTH') return out(); setErr(t(errKey(c))); };
  useEffect(() => {
    if (session) return;
    Promise.all([rpc<Today>('student_wird_today', { p_token: s.token }), rpc<Progress>('student_progress', { p_token: s.token })]).then(([a, b]) => { setToday(a); setProg(b); }).catch(fail);
  }, [session, n]);

  const remaining = today ? today.sabqi.length + (today.sabaq?.items.length ?? 0) + today.manzil.length : 0;
  const total = today ? remaining + today.items_done_today : 0;
  const nav = (id: typeof tab, label: string) => <button role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setSession(false); }}>{label}</button>;

  return (
    <div className="app-s">
      <div className="greet"><div><small>{t('greet')}</small><h2>{s.name}</h2></div></div>
      {err && <p className="err" role="alert">{err}</p>}
      {tab === 'today' && session && (<><button className="link" onClick={() => { setSession(false); setN((x) => x + 1); }}>← {t('back')}</button><TodayView token={s.token} t={t} onAuthError={out} /></>)}
      {tab === 'today' && !session && (!today || !prog ? (!err && <p>{t('loading')}</p>) : (<>
        <section className="hero">
          <Ring done={today.items_done_today} total={total} />
          <div className="hero-b"><h3>{t('todaysWird')}</h3>
            <p>{total === 0 ? t('nothingDue') : remaining === 0 ? t('doneToday') : t('wirdBlurb')}</p>
            <button className="gold" disabled={remaining === 0} onClick={() => setSession(true)}>{today.items_done_today > 0 ? t('cont') : t('startWird')}</button></div>
        </section>
        <h4>{t('yourKeys')} <small>{prog.keys.length} / {prog.lessons_total}</small></h4>
        <div className="shelf">{Array.from({ length: Math.min(Math.max(prog.lessons_total, prog.keys.length), 6) }, (_, i) => <div key={i} className={`keycell ${i < prog.keys.length ? (prog.keys[i].overdue ? 'on dim' : 'on') : ''}`} title={prog.keys[i]?.overdue ? t('needsRevision') : undefined}><Key /></div>)}</div>
        {prog.keys.some((k) => k.overdue) && <p className="muted">{t('needsRevision')}</p>}
        <h4>{t('thisWeek')} <small>{prog.week_days_done} / {prog.week_days_expected} · {t('fridayRest')}</small></h4>
        <div className="week">{prog.week.map((w) => <div key={w.day} className={w.today ? 'today' : ''}><span className={`${w.done ? 'on' : ''} ${w.rest ? 'rest' : ''}`} /><small>{new Date(w.day + 'T12:00:00').toLocaleDateString(document.documentElement.lang || 'en', { weekday: 'narrow' })}</small></div>)}</div>
      </>))}
      {tab === 'keys' && <KeysView prog={prog} t={t} />}
      {tab === 'courses' && <Courses s={s} t={t} out={out} />}
      {tab === 'me' && <Account s={s} t={t} out={out} />}
      <nav className="bottom" role="tablist">{nav('today', t('today'))}{nav('keys', t('keysTab'))}{nav('courses', t('coursesTab'))}{nav('me', t('me'))}</nav>
    </div>);
}

function KeysView({ prog, t }: { prog: Progress | null; t: T }) {
  if (!prog) return <p>{t('loading')}</p>;
  return (
    <div className="stack"><h4>{t('yourKeys')} <small>{prog.keys.length} / {prog.lessons_total}</small></h4>
      {prog.keys.length === 0 && <p className="muted">{t('noKeysYet')}</p>}
      <ul className="list">{prog.keys.map((k) => <li key={k.lesson_id}><span className="keycell on sm"><Key size={20} /></span><span className="grow">{k.title}</span></li>)}</ul></div>);
}

function Courses({ s, t, out }: { s: Session; t: T; out: () => void }) {
  const [rows, setRows] = useState<Enrollment[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => { rpc<{ enrollments: Enrollment[] }>('student_me', { p_token: s.token }).then((r) => setRows(r.enrollments)).catch((e) => { if (e instanceof RpcError && e.code === 'E_AUTH') out(); else setErr(t(errKey(e instanceof RpcError ? e.code : ''))); }); }, []);
  return (
    <div className="stack">{err && <p className="err" role="alert">{err}</p>}{rows === null && !err && <p>{t('loading')}</p>}{rows?.length === 0 && <p>{t('noCourses')}</p>}
      {rows?.map((r) => <article className="card" key={r.enrollment_id}><h2>{r.course_name}</h2><p className="muted">{t('marks')}: {(r.days ?? []).reduce((x, y) => x + (y > 0 ? y : 0), 0)}</p></article>)}</div>);
}

function Account({ s, t, out }: { s: Session; t: T; out: () => void }) {
  const [pw, setPw] = useState(''); const [email, setEmail] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>, ok: string) => { setErr(''); setMsg(''); setBusy(true); try { await f(); setMsg(ok); } catch (e) { setErr(t(errKey(e instanceof RpcError ? e.code : ''))); } finally { setBusy(false); } };
  const needLogin = !s.access;
  return (
    <div className="stack">
      <div className="card stack"><h2>{s.name}</h2><p className="muted">{s.email}</p></div>
      {needLogin ? <p className="muted">{t('signInAgain')}</p> : (<>
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(async () => { if (pw.length < 8) throw new RpcError('E_VALIDATION'); await authUpdate(s.access!, { password: pw }); setPw(''); }, t('pwChanged')); }}>
          <label>{t('newPassword')}<input type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
          <button disabled={busy}>{t('savePassword')}</button></form>
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(async () => { await authUpdate(s.access!, { email: email.trim().toLowerCase() }); setEmail(''); }, t('emailSent')); }}>
          <label>{t('realEmail')}<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <p className="muted">{t('emailNote')}</p><button disabled={busy}>{t('changeEmail')}</button></form></>)}
      {msg && <p className="ok" role="status">{msg}</p>}{err && <p className="err" role="alert">{err}</p>}
      <button className="ghost" onClick={() => { rpc('student_logout', { p_token: s.token }).catch(() => {}); out(); }}>{t('signOut')}</button>
    </div>);
}
