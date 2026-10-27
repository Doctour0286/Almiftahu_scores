import { useEffect, useState, type FormEvent } from 'react';
import { rpc, readPublic, RpcError } from './rpc';
import { errKey } from './i18n';
import { parseBulk } from './parse';

type T = (k: string) => string;
type Course = { id: string; name: string };
type Lesson = { id: string; position: number; title: string; status: 'draft' | 'published'; items: number; learners: number };
type Draft = { type: 'recall' | 'mcq'; prompt: string; answer: string; alts: string; options: string[]; correct: number };
const blank = (type: Draft['type'] = 'recall'): Draft => ({ type, prompt: '', answer: '', alts: '', options: ['', ''], correct: 0 });

export default function Lessons({ token, t, onAuthError }: { token: string; t: T; onAuthError: () => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null); const [cid, setCid] = useState(''); const [rows, setRows] = useState<Lesson[] | null>(null);
  const [mode, setMode] = useState<'list' | 'edit' | 'import'>('list'); const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const fail = (e: unknown) => { const c = e instanceof RpcError ? e.code : ''; if (c === 'E_AUTH') return onAuthError(); setErr(c === 'E_VALIDATION' && e instanceof RpcError && e.detail ? e.detail : t(errKey(c))); };
  useEffect(() => { readPublic<Course[]>('courses?select=id,name&status=eq.active&order=name').then((c) => { setCourses(c); if (c[0]) setCid(c[0].id); }).catch(fail); }, []);
  const load = () => rpc<Lesson[]>('admin_list_lessons', { p_token: token, p_course_id: cid }).then(setRows).catch(fail);
  useEffect(() => { if (cid) { setRows(null); setErr(''); setMode('list'); load(); } }, [cid]);
  const act = async (f: () => Promise<unknown>) => { setErr(''); setBusy(true); try { await f(); await load(); } catch (e) { fail(e); } finally { setBusy(false); } };
  const move = (i: number, d: -1 | 1) => act(async () => {   // reassign positions 1..n in the new order; only changed ones are sent
    const order = [...rows!]; const j = i + d; if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]];
    for (let k = 0; k < order.length; k++) if (order[k].position !== k + 1) await rpc('admin_set_lesson_position', { p_token: token, p_lesson_id: order[k].id, p_position: k + 1 });
  });
  if (courses === null && !err) return <p>{t('loading')}</p>;

  if (mode === 'edit') return <Editor token={token} t={t} cid={cid} id={editId} fail={fail} done={() => { setMode('list'); load(); }} />;
  if (mode === 'import') return <Import token={token} t={t} cid={cid} fail={fail} done={() => { setMode('list'); load(); }} />;
  return (
    <div className="stack">
      <label>{t('course')}<select value={cid} onChange={(e) => setCid(e.target.value)}>{courses?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <div className="row2b"><button onClick={() => { setEditId(null); setMode('edit'); }} disabled={!cid}>{t('newLesson')}</button><button className="ghost" onClick={() => setMode('import')} disabled={!cid}>{t('import')}</button></div>
      {err && <p className="err" role="alert">{err}</p>}
      {rows === null && !err && <p>{t('loading')}</p>}
      <ul className="list">{rows?.map((l, i) => (
        <li key={l.id}><span className="grow"><b>{l.position}.</b> {l.title}<small className="muted"> · {l.items} {t('itemsLbl')} · {l.learners} {t('learners')} · {t(l.status)}</small></span>
          <button className="ghost sm" disabled={busy || i === 0} aria-label="up" onClick={() => move(i, -1)}>↑</button>
          <button className="ghost sm" disabled={busy || i === rows.length - 1} aria-label="down" onClick={() => move(i, 1)}>↓</button>
          <button className="ghost" onClick={() => { setEditId(l.id); setMode('edit'); }}>{t('edit')}</button>
          <button className={l.status === 'published' ? 'ghost' : ''} disabled={busy} onClick={() => act(() => rpc('admin_publish_lesson', { p_token: token, p_lesson_id: l.id, p_publish: l.status !== 'published' }))}>{l.status === 'published' ? t('unpublish') : t('publish')}</button>
          <button className="ghost sm" disabled={busy} aria-label="delete" onClick={() => window.confirm(t('confirmDelete')) && act(() => rpc('admin_delete_lesson', { p_token: token, p_lesson_id: l.id }))}>✕</button></li>))}</ul>
    </div>);
}

