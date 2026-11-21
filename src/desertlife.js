import * as THREE from 'three';
import { daub, place, Bag, glowSprite, clamp, mulberry32 } from './util.js';

// What makes the desert of the Sunken Tower somewhere that is lived in, and alive (see dunes.js, which owns this):
//   wind ........ sand smoking off the crests of the dunes, weeds rolling before it, a line of flags at the camp
//   people ...... a camp left standing by the oasis; a caravan crossing the far dunes, never to be caught up with;
//                 lanterns down the avenue of statues, which light as the evening comes
//   creatures ... lizards that scatter and leave their tracks, a fox that watches from a crest and is gone when it is
//                 come near, beetles; a flock that goes up when the worm comes out, and later roosts on the one that woke
//   to play with  arches half under the sand on the way down the hill, a row of bells that ring for whoever passes
//                 them, jars that go over when they are brushed against
//   night ....... moths at the lanterns, fireflies at the oasis, windows lit far off in the rocks
// Nothing here can hurt, and nothing here is needed: it is all only there.

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const STONE = ['#d9b98a', '#c9a676', '#e6caa0', '#b8935f'], ROCK = ['#b08858', '#9a744a', '#c49a68'], WOOD = ['#7a5a3a', '#6a4c30', '#8a6844'], CHAR = ['#3a302a', '#2c2420', '#4a3e36'];
const CLOTH = ['#b8503c', '#a04434', '#c86048'], CREAM = ['#f0e2c0', '#e6d4a8', '#f6ecd0'], TILE = ['#3fb8b0', '#2e9a9c', '#58d0c0'], GILT = ['#c99a3e', '#e0b860', '#a87a2a'];
const WIND = new V3(0.92, 0, 0.39);          // (the way the ripples in the sand say it blows)
const flat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: 0x16100a, ...extra });

