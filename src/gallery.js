import * as THREE from 'three';
import { rimR, surfY, islandTopGeo } from './world.js';
import { daub, place, Bag, paintify, glowSprite, drawStroke, mulberry32, clamp, smooth } from './util.js';
import { underside, makeStream, SPAN, STONE } from './underpainting.js';
import { PAGE } from './lastpage.js';
import { PAINTS } from './paint.js';
import { buildPainter } from './painter.js';
import { ghostMaterial } from './sketches.js';

// Varnishing Day: the third level. The painter steps out of the painting into the gallery where it hangs, the
// day before the doors open.
//
//   The Gallery    a round floor with the frames standing on it, each with its name on a plate. Stepping into a
//                  frame is stepping into its picture.
//   Three Tubes    the one picture that can be stepped into (see tubes.js): a picture painted with red, yellow and
//                  blue, where anything else has to be mixed. At its far end is a field, and in the field a Piper.
//                  The field is built here, because of what happens in it afterwards.
//
// And then it goes wrong. Once the three colours are mixed, one of the dust sheets is found on the floor, and the
// painting it covered is a painting of this room, in grey, with someone standing in it wherever the painter stands.
// Stepping into it leads to the same room with the colour gone out of it, the companions nowhere, every other
// frame shut, and somebody in each of the pictures. From here on the game is not the gentle one it began as.
//
// Somebody is in that room: a painter like this one, drawn and never painted. It only moves when it is not being
// looked at: while the painter's back is turned, and in the moments when the room goes dark. It does what the
// painter has learned to do: it lifts. Each time it reaches the painter one paint leaves their palette (two, later
// on), one more part of them is only an outline, one more part of the other is painted in, and the colour comes
// back into the room; then it is gone, and comes again from behind. Nothing is failed and nobody dies. When there is only Cream left it goes home in
// the painter's place. The one frame that opens after that is the empty one, and what hangs in it then is a portrait.
//
// From the moment the painter steps into that picture there is no colour anywhere, and after the portrait there never
// is again: the painter is left with Cream, which is blank, in a world in black and white.
//
// And the companions. A piper lives in the field at the end of Three Tubes, and is glad of company: the companions go to the piper, dance,
// and do not come away again. That is the happiest place in the game. Afterwards it is where they are found.
//
// And it does not stop at the portrait. One of the companions is not quite dead, and tries to come to the painter.
// The piper's tune is still in the clearing, running down. There is blood across the gallery floor, to the way
// home. The portrait is different every time it is come back to. The muse weeps. Somebody in the painter's colours
// is seen, far off, in the first painting, and is never there on arrival.
//
// There are two ways for it to end, and both are made with Cream, the one paint left: it takes paint back to paper.
// The painter can go to their own portrait and paint it out, and then there was never a painter: the journey is
// gone for good. Or they can follow the blood home. The other one is in the atelier, painting in the painter's
// colours, with its back to the door; painted out, it gives back what it took, and the colour comes home.
//
// It does not come from nowhere. Each time something is mixed the music loses a layer, and the dust sheet over that
// picture hangs a little lower every time the painter comes back into the room.
// (It all lives far to the east of everything else, in the same scene.)

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const HALL = { x: 4000, y: 0, z: 1000, r: 19, ph: 0.4, name: 'The Gallery', pale: true };
// (the field at the far end of Three Tubes: where the Piper is, and where the companions stay)
const SUMMER = { x: 8000, y: 0, z: 1000, r: 26, ph: 5.2, name: 'Three Tubes', pale: true, quiet: true };

const WOOD = ['#a87848', '#c29460', '#9c6c40', '#cda470', '#b4844f'];
export const MEADOW = ['#7f9a7a', '#93a888', '#6f8a78', '#a2b094', '#84a092'];
const PARCHED = ['#d2b477', '#e2cc96', '#c9a868', '#ead8a8', '#bf9c5c'];
export const EARTH = ['#8a6a50', '#a07c5c', '#75584a', '#b08e6a', '#6a5046'];
// Three Tubes: violet ground, and the dark crystal the islands hang by
export const DUSK = ['#6a4cc0', '#8058d0', '#4a34a0', '#a070e0', '#3c5cc8', '#c060d0', '#4c7ce0'];
export const CRYSTAL = ['#3a2478', '#4a2e96', '#2c1c64', '#5c3cb4', '#241650', '#7a44c8'];
const CLOTH = ['#efe8da', '#e2d9c8', '#f6f1e6', '#d6ccba'];
const GILT = ['#d9b25a', '#c99a3e', '#ecd084', '#b8862e'];
const WATER = '#58c0e8';

/** A ground canvas laid in brush strokes. `ang(i)` gives each stroke its direction; `extra` draws on top. */
export function ground(isl, size, base, pal, n, seed, ang = null, extra = null) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), r = mulberry32(seed), span = 2 * isl.r * SPAN, px = size / span;
  x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * isl.r * 1.2;
    drawStroke(x, (Math.cos(a) * d / span + 0.5) * size, (Math.sin(a) * d / span + 0.5) * size, ang ? ang(i) : r() * TAU, (1.4 + r() * 2.4) * px, (0.5 + r() * 0.8) * px, pal[i % pal.length], 'rgba(255,255,255,0.22)', 'rgba(0,0,0,0.14)', r);
  }
  if (extra) extra(x, (wx) => ((wx - isl.x) / span + 0.5) * size, (wz) => ((wz - isl.z) / span + 0.5) * size, px);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** A small painted canvas, for a frame. */
function picture(base, pal, seed, extra = null) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const x = c.getContext('2d'), r = mulberry32(seed);
  x.fillStyle = base; x.fillRect(0, 0, 256, 320);
  for (let i = 0; i < 120; i++) drawStroke(x, r() * 256, r() * 320, (r() - 0.5) * 0.7, 26 + r() * 50, 8 + r() * 12, pal[i % pal.length], 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.12)', r);
  if (extra) extra(x, r);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Someone, seen from behind (or from in front: there is no face either way), with a brush across their back. */
function figure(x, u, v, s, col, line = 0) {
  x.fillStyle = x.strokeStyle = col; x.lineWidth = line || 2.5 * s; x.lineCap = x.lineJoin = 'round';
  const lay = () => (line ? x.stroke() : x.fill());
  x.beginPath(); x.moveTo(u - 13 * s, v); x.lineTo(u + 13 * s, v); x.lineTo(u + 7 * s, v - 44 * s); x.lineTo(u - 7 * s, v - 44 * s); x.closePath(); lay();
  x.beginPath(); x.arc(u, v - 52 * s, 9 * s, 0, TAU); lay();
  x.beginPath(); x.rect(u - 12 * s, v - 61 * s, 24 * s, 4 * s); lay();
  x.beginPath(); x.moveTo(u + 12 * s, v - 6 * s); x.lineTo(u + 20 * s, v - 68 * s); x.stroke();
}
/** The meshes something is made of, lowest first, each remembering the material it was painted with. */
function partsOf(roots, skip = []) {
  const box = new THREE.Box3(), c = new V3(), list = [];
  for (const r of roots) r.traverse((o) => {
    if (!o.isMesh || skip.includes(o)) return;
    o.userData.real = o.material; o.userData.h = box.setFromObject(o).getCenter(c).y;
    list.push(o);
  });
  return list.sort((a, b) => a.userData.h - b.userData.h);
}
/** Leave `n` of those parts as a drawing (from the feet up, or from the head down) and the rest as they were painted. */
const dress = (parts, ghost, n, fromFeet) => parts.forEach((m, i) => { m.material = (fromFeet ? i < n : i >= parts.length - n) ? ghost : m.userData.real; });
/** A picture with somebody in it who was not there before. */
function haunted(tex, s = 1.2, v = 282) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const x = c.getContext('2d');
  x.drawImage(tex.image, 0, 0); figure(x, 128, v, s, '#f6f4ee');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** The gallery itself, as a picture: its floor, its frames, and in the middle the frame this picture hangs in. */
function roomPicture(empty) {
  const wall = empty ? ['#d6d4d8', '#e0dee2', '#cac8ce', '#e8e6ea'] : ['#b4b2b8', '#c0bec4', '#a8a6ac', '#c8c6cc'];
  return picture(wall[0], wall, empty ? 91 : 90, (x, r) => {
    const floor = empty ? ['#a09ea6', '#96949c', '#aaa8b0', '#8c8a92'] : ['#8a8890', '#807e86', '#94929a', '#76747c'];
    for (let i = 0; i < 70; i++) drawStroke(x, r() * 256, 240 + r() * 84, (r() - 0.5) * 0.3, 30 + r() * 50, 9 + r() * 10, floor[i % floor.length], 'rgba(255,255,255,0.2)', 'rgba(0,0,0,0.14)', r);
    const hang = (u, v, w, h, fill) => { x.fillStyle = fill; x.fillRect(u, v, w, h); x.strokeStyle = '#55535a'; x.lineWidth = 5; x.strokeRect(u, v, w, h); };
    hang(16, 98, 48, 62, '#8a888e'); hang(192, 98, 48, 62, '#a3a1a6');
    hang(92, 70, 72, 96, '#3a3840');
    x.fillStyle = '#6a686e'; x.fillRect(96, 140, 64, 22);
    if (!empty) figure(x, 128, 158, 0.24, '#c8c6cc');
  });
}

const giltMat = new THREE.MeshLambertMaterial({ color: 0xd9b25a, emissive: 0x4a3410, flatShading: true });
/** A gilt frame standing on the floor, `w` by `h` inside, with a picture in it (or bare boards). */
function plate(title, wide) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 124;
  const x = c.getContext('2d');
  x.fillStyle = '#f3e7c4'; x.fillRect(0, 0, 512, 124);          // (big heavy letters, dark on pale: the brushwork eats anything finer)
  x.strokeStyle = '#6a4a14'; x.lineWidth = 10; x.strokeRect(5, 5, 502, 114);
  x.fillStyle = '#17100a'; x.font = '700 60px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(title.toUpperCase(), 256, 66, 470);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(wide, (wide * 124) / 512), new THREE.MeshBasicMaterial({ map: t, fog: false }));
}
function frame(w, h, tex, title = null) {
  const g = new THREE.Group(), t = 0.36, y0 = 0.5;
  for (const [bw, bh, x, y] of [[w + 2 * t, t, 0, y0 + h + t / 2], [w + 2 * t, t, 0, y0 - t / 2], [t, h, -(w + t) / 2, y0 + h / 2], [t, h, (w + t) / 2, y0 + h / 2]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.34), giltMat); bar.position.set(x, y, 0); g.add(bar);
  }
  for (const s of [-1, 1]) { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 1.5), giltMat); foot.position.set(s * (w / 2), 0.17, 0); g.add(foot); }
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08).translate(0, y0 + h / 2, -0.08), new THREE.MeshLambertMaterial({ color: 0x4a4048, emissive: 0x16131a })));
  if (tex) { g.userData.pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, y0 + h / 2, 0.02), new THREE.MeshBasicMaterial({ map: tex, fog: false })); g.add(g.userData.pic); }
  if (title) { g.userData.plate = plate(title, Math.min(w - 0.2, 3.3)); g.userData.plate.position.set(0, y0 + 0.5, 0.09); g.add(g.userData.plate); }
  return g;
}

