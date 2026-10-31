import { useEffect, useState } from 'react';
import { rpc, RpcError } from './rpc';
import { errKey } from './i18n';

type Person = { student_id: string; name: string; name_ar: string | null; days_since?: number | null; items?: number };
type Inbox = { summary: { enrolled: number; active_today: number }; inactive: Person[]; repair: Person[] };

// "Needs you": who to reach out to today. Students have no phone numbers on file, so a nudge is a message the teacher copies and sends themselves.
export default function InboxView({ token, t, onAuthError }: { token: string; t: (k: string) => string; onAuthError: () => void }) {
  const [d, setD] = useState<Inbox | null>(null); const [err, setErr] = useState(''); const [copied, setCopied] = useState('');
  useEffect(() => { rpc<Inbox>('teacher_inbox', { p_token: token }).then(setD).catch((e) => { const c = e instanceof RpcError ? e.code : ''; if (c === 'E_AUTH') onAuthError(); else setErr(t(errKey(c))); }); }, []);
  const nudge = async (p: Person) => {
    const msg = t('nudgeMsg').replace('{name}', p.name);
    try { await navigator.clipboard.writeText(msg); setCopied(p.student_id); } catch { window.prompt(t('copyNudge'), msg); }
  };
  if (err) return <p className="err" role="alert">{err}</p>;
  if (!d) return <p>{t('loading')}</p>;
  const stopped = d.inactive.filter((p) => p.days_since != null); const fresh = d.inactive.filter((p) => p.days_since == null);
  const pct = d.summary.enrolled ? Math.round((d.summary.active_today / d.summary.enrolled) * 100) : 0;
  const row = (p: Person, chip: string) => (
    <li key={p.student_id} className="prow">
      <span className="av" aria-hidden="true">{p.name.trim().charAt(0).toUpperCase()}</span>
      <span className="who"><b>{p.name}</b>{p.name_ar && <span className="ar" dir="rtl" lang="ar">{p.name_ar}</span>}</span>
      <span className="chip soft">{chip}</span>
      <button className="ghost sm" onClick={() => nudge(p)} aria-label={t('copyNudge')}>{copied === p.student_id ? '✓' : t('copyShort')}</button>
    </li>);
  return (
    <div className="stack">
      <section className="hero slim"><div className="num"><b>{d.summary.active_today}</b><span>/ {d.summary.enrolled}</span></div><p>{t('activeToday')}</p>
        <div className="bar-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div></section>
      {d.inactive.length === 0 && <p className="ok">{t('allGood')}</p>}
      {stopped.length > 0 && <><h4>{t('stopped')} <small>{stopped.length}</small></h4><ul className="plist">{stopped.map((p) => row(p, `${p.days_since} ${t('daysAgo')}`))}</ul></>}
      {fresh.length > 0 && <details open={stopped.length === 0}><summary><h4 style={{ display: 'inline' }}>{t('notStartedGroup')} <small>{fresh.length}</small></h4></summary>
        <ul className="plist">{fresh.map((p) => row(p, t('notStarted')))}</ul></details>}
      {d.repair.length > 0 && <><h4>{t('repairList')} <small>{d.repair.length}</small></h4>
        <ul className="plist">{d.repair.map((p) => (<li key={p.student_id} className="prow"><span className="av" aria-hidden="true">{p.name.trim().charAt(0).toUpperCase()}</span><span className="who"><b>{p.name}</b></span><span className="chip soft">{p.items}</span></li>))}</ul></>}
    </div>);
}
