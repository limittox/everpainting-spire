import * as THREE from 'three';
import { rimR } from './world.js';
import { daub, place, Bag, paintify, glowSprite, clamp, mulberry32 } from './util.js';
import { underside, makeStream, SPAN } from './underpainting.js';
import { ground } from './gallery.js';
import { DUNE_SUN } from './day.js';

// The Sunken Tower: another picture in the gallery. A desert adrift in the sky, sand going over its edges; statues
// that the sand has had for a long time; and a great tower, leaning, sunk in it to half its height.
//
//   the way in ..... is across another desert, far under this one: the painter steps in on the top of a hill of sand,
//                    with the island adrift a long way off; slides down, faster the steeper it is; and gets up onto it by
//                    the one chain, of the four that held it, which still reaches the sand.
//   the sand ....... keeps the mark of whatever crosses it: a furrow behind the painter, a wider one behind a
//                    skating painter, a hollow where they land, a scoop where the brush strikes. The wind fills
//                    them in again, slowly.
//   the hour ....... goes with the painter. A high sun at the frame; gold by the time the tower is reached; the
//                    sun going down as it is climbed; night, and every star, at the top.
//   the tower ...... is climbed round the outside: a stair, beams, platforms hung from ropes, a drum that throws
//                    the painter up, and at the last the evening wind. A fall from above a balcony ends on that
//                    balcony: the paint carries the painter back to it.
//   the beam ....... at the very top looks out over everything, and the picture is finished by looking.

const V3 = THREE.Vector3, TAU = Math.PI * 2, deg = (d) => (d * Math.PI) / 180, UP = new V3(0, 1, 0);
const X0 = 12000, Y0 = 0, Z0 = 1000, R0 = 78, HALF = 92;        // (the sand that takes a mark is a square HALF each way)
// the open desert far under the island: how low it lies, where its ground is centred, how far that reaches and how
// far it may be walked; where the frame stands in it (east and south of the island's middle); and the one chain that
// still holds, from the island's rim down to the top of a great dune
const LOW = Y0 - 130, LAND = { x: X0, z: Z0 + 290, r: 470, keep: 380 }, ENTER = [0, 630];
// the mirage: where it lies (east and south of the island's middle), the level of the pan of sand round it, and of its water
const MIRAGE = [145, 372], PAN = LOW + 3, WATER = PAN - 1.4;
const CH = deg(64), HEAD_R = rimR({ r: R0, ph: 0.9 }, CH) - 3, FOOT = [Math.cos(CH) * (HEAD_R + 130), Math.sin(CH) * (HEAD_R + 130)];
const START = new V3(X0 + Math.cos(CH) * HEAD_R, 0, Z0 + Math.sin(CH) * HEAD_R);       // where the chain lets the painter onto the island
// the tower: where it stands, how far it leans for every unit it rises, and how wide it is at a height
const TX = X0 + 4, TZ = Z0 - 22, LX = 0.13, LZ = -0.03, TOP = 72.3;
const ax = (h) => TX + LX * h, az = (h) => TZ + LZ * h, wall = (h) => 10.5 - 0.035 * h;
const NEEDLE = [5.2, 0], PERCH = 80.6;                          // the needle on the roof (east, north of the axis), and the beam on it

const SAND = ['#efd096', '#ebca8c', '#f3d8a2', '#e6c484', '#f0d39a'];
const STONE = ['#d9b98a', '#c9a676', '#e6caa0', '#b8935f', '#cfae84'], SHADE = ['#5a4630', '#4a3a28', '#6a5238'];
const ROCK = ['#b08858', '#9a744a', '#c49a68', '#86623e', '#a67e52'];
const TILE = ['#3fb8b0', '#2e9a9c', '#58d0c0', '#2a8494'], GILT = ['#c99a3e', '#b8862e', '#e0b860', '#a87a2a'];
const WOOD = ['#7a5a3a', '#6a4c30', '#8a6844'], CLOTH = ['#b8503c', '#a04434', '#c86048'], LIT = ['#ffe6a8', '#fff4d0', '#ffd27a'];
/** What the painter's feet throw up here. */
export const DUST = ['#f6dfae', '#f0d49a', '#fff0cc', '#e8c684'];

const smooth = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const ridge = (u) => 1 - Math.abs(Math.sin(u));
/** How high the sand lies: long crests across the wind, and a drift piled against the tower on the side the painter comes from. */
function duneH(x, z) {
  const dx = x - X0, dz = z - Z0, tx = x - TX, tz = z - (TZ + 3), dt = Math.hypot(tx, tz);
  // (lower toward the edge, by the tower, and where the frame stands)
  const calm = smooth((R0 - Math.hypot(dx, dz)) / 16) * (0.3 + 0.7 * smooth((dt - 16) / 26)) * (0.25 + 0.75 * smooth((Math.hypot(x - START.x, z - START.z) - 5) / 14));
  const dune = 3.6 * ridge(dx * 0.05 + 0.9 * Math.sin(dz * 0.033) + 0.4) ** 1.4 + 1.6 * ridge(dz * 0.085 + 0.7 * Math.sin(dx * 0.05) + 1.1) ** 1.2 + 0.5 * Math.sin(dx * 0.19 + dz * 0.13);
  return Y0 + 1.3 + calm * dune + 13.2 * smooth(1 - dt / 34) * (0.4 + 0.6 * (0.5 + (0.5 * tz) / Math.max(dt, 0.01)));
}

// The open desert: dunes as high as hills. The same arithmetic is read by the game (how high is the ground?) and by
// the shader that draws the sand, so it is written once, in the shader's language, and the game's copy is made from
// it. (u is east and v is south of the island's middle.) The first great dune is a hill the frame stands on the top of,
// with everything else spread out below it (steepest at the very top and easing all the way down, like a slide, so that
// no shoulder of it stands in the way of the view); the second is the one the chain comes down to; and far out, where nobody walks, they are mountains.
// Off to one side the ground is levelled into a pan with a hollow in it and a hummock in the middle of the hollow: the
// bed of the mirage, which is all that is really there.
const DESERT = `
  float t1 = v * 0.0165 + 0.55 * sin(u * 0.0062 + 1.3) + 0.9, s1 = sin(t1 + 0.3 * sin(2.0 * t1));
  float t2 = (u * 0.8 + v * 0.6) * 0.045 + 0.8 * sin((u * 0.6 - v * 0.8) * 0.021), s2 = sin(t2);
  float t3 = (u * 0.35 - v * 0.94) * 0.0052 + 0.7 * sin(u * 0.0031 + v * 0.0023) + 2.0, s3 = sin(t3);
  float calm = smoothstep(6.0, 30.0, sqrt(u * u + (v - ${ENTER[1].toFixed(1)}) * (v - ${ENTER[1].toFixed(1)}))), rim = smoothstep(450.0, 1000.0, sqrt(u * u + (v - 290.0) * (v - 290.0)));
  float e1 = sqrt(u * u + (v - ${(ENTER[1] + 8.5).toFixed(1)}) * (v - ${(ENTER[1] + 8.5).toFixed(1)})), e2 = ((u - ${FOOT[0].toFixed(2)}) * (u - ${FOOT[0].toFixed(2)}) + (v - ${FOOT[1].toFixed(2)}) * (v - ${FOOT[1].toFixed(2)})) / 3600.0;
  float h = ${LOW.toFixed(1)} + 34.0 * (1.0 - sqrt(s1 * s1 + 0.004)) * (0.6 + 0.4 * sin(u * 0.004 + v * 0.003 + 2.0)) + 4.5 * calm * (1.0 - sqrt(s2 * s2 + 0.01))
    + 125.0 * exp(-(sqrt(e1 * e1 + 144.0) - 12.0) / 95.0) * (1.0 - smoothstep(150.0, 270.0, e1)) + 62.0 * exp(-e2) + 70.0 * rim * (1.0 - sqrt(s3 * s3 + 0.004));
  float px = u - ${MIRAGE[0].toFixed(1)}, pz = v - ${MIRAGE[1].toFixed(1)}, pd = px * px + pz * pz, pr = sqrt(px * px * 0.72 + pz * pz) + 3.0 * sin(px * 0.13 + 1.0) + 2.5 * sin(pz * 0.17);
  return mix(h, ${PAN.toFixed(1)} - 5.2 * exp(-pr * pr / 400.0) + 5.4 * exp(-pd / 70.0), 1.0 - smoothstep(38.0, 60.0, sqrt(pd)));
`;
const desert0 = new Function('u', 'v', 'const { sin, exp, sqrt } = Math, smoothstep = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }, mix = (a, b, t) => a + (b - a) * t;' + DESERT.replace(/float /g, 'let '));
const desertH = (x, z) => desert0(x - X0, z - Z0);

const GREY = 'rgb(128,128,128)';
/** A canvas that keeps what has been pressed into the sand (grey is untouched, darker is dug, lighter is heaped), over a square `size` wide whose corner is at (x0, z0). */
function marks(x0, z0, size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  const c = cv.getContext('2d'); c.fillStyle = GREY; c.fillRect(0, 0, 1024, 1024);
  const tex = new THREE.CanvasTexture(cv); tex.flipY = false; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  return { c, tex, x0, z0, size, dirty: false };
}

