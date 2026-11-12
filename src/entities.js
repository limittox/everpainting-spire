import * as THREE from 'three';
import { PAL, daub, rand, rr, pick, clamp, glowSprite } from './util.js';

const V3 = THREE.Vector3;
export const SPLASH = ['#ff5a7a', '#ffc040', '#40e0d8', '#b060e0', '#fff4dc', '#ff8a3a', '#5a8af0'];

// ---------------------------------------------------------------- particles (flecks of paint)
export class Particles {
  constructor(scene, max = 700) {
    this.max = max; this.i = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.life0 = new Float32Array(max);
    this.grav = new Float32Array(max); this.size0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('tint', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute vec3 tint; attribute float size; uniform float scale; varying vec3 vCol;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * scale / max(0.5, -mv.z) * smoothstep(0.6, 3.0, -mv.z); vCol = tint; }`,
      fragmentShader: /* glsl */ `
        precision highp float; varying vec3 vCol;
        void main() { vec2 q = gl_PointCoord - 0.5; if (dot(q, q) > 0.25) discard; gl_FragColor = vec4(vCol, 1.0); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._c = new THREE.Color();
  }
  burst(p, n, o = {}) {
    const { speed = 5, up = 3, colors = SPLASH, size = 0.35, life = 0.8, gravity = 14, spread = 0.2, boost = 1 } = o;
    for (let k = 0; k < n; k++) {
      const i = this.i; this.i = (this.i + 1) % this.max;
      const a = rand() * Math.PI * 2, s = speed * rr(0.3, 1);
      this.pos[i * 3] = p.x + rr(-spread, spread); this.pos[i * 3 + 1] = p.y + rr(-spread, spread); this.pos[i * 3 + 2] = p.z + rr(-spread, spread);
      this.vel[i * 3] = Math.cos(a) * s; this.vel[i * 3 + 1] = up * rr(0.2, 1.3); this.vel[i * 3 + 2] = Math.sin(a) * s;
      this._c.set(pick(colors)).multiplyScalar(boost);
      this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b;
      this.life[i] = this.life0[i] = life * rr(0.6, 1.2); this.size0[i] = size * rr(0.5, 1.3); this.grav[i] = gravity;
    }
  }
  /** One fleck with an explicit velocity (used for the guiding motes). */
  emit(p, vx, vy, vz, color, size = 0.3, life = 1, gravity = 0, boost = 1) {
    const i = this.i; this.i = (this.i + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this._c.set(color).multiplyScalar(boost);         // brighter than white: picked up by the glow
    this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b;
    this.life[i] = this.life0[i] = life; this.size0[i] = size; this.grav[i] = gravity;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const u = this.life[i] / this.life0[i];
      this.size[i] = this.size0[i] * clamp(u * 1.6, 0, 1) * clamp((1 - u) * 9 + 0.35, 0, 1);
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = true; a.tint.needsUpdate = true; a.size.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- brush swing arcs
export class SwingFx {
  constructor(scene) {
    this.pool = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.RingGeometry(1.1, 3.7, 22, 3, -Math.PI / 2 - 0.6 * Math.PI, 1.2 * Math.PI);
      g.rotateX(-Math.PI / 2);
      const pal = ['#ffffff', '#f0f0f0', '#d4d4d4', '#ffffff', '#bcbcbc'];      // greys: the material colour tints them
      const m = new THREE.Mesh(daub(g, pal, { scale: 0.9, spread: 0.6 }), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      m.visible = false; m.userData.t = 1;
      scene.add(m); this.pool.push(m);
    }
    this.k = 0;
  }
  fire(pos, heading, hex = '#fff4dc') {
    const m = this.pool[this.k]; this.k = (this.k + 1) % this.pool.length;
    m.material.color.set(hex);
    m.position.set(pos.x, pos.y + 1.05, pos.z); m.userData.h = heading; m.userData.t = 0; m.visible = true;
    m.rotation.set(rr(-0.15, 0.15), heading, rr(-0.2, 0.2));
  }
  update(dt) {
    for (const m of this.pool) {
      if (!m.visible) continue;
      m.userData.t += dt / 0.34;
      const u = m.userData.t;
      if (u >= 1) { m.visible = false; continue; }
      m.rotation.y = m.userData.h + 0.9 - u * 1.6;
      m.scale.setScalar(0.65 + u * 0.5);
      m.material.opacity = 1 - u * u;
    }
  }
}

// ---------------------------------------------------------------- splats left on the ground
export class Splats {
  constructor(scene) {
    this.pool = [];
    for (let i = 0; i < 26; i++) {
      const g = new THREE.CircleGeometry(1, 11);
      const p = g.attributes.position;
      for (let k = 1; k < p.count; k++) { const s = rr(0.6, 1.25); p.setX(k, p.getX(k) * s); p.setY(k, p.getY(k) * s); }
      g.rotateX(-Math.PI / 2);
      const c = SPLASH[i % SPLASH.length];
      const m = new THREE.Mesh(daub(g, [c, c], { spread: 1 }), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.visible = false; scene.add(m); this.pool.push(m);
    }
    this.k = 0;
  }
  add(x, y, z, s = 1) {
    const m = this.pool[this.k]; this.k = (this.k + 1) % this.pool.length;
    m.position.set(x, y + 0.08, z); m.rotation.y = rand() * 6; m.scale.set(0.01, 1, 0.01); m.visible = true;
    m.userData.s = s; m.userData.t = 0;
  }
  /** A fresh daub spreads out quickly, then settles. */
  update(dt) {
    for (const m of this.pool) {
      if (!m.visible || m.userData.t >= 1) continue;
      const u = (m.userData.t = Math.min(1, m.userData.t + dt / 0.45)), e = 1 - Math.pow(1 - u, 3);
      const k = m.userData.s * (e + Math.sin(u * Math.PI) * 0.12);
      m.scale.set(k, 1, k);
    }
  }
}

// ---------------------------------------------------------------- pickups
export class Spark {
  constructor(scene, pos, glowTex) {
    this.g = new THREE.Group(); this.g.position.copy(pos); this.base = pos.y + 1.5;
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshBasicMaterial({ color: 0xfff6d0, fog: false }));
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 5, 18), new THREE.MeshBasicMaterial({ color: 0xffc040, fog: false }));
    this.ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.04, 5, 18), new THREE.MeshBasicMaterial({ color: 0xff8ab0, fog: false }));
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.45, 34, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.beam.position.y = 17;
    this.g.add(this.core, this.ring, this.ring2, this.beam, glowSprite(glowTex, 6.5, 0xffc870, 0.95));
    scene.add(this.g); this.taken = false;
    this.locked = false;       // held by something (under leaves, in a spring): it glints, but cannot be taken yet
    this.hidden = false;       // not there at all yet
    this.lure = null;          // while locked: where to look instead
    this.k = 1;                // 0 held .. 1 free
  }
  /** Where it floats (its ground position; it hovers a little above). */
  moveTo(p) { this.g.position.copy(p); this.base = p.y + 1.5; }
  update(t, dt = 0.016) {
    this.k += ((this.locked ? 0 : 1) - this.k) * (1 - Math.exp(-2.4 * dt));
    this.g.visible = !this.hidden;
    this.g.scale.setScalar(0.32 + 0.68 * this.k);
    this.beam.visible = this.k > 0.6;
    this.g.position.y = this.base - (1 - this.k) * 1.2 + Math.sin(t * 1.7) * 0.25 * this.k;
    this.ring.rotation.set(t * 1.2, t * 0.8, 0); this.ring2.rotation.set(-t * 0.9, 0, t * 1.1);
    this.core.rotation.y = t * 2;
  }
}

