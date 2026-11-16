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
const LIT = ['#ffe6a8', '#fff4d0', '#ffd27a'], AQUA = '#7ae8ff';

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
    const treeAt = (p, k, solid = true) => {
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
      add(place(new THREE.CylinderGeometry(0.05 * k, 0.09 * k, 1.5 * k, 5), p.x, p.y + 0.75 * k, p.z, 0, 0, 0.08), ['#6ad0c8', '#58b8c0', '#8ae0d0'], { scale: 0.8 });
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; soft.add(daub(place(new THREE.ConeGeometry(0.36 * k, 1.0 * k, 5), p.x + Math.cos(a) * 0.24 * k, p.y + 1.8 * k, p.z + Math.sin(a) * 0.24 * k, Math.PI + Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5), PETAL, { scale: 0.8, spread: 1 })); }
      glow(new V3(p.x, p.y + 2.0 * k, p.z), 3.8 * k, 0xffe2a8, 0.5);
    };
    // crystals, standing in a cluster
    const crystal = (isl, ox, oz, k, pal) => {
      const p = on(isl, ox, oz);
      for (const [dx, dz, h, t] of [[0, 0, 2.2, 0], [0.6, 0.2, 1.4, 0.35], [-0.5, 0.3, 1.2, -0.4], [0.1, -0.6, 1.0, 0.3]]) add(place(new THREE.OctahedronGeometry(0.42 * k), p.x + dx * k, p.y + h * 0.5 * k, p.z + dz * k, t * 0.6, dx, t, 1, h * 1.3, 1), pal, { scale: 0.9, spread: 1 });
      glow(new V3(p.x, p.y + 1.2 * k, p.z), 4.5 * k, pal === AQUAS ? 0x8ae8ff : 0xff9ae0, 0.34);
      world.colliders.push({ x: p.x, z: p.z, r: 0.7 * k, late: true });
    };
    // an arch of pale stone across a way that runs along (dx, dz), a star at its head
    const arch = (p, dx, dz, w = 3.2, h = 5) => {
      const yaw = Math.atan2(-dx, -dz), c = Math.cos(yaw), q = -Math.sin(yaw);
      for (const k of [-1, 1]) {
        const x = p.x + c * w * k, z = p.z + q * w * k;
        add(place(new THREE.BoxGeometry(1.1, h, 1.1), x, p.y + h / 2 - 0.2, z, 0, yaw, 0), STONE, { scale: 0.3 });
        add(place(new THREE.BoxGeometry(1.5, 0.45, 1.5), x, p.y + h, z, 0, yaw, 0), STONE, { scale: 0.3 });
        world.colliders.push({ x, z, r: 0.75, late: true });
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

    // ================================================================================== the first island
    this.first = island(START, dusk(301, 1024, [[0, 13], [9, 6], [-8, -2], [6, -11], [0, -22]]));
    this.frameAt = on(START, 0, 10);                         // where the frame that leads back to the gallery stands
    tree(START, -13, -3, 1.5); tree(START, 14.5, 3, 1.15); tree(START, -9, 15, 1.0);
    for (const [ox, oz, k] of [[7, 17, 1.2], [-4, 5, 1.0], [11, -6, 1.3], [-12, -13, 1.1], [3.5, -7, 0.9], [-17, 6, 1.4], [18, -6, 1.0], [-2, -14, 0.8], [15, 13, 0.9]]) flower(START, ox, oz, k);
    crystal(START, 9, 11, 1.0, PINKS); crystal(START, -18, -7, 1.1, AQUAS);
    fall(START, 2.75, 4.5); fall(START, 0.55, 3);
    for (const th of [1.25, 3.7, 4.15, 5.25, 5.75]) banner(START, th);

    // ================================================================================== the gate, and the road of every colour
    const gate = island(GATE, dusk(302, 512, [[0, 9], [3, 1], [0, -9]]));
    const up0 = seedbed.makeVine(new THREE.CatmullRomCurve3((() => { const m = edge(START, GATE, 1.2).lerp(edge(gate, START, 1.2), 0.5); m.y += 2.2; return [edge(START, GATE, 6), edge(START, GATE, 1.2), m, edge(gate, START, 1.2), edge(gate, START, 4.5)]; })()).getSpacedPoints(64), 1.7, 5);
    arch(edge(START, GATE, 7.6, 0), 0, -1);
    tree(GATE, -5.5, 1.5, 0.9); flower(GATE, 5, 3.5, 1.0); fall(GATE, 0.1, 2.4, 36); banner(GATE, 2.6);
    this.pool = island(BASE, dusk(311, 256));
    const south = new V3(GATE.x - 1, 0, GATE.z - 30), lip = new V3(8026, -46.5, 1254);
    arch(edge(gate, south, 3.4, 0), 0, -1, 3.4, 5.4);
    const walk = (pts, hw, pal) => { const v = seedbed.makeVine(pts, hw, 1, pal); v.shown = false; v.ghost.visible = false; v.set(1); return v; };
    // a long slide, down and round. (Wide: a fall from it is a long way back)
    walk(new THREE.CatmullRomCurve3([edge(gate, south, 5), edge(gate, south, 1.2), new V3(7995, -40.6, 1293), new V3(7988, -42, 1281), new V3(7997, -43.5, 1268), new V3(8012, -45, 1259), lip, edge(BASE, lip, 1.2), edge(BASE, lip, 5)]).getSpacedPoints(100), 2.8, RAINBOW);
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
    island(C, dusk(203, 1024, [[-1, 8], [4, 1], [-3.4, -4.5]])); island(D, dusk(204, 1024, [[4.8, 6], [-3, 1.5], [2.9, -7]])); island(E, dusk(205, 1024, [[-2.1, 5], [2, 0], [-0.9, -5.5]]));
    tree(C, -5, 3, 0.75); tree(C, 5.8, -2, 0.65); crystal(C, 6.5, 3.4, 0.8, PINKS); flower(C, -6.5, -2.5, 0.9);
    tree(D, -8, 1, 1.05); tree(D, -3, -9, 0.8); tree(D, 9, -1, 0.8); crystal(D, -6, 6.5, 0.9, AQUAS); crystal(D, -9, -4.5, 0.9, PINKS);
    for (const [ox, oz, k] of [[0.5, 3, 1.1], [7, 6, 0.9], [-1, -4, 0.8]]) flower(D, ox, oz, k);
    fall(D, 2.9, 3.5); banner(D, 2.1); banner(D, 4.1); banner(D, 5.9);
    tree(E, -5.5, -1, 0.8); crystal(E, 5, 4.5, 0.8, AQUAS); flower(E, 6, -3, 1.0);
    arch(edge(E, FIELD, 3.2, 0), FIELD.x - E.x, FIELD.z - E.z);

    // --- three more bridges, drawn and not yet there: a vine, which stands by day, and two paths of evening light
    const span = (I, J, in0, in1, arch_, n) => {
      const mid = edge(I, J, 1.2).lerp(edge(J, I, 1.2), 0.5); mid.y += arch_;
      return new THREE.CatmullRomCurve3([edge(I, J, in0), edge(I, J, 1.2), mid, edge(J, I, 1.2), edge(J, I, in1)]).getSpacedPoints(n);
    };
    // not a vine: a ribbon of evening light. (Both faces: it is walked on, so it is mostly seen from above)
    const light = new THREE.MeshBasicMaterial({ color: 0xdcd0ff, fog: false, side: THREE.DoubleSide });
    const path = (I, J, arch_) => { const v = seedbed.makeVine(span(I, J, 4.5, 6, arch_, 56), 1.7, 5); v.mesh.material = light; return v; };
    const cd = path(C, D, 1.2), de = seedbed.makeVine(span(D, E, 6, 4.5, 2.2, 64), 1.7, 5), ef = path(E, FIELD, 0.6);

    // ================================================================================== things only to be looked at
    // islands nobody can reach, a long way off on every side
    [[7940, -30, 1330, 7, 1], [8075, -36, 1345, 6, 1], [7950, -58, 1250, 8, 2], [8095, -20, 1180, 7, 1], [7935, -2, 1175, 6, 2], [8070, 10, 1120, 8, 1], [7930, 8, 1050, 7, 1], [8062, -10, 1040, 6, 2], [8085, -52, 1290, 5, 0], [7962, -42, 1205, 5, 1]].forEach(([x, h, z, r, what], i) => {
      const isl = { x, y: h, z, r, ph: i * 2.1 };
      bag.add(underside(isl, 5, 18, CRYSTAL));
      add(place(new THREE.CylinderGeometry(r * 0.98, r * 0.9, 0.7, 16), x, h - 0.25, z), DUSK, { scale: 0.3, spread: 1 });
      if (what) treeAt(new V3(x + (what === 2 ? -r * 0.3 : 0), h, z), r * 0.14, false);
      if (what === 2) { const th = i * 1.3, out = new V3(Math.cos(th), 0, Math.sin(th)); pour(new V3(x + out.x * r * 0.9, h + 0.1, z + out.z * r * 0.9), out, new V3(-out.z, 0, out.x), r * 0.4, 50); }
    });
    // the sky of this picture: a moon, a galaxy, and stars that can be counted
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
    }
    scene.add(this.sky);
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
  }

  /** Is this point inside the picture? (It lies far to the east, beyond the gallery.) */
  contains(p) { return p.x > 7000; }
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
    return out;
  }

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
    if (this.made === 0 && p.distanceTo(this.frameAt) < 12) return { key: 'tubes', loud: true, line: 'This picture was painted with three tubes: red, yellow and blue. Here they are all your brush has. Anything else has to be mixed.' };
    return null;
  }

  /** A line that may be said more than once, but not more often than every forty seconds. */
  again(thing) {
    if (this.clock - (this.saidAt[thing.key] ?? -1e9) < 40) return null;
    this.saidAt[thing.key] = this.clock;
    return { ...thing, again: true };
  }

  save() { return { coats: this.sketches.map((s) => (s.key === 'eve' ? (s.once ? 'once' : s.coat.join('')) : s.done ? 'done' : s.coat.join(''))), night: this.night ? 1 : 0, at: this.arrived ? 1 : 0 }; }
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
    this.sky.visible = here;
    if (here) {
      this.galaxy.material.opacity = 0.42 + 0.58 * this.eve; this.galaxy.rotateZ(dt * 0.006);
      for (const st of this.stars) st.q.material.opacity = (0.3 + 0.7 * this.eve) * (0.62 + 0.38 * Math.sin(t * st.sp + st.ph));
      for (const g of this.glows) g.q.material.opacity = g.op * (0.82 + 0.18 * Math.sin(t * 1.3 + g.ph)) * (0.8 + 0.4 * this.eve);
      for (const r of this.rings) r.m.rotation.z += r.spin * dt, r.hold.rotation.y += r.spin * 0.6 * dt;
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
