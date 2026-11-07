// Run with:  node mashup-core.test.js
const assert = require('assert');
const C = require('./mashup-core.js');

// deterministic RNG so failures reproduce
let seed = 12345;
const rng = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

const TAGS = ['dp', 'graphs', 'binary search', 'greedy', 'math', 'implementation', '*special'];
const rows = [];
for (let c = 1; c <= 900; c++) {
  for (const [i, ix] of ['A', 'B', 'C', 'D', 'E'].entries()) {
    const rating = 800 + 100 * Math.min(27, Math.floor(i * 3 + rng() * 6));
    const tags = TAGS.filter(() => rng() < 0.25);
    rows.push({ contestId: c, index: ix, name: `P${c}${ix}`, rating, tags, solvedCount: 100 });
  }
}
const bank = C.unpackBank(C.packBank({
  problems: rows.map(r => ({ contestId: r.contestId, index: r.index, name: r.name, rating: r.rating, tags: r.tags })),
  problemStatistics: rows.map(r => ({ contestId: r.contestId, index: r.index, solvedCount: r.solvedCount }))
}));

// 1. a typical request
const o = { tags: ['dp', 'graphs'], tagMode: 'any', count: 5, lo: 1000, hi: 1600, uniqueContest: true, exclude: new Set() };
for (let run = 0; run < 200; run++) {
  const r = C.generate(bank, o, rng);
  assert.strictEqual(r.problems.length, 5, 'five problems');
  assert.strictEqual(r.shortage, 0);
  const ratings = r.problems.map(p => p.rating);
  assert.deepStrictEqual(ratings, [...ratings].sort((a, b) => a - b), 'non-decreasing difficulty');
  assert.ok(ratings.every(x => x >= 1000 && x <= 1600), 'inside the range');
  assert.strictEqual(new Set(r.problems.map(p => p.contestId)).size, 5, 'one problem per contest');
  assert.ok(r.problems.every(p => p.tags.includes('dp') || p.tags.includes('graphs')), 'tag match');
  assert.ok(r.problems.every(p => !p.tags.includes('*special')), 'no April Fools');
}

// 2. "match all"
const all = C.generate(bank, { ...o, tags: ['dp', 'graphs'], tagMode: 'all' }, rng);
assert.ok(all.problems.every(p => p.tags.includes('dp') && p.tags.includes('graphs')));

// 3. exclusions are honoured
const banned = new Set(bank.filter(p => p.tags.includes('dp')).map(p => p.key));
const ex = C.generate(bank, { ...o, tags: ['dp'], exclude: banned }, rng);
assert.strictEqual(ex.problems.length, 0, 'everything with dp is excluded');
assert.strictEqual(ex.shortage, 5);

// 4. shortage is reported, not faked
const tiny = bank.filter(p => p.tags.includes('graphs') && p.rating === 1000).slice(0, 2);
const sh = C.generate(tiny, { ...o, tags: ['graphs'], lo: 1000, hi: 1000 }, rng);
assert.ok(sh.problems.length <= 2 && sh.shortage === 5 - sh.problems.length);

// 5. single problem sits mid-range; spread covers both tags when possible
assert.strictEqual(C.targets(1, 1000, 1600)[0], 1300);
let both = 0;
for (let i = 0; i < 100; i++) {
  const t = new Set(C.generate(bank, { ...o, count: 4 }, rng).problems.flatMap(p => p.tags));
  if (t.has('dp') && t.has('graphs')) both++;
}
assert.ok(both >= 95, 'tag spread works, got ' + both);

// 6. reroll keeps size, range, and changes the problem
const base = C.generate(bank, o, rng).problems;
const rr = C.reroll(bank, o, base, 2, rng);
assert.strictEqual(rr.length, 5);
assert.strictEqual(new Set(rr.map(p => p.key)).size, 5);
assert.ok(rr.map(p => p.key).join() !== base.map(p => p.key).join(), 'something changed');

// 7. duration suggestion
assert.strictEqual(C.estimateMinutes(800), 8);
assert.strictEqual(C.estimateMinutes(1600), 32);
assert.ok(C.suggestDuration(base) % 5 === 0 && C.suggestDuration(base) >= 15);

