import * as THREE from 'three';
import { clamp } from './util.js';
import { buildPainter, Cape } from './painter.js';

const V3 = THREE.Vector3;

// A hair ribbon that trails behind; it grows longer with every spark gathered.
class Ribbon {
  constructor(scene, color, offset, base = 9, max = 26, seg = 0.17) {
    this.max = max; this.base = base; this.n = base; this.target = base; this.grow = 0; this.seg = seg; this.offset = offset;
    this.nodes = Array.from({ length: max }, () => new V3());
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    this.geo.setDrawRange(0, (this.n - 1) * 6);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, flatShading: true, emissive: 0x300408 }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.init = false;
  }
  setLength(extra) { this.target = Math.min(this.max, this.base + extra); }
  update(anchor, t, dt, stream) {
    const N = this.nodes;
    if (!this.init) { N.forEach((p, i) => p.copy(anchor).add(new V3(0, -i * this.seg, 0))); this.init = true; }
    if (this.n < this.target) {
      this.grow += dt * 7;
      while (this.grow >= 1 && this.n < this.target) { N[this.n].copy(N[this.n - 1]); this.n++; this.grow -= 1; }
      this.geo.setDrawRange(0, (this.n - 1) * 6);
    }
    N[0].copy(anchor);
    for (let i = 1; i < this.n; i++) {
      const p = N[i];
      p.x += (1.6 + Math.sin(t * 5 + i * 0.9 + this.offset) * 1.3) * dt;
      p.y += (Math.sin(t * 6.3 + i * 1.1 + this.offset * 2) * 1.6 - 0.6 + stream * 1.4) * dt;
      p.z += (0.6 + Math.cos(t * 4.1 + i * 0.7 + this.offset) * 1.2) * dt;
      const d = p.clone().sub(N[i - 1]);
      const l = d.length() || 1;
      p.copy(N[i - 1]).addScaledVector(d, this.seg / l);
    }
    const pos = this.geo.attributes.position;
    for (let i = 0; i < this.n; i++) {
      const w = 0.085 * (1 - (i / this.n) * 0.7);
      const tw = Math.sin(i * 0.8 + t * 3 + this.offset) * 0.5;
      pos.setXYZ(i * 2, N[i].x + tw * w, N[i].y + w, N[i].z);
      pos.setXYZ(i * 2 + 1, N[i].x - tw * w, N[i].y - w, N[i].z);
    }
    pos.needsUpdate = true;
  }
}

const smooth = (x) => x * x * (3 - 2 * x);

export class Player {
  constructor(scene) {
    this.model = buildPainter();
    this.cape = new Cape(scene, this.model.capePins.length);
    this._pins = this.model.capePins.map(() => new V3());
    this._capsule = { a: new V3(), b: new V3(), r: 0.3 };
    this._spheres = [0, 1, 2, 3].map((i) => ({ c: new V3(), r: i < 2 ? 0.15 : 0.13 }));
    this._wind = new V3();
    this.blink = 2; this.pose = null;
    this.group = this.model.root;
    scene.add(this.group);
    this.pos = this.group.position;
    this.vel = new V3();
    this.heading = Math.PI;
    this.grounded = false; this.jumps = 0; this.airTime = 0;
    this.gliding = false; this.surfing = false; this.slope = 0;
    this.ride = null; this.rideCd = 0;      // carried by a wind current
    this.lift = null;                        // being floated back after a fall
    this.walk = 0; this.swingT = -1; this.swingCd = 0;
    this.jumpBuf = 0;                        // a jump pressed just before landing still counts
    this.sq = 0; this.sqV = 0;               // squash and stretch, on a small spring
    this.turn = 0; this.prevH = Math.PI; this.stepN = 0;
    this.safe = new V3(); this.radius = 0.45;
    this.ribbons = [new Ribbon(scene, 0xd9283c, 0, 10), new Ribbon(scene, 0xe84a50, 2.1, 8)];
    this._anchor = new V3(); this._tan = new V3(); this._t = new V3();
    this.events = [];
  }

  teleport(p, heading = Math.PI) {
    this.pos.copy(p); this.vel.set(0, 0, 0); this.heading = this.prevH = heading; this.safe.copy(p);
    this.ride = null; this.lift = null; this.seat = null;
    this.ribbons.forEach((r) => { r.init = false; });
    this.cape.reset();
  }

