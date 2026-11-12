import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './util.js';

// The world wakes where the painter walks:
//  - small flowers and tufts sprout in their wake and stay,
//  - colourless buds sleeping beside the path open into big flowers when the painter comes close,
//  - each tree breaks into pale blossom the first time the painter passes under it.

const TAU = Math.PI * 2;
const PETALS = ['#ff7aa8', '#ffd06a', '#fff4e0', '#62e6dc', '#c58af5', '#ff9a5a', '#ffb6d6', '#8ab4ff'];
const BLADES = ['#38c8c8', '#8a5ad8', '#ffd76a', '#ff8ac0', '#5ad8b0', '#fff0c8'];
const BLOSSOM = ['#fff0f6', '#ffc6de', '#fff4c8', '#ffffff', '#ffb0d0'];
const CELL = 1.15;                    // one sprout per cell of this size, so walked ground fills in but never crowds

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const r2 = (v) => Math.round(v * 100) / 100;
const toInt = (hex) => parseInt(String(hex).slice(1), 16) || 0;
const toHex = (n) => '#' + ((n >>> 0) & 0xffffff).toString(16).padStart(6, '0');
const cellKey = (x, z) => Math.round(x / CELL) * 8192 + Math.round(z / CELL);

/** Flat vertex colour (optionally brightening with height), ready to merge. */
function paint(geo, r, g, b, grad = 0) {
  const out = geo.index ? geo.toNonIndexed() : geo;
  if (out.attributes.uv) out.deleteAttribute('uv');
  const p = out.attributes.position, n = p.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = 1 + grad * p.getY(i); c[i * 3] = r * k; c[i * 3 + 1] = g * k; c[i * 3 + 2] = b * k; }
  out.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return out;
}
const STEM = [0.2, 0.42, 0.38];

// White petals take the instance colour; the stem comes out as a dark shade of the same hue.
function flowerGeo() {
  const parts = [paint(new THREE.CylinderGeometry(0.022, 0.04, 0.5, 4).translate(0, 0.25, 0), ...STEM)];
  parts.push(paint(new THREE.SphereGeometry(0.15, 5, 4).scale(1, 0.2, 0.5).rotateZ(0.5).translate(0.13, 0.16, 0), ...STEM));
  for (let i = 0; i < 5; i++) parts.push(paint(new THREE.SphereGeometry(0.2, 5, 4).scale(1, 0.32, 0.66).rotateZ(0.42).translate(0.2, 0.54, 0).rotateY((i / 5) * TAU), 1.12, 1.12, 1.12));
  parts.push(paint(new THREE.SphereGeometry(0.1, 5, 4).translate(0, 0.58, 0), 1.7, 1.4, 0.55));
  return mergeGeometries(parts);
}
function tuftGeo() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const h = 0.42 + i * 0.07;
    parts.push(paint(new THREE.ConeGeometry(0.055, h, 4).translate(0, h / 2, 0).rotateZ(0.12 + i * 0.1).rotateY(i * 2.1), 0.6, 0.6, 0.6, 1.2));
  }
  return mergeGeometries(parts);
}
function budGeo() {
  const parts = [
    paint(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 5).translate(0, 0.25, 0), 0.26, 0.25, 0.33),
    paint(new THREE.SphereGeometry(0.24, 7, 6).scale(1, 1.35, 1).translate(0, 0.72, 0), 0.33, 0.31, 0.41, 0.3),
    paint(new THREE.ConeGeometry(0.15, 0.34, 6).translate(0, 1.1, 0), 0.42, 0.4, 0.52),
  ];
  for (const s of [-1, 1]) parts.push(paint(new THREE.SphereGeometry(0.2, 5, 4).scale(1, 0.18, 0.5).rotateZ(0.5 * s).translate(0.2 * s, 0.2, 0), 0.26, 0.25, 0.33));
  return mergeGeometries(parts);
}
function bigGeo() {
  const parts = [paint(new THREE.CylinderGeometry(0.05, 0.09, 1.0, 5).translate(0, 0.5, 0), ...STEM)];
  for (const s of [-1, 1]) parts.push(paint(new THREE.SphereGeometry(0.3, 5, 4).scale(1, 0.16, 0.5).rotateZ(0.5 * s).translate(0.28 * s, 0.3, 0), ...STEM));
  for (let i = 0; i < 7; i++) parts.push(paint(new THREE.SphereGeometry(0.36, 6, 5).scale(1, 0.26, 0.56).rotateZ(0.42).translate(0.4, 1.08, 0).rotateY((i / 7) * TAU), 1, 1, 1));
  for (let i = 0; i < 5; i++) parts.push(paint(new THREE.SphereGeometry(0.24, 6, 5).scale(1, 0.3, 0.6).rotateZ(0.95).translate(0.2, 1.2, 0).rotateY((i / 5) * TAU + 0.4), 1.35, 1.3, 1.25));
  parts.push(paint(new THREE.SphereGeometry(0.16, 6, 5).translate(0, 1.14, 0), 1.8, 1.45, 0.5));
  return mergeGeometries(parts);
}

