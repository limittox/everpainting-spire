import * as THREE from 'three';
import { drawStroke, mulberry32 } from './util.js';

// The brush really paints. Each swing lays a fan of strokes into the ground's own canvas texture (so they
// stay, and sit in the painting like every other stroke), and soaks colour into whatever stands within
// reach: trunks, canopies, rocks, banners poles, the Spire's walls.

export const PAINTS = [
  { name: 'Rose', hex: '#ff5a7a' }, { name: 'Gold', hex: '#ffc040' }, { name: 'Turquoise', hex: '#40e0d8' }, { name: 'Violet', hex: '#b060e0' },
  { name: 'Cream', hex: '#fff4dc' }, { name: 'Ember', hex: '#ff8a3a' }, { name: 'Sky', hex: '#5a8af0' }, { name: 'Leaf', hex: '#6fd08a' },
  // found in the hidden places (see secrets.js). `glow` paints shine: what they soak into is brighter than white
  { name: 'Midnight', hex: '#2c2470', hidden: true }, { name: 'Moonlight', hex: '#dfe6ff', hidden: true, glow: 1.7 }, { name: 'Sunfire', hex: '#ffb020', hidden: true, glow: 1.9 },
];

const CELL = 4;
const MAX_LOG = 2500;                 // swings remembered for the saved journey; beyond this the oldest are let go
const r2 = (v) => Math.round(v * 100) / 100;
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Bucket a merged mesh's vertices into a grid over x/z, so a swing only looks at what is near it. */
function indexMesh(mesh) {
  const pos = mesh.geometry.attributes.position.array, n = pos.length / 3;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) { const x = pos[i * 3], z = pos[i * 3 + 2]; if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z; }
  const nx = Math.floor((maxX - minX) / CELL) + 1, nz = Math.floor((maxZ - minZ) / CELL) + 1;
  const start = new Uint32Array(nx * nz + 1), cellOf = new Uint32Array(n);
  for (let i = 0; i < n; i++) { const c = Math.floor((pos[i * 3] - minX) / CELL) + Math.floor((pos[i * 3 + 2] - minZ) / CELL) * nx; cellOf[i] = c; start[c + 1]++; }
  for (let c = 0; c < nx * nz; c++) start[c + 1] += start[c];
  const cursor = start.slice(0, nx * nz), order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[cursor[cellOf[i]]++] = i;
  return { pos, color: mesh.geometry.attributes.color, minX, minZ, nx, nz, start, order };
}

export class Painter {
  constructor(renderer, world) {
    this.renderer = renderer; this.world = world;
    this.grids = world.paintable.map(indexMesh);
    this.queue = [];
    this.patch = document.createElement('canvas'); this.patch.width = this.patch.height = 8;
    this.pctx = this.patch.getContext('2d');
    this.patchTex = new THREE.CanvasTexture(this.patch);
    this.at = new THREE.Vector2();
    this._c = new THREE.Color(); this._c2 = new THREE.Color();
    this.strokes = 0;
    this.log = [];                    // every swing so far: [x, y, z, heading, paint index, seed]
  }

