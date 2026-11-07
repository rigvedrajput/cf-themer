// CF Themer — Mashup contest builder page
(() => {
  'use strict';

  const L = chrome.storage.local;
  const K = {
    bank: 'cfx-mc:bank', solved: 'cfx-mc:solved', hist: 'cfx-mc:history', active: 'cfx-mc:active',
    prefs: 'cfx-mc:prefs', handle: 'cfx-mc:handle', log: 'cfx-mc:log', consent: 'cfx-mc:consent'
  };
  const CONSENT_V = 1;
  const PRIVACY_URL = 'https://rigvedrajput.github.io/cf-themer/privacy.html';
  const BANK_TTL = 24 * 3600e3, SOLVED_TTL = 15 * 60e3;
  const $ = id => document.getElementById(id);
  const get = async key => (await L.get(key))[key];
  const pad = n => String(n).padStart(2, '0');

  let bank = [];
  let solved = new Set(), tried = new Set(), history = new Set();
  let active = null;
  let picked = [], lastOpts = null, joined = false;
  const selTags = new Set();
  let lastApi = 0;

  const motion = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  // Scroll contest preview into view if not fully visible
  function revealPreview() {
    const el = $('preview');
    if (el.hidden) return;
    const r = el.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) return;
    el.scrollIntoView({ behavior: motion(), block: r.height > window.innerHeight ? 'start' : 'nearest' });
  }

  // Apply theme CSS variables to mashup page
  const THEME_KEYS = [...new Set(Object.values(CFX_THEMES).flatMap(t => Object.keys(t.vars || {})))];
  function applyTheme(settings) {
    const st = document.documentElement.style;
    THEME_KEYS.forEach(k => st.removeProperty('--cfx-' + k));
    const t = CFX_THEMES[settings.theme];
    if (t && t.vars) for (const [k, v] of Object.entries(t.vars)) st.setProperty('--cfx-' + k, v);
  }

  function setStatus(text, isErr) {
    const s = $('status');
    s.textContent = text || '';
    s.classList.toggle('err', !!isErr);
  }

  // Codeforces public API client with 2s rate limit enforcement
  async function api(method, params) {
    const wait = lastApi + 2100 - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastApi = Date.now();
    let data;
    try {
      data = await (await fetch('https://codeforces.com/api/' + method + (params ? '?' + params : ''))).json();
    } catch (e) { throw new Error('could not reach Codeforces'); }
    if (data.status !== 'OK') throw new Error(data.comment || 'Codeforces API error');
    return data.result;
  }

  // Fetch or retrieve cached problemset
  async function loadBank(force) {
    const cached = await get(K.bank);
    if (cached && !force && Date.now() - cached.t < BANK_TTL) { bank = CFX_MC.unpackBank(cached.rows); return; }
    try {
      setStatus('Downloading the problemset…');
      const rows = CFX_MC.packBank(await api('problemset.problems'));
      await L.set({ [K.bank]: { t: Date.now(), rows } });
      bank = CFX_MC.unpackBank(rows);
      setStatus('');
    } catch (e) {
      if (!cached) throw e;
      bank = CFX_MC.unpackBank(cached.rows);
      setStatus('Using an older copy of the problemset (' + e.message + ').', true);
    }
  }

  // Load user submissions to exclude solved/attempted problems
  async function loadSolved(handle) {
    solved = new Set(); tried = new Set();
    if (!handle) return;
    const c = await get(K.solved);
    if (c && c.handle.toLowerCase() === handle.toLowerCase() && Date.now() - c.t < SOLVED_TTL) {
      solved = new Set(c.solved); tried = new Set(c.tried);
      return;
    }
    setStatus('Reading your submissions…');
    const subs = await api('user.status', 'handle=' + encodeURIComponent(handle));
    for (const s of subs) {
      if (!s.problem || s.problem.contestId == null) continue;
      const key = CFX_MC.keyOf(s.problem.contestId, s.problem.index);
      if (s.verdict === 'OK') solved.add(key); else tried.add(key);
    }
    for (const k of solved) tried.delete(k);
    await L.set({ [K.solved]: { handle, t: Date.now(), solved: [...solved], tried: [...tried] } });
    setStatus('');
  }

  function updateTagsHint() {
    const el = $('tagsHint');
    if (!el) return;
    if (!selTags.size) {
      el.textContent = 'none selected = any topic';
    } else if (selTags.size === 1) {
      el.textContent = `${[...selTags][0]} selected`;
    } else {
      el.textContent = `${selTags.size} tags selected`;
    }
  }

  function renderTags() {
    updateTagsHint();
    const box = $('tags');
    box.textContent = '';
    for (const [tag, n] of CFX_MC.tagStats(bank)) {
      if (tag === '*special') continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', selTags.has(tag));
      b.append(tag);
      const cnt = document.createElement('small'); cnt.textContent = n; b.append(cnt);
      b.addEventListener('click', () => {
        if (selTags.has(tag)) selTags.delete(tag); else selTags.add(tag);
        b.setAttribute('aria-pressed', selTags.has(tag));
        updateTagsHint();
        updatePool(); savePrefs();
      });
      box.appendChild(b);
    }
  }

  function readForm() {
    const num = (id, d) => { const v = parseInt($(id).value, 10); return Number.isFinite(v) ? v : d; };
    let lo = CFX_MC.clamp(num('lo', 800), 800, 3500), hi = CFX_MC.clamp(num('hi', 1600), 800, 3500);
    if (lo > hi) [lo, hi] = [hi, lo];
    const exclude = new Set();
    if ($('exSolved').checked) solved.forEach(k => exclude.add(k));
    if ($('exTried').checked) tried.forEach(k => exclude.add(k));
    if ($('avoidRepeats').checked) history.forEach(k => exclude.add(k));
    const dur = num('duration', 0);
    return {
      tags: [...selTags], tagMode: document.querySelector('input[name=tagMode]:checked').value,
      count: CFX_MC.clamp(num('count', 5), 1, 10), lo, hi, uniqueContest: $('unique').checked,
      exclude, duration: dur > 0 ? CFX_MC.clamp(dur, 10, 600) : 0
    };
  }

  function updatePool() {
    if (!bank.length) return;
    const o = readForm();
    const n = CFX_MC.buildPool(bank, o).length;
    const handle = $('handle').value.trim();
    const needSolved = $('exSolved').checked || $('exTried').checked;
    let note = '';
    if (needSolved && !handle) {
      note = ' (enter handle to exclude solved)';
    } else if (needSolved && !solved.size && !tried.size) {
      note = ' (solved list not loaded yet)';
    }
    $('pool').textContent = `${n} matching problem${n === 1 ? '' : 's'}${note}`;
  }

  function savePrefs() {
    const p = {
      tags: [...selTags], tagMode: document.querySelector('input[name=tagMode]:checked').value,
      count: $('count').value, lo: $('lo').value, hi: $('hi').value, duration: $('duration').value,
      exSolved: $('exSolved').checked, exTried: $('exTried').checked, avoidRepeats: $('avoidRepeats').checked,
      unique: $('unique').checked
    };
    L.set({ [K.prefs]: p }).catch(() => {});
  }
  function restorePrefs(p) {
    if (!p) return;
    (p.tags || []).forEach(t => selTags.add(t));
    updateTagsHint();
    const r = document.querySelector(`input[name=tagMode][value=${p.tagMode === 'all' ? 'all' : 'any'}]`);
    if (r) r.checked = true;
    for (const id of ['count', 'lo', 'hi', 'duration']) if (p[id] !== undefined) $(id).value = p[id];
    for (const id of ['exSolved', 'exTried', 'avoidRepeats', 'unique']) if (typeof p[id] === 'boolean') $(id).checked = p[id];
  }

  async function copyText(text, btn) {
    const label = btn.textContent;
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied ✓'; }
    catch (e) {
      const f = $('shareCode'), prev = f.value;
      f.value = text; f.select();
      btn.textContent = document.execCommand && document.execCommand('copy') ? 'Copied ✓' : 'Press Ctrl+C';
      setTimeout(() => { f.value = prev; }, 4000);
    }
    setTimeout(() => { btn.textContent = label; }, 1500);
  }

  const contestLength = () => lastOpts.duration || CFX_MC.suggestDuration(picked);
  const currentCode = () => CFX_MC.encodeShare(picked, contestLength());
  function inviteText() {
    const r = picked.map(p => p.rating);
    return `Codeforces mashup: ${picked.length} problem${picked.length === 1 ? '' : 's'}, ` +
      `${Math.min(...r)}–${Math.max(...r)}, ${contestLength()} min.\n` +
      `Code: ${currentCode()}\n` +
      `(CF Themer extension → "Create a mashup contest…" → paste it under "Have a share code?")`;
  }

  // Load contest from entered share code
  async function onJoin() {
    const btn = $('joinBtn');
    btn.disabled = true;
    try {
      let dec;
      try { dec = CFX_MC.decodeShare($('joinCode').value); }
      catch (e) { setStatus(e.message, true); return; }
      let res = CFX_MC.resolveShare(bank, dec);
      if (res.missing.length) {
        setStatus('Refreshing the problemset…');
        try { await loadBank(true); res = CFX_MC.resolveShare(bank, dec); } catch (e) {}
      }
      if (res.missing.length) {
        setStatus(`${res.missing.length} problem${res.missing.length === 1 ? '' : 's'} from this code (${res.missing.join(', ')}) ` +
          'could not be found in the rated problemset, so the contest cannot be loaded.', true);
        return;
      }
      const handle = $('handle').value.trim();
      try { await loadSolved(handle); } catch (e) {}
      joined = true;
      picked = res.problems;
      const r = picked.map(p => p.rating);
      lastOpts = { duration: dec.durationMin, count: picked.length, lo: Math.min(...r), hi: Math.max(...r), tags: [], exclude: new Set() };
      setStatus('');
      renderPreview();
      revealPreview();
    } finally { btn.disabled = !$('joinCode').value.trim(); }
  }

  function renderPreview(res) {
    const tbody = $('rows');
    tbody.textContent = '';
    picked.forEach((p, i) => {
      const tr = document.createElement('tr');
      const cell = (cls, text) => { const td = document.createElement('td'); if (cls) td.className = cls; if (text !== undefined) td.textContent = text; tr.appendChild(td); return td; };
      cell('letter', String.fromCharCode(65 + i));
      const name = cell();
      const a = document.createElement('a');
      a.href = 'https://codeforces.com' + CFX_MC.problemPath(p); a.target = '_blank'; a.rel = 'noopener';
      a.textContent = `${p.contestId}${p.index} · ${p.name}`;
      name.appendChild(a);
      cell('num', p.rating);
      cell('tags', p.tags.join(', '));
      cell('num', '~' + CFX_MC.estimateMinutes(p.rating));
      const act = cell();
      if (!joined) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = '↻'; b.title = 'Replace with a similar problem';
        b.addEventListener('click', () => {
          const next = CFX_MC.reroll(bank, lastOpts, picked, i);
          if (!next) { setStatus('No other problem of that difficulty matches your filters.', true); return; }
          setStatus(''); picked = next; renderPreview();
        });
        act.appendChild(b);
      }
      tbody.appendChild(tr);
    });
    $('previewTitle').textContent = joined ? 'Shared contest' : 'Your contest';
    const est = CFX_MC.suggestDuration(picked);
    const len = lastOpts.duration || est;
    let msg = `Rough solving time ≈ ${est} min, contest length ${len} min${lastOpts.duration ? '' : ' (auto)'}.`;
    if (lastOpts.duration && lastOpts.duration < est * 0.7) msg += ' That is tight for these problems.';
    if (res && res.shortage) msg = `Only found ${picked.length} of ${lastOpts.count}: widen the rating range or relax a filter. ` + msg;
    const done = picked.filter(p => solved.has(p.key)).length;
    if (done) msg += ` You have already solved ${done} of these.`;
    $('summary').textContent = picked.length ? msg : '';
    $('shareCode').value = picked.length ? currentCode() : '';
    $('start').disabled = !picked.length;
    $('preview').hidden = false;
  }

  async function onGenerate() {
    const btn = $('generate');
    btn.disabled = true;
    try {
      const handle = $('handle').value.trim();
      const needSolved = $('exSolved').checked || $('exTried').checked;
      if (needSolved && !handle) { setStatus('Enter your handle to exclude solved problems, or untick that option.', true); return; }
      try { await loadSolved(handle); }
      catch (e) { setStatus(`Could not read submissions for "${handle}": ${e.message}`, true); return; }
      joined = false;
      lastOpts = readForm();
      savePrefs();
      const res = CFX_MC.generate(bank, lastOpts);
      picked = res.problems;
      setStatus(picked.length ? '' : 'No problem matches. Try more tags, "match any", or a wider rating range.', !picked.length);
      renderPreview(res);
      updatePool();
      if (picked.length) revealPreview();
    } finally { btn.disabled = false; }
  }

  // Start contest: store active state and open problem A
  async function onStart() {
    if (!picked.length) return;
    if (active && active.status === 'running' && !confirm('A mashup contest is already running. Replace it?')) return;
    const handle = $('handle').value.trim();
    const contest = CFX_MC.makeContest({
      problems: picked, handle, durationMin: lastOpts.duration || CFX_MC.suggestDuration(picked), now: Date.now()
    });
    picked.forEach(p => history.add(p.key));
    await L.set({ [K.active]: contest, [K.hist]: [...history].slice(-3000) });
    active = contest;
    chrome.tabs.create({ url: 'https://codeforces.com' + CFX_MC.problemPath(contest.problems[0]) });
  }

  // Sync history problem keys from log and active contest
  async function syncHistory() {
    const [log, act] = await Promise.all([get(K.log), get(K.active)]);
    const newHist = new Set();
    if (Array.isArray(log)) {
      for (const e of log) {
        if (e.code) {
          try {
            const dec = CFX_MC.decodeShare(e.code);
            if (dec && Array.isArray(dec.ids)) {
              dec.ids.forEach(id => newHist.add(CFX_MC.keyOf(id.contestId, id.index)));
            }
          } catch (_) {}
        }
        if (Array.isArray(e.problems)) {
          e.problems.forEach(p => {
            if (p.key) newHist.add(p.key);
            else if (p.contestId != null && p.index) newHist.add(CFX_MC.keyOf(p.contestId, p.index));
          });
        }
      }
    }
    if (act && act.status === 'running' && Array.isArray(act.problems)) {
      act.problems.forEach(p => {
        if (p.key) newHist.add(p.key);
        else if (p.contestId != null && p.index) newHist.add(CFX_MC.keyOf(p.contestId, p.index));
      });
    }
    history = newHist;
    await L.set({ [K.hist]: [...history].slice(-3000) });
    updatePool();
  }

  // Render past mashup contest list
  async function loadPast() {
    const log = (await get(K.log)) || [];
    const list = $('pastList');
    list.textContent = '';
    for (const e of log.slice(0, 10)) {
      const li = document.createElement('li');
      const d = new Date(e.startedAt);
      const info = document.createElement('span');
      info.className = 'past-info';
      const bold = document.createElement('b');
      bold.textContent = `${e.solved}/${e.total} solved`;
      info.append(bold, ` · penalty ${e.penalty} · ${e.lo}–${e.hi} · ${e.durationMin} min · ` +
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      li.appendChild(info);

      const btns = document.createElement('span');
      btns.className = 'past-btns';
      if (e.code) {
        const cb = document.createElement('button');
        cb.type = 'button'; cb.className = 'mini'; cb.textContent = 'Copy code'; cb.title = 'Share or replay this contest';
        cb.addEventListener('click', () => copyText(e.code, cb));
        btns.appendChild(cb);
      }

      const del = document.createElement('button');
      del.type = 'button'; del.className = 'mini del'; del.textContent = 'Delete'; del.title = 'Remove this contest from history';
      del.addEventListener('click', async () => {
        if (!confirm('Remove this mashup from your history?')) return;
        const currentLog = (await get(K.log)) || [];
        const updated = currentLog.filter(x => (e.id && x.id ? x.id !== e.id : !(x.startedAt === e.startedAt && x.code === e.code)));
        await L.set({ [K.log]: updated });
        const curAct = await get(K.active);
        if (curAct && ((e.id && curAct.id === e.id) || (curAct.startedAt === e.startedAt))) {
          await L.remove(K.active);
          active = null;
        }
        await syncHistory();
        loadPast();
      });
      btns.appendChild(del);

      li.appendChild(btns);
      list.appendChild(li);
    }
    $('past').hidden = !log.length;
  }

  function showConsent() {
    if (PRIVACY_URL) { const a = $('privacyLink'); a.href = PRIVACY_URL; a.hidden = false; }
    $('consent').hidden = false;
    $('agree').addEventListener('click', async () => {
      await L.set({ [K.consent]: { v: CONSENT_V, t: Date.now() } });
      $('consent').hidden = true;
      boot().catch(e => setStatus('Something went wrong: ' + e.message, true));
    });
    $('decline').addEventListener('click', () => { $('declined').hidden = false; $('decline').disabled = true; });
  }

  async function wipe(includeConsent) {
    const all = await L.get(null);
    const keys = Object.keys(all).filter(k => k.startsWith('cfx-p:') ||
      (k.startsWith('cfx-mc:') && (includeConsent || k !== K.consent)));
    if (keys.length) await L.remove(keys);
    location.reload();
  }

  async function init() {
    const settings = cfxNormalize((await chrome.storage.sync.get('settings')).settings);
    applyTheme(settings);
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.settings) applyTheme(cfxNormalize(changes.settings.newValue));
      if (area === 'local' && (changes[K.log] || changes[K.active])) {
        syncHistory().then(loadPast).catch(() => {});
      }
    });
    const consent = await get(K.consent);
    if (!consent || consent.v < CONSENT_V) { showConsent(); return; }
    await boot();
  }

  let booted = false;
  async function boot() {
    if (booted) return;
    booted = true;
    $('app').hidden = false;
    if (PRIVACY_URL) { const pl = $('privacyLink2'); pl.href = PRIVACY_URL; pl.hidden = false; }
    $('clearData').addEventListener('click', () => {
      if (confirm('Delete your saved handle, solved list, mashup history, contests, share codes, timers and notes from this browser?')) wipe(false);
    });
    $('withdraw').addEventListener('click', () => {
      if (confirm('Delete all of that and withdraw your consent? The mashup builder will ask again next time.')) wipe(true);
    });

    const [prefs, handle, act] = await Promise.all([get(K.prefs), get(K.handle), get(K.active)]);
    restorePrefs(prefs);
    active = act || null;
    if (active && active.status !== 'running') {
      await L.remove(K.active);
      active = null;
    }
    await syncHistory();
    $('handle').value = handle || '';
    loadPast();

    try { await loadBank(); }
    catch (e) { setStatus('Could not load the problemset: ' + e.message, true); return; }
    renderTags();
    if (handle) loadSolved(handle).then(updatePool).catch(() => {});
    $('generate').disabled = false;
    $('joinBtn').disabled = !$('joinCode').value.trim();
    $('joinCode').addEventListener('input', () => { $('joinBtn').disabled = !$('joinCode').value.trim(); });
    $('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter' && !$('joinBtn').disabled) onJoin(); });
    $('joinBtn').addEventListener('click', onJoin);
    $('joinCard').addEventListener('toggle', () => {
      if (!$('joinCard').open) return;
      $('joinCode').focus({ preventScroll: true });
    });
    $('copyCode').addEventListener('click', e => copyText(currentCode(), e.currentTarget));
    $('copyInvite').addEventListener('click', e => copyText(inviteText(), e.currentTarget));
    updatePool();

    async function onHandleInput() {
      const h = $('handle').value.trim();
      if (!h) {
        solved = new Set(); tried = new Set();
        L.set({ [K.handle]: '' }).catch(() => {});
        updatePool();
        if (picked.length) renderPreview();
      }
    }
    async function onHandleChange() {
      const h = $('handle').value.trim();
      L.set({ [K.handle]: h }).catch(() => {});
      try {
        await loadSolved(h);
      } catch (e) {
        if (h) setStatus(`Could not read submissions for "${h}": ${e.message}`, true);
      }
      updatePool();
      if (picked.length) renderPreview();
    }
    $('handle').addEventListener('input', onHandleInput);
    $('handle').addEventListener('change', onHandleChange);
    $('handle').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onHandleChange();
      }
    });

    for (const id of ['count', 'lo', 'hi', 'duration', 'exSolved', 'exTried', 'avoidRepeats', 'unique']) {
      $(id).addEventListener('change', () => { updatePool(); savePrefs(); });
    }
    document.querySelectorAll('input[name=tagMode]').forEach(r => r.addEventListener('change', () => { updatePool(); savePrefs(); }));
    const tagModes = document.querySelector('#tagsCard .tag-modes');
    if (tagModes) tagModes.addEventListener('click', e => e.stopPropagation());

    $('clearTags').addEventListener('click', () => {
      selTags.clear();
      document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', 'false'));
      updateTagsHint();
      updatePool(); savePrefs();
    });
    $('generate').addEventListener('click', onGenerate);
    $('again').addEventListener('click', onGenerate);
    $('start').addEventListener('click', onStart);
  }
  init().catch(e => setStatus('Something went wrong: ' + e.message, true));
})();
