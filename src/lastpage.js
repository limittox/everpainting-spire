import * as THREE from 'three';
import { rimR, surfY } from './world.js';
import { daub, place, Bag, paintify, glowSprite, drawStroke, mulberry32 } from './util.js';
import { PAINTS } from './paint.js';
import { pencilIsland, RUNS, PAPER, GRAPHITE, STONE } from './underpainting.js';
import { GROWS, WARMS } from './seedbed.js';

// The end of the Underpainting. Two more islands, north of the Kiln (ride its warm air to reach them):
//
//   The Overpainted Place   Somebody painted over everything here, thick and muddy. The fourth nature is Cream:
//                           blank. It takes paint back to paper. Wipe the mounds of old paint away and under one of
//                           them is a seed; its vine is the way to the last island.
//   The Blank Page          Four stone wells under a great hand holding a pencil. Each wants one nature: a colour
//                           that runs, one that grows, one that burns, and blank. Fill all four and the hand draws
//                           the sun, and it is morning.

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const MIRE = { x: -6, y: 30, z: 3780, r: 20, ph: 0.7, name: 'The Overpainted Place', pale: true };
const PAGE = { x: 0, y: 34, z: 3696, r: 22, ph: 3.9, name: 'The Blank Page', pale: true };
const BLANK = [4];                                        // Cream
const MUD = ['#6b4a3a', '#7d5a48', '#5a4040', '#84604a', '#4f3c44', '#8a6a58'];
const WELLS = [
  { wants: RUNS, line: 'This well wants a colour that runs.' },
  { wants: GROWS, line: 'This well wants a colour that grows.' },
  { wants: WARMS, line: 'This well wants a colour that burns.' },
  { wants: BLANK, line: 'This well is full of old paint. It wants taking away.' },
];

