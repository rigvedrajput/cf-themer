// CF Themer — Core mashup contest generation and scoring logic
(function (g) {
  'use strict';

  const PENALTY_MIN = 10; // ICPC penalty: 10 minutes per rejected submission
  const WRONG = new Set(['WRONG_ANSWER', 'RUNTIME_ERROR', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED',
    'IDLENESS_LIMIT_EXCEEDED', 'PRESENTATION_ERROR']);

  const keyOf = (contestId, index) => String(contestId) + String(index);
  const problemPath = p => `/problemset/problem/${p.contestId}/${p.index}`;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Pack problemset rows from API into compact storage format
  function packBank(result) {
    const stats = new Map();
    for (const st of result.problemStatistics || []) stats.set(keyOf(st.contestId, st.index), st.solvedCount || 0);
    const rows = [];
    for (const p of result.problems || []) {
      if (typeof p.rating !== 'number' || p.contestId == null) continue;
      rows.push([p.contestId, p.index, p.name, p.rating, p.tags || [], stats.get(keyOf(p.contestId, p.index)) || 0]);
    }
    return rows;
  }
  const unpackBank = rows => rows.map(r => ({
    key: keyOf(r[0], r[1]), contestId: r[0], index: r[1], name: r[2], rating: r[3], tags: r[4], solved: r[5]
  }));

  function tagStats(bank) {
    const m = new Map();
    for (const p of bank) for (const t of p.tags) m.set(t, (m.get(t) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  // Estimated solving time (minutes) used for contest duration suggestions
  const estimateMinutes = rating => clamp(Math.round(8 * Math.pow(2, (rating - 800) / 400)), 5, 120);
  const suggestDuration = problems =>
    Math.max(15, Math.ceil(problems.reduce((s, p) => s + estimateMinutes(p.rating), 0) / 5) * 5);

  // Filter bank by tags, difficulty, and exclusions
  function buildPool(bank, o) {
    const tags = o.tags || [];
    const wantSpecial = tags.includes('*special');
    return bank.filter(p => {
      if (p.rating < o.lo || p.rating > o.hi) return false;
      if (o.exclude && o.exclude.has(p.key)) return false;
      if (!wantSpecial && p.tags.includes('*special')) return false;
      if (!tags.length) return true;
      return o.tagMode === 'all' ? tags.every(t => p.tags.includes(t)) : tags.some(t => p.tags.includes(t));
    });
  }

  function targets(count, lo, hi) {
    if (count <= 1) return [Math.round((lo + hi) / 2)];
    return Array.from({ length: count }, (_, i) => lo + (hi - lo) * i / (count - 1));
  }

  const newState = () => ({ keys: new Set(), contests: new Set(), covered: new Set() });
  function take(st, p) { st.keys.add(p.key); st.contests.add(p.contestId); p.tags.forEach(t => st.covered.add(t)); }

  function pickSlot(pool, st, target, o, rng) {
    const tags = o.tags || [];
    const spread = tags.length > 1 && o.tagMode !== 'all';
    for (const relaxed of [false, true]) {
      let best = null, bestScore = -Infinity;
      for (const p of pool) {
        if (st.keys.has(p.key)) continue;
        if (!relaxed && o.uniqueContest && st.contests.has(p.contestId)) continue;
        let score = -Math.abs(p.rating - target) / 100 + rng() * 1.5;
        if (spread) {
          let fresh = 0;
          for (const t of tags) if (p.tags.includes(t) && !st.covered.has(t)) fresh++;
          score += 1.2 * Math.min(2, fresh);
        }
        if (score > bestScore) { bestScore = score; best = p; }
      }
      if (best) return best;
    }
    return null;
  }

  // Generate contest problems distributed evenly across difficulty range
  function generate(bank, o, rng = Math.random) {
    const pool = buildPool(bank, o);
    const st = newState();
    const picked = [];
    for (const target of targets(o.count, o.lo, o.hi)) {
      const p = pickSlot(pool, st, target, o, rng);
      if (!p) break;
      take(st, p);
      picked.push(p);
    }
    picked.sort((a, b) => a.rating - b.rating);
    return { problems: picked, poolSize: pool.length, shortage: o.count - picked.length };
  }

  // Replace a single problem with another of matching difficulty
  function reroll(bank, o, current, i, rng = Math.random) {
    const pool = buildPool(bank, o);
    const st = newState();
    current.forEach((p, j) => { if (j !== i) take(st, p); });
    st.keys.add(current[i].key);
    const p = pickSlot(pool, st, current[i].rating, o, rng);
    if (!p) return null;
    const next = current.slice();
    next[i] = p;
    return next.sort((a, b) => a.rating - b.rating);
  }

  const LETTERS = 'ABCDEFGHIJ';
  function makeContest({ problems, handle, durationMin, now }) {
    return {
      id: now.toString(36), handle: handle || '', startedAt: now, durationMin, status: 'running',
      lastPoll: 0, error: null,
      problems: problems.map((p, i) => ({
        key: p.key, letter: LETTERS[i], contestId: p.contestId, index: p.index, name: p.name,
        rating: p.rating, tags: p.tags, apiAt: null, manualAt: null, wrong: 0
      }))
    };
  }

  // Evaluate submissions against contest problem set
  function evaluate(contest, subs) {
    const start = contest.startedAt, end = start + contest.durationMin * 60000;
    const st = new Map(contest.problems.map(p => [p.key, { apiAt: null, wrong: 0 }]));
    const ordered = (subs || []).filter(s => s && s.problem).sort((a, b) => a.creationTimeSeconds - b.creationTimeSeconds);
    for (const s of ordered) {
      const r = st.get(keyOf(s.problem.contestId, s.problem.index));
      if (!r || r.apiAt) continue;
      const t = s.creationTimeSeconds * 1000;
      if (t < start || t > end) continue;
      if (s.verdict === 'OK') r.apiAt = t;
      else if (WRONG.has(s.verdict)) r.wrong++;
    }
    return contest.problems.map(p => ({ key: p.key, ...st.get(p.key) }));
  }

  function applyRows(contest, rows) {
    const by = new Map(rows.map(r => [r.key, r]));
    for (const p of contest.problems) {
      const r = by.get(p.key);
      if (!r) continue;
      p.apiAt = r.apiAt || p.apiAt || null;
      p.wrong = Math.max(p.wrong || 0, r.wrong || 0);
    }
  }

  function summarize(contest) {
    let solved = 0, penalty = 0;
    for (const p of contest.problems) {
      const at = p.apiAt || p.manualAt;
      if (!at) continue;
      solved++;
      penalty += Math.floor(Math.max(0, at - contest.startedAt) / 60000) + (p.apiAt ? PENALTY_MIN * (p.wrong || 0) : 0);
    }
    return { solved, penalty };
  }

  // Compact share code encoder / decoder with checksum
  const SHARE_PREFIX = 'CFX-';
  const checksum = bytes => { let a = 0, b = 0; for (const x of bytes) { a = (a + x) % 255; b = (b + a) % 255; } return [a, b]; };
  const pushVarint = (out, n) => { while (n >= 128) { out.push((n & 127) | 128); n = Math.floor(n / 128); } out.push(n); };

  function encodeShare(problems, durationMin) {
    const out = [1];
    pushVarint(out, clamp(Math.round(durationMin) || 0, 0, 600));
    out.push(problems.length);
    for (const p of problems) {
      pushVarint(out, p.contestId);
      const idx = String(p.index);
      out.push(idx.length);
      for (const ch of idx) out.push(ch.charCodeAt(0) & 127);
    }
    out.push(...checksum(out));
    const b64 = btoa(String.fromCharCode(...out)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return SHARE_PREFIX + b64;
  }

  function decodeShare(text) {
    const bad = msg => new Error(msg);
    const t = String(text || '').trim();
    if (!t) throw bad('Paste a share code first.');
    const m = /CFX-([A-Za-z0-9_-]+)/i.exec(t);
    const body = (m ? m[1] : t.replace(/\s+/g, ''));
    if (!/^[A-Za-z0-9_-]{8,200}$/.test(body)) throw bad('That does not look like a share code.');
    let bytes;
    try {
      const b64 = body.replace(/-/g, '+').replace(/_/g, '/');
      bytes = Array.from(atob(b64 + '='.repeat((4 - b64.length % 4) % 4)), c => c.charCodeAt(0));
    } catch (e) { throw bad('That does not look like a share code.'); }
    if (bytes.length < 8) throw bad('That share code is too short.');
    const data = bytes.slice(0, -2), sum = checksum(data);
    if (sum[0] !== bytes[bytes.length - 2] || sum[1] !== bytes[bytes.length - 1]) throw bad('This code has a typo or was cut off. Copy it again.');
    if (data[0] !== 1) throw bad('This code comes from a newer CF Themer. Update the extension.');
    let pos = 1;
    const readVarint = () => {
      let n = 0, mul = 1;
      for (let k = 0; k < 5; k++) {
        if (pos >= data.length) throw bad('This code is damaged.');
        const b = data[pos++];
        n += (b & 127) * mul; mul *= 128;
        if (b < 128) return n;
      }
      throw bad('This code is damaged.');
    };
    const durationMin = readVarint();
    const count = data[pos++];
    if (!(count >= 1 && count <= 10)) throw bad('This code is damaged.');
    const ids = [];
    for (let i = 0; i < count; i++) {
      const contestId = readVarint();
      const len = data[pos++];
      if (!(len >= 1 && len <= 4) || pos + len > data.length) throw bad('This code is damaged.');
      const index = String.fromCharCode(...data.slice(pos, pos + len)); pos += len;
      if (!/^[A-Za-z0-9]+$/.test(index) || contestId < 1) throw bad('This code is damaged.');
      ids.push({ contestId, index });
    }
    if (pos !== data.length) throw bad('This code is damaged.');
    return { durationMin: durationMin >= 5 ? durationMin : 0, ids };
  }

  function resolveShare(bank, decoded) {
    const by = new Map(bank.map(p => [p.key, p]));
    const problems = [], missing = [];
    for (const id of decoded.ids) {
      const k = keyOf(id.contestId, id.index), p = by.get(k);
      if (p) problems.push(p); else missing.push(k);
    }
    return { problems, missing };
  }

  const api = { keyOf, problemPath, clamp, packBank, unpackBank, tagStats, estimateMinutes, suggestDuration,
    buildPool, targets, generate, reroll, makeContest, evaluate, applyRows, summarize, PENALTY_MIN,
    encodeShare, decodeShare, resolveShare };
  g.CFX_MC = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
