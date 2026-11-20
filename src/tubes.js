import * as THREE from 'three';
import { rimR, surfY, islandTopGeo } from './world.js';
import { daub, place, Bag, paintify, glowSprite, clamp, mulberry32 } from './util.js';
import { underside, SPAN, makeStream } from './underpainting.js';
import { ghostMaterial } from './sketches.js';
import { PAINTS } from './paint.js';
import { ground, CRYSTAL, DUSK } from './gallery.js';

// Three Tubes: the one picture in the gallery that can be stepped into. Whoever painted it had three tubes of paint:
// red, yellow and blue. Inside it those three are all the brush has (and Cream, which is blank), and the picture is
// made of nothing else. Anything more has to be mixed: paint one colour over another and the two become a third.
//
//   blue and yellow make green, and green grows: a sketched seed sends a vine across a gap
//   red and yellow make orange, and orange warms: a sketched lamp lights, and its warm air lifts a glider
//   red and blue make violet, and violet brings the evening: a sketched lantern lights, and paths of evening light
//   stand where by day there was only a drawing of them
//
// The place is a night sky with a great moon in it, and islands of violet rock hung under it: trees that give off
// their own light, water going over every edge, arches, banners, and a road of every colour wound through it all.
//
//   the first island  a seed: green, and a vine up to
//   the gate ........ a small island with an arch on it, where the road of every colour sets out:
//   the road ........ a long slide, to be skated, down and round to the foot of
//   the observatory . a tower, with rings turning about its head. Stones hang round it in a rising spiral, to be
//                     climbed by jumping; two of them carry a bead of light, which throws the painter up. On its roof
//                     a lamp: orange, warm air, and a glide to
//   three islands ... (C, D and E below) where nothing more is said and the hour is something the painter sets:
//                     green things close in the dark, and the paths of light are not there by day. Cream on a lit
//                     lantern takes the evening back.
//                       C  lantern, lamp   the evening, and a path of light to D
//                       D  seed .........  a vine to E, which will not open in the dark; and there is no lantern here.
//                                          The evening has to be put out back on C, which takes the path away: the
//                                          lamp on C is the other way over
//                       E  lantern ......  the evening again, and the last path, up to
//   the village ..... (built by the gallery) where everybody is out dancing.
//
// Each sketch glows faintly in the colour it wants. A wrong mixture stays as it is until Cream takes it back to paper;
// all three colours together make mud.

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const MOON = new V3(7790, 250, 770), GALAXY = new V3(8330, 330, 860), HEART = new V3(8010, -20, 1200);       // (the middle of the place)
// (the Piper's field itself is built by the gallery: this is only where it lies, for the path that ends on it)
const FIELD = { x: 8000, y: 0, z: 1000, r: 26, ph: 5.2 };
const START = { x: 8000, y: -50, z: 1388, r: 26, ph: 1.1 };         // where the frame lets the painter in
const GATE = { x: 8000, y: -39, z: 1312, r: 9.5, ph: 2.0 };         // where the road of every colour sets out
const BASE = { x: 8040, y: -48, z: 1244, r: 8, ph: 3.3 };           // where it ends, at the foot of the observatory
const TOWER = { x: 8046, z: 1218, r: 6 };                           // the observatory
const TOP = { x: TOWER.x, y: -14, z: TOWER.z, r: 7, ph: 0.7 };      // its roof
// (the warm air on TOP reaches C, as that on C reaches D. E stands high, so that neither reaches it)
const C = { x: 8030, y: -9, z: 1160, r: 9.5, ph: 0.2 };
const D = { x: 7985, y: -13, z: 1112, r: 13, ph: 2.4 };
const E = { x: 8010, y: -3, z: 1058, r: 9.5, ph: 4.1 };
// the stones round the observatory: how much higher each hangs than the one before, and which carry a bead
// (No step is more than one plain jump: a step that needed the second jump at just the right moment could not be
// climbed by hand. The height is made up by the beads, which throw higher.)
const RISE = [1.7, 2, 2, 2, 2, 9, 2, 2, 2], BEAD = [4, 8], RING = 12.5, TURN = (33 * Math.PI) / 180, BOUNCE = 26;

const STONE = ['#e8dcf8', '#d4c4f0', '#f6eeff', '#c0b0e4'], GOLD = ['#f2d8a0', '#e8c078', '#fff0c8', '#f8e2b0'];
const BLOSSOM = ['#ffffff', '#f4e8ff', '#e6d2ff', '#ffdcf2', '#d6c2fa'], PETAL = ['#fff4d8', '#ffe6b0', '#fffaf0', '#ffd8c0'];
const RAINBOW = ['#ff9ae0', '#ffd68a', '#8ae6ff', '#b89cff', '#fff4d0', '#7ab8ff'];
const AQUAS = ['#8ae8ff', '#5cc8f0', '#c0f4ff', '#48a8e0'], PINKS = ['#ff9ae0', '#f070c8', '#ffc0ec', '#d058b8'], CLOTH = ['#6a3cc0', '#7c4cd4', '#5a30a8', '#8a5ce0'];
const LIT = ['#ffe6a8', '#fff4d0', '#ffd27a'], AQUA = '#7ae8ff', BLADES = ['#8a7af0', '#6ad0c8', '#a896ff', '#58b8c0'];
// the roads of every colour that are painted on the ground of the larger islands, as [east, south] of each one's middle
const ROAD = { start: [[0, 13], [9, 6], [-8, -2], [6, -11], [0, -22]], gate: [[0, 9], [3, 1], [0, -9]], c: [[-1, 8], [4, 1], [-3.4, -4.5]], d: [[4.8, 6], [-3, 1.5], [2.9, -7]], e: [[-2.1, 5], [2, 0], [-0.9, -5.5]] };

const RED = PAINTS[0].hex, YELLOW = PAINTS[1].hex, BLUE = PAINTS[6].hex;
/** What two (or three) of the tubes make, by which of them went in: r, y and b, in that order of letters. */
const MIX = { r: RED, y: YELLOW, b: BLUE, ry: PAINTS[5].hex, by: PAINTS[7].hex, br: PAINTS[3].hex, bry: '#7d6f66' };
/** Which tube a paint is: red, yellow, blue; or Cream, which takes paint away. Anything else is not from a tube. */
const kindOf = (hex) => { const i = PAINTS.findIndex((p) => p.hex === hex); return i === 0 ? 'r' : i === 1 ? 'y' : i === 6 || i === 2 ? 'b' : i === 4 ? 'cream' : null; };
/** The paints the brush has inside this picture. */
export const TUBES = [0, 1, 6, 4];

