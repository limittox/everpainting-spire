import * as THREE from 'three';
import { rimR, surfY, islandTopGeo } from './world.js';
import { daub, place, Bag, paintify, glowSprite, drawStroke, mulberry32, clamp, smooth } from './util.js';
import { underside, makeStream, SPAN, STONE } from './underpainting.js';
import { PAGE } from './lastpage.js';
import { PAINTS } from './paint.js';

// Varnishing Day: the third level. The painter steps out of the painting into the gallery where it hangs, the
// day before the doors open. The pictures on the walls are nearly finished: each has too much of one thing and
// not enough of another, and here the brush learns to carry. It lifts a thing out of one picture and lays it
// down in another.
//
//   The Gallery    a round floor with the frames standing on it. Stepping into a frame is stepping into its picture.
//   The Flood      a drowned orchard: water almost to the top of its one hill. Lift the water (twice) and the
//                  ground comes back, ring by ring.
//   High Summer    a parched field, a dry spring and a dry mill pond. Each wants a brushful of water.
//
// The brush holds one thing at a time, and nothing is ever lost: whatever was laid down can be lifted again.
//
// And then it goes wrong. Once both pictures are finished, one of the dust sheets is found on the floor, and the
// painting it covered is a painting of this room, in grey, with someone standing in it wherever the painter stands.
// Stepping into it leads to the same room with the colour gone out of it, the companions nowhere, every other
// frame shut, and somebody in each of the pictures. From here on the game is not the gentle one it began as.
// (It all lives far to the east of everything else, in the same scene.)

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const HALL = { x: 4000, y: 0, z: 1000, r: 19, ph: 0.4, name: 'The Gallery', pale: true };
const FLOOD = { x: 6000, y: 0, z: 1000, r: 25, ph: 2.1, name: 'The Flood', pale: true };
const SUMMER = { x: 8000, y: 0, z: 1000, r: 26, ph: 5.2, name: 'High Summer', pale: true };

const HILL = 3.2, LEVELS = [-0.6, 1.25, 2.6];                       // the Flood's hill, and how high the water stands on it
const hill = (d) => HILL * (1 - smooth(clamp((d - 3.5) / 17.5, 0, 1)));
/** How far from the middle of the Flood the water's edge is, with the water standing `wy` high. */
function shoreR(wy) {
  if (wy <= 0.02) return 99;
  let a = 0, b = 21;
  for (let i = 0; i < 14; i++) { const m = (a + b) / 2; if (hill(m) > wy) a = m; else b = m; }
  return a;
}

const WOOD = ['#a87848', '#c29460', '#9c6c40', '#cda470', '#b4844f'];
const MEADOW = ['#7f9a7a', '#93a888', '#6f8a78', '#a2b094', '#84a092'];
const PARCHED = ['#d2b477', '#e2cc96', '#c9a868', '#ead8a8', '#bf9c5c'];
const EARTH = ['#8a6a50', '#a07c5c', '#75584a', '#b08e6a', '#6a5046'];
const CLOTH = ['#efe8da', '#e2d9c8', '#f6f1e6', '#d6ccba'];
const GILT = ['#d9b25a', '#c99a3e', '#ecd084', '#b8862e'];
const WATER = '#58c0e8';

/** A ground canvas laid in brush strokes. `ang(i)` gives each stroke its direction; `extra` draws on top. */
function ground(isl, size, base, pal, n, seed, ang = null, extra = null) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), r = mulberry32(seed), span = 2 * isl.r * SPAN, px = size / span;
  x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * isl.r * 1.2;
    drawStroke(x, (Math.cos(a) * d / span + 0.5) * size, (Math.sin(a) * d / span + 0.5) * size, ang ? ang(i) : r() * TAU, (1.4 + r() * 2.4) * px, (0.5 + r() * 0.8) * px, pal[i % pal.length], 'rgba(255,255,255,0.22)', 'rgba(0,0,0,0.14)', r);
  }
  if (extra) extra(x, (wx) => ((wx - isl.x) / span + 0.5) * size, (wz) => ((wz - isl.z) / span + 0.5) * size, px);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** A small painted canvas, for a frame. */
function picture(base, pal, seed, extra = null) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const x = c.getContext('2d'), r = mulberry32(seed);
  x.fillStyle = base; x.fillRect(0, 0, 256, 320);
  for (let i = 0; i < 120; i++) drawStroke(x, r() * 256, r() * 320, (r() - 0.5) * 0.7, 26 + r() * 50, 8 + r() * 12, pal[i % pal.length], 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.12)', r);
  if (extra) extra(x, r);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Someone, seen from behind (or from in front: there is no face either way), with a brush across their back. */
function figure(x, u, v, s, col) {
  x.fillStyle = x.strokeStyle = col;
  x.beginPath(); x.moveTo(u - 13 * s, v); x.lineTo(u + 13 * s, v); x.lineTo(u + 7 * s, v - 44 * s); x.lineTo(u - 7 * s, v - 44 * s); x.closePath(); x.fill();
  x.beginPath(); x.arc(u, v - 52 * s, 9 * s, 0, TAU); x.fill();
  x.fillRect(u - 12 * s, v - 61 * s, 24 * s, 4 * s);
  x.lineWidth = 2.5 * s; x.lineCap = 'round'; x.beginPath(); x.moveTo(u + 12 * s, v - 6 * s); x.lineTo(u + 20 * s, v - 68 * s); x.stroke();
}
/** A picture with somebody in it who was not there before. */
function haunted(tex) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const x = c.getContext('2d');
  x.drawImage(tex.image, 0, 0); figure(x, 128, 282, 1.2, '#f6f4ee');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** The gallery itself, as a picture: its floor, its frames, and in the middle the frame this picture hangs in. */