  setPaint(hex) { for (const k of ['tip', 'backTip', 'easelTip']) this.model[k].material.color.set(hex); }
  setSparks(n) { this.ribbons.forEach((r) => r.setLength(n * 5)); }

  /** Sit on a stool at `pos`, facing `heading`. While `seat.painting` is set the painter works at the easel. */
  sit(pos, heading) { this.seat = { pos: pos.clone(), heading, painting: false }; this.ride = null; this.swingT = -1; }
  stand() { this.seat = null; }

  swing() {
    if (this.swingCd > 0 || this.lift || this.seat) return false;
    this.swingT = 0; this.swingCd = 0.42;
    return true;
  }

  /** Nothing is lost by falling: a swirl of paint carries the painter back to the last safe ground. */
  floatBack() {
    this.lift = { from: this.pos.clone(), to: this.safe.clone(), t: 0 };
    this.vel.set(0, 0, 0); this.ride = null; this.seat = null; this.gliding = false; this.surfing = false;
  }

  release(up) {
    this.vel.copy(this._tan).multiplyScalar(13);
    this.vel.y = Math.max(this.vel.y, up);
    this.ride = null; this.rideCd = 1.2; this.jumps = 1; this.airTime = 1;
  }

  update(dt, t, input, camYaw, world) {
    const ev = this.events; ev.length = 0;
    this.rideCd -= dt; this.swingCd -= dt;
    this.jumpBuf = input.jump ? 0.14 : this.jumpBuf - dt;

    // --- resting on a stool
    if (this.seat) {
      const k = 1 - Math.exp(-7 * dt);
      this.pos.lerp(this.seat.pos, k);
      let d = this.seat.heading - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * k;
      this.vel.set(0, 0, 0); this.grounded = true; this.gliding = false; this.surfing = false; this.jumps = 0; this.airTime = 0;
      this.animate(dt, t);
      return ev;
    }

    // --- floating back up after a fall
    if (this.lift) {
      const L = this.lift;
      L.t += dt / 1.8;
      const e = smooth(clamp(L.t, 0, 1));
      this.pos.lerpVectors(L.from, L.to, e);
      this.pos.y += Math.sin(Math.PI * e) * 7;
      this.heading += dt * 3;
      this.grounded = false; this.gliding = true;
      if (L.t >= 1) { this.pos.copy(L.to); this.lift = null; this.grounded = true; this.gliding = false; this.jumps = 0; ev.push('settle'); }
      this.animate(dt, t);
      return ev;
    }

    // --- riding the wind
    if (this.ride) {
      const R = this.ride, w = R.wind;
      R.s += (15 * dt) / w.step;
      const i = Math.min(w.n - 1, Math.floor(R.s)), f = R.s - i;
      this._tan.subVectors(w.pts[i + 1], w.pts[i]).normalize();
      if (input.jump) { this.release(8); ev.push('jump'); }
      else if (R.s >= w.n) { this.release(4.5); }
      else {
        this._t.lerpVectors(w.pts[i], w.pts[i + 1], f); this._t.y -= 0.9;
        this.pos.lerp(this._t, 1 - Math.exp(-9 * dt));
        this.vel.copy(this._tan).multiplyScalar(15);
        let d = Math.atan2(this._tan.x, this._tan.z) - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.heading += d * (1 - Math.exp(-8 * dt));
        this.grounded = false; this.gliding = true; this.surfing = false;
      }
      this.animate(dt, t);
      return ev;
    }

    // --- camera-relative movement
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let mx = fx * input.mz + rx * input.mx, mz = fz * input.mz + rz * input.mx;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    this.surfing = input.surf && this.grounded && ml > 0.1;
    let speed = 8.6;
    if (this.surfing) speed = 14.5 + clamp(-this.slope * 16, -3, 6);     // skating: faster downhill
    else if (this.gliding) speed = 11;
    const k = 1 - Math.exp(-(this.grounded ? (this.surfing ? 5 : 14) : 5.5) * dt);
    this.vel.x += (mx * speed - this.vel.x) * k;
    this.vel.z += (mz * speed - this.vel.z) * k;
    if (ml > 0.1) {
      const target = Math.atan2(mx, mz);
      let d = target - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * (1 - Math.exp(-(this.surfing ? 7 : 13) * dt));
    }
    if (this.jumpBuf > 0 && (this.grounded || this.airTime < 0.12 || this.jumps < 2)) {
      const first = this.grounded || this.airTime < 0.12;
      this.jumpBuf = 0; this.sqV = first ? 2.8 : 2.0;
      this.vel.y = first ? 11.5 : 10.5;
      this.jumps = first ? 1 : 2; this.grounded = false; this.airTime = 1;
      ev.push(first ? 'jump' : 'doublejump');
    }
    // gliding: hold jump while falling and the cloak catches the air, trading gravity for a slow, even sink
    const wasGliding = this.gliding;
    const up = this.updraft || 0;        // warm air rising under the painter (set by the game, in the Underpainting)
    this.gliding = !this.grounded && input.jumpHeld && (this.vel.y < -1.2 || up > 0);
    if (this.gliding) {
      if (up > 0) this.vel.y += (up - this.vel.y) * (1 - Math.exp(-3.2 * dt));       // the cloak fills, and the air carries it up
      else this.vel.y += (-2.4 - this.vel.y) * (1 - Math.exp(-6 * dt));
      if (!wasGliding) ev.push('glide');
    } else this.vel.y -= 27 * dt;
    if (this.vel.y < -40) this.vel.y = -40;

    const wasGrounded = this.grounded, y0 = this.pos.y;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;

    // obstacles
    for (const c of world.colliders) {
      if (c.top !== undefined && this.pos.y >= c.top) continue;        // above it: nothing in the way
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z, rr2 = c.r + this.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr2 * rr2 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        // sinking into something tall from above (the Spire's roofs): slide out to the side rather than jump there
        const out = c.top !== undefined && !wasGrounded && d < rr2 - 0.6 ? Math.min(rr2, d + 42 * dt) : rr2;
        this.pos.x = c.x + (dx / d) * out; this.pos.z = c.z + (dz / d) * out;
      }
    }

