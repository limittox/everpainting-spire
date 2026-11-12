import * as THREE from 'three';
import { rimR, surfY, islandTopGeo } from './world.js';
import { ghostMaterial } from './sketches.js';
import { daub, place, Bag, paintify, glowSprite, mulberry32, noise3 } from './util.js';
import { PAINTS } from './paint.js';

// The Underpainting: the second level, a world still in pencil. Nothing here has any colour until the painter
// brings it, and here colour does things. This is its first island, the Dry Stair, and its first lesson: water.
//
//   Paint a dry spring in a colour that runs (Turquoise or Sky) and water runs from it down its channel, turns
//   the wheel at the end, and the wheel works a lift up to the next terrace. Any other colour sits in the spring
//   and goes nowhere. Three terraces, two springs, and at the top the source of them all.
//
// The level lives a long way from the first one (in the same scene, far beyond its horizon), and is reached by
// stepping into an unfinished canvas that stands in the Spire's atelier.

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const STAIR = { x: 0, y: 0, z: 4200, r: 34, ph: 1.3, name: 'The Dry Stair', pale: true };
const MID = { r: 22, y: 5.5 }, TOP = { r: 11, y: 11 };          // the two upper terraces: too high to jump
export const RUNS = [2, 6];                                             // the paints that are water: Turquoise and Sky
export const SPAN = 1.22;                                               // an island's ground canvas covers 2 * r * SPAN

export const PAPER = ['#f4efe6', '#ebe5da', '#e2dccf', '#f8f4ec'];
export const GRAPHITE = ['#8a8794', '#6f6c7a', '#a09dac', '#57545f'];
export const STONE = ['#dcdad6', '#cfcdca', '#e6e4e0', '#bcbab8', '#c6c4c2'];

const at = (a, r, y = 0) => new V3(STAIR.x + Math.cos(a) * r, y, STAIR.z + Math.sin(a) * r);
const floor = (p) => { p.y = surfY(STAIR, p.x, p.z); return p; };

