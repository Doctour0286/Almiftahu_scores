import { useEffect, useState } from 'react';
import { rpc, RpcError } from './rpc';
import { errKey } from './i18n';

type Item = { id: string; type: 'recall' | 'mcq'; prompt: string; options: { id: string; text: string }[] | null };
type Today = { paused_new: boolean; repair: number; items_done_today: number; sabqi: Item[]; sabaq: { title: string; title_ar: string | null; body: string; items: Item[] } | null; manzil: Item[] };
type Progress = { keys: { lesson_id: string; title: string }[]; lessons_total: number; week_days_done: number; week_days_expected: number };
type Step = { station: 'sabqi' | 'sabaq' | 'manzil'; item?: Item; read?: { title: string; body: string } };
type Result = { correct: boolean; answer: string; key_earned: boolean };

// The daily Wird (PRD 6.1): recent revision, one new lesson, older revision, then a clear finish. No "one more round" prompt.
export default function TodayView({ token, t, onAuthError }: { token: string; t: (k: string) => string; onAuthError: () => void }) {
  const [data, setData] = useState<Today | null>(null); const [prog, setProg] = useState<Progress | null>(null);
  const [steps, setSteps] = useState<Step[]>([]); const [i, setI] = useState(0); const [val, setVal] = useState('');
  const [res, setRes] = useState<Result | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [keys, setKeys] = useState(0);
  const fail = (e: unknown) => { const c = e instanceof RpcError ? e.code : ''; if (c === 'E_AUTH') return onAuthError(); setErr(t(errKey(c))); };

  const load = async () => {
    try {
      const [d, p] = await Promise.all([rpc<Today>('student_wird_today', { p_token: token }), rpc<Progress>('student_progress', { p_token: token })]);
      setData(d); setProg(p); setI(0); setRes(null); setVal('');
      setSteps([
        ...d.sabqi.map((item) => ({ station: 'sabqi' as const, item })),
        ...(d.sabaq ? [{ station: 'sabaq' as const, read: { title: d.sabaq.title, body: d.sabaq.body } }, ...d.sabaq.items.map((item) => ({ station: 'sabaq' as const, item }))] : []),
        ...d.manzil.map((item) => ({ station: 'manzil' as const, item })),
      ]);
    } catch (e) { fail(e); }
  };
  useEffect(() => { load(); }, []);

  const step = steps[i];
  const check = async (response: string) => {
    if (!step?.item || busy) return; setBusy(true); setErr('');
    try {
      const r = await rpc<Result>('student_wird_answer', { p_token: token, p_item_id: step.item.id, p_response: response });
      setRes(r); if (r.key_earned) setKeys((k) => k + 1);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const next = () => { setRes(null); setVal(''); setI((x) => x + 1); if (i + 1 >= steps.length) load(); };

  if (!data && !err) return <p>{t('loading')}</p>;
  if (err && !data) return <p className="err" role="alert">{err}</p>;
  const finished = steps.length === 0 || i >= steps.length;
  if (finished) {
    return (
      <div className="card stack center">
        <h2>{data!.items_done_today > 0 || steps.length > 0 ? t('doneToday') : t('nothingDue')}</h2>
        {data!.paused_new && <p className="muted">{t('pausedNew')}</p>}
        {prog && <>
          <p className="big-num">{prog.week_days_done}<small> / {prog.week_days_expected}</small></p><p className="muted">{t('weekDays')}</p>
          <p>🔑 {prog.keys.length} <span className="muted">/ {prog.lessons_total} {t('keysLabel')}</span></p></>}
        {keys > 0 && <p className="ok">🔑 +{keys}</p>}
        <p className="muted">{t('comeBack')}</p>
      </div>);
  }
  return (
    <div className="stack">
      <div className="bar"><span className={`chip ${step.station}`}>{t(step.station)}</span><span className="muted">{i + 1} / {steps.length}</span></div>
      <progress value={i} max={steps.length} aria-hidden="true" />
      {err && <p className="err" role="alert">{err}</p>}
      {step.read ? (
        <div className="card stack"><h2>{step.read.title}</h2><p className="prewrap">{step.read.body}</p><button className="big" onClick={next}>{t('startItems')}</button></div>
      ) : (
        <div className="card stack">
          <p className="prompt">{step.item!.prompt}</p>
          {!res && step.item!.type === 'recall' && (<>
            <input value={val} onChange={(e) => setVal(e.target.value)} placeholder={t('typeAnswer')} autoFocus autoComplete="off" onKeyDown={(e) => e.key === 'Enter' && val.trim() && check(val)} />
            <button className="big" disabled={busy || !val.trim()} onClick={() => check(val)}>{t('check')}</button></>)}
          {!res && step.item!.type === 'mcq' && step.item!.options?.map((o) => <button key={o.id} className="opt" disabled={busy} onClick={() => check(o.id)}>{o.text}</button>)}
          {res && (<>
            <p className={res.correct ? 'ok' : 'err'} role="status">{res.correct ? t('correct') : t('incorrect')}</p>
            {!res.correct && <p>{t('answerWas')}: <b>{step.item!.type === 'mcq' ? step.item!.options?.find((o) => o.id === res.answer)?.text : res.answer}</b></p>}
            {res.key_earned && <p className="ok">🔑 {t('keyEarned')}</p>}
            <button className="big" onClick={next}>{t('next')}</button></>)}
        </div>)}
    </div>);
}