    // ground
    const step = wasGrounded ? 0.75 : 0.35;
    // swept test: measure from where the step started so a fast fall can't pass through the ground
    const gh = world.groundHeight(this.pos.x, this.pos.z, Math.max(y0, this.pos.y) + step);
    if (gh > -Infinity && this.vel.y <= 0 && (this.pos.y <= gh || (wasGrounded && this.pos.y - gh < 0.8))) {
      if (!wasGrounded) {
        if (this.vel.y < -6) ev.push('land');
        this.sqV = -3.6 * clamp(-this.vel.y / 14, 0.25, 1);
      }
      this.pos.y = gh; this.vel.y = 0; this.grounded = true; this.jumps = 0; this.airTime = 0; this.gliding = false;
    } else {
      this.grounded = false; this.airTime += dt;
    }
    if (this.grounded) {
      const hs = Math.hypot(this.vel.x, this.vel.z);
      const s = wasGrounded && hs > 1 ? (this.pos.y - y0) / (hs * dt) : 0;
      this.slope += (s - this.slope) * (1 - Math.exp(-6 * dt));
      const isl = world.islandAt(this.pos.x, this.pos.z);
      if (isl) {
        // remember a safe spot a little inside the island
        const dx = this.pos.x - isl.x, dz = this.pos.z - isl.z, d = Math.hypot(dx, dz) || 1;
        const q = Math.min(1, (isl.r * 0.72) / d);
        this.safe.set(isl.x + dx * q, 0, isl.z + dz * q);
        this.safe.y = world.groundHeight(this.safe.x, this.safe.z, 1e9);
        this.lastIsland = isl.index;
      }
    }

    // step into a wind current: at its mouth from the ground, or anywhere along it from the air
    if (this.rideCd <= 0) {
      const cx = this.pos.x, cy = this.pos.y + 0.9, cz = this.pos.z;
      const near = (p, r) => (p.x - cx) ** 2 + (p.y - cy) ** 2 + (p.z - cz) ** 2 < r * r;
      for (const w of world.winds) {
        let hit = -1;
        if (near(w.pts[0], 2.5) || near(w.pts[1], 2.2)) hit = 0;
        else if (!this.grounded) for (let i = 2; i < w.n - 8; i += 2) if (near(w.pts[i], 2.7)) { hit = i; break; }
        if (hit >= 0) { this.ride = { wind: w, s: hit }; this.grounded = false; ev.push('wind'); break; }
      }
    }

