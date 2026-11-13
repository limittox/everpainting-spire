import * as THREE from 'three';
import { PAL, daub, place, Bag, paintify, glowSprite, mulberry32, fbm } from './util.js';
import { PAINTS } from './paint.js';

// Inside the Spire. Once the last stroke is laid the door stands open, and behind it is the atelier: a round hall
// far bigger than the tower that holds it, lit by windows of coloured glass, where every view painted at the
// easels hangs on the wall. A column of light in the middle lifts the painter to the crow's nest, a small deck
// around the very top of the real Spire, with one last easel looking back over everything.
//
// The hall is its own enclosed space set high above the world (stepping through the door is a cut through white),
// so it needs its own floor, its own walls to keep the painter and the camera in, and nothing else.

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const C = { x: 0, y: 600, z: -520 };          // the middle of the hall's floor
const R = 17, WALL = 22, CONE = 15;           // radius, height of the wall, height of the vault above it
const NEST_IN = 3.4, NEST_OUT = 7.3;          // the crow's nest is a ring of deck around the main tower

const FLOOR = ['#f6e6d0', '#f2c8c8', '#e8d0f0', '#ffe2a8', '#f0b8a0', '#d8c0ec', '#fff4e2'];
const PLUM = ['#7a4cc0', '#9a5fd0', '#b765c9', '#6b3fa0', '#c85ab8'];
const NIGHT = ['#2e3a90', '#3a50b8', '#5a78e0', '#7a58d0', '#4a2c7a'];
const POT = ['#6a4038', '#8a5a48', '#52303a', '#7a4a3c'];

// a point in the hall: `a` is the angle round from the door (0 = the door, on the south side), `r` the distance out
const at = (a, r, y = 0) => new V3(C.x + Math.sin(a) * r, C.y + y, C.z + Math.cos(a) * r);
function arch(half, straight) {
  const sh = new THREE.Shape();
  sh.moveTo(-half, 0); sh.lineTo(-half, straight); sh.absarc(0, straight, half, Math.PI, 0, true); sh.lineTo(half, 0); sh.closePath();
  return sh;
}

export class Interior {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    const rnd = mulberry32(8123);
    const bag = new Bag(), glass = new Bag(), stars = new Bag();
    const add = (g, pal, o) => bag.add(daub(g, pal, o));
    const facing = (a) => a + Math.PI;                    // turn something on the wall to face the middle

    // ------------------------------------------------------------ the hall
    add(place(new THREE.RingGeometry(0.01, R + 0.4, 72, 22).rotateX(-Math.PI / 2), C.x, C.y, C.z), FLOOR, {
      fn: (x, y, z, out, cols) => {
        // a great wheel of strokes: rings of wedges, each a little out of step with the last
        const dx = x - C.x, dz = z - C.z, r = Math.hypot(dx, dz), band = Math.floor(r / 2.4), wedge = Math.floor((Math.atan2(dz, dx) / TAU + 0.5) * (6 + band * 4) + band * 0.5);
        const n = fbm(x * 0.35, 3.1, z * 0.35);
        return out.copy(cols[(band * 3 + wedge * 2 + Math.floor(n * 2.2)) % cols.length]);
      },
    });
    add(place(new THREE.CylinderGeometry(R, R, WALL, 64, 8, true), C.x, C.y + WALL / 2, C.z), PAL.castle, { scale: 0.25, stretch: [1, 0.25, 1], spread: 0.6 });
    add(place(new THREE.CylinderGeometry(R - 0.12, R - 0.12, 3.2, 64, 2, true), C.x, C.y + 1.6, C.z), PLUM, { scale: 0.3, stretch: [1, 0.3, 1] });
    add(place(new THREE.TorusGeometry(R - 0.15, 0.14, 5, 64), C.x, C.y + 3.25, C.z, Math.PI / 2, 0, 0), PAL.gold);
    add(place(new THREE.TorusGeometry(R - 0.1, 0.4, 6, 64), C.x, C.y + WALL, C.z, Math.PI / 2, 0, 0), PAL.gold);
    add(place(new THREE.ConeGeometry(R, CONE, 64, 6, true), C.x, C.y + WALL + CONE / 2, C.z), NIGHT, { scale: 0.2, spread: 0.8 });
    for (let k = 0; k < 16; k++) {
      const a = (Math.floor(k / 2) + (k % 2 ? 0.75 : 0.25)) * (Math.PI / 4), p = at(a, R - 0.3, WALL / 2);
      add(place(new THREE.BoxGeometry(0.9, WALL, 0.5), p.x, p.y, p.z, 0, a, 0), PAL.stone, { scale: 0.4, stretch: [1, 0.3, 1] });
      const cap = at(a, R - 0.4, WALL - 1.2);
      add(place(new THREE.BoxGeometry(1.3, 0.5, 0.8), cap.x, cap.y, cap.z, 0, a, 0), PAL.gold);
    }

