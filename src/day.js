import * as THREE from 'three';

// The day moves with the journey: morning on Lantern Rise, noon over Maple Step, a long golden hour at
// Last Easel, dusk at the Spire, and night once the last stroke is laid. Each key below is a whole mood:
// the sky's bands and cloud colours, the light, the haze, and a tint for everything too far away to be lit.

const rgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const hex = (h) => new THREE.Color(h);
const dir = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

const KEYS = [
  { // morning: the look the world starts with
    t: 0,
    top: rgb(0.27, 0.38, 0.90), mid: rgb(0.47, 0.52, 0.96), hor: rgb(0.90, 0.72, 0.90), low: rgb(0.74, 0.64, 0.95),
    cream: rgb(1.0, 0.95, 0.90), rose: rgb(0.98, 0.72, 0.84), violet: rgb(0.52, 0.42, 0.86), blue: rgb(0.30, 0.42, 0.90),
    sunCol: rgb(1.0, 0.82, 0.55), sunDir: dir(0, 0.28, -1), stars: 0,
    fog: hex(0xb4b0f2), hemiSky: hex(0xe6e4ff), hemiGround: hex(0xb46ec4), hemiI: 1.55,
    sun: hex(0xfff0d8), sunI: 2.0, sunPos: dir(-0.55, 0.9, 0.35),
    far: hex(0xffffff), cloud: hex(0x6a6088), sea: hex(0xffffff), tint: hex(0xffffff),
  },
  { // midday: higher, whiter light and a bluer sky
    t: 0.33,
    top: rgb(0.20, 0.42, 0.95), mid: rgb(0.45, 0.62, 0.98), hor: rgb(0.86, 0.82, 0.96), low: rgb(0.72, 0.72, 0.97),
    cream: rgb(1.0, 0.98, 0.95), rose: rgb(0.97, 0.80, 0.88), violet: rgb(0.56, 0.50, 0.90), blue: rgb(0.28, 0.46, 0.92),
    sunCol: rgb(1.0, 0.9, 0.7), sunDir: dir(0, 0.3, -1), stars: 0,
    fog: hex(0xb8c0f6), hemiSky: hex(0xeef0ff), hemiGround: hex(0xb880d0), hemiI: 1.62,
    sun: hex(0xfffaf0), sunI: 2.1, sunPos: dir(-0.3, 1.0, 0.25),
    far: hex(0xffffff), cloud: hex(0x70688c), sea: hex(0xffffff), tint: hex(0xffffff),
  },
  { // golden hour: the sun low and to one side, peach along the horizon
    t: 0.68,
    top: rgb(0.36, 0.34, 0.80), mid: rgb(0.78, 0.56, 0.80), hor: rgb(1.0, 0.74, 0.58), low: rgb(0.92, 0.60, 0.72),
    cream: rgb(1.0, 0.90, 0.74), rose: rgb(1.0, 0.62, 0.62), violet: rgb(0.60, 0.38, 0.78), blue: rgb(0.40, 0.36, 0.82),
    sunCol: rgb(1.5, 0.95, 0.5), sunDir: dir(0, 0.2, -1), stars: 0,
    fog: hex(0xe8b0c0), hemiSky: hex(0xffe0d8), hemiGround: hex(0xc070a8), hemiI: 1.4,
    sun: hex(0xffc890), sunI: 2.3, sunPos: dir(-0.8, 0.42, -0.4),
    far: hex(0xffdccc), cloud: hex(0x8a6070), sea: hex(0xffe6d8), tint: hex(0xfffaf0),
  },
  { // dusk: indigo overhead, embers on the horizon, the first stars
    t: 1.0,
    top: rgb(0.10, 0.10, 0.42), mid: rgb(0.30, 0.22, 0.62), hor: rgb(0.98, 0.52, 0.52), low: rgb(0.60, 0.36, 0.70),
    cream: rgb(1.0, 0.72, 0.66), rose: rgb(0.90, 0.42, 0.60), violet: rgb(0.34, 0.24, 0.62), blue: rgb(0.16, 0.16, 0.52),
    sunCol: rgb(1.6, 0.8, 0.5), sunDir: dir(0, 0.14, -1), stars: 0.55,
    fog: hex(0x8e6cb8), hemiSky: hex(0xb8b0ff), hemiGround: hex(0x8a5ab0), hemiI: 1.22,
    sun: hex(0xff9a78), sunI: 1.5, sunPos: dir(-0.7, 0.3, -0.6),
    far: hex(0xb89edc), cloud: hex(0x5a4078), sea: hex(0xcca8f2), tint: hex(0xfff6ff),
  },
  { // night: after the last stroke. Moonlight, a full sky of stars, and everything that glows
    t: 1.25,
    top: rgb(0.04, 0.05, 0.24), mid: rgb(0.12, 0.12, 0.42), hor: rgb(0.52, 0.30, 0.62), low: rgb(0.30, 0.22, 0.52),
    cream: rgb(0.66, 0.60, 0.86), rose: rgb(0.56, 0.38, 0.72), violet: rgb(0.22, 0.18, 0.50), blue: rgb(0.10, 0.10, 0.38),
    sunCol: rgb(1.0, 0.86, 0.9), sunDir: dir(0, 0.2, -1), stars: 1,
    fog: hex(0x4a4490), hemiSky: hex(0x9aa0ff), hemiGround: hex(0x6a4aa0), hemiI: 1.08,
    sun: hex(0xc8d0ff), sunI: 0.95, sunPos: dir(-0.4, 0.8, 0.3),
    far: hex(0x6c6cb8), cloud: hex(0x34306a), sea: hex(0x8080d8), tint: hex(0xf0f4ff),
  },
];

