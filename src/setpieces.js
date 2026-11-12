import * as THREE from 'three';
import { rimR, surfY, waterfallMesh } from './world.js';
import { canvasMaterial, VIEW_W, VIEW_H } from './vista.js';
import { PAL, daub, place, Bag, paintify, glowSprite, mulberry32 } from './util.js';

// One moment for each of the islands in the middle of the journey, and each of them keeps a spark:
//   Maple Step       fallen leaves that scatter and swirl when the painter runs, skates or swings through them.
//                    The spark lies under a heap of them.
//   Weeping Palette  springs of paint that feed the island's falls. Paint a spring and its fall runs that colour.
//                    The spark is caught in the first spring.
//   Last Easel       a great canvas standing off the island that paints itself a picture of the whole world, as it
//                    is now, with everything the painter has done to it. The spark comes when the picture is finished.

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);

// ============================================================================================ leaves
const LEAF_COUNT = 440, HEAP = 120;
const LEAF_COLORS = [...PAL.maple, '#ffc94a', '#ffdf8a', '#e8342a', '#ff7a2e'];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3(), _s = new V3(), _c = new THREE.Color();

function leafGeo() {
  const pts = [[0, 0.5], [0.18, 0.2], [0.5, 0.22], [0.3, -0.05], [0.38, -0.4], [0, -0.22], [-0.38, -0.4], [-0.3, -0.05], [-0.5, 0.22], [-0.18, 0.2]];
  const sh = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  return new THREE.ShapeGeometry(sh).scale(0.5, 0.5, 0.5);
}