// 8. scoring
const t0 = Date.parse('2026-10-28T10:00:00Z');
const contest = C.makeContest({ problems: base, handle: 'x', durationMin: 120, now: t0 });
const [a, b, c] = contest.problems;
const sub = (p, minutes, verdict) => ({
  problem: { contestId: p.contestId, index: p.index }, verdict, creationTimeSeconds: (t0 + minutes * 60000) / 1000
});
const subs = [
  sub(a, -30, 'OK'),                // before the contest: ignored
  sub(a, 10, 'WRONG_ANSWER'),
  sub(a, 15, 'COMPILATION_ERROR'),  // no penalty
  sub(a, 20, 'OK'),                 // solved at 20, one wrong -> 20 + 10
  sub(a, 50, 'OK'),                 // already solved: ignored
  sub(b, 60, 'TIME_LIMIT_EXCEEDED'),
  sub(c, 130, 'OK')                 // after the end: ignored
];
C.applyRows(contest, C.evaluate(contest, subs));
let sm = C.summarize(contest);
assert.deepStrictEqual(sm, { solved: 1, penalty: 30 });
contest.problems[3].manualAt = t0 + 45 * 60000;           // manual mark counts, without wrong-attempt penalty
sm = C.summarize(contest);
assert.deepStrictEqual(sm, { solved: 2, penalty: 75 });
C.applyRows(contest, C.evaluate(contest, []));            // a poll that sees nothing must not un-solve
assert.strictEqual(C.summarize(contest).solved, 2);


// 9. share codes
const code = C.encodeShare(base, 95);
assert.ok(code.startsWith('CFX-') && code.length < 45, 'short code: ' + code);
const dec = C.decodeShare(code);
assert.strictEqual(dec.durationMin, 95);
assert.deepStrictEqual(dec.ids.map(i => i.contestId + i.index), base.map(p => p.key));
const back = C.resolveShare(bank, dec);
assert.deepStrictEqual(back.problems.map(p => p.key), base.map(p => p.key), 'same problems, same order');
assert.strictEqual(back.missing.length, 0);
// tolerant input: lower-case prefix, spaces, whole invite text
assert.strictEqual(C.decodeShare('  ' + code.replace('CFX-', 'cfx-') + '  \n').ids.length, 5);
assert.strictEqual(C.decodeShare(`Join my mashup! Code: ${code}\nHave fun`).ids.length, 5);
assert.strictEqual(C.decodeShare(code.slice(4)).ids.length, 5, 'bare body works');
// every single-character corruption is caught or yields a clean error, never a wrong contest
let caught = 0, total = 0;
for (let i = 4; i < code.length; i++) {
  const alt = code[i] === 'A' ? 'B' : 'A';
  const mangled = code.slice(0, i) + alt + code.slice(i + 1);
  total++;
  try { const d = C.decodeShare(mangled); assert.notDeepStrictEqual(d.ids, dec.ids); } catch (e) { caught++; }
}
assert.ok(caught >= total - 1, `typos rejected ${caught}/${total}`);
assert.throws(() => C.decodeShare(code.slice(0, -3)), /typo|damaged|short/);
assert.throws(() => C.decodeShare(''), /Paste/);
assert.throws(() => C.decodeShare('hello world!!'), /share code/);
// problems not in the receiver's problemset are reported
const stranger = C.decodeShare(C.encodeShare([{ contestId: 999999, index: 'Z9' }, base[0]], 30));
const r2 = C.resolveShare(bank, stranger);
assert.deepStrictEqual(r2.missing, ['999999Z9']);
assert.strictEqual(r2.problems.length, 1);
// multi-part indices and big contest ids survive
const odd = C.decodeShare(C.encodeShare([{ contestId: 1900000, index: 'B1' }, { contestId: 5, index: 'F2' }], 600));
assert.deepStrictEqual(odd.ids, [{ contestId: 1900000, index: 'B1' }, { contestId: 5, index: 'F2' }]);
assert.strictEqual(odd.durationMin, 600);

console.log('all mashup-core tests passed');
