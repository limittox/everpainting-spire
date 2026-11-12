import * as THREE from 'three';
import { PAL, daub, place, Bag, paintify, glowSprite, mulberry32 } from './util.js';
import { PAINTS } from './paint.js';

// The big sights get an answer.
//   The sleeping muse   stirs each time a spark is found, opens her eyes when the last stroke is laid, and from
//                       then on watches the painter wherever they go.
//   The paint sea       has fish in it: great daubs of colour that leap clear of the clouds, more often when the
//                       painter is out over the open air.
//   Paper birds         sit about the islands in little flocks, scatter when the painter comes near, wheel overhead
//                       and settle again somewhere else.
//   The great brush     can be reached: once the door of the Spire is open, a wind leaves the crow's nest for a deck
//                       built round the brush's handle. A hair of the brush is kept there, and it lends the painter
//                       its reach.

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

// ============================================================================================ the muse's eyes
class MuseEyes {
  constructor(muse) {
    this.muse = muse;
    const basic = (hex) => new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide, fog: false });
    const white = basic(0xf2eaf6), iris = basic(0x6a58d8), pupil = basic(0x2a1c4a), lid = basic(0x54387e), glint = basic(0xffffff);
    // the eye sits where her closed lash was drawn: the lash is its lower lid, and the upper one lifts away from it
    const sh = new THREE.Shape();
    sh.moveTo(0.1, 0.676); sh.quadraticCurveTo(0.155, 0.632, 0.22, 0.682); sh.quadraticCurveTo(0.165, 0.742, 0.1, 0.676);
    const scleraGeo = new THREE.ShapeGeometry(sh, 16).translate(0, -0.656, 0);
    const lidGeo = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new V3(0.1, 0.02, 0), new V3(0.165, 0.086, 0), new V3(0.22, 0.026, 0)), 14, 0.0065, 5);
    this.eyes = [];
    for (const side of [1, -1]) {
      const g = new THREE.Group(), e = 0.0016 * side;
      g.position.set(0, 0.656, side * 0.309);
      const ball = new THREE.Group();             // the iris, pupil and glint move together as she looks about
      const i = new THREE.Mesh(new THREE.CircleGeometry(0.0215, 20), iris); i.position.z = e;
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.011, 16), pupil); p.position.z = e * 2;
      const s = new THREE.Mesh(new THREE.CircleGeometry(0.0052, 10), glint); s.position.set(0.007, 0.008, e * 3);
      ball.add(i, p, s); ball.position.set(0.163, 0.027, 0);
      g.add(new THREE.Mesh(scleraGeo, white), ball, new THREE.Mesh(lidGeo, lid));
      g.scale.y = 0.02;
      muse.add(g);
      this.eyes.push({ g, ball });
    }
    this.open = 0;            // how far open they are now
    this.want = 0;            // how far open they should be
    this.awake = false; this.risen = false;
    this.stirT = 0; this.blink = 6; this.look = new THREE.Vector2();
    this._p = new V3();
  }
  /** A spark was found: her eyes flutter, as if at a dream. */
  stir() { if (!this.awake) this.stirT = 1.6; }
  /** The last stroke is laid. */
  wake(now = false) { this.awake = true; if (now) { this.open = 1; this.risen = true; } }

  update(dt, t, playerPos) {
    if (this.awake) {
      this.blink -= dt;
      if (this.blink < -0.16) this.blink = 5 + Math.random() * 6;
      this.want = this.blink < 0 ? 0.04 : 1;
    } else {
      this.stirT = Math.max(0, this.stirT - dt);
      this.want = this.stirT > 0 ? 0.2 + Math.sin(this.stirT * 9) * 0.1 : 0;
    }
    // waking is slow, the first time; a blink is quick
    if (this.awake && this.open > 0.93) this.risen = true;
    this.open += (this.want - this.open) * ease(this.awake && !this.risen ? 0.8 : 9, dt);
    // she looks at the painter: the iris slides toward wherever they are, within the eye
    if (playerPos && this.open > 0.05) {
      const p = this.muse.worldToLocal(this._p.copy(playerPos)), dx = p.x - 0.163, dy = p.y - 0.683, d = Math.hypot(dx, dy) || 1;
      this.look.x += ((dx / d) * 0.021 - this.look.x) * ease(2.5, dt);
      this.look.y += ((dy / d) * 0.009 - this.look.y) * ease(2.5, dt);
    }
    for (const e of this.eyes) {
      e.g.scale.y = Math.max(0.02, this.open);
      e.g.visible = this.open > 0.025;
      e.ball.position.set(0.163 + this.look.x, 0.027 + this.look.y, 0);
    }
  }
}