export class Drops {
  constructor(scene, spots) {
    const geo = new THREE.OctahedronGeometry(0.24, 0);
    this.items = spots.map((p, i) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: SPLASH[i % SPLASH.length], fog: false }));
      m.position.copy(p); m.scale.set(0.8, 1.25, 0.8);
      scene.add(m);
      return { m, y: p.y, ph: i * 1.3, taken: false, color: SPLASH[i % SPLASH.length] };
    });
  }
  update(t) {
    for (const d of this.items) { if (d.taken) continue; d.m.position.y = d.y + Math.sin(t * 2.2 + d.ph) * 0.18; d.m.rotation.y = t * 1.6 + d.ph; }
  }
}

// ---------------------------------------------------------------- blots: colourless sleepers
// They doze as dark smudges until the painter comes close (or swings the brush nearby); then they
// bloom into colour and drift along behind for the rest of the journey.
//
// Awake, each one has a temperament, and it shows whenever the painter stops for a moment:
//   curious  drifts a little ahead on the road, and goes to look closely at the nearest flower
//   sleepy   trails at the back, and settles on the ground for a nap (it takes a moment to get going again)
//   playful  circles the painter in hops and somersaults, and rolls over and over in the air when they fly
//   fond     keeps closest of all, and sits at the painter's feet looking up at them
// All of them hop when the painter jumps, blink, spin for joy when something blooms or is found, and keep
// whatever colour the brush splashes them with.
const TEMPERS = ['curious', 'sleepy', 'playful', 'fond'];
const blotGeo = new THREE.IcosahedronGeometry(0.85, 2);
const eyeGeo = new THREE.SphereGeometry(0.13, 8, 6);
const TAU = Math.PI * 2;
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);
export class Blot {
  constructor(scene, pos, index) {
    this.g = new THREE.Group();
    this.mat = new THREE.MeshLambertMaterial({ color: 0x3a3548 });
    this.body = new THREE.Mesh(blotGeo, this.mat); this.body.position.y = 0.7;
    const em = new THREE.MeshBasicMaterial({ color: 0xf4f0ff });
    this.eyes = [new THREE.Mesh(eyeGeo, em), new THREE.Mesh(eyeGeo, em)];
    this.eyes[0].position.set(-0.3, 0.85, 0.7); this.eyes[1].position.set(0.3, 0.85, 0.7);
    this.eyes.forEach((e) => e.scale.set(1.2, 0.18, 1));        // closed
    this.drips = [];
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(blotGeo, this.mat); const a = (i / 4) * 6.28 + rand();
      d.scale.setScalar(rr(0.22, 0.38)); d.position.set(Math.cos(a) * 0.85, 0.18, Math.sin(a) * 0.85);
      this.g.add(d); this.drips.push(d);
    }
    this.g.add(this.body, ...this.eyes);
    this.g.position.copy(pos);
    this.g.rotation.y = rand() * 6;
    scene.add(this.g);
    this.color = SPLASH[index % SPLASH.length];
    this.awake = false; this.slot = 0; this.pop = 0; this.ph = rand() * 6;

