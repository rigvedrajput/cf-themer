// CF Themer — Content script for themes, focus mode, and problem tools
(() => {
  'use strict';

  const root = document.documentElement;
  const CACHE_KEY = 'cfx-settings';
  let s = { ...CFX_DEFAULTS };

  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };

  const varsEl = document.createElement('style');
  varsEl.id = 'cfx-vars';
  root.appendChild(varsEl);

  const flag = (name, on) => on ? root.setAttribute(name, '') : root.removeAttribute(name);

  // Color utilities
  const hexToRgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const chroma = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, sat = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, sat, l];
  }
  function hslToRgb(h, sat, l) {
    if (sat === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
    const p = 2 * l - q;
    const f = t => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  const parseColor = str => {
    if (!str) return null;
    const n = str.match(/-?\d*\.?\d+(?:e-?\d+)?/g);
    if (!n || n.length < 3) return null;
    let v = n.map(Number);
    if (str.startsWith('color(')) v = [v[0] * 255, v[1] * 255, v[2] * 255, v.length > 3 ? v[3] : 1];
    return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
  };
  const isLight = c => { const L = lum(c); return L > 0.55 || (L > 0.38 && chroma(c) < 40); };
  const hasOwnText = el => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  };

  // Readability guard: fixes hardcoded light backgrounds and unreadable text
  const ATTRS = ['data-cfx-fix', 'data-cfx-surf', 'data-cfx-bd', 'data-cfx-empty', 'data-cfx-stk'];
  const ATTR_SEL = ATTRS.map(a => `[${a}]`).join(',');
  const SIDES = [['Top', 't'], ['Right', 'r'], ['Bottom', 'b'], ['Left', 'l']];

  const SKIP_ALL = new Set(['script', 'style', 'link', 'meta', 'head', 'title', 'noscript', 'template', 'option', 'br', 'html', 'body']);
  const NO_BG_FIX = new Set(['img', 'canvas', 'video', 'audio', 'iframe', 'picture', 'source', 'mark', 'input', 'select', 'textarea', 'button']);
  const NO_TEXT_FIX = 'button,select,textarea,input,.MathJax,.MathJax_Display,.MathJax_Preview,mjx-container';

  let gen = 0;
  let seen = new WeakMap();
  const inlineColor = new WeakMap();
  let pal = null;
  let lastKey = '';
  let fullTimer = null;
  let observer = null;
  let widgetEl = null;

  function setPalette() {
    const t = CFX_THEMES[s.theme];
    pal = (s.contrastFix && t && t.vars)
      ? { bg: hexToRgb(t.vars.bg), fg: hexToRgb(t.vars.fg), panel: hexToRgb(t.vars.panel) }
      : null;
  }

  function backdrop(el) {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      const b = parseColor(cs.backgroundColor);
      if (b && b[3] > 0.3) return (isLight(b) && cs.backgroundImage === 'none') ? pal.panel : b;
    }
    return pal.bg;
  }

  // Inspect element for clashing styles and queue adjustments
  function inspect(el, out) {
    if (seen.get(el) === gen) return;
    seen.set(el, gen);
    const tag = el.localName;
    if (SKIP_ALL.has(tag)) return;
    if (el.closest('#cfx-widget,#cfx-pt,#cfx-mc,#cfx-focus-exit,[id*="vote-"],.vote-item,.alert,[class*="alert-"]')) return;

    if (el instanceof SVGElement) {
      if (tag !== 'rect') return;
      const cs = getComputedStyle(el);
      const rec = { el };
      const f = parseColor(cs.fill);
      if (f && f[3] > 0.5 && lum(f) > 0.45 && chroma(f) < 40) {
        let big = false;
        try { big = el.width.baseVal.value * el.height.baseVal.value > 2500; } catch (e) {}
        rec.empty = big ? 'bg' : '';
      }
      const st = parseColor(cs.stroke);
      if (st && st[3] > 0.5 && lum(st) > 0.7 && chroma(st) < 40 && parseFloat(cs.strokeWidth) > 0) rec.stk = true;
      if (rec.empty !== undefined || rec.stk) out.push(rec);
      return;
    }

    const cs = getComputedStyle(el);
    const rec = { el };
    let dirty = false;

    const bg = parseColor(cs.backgroundColor);
    const hasBg = !!(bg && bg[3] > 0.3);
    const surf = hasBg && !NO_BG_FIX.has(tag) && isLight(bg) && cs.backgroundImage === 'none';
    if (surf) { rec.surf = true; dirty = true; }

    let bd = '';
    for (const [side, k] of SIDES) {
      if (cs['border' + side + 'Style'] === 'none' || parseFloat(cs['border' + side + 'Width']) === 0) continue;
      const c = parseColor(cs['border' + side + 'Color']);
      if (c && c[3] > 0.3 && lum(c) > 0.3) bd += (bd ? ' ' : '') + k;
    }
    if (bd) { rec.bd = bd; dirty = true; }

    if (hasOwnText(el) && !el.closest(NO_TEXT_FIX)) {
      const c = parseColor(cs.color);
      if (c && c[3] >= 0.4 && lum(c) < 0.3) {
        const base = surf ? pal.panel : (hasBg ? bg : backdrop(el));
        if (lum(base) <= 0.2 && ratio(c, base) < 4) {
          const [h, sat, l0] = rgbToHsl(c);
          let res;
          if (sat < 0.1) res = pal.fg;
          else {
            let l = l0;
            res = c;
            while (l < 0.92 && ratio(res, base) < 4.5) { l += 0.03; res = hslToRgb(h, sat, l); }
          }
          rec.fix = rgbToHex(res);
          dirty = true;
        }
      }
    }
    if (dirty) out.push(rec);
  }

  function apply(out) {
    for (const r of out) {
      const el = r.el;
      if (r.surf) el.setAttribute('data-cfx-surf', '');
      if (r.bd) el.setAttribute('data-cfx-bd', r.bd);
      if (r.fix) {
        el.style.setProperty('--cfx-fixed', r.fix);
        el.setAttribute('data-cfx-fix', '');
        if (el.style.getPropertyPriority('color') === 'important' && !inlineColor.has(el)) {
          inlineColor.set(el, el.style.getPropertyValue('color'));
          el.style.setProperty('color', r.fix, 'important');
        }
      }
      if (r.empty !== undefined) el.setAttribute('data-cfx-empty', r.empty);
      if (r.stk) el.setAttribute('data-cfx-stk', '');
    }
  }

  function clearFixes() {
    gen++;
    document.querySelectorAll(ATTR_SEL).forEach(el => {
      for (const a of ATTRS) el.removeAttribute(a);
      if (el.style) {
        el.style.removeProperty('--cfx-fixed');
        if (inlineColor.has(el)) { el.style.setProperty('color', inlineColor.get(el), 'important'); inlineColor.delete(el); }
      }
    });
  }

  function processList(list, myGen, onDone) {
    let i = 0;
    (function step() {
      if (myGen !== gen || !pal) return;
      const end = Math.min(i + 400, list.length);
      const out = [];
      for (; i < end; i++) inspect(list[i], out);
      apply(out);
      if (i < list.length) setTimeout(step, 0);
      else if (onDone) onDone();
    })();
  }

  const releaseAnim = () => root.removeAttribute('data-cfx-noanim');
  function fullScan() {
    if (!pal || !document.body) { releaseAnim(); return; }
    processList([document.body, ...document.body.querySelectorAll('*')], gen, releaseAnim);
  }
  function scheduleFull(delay = 250) {
    clearTimeout(fullTimer);
    fullTimer = setTimeout(fullScan, delay);
  }

  function onMutations(records) {
    if (!pal) return;
    const todo = new Set();
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (n.nodeType === 1) todo.add(n);
        else if (n.nodeType === 3 && r.target.nodeType === 1) { seen.delete(r.target); todo.add(r.target); }
      }
    }
    if (!todo.size) return;
    const list = [];
    for (const n of todo) {
      if (!n.isConnected) continue;
      list.push(n);
      if (n.firstElementChild) n.querySelectorAll('*').forEach(c => list.push(c));
    }
    if (list.length) processList(list, gen);
  }

  // Tag "Find user" sidebox for proper layout alignment
  const FIND_USER = /find user|найти пользователя/i;
  function tagFindUser() {
    for (const cap of document.querySelectorAll('.roundbox .caption, .sidebox .caption')) {
      if (!FIND_USER.test(cap.textContent)) continue;
      const box = cap.closest('.roundbox, .sidebox');
      if (!box) continue;
      const host = box.querySelector('form') || [...box.children].find(c => c !== cap && !c.contains(cap));
      if (host && !host.hasAttribute('data-cfx-find')) host.setAttribute('data-cfx-find', '');
    }
  }

  function tagSearchBox() {
    const box = document.querySelector('.menu-box');
    if (!box) return;
    const input = box.querySelector('input:not([type]), input[type="text"], input[type="search"]');
    const tabs = box.querySelector('ul.menu-list, ul.main-menu-list');
    if (!input || !tabs || tabs.contains(input)) return;
    let host = input;
    while (host.parentElement && host.parentElement !== box && !host.parentElement.contains(tabs)) host = host.parentElement;
    if (host !== box && !host.contains(tabs) && !host.hasAttribute('data-cfx-search')) host.setAttribute('data-cfx-search', '');
  }

  // Focus mode: isolates the problem statement and dims outside distractions
  let hasProblem = false;

  function markFocusPath() {
    document.querySelectorAll('[data-cfx-keep]').forEach(el => el.removeAttribute('data-cfx-keep'));
    const stmts = document.querySelectorAll('.problem-statement');
    hasProblem = stmts.length > 0;
    for (const st of stmts) {
      st.setAttribute('data-cfx-keep', 'stmt');
      for (let p = st.parentElement; p && p !== root; p = p.parentElement) {
        if (p.getAttribute('data-cfx-keep') !== 'stmt') p.setAttribute('data-cfx-keep', 'path');
      }
    }
    renderFocus();
  }

  function renderFocus() {
    const on = s.focus && hasProblem;
    flag('data-cfx-has-problem', hasProblem);
    flag('data-cfx-focus', on);
    let chip = document.getElementById('cfx-focus-exit');
    if (on && document.body) {
      if (!chip) {
        chip = document.createElement('button');
        chip.id = 'cfx-focus-exit';
        chip.type = 'button';
        chip.textContent = 'Exit focus · Alt+Shift+F';
        chip.addEventListener('click', toggleFocus);
        document.body.appendChild(chip);
      }
    } else if (chip) chip.remove();
    updateFocusButton();
  }

  function toggleFocus() {
    if (!hasProblem) return;
    s.focus = !s.focus;
    render();
    save();
  }

  function updateFocusButton() {
    const b = document.getElementById('cfx-focus-btn');
    if (!b) return;
    b.style.display = hasProblem ? '' : 'none';
    b.textContent = 'Focus mode: ' + (s.focus ? 'on' : 'off');
  }

  let pageLoaded = document.readyState === 'complete';
  window.addEventListener('load', () => { pageLoaded = true; });
  function keepFocusOverlays(records) {
    if (!(s.focus && hasProblem) || !pageLoaded) return;
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1 || n.hasAttribute('data-cfx-keep')) continue;
        const p = n.parentElement;
        if (!p || p.getAttribute('data-cfx-keep') !== 'path') continue;
        const pos = getComputedStyle(n).position;
        if (pos === 'absolute' || pos === 'fixed') n.setAttribute('data-cfx-keep', 'dyn');
      }
    }
  }

  function watchForStatement() {
    const mo = new MutationObserver(() => {
      if (document.querySelector('.problem-statement')) { mo.disconnect(); markFocusPath(); }
    });
    mo.observe(root, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => mo.disconnect(), { once: true });
  }

  // Problem tools: timer and notes for the active problem
  const PT_RE = /^\/(?:group\/[^/]+\/)?(?:(contest|gym)\/(\d+)\/problem\/([A-Za-z0-9]+)|(problemset)\/problem\/(\d+)\/([A-Za-z0-9]+))\/?$/;
  function problemKey() {
    const m = PT_RE.exec(location.pathname);
    if (!m) return null;
    return m[1] ? `${m[1]}${m[2]}/${m[3].toUpperCase()}` : `contest${m[5]}/${m[6].toUpperCase()}`;
  }
  const PT_KEY = problemKey();
  const PT = { el: null, refs: null, data: null, since: null, n: 0, tick: null, noteTimer: null, token: 0 };

  const fmtTime = ms => {
    const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sec = t % 60;
    const p = n => String(n).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
  };
  const ptElapsed = () => PT.data.ms + (PT.since ? Date.now() - PT.since : 0);
  function ptStop() { if (PT.since) { PT.data.ms += Date.now() - PT.since; PT.since = null; } }
  function ptStart() { if (!PT.since && PT.data && !PT.data.paused && !document.hidden) PT.since = Date.now(); }
  function ptSave() {
    if (!PT.data || !alive()) return;
    if (PT.since) { PT.data.ms = ptElapsed(); PT.since = Date.now(); }
    try { chrome.storage.local.set({ ['cfx-p:' + PT_KEY]: { ms: PT.data.ms, paused: PT.data.paused, note: PT.data.note } }); } catch (e) {}
  }
  function ptPaint() {
    if (!PT.el || !PT.data) return;
    PT.refs.time.textContent = fmtTime(ptElapsed());
    PT.refs.toggle.textContent = PT.data.paused ? 'Resume' : 'Pause';
    PT.el.classList.toggle('paused', !!PT.data.paused);
  }

  function ptMount() {
    const el = document.createElement('div');
    el.id = 'cfx-pt';
    el.innerHTML =
      '<div id="cfx-pt-panel">' +
        '<div class="cfx-pt-row"><span class="cfx-pt-title"></span><span class="cfx-pt-spacer"></span>' +
          '<button type="button" data-act="toggle">Pause</button><button type="button" data-act="reset">Reset</button></div>' +
        '<textarea maxlength="20000" spellcheck="false" disabled placeholder="Notes for this problem (kept in this browser only)"></textarea>' +
        '<div class="cfx-pt-status"></div>' +
      '</div>' +
      '<button type="button" id="cfx-pt-chip" aria-label="Problem timer and notes"><span class="cfx-pt-dot"></span><span class="cfx-pt-time">0:00</span></button>';
    const refs = {
      time: el.querySelector('.cfx-pt-time'),
      toggle: el.querySelector('[data-act="toggle"]'),
      reset: el.querySelector('[data-act="reset"]'),
      note: el.querySelector('textarea'),
      status: el.querySelector('.cfx-pt-status'),
      chip: el.querySelector('#cfx-pt-chip')
    };
    el.querySelector('.cfx-pt-title').textContent = PT_KEY.replace(/^(contest|gym)(\d+)\/(.+)$/, '$3 · $1 $2');
    PT.el = el; PT.refs = refs;
    PT.data = { ms: 0, paused: false, note: '' };
    const myToken = ++PT.token;

    refs.chip.addEventListener('click', () => el.classList.toggle('open'));
    refs.toggle.addEventListener('click', () => {
      PT.data.paused = !PT.data.paused;
      if (PT.data.paused) ptStop(); else ptStart();
      ptSave(); ptPaint();
    });
    refs.reset.addEventListener('click', () => {
      PT.data.ms = 0;
      if (PT.since) PT.since = Date.now();
      ptSave(); ptPaint();
    });
    refs.note.addEventListener('input', () => {
      PT.data.note = refs.note.value;
      refs.status.textContent = 'Saving…';
      clearTimeout(PT.noteTimer);
      PT.noteTimer = setTimeout(() => { ptSave(); refs.status.textContent = 'Saved'; }, 500);
    });
    document.body.appendChild(el);

    const finish = stored => {
      if (myToken !== PT.token || !PT.el) return;
      if (stored && typeof stored === 'object') {
        PT.data.ms = Number.isFinite(stored.ms) && stored.ms > 0 ? stored.ms : 0;
        PT.data.paused = !!stored.paused;
        PT.data.note = typeof stored.note === 'string' ? stored.note.slice(0, 20000) : '';
      }
      refs.note.value = PT.data.note;
      refs.note.disabled = false;
      ptStart(); ptPaint();
    };
    if (alive()) {
      chrome.storage.local.get('cfx-p:' + PT_KEY).then(r => finish(r['cfx-p:' + PT_KEY])).catch(() => finish(null));
    } else finish(null);

    PT.n = 0;
    PT.tick = setInterval(() => {
      if (document.hidden) return;
      ptPaint();
      if (++PT.n % 15 === 0) ptSave();
    }, 1000);
  }

  function ptUnmount() {
    if (!PT.el) return;
    ptStop(); ptSave();
    clearInterval(PT.tick); clearTimeout(PT.noteTimer);
    PT.el.remove();
    PT.el = null; PT.refs = null; PT.since = null; PT.data = null; PT.token++;
  }

  function syncProblemTools() {
    const want = !!(s.problemTools && PT_KEY && document.body);
    if (want && !PT.el) ptMount();
    else if (!want && PT.el) ptUnmount();
  }

  document.addEventListener('visibilitychange', () => {
    if (!PT.data) return;
    if (document.hidden) { ptStop(); ptSave(); } else { ptStart(); ptPaint(); }
  });
  window.addEventListener('pagehide', () => { if (PT.data) { ptStop(); ptSave(); } });

  // Apply theme and visibility settings
  function render() {
    const key = s.theme + '|' + s.contrastFix;
    if (key !== lastKey) root.setAttribute('data-cfx-noanim', '');
    const t = CFX_THEMES[s.theme];
    let css = ':root{';
    if (t && t.vars) for (const [k, v] of Object.entries(t.vars)) css += `--cfx-${k}:${v};`;
    css += `--cfx-code-size:${s.codeSize ? s.codeSize + 'px' : '13px'};}`;
    varsEl.textContent = css;

    flag('data-cfx', !!(t && t.vars));
    flag('data-cfx-lockin', s.theme === 'lockin');
    flag('data-cfx-code', !!s.codeSize);
    flag('data-cfx-hide-tags', s.hideTags);
    flag('data-cfx-hide-rating', s.hideRating);
    flag('data-cfx-hide-solved', s.hideSolved);
    setPalette();
    buildWidget();
    renderFocus();
    syncProblemTools();

    if (key !== lastKey) {
      lastKey = key;
      clearFixes();
      scheduleFull(60);
    }
  }

  let saveTimer = null;
  function persist() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function save() {
    persist();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!alive()) return;
      try { chrome.storage.sync.set({ settings: s }); } catch (e) {}
    }, 300);
  }
  function setTheme(id) { s.theme = id; render(); save(); }
  function cycleTheme() {
    const i = CFX_ORDER.indexOf(s.theme);
    setTheme(CFX_ORDER[(i + 1) % CFX_ORDER.length]);
  }

  // Floating quick-switch widget
  function buildWidget() {
    let box = document.getElementById('cfx-widget');
    if (!s.widget) { if (box) box.remove(); widgetEl = null; return; }
    if (!document.body) return;

    if (!box) {
      box = document.createElement('div');
      box.id = 'cfx-widget';
      const fab = document.createElement('button');
      fab.id = 'cfx-fab';
      fab.type = 'button';
      fab.title = 'CF Themer (Alt+Shift+T cycles themes)';
      fab.setAttribute('aria-label', 'CF Themer: choose theme');
      fab.setAttribute('aria-haspopup', 'true');
      fab.textContent = '◐';
      fab.addEventListener('click', () => {
        const open = box.classList.toggle('open');
        fab.setAttribute('aria-expanded', String(open));
      });
      const panel = document.createElement('div');
      panel.id = 'cfx-panel';
      for (const id of CFX_ORDER) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.id = id;
        b.textContent = CFX_THEMES[id].name;
        b.addEventListener('click', () => setTheme(id));
        panel.appendChild(b);
      }
      const focusBtn = document.createElement('button');
      focusBtn.id = 'cfx-focus-btn';
      focusBtn.type = 'button';
      focusBtn.addEventListener('click', () => { toggleFocus(); box.classList.remove('open'); });
      panel.appendChild(focusBtn);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'Alt+Shift+T themes · Alt+Shift+F focus';
      panel.appendChild(hint);
      box.append(panel, fab);
      document.body.appendChild(box);
      document.addEventListener('click', e => { if (!box.contains(e.target)) box.classList.remove('open'); });
    }
    widgetEl = box;
    box.querySelectorAll('#cfx-panel button').forEach(b => b.classList.toggle('active', b.dataset.id === s.theme));
    updateFocusButton();
  }

  // Initial load and settings sync
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached) s = cfxNormalize(cached);
  } catch (e) {}
  render();

  if (alive()) {
    chrome.storage.sync.get('settings').then(r => {
      s = cfxNormalize(r.settings);
      persist();
      render();
    }).catch(() => {});

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.settings) {
        s = cfxNormalize(changes.settings.newValue);
        persist();
        render();
      }
    });
  }

  const onReady = () => {
    buildWidget();
    markFocusPath();
    syncProblemTools();
    tagFindUser();
    tagSearchBox();
    scheduleFull(0);
    if (document.body && !observer) {
      observer = new MutationObserver(onMutations);
      observer.observe(document.body, { childList: true, subtree: true });
      new MutationObserver(keepFocusOverlays).observe(document.body, { childList: true, subtree: true });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();
  window.addEventListener('load', () => { markFocusPath(); tagFindUser(); tagSearchBox(); scheduleFull(300); });
  if (s.focus && document.readyState === 'loading') watchForStatement();

  document.addEventListener('keydown', e => {
    if (e.altKey && e.shiftKey && e.code === 'KeyT' && !e.repeat) { e.preventDefault(); cycleTheme(); }
    else if (e.altKey && e.shiftKey && e.code === 'KeyF' && !e.repeat) { e.preventDefault(); toggleFocus(); }
    else if (e.key === 'Escape' && widgetEl) widgetEl.classList.remove('open');
  });
})();