// ------------------------------------------------------------------------------------------------ the ground, in pencil
export function pencilGround(isl, size, channels = [], cracks = [], seed = 1887) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), r = mulberry32(seed), px = size / (2 * isl.r * SPAN);
  const U = (wx) => ((wx - isl.x) / (2 * isl.r * SPAN) + 0.5) * size, V = (wz) => ((wz - isl.z) / (2 * isl.r * SPAN) + 0.5) * size;
  x.fillStyle = '#efe9dd'; x.fillRect(0, 0, size, size);
  // hatching: short pencil lines that follow the round of the island, crossed here and there
  x.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * isl.r * 1.18, u = U(isl.x + Math.cos(a) * d), v = V(isl.z + Math.sin(a) * d);
    const t = a + Math.PI / 2 + (r() - 0.5) * 0.5 + (r() < 0.16 ? Math.PI / 2.6 : 0), len = (0.5 + r() * 1.5) * px;
    x.strokeStyle = `rgba(${70 + r() * 30 | 0},${68 + r() * 30 | 0},${86 + r() * 30 | 0},${0.07 + r() * 0.17})`;
    x.lineWidth = 0.8 + r() * 1.6;
    x.beginPath(); x.moveTo(u - Math.cos(t) * len * 0.5, v - Math.sin(t) * len * 0.5); x.lineTo(u + Math.cos(t) * len * 0.5, v + Math.sin(t) * len * 0.5); x.stroke();
  }
  // soft smudges where a thumb went over the graphite
  for (let i = 0; i < 70; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * isl.r, g = x.createRadialGradient(0, 0, 0, 0, 0, (1.5 + r() * 3.5) * px);
    g.addColorStop(0, `rgba(120,118,134,${0.05 + r() * 0.07})`); g.addColorStop(1, 'rgba(120,118,134,0)');
    x.save(); x.translate(U(isl.x + Math.cos(a) * d), V(isl.z + Math.sin(a) * d)); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 6 * px, 0, TAU); x.fill(); x.restore();
  }
  // the channels the water once ran in: two drawn banks, and a dry bed between them
  for (const ch of channels) {
    const line = (off, width, style) => {
      x.strokeStyle = style; x.lineWidth = width; x.lineJoin = 'round';
      let pen = false;
      x.beginPath();
      ch.pts.forEach((p, i) => {
        const q = ch.pts[Math.min(ch.pts.length - 1, i + 1)], o = ch.pts[Math.max(0, i - 1)];
        const tx = q.x - o.x, tz = q.z - o.z, L = Math.hypot(tx, tz) || 1, u = U(p.x - (tz / L) * off), v = V(p.z + (tx / L) * off);
        const f = i / (ch.pts.length - 1), broken = ch.gap && f > ch.gap[0] && f < ch.gap[1];
        if (broken) { pen = false; return; }
        if (pen) x.lineTo(u, v); else { x.moveTo(u, v); pen = true; }
      });
      x.stroke();
    };
    line(0, 1.0 * px, 'rgba(96,94,112,0.2)');
    line(-0.62, 0.11 * px, 'rgba(60,58,76,0.8)'); line(0.62, 0.11 * px, 'rgba(60,58,76,0.8)');
  }
  // where a channel is broken: a crack drawn across the ground
  for (const k of cracks) {
    x.strokeStyle = 'rgba(52,50,68,0.85)'; x.lineWidth = 0.09 * px; x.lineJoin = 'miter';
    x.beginPath();
    for (let i = 0; i <= 12; i++) {
      const f = i / 12, wx = k.a.x + (k.b.x - k.a.x) * f + (r() - 0.5) * 0.7, wz = k.a.z + (k.b.z - k.a.z) * f + (r() - 0.5) * 0.7;
      if (i) x.lineTo(U(wx), V(wz)); else x.moveTo(U(wx), V(wz));
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** A flat ring of ground at height `y`, textured from the island's one canvas by where it lies. */
export function terraceTop(isl, r0, r1, y, K = 10, S = 72) {
  const pos = [], uv = [], idx = [];
  for (let k = 0; k <= K; k++) for (let i = 0; i <= S; i++) {
    const th = (i / S) * TAU, rad = r0 + ((r1 - r0) * k) / K, x = isl.x + Math.cos(th) * rad, z = isl.z + Math.sin(th) * rad;
    pos.push(x, y, z);
    uv.push((x - isl.x) / (2 * isl.r * SPAN) + 0.5, 0.5 - (z - isl.z) / (2 * isl.r * SPAN));
  }
  for (let k = 0; k < K; k++) for (let i = 0; i < S; i++) { const p = k * (S + 1) + i, q = p + S + 1; idx.push(p, p + 1, q, p + 1, q + 1, q); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The rock the island hangs on: the same sort of shape as the others, in graphite. */
export function underside(isl, J = 8, S = 40) {
  const depth = isl.r * 1.15 + 7, pos = [];
  const P = (j, s) => {
    const th = (s / S) * TAU, t = j / J, nz = noise3(Math.cos(th) * 2.2 + isl.ph, t * 3.1, Math.sin(th) * 2.2);
    const rad = rimR(isl, th) * Math.pow(1 - t, 0.75) * (1 + (nz - 0.5) * 0.7 * Math.min(1, t * 3));
    const x = isl.x + Math.cos(th) * rad, z = isl.z + Math.sin(th) * rad;
    return [x, j === 0 ? surfY(isl, x, z) - 0.2 : isl.y - 0.2 - depth * Math.pow(t, 1.25) - nz * 2.5, z];
  };
  for (let j = 0; j < J; j++) for (let s = 0; s < S; s++) {
    const a = P(j, s), b = P(j, s + 1), c = P(j + 1, s + 1), d = P(j + 1, s);
    pos.push(...a, ...b, ...c);
    if (j < J - 1) pos.push(...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return daub(g, [...GRAPHITE, ...STONE], { scale: 0.08, stretch: [1, 0.25, 1] });
}

// ------------------------------------------------------------------------------------------------ running water
const WATER_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WATER_FRAG = /* glsl */ `
precision highp float;
uniform float time; uniform float reach; uniform float len; uniform vec3 tint;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  if (vUv.x > reach) discard;                       // the water has only come this far
  float along = vUv.x * len;
  float n = vnoise(vec2(along * 0.9 - time * 2.4, vUv.y * 3.0));
  float streak = vnoise(vec2(along * 0.35 - time * 1.5, vUv.y * 9.0));
  vec3 col = tint * (0.6 + 0.55 * n);
  col = mix(col, vec3(1.0), smoothstep(0.62, 0.9, streak) * 0.5);
  col = mix(col, vec3(1.0), smoothstep(reach - 1.1 / len, reach, vUv.x) * 0.75);      // foam at its leading edge
  float edge = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
  gl_FragColor = vec4(col, (0.84 + 0.16 * n) * edge);
}`;

/** A ribbon of water along `pts`. `sideOf(i)` gives the direction across it at each point (for water falling down a wall). */
function makeStream(scene, uTime, pts, width, sideOf = null) {
  const pos = [], uv = [], idx = [], side = new V3(), tan = new V3(), up = new V3(0, 1, 0);
  let len = 0;
  const run = pts.map((p, i) => (i ? (len += p.distanceTo(pts[i - 1])) : 0));
  pts.forEach((p, i) => {
    if (sideOf) side.copy(sideOf(i)); else { tan.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize(); side.crossVectors(tan, up).normalize(); }
    pos.push(p.x + side.x * width * 0.5, p.y + side.y * width * 0.5, p.z + side.z * width * 0.5, p.x - side.x * width * 0.5, p.y - side.y * width * 0.5, p.z - side.z * width * 0.5);
    uv.push(run[i] / len, 0, run[i] / len, 1);
    if (i < pts.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: uTime, reach: { value: 0 }, len: { value: len }, tint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2;
  scene.add(mesh);
  return { pts, len, run, mesh, mat, reach: 0, goal: 0 };
}

/** A smooth run of points on the ground between the given places (angle, radius), `lift` above it. */
function channel(ctrl, y, lift = 0.1) {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([a, r]) => at(a, r, 0)));
  const pts = curve.getSpacedPoints(Math.ceil(curve.getLength() / 0.7));
  pts.forEach((p) => { p.y = (y === null ? surfY(STAIR, p.x, p.z) : y) + lift; });
  return pts;
}

// ------------------------------------------------------------------------------------------------ the level
export class Underpainting {
  /** `hall` is the middle of the atelier's floor: the canvas that leads here stands in it. */
  constructor(scene, world, uTime, hall) {
    this.world = world; this.scene = scene;
    const isl = (this.island = { ...STAIR, index: world.islands.length });
    const bag = new Bag(), add = (g, pal, o) => bag.add(daub(g, pal, o));

    // --- where the water goes: two channels, each from a spring to a wheel, and the second one broken
    const A = { key: 'lower', level: 0, top: MID.y, spring: floor(at(2.22, 29)), ctrl: [[2.22, 29], [2.42, 28.4], [2.66, 27.2], [2.86, 25.9], [2.99, 25.2]], wheelAt: [2.99, 25.2], liftAt: [3.2, 23.9] };
    const B = { key: 'middle', level: MID.y, top: TOP.y, spring: at(4.0, 18.6, MID.y), ctrl: [[4.0, 18.6], [4.22, 17.9], [4.48, 17.3], [4.62, 17.0], [4.88, 15.7], [5.08, 13.6]], wheelAt: [5.08, 13.6], liftAt: [5.32, 12.95], gap: [0.415, 0.585] };
    for (const st of [A, B]) st.pts = channel(st.ctrl, st.level === 0 ? null : st.level);
    const gapFrom = B.pts[Math.floor(B.gap[0] * (B.pts.length - 1))], gapTo = B.pts[Math.ceil(B.gap[1] * (B.pts.length - 1))], gapMid = gapFrom.clone().lerp(gapTo, 0.5);
    const across = new V3(-(gapTo.z - gapFrom.z), 0, gapTo.x - gapFrom.x).normalize();

    // --- the island: one canvas of pencilled ground, worn by all three terraces
    isl.tex = pencilGround(isl, 2048, [A, B], [{ a: gapMid.clone().addScaledVector(across, -3.4), b: gapMid.clone().addScaledVector(across, 3.4) }]);
    isl.span = 2 * isl.r * SPAN;
    world.islands.push(isl);                       // from here on it is an island like the others: ground, paint, flowers
    const topMat = paintify(new THREE.MeshLambertMaterial({ map: isl.tex }), { scale: 1, amp: 0.45 });
    scene.add(new THREE.Mesh(islandTopGeo(isl), topMat), new THREE.Mesh(terraceTop(isl, TOP.r - 0.5, MID.r, MID.y), topMat), new THREE.Mesh(terraceTop(isl, 0.01, TOP.r, TOP.y), topMat));
    bag.add(underside(isl));
    for (const t of [MID, TOP]) {
      const h = t.y - (t === TOP ? MID.y : 0);
      add(place(new THREE.CylinderGeometry(t.r, t.r + 0.45, h + 0.5, 72, 5, true), isl.x, t.y - h / 2 - 0.25, isl.z), STONE, { scale: 0.25, stretch: [1, 0.2, 1], spread: 0.7 });
      add(place(new THREE.TorusGeometry(t.r + 0.05, 0.16, 5, 72), isl.x, t.y + 0.02, isl.z, Math.PI / 2, 0, 0), GRAPHITE);
      world.colliders.push({ x: isl.x, z: isl.z, r: t.r, top: t.y - 0.25, late: true });       // a cliff: in the way from below only
    }

    // --- pencil trees and standing stones: grey, until someone paints them
    const tree = (a, r, y, s) => {
      const p = at(a, r, y === null ? 0 : y); if (y === null) floor(p);
      add(place(new THREE.CylinderGeometry(0.16 * s, 0.3 * s, 3.4 * s, 6), p.x, p.y + 1.7 * s, p.z, 0, 0, 0.05), GRAPHITE, { scale: 0.6 });
      for (const [ox, oy, oz, rr] of [[0, 4.3, 0, 1.5], [1.1, 3.6, 0.4, 1.05], [-1.0, 3.7, -0.5, 1.1], [0.2, 5.3, -0.3, 0.9]]) {
        add(place(new THREE.IcosahedronGeometry(rr * s, 1), p.x + ox * s, p.y + oy * s, p.z + oz * s, 0, rr * 2, 0, 1, 0.72, 1), [...PAPER, '#d6d2dc', '#c9c5d0'], { scale: 0.4, spread: 1 });
      }
      world.colliders.push({ x: p.x, z: p.z, r: 0.45 * s, late: true });
    };
    for (const [a, r, s] of [[0.5, 28, 1.3], [1.05, 30, 1.0], [5.6, 27.5], [4.9, 29.5, 1.2], [4.1, 27, 1.0], [3.7, 30, 1.25], [0.05, 26.5, 0.9]]) tree(a, r, null, s || 1.1);
    for (const [a, r, s] of [[0.9, 16.5, 1.0], [2.3, 17.5, 1.2], [6.0, 17, 0.9]]) tree(a, r, MID.y, s);
    for (const [a, r, y] of [[1.9, 31, null], [2.75, 30.5, null], [5.2, 26, null], [3.45, 18.5, MID.y], [1.5, 13.5, MID.y]]) {
      const p = at(a, r, y === null ? 0 : y); if (y === null) floor(p);
      add(place(new THREE.BoxGeometry(0.7, 1.9, 0.5), p.x, p.y + 0.85, p.z, 0.06, a, 0.08), STONE, { scale: 0.9 });
    }

    // --- each stage: a spring, its stream, a wheel, a lift
    this.lifts = [];
    this.stages = [A, B].map((st) => this.buildStage(st, bag, add, uTime));
    this.trough = this.buildTrough(bag, uTime, gapMid, gapFrom, gapTo);
    this.stages[1].gapAt = B.gap[0] - 0.02;

    // --- the source, on top: a wide stone bowl. Paint it, and the whole stair runs.
    this.source = { pos: new V3(isl.x, TOP.y, isl.z), hex: null, running: false, falls: [], done: false };
    add(place(new THREE.TorusGeometry(4.2, 0.42, 6, 30), isl.x, TOP.y + 0.3, isl.z, Math.PI / 2, 0, 0), STONE, { scale: 0.6 });
    add(place(new THREE.CylinderGeometry(4.1, 4.1, 0.14, 30), isl.x, TOP.y + 0.08, isl.z), GRAPHITE);
    this.source.pool = new THREE.Mesh(new THREE.CircleGeometry(3.95, 30).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x77758a, fog: false }));
    this.source.pool.position.set(isl.x, TOP.y + 0.34, isl.z);
    const lily = new THREE.Mesh(new THREE.TorusKnotGeometry(0.9, 0.16, 60, 6, 2, 5).rotateX(Math.PI / 2).scale(1, 0.35, 1), ghostMaterial(uTime));
    lily.position.set(isl.x, TOP.y + 1.0, isl.z);
    this.source.lily = lily;
    scene.add(this.source.pool, lily);
    world.colliders.push({ x: isl.x, z: isl.z, r: 4.3, late: true });
    // when it runs, water goes over the edge of both cliffs
    for (const [t, base, angles] of [[TOP, MID.y, [0.35, 2.5, 4.55]], [MID, 0, [1.05, 2.0, 4.2, 5.75]]]) {
      for (const a of angles) {
        const tangent = new V3(-Math.sin(a), 0, Math.cos(a));
        const pts = [at(a, t.r - 1.6, t.y + 0.1), at(a, t.r + 0.1, t.y + 0.1), at(a, t.r + 0.5, t.y - 0.6), at(a, t.r + 0.62, base + 0.12)];
        const f = makeStream(scene, uTime, pts, 2.4, () => tangent);
        this.source.falls.push(f);
      }
    }

    // --- the pencil that drew it all, far off
    {
      const pb = new Bag();
      pb.add(daub(place(new THREE.CylinderGeometry(5, 5, 150, 6, 8), 0, 75, 0), ['#d8d2c2', '#cfc8b6', '#e4dece', '#c2bba8'], { scale: 0.05, stretch: [1, 0.1, 1] }));
      pb.add(daub(place(new THREE.ConeGeometry(5, 16, 6, 2), 0, -8, 0, Math.PI, 0, 0), ['#e9dcc2', '#dccfb4', '#f2e8d2'], { scale: 0.2 }));
      pb.add(daub(place(new THREE.ConeGeometry(1.7, 5.6, 6, 1), 0, -13.2, 0, Math.PI, 0, 0), ['#4a4854', '#3a3844', '#5c5a68'], {}));
      pb.add(daub(place(new THREE.CylinderGeometry(5.2, 5.2, 9, 6, 1), 0, 154, 0), GRAPHITE, {}));
      const pencil = pb.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x55535c, fog: false }), { scale: 14 }));
      pencil.position.set(isl.x + 92, 34, isl.z + 150); pencil.rotation.set(0.25, 0.4, -0.62);
      scene.add(pencil);
    }
    // a few bare islets out in the white, to give the place some distance
    const rr = mulberry32(311);
    for (let k = 0; k < 9; k++) {
      const a = rr() * TAU, d = 90 + rr() * 150, s = 7 + rr() * 9, y = -12 + rr() * 40;
      add(place(new THREE.ConeGeometry(s, s * 2.2, 9, 3), isl.x + Math.cos(a) * d, y - s * 1.1, isl.z + Math.sin(a) * d, Math.PI, rr() * 3, 0), [...GRAPHITE, ...STONE], { scale: 0.1, stretch: [1, 0.3, 1] });
      add(place(new THREE.CylinderGeometry(s, s, 0.5, 9), isl.x + Math.cos(a) * d, y, isl.z + Math.sin(a) * d, 0, rr() * 3, 0), PAPER, { scale: 0.3 });
    }

    // --- the two canvases: one in the atelier that leads here, and one here that leads back
    // (arriving, the painter stands in front of the way back but faces along the terrace, toward the first spring,
    // so that the camera behind them has open ground to stand on)
    this.arrive = { pos: floor(at(Math.PI / 2, 27)), heading: -Math.PI / 2 };
    this.backAt = floor(at(Math.PI / 2, 31));
    {
      const g = new THREE.Group(); g.position.copy(this.backAt); g.rotation.y = Math.PI;
      g.add(new THREE.Mesh(new THREE.BoxGeometry(4.5, 5.7, 0.3).translate(0, 2.95, -0.12), new THREE.MeshLambertMaterial({ color: 0xb9b3a6 })));
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 5.1).translate(0, 2.95, 0.05), new THREE.MeshBasicMaterial({ map: doorPicture(true), fog: false }));
      const glow = glowSprite(world.glowTex, 9, 0xffd890, 0.55); glow.position.set(0, 3.2, 0.8);
      g.add(pic, glow);
      scene.add(g);
      world.colliders.push({ x: this.backAt.x, z: this.backAt.z + 0.4, r: 1.6, late: true });
    }
    this.hallAt = new V3(hall.x + Math.sin(0.8 * Math.PI) * 9.6, hall.y, hall.z + Math.cos(0.8 * Math.PI) * 9.6);
    {
      const g = new THREE.Group(); g.position.copy(this.hallAt); g.rotation.y = Math.atan2(hall.x - this.hallAt.x, hall.z + 8 - this.hallAt.z);
      const wood = new THREE.MeshLambertMaterial({ color: 0x6a4038, emissive: 0x1a100e });
      for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.6, 5), wood); leg.position.set(s * 1.5, 3.2, -0.25); leg.rotation.z = s * 0.14; g.add(leg); }
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.4, 5), wood); back.position.set(0, 3.0, -1.3); back.rotation.x = 0.36; g.add(back);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.16, 0.4).translate(0, 1.0, 0.1), wood));
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.6).translate(0, 3.5, 0.02), new THREE.MeshBasicMaterial({ map: doorPicture(false), color: 0xcfcfcf, fog: false })));
      const glow = glowSprite(world.glowTex, 8, 0xffffff, 0.4); glow.position.set(0, 3.6, 0.8); g.add(glow);
      scene.add(g);
      world.colliders.push({ x: this.hallAt.x, z: this.hallAt.z, r: 1.3, late: true });
    }

    this.mesh = bag.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x18171c }), { scale: 1.1, amp: 0.5 }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    world.paintable.push(this.mesh);

    // --- ground: the terraces, and the lifts wherever they happen to be
    const base = world.groundHeight, lifts = this.lifts, m2 = MID.r * MID.r, t2 = TOP.r * TOP.r;
    world.groundHeight = (x, z, maxY) => {
      let best = base(x, z, maxY);
      const dx = x - isl.x, dz = z - isl.z, d2 = dx * dx + dz * dz;
      if (d2 > 2500) return best;
      if (d2 < m2 && MID.y <= maxY && MID.y > best) best = MID.y;
      if (d2 < t2 && TOP.y <= maxY && TOP.y > best) best = TOP.y;
      for (const L of lifts) if ((x - L.x) ** 2 + (z - L.z) ** 2 < L.r * L.r && L.y <= maxY && L.y > best) best = L.y;
      return best;
    };
    this.events = [];
    this.spillT = 0;
  }

  buildStage(st, bag, add, uTime) {
    const scene = this.scene, w = this.world, sp = st.spring;
    // the spring: a stone spout over a small round pool
    add(place(new THREE.TorusGeometry(1.25, 0.22, 5, 18), sp.x, sp.y + 0.16, sp.z, Math.PI / 2, 0, 0), STONE, { scale: 0.8 });
    add(place(new THREE.BoxGeometry(0.9, 1.5, 0.7), sp.x - Math.cos(st.ctrl[0][0]) * -1.5, sp.y + 0.7, sp.z - Math.sin(st.ctrl[0][0]) * -1.5, 0, -st.ctrl[0][0], 0), STONE, { scale: 0.8 });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x77758a, fog: false }));
    pool.position.set(sp.x, sp.y + 0.2, sp.z);
    const glint = glowSprite(w.glowTex, 4, 0xffffff, 0.3); glint.position.set(sp.x, sp.y + 1.1, sp.z);
    scene.add(pool, glint);
    const stream = makeStream(scene, uTime, st.pts, 1.05);

    // the wheel at the end of the channel: it stands across the water, and turns when the water reaches it
    const wp = at(st.wheelAt[0], st.wheelAt[1], 0); wp.y = st.level === 0 ? surfY(STAIR, wp.x, wp.z) : st.level;
    const last = st.pts[st.pts.length - 1], prev = st.pts[st.pts.length - 4], flow = Math.atan2(last.x - prev.x, last.z - prev.z);
    const wheel = new THREE.Group(); wheel.position.set(wp.x, wp.y + 1.75, wp.z); wheel.rotation.y = flow + Math.PI / 2;
    const grey = new THREE.MeshLambertMaterial({ color: 0xa7a3b0, emissive: 0x2a2930, flatShading: true });
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 5, 22), grey), new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.5, 6).rotateX(Math.PI / 2), grey));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU, paddle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.75), grey), spoke = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.5, 0.07), grey);
      paddle.position.set(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0); paddle.rotation.z = a + Math.PI / 2;
      spoke.position.set(Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0); spoke.rotation.z = a + Math.PI / 2;
      wheel.add(paddle, spoke);
    }
    scene.add(wheel);
    for (const s of [-1, 1]) {
      const x = wp.x + Math.cos(flow) * s * 0.75, z = wp.z - Math.sin(flow) * s * 0.75;
      add(place(new THREE.BoxGeometry(0.22, 2.1, 0.22), x, wp.y + 0.95, z, 0, flow, 0), GRAPHITE);
    }

    // the lift: a round platform between two posts against the cliff
    const lp = at(st.liftAt[0], st.liftAt[1], 0), y0 = (st.level === 0 ? surfY(STAIR, lp.x, lp.z) : st.level) + 0.16;
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.55, 0.32, 16), new THREE.MeshLambertMaterial({ color: 0xcfc9bc, emissive: 0x242328, flatShading: true }));
    plat.position.set(lp.x, y0 - 0.16, lp.z);
    scene.add(plat);
    for (const s of [-1, 1]) {
      const a = st.liftAt[0] + (s * 2.05) / st.liftAt[1], q = at(a, st.liftAt[1] + 0.2, 0);
      add(place(new THREE.BoxGeometry(0.24, st.top - st.level + 1.6, 0.24), q.x, y0 + (st.top - st.level + 1.6) / 2 - 0.3, q.z, 0, -a, 0), GRAPHITE);
      add(place(new THREE.IcosahedronGeometry(0.22, 0), q.x, y0 + st.top - st.level + 1.4, q.z), STONE);
    }
    const lift = { x: lp.x, z: lp.z, r: 1.7, y0, y1: st.top + 0.02, y: y0, t: 0, plat };
    this.lifts.push(lift);
    return { key: st.key, pos: sp, pool, glint, stream, wheel, lift, hex: null, running: false, turning: false, spin: 0, gapAt: null, top: new V3(sp.x, sp.y + 0.8, sp.z) };
  }

  /** The broken stretch of the second channel, and the trough someone sketched to carry the water over it. */
  buildTrough(bag, uTime, mid, from, to) {
    const len = from.distanceTo(to) + 0.5, ry = Math.atan2(to.x - from.x, to.z - from.z);
    const make = (pal) => {
      const b = new Bag();
      b.add(daub(place(new THREE.BoxGeometry(1.5, 0.16, len), 0, 0.02, 0), pal, { spread: 1 }));
      for (const s of [-1, 1]) b.add(daub(place(new THREE.BoxGeometry(0.16, 0.5, len), s * 0.72, 0.22, 0), pal, { spread: 1 }));
      for (const s of [-1, 1]) b.add(daub(place(new THREE.BoxGeometry(1.9, 0.3, 0.3), 0, -0.1, s * (len / 2 - 0.3)), pal, { spread: 1 }));
      return b;
    };
    const ghost = make(PAPER).mesh(ghostMaterial(uTime));
    ghost.position.set(mid.x, MID.y + 0.12, mid.z); ghost.rotation.y = ry; ghost.renderOrder = 3;
    this.scene.add(ghost);
    return { pos: new V3(mid.x, MID.y, mid.z), ry, ghost, real: null, hex: null, make, top: new V3(mid.x, MID.y + 0.8, mid.z) };
  }

  /** Is this point in the Underpainting at all? (It lives far beyond the first level's horizon.) */
  contains(p) { return p.z > 3000; }
  get done() { return this.source.done; }

  // ---------------------------------------------------------------------------------------------- painting
  setSpring(s, hex, instant = false) {
    const runs = RUNS.includes(PAINTS.findIndex((p) => p.hex === hex));
    s.hex = hex;
    s.pool.material.color.set(hex).multiplyScalar(runs ? 1.12 : 0.9);
    s.running = runs;
    if (runs) s.stream.mat.uniforms.tint.value.set(hex);
    s.stream.goal = !runs ? 0 : s.gapAt !== null && !this.trough.hex ? s.gapAt : 1;
    if (instant) s.stream.reach = s.stream.goal;
    return runs;
  }
  setTrough(hex) {
    const tr = this.trough, c = new THREE.Color(hex), tones = [0, 0.08, -0.08, 0.15].map((l) => '#' + c.clone().offsetHSL(0, 0, l).getHexString());
    if (tr.real) { this.scene.remove(tr.real); tr.real.geometry.dispose(); }
    tr.real = tr.make(tones).mesh(this.mesh.material);
    tr.real.position.copy(tr.ghost.position); tr.real.rotation.y = tr.ry;
    this.scene.add(tr.real);
    tr.ghost.visible = false; tr.hex = hex;
    const s = this.stages[1];
    if (s.running) s.stream.goal = 1;
  }
  setSource(hex, instant = false) {
    const src = this.source, runs = RUNS.includes(PAINTS.findIndex((p) => p.hex === hex));
    src.hex = hex; src.running = runs;
    src.pool.material.color.set(hex).multiplyScalar(runs ? 1.12 : 0.9);
    src.lily.visible = false;
    for (const f of src.falls) { if (runs) f.mat.uniforms.tint.value.set(hex); f.goal = runs ? 1 : 0; if (instant) f.reach = f.goal; }
    if (runs) src.done = true;
    return runs;
  }

  /** A swing of the brush landing at (x, z), from a painter standing at `p`. Returns what it did, for the game to answer. */
  strike(x, z, p, hex) {
    const out = [];
    if (!this.contains(p)) return out;
    const hit = (q, reach = 3.3) => Math.abs(q.y - p.y) < 3 && ((q.x - x) ** 2 + (q.z - z) ** 2 < reach * reach || (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 2.7 * 2.7);
    for (const s of this.stages) {
      if (s.hex === hex || !hit(s.pos)) continue;
      const was = s.running, runs = this.setSpring(s, hex);
      out.push({ type: runs ? 'run' : was ? 'stop' : 'still', at: s.top, stage: s });
    }
    if (this.trough.hex !== hex && hit(this.trough.pos, 3.6)) { const fresh = !this.trough.hex; this.setTrough(hex); out.push({ type: 'trough', at: this.trough.top, fresh }); }
    if (this.source.hex !== hex && hit(this.source.pos, 5.4)) {
      const first = !this.source.done, runs = this.setSource(hex);
      out.push({ type: runs ? (first ? 'source' : 'run') : 'still', at: new V3(this.source.pos.x, TOP.y + 1, this.source.pos.z) });
    }
    return out;
  }

  /** A dry spring (or the dry source) near the painter, if there is one: for the first hint. */
  drySpring(p) {
    for (const s of [...this.stages, this.source]) if (!s.hex && s.pos.distanceTo(p) < 9) return s;
    return null;
  }

  /** Where running water would carry someone standing in it: a direction, scaled by how strongly. */
  current(p, out) {
    out.set(0, 0, 0);
    for (const s of this.stages) {
      const st = s.stream;
      if (st.reach < 0.02 || Math.abs(st.pts[0].y - p.y) > 1.2) continue;
      const n = Math.floor(st.reach * (st.pts.length - 1));
      for (let i = 0; i < n; i++) {
        const a = st.pts[i];
        if ((a.x - p.x) ** 2 + (a.z - p.z) ** 2 < 0.8) { out.subVectors(st.pts[i + 1], a).setY(0).normalize(); return out; }
      }
    }
    return out;
  }

  save() { return { springs: this.stages.map((s) => s.hex || 0), trough: this.trough.hex || 0, source: this.source.hex || 0, done: this.source.done }; }
  load(d) {
    if (!d) return;
    const ok = (h) => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
    if (ok(d.trough)) this.setTrough(d.trough);
    (d.springs || []).forEach((h, i) => { if (ok(h) && this.stages[i]) this.setSpring(this.stages[i], h, true); });
    if (ok(d.source)) this.setSource(d.source, true);
    this.source.done = !!d.done || this.source.done;
    for (const s of this.stages) { s.turning = s.running && s.stream.reach > 0.97; }
  }

  // ---------------------------------------------------------------------------------------------- every frame
  update(dt, t, player) {
    const ev = this.events; ev.length = 0;
    if (!player || !this.contains(player.pos)) return ev;
    const ease = (st, rate) => {
      if (st.reach < st.goal) st.reach = Math.min(st.goal, st.reach + dt * rate);
      else if (st.reach > st.goal) st.reach = Math.max(st.goal, st.reach - dt * rate * 1.6);
      st.mat.uniforms.reach.value = st.reach; st.mesh.visible = st.reach > 0.001;
    };
    for (const s of this.stages) {
      ease(s.stream, 5.5 / s.stream.len);                           // the water comes on at a walking pace
      const was = s.turning;
      s.turning = s.running && s.stream.reach > 0.97;
      if (s.turning && !was) ev.push({ type: 'wheel', at: s.wheel.position });
      s.spin += ((s.turning ? 2.3 : 0) - s.spin) * (1 - Math.exp(-1.5 * dt));
      s.wheel.rotation.z -= s.spin * dt;
      // the lift: up, wait, down, wait, for as long as the wheel turns; then it comes to rest at the bottom
      const L = s.lift, span = L.y1 - L.y0;
      if (s.turning || L.t > 0) {
        L.t += dt;
        const c = L.t % 10.4, u = c < 1.4 ? 0 : c < 5 ? (c - 1.4) / 3.6 : c < 6.8 ? 1 : 1 - (c - 6.8) / 3.6;
        L.y = L.y0 + span * (u * u * (3 - 2 * u));
        if (!s.turning && c < 1.2) L.t = 0;                         // stopped: it finishes its trip down and stays
      } else L.y = L.y0;
      L.plat.position.y = L.y - 0.16;
      s.glint.material.opacity = s.hex ? 0 : 0.26 + Math.sin(t * 1.5 + s.pos.x) * 0.1;
    }
    for (const f of this.source.falls) ease(f, 0.55);
    this.source.lily.rotation.y = t * 0.3;
    // water waiting at the break in the channel: it slops over the edge
    const b = this.stages[1];
    if (b.running && !this.trough.hex && b.stream.reach >= b.gapAt - 0.001) {
      this.spillT -= dt;
      if (this.spillT <= 0) { this.spillT = 0.22; const i = Math.floor(b.gapAt * (b.stream.pts.length - 1)); ev.push({ type: 'spill', at: b.stream.pts[i], hex: b.hex }); }
    }
    return ev;
  }
}