export class Dunes {
  constructor(scene, world, uTime) {
    this.scene = scene; this.world = world;
    const rk = mulberry32(6107);
    const bag = new Bag(), add = (g, pal = STONE, o = { scale: 0.22, spread: 0.6 }) => bag.add(daub(g, pal, o));
    const box = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
    const glows = (this.fires = []);
    const fire = (p, size, color = 0xffc070, op = 0.8) => { const q = glowSprite(world.glowTex, size, color, 0); q.position.copy(p); q.visible = false; scene.add(q); glows.push({ q, op, ph: p.x * 0.7 + p.z * 0.3 }); };

    // ================================================================================== the ground
    const isl = (this.isl = { name: 'The Sunken Tower', x: X0, y: Y0, z: Z0, r: R0, ph: 0.9, pale: true, quiet: true, bare: true, surf: duneH, index: world.islands.length });
    isl.tex = ground(isl, 2048, '#ebcb8e', SAND, 9000, 911, (i) => 0.45 + Math.sin(i * 12.9898) * 0.3);       // (strokes laid along the wind)
    isl.span = 2 * R0 * SPAN;
    world.islands.push(isl);
    bag.add(underside(isl, 8, 48, ROCK));
    {
      // the sand: a fine net, so that it can be pressed down where it is trodden. What has been pressed is kept on a
      // canvas (grey is untouched, darker is dug, lighter is heaped), which the net is moved by and shaded by.
      const N = 300, pos = new Float32Array((N + 1) * (N + 1) * 3), uv = new Float32Array((N + 1) * (N + 1) * 2), idx = new Uint32Array(N * N * 6);
      for (let j = 0, k = 0; j <= N; j++) for (let i = 0; i <= N; i++, k++) {
        const x = X0 - HALF + (2 * HALF * i) / N, z = Z0 - HALF + (2 * HALF * j) / N;
        pos[k * 3] = x; pos[k * 3 + 1] = duneH(x, z); pos[k * 3 + 2] = z;
        uv[k * 2] = (x - X0) / isl.span + 0.5; uv[k * 2 + 1] = 0.5 - (z - Z0) / isl.span;
      }
      for (let j = 0, q = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx[q++] = a; idx[q++] = b; idx[q++] = a + 1; idx[q++] = a + 1; idx[q++] = b; idx[q++] = b + 1; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeVertexNormals();
      this.top = marks(X0 - HALF, Z0 - HALF, 2 * HALF); this.low = marks(0, 0, 160);          // (the one for the open desert goes with the painter)
      this.tfill = 0; this.stepAt = new V3(1e9, 0, 0);
      const mat = paintify(new THREE.MeshLambertMaterial({ map: isl.tex }), { scale: 1, amp: 0.3 }), painted = mat.onBeforeCompile;
      mat.onBeforeCompile = (sh, r) => {
        painted.call(mat, sh, r);
        sh.uniforms.tTrail = { value: this.top.tex };
        sh.uniforms.uSand = { value: new THREE.Vector4(X0 - HALF, Z0 - HALF, 2 * HALF, R0) };
        sh.vertexShader = 'uniform sampler2D tTrail; uniform vec4 uSand; varying vec2 vTrail;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vTrail = (position.xz - uSand.xy) / uSand.z;\n  transformed.y += (texture2D(tTrail, vTrail).r - 0.5) * 1.3;');
        sh.fragmentShader = 'uniform sampler2D tTrail; uniform vec4 uSand; varying vec2 vTrail;\n' + sh.fragmentShader
          // (the net is square and the desert is not: nothing is drawn beyond the rim)
          .replace('#include <clipping_planes_fragment>', `{ vec2 d = vTrail * uSand.z - vec2(${HALF.toFixed(1)}); float th = atan(d.y, d.x); if (length(d) > uSand.w * (1.0 + 0.1 * sin(3.0 * th + ${isl.ph.toFixed(2)}) + 0.05 * sin(7.0 * th + ${(isl.ph * 2.3).toFixed(3)}))) discard; }\n#include <clipping_planes_fragment>`)
          .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= 1.0 + (texture2D(tTrail, vTrail).r - 0.5) * 1.5;')
          // (lit by how the mark slopes, and by the ripples the wind leaves)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n  { float e = 1.0 / 1024.0; vec2 w = vTrail * uSand.z;
            float hx = texture2D(tTrail, vTrail + vec2(e, 0.0)).r - texture2D(tTrail, vTrail - vec2(e, 0.0)).r, hz = texture2D(tTrail, vTrail + vec2(0.0, e)).r - texture2D(tTrail, vTrail - vec2(0.0, e)).r;
            float rp = cos(dot(w, vec2(0.92, 0.39)) * 3.4 + sin(dot(w, vec2(-0.39, 0.92)) * 0.5) * 2.2) * 0.07;
            normal = normalize(normal + mat3(viewMatrix) * vec3(-hx * 12.0 + rp * 0.92, 0.0, -hz * 12.0 + rp * 0.39)); }`);
      };
      mat.customProgramCacheKey = () => 'sand';
      this.sand = new THREE.Mesh(g, mat); this.sand.frustumCulled = false;
      scene.add(this.sand);
    }
    const sandAt = (dx, dz, lift = 0) => new V3(X0 + dx, duneH(X0 + dx, Z0 + dz) + lift, Z0 + dz);
    const lowAt = (dx, dz, lift = 0) => new V3(X0 + dx, desertH(X0 + dx, Z0 + dz) + lift, Z0 + dz);

    // ---- the open desert, far under all this: ground of its own, as far as it can be walked
    this.land = { name: 'The Sunken Tower', x: LAND.x, y: LOW - 5, z: LAND.z, r: LAND.r, ph: 0.4, pale: true, quiet: true, bare: true, surf: desertH, under: 2.5, index: world.islands.length };
    world.islands.push(this.land);
    {
      // its sand is one net that goes with the painter: fine about their feet, where it is pressed down like the sand
      // above, and coarser the farther off it is, out to the end of sight. The island's shadow lies on it.
      this.uEye = { value: new THREE.Vector2() }; this.uLow = { value: new THREE.Vector3() }; this.uShade = { value: new THREE.Vector3() };
      const mat = paintify(new THREE.MeshLambertMaterial({ color: 0xe8c486 }), { scale: 1, amp: 0.3 }), painted = mat.onBeforeCompile;
      const glsl = `uniform vec2 uEye; uniform sampler2D tTrail; uniform vec3 uTrail; uniform vec3 uShade; uniform float uMirage; varying vec2 vSand;
        float desertH(float u, float v) {${DESERT}}
        float pressed(vec2 w) { vec2 q = (w - uTrail.xy) / uTrail.z; return q.x > 0.0 && q.y > 0.0 && q.x < 1.0 && q.y < 1.0 ? texture2D(tTrail, q).r - 0.5 : 0.0; }\n`;
      mat.onBeforeCompile = (sh, r) => {
        painted.call(mat, sh, r);
        Object.assign(sh.uniforms, { uEye: this.uEye, uTrail: this.uLow, uShade: this.uShade, tTrail: { value: this.low.tex }, uMirage: this.uFade });
        sh.vertexShader = glsl + sh.vertexShader.replace('#include <begin_vertex>', `vec2 gq = position.xy * (64.0 + 1336.0 * position.xy * position.xy * position.xy * position.xy);
          vSand = uEye + vec2(gq.x, -gq.y);
          vec3 transformed = vec3(vSand.x, desertH(vSand.x, vSand.y) + pressed(vSand) * 1.3, vSand.y);`);
        sh.fragmentShader = glsl + sh.fragmentShader
          .replace('#include <map_fragment>', `#include <map_fragment>\n  float sandH = desertH(vSand.x, vSand.y);
            diffuseColor.rgb *= (1.0 + pressed(vSand) * 1.5) * (1.0 - uShade.z * (1.0 - smoothstep(52.0, 86.0, length(vSand - uShade.xy)))) * mix(vec3(0.84, 0.77, 0.7), vec3(1.05, 1.04, 1.0), smoothstep(${LOW.toFixed(1)}, ${(LOW + 44).toFixed(1)}, sandH))
              * (1.0 - 0.34 * uMirage * (1.0 - smoothstep(${(WATER + 0.05).toFixed(2)}, ${(WATER + 0.85).toFixed(2)}, sandH)) * (1.0 - smoothstep(33.0, 39.0, distance(vSand, vec2(${MIRAGE[0].toFixed(1)}, ${MIRAGE[1].toFixed(1)})))));          // (deeper in the hollows, paler on the crests)`)
          // (lit by how the dune slopes, which is worked out here and not at the corners of the net: so a far dune is as crisp as a near one)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n  { float e = 0.16, h0 = sandH;
            float hx = pressed(vSand + vec2(e, 0.0)) - pressed(vSand - vec2(e, 0.0)), hz = pressed(vSand + vec2(0.0, e)) - pressed(vSand - vec2(0.0, e));
            float rp = cos(dot(vSand, vec2(0.92, 0.39)) * 3.4 + sin(dot(vSand, vec2(-0.39, 0.92)) * 0.5) * 2.2) * 0.07 * (1.0 - smoothstep(30.0, 110.0, length(vSand - uEye)));
            normal = normalize(mat3(viewMatrix) * (normalize(vec3(h0 - desertH(vSand.x + 0.5, vSand.y), 0.5, h0 - desertH(vSand.x, vSand.y + 0.5))) + vec3(-hx * 12.0 + rp * 0.92, 0.0, -hz * 12.0 + rp * 0.39))); }`);
      };
      mat.customProgramCacheKey = () => 'lowsand';
      this.lowSand = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 256, 256), mat); this.lowSand.position.set(X0, 0, Z0); this.lowSand.frustumCulled = false;
      scene.add(this.lowSand);
    }

    // ---- what can be stood on that is not sand, and is asked for by the ground: [is this point on it, and how high]
    const decks = (this.decks = []);
    /** A ledge round the tower from angle a0 to a1, rising from h0 to h1, `w` wide. */
    const arc = (a0, a1, h0, h1, w) => decks.push((x, z) => {
      let h = (h0 + h1) / 2;
      for (let k = 0; k < 3; k++) { const a = (((Math.atan2(z - az(h), x - ax(h)) - a0 + 0.3) % TAU) + TAU) % TAU - 0.3; if (k === 2 && a1 - a0 < TAU - 0.01 && (a < 0 || a > a1 - a0)) return null; h = h0 + ((h1 - h0) * clamp(a, 0, a1 - a0)) / (a1 - a0); }          // (the tower leans, so which way a point lies from it depends on how high it is: found by going round twice)
      const d = Math.hypot(x - ax(h), z - az(h));
      return d > wall(h) - 0.4 && d < wall(h) + w ? Y0 + h : null;
    });
    const disc = (p, r, y = p.y) => decks.push((x, z) => ((x - p.x) ** 2 + (z - p.z) ** 2 < r * r ? y : null));
    const plank = (p, yaw, hl, hw) => { const c = Math.cos(yaw), s = Math.sin(yaw); decks.push((x, z) => { const dx = x - p.x, dz = z - p.z; return Math.abs(dx * c + dz * s) < hl && Math.abs(dz * c - dx * s) < hw ? p.y : null; }); };
    const base = world.groundHeight;
    world.groundHeight = (x, z, maxY) => {
      let h = base(x, z, maxY);
      if (x < X0 - 130) return h;
      for (const at of decks) { const y = at(x, z); if (y !== null && y <= maxY && y > h) h = y; }
      return h;
    };

    // ================================================================================== statues, sunk in the sand
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
    /** Stand a thing made at the origin somewhere: so big, turned so, tipped so. Gives back where a point of it ended up. */
    const set = (parts, p, s, yaw = 0, tipX = 0, tipZ = 0) => { M.compose(p, Q.setFromEuler(E.set(tipX, yaw, tipZ, 'YXZ')), new V3(s, s, s)); for (const [g, pal] of parts) add(g.applyMatrix4(M), pal); return (x, y, z) => new V3(x, y, z).applyMatrix4(M); };
    // a seated figure, twenty high from the foot of its seat to its crown
    const guardian = (arms = 3) => [
      [box(5, 6, 4, 0, 3, -1), STONE], [box(5.6, 0.7, 4.6, 0, 6.2, -1), STONE],
      ...[-1, 1].flatMap((k) => [[box(1.7, 1.7, 4.2, k * 1.2, 6.9, 1.6), STONE], [box(1.7, 6.2, 1.7, k * 1.2, 3.1, 3.2), STONE], [box(1.8, 0.8, 2.6, k * 1.2, 0.4, 3.9), STONE]]),
      [box(4.6, 6.4, 2.8, 0, 10.4, -0.8), STONE], [box(6.6, 1.5, 3.0, 0, 13.1, -0.8), STONE],
      ...[-1, 1].filter((k) => arms & (k < 0 ? 1 : 2)).flatMap((k) => [[box(1.4, 4.6, 1.6, k * 3.0, 10.6, -0.6), STONE], [box(1.3, 1.3, 4.0, k * 2.7, 8.1, 1.2), STONE]]),
      [box(1.6, 1.0, 1.6, 0, 14.2, -0.6), STONE], [box(2.8, 3.2, 2.8, 0, 16.1, -0.5), STONE],
      [box(4.4, 4.2, 1.0, 0, 15.6, -1.7), STONE], ...[-1, 1].map((k) => [box(0.9, 3.6, 1.3, k * 1.8, 14.5, 0.1), STONE]),
      [place(new THREE.CylinderGeometry(1.15, 1.5, 2.4, 8), 0, 18.9, -0.5), STONE],
      // the face: a brow, a nose, a beard; the eyes shut, and the mouth
      [box(2.4, 0.32, 0.35, 0, 16.8, 0.98), STONE], [box(0.45, 1.0, 0.5, 0, 16.1, 1.08), STONE], [box(0.8, 1.9, 0.7, 0, 14.0, 0.95), STONE],
      ...[-1, 1].map((k) => [box(0.75, 0.12, 0.1, k * 0.65, 16.45, 0.93), SHADE]), [box(0.95, 0.1, 0.1, 0, 15.25, 0.93), SHADE],
      [place(new THREE.CylinderGeometry(1.2, 0.7, 0.7, 10), 0, 8.1, 2.5), GILT],          // a bowl in its lap
    ];
    // a great head: a ball cut in faces, a brow, a nose, lips, the lids shut, a band round the brow
    const head = () => [
      [place(new THREE.IcosahedronGeometry(1, 2), 0, 0, 0, 0, 0, 0, 0.86, 1.12, 0.96), STONE],
      [box(1.25, 0.14, 0.3, 0, 0.3, 0.86), STONE], [place(new THREE.ConeGeometry(0.2, 0.62, 4), 0, 0.0, 0.97, 0.3, Math.PI / 4, 0), STONE],
      ...[-1, 1].map((k) => [box(0.36, 0.05, 0.07, k * 0.36, 0.17, 0.91), SHADE]),
      [box(0.5, 0.08, 0.14, 0, -0.42, 0.88), STONE], [box(0.44, 0.03, 0.06, 0, -0.36, 0.92), SHADE],
      [place(new THREE.IcosahedronGeometry(0.3, 1), 0, -0.78, 0.66), STONE],
      ...[-1, 1].map((k) => [box(0.12, 0.5, 0.3, k * 0.87, 0, 0), STONE]),
      [place(new THREE.CylinderGeometry(0.93, 0.9, 0.2, 14, 1, true), 0, 0.56, 0, 0, 0, 0, 0.94, 1, 1.04), GILT],
      [place(new THREE.CylinderGeometry(0.5, 0.62, 0.9, 10), 0, -1.35, -0.1), STONE],
    ];
    // an open hand, palm up
    const hand = () => [
      [box(2.2, 0.5, 2.6, 0, 0, 0), STONE], [box(1.7, 0.7, 2.4, 0, -0.3, -2.2, 0.3), STONE],
      ...[-0.8, -0.27, 0.27, 0.8].flatMap((x, i) => [[box(0.44, 0.44, 1.1, x, 0.26, 1.72, -0.5), STONE], [box(0.4, 0.4, 0.9 + (i % 2) * 0.12, x, 0.95, 2.42, -1.15), STONE]]),
      [box(0.5, 0.5, 1.2, 1.45, 0.3, 0.3, -0.4, 0.9), STONE],
    ];
    // an avenue of them, either side of the way to the tower, each pair deeper in than the last
    for (const [dz, deep, tip] of [[40, 6, 0], [21, 10, 0.05], [3, 13, -0.09]]) for (const k of [-1, 1]) {
      const p = sandAt(k * 13, dz, -deep * 0.9), spot = set(guardian(k < 0 && dz < 30 ? 2 : 3), p, 0.9, -k * 1.15, tip * k, tip);
      world.colliders.push({ x: p.x, z: p.z + 0.5, r: 3.4, top: p.y + 18.6, late: true });
      const bowl = spot(0, 9, 2.5); if (bowl.y > duneH(bowl.x, bowl.z) + 0.4) fire(bowl, 5);
    }
    {
      // a head, thrown back, the sand to its lips on one side
      const p = sandAt(-34, 12, 2.6); set(head(), p, 7.5, 0.9, -0.5, 0.22);
      world.colliders.push({ x: p.x, z: p.z, r: 6.4, top: p.y + 9.5, late: true });
      // a hand reaching out of a dune, big enough to stand in
      const q = sandAt(29, 27, 2.3), palm = set(hand(), q, 3.1, -0.7, -0.12, 0.08)(0, 0.26, 0);
      disc(palm, 3.2);
      world.colliders.push({ x: q.x, z: q.z, r: 2.6, top: palm.y - 0.1, late: true });
      this.palm = palm;
    }
    // pillars along the avenue, most of them broken; and their drums lying about
    for (const [dx, dz, h] of [[-7, 50, 7.5], [7, 50, 4.2], [-7.5, 31, 3.2], [7.5, 31, 9], [-8, 12, 5.6], [8, 12, 2.4]]) {
      const p = sandAt(dx, dz, -1);
      add(place(new THREE.CylinderGeometry(0.95, 1.05, h + 1, 10), p.x, p.y + (h + 1) / 2, p.z, 0, dx, 0.04));
      add(place(new THREE.CylinderGeometry(1.3, 1.3, 0.5, 10), p.x, p.y + 1.4, p.z));
      if (h > 6) add(box(2.8, 0.7, 2.8, p.x, p.y + h + 1.2, p.z, 0, dx));
      world.colliders.push({ x: p.x, z: p.z, r: 1.2, top: p.y + h + 1.6, late: true });
    }
    for (const [dx, dz, turn] of [[11, 44, 0.4], [-12, 26, 1.9], [15, 16, 1.1], [-21, 44, 0.2], [24, 6, 2.6]]) { const p = sandAt(dx, dz, 0.35); add(place(new THREE.CylinderGeometry(1.0, 1.0, 2.2, 10), p.x, p.y, p.z, 0, turn, Math.PI / 2 - 0.12)); }

    // ================================================================================== the chains
    // Four chains of stone held the island to the desert under it. Three have parted: what is left of them hangs from
    // the rim, and the rest lies in the sand by the posts it was made fast to. The fourth still goes down to the top
    // of a great dune, and its links are broad enough to walk up.
    const chain = (a, b) => {
      const n = Math.max(1, Math.round(a.distanceTo(b) / 7));
      for (let i = 0; i < n; i++) {
        M.lookAt(a, b, UP).setPosition(a.clone().lerp(b, (i + 0.5) / n));          // (its own z down the chain, its own y out of the top of it)
        const link = (g, pal) => add(g.applyMatrix4(M), pal);
        link(box(5, 0.9, 6.5, 0, -0.45, 0)); for (const k of [-1, 1]) link(box(0.55, 0.6, 6.5, k * 2.5, -0.05, 0));
        if (i % 3 === 1) link(box(2.4, 0.1, 3.4, 0, 0.01, 0), TILE);
        if (i < n - 1) for (const k of [-1, 1]) link(place(new THREE.TorusGeometry(1.7, 0.42, 5, 12), k * 1.5, -2.0, -3.5, 0, Math.PI / 2, 0), ROCK);
      }
    };
    const posts = (p, th) => { for (const k of [-1, 1]) { const x = p.x - Math.sin(th) * k * 4.6, z = p.z + Math.cos(th) * k * 4.6; add(box(2.2, 13, 2.2, x, p.y + 3.5, z, 0.05 * k, -th, 0.06)); add(box(2.8, 0.7, 2.8, x, p.y + 10.2, z, 0.05 * k, -th, 0.06), GILT); world.colliders.push({ x, z, r: 1.4, top: p.y + 10.5, late: true }); } };
    /** A slope to stand on, from a up to b, `hw` to either side. */
    const ramp = (a, b, hw) => { const ex = b.x - a.x, ez = b.z - a.z, L = Math.hypot(ex, ez); decks.push((x, z) => { const s = ((x - a.x) * ex + (z - a.z) * ez) / L; return s > -0.5 && s < L + 0.5 && Math.abs((z - a.z) * ex - (x - a.x) * ez) / L < hw ? a.y + ((b.y - a.y) * clamp(s, 0, L)) / L : null; }); };
    this.foot = lowAt(FOOT[0], FOOT[1], 0.3); this.head = new V3(START.x, duneH(START.x, START.z) + 0.2, START.z);
    chain(this.foot, this.head); ramp(this.foot, this.head, 2.3); posts(this.foot, CH);
    for (const [th, len] of [[deg(170), 46], [deg(262), 30], [deg(338), 58]]) {
      const r = rimR(isl, th), o = new V3(Math.cos(th), 0, Math.sin(th)), a = new V3(X0, Y0 - 3, Z0).addScaledVector(o, r - 1.5);
      chain(a.clone().addScaledVector(o, 3).setY(a.y - len), a);
      const far = lowAt(o.x * (r + 108), o.z * (r + 108), -0.6); chain(far, lowAt(o.x * (r + 82), o.z * (r + 82), -0.1)); posts(far, th);
    }

    // ================================================================================== the tower
    // (built standing straight, and then leaned: every floor of it stays level, which is what lets it be climbed)
    const tb = new Bag(), lit = new Bag(), T = (g, pal = STONE, o = { scale: 0.22, spread: 0.6 }) => tb.add(daub(g, pal, o));
    const out = (g, a, r, h, turn = 0) => place(g, Math.cos(a) * r, h, Math.sin(a) * r, 0, Math.PI / 2 - a + turn, 0);       // (its own z pointing away from the tower)
    const rad = (g, a, r, h) => place(g, Math.cos(a) * r, h, Math.sin(a) * r, 0, -a, 0);                                    // (its own x pointing away)
    /** Where a point of the tower is in the world, once it has leaned. */
    const W = (a, r, h) => new V3(TX + Math.cos(a) * r + LX * h, Y0 + h, TZ + Math.sin(a) * r + LZ * h);
    const FLOORS = [-12, 12.2, 30.4, 52.4, TOP];
    FLOORS.slice(0, 4).forEach((h0, i) => {
      const h1 = FLOORS[i + 1], mid = (h0 + h1) / 2, off = i * 0.31, tall = h1 - h0;
      T(place(new THREE.CylinderGeometry(wall(h1) - 0.15, wall(h0) - 0.15, tall, 24, 3, true), 0, mid, 0), STONE, { scale: 0.09, spread: 0.7 });
      // under each floor: a cornice, a course of blocks, and a band of glazed tile that has kept its colour
      T(place(new THREE.TorusGeometry(wall(h1) + 0.25, 0.55, 6, 28), 0, h1 - 0.55, 0, Math.PI / 2, 0, 0));
      T(place(new THREE.CylinderGeometry(wall(h1 - 2) - 0.07, wall(h1 - 3.2) - 0.07, 1.2, 24, 1, true), 0, h1 - 2.6, 0), TILE, { scale: 0.6, spread: 1 });
      for (let k = 0; k < 28; k++) T(rad(new THREE.BoxGeometry(0.7, 0.5, 0.5), (k / 28) * TAU, wall(h1 - 1.4) + 0.15, h1 - 1.4));
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU + off, b = a + TAU / 20;
        T(out(new THREE.BoxGeometry(0.9, tall - 4.6, 0.5), a, wall(mid) + 0.05, mid - 0.7));          // a rib
        // and between the ribs a window: dark, some of them bricked up, some with a light in them once it is evening
        if (i === 2 && Math.abs(Math.sin(b - Math.PI / 2)) < 0.4 && Math.sin(b) > 0) continue;        // (where the sun is carved)
        if (rk() < 0.2) continue;
        const y = i === 0 ? 7 : mid + 0.6, wide = 1.3, high = 3.2;
        T(out(new THREE.BoxGeometry(wide, high, 0.5), b, wall(y) - 0.14, y), SHADE);
        T(place(new THREE.CylinderGeometry(wide / 2, wide / 2, 0.5, 8, 1, false, 0, Math.PI), Math.cos(b) * (wall(y) - 0.14), y + high / 2, Math.sin(b) * (wall(y) - 0.14), Math.PI / 2, 0, Math.PI - b), SHADE);
        T(out(new THREE.BoxGeometry(wide + 0.6, 0.26, 0.9), b, wall(y) + 0.1, y - high / 2 - 0.1));
        if (rk() < 0.5) lit.add(daub(out(new THREE.BoxGeometry(wide * 0.82, high * 0.9, 0.08), b, wall(y) + 0.15, y), LIT, { scale: 2, spread: 1 }));
      }
    });
    T(place(new THREE.CylinderGeometry(wall(TOP) + 0.5, wall(TOP) + 0.1, 0.6, 24), 0, TOP - 0.3, 0));
    // the great door, of which only the head of the arch is above the sand
    { const a = deg(315); T(out(new THREE.BoxGeometry(5, 14, 0.6), a, wall(4) - 0.1, 3), SHADE); T(place(new THREE.CylinderGeometry(2.5, 2.5, 0.6, 12, 1, false, 0, Math.PI), Math.cos(a) * (wall(10) - 0.1), 10, Math.sin(a) * (wall(10) - 0.1), Math.PI / 2, 0, Math.PI - a), SHADE); T(out(new THREE.TorusGeometry(2.8, 0.4, 5, 14, Math.PI), a, wall(10) + 0.1, 10)); for (const k of [-1, 1]) T(out(new THREE.BoxGeometry(0.9, 14, 0.7), a + k * 0.34, wall(4) + 0.1, 3)); }
    // the sun, carved on the side the painter comes from: a ring, a boss of bronze, and its rays
    {
      const a = deg(90), h = 41.4, r = wall(h) + 0.12;
      T(out(new THREE.TorusGeometry(3.0, 0.32, 6, 24), a, r, h));
      T(out(place(new THREE.CylinderGeometry(1.7, 1.7, 0.35, 16), 0, 0, 0, Math.PI / 2, 0, 0), a, r, h), GILT);
      for (let k = 0; k < 12; k++) { const b = (k / 12) * TAU; T(out(place(new THREE.BoxGeometry(0.3, k % 2 ? 1.2 : 2.0, 0.25), Math.cos(b) * (k % 2 ? 4.0 : 4.4), Math.sin(b) * (k % 2 ? 4.0 : 4.4), 0, 0, 0, b - Math.PI / 2), a, r, h), k % 2 ? STONE : GILT); }
    }
    // courses of darker stone, every so often
    for (let h = -2; h < TOP - 3; h += 3.4) if (FLOORS.every((f) => Math.abs(f - h) > 2.6)) T(place(new THREE.TorusGeometry(wall(h) - 0.05, 0.17, 4, 28), 0, h, 0, Math.PI / 2, 0, 0), ROCK, { scale: 0.5, spread: 1 });
    // little turrets hung off the side of it, each under a cap of tile, with a slit that is lit at night
    const turret = (a, h) => {
      const r = wall(h) + 1.3, x = Math.cos(a) * r, z = Math.sin(a) * r;
      T(place(new THREE.CylinderGeometry(1.9, 1.9, 5, 10), x, h + 2.5, z)); T(place(new THREE.ConeGeometry(1.9, 2.6, 10), x, h - 1.3, z, Math.PI, 0, 0));
      T(place(new THREE.CylinderGeometry(2.2, 2.2, 0.4, 10), x, h + 5.0, z)); T(place(new THREE.ConeGeometry(2.3, 3.4, 10), x, h + 6.9, z), TILE, { scale: 0.6, spread: 1 });
      T(place(new THREE.IcosahedronGeometry(0.32, 0), x, h + 8.8, z), GILT);
      for (const k of [-1, 0, 1]) {
        const b = a + k * 0.9;
        T(place(new THREE.BoxGeometry(0.5, 1.6, 0.3), x + Math.cos(b) * 1.85, h + 3, z + Math.sin(b) * 1.85, 0, Math.PI / 2 - b, 0), SHADE);
        if (k === 0) lit.add(daub(place(new THREE.BoxGeometry(0.4, 1.4, 0.08), x + Math.cos(b) * 2.02, h + 3, z + Math.sin(b) * 2.02, 0, Math.PI / 2 - b, 0), LIT, { scale: 2, spread: 1 }));
      }
    };
    turret(deg(20), 17); turret(deg(300), 34); turret(deg(215), 57); turret(deg(350), 61);
    // a place where the wall has fallen in: dark, a floor showing in it, and stones hanging at its edge
    {
      const a = deg(128), h = 63, r = wall(h) - 0.05;
      for (const [dx, dy, w, hh, rot] of [[0, 0, 3.2, 4.6, 0.2], [1.4, 1.6, 2.2, 3, -0.5], [-1.5, -1.2, 2.4, 2.6, 0.7], [0.6, -2.4, 2, 2.2, -0.3], [-0.8, 2.6, 1.6, 2, 0.4]]) T(out(place(new THREE.BoxGeometry(w, hh, 0.3), dx, dy, 0, 0, 0, rot), a, r, h), SHADE);
      T(out(place(new THREE.BoxGeometry(4.4, 0.35, 0.5), 0, -0.6, -0.1), a, r, h));
      for (const [dx, dy] of [[2.4, -2.6], [-2.6, 0.4], [1.9, 3.2]]) T(out(place(new THREE.DodecahedronGeometry(0.6, 0), dx, dy, 0.4), a, r, h));
    }
    // ---- the way up. Each piece is a thing to look at, and under it a line telling the ground where it can be stood on.
    /** A level ledge with a rail along the part of it nobody steps on or off. */
    const balcony = (a0, a1, h, w, rail0 = a0, rail1 = a1) => {
      arc(a0, a1, h, h, w);
      for (let a = a0; a < a1 - 0.001; a += deg(5)) T(rad(new THREE.BoxGeometry(w + 0.3, 0.5, (wall(h) + w) * deg(5) + 0.2), a + deg(2.5), wall(h) + w / 2 - 0.15, h - 0.25), STONE, { scale: 0.4, spread: 0.8 });
      for (let a = a0 + deg(10); a < a1; a += deg(20)) T(rad(new THREE.BoxGeometry(w * 0.85, 1.0, 0.45), a, wall(h) + w * 0.42, h - 1.0));
      for (let a = rail0; a <= rail1 + 0.001; a += deg(10)) {
        T(rad(new THREE.BoxGeometry(0.24, 1.05, 0.24), a, wall(h) + w - 0.12, h + 0.52));
        if (a + deg(10) <= rail1 + 0.001) T(rad(new THREE.BoxGeometry(0.16, 0.15, (wall(h) + w) * deg(10)), a + deg(5), wall(h) + w - 0.12, h + 1.0));
      }
    };
    /** A stair: steps to look at, and a slope to stand on. */
    const stair = (a0, a1, h0, h1, w) => {
      arc(a0, a1, h0, h1, w);
      const n = Math.ceil((h1 - h0) / 0.42);
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n, a = a0 + (a1 - a0) * u, h = h0 + (h1 - h0) * u;
        T(rad(new THREE.BoxGeometry(w + 0.2, 0.5, ((wall(h) + w) * (a1 - a0)) / n + 0.25), a, wall(h) + w / 2 - 0.1, h - 0.2), STONE, { scale: 0.4, spread: 0.8 });
        if (k % 4 === 1) T(rad(new THREE.BoxGeometry(w * 0.8, 0.9, 0.4), a, wall(h) + w * 0.4, h - 0.9));
      }
    };
    /** A beam of wood out of the wall. */
    const beam = (a, h, len = 4.4) => { T(rad(new THREE.BoxGeometry(len, 0.5, 1.6), a, wall(h) + len / 2 - 0.3, h - 0.25), WOOD, { scale: 0.5 }); plank(W(a, wall(h) + len / 2 - 0.3, h), a, len / 2, 0.85); };
    /** A round platform hung on three ropes from an arm above it. */
    const hung = (a, h) => {
      const r = wall(h) + 2.7;
      T(place(new THREE.CylinderGeometry(2.1, 1.9, 0.5, 10), Math.cos(a) * r, h - 0.25, Math.sin(a) * r), WOOD, { scale: 0.5 });
      T(place(new THREE.TorusGeometry(2.05, 0.09, 4, 14), Math.cos(a) * r, h - 0.05, Math.sin(a) * r, Math.PI / 2, 0, 0), GILT);
      for (let k = 0; k < 3; k++) { const b = a + (k / 3) * TAU; T(place(new THREE.CylinderGeometry(0.04, 0.04, 6, 4), Math.cos(a) * r + Math.cos(b) * 1.8, h + 3, Math.sin(a) * r + Math.sin(b) * 1.8), WOOD); }
      T(rad(new THREE.BoxGeometry(5.2, 0.4, 0.4), a, wall(h + 6) + 2.3, h + 6), WOOD, { scale: 0.5 });
      T(place(new THREE.TorusGeometry(1.8, 0.05, 4, 12), Math.cos(a) * r, h + 6, Math.sin(a) * r, Math.PI / 2, 0, 0), WOOD);
      disc(W(a, r, h), 2.05);
      return W(a, r, h);
    };
    // where a fall is taken back to: the first is the sand itself
    this.perches = [{ p: sandAt(4, -4), h: 0 }];
    const perch = (a, h, w) => { const p = W(a, wall(h) + w * 0.55, h); p.y = Math.max(p.y, duneH(p.x, p.z) + 0.1); this.perches.push({ p, h }); T(place(new THREE.CylinderGeometry(0.1, 0.16, 1.0, 6), p.x - TX - LX * h + 1.2, h + 0.5, p.z - TZ - LZ * h), WOOD); T(place(new THREE.CylinderGeometry(0.55, 0.3, 0.4, 10), p.x - TX - LX * h + 1.2, h + 1.15, p.z - TZ - LZ * h), GILT); fire(new V3(p.x + 1.2, p.y + 1.6, p.z), 6); return p; };
    // the first gallery: all the way round, and on the side the painter comes from the sand is over it
    balcony(0, TAU, 12.2, 3.2, deg(170), deg(370)); perch(deg(90), 12.2, 3.2);
    // a stair, with a gap in it; three beams; and the second gallery, under the carved sun
    stair(deg(120), deg(230), 12.2, 19.5, 2.9); stair(deg(243), deg(330), 19.8, 25.5, 2.9);
    beam(deg(346), 26.7); beam(deg(366), 28.0); beam(deg(386), 29.3);
    balcony(deg(40), deg(150), 30.4, 3.4, deg(60), deg(130)); perch(deg(95), 30.4, 3.4);
    // platforms on ropes; on the last of them a drum, which throws the painter up through a gap in the ledge over it
    hung(deg(166), 32.2); hung(deg(194), 34.2); hung(deg(222), 36.2);
    {
      const c = hung(deg(250), 38.2), skin = c.clone(); skin.y += 0.85;
      this.drum = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.3, 0.8, 14), new THREE.MeshLambertMaterial({ color: 0x8a3a2c, emissive: 0x2a100a, flatShading: true }));
      this.drum.position.set(c.x, c.y + 0.42, c.z);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.52, 0.08, 14), new THREE.MeshLambertMaterial({ color: 0xf6ead0, emissive: 0x403828 })); top.position.y = 0.42; this.drum.add(top);
      scene.add(this.drum);
      disc(skin, 1.5); this.drumAt = skin; this.drumT = 0;
    }
    balcony(deg(258), deg(330), 47.5, 3.6, deg(270), deg(320));
    stair(deg(330), deg(410), 47.5, 52.4, 2.9);
    balcony(deg(50), deg(172), 52.4, 3.6, deg(60), deg(140)); perch(deg(108), 52.4, 3.6);
    // the evening wind, which goes up the wall from the end of the third gallery to above the roof
    this.wind = W(deg(160), wall(52.4) + 2.2, 52.4);
    {
      const n = 70, at = new Float32Array(n * 3); this.gusts = Array.from({ length: n }, (_, i) => ({ a: rk() * TAU, r: 0.6 + rk() * 2.6, u: rk(), sp: 0.16 + rk() * 0.16 }));
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(at, 3));
      this.gust = new THREE.Points(g, new THREE.PointsMaterial({ map: world.glowTex, size: 0.55, color: 0xffe6b8, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      this.gust.frustumCulled = false; scene.add(this.gust);
    }
    // cloths hung from the galleries, and sand running out of the windows
    for (const [a, h, w, pal] of [[deg(70), 30.4, 3.4, CLOTH], [deg(118), 30.4, 3.4, TILE], [deg(75), 52.4, 3.6, TILE], [deg(128), 52.4, 3.6, CLOTH], [deg(290), 47.5, 3.6, CLOTH], [deg(215), 12.2, 3.2, CLOTH], [deg(300), 12.2, 3.2, TILE]]) {
      T(out(new THREE.BoxGeometry(1.7, 6.2, 0.08), a, wall(h) + w + 0.06, h - 3.4), pal, { scale: 0.5, spread: 1 });
      T(out(new THREE.ConeGeometry(0.98, 1.3, 3, 1).rotateX(Math.PI).rotateY(Math.PI / 6).scale(1, 1, 0.1), a, wall(h) + w + 0.06, h - 7.15), pal, { scale: 0.5, spread: 1 });
    }
    const pour = (lip, a, w, drop) => {
      const o = new V3(Math.cos(a), 0, Math.sin(a)), tan = new V3(-o.z, 0, o.x);
      const st = makeStream(scene, uTime, [lip.clone().addScaledVector(o, -1.2), lip.clone().addScaledVector(o, 0.3), lip.clone().addScaledVector(o, 0.8).setY(lip.y - 0.8), lip.clone().addScaledVector(o, 1.0).setY(lip.y - drop)], w, () => tan);
      st.mesh.visible = true; st.mat.uniforms.reach.value = 1; st.mat.uniforms.tint.value.set('#f4d596');
    };
    for (const [a, h, w] of [[deg(205), 23, 1.4], [deg(22), 43, 1.7], [deg(285), 60, 1.2], [deg(338), 8.6, 2.2]]) { const lip = W(a, wall(h) + 0.3, h); pour(lip, a, w, lip.y - duneH(lip.x, lip.z) + 0.6); }
    // ---- the roof: a floor, what is left of its wall, a ring of bronze that still turns, and a needle with a beam out of it
    disc(W(0, 0, TOP), wall(TOP) + 0.4);
    for (let k = 0; k < 26; k++) { const a = (k / 26) * TAU, tallness = [0.5, 0.9, 0.6, 1.3, 0.5, 0.7][k % 6] + (k % 7 === 3 ? 1.6 : 0); if (Math.abs(a - deg(0)) < 0.3 || k % 9 === 5) continue; T(rad(new THREE.BoxGeometry(0.7, tallness, (wall(TOP) + 0.2) * (TAU / 26) * 0.96), a, wall(TOP) + 0.05, TOP + tallness / 2), STONE, { scale: 0.4, spread: 0.8 }); }
    {
      const [nx, nz] = NEEDLE;
      T(place(new THREE.CylinderGeometry(1.0, 1.35, PERCH - TOP + 0.8, 8), nx, (PERCH + TOP + 0.8) / 2, nz));
      T(place(new THREE.ConeGeometry(1.25, 3.4, 8), nx, PERCH + 2.9, nz), TILE, { scale: 0.6, spread: 1 });
      T(place(new THREE.CylinderGeometry(1.5, 1.2, 0.5, 8), nx, PERCH + 1.0, nz));
      const world0 = (x, h, z) => new V3(TX + x + LX * h, Y0 + h, TZ + z + LZ * h);
      // four steps round it, and then the beam
      [[180, 74.0], [245, 75.7], [300, 77.4], [332, 79.1]].forEach(([a, h]) => { const x = nx + Math.cos(deg(a)) * 2.3, z = nz + Math.sin(deg(a)) * 2.3; T(place(new THREE.CylinderGeometry(1.3, 1.1, 0.5, 8), x, h - 0.25, z)); T(box(0.5, 0.4, 1.4, (x + nx) / 2, h - 0.3, (z + nz) / 2, 0, -deg(a) + Math.PI / 2), WOOD); disc(world0(x, h, z), 1.3); });
      T(box(8.6, 0.5, 1.7, nx + 4.0, PERCH - 0.25, nz), WOOD, { scale: 0.5 });
      T(box(0.3, 1.4, 0.3, nx + 8.1, PERCH - 0.9, nz), WOOD); T(place(new THREE.TorusGeometry(0.5, 0.07, 4, 10), nx + 8.1, PERCH - 1.9, nz), GILT);
      plank(world0(nx + 4.1, PERCH, nz), 0, 4.1, 0.9);
      this.needle = world0(nx, TOP, nz);
      this.perch = world0(nx + 7.3, PERCH, nz);          // where the picture is looked out over
      // the ring: an instrument for telling the hour by the sky. Two hoops of bronze, one inside the other, turning
      const hoop = new THREE.MeshLambertMaterial({ color: 0xd0a040, emissive: 0x3a2808, flatShading: true });
      this.ring = new THREE.Group(); this.ring.position.copy(world0(-3.4, TOP + 7.4, -1.5));
      this.ring.add(new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.26, 6, 40), hoop), new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.2, 6, 36), hoop));
      this.ring.children[1].rotation.y = 1.1;
      scene.add(this.ring);
      T(place(new THREE.CylinderGeometry(0.4, 0.9, 2.0, 8), -3.4, TOP + 1.0, -1.5)); fire(world0(-3.4, TOP + 7.4, -1.5), 9, 0xfff0c0, 0.7);
      this.perches.push({ p: world0(1.5, TOP, -1.8), h: TOP });
      // the two frames that lead back to the gallery: one where the painter comes in, out in the open desert, and one on the roof
      // (the first stands side-on at the top of the hill, so that whoever steps out of it is looking down the slope at the island)
      this.frames = [{ at: lowAt(ENTER[0] - 6, ENTER[1]), face: lowAt(ENTER[0] + 30, ENTER[1]) }, { at: world0(-0.5, TOP, 3.6), face: world0(1.5, TOP, -1) }];
    }
    // (the lean, last of all)
    const lean = new THREE.Matrix4().set(1, LX, 0, TX, 0, 1, 0, Y0, 0, LZ, 1, TZ, 0, 0, 0, 1);
    const stoneMat = () => paintify(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x1c140c }), { scale: 1.1, amp: 0.5 });
    this.tower = tb.mesh(stoneMat()); this.tower.geometry.applyMatrix4(lean); this.tower.frustumCulled = false;       // (one face only: from inside it, the wall is not in the way of the eye)
    this.lit = lit.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, fog: false })); this.lit.geometry.applyMatrix4(lean); this.lit.frustumCulled = false; this.lit.visible = false;
    scene.add(this.tower, this.lit);
    world.paintable.push(this.tower);

    {
      const a = W(deg(100), wall(30.4) + 3.3, 31.4), b = sandAt(7.5, 31, 9.4), n = 18, up = new V3(0, 1, 0), FLAG = [CLOTH[0], TILE[0], GILT[2], '#f6ead0'];
      let was = a;
      for (let i = 1; i <= n; i++) {
        const q = a.clone().lerp(b, i / n); q.y -= Math.sin((i / n) * Math.PI) * 3.4;
        const g = new THREE.BoxGeometry(0.06, 0.06, was.distanceTo(q)); g.applyMatrix4(new THREE.Matrix4().lookAt(was, q, up).setPosition(was.clone().lerp(q, 0.5)));
        add(g, WOOD);
        if (i < n) add(place(new THREE.ConeGeometry(0.46, 0.85, 3).rotateX(Math.PI).scale(1, 1, 0.1), q.x, q.y - 0.46, q.z, 0, -Math.atan2(b.z - a.z, b.x - a.x), 0), [FLAG[i % 4], FLAG[i % 4]], {});
        was = q;
      }
    }

    // ================================================================================== things only to be looked at
    // sand going over the edge of the desert, in five places
    for (const th of [0.5, 1.9, 3.0, 4.2, 5.5]) { const r = rimR(isl, th) - 0.5, lip = new V3(X0 + Math.cos(th) * r, 0, Z0 + Math.sin(th) * r); lip.y = duneH(lip.x, lip.z) + 0.1; pour(lip, th, 5 + (th * 3) % 4, lip.y - desertH(lip.x, lip.z) + 1); }
    // out in the open desert: rocks standing up out of it, two more of the great heads, and one of the seated ones, in to its chest
    {
      for (const [dx, dz, r, h] of [[-260, -180, 26, 120], [-190, -330, 18, 90], [310, -120, 30, 150], [220, 260, 22, 100], [-330, 140, 28, 130], [60, -420, 34, 170], [420, 90, 20, 110], [-150, 410, 24, 95]]) {
        const y = desertH(X0 + dx, Z0 + dz) - 6;
        add(place(new THREE.CylinderGeometry(r * 0.72, r, h, 9, 3), X0 + dx, y + h / 2, Z0 + dz, 0, dx, 0.03), ROCK, { scale: 0.02, spread: 0.8 });
        add(place(new THREE.CylinderGeometry(r * 0.86, r * 0.8, h * 0.07, 9), X0 + dx, y + h, Z0 + dz, 0, dx, 0.03), ROCK, { scale: 0.02, spread: 0.8 });
        world.colliders.push({ x: X0 + dx, z: Z0 + dz, r: r * 0.95, top: y + h, late: true });
      }
      for (const [p, s, yaw, tx, tz] of [[lowAt(-150, -250, 14), 30, 0.7, -0.35, 0.2], [lowAt(240, 60, 12), 26, -1.9, -0.6, -0.15]]) { set(head(), p, s, yaw, tx, tz); world.colliders.push({ x: p.x, z: p.z, r: s * 0.85, top: p.y + s, late: true }); }
      { const p = lowAt(-52, 350, -31); set(guardian(), p, 3.2, 0.5, 0.05, -0.08); world.colliders.push({ x: p.x, z: p.z, r: 10, top: p.y + 60, late: true }); }
    }
    this.mesh = bag.mesh(stoneMat()); this.mesh.material.side = THREE.DoubleSide; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.all = [this.sand, this.lowSand, this.tower, this.mesh, this.ring, this.drum];          // (not drawn while the painter is somewhere else)

    // a mirage: an oasis in a pan of sand off to the right of the way down. Water with the sky in it, palms on an islet
    // in the middle, reeds along the shore. It is plain from the hill and from far off; it shivers and thins as it is
    // come to, and where it was there is a dry hollow. (Noon makes it: by evening it is gone.)
    {
      const rs = mulberry32(4421), C = lowAt(MIRAGE[0], MIRAGE[1]), bag2 = new Bag(), one = new V3(1, 1, 1);
      const LEAF = ['#3f8a4a', '#2f7440', '#56a052', '#6fb45a', '#256638'], RIB = ['#8aa054', '#6f8a44'], DRY = ['#b89a58', '#9a7e46', '#c8ac6a'];
      const BARK = ['#8d7355', '#7a6248', '#a08566', '#6b553e'], REED = ['#4a7a3e', '#3a6a36', '#6a9048', '#8aa24e'], HEART = ['#9aa860', '#b0a868'];
      const soup = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return g; };
      /** A palm: a ringed trunk that bends as it rises, and a crown of feathered fronds, the young ones standing and the old ones hanging. */
      const palmTree = (base, tall, lean) => {
        const at = (s) => new V3(base.x + lean.x * s * s, base.y - 0.4 + tall * s, base.z + lean.z * s * s), R = (s) => (0.2 + tall * 0.028) * (1 - 0.5 * s) + 0.3 * Math.exp(-s * 16), N = 13;
        for (let i = 0; i < N; i++) {
          const a = at(i / N), b = at((i + 1) / N), dir = b.clone().sub(a), len = dir.length();
          const g = new THREE.CylinderGeometry(R((i + 1) / N) * 1.13, R(i / N) * 0.93, len * 1.05, 8);          // (each length a little wider at its top than the next is at its foot: the rings of the bark)
          g.applyMatrix4(new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), one));
          bag2.add(daub(g, BARK, { scale: 0.9, spread: 1 }));
        }
        const top = at(1), n = 15 + Math.round(tall * 0.25);
        bag2.add(daub(place(new THREE.IcosahedronGeometry(R(1) * 1.9, 1), top.x, top.y + 0.1, top.z, 0, 0, 0, 1, 1.35, 1), HEART));
        for (let k = 0; k < n; k++) {
          const old = k % 5 === 4, az = k * 2.4 + rs() * 0.5, hx = Math.cos(az), hz = Math.sin(az), side = new V3(-hz, 0, hx);
          const e0 = old ? -0.5 - rs() * 0.4 : 1.15 - (k / n) * 1.3 + (rs() - 0.5) * 0.25, droop = old ? 0.9 : 1.5 + rs() * 0.6, Lf = tall * (0.36 + rs() * 0.1) + 2.2, S = 13;
          const leaf = [], rib = [], p = top.clone();
          let was = null;
          for (let j = 0; j <= S; j++) {
            const t = j / S, e = e0 - droop * t * t, tan = new V3(hx * Math.cos(e), Math.sin(e), hz * Math.cos(e)), upL = new V3().crossVectors(side, tan);
            if (was) { const w = 0.1 * (1 - t) + 0.025, a = was.clone().addScaledVector(side, -w), b = was.clone().addScaledVector(side, w), c = p.clone().addScaledVector(side, w), d = p.clone().addScaledVector(side, -w); rib.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z); }
            if (t > 0.1) {
              // the leaflets: a pair at every step along the rib, longest at the middle of it, hanging more toward its end
              const ll = Lf * 0.3 * Math.sin(Math.PI * (0.06 + 0.9 * t)) ** 0.75, hang = 0.45 + 0.4 * t + (old ? 0.5 : 0), half = (Lf / S) * 0.42;
              for (const sgn of [-1, 1]) {
                const tip = p.clone().addScaledVector(side, sgn * ll * Math.cos(hang)).addScaledVector(upL, -ll * Math.sin(hang)).addScaledVector(tan, ll * 0.35), a = p.clone().addScaledVector(tan, -half), b = p.clone().addScaledVector(tan, half);
                leaf.push(a.x, a.y, a.z, b.x, b.y, b.z, tip.x, tip.y, tip.z);
              }
            }
            was = p.clone(); p.addScaledVector(tan, Lf / S);
          }
          bag2.add(daub(soup(leaf), old ? DRY : LEAF, { scale: 0.25, spread: 1 })); bag2.add(daub(soup(rib), old ? DRY : RIB, {}));
        }
        for (let k = 0; k < 5; k++) bag2.add(daub(place(new THREE.IcosahedronGeometry(0.2 + tall * 0.016, 1), top.x + Math.cos(k * 1.3) * R(1) * 2, top.y - 0.55 - (k % 2) * 0.3, top.z + Math.sin(k * 1.3) * R(1) * 2), k % 2 ? BARK : HEART));
      };
      /** A clump of blades: grass, or reeds if they are tall. */
      const tuft = (c, tall, n, pal) => {
        const g = [];
        for (let i = 0; i < n; i++) {
          const a = rs() * TAU, r = rs() * 0.25 * tall + 0.1, lean = 0.2 + rs() * 0.5, h = tall * (0.55 + rs() * 0.55), w = 0.05 + tall * 0.035, bx = c.x + Math.cos(a) * r, bz = c.z + Math.sin(a) * r, wx = Math.cos(a + 1.57) * w, wz = Math.sin(a + 1.57) * w;
          g.push(bx - wx, c.y - 0.15, bz - wz, bx + wx, c.y - 0.15, bz + wz, bx + Math.cos(a) * h * lean, c.y + h, bz + Math.sin(a) * h * lean);
        }
        bag2.add(daub(soup(g), pal, { scale: 0.5, spread: 1 }));
      };
      const stone = (c, s) => bag2.add(daub(place(new THREE.IcosahedronGeometry(s, 0), c.x, c.y + s * 0.2, c.z, rs() * 3, rs() * 3, 0, 1.3, 0.6, 1), ROCK, { scale: 0.6, spread: 1 }));
      const here = (dx, dz, lift = 0) => lowAt(MIRAGE[0] + dx, MIRAGE[1] + dz, lift);
      // three palms on the islet, leaning apart; grass under them
      palmTree(here(-0.6, 0.4), 15, new V3(4.4, 0, 1.4)); palmTree(here(1.9, -1.3), 10.5, new V3(-3.6, 0, -1.8)); palmTree(here(-2.3, -1.9), 6.2, new V3(-1.0, 0, 2.6));
      for (let i = 0; i < 16; i++) { const a = rs() * TAU, r = 0.8 + rs() * 3.6; tuft(here(Math.cos(a) * r, Math.sin(a) * r), 0.7 + rs() * 0.8, 7, LEAF); }
      stone(here(3.0, 1.6), 0.9); stone(here(-3.2, 2.2), 0.6);
      // and along the shore, wherever the water meets the sand: reeds standing in it, grass above it, a stone here and there
      for (let k = 0; k < 13; k++) {
        const a = (k / 13) * TAU + rs() * 0.3, cx = Math.cos(a), cz = Math.sin(a);
        let r = 9; while (r < 52 && desertH(C.x + cx * r, C.z + cz * r) < WATER) r += 0.5;
        if (r >= 52) continue;
        if (k % 3 !== 2) for (let i = 0; i < 3; i++) { const q = here(cx * (r - 0.6 - i * 0.5) + (rs() - 0.5) * 2.4, cz * (r - 0.6 - i * 0.5) + (rs() - 0.5) * 2.4); q.y = Math.max(q.y, WATER - 0.5); tuft(q, 2.0 + rs() * 1.2, 9, REED); }
        for (let i = 0; i < 3; i++) tuft(here(cx * (r + 1 + rs() * 2.5) + (rs() - 0.5) * 3, cz * (r + 1 + rs() * 2.5) + (rs() - 0.5) * 3), 0.6 + rs() * 0.6, 6, LEAF);
        if (k % 4 === 1) stone(here(cx * (r + 0.4), cz * (r + 0.4)), 0.5 + rs() * 0.6);
      }
      // (what is not there shivers a little even when it is all there, and comes apart in bands as it goes)
      this.uFade = { value: 1 }; this.uCamL = { value: new V3() };
      const band = 'smoothstep(0.0, 1.0, uFade * 1.7 - 0.7 * (0.5 + 0.5 * sin(gl_FragCoord.y * 0.3 + uTime * 5.0)))';
      const green = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, side: THREE.DoubleSide }), { scale: 1.1, amp: 0.45 }), painted = green.onBeforeCompile;
      green.onBeforeCompile = (sh, r) => {
        painted.call(green, sh, r);
        sh.uniforms.uTime = uTime; sh.uniforms.uFade = this.uFade;
        sh.vertexShader = 'uniform float uTime, uFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed.x += sin(transformed.y * 0.7 + uTime * 2.6) * (0.03 + 0.5 * (1.0 - uFade));');
        sh.fragmentShader = 'uniform float uTime, uFade;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\n  diffuseColor.a *= ${band};`);
      };
      green.customProgramCacheKey = () => 'mirage';
      const trees = bag2.mesh(green);
      // the water. How deep it is anywhere is worked out from the same ground the painter walks on, so its shore is
      // wherever the sand comes up through it. Pale and green in the shallows, darker out in the middle; the sky lies on
      // it, more of it the flatter it is looked across; and the palms stand in it upside down.
      const f1 = (v) => v.toFixed(2), P = [[here(-0.6, 0.4), 15, 4.4, 1.4, 6.6], [here(1.9, -1.3), 10.5, -3.6, -1.8, 5.2]];
      const water = new THREE.Mesh(new THREE.PlaneGeometry(130, 130).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: true,
        uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { uTime, uFade: this.uFade, uCamL: this.uCamL, uOrigin: { value: new THREE.Vector2(X0, Z0) } }),
        vertexShader: `uniform vec2 uOrigin; varying vec2 vS;
          #include <fog_pars_vertex>
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0); vS = wp.xz - uOrigin;
            vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `uniform float uTime, uFade; uniform vec3 uCamL; varying vec2 vS;
          #include <fog_pars_fragment>
          float desertH(float u, float v) {${DESERT}}
          // how much of a palm's upside-down shape lies on the water at q: a palm standing at c, so tall, leaning so, with a crown so wide
          float palm(vec2 q, vec2 c, float tall, vec2 lean, float crown, float camH) {
            vec2 toCam = uCamL.xz - c; float D = length(toCam); vec2 d = toCam / D;
            float t = dot(q - c, d), s = dot(q - c, vec2(-d.y, d.x));
            if (t <= 0.0 || t >= D * 0.9) return 0.0;
            float hgt = camH * t / (D - t), lat = s * D / (D - t), x1 = dot(lean, vec2(-d.y, d.x)), x0 = x1 * (hgt / tall) * (hgt / tall);
            float trunk = (1.0 - smoothstep(0.3, 0.62, abs(lat - x0))) * (1.0 - step(tall, hgt));
            vec2 r = vec2(lat - x1, hgt - tall); float a = atan(r.y, r.x);
            float fronds = 1.0 - smoothstep(0.7, 1.0, length(r) / (crown * (0.42 + 0.58 * abs(cos(a * 3.5 + 0.6)))));
            return max(trunk, fronds);
          }
          vec3 L(float r, float g, float b) { return pow(vec3(r, g, b), vec3(2.2)); }
          void main() {
            float depth = ${f1(WATER)} - desertH(vS.x, vS.y);
            if (depth < 0.0 || distance(vS, vec2(${f1(C.x - X0)}, ${f1(C.z - Z0)})) > 37.0) discard;
            vec2 rp = vec2(sin(vS.x * 1.7 + uTime * 1.1 + sin(vS.y * 0.9) * 1.3), sin(vS.y * 2.1 - uTime * 0.9 + sin(vS.x * 0.7) * 1.7));
            vec3 N = normalize(vec3(rp.x * 0.04, 1.0, rp.y * 0.04)), V = normalize(uCamL - vec3(vS.x, ${f1(WATER)}, vS.y)), R = reflect(-V, N);
            float across = pow(1.0 - max(dot(N, V), 0.0), 2.5);
            vec3 sky = mix(L(0.74, 0.86, 0.97), L(0.34, 0.58, 0.95), smoothstep(0.02, 0.7, R.y));
            vec3 body = mix(L(0.40, 0.80, 0.72), L(0.05, 0.33, 0.50), smoothstep(0.05, 2.6, depth));
            vec3 col = mix(body, sky, 0.16 + 0.62 * across);
            vec2 q = vS + rp * 0.22; float camH = uCamL.y - ${f1(WATER)};
            float shade = max(palm(q, vec2(${f1(P[0][0].x - X0)}, ${f1(P[0][0].z - Z0)}), ${f1(P[0][1])}, vec2(${f1(P[0][2])}, ${f1(P[0][3])}), ${f1(P[0][4])}, camH), palm(q, vec2(${f1(P[1][0].x - X0)}, ${f1(P[1][0].z - Z0)}), ${f1(P[1][1])}, vec2(${f1(P[1][2])}, ${f1(P[1][3])}), ${f1(P[1][4])}, camH));
            col = mix(col, L(0.10, 0.26, 0.16), shade * 0.7 * smoothstep(0.1, 0.8, depth));
            // a glitter, small and sharp, that comes and goes
            col += vec3(1.0, 0.97, 0.86) * smoothstep(0.93, 1.0, sin(vS.x * 2.9 + uTime * 1.9 + rp.y) * sin(vS.y * 3.4 - uTime * 1.5 + rp.x)) * 0.55;
            // the edge: a pale line where it laps, then the sand showing through the shallows
            float lap = depth + 0.05 * sin(uTime * 1.4 + vS.x * 0.8 + vS.y * 0.6);
            col = mix(L(0.97, 0.95, 0.88), col, smoothstep(0.03, 0.16, lap));
            gl_FragColor = vec4(col, smoothstep(0.0, 0.08, depth) * (0.62 + 0.36 * smoothstep(0.1, 1.6, depth)) * ${band});
            #include <fog_fragment>
          }`,
      }));
      water.position.set(C.x, WATER, C.z);
      this.mirageAt = C; this.mirage = new THREE.Group(); this.mirage.add(water, trees); this.mirage.visible = false;
      this.mirage.traverse((m) => { m.frustumCulled = false; });
      scene.add(this.mirage);
    }

    // the sky of this picture: a sun that can be seen going down, and then every star there is
    this.sky = new THREE.Group(); this.sky.visible = false;
    {
      const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
      this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, depthWrite: false, transparent: true, map: cv(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, '#ffffff'); g.addColorStop(0.42, '#ffffff'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }) }));
      this.sun.scale.setScalar(260); this.sky.add(this.sun);
      // stars: three sizes of them, most along a band across the sky; and a few great ones, each with a halo
      const sr = mulberry32(8087), tones = ['#ffffff', '#dfe8ff', '#fff2d0', '#ffdcec', '#cfe0ff'], band = new V3(0.35, 0.5, 0.79).normalize(), tmp = new V3();
      const far = () => { for (;;) { tmp.set(sr() * 2 - 1, sr() * 1.25 - 0.12, sr() * 2 - 1); const l = tmp.length(); if (l > 0.2 && l < 1) return tmp.multiplyScalar(1500 / l); } };
      this.stars = [[900, 3.2, 0.55], [420, 5.5, 0.4], [120, 9, 0.25]].map(([n, size, milky], k) => {
        const at = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
        for (let i = 0; i < n; i++) {
          let p = far(); if (sr() < milky) for (let tries = 0; tries < 6 && Math.abs(p.dot(band)) > 260; tries++) p = far();          // (kept near the band)
          at.set([p.x, p.y, p.z], i * 3); c.set(tones[Math.floor(sr() * tones.length)]).multiplyScalar(0.55 + sr() * 0.45); col.set([c.r, c.g, c.b], i * 3);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(at, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const m = new THREE.Points(g, new THREE.PointsMaterial({ map: world.glowTex, size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        m.frustumCulled = false; this.sky.add(m);
        return { m, sp: 0.9 + k * 0.7, ph: k * 2.1 };
      });
      this.great = Array.from({ length: 30 }, (_, i) => { const q = glowSprite(world.glowTex, 26 + sr() * 30, tones[i % tones.length], 0); q.position.copy(far()); if (q.position.y < 120) q.position.y = 120 + sr() * 500; this.sky.add(q); return { q, ph: sr() * TAU, sp: 0.8 + sr() * 1.6 }; });
      // the band itself: a long cloud of pale light
      this.milky = new THREE.Mesh(new THREE.PlaneGeometry(3400, 900), new THREE.MeshBasicMaterial({ fog: false, depthWrite: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, map: cv(512, 128, (x) => {
        for (let i = 0; i < 420; i++) { const u = sr() * 512, v = 64 + (sr() + sr() + sr() - 1.5) * 44, r = 8 + sr() * 30, g = x.createRadialGradient(u, v, 0, u, v, r); g.addColorStop(0, ['rgba(190,170,255,0.10)', 'rgba(150,190,255,0.09)', 'rgba(255,210,220,0.07)', 'rgba(255,240,210,0.08)'][i % 4]); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(u - r, v - r, r * 2, r * 2); }
      }) }));
      { const up = new V3(0.5, 0.62, -0.6).normalize(), along = new V3().crossVectors(band, up).normalize(), z = up.clone().negate(); this.milky.position.copy(up).multiplyScalar(1300); this.milky.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, new V3().crossVectors(z, along), z)); }
      this.sky.add(this.milky);
    }
    scene.add(this.sky);
    // birds about the head of the tower
    {
      const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, 1.5, 0, 0.1, 0, 0, -0.5], 3));
      const dark = new THREE.MeshBasicMaterial({ color: 0x3a2c3c, side: THREE.DoubleSide });
      this.birds = Array.from({ length: 7 }, (_, i) => { const g = new THREE.Group(), w = [new THREE.Mesh(wing, dark), new THREE.Mesh(wing, dark)]; w[1].scale.x = -1; g.add(...w); g.visible = false; scene.add(g); return { g, w, ph: i * 0.9, r: 15 + (i % 4) * 4.5, h: TOP - 6 + (i % 5) * 4.2, sp: (0.2 + (i % 3) * 0.05) * (i % 2 ? 1 : -1) }; });
      this.flee = 0;
    }

    // what the frame in the gallery shows, and what is said on stepping through it
    this.title = 'The Sunken Tower'; this.toast = ['The Sunken Tower', 'Noon to night'];
    this.picture = ['#f0d6a0', ['#f6dfae', '#e8c684', '#9cc4f0', '#c4dcf6', '#f2d8a4'], 87, (x) => {
      const sky = x.createLinearGradient(0, 0, 0, 200); sky.addColorStop(0, '#5a8fe0'); sky.addColorStop(1, '#f4e2bc'); x.globalAlpha = 0.8; x.fillStyle = sky; x.fillRect(0, 0, 256, 205); x.globalAlpha = 1;
      x.fillStyle = '#fff6d8'; x.beginPath(); x.arc(196, 52, 20, 0, TAU); x.fill();
      x.fillStyle = '#b8935f'; x.strokeStyle = 'rgba(40,26,12,0.6)'; x.lineWidth = 3; x.beginPath(); x.moveTo(92, 236); x.lineTo(118, 56); x.lineTo(158, 60); x.lineTo(150, 240); x.closePath(); x.fill(); x.stroke();
      x.strokeStyle = 'rgba(40,26,12,0.5)'; for (const v of [100, 150, 196]) { x.beginPath(); x.moveTo(104, v); x.lineTo(160, v + 4); x.stroke(); }
      x.fillStyle = '#e8c684'; x.beginPath(); x.moveTo(0, 230); x.quadraticCurveTo(70, 190, 140, 232); x.quadraticCurveTo(200, 200, 256, 226); x.lineTo(256, 320); x.lineTo(0, 320); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(120,84,40,0.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 262); x.quadraticCurveTo(90, 240, 256, 276); x.stroke();
    }];

    this.day = 0; this.far = 0;       // the hour, 0 noon .. 1 night; and the latest it has been since the painter came in
    this.done = false;                // has the picture been looked out over?
    this.was = false; this.wasGround = true; this.fall = 0;
    this.from = 0; this.high = 0; this.glid = false; this.armed = true;       // the gallery last stood on; the highest yet; did the painter glide down?
    this.below = true; this.up = false;                                        // is the painter down in the open desert? have they stood on the island since?
    this.events = []; this._v = new V3();
  }

  /** Is this point in the picture? (It lies east of the other one.) */
  contains(p) { return p.x > 10000; }
  /** How fast the air is rising here: only in the evening wind, at the end of the third gallery. */
  thermal(p) { const h = p.y - this.wind.y; return h > -0.6 && h < 26 && (p.x - this.wind.x) ** 2 + (p.z - this.wind.z) ** 2 < 3.8 * 3.8 ? 12 * clamp((25 - h) / 5, 0, 1) : 0; }
  /** Where to go next, for the flecks that drift toward it. */
  goal() { return this.done ? null : this.below ? this.foot : this.from >= 4 ? this.perch : this.perches[this.from + 1].p; }

  /** Press the sand down round a point: `r` wide, and how deep (0..1). A little of it is heaped round the edge. */
  dig(x, z, r, depth, tr = this.top) {
    const c = tr.c, S = 1024 / tr.size, u = (x - tr.x0) * S, v = (z - tr.z0) * S, R = r * S;
    let g = c.createRadialGradient(u, v, R * 0.5, u, v, R * 1.9);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, `rgba(255,255,255,${depth * 0.45})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(u - R * 2, v - R * 2, R * 4, R * 4);
    g = c.createRadialGradient(u, v, 0, u, v, R);
    g.addColorStop(0, `rgba(0,0,0,${depth})`); g.addColorStop(0.6, `rgba(0,0,0,${depth * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(u - R, v - R, R * 2, R * 2);
    tr.dirty = true;
  }
  /** The brush, striking the ground at (x, z): it leaves a scoop, in whichever sand is underfoot. */
  strike(x, z, p) {
    if (!this.contains(p)) return;
    const tr = Math.abs(duneH(x, z) - p.y) < 1.5 ? this.top : Math.abs(desertH(x, z) - p.y) < 1.5 ? this.low : null;
    if (tr) { this.dig(x, z, 1.25, 0.6, tr); this.events.push({ type: 'dust', x, y: p.y, z, n: 10 }); }
  }

  /** Something here that is worth a word. */
  waiting(p) {
    if (!this.contains(p)) return null;
    const h = p.y - Y0, near = (q, r) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < r * r;
    if (this.below) {
      if (near(this.mirageAt, 24)) return { key: 'mirage', line: 'There was water here, and a tree. From up there, there was.' };
      if (near(this.foot, 34)) return { key: 'chain', line: 'This chain still holds. Its links are broad enough to walk up.' };
      if (near(this.isl, 230)) return { key: 'chains', line: 'Chains held it to the desert once. Most have parted: one still comes down to the sand, on the top of the great dune.' };
      if (p.z > Z0 + ENTER[1] - 30) return { key: 'adrift', line: 'There: a desert of its own, adrift over this one. And a long way down to it.' };
      return { key: 'vast', line: 'Sand this steep is not for walking. Go with it.' };
    }
    if (this.done && h > TOP - 1) return { key: 'roofframe', line: 'The frame on the roof leads back to the gallery.' };
    if (h > TOP - 1) return { key: 'beam', line: 'There is a beam out of the needle, over everything. The steps go round to it.' };
    if (this.from === 3 && h > 51) return { key: 'windup', loud: true, line: 'The evening wind goes up the wall at the end of this gallery. Jump into it, and hold Space to rise.' };
    if (near(this.drumAt, 9) && Math.abs(p.y - this.drumAt.y) < 4) return { key: 'drum', line: 'A drum. It throws up whatever lands on its skin.' };
    if (this.from === 1) return { key: 'tower', line: 'It goes down into the sand as far as it goes up. The way up is round the outside.' };
    if (near(this.palm, 12)) return { key: 'buried', line: 'Whoever they were, the sand has had them a long time.' };
    if (Math.abs(p.y - duneH(p.x, p.z)) < 0.5 && !near(START, 9)) return { key: 'sand', line: 'The sand keeps the mark of whatever crosses it, for a while.' };
    return null;
  }

  /** The look-out is over: the picture is finished. */
  surveyed() { this.done = true; }
  save() { return { done: this.done ? 1 : 0 }; }
  load(d) { this.done = !!(d && d.done); }

  update(dt, t, player, camera) {
    const ev = this.events.splice(0), here = !!player && this.contains(player.pos);
    this.sky.visible = this.gust.visible = this.mirage.visible = here; for (const b of this.birds) b.g.visible = here; for (const m of this.all) m.visible = here;
    if (!here) { this.was = false; this.sandy = false; this.lit.visible = false; return ev; }
    const p = player.pos, h = p.y - Y0, sand = duneH(p.x, p.z), onSand = player.grounded && Math.abs(p.y - sand) < 0.4;
    const under = desertH(p.x, p.z), tr = onSand ? this.top : player.grounded && Math.abs(p.y - under) < 0.4 ? this.low : null, landed = player.grounded && !this.wasGround;
    if (player.grounded) this.sandy = tr === this.low;          // (loose sand underfoot, or last underfoot: the painter slides on it)
    this.below = h < -8 && p.y - under < 4;          // (down in the open desert, and not on the chain up out of it)
    // (stepping in: it is noon again, whatever hour it was left at; and nothing has crossed the sand down here)
    if (!this.was) {
      this.was = true; this.far = 0; this.day = 0; this.from = 0; this.glid = false; this.up = false; this.wasGround = true;
      const m = this.low; m.c.fillStyle = GREY; m.c.fillRect(0, 0, 1024, 1024); m.x0 = p.x - m.size / 2; m.z0 = p.z - m.size / 2; m.dirty = true;
    }
    // ---- the open desert has an end, though not one that can be seen: the painter is turned back there
    { const dx = p.x - LAND.x, dz = p.z - LAND.z, d = Math.hypot(dx, dz); if (d > LAND.keep) { p.x = LAND.x + (dx / d) * LAND.keep; p.z = LAND.z + (dz / d) * LAND.keep; } }
    // its net of sand goes with the painter, and so does the square of it that keeps marks: moved over by whole dots, so that nothing in it is smudged
    this.uEye.value.set(Math.round((p.x - X0) * 2) / 2, Math.round((p.z - Z0) * 2) / 2);
    {
      const m = this.low, S = 1024 / m.size, du = Math.round((p.x - m.x0 - m.size / 2) * S), dv = Math.round((p.z - m.z0 - m.size / 2) * S);
      if (this.below && Math.max(Math.abs(du), Math.abs(dv)) > 30 * S) {
        m.c.globalCompositeOperation = 'copy'; m.c.drawImage(m.c.canvas, -du, -dv);
        m.c.globalCompositeOperation = 'destination-over'; m.c.fillStyle = GREY; m.c.fillRect(0, 0, 1024, 1024); m.c.globalCompositeOperation = 'source-over';
        m.x0 += du / S; m.z0 += dv / S; m.dirty = true;
      }
      this.uLow.value.set(m.x0 - X0, m.z0 - Z0, m.size);
    }

    // ---- the tower is in the way, at whatever height the painter is; and the needle, on the roof
    if (h > -2 && h < TOP - 0.1) { const dx = p.x - ax(h), dz = p.z - az(h), d = Math.hypot(dx, dz) || 1, need = wall(h) + 0.45; if (d < need) { p.x = ax(h) + (dx / d) * need; p.z = az(h) + (dz / d) * need; } }
    if (h > TOP - 0.5 && h < PERCH + 2) { const dx = p.x - this.needle.x - LX * (h - TOP), dz = p.z - this.needle.z, d = Math.hypot(dx, dz) || 1; if (d < 1.75) { p.x += (dx / d) * (1.75 - d); p.z += (dz / d) * (1.75 - d); } }

    // ---- the hour: by how near the tower is, then by how far up it; and it only goes forward
    const want = h > 12 ? 0.25 + 0.67 * clamp((h - 12.2) / (TOP - 12.2), 0, 1) + (h > PERCH - 1 ? 0.08 : 0) : h > -8 ? Math.max(0.1, 0.25 * clamp(1 - (Math.hypot(p.x - TX, p.z - TZ) - 14) / 72, 0, 1)) : 0.1 * clamp(1 - Math.hypot(p.x - this.foot.x, p.z - this.foot.z) / 380, 0, 1);
    this.far = Math.max(this.far, want);
    this.day += clamp(this.far - this.day, -0.05 * dt, 0.05 * dt);
    const night = smooth((this.day - 0.66) / 0.3);
    // the mirage: all there from far off and from the last rise before it, going as it is come down to, gone before its shore is reached; and gone with the noon
    {
      const fade = smooth((Math.hypot(p.x - this.mirageAt.x, p.z - this.mirageAt.z) - 48) / 165) * (1 - smooth((this.day - 0.1) / 0.12));
      this.mirage.visible = fade > 0.01; this.uFade.value = fade; this.uCamL.value.set(camera.position.x - X0, camera.position.y, camera.position.z - Z0);
    }

    // ---- the sand takes the mark of what crosses it
    if (tr) {
      const fast = player.surfing;
      if (!this.wasGround) { const hard = clamp(this.fall / 30, 0.25, 1); this.dig(p.x, p.z, 1.0 + hard * 1.5, 0.55 + hard * 0.4, tr); ev.push({ type: 'dust', x: p.x, y: p.y, z: p.z, n: Math.round(10 + hard * 26), ring: true }); this.stepAt.copy(p); }
      else if (this.stepAt.distanceToSquared(p) > (fast ? 0.2 : 0.12)) {
        // (a little behind the feet, so that the furrow opens after them)
        const back = Math.hypot(player.vel.x, player.vel.z) || 1;
        this.dig(p.x - (player.vel.x / back) * 0.4, p.z - (player.vel.z / back) * 0.4, fast ? 0.95 : 0.66, fast ? 0.4 : 0.3, tr);
        if (fast || Math.random() < 0.3) ev.push({ type: 'dust', x: p.x, y: p.y, z: p.z, n: fast ? 3 : 1 });
        this.stepAt.copy(p);
      }
    }
    if (!player.grounded) { this.fall = Math.max(0, -player.vel.y); if (player.gliding) this.glid = true; }
    this.wasGround = player.grounded;
    // the wind fills the marks in again, a little at a time
    const fill = (this.tfill += dt) > 6; if (fill) this.tfill = 0;
    for (const m of [this.top, this.low]) {
      if (fill) { m.c.globalAlpha = 0.06; m.c.fillStyle = GREY; m.c.fillRect(0, 0, 1024, 1024); m.c.globalAlpha = 1; m.dirty = true; }
      if (m.dirty) { m.dirty = false; m.tex.needsUpdate = true; }
    }
    const glided = this.glid;

    // ---- the climb. Standing on a gallery (or the roof) makes it the place a fall is taken back to: whoever comes
    // down below it without gliding is carried back up to it. (Gliding down is meant; and once the picture is
    // finished, so is any way down.)
    if (player.grounded && !player.lift) {
      const on = Math.abs(h - TOP) < 0.3 ? 4 : this.perches.findIndex((q, i) => i > 0 && i < 4 && Math.abs(h - q.h) < 0.3 && Math.hypot(p.x - ax(q.h), p.z - az(q.h)) < wall(q.h) + 4);
      if (on > 0) { if (on > this.high) { this.high = on; ev.push({ type: 'perch', n: on }); } this.from = on; }
      else if (this.from > 0 && h < this.perches[this.from].h - 3) {
        if (!this.glid && !this.done) { player.safe.copy(this.perches[this.from].p); player.floatBack(); ev.push({ type: 'back' }); } else this.from = 0;
      }
      this.glid = false;
    }
    // (the island is such a place too: whoever falls from it to the desert below is carried back to the head of the chain)
    if (player.grounded && !player.lift) {
      if (h > -6) this.up = true;
      else if (this.below) { if (this.up && landed && this.fall > 26 && !glided && !this.done) { player.safe.copy(this.head); player.floatBack(); ev.push({ type: 'back' }); } else this.up = false; }
    }
    // the drum throws up whoever lands on it
    if (player.grounded && Math.abs(p.y - this.drumAt.y) < 0.3 && (p.x - this.drumAt.x) ** 2 + (p.z - this.drumAt.z) ** 2 < 2.2) {
      player.vel.y = 26; player.grounded = false; player.jumps = 1; player.airTime = 1; this.drumT = 1;
      ev.push({ type: 'drum', at: this.drumAt });
    }
    this.drumT = Math.max(0, this.drumT - dt * 1.6);
    this.drum.scale.y = 1 - Math.sin(this.drumT * 22) * 0.22 * this.drumT;
    // the look-out: at the end of the beam. (Armed again once the painter has gone back along it.)
    const tip = Math.hypot(p.x - this.perch.x, p.z - this.perch.z);
    if (this.armed && player.grounded && Math.abs(p.y - this.perch.y) < 0.4 && tip < 1.5) { this.armed = false; this.flee = 1; ev.push({ type: 'survey' }); }
    else if (tip > 6) this.armed = true;

    // ---- what moves: the wind up the wall, the ring, the birds; what gives light once it is evening
    {
      const at = this.gust.geometry.attributes.position.array;
      this.gusts.forEach((g, i) => { g.u = (g.u + g.sp * dt) % 1; const a = g.a + g.u * 5; at[i * 3] = this.wind.x + Math.cos(a) * g.r; at[i * 3 + 1] = this.wind.y + g.u * 25; at[i * 3 + 2] = this.wind.z + Math.sin(a) * g.r; });
      this.gust.geometry.attributes.position.needsUpdate = true;
    }
    this.ring.rotation.y += dt * 0.07; this.ring.children[1].rotation.x += dt * 0.11;
    this.flee = Math.max(0, this.flee - dt * 0.05);
    for (const b of this.birds) {
      const a = b.ph + t * b.sp, r = b.r + smooth(this.flee) * 60, y = Y0 + b.h + Math.sin(t * 0.5 + b.ph) * 2 + smooth(this.flee) * 14;
      b.g.position.set(ax(TOP) + Math.cos(a) * r, y, az(TOP) + Math.sin(a) * r); b.g.rotation.y = -a + (b.sp > 0 ? Math.PI : 0);
      const flap = Math.sin(t * 7 + b.ph * 3) * 0.6; b.w[0].rotation.z = flap; b.w[1].rotation.z = -flap;
    }
    this.lit.visible = night > 0.02; this.lit.material.opacity = night;
    for (const f of this.fires) { f.q.visible = night > 0.02; f.q.material.opacity = night * f.op * (0.82 + 0.18 * Math.sin(t * 5.1 + f.ph)); }

    // ---- the sky: the sun where the hour puts it, going red as it goes down; then the stars
    this.sky.position.copy(camera.position);
    {
      let i = 0; while (i < DUNE_SUN.length - 2 && this.day > DUNE_SUN[i + 1][0]) i++;
      const a = DUNE_SUN[i], b = DUNE_SUN[i + 1], d = this._v.lerpVectors(a[1], b[1], clamp((this.day - a[0]) / (b[0] - a[0]), 0, 1)).normalize(), low = smooth(1 - d.y / 0.45);
      this.sun.position.copy(d).multiplyScalar(1700);
      this.uShade.value.set((-d.x / Math.max(d.y, 0.2)) * 118, (-d.z / Math.max(d.y, 0.2)) * 118, 0.32 * smooth((d.y - 0.12) / 0.3));          // (where the island's shadow lies on the desert under it)
      this.sun.material.color.setRGB(1, 1 - low * 0.42, 0.92 - low * 0.72);
      this.sun.material.opacity = smooth((d.y + 0.1) / 0.1); this.sun.scale.setScalar(240 + low * 150);
    }
    for (const s of this.stars) s.m.material.opacity = night * (0.8 + 0.2 * Math.sin(t * s.sp + s.ph));
    for (const s of this.great) s.q.material.opacity = night * (0.6 + 0.4 * Math.sin(t * s.sp + s.ph));
    this.milky.material.opacity = night * 0.9;
    return ev;
  }
}