function roomPicture(empty) {
  const wall = empty ? ['#d6d4d8', '#e0dee2', '#cac8ce', '#e8e6ea'] : ['#b4b2b8', '#c0bec4', '#a8a6ac', '#c8c6cc'];
  return picture(wall[0], wall, empty ? 91 : 90, (x, r) => {
    const floor = empty ? ['#a09ea6', '#96949c', '#aaa8b0', '#8c8a92'] : ['#8a8890', '#807e86', '#94929a', '#76747c'];
    for (let i = 0; i < 70; i++) drawStroke(x, r() * 256, 240 + r() * 84, (r() - 0.5) * 0.3, 30 + r() * 50, 9 + r() * 10, floor[i % floor.length], 'rgba(255,255,255,0.2)', 'rgba(0,0,0,0.14)', r);
    const hang = (u, v, w, h, fill) => { x.fillStyle = fill; x.fillRect(u, v, w, h); x.strokeStyle = '#55535a'; x.lineWidth = 5; x.strokeRect(u, v, w, h); };
    hang(16, 98, 48, 62, '#8a888e'); hang(192, 98, 48, 62, '#a3a1a6');
    hang(92, 70, 72, 96, '#3a3840');
    x.fillStyle = '#6a686e'; x.fillRect(96, 140, 64, 22);
    if (!empty) figure(x, 128, 158, 0.24, '#c8c6cc');
  });
}

const giltMat = new THREE.MeshLambertMaterial({ color: 0xd9b25a, emissive: 0x4a3410, flatShading: true });
/** A gilt frame standing on the floor, `w` by `h` inside, with a picture in it (or bare boards). */
function frame(w, h, tex) {
  const g = new THREE.Group(), t = 0.36, y0 = 0.5;
  for (const [bw, bh, x, y] of [[w + 2 * t, t, 0, y0 + h + t / 2], [w + 2 * t, t, 0, y0 - t / 2], [t, h, -(w + t) / 2, y0 + h / 2], [t, h, (w + t) / 2, y0 + h / 2]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.34), giltMat); bar.position.set(x, y, 0); g.add(bar);
  }
  for (const s of [-1, 1]) { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 1.5), giltMat); foot.position.set(s * (w / 2), 0.17, 0); g.add(foot); }
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08).translate(0, y0 + h / 2, -0.08), new THREE.MeshLambertMaterial({ color: 0x4a4048, emissive: 0x16131a })));
  if (tex) { g.userData.pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, y0 + h / 2, 0.02), new THREE.MeshBasicMaterial({ map: tex, fog: false })); g.add(g.userData.pic); }
  return g;
}