/** Everything that grows leans a little in the breeze: the taller the point, the further it moves. */
function sway(mat, uTime, amt) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float swPh = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.9;
        float swK = position.y * position.y * ${amt.toFixed(3)};
        transformed.x += sin(uTime * 1.6 + swPh) * swK;
        transformed.z += cos(uTime * 1.3 + swPh * 1.3) * swK * 0.7;
      #endif`);
  };
  return mat;
}

/** A fixed-size ring of instances; when it is full the oldest one is replaced. */
class Pool {
  constructor(scene, geo, mat, max, tinted = true) {
    this.max = max; this.next = 0; this.items = new Array(max).fill(null);
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) { this.mesh.setMatrixAt(i, _m); if (tinted) this.mesh.setColorAt(i, _c.set(0xffffff)); }
    this.moved = false; this.tinted = false;
    scene.add(this.mesh);
  }
  alloc(item) {
    const i = this.next; this.next = (this.next + 1) % this.max;
    const old = this.items[i];
    this.items[i] = item; item.i = i; item.pool = this;
    return old;
  }
  tint(item, hex) { this.mesh.setColorAt(item.i, _c.set(hex)); this.tinted = true; }
  place(item, k, ky = k) {
    _q.setFromEuler(_e.set(item.tx || 0, item.rot, item.tz || 0));
    this.mesh.setMatrixAt(item.i, _m.compose(_p.set(item.x, item.y, item.z), _q, _s.set(item.s * k, item.s * (item.sy || 1) * ky, item.s * k)));
    this.moved = true;
  }
  flush() {
    if (this.moved) { this.mesh.instanceMatrix.needsUpdate = true; this.moved = false; }
    if (this.tinted) { this.mesh.instanceColor.needsUpdate = true; this.tinted = false; }
  }
}

// springs up past full size, then settles
const pop = (u) => 1 - (1 - u) ** 3 + Math.sin(u * Math.PI) * 0.24;