class Leaves {
  constructor(scene, world, isl, heapAt) {
    this.world = world; this.isl = isl; this.heapAt = heapAt;
    const r = (this.rnd = mulberry32(5150));
    const n = LEAF_COUNT;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.rot = new Float32Array(n * 3); this.spin = new Float32Array(n * 2);
    this.air = new Uint8Array(n); this.size = new Float32Array(n); this.ph = new Float32Array(n);
    this.inHeap = new Uint8Array(n); this.heapLeft = 0; this.uncovered = false;
    this.mesh = new THREE.InstancedMesh(leafGeo(), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), n);
    this.mesh.frustumCulled = false;
    this.trees = world.trees.filter((t) => Math.hypot(t.x - isl.x, t.z - isl.z) < isl.r);
    for (let i = 0; i < n; i++) {
      this.size[i] = 0.75 + r() * 0.6; this.ph[i] = r() * TAU;
      let x, z, y;
      if (i < HEAP) {
        // the heap over the spark: a low mound, leaves at every angle
        const a = r() * TAU, d = Math.sqrt(r()) * 1.55;
        x = heapAt.x + Math.cos(a) * d; z = heapAt.z + Math.sin(a) * d;
        y = world.groundHeight(x, z, 1e9) + 0.06 + (1 - d / 1.55) * 0.95 * r();
        this.rot[i * 3] = -Math.PI / 2 + (r() - 0.5) * 1.5;
        this.inHeap[i] = 1; this.heapLeft++;
      } else {
        let tries = 0;
        do {
          const a = r() * TAU, d = Math.sqrt(r()) * isl.r * 0.9;
          x = isl.x + Math.cos(a) * d; z = isl.z + Math.sin(a) * d;
        } while (tries++ < 20 && (world.islandAt(x, z) !== isl || Math.hypot(x - heapAt.x, z - heapAt.z) < 2.4));
        y = world.groundHeight(x, z, 1e9) + 0.05 + (i % 7) * 0.004;
        this.rot[i * 3] = -Math.PI / 2 + (r() - 0.5) * 0.3;
      }
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.rot[i * 3 + 1] = r() * TAU; this.rot[i * 3 + 2] = (r() - 0.5) * 0.3;
      this.mesh.setColorAt(i, _c.set(LEAF_COLORS[Math.floor(r() * LEAF_COLORS.length)]));
      this.place(i);
    }
    this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
    this.fallT = 1; this.rustleT = 0; this.events = [];
  }

  place(i) {
    _q.setFromEuler(_e.set(this.rot[i * 3], this.rot[i * 3 + 1], this.rot[i * 3 + 2], 'YXZ'));
    this.mesh.setMatrixAt(i, _m.compose(_p.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]), _q, _s.setScalar(this.size[i])));
  }

  /** Send leaf `i` flying, away from (cx, cz), carried along by whatever disturbed it. */
  kick(i, cx, cz, vx, vz, power) {
    const r = this.rnd, k = i * 3, dx = this.pos[k] - cx, dz = this.pos[k + 2] - cz, d = Math.hypot(dx, dz) || 1;
    const out = (1.4 + r() * 2.6) * power, swirl = (r() - 0.35) * 3.2 * power;
    this.vel[k] = vx * 0.42 + (dx / d) * out - (dz / d) * swirl;
    this.vel[k + 1] = (2.6 + r() * 3.8) * power;
    this.vel[k + 2] = vz * 0.42 + (dz / d) * out + (dx / d) * swirl;
    this.spin[i * 2] = (r() - 0.5) * 12; this.spin[i * 2 + 1] = (r() - 0.5) * 9;
    this.air[i] = 1;
    if (this.inHeap[i]) { this.inHeap[i] = 0; this.heapLeft--; }
  }

  /** A swing of the brush, or anything else sudden: every resting leaf within `radius` is thrown outwards. */
  burst(x, z, y, radius, power = 1.3) {
    if (Math.abs(y - this.isl.y) > 6) return 0;
    let n = 0;
    for (let i = 0; i < LEAF_COUNT; i++) {
      if (this.air[i]) continue;
      const dx = this.pos[i * 3] - x, dz = this.pos[i * 3 + 2] - z;
      if (dx * dx + dz * dz < radius * radius) { this.kick(i, x, z, 0, 0, power); n++; }
    }
    return n;
  }

  /** A leaf lets go of a tree and starts down. */
  drop(i) {
    const r = this.rnd, k = i * 3;
    if (!this.trees.length) return;
    const tr = this.trees[Math.floor(r() * this.trees.length)], pf = tr.puffs[Math.floor(r() * tr.puffs.length)];
    const a = r() * TAU, d = r() * pf.R * 0.8;
    this.pos[k] = pf.x + Math.cos(a) * d; this.pos[k + 1] = pf.y - pf.R * pf.sy * 0.7; this.pos[k + 2] = pf.z + Math.sin(a) * d;
    this.vel[k] = (r() - 0.5) * 1.4; this.vel[k + 1] = -0.4; this.vel[k + 2] = (r() - 0.5) * 1.4;
    this.spin[i * 2] = (r() - 0.5) * 5; this.spin[i * 2 + 1] = (r() - 0.5) * 4;
    this.air[i] = 1;
    if (this.inHeap[i]) { this.inHeap[i] = 0; this.heapLeft--; }
  }

  update(dt, t, player) {
    const ev = this.events; ev.length = 0;
    const isl = this.isl, w = this.world, r = this.rnd;
    if (!player || Math.hypot(player.pos.x - isl.x, player.pos.z - isl.z) > isl.r + 55) return ev;
    let moved = false, kicked = 0;

    // the painter wades through: whatever lies underfoot is thrown up and carried along
    const sp = Math.hypot(player.vel.x, player.vel.z);
    if (sp > 2.2 && Math.abs(player.pos.y - isl.y) < 3.5) {
      const reach = sp > 11 ? 2.7 : 2.0, power = 0.75 + Math.min(1, sp / 14) * 0.75;
      for (let i = 0; i < LEAF_COUNT; i++) {
        if (this.air[i]) continue;
        const dx = this.pos[i * 3] - player.pos.x, dz = this.pos[i * 3 + 2] - player.pos.z;
        if (dx * dx + dz * dz < reach * reach) { this.kick(i, player.pos.x, player.pos.z, player.vel.x, player.vel.z, power); kicked++; }
      }
    }
    this.rustleT -= dt;
    if (kicked > 1 && this.rustleT <= 0) { this.rustleT = 0.16; ev.push({ type: 'rustle' }); }

    // now and then a leaf comes down off a tree by itself (never one from the heap, and never one in view underfoot)
    this.fallT -= dt;
    if (this.fallT <= 0) {
      this.fallT = 0.5 + r() * 0.9;
      const i = HEAP + Math.floor(r() * (LEAF_COUNT - HEAP));
      if (!this.air[i] && Math.hypot(this.pos[i * 3] - player.pos.x, this.pos[i * 3 + 2] - player.pos.z) > 7) this.drop(i);
    }

    for (let i = 0; i < LEAF_COUNT; i++) {
      if (!this.air[i]) continue;
      const k = i * 3, ph = this.ph[i];
      // a leaf falls slowly, sliding from side to side as it turns
      this.vel[k + 1] = Math.max(this.vel[k + 1] - 7 * dt, -2.3);
      const drag = Math.exp(-1.5 * dt);
      this.vel[k] = this.vel[k] * drag + Math.sin(t * 3.1 + ph) * 2.2 * dt + 0.25 * dt;
      this.vel[k + 2] = this.vel[k + 2] * drag + Math.cos(t * 2.6 + ph * 1.3) * 2.2 * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      this.rot[k] += this.spin[i * 2] * dt; this.rot[k + 2] += this.spin[i * 2 + 1] * dt;
      if (this.vel[k + 1] < 0) {
        const g = w.groundHeight(this.pos[k], this.pos[k + 2], this.pos[k + 1] + 0.7);
        if (g > -Infinity && this.pos[k + 1] <= g + 0.06) {
          // down: it lies flat where it landed
          this.pos[k + 1] = g + 0.05 + (i % 7) * 0.004;
          this.rot[k] = -Math.PI / 2 + (r() - 0.5) * 0.3; this.rot[k + 2] = (r() - 0.5) * 0.3;
          this.air[i] = 0;
        } else if (this.pos[k + 1] < isl.y - 16) this.drop(i);          // blown off the island: another takes its place
      }
      this.place(i);
      moved = true;
    }
    if (moved) this.mesh.instanceMatrix.needsUpdate = true;
    if (!this.uncovered && this.heapLeft < HEAP * 0.3) { this.uncovered = true; ev.push({ type: 'heap' }); }
    return ev;
  }
}

