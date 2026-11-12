import * as THREE from 'three';
import { rimR, surfY } from './world.js';
import { PAL, daub, place, Bag, paintify, glowSprite, mulberry32 } from './util.js';
import { PAINTS } from './paint.js';

// Hidden places: three spots off the painted path, each keeping a pot of paint that is found nowhere else.
//  - The Low Shelf: a small islet below Lantern Rise. No bridge and no wind leads there; you glide down to it.
//  - The Ring Islet: the islet inside the great loop of cream paint. A side wind leaves Last Easel for it.
//  - Where the Light Comes From: the far side of the Spire, behind the castle, where no path goes.
// Nothing marks them: no hint, no guiding flecks, nothing on the map until they are found. Only a glint.

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const POT = ['#6a4038', '#8a5a48', '#52303a', '#7a4a3c'];

export class Secrets {
  constructor(scene, world) {
    this.world = world;
    const rnd = mulberry32(4471);
    const bag = new Bag();
    const isl = world.islands, shelf = world.islets[5], ringIslet = world.islets[1];
    this.grounds = [shelf, ringIslet];               // islets the painter can stand on
    this.avoid = [];                                 // wind mouths: nothing else should be put there
    this.places = [];

    // --- the two islets become solid ground, trees and all
    const base = world.groundHeight;
    const grounds = this.grounds;
    world.groundHeight = (x, z, maxY) => {
      let best = base(x, z, maxY);
      for (const il of grounds) {
        const dx = x - il.x, dz = z - il.z, d2 = dx * dx + dz * dz;
        if (d2 > il.r * il.r * 1.44) continue;
        if (Math.sqrt(d2) <= rimR(il, Math.atan2(dz, dx)) - 0.3) {
          const h = surfY(il, x, z);
          if (h <= maxY && h > best) best = h;
        }
      }
      return best;
    };
    for (const il of grounds) for (const t of il.trees || []) world.colliders.push({ x: t.x, z: t.z, r: 0.75 * t.s, late: true });

    const clearance = (x, z) => { let d = Infinity; for (const c of world.colliders) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r); return d; };
    const pickClear = (list) => list.reduce((best, p) => (clearance(p[0], p[1]) > clearance(best[0], best[1]) ? p : best));
    const onIsland = (i, ox, oz, lift) => { const s = isl[i], x = s.x + ox, z = s.z + oz; return new V3(x, surfY(s, x, z) + lift, z); };
    const onIslet = (il, ox, oz, lift) => { const x = il.x + ox, z = il.z + oz; return new V3(x, surfY(il, x, z) + lift, z); };
    /** The roomiest spot on an islet, away from its trees and from the given points. */
    const roomiest = (il, away) => {
      let best = null, bestD = -Infinity;
      for (let k = 0; k < 60; k++) {
        const a = rnd() * TAU, r = Math.sqrt(rnd()) * il.r * 0.5, x = il.x + Math.cos(a) * r, z = il.z + Math.sin(a) * r;
        let d = clearance(x, z);
        for (const p of away) d = Math.min(d, Math.hypot(x - p.x, z - p.z) - 3.2);
        if (d > bestD) { bestD = d; best = new V3(x, surfY(il, x, z), z); }
      }
      return best;
    };

    // --- 1. the Low Shelf: glide down to it; a wind carries you back up
    {
      const mouth = onIslet(shelf, 4.6, 1, 1.7);          // on the far side, and leaving to the south, well clear of anyone gliding in
      const end = pickClear([[17, 12], [19, 6], [14, 16]]);
      const wind = world.makeWind([mouth, new V3(67, 1.5, 9), new V3(53, 8, 22), new V3(34, 9.5, 22), onIsland(0, end[0], end[1], 4)]);
      const arrive = new V3(shelf.x - 4.5, 0, shelf.z);                // where a glide from Lantern Rise comes down
      this.add(bag, { key: 'shelf', name: 'The Low Shelf', paint: 8, pos: roomiest(shelf, [mouth, arrive]), winds: [wind] });
      this.avoid.push(mouth);
    }

    // --- 2. the Ring Islet: a side wind from Last Easel, through the great loop, and another one home
    {
      const m = pickClear([[11, 2], [10.5, 5.5], [11.5, -1.5], [9, 8]]);
      const mouth = onIsland(3, m[0], m[1], 1.7);
      const out = world.makeWind([mouth, new V3(50, 30, -200), new V3(72, 36, -187), onIslet(ringIslet, -6, -2, 5)]);
      const back0 = onIslet(ringIslet, 1, -6.5, 1.7);
      const e = pickClear([[9, -5], [7, -7.5], [10, -3]]);
      const back = world.makeWind([back0, new V3(80, 37, -200), new V3(55, 35, -214), onIsland(3, e[0], e[1], 4.5)]);
      const arrive = new V3(ringIslet.x - 5, 0, ringIslet.z - 2);
      this.add(bag, { key: 'ring', name: 'The Ring Islet', paint: 9, pos: roomiest(ringIslet, [back0, arrive]), winds: [out, back] });
      this.avoid.push(mouth, back0);
    }