export class LastPage {
  constructor(scene, world, uTime, under, seedbed) {
    this.scene = scene; this.under = under;
    const bag = new Bag(), add = (g, pal, o) => bag.add(daub(g, pal, o)), r = mulberry32(4099);
    const on = (isl, ox, oz) => new V3(isl.x + ox, surfY(isl, isl.x + ox, isl.z + oz), isl.z + oz);
    const mire = pencilIsland(scene, world, bag, MIRE, 1024, 2301).isl, page = pencilIsland(scene, world, bag, PAGE, 2048, 2302).isl;

    // --- the Overpainted Place: old paint over the whole ground, and heaped up in mounds
    {
      const cv = mire.tex.image, x = cv.getContext('2d'), px = cv.width / mire.span;
      for (let i = 0; i < 520; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * mire.r * 1.1, u = (Math.cos(a) * d / mire.span + 0.5) * cv.width, v = (Math.sin(a) * d / mire.span + 0.5) * cv.width;
        drawStroke(x, u, v, r() * TAU, (1.6 + r() * 2.6) * px, (0.6 + r() * 0.9) * px, MUD[i % MUD.length], '#93705c', '#3f3038', r);
      }
    }
    const mudMat = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x120c0c }), { scale: 0.8 });
    this.mounds = [[3, -12], [6, 4], [-12, 2], [2, 12]].map(([ox, oz], i) => {
      const p = on(mire, ox, oz), m = new THREE.Mesh(daub(new THREE.IcosahedronGeometry(1, 2).scale(2.7, 1.25, 2.4), MUD, { scale: 0.6, spread: 1 }), mudMat);
      m.position.copy(p); m.rotation.y = i * 1.3;
      scene.add(m);
      const col = { x: p.x, z: p.z, r: 2.1, late: true };
      world.colliders.push(col);
      return { pos: p, mesh: m, col, gone: false, k: 1, top: new V3(p.x, p.y + 1.2, p.z) };
    });
    // under the first mound, a seed; its vine goes over to the Blank Page once the mound is wiped away
    {
      const a = new V3(MIRE.x, 0, MIRE.z - rimR(MIRE, Math.PI * 1.5)), b = new V3(PAGE.x, 0, PAGE.z + rimR(PAGE, Math.PI / 2));
      const pt = (isl, z, lift) => new V3(isl.x, surfY(isl, isl.x, z) + lift, z);
      const curve = new THREE.CatmullRomCurve3([pt(MIRE, a.z + 6.5, 0.12), pt(MIRE, a.z + 1.3, 0.14), new V3(-3, 34.5, (a.z + b.z) / 2), pt(PAGE, b.z - 1.3, 0.14), pt(PAGE, b.z - 6.5, 0.12)]);
      this.vine = seedbed.makeVine(curve.getSpacedPoints(56), 1.7, 5);
      seedbed.makeSeed(this.mounds[0].pos.clone(), this.vine, 'There was a seed under the old paint. It wants a colour that grows.', () => this.mounds[0].gone);
    }

    // --- the Blank Page: four wells round the middle
    const wellMat = () => new THREE.MeshBasicMaterial({ color: 0x77758a, fog: false });
    this.wells = WELLS.map((def, i) => {
      const a = i * (Math.PI / 2) + Math.PI / 4, p = on(page, Math.cos(a) * 9, Math.sin(a) * 9);
      add(place(new THREE.TorusGeometry(1.5, 0.26, 5, 20), p.x, p.y + 0.2, p.z, Math.PI / 2, 0, 0), STONE, { scale: 0.8 });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20).rotateX(-Math.PI / 2), wellMat());
      disc.position.set(p.x, p.y + 0.24, p.z);
      if (def.wants === BLANK) disc.material.color.set(MUD[0]);
      const glow = glowSprite(world.glowTex, 5, 0xffffff, 0); glow.position.set(p.x, p.y + 1.2, p.z);
      scene.add(disc, glow);
      return { ...def, pos: p, disc, glow, hex: null, done: false, top: new V3(p.x, p.y + 0.9, p.z) };
    });

    // --- the hand that drew all this, its pencil just off the page; and the sun it has not drawn yet
    {
      const tip = on(page, 0, 0); tip.y += 5;
      const hb = new Bag(), put = (g, pal, o) => hb.add(daub(g, pal, o));
      put(place(new THREE.ConeGeometry(1.5, 5, 6, 1), 0, 2.5, 0, Math.PI, 0, 0), ['#e9dcc2', '#dccfb4', '#4a4854'], { scale: 0.3 });
      put(place(new THREE.CylinderGeometry(1.5, 1.5, 52, 6, 6), 0, 31, 0), ['#d8d2c2', '#cfc8b6', '#e4dece'], { scale: 0.05, stretch: [1, 0.1, 1] });
      put(place(new THREE.BoxGeometry(10, 8, 6), 1.5, 26, -2.4), PAPER, { scale: 0.2 });                        // the palm
      for (let k = 0; k < 4; k++) put(place(new THREE.CylinderGeometry(1.15, 1.0, 8, 7), -1 + k * 0.3, 21.5 + k * 2.4, 1.6, 0, 0, Math.PI / 2 - 0.25), PAPER, { scale: 0.3 });   // fingers, wrapped round
      put(place(new THREE.CylinderGeometry(1.3, 1.1, 7, 7), -3.4, 27, -0.6, 0.5, 0, 0.9), PAPER, { scale: 0.3 });   // the thumb
      put(place(new THREE.CylinderGeometry(4.6, 6.2, 70, 9, 4), 9, 62, -12, -0.32, 0, -0.26), [...PAPER, ...STONE], { scale: 0.06, stretch: [1, 0.15, 1] });   // the arm, going up into the white
      const hand = hb.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2a2930 }), { scale: 6 }));
      hand.position.copy(tip); hand.rotation.set(0.2, 0.4, 0.3);
      scene.add(hand);
      this.hand = hand; this.handY = tip.y;
      const sun = new THREE.Mesh(new THREE.TorusGeometry(15, 0.9, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd27a).multiplyScalar(1.6), fog: false }));
      sun.position.set(PAGE.x, PAGE.y + 26, PAGE.z - 44); sun.visible = false;
      this.sunGlow = glowSprite(world.glowTex, 70, 0xffdc9a, 0); this.sunGlow.position.copy(sun.position);
      scene.add(sun, this.sunGlow);
      this.sun = sun; this.sunK = 0;
    }
    for (const [a, rad] of [[0.3, 16], [2.0, 17.5], [3.6, 15.5], [5.0, 17]]) { const p = on(page, Math.cos(a) * rad, Math.sin(a) * rad); add(place(new THREE.BoxGeometry(0.7, 1.9, 0.5), p.x, p.y + 0.85, p.z, 0.06, a, 0.08), STONE, { scale: 0.9 }); }

    this.mesh = bag.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x18171c }), { scale: 1.1, amp: 0.5 }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    world.paintable.push(this.mesh);
    this.done = false;
  }

  /** The seed under the old paint has been uncovered. */
  get cleared() { return this.mounds[0].gone; }

  setWell(w, hex) {
    const i = PAINTS.findIndex((p) => p.hex === hex), right = w.wants.includes(i);
    w.hex = hex;
    w.disc.material.color.set(hex).multiplyScalar(right ? 1.3 : 0.85);
    w.done = right;
    if (this.wells.every((q) => q.done)) this.done = true;
    return right;
  }

  /** A swing of the brush landing at (x, z), from a painter standing at `p`. Returns what it did. */
  strike(x, z, p, hex) {
    const out = [];
    if (!this.under.contains(p)) return out;
    const blank = BLANK.includes(PAINTS.findIndex((q) => q.hex === hex));
    const hit = (q, reach = 3.6) => Math.abs(q.y - p.y) < 3 && ((q.x - x) ** 2 + (q.z - z) ** 2 < reach * reach || (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 3 * 3);
    for (const m of this.mounds) {
      if (m.gone || !hit(m.pos, 4)) continue;
      if (blank) { m.gone = true; out.push({ type: 'wipe', at: m.top, seed: m === this.mounds[0] }); } else out.push({ type: 'smear', at: m.top });
    }
    const was = this.done;
    for (const w of this.wells) {
      if (w.hex === hex || !hit(w.pos, 3.2)) continue;
      out.push({ type: this.setWell(w, hex) ? 'well' : 'wrong', at: w.top, line: w.line });
    }
    if (this.done && !was) out.push({ type: 'dawn', at: new V3(PAGE.x, PAGE.y + 3, PAGE.z) });
    return out;
  }

  /** Something here the painter is standing by and has not dealt with: a line to say about it, with a key for saying it once. */
  waiting(p) {
    for (const m of this.mounds) if (!m.gone && m.pos.distanceTo(p) < 7) return { key: 'mud', line: 'Old paint, laid on thick. Cream takes paint back to paper.' };
    for (const [i, w] of this.wells.entries()) if (!w.done && w.pos.distanceTo(p) < 4.5) return { key: 'well' + i, line: w.line };
    return null;
  }

  save() { return { mounds: this.mounds.map((m) => (m.gone ? 1 : 0)), wells: this.wells.map((w) => w.hex || 0) }; }
  load(d) {
    if (!d) return;
    (d.mounds || []).forEach((g, i) => { const m = this.mounds[i]; if (g && m) { m.gone = true; m.k = 0; m.mesh.visible = false; } });
    (d.wells || []).forEach((h, i) => { if (typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) && this.wells[i]) this.setWell(this.wells[i], h); });
    if (this.done) this.sunK = 1;
  }

  update(dt, t) {
    for (const m of this.mounds) {
      if (m.gone) m.col.r = -1;                             // nothing left to walk into
      if (!m.gone || m.k <= 0) continue;
      m.k = Math.max(0, m.k - dt / 0.6);                    // wiped: it thins away to nothing
      m.mesh.scale.set(1 + (1 - m.k) * 0.5, m.k, 1 + (1 - m.k) * 0.5); m.mesh.visible = m.k > 0;
    }
    for (const w of this.wells) w.glow.material.opacity += ((w.done ? 0.5 + Math.sin(t * 2 + w.pos.x) * 0.1 : 0) - w.glow.material.opacity) * (1 - Math.exp(-3 * dt));
    // the last thing: the hand lifts away and the sun is drawn in
    this.sunK = this.done ? Math.min(1, this.sunK + dt / 5) : 0;
    const e = this.sunK * this.sunK * (3 - 2 * this.sunK);
    this.sun.visible = this.sunK > 0; this.sun.scale.setScalar(0.05 + 0.95 * e);
    this.sunGlow.material.opacity = e * 0.6;
    this.hand.position.y = this.handY + e * 26 + Math.sin(t * 0.5) * 0.4;
  }
}
