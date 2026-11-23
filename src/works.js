import * as THREE from 'three';
import { daub, place, Bag, paintify, glowSprite, clamp } from './util.js';

// The inside of the one that wakes (see dunes.js): a shaft of brass and iron, as deep as it is tall, with everything in
// it turning. The painter comes in at its ear, onto a ledge at the top, and goes down a winding stair of gear-wheels,
// each lower than the last and each turning under their feet, round the great axle that everything hangs from. At the
// bottom hangs its heart, the one thing in here that is not moving and has no colour. Painted red, it beats; everything
// turns faster; the round door in its chest opens (the blue circle, seen from behind), and the painter is put out
// through it. Falling in here is not failing either: whoever drops too far is carried back to the wheel they left.
//
// And there are other ways about: a lift on a great rod between the floor and one of the wheels, and a column of steam
// by the ledge at the top that carries an open cloak the whole height of the place.
//
// It is nowhere near the desert it is entered from (far east of it), so that nothing out there is in its way or it in theirs.

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const R = 24, TOP = 14, FLOOR = -60, HEART = -55.4, COGS = 11, COG_R = 5.6, RING = 13;
// Two wheels that touch really do drive one another here: their teeth are the same size, they stand as far apart as lets
// a tooth of one into a gap of the other, and the driven one is turned from the driver (so many teeth past, so many
// teeth on), never on its own. PIN is the small wheel that drives each wheel of the stair; MESH, how far apart two
// wheels of radii r and s stand; and 'driven', where the second must be when the first is at 'turn' (both lying in the
// same plane, the second off towards 'way' from the first, the first with n teeth and the second with m).
const PIN = 5, PIN_R = (COG_R * PIN) / 16, MESH = (r, s) => r + s + 0.875 + 0.3;
const driven = (turn, way, n, m) => -(way + Math.PI - Math.PI / m + (way + turn) * (n / m));
const BRASS = ['#b8893a', '#a67a30', '#c99a48', '#8f6a2a', '#d4a850'], IRON = ['#4a4038', '#3c342e', '#584c42', '#332c28'];
const COPPER = ['#b4603a', '#9c5230', '#c87246', '#8a4628'], PLATE = ['#6a5a44', '#5c4e3c', '#786850', '#4e4234'], GILT = ['#e0b860', '#c99a3e', '#f0cc78'];
const smooth = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
/** Is this colour a red? (Rose, ember, any of them: more red in it than anything else, by a good way.) */
const isRed = (hex) => { const c = new THREE.Color(hex); return c.r > 0.5 && c.r > c.g * 1.7 && c.r > c.b * 1.35; };

