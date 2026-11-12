import * as THREE from 'three';
import { PAL, daub, place, Bag, strokeGeo, paintify, drawStroke, mulberry32, rand, rr, pick, noise3, fbm, clamp, glowTexture, glowSprite } from './util.js';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;

export const ISLANDS = [
  { x: 0, y: 0, z: 0, r: 25, ph: 0.4, name: 'Lantern Rise' },
  { x: 16, y: 5, z: -80, r: 15, ph: 1.9, name: 'Maple Step' },
  { x: -30, y: 12, z: -145, r: 19, ph: 3.1, name: 'Weeping Palette' },
  { x: 18, y: 20, z: -212, r: 15, ph: 4.4, name: 'Last Easel' },
  { x: 0, y: 28, z: -300, r: 40, ph: 5.2, name: 'The Everpainting Spire' },
];
const CASTLE = { x: 0, y: 28, z: -306 };

export function rimR(isl, th) {
  return isl.r * (1 + 0.1 * Math.sin(3 * th + isl.ph) + 0.05 * Math.sin(7 * th + isl.ph * 2.3));
}
export function surfY(isl, x, z) {
  return isl.y + 0.45 * Math.sin(x * 0.21 + isl.ph) * Math.cos(z * 0.19 + isl.ph * 1.7);
}
function edgePoint(isl, tx, tz, inset, lift = 0.22) {
  const th = Math.atan2(tz - isl.z, tx - isl.x);
  const rad = rimR(isl, th) - inset;
  const x = isl.x + Math.cos(th) * rad, z = isl.z + Math.sin(th) * rad;
  return new V3(x, surfY(isl, x, z) + lift, z);
}