export class DesertLife {
  /**
   * `env`: low(x, z) and high(x, z), how high the sand lies in the open desert and on the island; X0, Z0, the island's
   * middle; oasis and land, the middles of the oasis and of the open desert; mesas, [x, z, r, h, baseY] of each rock;
   * material(), the painted stone; dig(x, z, r, depth, low), a mark pressed into the sand.
   */
  constructor(scene, world, env) {
    this.env = env; this._v = new V3();
    const { low, high, X0, Z0 } = env, rnd = mulberry32(8813), root = (this.root = new THREE.Group()); root.visible = false; scene.add(root);
    const bag = new Bag(), add = (g, pal = STONE, o = { scale: 0.3, spread: 0.7 }) => bag.add(daub(g, pal, o));
    const box = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
    const L = (dx, dz, lift = 0) => new V3(X0 + dx, low(X0 + dx, Z0 + dz) + lift, Z0 + dz), H = (dx, dz, lift = 0) => new V3(X0 + dx, high(X0 + dx, Z0 + dz) + lift, Z0 + dz);
    const glow = (p, size, color, op = 0) => { const q = glowSprite(world.glowTex, size, color, op); q.position.copy(p); root.add(q); return q; };
    const points = (n, size, color, additive = true) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); const m = new THREE.Points(g, new THREE.PointsMaterial({ map: world.glowTex, size, color, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })); m.frustumCulled = false; root.add(m); return m; };

    // ================================================================= the camp, on the shore of the oasis that is not there
    const K = L(env.oasis[0] - 30, env.oasis[1] + 30);
    {
      const k = (dx, dz, lift = 0) => { const p = new V3(K.x + dx, 0, K.z + dz); p.y = low(p.x, p.z) + lift; return p; };
      for (const [dx, dz, yaw, pal] of [[-4.5, -2, 0.5, CLOTH], [5, 1.5, -0.9, CREAM]]) {
        const p = k(dx, dz);
        add(place(new THREE.ConeGeometry(3.3, 3.7, 4, 1, true), p.x, p.y + 1.75, p.z, 0, yaw + Math.PI / 4), pal, { scale: 0.5, spread: 1 }); add(place(new THREE.CylinderGeometry(0.08, 0.08, 4.6, 5), p.x, p.y + 2.3, p.z), WOOD);
        add(place(new THREE.ConeGeometry(1.25, 2.3, 3), p.x + Math.sin(yaw) * 2.05, p.y + 1.1, p.z + Math.cos(yaw) * 2.05, 0, yaw + Math.PI), CHAR);          // (the way in, dark)
        add(box(2.6, 0.07, 1.7, p.x + Math.sin(yaw) * 3.6, p.y + 0.06, p.z + Math.cos(yaw) * 3.6, 0, yaw), pal === CLOTH ? TILE : CLOTH, { scale: 0.8, spread: 1 });
        world.colliders.push({ x: p.x, z: p.z, r: 2.1, top: p.y + 3.4, late: true });
      }
      // a fire that has been cold a long time: a ring of stones, ash, three burnt ends
      const f = k(0.5, -6);
      for (let i = 0; i < 8; i++) add(place(new THREE.IcosahedronGeometry(0.34, 0), f.x + Math.cos(i * 0.785) * 1.2, f.y + 0.15, f.z + Math.sin(i * 0.785) * 1.2, i, i * 2, 0), ROCK);
      add(place(new THREE.CylinderGeometry(1.0, 1.0, 0.06, 10), f.x, f.y + 0.04, f.z), CHAR); for (let i = 0; i < 3; i++) add(box(0.18, 0.18, 1.1, f.x, f.y + 0.18, f.z, 0.2, i * 2.1, 0), CHAR);
      // a post with a rope on it and nothing on the rope; and from the tent to the post, a line of flags
      const post = k(9.5, -3.5), tent = k(-4.5, -2, 4.4);
      add(place(new THREE.CylinderGeometry(0.14, 0.18, 3.4, 6), post.x, post.y + 1.6, post.z, 0.05, 0, -0.08), WOOD); add(box(0.07, 0.07, 3.0, post.x + 0.9, post.y + 0.45, post.z + 1.2, 0.5, 0.6, 0), CREAM);
      this.flags = [];
      for (let i = 1; i <= 9; i++) {
        const u = i / 10, at = tent.clone().lerp(new V3(post.x, post.y + 3.2, post.z), u);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8).translate(0, -0.4, 0), flat([0xb8503c, 0xf0e2c0, 0x3fb8b0, 0xe0b860][i % 4], { side: THREE.DoubleSide })); m.position.copy(at); m.rotation.y = Math.atan2(post.x - tent.x, post.z - tent.z) + Math.PI / 2; root.add(m); this.flags.push(m);
      }
      { const a = tent, b = new V3(post.x, post.y + 3.2, post.z), line = new THREE.CylinderGeometry(0.03, 0.03, a.distanceTo(b), 4); line.applyMatrix4(new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize()), new V3(1, 1, 1))); add(line, CREAM); }
      // jars: they stand until somebody brushes against them
      const jar = new THREE.LatheGeometry([[0, 0], [0.32, 0], [0.46, 0.3], [0.4, 0.72], [0.2, 0.92], [0.27, 1.02]].map(([x, y]) => new THREE.Vector2(x, y)), 10);
      this.jars = [[-1.5, 3.2], [-0.6, 3.9], [6.6, -2.6], [7.4, -1.9], [2.2, -3.4], [-7.5, 1.2], [3.4, 5.6]].map(([dx, dz], i) => {
        const p = k(dx, dz), m = new THREE.Mesh(jar, flat([0xb8663c, 0xa4582f, 0xc87a48][i % 3])); m.position.copy(p); m.scale.setScalar(0.9 + (i % 3) * 0.18); root.add(m); return { m, fall: 0, ax: 0, az: 0 };
      });
    }

    // ================================================================= on the way down the hill: arches, and a row of bells
    for (const [dx, dz, yaw] of [[6, 548, 0.05], [24, 462, 0.2], [48, 372, 0.25]]) {
      const c = L(dx, dz), cs = Math.cos(yaw), sn = Math.sin(yaw);
      for (const k of [-1, 1]) { const x = c.x + cs * k * 6, z = c.z - sn * k * 6, y = low(x, z) - 1.5; add(box(2.2, 9, 2.2, x, y + 4.5, z, 0.03 * k, yaw, 0.04 * k)); add(box(2.7, 0.6, 2.7, x, y + 8.9, z, 0.03 * k, yaw, 0.04 * k), GILT); world.colliders.push({ x, z, r: 1.4, top: y + 9, late: true }); }
      const y0 = Math.max(low(c.x + cs * 6, c.z - sn * 6), low(c.x - cs * 6, c.z + sn * 6)) + 7.6;
      for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI, ox = -Math.cos(a) * 6; add(box(2.4, 1.3, 2.0, c.x + cs * ox, y0 + Math.sin(a) * 4.2, c.z - sn * ox, 0, yaw, Math.cos(a) * 1.0), i === 3 ? TILE : STONE); }
    }
    this.bells = [];
    {
      const bell = new THREE.CylinderGeometry(0.14, 0.52, 0.72, 8).translate(0, -0.55, 0);
      for (let i = 0; i < 8; i++) {
        const u = i / 7, k = i % 2 ? 1 : -1, p = L(-6 + 54 * u + k * 5.5, 606 - 250 * u), lean = 0.12 * k;
        add(box(0.34, 4.6, 0.34, p.x, p.y + 1.9, p.z, 0, 0, lean), WOOD); add(box(1.5, 0.24, 0.24, p.x - k * 0.9 - lean * 4, p.y + 4.1, p.z), WOOD);
        const m = new THREE.Mesh(bell, flat(0xd0a040, { emissive: 0x3a2808 })); m.position.set(p.x - k * 1.5 - lean * 4, p.y + 4.0, p.z); root.add(m);
        this.bells.push({ m, x: m.position.x, z: m.position.z, swing: 0, cool: 0 });
      }
    }

    // ================================================================= lanterns down the avenue of statues (they light as it grows late)
    this.lamps = [];
    for (const [dx, dz, at] of [[-4.4, 46, 0.11], [4.4, 46, 0.11], [-4.4, 28, 0.16], [4.4, 28, 0.16], [-4.4, 10, 0.21], [4.4, 10, 0.21]]) {
      const p = H(dx, dz);
      add(box(0.26, 3.2, 0.26, p.x, p.y + 1.5, p.z), WOOD); add(box(0.9, 0.12, 0.9, p.x, p.y + 3.15, p.z), GILT); add(place(new THREE.ConeGeometry(0.6, 0.5, 4), p.x, p.y + 4.25, p.z, 0, Math.PI / 4), GILT);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.6), new THREE.MeshBasicMaterial({ color: 0x4a3a28, fog: false })); m.position.set(p.x, p.y + 3.62, p.z); root.add(m);
      this.lamps.push({ m, g: glow(m.position, 5.5, 0xffc070), at, k: 0 });
      world.colliders.push({ x: p.x, z: p.z, r: 0.3, top: p.y + 3.3, late: true });
    }
    this.moths = points(this.lamps.length * 3, 0.5, 0xfff0d0);
    // ---- fireflies at the oasis; windows in the far rocks
    this.flies = points(40, 0.7, 0xc8ff8a); this.fly = Array.from({ length: 40 }, () => [rnd() * TAU, 3 + rnd() * 15, 0.6 + rnd() * 3.6, rnd() * TAU, 0.2 + rnd() * 0.5]);
    this.windows = [];
    for (const [x, z, r, h, y] of env.mesas) { const a = Math.atan2(env.land[0] - x, env.land[1] - z); for (let i = 0; i < 3; i++) { const b = a + (i - 1) * 0.5 + (rnd() - 0.5) * 0.2, hh = (0.3 + i * 0.14 + rnd() * 0.06) * h, rr = r * (1 - 0.28 * (hh / h)) + 0.4; this.windows.push({ g: glow(new V3(x + Math.sin(b) * rr, y + hh, z + Math.cos(b) * rr), 5 + rnd() * 3, 0xffb860), ph: rnd() * TAU }); } }

    // ================================================================= wind: sand off the crests, and weeds before it
    this.spin = points(220, 1.5, 0xf6e2b4, false); this.grain = Array.from({ length: 220 }, () => ({ t: rnd() * 1.6, x: 0, y: -999, z: 0, vy: 0 }));
    this.weeds = Array.from({ length: 6 }, (_, i) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 + (i % 3) * 0.2, 1), new THREE.MeshBasicMaterial({ color: 0x8a6a3a, wireframe: true })); root.add(m); return { m, x: 0, z: 0, v: 9 + i * 1.3, far: true, ph: i * 1.7 }; });

    // ================================================================= creatures
    const critter = (color, parts) => { const g = new THREE.Group(), mat = flat(color); for (const [w, h, d, x, y, z] of parts) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); } root.add(g); return g; };
    // lizards: basking, until somebody comes too near
    this.lizards = [[-5, 38, 0], [9, 24, 0], [-16, 30, 0], [20, 40, 0], [3, 4, 0], [-24, 8, 0], [30, 18, 0], [env.oasis[0] - 36, env.oasis[1] + 10, 1], [env.oasis[0] - 20, env.oasis[1] + 34, 1], [env.oasis[0] + 8, env.oasis[1] - 22, 1], [80, 198, 1], [96, 172, 1]]
      .map(([dx, dz, lowland], i) => ({ g: critter([0x7a8a4a, 0x9a8450, 0x6a7a58][i % 3], [[0.16, 0.08, 0.5, 0, 0.05, 0], [0.12, 0.07, 0.16, 0, 0.06, 0.32], [0.06, 0.05, 0.5, 0, 0.04, -0.45], [0.42, 0.03, 0.06, 0, 0.03, 0.15], [0.42, 0.03, 0.06, 0, 0.03, -0.12]]), x: X0 + dx, z: Z0 + dz, low: !!lowland, run: 0, dir: i * 1.3, mark: 0 }));
    // beetles: going about their business, slowly
    this.beetles = [[K.x + 3, K.z + 2], [K.x - 6, K.z - 4], [K.x + 9, K.z + 5], [X0 + 20, Z0 + 470], [X0 + 2, Z0 + 556], [X0 + 86, Z0 + 196], [X0 + env.oasis[0] - 5, Z0 + env.oasis[1] + 8], [X0 + env.oasis[0] + 6, Z0 + env.oasis[1] - 9]]
      .map(([x, z], i) => ({ g: critter(0x2a2420, [[0.2, 0.12, 0.28, 0, 0.07, 0], [0.12, 0.08, 0.1, 0, 0.06, 0.18]]), x, z, dir: i * 2.3, turn: i * 0.7, mark: 0 }));
    // a fox: on a crest, watching; gone over it when come near; and then on another crest, further on
    this.fox = { g: critter(0xc8793a, [[0.42, 0.5, 1.2, 0, 0.62, 0], [0.36, 0.36, 0.42, 0, 1.0, 0.72], [0.1, 0.22, 0.08, -0.12, 1.28, 0.74], [0.1, 0.22, 0.08, 0.12, 1.28, 0.74], [0.16, 0.14, 0.26, 0, 0.94, 1.0], [0.22, 0.22, 0.9, 0, 0.6, -1.0], [0.12, 0.5, 0.12, -0.14, 0.25, 0.42], [0.12, 0.5, 0.12, 0.14, 0.25, 0.42], [0.12, 0.5, 0.12, -0.14, 0.25, -0.42], [0.12, 0.5, 0.12, 0.14, 0.25, -0.42]]), spots: [[-58, 522], [-92, 404], [172, 306], [-44, 246], [128, 520]], at: 0, run: 0, gone: false, x: 0, z: 0, dir: 0 };
    this.fox.g.children[5].material = flat(0xf0e2c0); this.fox.g.scale.setScalar(1.35); this.fox.x = X0 + this.fox.spots[0][0]; this.fox.z = Z0 + this.fox.spots[0][1];
    // a flock: sat on a dune by where the worm comes out, and later on the shoulders of the one that woke; up when either stirs
    this.birds = Array.from({ length: 14 }, (_, i) => {
      const g = new THREE.Group(), mat = flat(0xf4ecd8, { side: THREE.DoubleSide }), w = [-1, 1].map((k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42).translate(k * 0.45, 0, 0).rotateX(-Math.PI / 2), mat); g.add(m); return m; });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.6), mat); g.add(b); root.add(g);
      return { g, w, ph: i * 0.83, r: 14 + (i % 5) * 4, h: 12 + (i % 4) * 3.5, sp: (i % 2 ? 1 : -1) * (0.5 + (i % 3) * 0.12), roost: new V3() };
    });
    this.air = 0; this.perchAt = L(96, 500, 0.2);
    // ================================================================= far off: a caravan, going along the crests where nobody can follow
    this.caravan = Array.from({ length: 9 }, (_, i) => {
      const beast = i % 3 !== 2, g = critter(0x4a3626, beast
        ? [[1.6, 2.0, 4.4, 0, 4.6, 0], [1.2, 1.4, 1.6, 0, 6.2, -0.3], [0.7, 2.6, 0.8, 0, 6.0, 2.4], [0.8, 0.8, 1.6, 0, 7.4, 3.0], [0.5, 3.6, 0.5, -0.5, 1.8, 1.6], [0.5, 3.6, 0.5, 0.5, 1.8, 1.6], [0.5, 3.6, 0.5, -0.5, 1.8, -1.6], [0.5, 3.6, 0.5, 0.5, 1.8, -1.6], [2.2, 1.2, 1.8, 0, 5.6, -1.2]]
        : [[1.0, 2.6, 0.8, 0, 2.3, 0], [0.7, 0.8, 0.7, 0, 4.0, 0], [0.4, 1.0, 0.4, -0.25, 0.5, 0], [0.4, 1.0, 0.4, 0.25, 0.5, 0], [0.12, 4.4, 0.12, 0.7, 2.4, 0.3]]);
      return { g, off: i * 15 };
    });
    this.march = 0;

    const fixed = bag.mesh(env.material()); fixed.material.side = THREE.DoubleSide; fixed.frustumCulled = false; root.add(fixed);
  }

  /** `st`: day and night (0..1), is the painter down in the open desert, has the worm just come out (and how far off), where the giant's shoulders are once it stands. */
  update(dt, t, player, st, ev) {
    const { low, high, X0, Z0 } = this.env, p = player.pos, v = this._v, sp = Math.hypot(player.vel.x, player.vel.z);
    const ground = (x, z, lowland) => (lowland ? low(x, z) : high(x, z));
    const down = p.y - low(p.x, p.z) < 8;          // (is the painter on the sand of the open desert, or just over it?)

    // ---- flags, lanterns and their moths, fireflies, windows
    this.flags.forEach((m, i) => { m.rotation.x = 0.5 + Math.sin(t * 6.3 + i * 1.3) * 0.35 + Math.sin(t * 2.1 + i) * 0.2; });
    const mo = this.moths.geometry.attributes.position; let lit = 0;
    this.lamps.forEach((l, i) => {
      l.k += clamp((st.day > l.at ? 1 : 0) - l.k, -dt, dt / 1.8); lit = Math.max(lit, l.k);
      l.m.material.color.setRGB(0.29 + 0.71 * l.k, 0.23 + 0.62 * l.k, 0.16 + 0.42 * l.k); l.g.material.opacity = l.k * (0.7 + 0.12 * Math.sin(t * 5 + i));
      for (let j = 0; j < 3; j++) { const a = t * (1.6 + j * 0.5) + i * 2 + j * 2.1; mo.setXYZ(i * 3 + j, l.m.position.x + Math.cos(a) * (0.7 + 0.3 * Math.sin(a * 1.7)), l.m.position.y + Math.sin(a * 2.3) * 0.5, l.m.position.z + Math.sin(a) * (0.7 + 0.3 * Math.cos(a * 1.3))); }
    });
    mo.needsUpdate = true; this.moths.material.opacity = Math.min(lit, st.night * 2 + lit * 0.4) * 0.9;
    const fp = this.flies.geometry.attributes.position, ox = X0 + this.env.oasis[0], oz = Z0 + this.env.oasis[1];
    if (st.night > 0.02) { this.fly.forEach(([a, r, h, ph, s], i) => { const b = a + t * s * 0.2 + Math.sin(t * 0.7 + ph) * 0.3, x = ox + Math.cos(b) * r, z = oz + Math.sin(b) * r; fp.setXYZ(i, x, low(x, z) + h + Math.sin(t * 1.3 + ph) * 0.6, z); }); fp.needsUpdate = true; }
    this.flies.material.opacity = st.night * 0.9;
    for (const w of this.windows) w.g.material.opacity = st.night * (0.75 + 0.2 * Math.sin(t * 2.3 + w.ph));

    // ---- sand off the crests: a grain is let go where the ground falls away downwind, near the painter, and blows a little way
    if (down) {
      const gp = this.spin.geometry.attributes.position;
      this.grain.forEach((g, i) => {
        if ((g.t -= dt) <= 0) {
          g.y = -999;
          for (let k = 0; k < 3; k++) { const x = p.x + (Math.random() - 0.5) * 240, z = p.z + (Math.random() - 0.5) * 240, y = low(x, z); if (y - low(x + WIND.x * 5, z + WIND.z * 5) > 0.6 && y - low(x - WIND.x * 5, z - WIND.z * 5) > -0.4) { g.x = x; g.y = y + 0.3; g.z = z; g.vy = 1.5 + Math.random() * 2; g.t = 1.0 + Math.random() * 1.2; break; } }
          if (g.y < -900) g.t = 0.2;
        } else if (g.y > -900) { g.x += WIND.x * 15 * dt; g.z += WIND.z * 15 * dt; g.y += g.vy * dt; g.vy -= 2.2 * dt; }
        gp.setXYZ(i, g.x, g.y, g.z);
      });
      gp.needsUpdate = true;
      // weeds: rolled along by it; one that has gone too far is found again upwind
      for (const w of this.weeds) {
        if (w.far || Math.hypot(w.x - p.x, w.z - p.z) > 170) { const s = (Math.random() - 0.5) * 200; w.x = p.x - WIND.x * 130 - WIND.z * s; w.z = p.z - WIND.z * 130 + WIND.x * s; w.far = false; }
        w.x += WIND.x * w.v * dt; w.z += WIND.z * w.v * dt; w.m.position.set(w.x, low(w.x, w.z) + 0.85 + Math.abs(Math.sin(t * 2.2 + w.ph)) * 1.1, w.z); w.m.rotation.z -= w.v * dt * 0.9; w.m.rotation.x += dt * 0.7;
      }
    }
    this.spin.material.opacity = down ? 0.5 : 0; for (const w of this.weeds) w.m.visible = down;

    // ---- bells ring for whoever goes by; jars go over when they are brushed against
    this.bells.forEach((b, i) => {
      b.cool -= dt; b.swing *= Math.exp(-1.4 * dt); b.m.rotation.z = Math.sin(t * 9 + i) * b.swing; b.m.rotation.x = Math.cos(t * 7 + i) * b.swing * 0.5;
      if (b.cool <= 0 && (p.x - b.x) ** 2 + (p.z - b.z) ** 2 < 36 && Math.abs(p.y - b.m.position.y + 4) < 6) { b.cool = 2.5; b.swing = 0.7; ev.push({ type: 'bell', n: i }); }
    });
    for (const j of this.jars) {
      const q = j.m.position;
      if (!j.fall && (p.x - q.x) ** 2 + (p.z - q.z) ** 2 < 1.1 && Math.abs(p.y - q.y) < 1.5) { j.fall = 0.001; const d = Math.hypot(q.x - p.x, q.z - p.z) || 1; j.ax = (q.z - p.z) / d; j.az = -(q.x - p.x) / d; ev.push({ type: 'clink', at: q }); }
      if (j.fall > 0 && j.fall < 1) { j.fall = Math.min(1, j.fall + dt / 0.35); const a = j.fall * j.fall * 1.5; j.m.rotation.set(j.ax * a, 0, j.az * a); q.x -= j.az * dt * 1.6; q.z += j.ax * dt * 1.6; q.y = low(q.x, q.z) + 0.3 * j.fall; }
    }

    // ---- lizards, beetles, the fox
    for (const l of this.lizards) {
      const d = Math.hypot(p.x - l.x, p.z - l.z);
      if (l.run <= 0 && d < 5.5 && Math.abs(p.y - ground(l.x, l.z, l.low)) < 3) { l.run = 1.1; l.dir = Math.atan2(l.x - p.x, l.z - p.z) + (Math.random() - 0.5) * 1.2; }
      if (l.run > 0) { l.run -= dt; const a = l.dir + Math.sin(t * 22) * 0.35; l.x += Math.sin(a) * 11 * dt; l.z += Math.cos(a) * 11 * dt; l.g.rotation.y = a; if ((l.mark -= dt) <= 0) { l.mark = 0.07; this.env.dig(l.x, l.z, 0.13, 0.3, l.low); } }
      l.g.position.set(l.x, ground(l.x, l.z, l.low) + 0.02, l.z);
    }
    for (const b of this.beetles) {
      if ((b.turn -= dt) <= 0) { b.turn = 2 + Math.random() * 3; b.dir += (Math.random() - 0.5) * 2; }
      b.x += Math.sin(b.dir) * 0.55 * dt; b.z += Math.cos(b.dir) * 0.55 * dt; b.g.position.set(b.x, low(b.x, b.z) + 0.02, b.z); b.g.rotation.y = b.dir;
      if ((b.mark -= dt) <= 0) { b.mark = 0.3; this.env.dig(b.x, b.z, 0.07, 0.2, true); }
    }
    {
      const f = this.fox, d = Math.hypot(p.x - f.x, p.z - f.z);
      if (f.gone) { const s = f.spots[f.at]; if (Math.hypot(p.x - X0 - s[0], p.z - Z0 - s[1]) > 110) { f.gone = false; f.x = X0 + s[0]; f.z = Z0 + s[1]; } }
      else if (f.run > 0) { f.run -= dt; f.x += Math.sin(f.dir) * 17 * dt; f.z += Math.cos(f.dir) * 17 * dt; f.g.rotation.y = f.dir; if (f.run <= 0) { f.gone = true; f.at = (f.at + 1) % f.spots.length; } }
      else { f.g.rotation.y = Math.atan2(p.x - f.x, p.z - f.z); if (d < 44 && down) { f.run = 3.2; f.dir = Math.atan2(f.x - p.x, f.z - p.z) + 0.4; } }
      f.g.visible = !f.gone; f.g.position.set(f.x, low(f.x, f.z) + (f.run > 0 ? Math.abs(Math.sin(t * 14)) * 0.5 : 0), f.z);
    }

    // ---- the flock: sitting; up and round when the worm comes out near them, or the painter comes among them; and down again
    {
      const up = st.shoulders, mid = up ? v.copy(up[0]).lerp(up[1], 0.5) : v.copy(this.perchAt);
      this.birds.forEach((b, i) => { if (up) b.roost.copy(up[i % 2]).add({ x: Math.sin(i * 2.4) * 3.5, y: 0.15, z: Math.cos(i * 1.9) * 5 }); else b.roost.set(this.perchAt.x + Math.sin(i * 2.4) * 5, 0, this.perchAt.z + Math.cos(i * 1.9) * 5).setY(low(b.roost.x, b.roost.z) + 0.15); });
      if (this.air <= 0 && ((st.worm !== null && st.worm < 420) || this.birds.some((b) => b.roost.distanceToSquared(p) < 64))) { this.air = 13; ev.push({ type: 'flock', at: mid.clone() }); }
      this.air = Math.max(0, this.air - dt);
      const k = clamp(Math.min((13 - this.air) / 1.6, this.air / 2.6), 0, 1), e = this.air > 0 ? k * k * (3 - 2 * k) : 0, cx = mid.x, cy = mid.y, cz = mid.z;
      for (const b of this.birds) {
        const a = b.ph + t * b.sp, flap = e > 0.02 ? Math.sin(t * 13 + b.ph * 3) * 0.75 : -1.15;
        b.g.position.set(b.roost.x + (cx + Math.cos(a) * b.r - b.roost.x) * e, b.roost.y + (cy + b.h + Math.sin(t * 0.8 + b.ph) * 2 - b.roost.y) * e, b.roost.z + (cz + Math.sin(a) * b.r - b.roost.z) * e);
        b.g.rotation.y = e > 0.02 ? -a + (b.sp > 0 ? 0 : Math.PI) : b.ph; b.w[0].rotation.z = -flap; b.w[1].rotation.z = flap;
      }
    }

    // ---- the caravan: along a round of the far dunes, at a walk
    this.march += dt * 2.2;
    for (const c of this.caravan) { const a = (this.march - c.off) / 520 + 0.9, x = X0 + this.env.land[0] + Math.sin(a) * 520, z = Z0 + this.env.land[1] + Math.cos(a) * 520; c.g.position.set(x, low(x, z) + Math.abs(Math.sin(t * 1.6 + c.off)) * 0.25, z); c.g.rotation.y = a + Math.PI / 2; }
  }
}