export class Gallery {
  /**
   * `atelier` is the middle of the Spire's hall: once the gallery has been found, a frame stands there that leads back to it.
   * `tubes` is the picture that can be stepped into.
   */
  constructor(scene, world, uTime, lastpage, atelier, tubes) {
    this.scene = scene; this.world = world; this.lastpage = lastpage; this.tubes = tubes; this.found = false;
    this.wiped = 0; this.unpainted = 0; this.undone = false;      // how much of the portrait, and of the other painter, has been painted out
    this.indoors = false;                                   // (the game says) in the Spire's atelier
    this.homeSpot = new V3(atelier.x, atelier.y, atelier.z - 8.5);
    this.greyK = 0;                                         // how far the colour has gone out of the gallery (it goes slowly)
    this.after = 0;                                         // how often the gallery has been come back to since the portrait
    this.outdoors = false; this.sightT = 12;                // (the game says) out in the first painting; and how long until somebody is seen there
    this.beatT = 0; this.holdT = 0; this.scared = false; this.crawled = false;
    const rb = mulberry32(9133);                            // (for what was added later, so that nothing laid out before it moves)
    this.slipped = false; this.grey = false; this.hung = [];
    this.ghost = ghostMaterial(uTime);
    this.shade = new THREE.MeshBasicMaterial({ color: 0x14121a, fog: false });       // the other painter, where it has not been painted yet: a dark shape
    this.gaze = new V3(0, 0, -1);                                                     // and which way it is looking
    this.away = 0; this.unseen = 0; this.blinkT = 7; this.blink = 0; this.stepT = 0; this.moved = false;
    this.close = 0; this.dark = 0;                                                    // for the game: how near it is (0..1), and whether the room is dark this frame
    this.eye = new V3();                                                              // where the camera is (the game says), so it can stand where it will be seen
    this.taken = 0; this.total = 7;          // paints lifted off the painter so far, out of how many they had (the game says)
    this.walk = 0; this.greyT = 0; this.whole = false; this.wholeT = 0; this.ended = false; this.ending = null;
    this.events = []; this._last = new V3();
    this.joined = false;                                    // the companions have gone to the piper
    this.lifts = 0; this.visits = 0; this._inHall = false;          // how often something has been lifted; how often the room has been come back to
    const bag = new Bag(), add = (g, pal, o) => bag.add(daub(g, pal, o)), r = mulberry32(5521);
    const island = (def, tex, rock) => {
      const isl = { ...def, index: world.islands.length };
      isl.tex = tex(isl); isl.span = 2 * isl.r * SPAN;
      world.islands.push(isl);
      scene.add(new THREE.Mesh(islandTopGeo(isl), paintify(new THREE.MeshLambertMaterial({ map: isl.tex }), { scale: 1, amp: 0.45 })));
      bag.add(underside(isl, 8, 40, rock));
      return isl;
    };
    const hall = island(HALL, (i) => ground(i, 1024, '#b98a5a', WOOD, 1500, 71, (k) => (k % 2 ? 1 : -1) * Math.PI / 4), [...WOOD, ...EARTH]);
    const summer = island(SUMMER, (i) => ground(i, 2048, '#6c5cb8', ['#6252ae', '#7a6cc8', '#5646a0', '#8c80d8', '#6a7ad0', '#9a70d0'], 2600, 73), CRYSTAL);
    this.hall = hall;

    // every frame that can be stepped through: where it stands, what E says, and where it leads
    this.doors = [];
    const stand = (g, at, facing) => { g.position.copy(at); g.rotation.y = Math.atan2(facing.x - at.x, facing.z - at.z); scene.add(g); world.colliders.push({ x: at.x, z: at.z, r: 1.7, late: true }); return g; };
    /** Coming out of a frame: a few steps in front of it, turned to walk along it, so the camera has room behind. */
    const arrive = (at, centre, isl, floor) => {
      const d = new V3(centre.x - at.x, 0, centre.z - at.z).normalize(), p = at.clone().addScaledVector(d, 5.5);
      p.y = floor(p.x, p.z);
      return { pos: p, heading: Math.atan2(d.x, d.z) + Math.PI / 2, island: isl.index };
    };
    const lit = (g, h) => { const glow = glowSprite(world.glowTex, 8, 0xffe6b0, 0.4); glow.position.set(0, 0.5 + h / 2, 0.9); g.add(glow); return g; };
    const flat = (isl) => (x, z) => surfY(isl, x, z);
    const hp = (a, rad) => { const x = HALL.x + Math.cos(a) * rad, z = HALL.z + Math.sin(a) * rad; return new V3(x, surfY(HALL, x, z), z); };
    const centre = (isl) => new V3(isl.x, isl.y, isl.z);

    // --- Three Tubes as it hangs in the gallery: three daubs of paint, and under them whatever has been mixed so far
    // (plain shapes with dark edges, so the picture can be told by its drawing when there is no colour to tell it by)
    const tubePic = (k) => picture('#efe6d4', ['#e8dcc6', '#f4ecdc', '#ddd0b8', '#f8f2e4'], 81, (x) => {
      const blob = (u, v, rad, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(u, v, rad, rad * 0.8, 0.3, 0, TAU); x.fill(); x.strokeStyle = 'rgba(30,20,40,0.6)'; x.lineWidth = 4; x.stroke(); };
      blob(62, 92, 32, PAINTS[0].hex); blob(128, 92, 32, PAINTS[1].hex); blob(194, 92, 32, PAINTS[6].hex);
      [[160, 180, PAINTS[7].hex], [96, 180, PAINTS[5].hex], [128, 254, PAINTS[3].hex]].forEach(([u, v, col], i) => {
        if (i < k) blob(u, v, 30, col);
        else { x.strokeStyle = 'rgba(30,20,40,0.45)'; x.lineWidth = 3; x.setLineDash([7, 7]); x.beginPath(); x.ellipse(u, v, 30, 24, 0.3, 0, TAU); x.stroke(); x.setLineDash([]); }
      });
    });
    const tubeList = [0, 1, 2, 3].map(tubePic);
    const pic = {
      hall: picture('#e8dcc8', ['#d9b25a', '#efe4d0', '#c8a070', '#f6eedf'], 83, (x) => { x.strokeStyle = '#8a6a3a'; x.lineWidth = 7; for (const [u, v] of [[40, 90], [150, 70], [96, 190]]) x.strokeRect(u, v, 64, 80); }),
      home: picture('#f6e2c0', PAINTS.slice(0, 8).map((p) => p.hex), 84, (x) => { const g = x.createRadialGradient(128, 150, 8, 128, 150, 150); g.addColorStop(0, 'rgba(255,246,214,0.9)'); g.addColorStop(1, 'rgba(255,246,214,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 320); }),
    };

    // --- the Gallery: frames round a wooden floor
    {
      const W = 3.6, H = 4.8;
      // the way in: a frame on the Blank Page (it stands once the sun is drawn). The way home leads to the Spire's
      // atelier, where a frame of its own stands from then on, so the gallery is never more than a step away.
      const backAt = (this.backAt = hp(Math.PI / 2, 15.5)), pageAt = new V3(PAGE.x, surfY(PAGE, PAGE.x, PAGE.z - 14.5), PAGE.z - 14.5), pageMid = new V3(PAGE.x, PAGE.y, PAGE.z);
      const homeAt = new V3(atelier.x + Math.sin(1.2 * Math.PI) * 9.6, atelier.y, atelier.z + Math.cos(1.2 * Math.PI) * 9.6);
      stand(lit(frame(W, H, pic.home, 'The Way Home'), H), backAt, centre(HALL));
      this.pageDoor = stand(lit(frame(W, H, pic.hall, 'The Gallery'), H), pageAt, pageMid);
      this.homeDoor = stand(lit(frame(W, H, pic.hall, 'The Gallery'), H), homeAt, new V3(atelier.x, 0, atelier.z + 8));
      this.homeCol = world.colliders[world.colliders.length - 1];
      this.entry = arrive(backAt, centre(HALL), hall, flat(HALL));
      const dir = new V3(atelier.x - homeAt.x, 0, atelier.z - homeAt.z).normalize(), h = Math.atan2(dir.x, dir.z);
      const welcome = ['Varnishing Day', 'The day before the doors open'];
      this.doors.push({ at: pageAt, text: 'Step through the frame', to: this.entry, toast: welcome, open: () => lastpage.done });
      this.doors.push({ at: homeAt, text: 'Step through the frame', to: this.entry, toast: welcome, open: () => this.found });
      // (in the atelier the camera goes out into the hall, looking back at the painter and the frame they stepped out of)
      this.doors.push({ at: backAt, text: 'Step back into the Spire', to: { pos: homeAt.clone().addScaledVector(dir, 3), heading: h, yaw: h }, toast: ['The Atelier', 'Inside the Spire'], out: true });

      // one picture that can be stepped into. Two frames inside it lead back here: one where the painter arrives,
      // and one in the field at its far end
      {
        const at = hp(Math.PI * 0.08, 15.5), whole = tubeList[3], first = tubes.first;
        this.hung.push({ at, pic: stand(lit(frame(W, H, tubeList[0], 'Three Tubes'), H), at, centre(HALL)).userData.pic, list: tubeList, greys: [haunted(whole), haunted(whole, 2.3, 336), haunted(whole, 4.6, 492)], stage: 0, seen: false });
        const sAt = new V3(SUMMER.x, 0, SUMMER.z + 20.5); sAt.y = surfY(SUMMER, sAt.x, sAt.z);
        const back = arrive(at, centre(HALL), hall, flat(HALL));
        stand(lit(frame(W, H, pic.hall, 'The Gallery'), H), tubes.frameAt, centre(first));
        stand(lit(frame(W, H, pic.hall, 'The Gallery'), H), sAt, centre(SUMMER));
        this.doors.push({ at, text: 'Step into Three Tubes', to: arrive(tubes.frameAt, centre(first), first, flat(first)), toast: ['Three Tubes', 'Red, yellow and blue'] });
        for (const inAt of [tubes.frameAt, sAt]) this.doors.push({ at: inAt, text: 'Step back into the Gallery', to: back, toast: ['The Gallery', ''], out: true });
        this.sAt = sAt;
      }
      // a picture hung after the others were: a frame here that leads into it, and frames inside it that lead back
      this.dunes = null;
      this.hang = (lvl) => {
        const at = hp(Math.PI * 0.3, 15.5), back = arrive(at, centre(HALL), hall, flat(HALL)), f0 = lvl.frames[0];
        stand(lit(frame(W, H, picture(...lvl.picture), lvl.title), H), at, centre(HALL));
        for (const f of lvl.frames) { f.mesh = stand(lit(frame(W, H, pic.hall, 'The Gallery'), H), f.at, f.face); f.collider = world.colliders[world.colliders.length - 1]; }          // (kept: a picture may have a frame that is not there yet)
        this.doors.push({ at, text: 'Step into ' + lvl.title, to: arrive(f0.at, f0.face, lvl.land,(x, z) => world.groundHeight(x, z, 1e9)), toast: lvl.toast });
        for (const f of lvl.frames) this.doors.push({ at: f.at, text: 'Step back into the Gallery', to: back, toast: ['The Gallery', ''], out: true, open: () => !f.open || f.open() });
        lvl.frameAt = at; this.dunes = lvl;
      };

      // two more are still under their dust sheets, and the biggest frame of all is empty
      const sheet = (at) => place(new THREE.BoxGeometry(W + 1.1, H + 0.9, 0.8, 6, 6, 1), at.x, at.y + 0.5 + H / 2 + 0.1, at.z, 0, Math.atan2(HALL.x - at.x, HALL.z - at.z), 0);
      this.draped = [-0.73, 0.92].map((f) => { const at = hp(Math.PI * f, 15.5); stand(frame(W, H, null), at, centre(HALL)); add(sheet(at), CLOTH, { scale: 0.5, spread: 1 }); return at; });
      // the other sheet comes off by itself, when the picture is finished and nobody is in the room to see it go.
      // What it covered is a picture of this room, painted afresh whenever the painter moves (see update)
      {
        const at = hp(Math.PI * -0.27, 15.5), n = new V3(HALL.x - at.x, 0, HALL.z - at.z).normalize();
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320;
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
        stand(frame(W, H, tex), at, centre(HALL));
        const cloth = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x18171c }), { scale: 1.1, amp: 0.5 });
        const on = new THREE.Mesh(daub(sheet(at), CLOTH, { scale: 0.5, spread: 1 }), cloth);
        const off = new THREE.Mesh(daub(place(new THREE.IcosahedronGeometry(1, 2), at.x + n.x * 2.4 + n.z * 1.2, at.y + 0.14, at.z + n.z * 2.4 - n.x * 1.2, 0, 0.7, 0, 2.1, 0.17, 1.4), CLOTH, { scale: 0.5, spread: 1 }), cloth);
        scene.add(on, off);
        this.odd = { at, n, right: new V3(n.z, 0, -n.x), cv, tex, on, off, key: '', rooms: [roomPicture(false), roomPicture(true)] };
        this.doors.push({ at, text: 'Step into the picture', to: arrive(at, centre(HALL), hall, flat(HALL)), odd: true, open: () => this.slipped && !this.ended });
      }
      this.empty = hp(-Math.PI / 2, 15.2);
      {
        // what will hang in it: a portrait in pencil. Until then, bare boards
        const paper = ['#ebe5da', '#e2dccf', '#f8f4ec', '#d8d2c6'];
        const scrawl = (x, r) => { x.strokeStyle = '#2a2830'; x.lineWidth = 5; x.lineCap = 'round'; for (let i = 0; i < 30; i++) { x.beginPath(); x.moveTo(16 + r() * 224, 16 + r() * 288); x.lineTo(16 + r() * 224, 16 + r() * 288); x.stroke(); } };
        this.portraits = [
          picture('#f1ece2', paper, 95, (x) => figure(x, 128, 298, 3.3, '#4a4854', 4)),
          picture('#f1ece2', paper, 95, (x) => figure(x, 92, 306, 3.9, '#4a4854', 4)),                               // it has moved
          picture('#f1ece2', paper, 95, (x) => figure(x, 128, 530, 7.4, '#3a3844', 5)),                              // it is nearer
          picture('#f1ece2', paper, 95, (x, r) => { figure(x, 128, 530, 7.4, '#3a3844', 5); scrawl(x, r); }),        // it has been scratched out
        ];
        const g = stand(frame(6.4, 7.6, this.portraits[0]), this.empty, centre(HALL));
        this.framePic = g.userData.pic; this.framePic.visible = false;
        this.frameGlow = glowSprite(world.glowTex, 13, 0xffffff, 0); this.frameGlow.position.set(0, 4.3, 1); g.add(this.frameGlow);
        this.doors.push({ at: this.empty, text: 'Step into the frame', to: arrive(this.empty, centre(HALL), hall, flat(HALL)), frame: true, open: () => this.whole && this.wholeT > 3.5 && !this.ended });
      }
      // afterwards: drops of red across the floor, from the frame of Three Tubes to the way home
      {
        const from = this.hung[0].at, to = this.backAt, blood = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.0, 0.012), fog: false, side: THREE.DoubleSide, transparent: true, opacity: 0, blending: THREE.NoBlending });          // (no alpha: that is how the picture knows it for blood)
        this.trail = new THREE.Group();
        for (let i = 0; i < 24; i++) {
          const f = (i + 0.5) / 24, x = from.x + (to.x - from.x) * f + (rb() - 0.5) * 1.1, z = from.z + (to.z - from.z) * f + (rb() - 0.5) * 1.1;
          const m = new THREE.Mesh(new THREE.CircleGeometry(i % 6 === 0 ? 0.48 : 0.1 + rb() * 0.2, 12).rotateX(-Math.PI / 2), blood);
          m.position.set(x, surfY(HALL, x, z) + 0.05, z); m.scale.z = 0.6 + rb() * 0.8; m.rotation.y = rb() * 3;
          this.trail.add(m);
        }
        this.trail.visible = false;
        scene.add(this.trail);
        // and in the first painting, the muse weeps
        this.tears = [1, -1].map((side) => {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(0.007, 0.17), blood);
          m.add(new THREE.Mesh(new THREE.CircleGeometry(0.0075, 12).translate(0, -0.088, 0), blood));          // (the drop it ends in)
          m.position.set(0.166, 0.56, side * 0.3125); m.visible = false;
          world.muse.add(m);
          return m;
        });
      }
      // the other painter stands in front of the way home
      {
        const m = buildPainter(); m.handBrush.visible = false; m.easelBrush.visible = false;
        const at = hp(Math.PI / 2, 11.5);
        m.root.position.copy(at); m.root.rotation.y = Math.PI; m.root.visible = false;
        scene.add(m.root); m.root.updateMatrixWorld(true);
        this.other = { root: m.root, at, parts: partsOf([m.root]), k: -1 };
      }
      world.colliders.push({ x: this.empty.x - 2.2, z: this.empty.z, r: 1.4, late: true }, { x: this.empty.x + 2.2, z: this.empty.z, r: 1.4, late: true });

      // a round bench in the middle, and more of the gallery hanging far off in the haze
      add(place(new THREE.CylinderGeometry(2.3, 2.3, 0.55, 20), HALL.x, HALL.y + 0.3, HALL.z), ['#7a3c34', '#8c4a3e', '#6a3230'], { scale: 0.5 });
      world.colliders.push({ x: HALL.x, z: HALL.z, r: 2.3, late: true });
      for (let k = 0; k < 9; k++) {
        const a = r() * TAU, d = 62 + r() * 60, w = 14 + r() * 16, h = w * (0.7 + r() * 0.7), x = HALL.x + Math.cos(a) * d, z = HALL.z + Math.sin(a) * d, y = -14 + r() * 40, ry = Math.atan2(HALL.x - x, HALL.z - z);
        add(place(new THREE.BoxGeometry(w + 2.4, h + 2.4, 0.8), x, y, z, 0, ry, 0), GILT, { scale: 0.2 });
        add(place(new THREE.BoxGeometry(w, h, 1.2), x, y, z, 0, ry, 0), [MEADOW, PARCHED, WOOD, CLOTH, ['#7f9ab0', '#9cb2c2', '#6c8aa2']][k % 5], { scale: 0.16, spread: 1 });
      }
    }

    // --- the village at the far end of Three Tubes: a spring and its stream, a pond, a mill, houses round a green, and
    // everybody out dancing to the Piper
    {
      const S = (this.summer = { wetK: [1, 1] });
      const sp = (a, rad) => { const x = SUMMER.x + Math.cos(a) * rad, z = SUMMER.z + Math.sin(a) * rad; return new V3(x, surfY(SUMMER, x, z), z); };
      const npcAt = sp(3.4, 6.5);
      const springAt = sp(1.95, 12), pondAt = sp(-1.35, 13), rimA = 0.4, rimAt = sp(rimA, rimR(SUMMER, rimA) + 0.2);
      const bed = new THREE.CatmullRomCurve3([springAt, sp(1.6, 11), sp(1.2, 12.5), sp(0.8, 16), sp(0.5, 21), rimAt]).getSpacedPoints(60);
      bed.forEach((p) => { p.y = surfY(SUMMER, p.x, p.z) + 0.1; });
      // the bed of the stream, and of the pond, drawn onto the ground
      {
        const cv = summer.tex.image, x = cv.getContext('2d'), span = summer.span, U = (wx) => ((wx - SUMMER.x) / span + 0.5) * cv.width, V = (wz) => ((wz - SUMMER.z) / span + 0.5) * cv.width, px = cv.width / span;
        x.lineCap = 'round'; x.lineJoin = 'round';
        x.strokeStyle = 'rgba(150,118,72,0.75)'; x.lineWidth = 1.5 * px; x.beginPath(); bed.forEach((p, i) => (i ? x.lineTo(U(p.x), V(p.z)) : x.moveTo(U(p.x), V(p.z)))); x.stroke();
        x.fillStyle = 'rgba(150,118,72,0.8)'; x.beginPath(); x.arc(U(pondAt.x), V(pondAt.z), 4.4 * px, 0, TAU); x.fill();
        summer.tex.needsUpdate = true;
      }
      const dry = () => new THREE.MeshBasicMaterial({ color: 0x9a8460, fog: false });
      const spot = (key, pos, rad, reach, lay, lift) => {
        add(place(new THREE.TorusGeometry(rad, rad * 0.16, 5, 22), pos.x, pos.y + 0.16, pos.z, Math.PI / 2, 0, 0), STONE, { scale: 0.8 });
        const pool = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.94, 24).rotateX(-Math.PI / 2), dry());
        pool.position.set(pos.x, pos.y + 0.2, pos.z);
        const glint = glowSprite(world.glowTex, rad * 3, 0xffffff, 0.3); glint.position.set(pos.x, pos.y + 1.1, pos.z);
        scene.add(pool, glint);
        return { key, pos, reach, lay, lift, pool, glint, wet: true, top: new V3(pos.x, pos.y + 0.9, pos.z) };
      };
      S.spots = [spot('spring', springAt, 1.3, 4.2, 'Lay the blue on the spring', 'Lift the water out of the spring'), spot('pond', pondAt, 4.2, 6.6, 'Lay the blue in the pond', 'Lift the water out of the pond')];
      add(place(new THREE.BoxGeometry(0.9, 1.5, 0.7), springAt.x - 1.4, springAt.y + 0.7, springAt.z + 0.6, 0, 0.5, 0), STONE, { scale: 0.8 });
      // the stream, and where it goes over the edge
      S.stream = makeStream(scene, uTime, bed, 1.15);
      const out = new V3(Math.cos(rimA), 0, Math.sin(rimA)), tangent = new V3(-Math.sin(rimA), 0, Math.cos(rimA)), lip = bed[bed.length - 1];
      S.fall = makeStream(scene, uTime, [lip.clone().addScaledVector(out, -0.8), lip.clone().addScaledVector(out, 0.3), lip.clone().addScaledVector(out, 0.7).setY(lip.y - 0.7), lip.clone().addScaledVector(out, 0.9).setY(lip.y - 20)], 1.6, () => tangent);
      for (const st of [S.stream, S.fall]) st.mat.uniforms.tint.value.set(WATER);

      // the mill beside the pond: a hut, and a wheel that only turns when there is water under it
      const hut = new V3(pondAt.x - 6.6, pondAt.y, pondAt.z - 0.6);
      add(place(new THREE.BoxGeometry(3.4, 2.8, 3.2), hut.x, hut.y + 1.4, hut.z), ['#f2e8ff', '#e2d4f6', '#fbf4ff'], { scale: 0.5 });
      add(place(new THREE.ConeGeometry(3.1, 2.0, 4), hut.x, hut.y + 3.8, hut.z, 0, Math.PI / 4, 0), ['#6a4cc0', '#7c5cd4', '#5a3ca8'], { scale: 0.5 });
      world.colliders.push({ x: hut.x, z: hut.z, r: 2.4, late: true });
      const wheel = new THREE.Group(), grey = new THREE.MeshLambertMaterial({ color: 0x8a6a4a, emissive: 0x241a12, flatShading: true });
      wheel.position.set(pondAt.x - 3.9, pondAt.y + 1.75, pondAt.z - 0.6); wheel.rotation.y = Math.PI / 2;
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 5, 22), grey), new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 6).rotateX(Math.PI / 2), grey));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU, paddle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.75), grey), spoke = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.5, 0.07), grey);
        paddle.position.set(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0); paddle.rotation.z = a + Math.PI / 2;
        spoke.position.set(Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0); spoke.rotation.z = a + Math.PI / 2;
        wheel.add(paddle, spoke);
      }
      scene.add(wheel);
      S.wheel = wheel; S.spin = 0;

      // somebody who lives in this picture: a piper in a straw hat, who is glad of company
      {
        const flat = (c) => new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.18), flatShading: true });
        const piper = new THREE.Group(), part = (g, c, x, y, z) => { const m = new THREE.Mesh(g, flat(c)); m.position.set(x, y, z); piper.add(m); return m; };
        part(new THREE.ConeGeometry(0.72, 1.5, 9), 0x3fa7a0, 0, 0.95, 0);
        part(new THREE.IcosahedronGeometry(0.36, 1), 0xf0c9a0, 0, 1.95, 0);
        part(new THREE.CylinderGeometry(0.8, 0.86, 0.07, 14), 0xe8c46a, 0, 2.2, 0);
        part(new THREE.ConeGeometry(0.42, 0.5, 10), 0xe8c46a, 0, 2.46, 0);
        part(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 5).rotateX(Math.PI / 2), 0x6a4a2a, 0.12, 1.86, 0.55);
        for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.22, 0.2, 0.36), 0x5a3a2a, s * 0.22, 0.1, 0.06);
        piper.position.copy(npcAt);
        scene.add(piper);
        S.piper = piper; S.npcAt = npcAt; S.noteT = 0; S.note = 0;
        // the point the companions chase round the piper: a ring dance
        S.lead = { pos: new V3(), heading: 0, seat: null, grounded: true, lift: null, ride: null, gliding: false, vel: new V3() };
        // and what is found here afterwards: where each of them lies
        const blood = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.0, 0.012), fog: false, transparent: true, opacity: 0, blending: THREE.NoBlending });
        S.lie = [[2.2, 0.6], [-1.6, 2.1], [0.4, -2.6], [-2.8, -1.0], [3.1, -1.9], [-0.6, 3.6]].map(([ox, oz], i) => {
          const x = npcAt.x + ox, z = npcAt.z + oz, y = surfY(SUMMER, x, z), pool = new THREE.Group();
          for (const [dx, dz, rad, sq] of [[0, 0, 1.25, 0.72], [0.9, 0.5, 0.5, 1], [-0.7, 0.9, 0.34, 1], [1.5, -0.3, 0.2, 1]]) {
            const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 18).rotateX(-Math.PI / 2), blood);
            m.position.set(dx, 0.05 + 0.004 * i, dz); m.scale.set(1, 1, sq); m.rotation.y = i * 1.7; pool.add(m);
          }
          pool.position.set(x, y, z); pool.rotation.y = i * 2.3; pool.visible = false; pool.renderOrder = 1;
          scene.add(pool);
          return { pos: new V3(x, y, z), pool, turn: i * 1.9 };
        });
        S.hat = new THREE.Group();
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 10), flat(0xe8c46a)); crown.position.y = 0.26;
        S.hat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.86, 0.07, 14), flat(0xe8c46a)), crown);
        S.hat.position.set(npcAt.x + 0.8, npcAt.y + 0.22, npcAt.z - 0.6); S.hat.rotation.set(0.5, 0.3, 0.35); S.hat.visible = false;
        scene.add(S.hat);
        S.smear = Array.from({ length: 18 }, () => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10).rotateX(-Math.PI / 2), blood); m.visible = false; scene.add(m); return m; });
        S.crawl = { b: null, state: 'still', gone: 0, laid: 0 };
      }

      // ---- the village: houses round the green, lights strung from a pole, and everybody out of doors
      const V = (S.village = { folk: [], bulbs: [], down: false });
      const keep = [];                                        // [where, how far round it] the wheat is not to grow
      {
        const roof = ['#6a4cc0', '#7c5cd4', '#5a3ca8', '#8a6ce0'], wall = ['#f2e8ff', '#e2d4f6', '#fbf4ff', '#d4c4ec'], LAMP = ['#ffe6a8', '#fff4d0', '#ffd27a'], lit = new Bag();
        const BEAM = ['#5a4480', '#4a3670', '#6a5494'], POLE = ['#f2d8a0', '#e8c078', '#fff0c8'], SHEAF = ['#f2d27a', '#e8c060', '#fff0b0'], FLAGS = ['#ff9ae0', '#8ae6ff', '#ffe2a0', '#c8a8ff', '#ff9a70'];
        const one = (g, c) => add(g, [c, c], {});
        const bulb = (q, size, op = 0.8) => { const b = glowSprite(world.glowTex, size, 0xffd890, op); b.position.copy(q); scene.add(b); V.bulbs.push(b); };
        const house = (ang, rad, k, tall = 0) => {
          const p = sp(ang, rad), yaw = Math.atan2(SUMMER.x - p.x, SUMMER.z - p.z), fx = Math.sin(yaw), fz = Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw), H = (2.6 + tall) * k;
          add(place(new THREE.BoxGeometry(3.4 * k, H, 3.0 * k), p.x, p.y + H / 2, p.z, 0, yaw, 0), wall, { scale: 0.5 });
          add(place(new THREE.ConeGeometry(2.9 * k, 2.3 * k, 4), p.x, p.y + H + 1.1 * k, p.z, 0, yaw + Math.PI / 4, 0), roof, { scale: 0.5 });
          add(place(new THREE.BoxGeometry(0.5 * k, 1.3 * k, 0.5 * k), p.x + sx * 0.9 * k, p.y + H + 1.2 * k, p.z + sz * 0.9 * k, 0, yaw, 0), wall, { scale: 0.5 });
          // timber at its corners and under its eaves, a step at the door, and a box of flowers under each window
          for (const a of [-1, 1]) {
            for (const b of [-1, 1]) add(place(new THREE.BoxGeometry(0.24 * k, H, 0.24 * k), p.x + sx * a * 1.7 * k + fx * b * 1.5 * k, p.y + H / 2, p.z + sz * a * 1.7 * k + fz * b * 1.5 * k, 0, yaw, 0), BEAM, { scale: 0.6 });
            add(place(new THREE.BoxGeometry(3.6 * k, 0.24 * k, 0.2 * k), p.x + fx * a * 1.52 * k, p.y + H - 0.12 * k, p.z + fz * a * 1.52 * k, 0, yaw, 0), BEAM, { scale: 0.6 });
            add(place(new THREE.BoxGeometry(0.78 * k, 0.18 * k, 0.28 * k), p.x + fx * 1.66 * k + sx * a * 1.1 * k, p.y + 1.26 * k, p.z + fz * 1.66 * k + sz * a * 1.1 * k, 0, yaw, 0), BEAM, { scale: 0.6 });
            for (let j = -1; j <= 1; j++) one(place(new THREE.IcosahedronGeometry(0.14 * k, 0), p.x + fx * 1.68 * k + sx * (a * 1.1 + j * 0.24) * k, p.y + 1.42 * k, p.z + fz * 1.68 * k + sz * (a * 1.1 + j * 0.24) * k), FLAGS[(j + 3 + (a > 0 ? 1 : 0)) % FLAGS.length]);
          }
          add(place(new THREE.BoxGeometry(1.3 * k, 0.16, 0.7 * k), p.x + fx * 1.85 * k, p.y + 0.06, p.z + fz * 1.85 * k, 0, yaw, 0), STONE, { scale: 0.8 });
          // a lamp by the door; and the door and the windows, lit from inside
          const lampAt = new V3(p.x + fx * 1.66 * k + sx * 0.74 * k, p.y + 1.95 * k, p.z + fz * 1.66 * k + sz * 0.74 * k);
          lit.add(daub(place(new THREE.OctahedronGeometry(0.17 * k), lampAt.x, lampAt.y, lampAt.z), LAMP, {}));
          bulb(lampAt, 2.6, 0.7);
          const front = (dx, y, w, h) => lit.add(daub(place(new THREE.BoxGeometry(w * k, h * k, 0.12), p.x + fx * 1.53 * k + sx * dx * k, p.y + y * k, p.z + fz * 1.53 * k + sz * dx * k, 0, yaw, 0), LAMP, { scale: 2, spread: 1 }));
          front(0, 0.8, 0.85, 1.6); front(-1.1, 1.7, 0.6, 0.65); front(1.1, 1.7, 0.6, 0.65);
          if (tall) { front(0, 3.4, 0.7, 0.9); front(-1.1, 3.4, 0.5, 0.6); front(1.1, 3.4, 0.5, 0.6); }
          world.colliders.push({ x: p.x, z: p.z, r: 2.35 * k, late: true });
          return { p, top: new V3(p.x, p.y + H + 2.2 * k, p.z), door: new V3(p.x + fx * 3.4 * k, 0, p.z + fz * 3.4 * k) };
        };
        V.houses = [house(2.62, 18, 1), house(3.58, 18.5, 1.1), house(5.76, 18, 1), house(0, 17, 0.95), house(3.1, 20.8, 1.05, 2.2)];
        // the pole on the green, a star on it, and the lights strung from it to every roof
        const pole = sp(0, 0);
        add(place(new THREE.CylinderGeometry(0.12, 0.18, 8, 6), pole.x, pole.y + 4, pole.z), ['#f2d8a0', '#e8c078', '#fff0c8'], { scale: 0.6 });
        lit.add(daub(place(new THREE.OctahedronGeometry(0.5), pole.x, pole.y + 8.5, pole.z, 0, 0, 0, 1, 2, 0.4), LAMP, {})); lit.add(daub(place(new THREE.OctahedronGeometry(0.5), pole.x, pole.y + 8.5, pole.z, 0, 0, 0, 2, 1, 0.4), LAMP, {}));
        world.colliders.push({ x: pole.x, z: pole.z, r: 0.4, late: true });
        V.pole = pole;
        const head = new V3(pole.x, pole.y + 8, pole.z);
        [...V.houses.map((h) => h.top), new V3(hut.x, hut.y + 4.8, hut.z)].forEach((top, n) => {
          for (let i = 1; i < 8; i++) {
            const q = head.clone().lerp(top, i / 8); q.y -= Math.sin((i / 8) * Math.PI) * 1.5;
            const b = glowSprite(world.glowTex, 1.7, [0xffe2a0, 0xff9ae0, 0x8ae6ff, 0xc8a8ff][(i + n) % 4], 0.95); b.position.copy(q);
            scene.add(b); V.bulbs.push(b);
          }
          // (and little flags between the lights, hung in the line of the string)
          const turn = Math.PI / 2 - Math.atan2(top.x - head.x, top.z - head.z);
          for (let i = 0; i < 8; i++) { const q = head.clone().lerp(top, (i + 0.5) / 8); q.y -= Math.sin(((i + 0.5) / 8) * Math.PI) * 1.5 + 0.34; one(place(new THREE.ConeGeometry(0.3, 0.55, 3), q.x, q.y, q.z, Math.PI, turn, 0, 1, 1, 0.12), FLAGS[(i + n) % FLAGS.length]); }
        });
        const star = glowSprite(world.glowTex, 9, 0xfff0c0, 0.8); star.position.set(pole.x, pole.y + 8.5, pole.z); scene.add(star); V.bulbs.push(star);
        // ---- what a village has standing about in it. (All of it is still there afterwards; only the lights are not.)
        const at = (c, a, al, ac, h = 0) => new V3(c.x + Math.cos(a) * al - Math.sin(a) * ac, c.y + h, c.z + Math.sin(a) * al + Math.cos(a) * ac);
        // paper lanterns on posts, either side of the way in
        for (const [a, rad] of [[1.22, 14.6], [1.75, 14.5], [1.2, 9], [1.78, 9]]) {
          const q = sp(a, rad);
          add(place(new THREE.CylinderGeometry(0.06, 0.1, 1.9, 6), q.x, q.y + 0.95, q.z), BEAM, { scale: 0.6 });
          add(place(new THREE.SphereGeometry(0.34, 8, 6), q.x, q.y + 2.15, q.z, 0, 0, 0, 1, 1.25, 1), LAMP, { scale: 2, spread: 1 });
          for (const h of [1.72, 2.58]) add(place(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 8), q.x, q.y + h, q.z), BEAM, { scale: 0.6 });
          bulb(new V3(q.x, q.y + 2.15, q.z), 3.6);
          world.colliders.push({ x: q.x, z: q.z, r: 0.3, late: true }); keep.push([q, 1.2]);
        }
        // two long tables laid for the feast, a bench either side of each
        const table = (a, rad, n) => {
          const c = sp(a, rad), P = (al, ac, h) => at(c, a, al, ac, h);
          const box = (w, h, d, al, ac, y, pal, o) => { const q = P(al, ac, y); add(place(new THREE.BoxGeometry(w, h, d), q.x, q.y, q.z, 0, -a, 0), pal, o || { scale: 0.6 }); };
          box(4.2, 0.12, 1.3, 0, 0, 0.95, WOOD);
          box(4.3, 0.05, 0.5, 0, 0, 1.03, [FLAGS[n], FLAGS[n + 3]], { scale: 1.5, spread: 1 });
          for (const al of [-1.9, 1.9]) for (const ac of [-0.5, 0.5]) box(0.14, 1.4, 0.14, al, ac, 0.25, WOOD);
          for (const ac of [-1.15, 1.15]) { box(3.8, 0.1, 0.42, 0, ac, 0.52, WOOD); for (const al of [-1.5, 1.5]) box(0.12, 0.9, 0.36, al, ac, 0.05, WOOD); }
          // what is on it: a pie, a jug, a loaf, a bowl of fruit; plates; and candles, lit
          [-1.65, -0.85, 0, 0.85, 1.65].forEach((al, i) => {
            const q = P(al, i % 2 ? 0.22 : -0.22, 1.06), kind = (i + n) % 4;
            if (kind === 0) { one(place(new THREE.CylinderGeometry(0.3, 0.26, 0.12, 10), q.x, q.y + 0.06, q.z), '#e8b060'); one(place(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 10), q.x, q.y + 0.13, q.z), '#c85a70'); }
            else if (kind === 1) one(place(new THREE.CylinderGeometry(0.11, 0.17, 0.42, 8), q.x, q.y + 0.21, q.z), '#5a9cf0');
            else if (kind === 2) one(place(new THREE.IcosahedronGeometry(0.2, 1), q.x, q.y + 0.1, q.z, 0, i, 0, 1.6, 0.75, 1), '#e0a860');
            else { one(place(new THREE.CylinderGeometry(0.3, 0.16, 0.16, 10), q.x, q.y + 0.08, q.z), '#f4eede'); for (let j = 0; j < 3; j++) one(place(new THREE.IcosahedronGeometry(0.11, 0), q.x + Math.cos(j * 2.1) * 0.12, q.y + 0.2, q.z + Math.sin(j * 2.1) * 0.12), ['#e86a9a', '#f0c050', '#ff9a70'][j]); }
          });
          for (const al of [-1.25, -0.42, 0.42, 1.25]) for (const ac of [-0.45, 0.45]) { const q = P(al, ac, 1.03); one(place(new THREE.CylinderGeometry(0.17, 0.13, 0.04, 10), q.x, q.y, q.z), '#fff8ea'); }
          for (const al of [-0.42, 0.42]) {
            const q = P(al, 0, 1.06);
            one(place(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 6), q.x, q.y + 0.15, q.z), '#fff4d8');
            lit.add(daub(place(new THREE.OctahedronGeometry(0.07), q.x, q.y + 0.4, q.z, 0, 0, 0, 1, 1.7, 1), LAMP, {}));
            bulb(new V3(q.x, q.y + 0.42, q.z), 1.8, 0.7);
          }
          for (const al of [-1.4, 0, 1.4]) { const q = P(al, 0, 0); world.colliders.push({ x: q.x, z: q.z, r: 1.15, top: c.y + 1.15, late: true }); }
          keep.push([c, 3.6]);
        };
        table(2.2, 6.5, 0); table(0.3, 8.2, 1);
        // a well on the green, under a little roof
        {
          const q = sp(0.85, 6.5);
          add(place(new THREE.CylinderGeometry(0.95, 1.02, 0.8, 14, 1, true), q.x, q.y + 0.4, q.z), STONE, { scale: 0.8 });
          add(place(new THREE.TorusGeometry(0.97, 0.13, 5, 16), q.x, q.y + 0.8, q.z, Math.PI / 2, 0, 0), STONE, { scale: 0.8 });
          one(place(new THREE.CircleGeometry(0.9, 14), q.x, q.y + 0.5, q.z, -Math.PI / 2, 0, 0), '#3f6ec8');
          for (const k of [-1, 1]) add(place(new THREE.BoxGeometry(0.14, 2.3, 0.14), q.x + k * 0.98, q.y + 1.15, q.z), BEAM, { scale: 0.6 });
          add(place(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), q.x, q.y + 2.2, q.z, 0, 0, Math.PI / 2), BEAM, { scale: 0.6 });
          add(place(new THREE.ConeGeometry(1.6, 0.9, 4), q.x, q.y + 2.85, q.z, 0, Math.PI / 4, 0), roof, { scale: 0.5 });
          add(place(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 4), q.x, q.y + 1.82, q.z), BEAM, {});
          add(place(new THREE.CylinderGeometry(0.17, 0.13, 0.28, 8), q.x, q.y + 1.35, q.z), WOOD, { scale: 0.6 });
          world.colliders.push({ x: q.x, z: q.z, r: 1.25, late: true }); keep.push([q, 2.4]);
        }
        // barrels and sacks by the mill, and a barrel at the end of a table
        const barrel = (x, z) => {
          const y = surfY(SUMMER, x, z);
          add(place(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 10), x, y + 0.45, z), WOOD, { scale: 0.6 });
          for (const h of [0.22, 0.68]) add(place(new THREE.TorusGeometry(0.41, 0.04, 4, 12), x, y + h, z, Math.PI / 2, 0, 0), BEAM, {});
          world.colliders.push({ x, z, r: 0.5, late: true }); keep.push([new V3(x, y, z), 1.1]);
        };
        barrel(hut.x - 0.7, hut.z + 2.3); barrel(hut.x + 0.3, hut.z + 2.5);
        { const e = sp(2.32, 9.4); barrel(e.x, e.z); }
        for (const [dx, dz] of [[1.4, 2.3], [1.9, 2.8]]) { const x = hut.x + dx, z = hut.z + dz; one(place(new THREE.IcosahedronGeometry(0.42, 1), x, surfY(SUMMER, x, z) + 0.3, z, 0, dx, 0, 1, 0.8, 0.85), '#e8d8b0'); keep.push([new V3(x, 0, z), 1]); }
        // sheaves stood up in the wheat
        for (const [a, rad] of [[2.25, 16], [4.2, 17], [5.2, 19]]) {
          const q = sp(a, rad);
          for (let j = 0; j < 4; j++) { const t = j * 1.57 + a; add(place(new THREE.ConeGeometry(0.34, 1.6, 6), q.x + Math.cos(t) * 0.26, q.y + 0.8, q.z + Math.sin(t) * 0.26, -Math.sin(t) * 0.22, 0, Math.cos(t) * 0.22), SHEAF, { scale: 1.2, spread: 1 }); }
          add(place(new THREE.TorusGeometry(0.36, 0.05, 4, 10), q.x, q.y + 1.0, q.z, Math.PI / 2, 0, 0), BEAM, {});
          world.colliders.push({ x: q.x, z: q.z, r: 0.6, late: true }); keep.push([q, 1.5]);
        }
        // a rail along the edge, either side of the way in
        for (const [a0, a1] of [[1.72, 2.5], [0.62, 1.2]]) {
          const n = Math.round(((a1 - a0) * 24) / 1.7); let was = null;
          for (let i = 0; i <= n; i++) {
            const a = a0 + ((a1 - a0) * i) / n, q = sp(a, rimR(SUMMER, a) - 1.3);
            add(place(new THREE.BoxGeometry(0.15, 1.05, 0.15), q.x, q.y + 0.5, q.z, 0, -a, 0), POLE, { scale: 0.6 });
            if (was) for (const h of [0.42, 0.82]) add(place(new THREE.BoxGeometry(was.distanceTo(q), 0.08, 0.08), (was.x + q.x) / 2, (was.y + q.y) / 2 + h, (was.z + q.z) / 2, 0, -Math.atan2(q.z - was.z, q.x - was.x), 0), POLE, { scale: 0.6 });
            was = q;
          }
        }
        // and the ways between: from where the painter comes in to the green, and from the green to every door
        {
          const cv = summer.tex.image, x = cv.getContext('2d'), span = summer.span, cu = (wx) => ((wx - SUMMER.x) / span + 0.5) * cv.width, cz = (wz) => ((wz - SUMMER.z) / span + 0.5) * cv.width, px = cv.width / span;
          const lane = (pts) => {
            const line = () => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(cu(p.x), cz(p.z)) : x.moveTo(cu(p.x), cz(p.z)))); x.stroke(); };
            x.setLineDash([]); x.strokeStyle = 'rgba(226,208,252,0.42)'; x.lineWidth = 1.9 * px; line();
            x.setLineDash([0.01, 1.15 * px]); x.strokeStyle = 'rgba(255,246,230,0.6)'; x.lineWidth = 0.62 * px; line();       // (stones, set along it)
            for (let i = 1; i < pts.length; i++) { const n = Math.ceil(pts[i - 1].distanceTo(pts[i]) / 1.3); for (let j = 0; j <= n; j++) keep.push([pts[i - 1].clone().lerp(pts[i], j / n), 1.25]); }
          };
          x.lineCap = 'round'; x.lineJoin = 'round';
          lane(new THREE.CatmullRomCurve3([sp(1.4, 24.5), sp(1.42, 17), sp(1.5, 10), sp(Math.PI / 2, 3.2)]).getPoints(16));
          lane([new V3(SUMMER.x, 0, SUMMER.z + 18.4), sp(1.47, 13.5)]);
          for (const h of V.houses) lane([sp(Math.atan2(h.door.z - SUMMER.z, h.door.x - SUMMER.x), 3.4), h.door]);
          x.setLineDash([]); x.fillStyle = 'rgba(226,208,252,0.42)'; x.beginPath(); x.arc(cu(pole.x), cz(pole.z), 3.4 * px, 0, TAU); x.fill();
          x.strokeStyle = 'rgba(255,246,230,0.6)'; x.lineWidth = 0.3 * px; x.beginPath(); x.arc(cu(pole.x), cz(pole.z), 3.4 * px, 0, TAU); x.stroke();
          summer.tex.needsUpdate = true;
        }
        V.windows = lit.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })); V.windows.frustumCulled = false;
        scene.add(V.windows);
        // the people of the village
        const cloth = paintify(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a2236 }), { scale: 1.2, amp: 0.35 });
        const ROBES = ['#e86a9a', '#3fb8b0', '#f0c050', '#b48cff', '#5a9cf0', '#ff9a70', '#7ad8a0', '#f4eede', '#d870d0', '#70c8e8'], SKIN = ['#f0c9a0', '#e0b088', '#c89070', '#f6d8b8'], HAIR = ['#5a3a2a', '#2e2430', '#c89a50', '#8a5a3a'];
        const person = (i, k = 1) => {
          const g = new Bag(), one = (geo, c) => g.add(daub(geo, [c, c], {})), robe = ROBES[i % ROBES.length];
          one(place(new THREE.ConeGeometry(0.62, 1.4, 8), 0, 0.82, 0), robe);
          one(place(new THREE.IcosahedronGeometry(0.33, 1), 0, 1.78, 0), SKIN[i % SKIN.length]);
          if (i % 3 === 0) one(place(new THREE.ConeGeometry(0.36, 0.62, 8), 0, 2.3, 0), ROBES[(i + 3) % ROBES.length]);
          else if (i % 3 === 1) { one(place(new THREE.CylinderGeometry(0.62, 0.66, 0.06, 12), 0, 2.03, 0), '#e8c46a'); one(place(new THREE.ConeGeometry(0.32, 0.36, 9), 0, 2.22, 0), '#e8c46a'); }
          else one(place(new THREE.IcosahedronGeometry(0.37, 1), 0, 1.9, -0.07, 0, 0, 0, 1, 0.8, 1), HAIR[i % HAIR.length]);
          for (const q of [-1, 1]) one(place(new THREE.BoxGeometry(0.16, 0.85, 0.16), q * 0.62, 1.55, 0, 0, 0, q * -0.9), robe);      // (both arms up)
          const m = g.mesh(cloth); m.scale.setScalar(k);
          scene.add(m);
          return m;
        };
        const folk = (kind, o) => V.folk.push({ kind, m: person(V.folk.length, o.k || 1), k: o.k || 1, i: V.folk.length, ...o });
        for (let i = 0; i < 8; i++) folk('ring', { c: npcAt, rad: 4.7, ph: (i / 8) * TAU, w: -0.8 });                    // a ring round the Piper
        [sp(2.6, 12), sp(5.6, 8.5), sp(0.6, 9.5)].forEach((c) => { folk('ring', { c, rad: 0.85, ph: 0, w: 2.1 }); folk('ring', { c, rad: 0.85, ph: Math.PI, w: 2.1 }); });    // couples, turning
        for (let i = 0; i < 3; i++) folk('ring', { c: pole, rad: 1.9, ph: (i / 3) * TAU, w: 2.7, k: 0.62 });             // children, round the pole
        [0, 2, 3, 4].forEach((h) => folk('stand', { at: V.houses[h].door, ph: h * 1.9 }));                               // and some who only clap
      }
      // wheat: the south field drinks from the stream, the north field from the pond
      const fields = [new Bag(), new Bag()], sAt = this.sAt;
      for (let i = 0; i < 620; i++) {
        const a = r() * TAU, d = 2 + Math.sqrt(r()) * 20.5, x = SUMMER.x + Math.cos(a) * d, z = SUMMER.z + Math.sin(a) * d, y = surfY(SUMMER, x, z);
        const near = (q, rad) => (q.x - x) ** 2 + (q.z - z) ** 2 < rad * rad;
        if (near(springAt, 3) || near(pondAt, 5.6) || near(hut, 3.4) || near(sAt, 7) || near(npcAt, 8.5) || near(V.pole, 4) || V.houses.some((h) => near(h.p, 4.6) || near(h.door, 2.2)) || V.folk.some((q) => q.c && q.rad < 1 && near(q.c, 2.6)) || keep.some(([q, rad]) => near(q, rad)) || bed.some((q, k) => k % 2 === 0 && near(q, 1.5))) continue;
        for (let k = 0; k < 3; k++) {
          const h = 1.0 + r() * 0.6;
          fields[z > SUMMER.z - 3 ? 0 : 1].add(daub(place(new THREE.ConeGeometry(0.075, h, 4, 1), x + (r() - 0.5) * 0.5, y + h / 2, z + (r() - 0.5) * 0.5, (r() - 0.5) * 0.3, r() * 3, (r() - 0.5) * 0.3), ['#ffffff', '#f4f0e4', '#e8e2d2'], { scale: 0.8, spread: 1 }));
        }
      }
      S.wheat = fields.map((f) => { const m = f.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x201808 }), { scale: 1.2, amp: 0.4 })); m.frustumCulled = false; scene.add(m); return m; });
    }

    this.mesh = bag.mesh(paintify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x18171c }), { scale: 1.1, amp: 0.5 }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    world.paintable.push(this.mesh);

    this._v = new V3();
  }

  /** Is this point in the gallery or one of its pictures? (They lie far to the east of everything else.) */
  contains(p) { return p.x > 3000; }
  where(p) { return p.x < 3000 ? null : p.x < 5000 ? 'hall' : p.x < 10000 ? 'tubes' : 'dunes'; }
  /** On the Piper's field, at the far end of the picture. */
  onField(p) { return p.x > 7000 && (p.x - SUMMER.x) ** 2 + (p.z - SUMMER.z) ** 2 < 34 * 34 && Math.abs(p.y - SUMMER.y) < 12; }
  /** Every picture that is hung is finished. */
  get done() { return this.tubes.done && (!this.dunes || this.dunes.done); }

  /** The sky and light for where the camera is: which look, and how far along it. */
  look(p) {
    const w = this.where(p);
    return !w ? null : w === 'hall' ? { name: 'hall', at: this.greyK } : w === 'dunes' ? { name: 'dunes', at: this.dunes.day } : { name: 'tubes', at: this.tubes.eve };
  }

  /** Where the next thing to do is, for the flecks that drift toward it: the frame of the picture, or the next thing to mix in it. */
  goal(p) {
    const w = this.where(p);
    if (!w || this.slipped || this.grey || this.ended) return null;
    if (w === 'dunes') return this.dunes.goal();
    if (w === 'tubes') return this.tubes.done ? null : this.tubes.goal();
    return !this.tubes.done ? this.hung[0].at : this.dunes && !this.dunes.done ? this.dunes.frameAt : null;
  }

  /** What E would do for a painter standing at `p`, if anything: step through a frame. */
  near(p) {
    for (const d of this.doors) if ((!d.open || d.open()) && (this.grey ? !!d.frame : !d.frame) && Math.abs(d.at.y - p.y) < 2.5 && d.at.distanceTo(p) < 3.9) return { type: 'door', door: d, text: d.text };
    return null;
  }

  /** After the portrait, and until the other painter is painted out: the world has no colour, and nothing is as it was. */
  get bleak() { return this.ended && !this.undone; }

  /** A long look at the big frame, with nobody to move: `erase` if what follows is nothing at all. */
  lookAtFrame(erase = false) {
    const n = new V3(HALL.x - this.empty.x, 0, HALL.z - this.empty.z).normalize();
    this.ending = { t: 0, erase, cam: this.empty.clone().addScaledVector(n, 13).setY(HALL.y + 4.4), look: this.empty.clone().setY(HALL.y + 4.3), dir: n.clone().negate() };
  }
  /** Stepping into the empty frame: the painter is the portrait now. */
  frameIn() { this.grey = false; this.ended = true; this.lookAtFrame(); }

  /** A swing of the brush landing at (x, z), from a painter standing at `p`. Only Cream does anything here, and only at the end. */
  strike(x, z, p, hex) {
    const out = [];
    if (!this.bleak || this.ending || hex !== PAINTS[4].hex) return out;
    const hit = (q, reach) => Math.abs(q.y - p.y) < 4 && ((q.x - x) ** 2 + (q.z - z) ** 2 < reach * reach || (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 9);
    // the painter's own portrait: three strokes, and there is no painter
    if (this.where(p) === 'hall' && hit(this.empty, 4.4) && this.wiped < 3) {
      if (!this.selfCv) {
        this.selfCv = document.createElement('canvas'); this.selfCv.width = 256; this.selfCv.height = 320;
        this.selfCv.getContext('2d').drawImage(this.portraits[Math.min(3, this.after)].image, 0, 0);
        this.selfTex = new THREE.CanvasTexture(this.selfCv); this.selfTex.colorSpace = THREE.SRGBColorSpace;
      }
      this.wiped++;
      const c = this.selfCv.getContext('2d');
      if (this.wiped >= 3) { c.fillStyle = '#f1ece2'; c.fillRect(0, 0, 256, 320); }
      else for (let i = 0; i < 70; i++) drawStroke(c, Math.random() * 256, Math.random() * 320, (Math.random() - 0.5) * 0.8, 40 + Math.random() * 70, 16 + Math.random() * 16, ['#f1ece2', '#ebe5da', '#f8f4ec'][i % 3], 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.05)');
      this.selfTex.needsUpdate = true;
      if (this.wiped >= 3) this.lookAtFrame(true);
      out.push({ type: this.wiped >= 3 ? 'erased' : 'wipe', n: this.wiped, at: new V3(this.empty.x, this.empty.y + 3.5, this.empty.z) });
    }
    // the other painter, at home: three strokes, and everything it took comes back
    if (this.indoors && this.other.root.visible && hit(this.homeSpot, 3.8) && this.unpainted < 3) {
      this.unpainted++;
      this.taken = Math.round(this.total * (1 - this.unpainted / 3));
      if (this.unpainted >= 3) this.undone = true;
      out.push({ type: this.undone ? 'undone' : 'unpaint', n: this.unpainted, at: new V3(this.homeSpot.x, this.homeSpot.y + 1.4, this.homeSpot.z) });
    }
    return out;
  }

  /** Something here the painter is standing by and may not understand yet: a line to say about it, once. */
  waiting(p) {
    const w = this.where(p);
    if (w === 'hall' && this.grey) {
      if (this.greyT < 5) return { key: 'grey', line: 'It is the same room.' };
      if (this.whole) return this.wholeT > 10 ? { key: 'forme', line: 'Every frame is shut now, except the empty one.' } : null;
      if (this.taken === 0) return { key: 'other', line: 'Someone is standing there. A painter, drawn and never painted.' };
      if (this.odd.at.distanceTo(p) < 5) return { key: 'shut', line: 'It is only a painting now.' };
      if (this.hung.some((h) => h.at.distanceTo(p) < 6)) return { key: 'someone', line: 'There is someone in it.' };
      return null;
    }
    if (w === 'hall' && this.bleak) return this.empty.distanceTo(p) < 7 ? { key: 'portrait', line: 'A portrait of a painter, in pencil. Cream takes paint back to paper.' } : { key: 'colours', line: 'Thank you for the colours.' };
    if (this.onField(p) && this.bleak) return p.distanceTo(this.summer.npcAt) < 10 ? { key: 'danced', line: 'They danced for a long time.' } : null;
    if (w === 'hall') {
      if (this.slipped && this.odd.at.distanceTo(p) < 7) return { key: 'odd', line: 'A painting of this room. Whoever is in it is standing where you are.' };
      if (this.draped.some((q) => q.distanceTo(p) < 4.6)) return { key: 'draped', line: 'Still under its dust sheet. It has not been hung yet.' };
      if (this.empty.distanceTo(p) < 5.5) return { key: 'emptyframe', line: 'An empty frame, bigger than all the others.' };
      if (this.slipped) return { key: 'slipped', line: 'One of the dust sheets is on the floor. Nobody has been in here.' };
    }
    return null;
  }

  save() { return { tubes: this.tubes.save(), dunes: this.dunes ? this.dunes.save() : null, slipped: this.slipped ? 1 : 0, grey: this.grey ? 1 : 0, joined: this.joined ? 1 : 0, unpainted: this.unpainted, undone: this.undone ? 1 : 0, after: Math.min(this.after, 9), crawled: this.crawled ? 1 : 0, taken: this.taken, whole: this.whole ? 1 : 0, ended: this.ended ? 1 : 0, lifts: Math.min(this.lifts, 99), visits: Math.min(this.visits, 9) }; }
  load(d) {
    if (!d) return;
    this.slipped = !!d.slipped; this.ended = this.slipped && !!d.ended; this.grey = this.slipped && !!d.grey && !this.ended;
    this.greyK = this.grey ? 1 : 0;
    this.taken = Number.isInteger(d.taken) && d.taken > 0 && this.slipped ? Math.min(d.taken, PAINTS.length) : 0;
    this.whole = this.ended || (this.slipped && !!d.whole);
    if (this.whole) this.wholeT = 99;
    this.joined = !!d.joined; this.crawled = !!d.crawled;
    this.undone = this.ended && !!d.undone; this.unpainted = this.undone ? 3 : this.ended && [1, 2].includes(d.unpainted) ? d.unpainted : 0;
    if (this.undone) this.taken = 0;
    this.after = Number.isInteger(d.after) && d.after > 0 && this.ended ? d.after : 0;
    this.lifts = Number.isInteger(d.lifts) && d.lifts > 0 ? d.lifts : 0; this.visits = Number.isInteger(d.visits) && d.visits > 0 ? d.visits : 0;
    // (a journey saved when this level was something else, and which had got as far as the dust sheet: the picture counts as finished)
    this.tubes.load(d.tubes, this.slipped);
    if (this.dunes) this.dunes.load(d.dunes);
  }

  update(dt, t, player, blots = null) {
    const S = this.summer, ease = (k) => 1 - Math.exp(-k * dt);
    // the sheet goes while nobody is looking; the picture under it shows whoever is in the room, from behind
    const O = this.odd, inHall = !!player && this.where(player.pos) === 'hall';
    if (!this.slipped && this.done && player && !inHall) this.slipped = true;
    O.on.visible = !this.slipped; O.off.visible = this.slipped;
    // every time the room is come back to, the sheet hangs a little lower and a little to one side
    if (inHall && !this._inHall) {
      this.visits++; if (this.bleak && !this.wiped) this.after++;
      const k = Math.min(3, this.visits - 1), side = k ? (this.visits % 2 ? 0.12 : -0.12) : 0;
      O.on.position.set(O.right.x * side, -0.18 * k, O.right.z * side);
    }
    this._inHall = inHall;
    if (this.slipped && inHall) {
      const dx = player.pos.x - O.at.x, dz = player.pos.z - O.at.z, lat = dx * O.right.x + dz * O.right.z, out = dx * O.n.x + dz * O.n.z;
      const bare = this.grey || this.ended;                          // (once stepped into, nobody is in it any more)
      const u = Math.round(clamp(128 + lat * 9, 26, 230) / 2) * 2, s = Math.round(clamp(0.5 + out / 11, 0.6, 1.9) * 30) / 30, key = bare ? 'bare' : u + ':' + s;
      if (key !== O.key) {
        O.key = key;
        const x = O.cv.getContext('2d');
        x.drawImage(O.rooms[bare ? 1 : 0].image, 0, 0);
        if (!bare) figure(x, u, 206 + s * 44, s, '#2c2a32');
        O.tex.needsUpdate = true;
      }
    }
    // the grey room, and who is in it
    const ev = this.events, T = this.other, was = T.root.visible;
    ev.length = 0;
    this.close = 0; this.dark = 0;
    if (this.grey && player) {
      const p = player.pos, at = T.at;
      this.greyT += dt;
      /** Stand `far` from the painter in the direction (dx, dz): inside the room, off the bench, facing them. */
      const place = (dx, dz, far) => {
        const l = Math.hypot(dx, dz) || 1;
        let x = p.x + (dx / l) * far - HALL.x, z = p.z + (dz / l) * far - HALL.z;
        const d = Math.hypot(x, z) || 1, lim = d > 13 ? 13 : d < 3.6 ? 3.6 : d;
        x *= lim / d; z *= lim / d;
        at.set(HALL.x + x, surfY(HALL, HALL.x + x, HALL.z + z), HALL.z + z);
        T.root.position.copy(at); T.root.rotation.y = Math.atan2(p.x - at.x, p.z - at.z);
        return Math.hypot(p.x - at.x, p.z - at.z);
      };
      if (this.whole) {
        // it has everything: it turns to the way home, and is gone
        const before = this.wholeT; this.wholeT += dt;
        if (before <= 3.5 && this.wholeT > 3.5) ev.push({ type: 'gone', at });
        T.root.visible = this.wholeT <= 3.5;
        const want = Math.atan2(this.backAt.x - at.x, this.backAt.z - at.z);
        T.root.rotation.y += Math.atan2(Math.sin(want - T.root.rotation.y), Math.cos(want - T.root.rotation.y)) * ease(1.4);
      } else if (this.greyT <= 5) T.root.visible = false;
      else if (this.away > 0) {
        // it has just taken something: nowhere at all for a while, and then behind the painter
        this.holdT -= dt; T.root.visible = this.holdT > 0;          // (the first time, it stays a moment where it touched)
        if (this.holdT <= 0) this.away -= dt;
        if (this.away <= 0) {
          // (behind and to one side of the view, so that it comes in at the edge of the picture and not through the camera)
          // whichever side has more room (near a wall, one side has none)
          const a = 1.9 + Math.random() * 0.5, c = Math.cos(a), s = Math.sin(a), g = this.gaze;
          const left = place(g.x * c - g.z * s, g.x * s + g.z * c, 11), right = place(g.x * c + g.z * s, -g.x * s + g.z * c, 11);
          if (left > right) place(g.x * c - g.z * s, g.x * s + g.z * c, 11);
          T.root.visible = true; this.unseen = 0; this.stepT = 0;
        }
      } else if (!was) { place(this.gaze.x, this.gaze.z, 9); T.root.visible = true; this.blinkT = 7; this.unseen = 0; }      // the first time: simply there, in the middle of the view
      else {
        const dx = p.x - at.x, dz = p.z - at.z, d = Math.hypot(dx, dz) || 1;
        // is it being looked at? (in front of the camera, within the width of the view)
        const ex = at.x - this.eye.x, ez = at.z - this.eye.z, el = Math.hypot(ex, ez) || 1;
        const seen = (ex * this.gaze.x + ez * this.gaze.z) / el > 0.72;
        // every so often the room goes dark for a moment; more often, the more it has taken
        this.blinkT -= dt;
        if (this.blinkT <= 0) { this.blinkT = 4.5 + Math.random() * 4 - 2.5 * (this.taken / this.total); this.blink = 0.3; ev.push({ type: 'blink' }); }
        const dark = this.blink > 0;
        if (dark) { this.blink -= dt; this.dark = 1; }
        this.unseen = seen && !dark ? 0 : this.unseen + dt;
        const near = clamp(1 - d / 16, 0, 1);
        if ((!seen || dark) && d > 1.3) {
          // unwatched, it comes: faster the longer it is left unwatched, and very fast in the dark
          const step = Math.min(d - 1.2, (dark ? 15 : Math.min(20, 6.5 + 3 * this.unseen)) * dt);
          at.x += (dx / d) * step; at.z += (dz / d) * step;
          const c = Math.hypot(at.x - HALL.x, at.z - HALL.z);
          if (c < 3.3 && c > 0.01) { at.x = HALL.x + ((at.x - HALL.x) / c) * 3.3; at.z = HALL.z + ((at.z - HALL.z) / c) * 3.3; }      // round the bench, not through it
          at.y = surfY(HALL, at.x, at.z);
          T.root.position.copy(at); T.root.rotation.y = Math.atan2(dx, dz);
          if (!dark) { this.moved = true; this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.36; ev.push({ type: 'tread', near }); } }
        } else if (this.moved && seen) { this.moved = false; ev.push({ type: 'tread', near, late: true }); }      // caught moving: one more step lands, a beat late
        this.close = clamp(1 - (d - 2) / 7, 0, 1);
        this.beatT -= dt;
        if (this.beatT <= 0 && this.close > 0.04) { this.beatT = 1.15 - 0.75 * this.close; ev.push({ type: 'beat', near: this.close }); }
        if (d < 1.7) {
          // it has reached the painter: one paint (two, once it has a few), and it is gone
          const n = Math.min(this.total - this.taken, this.taken >= 2 ? 2 : 1);
          for (let i = 0; i < n; i++) { this.taken++; ev.push({ type: 'take', n: this.taken, last: this.taken >= this.total, at, touch: i === 0 }); }
          if (this.taken >= this.total) { this.whole = true; this.wholeT = 0; } else {
            this.away = 2.5 + Math.random() * 2; this.moved = false;
            this.holdT = this.scared ? 0 : 0.8;
            if (!this.scared) { this.scared = true; ev.push({ type: 'scare', at }); }
            T.root.visible = this.holdT > 0;
          }
        }
      }
    } else if (this.bleak && this.indoors && player) {
      // it went home. It is in the atelier, painting, with its back to the door; struck, it turns round
      const at = T.at;
      at.copy(this.homeSpot); T.root.position.copy(at); T.root.visible = true;
      const want = this.unpainted ? Math.atan2(player.pos.x - at.x, player.pos.z - at.z) : Math.PI;
      T.root.rotation.y += Math.atan2(Math.sin(want - T.root.rotation.y), Math.cos(want - T.root.rotation.y)) * ease(2.5);
      if (player.pos.distanceTo(at) < 9) ev.push({ type: 'say', key: 'home', line: 'It is painting, in your colours. All you have is Cream.' });
    } else if (this.bleak && this.outdoors && player) {
      // somebody in the painter's colours, a long way off, with their back turned. Never there on arrival
      const p = player.pos, at = T.at, d = T.root.visible ? Math.hypot(p.x - at.x, p.z - at.z) : 0;
      this.sightT -= dt;
      if (T.root.visible && (d < 26 || d > 120)) { T.root.visible = false; this.sightT = 16 + Math.random() * 20; }
      else if (!T.root.visible && this.sightT <= 0) {
        this.sightT = 5;
        for (const far of [54, 44, 64, 36]) {
          const a = (Math.random() - 0.5) * 0.9, c = Math.cos(a), s = Math.sin(a), g = this.gaze;
          const x = p.x + (g.x * c - g.z * s) * far, z = p.z + (g.x * s + g.z * c) * far, y = this.world.groundHeight(x, z, 1e9);
          if (y > -Infinity && Math.abs(y - p.y) < 40) { at.set(x, y, z); T.root.position.copy(at); T.root.rotation.y = Math.atan2(x - p.x, z - p.z); T.root.visible = true; break; }
        }
      }
    } else T.root.visible = false;
    // what it takes, it is painted with; what the painter loses leaves them an outline
    const f = (this.whole ? 1 : Math.min(1, this.taken / this.total)) * (1 - this.unpainted / 3), kT = Math.round((1 - f) * T.parts.length);
    if (kT !== T.k) { T.k = kT; dress(T.parts, this.shade, kT, false); }

    this.framePic.visible = this.bleak; this.framePic.material.map = this.wiped ? this.selfTex : this.portraits[Math.min(3, this.after)];
    this.frameGlow.material.opacity += ((this.whole && this.wholeT > 3.5 && !this.ended ? 0.55 : 0) - this.frameGlow.material.opacity) * ease(1.5);
    if (this.ending) this.ending.t += dt;
    const gone = this.grey && inHall;
    for (const h of this.hung) {
      // in the grey room, whoever is in a picture is nearer the glass each time the painter looks away from it
      if (gone) {
        const ex = h.at.x - this.eye.x, ez = h.at.z - this.eye.z, el = Math.hypot(ex, ez) || 1, seen = (ex * this.gaze.x + ez * this.gaze.z) / el > 0.72;
        if (h.seen && !seen) h.stage = Math.min(2, h.stage + 1);
        h.seen = seen;
      } else { h.stage = 0; h.seen = false; }
    }
    // standing in front of a picture that has a name: say it (it reads the same whatever has become of its colours)
    {
      let name = null;
      if (inHall && !this.grey) for (const d of this.doors) if (d.toast && d.toast[0] !== 'Varnishing Day' && d.at.distanceTo(player.pos) < 6.5) name = d.toast[0];
      if (name !== this._facing) { this._facing = name; if (name) ev.push({ type: 'title', name }); }
    }
    // (as it hangs in the gallery, the picture shows how much has been mixed in it)
    this.hung[0].pic.material.map = gone ? this.hung[0].greys[this.hung[0].stage] : this.hung[0].list[this.tubes.made];
    this.trail.visible = this.ended;
    for (const m of this.tears) m.visible = this.bleak;
    // the field: the piper plays, and the companions go to the piper and stay. Afterwards, this is where they are
    {
      const P = S.piper, here = !!player && this.onField(player.pos), dist = player ? player.pos.distanceTo(S.npcAt) : 99;
      P.visible = !this.ended; S.hat.visible = this.ended;
      if (!this.ended) {
        // a little dance: a bob, a sway, a turn toward whoever has come
        P.position.y = S.npcAt.y + Math.abs(Math.sin(t * 5.2)) * 0.22;
        P.rotation.z = Math.sin(t * 2.6) * 0.14;
        const want = here && dist < 14 ? Math.atan2(player.pos.x - S.npcAt.x, player.pos.z - S.npcAt.z) : Math.sin(t * 0.7) * 1.2;
        P.rotation.y += Math.atan2(Math.sin(want - P.rotation.y), Math.cos(want - P.rotation.y)) * ease(3);
        if (here && dist < 26) { S.noteT -= dt; if (S.noteT <= 0) { S.noteT = 0.24; ev.push({ type: 'note', i: S.note++, near: clamp(1.2 - dist / 20, 0.25, 1) }); } }
        if (here && dist < 13 && !this.joined && blots && blots.some((b) => b.awake)) { this.joined = true; ev.push({ type: 'join', at: S.npcAt }); }
        // the ring they dance in
        const a = t * 1.25;
        S.lead.pos.set(S.npcAt.x + Math.cos(a) * 2.3, S.npcAt.y, S.npcAt.z + Math.sin(a) * 2.3);
        S.lead.vel.set(-Math.sin(a) * 2.9, 0, Math.cos(a) * 2.9); S.lead.heading = Math.atan2(S.lead.vel.x, S.lead.vel.z);
      }
      // the village: everybody dancing, in time with the Piper. Afterwards they are where they fell, and the lights are out
      {
        const V = S.village;
        V.windows.visible = !this.ended; for (const b of V.bulbs) b.visible = !this.ended;
        if (this.ended && !V.down) {
          V.down = true;
          for (const q of V.folk) { q.m.rotation.set(0, q.i * 1.3, 1.45); q.m.position.y = surfY(SUMMER, q.m.position.x, q.m.position.z) + 0.34 * q.k; }
        }
        if (!this.ended) for (const q of V.folk) {
          const hop = Math.abs(Math.sin(t * 5.2 + q.i * 0.9)), m = q.m;
          if (q.kind === 'ring') {
            const a = q.ph + t * q.w, x = q.c.x + Math.cos(a) * q.rad, z = q.c.z + Math.sin(a) * q.rad;
            m.position.set(x, surfY(SUMMER, x, z) + hop * 0.3 * q.k, z);
            // (a couple face each other; a ring faces the way it goes)
            m.rotation.set(0, q.rad < 1 ? Math.atan2(-Math.cos(a), -Math.sin(a)) : Math.atan2(-Math.sin(a) * q.w, Math.cos(a) * q.w), Math.sin(t * 2.6 + q.i) * 0.12);
          } else {
            m.position.set(q.at.x, surfY(SUMMER, q.at.x, q.at.z) + hop * 0.16, q.at.z);
            m.rotation.set(0, Math.atan2(S.npcAt.x - q.at.x, S.npcAt.z - q.at.z) + Math.sin(t * 0.9 + q.ph) * 0.4, Math.sin(t * 2.6 + q.ph) * 0.1);
          }
        }
      }
      if (blots) {
        let n = 0;
        for (const b of blots) {
          if (!b.awake) continue;
          const spot = S.lie[n++ % S.lie.length];
          if (this.ended) {
            // nobody is dancing now
            if (!b.dead) {
              b.dead = true; b.host = null; b.g.visible = true;
              b.g.scale.setScalar(0.5);                                    // (the size they always were)
              if (n === 1 && !this.crawled) S.crawl.b = b;
              b.g.position.copy(spot.pos); b.g.rotation.set(0, spot.turn, 1.42);
              b.body.scale.set(1.12, 0.62, 1.12); b.eyes.forEach((e) => e.scale.set(1.2, 0.1, 1));
              spot.pool.visible = true;
            }
          } else if (this.joined) {
            if (!b.host) { b.host = S.lead; b.g.visible = true; if (b.g.position.distanceTo(S.npcAt) > 40) b.g.position.set(spot.pos.x, spot.pos.y + 1, spot.pos.z); }
            if (here && Math.random() < dt * 0.7) b.hop(0, Math.random() < 0.25);
          }
        }
      }
    }
    if (this.ended && player && this.onField(player.pos)) {
      const dist = player.pos.distanceTo(S.npcAt), C = S.crawl, b = C.b;
      // the tune is still here, running down, until the painter is close enough to see why
      if (this.bleak && dist > 6.5 && dist < 26) { S.noteT -= dt; if (S.noteT <= 0) { S.noteT = 0.5 + Math.random() * 0.4; ev.push({ type: 'dirge', i: S.note++ }); } }
      // one of them is not quite dead. It tries to come to the painter, and does not get there
      if (b && C.state !== 'done') {
        const q = b.g.position, dx = player.pos.x - q.x, dz = player.pos.z - q.z, d = Math.hypot(dx, dz) || 1;
        if (C.state === 'still' && d < 7.5) { C.state = 'crawl'; b.eyes.forEach((e) => e.scale.set(1.2, 0.45, 1)); }
        if (C.state === 'crawl') {
          if (C.gone > 3.6 || d < 2.3) { C.state = 'done'; this.crawled = true; b.eyes.forEach((e) => e.scale.set(1.2, 0.1, 1)); }
          else {
            const step = 0.42 * dt * (0.55 + 0.45 * Math.sin(t * 2.2));          // in pulls
            q.x += (dx / d) * step; q.z += (dz / d) * step; q.y = surfY(SUMMER, q.x, q.z); C.gone += step;
            b.g.rotation.z = 1.42 + Math.sin(t * 2.2) * 0.07;
            if (C.gone > C.laid * 0.2 && C.laid < S.smear.length) { const m = S.smear[C.laid++]; m.position.set(q.x, q.y + 0.05, q.z); m.scale.setScalar(0.8 + Math.random() * 0.8); m.visible = true; }
          }
        }
      }
    }
    // the companions will not go near that picture, and they do not come through it
    if (blots) for (const b of blots) {
      if (!b.awake || b.host || b.dead) continue;
      b.g.visible = !gone;
      const q = b.g.position, dx = q.x - O.at.x, dz = q.z - O.at.z, d = Math.hypot(dx, dz);
      if (this.slipped && d < 8 && d > 0.01) { const push = (8 - d) * ease(6); q.x += (dx / d) * push; q.z += (dz / d) * push; }
    }
    this.pageDoor.visible = this.lastpage.done;
    this.homeDoor.visible = this.found; this.homeCol.r = this.found ? 1.7 : -1;
    // (the colour goes out of the room slowly, when it goes)
    this.greyK += ((this.grey ? 1 : 0) - this.greyK) * ease(this.grey ? 0.3 : 4);
    // the field: its stream, its pond, its mill
    const run = (st, goal, rate) => {
      st.reach = st.reach < goal ? Math.min(goal, st.reach + dt * rate) : Math.max(goal, st.reach - dt * rate * 1.6);
      st.mat.uniforms.reach.value = st.reach; st.mesh.visible = st.reach > 0.001;
    };
    run(S.stream, S.spots[0].wet ? 1 : 0, 5.5 / S.stream.len);
    run(S.fall, S.stream.reach > 0.97 ? 1 : 0, 0.8);
    S.spots.forEach((s, i) => {
      S.wetK[i] += ((s.wet ? 1 : 0) - S.wetK[i]) * ease(0.6);
      s.pool.material.color.setRGB(0.6 - 0.26 * S.wetK[i], 0.52 + 0.22 * S.wetK[i], 0.38 + 0.52 * S.wetK[i]);
      s.glint.material.opacity = s.wet ? 0 : 0.24 + Math.sin(t * 1.5 + i) * 0.1;
      S.wheat[i].material.color.setRGB(1.0, 0.94 - 0.04 * S.wetK[i], 0.9 - 0.06 * S.wetK[i]);          // (pale, as everything that grows here is)
    });
    S.spin += ((S.spots[1].wet ? 1.6 : 0) - S.spin) * ease(1.2);
    S.wheel.rotation.z -= S.spin * dt;

  }
}
