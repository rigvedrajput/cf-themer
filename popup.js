let s = cfxNormalize();
const $ = id => document.getElementById(id);

function save() { chrome.storage.sync.set({ settings: s }); }

function renderThemes() {
  const grid = $('themes');
  grid.innerHTML = '';
  const entries = CFX_ORDER.map(id => ({ id, ...CFX_THEMES[id] }));
  const isOdd = entries.length % 2 !== 0;

  entries.forEach((entry, idx) => {
    const { id } = entry;
    const t = CFX_THEMES[id];
    const v = t.vars || { bg: '#ffffff', accent: '#3b5998', kwd: '#0000cc', str: '#007700' };
    const b = document.createElement('button');
    b.className = 'theme' + (id === s.theme ? ' active' : '');
    b.dataset.id = id;

    if (isOdd && idx === entries.length - 1) {
      b.style.gridColumn = '1 / -1';
    }

    b.innerHTML = `<span class="dots">${[v.bg, v.accent, v.kwd, v.str]
      .map(c => `<i style="background:${c}"></i>`).join('')}</span><span>${t.name}</span>`;
    b.addEventListener('click', () => { s.theme = id; save(); renderThemes(); });
    grid.appendChild(b);
  });

  const cur = CFX_THEMES[s.theme];
  document.documentElement.style.setProperty('--accent', (cur.vars && cur.vars.accent) || '#8a8fa3');
}

function init() {
  $('ver').textContent = 'v' + chrome.runtime.getManifest().version;
  $('size').value = s.codeSize;
  for (const k of ['hideTags', 'hideRating', 'hideSolved', 'widget', 'contrastFix', 'problemTools', 'focus']) {
    $(k).checked = s[k];
    $(k).addEventListener('change', e => { s[k] = e.target.checked; save(); });
  }
  $('size').addEventListener('change', e => {
    s.codeSize = Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 0));
    e.target.value = s.codeSize;
    save();
  });
  $('mashup').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('mashup.html') });
    window.close();
  });
  renderThemes();
}

chrome.storage.sync.get('settings').then(r => {
  s = cfxNormalize(r.settings);
  init();
});
