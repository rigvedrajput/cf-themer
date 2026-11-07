// CF Themer — Floating HUD overlay for active mashup contests
(() => {
  'use strict';

  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  if (!alive() || typeof CFX_MC === 'undefined') return;

  const root = document.documentElement;
  const K_ACTIVE = 'cfx-mc:active', K_HANDLE = 'cfx-mc:handle', K_LOG = 'cfx-mc:log', K_CONSENT = 'cfx-mc:consent';
  const POLL_MS = 30000;

  let c = null;
  let el = null, refs = null;
  let tick = null, poller = null;
  let polling = false, finishing = false;

  const pad = n => String(n).padStart(2, '0');
  const fmt = ms => {
    const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  };
  const endAt = () => c.startedAt + c.durationMin * 60000;
  const get = async key => (await chrome.storage.local.get(key))[key];
  const hasConsent = async () => { try { const v = await get(K_CONSENT); return !!(v && v.v >= 1); } catch (e) { return false; } };

  // Read-modify-write helper for active contest state in storage
  async function mutate(fn) {
    if (!alive()) return null;
    try {
      const cur = await get(K_ACTIVE);
      if (!cur) return null;
      fn(cur);
      await chrome.storage.local.set({ [K_ACTIVE]: cur });
      c = cur;
      sync();
      return cur;
    } catch (e) { return null; }
  }

  // Detect logged-in handle from page header
  async function detectHandle() {
    if (!(await hasConsent())) return;
    const a = document.querySelector('.lang-chooser a[href^="/profile/"]');
    if (!a) return;
    let h = '';
    try { h = decodeURIComponent(a.getAttribute('href').slice('/profile/'.length)).trim(); } catch (e) { return; }
    if (!/^[\w.-]{2,24}$/.test(h)) return;
    try { if ((await get(K_HANDLE)) !== h) await chrome.storage.local.set({ [K_HANDLE]: h }); } catch (e) {}
  }

  // Poll recent submissions from Codeforces API and evaluate status
  async function poll(force) {
    if (!c || c.status !== 'running' || !c.handle || polling) return;
    if (!force && Date.now() - (c.lastPoll || 0) < POLL_MS - 5000) return;
    polling = true;
    let err = null, rows = null;
    if (!(await hasConsent())) { polling = false; return; }
    try {
      const url = '/api/user.status?handle=' + encodeURIComponent(c.handle) + '&from=1&count=' + (force ? 200 : 50);
      const data = await (await fetch(url)).json();
      if (data.status !== 'OK') err = data.comment || 'Codeforces API error';
      else rows = CFX_MC.evaluate(c, data.result);
    } catch (e) { err = 'Could not reach the Codeforces API'; }
    finally { polling = false; }
    await mutate(cc => { cc.lastPoll = Date.now(); cc.error = err; if (rows) CFX_MC.applyRows(cc, rows); });
    if (!err && c && c.status === 'running' && CFX_MC.summarize(c).solved === c.problems.length) finish();
  }

  // Finalize contest, calculate penalty, and save to past mashups log
  async function finish() {
    if (!c || c.status !== 'running' || finishing) return;
    finishing = true;
    try {
      await poll(true);
      let done = false;
      const cur = await mutate(cc => {
        if (cc.status !== 'running') return;
        cc.status = 'finished';
        cc.endedAt = Math.min(Date.now(), cc.startedAt + cc.durationMin * 60000);
        done = true;
      });
      if (done && cur) {
        const sm = CFX_MC.summarize(cur);
        const log = (await get(K_LOG)) || [];
        if (!log.some(x => x.id === cur.id)) {
          log.unshift({
            id: cur.id, startedAt: cur.startedAt, durationMin: cur.durationMin, solved: sm.solved,
            total: cur.problems.length, penalty: sm.penalty, code: CFX_MC.encodeShare(cur.problems, cur.durationMin),
            lo: cur.problems[0].rating, hi: cur.problems[cur.problems.length - 1].rating
          });
          await chrome.storage.local.set({ [K_LOG]: log.slice(0, 30) });
        }
      }
    } catch (e) {} finally { finishing = false; }
  }

  // Mount HUD DOM components into page
  function mount() {
    if (el) return;
    el = document.createElement('div');
    el.id = 'cfx-mc';
    el.innerHTML =
      '<div id="cfx-mc-panel">' +
        '<div class="cfx-mc-head"><span class="cfx-mc-title"></span><span class="cfx-mc-spacer"></span><span class="cfx-mc-sum"></span></div>' +
        '<div class="cfx-mc-list"></div>' +
        '<div class="cfx-mc-note"></div>' +
        '<div class="cfx-mc-actions"></div>' +
      '</div>' +
      '<button type="button" id="cfx-mc-chip" aria-label="Mashup contest">' +
        '<span class="cfx-mc-dot"></span><span class="cfx-mc-time"></span><span class="cfx-mc-score"></span></button>';
    refs = {
      title: el.querySelector('.cfx-mc-title'), sum: el.querySelector('.cfx-mc-sum'),
      list: el.querySelector('.cfx-mc-list'), note: el.querySelector('.cfx-mc-note'),
      actions: el.querySelector('.cfx-mc-actions'), time: el.querySelector('.cfx-mc-time'),
      score: el.querySelector('.cfx-mc-score')
    };
    el.querySelector('#cfx-mc-chip').addEventListener('click', () => el.classList.toggle('open'));
    document.body.appendChild(el);
  }
  function unmount() { if (el) { el.remove(); el = null; refs = null; } }

  const button = (text, title, onClick) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cfx-mc-btn'; b.textContent = text;
    if (title) b.title = title;
    b.addEventListener('click', onClick);
    return b;
  };

  function paintTime() {
    if (!el || !c) return;
    const running = c.status === 'running';
    const left = endAt() - Date.now();
    refs.time.textContent = running ? fmt(left) : 'Done';
    el.classList.toggle('low', running && left < 5 * 60000);
    el.classList.toggle('over', !running);
  }

  function paint() {
    if (!el || !c) return;
    const running = c.status === 'running';
    const sm = CFX_MC.summarize(c);
    refs.title.textContent = running ? 'Mashup contest' : 'Mashup contest · finished';
    refs.sum.textContent = running ? `${sm.solved}/${c.problems.length} solved` : `penalty ${sm.penalty}`;
    refs.score.textContent = `${sm.solved}/${c.problems.length}`;

    refs.list.textContent = '';
    c.problems.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'cfx-mc-prob';
      const letter = document.createElement('span');
      letter.className = 'cfx-mc-letter'; letter.textContent = p.letter || String.fromCharCode(65 + i);
      const name = document.createElement('a');
      name.className = 'cfx-mc-name'; name.href = CFX_MC.problemPath(p);
      name.textContent = running ? p.name : `${p.name} (${p.rating})`;
      const at = p.apiAt || p.manualAt;
      const stat = document.createElement('span');
      stat.className = 'cfx-mc-stat' + (at ? ' ok' : '');
      if (at) stat.textContent = `✓ ${Math.max(0, Math.floor((at - c.startedAt) / 60000))}m` + (p.wrong ? ` (−${p.wrong})` : '');
      else if (p.wrong) stat.textContent = `−${p.wrong}`;
      row.append(letter, name, stat);
      if (running) {
        row.append(button(p.manualAt ? '↺' : '✓',
          p.manualAt ? 'Undo manual mark' : 'Mark solved by hand', () => mutate(cc => {
            const q = cc.problems[i];
            q.manualAt = q.manualAt ? null : Date.now();
          })));
      }
      refs.list.appendChild(row);
    });

    if (running) {
      refs.note.textContent = (c.error ? 'Submission check failed: ' + c.error + '. '
        : c.handle ? 'Your submissions are checked every 30 s. '
        : 'No handle set: mark problems solved by hand. ') + 'Tags and difficulty are hidden until the end.';
    } else {
      refs.note.textContent = `Solved ${sm.solved} of ${c.problems.length}, penalty ${sm.penalty}. Build another one from the extension popup.`;
    }

    refs.actions.textContent = '';
    if (running) {
      refs.actions.append(
        button('Check now', 'Look at your latest submissions', () => poll(true)),
        button('End contest', 'Finish now and score it', () => { if (confirm('End the mashup contest now?')) finish(); }));
    } else {
      refs.actions.append(button('Dismiss', 'Remove this contest from the page', () => chrome.storage.local.remove(K_ACTIVE)));
    }
    paintTime();
  }

  function startTimers() {
    if (!tick) tick = setInterval(() => {
      if (!c || c.status !== 'running') return;
      if (Date.now() >= endAt()) finish(); else paintTime();
    }, 1000);
    if (!poller) {
      poller = setInterval(() => { if (!document.hidden) poll(false); }, POLL_MS);
      poll(false);
    }
  }
  function stopTimers() { clearInterval(tick); clearInterval(poller); tick = poller = null; }

  // Sync HUD visibility and blind-mode flag
  function sync() {
    if (c && c.status === 'running') root.setAttribute('data-cfx-mc-live', ''); else root.removeAttribute('data-cfx-mc-live');
    if (!c) { unmount(); stopTimers(); return; }
    if (!document.body) return;
    mount();
    paint();
    if (c.status === 'running') startTimers(); else stopTimers();
  }

  get(K_ACTIVE).then(v => { c = v || null; sync(); }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[K_ACTIVE]) { c = changes[K_ACTIVE].newValue || null; sync(); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { paintTime(); poll(false); } });
  const ready = () => { sync(); detectHandle(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