    this.animate(dt, t);
    return ev;
  }

  animate(dt, t) {
    const m = this.model;
    const hs = Math.hypot(this.vel.x, this.vel.z), f = clamp(hs / 8.6, 0, 1.4);
    this.walk += hs * dt * 1.25;
    this.group.rotation.y = this.heading;
    let dh = this.heading - this.prevH; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); this.prevH = this.heading;
    this.turn += (dh / Math.max(dt, 1e-3) - this.turn) * (1 - Math.exp(-8 * dt));
    this.sqV += (-this.sq * 190 - this.sqV * 15) * dt; this.sq = clamp(this.sq + this.sqV * dt, -0.3, 0.3);
    const sn = Math.sin(this.walk), cs = Math.cos(this.walk);
    const ease = 1 - Math.exp(-12 * dt);

    // ---- the pose: thigh and knee for each leg, shoulder and elbow for each arm.
    // Index 0 is the painter's right side, 1 the left. Thighs and upper arms: negative swings forward.
    // Knees bend with positive angles, elbows with negative ones.
    let th0, th1, kn0, kn1, a0, a1, e0, e1, armZ = 0.1, lean, bob = 0, spread = 0, headX = 0;
    if (this.seat) {
      // seated properly: thighs level, shins down, one hand on a knee and the other working at the easel
      const paint = this.seat.painting;
      th0 = -1.5; th1 = -1.42; kn0 = 1.5; kn1 = 1.36;
      a0 = paint ? -0.95 + Math.sin(t * 2.7) * 0.16 : -0.42; e0 = paint ? -0.75 + Math.sin(t * 3.9 + 1) * 0.3 : -1.0;
      a1 = -0.42; e1 = -1.0;
      armZ = 0.12; lean = 0.08; bob = -0.37 + Math.sin(t * 1.5) * 0.012; headX = paint ? 0.02 : -0.1;
    } else if (this.gliding) {
      // arms wide, legs trailing, the whole body laid forward on the air
      th0 = 0.3; th1 = 0.5; kn0 = 0.55; kn1 = 0.25; a0 = a1 = 0.15; e0 = e1 = -0.12; armZ = 1.4; lean = 0.6; spread = 1; headX = -0.4;
    } else if (this.surfing) {
      // a skater's crouch: one foot leading, knees bent, arms out for balance
      th0 = 0.2; th1 = -0.8; kn0 = 0.8; kn1 = 1.0; a0 = 0.35; a1 = -0.2; e0 = -0.3; e1 = -0.55; armZ = 0.85; lean = 0.34;
      bob = -0.11 + Math.sin(t * 9) * 0.015; spread = 0.35; headX = -0.22;
    } else if (this.grounded) {
      // walking and running: the knee folds as each leg swings through, elbows stay bent and pump with speed
      const A = 0.85 * f;
      th0 = sn * A; th1 = -sn * A;
      kn0 = 0.04 + (0.14 + 1.0 * Math.max(0, -cs)) * f; kn1 = 0.04 + (0.14 + 1.0 * Math.max(0, cs)) * f;
      a0 = -sn * 0.62 * f; a1 = sn * 0.62 * f;
      e0 = -0.22 - 0.6 * f - 0.3 * f * Math.max(0, sn); e1 = -0.22 - 0.6 * f - 0.3 * f * Math.max(0, -sn);
      lean = f * 0.15;
      bob = Math.abs(cs) * 0.06 * f + Math.sin(t * 1.8) * 0.012;
      const n = Math.floor(this.walk / Math.PI);
      if (n !== this.stepN && f > 0.35) this.events.push('step');
      this.stepN = n;
    } else if (this.vel.y > 1) {
      // rising: one knee drawn up, arms lifted
      th0 = 0.25; th1 = -0.95; kn0 = 0.75; kn1 = 1.3; a0 = a1 = -0.5; e0 = e1 = -0.5; armZ = 0.55; lean = 0.08;
    } else {
      // falling: legs loose, arms out
      th0 = 0.3; th1 = -0.4; kn0 = 0.45; kn1 = 0.7; a0 = a1 = -0.15; e0 = e1 = -0.3; armZ = 1.0; lean = 0.12; spread = 0.3; headX = 0.1;
    }
    const lerpTo = (obj, key, v) => { obj[key] += (v - obj[key]) * ease; };
    lerpTo(m.legs[0].rotation, 'x', th0); lerpTo(m.legs[1].rotation, 'x', th1);
    lerpTo(m.knees[0].rotation, 'x', kn0); lerpTo(m.knees[1].rotation, 'x', kn1);
    lerpTo(m.arms[0].rotation, 'x', a0); lerpTo(m.arms[0].rotation, 'z', -armZ); lerpTo(m.elbows[0].rotation, 'x', e0);
    lerpTo(m.body.rotation, 'x', lean);
    const flowing = (this.surfing || this.gliding) && !this.lift;
    lerpTo(m.body.rotation, 'z', flowing ? clamp(-this.turn * 0.1, -0.42, 0.42) : clamp(-this.turn * 0.02, -0.08, 0.08));
    m.body.position.y += (bob - m.body.position.y) * (1 - Math.exp(-(this.seat || m.body.position.y < -0.15 ? 6 : 40) * dt));
    m.body.scale.set(1 - this.sq * 0.5, 1 + this.sq, 1 - this.sq * 0.5);
    // the poncho lifts off the shoulders as the arms go out
    const cloakS = 1 + spread * 0.3 + f * 0.03;
    lerpTo(m.cloak.scale, 'x', cloakS); lerpTo(m.cloak.scale, 'z', cloakS);
    lerpTo(m.head.rotation, 'x', headX);
    lerpTo(m.head.rotation, 'y', Math.sin(t * 0.6) * 0.12 + (this.lift ? 0 : clamp(this.turn * 0.1, -0.5, 0.5)));

    // blinking; eyes half closed when simply sitting and looking
    this.blink -= dt;
    if (this.blink < -0.13) this.blink = 2 + Math.random() * 4;
    const lid = this.blink < 0 ? 0.1 : this.seat && !this.seat.painting ? 0.62 : 1;
    for (const eye of m.eyes) eye.scale.y += (lid - eye.scale.y) * (1 - Math.exp(-30 * dt));

    // brush swing overrides the left arm
    if (this.swingT >= 0) {
      this.swingT += dt;
      const u = clamp(this.swingT / 0.32, 0, 1), e = 1 - (1 - u) * (1 - u);
      m.handBrush.visible = true; m.backBrush.visible = false; m.easelBrush.visible = false;
      const q = 1 - Math.exp(-45 * dt), r = m.arms[1].rotation;
      r.x += (-1.5 - r.x) * q; r.z += (1.5 - e * 3.0 - r.z) * q;
      m.elbows[1].rotation.x += (-0.12 - m.elbows[1].rotation.x) * q;
      m.body.rotation.y += (0.5 - e * 1.0 - m.body.rotation.y) * q;
      if (this.swingT > 0.36) { this.swingT = -1; m.handBrush.visible = false; m.backBrush.visible = true; }
    } else {
      lerpTo(m.arms[1].rotation, 'x', a1); lerpTo(m.arms[1].rotation, 'z', armZ); lerpTo(m.elbows[1].rotation, 'x', e1);
      // at an easel a small brush is in the working hand; otherwise the big one rides on the back
      m.easelBrush.visible = !!(this.seat && this.seat.painting);
      m.handBrush.visible = false; m.backBrush.visible = true;
      lerpTo(m.body.rotation, 'y', 0);
    }
    this.group.updateMatrixWorld(true);

    // ---- the cape: sewn to the poncho's rim, pushed about by the body, the knees and the heels
    const sx = m.cloak.scale.x, bw = m.body.matrixWorld;
    m.capePins.forEach((p, i) => this._pins[i].set(p.x * sx, p.y, p.z * sx).applyMatrix4(bw));
    this._capsule.a.set(0, 0.5, 0).applyMatrix4(bw); this._capsule.b.set(0, 1.12, 0).applyMatrix4(bw);
    m.knees[0].getWorldPosition(this._spheres[0].c); m.knees[1].getWorldPosition(this._spheres[1].c);
    m.feet[0].getWorldPosition(this._spheres[2].c); m.feet[1].getWorldPosition(this._spheres[3].c);
    this._wind.set(0.5 + Math.sin(t * 0.6) * 0.45, Math.sin(t * 1.1) * 0.12, Math.sin(t * 0.43 + 1) * 0.3);       // a light, wandering breeze
    this.cape.update(dt, this._pins, this._capsule, this._spheres, this._wind, this.grounded ? this.pos.y + 0.04 : -Infinity);

    const stream = this.gliding ? 1 : this.surfing ? 0.5 : 0;
    this.ribbons.forEach((r, i) => {
      this._anchor.set(i ? 0.07 : -0.07, 0.2, -0.2).applyMatrix4(m.head.matrixWorld);
      r.update(this._anchor, t, dt, stream);
    });
  }
}
