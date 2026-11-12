import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL, daub, place, paintify, glowSprite } from './util.js';

// Sketches: things somebody drew on the world and never painted. Each stands as a white outline until the
// painter swings the brush at it; then it becomes real, in whatever colour was on the brush, and goes on to do
// its small thing: a lantern glows, a pinwheel turns, a kite flies, a bell rings when you pass.
// Swing at one again with another colour and it is repainted.

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const CREAM = ['#fff4dc', '#f6e6c8', '#ffffff'];
const box = (w, h, d, x, y, z, pal, rx = 0, ry = 0, rz = 0) => daub(place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), pal);
const cyl = (r0, r1, h, x, y, z, pal, seg = 6, open = false) => daub(place(new THREE.CylinderGeometry(r0, r1, h, seg, 1, open), x, y, z), pal);
const ball = (r, x, y, z, pal, sy = 1, detail = 1) => daub(place(new THREE.IcosahedronGeometry(r, detail), x, y, z, 0, r * 3, 0, 1, sy, 1), pal, { scale: 0.5, spread: 1 });

// Each kind builds its parts from `T`, a few tones of the paint it was made real with. `fixed` parts stand still;
// `moving` parts are built around `pivot` and are what turns, sways or swings. `colliders` are [x, z, r] in its own space.
const KINDS = {
  lantern: {
    name: 'A lantern', top: 3.4,
    build(T, ghost) {
      const fixed = [
        cyl(0.3, 0.38, 0.3, 0, 0.15, 0, PAL.stone, 7), cyl(0.09, 0.13, 3.4, 0, 1.7, 0, PAL.trunk),
        box(1.05, 0.1, 0.1, 0.45, 3.32, 0, PAL.trunk), cyl(0.025, 0.025, 0.3, 0.85, 3.16, 0, PAL.trunk, 4),
        daub(place(new THREE.ConeGeometry(0.44, 0.32, 6), 0.85, 2.98, 0), PAL.gold), cyl(0.24, 0.3, 0.1, 0.85, 2.2, 0, PAL.gold),
        box(0.5, 0.95, 0.05, 0.32, 2.75, 0, T),                 // a pennant under the arm, in the lantern's colour
      ];
      if (ghost) fixed.push(ball(0.3, 0.85, 2.55, 0, T));
      return { fixed, glass: [0.85, 2.55, 0, 0.3], colliders: [[0, 0, 0.35]] };
    },
  },
  sapling: {
    name: 'A sapling', top: 4,
    build(T) {
      const fixed = [daub(place(new THREE.CylinderGeometry(0.13, 0.24, 2.7, 6), 0, 1.35, 0, 0, 0, 0.05), PAL.trunk)];
      for (const [x, y, z, r] of [[0, 3.1, 0, 1.05], [0.85, 2.6, 0.3, 0.72], [-0.75, 2.7, -0.3, 0.78], [0.1, 3.75, -0.2, 0.62]]) fixed.push(ball(r, x, y, z, T, 0.72));
      return { fixed, colliders: [[0, 0, 0.4]] };
    },
  },
  bench: {
    name: 'A bench', top: 1.5,
    build(T) {
      const fixed = [box(2.2, 0.14, 0.7, 0, 0.62, 0, T), box(2.2, 0.62, 0.1, 0, 1.16, -0.33, T, -0.12)];
      for (const sx of [-0.95, 0.95]) {
        for (const sz of [-0.25, 0.25]) fixed.push(box(0.12, 0.62, 0.12, sx, 0.31, sz, PAL.trunk));
        fixed.push(box(0.1, 0.1, 0.72, sx * 1.1, 0.96, 0, PAL.gold), box(0.1, 0.34, 0.1, sx * 1.1, 0.8, 0.3, PAL.trunk));
      }
      return { fixed, colliders: [[-0.6, 0, 0.6], [0.6, 0, 0.6]] };
    },
  },
  pinwheel: {
    name: 'A pinwheel', top: 3.9,
    build(T) {
      const fixed = [cyl(0.26, 0.34, 0.26, 0, 0.13, 0, PAL.stone, 7), cyl(0.07, 0.1, 3.2, 0, 1.6, 0, PAL.trunk)];
      const moving = [ball(0.15, 0, 0, 0.06, PAL.gold)];
      for (let k = 0; k < 4; k++) {
        const a = k * (Math.PI / 2) + Math.PI / 4;
        moving.push(daub(place(new THREE.ConeGeometry(0.44, 1.3, 3), Math.cos(a) * 0.64, Math.sin(a) * 0.64, 0, 0, 0, a - Math.PI / 2, 1, 1, 0.14), k % 2 ? CREAM : T, { spread: 1 }));
      }
      return { fixed, moving, pivot: [0, 3.2, 0.14], colliders: [[0, 0, 0.3]] };
    },
  },
  kite: {
    name: 'A kite', top: 2.4,
    build(T) {
      const fixed = [cyl(0.08, 0.11, 0.7, 0, 0.35, 0, PAL.trunk), box(0.34, 0.08, 0.08, 0, 0.6, 0, PAL.gold)];
      const K = new V3(0, 5.6, -3.4), tilt = 0.45;
      const sh = new THREE.Shape(); sh.moveTo(0, 1.0); sh.lineTo(0.68, 0.1); sh.lineTo(0, -1.2); sh.lineTo(-0.68, 0.1); sh.closePath();
      const moving = [
        daub(new THREE.TubeGeometry(new THREE.LineCurve3(new V3(0, 0, 0), K), 1, 0.022, 4), CREAM),
        daub(place(new THREE.ShapeGeometry(sh), K.x, K.y, K.z, tilt, 0, 0), T, { spread: 1 }),
        box(0.05, 2.2, 0.05, K.x, K.y - 0.1, K.z + 0.03, PAL.gold, tilt), box(1.36, 0.05, 0.05, K.x, K.y + 0.1, K.z + 0.03, PAL.gold, tilt),
      ];
      for (let k = 0; k < 4; k++) moving.push(ball(0.13, K.x, K.y - 1.6 - k * 0.55, K.z + 0.5 + k * 0.28, k % 2 ? CREAM : T, 1, 0));
      return { fixed, moving, pivot: [0, 0.7, 0], colliders: [[0, 0, 0.25]] };
    },
  },
  bell: {
    name: 'A bell', top: 2.8,
    build(T) {
      const fixed = [box(2.0, 0.18, 0.22, 0, 2.65, 0, PAL.trunk)];
      for (const sx of [-0.8, 0.8]) fixed.push(box(0.16, 2.6, 0.16, sx, 1.3, 0, PAL.trunk), box(0.3, 0.12, 0.3, sx, 2.8, 0, PAL.gold), cyl(0.18, 0.24, 0.2, sx, 0.1, 0, PAL.stone));
      const moving = [
        cyl(0.02, 0.02, 0.3, 0, -0.15, 0, PAL.trunk, 4), ball(0.23, 0, -0.34, 0, T),
        daub(place(new THREE.CylinderGeometry(0.2, 0.52, 0.75, 12, 1, true), 0, -0.7, 0), T, { spread: 1 }),
        ball(0.1, 0, -1.1, 0, PAL.gold, 1, 0),
      ];
      return { fixed, moving, pivot: [0, 2.56, 0], colliders: [[-0.8, 0, 0.25], [0.8, 0, 0.25]] };
    },
  },
};