// ============================================================================================ fish of paint
const SEA_Y = -78;
class SeaLife {
  constructor(scene, world) {
    this.world = world;
    const r = (this.rnd = mulberry32(6021));
    const mat = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x3a2c30 }), { scale: 2 });
    const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const ringGeo = new THREE.RingGeometry(0.82, 1, 28).rotateX(-Math.PI / 2);
    this.fish = [];
    for (let k = 0; k < 8; k++) {
      const col = new THREE.Color(PAINTS[k % 8].hex), tones = [0, 0.1, -0.1, 0.18].map((l) => '#' + col.clone().offsetHSL(0, 0, l).getHexString());
      const bag = new Bag();
      // nose toward +z: a long body, a forked tail, a fin on the back and one each side
      bag.add(daub(place(new THREE.IcosahedronGeometry(1, 2), 0, 0, 0, 0, 0, 0, 0.5, 0.95, 2.6), tones, { scale: 0.6, spread: 1 }));
      for (const s of [-1, 1]) bag.add(daub(place(new THREE.ConeGeometry(0.7, 1.9, 4), 0, s * 0.55, -3.0, s * 0.95 + Math.PI / 2, 0, 0, 0.25, 1, 1), tones, { spread: 1 }));
      bag.add(daub(place(new THREE.ConeGeometry(0.5, 1.3, 4), 0, 1.15, 0.2, -0.5, 0, 0, 0.22, 1, 1), tones, { spread: 1 }));
      for (const s of [-1, 1]) bag.add(daub(place(new THREE.ConeGeometry(0.4, 1.2, 4), s * 0.6, -0.25, 0.8, 0, 0, s * -1.9, 1, 1, 0.25), ['#fff6e2', '#ffffff'], {}));
      const mesh = bag.mesh(mat);
      mesh.visible = false; mesh.frustumCulled = false;
      const rings = [new THREE.Mesh(ringGeo, ringMat()), new THREE.Mesh(ringGeo, ringMat())];
      rings.forEach((m) => { m.visible = false; });
      scene.add(mesh, ...rings);
      this.fish.push({ mesh, rings, ringT: [9, 9], on: false, p: new V3(), v: new V3(), size: 2.6 + r() * 1.0, roll: 0 });
    }
    this.timer = 3;
    this._l = new V3();
  }

  /** Somewhere on the open sea, not under an island. */
  free(x, z) {
    const w = this.world;
    if (Math.hypot(x - 70, z + 190) > 380) return false;
    for (const isl of w.islands) if (Math.hypot(isl.x - x, isl.z - z) < isl.r + 9) return false;
    for (const il of w.islets) if (Math.hypot(il.x - x, il.z - z) < il.r + 7) return false;
    return true;
  }

  leap(player) {
    const f = this.fish.find((q) => !q.on && q.ringT[1] > 2);
    if (!f) return;
    const r = this.rnd, p = player.pos;
    for (let tries = 0; tries < 12; tries++) {
      // somewhere the painter can see: ahead of them and off to one side
      const a = player.heading + (r() - 0.5) * 2.4, d = 28 + r() * 46, x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
      const dir = r() * TAU, sp = 9 + r() * 6, up = 44 + r() * 9, air = (2 * up) / 21;
      if (!this.free(x, z) || !this.free(x + Math.sin(dir) * sp * air, z + Math.cos(dir) * sp * air) || !this.free(x + Math.sin(dir) * sp * air * 0.5, z + Math.cos(dir) * sp * air * 0.5)) continue;
      f.on = true; f.p.set(x, SEA_Y - 2, z); f.v.set(Math.sin(dir) * sp, up, Math.cos(dir) * sp);
      f.mesh.visible = true; f.mesh.scale.setScalar(f.size); f.roll = (r() - 0.5) * 0.8;
      this.ripple(f, 0);
      return;
    }
  }
  ripple(f, i) { const m = f.rings[i]; m.position.set(f.p.x, SEA_Y + 0.6, f.p.z); m.visible = true; f.ringT[i] = 0; }

  update(dt, t, player) {
    if (player) {
      // fish leap now and then; out over open air (on a bridge, gliding, riding the wind) there is always one about
      const open = !this.world.islandAt(player.pos.x, player.pos.z) && player.pos.y < 140;
      this.timer -= dt * (open ? 3.2 : 1);
      if (this.timer <= 0) { this.timer = 4 + this.rnd() * 4.5; this.leap(player); }
    }
    for (const f of this.fish) {
      for (let i = 0; i < 2; i++) {
        if (f.ringT[i] > 2) { f.rings[i].visible = false; continue; }
        f.ringT[i] += dt;
        const u = f.ringT[i] / 2;
        f.rings[i].scale.setScalar(3 + u * 15); f.rings[i].material.opacity = 0.75 * (1 - u) * (1 - u);
      }
      if (!f.on) continue;
      f.v.y -= 21 * dt;
      f.p.addScaledVector(f.v, dt);
      f.mesh.position.copy(f.p);
      f.mesh.lookAt(this._l.copy(f.p).add(f.v));
      f.mesh.rotateZ(f.roll + Math.sin(t * 7 + f.size * 9) * 0.18);          // a wriggle
      if (f.v.y < 0 && f.p.y < SEA_Y - 3) { f.on = false; f.mesh.visible = false; this.ripple(f, 1); }
    }
  }
}

