// CF Themer — Theme definitions and default settings

const CFX_DEFAULTS = {
  theme: 'monokai',
  codeSize: 0,        // 0 = site default
  hideTags: false,    // Hide problem tags
  hideRating: false,  // Hide problem difficulty rating
  widget: true,       // Floating quick-switch button
  contrastFix: true,  // Auto-adjust clashing hard-coded colors
  hideSolved: false,  // Hide solved count
  problemTools: true, // Problem timer and notes on problem pages
  focus: false        // Focus mode: problem statement only
};

const CFX_THEMES = {
  off: { name: 'Default (off)', vars: null },

  monokai: {
    name: 'Monokai',
    vars: {
      bg: '#272822', panel: '#2d2e27', panel2: '#383930', codebg: '#1e1f1a',
      fg: '#f8f8f2', muted: '#b0ab94', border: '#48493c',
      accent: '#a6e22e', link: '#f8f8f2', ok: '#a6e22e', bad: '#ff7799',
      kwd: '#a6e22e', str: '#cfcab0', com: '#8a8670', typ: '#ffffff',
      lit: '#f8f8f2', tag: '#a6e22e', atn: '#cfcab0', atv: '#f8f8f2'
    }
  },

  dracula: {
    name: 'Dracula',
    vars: {
      bg: '#20212b', panel: '#272833', panel2: '#313340', codebg: '#1a1b23',
      fg: '#f2f2f4', muted: '#a6a9b8', border: '#3f4152',
      accent: '#b9a6e6', link: '#f2f2f4', ok: '#dcdce4', bad: '#ff7d7d',
      kwd: '#b9a6e6', str: '#cbced9', com: '#7f8498', typ: '#ffffff',
      lit: '#f2f2f4', tag: '#b9a6e6', atn: '#cbced9', atv: '#f2f2f4'
    }
  },

  black: {
    name: 'Pure Black',
    vars: {
      bg: '#000000', panel: '#0b0b0c', panel2: '#161618', codebg: '#050506',
      fg: '#ececec', muted: '#9a9aa2', border: '#2a2a2e',
      accent: '#5eb0ff', link: '#ececec', ok: '#5eb0ff', bad: '#ff6b63',
      kwd: '#5eb0ff', str: '#bdbdc4', com: '#7c7c86', typ: '#ffffff',
      lit: '#ececec', tag: '#5eb0ff', atn: '#bdbdc4', atv: '#ececec'
    }
  },

  lockin: {
    name: 'Lock-In',
    vars: {
      bg: '#000000', panel: '#0b0b0b', panel2: '#161616', codebg: '#050505',
      fg: '#ededed', muted: '#9a9a9a', border: '#2b2b2b',
      accent: '#ff3b30', link: '#ededed', ok: '#ededed', bad: '#ff3b30',
      kwd: '#ff3b30', str: '#bdbdbd', com: '#7a7a7a', typ: '#ffffff',
      lit: '#ededed', tag: '#ff3b30', atn: '#bdbdbd', atv: '#ededed'
    }
  }
};

const CFX_ORDER = Object.keys(CFX_THEMES);

const CFX_BOOLS = ['hideTags', 'hideRating', 'hideSolved', 'widget', 'contrastFix', 'problemTools', 'focus'];

// Sanitize settings with fallback to defaults
function cfxNormalize(raw) {
  const s = { ...CFX_DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!CFX_THEMES[s.theme]) s.theme = CFX_DEFAULTS.theme;
  s.codeSize = Math.max(0, Math.min(30, parseInt(s.codeSize, 10) || 0));
  for (const k of CFX_BOOLS) s[k] = !!s[k];
  return s;
}