// island, a first guess at the spot (nudged if something is in the way), and what is sketched there
const SPOTS = [
  { i: 0, x: 7.5, z: 8, kind: 'lantern' }, { i: 0, x: -7, z: -4, kind: 'sapling' }, { i: 0, x: 9, z: -10, kind: 'bench' },
  { i: 1, x: 4, z: 7, kind: 'pinwheel' }, { i: 1, x: -3, z: -9, kind: 'bell' },
  { i: 2, x: 9, z: -8, kind: 'kite' }, { i: 2, x: 6, z: 11, kind: 'sapling' }, { i: 2, x: -2, z: -4, kind: 'lantern' },
  { i: 3, x: -2, z: 8, kind: 'bench' }, { i: 3, x: 5, z: 3, kind: 'pinwheel' },
  { i: 4, x: 14, z: 22, kind: 'bell' }, { i: 4, x: -17, z: 24, kind: 'kite' },
];

// A drawing in the air: bright along its outlines, faintly hatched across its faces, and never quite still
const GHOST_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const GHOST_FRAG = /* glsl */ `
precision highp float;
uniform float time;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
  float hatch = step(0.6, fract((vW.x + vW.y * 1.3 - vW.z) * 2.4));
  float a = (0.26 + rim * 0.8 + hatch * 0.2) * (0.86 + 0.14 * sin(time * 1.7 + vW.x));
  gl_FragColor = vec4(vec3(1.25), clamp(a, 0.0, 0.96));          // a touch brighter than white, so the outline glows a little
}`;

