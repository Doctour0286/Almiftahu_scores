import { useEffect, useState, type FormEvent } from 'react';
import { rpc, readPublic, RpcError } from './rpc';
import { errKey } from './i18n';

type Course = { id: string; name: string };
type Lesson = { id: string; position: number; title: string; status: 'draft' | 'published'; items: number; learners: number };

// Teacher authoring: one lesson per form. Items are one per line:  prompt || answer || alt1 ; alt2   (alternates are optional).
export default function Lessons({ token, t, onAuthError }: { token: string; t: (k: string) => string; onAuthError: () => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null); const [cid, setCid] = useState(''); const [rows, setRows] = useState<Lesson[] | null>(null);
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [lines, setLines] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const fail = (e: unknown) => { const c = e instanceof RpcError ? e.code : ''; if (c === 'E_AUTH') return onAuthError(); setErr(c === 'E_VALIDATION' && e instanceof RpcError && e.detail ? e.detail : t(errKey(c))); };
  useEffect(() => { readPublic<Course[]>('courses?select=id,name&status=eq.active&order=name').then((c) => { setCourses(c); if (c[0]) setCid(c[0].id); }).catch(fail); }, []);
  const load = () => rpc<Lesson[]>('admin_list_lessons', { p_token: token, p_course_id: cid }).then(setRows).catch(fail);
  useEffect(() => { if (cid) { setRows(null); setErr(''); load(); } }, [cid]);
  const act = async (f: () => Promise<unknown>) => { setErr(''); setBusy(true); try { await f(); await load(); } catch (e) { fail(e); } finally { setBusy(false); } };

  const submit = (e: FormEvent) => { e.preventDefault(); act(async () => {
    const items = lines.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [prompt, answer, alts] = l.split('||').map((x) => x.trim());
      return { type: 'recall', prompt, answer, alts: alts ? alts.split(';').map((a) => a.trim()).filter(Boolean) : [] };
    });
    await rpc('admin_save_lesson', { p_token: token, p_lesson_id: null, p_course_id: cid, p_data: { title, body, items } });
    setTitle(''); setBody(''); setLines('');
  }); };

  if (courses === null && !err) return <p>{t('loading')}</p>;
  return (
    <div className="stack">
      <label>{t('course')}<select value={cid} onChange={(e) => setCid(e.target.value)}>{courses?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {err && <p className="err" role="alert">{err}</p>}
      {rows === null && !err && <p>{t('loading')}</p>}
      <ul className="list">{rows?.map((l) => (
        <li key={l.id}><span className="grow"><b>{l.position}.</b> {l.title}<small className="muted"> · {l.items} {t('itemsLbl')} · {l.learners} {t('learners')} · {t(l.status)}</small></span>
          <button className={l.status === 'published' ? 'ghost' : ''} disabled={busy}
            onClick={() => act(() => rpc('admin_publish_lesson', { p_token: token, p_lesson_id: l.id, p_publish: l.status !== 'published' }))}>
            {l.status === 'published' ? t('unpublish') : t('publish')}</button></li>))}</ul>
      <form className="card stack" onSubmit={submit}>
        <h2>{t('newLesson')}</h2>
        <input placeholder={t('lessonTitle')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        <textarea rows={4} placeholder={t('lessonBody')} value={body} onChange={(e) => setBody(e.target.value)} />
        <textarea rows={6} placeholder={t('itemsHelp')} value={lines} onChange={(e) => setLines(e.target.value)} required />
        <button disabled={busy || !cid}>{t('saveLesson')}</button>
      </form>
    </div>);
}
