// A handful of settings, kept in this browser. The panel's controls are plain HTML (see #menu in index.html):
// every slider or group of buttons carries data-opt="<name>", and this file keeps the two in step.

const KEY = 'everpainting.settings.v1';

export const DEFAULTS = {
  volume: 0.8,      // everything, 0..1
  music: 0.8,       // the music under it, 0..1
  look: 1,          // mouse look speed, 0.4..2
  invert: false,    // push the mouse up to look down
  follow: true,     // the camera drifts round behind the painter when left alone
  filter: 2,        // 0 plain, 1 painterly, 2 heavy impasto
  detail: 2,        // 0 soft, 1 standard, 2 fine: how many pixels the picture is painted at
  sharp: false,     // things keep their detail with distance: the brush strokes shrink the further off they are
};
const RANGE = { volume: [0, 1], music: [0, 1], look: [0.4, 2], filter: [0, 2], detail: [0, 2] };

function clean(key, v) {
  const d = DEFAULTS[key];
  if (typeof d === 'boolean') return v === true || v === 'true';
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  const [lo, hi] = RANGE[key];
  const c = Math.max(lo, Math.min(hi, n));
  return key === 'filter' || key === 'detail' ? Math.round(c) : c;
}

export function createSettings(onChange) {
  const values = { ...DEFAULTS };
  let stored = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const k of Object.keys(DEFAULTS)) if (k in saved) values[k] = clean(k, saved[k]);
  } catch (e) { stored = false; }

  const sliders = [...document.querySelectorAll('input[data-opt]')];
  const groups = [...document.querySelectorAll('.seg[data-opt]')];

  function show(key) {
    const v = values[key];
    for (const el of sliders) if (el.dataset.opt === key) {
      el.value = String(Math.round(v * 100));
      const lo = Number(el.min), hi = Number(el.max);
      el.style.setProperty('--fill', `${((el.value - lo) / (hi - lo)) * 100}%`);
      const out = el.nextElementSibling;
      if (out) out.textContent = key === 'look' ? `${v.toFixed(1)}×` : v === 0 ? 'Off' : `${Math.round(v * 100)}%`;
    }
    for (const g of groups) if (g.dataset.opt === key) for (const b of g.children) b.setAttribute('aria-pressed', String(b.dataset.v === String(v)));
  }

  function set(key, v) {
    if (!(key in DEFAULTS)) return;
    v = clean(key, v);
    if (values[key] === v) { show(key); return; }
    values[key] = v;
    show(key);
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch (e) { stored = false; }
    onChange(key, v, values);
  }

  for (const el of sliders) el.addEventListener('input', () => set(el.dataset.opt, Number(el.value) / 100));
  for (const g of groups) g.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) set(g.dataset.opt, b.dataset.v); });
  for (const k of Object.keys(DEFAULTS)) { show(k); onChange(k, values[k], values); }

  return { values, set, get stored() { return stored; } };
}

// ------------------------------------------------------------------------------------------------ keys
// The game itself only ever hears the keys it was written for (W, Space, E...). Choosing another key for one of
// them is done here, before the game hears anything: the chosen key is passed on as the one it stands for.
const KEYS = 'everpainting.keys.v1';
export const ACTIONS = [
  ['fwd', 'Forward', 'KeyW'], ['back', 'Back', 'KeyS'], ['left', 'Left', 'KeyA'], ['right', 'Right', 'KeyD'], ['jump', 'Jump', 'Space'],
  ['skate', 'Skate', 'ShiftLeft'], ['use', 'Use', 'KeyE'], ['next', 'Next colour', 'KeyQ'], ['paint', 'Paint', 'KeyF'],
  ['book', 'Sketchbook', 'KeyG'], ['photo', 'Photo', 'KeyC'], ['map', 'Map', 'KeyH'], ['sound', 'Sound on or off', 'KeyM'],
  ['lookU', 'Look up', 'ArrowUp'], ['lookD', 'Look down', 'ArrowDown'], ['lookL', 'Look left', 'ArrowLeft'], ['lookR', 'Look right', 'ArrowRight'],
];
// A controller's buttons, the same way: each of these is a button's number, as the browser counts them. (Start is not
// here: it is the controller's Enter, and stays so. The triggers skate as well, unless one of them is given another job.)
const PADS = 'everpainting.pad.v1';
export const PAD_ACTIONS = [['jump', 'Jump', 0], ['skate', 'Skate', 1], ['paint', 'Paint', 2], ['use', 'Use', 3], ['next', 'Next colour', 4]];
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'Left stick', 'Right stick', 'Up', 'Down', 'Left', 'Right'];
const padName = (i) => PAD_NAMES[i] || 'Button ' + i;
const firstPad = () => (navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g && g.connected) : null) || null;
const FIXED = ['Escape', 'Tab', 'Enter'];     // never given away: the panel and the title need them
export const keyName = (code) => code.replace(/^(Key|Digit)/, '').replace(/^Arrow(\w+)/, '$1 arrow').replace(/^Numpad/, 'Num ').replace(/(\w)(Left|Right)$/, '$1');