// ============================================================================================ springs
const WATER = '#40d8d0';

class Springs {
  constructor(scene, world, uTime, isl, clearance) {
    this.world = world; this.isl = isl; this.list = [];
    const bag = new Bag(), r = mulberry32(2718);
    // the island's own fall, and two more that only run if there is room for a spring at their head
    const falls = [{ mesh: world.falls[0], th0: 0.3, th1: 1.3 }, { mesh: null, th0: 3.5, th1: 4.2 }, { mesh: null, th0: 1.75, th1: 2.3 }];
    const onBridge = (x, z) => world.bridges.some((br) => br.pts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 4.6 * 4.6));
    for (const f of falls) {
      let best = null, bd = -Infinity;
      for (const u of [0.5, 0.35, 0.65, 0.22, 0.78]) {
        const th = f.th0 + (f.th1 - f.th0) * u, rad = rimR(isl, th) - 2.8, x = isl.x + Math.cos(th) * rad, z = isl.z + Math.sin(th) * rad;
        if (world.islandAt(x, z) !== isl || world.nearPath(x, z, 3.4) || onBridge(x, z)) continue;
        const c = clearance(x, z, this.list) - Math.abs(u - 0.5);
        if (c > bd) { bd = c; best = { th, rad, x, z }; }
      }
      if (!best || (bd < 2.4 && f.mesh === null)) continue;
      if (!f.mesh) { f.mesh = waterfallMesh(isl, f.th0, f.th1, 34, uTime); scene.add(f.mesh); }
      const { th, rad, x, z } = best, y = surfY(isl, x, z);
      // a pool, and a short run of water from it to the edge
      const run = rimR(isl, th) - rad - 1.1;
      const geo = new THREE.CircleGeometry(1.55, 22).rotateX(-Math.PI / 2).translate(x, y + 0.2, z);
      const stream = new THREE.PlaneGeometry(0.95, run).rotateX(-Math.PI / 2).rotateY(Math.PI / 2 - th).translate(x + Math.cos(th) * (1.25 + run / 2), y + 0.17, z + Math.sin(th) * (1.25 + run / 2));
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WATER).multiplyScalar(1.1), fog: false, side: THREE.DoubleSide });
      const water = new THREE.Group();
      water.add(new THREE.Mesh(geo, mat), new THREE.Mesh(stream, mat));
      scene.add(water);
      for (let k = 0; k < 11; k++) {
        const a = (k / 11) * TAU + r() * 0.3, s = 0.28 + r() * 0.18;
        if (Math.abs(Math.atan2(Math.sin(a - th), Math.cos(a - th))) < 0.42) continue;          // the gap the water leaves by
        const sx = x + Math.cos(a) * 1.78, sz = z + Math.sin(a) * 1.78;
        bag.add(daub(place(new THREE.IcosahedronGeometry(s, 0), sx, surfY(isl, sx, sz) + s * 0.35, sz, r(), r() * 3, 0, 1, 0.7, 1), PAL.stone, { scale: 0.8 }));
      }
      const glint = glowSprite(world.glowTex, 4.5, 0xdffcff, 0.3); glint.position.set(x, y + 0.9, z); scene.add(glint);
      this.list.push({ index: this.list.length, x, y, z, r: 4.5, top: new V3(x, y + 0.7, z), fall: f.mesh, mat, glint, hex: null, flow: 0 });
    }
    if (bag.list.length) {
      this.stones = bag.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2a2026 }), { scale: 1.2 }));
      scene.add(this.stones);
      world.paintable.push(this.stones);
    }
  }

  /** Give a spring a colour: the pool takes it at once, and it runs down the fall over the next few seconds. */
  paint(s, hex, glow = 1, instant = false) {
    const u = s.fall.material.uniforms, col = new THREE.Color(hex);
    if (s.flow > 0) { u.tintA.value.copy(u.tintB.value); u.amtA.value = 1; }      // interrupted: the last colour counts as arrived
    s.hex = hex;
    s.mat.color.copy(col).multiplyScalar(Math.max(1.12, Math.min(glow, 1.5)));
    u.tintB.value.copy(col).multiplyScalar(Math.min(glow, 1.4));
    if (instant) { u.tintA.value.copy(u.tintB.value); u.amtA.value = 1; u.front.value = 0; s.flow = 0; } else { s.flow = 0.001; u.front.value = 0.001; }
  }

  /** A swing of the brush landing at (x, z), from a painter standing at `p`. Returns the springs it coloured. */
  strike(x, z, p, hex, glow) {
    const out = [];
    for (const s of this.list) {
      if (s.hex === hex || Math.abs(s.y - p.y) > 3) continue;
      if ((s.x - x) ** 2 + (s.z - z) ** 2 < 3.4 * 3.4 || (s.x - p.x) ** 2 + (s.z - p.z) ** 2 < 2.7 * 2.7) { this.paint(s, hex, glow); out.push(s); }
    }
    return out;
  }

  update(dt, t) {
    for (const s of this.list) {
      s.glint.material.opacity = 0.24 + Math.sin(t * 1.4 + s.index * 2) * 0.08;
      if (s.flow <= 0) continue;
      const u = s.fall.material.uniforms;
      s.flow += dt / 2.8; u.front.value = s.flow;
      if (s.flow >= 1) { u.tintA.value.copy(u.tintB.value); u.amtA.value = 1; u.front.value = 0; s.flow = 0; }
    }
  }
}