/** The pictures on the two canvases that join the levels: a pencil drawing of the stair, and a blaze of the atelier. */
function doorPicture(colour) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 512;
  const x = c.getContext('2d'), r = mulberry32(colour ? 77 : 78);
  x.fillStyle = colour ? '#f6e2c0' : '#ddd6c6'; x.fillRect(0, 0, 384, 512);
  if (colour) {
    for (let i = 0; i < 260; i++) {
      x.fillStyle = PAINTS[Math.floor(r() * 8)].hex; x.globalAlpha = 0.5 + r() * 0.4;
      x.beginPath(); x.ellipse(r() * 384, r() * 512, 8 + r() * 34, 4 + r() * 12, r() * 3, 0, TAU); x.fill();
    }
    x.globalAlpha = 1;
    const g = x.createRadialGradient(192, 250, 10, 192, 250, 230); g.addColorStop(0, 'rgba(255,246,214,0.95)'); g.addColorStop(1, 'rgba(255,246,214,0)');
    x.fillStyle = g; x.fillRect(0, 0, 384, 512);
  } else {
    x.strokeStyle = 'rgba(40,38,56,0.95)'; x.lineCap = 'round';
    for (const [cy, rx, ry] of [[390, 150, 34], [300, 100, 24], [222, 54, 14]]) {
      for (let k = 0; k < 3; k++) { x.lineWidth = 3 + r() * 2.5; x.beginPath(); x.ellipse(192 + (r() - 0.5) * 4, cy + (r() - 0.5) * 4, rx, ry, 0, 0, TAU); x.stroke(); }
      x.lineWidth = 4; x.beginPath(); x.moveTo(192 - rx, cy); x.lineTo(192 - rx, cy + 60); x.moveTo(192 + rx, cy); x.lineTo(192 + rx, cy + 60); x.stroke();
    }
    for (let i = 0; i < 160; i++) {
      x.strokeStyle = `rgba(50,48,66,${0.25 + r() * 0.3})`; x.lineWidth = 2.2;
      const u = r() * 384, v = 60 + r() * 440; x.beginPath(); x.moveTo(u, v); x.lineTo(u + 10 + r() * 16, v - 6 - r() * 8); x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