export class Garden {
  constructor(scene, world, uTime, avoid = []) {
    this.world = world;
    const r = (this.rnd = mulberry32(90210));
    const mat = (amt) => sway(new THREE.MeshLambertMaterial({ vertexColors: true }), uTime, amt);

    // --- sprouts in the painter's wake
    this.sprouts = [new Pool(scene, flowerGeo(), mat(0.5), 1100), new Pool(scene, tuftGeo(), mat(0.7), 700)];
    this.cells = new Map();
    this.growing = [];
    this.acc = 0;

    // --- sleeping buds beside the path
    const spots = [];
    const taken = avoid.map((p) => ({ x: p.x, z: p.z, r: 3.6 }));
    for (const isl of world.islands) {
      if (isl.pale) continue;                       // (islands of later levels: nothing sleeps there yet)
      const want = Math.round(isl.r * 0.6);
      let placed = 0, tries = 0;
      while (placed < want && tries++ < 900) {
        const a = r() * TAU, d = Math.sqrt(r()) * isl.r * 0.86;
        const x = isl.x + Math.cos(a) * d, z = isl.z + Math.sin(a) * d;
        if (world.islandAt(x + Math.cos(a) * 1.5, z + Math.sin(a) * 1.5) !== isl) continue;
        if (!world.nearPath(x, z, 9.5) || world.nearPath(x, z, 2.9)) continue;
        if (world.colliders.some((c) => !c.late && (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + 1.3) ** 2)) continue;
        if (taken.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < c.r * c.r)) continue;
        const y = world.groundHeight(x, z, 1e9);
        if (!(y > -Infinity)) continue;
        spots.push({ x, y: y - 0.04, z });
        taken.push({ x, z, r: 4.4 });
        placed++;
      }
    }
    this.budPool = new Pool(scene, budGeo(), mat(0.06), spots.length, false);
    this.bigPool = new Pool(scene, bigGeo(), mat(0.11), spots.length);
    this.buds = spots.map((sp, k) => {
      const rot = r() * TAU, s = 0.85 + r() * 0.5, tx = (r() - 0.5) * 0.24, tz = (r() - 0.5) * 0.24;
      const bud = { ...sp, rot, s, tx, tz }, flower = { ...sp, rot, s, tx, tz };
      this.budPool.alloc(bud); this.bigPool.alloc(flower);
      const color = PETALS[k % PETALS.length];
      this.bigPool.tint(flower, color);
      this.budPool.place(bud, 1);
      return { ...sp, bud, flower, color, c: color, awake: false, t: 0, quiet: false, ph: r() * TAU };
    });
    this.waking = [];
    this.woken = 0;

    // --- blossom for the trees
    this.trees = world.trees.map((tr) => ({ tr, done: false }));
    this.puffs = new Pool(scene, paint(new THREE.IcosahedronGeometry(1, 1), 1, 1, 1, 0.12), new THREE.MeshLambertMaterial({ vertexColors: true }), Math.max(1, this.trees.length * 20));
    this.popping = [];