export function createKeys(root) {
  const bind = Object.fromEntries(ACTIONS.map(([a, , d]) => [a, d]));
  try {
    const saved = JSON.parse(localStorage.getItem(KEYS) || '{}');
    for (const [a] of ACTIONS) if (typeof saved[a] === 'string' && saved[a] && !FIXED.includes(saved[a])) bind[a] = saved[a];
  } catch (e) { /* the keys as written, then */ }
  const pad = Object.fromEntries(PAD_ACTIONS.map(([a, , d]) => [a, d]));
  try {
    const saved = JSON.parse(localStorage.getItem(PADS) || '{}');
    for (const [a] of PAD_ACTIONS) if (Number.isInteger(saved[a]) && saved[a] >= 0 && saved[a] < 32 && saved[a] !== 9) pad[a] = saved[a];
  } catch (e) { /* the buttons as written, then */ }
  const norm = (code) => (code === 'ShiftRight' ? 'ShiftLeft' : code);          // either Shift is Shift
  let waiting = null, padWait = null, padHeld = [];                               // the one whose button is waiting for a key; or for a button of the controller
  const show = () => {
    for (const b of root.querySelectorAll('button[data-bind]')) { b.textContent = waiting === b.dataset.bind ? 'Press a key' : keyName(bind[b.dataset.bind]); b.setAttribute('aria-pressed', String(waiting === b.dataset.bind)); }
    for (const b of root.querySelectorAll('button[data-pad]')) { b.textContent = padWait === b.dataset.pad ? 'Press a button' : padName(pad[b.dataset.pad]); b.setAttribute('aria-pressed', String(padWait === b.dataset.pad)); }
    root.querySelector('.pads').hidden = !firstPad();                             // (nothing about a controller until there is one)
    // (and wherever a key is named on the title and in the panel)
    for (const el of document.querySelectorAll('[data-act]')) el.textContent = el.dataset.act.split(' ').map((a) => keyName(bind[a])).join(' ');
  };
  const keep = () => { try { localStorage.setItem(KEYS, JSON.stringify(bind)); localStorage.setItem(PADS, JSON.stringify(pad)); } catch (e) { /* only for this visit, then */ } };
  root.innerHTML = ACTIONS.map(([a, label]) => '<label>' + label + '<button data-bind="' + a + '"></button></label>').join('')
    + '<div class="pads" hidden><span>Controller</span>' + PAD_ACTIONS.map(([a, label]) => '<label>' + label + '<button data-pad="' + a + '"></button></label>').join('') + '</div>'
    + '<button class="reset" data-reset>Reset the keys</button>';
  // (a controller is asked, not told: while one of its buttons is being chosen it is looked at twenty times a second, and the
  // first button to go down that was not down already is the answer. Start cannot be given away.)
  const listen = () => {
    if (!padWait) return;
    const g = firstPad(), down = g ? g.buttons.map((b) => b.pressed) : [];
    const i = down.findIndex((d, k) => d && !padHeld[k]);
    padHeld = down;
    if (i >= 0 && i !== 9) {
      const other = PAD_ACTIONS.find(([a]) => a !== padWait && pad[a] === i);
      if (other) pad[other[0]] = pad[padWait];                                    // (two things cannot share a button either)
      pad[padWait] = i; padWait = null; keep(); show(); return;
    }
    setTimeout(listen, 50);
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.bind) { waiting = waiting === b.dataset.bind ? null : b.dataset.bind; padWait = null; }
    else if (b.dataset.pad) { const g = firstPad(); waiting = null; padWait = padWait === b.dataset.pad ? null : b.dataset.pad; padHeld = g ? g.buttons.map((q) => q.pressed) : []; if (padWait) setTimeout(listen, 50); }
    else { for (const [a, , d] of ACTIONS) bind[a] = d; for (const [a, , d] of PAD_ACTIONS) pad[a] = d; waiting = padWait = null; keep(); }
    b.blur(); show();
  });
  addEventListener('gamepadconnected', show); addEventListener('gamepaddisconnected', show);
  // (heard before the game hears it, and kept from it: the next key pressed is the answer)
  addEventListener('keydown', (e) => {
    if (!waiting) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const code = norm(e.code);
    if (code && !FIXED.includes(code)) {
      const other = ACTIONS.find(([a]) => a !== waiting && bind[a] === code);
      if (other) bind[other[0]] = bind[waiting];                                  // two things cannot share a key: they change places
      bind[waiting] = code; keep();
    }
    waiting = null; show();
  }, true);
  show();
  return {
    bind, pad,
    /** What the game should hear when this key goes down or up (null: nothing at all). */
    hear(code) {
      code = norm(code);
      for (const [a, , d] of ACTIONS) if (bind[a] === code) return d;
      return ACTIONS.some(([, , d]) => d === code) ? null : code;                 // (a key whose own job has been given to another)
    },
    name: (a) => keyName(bind[a]),
    get plain() { return ACTIONS.every(([a, , d]) => bind[a] === d); },
    cancel() { if (waiting || padWait) { waiting = padWait = null; show(); } },
  };
}
