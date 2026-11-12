import * as THREE from 'three';
import { rimR, surfY, islandTopGeo } from './world.js';
import { ghostMaterial } from './sketches.js';
import { daub, place, Bag, paintify, glowSprite, glowTexture, strokeGeo, clamp } from './util.js';
import { PAINTS } from './paint.js';
import { STAIR, pencilGround, terraceTop, underside, PAPER, GRAPHITE, STONE, SPAN } from './underpainting.js';

// The Underpainting, onward from the Dry Stair. Two more colours turn out to have a nature:
//
//   Growth   Leaf. A sketched seed, painted green, grows a vine along the trellis drawn for it. The first vine is
//            the way off the Dry Stair; the second winds up the rock in the middle of the Seedbed.
//   Warmth   Ember, Gold (and Sunfire). Ground painted in a warm colour gives off rising air: jump into it, hold
//            Space, and the cloak fills and carries the painter up. From the top of the Seedbed the next rock is
//            too far to glide to, so the way across is a chain of the painter's own updrafts, rock to rock, to the
//            Kiln; and the Kiln itself, painted warm, lights.

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const SEED = { x: 0, y: 14, z: 4110, r: 24, ph: 2.7, name: 'The Seedbed', pale: true };
const ROCK = { r: 9, y: 21 };                          // the rock in the middle of the Seedbed: too high to jump
const CINDERS = [{ x: 22, y: 22, z: 4040, r: 6.5, ph: 0.9 }, { x: -14, y: 30, z: 3975, r: 6.5, ph: 4.1 }].map((c) => ({ ...c, name: 'A cinder', pale: true, quiet: true }));
const KILN = { x: 6, y: 36, z: 3895, r: 16, ph: 5.5, name: 'The Kiln', pale: true };
export const GROWS = [7], WARMS = [1, 5, 10];          // Leaf; Gold, Ember and Sunfire
const VINE = ['#6fd08a', '#4fb873', '#8ee0a0', '#3f9a62', '#b4ecb8', '#5cc47c'];
const COLUMN = 30, REACH = 4.2;                        // how high a patch of warm ground lifts, and how wide

const tonesOf = (hex) => { const c = new THREE.Color(hex); return [0, 0.08, -0.08, 0.15].map((l) => '#' + c.clone().offsetHSL(0, 0, l).getHexString()); };