function Editor({ token, t, cid, id, fail, done }: { token: string; t: T; cid: string; id: string | null; fail: (e: unknown) => void; done: () => void }) {
  const [title, setTitle] = useState(''); const [titleAr, setTitleAr] = useState(''); const [body, setBody] = useState(''); const [items, setItems] = useState<Draft[]>([blank()]);
  const [locked, setLocked] = useState(false); const [loaded, setLoaded] = useState(id === null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!id) return; rpc<any>('admin_get_lesson', { p_token: token, p_lesson_id: id }).then((l) => {
    setTitle(l.title); setTitleAr(l.title_ar ?? ''); setBody(l.body); setLocked(l.locked); setLoaded(true);
    setItems(l.items.length ? l.items.map((x: any): Draft => x.type === 'mcq'
      ? { type: 'mcq', prompt: x.prompt, answer: '', alts: '', options: x.options.map((o: any) => o.text), correct: Math.max(0, x.options.findIndex((o: any) => o.id === x.answer)) }
      : { type: 'recall', prompt: x.prompt, answer: x.answer, alts: (x.alts ?? []).join(' ; '), options: ['', ''], correct: 0 }) : [blank()]);
  }).catch(fail); }, []);
  const set = (i: number, p: Partial<Draft>) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true);
    try {
      const data: Record<string, unknown> = { title, title_ar: titleAr, body };
      if (!locked) data.items = items.filter((x) => x.prompt.trim()).map((x) => x.type === 'mcq'
        ? { type: 'mcq', prompt: x.prompt, answer: String.fromCharCode(97 + x.correct), options: x.options.map((text, k) => ({ id: String.fromCharCode(97 + k), text })).filter((o) => o.text.trim()) }
        : { type: 'recall', prompt: x.prompt, answer: x.answer, alts: x.alts.split(/[;؛]/).map((a) => a.trim()).filter(Boolean) });
      await rpc('admin_save_lesson', { p_token: token, p_lesson_id: id, p_course_id: cid, p_data: data }); done();
    } catch (e2) { fail(e2); setBusy(false); } };
  if (!loaded) return <p>{t('loading')}</p>;
  return (
    <form className="stack" onSubmit={submit}>
      <input placeholder={t('lessonTitle')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
      <input placeholder={t('titleAr')} value={titleAr} onChange={(e) => setTitleAr(e.target.value)} dir="rtl" maxLength={200} />
      <textarea rows={4} placeholder={t('lessonBody')} value={body} onChange={(e) => setBody(e.target.value)} />
      {locked && <p className="muted">{t('lockedNote')}</p>}
      {!locked && items.map((x, i) => (
        <div className="card stack" key={i}>
          <div className="row2b"><select value={x.type} onChange={(e) => set(i, { type: e.target.value as Draft['type'] })}><option value="recall">{t('typeRecall')}</option><option value="mcq">{t('typeMcq')}</option></select>
            <button type="button" className="ghost sm" aria-label="remove" onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))}>✕</button></div>
          <input placeholder={t('promptLbl')} value={x.prompt} onChange={(e) => set(i, { prompt: e.target.value })} maxLength={1000} />
          {x.type === 'recall' ? (<>
            <input placeholder={t('answerLbl')} value={x.answer} onChange={(e) => set(i, { answer: e.target.value })} />
            <input placeholder={t('altsLbl')} value={x.alts} onChange={(e) => set(i, { alts: e.target.value })} /></>) : (<>
            {x.options.map((o, k) => (
              <label key={k} className="opt-row"><input type="radio" name={`c${i}`} checked={x.correct === k} onChange={() => set(i, { correct: k })} aria-label={t('correctOpt')} />
                <input placeholder={`${t('optionLbl')} ${k + 1}`} value={o} onChange={(e) => set(i, { options: x.options.map((v, m) => (m === k ? e.target.value : v)) })} /></label>))}
            {x.options.length < 6 && <button type="button" className="ghost" onClick={() => set(i, { options: [...x.options, ''] })}>+ {t('optionLbl')}</button>}</>)}
        </div>))}
      {!locked && <button type="button" className="ghost" onClick={() => setItems((xs) => [...xs, blank()])}>+ {t('addItem')}</button>}
      <div className="row2b"><button disabled={busy}>{t('saveLesson')}</button><button type="button" className="ghost" onClick={done}>{t('back')}</button></div>
    </form>);
}

function Import({ token, t, cid, fail, done }: { token: string; t: T; cid: string; fail: (e: unknown) => void; done: () => void }) {
  const [text, setText] = useState(''); const [log, setLog] = useState(''); const [busy, setBusy] = useState(false);
  const parsed = parseBulk(text);
  const run = async () => { setBusy(true); let ok = 0;
    for (const l of parsed.lessons) {
      try { await rpc('admin_save_lesson', { p_token: token, p_lesson_id: null, p_course_id: cid, p_data: { title: l.title, title_ar: l.title_ar ?? '', body: l.body, items: l.items } }); ok++; setLog(`${ok} / ${parsed.lessons.length}`); }
      catch (e) { fail(e); break; }
    }
    setBusy(false); if (ok === parsed.lessons.length) done(); };
  return (
    <div className="stack">
      <p className="muted prewrap">{t('importHelp')}</p>
      <textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} placeholder={'# Lesson title | العنوان\n> Lesson text\nprompt || answer || other answer ; another\n? question || right | wrong | wrong'} />
      <p>{parsed.lessons.length} {t('lessonsLbl')} · {parsed.lessons.reduce((n, l) => n + l.items.length, 0)} {t('itemsLbl')}</p>
      {parsed.errors.length > 0 && <ul className="err">{parsed.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul>}
      {log && <p className="ok">{log}</p>}
      <div className="row2b"><button disabled={busy || parsed.errors.length > 0 || parsed.lessons.length === 0} onClick={run}>{t('importRun')}</button><button className="ghost" onClick={done}>{t('back')}</button></div>
    </div>);
}