export class Day {
  constructor(world, post) {
    this.sky = world.sky.material.uniforms; this.L = world.light; this.post = post;
    this.t = -1;
    this.set(0);
  }

  /** t: 0 morning, 0.33 midday, 0.68 golden hour, 1 dusk, 1.25 night. */
  set(t) {
    t = Math.max(0, Math.min(KEYS[KEYS.length - 1].t, t));
    if (Math.abs(t - this.t) < 1e-4) return;
    this.t = t;
    let i = 0;
    while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
    const a = KEYS[i], b = KEYS[i + 1], k = (t - a.t) / (b.t - a.t);
    const u = this.sky, L = this.L;
    u.top.value.lerpColors(a.top, b.top, k); u.mid.value.lerpColors(a.mid, b.mid, k); u.hor.value.lerpColors(a.hor, b.hor, k); u.low.value.lerpColors(a.low, b.low, k);
    u.cCream.value.lerpColors(a.cream, b.cream, k); u.cRose.value.lerpColors(a.rose, b.rose, k); u.cViolet.value.lerpColors(a.violet, b.violet, k); u.cBlue.value.lerpColors(a.blue, b.blue, k);
    u.sunCol.value.lerpColors(a.sunCol, b.sunCol, k); u.sunDir.value.lerpVectors(a.sunDir, b.sunDir, k).normalize();
    u.stars.value = a.stars + (b.stars - a.stars) * k;
    L.fog.color.lerpColors(a.fog, b.fog, k);
    L.hemi.color.lerpColors(a.hemiSky, b.hemiSky, k); L.hemi.groundColor.lerpColors(a.hemiGround, b.hemiGround, k); L.hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * k;
    L.sun.color.lerpColors(a.sun, b.sun, k); L.sun.intensity = a.sunI + (b.sunI - a.sunI) * k; L.sun.position.lerpVectors(a.sunPos, b.sunPos, k).normalize();
    L.far.color.lerpColors(a.far, b.far, k); L.clouds.emissive.lerpColors(a.cloud, b.cloud, k); L.sea.uniforms.tint.value.lerpColors(a.sea, b.sea, k);
    this.post.tint.lerpColors(a.tint, b.tint, k);
  }
}