    this.events = [];
    this.flush();
  }

  flush() { this.sprouts.forEach((p) => p.flush()); this.budPool.flush(); this.bigPool.flush(); this.puffs.flush(); }

  /** Try to grow one sprout at (x, z). Fails quietly on occupied cells, bridges, trunks and edges. */
  spawn(x, z, yRef, scale = 1, delay = 0) {
    const key = cellKey(x, z);
    if (this.cells.has(key)) return false;
    const w = this.world;
    if (!w.islandAt(x, z)) return false;
    const y = w.groundHeight(x, z, yRef + 1.5);
    if (!(y > -Infinity) || Math.abs(y - yRef) > 1.6) return false;
    for (const c of w.colliders) if ((c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + 0.25) ** 2) return false;
    const r = this.rnd, kind = r() < 0.62 ? 0 : 1, pool = this.sprouts[kind], pal = kind ? BLADES : PETALS;
    const item = { x, y: y - 0.03, z, rot: r() * TAU, tx: (r() - 0.5) * 0.3, tz: (r() - 0.5) * 0.3, s: (0.85 + r() * 0.75) * scale * (kind ? 1.05 : 1.25), t: -delay - r() * 0.25, key, kind };
    const old = pool.alloc(item);
    if (old) this.cells.delete(old.key);
    this.cells.set(key, item);
    item.c = pal[Math.floor(r() * pal.length)];
    pool.tint(item, item.c);
    pool.place(item, 0);
    this.growing.push(item);
    return true;
  }

  /** Sprouts appear to either side of wherever the painter walks or skates. Returns how many are new. */
  trail(player, dt) {
    if (!player.grounded || player.lift) return 0;
    this.acc += Math.hypot(player.vel.x, player.vel.z) * dt;
    let n = 0;
    while (this.acc > 0.75) {
      this.acc -= 0.75;
      for (let k = 0; k < 2; k++) {
        const a = this.rnd() * TAU, d = 0.8 + this.rnd() * 2.2;
        if (this.spawn(player.pos.x + Math.cos(a) * d, player.pos.z + Math.sin(a) * d, player.pos.y)) n++;
      }
    }
    return n;
  }

  wake(b, delay = 0, quiet = false) {
    if (b.awake) return;
    b.awake = true; b.t = -delay; b.quiet = quiet;
    this.waking.push(b); this.woken++;
  }
  /** A brush swing wakes the buds around it. */
  wakeNear(pos, radius) {
    for (const b of this.buds) if (!b.awake && (b.x - pos.x) ** 2 + (b.z - pos.z) ** 2 < radius * radius && Math.abs(b.y - pos.y) < 4) this.wake(b);
  }
  /** A swing of the brush recolours the flowers it passes over. */
  tintNear(x, z, radius, hex) {
    const rr2 = radius * radius;
    for (const it of this.cells.values()) if ((it.x - x) ** 2 + (it.z - z) ** 2 < rr2) { it.pool.tint(it, hex); it.c = hex; }
    for (const b of this.buds) if (b.awake && (b.x - x) ** 2 + (b.z - z) ** 2 < rr2) { this.bigPool.tint(b.flower, hex); b.c = hex; }
  }
  bloomTree(T, delay = 0) {
    T.done = true;
    const r = this.rnd, tr = T.tr;
    for (let k = 0; k < 20; k++) {
      const pf = tr.puffs[Math.floor(r() * tr.puffs.length)];
      const a = r() * TAU, phi = 0.35 + r() * 1.6, sp = Math.sin(phi);          // mostly the flanks, which is what is seen from the ground
      const item = {
        x: pf.x + Math.cos(a) * sp * pf.R * 0.97, y: pf.y + Math.cos(phi) * pf.R * pf.sy * 0.97, z: pf.z + Math.sin(a) * sp * pf.R * 0.97,
        rot: r() * TAU, tx: r() - 0.5, tz: r() - 0.5, s: (0.3 + r() * 0.3) * tr.s, sy: 0.6, t: -(delay + k * 0.05 + r() * 0.2) / 0.6,
      };
      this.puffs.alloc(item);
      this.puffs.tint(item, BLOSSOM[Math.floor(r() * BLOSSOM.length)]);
      this.puffs.place(item, 0);
      this.popping.push(item);
    }
  }
  /** The finale: everything still asleep wakes in a wave spreading out from `from`. */
  wakeAll(from, speed = 42) {
    for (const b of this.buds) if (!b.awake) this.wake(b, Math.hypot(b.x - from.x, b.z - from.z) / speed + this.rnd() * 0.5, true);
    for (const T of this.trees) if (!T.done) this.bloomTree(T, Math.hypot(T.tr.x - from.x, T.tr.z - from.z) / speed);
  }

  /** The nearest open flower to a point (the big ones first, then anything in the painter's wake), within `reach`. */
  flowerNear(p, reach = 9) {
    let best = null, bd = reach * reach;
    for (const b of this.buds) {
      if (!b.awake || b.t < 1) continue;
      const d = (b.x - p.x) ** 2 + (b.z - p.z) ** 2;
      if (d < bd && Math.abs(b.y - p.y) < 4) { bd = d; best = { x: b.x, y: b.y + 0.35 * b.flower.s, z: b.z }; }
    }
    if (best) return best;
    for (const it of this.cells.values()) {
      if (it.kind !== 0 || it.t < 1) continue;
      const d = (it.x - p.x) ** 2 + (it.z - p.z) ** 2;
      if (d < bd && Math.abs(it.y - p.y) < 4) { bd = d; best = { x: it.x, y: it.y - 0.35, z: it.z }; }
    }
    return best;
  }

  /** Everything that has grown or woken, small enough to keep with a saved journey. */
  save() {
    const sprouts = [];
    this.sprouts.forEach((pool, kind) => {
      for (let n = 0; n < pool.max; n++) {                 // oldest first, so the ring refills in the same order
        const it = pool.items[(pool.next + n) % pool.max];
        if (it) sprouts.push([kind, r2(it.x), r2(it.y), r2(it.z), r2(it.rot), r2(it.s), toInt(it.c)]);
      }
    });
    const buds = [], trees = [];
    this.buds.forEach((b, i) => { if (b.awake) buds.push([i, toInt(b.c)]); });
    this.trees.forEach((T, i) => { if (T.done) trees.push(i); });
    return { sprouts, buds, trees };
  }
  /** Put a saved garden back, fully grown, with no fanfare. */
  load(d) {
    if (!d) return;
    const r = this.rnd;
    for (const e of d.sprouts || []) {
      if (!Array.isArray(e) || e.length < 7 || !e.every(Number.isFinite)) continue;
      const [kind, x, y, z, rot, s, c] = e, pool = this.sprouts[kind], key = cellKey(x, z);
      if (!pool || this.cells.has(key)) continue;
      const item = { x, y, z, rot, tx: (r() - 0.5) * 0.3, tz: (r() - 0.5) * 0.3, s, t: 1, key, kind, c: toHex(c) };
      const old = pool.alloc(item);
      if (old) this.cells.delete(old.key);
      this.cells.set(key, item);
      pool.tint(item, item.c);
      pool.place(item, 1);
    }
    for (const e of d.buds || []) {
      const b = Array.isArray(e) ? this.buds[e[0]] : null;
      if (!b || b.awake) continue;
      b.awake = true; b.t = 1; b.c = toHex(e[1]); this.woken++;
      this.budPool.place(b.bud, 0);
      this.bigPool.tint(b.flower, b.c);
      this.bigPool.place(b.flower, 1);
    }
    for (const i of d.trees || []) { const T = this.trees[i]; if (T && !T.done) this.bloomTree(T); }
    for (const it of this.popping) this.puffs.place(it, 1);
    this.popping.length = 0;
    this.flush();
  }

  /** Advance every animation; with a `player`, also wake what they have come close to. Returns this frame's events. */
  update(dt, t, player) {
    const ev = this.events; ev.length = 0;

    // sprouts springing up
    for (let k = this.growing.length - 1; k >= 0; k--) {
      const it = this.growing[k];
      if (it.pool.items[it.i] !== it) { this.growing.splice(k, 1); continue; }     // its slot was recycled
      it.t += dt / 0.7;
      if (it.t < 0) continue;
      const u = Math.min(1, it.t);
      it.pool.place(it, pop(u), pop(u) * (1 + Math.sin(u * Math.PI) * 0.25));
      if (u >= 1) this.growing.splice(k, 1);
    }

    // buds: wake on approach, then swell, split and open
    if (player) {
      const p = player.pos;
      for (const b of this.buds) if (!b.awake && (b.x - p.x) ** 2 + (b.z - p.z) ** 2 < 10.5 && Math.abs(b.y - p.y) < 3) this.wake(b);
      for (const T of this.trees) {
        const tr = T.tr, reach = 6.5 + 2.5 * tr.s;
        if (!T.done && (tr.x - p.x) ** 2 + (tr.z - p.z) ** 2 < reach * reach && Math.abs(tr.y - p.y) < 10) {
          this.bloomTree(T);
          ev.push({ type: 'tree', x: tr.top.x, y: tr.top.y, z: tr.top.z, s: tr.s });
        }
      }
    }
    for (let k = this.waking.length - 1; k >= 0; k--) {
      const b = this.waking[k], before = b.t;
      b.t += dt / 0.9;
      if (b.t < 0) continue;
      if (before < 0 || before === 0) {
        if (!b.quiet) ev.push({ type: 'bud', x: b.x, y: b.y, z: b.z, color: b.color });
        for (let i = 0; i < 9; i++) { const a = this.rnd() * TAU, d = 0.9 + this.rnd() * 1.9; this.spawn(b.x + Math.cos(a) * d, b.z + Math.sin(a) * d, b.y, 1, 0.15 + i * 0.05); }
      }
      const u = Math.min(1, b.t), shut = Math.min(1, u * 2.6);
      this.budPool.place(b.bud, (1 - shut) * (1 + Math.sin(shut * Math.PI) * 0.45));
      this.bigPool.place(b.flower, pop(u), pop(u) * (1 + Math.sin(u * Math.PI) * 0.2));
      if (u >= 1) this.waking.splice(k, 1);
    }

    // blossom popping out on the trees
    for (let k = this.popping.length - 1; k >= 0; k--) {
      const it = this.popping[k];
      it.t += dt / 0.6;
      if (it.t < 0) continue;
      const u = Math.min(1, it.t);
      this.puffs.place(it, pop(u));
      if (u >= 1) this.popping.splice(k, 1);
    }

    this.flush();
    return ev;
  }
}
