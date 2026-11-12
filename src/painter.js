import * as THREE from 'three';
import { PAL, daub, rand, rr, fbm } from './util.js';

// The painter: a jointed figure (hips, knees, shoulders, elbows) with a face, a ragged poncho over the
// shoulders, and below it a cape that is simulated as cloth so it trails, swings and gets kicked by the heels.
// Signature pieces kept from the first model: the cream paint-stained cloak, the palette and brush slung on
// the back, the bun with its gold ring, and (in player.js) the long red hair ribbons.

const V3 = THREE.Vector3;
const lam = (hex, extra = {}) => new THREE.MeshLambertMaterial({ color: hex, ...extra });
// mostly cream, with the odd stain of paint scattered through it (so stains come out as small patches)
const STAINS = [...PAL.cloak, '#f2a0b8', ...PAL.cloak, '#f6c56e', ...PAL.cloak, '#b890e0', ...PAL.cloak, '#e8706a', ...PAL.cloak];

export function buildPainter() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const mTrouser = lam(0x2b1d3d), mTunic = lam(0x4a2a5e), mSkin = lam(0xf0c6a6), mHair = lam(0x2a1826), mBoot = lam(0x5a3a40), mLeather = lam(0x7a4a34);
  const mGold = lam(0xf0b840, { emissive: 0x4a3000 });
  const mCloth = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // ---- legs: hip -> thigh -> knee -> shin and boot
  const legs = [], knees = [], feet = [];
  [-1, 1].forEach((s, i) => {
    const hip = new THREE.Group(); hip.position.set(0.13 * s, 0.86, 0);
    add(hip, new THREE.CylinderGeometry(0.108, 0.086, 0.44, 9), mTrouser, 0, -0.21, 0);
    add(hip, new THREE.SphereGeometry(0.09, 9, 7), mTrouser, 0, -0.42, 0);
    const knee = new THREE.Group(); knee.position.set(0, -0.42, 0); hip.add(knee);
    add(knee, new THREE.CylinderGeometry(0.084, 0.07, 0.3, 9), mTrouser, 0, -0.15, 0);
    add(knee, new THREE.CylinderGeometry(0.092, 0.088, 0.17, 9), mBoot, 0, -0.335, 0);
    add(knee, new THREE.SphereGeometry(0.1, 9, 7), mBoot, 0, -0.39, 0.07).scale.set(0.95, 0.55, 1.55);
    add(knee, new THREE.TorusGeometry(0.092, 0.024, 5, 12), mLeather, 0, -0.255, 0).rotation.x = Math.PI / 2;
    // a drip of paint on each boot
    add(knee, new THREE.SphereGeometry(0.04, 6, 5), lam(i ? 0x40e0d8 : 0xffc040), 0.05 * s, -0.37, 0.14).scale.set(1, 0.5, 1.3);
    const foot = new THREE.Object3D(); foot.position.set(0, -0.38, 0.03); knee.add(foot);
    body.add(hip); legs.push(hip); knees.push(knee); feet.push(foot);
  });

  // ---- torso: tunic with a short skirt, belt, satchel and vials of paint
  add(body, new THREE.CylinderGeometry(0.2, 0.238, 0.52, 12), mTunic, 0, 1.25, 0);
  add(body, new THREE.CylinderGeometry(0.225, 0.34, 0.32, 12, 1, true), lam(0x3a2350, { side: THREE.DoubleSide }), 0, 0.86, 0);
  add(body, new THREE.TorusGeometry(0.238, 0.04, 6, 16), mLeather, 0, 1.01, 0).rotation.x = Math.PI / 2;
  add(body, new THREE.BoxGeometry(0.09, 0.09, 0.03), mGold, 0, 1.01, 0.265);
  const satchel = add(body, new THREE.BoxGeometry(0.11, 0.2, 0.24), mLeather, 0.3, 0.9, 0.0); satchel.rotation.z = -0.12;
  add(body, new THREE.BoxGeometry(0.115, 0.1, 0.25), lam(0x93603f), 0.305, 0.96, 0.0).rotation.z = -0.12;
  [0x40e0ff, 0xffc040, 0xff70b0].forEach((c, i) => add(body, new THREE.CylinderGeometry(0.04, 0.04, 0.17, 7), new THREE.MeshBasicMaterial({ color: c }), -0.29 + i * 0.012, 0.9, -0.1 + i * 0.1));
  add(body, new THREE.CylinderGeometry(0.075, 0.085, 0.14, 9), mSkin, 0, 1.63, 0);

  // ---- poncho: rigid over the shoulders, ragged at its rim; the cape hangs from its back edge
  const PONCHO = { top: 1.7, rim: 1.12, rTop: 0.19, rRim: 0.5 };
  const pg = new THREE.CylinderGeometry(PONCHO.rTop, PONCHO.rRim, PONCHO.top - PONCHO.rim, 18, 4, true);
  const pp = pg.attributes.position;
  for (let i = 0; i < pp.count; i++) if (pp.getY(i) < -0.2) pp.setY(i, pp.getY(i) + (rand() - 0.5) * 0.1);
  pg.computeVertexNormals();
  const cloak = add(body, daub(pg, STAINS, { scale: 3.4, spread: 0.5 }), mCloth, 0, (PONCHO.top + PONCHO.rim) / 2, 0);
  add(body, daub(new THREE.TorusGeometry(0.2, 0.082, 8, 14), PAL.cloak, { scale: 3 }), mCloth, 0, 1.625, -0.025).rotation.x = Math.PI / 2;
  // where the cape is sewn on: an arc round the back of the rim, in body space
  const capePins = [];
  const COLS = 11;
  for (let c = 0; c < COLS; c++) { const a = ((c / (COLS - 1)) * 2 - 1) * 1.75; capePins.push(new V3(Math.sin(a) * (PONCHO.rRim - 0.01), PONCHO.rim + 0.02, -Math.cos(a) * (PONCHO.rRim - 0.01))); }

  // ---- arms: shoulder -> sleeve -> elbow -> forearm, bracer and hand
  const arms = [], elbows = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0.3 * s, 1.48, 0);
    add(sh, daub(new THREE.SphereGeometry(0.1, 9, 7), PAL.cloak, { scale: 3 }), mCloth);
    add(sh, daub(new THREE.CylinderGeometry(0.088, 0.1, 0.32, 9, 1, true), PAL.cloak, { scale: 3 }), mCloth, 0, -0.15, 0);
    const el = new THREE.Group(); el.position.set(0, -0.3, 0); sh.add(el);
    add(el, new THREE.SphereGeometry(0.066, 8, 6), mSkin);
    add(el, new THREE.CylinderGeometry(0.06, 0.05, 0.27, 8), mSkin, 0, -0.135, 0);
    add(el, new THREE.CylinderGeometry(0.066, 0.06, 0.13, 8), lam(0x3a2440), 0, -0.17, 0);
    add(el, new THREE.TorusGeometry(0.066, 0.015, 4, 10), mGold, 0, -0.1, 0).rotation.x = Math.PI / 2;
    add(el, new THREE.SphereGeometry(0.062, 8, 6), mSkin, 0, -0.3, 0).scale.set(1, 1.15, 0.8);
    body.add(sh); arms.push(sh); elbows.push(el);
  }

  // ---- head: face, hair with a fringe, bun, gold ring and hairpin
  const head = new THREE.Group(); head.position.set(0, 1.82, 0); body.add(head);
  add(head, new THREE.SphereGeometry(0.2, 18, 14), mSkin).scale.set(1, 1.02, 0.98);
  add(head, new THREE.SphereGeometry(0.218, 18, 14), mHair, 0, 0.03, -0.04);
  for (let i = 0; i < 5; i++) {                                   // fringe across the forehead
    const a = (i - 2) * 0.36;
    const lock = add(head, new THREE.SphereGeometry(0.075, 8, 6), mHair, Math.sin(a) * 0.168, 0.118 - Math.abs(i - 2) * 0.016, Math.cos(a) * 0.168);
    lock.scale.set(1.05, 0.72, 0.5); lock.rotation.y = a; lock.rotation.z = (i - 2) * -0.12;
  }
  for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(0.06, 8, 6), mHair, 0.172 * s, -0.07, 0.045).scale.set(0.6, 1.9, 0.9);   // side locks
  add(head, new THREE.SphereGeometry(0.118, 10, 8), mHair, 0, 0.25, -0.1);
  add(head, new THREE.TorusGeometry(0.125, 0.026, 5, 14), mGold, 0, 0.24, -0.1).rotation.x = Math.PI / 2.4;
  add(head, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5), mGold, 0, 0.27, -0.1).rotation.z = 1.1;
  for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(0.05, 7, 5), lam(0xd9283c, { emissive: 0x300408 }), 0.07 * s, 0.2, -0.19).scale.set(1.3, 0.8, 0.5);   // the bow the ribbons trail from
  // eyes (they blink), a little blush, a small smile
  const eyes = [];
  const mEye = lam(0x2a1c3a), mGlint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(0.076 * s, -0.004, 0.178); eye.rotation.y = 0.38 * s;
    add(eye, new THREE.SphereGeometry(0.036, 10, 8), mEye).scale.set(0.82, 1.22, 0.45);
    add(eye, new THREE.SphereGeometry(0.011, 6, 5), mGlint, 0.01, 0.018, 0.014);
    head.add(eye); eyes.push(eye);
    add(head, new THREE.SphereGeometry(0.036, 8, 6), lam(0xf29aa6), 0.118 * s, -0.062, 0.152).scale.set(1, 0.62, 0.3);
  }
  const mouth = add(head, new THREE.TorusGeometry(0.027, 0.007, 4, 9, Math.PI), lam(0x9a4a5a), 0, -0.078, 0.186); mouth.rotation.z = Math.PI;

  // ---- palette and brush slung high on the back, over the poncho
  const back = new THREE.Group(); back.position.set(-0.03, 1.42, -0.41); back.rotation.set(0.5, 0, 0.22); body.add(back);
  add(back, new THREE.CylinderGeometry(0.31, 0.31, 0.045, 16), lam(0xe9d3a6)).rotation.x = Math.PI / 2;
  add(back, new THREE.CylinderGeometry(0.058, 0.058, 0.055, 9), lam(0x4a2a3a), 0.15, 0.09, 0).rotation.x = Math.PI / 2;
  [0xe8342a, 0xffc040, 0x3a6ae0, 0x9a50d0, 0xfff6e6, 0xf25a9a].forEach((c, i) => {
    const a = 2.2 + i * 0.72;
    add(back, new THREE.SphereGeometry(0.066, 7, 6), lam(c), Math.cos(a) * 0.185, Math.sin(a) * 0.185, -0.032).scale.set(1 + (i % 2) * 0.3, 1, 0.4);
  });
  const mkBrush = (g) => {
    add(g, new THREE.CylinderGeometry(0.028, 0.036, 1.6, 7), lam(0x8a5a34), 0, 0, 0);
    add(g, new THREE.CylinderGeometry(0.05, 0.04, 0.16, 7), mGold, 0, 0.86, 0);
    add(g, new THREE.ConeGeometry(0.075, 0.34, 7), lam(0xfff0d8), 0, 1.1, 0);
    return add(g, new THREE.ConeGeometry(0.05, 0.18, 7), new THREE.MeshBasicMaterial({ color: 0x40e0d8 }), 0, 1.2, 0);
  };
  const backBrush = new THREE.Group(); backBrush.position.set(0.08, 0.02, -0.07); backBrush.rotation.z = -0.75; back.add(backBrush);
  const backTip = mkBrush(backBrush);

  // the big brush in hand while swinging (arm 1), and a small one for working at an easel (arm 0)
  const handBrush = new THREE.Group(); handBrush.position.set(0, -0.3, 0); handBrush.rotation.x = Math.PI; handBrush.visible = false;
  const tip = mkBrush(handBrush); handBrush.children.forEach((c) => { c.position.y += 0.62; });
  elbows[1].add(handBrush);
  const easelBrush = new THREE.Group(); easelBrush.position.set(0, -0.3, 0); easelBrush.rotation.x = Math.PI + 0.5; easelBrush.scale.setScalar(0.42); easelBrush.visible = false;
  const easelTip = mkBrush(easelBrush); easelBrush.children.forEach((c) => { c.position.y += 0.75; });
  elbows[0].add(easelBrush);

  return { root, body, legs, knees, feet, arms, elbows, head, eyes, cloak, backBrush, handBrush, easelBrush, tip, backTip, easelTip, capePins };
}

