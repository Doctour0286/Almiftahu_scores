// Run: node --experimental-strip-types app/src/parse.test.mjs
import assert from 'node:assert/strict';
import { parseBulk } from './parse.ts';
const src = `
# Adab of Greeting | آداب السلام
> Say salam first.
> Smile.
Greeting of Islam || As-salamu alaykum || السلام عليكم ; salam
? Who starts the greeting? || The one riding | The one walking | The oldest
# Empty lesson
`;
const r = parseBulk(src, () => 0);
assert.equal(r.lessons.length, 2);
assert.equal(r.lessons[0].title, 'Adab of Greeting'); assert.equal(r.lessons[0].title_ar, 'آداب السلام');
assert.equal(r.lessons[0].body, 'Say salam first.\nSmile.');
assert.deepEqual(r.lessons[0].items[0].alts, ['السلام عليكم', 'salam']);
const m = r.lessons[0].items[1];
assert.equal(m.options.length, 3);
assert.equal(m.options.find((o) => o.id === m.answer).text, 'The one riding', 'answer id must point at the correct text after shuffling');
assert.ok(r.errors.some((e) => e.includes('"Empty lesson" has no questions')));
assert.ok(parseBulk('orphan || a').errors[0].includes('before the first'));
assert.ok(parseBulk('# T\nbad line').errors[0].includes('prompt || answer'));
assert.ok(parseBulk('# T\n? q || a').errors[0].includes('multiple-choice'));
// shuffle with another seed still keeps the right answer
for (const seed of [0.1, 0.5, 0.99]) { const x = parseBulk('# T\n? q || right | w1 | w2', () => seed).lessons[0].items[0]; assert.equal(x.options.find((o) => o.id === x.answer).text, 'right'); }
console.log('parse tests passed');