/** The Flood's hill: ground that rises toward the middle, textured from the island's one canvas by where it lies. */
function hillGeo(isl, R = 21, K = 26, S = 72) {
  const pos = [], uv = [], idx = [];
  for (let k = 0; k <= K; k++) for (let i = 0; i <= S; i++) {
    const th = (i / S) * TAU, rad = (R * k) / K, x = isl.x + Math.cos(th) * rad, z = isl.z + Math.sin(th) * rad;
    pos.push(x, surfY(isl, x, z) + hill(rad) + 0.03, z);
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

/** Standing water over a whole island, in one piece: the flat of it, and the curtain where it pours off the rim. */
function floodMesh(isl, uTime, S = 96, H = 16) {
  const pos = [0, 0, 0], idx = [];
  for (const y of [0, -H]) for (let i = 0; i <= S; i++) { const th = (i / S) * TAU, r = rimR(isl, th) * 1.03; pos.push(Math.cos(th) * r, y, Math.sin(th) * r); }
  for (let i = 0; i < S; i++) { const a = 1 + i, b = a + S + 1; idx.push(0, a + 1, a, a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: uTime, tint: { value: new THREE.Color('#7fb0cc') }, depth: { value: H } },
    vertexShader: /* glsl */ `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
precision highp float;
uniform float time; uniform vec3 tint; uniform float depth;
varying vec3 vPos;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float fall = clamp(-vPos.y / depth, 0.0, 1.0);
  vec2 p = fall > 0.001 ? vec2(atan(vPos.z, vPos.x) * 16.0, vPos.y * 0.45 + time * 1.9) : vPos.xz * 0.33 + vec2(time * 0.13, time * 0.08);
  float n = vnoise(p), s = vnoise(p * 2.7 + 9.0);
  vec3 col = tint * (0.74 + 0.4 * n);
  col = mix(col, vec3(1.0), smoothstep(0.68, 0.92, s) * 0.5);
  gl_FragColor = vec4(col, 0.86 * pow(1.0 - fall, 1.4));
}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false; m.renderOrder = 2;
  return m;
}

export class Gallery {
  /** `atelier` is the middle of the Spire's hall: once the gallery has been found, a frame stands there that leads back to it. */
  constructor(scene, world, uTime, lastpage, atelier) {
    this.scene = scene; this.lastpage = lastpage; this.found = false;
    this.slipped = false; this.grey = false; this.hung = [];
    const bag = new Bag(), add = (g, pal, o) => bag.add(daub(g, pal, o)), r = mulberry32(5521);
    const island = (def, tex, rock) => {
      const isl = { ...def, index: world.islands.length };
      isl.tex = tex(isl); isl.span = 2 * isl.r * SPAN;
      world.islands.push(isl);
      scene.add(new THREE.Mesh(islandTopGeo(isl), paintify(new THREE.MeshLambertMaterial({ map: isl.tex }), { scale: 1, amp: 0.45 })));
      bag.add(underside(isl, 8, 40, rock));
      return isl;
    };
    const hall = island(HALL, (i) => ground(i, 1024, '#b98a5a', WOOD, 1500, 71, (k) => (k % 2 ? 1 : -1) * Math.PI / 4), [...WOOD, ...EARTH]);
    const flood = island(FLOOD, (i) => ground(i, 2048, '#8fa08c', MEADOW, 2600, 72), EARTH);
    const summer = island(SUMMER, (i) => ground(i, 2048, '#d9c08a', PARCHED, 2600, 73), EARTH);
    this.hall = hall;

    // every frame that can be stepped through: where it stands, what E says, and where it leads
    this.doors = [];
    const stand = (g, at, facing) => { g.position.copy(at); g.rotation.y = Math.atan2(facing.x - at.x, facing.z - at.z); scene.add(g); world.colliders.push({ x: at.x, z: at.z, r: 1.7, late: true }); return g; };
    /** Coming out of a frame: a few steps in front of it, turned to walk along it, so the camera has room behind. */
    const arrive = (at, centre, isl, floor) => {
      const d = new V3(centre.x - at.x, 0, centre.z - at.z).normalize(), p = at.clone().addScaledVector(d, 5.5);
      p.y = floor(p.x, p.z);
      return { pos: p, heading: Math.atan2(d.x, d.z) + Math.PI / 2, island: isl.index };
    };
    const lit = (g, h) => { const glow = glowSprite(world.glowTex, 8, 0xffe6b0, 0.4); glow.position.set(0, 0.5 + h / 2, 0.9); g.add(glow); return g; };
    const flat = (isl) => (x, z) => surfY(isl, x, z);
    const hp = (a, rad) => { const x = HALL.x + Math.cos(a) * rad, z = HALL.z + Math.sin(a) * rad; return new V3(x, surfY(HALL, x, z), z); };
    const centre = (isl) => new V3(isl.x, isl.y, isl.z);

    // --- the pictures, as they look from outside
    const pic = {
      flood: picture('#8ea4b4', ['#7f9ab0', '#9cb2c2', '#6c8aa2', '#b4c4cc'], 81, (x) => { x.fillStyle = '#7f9a7a'; x.beginPath(); x.ellipse(128, 250, 62, 26, 0, 0, TAU); x.fill(); x.fillStyle = '#5c7a62'; for (const u of [70, 190, 40, 226]) { x.beginPath(); x.arc(u, 232 + (u % 3) * 6, 13, 0, TAU); x.fill(); } }),
      summer: picture('#ecd08a', ['#e6c470', '#f2dc9c', '#dcb45c', '#f8e8b4'], 82, (x) => { const g = x.createRadialGradient(170, 70, 4, 170, 70, 70); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 320); }),
      hall: picture('#e8dcc8', ['#d9b25a', '#efe4d0', '#c8a070', '#f6eedf'], 83, (x) => { x.strokeStyle = '#8a6a3a'; x.lineWidth = 7; for (const [u, v] of [[40, 90], [150, 70], [96, 190]]) x.strokeRect(u, v, 64, 80); }),
      home: picture('#f6e2c0', PAINTS.slice(0, 8).map((p) => p.hex), 84, (x) => { const g = x.createRadialGradient(128, 150, 8, 128, 150, 150); g.addColorStop(0, 'rgba(255,246,214,0.9)'); g.addColorStop(1, 'rgba(255,246,214,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 320); }),
    };

    // --- the Gallery: frames round a wooden floor
    {
      const W = 3.6, H = 4.8;
      // the way in: a frame on the Blank Page (it stands once the sun is drawn). The way home leads to the Spire's
      // atelier, where a frame of its own stands from then on, so the gallery is never more than a step away.
      const backAt = hp(Math.PI / 2, 15.5), pageAt = new V3(PAGE.x, surfY(PAGE, PAGE.x, PAGE.z - 14.5), PAGE.z - 14.5), pageMid = new V3(PAGE.x, PAGE.y, PAGE.z);
      const homeAt = new V3(atelier.x + Math.sin(1.2 * Math.PI) * 9.6, atelier.y, atelier.z + Math.cos(1.2 * Math.PI) * 9.6);
      stand(lit(frame(W, H, pic.home), H), backAt, centre(HALL));
      this.pageDoor = stand(lit(frame(W, H, pic.hall), H), pageAt, pageMid);
      this.homeDoor = stand(lit(frame(W, H, pic.hall), H), homeAt, new V3(atelier.x, 0, atelier.z + 8));
      this.homeCol = world.colliders[world.colliders.length - 1];
      this.entry = arrive(backAt, centre(HALL), hall, flat(HALL));
      const dir = new V3(atelier.x - homeAt.x, 0, atelier.z - homeAt.z).normalize(), h = Math.atan2(dir.x, dir.z);
      const welcome = ['Varnishing Day', 'The day before the doors open'];
      this.doors.push({ at: pageAt, text: 'Step through the frame', to: this.entry, toast: welcome, open: () => lastpage.done });
      this.doors.push({ at: homeAt, text: 'Step through the frame', to: this.entry, toast: welcome, open: () => this.found });
      // (in the atelier the camera goes out into the hall, looking back at the painter and the frame they stepped out of)
      this.doors.push({ at: backAt, text: 'Step back into the Spire', to: { pos: homeAt.clone().addScaledVector(dir, 3), heading: h, yaw: h }, toast: ['The Atelier', 'Inside the Spire'], out: true });

      // two pictures that can be stepped into; their own frames, inside them, lead back here
      const floodFloor = (x, z) => surfY(FLOOD, x, z) + hill(Math.hypot(x - FLOOD.x, z - FLOOD.z));
      const pair = (a, isl, tex, toast, inAt, floor) => {
        const at = hp(a, 15.5);
        this.hung.push({ at, pic: stand(lit(frame(W, H, tex), H), at, centre(HALL)).userData.pic, tex, grey: haunted(tex) });
        stand(lit(frame(W, H, pic.hall), H), inAt, centre(isl));
        this.doors.push({ at, text: 'Step into the picture', to: arrive(inAt, centre(isl), isl, floor), toast });
        this.doors.push({ at: inAt, text: 'Step back out of the picture', to: arrive(at, centre(HALL), hall, flat(HALL)), toast: ['The Gallery', ''], out: true });
      };
      const fAt = new V3(FLOOD.x, 0, FLOOD.z + 4.6); fAt.y = floodFloor(fAt.x, fAt.z);
      const sAt = new V3(SUMMER.x, 0, SUMMER.z + 20.5); sAt.y = surfY(SUMMER, sAt.x, sAt.z);
      pair(Math.PI * 0.92, flood, pic.flood, ['The Flood', 'More water than it wants'], fAt, floodFloor);
      pair(Math.PI * 0.08, summer, pic.summer, ['High Summer', 'Not a drop'], sAt, flat(SUMMER));
      this.sAt = sAt;

      // one more is still under its dust sheet, and the biggest frame of all is empty
      const sheet = (at) => place(new THREE.BoxGeometry(W + 1.1, H + 0.9, 0.8, 6, 6, 1), at.x, at.y + 0.5 + H / 2 + 0.1, at.z, 0, Math.atan2(HALL.x - at.x, HALL.z - at.z), 0);
      const drapedAt = hp(Math.PI * -0.73, 15.5);
      stand(frame(W, H, null), drapedAt, centre(HALL));
      add(sheet(drapedAt), CLOTH, { scale: 0.5, spread: 1 });
      this.draped = [drapedAt];
      // the other sheet comes off by itself, when both pictures are finished and nobody is in the room to see it go.
      // What it covered is a picture of this room, painted afresh whenever the painter moves (see update)
      {
        const at = hp(Math.PI * -0.27, 15.5), n = new V3(HALL.x - at.x, 0, HALL.z - at.z).normalize();
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320;
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
        stand(frame(W, H, tex), at, centre(HALL));
        const cloth = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x18171c }), { scale: 1.1, amp: 0.5 });
        const on = new THREE.Mesh(daub(sheet(at), CLOTH, { scale: 0.5, spread: 1 }), cloth);
        const off = new THREE.Mesh(daub(place(new THREE.IcosahedronGeometry(1, 2), at.x + n.x * 2.4 + n.z * 1.2, at.y + 0.14, at.z + n.z * 2.4 - n.x * 1.2, 0, 0.7, 0, 2.1, 0.17, 1.4), CLOTH, { scale: 0.5, spread: 1 }), cloth);
        scene.add(on, off);
        this.odd = { at, n, right: new V3(n.z, 0, -n.x), cv, tex, on, off, key: '', rooms: [roomPicture(false), roomPicture(true)] };
        this.doors.push({ at, text: 'Step into the picture', to: arrive(at, centre(HALL), hall, flat(HALL)), odd: true, open: () => this.slipped });
      }
      this.empty = hp(-Math.PI / 2, 15.2);
      stand(frame(6.4, 7.6, null), this.empty, centre(HALL));
      world.colliders.push({ x: this.empty.x - 2.2, z: this.empty.z, r: 1.4, late: true }, { x: this.empty.x + 2.2, z: this.empty.z, r: 1.4, late: true });

      // a round bench in the middle, and more of the gallery hanging far off in the haze
      add(place(new THREE.CylinderGeometry(2.3, 2.3, 0.55, 20), HALL.x, HALL.y + 0.3, HALL.z), ['#7a3c34', '#8c4a3e', '#6a3230'], { scale: 0.5 });
      world.colliders.push({ x: HALL.x, z: HALL.z, r: 2.3, late: true });
      for (let k = 0; k < 9; k++) {
        const a = r() * TAU, d = 62 + r() * 60, w = 14 + r() * 16, h = w * (0.7 + r() * 0.7), x = HALL.x + Math.cos(a) * d, z = HALL.z + Math.sin(a) * d, y = -14 + r() * 40, ry = Math.atan2(HALL.x - x, HALL.z - z);
        add(place(new THREE.BoxGeometry(w + 2.4, h + 2.4, 0.8), x, y, z, 0, ry, 0), GILT, { scale: 0.2 });
        add(place(new THREE.BoxGeometry(w, h, 1.2), x, y, z, 0, ry, 0), [MEADOW, PARCHED, WOOD, CLOTH, ['#7f9ab0', '#9cb2c2', '#6c8aa2']][k % 5], { scale: 0.16, spread: 1 });
      }
    }

    // --- the Flood: a hill in the middle, an orchard round it, and water over nearly all of it
    {
      const F = (this.flood = { level: 2, wy: LEVELS[2], dryK: 0 });
      const topMat = paintify(new THREE.MeshLambertMaterial({ map: flood.tex }), { scale: 1, amp: 0.45 });
      scene.add(new THREE.Mesh(hillGeo(FLOOD), topMat));
      F.water = floodMesh(FLOOD, uTime);
      F.water.position.set(FLOOD.x, FLOOD.y + F.wy, FLOOD.z);
      scene.add(F.water);
      // the orchard: grey with wet while it stands in water; it flowers when the ground is dry
      const crowns = new Bag();
      for (let k = 0; k < 15; k++) {
        const a = (k / 15) * TAU + (r() - 0.5) * 0.25, d = 10.5 + (k % 3) * 3.3 + r(), x = FLOOD.x + Math.cos(a) * d, z = FLOOD.z + Math.sin(a) * d, y = surfY(FLOOD, x, z) + hill(d), s = 0.9 + r() * 0.35;
        if (Math.abs(a - Math.PI / 2) < 0.35 && d < 12) continue;                         // (keep the view from the frame open)
        add(place(new THREE.CylinderGeometry(0.17 * s, 0.32 * s, 4.2 * s, 6), x, y + 2.1 * s, z, 0, 0, 0.06), EARTH, { scale: 0.6 });
        for (const [ox, oy, oz, rr] of [[0, 5.0, 0, 1.7], [1.2, 4.3, 0.4, 1.2], [-1.1, 4.4, -0.5, 1.25], [0.2, 6.1, -0.3, 1.0]]) {
          crowns.add(daub(place(new THREE.IcosahedronGeometry(rr * s, 1), x + ox * s, y + oy * s, z + oz * s, 0, rr * 2, 0, 1, 0.74, 1), ['#ffffff', '#f2f0ee', '#e6e2e4', '#fbf6f8'], { scale: 0.5, spread: 1 }));
        }
        world.colliders.push({ x, z, r: 0.5 * s, late: true });
      }
      F.crownMat = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x1a1c1c }), { scale: 1.1, amp: 0.5 });
      F.crowns = crowns.mesh(F.crownMat);
      F.crowns.frustumCulled = false;
      scene.add(F.crowns);
      world.paintable.push(F.crowns);
    }

    // --- High Summer: a dry spring, the bed its stream once ran in, a dry pond, a mill, and wheat gone to straw
    {
      const S = (this.summer = { wetK: [0, 0] });
      const sp = (a, rad) => { const x = SUMMER.x + Math.cos(a) * rad, z = SUMMER.z + Math.sin(a) * rad; return new V3(x, surfY(SUMMER, x, z), z); };
      const springAt = sp(1.95, 12), pondAt = sp(-1.35, 13), rimA = 0.4, rimAt = sp(rimA, rimR(SUMMER, rimA) + 0.2);
      const bed = new THREE.CatmullRomCurve3([springAt, sp(1.6, 11), sp(1.2, 12.5), sp(0.8, 16), sp(0.5, 21), rimAt]).getSpacedPoints(60);
      bed.forEach((p) => { p.y = surfY(SUMMER, p.x, p.z) + 0.1; });
      // the dry bed, and the cracks of a long drought, drawn onto the ground
      {
        const cv = summer.tex.image, x = cv.getContext('2d'), span = summer.span, U = (wx) => ((wx - SUMMER.x) / span + 0.5) * cv.width, V = (wz) => ((wz - SUMMER.z) / span + 0.5) * cv.width, px = cv.width / span;
        x.lineCap = 'round'; x.lineJoin = 'round';
        x.strokeStyle = 'rgba(150,118,72,0.75)'; x.lineWidth = 1.5 * px; x.beginPath(); bed.forEach((p, i) => (i ? x.lineTo(U(p.x), V(p.z)) : x.moveTo(U(p.x), V(p.z)))); x.stroke();
        x.fillStyle = 'rgba(150,118,72,0.8)'; x.beginPath(); x.arc(U(pondAt.x), V(pondAt.z), 4.4 * px, 0, TAU); x.fill();
        x.strokeStyle = 'rgba(110,84,50,0.55)'; x.lineWidth = 0.09 * px;
        for (let i = 0; i < 90; i++) {
          let a = r() * TAU, d = Math.sqrt(r()) * 23, wx = SUMMER.x + Math.cos(a) * d, wz = SUMMER.z + Math.sin(a) * d, t = r() * TAU;
          x.beginPath(); x.moveTo(U(wx), V(wz));
          for (let k = 0; k < 5; k++) { t += (r() - 0.5) * 1.6; wx += Math.cos(t) * (0.5 + r()); wz += Math.sin(t) * (0.5 + r()); x.lineTo(U(wx), V(wz)); }
          x.stroke();
        }
        summer.tex.needsUpdate = true;
      }
      const dry = () => new THREE.MeshBasicMaterial({ color: 0x9a8460, fog: false });
      const spot = (key, pos, rad, reach, lay, lift) => {
        add(place(new THREE.TorusGeometry(rad, rad * 0.16, 5, 22), pos.x, pos.y + 0.16, pos.z, Math.PI / 2, 0, 0), STONE, { scale: 0.8 });
        const pool = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.94, 24).rotateX(-Math.PI / 2), dry());
        pool.position.set(pos.x, pos.y + 0.2, pos.z);
        const glint = glowSprite(world.glowTex, rad * 3, 0xffffff, 0.3); glint.position.set(pos.x, pos.y + 1.1, pos.z);
        scene.add(pool, glint);
        return { key, pos, reach, lay, lift, pool, glint, wet: false, top: new V3(pos.x, pos.y + 0.9, pos.z) };
      };
      S.spots = [spot('spring', springAt, 1.3, 4.2, 'Lay the water in the spring', 'Lift the water out of the spring'), spot('pond', pondAt, 4.2, 6.6, 'Lay the water in the pond', 'Lift the water out of the pond')];
      add(place(new THREE.BoxGeometry(0.9, 1.5, 0.7), springAt.x - 1.4, springAt.y + 0.7, springAt.z + 0.6, 0, 0.5, 0), STONE, { scale: 0.8 });
      // the stream, and where it goes over the edge
      S.stream = makeStream(scene, uTime, bed, 1.15);
      const out = new V3(Math.cos(rimA), 0, Math.sin(rimA)), tangent = new V3(-Math.sin(rimA), 0, Math.cos(rimA)), lip = bed[bed.length - 1];
      S.fall = makeStream(scene, uTime, [lip.clone().addScaledVector(out, -0.8), lip.clone().addScaledVector(out, 0.3), lip.clone().addScaledVector(out, 0.7).setY(lip.y - 0.7), lip.clone().addScaledVector(out, 0.9).setY(lip.y - 20)], 1.6, () => tangent);
      for (const st of [S.stream, S.fall]) st.mat.uniforms.tint.value.set(WATER);

      // the mill beside the pond: a hut, and a wheel that only turns when there is water under it
      const hut = new V3(pondAt.x - 6.6, pondAt.y, pondAt.z - 0.6);
      add(place(new THREE.BoxGeometry(3.4, 2.8, 3.2), hut.x, hut.y + 1.4, hut.z), ['#f2e6cc', '#e6d6b4', '#f8eed8'], { scale: 0.5 });
      add(place(new THREE.ConeGeometry(3.1, 2.0, 4), hut.x, hut.y + 3.8, hut.z, 0, Math.PI / 4, 0), ['#c8643c', '#b4502c', '#d87a4a'], { scale: 0.5 });
      world.colliders.push({ x: hut.x, z: hut.z, r: 2.4, late: true });
      const wheel = new THREE.Group(), grey = new THREE.MeshLambertMaterial({ color: 0x8a6a4a, emissive: 0x241a12, flatShading: true });
      wheel.position.set(pondAt.x - 3.9, pondAt.y + 1.75, pondAt.z - 0.6); wheel.rotation.y = Math.PI / 2;
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 5, 22), grey), new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 6).rotateX(Math.PI / 2), grey));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU, paddle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.75), grey), spoke = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.5, 0.07), grey);
        paddle.position.set(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0); paddle.rotation.z = a + Math.PI / 2;
        spoke.position.set(Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0); spoke.rotation.z = a + Math.PI / 2;
        wheel.add(paddle, spoke);
      }
      scene.add(wheel);
      S.wheel = wheel; S.spin = 0;

      // wheat: the south field drinks from the stream, the north field from the pond
      const fields = [new Bag(), new Bag()], sAt = this.sAt;
      for (let i = 0; i < 620; i++) {
        const a = r() * TAU, d = 2 + Math.sqrt(r()) * 20.5, x = SUMMER.x + Math.cos(a) * d, z = SUMMER.z + Math.sin(a) * d, y = surfY(SUMMER, x, z);
        const near = (q, rad) => (q.x - x) ** 2 + (q.z - z) ** 2 < rad * rad;
        if (near(springAt, 3) || near(pondAt, 5.6) || near(hut, 3.4) || near(sAt, 7) || bed.some((q, k) => k % 2 === 0 && near(q, 1.5))) continue;
        for (let k = 0; k < 3; k++) {
          const h = 1.0 + r() * 0.6;
          fields[z > SUMMER.z - 3 ? 0 : 1].add(daub(place(new THREE.ConeGeometry(0.075, h, 4, 1), x + (r() - 0.5) * 0.5, y + h / 2, z + (r() - 0.5) * 0.5, (r() - 0.5) * 0.3, r() * 3, (r() - 0.5) * 0.3), ['#ffffff', '#f4f0e4', '#e8e2d2'], { scale: 0.8, spread: 1 }));
        }
      }
      S.wheat = fields.map((f) => { const m = f.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x201808 }), { scale: 1.2, amp: 0.4 })); m.frustumCulled = false; scene.add(m); return m; });
      // too much light: slice two will have something to say about this
      const sun = glowSprite(world.glowTex, 170, 0xfff4c8, 0.9); sun.position.set(SUMMER.x - 30, SUMMER.y + 95, SUMMER.z - 270);
      scene.add(sun);
    }

    // --- what the brush is carrying: a bead of it rides on the brush
    this.carry = null;
    this.bead = new THREE.Group();
    this.bead.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshBasicMaterial({ color: 0x8fdcff, fog: false })), glowSprite(world.glowTex, 1.7, 0x9fdcff, 0.7));
    this.bead.visible = false;
    scene.add(this.bead);

    this.mesh = bag.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x18171c }), { scale: 1.1, amp: 0.5 }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    world.paintable.push(this.mesh);

    // --- ground: the Flood's hill
    const base = world.groundHeight;
    world.groundHeight = (x, z, maxY) => {
      const best = base(x, z, maxY), d = Math.hypot(x - FLOOD.x, z - FLOOD.z);
      if (d > 21) return best;
      const top = surfY(FLOOD, x, z) + hill(d);
      return top <= maxY && top > best ? top : best;
    };
    this._v = new V3();
  }

  /** Is this point in the gallery or one of its pictures? (They lie far to the east of everything else.) */
  contains(p) { return p.x > 3000; }
  where(p) { return p.x < 3000 ? null : p.x < 5000 ? 'hall' : p.x < 7000 ? 'flood' : 'summer'; }
  get dry() { return this.flood.level === 0; }
  get watered() { return this.summer.spots.every((s) => s.wet); }
  get done() { return this.dry && this.watered; }

  /** The sky and light for where the camera is: which look, and how far along it. */
  look(p) {
    const w = this.where(p);
    return !w ? null : w === 'hall' ? { name: this.grey ? 'grey' : 'hall', at: 0 } : w === 'flood' ? { name: 'flood', at: 1 - clamp(this.flood.wy / LEVELS[2], 0, 1) } : { name: 'summer', at: (this.summer.wetK[0] + this.summer.wetK[1]) / 2 };
  }

  /** What E would do for a painter standing at `p`, if anything: step through a frame, lift something, lay it down. */
  near(p) {
    for (const d of this.doors) if ((!d.open || d.open()) && (!this.grey || d.odd) && Math.abs(d.at.y - p.y) < 2.5 && d.at.distanceTo(p) < 3.9) return { type: 'door', door: d, text: d.text };
    const w = this.where(p), F = this.flood;
    if (w === 'flood') {
      const d = Math.hypot(p.x - FLOOD.x, p.z - FLOOD.z), edge = F.level === 0 ? d > 12 && d < 21 : d > shoreR(F.wy) - 2.4;      // (with no water left, the low ground is where it goes back)
      if (!edge || p.y > FLOOD.y + HILL + 1) return null;
      const at = new V3(p.x, p.y + 0.8, p.z);
      if (!this.carry && F.level > 0) return { type: 'lift', text: 'Lift the water', at };
      if (this.carry === 'water' && F.level < 2) return { type: 'lay', text: 'Pour the water back', at };
    }
    if (w === 'summer') for (const s of this.summer.spots) {
      if (s.pos.distanceTo(p) > s.reach) continue;
      if (!this.carry && s.wet) return { type: 'lift', text: s.lift, at: s.top, spot: s };
      if (this.carry === 'water' && !s.wet) return { type: 'lay', text: s.lay, at: s.top, spot: s };
    }
    return null;
  }

  /** Lift or lay, as `near` offered. Returns what happened, and the name of a picture this has just finished. */
  act(a) {
    const F = this.flood;
    if (a.type === 'lift') {
      this.carry = 'water';
      if (a.spot) a.spot.wet = false; else F.level--;
      return { type: 'lift', at: a.at, finished: !a.spot && F.level === 0 ? ['The Flood', 'The orchard stands on dry ground'] : null };
    }
    this.carry = null;
    if (a.spot) a.spot.wet = true; else F.level++;
    return { type: 'lay', at: a.at, finished: a.spot && this.watered ? ['High Summer', 'The field has its water'] : null };
  }

  /** Something here the painter is standing by and may not understand yet: a line to say about it, once. */
  waiting(p) {
    const w = this.where(p);
    if (w === 'hall' && this.grey) {
      if (this.hung.some((h) => h.at.distanceTo(p) < 6)) return { key: 'someone', line: 'There is someone in it.' };
      return { key: 'grey', line: 'It is the same room.' };
    }
    if (w === 'hall') {
      if (this.slipped && this.odd.at.distanceTo(p) < 7) return { key: 'odd', line: 'A painting of this room. Whoever is in it is standing where you are.' };
      if (this.draped.some((q) => q.distanceTo(p) < 4.6)) return { key: 'draped', line: 'Still under its dust sheet. It has not been hung yet.' };
      if (this.empty.distanceTo(p) < 5.5) return { key: 'emptyframe', line: 'An empty frame, bigger than all the others.' };
      if (this.slipped) return { key: 'slipped', line: 'One of the dust sheets is on the floor. Nobody has been in here.' };
    }
    if (w === 'flood' && this.flood.level === 2) return { key: 'flood', line: 'Water, almost to the top of the hill. Here the brush can lift as well as paint: go down to the water’s edge.' };
    if (w === 'summer' && !this.watered) {
      if (this.carry) return { key: 'wants', line: 'The brush is still holding the water. Something here is waiting for it.' };
      if (this.summer.spots.some((s) => !s.wet && s.pos.distanceTo(p) < 9)) return { key: 'parched', line: 'Bone dry. No colour will run here: it wants real water, from somewhere that has too much.' };
    }
    return null;
  }

  save() { return { level: this.flood.level, wet: this.summer.spots.map((s) => (s.wet ? 1 : 0)), slipped: this.slipped ? 1 : 0, grey: this.grey ? 1 : 0 }; }
  load(d) {
    if (!d) return;
    this.slipped = !!d.slipped; this.grey = this.slipped && !!d.grey;
    const F = this.flood, S = this.summer, level = [0, 1, 2].includes(d.level) ? d.level : 2, wet = S.spots.map((_, i) => !!(d.wet && d.wet[i]));
    const held = 2 - level - wet.filter(Boolean).length;          // there are two brushfuls in all: any that is nowhere is on the brush
    if (held < 0 || held > 1) return;
    F.level = level; F.wy = LEVELS[level]; F.dryK = level === 0 ? 1 : 0;
    S.spots.forEach((s, i) => { s.wet = wet[i]; S.wetK[i] = wet[i] ? 1 : 0; });
    S.stream.reach = S.fall.reach = wet[0] ? 1 : 0;
    this.carry = held ? 'water' : null;
  }

  update(dt, t, player, blots = null) {
    const F = this.flood, S = this.summer, ease = (k) => 1 - Math.exp(-k * dt);
    // the sheet goes while nobody is looking; the picture under it shows whoever is in the room, from behind
    const O = this.odd, inHall = !!player && this.where(player.pos) === 'hall';
    if (!this.slipped && this.done && player && !inHall) this.slipped = true;
    O.on.visible = !this.slipped; O.off.visible = this.slipped;
    if (this.slipped && inHall) {
      const dx = player.pos.x - O.at.x, dz = player.pos.z - O.at.z, lat = dx * O.right.x + dz * O.right.z, out = dx * O.n.x + dz * O.n.z;
      const u = Math.round(clamp(128 + lat * 9, 26, 230) / 2) * 2, s = Math.round(clamp(0.5 + out / 11, 0.6, 1.9) * 30) / 30, key = this.grey ? 'grey' : u + ':' + s;
      if (key !== O.key) {
        O.key = key;
        const x = O.cv.getContext('2d');
        x.drawImage(O.rooms[this.grey ? 1 : 0].image, 0, 0);          // (from inside, it shows the room as it was left: nobody in it)
        if (!this.grey) figure(x, u, 206 + s * 44, s, '#2c2a32');
        O.tex.needsUpdate = true;
      }
    }
    const gone = this.grey && inHall;
    for (const h of this.hung) h.pic.material.map = gone ? h.grey : h.tex;
    // the companions will not go near that picture, and they do not come through it
    if (blots) for (const b of blots) {
      if (!b.awake) continue;
      b.g.visible = !gone;
      const q = b.g.position, dx = q.x - O.at.x, dz = q.z - O.at.z, d = Math.hypot(dx, dz);
      if (this.slipped && d < 8 && d > 0.01) { const push = (8 - d) * ease(6); q.x += (dx / d) * push; q.z += (dz / d) * push; }
    }
    this.pageDoor.visible = this.lastpage.done;
    this.homeDoor.visible = this.found; this.homeCol.r = this.found ? 1.7 : -1;
    // the Flood: the water finds its level; the orchard flowers once it stands on dry ground
    F.wy += (LEVELS[F.level] - F.wy) * ease(1.1);
    F.water.position.y = FLOOD.y + F.wy; F.water.visible = F.wy > -0.45;
    F.dryK += ((F.level === 0 ? 1 : 0) - F.dryK) * ease(0.5);
    F.crownMat.color.setRGB(0.52 + 0.48 * F.dryK, 0.62 + 0.1 * F.dryK, 0.56 + 0.26 * F.dryK);
    // High Summer: water where it was laid
    const run = (st, goal, rate) => {
      st.reach = st.reach < goal ? Math.min(goal, st.reach + dt * rate) : Math.max(goal, st.reach - dt * rate * 1.6);
      st.mat.uniforms.reach.value = st.reach; st.mesh.visible = st.reach > 0.001;
    };
    run(S.stream, S.spots[0].wet ? 1 : 0, 5.5 / S.stream.len);
    run(S.fall, S.stream.reach > 0.97 ? 1 : 0, 0.8);
    S.spots.forEach((s, i) => {
      S.wetK[i] += ((s.wet ? 1 : 0) - S.wetK[i]) * ease(0.6);
      s.pool.material.color.setRGB(0.6 - 0.26 * S.wetK[i], 0.52 + 0.22 * S.wetK[i], 0.38 + 0.52 * S.wetK[i]);
      s.glint.material.opacity = s.wet ? 0 : 0.24 + Math.sin(t * 1.5 + i) * 0.1;
      S.wheat[i].material.color.setRGB(0.92 - 0.2 * S.wetK[i], 0.82 + 0.02 * S.wetK[i], 0.5 - 0.1 * S.wetK[i]);
    });
    S.spin += ((S.spots[1].wet ? 1.6 : 0) - S.spin) * ease(1.2);
    S.wheel.rotation.z -= S.spin * dt;

    this.bead.visible = !!this.carry && !!player;
    if (!player) return;
    if (this.carry) { player.model.backTip.getWorldPosition(this.bead.position); this.bead.position.y += 0.28 + Math.sin(t * 3) * 0.04; }
    // standing water is in the way: it will not be waded into past the ankles
    const p = player.pos;
    if (F.wy > 0.05 && player.grounded && this.where(p) === 'flood' && p.y < FLOOD.y + F.wy + 0.5) {
      const dx = p.x - FLOOD.x, dz = p.z - FLOOD.z, d = Math.hypot(dx, dz), lim = shoreR(F.wy) + 0.7;
      if (d > lim) { const nd = Math.max(lim, d - 12 * dt); p.x = FLOOD.x + (dx / d) * nd; p.z = FLOOD.z + (dz / d) * nd; }
    }
  }
}
