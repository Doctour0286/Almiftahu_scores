import { useEffect, useState, type FormEvent } from 'react';
import { rpc, readPublic, RpcError } from './rpc';
import { errKey } from './i18n';

type Course = { id: string; name: string; eligibility_rule: string };
type Row = { enrollment_id: string; sn: number; name: string; name_ar: string | null; active: boolean; exam_approved: boolean | null; status: string | null };

// Roster management: add a student to a course, deactivate or reactivate an enrollment, and (for courses that use it) approve a student for the exam.
// Deactivating hides the student from the public portal (probe step 5) and keeps all history.
export default function Roster({ token, t, onAuthError }: { token: string; t: (k: string) => string; onAuthError: () => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null); const [cid, setCid] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null); const [err, setErr] = useState(''); const [note, setNote] = useState('');
  const [name, setName] = useState(''); const [nameAr, setNameAr] = useState(''); const [busy, setBusy] = useState(false);
  const fail = (e: unknown) => { const c = e instanceof RpcError ? e.code : ''; if (c === 'E_AUTH') return onAuthError(); setErr(t(errKey(c))); };
  const course = courses?.find((c) => c.id === cid);

  useEffect(() => {
    readPublic<Course[]>('courses?select=id,name,eligibility_rule&status=eq.active&order=name')
      .then((c) => { setCourses(c); if (c[0]) setCid(c[0].id); }).catch(fail);
  }, []);
  const load = () => rpc<Row[]>('admin_list_roster', { p_token: token, p_course_id: cid }).then(setRows).catch(fail);
  useEffect(() => { if (cid) { setRows(null); setErr(''); setNote(''); load(); } }, [cid]);

  const act = async (f: () => Promise<unknown>) => { setErr(''); setNote(''); setBusy(true); try { await f(); await load(); } catch (e) { fail(e); } finally { setBusy(false); } };
  const add = (e: FormEvent) => { e.preventDefault(); act(async () => {
    const r = await rpc<{ duplicate_name?: boolean }>('admin_add_student', { p_token: token, p_course_id: cid, p_name: name, p_name_ar: nameAr || null });
    if (r.duplicate_name) setNote(t('dupName'));
    setName(''); setNameAr('');
  }); };

  if (courses === null && !err) return <p>{t('loading')}</p>;
  return (
    <div className="stack">
      <label>{t('course')}<select value={cid} onChange={(e) => setCid(e.target.value)}>{courses?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <form className="card stack" onSubmit={add}>
        <h2>{t('addStudent')}</h2>
        <input placeholder={t('nameEn')} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
        <input placeholder={t('nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} maxLength={200} dir="rtl" />
        <button disabled={busy || !cid}>{t('add')}</button>
      </form>
      {note && <p className="muted" role="status">{note}</p>}
      {err && <p className="err" role="alert">{err}</p>}
      {rows === null && !err && <p>{t('loading')}</p>}
      <ul className="list">{rows?.map((r) => (
        <li key={r.enrollment_id} className={r.active ? '' : 'off'}>
          <span className="grow"><b>{r.sn}.</b> {r.name}{r.name_ar ? ` · ${r.name_ar}` : ''}{!r.active && <small className="muted"> · {t('inactive')}</small>}</span>
          {course?.eligibility_rule === 'teacher_approved' && r.active && (
            <button className={r.exam_approved ? '' : 'alt'} disabled={busy}
              onClick={() => act(() => rpc('admin_set_exam_approval', { p_token: token, p_enrollment_id: r.enrollment_id, p_approved: !r.exam_approved }))}>
              {r.exam_approved ? t('approved') : t('approve')}</button>)}
          <button className="ghost" disabled={busy}
            onClick={() => { if (r.active && !window.confirm(t('confirmOff'))) return; act(() => rpc('admin_set_active', { p_token: token, p_enrollment_id: r.enrollment_id, p_active: !r.active })); }}>
            {r.active ? t('deactivate') : t('reactivate')}</button>
        </li>))}</ul>
    </div>);
}