const pop = (u) => 1 - (1 - u) ** 3 + Math.sin(u * Math.PI) * 0.2;
const tonesOf = (hex) => { const c = new THREE.Color(hex); return [0, 0.08, -0.08, 0.15, -0.14].map((l) => '#' + c.clone().offsetHSL(0, 0, l).getHexString()); };

export class Sketches {
  /** `keepClear` is a list of { x, z, r }: places already spoken for. */
  constructor(scene, world, uTime, keepClear = []) {
    this.scene = scene; this.world = world;
    this.ghostMat = new THREE.ShaderMaterial({ uniforms: { time: uTime }, vertexShader: GHOST_VERT, fragmentShader: GHOST_FRAG, transparent: true, depthWrite: false, fog: false });
    this.realMat = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2a2026 }), { scale: 1.2 });
    this.items = [];
    this.events = [];
    const taken = keepClear.slice();
    for (const def of SPOTS) {
      const isl = world.islands[def.i], at = this.settle(def, isl, taken);
      if (!at) continue;
      const kind = KINDS[def.kind], pos = new V3(at.x, world.groundHeight(at.x, at.z, 1e9), at.z);
      // it faces the middle of its island, which is roughly where the painter will come from
      const facing = Math.atan2(isl.x - pos.x, isl.z - pos.z);
      const parts = kind.build(CREAM, true), all = parts.fixed.slice();
      if (parts.moving) for (const g of parts.moving) all.push(g.translate(...parts.pivot));
      const ghost = new THREE.Mesh(mergeGeometries(all, false), this.ghostMat);
      all.forEach((g) => g.dispose());
      ghost.position.copy(pos); ghost.rotation.y = facing; ghost.renderOrder = 3;
      scene.add(ghost);
      taken.push({ x: pos.x, z: pos.z, r: 8 });
      this.items.push({
        kind: def.kind, name: kind.name, pos, facing, top: new V3(pos.x, pos.y + kind.top * 0.62, pos.z),
        ghost, real: null, mover: null, glass: null, colliders: null,
        hex: null, t: 1, spin: 0, speed: 0.6, swing: 0, swingV: 0, rang: 0, ph: this.items.length * 1.7,
      });
    }
  }

  /** Find clear ground near the suggested spot: on the island, off the path, away from everything else. */
  settle(def, isl, taken) {
    const w = this.world, x0 = isl.x + def.x, z0 = isl.z + def.z;
    const onBridge = (x, z) => w.bridges.some((br) => x > br.min.x - 1 && x < br.max.x + 1 && z > br.min.z - 1 && z < br.max.z + 1 && br.pts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 20));
    for (const ring of [0, 1.5, 3, 4.5, 6, 8, 10]) for (let k = 0; k < (ring ? 12 : 1); k++) {
      const a = (k / 12) * TAU, x = x0 + Math.cos(a) * ring, z = z0 + Math.sin(a) * ring;
      if (w.islandAt(x, z) !== isl || w.islandAt(x + (x - isl.x) * 0.16, z + (z - isl.z) * 0.16) !== isl) continue;
      if (w.nearPath(x, z, 3.6) || onBridge(x, z)) continue;
      if (w.colliders.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + 2.2) ** 2)) continue;
      if (taken.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < c.r * c.r)) continue;
      return { x, z };
    }
    return null;
  }

  get total() { return this.items.length; }
  get painted() { return this.items.filter((s) => s.hex).length; }

  /** An unpainted sketch near the painter, if there is one (for the first hint). */
  waiting(p, reach = 9) {
    for (const s of this.items) if (!s.hex && (s.pos.x - p.x) ** 2 + (s.pos.z - p.z) ** 2 < reach * reach && Math.abs(s.pos.y - p.y) < 4) return s;
    return null;
  }

  /**
   * A swing of the brush: `(x, z)` is where the stroke lands, `p` the painter. Every sketch within reach is painted
   * (or, if it is already real and a different colour, repainted). Returns [{ sketch, fresh }].
   */
  strike(x, z, p, hex) {
    const out = [];
    for (const s of this.items) {
      if (Math.abs(s.pos.y - p.y) > 4 || s.hex === hex) continue;
      const near = (s.pos.x - x) ** 2 + (s.pos.z - z) ** 2 < 3.5 * 3.5 || (s.pos.x - p.x) ** 2 + (s.pos.z - p.z) ** 2 < 2.4 * 2.4;
      if (!near) continue;
      const fresh = !s.hex;
      this.paint(s, hex);
      out.push({ sketch: s, fresh });
    }
    return out;
  }

  /** Make a sketch real in this colour (or change the colour of one that already is). */
  paint(s, hex, instant = false) {
    const kind = KINDS[s.kind], parts = kind.build(tonesOf(hex), false), fresh = !s.real;
    const merge = (list) => { const g = mergeGeometries(list, false); list.forEach((q) => q.dispose()); return g; };
    if (s.real) { this.scene.remove(s.real); s.real.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    const real = new THREE.Group();
    real.add(new THREE.Mesh(merge(parts.fixed), this.realMat));
    s.mover = null;
    if (parts.moving) {
      s.mover = new THREE.Mesh(merge(parts.moving), this.realMat);
      s.mover.position.fromArray(parts.pivot);
      real.add(s.mover);
    }
    if (parts.glass) {
      // the lantern's light: brighter than white, so it glows, and warmer after dark
      const [gx, gy, gz, r] = parts.glass, col = new THREE.Color(hex);
      const glass = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color(0xffffff), 0.25).multiplyScalar(1.6), fog: false }));
      glass.position.set(gx, gy, gz);
      const halo = glowSprite(this.world.glowTex, 4.2, col.clone().lerp(new THREE.Color(0xffffff), 0.3).getHex(), 0.5);
      halo.position.set(gx, gy, gz);
      real.add(glass, halo);
      s.glass = halo;
    }
    real.position.copy(s.pos); real.rotation.y = s.facing;
    this.scene.add(real);
    s.real = real; s.hex = hex; s.ghost.visible = false;
    s.t = instant || !fresh ? 1 : 0;
    if (!fresh && !instant) s.t = 0.72;                   // a repaint: a small bounce, not the whole arrival
    if (!s.colliders) {
      // it is solid now (`late`: it was not there when the garden was laid out)
      const sn = Math.sin(s.facing), cs = Math.cos(s.facing);
      s.colliders = parts.colliders.map(([cx, cz, r]) => ({ x: s.pos.x + cx * cs + cz * sn, z: s.pos.z - cx * sn + cz * cs, r, late: true }));
      this.world.colliders.push(...s.colliders);
    }
    if (s.kind === 'bell' && !instant) s.swingV = 3.2;
    if (s.kind === 'pinwheel' && !instant) s.speed = 9;
  }

  save() { return this.items.map((s) => s.hex || 0); }
  load(list) {
    (list || []).forEach((hex, i) => { const s = this.items[i]; if (s && typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)) this.paint(s, hex, true); });
  }

  /** Advance everything that moves. With a `player`, bells ring and pinwheels quicken as they pass. Returns this frame's events. */
  update(dt, t, player) {
    const ev = this.events; ev.length = 0;
    for (const s of this.items) {
      if (!s.real) continue;
      if (s.t < 1) {
        s.t = Math.min(1, s.t + dt / 0.7);
        const k = pop(s.t), ky = pop(Math.min(1, s.t * 1.35));
        s.real.scale.set(k, ky, k);
      }
      const d2 = player ? (s.pos.x - player.pos.x) ** 2 + (s.pos.z - player.pos.z) ** 2 + (s.pos.y - player.pos.y) ** 2 : 1e9;
      if (s.kind === 'pinwheel') {
        // it turns in the breeze, and spins up when the painter runs or skates past
        if (d2 < 30) s.speed = Math.max(s.speed, Math.min(14, Math.hypot(player.vel.x, player.vel.z) * 0.9));
        s.speed += (0.7 + Math.sin(t * 0.4 + s.ph) * 0.4 - s.speed) * (1 - Math.exp(-0.5 * dt));
        s.spin += s.speed * dt;
        s.mover.rotation.z = s.spin;
      } else if (s.kind === 'kite') {
        s.mover.rotation.z = Math.sin(t * 0.7 + s.ph) * 0.13 + Math.sin(t * 1.9 + s.ph) * 0.03;
        s.mover.rotation.x = Math.sin(t * 0.5 + s.ph * 2) * 0.07;
      } else if (s.kind === 'bell') {
        s.rang -= dt;
        if (d2 < 6 && s.rang <= 0 && s.t >= 1) { s.rang = 3; s.swingV += 2.6; ev.push({ type: 'bell', sketch: s }); }
        s.swingV += (-s.swing * 30 - s.swingV * 1.3) * dt; s.swing += s.swingV * dt;
        s.mover.rotation.z = s.swing;
      } else if (s.glass) {
        s.glass.material.opacity = 0.45 + Math.sin(t * 1.9 + s.ph) * 0.08;
      }
    }
    return ev;
  }
}
