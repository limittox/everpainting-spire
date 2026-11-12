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
