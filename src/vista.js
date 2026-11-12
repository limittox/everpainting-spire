import * as THREE from 'three';
import { glowSprite } from './util.js';

// Resting vistas: an easel and a stool at four overlooks. Sit, and the camera drifts out to the view while
// the painter paints it: the canvas slowly fills with a picture of what really lies in front of it
// (a small render of the scene, including anything the player has repainted), and keeps it afterwards.

const V3 = THREE.Vector3, UP = new V3(0, 1, 0);

// island index, a first guess at the spot (nudged if something is in the way), and what the easel looks at.
// `cam` frames the resting shot: how far behind and above the painter it sits, how far it may tilt up toward
// the subject (so the painter stays in frame), and how much the lens narrows.
const SPOTS = [
  { i: 0, x: -11, z: -15, target: [-215, 95, -505], name: 'The sleeper in the sky' },
  { i: 2, x: -33.5, z: -158.5, target: [0, 62, -306], name: 'The Spire, from afar' },
  { i: 3, x: 23.7, z: -221.2, target: [150, 196, -425], name: 'The great brush', cam: { back: 11, up: 2.0, tilt: 0.38, fov: 0 } },
  { i: 4, x: -28.6, z: -282.8, target: [0, 0, 0], name: 'The way you came', cam: { back: 10, up: 5.6, eye: 4.6 } },
  // on the crow's nest at the top of the Spire (see interior.js): exactly here, on whatever ground is highest
  // (the easel's eye is set high, to see over the last stroke where it winds past the deck)
  { fixed: true, x: 0, z: -301, target: [6, 27, -120], name: 'Everything, from the top', cam: { back: 3, up: 3.0, tilt: 0.1, fov: 0, eye: 4.6 } },
];
const CAM = { back: 9.2, up: 2.7, tilt: 0.18, fov: 7, eye: 1.9 };
const PAINT_SECONDS = 11;
const W = 768, H = 512;                    // size of each painted view

// turns a picture from the game's linear light into ordinary image colours, for the gallery and for saving
const ENCODE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D map;
varying vec2 vUv;
void main() {
  vec3 c = pow(max(texture2D(map, vUv).rgb, 0.0), vec3(1.0 / 2.2));
  c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, 1.2);
  c = (c - 0.5) * 1.06 + 0.5;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const CANVAS_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// The picture arrives the way a painting does: in ragged patches that spread until the canvas is covered.