    this.temper = TEMPERS[index % TEMPERS.length];
    this.ctx = null;                 // set by the game: { ground(x, z, y), flower(pos) }
    this.mode = 'follow';            // follow | idle (the painter is standing about) | rest (the painter is at an easel)
    this.modeT = 0; this.still = 0; this.lag = 0;
    this.goal = null; this.goalT = 0;
    this.off = 0;                    // how far a hop has lifted it, this frame
    this.hopping = false; this.hopWait = 0; this.hopU = 0; this.hopFlip = false; this.nextHop = 2;
    this.spin = 0; this.roll = 0; this.tilt = 0;
    this.lid = 0.18; this.blink = 2 + Math.random() * 4;
    this.napping = false; this.puff = false; this.puffT = 1.5;
  }
  wake(slot) {
    this.awake = true; this.slot = slot; this.pop = 1;
    this.mat.color.set(this.color); this.mat.emissive.set(this.color).multiplyScalar(0.3);
    this.drips.forEach((d) => { d.visible = false; });
  }
  setColor(hex) {
    this.color = hex;
    if (this.awake) { this.mat.color.set(hex); this.mat.emissive.set(hex).multiplyScalar(0.3); }
  }
  sing() { this.pop = Math.max(this.pop, 0.5); }
  /** A hop, after `delay` seconds; with `flip`, head over heels. */
  hop(delay = 0, flip = false) {
    if (!this.awake || this.hopping || this.napping) return;
    this.hopping = true; this.hopWait = delay; this.hopU = 0; this.hopFlip = flip;
  }
  /** Something good just happened: a spin and a bounce. */
  cheer(delay = 0) {
    if (!this.awake) return;
    this.napping = false;
    this.pop = Math.max(this.pop, 0.7); this.spin += TAU;
    this.hop(delay);
  }
  /** Caught by the brush: it takes the colour, and is delighted. */
  splash(hex) {
    if (!this.awake) return;
    this.setColor(hex);
    this.napping = false;
    this.pop = 0.9; this.spin += TAU;
    this.hop(0);
  }

  update(dt, t, player) {
    const p = this.g.position;
    if (!this.awake) {
      const br = 1 + Math.sin(t * 1.3 + this.ph) * 0.06;
      this.body.scale.set(1 / br, 0.78 * br, 1 / br);
      const dx = player.pos.x - p.x, dz = player.pos.z - p.z;
      return dx * dx + dz * dz < 6.2 && Math.abs(player.pos.y - p.y) < 3 ? 'wake' : null;
    }
    p.y -= this.off;                                   // (the hop is added back at the end)
    const pp = player.pos, h = player.heading, sh = Math.sin(h), ch = Math.cos(h);
    const ground = (x, z) => { const g = this.ctx ? this.ctx.ground(x, z, pp.y) : -Infinity; return g > -Infinity && Math.abs(g - pp.y) < 3 ? g : pp.y; };

    // --- what is the painter doing? walking on, standing about, or sitting at an easel
    const quiet = !player.seat && player.grounded && !player.lift && !player.ride && Math.hypot(player.vel.x, player.vel.z) < 0.6;
    this.still = quiet ? this.still + dt : 0;
    const mode = player.seat ? 'rest' : this.still > 3.2 + this.slot * 0.7 ? 'idle' : 'follow';
    if (mode !== this.mode) {
      if (this.napping) { this.napping = false; this.pop = 0.6; this.lag = mode === 'follow' ? 0.8 : 0; }     // woken with a start; a moment to gather itself
      this.mode = mode; this.modeT = 0; this.goal = null; this.goalT = 0; this.nextHop = 1 + Math.random() * 2;
    }
    this.modeT += dt;

    let tx, ty, tz, rate, face = null, lid = 1, squash = 0, tilt = 0, rolling = false;
    const row = Math.floor(this.slot / 2), sgn = this.slot % 2 ? -1 : 1;

    if (mode === 'rest') {
      // gathered on the ground beside and behind the stool, out of the view
      const S = player.seat, phi = 0.25 + this.slot * 0.42, rad = 2.3 + (this.slot % 2) * 0.8, s2 = Math.sin(S.heading), c2 = Math.cos(S.heading);
      tx = S.pos.x + (c2 * Math.cos(phi) - s2 * Math.sin(phi)) * rad; tz = S.pos.z + (-s2 * Math.cos(phi) - c2 * Math.sin(phi)) * rad;
      ty = S.pos.y + 0.42 + Math.sin(t * 1.4 + this.slot) * 0.06;
      rate = 1.6;
      // they watch the view with the painter; the fond one watches the painter, and the sleepy one is soon asleep
      face = this.temper === 'fond' ? [S.pos.x, S.pos.z] : [p.x + s2 * 10, p.z + c2 * 10];
      if (this.temper === 'sleepy' && this.modeT > 4) { this.napping = true; lid = 0.14; squash = 1; }
      if (this.temper === 'playful' && this.modeT > this.nextHop) { this.hop(0); this.nextHop = this.modeT + 3.5 + Math.random() * 3; }
    } else if (mode === 'idle') {
      rate = 2.2;
      if (this.temper === 'sleepy') {
        // down on the ground where it is, eyes shut
        if (!this.goal) this.goal = { x: p.x, z: p.z };
        tx = this.goal.x; tz = this.goal.z; ty = ground(tx, tz) + 0.42;
        if (this.modeT > 1.2) { this.napping = true; lid = 0.14; squash = 1; }
      } else if (this.temper === 'curious') {
        // off to the nearest flower for a closer look; with none about, it potters round on its own
        this.goalT -= dt;
        if (!this.goal || this.goalT <= 0) {
          const f = this.ctx && this.ctx.flower ? this.ctx.flower(p) : null;
          if (f) { this.goal = { x: f.x, y: f.y + 1.2, z: f.z, flower: true }; this.goalT = 1e9; }
          else { const a = Math.random() * TAU, r = 2.5 + Math.random() * 3; this.goal = { x: pp.x + Math.cos(a) * r, y: 0, z: pp.z + Math.sin(a) * r, flower: false }; this.goal.y = ground(this.goal.x, this.goal.z) + 0.8; this.goalT = 3 + Math.random() * 2.5; }
        }
        const dx = this.goal.x - p.x, dz = this.goal.z - p.z, d = Math.hypot(dx, dz) || 1;
        // stop just short of the flower, facing it, and lean in
        const stop = this.goal.flower ? 0.75 : 0;
        tx = this.goal.x - (dx / d) * stop; tz = this.goal.z - (dz / d) * stop; ty = this.goal.y + Math.sin(t * 1.7 + this.ph) * 0.08;
        if (this.goal.flower) { face = [this.goal.x, this.goal.z]; if (d < 1.6) tilt = 0.42 + Math.sin(t * 2.6 + this.ph) * 0.14; }
      } else if (this.temper === 'playful') {
        // round and round the painter, a hop and a somersault at a time
        const a = this.modeT * 1.25 + this.ph;
        tx = pp.x + Math.cos(a) * 2.7; tz = pp.z + Math.sin(a) * 2.7; ty = ground(tx, tz) + 0.6;
        rate = 3;
        if (this.modeT > this.nextHop) { this.hop(0, true); this.nextHop = this.modeT + 1.5 + Math.random() * 1.2; }
      } else {
        // at the painter's feet, looking up
        tx = pp.x + sh * 1.25 + ch * 0.55 * sgn; tz = pp.z + ch * 1.25 - sh * 0.55 * sgn; ty = ground(tx, tz) + 0.5 + Math.sin(t * 1.5 + this.ph) * 0.05;
        face = [pp.x, pp.z]; tilt = -0.3;
        if (this.modeT > this.nextHop) { this.hop(0); this.nextHop = this.modeT + 3 + Math.random() * 3; }
      }
    } else {
      // drifting along with the painter, each in its own lazy orbit and its own place in the line
      const a = t * (this.temper === 'playful' ? 1.5 : 0.9) + this.slot * 2.4, orbit = this.temper === 'playful' ? 1.0 : 0.6;
      let back = 1.0 + row * 1.3, side = sgn * (2.1 + row * 0.7);
      rate = 3.2 - this.slot * 0.2;
      if (this.temper === 'curious') { back -= 2.6; side *= 1.15; rate += 0.6; }          // up ahead, to either side of the road
      else if (this.temper === 'sleepy') { back += 1.3; rate *= 0.7; }                    // bringing up the rear
      else if (this.temper === 'fond') { back -= 0.3; side *= 0.62; rate += 0.4; }        // close by
      tx = pp.x - sh * back + ch * side + Math.cos(a) * orbit;
      ty = pp.y + 1.25 + Math.sin(t * 2.1 + this.slot) * 0.3 + row * 0.25;
      tz = pp.z - ch * back - sh * side + Math.sin(a) * orbit;
      rolling = this.temper === 'playful' && (player.gliding || !!player.ride);
      if (this.lag > 0) { this.lag -= dt; rate = 0.25; lid = this.lag > 0.45 ? 0.3 : 1; }
    }

    const k = ease(rate, dt), ox = p.x, oz = p.z;
    p.x += (tx - p.x) * k; p.y += (ty - p.y) * k; p.z += (tz - p.z) * k;

    // --- which way it looks: at whatever it is attending to, otherwise where it is going
    let want = null;
    if (face) want = Math.atan2(face[0] - p.x, face[1] - p.z);
    else { const vx = p.x - ox, vz = p.z - oz; if (vx * vx + vz * vz > 1e-5) want = Math.atan2(vx, vz); }
    if (this.spin > 0) { const d = Math.min(this.spin, dt * 13); this.spin -= d; this.g.rotation.y += d; }
    else if (want !== null) {
      let d = want - this.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.g.rotation.y += d * ease(face ? 4 : 6, dt);
    }

    // --- hops (the painter jumped, or it simply felt like it)
    let flip = 0;
    if (this.hopping) {
      if (this.hopWait > 0) this.hopWait -= dt;
      else {
        this.hopU += dt / (this.hopFlip ? 0.62 : 0.46);
        if (this.hopU >= 1) { this.hopping = false; this.off = 0; this.pop = Math.max(this.pop, 0.25); }
        else { this.off = Math.sin(Math.PI * this.hopU) * (this.hopFlip ? 1.25 : 0.85); if (this.hopFlip) flip = this.hopU * TAU; }
      }
    } else this.off = 0;
    p.y += this.off;

    // --- rolling over and over in the air when the painter flies; otherwise upright
    if (rolling) this.roll += dt * 4.6;
    else if (this.roll !== 0) { this.roll %= TAU; this.roll += ((this.roll > Math.PI ? TAU : 0) - this.roll) * ease(5, dt); if (Math.abs(this.roll % TAU) < 0.01 || Math.abs(this.roll - TAU) < 0.01) this.roll = 0; }
    this.tilt += (tilt - this.tilt) * ease(4, dt);
    this.g.rotation.x = this.tilt + flip; this.g.rotation.z = this.roll;

    // --- eyes: open, shut in sleep, and a blink every few seconds
    this.blink -= dt;
    if (this.blink < -0.12) this.blink = 2.5 + Math.random() * 4;
    if (this.blink < 0) lid = Math.min(lid, 0.12);
    this.lid += (lid - this.lid) * ease(18, dt);
    for (const e of this.eyes) e.scale.set(1 + (1 - this.lid) * 0.22, this.lid, 1);

    // --- asleep: flattened, breathing slowly, and now and then a little puff drifts up
    if (this.napping) { this.puffT -= dt; if (this.puffT <= 0) { this.puffT = 2.6; this.puff = true; } } else this.puffT = 1.5;
    this.pop = Math.max(0, this.pop - dt * 1.4);
    const s = 0.5 * (1 + Math.sin(this.pop * 12) * this.pop * 0.5), wob = 1 + Math.sin(t * (this.napping ? 1.1 : 3) + this.ph) * 0.06;
    this.g.scale.set(s / wob, s * wob, s / wob);
    const q = ease(5, dt), by = squash ? 0.66 : 0.9, bw = squash ? 1.14 : 1;
    this.body.scale.x += (bw - this.body.scale.x) * q; this.body.scale.z = this.body.scale.x; this.body.scale.y += (by - this.body.scale.y) * q;
    return null;
  }
}
