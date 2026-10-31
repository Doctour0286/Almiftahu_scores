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
  return (
    <div className="stack">
      <section className="hero"><div className="hero-b"><h3>{d.summary.active_today} / {d.summary.enrolled}</h3><p>{t('activeToday')}</p></div></section>
      <h4>{t('needsYou')} <small>{d.inactive.length}</small></h4>
      {d.inactive.length === 0 && <p className="ok">{t('allGood')}</p>}
      <ul className="list">{d.inactive.map((p) => (
        <li key={p.student_id}><span className="grow">{p.name}{p.name_ar ? ` · ${p.name_ar}` : ''}<small className="muted"> · {p.days_since == null ? t('notStarted') : `${p.days_since} ${t('daysAgo')}`}</small></span>
          <button className="ghost" onClick={() => nudge(p)}>{copied === p.student_id ? t('copied') : t('copyNudge')}</button></li>))}</ul>
      {d.repair.length > 0 && <><h4>{t('repairList')} <small>{d.repair.length}</small></h4>
        <ul className="list">{d.repair.map((p) => <li key={p.student_id}><span className="grow">{p.name}</span><small className="muted">{p.items}</small></li>)}</ul></>}
    </div>);
}
