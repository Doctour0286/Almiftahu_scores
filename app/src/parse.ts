// Bulk lesson import. Plain text, one lesson per "# " heading (PRD v4 6.2). Lessons are created as DRAFTS for a teacher to review.
//   # Lesson title | Arabic title (optional)
//   > a line of the lesson text (repeat for more lines)
//   prompt || answer || other accepted answer ; another          <- typed-answer question
//   ? prompt || correct option | wrong option | wrong option      <- multiple choice (options are shuffled on import)
export type ParsedItem = { type: 'recall' | 'mcq'; prompt: string; answer: string; alts?: string[]; options?: { id: string; text: string }[] };
export type ParsedLesson = { title: string; title_ar?: string; body: string; items: ParsedItem[] };

export function parseBulk(text: string, rand: () => number = Math.random): { lessons: ParsedLesson[]; errors: string[] } {
  const lessons: ParsedLesson[] = []; const errors: string[] = []; let cur: ParsedLesson | null = null; const body: string[] = [];
  const close = () => { if (cur) { cur.body = body.splice(0).join('\n'); if (cur.items.length === 0) errors.push(`Lesson "${cur.title}" has no questions.`); lessons.push(cur); } };
  text.split(/\r?\n/).forEach((raw, n) => {
    const line = raw.trim(); const at = `Line ${n + 1}: `;
    if (!line) return;
    if (line.startsWith('#')) {
      close(); const [title, ar] = line.replace(/^#+/, '').split('|').map((x) => x.trim());
      if (!title) { errors.push(at + 'a lesson needs a title.'); cur = null; return; }
      cur = { title, title_ar: ar || undefined, body: '', items: [] }; return;
    }
    if (!cur) { errors.push(at + 'text before the first "# Lesson title" line.'); return; }
    if (line.startsWith('>')) { body.push(line.replace(/^>\s?/, '')); return; }
    const isMcq = line.startsWith('?'); const parts = (isMcq ? line.slice(1) : line).split('||').map((x) => x.trim());
    const prompt = parts[0];
    if (isMcq) {
      const opts = parts.slice(1).join('|').split('|').map((x) => x.trim()).filter(Boolean).slice(0, 6);   // first option is the correct one
      if (!prompt || opts.length < 2) { errors.push(at + 'a multiple-choice line needs "? prompt || correct | wrong | wrong".'); return; }
      const texts = opts.map((text, i) => ({ text, ok: i === 0 }));
      for (let i = texts.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [texts[i], texts[j]] = [texts[j], texts[i]]; }
      const options = texts.map((o, i) => ({ id: String.fromCharCode(97 + i), text: o.text }));
      cur.items.push({ type: 'mcq', prompt, answer: options[texts.findIndex((o) => o.ok)].id, options });
    } else {
      const [, answer, extra] = parts;
      if (!prompt || !answer) { errors.push(at + 'needs "prompt || answer".'); return; }
      cur.items.push({ type: 'recall', prompt, answer, alts: (extra ?? '').split(/[;؛]/).map((x) => x.trim()).filter(Boolean) });
    }
  });
  close();
  return { lessons, errors };
}