// ============================================================================================ the great easel
function beam(a, b, r, pal) {
  const d = new V3().subVectors(b, a), g = new THREE.CylinderGeometry(r, r, d.length(), 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return daub(g, pal, { scale: 0.5 });
}

class GreatEasel {
  constructor(scene, world, vistas, isl) {
    this.world = world; this.vistas = vistas; this.isl = isl;
    // it stands on a spur of rock of its own, off the island's rim, facing in
    const th = 1.22, rad = rimR(isl, th) + 9.5, x = isl.x + Math.cos(th) * rad, z = isl.z + Math.sin(th) * rad, y = isl.y - 0.5;
    const g = (this.group = new THREE.Group());
    g.position.set(x, y, z); g.rotation.y = Math.atan2(isl.x - x, isl.z - z);
    const bag = new Bag(), wood = ['#6a4038', '#8a5a48', '#52303a', '#a06a3a'];
    bag.add(daub(place(new THREE.ConeGeometry(4.8, 11, 9, 3), 0, -5.7, 0, Math.PI, 0.3, 0), PAL.rock, { scale: 0.3, stretch: [1, 0.3, 1] }));
    bag.add(daub(place(new THREE.CylinderGeometry(4.8, 4.6, 0.6, 9), 0, -0.1, 0, 0, 0.3, 0), PAL.ground, { scale: 0.4 }));
    bag.add(beam(new V3(-4.4, 0, 1.2), new V3(-1.7, 13.4, -0.5), 0.24, wood), beam(new V3(4.4, 0, 1.2), new V3(1.7, 13.4, -0.5), 0.24, wood));
    bag.add(beam(new V3(0, 0, -3.6), new V3(0, 12.9, -0.6), 0.24, wood));
    bag.add(daub(place(new THREE.BoxGeometry(13.4, 0.42, 1.0), 0, 2.75, 0.75), wood, { scale: 0.5 }), daub(place(new THREE.BoxGeometry(3.2, 0.42, 0.7), 0, 11.6, 0.1), wood, { scale: 0.5 }));
    bag.add(daub(place(new THREE.BoxGeometry(12.7, 8.5, 0.26), 0, 7.2, 0.28, -0.1, 0, 0), ['#f3e2c4', '#ecd8b6', '#fff0d8'], { scale: 0.4 }));
    const mesh = bag.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2a2026 }), { scale: 1.2 }));
    this.mat = canvasMaterial();
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), this.mat);
    canvas.position.set(0, 7.2, 0.45); canvas.rotation.x = -0.1;
    g.add(mesh, canvas);
    scene.add(g);
    g.updateMatrixWorld(true);
    this.center = canvas.getWorldPosition(new V3());
    // what the canvas shows: the whole chain of islands from high in the east, steeply enough to see their painted tops
    this.spot = {
      name: 'The whole painting', eye: new V3(128, 205, -152), target: new V3(-2, 6, -160), easel: g, mat: this.mat, picture: null, done: false, progress: 0,
      rt: new THREE.WebGLRenderTarget(VIEW_W, VIEW_H, { type: THREE.HalfFloatType, depthBuffer: false }),
    };
    this.state = 'idle';       // idle | painting | shown
    this.seen = false;         // the painter has watched it finish before
    this.progress = 0; this.refresh = 0;
    this.events = [];
  }

  update(dt, t, player) {
    const ev = this.events; ev.length = 0;
    if (!player) return ev;
    const p = player.pos, isl = this.isl;
    const here = Math.abs(p.y - isl.y) < 14 && (this.world.islandAt(p.x, p.z) === isl || p.distanceTo(this.center) < 30);
    if (here) {
      this.refresh -= dt;
      if (this.state === 'idle' || this.refresh <= 0) {
        // look at the world again: whatever has been painted since is in the picture
        this.vistas.snapshot(this.spot);
        this.refresh = 5;
        if (this.state === 'idle') {
          this.state = this.seen ? 'shown' : 'painting';
          this.progress = this.seen ? 1 : 0;
          if (!this.seen) ev.push({ type: 'easelStart' });
        }
        this.mat.uniforms.progress.value = this.progress;
      }
    }
    if (this.state === 'painting') {
      this.progress = Math.min(1, this.progress + dt / 4.5);
      this.mat.uniforms.progress.value = this.progress;
      if (this.progress >= 1) { this.state = 'shown'; this.seen = true; ev.push({ type: 'easelDone' }); }
    }
    return ev;
  }
}