// ------------------------------------------------------------------ the cape: a small sheet of cloth
// Verlet particles in world space. The top row is sewn to the poncho's rim; everything below hangs, trails
// behind when the painter moves, and is pushed out of the way by the body and the legs.
const _d = new V3(), _a = new V3();
export class Cape {
  constructor(scene, cols, rows = 7, seg = 0.092) {
    this.cols = cols; this.rows = rows; this.seg = seg;
    const n = cols * rows;
    this.p = new Float32Array(n * 3); this.q = new Float32Array(n * 3);
    // the hem is ragged: the last row hangs a different length in every column
    this.len = new Float32Array(n);
    for (let c = 0; c < cols; c++) for (let r = 1; r < rows; r++) this.len[r * cols + c] = seg * (r === rows - 1 ? rr(0.45, 1.5) : rr(0.92, 1.08));
    this.span = new Float32Array(rows);                         // spacing across each row: the cape flares toward the hem
    const col = new Float32Array(n * 3), idx = [], cols3 = STAINS.map((h) => new THREE.Color(h));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const t = fbm(c * 0.42 + 3.1, r * 0.5 + 1.7, 7.7), k = cols3[Math.min(cols3.length - 1, Math.floor(Math.max(0, (t - 0.5) * 2.4 + 0.5) * cols3.length))];
      const shade = 1 - (r / rows) * 0.12;                      // a little grubbier toward the hem
      col.set([k.r * shade, k.g * shade, k.b * shade], (r * cols + c) * 3);
      if (r < rows - 1 && c < cols - 1) { const i = r * cols + c; idx.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1); }
    }
    const g = (this.geo = new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.ready = false;
  }

  reset() { this.ready = false; }

  /**
   * pins: world positions for the top row. capsule: { a, b, r } round the body. spheres: [{ c, r }] for knees and
   * feet. wind: the air's velocity. floor: height the cloth may not sink below (or -Infinity in the air).
   */
  update(dt, pins, capsule, spheres, wind, floor) {
    const { cols, rows, p, q } = this, n = cols * rows;
    const pinSpan = pins[0].distanceTo(pins[1]);
    for (let r = 0; r < rows; r++) this.span[r] = pinSpan * (1 + r * 0.075);
    if (!this.ready || (p[0] - pins[0].x) ** 2 + (p[1] - pins[0].y) ** 2 + (p[2] - pins[0].z) ** 2 > 6) {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 3;
        p[i] = q[i] = pins[c].x; p[i + 1] = q[i + 1] = pins[c].y - r * this.seg; p[i + 2] = q[i + 2] = pins[c].z;
      }
      this.ready = true;
    }
    const SUB = 3, h = Math.min(dt, 1 / 30) / SUB, drag = 1.5, damp = 0.992;
    for (let s = 0; s < SUB; s++) {
      // integrate: gravity, plus the air dragging each point toward the wind's own speed
      for (let k = cols; k < n; k++) {
        const i = k * 3;
        for (let a = 0; a < 3; a++) {
          const v = (p[i + a] - q[i + a]) * damp, w = a === 0 ? wind.x : a === 1 ? wind.y : wind.z;
          const acc = (a === 1 ? -13 : 0) + (w - v / h) * drag;
          q[i + a] = p[i + a]; p[i + a] += v + acc * h * h;
        }
      }
      for (let c = 0; c < cols; c++) { p[c * 3] = pins[c].x; p[c * 3 + 1] = pins[c].y; p[c * 3 + 2] = pins[c].z; }
      for (let it = 0; it < 3; it++) {
        // each point keeps its distance from the one above it...
        for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) {
          const k = r * cols + c, i = k * 3, j = (k - cols) * 3;
          let dx = p[i] - p[j], dy = p[i + 1] - p[j + 1], dz = p[i + 2] - p[j + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-6, e = (d - this.len[k]) / d, wU = r === 1 ? 0 : 0.5, wL = 1 - wU;
          p[j] += dx * e * wU; p[j + 1] += dy * e * wU; p[j + 2] += dz * e * wU;
          p[i] -= dx * e * wL; p[i + 1] -= dy * e * wL; p[i + 2] -= dz * e * wL;
        }
        // ...and, more loosely, from its neighbour across
        for (let r = 1; r < rows; r++) for (let c = 0; c < cols - 1; c++) {
          const i = (r * cols + c) * 3, j = i + 3;
          const dx = p[j] - p[i], dy = p[j + 1] - p[i + 1], dz = p[j + 2] - p[i + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-6, e = ((d - this.span[r]) / d) * 0.35;
          p[i] += dx * e; p[i + 1] += dy * e; p[i + 2] += dz * e;
          p[j] -= dx * e; p[j + 1] -= dy * e; p[j + 2] -= dz * e;
        }
      }
      // keep the cloth outside the body and legs, and off the ground
      _a.subVectors(capsule.b, capsule.a); const al = _a.lengthSq();
      for (let k = cols; k < n; k++) {
        const i = k * 3;
        const t = Math.max(0, Math.min(1, ((p[i] - capsule.a.x) * _a.x + (p[i + 1] - capsule.a.y) * _a.y + (p[i + 2] - capsule.a.z) * _a.z) / al));
        _d.set(p[i] - (capsule.a.x + _a.x * t), p[i + 1] - (capsule.a.y + _a.y * t), p[i + 2] - (capsule.a.z + _a.z * t));
        let d = _d.length();
        if (d < capsule.r && d > 1e-5) { const m = (capsule.r - d) / d; p[i] += _d.x * m; p[i + 1] += _d.y * m; p[i + 2] += _d.z * m; }
        for (const sp of spheres) {
          _d.set(p[i] - sp.c.x, p[i + 1] - sp.c.y, p[i + 2] - sp.c.z); d = _d.length();
          if (d < sp.r && d > 1e-5) { const m = (sp.r - d) / d; p[i] += _d.x * m; p[i + 1] += _d.y * m; p[i + 2] += _d.z * m; }
        }
        if (p[i + 1] < floor) p[i + 1] = floor;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}
