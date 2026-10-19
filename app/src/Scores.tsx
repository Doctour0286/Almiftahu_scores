import { useEffect, useState, type KeyboardEvent } from 'react';
import { rpc, readPublic, RpcError } from './rpc';
import { errKey } from './i18n';

type Course = { id: string; code: string; name: string; name_ar: string | null; lesson_mode: string; day_count: number; day_max: number; unit_label: string };
type Row = { enrollment_id: string; sn: number; name: string; name_ar: string | null; active: boolean; days: number[]; bonus_units: number[]; lesson_pct: number | null; status: string | null };

// Fast score entry: pick a course and a day, then type marks straight down the list.
// Blank is stored as -1 by admin_save_day; the existing bonus is passed back so saving a mark never resets it.
export default function Scores({ token, t, onAuthError }: { token: string; t: (k: string) => string; onAuthError: () => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [cid, setCid] = useState(''); const [day, setDay] = useState(0);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({}); const [state, setState] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const fail = (e: unknown) => {
    const code = e instanceof RpcError ? e.code : '';
    if (code === 'E_AUTH') return onAuthError();
    setErr(t(errKey(code)));
  };

  useEffect(() => {
    readPublic<Course[]>('courses?select=id,code,name,name_ar,lesson_mode,day_count,day_max,unit_label&status=eq.active&lesson_mode=eq.scored&order=name')
      .then((c) => { setCourses(c); if (c[0]) setCid(c[0].id); }).catch(fail);
  }, []);
  const course = courses?.find((c) => c.id === cid);

  useEffect(() => {
    if (!cid) return;
    setRows(null); setDraft({}); setState({}); setErr(''); setDay(0);
    rpc<Row[]>('admin_list_roster', { p_token: token, p_course_id: cid }).then((r) => setRows(r.filter((x) => x.active))).catch(fail);
  }, [cid]);

  const current = (r: Row) => (r.days[day] >= 0 ? String(r.days[day]) : '');
  const save = async (r: Row) => {
    const v = (draft[r.enrollment_id] ?? current(r)).trim();
    if (v === current(r)) return;
    const n = v === '' ? null : Number(v);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > course!.day_max)) { setState((p) => ({ ...p, [r.enrollment_id]: 'bad' })); return; }
    setState((p) => ({ ...p, [r.enrollment_id]: 'saving' }));
    try {
      const res = await rpc<{ days: number[]; bonus_units: number[]; lesson_pct: number | null; status: string | null }>('admin_save_day',
        { p_token: token, p_enrollment_id: r.enrollment_id, p_day_index: day, p_score: n, p_bonus: r.bonus_units[day] ?? 0 });
      setRows((rs) => rs && rs.map((x) => x.enrollment_id === r.enrollment_id ? { ...x, days: res.days, bonus_units: res.bonus_units, lesson_pct: res.lesson_pct, status: res.status } : x));
      setDraft((p) => { const q = { ...p }; delete q[r.enrollment_id]; return q; });
      setState((p) => ({ ...p, [r.enrollment_id]: 'saved' }));
    } catch (e) { setState((p) => ({ ...p, [r.enrollment_id]: 'error' })); fail(e); }
  };
  const next = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    (e.currentTarget.closest('li')?.nextElementSibling?.querySelector('input') as HTMLInputElement | null)?.focus();
  };

  if (courses === null && !err) return <p>{t('loading')}</p>;
  if (courses?.length === 0) return <p>{t('noScored')}</p>;
  return (
    <div className="stack">
      <div className="row2">
        <label>{t('course')}<select value={cid} onChange={(e) => setCid(e.target.value)}>
          {courses?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {course && <label>{course.unit_label || t('unit')}<select value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {Array.from({ length: course.day_count }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label>}
      </div>
      {course && <p className="muted">{t('outOf')} {course.day_max} · {t('blankHint')}</p>}
      {err && <p className="err" role="alert">{err}</p>}
      {rows === null && !err && <p>{t('loading')}</p>}
      {rows?.length === 0 && <p>{t('noStudents')}</p>}
      <ul className="list">{rows?.map((r) => {
        const st = state[r.enrollment_id];
        return (
          <li key={r.enrollment_id}>
            <span className="grow"><b>{r.sn}.</b> {r.name}{r.name_ar ? ` · ${r.name_ar}` : ''}
              <small className="muted"> {t('lessonPct')} {r.lesson_pct ?? '–'}{r.lesson_pct != null ? '%' : ''}</small></span>
            <span className={`tick ${st ?? ''}`} aria-live="polite">{st === 'saved' ? '✓' : st === 'saving' ? '…' : st === 'bad' || st === 'error' ? '!' : ''}</span>
            <input className="mark" type="text" inputMode="numeric" aria-label={`${r.name} ${t('scores')}`}
              value={draft[r.enrollment_id] ?? current(r)}
              onChange={(e) => { setDraft((p) => ({ ...p, [r.enrollment_id]: e.target.value })); setState((p) => ({ ...p, [r.enrollment_id]: '' })); }}
              onBlur={() => save(r)} onKeyDown={next} />
          </li>);
      })}</ul>
    </div>);
}