// ============================================================================================ all three
export class SetPieces {
  /** `keepClear` is a list of { x, z, r }: places already spoken for (they are avoided when the springs are placed). */
  constructor(scene, world, uTime, vistas, keepClear = []) {
    const clearance = (x, z, extra = []) => {
      let d = Infinity;
      for (const c of world.colliders) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r);
      for (const c of keepClear) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r + 2);
      for (const c of extra) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - 4);
      return d;
    };
    this.leaves = new Leaves(scene, world, world.islands[1], world.sparkSpots[0]);
    this.springs = new Springs(scene, world, uTime, world.islands[2], clearance);
    this.easel = new GreatEasel(scene, world, vistas, world.islands[3]);
    this.avoid = this.springs.list.map((s) => ({ x: s.x, z: s.z, r: 5 }));
    this.events = [];
  }

  /** A swing of the brush: leaves fly, and any spring in reach takes the colour. Returns the springs coloured. */
  strike(x, z, p, hex, glow) {
    this.leaves.burst(x, z, p.y, 3.6);
    return this.springs.strike(x, z, p, hex, glow);
  }

  save() { return { springs: this.springs.list.map((s) => s.hex || 0) }; }
  load(d) {
    if (!d) return;
    (d.springs || []).forEach((hex, i) => { const s = this.springs.list[i]; if (s && typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)) this.springs.paint(s, hex, 1, true); });
  }

  update(dt, t, player) {
    const ev = this.events; ev.length = 0;
    for (const e of this.leaves.update(dt, t, player)) ev.push(e);
    this.springs.update(dt, t);
    for (const e of this.easel.update(dt, t, player)) ev.push(e);
    return ev;
  }
}