const CANVAS_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D map;
uniform float progress;
uniform float sat;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec3 blank = vec3(0.92, 0.84, 0.7) * (0.94 + 0.06 * vnoise(vUv * vec2(60.0, 40.0)));
  float n = vnoise(vUv * vec2(9.0, 6.0)) * 0.45 + vUv.x * 0.35 + (1.0 - vUv.y) * 0.2;
  float m = smoothstep(n - 0.05, n + 0.05, progress * 1.14 - 0.06);
  vec3 c = texture2D(map, vUv).rgb;
  c = mix(vec3(dot(c, vec3(0.3, 0.6, 0.1))), c, sat);
  gl_FragColor = vec4(mix(blank, c, m), 1.0);
}
`;

/** The material of a canvas that paints itself in: `map` is the picture, `progress` how much of it is on the canvas. */
export function canvasMaterial() {
  return new THREE.ShaderMaterial({ uniforms: { map: { value: null }, progress: { value: 0 }, sat: { value: 1.2 } }, vertexShader: CANVAS_VERT, fragmentShader: CANVAS_FRAG });
}
export const VIEW_W = W, VIEW_H = H;

function stick(a, b, r, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 5), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  return m;
}

export class Vistas {
  constructor(scene, world, renderer, avoid = [], post = null) {
    this.scene = scene; this.world = world; this.renderer = renderer; this.post = post;
    this.raw = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });           // the view as rendered, before the knife
    this.rt8 = new THREE.WebGLRenderTarget(W, H);                                          // 8-bit copy, for reading back
    this.enc = new THREE.ShaderMaterial({ uniforms: { map: { value: null } }, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: ENCODE_FRAG, depthTest: false, depthWrite: false });
    this.encScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.enc); quad.frustumCulled = false; this.encScene.add(quad);
    this.encCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.cam = new THREE.PerspectiveCamera(58, 1.5, 0.5, 2600);
    this.wood = new THREE.MeshLambertMaterial({ color: 0x6a4038 });
    this.dark = new THREE.MeshLambertMaterial({ color: 0x4a2c3c });
    this.cream = new THREE.MeshLambertMaterial({ color: 0xf3e2c4 });
    this.spots = [];
    for (const def of SPOTS) { const v = this.build(def, avoid); if (v) this.spots.push(v); }
  }

  /** Find clear ground for the stool and the easel near the suggested spot. */
  settle(def, isl, target, avoid) {
    const w = this.world;
    const inside = (x, z) => w.islandAt(x, z) === isl && w.islandAt(x + (x - isl.x) * 0.1, z + (z - isl.z) * 0.1) === isl;
    const clear = (x, z, gap) => !w.colliders.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + gap) ** 2);
    for (const ring of [0, 1.5, 3, 4.5, 6, 8, 10]) for (let k = 0; k < (ring ? 12 : 1); k++) {
      const a = (k / 12) * Math.PI * 2, x = def.x + Math.cos(a) * ring, z = def.z + Math.sin(a) * ring;
      const d = new V3(target.x - x, 0, target.z - z).normalize(), right = new V3(-d.z, 0, d.x);
      const ex = x + d.x * 1.35 + right.x * 0.8, ez = z + d.z * 1.35 + right.z * 0.8;
      if (!inside(x, z) || !inside(ex, ez) || !clear(x, z, 2.4) || !clear(ex, ez, 1.6)) continue;
      if (w.nearPath(x, z, 3.4) || w.nearPath(ex, ez, 2.6)) continue;
      if (avoid.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 49)) continue;
      return { x, z, d, right, ex, ez };
    }
    return null;
  }

  build(def, avoid) {
    const w = this.world, target = new V3(...def.target);
    let at;
    if (def.fixed) {
      const d = new V3(target.x - def.x, 0, target.z - def.z).normalize(), right = new V3(-d.z, 0, d.x);
      at = { x: def.x, z: def.z, d, right, ex: def.x + d.x * 1.35 + right.x * 0.8, ez: def.z + d.z * 1.35 + right.z * 0.8 };
    } else at = this.settle(def, w.islands[def.i], target, avoid);
    if (!at) return null;
    const { d, right } = at;
    const pos = new V3(at.x, w.groundHeight(at.x, at.z, 1e9), at.z);
    const easelPos = new V3(at.ex, w.groundHeight(at.ex, at.ez, 1e9), at.ez);

    // --- the stool
    const stool = new THREE.Group(); stool.position.copy(pos);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.09, 10), this.wood); seat.position.y = 0.46; stool.add(seat);
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.5; stool.add(stick(new V3(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3), new V3(Math.cos(a) * 0.14, 0.44, Math.sin(a) * 0.14), 0.035, this.dark)); }
    this.scene.add(stool);

    // --- the easel: its +z faces the painter
    const easel = new THREE.Group(); easel.position.copy(easelPos); easel.rotation.y = Math.atan2(-d.x, -d.z);
    easel.add(stick(new V3(-0.62, 0, 0.16), new V3(-0.22, 2.15, -0.06), 0.045, this.dark), stick(new V3(0.62, 0, 0.16), new V3(0.22, 2.15, -0.06), 0.045, this.dark));
    easel.add(stick(new V3(0, 0, -0.85), new V3(0, 2.05, -0.08), 0.045, this.dark));
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.07, 0.16), this.wood); shelf.position.set(0, 0.8, 0.12); easel.add(shelf);
    const board = new THREE.Group(); board.position.set(0, 1.36, 0.09); board.rotation.x = -0.12; easel.add(board);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.58, 1.08, 0.05), this.cream); back.position.z = -0.03; board.add(back);
    const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: null }, progress: { value: 0 }, sat: { value: 1.2 } }, vertexShader: CANVAS_VERT, fragmentShader: CANVAS_FRAG });
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), mat); board.add(canvas);
    const glow = glowSprite(w.glowTex, 3.2, 0xffe2a8, 0.32); glow.position.set(0, 2.5, 0); easel.add(glow);
    this.scene.add(easel);
    w.colliders.push({ x: easelPos.x, z: easelPos.z, r: 0.55 });

    // --- where the camera rests, and what it looks at
    const cam = { ...CAM, ...def.cam };
    const d3 = target.clone().sub(pos).normalize(); d3.y = Math.max(-0.15, Math.min(cam.tilt, d3.y)); d3.normalize();
    // the camera sits behind and to one side of the painter; if a tree's canopy is in the way, try the other
    // side, then lower heights, so the resting shot is never taken from inside the leaves
    const leafy = (p) => w.trees.some((tr) => tr.puffs.some((f) => (f.x - p.x) ** 2 + (f.z - p.z) ** 2 < (f.R + 2.6) ** 2 && Math.abs(f.y - p.y) < f.R * f.sy + 1.8)
      || ((tr.x - p.x) ** 2 + (tr.z - p.z) ** 2 < 9 && p.y < tr.top.y));
    const camPos = new V3();
    let found = false;
    for (const up of [cam.up, cam.up * 0.7, 2.2]) {
      for (const side of [1, -1]) {
        camPos.copy(pos).addScaledVector(d, -cam.back).addScaledVector(right, 3.2 * side); camPos.y += up;
        const gh = w.groundHeight(camPos.x, camPos.z, 1e9);
        if (gh > -Infinity) camPos.y = Math.max(camPos.y, gh + 1.6);
        if (!leafy(camPos)) { found = true; break; }
      }
      if (found) break;
    }
    const camLook = pos.clone().addScaledVector(d3, 24); camLook.y += 0.3;
    const eye = easelPos.clone().addScaledVector(d, 0.9); eye.y += cam.eye;
    if (leafy(eye)) eye.y = easelPos.y + 1.9;         // the easel's own view, just past it

    return {
      name: def.name, fixed: !!def.fixed, pos, easelPos, dir: d, right, heading: Math.atan2(d.x, d.z), target, eye, camPos, camLook,
      easel, glow, mat, canvasAt: easelPos.clone().setY(easelPos.y + 1.4),
      fovDrop: cam.fov,
      rt: new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false }), picture: null,
      progress: 0, done: false,
    };
  }

  /** The vista whose stool the painter is standing at, if any. */
  near(p) {
    for (const v of this.spots) if ((v.pos.x - p.x) ** 2 + (v.pos.z - p.z) ** 2 < 10.5 && Math.abs(v.pos.y - p.y) < 2) return v;
    return null;
  }

  /** Take in the view from the easel: this is the picture the painter will paint. */
  snapshot(v) {
    const r = this.renderer, prev = r.getRenderTarget(), cam = this.cam;
    cam.position.copy(v.eye); cam.lookAt(v.target); cam.updateMatrixWorld();
    v.easel.visible = false;
    // render the view, then lay it down with the same palette knife as the rest of the world
    r.setRenderTarget(this.post ? this.raw : v.rt); r.render(this.scene, cam); r.setRenderTarget(prev);
    if (this.post) this.post.filter(this.raw.texture, v.rt, W, H);
    v.picture = null;
    v.easel.visible = true;
    v.mat.uniforms.map.value = v.rt.texture; v.mat.uniforms.sat.value = 1.2;
    if (v.done) v.progress = 0.5;            // already finished once: this sitting repaints it, faster
  }

  /** The finished painting as an ordinary canvas image (for the gallery, and for saving as a file). */
  picture(v) {
    if (v.picture) return v.picture;
    const r = this.renderer, prev = r.getRenderTarget();
    this.enc.uniforms.map.value = v.rt.texture;
    r.setRenderTarget(this.rt8); r.render(this.encScene, this.encCam); r.setRenderTarget(prev);
    const px = new Uint8Array(W * H * 4);
    r.readRenderTargetPixels(this.rt8, 0, 0, W, H, px);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);      // the GPU's rows run bottom-up
    ctx.putImageData(img, 0, 0);
    return (v.picture = cv);
  }

  /**
   * Put a painting kept from an earlier visit back on its easel. The spot counts as painted straight away;
   * `lost` is called if the picture turns out to be unreadable, and the easel goes back to waiting.
   */
  restore(v, url, lost) {
    v.done = true; v.progress = 1;
    const img = new Image();
    img.onload = () => {
      if (v.progress < 1) return;                        // already being repainted
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      cv.getContext('2d').drawImage(img, 0, 0, W, H);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      v.picture = cv;
      v.mat.uniforms.map.value = tex; v.mat.uniforms.sat.value = 1.0; v.mat.uniforms.progress.value = 1;
    };
    img.onerror = () => { if (v.picture) return; v.done = false; v.progress = 0; if (lost) lost(v); };
    img.src = url;
  }

  /** Paint a little more of the view. Returns true on the frame the picture is finished. */
  paint(v, dt) {
    if (v.progress >= 1) return false;
    v.progress = Math.min(1, v.progress + dt / PAINT_SECONDS);
    v.mat.uniforms.progress.value = v.progress;
    if (v.progress < 1) return false;
    const first = !v.done; v.done = true;
    return first;
  }

  update(t) {
    for (const v of this.spots) v.glow.material.opacity = (v.done ? 0.16 : 0.3) + Math.sin(t * 1.3 + v.pos.x) * 0.06;
  }
}