export class Seedbed {
  constructor(scene, world, uTime, under) {
    this.scene = scene; this.world = world; this.under = under; this.uTime = uTime;
    const bag = (this.bag = new Bag()), add = (g, pal, o) => bag.add(daub(g, pal, o));
    const topMat = (tex) => paintify(new THREE.MeshLambertMaterial({ map: tex }), { scale: 1, amp: 0.45 });
    this.realMat = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x18171c }), { scale: 1.1, amp: 0.5 });
    this.vineMat = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { scale: 1 });

    // --- four more islands in pencil: the Seedbed, two cinders to cross by, and the Kiln
    const island = (def, size, seed) => {
      const isl = { ...def, index: world.islands.length };
      isl.tex = pencilGround(isl, size, [], [], seed); isl.span = 2 * isl.r * SPAN;
      world.islands.push(isl);
      const mat = topMat(isl.tex);
      scene.add(new THREE.Mesh(islandTopGeo(isl, isl.r > 10 ? 22 : 10, isl.r > 10 ? 72 : 40), mat));
      bag.add(underside(isl, isl.r > 10 ? 8 : 5, isl.r > 10 ? 40 : 22));
      return { isl, mat };
    };
    const seed = island(SEED, 2048, 2203); this.seedbed = seed.isl;
    this.cinders = CINDERS.map((c, k) => island(c, 512, 2210 + k).isl);
    this.kilnIsle = island(KILN, 1024, 2231).isl;

    // the rock in the middle of the Seedbed
    scene.add(new THREE.Mesh(terraceTop(SEED, 0.01, ROCK.r, ROCK.y), seed.mat));
    add(place(new THREE.CylinderGeometry(ROCK.r, ROCK.r + 0.5, ROCK.y - SEED.y + 0.6, 56, 5, true), SEED.x, (ROCK.y + SEED.y) / 2 - 0.3, SEED.z), STONE, { scale: 0.25, stretch: [1, 0.2, 1], spread: 0.7 });
    add(place(new THREE.TorusGeometry(ROCK.r + 0.05, 0.16, 5, 56), SEED.x, ROCK.y + 0.02, SEED.z, Math.PI / 2, 0, 0), GRAPHITE);
    world.colliders.push({ x: SEED.x, z: SEED.z, r: ROCK.r, top: ROCK.y - 0.25, late: true });
    const base = world.groundHeight, r2 = ROCK.r * ROCK.r;
    world.groundHeight = (x, z, maxY) => {
      const best = base(x, z, maxY);
      return ROCK.y <= maxY && ROCK.y > best && (x - SEED.x) ** 2 + (z - SEED.z) ** 2 < r2 ? ROCK.y : best;
    };

    // pencil trees and stones, grey until painted
    const on = (isl, a, r) => { const x = isl.x + Math.cos(a) * r, z = isl.z + Math.sin(a) * r; return new V3(x, surfY(isl, x, z), z); };
    const tree = (p, s) => {
      add(place(new THREE.CylinderGeometry(0.16 * s, 0.3 * s, 3.4 * s, 6), p.x, p.y + 1.7 * s, p.z, 0, 0, 0.05), GRAPHITE, { scale: 0.6 });
      for (const [ox, oy, oz, rr] of [[0, 4.3, 0, 1.5], [1.1, 3.6, 0.4, 1.05], [-1.0, 3.7, -0.5, 1.1], [0.2, 5.3, -0.3, 0.9]]) {
        add(place(new THREE.IcosahedronGeometry(rr * s, 1), p.x + ox * s, p.y + oy * s, p.z + oz * s, 0, rr * 2, 0, 1, 0.72, 1), [...PAPER, '#d6d2dc', '#c9c5d0'], { scale: 0.4, spread: 1 });
      }
      world.colliders.push({ x: p.x, z: p.z, r: 0.45 * s, late: true });
    };
    for (const [a, r, s] of [[0.2, 19, 1.2], [1.0, 20.5, 1.0], [2.5, 20, 1.3], [3.5, 18.5, 1.0], [5.6, 19.5, 1.1]]) tree(on(SEED, a, r), s);
    for (const [a, r, s] of [[0.6, 11, 1.2], [2.3, 12, 1.0], [3.9, 10.5, 1.1]]) tree(on(KILN, a, r), s);
    for (const [isl, a, r] of [[SEED, 0.7, 15], [SEED, 3.0, 16], [SEED, 4.6, 20], [KILN, 5.2, 11], [KILN, 1.6, 12.5]]) {
      const p = on(isl, a, r);
      add(place(new THREE.BoxGeometry(0.7, 1.9, 0.5), p.x, p.y + 0.85, p.z, 0.06, a, 0.08), STONE, { scale: 0.9 });
    }

    // --- growth: two vines, each with a seed at its foot
    this.vines = []; this.seeds = [];
    {
      // off the top of the Dry Stair (its north edge), over to the Seedbed's near rim
      const rim = rimR(SEED, Math.PI / 2), end = (inset) => new V3(SEED.x, 0, SEED.z + rim - inset);
      const b1 = end(1.3), b0 = end(6.5); b1.y = surfY(SEED, b1.x, b1.z) + 0.14; b0.y = surfY(SEED, b0.x, b0.z) + 0.12;
      const curve = new THREE.CatmullRomCurve3([new V3(STAIR.x, 11.06, STAIR.z - 8.6), new V3(STAIR.x, 11.12, STAIR.z - 11.4), new V3(STAIR.x + 3, 13.6, STAIR.z - 30), new V3(STAIR.x - 2.5, 15.2, STAIR.z - 48), b1, b0]);
      const vine = this.makeVine(curve.getSpacedPoints(64), 1.7, 5.5);
      this.makeSeed(new V3(STAIR.x + 2.4, 11, STAIR.z - 8.2), vine, 'A sketched seed, and a trellis leading away. It wants a colour that grows.');
    }
    {
      // round and up the rock in the middle of the Seedbed, and in over its edge at the top
      const a0 = Math.PI / 2 + 0.55, pts = [], n = 72;
      for (let i = 0; i <= n; i++) {
        const t = i / n, a = a0 + t * 1.55 * Math.PI, rise = clamp(t / 0.9, 0, 1), rad = t < 0.9 ? 10.75 : 10.75 - ((t - 0.9) / 0.1) * 3.4;
        const x = SEED.x + Math.cos(a) * rad, z = SEED.z + Math.sin(a) * rad, g = surfY(SEED, x, z) + 0.12;
        pts.push(new V3(x, g + (ROCK.y + 0.08 - g) * (rise * rise * (3 - 2 * rise)), z));
      }
      const vine = this.makeVine(pts, 1.55, 6.5);
      this.makeSeed(on(SEED, a0 - 0.2, 13.1), vine, 'Another seed, at the foot of the rock.');
    }

    // --- warmth: patches of painted ground that lift, and the Kiln
    this.warm = [];
    this.decalGeo = new THREE.CircleGeometry(REACH - 0.5, 28).rotateX(-Math.PI / 2);
    this.decalMat = new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,214,150,0.95)', 'rgba(255,130,50,0.5)', 'rgba(255,90,30,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.fleckT = 0; this.fleckI = 0;
    // a ring sketched on the rock's top, facing the first cinder: somewhere to try it
    const hint = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.14, 5, 30).rotateX(Math.PI / 2), ghostMaterial(uTime));
    hint.position.set(SEED.x + 2, ROCK.y + 0.2, SEED.z - 5.2); scene.add(hint);
    this.hintRing = hint;
    {
      const k = on(KILN, Math.PI * 1.5, 2.5);          // the kiln stands a little back from the middle, its mouth to the south
      this.kiln = { pos: k, hex: null, lit: false, top: new V3(k.x, k.y + 2, k.z) };
      add(place(new THREE.SphereGeometry(3.3, 18, 10, 0, TAU, 0, Math.PI / 2), k.x, k.y - 0.1, k.z), STONE, { scale: 0.5, spread: 0.8 });
      add(place(new THREE.CylinderGeometry(3.5, 3.7, 0.5, 18), k.x, k.y + 0.2, k.z), GRAPHITE, {});
      add(place(new THREE.CylinderGeometry(0.6, 0.8, 2.6, 8), k.x, k.y + 4.1, k.z - 0.6), STONE, { scale: 0.6 });
      add(place(new THREE.TorusGeometry(1.25, 0.24, 5, 12, Math.PI), k.x, k.y + 0.3, k.z + 3.05), GRAPHITE, {});
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.2, 14, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x3a3844, fog: false }));
      mouth.position.set(k.x, k.y + 0.3, k.z + 3.12);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 6), ghostMaterial(uTime)); flame.position.set(k.x, k.y + 6.5, k.z - 0.6);
      const glow = glowSprite(world.glowTex, 16, 0xffb060, 0); glow.position.set(k.x, k.y + 2.4, k.z + 2.6);
      scene.add(mouth, flame, glow);
      Object.assign(this.kiln, { mouth, flame, glow });
      world.colliders.push({ x: k.x, z: k.z, r: 3.5, late: true });
    }

    this.mesh = bag.mesh(this.realMat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    world.paintable.push(this.mesh);
    this.events = [];
  }

  /** A vine along `pts`: a sketched trellis until it grows, then a walkable stroke of green, like the bridges. */
  makeVine(pts, hw, seconds) {
    const scene = this.scene, N = pts.length - 1;
    const geo = strokeGeo(pts, { width: hw * 2, lanes: 5, palette: VINE, dripPalette: VINE, drips: 0.5, run: 9 });
    const mesh = new THREE.Mesh(geo, this.vineMat); mesh.frustumCulled = false;
    const ghost = new THREE.Mesh(strokeGeo(pts, { width: hw * 1.4, lanes: 2, palette: ['#ffffff'], bump: 0 }), ghostMaterial(this.uTime));
    ghost.frustumCulled = false; ghost.renderOrder = 3;
    scene.add(mesh, ghost);
    const vine = {
      vine: true, raised: true, pts, N, hw, progress: 0, need: 0, anchor: pts[2].clone(), vps: geo.userData.vertsPerSeg, mesh, ghost,
      shown: true, growing: false, seconds, from: -1, to: -1,
      min: new V3(Infinity, 0, Infinity), max: new V3(-Infinity, 0, -Infinity),
      set(p) {
        this.progress = clamp(p, 0, 1);
        mesh.geometry.setDrawRange(0, Math.floor(this.progress * N) * this.vps);
        mesh.visible = this.progress > 0;
        ghost.visible = this.shown && this.progress < 1;
      },
      head() { return pts[Math.min(N, Math.floor(this.progress * N))]; },
    };
    for (const p of pts) { vine.min.x = Math.min(vine.min.x, p.x - 3); vine.max.x = Math.max(vine.max.x, p.x + 3); vine.min.z = Math.min(vine.min.z, p.z - 3); vine.max.z = Math.max(vine.max.z, p.z + 3); }
    vine.set(0);
    this.world.bridges.push(vine);                   // (it is walked on, saved and mapped exactly as a bridge is)
    this.vines.push(vine);
    return vine;
  }

  /** A seed pod drawn at the foot of a vine's trellis. */
  makeSeed(pos, vine, line) {
    const ghost = new THREE.Group();
    const pod = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1).scale(1, 1.45, 1), ghostMaterial(this.uTime)); pod.position.y = 1.15;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.7, 5), pod.material); stem.position.y = 0.35;
    ghost.add(pod, stem); ghost.position.copy(pos);
    this.scene.add(ghost);
    const s = { pos, vine, line, ghost, real: null, hex: null, top: new V3(pos.x, pos.y + 1.2, pos.z), index: this.seeds.length };
    this.seeds.push(s);
    return s;
  }
  setSeed(s, hex, instant = false) {
    const grows = GROWS.includes(PAINTS.findIndex((p) => p.hex === hex)), T = tonesOf(hex), b = new Bag();
    if (s.real) { this.scene.remove(s.real); s.real.geometry.dispose(); }
    // painted, the pod is a real thing in that colour; in a colour that grows, it has split open
    b.add(daub(place(new THREE.IcosahedronGeometry(0.62, 1), 0, grows ? 0.62 : 1.15, 0, 0, 0, 0, grows ? 1.25 : 1, grows ? 0.5 : 1.45, grows ? 1.25 : 1), T, { spread: 1 }));
    b.add(daub(place(new THREE.CylinderGeometry(0.07, 0.11, 0.7, 5), 0, 0.35, 0), GRAPHITE, {}));
    s.real = b.mesh(this.realMat); s.real.position.copy(s.pos);
    this.scene.add(s.real);
    s.ghost.visible = false; s.hex = hex;
    if (grows) { s.vine.growing = true; if (instant) s.vine.set(Math.max(s.vine.progress, 1)); }
    return grows;
  }

  /** Warm ground at this spot: a new patch, or the nearest one moved here if it is close by. */
  addWarm(x, y, z) {
    let p = this.warm.find((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < 6.5 && Math.abs(q.y - y) < 2);
    if (!p) {
      if (this.warm.length >= 30) { const old = this.warm.shift(); this.scene.remove(old.decal); }
      p = { x, y, z, decal: new THREE.Mesh(this.decalGeo, this.decalMat), born: 0 };
      p.decal.renderOrder = 2;
      this.scene.add(p.decal);
      this.warm.push(p);
    }
    p.x = x; p.y = y; p.z = z; p.decal.position.set(x, y + 0.09, z);
    return p;
  }
  lightKiln(hex, instant = false) {
    const k = this.kiln, warm = WARMS.includes(PAINTS.findIndex((p) => p.hex === hex));
    k.hex = hex;
    k.mouth.material.color.set(hex).multiplyScalar(warm ? 1.9 : 0.8);
    k.flame.visible = !warm;
    const first = warm && !k.lit;
    if (warm) k.lit = true;
    k.burning = warm;
    if (instant) k.glow.material.opacity = warm ? 0.8 : 0;
    return { warm, first };
  }

  get grown() { return this.vines.every((v) => v.progress >= 1); }
  get lit() { return this.kiln.lit; }

  /** How fast the air is rising under this point: warm ground below, or the lit Kiln. Zero if there is none. */
  thermal(p) {
    let up = 0;
    for (const q of this.warm) {
      const h = p.y - q.y;
      if (h > -0.6 && h < COLUMN + 1 && (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < REACH * REACH) up = Math.max(up, 10 * clamp((COLUMN - h) / 4, 0, 1));
    }
    const k = this.kiln;
    if (k.burning) {
      const h = p.y - k.pos.y;
      if (h > -0.6 && h < 49 && (k.pos.x - p.x) ** 2 + (k.pos.z - p.z) ** 2 < 6.2 * 6.2) up = Math.max(up, 13 * clamp((48 - h) / 6, 0, 1));
    }
    return up;
  }

  /** A swing of the brush landing at (x, z), from a painter standing at `p`. Returns what it did. */
  strike(x, z, p, hex) {
    const out = [];
    if (!this.under.contains(p)) return out;
    const hit = (q, reach = 3.3) => Math.abs(q.y - p.y) < 3 && ((q.x - x) ** 2 + (q.z - z) ** 2 < reach * reach || (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 2.7 * 2.7);
    for (const s of this.seeds) {
      if (s.hex === hex || !s.ghost.parent || (s.index === 0 && !this.under.done) || !hit(s.pos)) continue;
      const already = s.vine.growing || s.vine.progress >= 1, grows = this.setSeed(s, hex);
      out.push({ type: grows ? (already ? 'recolour' : 'grow') : already ? 'recolour' : 'barren', at: s.top });
    }
    const k = this.kiln;
    if (k.hex !== hex && hit(k.pos, 5.4)) { const res = this.lightKiln(hex); out.push({ type: res.first ? 'kiln' : res.warm ? 'recolour' : 'cold', at: k.top }); }
    // warm paint on any ground here leaves that ground warm
    if (WARMS.includes(PAINTS.findIndex((q) => q.hex === hex))) {
      const g = this.world.groundHeight(x, z, p.y + 1.5);
      if (g > -Infinity && Math.abs(g - p.y) < 2.4) { const fresh = this.warm.length; this.addWarm(x, g, z); out.push({ type: 'warm', at: new V3(x, g + 0.6, z), fresh: this.warm.length > fresh }); }
    }
    return out;
  }

  /** An unpainted seed the painter is standing near (and may be shown its line about), if any. */
  waitingSeed(p) {
    for (const s of this.seeds) if (!s.hex && s.ghost.visible && s.pos.distanceTo(p) < 7) return s;
    return null;
  }
  /** Is the painter on top of the Seedbed's rock, looking at a gap too wide to glide? */
  onRock(p) { return Math.abs(p.y - ROCK.y) < 1 && (p.x - SEED.x) ** 2 + (p.z - SEED.z) ** 2 < ROCK.r * ROCK.r; }

  save() { return { seeds: this.seeds.map((s) => s.hex || 0), kiln: this.kiln.hex || 0, lit: this.kiln.lit, warm: this.warm.map((q) => [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10, Math.round(q.z * 10) / 10]) }; }
  load(d) {
    if (!d) return;
    const ok = (h) => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
    (d.seeds || []).forEach((h, i) => { if (ok(h) && this.seeds[i]) this.setSeed(this.seeds[i], h, true); });
    if (ok(d.kiln)) this.lightKiln(d.kiln, true);
    this.kiln.lit = !!d.lit || this.kiln.lit;
    for (const q of d.warm || []) if (Array.isArray(q) && q.length === 3 && q.every(Number.isFinite)) this.addWarm(q[0], q[1], q[2]);
  }

  update(dt, t, player) {
    const ev = this.events; ev.length = 0;
    // the first seed and its trellis are only drawn in once the Dry Stair runs
    const first = this.seeds[0], shown = this.under.done;
    first.vine.shown = shown; first.ghost.visible = shown && !first.hex;
    if (first.real) first.real.visible = true;
    for (const v of this.vines) {
      if (v.growing && v.progress < 1) { v.set(v.progress + dt / v.seconds); if (v.progress >= 1) { v.growing = false; ev.push({ type: 'grown', at: v.pts[v.N], vine: v }); } }
      else v.set(v.progress);
    }
    if (!player || !this.under.contains(player.pos)) return ev;
    // warm ground breathes, and sends up flecks to show where the air is rising
    for (const q of this.warm) { q.born = Math.min(1, q.born + dt * 2); q.decal.scale.setScalar(q.born * (1 + Math.sin(t * 2.2 + q.x) * 0.06)); }
    this.fleckT -= dt;
    if (this.fleckT <= 0) {
      this.fleckT = 0.07;
      const n = this.warm.length + (this.kiln.burning ? 2 : 0);
      if (n) {
        const i = this.fleckI++ % n, q = i < this.warm.length ? this.warm[i] : null, a = Math.random() * TAU, d = Math.sqrt(Math.random()) * (q ? REACH - 1 : 4.5);
        const cx = q ? q.x : this.kiln.pos.x, cy = q ? q.y : this.kiln.pos.y + 5, cz = q ? q.z : this.kiln.pos.z;
        if ((cx - player.pos.x) ** 2 + (cz - player.pos.z) ** 2 < 120 * 120) ev.push({ type: 'fleck', x: cx + Math.cos(a) * d, y: cy + 0.3 + Math.random() * (q ? 6 : 14), z: cz + Math.sin(a) * d, fast: !q });
      }
    }
    const k = this.kiln;
    k.glow.material.opacity += ((k.burning ? 0.7 + Math.sin(t * 5.3) * 0.12 : 0) - k.glow.material.opacity) * (1 - Math.exp(-3 * dt));
    k.flame.rotation.y = t * 0.6;
    this.hintRing.visible = this.warm.length === 0;
    return ev;
  }
}