// ============================================================================================ paper birds
const FLOCKS = [
  { i: 0, a: [-3, 9], b: [12, -3] }, { i: 0, a: [-14, 2], b: [3, -16] },
  { i: 2, a: [3, 4], b: [-10, -9] }, { i: 4, a: [10, 30], b: [-22, 14] }, { i: 4, a: [24, 12], b: [-8, 33] },
];
const PER_FLOCK = 6;

class Birds {
  constructor(scene, world, keepClear) {
    this.world = world;
    const r = (this.rnd = mulberry32(7741));
    const paper = new THREE.MeshLambertMaterial({ color: 0xfff6ea, side: THREE.DoubleSide, flatShading: true, emissive: 0x3a3440 });
    // folded from one sheet: a body with a pointed head and tail, and two wings hinged along its back
    const body = new THREE.BufferGeometry();
    body.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.34, 0.07, 0.03, -0.05, 0, 0.13, -0.05, 0, 0, 0.34, 0, 0.13, -0.05, -0.07, 0.03, -0.05, 0.07, 0.03, -0.05, 0, 0.06, -0.36, 0, 0.13, -0.05, -0.07, 0.03, -0.05, 0, 0.13, -0.05, 0, 0.06, -0.36], 3));
    body.computeVertexNormals();
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.16, 0.5, 0, -0.02, 0, 0, -0.2], 3));
    wing.computeVertexNormals();
    const taken = keepClear.slice();
    this.flocks = [];
    for (const def of FLOCKS) {
      const isl = world.islands[def.i];
      const a = this.settle(isl, def.a, taken), b = this.settle(isl, def.b, taken);
      if (!a || !b) continue;
      const flock = { perches: [a, b], at: 0, state: 'perched', t: 0, loiter: 0, birds: [] };
      for (let k = 0; k < PER_FLOCK; k++) {
        const g = new THREE.Group(), wl = new THREE.Mesh(wing, paper), wr = new THREE.Mesh(wing, paper);
        wr.scale.x = -1; wl.position.y = wr.position.y = 0.11;
        g.add(new THREE.Mesh(body, paper), wl, wr);
        g.scale.setScalar(1.9 + r() * 0.7);
        scene.add(g);
        const ang = r() * TAU, d = 0.5 + r() * 1.6;
        const bird = { g, wl, wr, off: new V3(Math.cos(ang) * d, 0, Math.sin(ang) * d), p: new V3(), v: new V3(), yaw: r() * TAU, ph: r() * TAU, delay: 0, flying: false, orbit: 5.5 + r() * 4, height: 5.5 + r() * 4, speed: 0.7 + r() * 0.5, peck: r() * 9 };
        this.seat(bird, a);
        flock.birds.push(bird);
      }
      this.flocks.push(flock);
    }
    this.events = [];
    this._t = new V3();
  }

  settle(isl, [ox, oz], taken) {
    const w = this.world, x0 = isl.x + ox, z0 = isl.z + oz;
    for (const ring of [0, 2, 4, 6, 8]) for (let k = 0; k < (ring ? 10 : 1); k++) {
      const a = (k / 10) * TAU, x = x0 + Math.cos(a) * ring, z = z0 + Math.sin(a) * ring;
      if (w.islandAt(x, z) !== isl || w.islandAt(x + (x - isl.x) * 0.14, z + (z - isl.z) * 0.14) !== isl) continue;
      if (w.colliders.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + 2.6) ** 2)) continue;
      if (taken.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + 1) ** 2)) continue;
      taken.push({ x, z, r: 4 });
      return new V3(x, w.groundHeight(x, z, 1e9), z);
    }
    return null;
  }
  /** Put a bird down on the ground at its place in the flock. */
  seat(b, perch) {
    const x = perch.x + b.off.x, z = perch.z + b.off.z, y = this.world.groundHeight(x, z, perch.y + 3);
    b.p.set(x, (y > -Infinity ? y : perch.y) + 0.02, z);
    b.g.position.copy(b.p); b.flying = false; b.v.set(0, 0, 0);
  }

  /** Something sudden nearby (a swing of the brush): any flock within `reach` takes off. */
  startle(x, z, y, reach) {
    for (const f of this.flocks) {
      const p = f.perches[f.at];
      if (f.state === 'perched' && (p.x - x) ** 2 + (p.z - z) ** 2 < reach * reach && Math.abs(p.y - y) < 4) this.scatter(f);
    }
  }
  scatter(f) {
    f.state = 'aloft'; f.t = 0; f.loiter = 5 + this.rnd() * 3.5;
    f.birds.forEach((b) => { b.delay = this.rnd() * 0.45; b.flying = true; });
    this.events.push({ type: 'flock', at: f.perches[f.at] });
  }

  update(dt, t, player) {
    const ev = this.events.splice(0), out = this.out || (this.out = []);
    out.length = 0; for (const e of ev) out.push(e);
    for (const f of this.flocks) {
      const perch = f.perches[f.at];
      if (player && f.state === 'perched' && (perch.x - player.pos.x) ** 2 + (perch.z - player.pos.z) ** 2 < 4.4 * 4.4 && Math.abs(perch.y - player.pos.y) < 3.5) {
        this.scatter(f);
        out.push(this.events.pop());
      }
      f.t += dt;
      if (f.state === 'aloft' && f.t > f.loiter) {
        // time to come down: on the other perch, unless the painter is standing on it
        const other = 1 - f.at, o = f.perches[other];
        f.at = player && (o.x - player.pos.x) ** 2 + (o.z - player.pos.z) ** 2 < 49 ? f.at : other;
        f.state = 'landing'; f.t = 0;
      }
      const home = f.perches[f.at];
      let down = 0;
      for (const b of f.birds) {
        if (!b.flying) {
          down++;
          // on the ground: wings folded up over its back, and now and then it dips its head
          const peck = Math.max(0, Math.sin(t * 0.9 + b.peck)) ** 14;
          b.g.rotation.set(peck * 0.9, b.yaw, 0);
          b.wl.rotation.z = 1.25; b.wr.rotation.z = -1.25;
          continue;
        }
        if (b.delay > 0) { b.delay -= dt; continue; }
        const tgt = this._t;
        if (f.state === 'landing') tgt.set(home.x + b.off.x, home.y + 0.02, home.z + b.off.z);
        else { const a = t * b.speed + b.ph; tgt.set(perch.x + Math.cos(a) * b.orbit, perch.y + b.height + Math.sin(t * 0.8 + b.ph) * 1.2, perch.z + Math.sin(a) * b.orbit); }
        // steer toward wherever it is meant to be, never faster than a bird can fly
        const dx = tgt.x - b.p.x, dy = tgt.y - b.p.y, dz = tgt.z - b.p.z, d = Math.hypot(dx, dy, dz) || 1, sp = Math.min(9, d * 2.4 + 1.2);
        const k = ease(3.2, dt);
        b.v.x += ((dx / d) * sp - b.v.x) * k; b.v.y += ((dy / d) * sp - b.v.y) * k; b.v.z += ((dz / d) * sp - b.v.z) * k;
        b.p.addScaledVector(b.v, dt);
        if (f.state === 'landing' && d < 0.35) { b.yaw = Math.atan2(b.v.x, b.v.z); this.seat(b, home); continue; }
        b.g.position.copy(b.p);
        const yaw = Math.atan2(b.v.x, b.v.z), flap = Math.sin(t * 15 + b.ph) * 0.85;
        b.g.rotation.set(-Math.atan2(b.v.y, Math.hypot(b.v.x, b.v.z) + 0.01) * 0.6, yaw, 0);
        b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
      }
      if (f.state === 'landing' && down === f.birds.length) f.state = 'perched';
    }
    return out;
  }
}