  /**
   * One swing of the brush at `pos`, facing `heading`. The strokes are queued along the arc and laid over the
   * next quarter of a second, so the paint follows the brush round.
   */
  strike(pos, heading, hex, seed = (Math.random() * 4294967296) >>> 0, log = true, wide = false) {
    // every random choice comes from the seed, so the same swing can be laid again exactly when a journey is restored
    const rnd = mulberry32(seed), u32 = () => (rnd() * 4294967296) >>> 0;
    // (the swing is laid from the same rounded numbers that are written down, so a restored one lands on the same spot)
    pos = { x: r2(pos.x), y: r2(pos.y), z: r2(pos.z) }; heading = r2(heading);
    if (log) {
      this.log.push([pos.x, pos.y, pos.z, heading, Math.max(0, PAINTS.findIndex((p) => p.hex === hex)), seed, wide ? 1 : 0]);
      if (this.log.length > MAX_LOG) this.log.splice(0, this.log.length - MAX_LOG);
    }
    const q = this.queue, n = wide ? 24 : 16, far = wide ? 1.5 : 1, fat = wide ? 1.3 : 1;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), a = heading + (0.5 - u) * 2.6 + (rnd() - 0.5) * 0.25, r = (1.4 + rnd() * 3.0) * far;
      q.push({
        t: u * 0.24, hex, y: pos.y, x: pos.x + Math.sin(a) * r, z: pos.z + Math.cos(a) * r,
        ang: Math.atan2(Math.sin(a), -Math.cos(a)) + (rnd() - 0.5) * 0.5,         // along the sweep
        len: (1.5 + rnd() * 1.7) * fat, w: (0.5 + rnd() * 0.6) * fat, shade: (rnd() - 0.5) * 0.14, seed: u32(),
      });
    }
    for (let i = 0; i < (wide ? 11 : 7); i++) {          // spatter thrown off the end of the stroke
      const a = heading + (rnd() - 0.5) * 3.0, r = (3.6 + rnd() * 3.2) * far;
      q.push({ t: 0.12 + rnd() * 0.16, hex, y: pos.y, x: pos.x + Math.sin(a) * r, z: pos.z + Math.cos(a) * r, dot: 0.12 + rnd() * 0.26, shade: (rnd() - 0.5) * 0.14, squash: 0.6 + rnd() * 0.4, turn: rnd() * 3 });
    }
    const paint = PAINTS.find((p) => p.hex === hex);
    q.push({ t: 0.1, hex, objects: true, x: pos.x + Math.sin(heading) * 1.7 * far, y: pos.y, z: pos.z + Math.cos(heading) * 1.7 * far, r: 4.7 * far, glow: (paint && paint.glow) || 1 });
  }

  /** Lay a saved journey's swings again, all at once (before the first frame is drawn). */
  replay(log) {
    if (!Array.isArray(log)) return;
    const dirty = new Map(), pos = { x: 0, y: 0, z: 0 };
    for (const e of log) {
      if (!Array.isArray(e) || e.length < 6 || !e.every(Number.isFinite)) continue;
      pos.x = e[0]; pos.y = e[1]; pos.z = e[2];
      this.strike(pos, e[3], (PAINTS[e[4]] || PAINTS[0]).hex, e[5] >>> 0, false, !!e[6]);
      this.queue.sort((a, b) => a.t - b.t);                 // the order the brush laid them in
      for (const s of this.queue) { if (s.objects) this.soak(s.x, s.y, s.z, s.r, s.hex, s.glow); else this.ground(s, dirty); }
      this.queue.length = 0;
      this.log.push(e);
    }
    if (this.log.length > MAX_LOG) this.log.splice(0, this.log.length - MAX_LOG);
    for (const isl of dirty.keys()) isl.tex.needsUpdate = true;
  }

  update(dt) {
    const q = this.queue;
    if (!q.length) return;
    const dirty = new Map();
    for (let k = q.length - 1; k >= 0; k--) {
      const s = q[k];
      s.t -= dt;
      if (s.t > 0) continue;
      q.splice(k, 1);
      if (s.objects) this.soak(s.x, s.y, s.z, s.r, s.hex, s.glow);
      else this.ground(s, dirty);
    }
    for (const [isl, d] of dirty) this.upload(isl, d);
  }

  // ------------------------------------------------------------------ the ground: strokes on the island's canvas
  ground(s, dirty) {
    const w = this.world, isl = w.islandAt(s.x, s.z);
    if (!isl || !isl.tex) return;
    const gh = w.groundHeight(s.x, s.z, s.y + 1.5);
    if (!(gh > -Infinity) || s.y - gh > 2.6) return;                       // too far above the ground to reach it
    const cv = isl.tex.image, size = cv.width, px = size / isl.span, ctx = isl.ctx || (isl.ctx = cv.getContext('2d'));
    const u = ((s.x - isl.x) / isl.span + 0.5) * size, v = ((s.z - isl.z) / isl.span + 0.5) * size;
    const c = this._c.set(s.hex).offsetHSL(0, 0, s.shade), fill = '#' + c.getHexString();
    let reach;
    if (s.dot) {
      reach = s.dot * px + 2;
      ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(u, v, s.dot * px, s.dot * px * s.squash, s.turn, 0, 6.3); ctx.fill();
    } else {
      const len = s.len * px, hi = '#' + this._c2.copy(c).offsetHSL(0, 0, 0.09).getHexString(), lo = '#' + this._c2.copy(c).offsetHSL(0, 0, -0.09).getHexString();
      drawStroke(ctx, u - Math.cos(s.ang) * len * 0.5, v - Math.sin(s.ang) * len * 0.5, s.ang, len, s.w * px, fill, hi, lo, mulberry32(s.seed));
      reach = len * 0.75 + s.w * px;
    }
    let d = dirty.get(isl);
    if (!d) dirty.set(isl, (d = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }));
    d.x0 = Math.min(d.x0, u - reach); d.y0 = Math.min(d.y0, v - reach); d.x1 = Math.max(d.x1, u + reach); d.y1 = Math.max(d.y1, v + reach);
    this.strokes++;
  }

  /** Send just the repainted rectangle to the GPU, rather than the whole island texture. */
  upload(isl, d) {
    const tex = isl.tex, cv = tex.image, size = cv.width;
    const x0 = Math.max(0, Math.floor(d.x0) - 2), y0 = Math.max(0, Math.floor(d.y0) - 2);
    const x1 = Math.min(size, Math.ceil(d.x1) + 2), y1 = Math.min(size, Math.ceil(d.y1) + 2);
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    try {
      if (this.patch.width !== w || this.patch.height !== h) { this.patch.width = w; this.patch.height = h; }
      this.pctx.drawImage(cv, x0, y0, w, h, 0, 0, w, h);
      this.renderer.copyTextureToTexture(this.patchTex, tex, null, this.at.set(x0, size - y0 - h));     // texture rows run bottom-up
    } catch (e) {
      tex.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ everything standing nearby: colour soaks into the vertices
  soak(cx, cy, cz, R, hex, glow = 1) {
    const col = this._c.set(hex).multiplyScalar(glow), R2 = R * R;
    for (const g of this.grids) {
      const c0x = Math.max(0, Math.floor((cx - R - g.minX) / CELL)), c1x = Math.min(g.nx - 1, Math.floor((cx + R - g.minX) / CELL));
      const c0z = Math.max(0, Math.floor((cz - R - g.minZ) / CELL)), c1z = Math.min(g.nz - 1, Math.floor((cz + R - g.minZ) / CELL));
      const pos = g.pos, arr = g.color.array;
      let lo = Infinity, hi = -1;
      for (let iz = c0z; iz <= c1z; iz++) for (let ix = c0x; ix <= c1x; ix++) {
        const cell = ix + iz * g.nx;
        for (let k = g.start[cell], end = g.start[cell + 1]; k < end; k++) {
          const i = g.order[k], x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
          const d2 = (x - cx) ** 2 + (z - cz) ** 2, dy = y - cy;
          if (d2 > R2 || dy < -1.5 || dy > 9.5) continue;
          // the paint goes on in daubs: each little block of space takes it, half takes it, or is missed
          const hx = Math.floor(x * 1.2), hy = Math.floor(y * 1.2), hz = Math.floor(z * 1.2), h = hash(hx, hy, hz);
          let w = (1 - smooth(0.5, 1, Math.sqrt(d2) / R)) * (1 - smooth(5.5, 9.5, dy));
          w *= h < 0.16 ? 0 : 0.5 + 0.5 * h;
          if (w < 0.01) continue;
          const tone = 0.8 + 0.4 * hash(hz, hx, hy);
          w *= 0.92;
          arr[i * 3] += (col.r * tone - arr[i * 3]) * w; arr[i * 3 + 1] += (col.g * tone - arr[i * 3 + 1]) * w; arr[i * 3 + 2] += (col.b * tone - arr[i * 3 + 2]) * w;
          if (i < lo) lo = i; if (i > hi) hi = i;
        }
      }
      if (hi >= 0) { g.color.addUpdateRange(lo * 3, (hi - lo + 1) * 3); g.color.needsUpdate = true; }
    }
  }
}