export class Tubes {
  /** `seedbed` grows the vines of the second level; the two bridges here are grown the same way. */
  constructor(scene, world, uTime, seedbed) {
    this.scene = scene;
    const bag = new Bag(), add = (g, pal, o) => bag.add(daub(g, pal, o));
    const rnd = mulberry32(3301);
    // what gives off light of its own (windows, stars) is a mesh apart, unlit; and the soft lights are sprites, which breathe
    const lights = new Bag(), lit = (g, pal = LIT) => lights.add(daub(g, pal, { scale: 2, spread: 1 }));
    const soft = new Bag();                                   // (blossom and petals: pale by night as by day)
    this.glows = [];
    const glow = (p, size, color, op) => { const q = glowSprite(world.glowTex, size, color, op); q.position.copy(p); scene.add(q); this.glows.push({ q, op, ph: p.x * 0.7 + p.z * 0.3 }); return q; };
    // the ground: violet, laid in strokes; and across the larger islands a road of every colour, as wound as the roads of the picture are
    const dusk = (seed, size = 1024, road = null) => (isl) => ground(isl, size, '#5a3fa8', DUSK, size > 600 ? 950 : size > 200 ? 260 : 60, seed, null, road && ((x, X, Z, px) => {
      const pts = new THREE.CatmullRomCurve3(road.map(([ox, oz]) => new V3(isl.x + ox, 0, isl.z + oz))).getPoints(48);
      x.lineCap = 'round'; x.lineJoin = 'round';
      RAINBOW.slice(0, 5).forEach((c, k) => { x.strokeStyle = c; x.globalAlpha = 0.92; x.lineWidth = (4.6 - k * 0.9) * px; x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(X(p.x), Z(p.z)) : x.moveTo(X(p.x), Z(p.z)))); x.stroke(); });
      x.globalAlpha = 1;
    }));
    const island = (def, tex, under = CRYSTAL) => {
      const isl = { name: 'Three Tubes', pale: true, quiet: true, ...def, index: world.islands.length }, big = isl.r > 10, small = isl.r < 5;
      isl.tex = tex(isl); isl.span = 2 * isl.r * SPAN;
      world.islands.push(isl);
      scene.add(new THREE.Mesh(islandTopGeo(isl, big ? 22 : small ? 6 : 12, big ? 72 : small ? 20 : 44), paintify(new THREE.MeshLambertMaterial({ map: isl.tex }), { scale: 1, amp: 0.45 })));
      bag.add(underside(isl, big ? 8 : 5, big ? 40 : small ? 14 : 24, under));
      return isl;
    };
    const on = (isl, ox, oz, lift = 0) => new V3(isl.x + ox, surfY(isl, isl.x + ox, isl.z + oz) + lift, isl.z + oz);
    /** A point on an island's ground, on the side toward `to`, `back` from its rim. */
    const edge = (isl, to, back, lift = 0.13) => { const th = Math.atan2(to.z - isl.z, to.x - isl.x), r = rimR(isl, th) - back, x = isl.x + Math.cos(th) * r, z = isl.z + Math.sin(th) * r; return new V3(x, surfY(isl, x, z) + lift, z); };

    // ================================================================================== what the islands are dressed in
    // a tree that gives off its own light: a pale gold trunk, and blossom in layers
    const taken = [];                                        // [x, z, how far to keep off] of whatever already stands somewhere
    // what a fish must not swim through: [x, z, how wide, its top], and for a bridge its underside too
    const block = [], laid = (pts, hw) => { pts.forEach((p, i) => { if (i % 3 === 0) block.push([p.x, p.z, hw + 0.4, p.y + 1.0, p.y - 0.8]); }); return pts; };
    const treeAt = (p, k, solid = true) => {
      taken.push([p.x, p.z, 1.4 * k]); block.push([p.x, p.z, 3.5 * k, p.y + 7.8 * k]);
      add(place(new THREE.CylinderGeometry(0.2 * k, 0.44 * k, 3.4 * k, 6), p.x, p.y + 1.7 * k, p.z, 0, 0, 0.06), GOLD, { scale: 0.6 });
      for (const [dx, dz] of [[1, 0.3], [-0.9, -0.4], [0.2, 1]]) add(place(new THREE.CylinderGeometry(0.1 * k, 0.17 * k, 2.3 * k, 5), p.x + dx * 0.75 * k, p.y + 3.7 * k, p.z + dz * 0.75 * k, dz * 0.7, 0, -dx * 0.7), GOLD, { scale: 0.6 });
      for (const [dx, dy, dz, rr] of [[0, 5.3, 0, 2.0], [1.9, 4.5, 0.6, 1.5], [-1.8, 4.6, -0.7, 1.55], [0.4, 4.4, 1.9, 1.3], [-0.5, 4.7, -1.8, 1.25], [0.2, 6.4, 0.2, 1.2]]) soft.add(daub(place(new THREE.IcosahedronGeometry(rr * k, 1), p.x + dx * k, p.y + dy * k, p.z + dz * k, 0, rr * 2, 0, 1, 0.62, 1), BLOSSOM, { scale: 0.5, spread: 1 }));
      glow(new V3(p.x, p.y + 5 * k, p.z), 12 * k, 0xf0d8ff, 0.3);
      if (solid) world.colliders.push({ x: p.x, z: p.z, r: 0.5 * k, late: true });
    };
    const tree = (isl, ox, oz, k) => treeAt(on(isl, ox, oz), k);
    // a flower as tall as the painter, with a light in its cup
    const flower = (isl, ox, oz, k) => {
      const p = on(isl, ox, oz);
      taken.push([p.x, p.z, 0.9 * k]); block.push([p.x, p.z, 0.9 * k, p.y + 2.7 * k]);
      add(place(new THREE.CylinderGeometry(0.05 * k, 0.09 * k, 1.5 * k, 5), p.x, p.y + 0.75 * k, p.z, 0, 0, 0.08), ['#6ad0c8', '#58b8c0', '#8ae0d0'], { scale: 0.8 });
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; soft.add(daub(place(new THREE.ConeGeometry(0.36 * k, 1.0 * k, 5), p.x + Math.cos(a) * 0.24 * k, p.y + 1.8 * k, p.z + Math.sin(a) * 0.24 * k, Math.PI + Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5), PETAL, { scale: 0.8, spread: 1 })); }
      glow(new V3(p.x, p.y + 2.0 * k, p.z), 3.8 * k, 0xffe2a8, 0.5);
    };
    // crystals, standing in a cluster
    const crystal = (isl, ox, oz, k, pal) => {
      const p = on(isl, ox, oz);
      taken.push([p.x, p.z, 1.4 * k]); block.push([p.x, p.z, 1.3 * k, p.y + 3.1 * k]);
      for (const [dx, dz, h, t] of [[0, 0, 2.2, 0], [0.6, 0.2, 1.4, 0.35], [-0.5, 0.3, 1.2, -0.4], [0.1, -0.6, 1.0, 0.3]]) add(place(new THREE.OctahedronGeometry(0.42 * k), p.x + dx * k, p.y + h * 0.5 * k, p.z + dz * k, t * 0.6, dx, t, 1, h * 1.3, 1), pal, { scale: 0.9, spread: 1 });
      glow(new V3(p.x, p.y + 1.2 * k, p.z), 4.5 * k, pal === AQUAS ? 0x8ae8ff : 0xff9ae0, 0.34);
      world.colliders.push({ x: p.x, z: p.z, r: 0.7 * k, late: true });
    };
    // an arch of pale stone across a way that runs along (dx, dz), a star at its head
    const arch = (p, dx, dz, w = 3.2, h = 5) => {
      const yaw = Math.atan2(-dx, -dz), c = Math.cos(yaw), q = -Math.sin(yaw);
      block.push([p.x, p.z, w + 1.3, p.y + h + w + 2.2]);
      for (const k of [-1, 1]) {
        const x = p.x + c * w * k, z = p.z + q * w * k;
        add(place(new THREE.BoxGeometry(1.1, h, 1.1), x, p.y + h / 2 - 0.2, z, 0, yaw, 0), STONE, { scale: 0.3 });
        add(place(new THREE.BoxGeometry(1.5, 0.45, 1.5), x, p.y + h, z, 0, yaw, 0), STONE, { scale: 0.3 });
        world.colliders.push({ x, z, r: 0.75, late: true }); taken.push([x, z, 1.3]);
      }
      add(place(new THREE.TorusGeometry(w, 0.55, 6, 18, Math.PI), p.x, p.y + h, p.z, 0, yaw, 0), STONE, { scale: 0.3 });
      lit(place(new THREE.OctahedronGeometry(0.5), p.x, p.y + h + w + 1.1, p.z, 0, yaw, 0, 1, 1.9, 0.5));
      lit(place(new THREE.OctahedronGeometry(0.5), p.x, p.y + h + w + 1.1, p.z, 0, yaw, 0, 1.9, 1, 0.5));
      glow(new V3(p.x, p.y + h + w + 1.1, p.z), 6, 0xfff0c0, 0.6);
    };
    // a banner hung from an island's rim
    const banner = (isl, th) => {
      const r = rimR(isl, th) + 0.25, x = isl.x + Math.cos(th) * r, z = isl.z + Math.sin(th) * r, y = surfY(isl, x, z) - 0.5, yaw = Math.atan2(-Math.cos(th), -Math.sin(th));
      add(place(new THREE.BoxGeometry(2.3, 0.25, 0.3), x, y, z, 0, yaw, 0), GOLD, { scale: 0.6 });
      block.push([x, z, 1.5, y + 0.3]);
      add(place(new THREE.BoxGeometry(2.0, 3.6, 0.1), x, y - 1.9, z, 0, yaw, 0), CLOTH, { scale: 0.5 });
      add(place(new THREE.ConeGeometry(1.0, 1.1, 4, 1), x, y - 4.2, z, Math.PI, yaw, 0, 1, 1, 0.08), CLOTH, { scale: 0.5 });
      lit(place(new THREE.OctahedronGeometry(0.42), x + Math.cos(th) * 0.12, y - 1.9, z + Math.sin(th) * 0.12, 0, yaw, 0, 1, 1.6, 0.2));
      lit(place(new THREE.OctahedronGeometry(0.42), x + Math.cos(th) * 0.12, y - 1.9, z + Math.sin(th) * 0.12, 0, yaw, 0, 1.6, 1, 0.2));
    };
    // water going over an edge, from a spring of crystal a little way in
    const pour = (lip, out, tan, w, drop) => {
      const st = makeStream(scene, uTime, [lip.clone().addScaledVector(out, -3.2), lip.clone().addScaledVector(out, 0.3), lip.clone().addScaledVector(out, 0.8).setY(lip.y - 0.8), lip.clone().addScaledVector(out, 1.0).setY(lip.y - drop)], w, () => tan);
      st.mesh.visible = true; st.mat.uniforms.reach.value = 1; st.mat.uniforms.tint.value.set(AQUA);
    };
    const fall = (isl, th, w, drop = 46) => {
      const out = new V3(Math.cos(th), 0, Math.sin(th)), r = rimR(isl, th) - 0.4, lip = new V3(isl.x + out.x * r, 0, isl.z + out.z * r);
      lip.y = surfY(isl, lip.x, lip.z) + 0.12;
      pour(lip, out, new V3(-out.z, 0, out.x), w, drop);
      crystal(isl, lip.x - out.x * 3.6 - isl.x, lip.z - out.z * 3.6 - isl.z, 0.7, AQUAS);
    };
    // small things underfoot: blades, pale stones, and mushrooms with a light in the cap. (None of them stops a foot.
    // They keep off the painted roads, and off whatever already stands somewhere.)
    const srnd = mulberry32(977);
    const scatter = (isl, n, road) => {
      const keep = road ? new THREE.CatmullRomCurve3(road.map(([ox, oz]) => new V3(isl.x + ox, 0, isl.z + oz))).getPoints(40).map((p) => [p.x, p.z, 2.9]) : [];
      for (let i = 0; i < n; i++) {
        const th = srnd() * TAU, r = Math.sqrt(srnd()) * (rimR(isl, th) - 0.9), kind = srnd(), k = 0.7 + srnd() * 0.7, p = on(isl, Math.cos(th) * r, Math.sin(th) * r);
        if ([...taken, ...keep].some(([x, z, d]) => (p.x - x) ** 2 + (p.z - z) ** 2 < d * d)) continue;
        if (kind < 0.62) for (let b = 0; b < 4; b++) {
          const a = srnd() * TAU, h = (0.35 + srnd() * 0.5) * k;
          add(place(new THREE.ConeGeometry(0.07 * k, h, 4), p.x + Math.cos(a) * 0.16 * k, p.y + h / 2 - 0.03, p.z + Math.sin(a) * 0.16 * k, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35), BLADES, { scale: 1.5, spread: 1 });
        } else if (kind < 0.86) add(place(new THREE.DodecahedronGeometry(0.3 * k, 0), p.x, p.y + 0.08 * k, p.z, srnd() * 3, srnd() * 3, 0, 1, 0.6, 1), STONE, { scale: 0.8, spread: 1 });
        else {
          add(place(new THREE.CylinderGeometry(0.07 * k, 0.1 * k, 0.5 * k, 5), p.x, p.y + 0.25 * k, p.z), STONE, { scale: 0.8 });
          soft.add(daub(place(new THREE.SphereGeometry(0.32 * k, 8, 4, 0, TAU, 0, Math.PI / 2), p.x, p.y + 0.45 * k, p.z), i % 2 ? AQUAS : PINKS, { scale: 1, spread: 1 }));
          glow(new V3(p.x, p.y + 0.6 * k, p.z), 1.9 * k, i % 2 ? 0x8ae8ff : 0xff9ae0, 0.4);
        }
      }
    };
    // crystals hanging under an island, with a light in each. (How far down the rock is there is how underside() makes it.)
    const hang = (isl, n) => {
      for (let i = 0; i < n; i++) {
        const th = srnd() * TAU, fr = 0.15 + srnd() * 0.6, r = rimR(isl, th) * fr, x = isl.x + Math.cos(th) * r, z = isl.z + Math.sin(th) * r;
        const y = isl.y - (isl.r * 1.15 + 7) * Math.pow(1 - Math.pow(fr, 4 / 3), 1.25) - 1.5, k = (0.7 + srnd() * 0.9) * Math.min(1.7, isl.r / 8);
        lights.add(daub(place(new THREE.OctahedronGeometry(0.5 * k), x, y - 1.2 * k, z, 0, th, 0, 1, 3, 1), i % 2 ? AQUAS : PINKS, { scale: 0.9, spread: 1 }));
        glow(new V3(x, y - 1.6 * k, z), 5 * k, i % 2 ? 0x8ae8ff : 0xff9ae0, 0.4);
      }
    };

    // ================================================================================== the first island
    this.first = island(START, dusk(301, 1024, ROAD.start));
    this.frameAt = on(START, 0, 10);                         // where the frame that leads back to the gallery stands
    tree(START, -13, -3, 1.5); tree(START, 14.5, 3, 1.15); tree(START, -9, 15, 1.0);
    for (const [ox, oz, k] of [[7, 17, 1.2], [-4, 5, 1.0], [11, -6, 1.3], [-12, -13, 1.1], [3.5, -7, 0.9], [-17, 6, 1.4], [18, -6, 1.0], [-2, -14, 0.8], [15, 13, 0.9]]) flower(START, ox, oz, k);
    crystal(START, 9, 11, 1.0, PINKS); crystal(START, -18, -7, 1.1, AQUAS);
    fall(START, 2.75, 4.5); fall(START, 0.55, 3);
    for (const th of [1.25, 3.7, 4.15, 5.25, 5.75]) banner(START, th);

    // ================================================================================== the gate, and the road of every colour
    const gate = island(GATE, dusk(302, 512, ROAD.gate));
    const up0 = seedbed.makeVine(laid(new THREE.CatmullRomCurve3((() => { const m = edge(START, GATE, 1.2).lerp(edge(gate, START, 1.2), 0.5); m.y += 2.2; return [edge(START, GATE, 6), edge(START, GATE, 1.2), m, edge(gate, START, 1.2), edge(gate, START, 4.5)]; })()).getSpacedPoints(64), 1.7), 1.7, 5);
    arch(edge(START, GATE, 7.6, 0), 0, -1);
    tree(GATE, -5.5, 1.5, 0.9); flower(GATE, 5, 3.5, 1.0); fall(GATE, 0.1, 2.4, 36); banner(GATE, 2.6);
    this.pool = island(BASE, dusk(311, 256));
    const south = new V3(GATE.x - 1, 0, GATE.z - 30), lip = new V3(8026, -46.5, 1254);
    arch(edge(gate, south, 3.4, 0), 0, -1, 3.4, 5.4);
    const walk = (pts, hw, pal) => { const v = seedbed.makeVine(pts, hw, 1, pal); v.shown = false; v.ghost.visible = false; v.set(1); return v; };
    // a long slide, down and round. (Wide: a fall from it is a long way back)
    walk(laid(new THREE.CatmullRomCurve3([edge(gate, south, 5), edge(gate, south, 1.2), new V3(7995, -40.6, 1293), new V3(7988, -42, 1281), new V3(7997, -43.5, 1268), new V3(8012, -45, 1259), lip, edge(BASE, lip, 1.2), edge(BASE, lip, 5)]).getSpacedPoints(100), 2.8), 2.8, RAINBOW);
    flower(BASE, -1.5, 4.5, 0.9); crystal(BASE, 5, 2.5, 0.8, PINKS);

    // ================================================================================== the observatory
    {
      const X = TOWER.x, Z = TOWER.z, R = TOWER.r, drum = (r0, r1, y0, y1) => add(place(new THREE.CylinderGeometry(r1, r0, y1 - y0, 28, 1, true), X, (y0 + y1) / 2, Z), STONE, { scale: 0.1, spread: 0.6 });
      const ledge = (r, y) => add(place(new THREE.TorusGeometry(r, 0.5, 6, 30), X, y, Z, Math.PI / 2, 0, 0), STONE, { scale: 0.3 });
      add(place(new THREE.ConeGeometry(R * 1.12, 26, 14), X, -85, Z, Math.PI, 0, 0), CRYSTAL, { scale: 0.12 });          // the rock it grows out of
      drum(R * 1.12, R, -72, -46); drum(R, R * 0.94, -46, -24); drum(R * 0.94, R * 0.9, -24, TOP.y - 2);
      ledge(R * 1.14, -72); ledge(R * 1.03, -46); ledge(R * 0.98, -24);
      // its windows, lit
      for (const [y, n, r, h] of [[-64, 9, R * 1.09, 2.6], [-55, 9, R * 1.04, 2.6], [-40, 8, R * 0.99, 2.4], [-31, 8, R * 0.96, 2.4], [-20, 7, R * 0.93, 1.8]]) for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + y * 0.13;
        lit(place(new THREE.BoxGeometry(1.0, h, 0.3), X + Math.cos(a) * r, y, Z + Math.sin(a) * r, 0, Math.PI / 2 - a, 0));
        lit(place(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10, 1, false, 0, Math.PI), X + Math.cos(a) * r, y + h / 2, Z + Math.sin(a) * r, Math.PI / 2, 0, Math.PI / 2 - a + Math.PI / 2));
      }
      world.colliders.push({ x: X, z: Z, r: R * 1.12, top: TOP.y - 1.5, late: true });
      block.push([X, Z, R * 1.14 + 0.6, TOP.y]);
      // the rings that turn about its head, and the star over them
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff0cc, fog: false });
      this.rings = [[10, 0.5, 0.2, 0.11], [12, -0.35, 0.9, -0.08], [14, 0.15, -0.6, 0.06]].map(([r, rx, rz, spin]) => {
        const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.3, 6, 64), ringMat), hold = new THREE.Group();
        m.rotation.x = Math.PI / 2; hold.add(m); hold.rotation.set(rx, 0, rz); hold.position.set(X, TOP.y + 15, Z);
        scene.add(hold);
        return { hold, m, spin };
      });
      lit(place(new THREE.OctahedronGeometry(1.2), X, TOP.y + 32, Z, 0, 0, 0, 1, 3.2, 0.4)); lit(place(new THREE.OctahedronGeometry(1.2), X, TOP.y + 32, Z, 0, 0, 0, 2.4, 1, 0.4));
      glow(new V3(X, TOP.y + 32, Z), 30, 0xfff0c8, 0.75);
    }
    // the stones that hang round it, in a rising spiral
    this.beads = [];
    let a = Math.atan2(BASE.z - TOWER.z, BASE.x - TOWER.x), y = BASE.y;
    RISE.forEach((rise, i) => {
      y += rise;
      const isl = island({ x: TOWER.x + Math.cos(a) * RING, y, z: TOWER.z + Math.sin(a) * RING, r: 2.8, ph: i * 1.7 }, dusk(320 + i, 128));
      if (BEAD.includes(i)) {
        // a bead of light: step on it and it throws the painter up
        const hex = '#ffe9b0', pos = on(isl, 0, 0);
        const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 2), new THREE.MeshLambertMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.6, flatShading: true }));
        mesh.position.copy(pos); mesh.scale.set(1, 0.55, 1);
        scene.add(mesh);
        glow(new V3(pos.x, pos.y + 0.9, pos.z), 5, 0xffe9b0, 0.5);
        this.beads.push({ pos, mesh, hex, t: 0, top: new V3(pos.x, pos.y + 0.8, pos.z) });
      }
      a -= TURN;
    });
    island(TOP, dusk(312, 256), STONE);

    // ================================================================================== the three islands where the hour is set
    island(C, dusk(203, 1024, ROAD.c)); island(D, dusk(204, 1024, ROAD.d)); island(E, dusk(205, 1024, ROAD.e));
    tree(C, -5, 3, 0.75); tree(C, 5.8, -2, 0.65); crystal(C, 6.5, 3.4, 0.8, PINKS); flower(C, -6.5, -2.5, 0.9);
    tree(D, -8, 1, 1.05); tree(D, -3, -9, 0.8); tree(D, 9, -1, 0.8); crystal(D, -6, 6.5, 0.9, AQUAS); crystal(D, -9, -4.5, 0.9, PINKS);
    for (const [ox, oz, k] of [[0.5, 3, 1.1], [7, 6, 0.9], [-1, -4, 0.8]]) flower(D, ox, oz, k);
    fall(D, 2.9, 3.5); banner(D, 2.1); banner(D, 4.1); banner(D, 5.9);
    tree(E, -5.5, -1, 0.8); crystal(E, 5, 4.5, 0.8, AQUAS); flower(E, 6, -3, 1.0);
    arch(edge(E, FIELD, 3.2, 0), FIELD.x - E.x, FIELD.z - E.z);

    // --- three more bridges, drawn and not yet there: a vine, which stands by day, and two paths of evening light
    const span = (I, J, in0, in1, arch_, n) => {
      const mid = edge(I, J, 1.2).lerp(edge(J, I, 1.2), 0.5); mid.y += arch_;
      return laid(new THREE.CatmullRomCurve3([edge(I, J, in0), edge(I, J, 1.2), mid, edge(J, I, 1.2), edge(J, I, in1)]).getSpacedPoints(n), 1.7);
    };
    // not a vine: a ribbon of evening light. (Both faces: it is walked on, so it is mostly seen from above)
    const light = new THREE.MeshBasicMaterial({ color: 0xdcd0ff, fog: false, side: THREE.DoubleSide });
    const path = (I, J, arch_) => { const v = seedbed.makeVine(span(I, J, 4.5, 6, arch_, 56), 1.7, 5); v.mesh.material = light; return v; };
    const cd = path(C, D, 1.2), de = seedbed.makeVine(span(D, E, 6, 4.5, 2.2, 64), 1.7, 5), ef = path(E, FIELD, 0.6);

    // ================================================================================== the small things, last
    for (const [isl, ox, oz, d] of [[START, 5.5, -15.5, 3.2], [START, 0, 10, 5], [TOP, 1.5, 2, 3], [C, 1.9, -4.5, 3], [C, 0.9, 3.9, 3], [D, 5.3, -5.8, 3.2], [E, 3.5, 0.5, 3]]) { taken.push([isl.x + ox, isl.z + oz, d]); block.push([isl.x + ox, isl.z + oz, d > 4 ? 2.6 : 1.4, isl.y + (d > 4 ? 6.5 : 5.2)]); }      // (the frame, and the six sketches)
    {
      // a telescope on the roof of the observatory, trained on the moon
      const p = on(TOP, 4, -2.6), aim = MOON.clone().sub(p).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), aim), eye = new V3(p.x, p.y + 1.55, p.z);
      const along = (g, d) => { g.applyQuaternion(q); g.translate(eye.x + aim.x * d, eye.y + aim.y * d, eye.z + aim.z * d); return g; };
      add(along(new THREE.CylinderGeometry(0.36, 0.24, 3.4, 10), 0.5), GOLD, { scale: 0.8 });
      add(along(new THREE.CylinderGeometry(0.44, 0.44, 0.3, 10), 2.2), STONE, { scale: 0.8 });
      lit(along(new THREE.CylinderGeometry(0.33, 0.33, 0.06, 10), 2.37));
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.4; add(place(new THREE.CylinderGeometry(0.05, 0.07, 1.75, 5), p.x + Math.cos(a) * 0.42, p.y + 0.8, p.z + Math.sin(a) * 0.42, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5), GOLD, { scale: 0.8 }); }
      world.colliders.push({ x: p.x, z: p.z, r: 0.5, top: p.y + 2.6, late: true }); taken.push([p.x, p.z, 1.6]); block.push([p.x, p.z, 1.3, p.y + 3.6]);
      this.scope = { at: p.clone(), eye: eye.clone().addScaledVector(aim, 16) };          // (where it stands; and where the eye is when looking through it, which is out past the rings: one of them would cross the view)
    }
    scatter(START, 95, ROAD.start); scatter(gate, 18, ROAD.gate); scatter(BASE, 12); scatter(TOP, 9); scatter(C, 18, ROAD.c); scatter(D, 34, ROAD.d); scatter(E, 18, ROAD.e);
    hang(START, 8); hang(GATE, 3); hang(BASE, 3); hang(C, 3); hang(D, 5); hang(E, 3);

    // ================================================================================== things only to be looked at
    // islands nobody can reach, a long way off on every side
    [[7940, -30, 1330, 7, 1], [8075, -36, 1345, 6, 1], [7950, -58, 1250, 8, 2], [8095, -20, 1180, 7, 1], [7935, -2, 1175, 6, 2], [8070, 10, 1120, 8, 1], [7930, 8, 1050, 7, 1], [8062, -10, 1040, 6, 2], [8085, -52, 1290, 5, 0], [7962, -42, 1205, 5, 1]].forEach(([x, h, z, r, what], i) => {
      const isl = { x, y: h, z, r, ph: i * 2.1 };
      bag.add(underside(isl, 5, 18, CRYSTAL));
      add(place(new THREE.CylinderGeometry(r * 0.98, r * 0.9, 0.7, 16), x, h - 0.25, z), DUSK, { scale: 0.3, spread: 1 });
      if (what) treeAt(new V3(x + (what === 2 ? -r * 0.3 : 0), h, z), r * 0.14, false);
      hang(isl, 2);
      if (what === 2) { const th = i * 1.3, out = new V3(Math.cos(th), 0, Math.sin(th)); pour(new V3(x + out.x * r * 0.9, h + 0.1, z + out.z * r * 0.9), out, new V3(-out.z, 0, out.x), r * 0.4, 50); }
    });
    // the sky of this picture: a moon with a serpent of rock asleep round it, a galaxy, and stars that can be counted
    this.sky = new THREE.Group(); this.sky.visible = false;
    {
      const cv = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
      const moon = new THREE.Mesh(new THREE.SphereGeometry(105, 40, 24), new THREE.MeshBasicMaterial({ fog: false, map: cv(512, (x, n) => {
        x.fillStyle = '#eadcff'; x.fillRect(0, 0, n, n);
        for (let i = 0; i < 260; i++) {
          const px = rnd() * n, py = rnd() * n, r = 6 + rnd() * rnd() * 46;
          x.fillStyle = ['#d6c0f6', '#fff6ea', '#c6acee', '#f4e4ff', '#dcc8f8'][i % 5]; x.globalAlpha = 0.3 + rnd() * 0.4;
          x.beginPath(); x.ellipse(px, py, r, r * (0.5 + rnd() * 0.5), rnd() * TAU, 0, TAU); x.fill();
        }
        x.globalAlpha = 1;
      }) }));
      moon.position.copy(MOON); moon.rotation.y = 1.1;
      const halo = glowSprite(world.glowTex, 520, 0xcbb4ff, 0.42); halo.position.copy(MOON);
      this.galaxy = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), new THREE.MeshBasicMaterial({ fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: cv(512, (x, n) => {
        const dot = (px, py, r, col, al) => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = al; x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); };
        x.fillStyle = '#000'; x.fillRect(0, 0, n, n);
        for (let i = 0; i < 2400; i++) {
          const t = Math.pow(rnd(), 0.8), arm = (i % 2) * Math.PI, ang = arm + t * 6.4 + (rnd() - 0.5) * (0.5 + t * 0.5), r = t * n * 0.47;
          dot(n / 2 + Math.cos(ang) * r, n / 2 + Math.sin(ang) * r * 0.62, 3 + rnd() * 11, t < 0.22 ? '#ffe6b8' : t < 0.5 ? '#ff8ad6' : t < 0.78 ? '#a070ff' : '#5ab8ff', 0.1 + rnd() * 0.14);
        }
        dot(n / 2, n / 2, n * 0.11, '#fff4d8', 0.95);
      }) }));
      this.galaxy.position.copy(GALAXY); this.galaxy.lookAt(HEART);
      this.sky.add(moon, halo, this.galaxy);
      this.stars = Array.from({ length: 64 }, (_, i) => {
        const th = rnd() * TAU, el = 0.12 + rnd() * 1.2, d = 880, q = glowSprite(world.glowTex, 5 + rnd() * rnd() * 13, [0xffffff, 0xffe9c0, 0xd8c8ff, 0xbfe8ff][i % 4], 0.8);
        q.position.set(HEART.x + Math.cos(th) * Math.cos(el) * d, HEART.y + Math.sin(el) * d, HEART.z + Math.sin(th) * Math.cos(el) * d);
        this.sky.add(q);
        return { q, ph: rnd() * TAU, sp: 0.6 + rnd() * 1.6 };
      });
      // a serpent of rock, asleep round the moon: its tail hangs under it, its coils lie on it from the bottom nearly to
      // the top, and its head is laid down across them on the side the picture sees, with its eyes shut. It is cut in
      // flat faces, worn, cracked, a little mossed, and crystals have grown on it; their light comes and goes slowly,
      // all together, as breath does. (Unlit, like everything in this sky: its shading is in its colours.)
      const R = 105, TURNS = 3, a1 = Math.PI / 2 - 1.9, pts = [], sun = new V3(0.3, 0.8, 0.52).normalize(), bag = new Bag(), rk = mulberry32(4411);
      const ring = (a, h, r) => new V3(Math.cos(a) * r, h, Math.sin(a) * r), sph = (a, h, far) => ring(a, h, Math.sqrt(far * far - h * h));
      for (let k = 6; k >= 1; k--) pts.push(ring(a1 - TAU * TURNS - k * 0.3, -86 - k * 9, 70 + k * 3));
      for (let i = 0; i <= 80; i++) { const h = -86 + (158 * i) / 80; pts.push(ring(a1 - TAU * TURNS * (1 - i / 80), h, Math.sqrt(R * R - h * h) + 9)); }
      pts.push(sph(a1 + 0.2, 86, 121), sph(a1 + 0.5, 74, 132), sph(a1 + 0.8, 50, 137), sph(a1 + 1.0, 32, 138), sph(a1 + 1.22, 23, 138), sph(a1 + 1.45, 20, 138));          // (its neck: over the last coil, down, and then along the one below)
      const curve = new THREE.CatmullRomCurve3(pts), N = 240, M = 7, thick = (u) => 11 * Math.min(1, 0.08 + u * 6) ** 0.7;
      const ink = (h) => new THREE.Color(h), LO = ink('#2a2650'), HI = ink('#7a74a6'), RIM = ink('#cfc6ee'), MOSS = ink('#4a8a88'), CRACK = ink('#14122c'), LID = ink('#0e0c22');
      const c = new THREE.Color(), n = new V3(), A = new V3(), B = new V3(), C3 = new V3(), Y = new V3(0, 1, 0), q4 = new THREE.Quaternion();
      const wear = (k) => { const r = rk(); if (r < 0.06) c.lerp(CRACK, 0.6); else if (k > 0.72 && r < 0.2) c.lerp(MOSS, 0.5); };          // (cracks anywhere, moss where it faces up)
      // (one colour to a face, by how much the face is turned to the light: that is what makes it cut stone)
      const put = (g, lo, hi, tone) => {
        g.deleteAttribute('uv'); g.deleteAttribute('normal');
        const flat = g.index ? g.toNonIndexed() : g, P = flat.attributes.position, arr = new Float32Array(P.count * 3);
        flat.clearGroups();
        for (let t = 0; t < P.count / 3; t++) {
          A.fromBufferAttribute(P, t * 3); B.fromBufferAttribute(P, t * 3 + 1); C3.fromBufferAttribute(P, t * 3 + 2);
          const k = 0.5 + 0.5 * n.subVectors(B, A).cross(C3.sub(A)).normalize().dot(sun);
          c.copy(lo).lerp(hi, k).lerp(RIM, k * k * k * 0.35).multiplyScalar(0.86 + 0.24 * rk());
          if (tone) tone(t, k); else wear(k);
          for (let v = 0; v < 3; v++) { arr[(t * 3 + v) * 3] = c.r; arr[(t * 3 + v) * 3 + 1] = c.g; arr[(t * 3 + v) * 3 + 2] = c.b; }
        }
        flat.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        return bag.add(flat);
      };
      const plain = (h) => (t, k) => c.copy(h).multiplyScalar(0.75 + 0.3 * k);          // (one colour, only shaded)
      const cone = (p, dir, r, h, lo, hi, tone, sides = 5) => { const g = new THREE.ConeGeometry(r, h, sides); g.applyQuaternion(q4.setFromUnitVectors(Y, dir)); g.translate(p.x + (dir.x * h) / 2, p.y + (dir.y * h) / 2, p.z + (dir.z * h) / 2); return put(g, lo, hi, tone); };
      // its body: few faces, none of them quite where a smooth body would have it, and a groove cut round it every so often
      const body = new THREE.TubeGeometry(curve, N, 1, M, false), bp = body.attributes.position, bn = body.attributes.normal, outs = [];
      for (let i = 0; i <= N; i++) {
        const mid = curve.getPointAt(i / N), w = thick(i / N) * (1 + 0.07 * Math.sin(i * 0.9));
        outs.push(mid.clone().normalize());
        let first = 1;
        for (let j = 0; j <= M; j++) { const v = i * (M + 1) + j, k = j === M ? first : 0.86 + 0.28 * rk(); if (!j) first = k; n.fromBufferAttribute(bn, v); bp.setXYZ(v, mid.x + n.x * w * k, mid.y + n.y * w * k, mid.z + n.z * w * k); }
      }
      put(body, LO, HI, (t, k) => { if (Math.floor((t >> 1) / M) % 6 === 0) c.multiplyScalar(0.62); wear(k); });
      // shards down its back, swept toward the tail: no two the same height, and some broken off
      for (let i = 10; i < N - 2; i += 2) { const u = i / N, w = thick(u), h = w * (0.5 + 1.1 * rk()) * (0.8 + 0.6 * u); if (rk() < 0.3) continue; cone(curve.getPointAt(u).addScaledVector(outs[i], w * 0.8), outs[i].clone().multiplyScalar(0.75).addScaledVector(curve.getTangentAt(u), -0.65).normalize(), w * 0.26, h, LO, HI, null, 4); }
      { const back = curve.getTangentAt(0).negate(), fan = new V3().crossVectors(back, outs[0]).normalize(), tip = curve.getPointAt(0); for (const a of [-0.45, 0, 0.45]) cone(tip, back.clone().multiplyScalar(Math.cos(a)).addScaledVector(fan, Math.sin(a)), 2, a ? 22 : 32, LO, HI, null, 4); }
      this.serpent = new THREE.Group();
      // crystals grown on it here and there, with a light in each
      [30, 62, 95, 121, 150, 178, 205].forEach((i, e) => {
        const u = i / N, w = thick(u), mid = curve.getPointAt(u), out = outs[i], hue = e % 2 ? '#ff9ae0' : '#8ae8ff';
        for (let b = 0; b < 3; b++) {
          const dir = out.clone().add(new V3(rk() - 0.5, rk() - 0.5, rk() - 0.5).multiplyScalar(0.9)).normalize(), g = new THREE.OctahedronGeometry(1), h = w * (0.9 + rk());
          g.scale(w * 0.3, h, w * 0.3); g.applyQuaternion(q4.setFromUnitVectors(Y, dir)); g.translate(mid.x + out.x * w * 0.7 + dir.x * h * 0.6, mid.y + out.y * w * 0.7 + dir.y * h * 0.6, mid.z + out.z * w * 0.7 + dir.z * h * 0.6);
          put(g, LO, HI, plain(ink(hue)));
        }
        const q = glowSprite(world.glowTex, 34, e % 2 ? 0xff9ae0 : 0x8ae8ff, 0.5); q.position.copy(mid).addScaledVector(out, w * 1.9);
        this.serpent.add(q); this.stars.push({ q, ph: 0, sp: 0.6 });
      });
      // its head: long and flat, a wedge, laid on its own coils with the chin down and the eyes shut. One horn is whole;
      // the other broke off long ago. (Built looking along +z with its crown away from the moon, then laid where it lies.)
      const end = pts[pts.length - 1], away = end.clone().normalize(), fwd = curve.getTangentAt(1).addScaledVector(away, -0.22).normalize();
      const side = new V3().crossVectors(away, fwd).normalize(), up = new V3().crossVectors(fwd, side), face = new THREE.Matrix4().makeBasis(side, up, fwd);
      const head = end.clone().addScaledVector(fwd, 24), off = (x, y, z) => head.clone().addScaledVector(side, x).addScaledVector(up, y).addScaledVector(fwd, z);
      const rel = (x, y, z) => new V3().addScaledVector(side, x).addScaledVector(up, y).addScaledVector(fwd, z).normalize();
      const part = (g, p, lo, hi, tone) => { g.applyMatrix4(face); g.translate(p.x, p.y, p.z); return put(g, lo, hi, tone); };
      const lump = (p, sx, sy, sz, lo, hi, tone) => { const g = new THREE.SphereGeometry(1, 9, 6); g.scale(sx, sy, sz); return part(g, p, lo, hi, tone); };
      const wedge = (p, r, h, press, lo, hi, tone) => { const g = new THREE.ConeGeometry(r, h, 7); g.rotateX(Math.PI / 2); g.translate(0, 0, h / 2); g.scale(1, press, 1); return part(g, p, lo, hi, tone); };
      lump(head, 21, 13, 30, LO, HI);                                                      // the back of the skull
      wedge(off(0, 0, 6), 19, 66, 0.52, LO, HI);                                           // the snout
      wedge(off(0, -6, 2), 16, 62, 0.34, LO, HI);                                          // the lower jaw, shut under it
      for (const z of [10, -2, -14]) cone(off(0, 11, z), rel(0, 0.6, -0.8), 3.4, 12 + rk() * 12, LO, HI, null, 4);
      this.headAt = off(0, 4, 20);                                                         // (what the telescope is first trained on)
      for (const sx of [-1, 1]) {
        lump(off(sx * 13, 9, 16), 9, 3.5, 17, LO, HI);                                     // brow
        lump(off(sx * 16.8, 4.5, 21), 2.2, 1.1, 9, LID, LID, plain(LID));                  // eye: shut, a dark line
        cone(off(sx * 10, 10, -14), rel(sx * 0.3, 0.5, -0.82), sx < 0 ? 4.4 : 5.4, sx < 0 ? 70 : 24, LO, HI);
        cone(off(sx * 16, 3, -16), rel(sx * 0.6, 0.12, -0.8), 3.2, 30 + rk() * 16, LO, HI, null, 4);
        for (const a of [-0.25, 0.05, 0.35]) cone(off(sx * 18, -3, -12), rel(sx * 0.62, a, -0.78), 2.8, 18 + rk() * 18, LO, HI, null, 4);
      }
      this.serpent.add(bag.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
      this.serpent.position.copy(MOON); this.serpent.rotation.set(0, 0.47, 0.32);          // (it faces the picture, and its coils lie aslant)
      this.sky.add(this.serpent);
      // a star that falls, now and then
      this.shoot = { m: new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xfff4d8, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), vel: new V3(), wait: 5, life: 0 };
      this.shoot.m.scale.set(1.3, 1.3, 38); this.shoot.m.visible = false;
      this.sky.add(this.shoot.m);
    }
    scene.add(this.sky);
    // motes of light adrift over the islands that are walked on
    {
      const at = [];
      for (const [isl, count] of [[START, 70], [GATE, 16], [BASE, 14], [TOP, 12], [C, 18], [D, 32], [E, 18]]) for (let i = 0; i < count; i++) { const th = srnd() * TAU, r = Math.sqrt(srnd()) * isl.r * 1.15; at.push(isl.x + Math.cos(th) * r, isl.y + 0.8 + srnd() * srnd() * 11, isl.z + Math.sin(th) * r); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(at, 3));
      this.motes = new THREE.Points(g, new THREE.PointsMaterial({ map: world.glowTex, size: 0.6, color: 0xfff0c8, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      this.motes.frustumCulled = false; this.motes.visible = false;
      scene.add(this.motes);
    }
    // three shoals of koi, of the three colours in the tubes, swimming the air. Each fish has a way of its own, round the
    // ground its shoal keeps to, and half of them go the other way round. Each keeps whatever is painted over it, on top
    // of its own colour; Cream gives it its own colour back.
    {
      // (nose toward +z. The body is pearl, as a koi's is, and what is of the shoal's colour lies on it in patches;
      // the tail and the fin on its back are of that colour too. Three ways of being patched, so no two side by side match)
      const PEARL = ['#fffaf0', '#f4ecfa', '#ffffff', '#e8e0f4'], INK = ['#ffffff', '#f2f2f2', '#dedede'], DARK = ['#1a1426', '#1a1426'];
      const fan = (pts) => { const a = []; for (let i = 1; i < pts.length - 1; i++) a.push(...pts[0], ...pts[i], ...pts[i + 1]); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); g.computeVertexNormals(); return g; };
      const both = (pts) => [pts, pts.map(([x, y, z]) => [-x, y, z])];
      const shape = () => { const g = new THREE.LatheGeometry(new THREE.SplineCurve([[0.02, -2.3], [0.2, -2.1], [0.34, -1.5], [0.55, -0.7], [0.72, 0.1], [0.76, 0.8], [0.66, 1.5], [0.46, 2.05], [0.24, 2.36], [0.02, 2.46]].map(([r, y]) => new THREE.Vector2(r, y))).getPoints(18), 14); g.rotateX(Math.PI / 2); g.scale(0.74, 1.06, 1); return g; };
      const pb = new Bag();
      pb.add(daub(shape(), PEARL, { scale: 0.7, spread: 1 }));
      for (const pts of both([[0.5, -0.2, 1.2], [1.5, -0.55, 0.95], [1.75, -0.7, 0.35], [1.35, -0.62, -0.2], [0.62, -0.4, 0.25]])) pb.add(daub(fan(pts), PEARL, { spread: 1 }));      // the fins at its sides
      for (const pts of both([[0.3, -0.62, -0.3], [0.8, -1.05, -0.6], [0.6, -1.05, -1.1], [0.25, -0.72, -1.0]])) pb.add(daub(fan(pts), PEARL, { spread: 1 }));                            // and those under it
      pb.add(daub(fan([[0, -0.45, -1.2], [0, -1.0, -1.5], [0, -0.82, -1.95], [0, -0.3, -1.85]]), PEARL, { spread: 1 }));
      for (const k of [-1, 1]) {
        pb.add(daub(place(new THREE.SphereGeometry(0.115, 8, 6), k * 0.31, 0.2, 1.9), DARK));                                 // eyes
        pb.add(daub(place(new THREE.ConeGeometry(0.035, 0.55, 4), k * 0.2, -0.22, 2.5, 1.95, 0, k * -0.5), PEARL));            // whiskers
      }
      const patches = (seed) => {
        const p = shape().toNonIndexed().attributes.position, keep = [];
        for (let i = 0; i < p.count; i += 3) {
          const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
          if (y > -0.12 + 0.25 * Math.sin(z * 2.3 + seed) && Math.sin(z * 1.55 + seed * 1.7) + 0.55 * Math.sin(z * 3.1 + x * 4 + seed * 0.6) > -0.25) for (let k = 0; k < 3; k++) keep.push(p.getX(i + k) * 1.05, p.getY(i + k) * 1.05, p.getZ(i + k) * 1.02);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); g.computeVertexNormals();
        const b = new Bag(); b.add(daub(g, INK, { scale: 0.8, spread: 1 }));
        b.add(daub(fan([[0, 0.74, 1.0], [0, 1.32, 0.5], [0, 1.42, -0.15], [0, 1.16, -0.9], [0, 0.46, -1.35]]), INK, { spread: 1 }));      // the fin on its back
        return b.mesh(null).geometry;
      };
      // (the tail is long and forked, and hinged where it meets the body, so that it can follow a beat behind)
      const tailGeo = (() => { const pts = [[0, 0, 0.15]]; for (let i = 0; i <= 10; i++) { const a = (i / 10 - 0.5) * 1.4, rr = 1.2 + 1.7 * Math.abs(Math.sin(a * 2.24)); pts.push([0, Math.sin(a) * rr, -Math.cos(a) * rr]); } return daub(fan(pts), INK, { scale: 0.9, spread: 1 }); })();
      const pearl = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), body = pb.mesh(null).geometry, marks = [0.4, 2.3, 4.1].map(patches);
      // (each round goes low over ground that is walked on, so its fish can be reached; red and yellow cross by the
      // foot of the slide, yellow and blue between the observatory and the island after it. The yellow go up round the
      // observatory and past its roof, not over it: the rings come down too near the roof for a fish to pass under)
      const ROUNDS = {
        r: [[8012, -45.5, 1402], [7986, -45, 1368], [7988, -40, 1336], [8003, -34.5, 1314], [8026, -41, 1296], [8032, -44.5, 1262], [8040, -44, 1300], [8034, -46, 1368]],
        y: [[8040, -44, 1250], [8030, -44, 1264], [8018, -38, 1240], [8024, -24, 1206], [8040, -13, 1192], [8066, -14, 1204], [8070, -24, 1228], [8060, -36, 1244]],
        b: [[8038, -10, 1186], [8034, -5, 1166], [8012, -9, 1140], [7990, -9, 1120], [7982, -6, 1092], [8006, 1, 1064], [8034, -1, 1096], [8044, -4, 1150]],
      };
      // a point of a fish's way, moved clear of whatever stands in the picture: over the ground of an island (and up
      // to it, coming from below), over what is low, round what is tall, and outside the rings of the observatory
      const isles = world.islands.filter((q) => q.name === 'Three Tubes');
      const fix = (p) => {
        for (let again = 0; again < 2; again++) {
          for (const [x, z, r, top, bot = -1e9] of block) {
            const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz), need = r + 1.6;
            if (d >= need || p.y > top + 1.6 || p.y < bot - 1.6) continue;
            if (bot > -1e8) p.y = p.y > (top + bot) / 2 ? top + 1.6 : bot - 1.6;
            else if (top + 1.6 - p.y < 2.6) p.y = top + 1.6;
            else { const k = need / Math.max(d, 0.01); p.x = x + dx * k; p.z = z + dz * k; }
          }
          for (const isl of isles) {
            const dx = p.x - isl.x, dz = p.z - isl.z, d = Math.hypot(dx, dz), rim = rimR(isl, Math.atan2(dz, dx)) + 1.2;
            if (d < rim + 13) p.y = Math.max(p.y, (d < rim ? surfY(isl, p.x, p.z) : isl.y) + 2.6 - Math.max(0, d - rim) * 0.75);
          }
          const dx = p.x - TOWER.x, dz = p.z - TOWER.z, d = Math.hypot(dx, dz);
          if (d < 17 && p.y > TOP.y - 5) { p.x = TOWER.x + (dx / d) * 17; p.z = TOWER.z + (dz / d) * 17; }       // (and outside the rings)
        }
      };
      const N = 140, course = (shoal, back) => {
        const ctrl = ROUNDS[shoal].map(([x, y, z]) => new V3(x + (srnd() - 0.5) * 9, y + srnd() * 2.2, z + (srnd() - 0.5) * 9));
        if (back) ctrl.reverse();
        let pts = new THREE.CatmullRomCurve3(ctrl, true).getSpacedPoints(N).slice(0, N);
        // (cleared, and then eased, so that a way does not turn a corner where something was in it; and cleared once more)
        for (let pass = 0; pass < 5; pass++) { pts.forEach(fix); pts = pts.map((p, j) => p.clone().multiplyScalar(0.5).addScaledVector(pts[(j + N - 1) % N], 0.25).addScaledVector(pts[(j + 1) % N], 0.25)); }
        pts.forEach(fix);
        const curve = new THREE.CatmullRomCurve3(pts, true); curve.arcLengthDivisions = N * 4;
        return curve;
      };
      this.koi = [];
      for (const shoal of ['r', 'y', 'b']) for (let i = 0; i < 6; i++) {
        const curve = course(shoal, i % 2 === 1), mat = new THREE.MeshBasicMaterial({ vertexColors: true, color: MIX[shoal], side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        const mesh = new THREE.Group(), swim = new THREE.Group(), tail = new THREE.Mesh(tailGeo, mat), light = glowSprite(world.glowTex, 6, MIX[shoal], 0.4);
        tail.position.z = -2.2;
        swim.add(new THREE.Mesh(body, pearl), new THREE.Mesh(marks[this.koi.length % 3], mat), tail, light); mesh.add(swim);
        mesh.scale.setScalar(0.8 + srnd() * 0.45); mesh.visible = false;
        scene.add(mesh);
        this.koi.push({ shoal, curve, len: curve.getLength(), mesh, swim, tail, mat, light, coat: [shoal], hex: MIX[shoal], u: (i / 6 + srnd() * 0.1) % 1, sp: 3.6 + srnd() * 2.6, ph: srnd() * TAU, pos: curve.getPointAt(0) });
      }
      this.koiT = 0; this.koiI = 0; this.koiMix = 0;
    }
    // paper moths, each hanging over the light in a flower's cup, not yet any colour. Painted, one keeps the colour
    // (two colours laid on quickly mix), and goes to fly with the others round the rings of the observatory.
    {
      const wing = new THREE.BufferGeometry();
      wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.32, 0.72, 0, 0.52, 0.56, 0, -0.46, 0, 0, 0.32, 0.56, 0, -0.46, 0, 0, -0.3], 3));
      this.moths = [[START, -4, 5, 1.0], [START, 11, -6, 1.3], [START, -12, -13, 1.1], [GATE, 5, 3.5, 1.0], [BASE, -1.5, 4.5, 0.9], [C, -6.5, -2.5, 0.9], [D, 0.5, 3, 1.1], [D, 7, 6, 0.9], [E, 6, -3, 1.0]].map(([isl, ox, oz, k], i) => {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), g = new THREE.Group(), wings = [new THREE.Mesh(wing, mat), new THREE.Mesh(wing, mat)], halo = glowSprite(world.glowTex, 2.6, 0xffffff, 0.45);
        wings[1].scale.x = -1; g.add(...wings, halo);
        const perch = on(isl, ox, oz, 2.0 * k + 0.75);
        g.position.copy(perch); g.rotation.y = i * 2.3;
        scene.add(g);
        return { g, wings, mat, halo, perch, coat: [], hex: null, state: 'rest', t: 0, from: new V3(), ph: i * 1.9, r: 9.5 + (i % 4) * 1.7, h: 10 + (i % 5) * 2.4, sp: (0.34 + (i % 3) * 0.07) * (i % 2 ? 1 : -1) };
      });
    }
    // fireworks over the village at the far end: specks from the first island, and from under them most of the sky
    {
      // (the specks are dabs laid on, each one whole and strong in colour: light added to a sky this pale does not show)
      const N = 64, burst = () => {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
        const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 8, transparent: true, opacity: 0, depthWrite: false, fog: false }));
        pts.frustumCulled = false; pts.visible = false;
        scene.add(pts);
        return { pts, vel: new Float32Array(N * 3), life: 9, at: new V3() };
      };
      this.works = { list: [burst(), burst(), burst(), burst(), burst()], wait: 2, N };
      this.festive = true;          // (main says when the village has stopped keeping its feast)
    }
    this.lights = lights.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    this.lights.frustumCulled = false;
    const pale = soft.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })); pale.frustumCulled = false;
    scene.add(this.lights, pale);

    // --- six sketches, each wanting a colour that is not in any tube
    const ghost = ghostMaterial(uTime);
    const sketch = (key, wants, pos, parts) => {
      const g = new Bag(); for (const p of parts) g.add(daub(p, ['#ffffff']));
      const outline = g.mesh(ghost); outline.position.copy(pos); outline.renderOrder = 3;
      const body = new THREE.Mesh(outline.geometry, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000, flatShading: true })); body.position.copy(pos); body.visible = false;
      const halo = glowSprite(world.glowTex, 7, MIX[wants], 0.5); halo.position.set(pos.x, pos.y + 1.6, pos.z);
      // (what it gives off once it is made: a lamp its fire, a lantern its light)
      const glow = glowSprite(world.glowTex, key === 'eve' ? 11 : 9, key === 'eve' ? 0xc8b0ff : 0xffa040, 0); glow.position.set(pos.x, pos.y + (key === 'eve' ? 3.7 : 3), pos.z); glow.visible = key !== 'seed';
      scene.add(outline, body, halo, glow);
      world.colliders.push({ x: pos.x, z: pos.z, r: 0.7, late: true });
      return { key, wants, pos, coat: [], done: false, once: false, outline, body, halo, glow, top: new V3(pos.x, pos.y + 1.5, pos.z) };
    };
    const seed = (isl, ox, oz) => sketch('seed', 'by', on(isl, ox, oz), [place(new THREE.IcosahedronGeometry(0.72, 1), 0, 1.1, 0, 0, 0, 0, 1, 1.45, 1), place(new THREE.CylinderGeometry(0.1, 0.16, 0.5, 6), 0, 0.25, 0)]);
    // a lamp: a post, a bowl, a flame
    const lamp = (isl, ox, oz) => sketch('lamp', 'ry', on(isl, ox, oz), [place(new THREE.CylinderGeometry(0.13, 0.2, 1.7, 6), 0, 0.85, 0), place(new THREE.CylinderGeometry(0.95, 0.5, 0.6, 10), 0, 2.0, 0), place(new THREE.ConeGeometry(0.5, 1.2, 8), 0, 2.9, 0)]);
    // a lantern for the evening: a tall pole and a round light
    const lantern = (isl, ox, oz) => sketch('eve', 'br', on(isl, ox, oz), [place(new THREE.CylinderGeometry(0.1, 0.16, 3.2, 6), 0, 1.6, 0), place(new THREE.IcosahedronGeometry(0.7, 1), 0, 3.7, 0), place(new THREE.TorusGeometry(0.95, 0.07, 5, 18), 0, 3.7, 0)]);
    // (in the order they are met: the palette, the top of the yellow tube, and then the picture; the lamp on C is met,
    // as something needed, only after the seed on D)
    this.sketches = [seed(this.first, 5.5, -15.5), lamp(TOP, 1.5, 2), lantern(C, 1.9, -4.5), seed(D, 5.3, -5.8), lamp(C, 0.9, 3.9), lantern(E, 3.5, 0.5)];
    // what stands when: a vine by day, once its seed is green; a path of light in the evening
    this.links = [{ v: up0, seed: this.sketches[0] }, { v: cd }, { v: de, seed: this.sketches[3] }, { v: ef }];

    this.mesh = bag.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2a2440 }), { scale: 1.1, amp: 0.5 }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    world.paintable.push(this.mesh);

    this.night = false;       // the hour, which the lanterns set: all of them are lit, or none
    this.arrived = false;     // has the painter reached the field at the far end?
    this.eve = 0;             // how far the evening has come on (0 day .. 1 dusk)
    this.events = []; this.fleckT = 0; this.fleckI = 0;
    this.clock = 0; this.saidAt = {};
    this._v = new V3(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
  }

  /** Is this point inside the picture? (It lies far to the east, beyond the gallery.) */
  contains(p) { return p.x > 7000 && p.x < 10000; }
  get done() { return this.arrived; }
  /** How far along the picture is, 0..3: for the copy of it that hangs in the hall, and for the music. */
  get made() { return this.arrived ? 3 : Math.min(2, this.sketches.filter((s) => s.once).length >> 1); }
  open(l) { return l.seed ? l.seed.done && !this.night : this.night; }

  /** Show a sketch as it now stands: an outline, or painted in whatever has been laid on it. */
  show(s) {
    const mix = s.coat.slice().sort().join('');
    s.body.visible = s.coat.length > 0;
    if (mix) { s.body.material.color.set(MIX[mix]); s.body.material.emissive.set(MIX[mix]).multiplyScalar(s.done ? 0.45 : 0.15); }
    s.outline.visible = s.coat.length === 0;          // (the drawing and the paint are the same shape in the same place: shown together, they flicker)
  }
  /** What a finished sketch does. A seed and a lamp stay as they are; a lantern lights every lantern. */
  finish(s) {
    if (s.key === 'eve') return this.setNight(true);
    s.done = s.once = true; s.coat = s.wants.split('');
    this.show(s);
  }
  /** The hour: evening when the lanterns are lit, day when Cream has taken them back to paper. */
  setNight(on) {
    this.night = on;
    for (const s of this.sketches) if (s.key === 'eve') { s.done = on; if (on) s.once = true; s.coat = on ? s.wants.split('') : []; this.show(s); }
  }

  /** A swing of the brush landing at (x, z), from a painter standing at `p`. Returns what it did. */
  strike(x, z, p, hex) {
    const out = [], kind = kindOf(hex);
    if (!kind || !this.contains(p)) return out;
    for (const s of this.sketches) {
      if ((s.done && !(s.key === 'eve' && kind === 'cream')) || Math.abs(s.pos.y - p.y) > 3.5) continue;
      if ((s.pos.x - x) ** 2 + (s.pos.z - z) ** 2 > 3.4 * 3.4 && (s.pos.x - p.x) ** 2 + (s.pos.z - p.z) ** 2 > 3 * 3) continue;
      if (kind === 'cream') { if (s.coat.length) { const day = s.done; if (day) this.setNight(false); else { s.coat.length = 0; this.show(s); } out.push({ type: 'wipe', hex, at: s.top, day }); } continue; }
      if (s.coat.includes(kind)) continue;                      // (more of the same colour is still that colour)
      s.coat.push(kind);
      const mix = s.coat.slice().sort().join('');
      if (mix === s.wants) { this.finish(s); out.push({ type: 'made', key: s.key, hex: MIX[mix], at: s.top }); }
      else { this.show(s); out.push({ type: s.coat.length > 1 ? 'wrong' : 'coat', hex: MIX[mix], at: s.top }); }
    }
    // a fish swimming by takes the colour over its own; a moth takes it, and waits a moment in case there is another
    for (const k of this.koi) {
      if (Math.abs(k.pos.y - p.y - 2) > 6 || ((k.pos.x - x) ** 2 + (k.pos.z - z) ** 2 > 25 && (k.pos.x - p.x) ** 2 + (k.pos.z - p.z) ** 2 > 20)) continue;
      if (kind === 'cream') { if (k.coat.length < 2) continue; k.coat = [k.shoal]; } else { if (k.coat.includes(kind)) continue; k.coat.push(kind); }
      this.tint(k); out.push({ type: 'coat', hex: k.hex, at: k.pos.clone() });
    }
    for (const m of this.moths) {
      const q = m.g.position;
      if ((m.state !== 'rest' && m.state !== 'wet') || Math.abs(q.y - p.y) > 5 || ((q.x - x) ** 2 + (q.z - z) ** 2 > 3.4 * 3.4 && (q.x - p.x) ** 2 + (q.z - p.z) ** 2 > 9)) continue;
      if (kind === 'cream') { if (!m.coat.length) continue; m.coat = []; m.state = 'rest'; }
      else { if (m.coat.includes(kind)) continue; m.coat.push(kind); m.state = 'wet'; m.t = m.coat.length > 1 ? 1.2 : 2.6; }
      this.dye(m); out.push({ type: 'coat', hex: m.hex || '#ffffff', at: q.clone() });
    }
    return out;
  }
  /** A fish, in what is on it now. */
  tint(k) { k.hex = MIX[k.coat.slice().sort().join('')]; k.mat.color.set(k.hex); k.light.material.color.set(k.hex); }
  /** A moth, in what is on it now: paper, until something is. */
  dye(m) { m.hex = m.coat.length ? MIX[m.coat.slice().sort().join('')] : null; m.mat.color.set(m.hex || '#ffffff'); m.halo.material.color.set(m.hex || '#ffffff'); }
  /** Where a moth that has flown is, on its round about the rings. */
  round(m, t, out) { const a = m.ph + t * m.sp; return out.set(TOWER.x + Math.cos(a) * m.r, TOP.y + m.h + Math.sin(t * 0.7 + m.ph) * 1.2, TOWER.z + Math.sin(a) * m.r); }
  /** What the telescope is trained on: the head of the serpent on the moon. */
  scopeAim(out) { return out.copy(this.headAt).applyMatrix4(this.serpent.matrixWorld); }

  /** How fast the air is rising under this point: only over a lamp, once it is lit. */
  thermal(p) {
    for (const s of this.sketches) {
      if (s.key !== 'lamp' || !s.done) continue;
      const q = s.pos, h = p.y - q.y;
      if (h > -0.6 && h < 21 && (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 5.5 * 5.5) return 12 * clamp((20 - h) / 5, 0, 1);
    }
    return 0;
  }

  /** The next thing to mix, for the flecks that drift toward it. */
  goal() { const s = this.sketches.find((q) => !q.once); return s ? s.pos : null; }

  /** Something to say, once, about where the painter is standing. */
  waiting(p) {
    if (!this.contains(p)) return null;          // (also on a later visit: the hour can still be set, and still needs saying)
    const [seed, lamp, eve, seed2, lamp2] = this.sketches, near = (s, d) => s.pos.distanceTo(p) < d;
    if (!seed.done && near(seed, 9)) return { key: 'mixgreen', loud: true, line: 'It wants green, and there is no green in the tubes. Blue, and then yellow on top.' };
    if (!lamp.done && near(lamp, 8)) return { key: 'mixorange', line: 'It wants orange.' };
    if (!eve.once && near(eve, 8)) return { key: 'mixviolet', line: 'It wants violet.' };
    // the picture's own rule, said where it bites, and then each step of the way round it, said where that step is taken
    // (these are said again whenever the painter comes back to the same fix: a line said once and missed is a dead end)
    if (seed2.done && this.night && near(seed2, 8)) return this.again({ key: 'shut2', loud: true, line: 'Green things close while the lanterns are lit. It will not open until the evening is put out, and it was lit on the island behind you.' });
    if (seed2.done && this.night && near(eve, 8)) return this.again({ key: 'unpaint2', loud: true, line: 'Cream takes paint back to paper. Even the evening: paint the lantern with Cream.' });
    if (eve.once && !this.night && !lamp2.done && near(lamp2, 9)) return this.again({ key: 'lampway', loud: true, line: 'The path went with the evening. This lamp wants orange: its warm air will carry you over.' });
    const once = (key, line) => (key in this.saidAt ? null : ((this.saidAt[key] = this.clock), { key, line }));
    if (this.moths.some((m) => m.state === 'rest' && m.g.position.distanceTo(p) < 7)) { const say = once('moth', 'A paper moth, not yet any colour.'); if (say) return say; }
    if (this.made > 0 && this.koi.some((k) => k.pos.distanceTo(p) < 11)) { const say = once('koi', 'The fish are the colours of the three tubes. They keep whatever is painted over them.'); if (say) return say; }
    if (this.made === 0 && p.distanceTo(this.frameAt) < 12) return { key: 'tubes', loud: true, line: 'This picture was painted with three tubes: red, yellow and blue. Here they are all your brush has. Anything else has to be mixed.' };
    return null;
  }

  /** A line that may be said more than once, but not more often than every forty seconds. */
  again(thing) {
    if (this.clock - (this.saidAt[thing.key] ?? -1e9) < 40) return null;
    this.saidAt[thing.key] = this.clock;
    return { ...thing, again: true };
  }

  save() { return { coats: this.sketches.map((s) => (s.key === 'eve' ? (s.once ? 'once' : s.coat.join('')) : s.done ? 'done' : s.coat.join(''))), night: this.night ? 1 : 0, at: this.arrived ? 1 : 0, koi: this.koi.map((k) => k.coat.join('')), moths: this.moths.map((m) => m.coat.join('')) }; }
  /** `all`: a journey that had already got past this level when it was a different one. */
  load(d, all = false) {
    const coats = d && Array.isArray(d.coats) ? d.coats : [];
    this.sketches.forEach((s, i) => {
      const c = all ? 'done' : coats[i];
      s.done = s.once = false;
      if (c === 'done' || c === 'once') { if (s.key === 'eve') s.once = true; else this.finish(s); }
      else { s.coat = typeof c === 'string' ? c.split('').filter((k, n, list) => 'ryb'.includes(k) && list.indexOf(k) === n) : []; this.show(s); }
    });
    this.arrived = all || !!(d && d.at);
    this.setNight(all || !!(d && (d.night ?? coats[2] === 'done')));
    for (const l of this.links) l.v.set(this.open(l) ? 1 : 0);
    this.eve = this.night ? 1 : 0;
    const kept = (list, i) => (d && Array.isArray(list) && typeof list[i] === 'string' ? list[i] : '').split('').filter((k, n, all) => 'ryb'.includes(k) && all.indexOf(k) === n);
    this.koi.forEach((k, i) => { k.coat = [k.shoal, ...kept(d && d.koi, i).filter((c) => c !== k.shoal)]; this.tint(k); });
    this.moths.forEach((m, i) => { m.coat = kept(d && d.moths, i); m.state = m.coat.length ? 'round' : 'rest'; m.g.scale.setScalar(m.coat.length ? 1.8 : 1); this.dye(m); });
  }

  update(dt, t, player) {
    const ev = this.events, ease = (k) => 1 - Math.exp(-k * dt);
    ev.length = 0; this.clock = t;
    for (const s of this.sketches) {
      // a seed that is green but shut for the evening looks shut: it sinks, and goes dull
      if (s.key === 'seed' && s.done) { s.body.scale.y += ((this.night ? 0.62 : 1) - s.body.scale.y) * ease(3); s.body.material.emissiveIntensity = this.night ? 0.2 : 1; }
      s.halo.material.opacity = s.done ? 0 : 0.42 + Math.sin(t * 1.6 + s.pos.x) * 0.14;
      // the lamps burn, the lanterns shine
      const g = s.glow.material; g.opacity += ((!s.done ? 0 : s.key === 'eve' ? 0.7 : 0.6 + Math.sin(t * 9) * 0.06) - g.opacity) * ease(s.key === 'eve' ? 2 : 3);
    }
    // the evening comes on slowly; what belongs to the other hour folds away, and what belongs to this one stands
    // (the frame lets the painter in on the first island, which has no lantern: arriving there in the evening, from
    // an older save or on a second visit, the vine would be shut and there would be no way on. So it is day there.)
    if (this.night && player && Math.abs(player.pos.y - START.y) < 8 && (player.pos.x - START.x) ** 2 + (player.pos.z - START.z) ** 2 < (START.r + 3) ** 2) this.setNight(false);
    this.eve += ((this.night ? 1 : 0) - this.eve) * ease(0.35);
    for (const l of this.links) { const to = this.open(l) ? 1 : 0, p = l.v.progress; if (p !== to) l.v.set(to > p ? p + dt / 5 : p - dt / 2.5); }
    if (player && !this.arrived && player.grounded && Math.abs(player.pos.y - FIELD.y) < 6 && (player.pos.x - FIELD.x) ** 2 + (player.pos.z - FIELD.z) ** 2 < 22 * 22) { this.arrived = true; ev.push({ type: 'arrived' }); }
    // the sky of this picture is only over this picture: the stars and the galaxy come out as the evening does
    const here = !!player && this.contains(player.pos);
    this.sky.visible = this.motes.visible = here;
    for (const k of this.koi) k.mesh.visible = here;
    for (const b of this.works.list) b.pts.visible = here && b.life < 2.4;
    if (here) {
      this.galaxy.material.opacity = 0.42 + 0.58 * this.eve; this.galaxy.rotateZ(dt * 0.006);
      for (const st of this.stars) st.q.material.opacity = (0.3 + 0.7 * this.eve) * (0.62 + 0.38 * Math.sin(t * st.sp + st.ph));
      for (const g of this.glows) g.q.material.opacity = g.op * (0.82 + 0.18 * Math.sin(t * 1.3 + g.ph)) * (0.8 + 0.4 * this.eve);
      for (const r of this.rings) r.m.rotation.z += r.spin * dt, r.hold.rotation.y += r.spin * 0.6 * dt;
      this.motes.position.y = Math.sin(t * 0.35) * 0.5; this.motes.material.opacity = (0.4 + 0.4 * this.eve) * (0.85 + 0.15 * Math.sin(t * 1.7));
      // the falling star: it waits, then crosses a part of the sky in a little over a second
      const sh = this.shoot;
      if (!sh.m.visible && (sh.wait -= dt) < 0) {
        const th = Math.random() * TAU, el = 0.45 + Math.random() * 0.6, turn = Math.random() < 0.5 ? 1 : -1;
        sh.m.position.set(HEART.x + Math.cos(th) * Math.cos(el) * 820, HEART.y + Math.sin(el) * 820, HEART.z + Math.sin(th) * Math.cos(el) * 820);
        sh.vel.set(-Math.sin(th) * turn, -0.4, Math.cos(th) * turn).normalize().multiplyScalar(430);
        sh.m.lookAt(sh.m.position.clone().add(sh.vel)); sh.life = 0; sh.m.visible = true;
      }
      if (sh.m.visible) {
        sh.life += dt; sh.m.position.addScaledVector(sh.vel, dt); sh.m.material.opacity = Math.sin((Math.PI * sh.life) / 1.3) * 0.9;
        if (sh.life > 1.3) { sh.m.visible = false; sh.wait = 7 + Math.random() * 12; }
      }
      // the koi go round; each leaves a fleck of its colour now and then, and where two of different shoals pass close,
      // there is a little of what the two colours make
      for (const k of this.koi) {
        k.u = (k.u + (k.sp * dt) / k.len) % 1;
        k.curve.getPointAt(k.u, k.pos); k.pos.y += Math.sin(t * 0.8 + k.ph) * 0.25;
        const m = k.mesh, beat = t * (2.2 + k.sp * 0.25) + k.ph;
        m.position.copy(k.pos);
        // (it turns into its way, not all at once; the body sways, and the tail a beat after it)
        m.quaternion.slerp(this._q.setFromRotationMatrix(this._m.lookAt(k.curve.getTangentAt(k.u, this._v).add(k.pos), k.pos, m.up)), ease(5));
        k.swim.rotation.y = Math.sin(beat) * 0.14; k.tail.rotation.y = Math.sin(beat - 1.2) * 0.5;
      }
      if ((this.koiT -= dt) < 0) {
        this.koiT = 0.06;
        const k = this.koi[this.koiI++ % this.koi.length];
        if (k.pos.distanceTo(player.pos) < 90) ev.push({ type: 'spark', x: k.pos.x, y: k.pos.y, z: k.pos.z, hex: k.hex, n: 1 });
        if (t - this.koiMix > 1.5) for (const o of this.koi) if (o.shoal !== k.shoal && o.pos.distanceToSquared(k.pos) < 64) {
          this.koiMix = t;
          ev.push({ type: 'spark', x: (k.pos.x + o.pos.x) / 2, y: (k.pos.y + o.pos.y) / 2, z: (k.pos.z + o.pos.z) / 2, hex: MIX[[k.shoal, o.shoal].sort().join('')], n: 14 });
          break;
        }
      }
      // the moths: at rest they hang and fan; wet, they beat; then they go up to the rings and stay there
      for (const m of this.moths) {
        let beat = 1.6, spread = 0.75;
        if (m.state === 'rest') m.g.position.set(m.perch.x, m.perch.y + Math.sin(t * 1.3 + m.ph) * 0.18, m.perch.z);
        else if (m.state === 'wet') { beat = 22; spread = 0.5; if ((m.t -= dt) < 0) { m.state = 'fly'; m.t = 0; m.from.copy(m.g.position); ev.push({ type: 'moth', hex: m.hex, at: m.g.position.clone() }); } }
        else {
          beat = 13; spread = 0.45;
          this.round(m, t, this._v);
          if (m.state === 'fly') { m.t = Math.min(1, m.t + dt / 7); const e = m.t * m.t * (3 - 2 * m.t); this._v.lerpVectors(m.from, this._v, e).setY(this._v.y + Math.sin(e * Math.PI) * 9); m.g.scale.setScalar(1 + 0.8 * e); if (m.t >= 1) m.state = 'round'; }
          if (this._v.distanceToSquared(m.g.position) > 1e-6) m.g.rotation.y = Math.atan2(this._v.x - m.g.position.x, this._v.z - m.g.position.z);
          m.g.position.copy(this._v);
        }
        const a = spread + Math.sin(t * beat + m.ph) * (m.state === 'rest' ? 0.22 : 0.6);
        m.wings[0].rotation.z = a; m.wings[1].rotation.z = -a;
      }
      // the fireworks: one goes up every second or three, in a colour that had to be mixed
      const W = this.works;
      if (this.festive && (W.wait -= dt) < 0) {
        const b = W.list.find((q) => q.life >= 2.4), hex = [MIX.ry, MIX.by, MIX.br, '#ffe9b0', MIX.ry, MIX.br][Math.floor(Math.random() * 6)];
        W.wait = 0.9 + Math.random() * 2.6;
        if (b) {
          const at = b.pts.geometry.attributes.position.array;
          b.at.set(FIELD.x + (Math.random() - 0.5) * 46, FIELD.y + 55 + Math.random() * 35, FIELD.z + (Math.random() - 0.5) * 46);
          for (let i = 0; i < W.N; i++) {
            const th = Math.random() * TAU, cz = Math.random() * 2 - 1, sr = Math.sqrt(1 - cz * cz), sp = 45 + Math.random() * 25;          // (big: they have to be seen from the far end of the picture)
            at[i * 3] = b.at.x; at[i * 3 + 1] = b.at.y; at[i * 3 + 2] = b.at.z;
            b.vel[i * 3] = Math.cos(th) * sr * sp; b.vel[i * 3 + 1] = cz * sp; b.vel[i * 3 + 2] = Math.sin(th) * sr * sp;
          }
          b.pts.material.color.set(hex).offsetHSL(0, 0.25, -0.1); b.life = 0; b.pts.visible = true;
          ev.push({ type: 'firework', hex, d: b.at.distanceTo(player.pos) });
        }
      }
      for (const b of W.list) {
        if (b.life >= 2.4) continue;
        b.life += dt;
        const at = b.pts.geometry.attributes.position.array, drag = Math.exp(-1.5 * dt);
        for (let i = 0; i < W.N * 3; i += 3) { b.vel[i] *= drag; b.vel[i + 1] = b.vel[i + 1] * drag - 6 * dt; b.vel[i + 2] *= drag; at[i] += b.vel[i] * dt; at[i + 1] += b.vel[i + 1] * dt; at[i + 2] += b.vel[i + 2] * dt; }
        b.pts.geometry.attributes.position.needsUpdate = true;
        b.pts.material.opacity = Math.min(1, Math.max(0, 1 - b.life / 2.4) * 2.2);
      }
    }
    // a bead of light throws up whoever steps on it, and wobbles after
    for (const b of this.beads) {
      if (player && player.grounded && Math.abs(player.pos.y - b.pos.y) < 1 && (player.pos.x - b.pos.x) ** 2 + (player.pos.z - b.pos.z) ** 2 < 1.5 * 1.5) {
        player.vel.y = BOUNCE; player.grounded = false; player.jumps = 1; player.airTime = 1;
        b.t = 1; ev.push({ type: 'spring', at: b.top, hex: b.hex });
      }
      b.t = Math.max(0, b.t - dt * 1.6);
      const k = 0.55 + Math.sin(t * 2.4 + b.pos.x) * 0.035 - Math.sin(b.t * 16) * b.t * 0.28;
      b.mesh.scale.set(1 + (0.55 - k) * 0.6, k, 1 + (0.55 - k) * 0.6);
    }
    // warm air over a lit lamp sends up flecks, to show where it rises
    const lamps = player && this.contains(player.pos) ? this.sketches.filter((s) => s.key === 'lamp' && s.done && player.pos.distanceTo(s.pos) < 70) : [];
    this.fleckT -= dt;
    if (lamps.length && this.fleckT <= 0) {
      this.fleckT = 0.08 / lamps.length;
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 4.6, q = lamps[this.fleckI++ % lamps.length].pos;
      ev.push({ type: 'fleck', x: q.x + Math.cos(a) * d, y: q.y + 0.4 + Math.random() * 12, z: q.z + Math.sin(a) * d });
    }
    return ev;
  }
}