// ============================================================================================ the perch on the great brush
// (where the brush hangs: world.js builds it at this point, leaning this way)
const BRUSH_AT = new V3(150, 196, -425), BRUSH_AXIS = new V3(0.731, 0.674, 0.102);
const DECK_R = 11, HANDLE_R = 6.5;

class BrushPerch {
  constructor(scene, world, nest) {
    this.world = world;
    const C = (this.center = BRUSH_AT.clone().addScaledVector(BRUSH_AXIS, 46.2));       // a third of the way up the handle
    const wood = ['#6a4038', '#8a5a48', '#52303a', '#a06a3a'], bag = new Bag();
    const strut = (a, b, r) => {
      const d = new V3().subVectors(b, a), g = new THREE.CylinderGeometry(r, r, d.length(), 5);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()));
      g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      return daub(g, wood, { scale: 0.5 });
    };
    // a round deck of planks built about the handle, braced back to it underneath
    bag.add(daub(place(new THREE.CylinderGeometry(DECK_R, DECK_R - 0.8, 0.7, 28), C.x, C.y - 0.35, C.z), wood, { scale: 0.35, stretch: [1, 1, 0.2] }));
    bag.add(daub(place(new THREE.TorusGeometry(DECK_R, 0.2, 5, 40), C.x, C.y + 0.05, C.z, Math.PI / 2, 0, 0), PAL.gold));
    const below = C.clone().addScaledVector(BRUSH_AXIS, -15);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + 0.3, rim = new V3(C.x + Math.cos(a) * (DECK_R - 1), C.y - 0.6, C.z + Math.sin(a) * (DECK_R - 1));
      bag.add(strut(rim, below, 0.2));
      bag.add(daub(place(new THREE.CylinderGeometry(0.1, 0.12, 1.1, 5), C.x + Math.cos(a) * (DECK_R - 0.3), C.y + 0.55, C.z + Math.sin(a) * (DECK_R - 0.3)), wood));
    }
    // tins of paint left up here by whoever used the brush last
    for (const [a, r, s, k] of [[2.0, 8.9, 1.3, 1], [2.42, 9.2, 0.9, 5], [4.5, 8.9, 1.1, 2]]) {
      const x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r, col = new THREE.Color(PAINTS[k].hex), tones = [0, 0.1, -0.1].map((l) => '#' + col.clone().offsetHSL(0, 0, l).getHexString());
      bag.add(daub(place(new THREE.CylinderGeometry(0.8 * s, 0.8 * s, 1.5 * s, 10), x, C.y + 0.75 * s, z), PAL.stone, { scale: 0.6 }));
      bag.add(daub(place(new THREE.CylinderGeometry(0.72 * s, 0.72 * s, 0.1, 10), x, C.y + 1.52 * s, z), tones, { spread: 1 }));
      world.colliders.push({ x, z, r: 0.85 * s, late: true });
    }
    const mesh = bag.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x3a2c30 }), { scale: 1.4 }));
    mesh.frustumCulled = false;
    scene.add(mesh);
    world.paintable.push(mesh);
    // the handle itself, where it passes through; and the side it leans out over, where there is no headroom
    world.colliders.push({ x: C.x, z: C.z, r: HANDLE_R, late: true }, { x: C.x + 5.6, z: C.z, r: 6.9, late: true });

    const base = world.groundHeight, r2 = (DECK_R + 0.1) ** 2;
    world.groundHeight = (x, z, maxY) => {
      const best = base(x, z, maxY);
      return maxY >= C.y && (x - C.x) ** 2 + (z - C.z) ** 2 < r2 && C.y > best ? C.y : best;
    };

    // the wind from the crow's nest, up through the sky to the deck
    const mouth = new V3(nest.x + 4.4, nest.y + 1.7, nest.z - 3.5);
    this.wind = world.makeWind([mouth, new V3(40, 100, -335), new V3(95, 160, -385), new V3(142, 208, -414), new V3(C.x - 8.4, C.y + 4.5, C.z)]);

    // a single hair of the great brush, stood in a ring of gold: it lends the painter its reach
    // (on the open side of the deck, away from the handle's lean)
    this.hairAt = new V3(C.x - 5.4, C.y, C.z - 6.9);
    this.hair = new THREE.Group();
    const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2a0).multiplyScalar(1.7), fog: false });
    const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.1, 3.2, 5), hot); strand.position.y = 1.9;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 5, 24).rotateX(Math.PI / 2), hot); ring.position.y = 0.2;
    this.glow = glowSprite(world.glowTex, 6, 0xffe2a8, 0.8); this.glow.position.y = 2;
    this.hair.add(strand, ring, this.glow);
    this.hair.position.copy(this.hairAt);
    scene.add(this.hair);
    this.taken = false;
  }

  /** True on the frame the painter reaches the hair. */
  reach(p) {
    if (this.taken || Math.abs(p.y - this.hairAt.y) > 3 || (p.x - this.hairAt.x) ** 2 + (p.z - this.hairAt.z) ** 2 > 4.4) return false;
    this.take();
    return true;
  }
  take() { this.taken = true; this.hair.visible = false; }

  update(t) {
    if (this.taken) return;
    this.hair.rotation.y = t * 0.5;
    this.hair.position.y = this.hairAt.y + Math.sin(t * 1.3) * 0.12;
    this.glow.material.opacity = 0.7 + Math.sin(t * 2.1) * 0.12;
  }
}

// ============================================================================================ all of them
export class Sights {
  /** `nest` is the middle of the crow's nest deck ({ x, y, z }); `keepClear` a list of { x, z, r } already spoken for. */
  constructor(scene, world, nest, keepClear = []) {
    this.muse = new MuseEyes(world.muse);
    this.sea = new SeaLife(scene, world);
    this.birds = new Birds(scene, world, keepClear);
    this.brush = new BrushPerch(scene, world, nest);
  }
  /** Advance everything. Returns this frame's events (a flock taking off). */
  update(dt, t, player) {
    this.muse.update(dt, t, player ? player.pos : null);
    this.sea.update(dt, t, player);
    this.brush.update(t);
    return this.birds.update(dt, t, player);
  }
}