    // eight tall windows of coloured glass, one for each paint the painter set out with
    for (let k = 0; k < 8; k++) {
      const a = (k + 0.5) * (Math.PI / 4), col = new THREE.Color(PAINTS[k].hex);
      const tones = [0, 0.1, -0.1, 0.05, -0.16].map((l) => '#' + col.clone().offsetHSL(0, 0, l).getHexString());
      const p = at(a, R - 0.22, 4.4);
      glass.add(daub(place(new THREE.PlaneGeometry(2.3, 7.6, 3, 12), p.x, p.y + 3.8, p.z, 0, facing(a), 0), tones, { scale: 0.9, spread: 1 }));
      glass.add(daub(place(new THREE.CircleGeometry(1.15, 12, 0, Math.PI), p.x, p.y + 7.6, p.z, 0, facing(a), 0), tones, { scale: 0.9, spread: 1 }));
      const f = at(a, R - 0.3, 4.4);
      add(place(new THREE.TorusGeometry(1.3, 0.13, 5, 14, Math.PI), f.x, f.y + 7.6, f.z, 0, facing(a), 0), PAL.gold);
      for (const s of [-1, 1]) {
        const q = at(a + (s * 1.3) / (R - 0.3), R - 0.3, 4.4 + 3.8);
        add(place(new THREE.BoxGeometry(0.2, 7.8, 0.2), q.x, q.y, q.z, 0, a, 0), PAL.gold);
      }
      const sill = at(a, R - 0.45, 4.3);
      add(place(new THREE.BoxGeometry(3.0, 0.24, 0.7), sill.x, sill.y, sill.z, 0, a, 0), PAL.stone);
    }

    // the vault is a painted night, with stars of thick gold
    for (let k = 0; k < 54; k++) {
      const h = 0.06 + rnd() * 0.86, a = rnd() * TAU, r = R * (1 - h) - 0.25, s = 0.1 + rnd() * rnd() * 0.3;
      const p = at(a, r, WALL + h * CONE);
      stars.add(daub(place(new THREE.IcosahedronGeometry(s, 0), p.x, p.y, p.z, rnd(), rnd(), 0), ['#fff0c0', '#ffe08a', '#ffffff']));
    }

    // frames for the five paintings: two to the left, two to the right, the largest facing the door
    this.slots = [6, 5, 4, 3, 2].map((k) => {
      const crown = k === 4, w = crown ? 6.6 : 4.8, h = crown ? 4.4 : 3.2, y = crown ? 7.4 : 6.3, a = k * (Math.PI / 4);
      const p = at(a, R - 0.34, y);
      add(place(new THREE.BoxGeometry(w + 0.6, h + 0.6, 0.22), p.x, p.y, p.z, 0, a, 0), crown ? PAL.gold : ['#6a4038', '#8a5a48', '#52303a', '#a06a3a'], { scale: 0.8 });
      return { crown, w, h, a, pos: at(a, R - 0.5, y) };
    });