    // --- 3. behind the Spire, where the light pours out and no path goes
    {
      const c = world.castlePos, home = isl[4];
      let best = null, bestD = -Infinity;
      for (let a = -0.6; a <= 0.61; a += 0.1) for (const r of [26.5, 28, 29.5]) {
        const x = c.x + Math.sin(a) * r, z = c.z - Math.cos(a) * r;
        if (world.islandAt(x + (x - home.x) * 0.12, z + (z - home.z) * 0.12) !== home) continue;
        const d = clearance(x, z) - Math.abs(a) * 2;                     // all else equal, straight behind the tower
        if (d > bestD) { bestD = d; best = new V3(x, surfY(home, x, z), z); }
      }
      this.add(bag, { key: 'far', name: 'Where the Light Comes From', paint: 10, pos: best, winds: [] });
    }

    this.mesh = bag.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2a2026 }), { scale: 1.2 }));
    scene.add(this.mesh);
    world.paintable.push(this.mesh);
    world.secrets = this.places;
    this.scene = scene;
  }

  /** A plinth, a pot of the place's paint with a brush left in it, a ring of small stones, and a glint. */
  add(bag, def) {
    const w = this.world, p = def.pos, paint = PAINTS[def.paint], col = new THREE.Color(paint.hex);
    const tones = [0, 0.08, -0.08, 0.16].map((l) => '#' + col.clone().offsetHSL(0, 0, l).getHexString());
    bag.add(daub(place(new THREE.CylinderGeometry(0.95, 1.15, 0.5, 9), p.x, p.y + 0.22, p.z), PAL.stone, { scale: 0.5 }));
    bag.add(daub(place(new THREE.CylinderGeometry(0.66, 0.5, 1.0, 10), p.x, p.y + 0.97, p.z), POT, { scale: 0.8 }));
    bag.add(daub(place(new THREE.TorusGeometry(0.66, 0.08, 5, 14), p.x, p.y + 1.47, p.z, Math.PI / 2, 0, 0), PAL.gold));
    bag.add(daub(place(new THREE.CylinderGeometry(0.035, 0.05, 1.5, 5), p.x + 0.25, p.y + 1.9, p.z + 0.1, 0.2, 0, -0.42), PAL.trunk));       // the brush handle
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + 0.4, h = 0.9 + ((k * 7) % 5) * 0.22, x = p.x + Math.cos(a) * 2.5, z = p.z + Math.sin(a) * 2.5;
      const gy = w.groundHeight(x, z, p.y + 2);
      if (!(gy > -Infinity)) continue;
      bag.add(daub(place(new THREE.BoxGeometry(0.5, h, 0.36), x, gy + h / 2 - 0.1, z, 0.08 * (k % 2 ? 1 : -1), a, 0.1), tones, { scale: 1.2, spread: 1 }));
    }
    // the paint itself, bright in the mouth of the pot
    const surface = new THREE.Mesh(new THREE.CircleGeometry(0.6, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(Math.max(1.25, paint.glow || 1)), fog: false }));
    surface.position.set(p.x, p.y + 1.45, p.z);
    const glint = glowSprite(w.glowTex, 6.5, col.clone().lerp(new THREE.Color(0xffffff), 0.45).getHex(), 0.7);
    glint.position.set(p.x, p.y + 2.3, p.z);
    w.colliders.push({ x: p.x, z: p.z, r: 0.95, late: true });
    const at = { key: def.key, name: def.name, paint: def.paint, hex: paint.hex, pos: p, top: new V3(p.x, p.y + 1.6, p.z), found: false, surface, glint, ph: this.places.length * 2.1 };
    for (const wind of def.winds) wind.secret = at;
    this.places.push(at);
    this.pending = (this.pending || []).concat(surface, glint);
    return at;
  }

  /** The unfound place whose pot the painter has reached, if any. */
  near(p) {
    for (const s of this.places) if (!s.found && (s.pos.x - p.x) ** 2 + (s.pos.z - p.z) ** 2 < 9.6 && Math.abs(s.pos.y - p.y) < 3) return s;
    return null;
  }
  find(s) { s.found = true; }
  get found() { return this.places.filter((s) => s.found).length; }

  /** The lowest hidden ground near a point (so standing on it does not count as falling). */
  floor(p) {
    let f = Infinity;
    for (const il of this.grounds) if (Math.hypot(il.x - p.x, il.z - p.z) < il.r + 90) f = Math.min(f, il.y);
    return f;
  }

  save() { return this.places.map((s) => (s.found ? 1 : 0)); }
  load(list) { (list || []).forEach((v, i) => { if (v && this.places[i]) this.places[i].found = true; }); }

  update(t) {
    if (this.pending) { this.scene.add(...this.pending); this.pending = null; }
    for (const s of this.places) {
      // an unfound pot glints, slowly; a found one keeps only a faint warmth
      s.glint.material.opacity = s.found ? 0.16 : 0.5 + Math.sin(t * 1.1 + s.ph) * 0.22;
      s.glint.scale.setScalar(s.found ? 3.5 : 6.5 + Math.sin(t * 0.8 + s.ph) * 0.8);
    }
  }
}