export class Works {
  /** `C` is the middle of the shaft, at the height of the ledge the painter comes in on. `decks` is what the ground is asked for there. */
  constructor(scene, world, decks, C) {
    this.C = C; this.painted = false; this.red = 0; this.since = 0; this.fast = 1; this.shown = false;
    this.safe = new V3(); this.ph = 0; this._v = new V3();
    const metal = () => paintify(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x5c4222, side: THREE.DoubleSide, fog: false }), { scale: 1.1, amp: 0.5 });
    const root = (this.root = new THREE.Group()); root.position.copy(C); root.visible = false; scene.add(root);
    const fixed = new Bag(), add = (g, pal = BRASS, o = { scale: 0.3, spread: 0.7 }) => fixed.add(daub(g, pal, o));
    const box = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
    const cyl = (r0, r1, h, n, x, y, z, rx = 0, ry = 0, rz = 0) => place(new THREE.CylinderGeometry(r0, r1, h, n), x, y, z, rx, ry, rz);
    /** A bolt-head on the wall at angle `a`, height `y`: six-sided, pointing in. */
    const bolt = (a, y, r = R - 0.75, s = 0.34) => add(cyl(s, s, 0.55, 6, Math.cos(a) * r, y, Math.sin(a) * r, 0, -a, Math.PI / 2), GILT);
    const lamp = (x, y, z, size = 7, color = 0xffb060, op = 0.75) => { const q = glowSprite(world.glowTex, size, color, op); q.position.set(x, y, z); root.add(q); return q; };
    const mesh = (bag) => { const m = bag.mesh(metal()); m.frustumCulled = false; return m; };

    // ---- the shaft: plates, hoops, girders with their bolts, pipes with their flanges
    // (its plates are only seen from inside: an eye that has backed out through the wall looks in through it)
    { const b = new Bag(); b.add(daub(place(new THREE.CylinderGeometry(R + 0.6, R + 0.6, TOP - FLOOR + 2, 24, 6, true), 0, (TOP + FLOOR) / 2, 0), PLATE, { scale: 0.16, spread: 0.9 })); b.add(daub(place(new THREE.CylinderGeometry(7, R + 0.6, 7, 24, 1, true), 0, TOP + 4.4, 0), PLATE, { scale: 0.16, spread: 0.9 })); const m = b.mesh(metal()); m.material.side = THREE.BackSide; m.frustumCulled = false; root.add(m); }
    add(cyl(R + 0.6, R + 0.6, 1, 24, 0, FLOOR - 0.5, 0), PLATE); add(cyl(7, 7, 0.6, 16, 0, TOP + 7.8, 0), IRON);
    for (const y of [9, -4, -17, -30, -43, -56]) add(place(new THREE.TorusGeometry(R + 0.1, 0.55, 6, 48), 0, y, 0, Math.PI / 2), BRASS);
    for (let k = 0; k < 8; k++) {
      const a = (k + 0.5) * (TAU / 8);
      add(box(1.0, TOP - FLOOR, 1.5, Math.cos(a) * (R - 0.2), (TOP + FLOOR) / 2, Math.sin(a) * (R - 0.2), 0, -a), IRON);
      for (let y = TOP - 3; y > FLOOR; y -= 6.5) for (const s of [-0.03, 0.03]) bolt(a + s, y);
      const b = a + TAU / 16, pr = R - 1.2;          // (and between each pair of girders a pipe, or two)
      if (k % 4 !== 0) { add(cyl(0.55, 0.55, TOP - FLOOR, 8, Math.cos(b) * pr, (TOP + FLOOR) / 2, Math.sin(b) * pr), COPPER); for (let y = TOP - 6; y > FLOOR; y -= 9) add(cyl(0.9, 0.9, 0.4, 8, Math.cos(b) * pr, y, Math.sin(b) * pr), BRASS); }
    }
    // ---- the ledge the painter comes in on, with the way out behind it (the ear, from inside: the night shows through)
    add(box(11.5, 0.6, 6, -18.4, -0.3, 0), BRASS); for (const z of [-2.9, 2.9]) { add(box(11.5, 0.2, 0.2, -18.4, 1.1, z), IRON); for (const x of [-13, -16.5, -20, -23.5]) add(box(0.2, 1.3, 0.2, x, 0.45, z), IRON); }
    for (const z of [-1.7, 1.7]) add(box(0.7, 4.2, 0.7, -R + 0.3, 2.1, z), GILT); add(box(0.7, 0.7, 4.1, -R + 0.3, 4.4, 0), GILT);
    const night = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 4.2), new THREE.MeshBasicMaterial({ color: 0x2a2f6a, fog: false })); night.position.set(-R + 0.1, 2.1, 0); night.rotation.y = Math.PI / 2; root.add(night);
    lamp(-R + 1.2, 2.4, 0, 6, 0x8f9cff, 0.6); lamp(-13, 1.6, 2.9, 2.6, 0xffb060, 0.6); lamp(-13, 1.6, -2.9, 2.6, 0xffb060, 0.6);
    decks.push((x, z) => { const dx = x - C.x, dz = z - C.z; return dx > -R && dx < -12.6 && Math.abs(dz) < 3 ? C.y : null; });

    // ---- the stair of wheels: each a little lower and further round, each turning the other way from the last
    /** A gear-wheel lying flat, its top at y = 0: a disc, teeth, a hub, bolts and grooves on its face. */
    const gear = (r, teeth, thick = 0.9, face = true) => {
      const b = new Bag(), put = (g, pal = BRASS) => b.add(daub(g, pal, { scale: 0.3, spread: 0.7 }));
      put(cyl(r, r, thick, 28, 0, -thick / 2, 0)); put(cyl(r * 0.24, r * 0.24, thick + 0.5, 12, 0, -thick / 2 + 0.05, 0), IRON);
      for (let i = 0; i < teeth; i++) { const a = (i / teeth) * TAU; put(box(0.95, thick, (TAU * r) / teeth * 0.5, Math.cos(a) * (r + 0.4), -thick / 2, Math.sin(a) * (r + 0.4), 0, -a)); }
      if (face) for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; put(cyl(0.3, 0.3, 0.3, 6, Math.cos(a) * r * 0.62, 0.1, Math.sin(a) * r * 0.62), GILT); put(box(r * 0.5, 0.07, 0.16, Math.cos(a + 0.52) * r * 0.6, 0.02, Math.sin(a + 0.52) * r * 0.6, 0, -(a + 0.52)), IRON); }
      put(place(new THREE.TorusGeometry(r * 0.86, 0.12, 5, 28), 0, 0.03, 0, Math.PI / 2), IRON);
      return b;
    };
    this.cogs = [];
    for (let i = 0; i < COGS; i++) {
      const a = Math.PI + 0.36 + i * 0.84, x = Math.cos(a) * RING, z = Math.sin(a) * RING, y = -5 * (i + 1), m = mesh(gear(COG_R, 16));
      // (and the little wheel that drives it, out on its arm by the wall, tooth in gap: it can be stood on as well)
      const pr = RING + MESH(COG_R, PIN_R), px = Math.cos(a) * pr, pz = Math.sin(a) * pr, pin = mesh(gear(PIN_R, PIN, 0.9, false));
      pin.position.set(px, y, pz); root.add(pin); add(cyl(0.34, 0.34, 1.3, 8, px, y - 1.0, pz), IRON);
      decks.push((qx, qz) => ((qx - C.x - px) ** 2 + (qz - C.z - pz) ** 2 < (PIN_R + 0.6) ** 2 ? C.y + y : null));
      m.position.set(x, y, z); root.add(m); this.cogs.push({ m, pin, a, x: C.x + x, y: C.y + y, z: C.z + z, w: (i % 2 ? -1 : 1) * 0.32 });
      // (what holds it: an arm out from the wall, under it, and a lamp on the arm)
      add(box(R - RING, 0.5, 0.8, Math.cos(a) * (RING + R) / 2, y - 1.25, Math.sin(a) * (RING + R) / 2, 0, -a), IRON); add(cyl(0.45, 0.45, 1.0, 8, x, y - 1.2, z), IRON);
      lamp(Math.cos(a) * (R - 2.2), y + 1.6, Math.sin(a) * (R - 2.2), 5.5, 0xffb060, 0.7);
      decks.push((px, pz) => ((px - C.x - x) ** 2 + (pz - C.z - z) ** 2 < (COG_R + 0.35) ** 2 ? C.y + y : null));
    }
    // ---- the great axle down the middle, and the wheels on it; it stops over the heart, which hangs from it
    {
      const b = new Bag(); b.add(daub(cyl(1.7, 1.7, TOP + 46, 12, 0, (TOP - 46) / 2, 0), IRON, { scale: 0.3, spread: 0.7 }));
      for (const y of [7, -7.5, -22.5, -37.5, -45.5]) for (const g of gear(5.4, 18, 1.0, false).list) { g.translate(0, y, 0); b.add(g); }
      for (let y = 3; y > -44; y -= 5) b.add(daub(cyl(2.0, 2.0, 0.5, 12, 0, y, 0), BRASS, { scale: 0.3, spread: 0.7 }));
      this.axle = mesh(b); root.add(this.axle);
      world.colliders.push({ x: C.x, z: C.z, r: 1.9, top: C.y + TOP, bottom: C.y - 46.5, late: true });
    }
    // ---- wheels on the wall, turning on edge; and rods that go up and down in their sleeves
    // (in pairs: a great one and a small one beside it in the same plane, the small one turned by the great one. Each is
    // [where round the wall, how high, its teeth, how fast, the small one's teeth, and which way the small one lies from
    // it: 0 is along the wall, a quarter turn is straight up]. Every tooth is two units round, so any two wheels fit.)
    this.wall = [];
    for (const [a, y, n, w, n2, lie] of [[0.9, 2, 13, 0.5, 8, -0.95], [2.5, -12, 15, 0.4, 7, 2.55], [4.0, -9, 11, -0.6, 7, -2.3], [5.3, -22.5, 14, 0.45, 9, -0.95], [0.3, -33, 15, 0.42, 7, -2.2], [2.2, -42.5, 12, -0.55, 8, 2.5], [3.7, -29, 10, 0.6, 7, 0.9]]) {
      const r = (n * 2) / TAU, r2 = (n2 * 2) / TAU, way = a + Math.PI / 2 - lie, d = MESH(r, r2);
      const g = new THREE.Group(), m = mesh(gear(r, n, 0.8)), mate = mesh(gear(r2, n2, 0.8)); mate.position.set(Math.cos(way) * d, 0, Math.sin(way) * d); g.add(m, mate);
      g.position.set(Math.cos(a) * (R - 1.4), y, Math.sin(a) * (R - 1.4)); g.quaternion.setFromUnitVectors(UP, new V3(-Math.cos(a), 0, -Math.sin(a))); root.add(g);
      this.wall.push({ m, w, mate, way, n, n2 });
    }
    this.rods = [];
    for (const [a, y, ph] of [[1.75, -6, 0], [1.95, -6, 2.1], [4.6, -16, 1], [4.8, -16, 3.1], [0.55, -45, 0.5], [3.2, -47, 2.6]]) {
      const x = Math.cos(a) * (R - 2.4), z = Math.sin(a) * (R - 2.4), b = new Bag();
      add(cyl(1.0, 1.0, 5, 10, x, y - 4, z), IRON); add(cyl(1.2, 1.2, 0.4, 10, x, y - 1.6, z), BRASS);
      b.add(daub(cyl(0.42, 0.42, 7, 8, 0, 0, 0), GILT, { scale: 0.4 })); b.add(daub(cyl(1.1, 1.1, 0.7, 10, 0, 3.6, 0), BRASS, { scale: 0.4 }));
      const m = mesh(b); m.position.set(x, y, z); root.add(m); this.rods.push({ m, y, ph });
    }

    // ---- the bottom: a floor of plate, a low round step in the middle, four great pipes, and the heart over the step
    add(cyl(6, 6.7, 0.7, 20, 0, FLOOR + 0.35, 0), BRASS); add(place(new THREE.TorusGeometry(6.2, 0.2, 5, 28), 0, FLOOR + 0.7, 0, Math.PI / 2), GILT);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; add(cyl(0.3, 0.3, 0.3, 6, Math.cos(a) * 5.4, FLOOR + 0.78, Math.sin(a) * 5.4), GILT); }
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * (TAU / 4), m = (R + 3) / 2;
      add(cyl(0.75, 0.75, R - 3, 10, Math.cos(a) * m, HEART + 0.4, Math.sin(a) * m, 0, -a, Math.PI / 2), COPPER);
      for (const d of [6, 12, 18, 23]) add(cyl(1.05, 1.05, 0.45, 10, Math.cos(a) * d, HEART + 0.4, Math.sin(a) * d, 0, -a, Math.PI / 2), BRASS);
      lamp(Math.cos(a) * (R - 2), FLOOR + 5, Math.sin(a) * (R - 2), 6, 0xffa050, 0.6);
    }
    for (let k = 0; k < 3; k++) { const a = k * (TAU / 3) + 0.4; add(cyl(0.12, 0.12, 6.4, 5, Math.cos(a) * 1.5, HEART + 6.1, Math.sin(a) * 1.5, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12), IRON); }
    decks.push((x, z) => { const d2 = (x - C.x) ** 2 + (z - C.z) ** 2; return d2 < 36 ? C.y + FLOOR + 0.7 : d2 < (R + 0.4) ** 2 ? C.y + FLOOR : null; });
    world.colliders.push({ x: C.x, z: C.z, r: 2.5, top: C.y + HEART + 3.4, bottom: C.y + HEART - 3.2, late: true });
    {
      // the heart: cut in faces like everything of this one's, bound in hoops, and the colour of slate until it is given one
      const g = (this.heart = new THREE.Group()), mat = (this.heartMat = new THREE.MeshLambertMaterial({ color: 0x59626c, emissive: 0x0c0e12, flatShading: true, fog: false }));
      const part = (geo) => g.add(new THREE.Mesh(geo, mat));
      part(place(new THREE.IcosahedronGeometry(2.5, 1), 0, -0.2, 0, 0, 0, 0, 1, 1.05, 0.85)); part(place(new THREE.IcosahedronGeometry(1.75, 1), -1.3, 1.45, 0, 0, 0, 0.2, 1, 1, 0.85)); part(place(new THREE.IcosahedronGeometry(1.75, 1), 1.3, 1.45, 0, 0, 0, -0.2, 1, 1, 0.85));
      part(place(new THREE.ConeGeometry(1.9, 2.6, 7), 0, -2.5, 0, Math.PI)); part(cyl(0.5, 0.6, 1.3, 7, -0.9, 3.2, 0, 0, 0, 0.3)); part(cyl(0.45, 0.55, 1.1, 7, 0.8, 3.2, 0.2, 0, 0, -0.35));
      const band = new THREE.MeshLambertMaterial({ color: 0xd0a040, emissive: 0x3a2808, flatShading: true });
      g.add(new THREE.Mesh(place(new THREE.TorusGeometry(2.62, 0.13, 5, 24), 0, -0.2, 0, Math.PI / 2, 0, 0, 1, 0.86, 1), band), new THREE.Mesh(place(new THREE.TorusGeometry(2.7, 0.11, 5, 24), 0, 0.3, 0, 0, 0.5, 0, 0.86, 1, 1), band));
      g.position.set(0, HEART, 0); root.add(g);
      this.glow = lamp(0, HEART, 0, 15, 0x9ab4d0, 0.28); this.heartAt = new V3(C.x, C.y + HEART, C.z);
    }
    // ---- the door in its chest, from behind: a round of blue tile in a ring of gilt, with the sun's rays round it
    {
      const a = 0, x = R - 0.5, y = HEART + 1;
      add(place(new THREE.TorusGeometry(4.9, 0.4, 6, 28), x, y, 0, 0, Math.PI / 2), GILT);
      for (let i = 0; i < 8; i++) { const t = (i / 8) * TAU; add(box(0.3, 1.6, 0.3, x, y + Math.cos(t) * 6.3, Math.sin(t) * 6.3, t), GILT); }
      this.door = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.4, 24).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2e9a9c, emissive: 0x0c3a40, flatShading: true, fog: false }));
      this.door.position.set(x, y, 0); root.add(this.door);
      this.light = new THREE.Mesh(new THREE.CircleGeometry(4.6, 24), new THREE.MeshBasicMaterial({ color: 0xa8f0ff, transparent: true, opacity: 0, fog: false })); this.light.position.set(x + 0.15, y, 0); this.light.rotation.y = -Math.PI / 2; root.add(this.light);
      this.blue = lamp(x - 1, y, 0, 26, 0x7fe0ff, 0); this.doorAt = new V3(C.x + x - 2, C.y + FLOOR, C.z + Math.sin(a));
    }
    // ---- a second way, and a way back up. A great rod with a round plate on it goes up and down between the floor and one
    // of the wheels: it is a lift for whoever stands on the plate. And beside the ledge at the top a column of steam goes
    // up from the floor: whoever jumps into it and opens their cloak is carried up the whole height of the place.
    {
      const a = 3.5, x = Math.cos(a) * 20.5, z = Math.sin(a) * 20.5, b = new Bag();
      b.add(daub(cyl(3, 3, 0.6, 16, 0, -0.3, 0), BRASS, { scale: 0.3, spread: 0.7 })); b.add(daub(cyl(0.9, 0.9, 24, 10, 0, -12.6, 0), GILT, { scale: 0.3 })); b.add(daub(place(new THREE.TorusGeometry(2.7, 0.14, 5, 20), 0, 0.03, 0, Math.PI / 2), IRON, { scale: 0.3 }));
      for (let i = 0; i < 6; i++) b.add(daub(cyl(0.26, 0.26, 0.3, 6, Math.cos(i * 1.047) * 2.1, 0.1, Math.sin(i * 1.047) * 2.1), GILT, { scale: 0.4 }));
      this.lift = { m: mesh(b), x: C.x + x, z: C.z + z, y: FLOOR + 0.2 }; this.lift.m.position.set(x, this.lift.y, z); root.add(this.lift.m);
      add(cyl(1.5, 1.7, 1.2, 12, x, FLOOR + 0.2, z), IRON);
      decks.push((px, pz) => ((px - this.lift.x) ** 2 + (pz - this.lift.z) ** 2 < 9 ? C.y + this.lift.y : null));
      const va = 2.82, vx = Math.cos(va) * 20.6, vz = Math.sin(va) * 20.6;
      add(cyl(2.4, 2.8, 0.5, 14, vx, FLOOR + 0.25, vz), IRON); add(place(new THREE.TorusGeometry(2.3, 0.2, 5, 20), vx, FLOOR + 0.55, vz, Math.PI / 2), GILT);
      this.vent = { x: C.x + vx, z: C.z + vz };
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 3), 3));
      this.steam = new THREE.Points(g, new THREE.PointsMaterial({ map: world.glowTex, size: 3.2, color: 0xf2ead8, transparent: true, opacity: 0.32, depthWrite: false, fog: false })); this.steam.frustumCulled = false; this.steam.position.set(vx, 0, vz); root.add(this.steam);
      lamp(vx, FLOOR + 2.5, vz, 9, 0xfff0d0, 0.35);
    }
    root.add(mesh(fixed));
    this.entry = new V3(C.x - 14.6, C.y, C.z); this.entryHeading = Math.PI / 2;          // (on the ledge, facing in)
  }

  /** Is this point in here? */
  inside(p) { return p.x > this.C.x - 300; }
  /** Where to go: down to the heart; and once it is red, to the door. */
  goal() { return this.painted ? this.doorAt : this.heartAt; }
  /** How fast the air is rising here: only in the column of steam. */
  thermal(p) { return (p.x - this.vent.x) ** 2 + (p.z - this.vent.z) ** 2 < 2.8 * 2.8 && p.y < this.C.y + 4 ? 13 * clamp((this.C.y + 4 - p.y) / 5, 0, 1) : 0; }
  /** The heart is painted, or (of a journey begun again) is not. */
  setPainted(on) { this.painted = !!on; this.red = on ? 1 : 0; this.since = on ? 1e3 : 0; this.tint = null; }

  /** Something in here that is worth a word. */
  waiting(p) {
    const y = p.y - this.C.y, d = Math.hypot(p.x - this.C.x, p.z - this.C.z);
    if (y < FLOOR + 4 && this.painted) return { key: 'heartdone', line: 'It beats. The round door in its chest is open.' };
    if (y < FLOOR + 4 && d < 13) return { key: 'heart', loud: true, line: 'Its heart. Everything in here turns but this, and this has no colour at all.' };
    if (y < FLOOR + 4 && Math.hypot(p.x - this.vent.x, p.z - this.vent.z) < 9) return { key: 'steam', line: 'Steam goes up here, all the way to the top. It would carry an open cloak.' };
    if (y > -3) return { key: 'works', line: 'Inside, it is all wheels. They go down, and they will carry whoever stands on them.' };
    return null;
  }

  /** A swing of the brush landing at (x, z), from a painter standing at `p`, with this colour on it. */
  strike(x, z, p, hex, ev) {
    if (!this.inside(p) || this.painted || p.y - this.C.y > FLOOR + 3 || (x - this.C.x) ** 2 + (z - this.C.z) ** 2 > 30) return;
    if (isRed(hex)) { this.painted = true; this.since = 0; this.tint = null; ev.push({ type: 'heart', at: this.heartAt, hex }); }
    else { this.tint = new THREE.Color(hex); ev.push({ type: 'wrongheart', at: this.heartAt, hex }); }
  }

  update(dt, t, player, ev) {
    const p = player.pos, C = this.C, here = this.inside(p);
    this.root.visible = here; if (!here) return;
    // (everything in here turns at one pace, and faster once the heart is going)
    if (this.painted) this.since += dt;
    this.red += clamp((this.painted ? 1 : 0) - this.red, -dt, dt / 2.2);
    this.fast += ((this.painted ? 2.6 : 1) - this.fast) * (1 - Math.exp(-0.8 * dt));
    const step = dt * this.fast; this.ph += step;
    for (const c of this.cogs) {
      c.m.rotation.y -= c.w * step; c.pin.rotation.y = driven(c.m.rotation.y, c.a, 16, PIN);
      // whoever stands on a wheel goes round with it
      if (player.grounded && Math.abs(p.y - c.y) < 0.2 && (p.x - c.x) ** 2 + (p.z - c.z) ** 2 < (COG_R + 0.4) ** 2) { const s = Math.sin(c.w * step), k = Math.cos(c.w * step), dx = p.x - c.x, dz = p.z - c.z; p.x = c.x + dx * k - dz * s; p.z = c.z + dx * s + dz * k; player.heading -= c.w * step; }
    }
    this.axle.rotation.y += 0.22 * step;
    for (const w of this.wall) { w.m.rotation.y += w.w * step; w.mate.rotation.y = driven(w.m.rotation.y, w.way, w.n, w.n2); }
    for (const r of this.rods) r.m.position.y = r.y + Math.sin(this.ph * 1.7 + r.ph) * 1.6;
    // the lift: slowly up to the eighth wheel and slowly down again, resting a moment at each end; and the steam
    { const u = clamp(0.5 - 0.72 * Math.cos(this.ph * 0.3), 0, 1), e = u * u * (3 - 2 * u); this.lift.y = FLOOR + 0.2 + (20 - 0.2) * e; this.lift.m.position.y = this.lift.y; }
    { const sp = this.steam.geometry.attributes.position; for (let i = 0; i < 48; i++) { const u = (t * 0.22 + i / 48) % 1, a = i * 2.4 + t * 0.6; sp.setXYZ(i, Math.cos(a) * (0.6 + u * 1.3), FLOOR + 0.6 + u * (4 - FLOOR), Math.sin(a) * (0.6 + u * 1.3)); } sp.needsUpdate = true; }
    // the wall is in the way all round, and so is the floor of the place: nobody leaves it but by a door
    { const dx = p.x - C.x, dz = p.z - C.z, d = Math.hypot(dx, dz); if (d > R - 0.9) { p.x = C.x + (dx / d) * (R - 0.9); p.z = C.z + (dz / d) * (R - 0.9); } }
    if (player.grounded) this.safe.copy(p);
    player.safe.copy(this.safe);
    // the way out, behind the ledge
    if (player.grounded && Math.abs(p.y - C.y) < 0.5 && p.x - C.x < -R + 1.6 && Math.abs(p.z - C.z) < 2.2) ev.push({ type: 'out' });

    // ---- the heart: slate, or whatever it was wrongly given; then red, and beating, and lighting the place
    const k = smooth(this.red), beat = this.painted ? Math.max(0, Math.sin(t * 5.2)) ** 6 * 0.11 + Math.max(0, Math.sin(t * 5.2 - 0.9)) ** 6 * 0.07 : Math.sin(t * 0.9) * 0.008;
    this.heart.scale.setScalar(1 + beat * (0.4 + 0.6 * k));
    const base = this._c || (this._c = new THREE.Color()); base.set(0x59626c); if (this.tint) base.lerp(this.tint, 0.75);
    this.heartMat.color.copy(base).lerp(this._r || (this._r = new THREE.Color(0xe02436)), k); this.heartMat.emissive.setRGB(0.05 + 0.5 * k + beat * 2 * k, 0.055 - 0.03 * k, 0.07 - 0.03 * k);
    this.glow.material.color.setRGB(lerp(0.6, 1, k), lerp(0.7, 0.16, k), lerp(0.82, 0.2, k)); this.glow.material.opacity = 0.28 + k * (0.5 + beat * 3); this.glow.scale.setScalar(15 + k * 14);
    // ---- the door: shut; then, a little after the heart has begun, it turns aside, and the blue comes in, and the painter is put out
    const open = smooth((this.since - 3.2) / 2.2);
    this.door.scale.set(1, Math.max(0.02, 1 - open), Math.max(0.02, 1 - open)); this.door.rotation.x = open * 2.4; this.door.visible = open < 0.99;
    this.light.material.opacity = open; this.blue.material.opacity = open * 0.85;
    if (this.painted && open >= 1 && !player.lift && p.y - C.y < FLOOR + 6 && (this.since < 100 ? this.since > 6.2 : p.x - C.x > R - 7 && Math.abs(p.z - C.z) < 5)) { this.since = Math.max(this.since, 100); ev.push({ type: 'eject' }); }
  }
}
const lerp = (a, b, t) => a + (b - a) * t;