// ------------------------------------------------------------------ islands
const TOP_SPAN = 1.22;          // island texture covers a square of 2 * r * TOP_SPAN
export function islandTopGeo(isl, K = 22, S = 72) {
  const pos = [], uv = [], idx = [];
  for (let k = 0; k <= K; k++) for (let i = 0; i <= S; i++) {
    const th = (i / S) * TAU, rad = (rimR(isl, th) * k) / K;
    const x = isl.x + Math.cos(th) * rad, z = isl.z + Math.sin(th) * rad;
    pos.push(x, surfY(isl, x, z) - (k === K ? 0.2 : 0), z);
    uv.push((x - isl.x) / (2 * isl.r * TOP_SPAN) + 0.5, 0.5 - (z - isl.z) / (2 * isl.r * TOP_SPAN));
  }
  for (let k = 0; k < K; k++) for (let i = 0; i < S; i++) {
    const p = k * (S + 1) + i, q = p + S + 1;
    idx.push(p, p + 1, q, p + 1, q + 1, q);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Paint an island's ground on a canvas: thousands of real brush strokes, with the path laid on top. */
function islandTexture(isl, polys, size, seed) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const rnd = mulberry32(seed);
  const span = 2 * isl.r * TOP_SPAN, px = size / span;       // pixels per world unit
  const W = (u) => isl.x + (u / size - 0.5) * span, Zc = (v) => isl.z + (v / size - 0.5) * span;
  x.fillStyle = '#a45ccc'; x.fillRect(0, 0, size, size);
  // nearest path point + direction
  const pts = [];
  for (const poly of polys) for (let i = 0; i < poly.length - 1; i++) {
    const p = poly[i], q = poly[i + 1];
    if (Math.abs(p.x - isl.x) > isl.r * 1.4 || Math.abs(p.z - isl.z) > isl.r * 1.4) continue;
    pts.push([p.x, p.z, Math.atan2(q.z - p.z, q.x - p.x)]);
  }
  const nearest = (wx, wz) => {
    let best = 1e9, ang = 0;
    for (const p of pts) { const d = (p[0] - wx) ** 2 + (p[1] - wz) ** 2; if (d < best) { best = d; ang = p[2]; } }
    return [Math.sqrt(best), ang];
  };
  const shade = (hex, k) => { const col = new THREE.Color(hex); col.offsetHSL(0, 0, k); return '#' + col.getHexString(); };
  const stroke = (u, v, ang, pal, scale) => {
    const base = pal[Math.floor(rnd() * pal.length)];
    const col = shade(base, (rnd() - 0.5) * 0.1);
    drawStroke(x, u, v, ang, (1.3 + rnd() * 2.4) * px * scale, (0.4 + rnd() * 0.65) * px * scale, col, shade(base, 0.09), shade(base, -0.09), rnd);
  };
  const GROUND = PAL.ground, ACCENT = ['#fff4e2', '#f9e6b4', '#f7d6de', '#f7d6de', '#fbd08a', '#40d8d0'];
  const N = Math.floor(span * span * 1.5);
  for (let i = 0; i < N; i++) {
    const u = rnd() * size, v = rnd() * size, wx = W(u), wz = Zc(v);
    const [d, pang] = nearest(wx, wz);
    const flow = fbm(wx * 0.05 + isl.ph, 0, wz * 0.05) * 5 + isl.ph;
    const ang = d < 9 ? pang + (rnd() - 0.5) * 1.1 : flow + (rnd() - 0.5) * 0.7;
    // colour zones: a patch of the palette picked by slow noise, with the odd pale accent stroke
    const zone = fbm(wx * 0.09 + 3.1, isl.ph, wz * 0.09 + 1.7);
    const k = Math.floor(clamp((zone - 0.5) * 2.6 + 0.5, 0, 0.999) * (GROUND.length - 2));
    stroke(u, v, ang, rnd() < 0.06 ? ACCENT : GROUND.slice(k, k + 3), 1);
  }
  // the path: pale strokes following its direction, ragged at the edges
  if (pts.length) {
    for (let i = 0; i < N * 0.85; i++) {
      const p = pts[Math.floor(rnd() * pts.length)];
      const off = (rnd() + rnd() - 1) * 2.8, along = (rnd() - 0.5) * 2.5;
      const wx = p[0] - Math.sin(p[2]) * off + Math.cos(p[2]) * along, wz = p[1] + Math.cos(p[2]) * off + Math.sin(p[2]) * along;
      const u = ((wx - isl.x) / span + 0.5) * size, v = ((wz - isl.z) / span + 0.5) * size;
      stroke(u, v, p[2] + (rnd() - 0.5) * (rnd() < 0.2 ? 2.4 : 0.6), PAL.path, 1.05);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function islandUnderGeo(isl, J = 9, S = 44) {
  const depth = isl.r * 1.2 + 7;
  const P = (j, s) => {
    const th = (s / S) * TAU, t = j / J;
    const nz = noise3(Math.cos(th) * 2.2 + isl.ph, t * 3.1, Math.sin(th) * 2.2);
    const f = Math.pow(1 - t, 0.75) * (1 + (nz - 0.5) * 0.7 * Math.min(1, t * 3));
    const rad = rimR(isl, th) * f;
    const x = isl.x + Math.cos(th) * rad, z = isl.z + Math.sin(th) * rad;
    const y = j === 0 ? surfY(isl, x, z) - 0.2 : isl.y - 0.2 - depth * Math.pow(t, 1.25) - nz * 2.5;
    return [x, y, z];
  };
  const pos = [];
  for (let j = 0; j < J; j++) for (let s = 0; s < S; s++) {
    const a = P(j, s), b = P(j, s + 1), c = P(j + 1, s + 1), d = P(j + 1, s);
    pos.push(...a, ...b, ...c);
    if (j < J - 1) pos.push(...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const ground = PAL.ground.map((h) => new THREE.Color(h));
  return daub(g, PAL.rock, {
    fn: (x, y, z, out, cols) => {
      const th = Math.atan2(z - isl.z, x - isl.x);
      const v = noise3(th * 5 + isl.ph * 3, y * 0.035, 1.3);
      if (isl.y - y < 1.5 + v * 5) return out.copy(ground[Math.floor(v * 13) % ground.length]);
      if (noise3(th * 9, y * 0.2, 5.5) > 0.86) return out.set('#38c8c8');
      return out.copy(cols[Math.floor(v * 2.4 * cols.length) % cols.length]);
    },
  });
}

// ------------------------------------------------------------------ shaders
const NOISE_GLSL = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
vec3 srgb(float r, float g, float b) { return pow(vec3(r, g, b), vec3(2.2)); }
`;

function buildSky(scene, uTime) {
  const mat = new THREE.ShaderMaterial({
    // every colour is a uniform so the day can move (see day.js, which fills these in)
    uniforms: {
      time: uTime, glow: { value: 0 }, stars: { value: 0 },
      top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, low: { value: new THREE.Color() },
      cCream: { value: new THREE.Color() }, cRose: { value: new THREE.Color() }, cViolet: { value: new THREE.Color() }, cBlue: { value: new THREE.Color() },
      sunCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 0.28, -1) },
    },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vDir; uniform float time; uniform float glow; uniform float stars;
      uniform vec3 top, mid, hor, low, cCream, cRose, cViolet, cBlue, sunCol, sunDir;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(low, hor, smoothstep(-0.5, 0.0, h));
        col = mix(col, mid, smoothstep(0.0, 0.28, h));
        col = mix(col, top, smoothstep(0.22, 0.85, h));
        // swirling painted cloud strokes (domain-warped noise)
        vec2 p = d.xz / (abs(h) + 0.42) * 1.4;
        vec2 q = p + 0.9 * vec2(fbm(p * 1.1 + time * 0.006), fbm(p * 1.1 + 5.2 - time * 0.004));
        vec2 r2 = q + 0.7 * vec2(fbm(q * 1.7 + 1.7), fbm(q * 1.7 + 9.2));
        float n = fbm(r2 * 1.5);
        vec3 cream = cCream, rose = cRose, violet = cViolet, blue = cBlue;
        col = mix(col, cream, smoothstep(0.54, 0.72, n) * 0.8);
        col = mix(col, rose, smoothstep(0.46, 0.52, n) * (1.0 - smoothstep(0.52, 0.60, n)) * 0.7);
        col = mix(col, violet, (1.0 - smoothstep(0.24, 0.40, n)) * 0.45);
        col = mix(col, blue, (1.0 - smoothstep(0.14, 0.28, n)) * 0.4 * smoothstep(0.0, 0.5, h));
        // warm light behind the spire (north)
        float sun = max(dot(d, normalize(sunDir)), 0.0);
        col += sunCol * (pow(sun, 6.0) * 0.16 + pow(sun, 40.0) * 0.4) * (1.0 + glow * 1.5);
        // stars: fat dabs of light, big enough to survive being painted, each with its own slow twinkle
        if (stars > 0.001 && h > 0.02) {
          vec2 sp = d.xz / (h + 0.45) * 13.0;
          vec2 cell = floor(sp);
          float s = hash(cell);
          vec2 o = (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.55;
          float size = 0.09 + 0.11 * hash(cell + 1.3);
          float star = step(0.55, s) * smoothstep(size, size * 0.55, length(fract(sp) - 0.5 - o)) * (0.75 + 0.25 * sin(time * (0.8 + s * 2.0) + s * 40.0));
          col += vec3(1.7, 1.55, 1.2) * star * stars * smoothstep(0.02, 0.3, h) * (1.0 - smoothstep(0.5, 0.66, n) * 0.9);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 20), mat);
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}

function buildPaintSea(scene, uTime) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: uTime, tint: { value: new THREE.Color(1, 1, 1) } }, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vP; uniform float time; uniform vec3 tint;
      ${NOISE_GLSL}
      void main() {
        float r = length(vP), a = atan(vP.y, vP.x);
        float sp = a + log(r + 0.04) * 3.4 - time * 0.07;
        float n = fbm(vP * 5.0 + time * 0.015);
        float band = sin(sp * 3.0 + n * 4.5);
        vec3 turq = srgb(0.22, 0.86, 0.82), teal = srgb(0.20, 0.58, 0.86), violet = srgb(0.62, 0.42, 0.92), gold = srgb(1.0, 0.84, 0.48), cream = srgb(1.0, 0.96, 0.9), rose = srgb(0.95, 0.5, 0.75);
        vec3 col = mix(turq, violet, smoothstep(-0.3, 0.7, band));
        col = mix(col, teal, smoothstep(0.3, 0.9, sin(sp * 2.0 - n * 3.0)) * 0.6);
        col = mix(col, rose, smoothstep(0.7, 0.95, sin(sp * 4.0 + n * 5.0 + 1.0)) * 0.6);
        col = mix(col, gold, smoothstep(0.78, 0.96, sin(sp * 5.0 + n * 6.0)));
        col = mix(col, cream, smoothstep(0.82, 0.98, sin(sp * 7.0 - n * 3.0 + 2.0)) * 0.9);
        float alpha = smoothstep(1.0, 0.6, r);
        gl_FragColor = vec4(col * tint, alpha);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.rotation.x = -Math.PI / 2; m.scale.setScalar(430); m.position.set(70, -78, -190);
  m.renderOrder = -5;
  scene.add(m);
  return mat;
}

export function waterfallMesh(isl, th0, th1, height, uTime) {
  const S = 18, pos = [], uv = [], idx = [];
  for (let s = 0; s <= S; s++) {
    const th = th0 + ((th1 - th0) * s) / S, rad = rimR(isl, th) + 0.25;
    const x = isl.x + Math.cos(th) * rad, z = isl.z + Math.sin(th) * rad;
    pos.push(x, isl.y + 0.1, z, isl.x + Math.cos(th) * (rad + 2.5), isl.y - height, isl.z + Math.sin(th) * (rad + 2.5));
    uv.push(s / S, 0, s / S, 1);
    if (s < S) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    // tintA is the colour the water has settled into (amtA: how much of it), tintB a new colour on its way down (front: how far)
    uniforms: { time: uTime, tintA: { value: new THREE.Color(1, 1, 1) }, amtA: { value: 0 }, tintB: { value: new THREE.Color(1, 1, 1) }, front: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float; varying vec2 vUv; uniform float time; uniform vec3 tintA; uniform float amtA; uniform vec3 tintB; uniform float front;
      ${NOISE_GLSL}
      void main() {
        float n = vnoise(vec2(vUv.x * 9.0, vUv.y * 2.5 - time * 0.7));
        float streak = vnoise(vec2(vUv.x * 34.0, vUv.y * 1.6 - time * 1.2));
        vec3 turq = srgb(0.20, 0.88, 0.86), white = srgb(0.92, 1.0, 1.0), violet = srgb(0.58, 0.44, 0.95), gold = srgb(1.0, 0.86, 0.5);
        vec3 col = mix(turq, white, smoothstep(0.45, 0.8, streak));
        col = mix(col, violet, (1.0 - smoothstep(0.2, 0.5, n)) * 0.6);
        col = mix(col, gold, smoothstep(0.82, 0.95, vnoise(vec2(vUv.x * 20.0 + 4.0, vUv.y * 1.2 - time * 0.9))) * 0.7);
        // dyed water keeps its light and dark streaks and its white foam, in the new colour
        float lum = dot(col, vec3(0.3, 0.6, 0.1)), foam = smoothstep(0.62, 0.9, streak) * 0.5;
        col = mix(col, mix(tintA * (0.5 + lum * 1.0), white, foam), amtA);
        float edge = front * 1.3 - 0.14 + (n - 0.5) * 0.2;
        col = mix(col, mix(tintB * (0.5 + lum * 1.0), white, foam), smoothstep(edge, edge - 0.1, vUv.y) * step(0.0005, front));
        float alpha = (1.0 - smoothstep(0.45, 1.0, vUv.y)) * (0.8 + 0.2 * n) * smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  return new THREE.Mesh(g, mat);
}

function bannerMaterial(uTime) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 224;
  const x = c.getContext('2d');
  x.fillStyle = '#8c1f47'; x.fillRect(0, 0, 128, 224);
  for (let i = 0; i < 60; i++) {
    x.fillStyle = pick(['rgba(180,50,90,0.5)', 'rgba(90,16,50,0.5)', 'rgba(200,80,110,0.35)']);
    x.fillRect(Math.random() * 128, Math.random() * 224, 6 + Math.random() * 30, 3 + Math.random() * 5);
  }
  x.fillStyle = '#f6e2c0';
  x.beginPath(); x.arc(64, 96, 34, 0, TAU); x.fill();
  x.fillStyle = '#8c1f47';
  x.beginPath(); x.arc(78, 88, 29, 0, TAU); x.fill();
  x.strokeStyle = '#e8b85a'; x.lineWidth = 6; x.strokeRect(3, 3, 122, 218);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.ShaderMaterial({
    uniforms: { time: uTime, map: { value: tex } }, side: THREE.DoubleSide, fog: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv; uniform float time;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float k = (1.0 - uv.y);
        float s = sin(time * 2.2 + wp.x * 0.7 + wp.z * 0.5 + uv.y * 4.0) * 0.28 * k;
        wp.xyz += (modelMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz * s;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float; varying vec2 vUv; uniform sampler2D map;
      void main() {
        float notch = abs(vUv.x - 0.5) * 0.36;           // swallow-tail cut
        if (vUv.y < 0.18 - notch) discard;
        gl_FragColor = vec4(texture2D(map, vUv).rgb, 1.0);
      }`,
  });
}

// ------------------------------------------------------------------ world
export function buildWorld(scene, uTime) {
  const terrainMat = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { scale: 1 });
  const glowMat = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x3a2c30 }), { scale: 1.4 });
  const farMat = paintify(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }), { scale: 11 });
  const museMat = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x5a4c52, fog: false }), { scale: 16 });
  const bag = new Bag(), castleBag = new Bag(), farBag = new Bag();
  const colliders = [];
  const pathPolys = [];
  const glowTex = glowTexture();
  const islands = ISLANDS.map((d, i) => ({ ...d, index: i }));
  const bMat = bannerMaterial(uTime);

  scene.fog = new THREE.Fog(0xb4b0f2, 130, 1050);
  const hemi = new THREE.HemisphereLight(0xe6e4ff, 0xb46ec4, 1.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.0);
  sun.position.set(-0.55, 0.9, 0.35);
  scene.add(sun);

  const sky = buildSky(scene, uTime);
  const seaMat = buildPaintSea(scene, uTime);

  // --- main islands
  for (const isl of islands) {
    bag.add(islandUnderGeo(isl));
    const depth = isl.r * 1.2 + 7;
    for (let i = 0; i < 7; i++) {
      const a = rand() * TAU, rad = isl.r * rr(0.1, 0.62), len = rr(6, 15);
      bag.add(daub(place(new THREE.ConeGeometry(rr(0.9, 2.2), len, 6), isl.x + Math.cos(a) * rad, isl.y - depth * Math.pow(1 - rad / isl.r, 1.1) * 0.8 - len * 0.4, isl.z + Math.sin(a) * rad, Math.PI, 0, 0), PAL.rock, { scale: 0.3, stretch: [1, 0.2, 1] }));
    }
  }

  // --- bridges: thick paint strokes between the islands
  const bridges = [];
  function makeBridge(a, b, bend, painted, need) {
    const A0 = edgePoint(a, b.x, b.z, 7), A1 = edgePoint(a, b.x, b.z, 1.2);
    const B1 = edgePoint(b, a.x, a.z, 1.2), B0 = edgePoint(b, a.x, a.z, 7);
    const dir = new V3().subVectors(B1, A1), perp = new V3(-dir.z, 0, dir.x).normalize();
    const M1 = A1.clone().lerp(B1, 0.33).addScaledVector(perp, bend); M1.y += 1.3;
    const M2 = A1.clone().lerp(B1, 0.67).addScaledVector(perp, -bend); M2.y += 1.3;
    const curve = new THREE.CatmullRomCurve3([A0, A1, M1, M2, B1, B0]);
    const N = 76, pts = curve.getSpacedPoints(N);
    const geo = strokeGeo(pts, { width: 5.4, lanes: 7, drips: 1, run: 13 });
    const mesh = new THREE.Mesh(geo, terrainMat);
    mesh.frustumCulled = false;
    scene.add(mesh);

    // un-painted sketch of the bridge
    const ghost = new THREE.Group();
    const fill = new THREE.Mesh(strokeGeo(pts, { width: 5.4, lanes: 2, palette: ['#ffffff'], bump: 0 }),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const dpos = [];
    const side = new V3(), tan = new V3();
    for (let i = 0; i < N; i++) {
      if (i % 4 > 1) continue;
      tan.subVectors(pts[i + 1], pts[i]).normalize(); side.set(-tan.z, 0, tan.x).normalize();
      for (const s of [-1, 1]) {
        const a0 = pts[i].clone().addScaledVector(side, s * 2.7), a1 = pts[i].clone().addScaledVector(side, s * 2.3);
        const b0 = pts[i + 1].clone().addScaledVector(side, s * 2.7), b1 = pts[i + 1].clone().addScaledVector(side, s * 2.3);
        dpos.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z, a0.x, a0.y, a0.z, b1.x, b1.y, b1.z, a1.x, a1.y, a1.z);
      }
    }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
    const dashes = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, fog: false }));
    ghost.add(fill, dashes);
    scene.add(ghost);

    // posts + hanging drip columns that appear once the stroke is laid
    const db = new Bag();
    for (let i = 6; i < N - 4; i += 7) {
      tan.subVectors(pts[i + 1], pts[i]).normalize(); side.set(-tan.z, 0, tan.x).normalize();
      const ry = Math.atan2(tan.x, tan.z);
      for (const s of [-1, 1]) {
        const p = pts[i].clone().addScaledVector(side, s * 2.45);
        db.add(daub(place(new THREE.BoxGeometry(0.2, 1.7, 0.2), p.x, p.y + 0.8, p.z, 0, ry, 0), PAL.stone));
        db.add(daub(place(new THREE.BoxGeometry(0.62, 0.14, 0.14), p.x, p.y + 1.3, p.z, 0, ry, 0), PAL.gold));
      }
    }
    for (let i = 14; i < N - 10; i += 12) {
      const len = rr(9, 17), p = pts[i];
      db.add(daub(place(new THREE.CylinderGeometry(1.5, 0.12, len, 6, 4), p.x, p.y - len / 2 - 0.2, p.z, 0, rand() * 3, 0), PAL.drip, { scale: 0.5, stretch: [1, 0.15, 1] }));
    }
    const decor = db.mesh(terrainMat);
    scene.add(decor);

    const br = {
      pts, N, hw: 2.75, progress: painted ? 1 : 0, need, mesh, ghost, decor, from: a.index, to: b.index,
      anchor: pts[4].clone(), vps: geo.userData.vertsPerSeg,
      min: new V3(Infinity, 0, Infinity), max: new V3(-Infinity, 0, -Infinity),
      set(p) {
        this.progress = clamp(p, 0, 1);
        this.mesh.geometry.setDrawRange(0, Math.floor(this.progress * this.N) * this.vps);
        this.mesh.visible = this.progress > 0;
        this.ghost.visible = this.progress < 1;
        this.decor.visible = this.progress >= 1;
      },
      head() { return this.pts[Math.min(this.N, Math.floor(this.progress * this.N))]; },
    };
    for (const p of pts) { br.min.x = Math.min(br.min.x, p.x - 3); br.max.x = Math.max(br.max.x, p.x + 3); br.min.z = Math.min(br.min.z, p.z - 3); br.max.z = Math.max(br.max.z, p.z + 3); }
    br.set(br.progress);
    bridges.push(br);
    return br;
  }
  makeBridge(islands[0], islands[1], 7, false, 0);
  makeBridge(islands[1], islands[2], -8, true, 0);
  makeBridge(islands[2], islands[3], 8, true, 0);
  makeBridge(islands[3], islands[4], -6, false, 3);

  // --- the painted path continues across each island
  const spawn = new V3(0, 0, 15);
  const gate = new V3(CASTLE.x, CASTLE.y, CASTLE.z + 22.5);
  function islandPath(isl, from, to, sway) {
    const d = new V3().subVectors(to, from), perp = new V3(-d.z, 0, d.x).normalize();
    const mid = from.clone().lerp(to, 0.5).addScaledVector(perp, sway);
    const curve = new THREE.CatmullRomCurve3([from, mid, to]);
    const pts = curve.getSpacedPoints(Math.max(8, Math.ceil(d.length() / 1.3)));
    pts.forEach((p) => { p.y = surfY(isl, p.x, p.z) + 0.1; });
    pathPolys.push(pts);
  }
  islandPath(islands[0], new V3(spawn.x, 0, spawn.z + 4), bridges[0].pts[3], -3);
  islandPath(islands[1], bridges[0].pts[bridges[0].N - 3], bridges[1].pts[3], 3);
  islandPath(islands[2], bridges[1].pts[bridges[1].N - 3], bridges[2].pts[3], -4);
  islandPath(islands[3], bridges[2].pts[bridges[2].N - 3], bridges[3].pts[3], 3);
  islandPath(islands[4], bridges[3].pts[bridges[3].N - 3], new V3(gate.x, 0, gate.z - 2), 2);
  const nearPath = (x, z, d) => {
    for (const poly of pathPolys) for (let i = 0; i < poly.length; i += 2) {
      const p = poly[i]; if ((p.x - x) ** 2 + (p.z - z) ** 2 < d * d) return true;
    }
    return false;
  };

  // --- trees (each one is remembered, canopy and all, so it can blossom later)
  const trees = [];
  function addTree(x, y, z, s = 1, pal = PAL.maple, collide = true, detail = 2) {
    const lx = rr(-0.5, 0.5), lz = rr(-0.5, 0.5), h = rr(5, 7.5) * s;
    const top = new V3(x + lx * 2.6 * s, y + h, z + lz * 2.6 * s);
    const curve = new THREE.CatmullRomCurve3([
      new V3(x, y - 0.4, z), new V3(x + lx * 0.5 * s, y + h * 0.35, z + lz * 0.5 * s),
      new V3(x + lx * 1.7 * s, y + h * 0.72, z + lz * 1.7 * s), top,
    ]);
    bag.add(daub(new THREE.TubeGeometry(curve, 7, 0.36 * s, 6), PAL.trunk, { scale: 0.7 }));
    bag.add(daub(place(new THREE.ConeGeometry(0.95 * s, 1.7 * s, 6), x, y + 0.45 * s, z), PAL.trunk, { scale: 0.7 }));
    const n = 6 + Math.floor(rand() * 4), puffs = [];
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU, rad = rr(0.3, 3.6) * s;
      const q = new V3(top.x + Math.cos(a) * rad, top.y + rr(-1.0, 1.7) * s - rad * 0.28, top.z + Math.sin(a) * rad);
      const p = curve.getPoint(rr(0.55, 0.95));
      bag.add(daub(new THREE.TubeGeometry(new THREE.LineCurve3(p, q), 1, 0.13 * s, 4), PAL.trunk));
      const R = rr(1.5, 2.7) * s;
      const ry = rand() * 3, sy = rr(0.5, 0.68);
      puffs.push({ x: q.x, y: q.y + R * 0.2, z: q.z, R, sy });
      bag.add(daub(place(new THREE.IcosahedronGeometry(R, detail), q.x, q.y + R * 0.2, q.z, 0, ry, 0, 1, sy, 1), pal, { scale: 0.3, spread: 0.3, jitter: 0.05 }));
    }
    if (collide) { colliders.push({ x, z, r: 0.75 * s }); trees.push({ x, y, z, s, top, puffs }); }
  }
  function scatterTrees(isl, count, sMin, sMax, pal = PAL.maple, pathGap = 9) {
    let placed = 0, tries = 0;
    while (placed < count && tries++ < 200) {
      const a = rand() * TAU, rad = Math.sqrt(rand()) * isl.r * 0.8;
      const x = isl.x + Math.cos(a) * rad, z = isl.z + Math.sin(a) * rad;
      if (nearPath(x, z, pathGap)) continue;
      if (isl.index === 4 && (x - CASTLE.x) ** 2 + (z - CASTLE.z) ** 2 < 26 * 26) continue;
      if (colliders.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < 36)) continue;
      addTree(x, surfY(isl, x, z), z, rr(sMin, sMax), pal);
      placed++;
    }
  }
  addTree(-10.5, surfY(islands[0], -10.5, 7), 7, 1.6);           // the big maple by the lantern
  scatterTrees(islands[0], 7, 0.9, 1.35);
  scatterTrees(islands[1], 3, 0.85, 1.1);
  scatterTrees(islands[2], 5, 0.9, 1.25);
  scatterTrees(islands[3], 3, 0.85, 1.1);
  scatterTrees(islands[4], 10, 0.9, 1.3);

  // --- little paint-dab shrubs
  for (const isl of islands) {
    for (let i = 0; i < isl.r * 1.6; i++) {
      const a = rand() * TAU, rad = Math.sqrt(rand()) * isl.r * 0.9;
      const x = isl.x + Math.cos(a) * rad, z = isl.z + Math.sin(a) * rad;
      if (nearPath(x, z, 3.4)) continue;
      const R = rr(0.3, 0.8);
      bag.add(daub(place(new THREE.IcosahedronGeometry(R, 1), x, surfY(isl, x, z) + R * 0.3, z, rand(), rand(), 0, 1, 0.7, 1), rand() < 0.5 ? PAL.maple : PAL.blossom, { spread: 1 }));
    }
  }

  // --- banners along the path
  const bannerGeo = new THREE.PlaneGeometry(1.5, 2.7, 3, 8); bannerGeo.translate(0, -1.35, 0);
  function addBanner(x, y, z, ry) {
    bag.add(daub(place(new THREE.CylinderGeometry(0.08, 0.11, 5.2, 5), x, y + 2.6, z), PAL.trunk));
    bag.add(daub(place(new THREE.BoxGeometry(1.9, 0.12, 0.12), x, y + 5.0, z, 0, ry, 0), PAL.gold));
    bag.add(daub(place(new THREE.IcosahedronGeometry(0.2, 0), x, y + 5.35, z), PAL.gold));
    const m = new THREE.Mesh(bannerGeo, bMat);
    m.position.set(x, y + 4.95, z); m.rotation.y = ry;
    scene.add(m);
  }
  for (const br of bridges) {
    for (const i of [5, br.N - 5]) {
      const p = br.pts[i], t = new V3().subVectors(br.pts[i + 1], br.pts[i - 1]).normalize();
      const s = new V3(-t.z, 0, t.x), ry = Math.atan2(t.x, t.z);
      const isl = islands[i < 10 ? br.from : br.to];
      for (const k of [-1, 1]) {
        const x = p.x + s.x * 4.1 * k, z = p.z + s.z * 4.1 * k;
        addBanner(x, surfY(isl, x, z), z, ry);
      }
    }
  }

  // --- lantern on the first island
  const lantern = new THREE.Group();
  {
    const lx = -4.6, lz = 10.5, ly = surfY(islands[0], lx, lz);
    const pts = [new V3(lx - 1.6, ly - 0.2, lz), new V3(lx - 1.8, ly + 3, lz), new V3(lx - 1.2, ly + 5.6, lz), new V3(lx, ly + 6.3, lz), new V3(lx + 0.9, ly + 5.6, lz), new V3(lx + 0.5, ly + 4.9, lz), new V3(lx, ly + 5.2, lz)];
    bag.add(daub(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.15, 5), PAL.trunk, { scale: 0.8 }));
    lantern.position.set(lx + 0.2, ly + 3.9, lz);
    lantern.add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c4, fog: false })));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 5, 20), new THREE.MeshBasicMaterial({ color: 0xffc860, fog: false }));
    lantern.add(ring); lantern.userData.ring = ring;
    lantern.add(glowSprite(glowTex, 7.5, 0xffd890, 0.9));
    const pl = new THREE.PointLight(0xffc878, 40, 26, 1.8); lantern.add(pl);
    scene.add(lantern);
    colliders.push({ x: lx - 1.6, z: lz, r: 0.4 });
  }

  // --- arcades
  function arcade(target, x0, z0, x1, z1, y, n, h, pal = PAL.stone) {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx), span = len / n;
    for (let i = 0; i <= n; i++) {
      const x = x0 + (dx * i) / n, z = z0 + (dz * i) / n;
      target.add(daub(place(new THREE.BoxGeometry(0.9, h + 1.5, 0.9), x, y + h / 2 - 0.75, z, 0, ry, 0), pal, { scale: 0.4 }));
      if (i < n) {
        const mx = x + dx / n / 2, mz = z + dz / n / 2;
        target.add(daub(place(new THREE.TorusGeometry(span / 2 - 0.2, 0.3, 5, 10, Math.PI), mx, y + h - span / 2 + 0.2, mz, 0, ry, 0), pal, { scale: 0.4 }));
      }
    }
    target.add(daub(place(new THREE.BoxGeometry(len + 1.2, 0.7, 1.1), x0 + dx / 2, y + h + 0.5, z0 + dz / 2, 0, ry, 0), pal, { scale: 0.4 }));
  }

  // --- the Spire
  {
    const { x: cx, y: cy, z: cz } = CASTLE;
    const add = (g, pal, o) => castleBag.add(daub(g, pal, o));
    const tower = (x, z, r, h, base, needle = true) => {
      add(place(new THREE.CylinderGeometry(r * 0.8, r, h, 7, 4), x, base + h / 2, z, 0, rand() * 3, 0), PAL.castle, { scale: 0.3, stretch: [1, 0.3, 1], spread: 0.6 });
      const rh = r * rr(2.8, 4.0);
      add(place(new THREE.ConeGeometry(r * 1.12, rh, 7, 2), x, base + h + rh / 2, z, 0, rand() * 3, 0), PAL.roof, { scale: 0.4, spread: 0.6 });
      if (needle) add(place(new THREE.CylinderGeometry(0.04, 0.1, rh * 0.8, 4), x, base + h + rh + rh * 0.35, z), PAL.gold);
      return base + h + rh;
    };
    add(place(new THREE.CylinderGeometry(17.2, 19, 2.6, 26, 1), cx, cy + 1.1, cz), PAL.stone, { scale: 0.3 });
    add(place(new THREE.CylinderGeometry(12.6, 14, 3.2, 22, 1), cx, cy + 4.0, cz), PAL.castle, { scale: 0.3 });
    add(place(new THREE.CylinderGeometry(8.2, 9.2, 3.2, 18, 1), cx, cy + 7.2, cz), PAL.castle, { scale: 0.3 });
    const topY = tower(cx, cz, 3.3, 36, cy + 8.6);
    add(place(new THREE.CylinderGeometry(0.12, 0.5, 14, 5), cx, topY + 6, cz), PAL.gold);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; tower(cx + Math.cos(a) * 6.3, cz + Math.sin(a) * 6.3, 1.5, rr(18, 26), cy + 8.6); }
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.1; tower(cx + Math.cos(a) * 10.6, cz + Math.sin(a) * 10.6, 1.3, rr(11, 17), cy + 5.4); }
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * TAU + 0.2;
      if (Math.abs(a - Math.PI / 2) < 0.42) continue;       // leave room for the gate (south side)
      tower(cx + Math.cos(a) * 15.4, cz + Math.sin(a) * 15.4, 1.1, rr(6, 11), cy + 2.2);
    }
    // gatehouse + glowing door
    add(place(new THREE.BoxGeometry(9.5, 12, 4), cx, cy + 6, cz + 17.6), PAL.castle, { scale: 0.3 });
    add(place(new THREE.ConeGeometry(6.6, 6, 4, 1), cx, cy + 15, cz + 17.6, 0, Math.PI / 4, 0), PAL.roof, { scale: 0.4 });
    tower(cx - 5.6, cz + 18.4, 1.7, 14, cy);
    tower(cx + 5.6, cz + 18.4, 1.7, 14, cy);
    add(place(new THREE.TorusGeometry(2.75, 0.42, 6, 14, Math.PI), cx, cy + 5.2, cz + 19.75), PAL.gold);
    add(place(new THREE.BoxGeometry(0.8, 5.4, 0.8), cx - 2.75, cy + 2.6, cz + 19.75), PAL.gold);
    add(place(new THREE.BoxGeometry(0.8, 5.4, 0.8), cx + 2.75, cy + 2.6, cz + 19.75), PAL.gold);
    colliders.push({ x: cx, z: cz, r: 19.6, top: cy + 34 }, { x: cx, z: cz, r: 3.7 }, { x: cx - 5.6, z: cz + 18.4, r: 2.6 }, { x: cx + 5.6, z: cz + 18.4, r: 2.6 });
    arcade(castleBag, cx - 37, cz + 6, cx - 20, cz + 8, cy, 5, 7);
    arcade(castleBag, cx + 20, cz + 8, cx + 37, cz + 6, cy, 5, 7);
    for (let i = 0; i <= 5; i++) {
      colliders.push({ x: cx - 37 + (17 * i) / 5, z: cz + 6 + (2 * i) / 5, r: 0.8 }, { x: cx + 20 + (17 * i) / 5, z: cz + 8 - (2 * i) / 5, r: 0.8 });
    }
  }
  const door = new THREE.Group();
  {
    const sh = new THREE.Shape();
    sh.moveTo(-2.35, 0); sh.lineTo(-2.35, 5.2); sh.absarc(0, 5.2, 2.35, Math.PI, 0, true); sh.lineTo(2.35, 0); sh.closePath();
    const doorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff3c2).multiplyScalar(1.7), fog: false });
    door.add(new THREE.Mesh(new THREE.ShapeGeometry(sh, 12), doorMat));
    const halo = glowSprite(glowTex, 20, 0xffd890, 0.95); halo.position.set(0, 4, 0.6);
    door.add(halo); door.userData.halo = halo;
    door.position.set(CASTLE.x, CASTLE.y + 0.1, CASTLE.z + 19.72);
    scene.add(door);
  }
  // light pouring out from behind the spire
  const aura = glowSprite(glowTex, 170, 0xffdfa0, 0.5); aura.position.set(CASTLE.x, CASTLE.y + 42, CASTLE.z - 40); scene.add(aura);
  const aura2 = glowSprite(glowTex, 70, 0xffffff, 0.45); aura2.position.set(CASTLE.x, CASTLE.y + 30, CASTLE.z - 20); scene.add(aura2);

  // --- waterfalls of liquid colour
  const falls = [
    waterfallMesh(islands[2], 0.3, 1.3, 34, uTime), waterfallMesh(islands[3], 2.6, 3.5, 30, uTime),
    waterfallMesh(islands[4], 0.9, 1.5, 46, uTime), waterfallMesh(islands[4], 2.2, 2.7, 46, uTime), waterfallMesh(islands[1], 5.3, 6.0, 26, uTime),
  ];
  falls.forEach((f) => scene.add(f));

  // --- unreachable islets drifting around the route
  const islets = [
    { x: 78, y: 14, z: -70, r: 11 }, { x: 96, y: 26, z: -172, r: 12 }, { x: -92, y: 22, z: -62, r: 12 }, { x: -108, y: 38, z: -235, r: 14 },
    { x: 118, y: 40, z: -292, r: 15 }, { x: 60, y: -6, z: -8, r: 8 }, { x: -64, y: 6, z: 28, r: 8 }, { x: 150, y: 10, z: -110, r: 10 },
    { x: -160, y: 30, z: -140, r: 13 }, { x: 70, y: 52, z: -380, r: 12 }, { x: -78, y: 50, z: -372, r: 13 },
  ].map((d, i) => ({ ...d, ph: i * 1.37 + 0.6, index: 100 + i }));
  for (const il of islets) {
    bag.add(islandUnderGeo(il, 6, 22));
    const n = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU, rad = rand() * il.r * 0.6, x = il.x + Math.cos(a) * rad, z = il.z + Math.sin(a) * rad;
      const s = rr(1.0, 1.5);
      addTree(x, surfY(il, x, z), z, s, il.index % 2 ? PAL.blossom : PAL.maple, false, 1);
      (il.trees || (il.trees = [])).push({ x, z, s });
    }
    if (il.index % 3 === 0) {
      const a = rand() * TAU;
      arcade(bag, il.x - Math.cos(a) * il.r * 0.7, il.z - Math.sin(a) * il.r * 0.7, il.x + Math.cos(a) * il.r * 0.7, il.z + Math.sin(a) * il.r * 0.7, il.y, 4, 5);
    }
    if (il.index % 4 === 1) { const f = waterfallMesh(il, 1.0, 2.2, 30, uTime); scene.add(f); }
  }

  // --- giant strokes hanging in the sky
  const taper = (W) => (t) => W * (0.12 + 0.88 * Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.55));
  const Z = new V3(0, 0, 1), X = new V3(1, 0, 0);
  function spiral(cx, cy, cz, r0, r1, a0, a1, n, squash = 0.85, zw = 12) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), a = a0 + (a1 - a0) * t, r = r0 + (r1 - r0) * t;
      pts.push(new V3(cx + Math.cos(a) * r, cy + Math.sin(a) * r * squash, cz + Math.sin(t * 5) * zw));
    }
    return pts;
  }
  farBag.add(strokeGeo(spiral(-6, 128, -395, 120, 20, -0.25 * Math.PI, 2.35 * Math.PI, 130), { widthFn: taper(26), lanes: 8, palette: PAL.swirlWarm, normal: Z, bump: 0.5, run: 9 }));
  farBag.add(strokeGeo(spiral(120, 150, -430, 150, 60, 0.55 * Math.PI, 1.5 * Math.PI, 90), { widthFn: taper(30), lanes: 8, palette: PAL.swirlWarm, normal: Z, bump: 0.5, run: 10 }));
  farBag.add(strokeGeo(spiral(-70, 210, -470, 190, 120, 0.2 * Math.PI, 0.85 * Math.PI, 80), { widthFn: taper(34), lanes: 8, palette: ['#e86ac0', '#b060d8', '#f7a8c8', '#7a58d0', '#ffd0e0', '#f4a060'], normal: Z, bump: 0.5, run: 10 }));
  // the looping stroke around the eastern islet
  {
    const pts = [];
    for (let i = 0; i < 80; i++) { const a = 0.2 + (i / 79) * 1.85 * Math.PI; pts.push(new V3(96 + Math.cos(a) * 34 * 0.76, 30 + Math.sin(a) * 30, -172 + Math.cos(a) * 34 * 0.65)); }
    farBag.add(strokeGeo(pts, { widthFn: taper(9), lanes: 6, palette: ['#fff7ea', '#f6e6d0', '#ffe9b8', '#e8d8f4', '#ffffff', '#f7c8d8'], normal: new V3(-0.65, 0, 0.76), bump: 0.3, run: 8 }));
  }
  // the brush that painted it all
  {
    const b = new Bag();
    b.add(daub(place(new THREE.CylinderGeometry(1.5, 2.3, 70, 8, 6), 0, 45, 0), ['#7a4a2a', '#a06a3a', '#5a3420', '#c08a50'], { scale: 0.08, stretch: [1, 0.15, 1] }));
    b.add(daub(place(new THREE.CylinderGeometry(2.6, 2.9, 9, 8, 1), 0, 6, 0), PAL.gold));
    b.add(daub(place(new THREE.ConeGeometry(3.3, 18, 8, 3), 0, -7, 0, Math.PI, 0, 0), ['#fff4dc', '#ffe2a0', '#f7a8c8', '#ffffff'], { scale: 0.2, stretch: [1, 0.2, 1] }));
    const brush = b.mesh(farMat);
    brush.position.set(150, 196, -425); brush.rotation.z = -0.82; brush.rotation.x = 0.15; brush.scale.setScalar(2.1);
    scene.add(brush);
  }

  // --- the sleeping muse
  const muse = new THREE.Group();
  {
    const pts = [[0.36, 0.1], [0.44, 0.155], [0.57, 0.16], [0.635, 0.215], [0.6, 0.3], [0.655, 0.34], [0.625, 0.372], [0.665, 0.4], [0.635, 0.445], [0.68, 0.455],
      [0.765, 0.5], [0.7, 0.58], [0.645, 0.665], [0.665, 0.72], [0.635, 0.83], [0.55, 0.93], [0.36, 1.0], [0.14, 0.95], [0.02, 0.78], [0.02, 0.58], [0.1, 0.36], [0.14, 0.18], [0.12, 0.0]];
    const sh = new THREE.Shape();
    sh.moveTo(0.34, 0);
    sh.splineThru(pts.map((p) => new THREE.Vector2(p[0], p[1])));
    sh.closePath();
    const depth = 0.42;
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.09, bevelSegments: 4, curveSegments: 40, steps: 1 });
    g.translate(-0.4, 0, -depth / 2);
    const mb = new Bag();
    const lip = new THREE.Color('#ee9ab4'), blush = new THREE.Color('#f8c4cc'), shade = new THREE.Color('#b9a8ea');
    mb.add(daub(g, PAL.skin, {
      fn: (x, y, z, out, cols) => {
        const px = x + 0.4;
        if ((px - 0.635) ** 2 + (y - 0.372) ** 2 < 0.0022) return out.copy(lip);
        const n = fbm(x * 9, y * 9, z * 9);
        out.copy(cols[Math.floor(n * 1.6 * cols.length) % cols.length]);
        if ((px - 0.5) ** 2 + (y - 0.5) ** 2 < 0.008) out.lerp(blush, 0.6);
        out.lerp(shade, clamp((0.42 - px) * 1.6, 0, 0.8) + clamp((0.3 - y) * 1.5, 0, 0.5));
        return out;
      }, jitter: 0.04,
    }));
    const dark = ['#6a4a9a', '#54387e'];
    for (const zz of [depth / 2 + 0.092, -depth / 2 - 0.092]) {
      mb.add(daub(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new V3(0.1, 0.676, zz), new V3(0.155, 0.632, zz), new V3(0.22, 0.682, zz)), 10, 0.009, 5), dark));
      mb.add(daub(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new V3(0.09, 0.74, zz), new V3(0.17, 0.775, zz), new V3(0.245, 0.728, zz)), 10, 0.008, 5), dark));
    }
    // wind-blown hair made of brush strokes
    for (let k = 0; k < 11; k++) {
      const u = k / 10;
      const p0 = new V3(0.6 - 0.52 * u, 0.83 + 0.16 * Math.sin(u * Math.PI * 0.9), 0);
      const p1 = p0.clone().add(new V3(-0.2, 0.13 + 0.06 * u, 0));
      const phi = (95 + 150 * u) * (Math.PI / 180), R = rr(0.95, 1.5);
      const end = new V3(0.2 + Math.cos(phi) * R, 0.72 + Math.sin(phi) * R, 0);
      const d = new V3().subVectors(end, p1), perp = new V3(-d.y, d.x, 0).normalize();
      const p2 = p1.clone().lerp(end, 0.5).addScaledVector(perp, rr(-0.22, 0.22));
      const curl = end.clone().addScaledVector(perp, 0.22 * (k % 2 ? 1 : -1)).addScaledVector(d.normalize(), 0.1);
      const zc = (u - 0.5) * 0.55 + rr(-0.08, 0.08);
      const hp = new THREE.CatmullRomCurve3([p0, p1, p2, end, curl]).getSpacedPoints(46).map((p) => new V3(p.x - 0.4, p.y, zc + Math.sin(p.x * 5 + k) * 0.05));
      mb.add(strokeGeo(hp, { widthFn: taper(rr(0.16, 0.26)), lanes: 5, palette: PAL.swirlCool, normal: Z, bump: 0.006, run: 6 }));
    }
    const m = mb.mesh(museMat);
    muse.add(m);
    muse.position.set(-215, -22, -505);
    muse.scale.setScalar(205);
    muse.rotation.order = 'YXZ';
    muse.rotation.set(0, Math.atan2(215, 360), 0.27);
    scene.add(muse);
  }

  // --- clouds
  let cloudMat;
  {
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const mat = (cloudMat = paintify(new THREE.MeshLambertMaterial({ emissive: 0x6a6088 }), { scale: 7, amp: 0.4 }));
    const COUNT = 1100;
    const inst = new THREE.InstancedMesh(geo, mat, COUNT);
    const d = new THREE.Object3D(), col = new THREE.Color();
    let n = 0;
    const cluster = (cx, cy, cz, S) => {
      const k = 5 + Math.floor(rand() * 5);
      for (let i = 0; i < k && n < COUNT; i++) {
        d.position.set(cx + rr(-1.5, 1.5) * S, cy + rr(-0.3, 0.35) * S, cz + rr(-1.1, 1.1) * S);
        d.scale.set(S * rr(0.6, 1.2), S * rr(0.34, 0.6), S * rr(0.6, 1.2));
        d.rotation.set(rand(), rand() * 6, rand()); d.updateMatrix();
        inst.setMatrixAt(n, d.matrix); inst.setColorAt(n, col.set(pick(PAL.cloud))); n++;
      }
    };
    for (let i = 0; i < 105; i++) cluster(rr(-380, 380), rr(-66, -40), rr(-700, 150), rr(11, 24));
    for (let i = 0; i < 38; i++) {
      const x = rr(-340, 340);
      cluster(Math.abs(x) < 46 ? x + Math.sign(x || 1) * 60 : x, rr(-18, 120), rr(-640, 80), rr(6, 15));
    }
    cluster(-215, -18, -500, 30); cluster(-190, -24, -470, 28); cluster(-240, -20, -520, 30);
    inst.count = n; inst.instanceMatrix.needsUpdate = true; inst.instanceColor.needsUpdate = true;
    inst.frustumCulled = false;
    scene.add(inst);
  }

  // --- the final stroke (hidden until the finale)
  let finale;
  {
    const { x: cx, y: cy, z: cz } = CASTLE, n = 220, pts = [], nr = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), a = t * TAU * 3.6 + 1.2, r = 30 - 25 * Math.pow(t, 0.8);
      pts.push(new V3(cx + Math.cos(a) * r, cy + 3 + t * 70, cz + Math.sin(a) * r));
      nr.push(new V3(Math.cos(a), 0.25, Math.sin(a)).normalize());
    }
    const g = strokeGeo(pts, { widthFn: (t) => 1.2 + 5.5 * Math.sin(Math.PI * Math.pow(t, 0.7)), lanes: 5, palette: ['#fff6d8', '#ffe08a', '#ffc94a', '#ffffff', '#ffd0e8'], normal: (i) => nr[i], bump: 0.1, run: 7 });
    finale = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
    finale.frustumCulled = false; finale.visible = false;
    finale.userData = { vps: g.userData.vertsPerSeg, segs: g.userData.segs, pts };
    scene.add(finale);
  }

  // --- drifting petals
  let petals;
  {
    const N = 420, seed = new Float32Array(N * 3), tint = new Float32Array(N * 3), c = new THREE.Color();
    const pal = [...PAL.maple, '#ffd76a', '#ffffff', '#f7a8c8', '#40e0d8'];
    for (let i = 0; i < N; i++) {
      seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random();
      c.set(pal[i % pal.length]); tint[i * 3] = c.r; tint[i * 3 + 1] = c.g; tint[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
    petals = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { time: uTime, camPos: { value: new V3() }, scale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute vec3 seed; attribute vec3 tint; uniform float time; uniform vec3 camPos; uniform float scale; varying vec3 vCol;
        void main() {
          vec3 box = vec3(80.0, 46.0, 80.0);
          vec3 p = seed * box + vec3(time * 2.4, -time * 1.0, time * 0.9);
          p += vec3(sin(time * 0.6 + seed.y * 40.0) * 2.0, sin(time * 0.8 + seed.x * 40.0) * 1.2, cos(time * 0.5 + seed.z * 40.0) * 2.0);
          p = mod(p - camPos + box * 0.5, box) - box * 0.5 + camPos;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.2 + seed.x * 0.22) * scale / max(0.5, -mv.z) * smoothstep(1.5, 8.0, -mv.z);
          vCol = tint;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float; varying vec3 vCol;
        void main() { vec2 q = gl_PointCoord - 0.5; if (abs(q.x + q.y) > 0.3 || abs(q.x - q.y) > 0.62) discard; gl_FragColor = vec4(vCol, 1.0); }`,
    }));
    petals.frustumCulled = false;
    scene.add(petals);
  }

  // island tops, each with its own painted canvas
  const bridgePolys = bridges.map((br) => br.pts);
  islands.forEach((isl, i) => {
    const tex = islandTexture(isl, [...pathPolys, ...bridgePolys], isl.r > 30 ? 2048 : 1024, 100 + i);
    const m = new THREE.Mesh(islandTopGeo(isl), paintify(new THREE.MeshLambertMaterial({ map: tex }), { scale: 1, amp: 0.45 }));
    scene.add(m);
    isl.tex = tex; isl.span = 2 * isl.r * TOP_SPAN;       // the painter's brush draws straight onto this canvas
  });
  const isletTex = islandTexture({ x: 0, y: 0, z: 0, r: 12, ph: 2.2 }, [], 512, 77);
  const isletMat = paintify(new THREE.MeshLambertMaterial({ map: isletTex }), { scale: 1, amp: 0.45 });
  for (const il of islets) scene.add(new THREE.Mesh(islandTopGeo(il, 8, 36), isletMat));

  const terrain = bag.mesh(terrainMat); scene.add(terrain);
  const castle = castleBag.mesh(glowMat); scene.add(castle);
  const far = farBag.mesh(farMat); scene.add(far);

  // ---------------------------------------------------------------- queries
  function groundHeight(x, z, maxY) {
    let best = -Infinity;
    for (const isl of islands) {
      const dx = x - isl.x, dz = z - isl.z, d2 = dx * dx + dz * dz, lim = isl.r * 1.2;
      if (d2 > lim * lim) continue;
      if (Math.sqrt(d2) <= rimR(isl, Math.atan2(dz, dx))) {
        const h = surfY(isl, x, z);
        if (h <= maxY && h > best) best = h;
      }
    }
    const land = best;           // the island underfoot here, if there is one
    for (const br of bridges) {
      if (br.progress <= 0 || x < br.min.x || x > br.max.x || z < br.min.z || z > br.max.z) continue;
      // the height of the stroke is its height at the nearest point along it. (Taking the highest segment within
      // reach instead makes a slope into a staircase: the painter jerks up or down each time a new segment comes in range.)
      const lim = Math.floor(br.progress * br.N);
      let near = br.hw * br.hw, h = -Infinity, along = 0;
      for (let i = 0; i < lim; i++) {
        const a = br.pts[i], b = br.pts[i + 1];
        const ex = b.x - a.x, ez = b.z - a.z;
        const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / (ex * ex + ez * ez), 0, 1);
        const px = a.x + ex * t - x, pz = a.z + ez * t - z, d2 = px * px + pz * pz;
        if (d2 < near) { near = d2; h = a.y + (b.y - a.y) * t; along = i + t; }
      }
      if (h > land && land > -Infinity && !br.raised) {
        // where the stroke lies on an island it is a soft ridge, not a kerb: its height eases down to the ground
        // at its sides and at its two ends, so stepping on or off it is a ramp rather than a jolt
        // (the sides only ease near the ends: by the island's rim the stroke is at its full height right across,
        // so nothing changes underfoot as the ground beneath it falls away)
        const s = Math.min(along, br.N - along), end = clamp(s / 3.5, 0, 1), side = 1 - clamp((Math.sqrt(near) / br.hw - 0.45) / 0.55, 0, 1);
        const soft = side * side * (3 - 2 * side), fade = 1 - clamp((s - 2.5) / 2.5, 0, 1);
        const w = end * end * (3 - 2 * end) * (1 + (soft - 1) * fade);
        h = land + (h - land) * w;
      }
      if (h <= maxY && h > best) best = h;
    }
    return best;
  }
  function islandAt(x, z) {
    for (const isl of islands) {
      const dx = x - isl.x, dz = z - isl.z;
      if (Math.hypot(dx, dz) <= rimR(isl, Math.atan2(dz, dx))) return isl;
    }
    return null;
  }

  // --- spots for things the game layer places
  const on = (i, ox, oz, lift = 0) => { const isl = islands[i], x = isl.x + ox, z = isl.z + oz; return new V3(x, surfY(isl, x, z) + lift, z); };
  const sparkSpots = [on(1, -8, -2), on(2, -9, 6), on(3, -7, -6)];
  const blotSpots = [
    { i: 2, p: on(2, -6, 2) }, { i: 2, p: on(2, -11, 9) }, { i: 2, p: on(2, -4, 10) },
    { i: 3, p: on(3, -4, -3) }, { i: 3, p: on(3, -8, -9) },
    { i: 4, p: on(4, -12, 31) }, { i: 4, p: on(4, 12, 30) }, { i: 4, p: on(4, -2, 34) },
  ];
  const dropSpots = [];
  for (const br of bridges) for (let k = 1; k <= 5; k++) { const p = br.pts[Math.floor((br.N * k) / 6)]; dropSpots.push(new V3(p.x, p.y + 1.1, p.z)); }
  for (const [i, ox, oz] of [[0, 6, 4], [0, -5, -6], [0, 3, -14], [1, 5, 5], [2, 8, -6], [2, -14, -4], [3, 6, 6], [4, -16, 26], [4, 16, 24], [4, 0, 33]]) dropSpots.push(on(i, ox, oz, 1.1));

  // --- wind: ribbons of moving air that pick the painter up and carry them along
  const winds = [];
  function makeWind(ctrl) {
    const curve = new THREE.CatmullRomCurve3(ctrl);
    const len = curve.getLength(), n = Math.ceil(len / 1.2);
    const pts = curve.getSpacedPoints(n);
    const pos = [], uv = [], strand = [], idx = [];
    const tan = new V3(), side = new V3(), up2 = new V3(), UPV = new V3(0, 1, 0);
    for (let k = 0; k < 4; k++) {
      const base = pos.length / 3;
      for (let i = 0; i <= n; i++) {
        tan.subVectors(pts[Math.min(n, i + 1)], pts[Math.max(0, i - 1)]).normalize();
        side.crossVectors(tan, UPV).normalize(); up2.crossVectors(side, tan);
        const a = k * 1.57 + i * 0.085, rad = 1.15 + 0.5 * Math.sin(i * 0.05 + k * 2);
        const c = pts[i].clone().addScaledVector(side, Math.cos(a) * rad).addScaledVector(up2, Math.sin(a) * rad);
        const w = side.clone().multiplyScalar(-Math.sin(a)).addScaledVector(up2, Math.cos(a)).multiplyScalar(0.34);
        pos.push(c.x + w.x, c.y + w.y, c.z + w.z, c.x - w.x, c.y - w.y, c.z - w.z);
        const d = (i / n) * len; uv.push(d, 0, d, 1); strand.push(k, k);
        if (i < n) { const p = base + i * 2; idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('strand', new THREE.Float32BufferAttribute(strand, 1));
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { time: uTime, len: { value: len } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */ `attribute float strand; varying vec2 vUv; varying float vS;
        void main() { vUv = uv; vS = strand; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `precision highp float; varying vec2 vUv; varying float vS; uniform float time; uniform float len;
        void main() {
          float f = fract(vUv.x * 0.05 - time * 0.6 + vS * 0.37);
          float dash = smoothstep(0.0, 0.3, f) * smoothstep(1.0, 0.5, f);
          float edge = smoothstep(0.0, 0.5, 1.0 - abs(vUv.y - 0.5) * 2.0);
          float ends = smoothstep(0.0, 5.0, vUv.x) * smoothstep(0.0, 7.0, len - vUv.x);
          vec3 col = mix(vec3(1.0, 0.72, 0.84), vec3(1.0, 0.97, 0.9), dash);
          gl_FragColor = vec4(col, (0.18 + 0.72 * dash) * edge * ends);
        }`,
    }));
    mesh.frustumCulled = false;
    scene.add(mesh);
    // the mouth of the current: a slow ring you can step into
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.1, 6, 30), new THREE.MeshBasicMaterial({ color: 0xfff4e0, fog: false }));
    ring.position.copy(pts[0]); ring.lookAt(pts[2]);
    const halo = glowSprite(glowTex, 7, 0xffe8f0, 0.6); halo.position.copy(pts[0]);
    scene.add(ring, halo);
    const wind = { pts, n, len, step: len / n, ring, halo, mesh };
    winds.push(wind);
    return wind;
  }
  const air = (i, ox, oz, lift) => { const isl = islands[i], x = isl.x + ox, z = isl.z + oz; return new V3(x, surfY(isl, x, z) + lift, z); };
  // a first taste on Lantern Rise: a small loop that sets you down by the bridge
  makeWind([air(0, 15, 4, 1.7), new V3(22, 7, -3), new V3(20, 13, -12), new V3(12, 11, -18), air(0, 6, -15, 4)]);
  // Maple Step -> Weeping Palette, swinging wide over the clouds
  makeWind([air(1, 9.5, -1, 1.7), new V3(38, 14, -97), new V3(31, 24, -123), new V3(4, 25, -139), air(2, 12, 3, 4.5)]);
  // Weeping Palette -> Last Easel
  makeWind([air(2, -13, -5, 1.7), new V3(-58, 21, -168), new V3(-46, 33, -197), new V3(-12, 35, -215), air(3, -10, -1, 4.5)]);
  // a spiral around the Spire itself, up to the rooftops
  {
    const c = [];
    for (let i = 0; i <= 34; i++) {
      const t = i / 34, a = 0.35 * Math.PI + t * 2.6 * Math.PI, r = 30 - 7 * t;
      c.push(new V3(CASTLE.x + Math.cos(a) * r, CASTLE.y + 1.8 + 40 * Math.pow(t, 0.85), CASTLE.z + Math.sin(a) * r));
    }
    makeWind(c);
  }

  return {
    winds, makeWind, falls, islands, islets, bridges, colliders, groundHeight, islandAt, spawn, gate, castlePos: CASTLE, towerTop: CASTLE.y + 44.6,
    sparkSpots, blotSpots, dropSpots, trees, nearPath, paintable: [terrain, castle], light: { hemi, sun, fog: scene.fog, sea: seaMat, clouds: cloudMat, far: farMat }, sky, door, aura, aura2, lantern, finale, petals, glowTex, pathPolys, muse,
    update(t, dt) {
      lantern.userData.ring.rotation.set(t * 0.9, t * 1.3, 0);
      for (const w of winds) w.ring.rotation.z = t * 0.8;
      const pulse = 1 + Math.sin(t * 2.1) * 0.06;
      door.userData.halo.scale.setScalar(20 * pulse * (1 + sky.material.uniforms.glow.value * 1.2));
      aura.material.opacity = 0.5 + Math.sin(t * 0.7) * 0.05 + sky.material.uniforms.glow.value * 0.3;
    },
  };
}