    // jars of paint and spare canvases, pushed back against the wall on either side of the door
    for (const side of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const a = side * (0.5 + k * 0.105 + rnd() * 0.03), r = R - 1.6 - (k % 2) * 1.3 - rnd() * 0.4, s = 0.7 + rnd() * 0.7, p = at(a, r);
        const col = new THREE.Color(PAINTS[(k * 3 + (side > 0 ? 1 : 4)) % 8].hex), tones = [0, 0.1, -0.1].map((l) => '#' + col.clone().offsetHSL(0, 0, l).getHexString());
        add(place(new THREE.CylinderGeometry(0.62 * s, 0.5 * s, 1.1 * s, 10), p.x, p.y + 0.55 * s, p.z), POT, { scale: 0.8 });
        add(place(new THREE.CylinderGeometry(0.56 * s, 0.56 * s, 0.08, 10), p.x, p.y + 1.1 * s, p.z), tones, { spread: 1 });
        add(place(new THREE.TorusGeometry(0.62 * s, 0.07 * s, 5, 12), p.x, p.y + 1.1 * s, p.z, Math.PI / 2, 0, 0), tones, { spread: 1 });
        world.colliders.push({ x: p.x, z: p.z, r: 0.62 * s, late: true });
      }
      for (let k = 0; k < 2; k++) {
        const a = side * (1.02 + k * 0.17), p = at(a, R - 0.95, 1.55);
        add(place(new THREE.BoxGeometry(2.3, 3.1, 0.12), p.x, p.y, p.z, 0.2, facing(a), 0.04 * side), ['#f6ecd8', '#efe0c4', '#fff6e6'], { scale: 0.6 });
      }
    }
    // the way back out: the same door of light, seen from the other side
    {
      const p = at(0, R - 0.3);
      add(place(new THREE.TorusGeometry(2.75, 0.42, 6, 14, Math.PI), p.x, p.y + 5.2, p.z, 0, Math.PI, 0), PAL.gold);
      for (const s of [-1, 1]) add(place(new THREE.BoxGeometry(0.8, 5.4, 0.8), p.x + s * 2.75, p.y + 2.6, p.z), PAL.gold);
    }

    const hallMat = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x4a3c40 }), { scale: 1.2 });
    this.mesh = bag.mesh(hallMat);
    this.mesh.frustumCulled = false;
    const bright = (k) => new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(k, k, k), side: THREE.DoubleSide, fog: false });
    const glassMesh = glass.mesh(bright(1.5)), starMesh = stars.mesh(bright(1.7));
    const lamp = new THREE.PointLight(0xffdcb0, 320, 80, 1.7);
    lamp.position.set(C.x, C.y + 11, C.z);
    scene.add(this.mesh, glassMesh, starMesh, lamp);
    world.paintable.push(this.mesh);                    // the walls, the floor, the jars: all of it takes paint

    const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff3c2).multiplyScalar(1.7), fog: false, side: THREE.DoubleSide });
    const door = new THREE.Mesh(new THREE.ShapeGeometry(arch(2.35, 5.2), 12), hot);
    door.position.copy(at(0, R - 0.24, 0.05)); door.rotation.y = Math.PI;
    this.doorHalo = glowSprite(world.glowTex, 13, 0xffd890, 0.7); this.doorHalo.position.copy(at(0, R - 1, 4));
    const oculus = new THREE.Mesh(new THREE.CircleGeometry(1.7, 20).rotateX(Math.PI / 2), hot);
    oculus.position.set(C.x, C.y + WALL + CONE * 0.9, C.z);
    // the column of light that lifts the painter out through the top of the vault
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.1, WALL + CONE * 0.9, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.beam.position.set(C.x, C.y + (WALL + CONE * 0.9) / 2, C.z);
    const inlay = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.11, 6, 44).rotateX(Math.PI / 2), hot);
    inlay.position.set(C.x, C.y + 0.06, C.z);
    this.pool = glowSprite(world.glowTex, 9, 0xffe2a8, 0.55); this.pool.position.set(C.x, C.y + 1.2, C.z);
    const crownGlow = glowSprite(world.glowTex, 16, 0xffe9c0, 0.6); crownGlow.position.set(C.x, C.y + WALL + CONE * 0.86, C.z);
    scene.add(door, this.doorHalo, oculus, this.beam, inlay, this.pool, crownGlow);

    // ------------------------------------------------------------ the crow's nest, on the real Spire
    const N = world.castlePos, ny = world.towerTop + 1.4;
    {
      const nb = new Bag(), put = (g, pal, o) => nb.add(daub(g, pal, o));
      put(place(new THREE.ConeGeometry(NEST_OUT + 0.1, 6.2, 26, 2, true), N.x, ny - 3.8, N.z, Math.PI, 0, 0), PAL.castle, { scale: 0.3, spread: 0.6 });
      put(place(new THREE.CylinderGeometry(NEST_OUT + 0.1, NEST_OUT + 0.1, 0.7, 30), N.x, ny - 0.35, N.z), PAL.stone, { scale: 0.4 });
      put(place(new THREE.TorusGeometry(NEST_OUT + 0.1, 0.17, 5, 40), N.x, ny + 0.04, N.z, Math.PI / 2, 0, 0), PAL.gold);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * TAU + 0.22, x = N.x + Math.sin(a) * (NEST_OUT - 0.15), z = N.z + Math.cos(a) * (NEST_OUT - 0.15);
        put(place(new THREE.CylinderGeometry(0.07, 0.09, 0.95, 5), x, ny + 0.47, z), PAL.stone);
        put(place(new THREE.IcosahedronGeometry(0.15, 0), x, ny + 1.02, z), PAL.gold);
      }
      const nest = nb.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x3a2c30 }), { scale: 1.4 }));
      scene.add(nest);
      world.paintable.push(nest);
    }

    // ------------------------------------------------------------ ground: the hall's floor and the nest's deck
    const base = world.groundHeight, in2 = NEST_IN * NEST_IN, out2 = NEST_OUT * NEST_OUT, hall2 = (R + 0.3) ** 2;
    world.groundHeight = (x, z, maxY) => {
      let best = base(x, z, maxY);
      if (maxY >= C.y && (x - C.x) ** 2 + (z - C.z) ** 2 < hall2 && C.y > best) best = C.y;
      if (maxY >= ny) { const d2 = (x - N.x) ** 2 + (z - N.z) ** 2; if (d2 > in2 && d2 < out2 && ny > best) best = ny; }
      return best;
    };

    this.center = new V3(C.x, C.y, C.z);
    this.entry = at(0, R - 9.2);                      // where the painter stands on stepping in: far enough from the door for the camera to fit behind
    this.exit = at(0, R - 1.4);                       // close to the door: near enough to step back out
    this.liftTop = new V3(C.x, C.y + 19, C.z);
    this.nest = { pos: new V3(N.x - 5.2, ny, N.z + 0.6), heading: -0.5, y: ny, center: new V3(N.x, ny, N.z) };
  }

  /** Hang the paintings: each frame shows its easel's own canvas, so a view appears here as it is painted there. */
  hang(spots) {
    const plain = spots.filter((v) => !v.fixed), crown = spots.find((v) => v.fixed), order = [plain[0], plain[1], crown, plain[2], plain[3]];
    this.slots.forEach((s, i) => {
      const v = order[i];
      if (!v) return;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), v.mat);
      m.position.copy(s.pos); m.rotation.y = s.a + Math.PI;
      this.scene.add(m);
      s.spot = v;
    });
  }

  /** Afterwards: every painting the painter made and hung here is scratched through. */
  deface(on) {
    if (!on && !this.scratches) return;
    if (!this.scratches) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 176;
      const x = c.getContext('2d');
      let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      x.strokeStyle = '#0c0a10'; x.lineCap = x.lineJoin = 'round';
      for (let i = 0; i < 16; i++) { x.lineWidth = 3 + r() * 6; x.beginPath(); x.moveTo(r() * 256, r() * 176); for (let k = 0; k < 3; k++) x.lineTo(r() * 256, r() * 176); x.stroke(); }
      const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, fog: false });
      this.scratches = this.slots.filter((s) => s.spot).map((s) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat), n = Math.hypot(C.x - s.pos.x, C.z - s.pos.z) || 1;
        m.position.set(s.pos.x + ((C.x - s.pos.x) / n) * 0.06, s.pos.y, s.pos.z + ((C.z - s.pos.z) / n) * 0.06); m.rotation.y = s.a + Math.PI;
        this.scene.add(m);
        return m;
      });
    }
    for (const m of this.scratches) m.visible = on;
  }

  inside(p) { return p.y > C.y - 6; }

  /** Keep the painter within the walls. */
  contain(p) {
    const dx = p.x - C.x, dz = p.z - C.z, d = Math.hypot(dx, dz), lim = R - 0.8;
    if (d > lim) { p.x = C.x + (dx / d) * lim; p.z = C.z + (dz / d) * lim; }
  }
  /** Keep the camera inside the hall too, under the slope of the vault. */
  clampCamera(p) {
    if (!this.inside(p)) return;
    const dx = p.x - C.x, dz = p.z - C.z, lim = R - 1.1;
    let d = Math.hypot(dx, dz);
    if (d > lim) { p.x = C.x + (dx / d) * lim; p.z = C.z + (dz / d) * lim; d = lim; }
    p.y = Math.min(p.y, C.y + WALL + CONE * (1 - d / R) - 1.2);
  }

  /** The framed painting the painter is standing in front of, if any. */
  facing(p) {
    for (const s of this.slots) if (s.spot && (s.pos.x - p.x) ** 2 + (s.pos.z - p.z) ** 2 < 20) return s.spot;
    return null;
  }

  update(t) {
    this.beam.material.opacity = 0.17 + Math.sin(t * 1.3) * 0.04;
    this.beam.rotation.y = t * 0.2;
    this.pool.material.opacity = 0.5 + Math.sin(t * 1.7) * 0.1;
    this.doorHalo.scale.setScalar(13 * (1 + Math.sin(t * 2.1) * 0.06));
  }
}
