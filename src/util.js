import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- seeded random ----------
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = mulberry32(20261112);
export const rr = (a, b) => a + (b - a) * rand();
export const pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

// ---------- value noise ----------
function h3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const a = lerp(h3(xi, yi, zi), h3(xi + 1, yi, zi), xf);
  const b = lerp(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), xf);
  const c = lerp(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), xf);
  const d = lerp(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), xf);
  return lerp(lerp(a, b, yf), lerp(c, d, yf), zf);
}
export function fbm(x, y, z, oct = 3) {
  let v = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { v += a * noise3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return v / n;
}

// ---------- palettes (thick oil paint) ----------
export const PAL = {
  path: ['#f8dccb', '#f4b9c6', '#f9e6b4', '#ef8fa6', '#f6c56e', '#e96b8c', '#fff4e2', '#f7a8b0', '#fbd08a'],
  ground: ['#b765c9', '#9a5fd0', '#d86aa8', '#e96b8c', '#f08f72', '#7a4cc0', '#c85ab8', '#f6a65e', '#e0509a', '#a058d8', '#f27a9a'],
  rock: ['#6b3fa0', '#8a4fc0', '#b04fa8', '#e0609a', '#f0a050', '#4a2c7a', '#c85ab8', '#7a48b8'],
  drip: ['#7a3fa8', '#b04fa8', '#e0609a', '#5a3490', '#f0a050', '#38c8c8'],
  maple: ['#e8342a', '#f0502a', '#ff7a2e', '#c81e3a', '#ff9a4a', '#f25a7a', '#d92c2c', '#ffb25a'],
  blossom: ['#f25a9a', '#e0409a', '#ff8ac0', '#c83aa0', '#ffb0d0', '#b040b0'],
  trunk: ['#3a2233', '#52303a', '#2a1a2e', '#6a4038', '#44283c'],
  castle: ['#fff6e6', '#f4e2ff', '#e6d0ff', '#ffe9b8', '#ffd6ea', '#d8c8ff', '#fffaf0'],
  roof: ['#ffd76a', '#ffc040', '#ffe9a0', '#c9a0ff', '#f2a0d0', '#b890ff'],
  gold: ['#ffd76a', '#ffc040', '#ffe9a0', '#f5b030'],
  cloud: ['#ffffff', '#f3ecff', '#e4dcff', '#fdeef4', '#f6f2ff'],
  stone: ['#e9dcf5', '#d6c4ee', '#f6ecf8', '#c4b0e4', '#f0d8e8'],
  skin: ['#fbf1ea', '#f1e3ee', '#e6d6f2', '#fde8dc', '#d9cdf0', '#fff7f0'],
  swirlWarm: ['#fff1cf', '#ffe2a0', '#ffc860', '#f7a8c8', '#e070c0', '#b060d8', '#ffd9b0', '#fff6e4'],
  swirlCool: ['#5a78e0', '#7a58d0', '#3a50b8', '#9a70e0', '#e05a70', '#f4a060', '#2e3a90', '#c8b0f0'],
  cloak: ['#f3e6cf', '#e9d5b5', '#fff6e6', '#ecdcc0', '#f6e0c8', '#e2c9a8'],
};

const _c = new THREE.Color();
const _cache = new Map();
function colorsOf(palette) {
  let c = _cache.get(palette);
  if (!c) { c = palette.map((h) => new THREE.Color(h)); _cache.set(palette, c); }
  return c;
}

/**
 * Colour a geometry from a palette: smooth per-vertex colour that drifts between palette entries
 * along streaky noise (the stroke shader then breaks it into daubs). Result is non-indexed with
 * position / normal / color only, so everything can be merged into one mesh.
 */
export function daub(geo, palette, opts = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (g.attributes.uv2) g.deleteAttribute('uv2');
  g.clearGroups();
  const { scale = 0.12, stretch = [1, 1, 1], spread = 0.3, fn = null } = opts;
  const pos = g.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const cols = colorsOf(palette), L = cols.length;
  const off = (rand() - 0.5) * spread * L, tone = 1 + (rand() - 0.5) * 0.1;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let c = fn ? fn(x, y, z, _c, cols) : null;
    if (!c) {
      const t = fbm(x * scale * stretch[0] + 11.3, y * scale * stretch[1] + 4.1, z * scale * stretch[2] + 7.7);
      const f = clamp(((t - 0.5) * 2.6 + 0.5) * L + off, 0, L - 1.001), k = Math.floor(f);
      c = _c.copy(cols[k]).lerp(cols[Math.min(L - 1, k + 1)], clamp((f - k - 0.5) * 3 + 0.5, 0, 1));
    }
    col[i * 3] = c.r * tone; col[i * 3 + 1] = c.g * tone; col[i * 3 + 2] = c.b * tone;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.normal || opts.flat) g.computeVertexNormals();
  return g;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
/** Bake a transform into a geometry. */
export function place(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
  geo.applyMatrix4(_m);
  return geo;
}

/** Collects daubed geometries and merges them into one mesh. */
export class Bag {
  constructor() { this.list = []; }
  add(g) { this.list.push(g); return g; }
  mesh(material) {
    const merged = mergeGeometries(this.list, false);
    this.list.forEach((g) => g.dispose());
    return new THREE.Mesh(merged, material);
  }
}

/**
 * A thick paint stroke: a ribbon along `pts` made of colour lanes that run with the stroke,
 * with optional drips hanging from both edges.
 * Triangles are emitted segment by segment so drawRange can "paint" it progressively.
 */
export function strokeGeo(pts, opts = {}) {
  const {
    width = 5, widthFn = null, lanes = 6, palette = PAL.path, dripPalette = PAL.drip,
    drips = 0, bump = 0.07, run = 5, jitter = 0.06,
  } = opts;
  const UP = new THREE.Vector3(0, 1, 0);
  const n = pts.length;
  const cols = colorsOf(palette), dcols = colorsOf(dripPalette);
  const grid = [];
  const side = new THREE.Vector3(), tan = new THREE.Vector3();
  const dripL = [], dripR = [], nrms = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    tan.subVectors(b, a).normalize();
    const normal = typeof opts.normal === 'function' ? opts.normal(i, n) : (opts.normal || UP);
    nrms.push(normal);
    side.crossVectors(normal, tan).normalize();
    const w = widthFn ? widthFn(i / (n - 1)) : width;
    const row = [];
    for (let l = 0; l <= lanes; l++) {
      const u = l / lanes - 0.5;
      const edge = l === 0 || l === lanes;
      const p = pts[i].clone().addScaledVector(side, u * w * (edge ? 1 + (rand() - 0.5) * 0.12 : 1));
      if (!edge) p.addScaledVector(normal, (rand() - 0.5) * 2 * bump);
      row.push(p);
    }
    grid.push(row);
    const spike = () => (rand() < 0.22 ? rr(1.2, 3.2) : rr(0.25, 0.9)) * drips;
    dripL.push(spike()); dripR.push(spike());
  }
  const laneSeed = [];
  for (let l = 0; l < lanes; l++) laneSeed.push(Math.floor(rand() * 97));
  const position = [], color = [];
  const push = (p, c, j) => { position.push(p.x, p.y, p.z); color.push(c.r * j, c.g * j, c.b * j); };
  const quad = (a, b, c, d, col) => {
    const j = 1 + (rand() - 0.5) * 2 * jitter;
    push(a, col, j); push(b, col, j); push(c, col, j);
    const j2 = 1 + (rand() - 0.5) * 2 * jitter;
    push(a, col, j2); push(c, col, j2); push(d, col, j2);
  };
  for (let i = 0; i < n - 1; i++) {
    const down = (p, d) => p.clone().addScaledVector(nrms[i], -d);
    for (let l = 0; l < lanes; l++) {
      const k = (laneSeed[l] + Math.floor((i + laneSeed[l] * 3) / run + noise3(i * 0.31, l * 1.7, 3.3) * 1.6)) % cols.length;
      quad(grid[i][l], grid[i][l + 1], grid[i + 1][l + 1], grid[i + 1][l], cols[k]);
    }
    if (drips > 0) {
      const dc = dcols[(i * 7 + 3) % dcols.length], dc2 = dcols[(i * 5 + 1) % dcols.length];
      quad(grid[i][0], grid[i + 1][0], down(grid[i + 1][0], dripL[i + 1]), down(grid[i][0], dripL[i]), dc);
      quad(grid[i + 1][lanes], grid[i][lanes], down(grid[i][lanes], dripR[i]), down(grid[i + 1][lanes], dripR[i + 1]), dc2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  g.computeVertexNormals();
  g.userData.vertsPerSeg = (lanes * 2 + (drips > 0 ? 4 : 0)) * 3;
  g.userData.segs = n - 1;
  return g;
}

/** Soft radial glow texture for additive sprites. */
export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,220,150,0.45)', outer = 'rgba(255,200,120,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(0.35, mid); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function glowSprite(tex, size, color = 0xffffff, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, opacity, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  s.scale.setScalar(size);
  return s;
}

// ---------- brush strokes ----------
/** Draw one thick, slightly curved brush stroke with bristle streaks on a 2D canvas. */
export function drawStroke(ctx, x, y, ang, len, w, fill, streakA, streakB, rnd = Math.random) {
  const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
  const bend = (rnd() - 0.5) * len * 0.35;
  const cx = x + dx * 0.5 - Math.sin(ang) * bend, cy = y + dy * 0.5 + Math.cos(ang) * bend;
  ctx.lineCap = 'round';
  ctx.strokeStyle = fill; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(cx, cy, x + dx, y + dy); ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const o = (rnd() - 0.5) * w * 0.7, ox = -Math.sin(ang) * o, oy = Math.cos(ang) * o;
    ctx.strokeStyle = k % 2 ? streakA : streakB; ctx.lineWidth = Math.max(1, w * (0.1 + rnd() * 0.14));
    ctx.beginPath(); ctx.moveTo(x + ox + dx * 0.08, y + oy + dy * 0.08);
    ctx.quadraticCurveTo(cx + ox, cy + oy, x + dx * 0.92 + ox, y + dy * 0.92 + oy); ctx.stroke();
  }
}

let _strokeData = null;
/**
 * Tileable "stroke id" texture: thousands of overlapping brush strokes, each carrying random values
 * (R = value shift, G = temperature shift, B = bristle streaks). Surfaces sample it tri-planar.
 */
export function strokeDataTexture() {
  if (_strokeData) return _strokeData;
  const S = 1024;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, S, S);
  const rnd = mulberry32(4242);
  for (let i = 0; i < 3000; i++) {
    const px = rnd() * S, py = rnd() * S, ang = (rnd() - 0.5) * 0.9 + (rnd() < 0.12 ? 1.2 : 0);
    const len = 46 + rnd() * 90, w = 11 + rnd() * 20;
    const r = Math.floor(rnd() * 256), g = Math.floor(rnd() * 256);
    const seedState = Math.floor(rnd() * 1e9);
    for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) {
      if (px + ox < -160 || px + ox > S + 160 || py + oy < -160 || py + oy > S + 160) continue;
      drawStroke(x, px + ox, py + oy, ang, len, w, `rgb(${r},${g},128)`, `rgb(${r},${g},215)`, `rgb(${r},${g},45)`, mulberry32(seedState));
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  _strokeData = t;
  return t;
}

const PAINT_GLSL = /* glsl */ `
varying vec3 vWPos;
uniform sampler2D tStrokes;
vec3 paintStroke(vec3 base, vec3 wp) {
  vec3 fn = abs(normalize(cross(dFdx(wp), dFdy(wp))));
  vec2 uv = (fn.y > 0.6) ? wp.xz * mat2(0.8, -0.6, 0.6, 0.8) : ((fn.x > fn.z) ? wp.yz : wp.yx);
  vec3 s = texture2D(tStrokes, uv / (24.0 * STROKE_SCALE)).rgb;
  float h = s.r, h2 = s.g;
  vec3 c = base * (0.74 + 0.52 * h);
  c += (h2 - 0.5) * vec3(0.22, 0.03, -0.20) * (0.3 + base);
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  c = mix(vec3(l), c, 0.8 + 0.55 * h2);
  c = mix(c, vec3(1.0, 0.92, 0.80), smoothstep(0.86, 0.93, h) * 0.5);
  c *= mix(vec3(0.60, 0.48, 0.82), vec3(1.0), smoothstep(0.06, 0.12, h));
  c *= 0.9 + 0.2 * s.b;
  return mix(base, max(c, 0.0), STROKE_AMP);
}
`;
/** Give a built-in material the brush-stroke treatment. */
export function paintify(mat, { scale = 1, amp = 1 } = {}) {
  const f = (v) => Number(v).toFixed(3);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tStrokes = { value: strokeDataTexture() };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWPos = (modelMatrix * wp4).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n#define STROKE_SCALE ${f(scale)}\n#define STROKE_AMP ${f(amp)}\n` + PAINT_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = paintStroke(diffuseColor.rgb, vWPos);');
  };
  mat.customProgramCacheKey = () => `paint_${f(scale)}_${f(amp)}`;
  return mat;
}

