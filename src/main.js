import * as THREE from 'three';
import { Painterly } from './post.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Particles, SwingFx, Splats, Spark, Drops, Blot } from './entities.js';
import { createHud } from './hud.js';
import { Sound } from './audio.js';
import { Garden } from './bloom.js';
import { Painter, PAINTS } from './paint.js';
import { Vistas } from './vista.js';
import { Day } from './day.js';
import { createSettings } from './settings.js';
import { store, SAVE_VERSION } from './save.js';
import { Secrets } from './secrets.js';
import { Interior } from './interior.js';
import { Sketches } from './sketches.js';
import { SetPieces } from './setpieces.js';
import { Sights } from './sights.js';
import { clamp, lerp, glowTexture } from './util.js';

const V3 = THREE.Vector3;
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const post = new Painterly(renderer);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, 1, 0.3, 2600);
const uTime = { value: 0 };

const world = buildWorld(scene, uTime);
const player = new Player(scene);
const fx = new Particles(scene);
const swings = new SwingFx(scene);
const splats = new Splats(scene);
const sparks = world.sparkSpots.map((p) => new Spark(scene, p, world.glowTex));
const drops = new Drops(scene, world.dropSpots);
const blots = world.blotSpots.map((b, i) => new Blot(scene, b.p, i));
const hud = createHud(world);
const sound = new Sound();
// the hidden places and the inside of the Spire add ground of their own, so they come before anything that asks where the ground is
const secrets = new Secrets(scene, world);
const interior = new Interior(scene, world);
const busy = [world.spawn, world.gate, ...world.sparkSpots, ...world.blotSpots.map((b) => b.p), ...world.dropSpots, ...world.bridges.map((b) => b.anchor)];
const vistas = new Vistas(scene, world, renderer, [...busy, ...secrets.avoid], post);
interior.hang(vistas.spots);
const day = new Day(world, post);
world.vistas = vistas.spots;
const garden = new Garden(scene, world, uTime, [...busy, ...vistas.spots.flatMap((v) => [v.pos, v.easelPos])]);
// what the companions need to know about the world: where the ground is, and where the nearest flower is
const blotCtx = { ground: (x, z, y) => world.groundHeight(x, z, y + 2), flower: (p) => garden.flowerNear(p, 9) };
for (const b of blots) b.ctx = blotCtx;
// what is already somewhere: the set-pieces and the sketches both keep clear of all this
const spokenFor = [
  ...busy.map((p) => ({ x: p.x, z: p.z, r: 4.5 })),
  ...vistas.spots.flatMap((v) => [{ x: v.pos.x, z: v.pos.z, r: 6.5 }, { x: v.easelPos.x, z: v.easelPos.z, r: 6.5 }]),
  ...secrets.places.map((sp) => ({ x: sp.pos.x, z: sp.pos.z, r: 6 })), ...secrets.avoid.map((p) => ({ x: p.x, z: p.z, r: 5 })),
  ...world.winds.flatMap((w) => [{ x: w.pts[0].x, z: w.pts[0].z, r: 5 }, { x: w.pts[w.n].x, z: w.pts[w.n].z, r: 5 }]),
  ...garden.buds.map((b) => ({ x: b.x, z: b.z, r: 2.6 })),
];
// one moment for each of the middle islands (leaves, springs, the great easel), and each of them keeps a spark
const pieces = new SetPieces(scene, world, uTime, vistas, spokenFor);
const [heapSpark, springSpark, easelSpark] = sparks;
function holdSparks() {
  // under the heap of leaves on Maple Step, until they are scattered
  heapSpark.locked = !pieces.leaves.uncovered;
  // in the first spring on Weeping Palette, until the spring is given a colour
  const spring = pieces.springs.list[0];
  if (spring) { springSpark.moveTo(new V3(spring.x, spring.y, spring.z)); springSpark.locked = !spring.hex; }
  // nowhere at all, until the great easel has finished its picture; until then, the canvas is the thing to look at
  easelSpark.locked = easelSpark.hidden = !pieces.easel.seen;
  easelSpark.lure = pieces.easel.center;
}
holdSparks();
// sketches go wherever nothing else already is
const sketches = new Sketches(scene, world, uTime, [
  ...spokenFor, ...pieces.avoid,
  ...busy.map((p) => ({ x: p.x, z: p.z, r: 4.5 })),
  ...vistas.spots.flatMap((v) => [{ x: v.pos.x, z: v.pos.z, r: 6.5 }, { x: v.easelPos.x, z: v.easelPos.z, r: 6.5 }]),
  ...secrets.places.map((s) => ({ x: s.pos.x, z: s.pos.z, r: 6 })), ...secrets.avoid.map((p) => ({ x: p.x, z: p.z, r: 5 })),
  ...world.winds.flatMap((w) => [{ x: w.pts[0].x, z: w.pts[0].z, r: 5 }, { x: w.pts[w.n].x, z: w.pts[w.n].z, r: 5 }]),
  ...garden.buds.map((b) => ({ x: b.x, z: b.z, r: 2.6 })),
]);
// the muse's eyes, the fish in the sea, the paper birds, and the way up to the great brush
const sights = new Sights(scene, world, interior.nest.center, [...spokenFor, ...pieces.avoid, ...sketches.items.map((q) => ({ x: q.pos.x, z: q.pos.z, r: 4 }))]);
/** The great brush has lent its reach: the painter's own brush is fuller, and every swing paints wider. */
function takeReach(quiet = false) {
  game.reach = true;
  sights.brush.take();
  for (const k of ['tip', 'backTip']) player.model[k].scale.setScalar(1.5);
  if (quiet) return;
  fx.burst(sights.brush.hairAt, 70, { speed: 7, up: 8, colors: ['#fff6d0', '#ffd060', '#ffffff', '#ff9a3a'], size: 0.5, life: 1.6, gravity: 6, boost: 1.6 });
  sound.play('bridge'); post.flash = 0.3;
  hud.toast('The great brush', 'It lends you its reach', 4600);
  hud.hint('Every swing of your brush paints wider now.', 7500);
  cheerAll();
  saveSoon();
}
/** Every companion celebrates, one after another. */
const cheerAll = () => blots.forEach((b) => b.cheer(0.1 + b.slot * 0.09));

// a soft smudge of shadow under the painter keeps them planted on the paint
const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: glowTexture('rgba(30,8,62,1)', 'rgba(30,8,62,0.85)', 'rgba(30,8,62,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
);
scene.add(shadow);

const painter = new Painter(renderer, world);

const game = {
  state: 'title', // title | play | finale | gallery | menu
  menu: null,      // the settings panel: null, or where it was opened from ('title' | 'play')
  started: false,  // set once the player has begun (or continued): from then on the journey is saved
  resumed: false,  // this journey was picked up from an earlier visit
  titleYaw: 0.38,  // where the opening shot looks from: always over the painter's left shoulder
  sparks: 0, friends: 0, won: false,
  yaw: 0.38, pitch: 0.2, dist: 7.6, flow: 0,
  day: 0, dayGoal: 0,      // time of day (see day.js): as late as the farthest point reached
  gateHold: 0, finaleT: 0, paintSfx: 0, guideT: 0, chime: 0, playT: 0, hints: {},
  paint: 2,        // which of PAINTS is on the brush
  intro: 0,        // 0 = the wide opening shot, 1 = over the painter's shoulder
  lookIdle: 9,     // seconds since the player last steered the camera
  locked: false, unlocked: false,
  rest: null, lastRest: null, restT: 0, restBlend: 0, restBloom: 0, vistas: 0,     // resting at an easel
  journey: 1,      // which time through this is
  keep: [],        // paints brought along from an earlier journey
  shot: null,      // photo mode: set to take a picture of the next frame
};
const start = world.spawn.clone(); start.y = world.groundHeight(start.x, start.z, 1e9);
player.teleport(start, Math.PI);

// ---------------------------------------------------------------- input
const keys = new Set();
const pressed = new Set();
let dragging = false;
addEventListener('keydown', (e) => {
  // while the settings are open the keyboard belongs to the panel's own controls
  if (game.menu) { if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); closeMenu(); } return; }
  // on the title and in the gallery, a focused button or link answers to the keyboard in the usual way
  if (game.state !== 'play' && game.state !== 'finale') {
    if (e.code === 'Tab') return;
    if ((e.code === 'Enter' || e.code === 'Space') && e.target instanceof Element && e.target.closest('button, a')) return;
  }
  if (e.repeat) return;
  keys.add(e.code); pressed.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('mousedown', (e) => {
  if (game.state === 'photo') { dragging = true; return; }
  if (game.state !== 'play') return;
  sound.start();
  if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.()?.catch?.(() => {}); dragging = true; }
  if (e.button === 0) { pressed.add('Attack'); keys.add('Attack'); }     // held: keeps painting
  if (e.button === 2) pressed.add('NextPaint');
});
addEventListener('mouseup', (e) => { dragging = false; if (e.button === 0) keys.delete('Attack'); });
// A captured mouse sometimes reports a single enormous movement out of nowhere: a known quirk of some browser and
// mouse combinations, and common in the instant after the pointer is captured or the window regains focus. One such
// event is enough to spin the view half-way round. So: nothing counts for a moment after capture or refocus, and a
// movement that is both large and wildly out of line with the ones just before it is dropped. A genuine fast flick
// builds up over a few events, or carries on in the same direction, so it gets through.
const mouse = { pace: 0, at: 0, quietUntil: 0, dropAt: -1e9, dropSign: 0, dropped: 0 };
const settleMouse = () => { mouse.quietUntil = performance.now() + 150; mouse.pace = 0; };
function plausible(e) {
  const now = performance.now();
  mouse.pace *= Math.exp(-(now - mouse.at) / 150); mouse.at = now;
  if (now < mouse.quietUntil) return false;
  const mag = Math.hypot(e.movementX, e.movementY), sign = Math.sign(e.movementX);
  if (mag > 100 && mag > 6 * mouse.pace + 80 && !(now - mouse.dropAt < 80 && sign === mouse.dropSign)) {
    mouse.dropAt = now; mouse.dropSign = sign; mouse.dropped++;
    return false;
  }
  mouse.pace += (mag - mouse.pace) * 0.5;
  return true;
}
document.addEventListener('pointerlockchange', settleMouse);
addEventListener('focus', settleMouse);
addEventListener('mousemove', (e) => {
  if ((game.state === 'photo' || game.state === 'play') && !plausible(e)) return;
  if (game.state === 'photo') {
    if (document.pointerLockElement === canvas || dragging) {
      const look = settings.values.look;
      photo.yaw -= e.movementX * 0.0026 * look;
      photo.pitch = clamp(photo.pitch + e.movementY * 0.0022 * look * (settings.values.invert ? -1 : 1), -1.25, 1.4);
    }
    return;
  }
  if (game.state !== 'play') return;
  if (document.pointerLockElement === canvas || dragging) {
    const look = settings.values.look;
    game.yaw -= e.movementX * 0.0026 * look;
    game.pitch = clamp(game.pitch + e.movementY * 0.0022 * look * (settings.values.invert ? -1 : 1), -0.45, 1.15);
    game.lookIdle = 0;
  }
});
addEventListener('wheel', (e) => {
  if (game.state === 'photo') photo.dist = clamp(photo.dist * (1 + Math.sign(e.deltaY) * 0.12), 1.2, 70);
  else game.dist = clamp(game.dist + Math.sign(e.deltaY) * 0.6, 4.5, 14);
}, { passive: true });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function begin() {
  if (game.state !== 'title') return;
  document.getElementById('title').classList.add('hidden');
  game.state = 'play'; game.started = true; hud.show(true);
  game.pitch = 0.16; game.lookIdle = 0;
  document.activeElement?.blur?.();
  sound.start();
  canvas.requestPointerLock?.()?.catch?.(() => {});
  const here = game.resumed ? world.islandAt(player.pos.x, player.pos.z) : null;
  setTimeout(() => (game.resumed ? hud.toast(here ? here.name : 'The Everpainting Spire', 'Where you left off') : hud.toast('Lantern Rise', game.journey > 1 ? 'The first stroke, again' : 'The first stroke')), 2800);
}
document.getElementById('begin').addEventListener('click', begin);
// letting go of the mouse (Esc, or switching to another window) is a pause: the settings open
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { if (game.unlocked) hud.clearHint(); game.locked = true; game.unlocked = false; }
  else if (game.locked && game.state === 'play') { game.locked = false; openMenu(); }
});
document.addEventListener('visibilitychange', () => { sound.pause(document.hidden); keys.clear(); if (document.hidden) saveGame(); });
addEventListener('pagehide', () => saveGame());
// ---------------------------------------------------------------- the gallery: the views painted at the easels
const $id = (id) => document.getElementById(id);
function fillGallery() {
  const el = $id('gallery');
  el.textContent = '';
  let n = 0;
  for (const v of vistas.spots) {
    const fig = document.createElement('figure'), cap = document.createElement('figcaption');
    if (v.done) {
      n++;
      const url = vistas.picture(v).toDataURL('image/png');
      const img = document.createElement('img'); img.className = 'pic'; img.src = url; img.alt = v.name;
      const save = document.createElement('a'); save.href = url; save.textContent = 'Save';
      save.download = 'everpainting-' + v.name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') + '.png';
      cap.textContent = v.name;
      fig.append(img, cap, save);
    } else {
      fig.className = 'empty';
      const blank = document.createElement('div'); blank.className = 'pic';
      cap.textContent = 'An easel still waiting';
      fig.append(blank, cap);
    }
    el.appendChild(fig);
  }
  return n;
}
const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
const nth = (n) => ORDINAL[n] || `${n}th`;
/** The sketchbook page under the paintings: everything found and painted so far. Returns how much of it there is. */
function fillBook() {
  const el = $id('book');
  el.textContent = '';
  let done = 0, total = 0;
  const add = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const row = (label, fill) => { const v = add('div', 'val'); fill(v); el.append(add('div', 'lbl', label), v); };
  const dots = (v, list, n) => { for (const hex of list) { const d = add('i', hex ? 'dot' : 'dot none'); if (hex) d.style.background = hex; v.appendChild(d); } v.appendChild(add('span', 'count', `${n} of ${list.length}`)); done += n; total += list.length; };
  const names = (v, list) => list.forEach(([name, have], k) => { if (k) v.appendChild(add('span', 'sep', '·')); v.appendChild(add('span', have ? '' : 'dim', have ? name : '· · ·')); done += have ? 1 : 0; total++; });
  done += game.vistas; total += vistas.spots.length;                    // the paintings above count too
  row('Sparks', (v) => dots(v, sparks.map((s) => (s.taken ? '#ffd060' : null)), game.sparks));
  row('Companions', (v) => dots(v, blots.map((b) => (b.awake ? b.color : null)), game.friends));
  row('Sketches', (v) => dots(v, sketches.items.map((s) => s.hex), sketches.painted));
  row('Springs', (v) => dots(v, pieces.springs.list.map((s) => s.hex), pieces.springs.list.filter((s) => s.hex).length));
  row('Hidden places', (v) => names(v, secrets.places.map((s) => [s.name, s.found])));
  const have = palette();
  row('Paints', (v) => { for (const [i, p] of PAINTS.entries()) { const d = add('i', have.includes(i) ? 'dot' : 'dot none'); if (have.includes(i)) d.style.background = p.hex; d.title = have.includes(i) ? p.name : ''; v.appendChild(d); } });
  row('The Spire', (v) => names(v, [['The last stroke', game.won], ['The atelier', !!game.hints.atelier], ['The crow\u2019s nest', !!game.hints.nest], ['The great brush', !!game.reach]]));
  const mins = Math.max(1, Math.round(game.playT / 60));
  row('Wandering', (v) => v.appendChild(add('span', '', `${mins} minute${mins === 1 ? '' : 's'}${game.journey > 1 ? `, on your ${nth(game.journey)} journey` : ''}`)));
  if (done === total) el.appendChild(add('div', 'full', 'Everything is found, and everything is painted. The sketchbook is full.'));
  return { done, total };
}
function openGallery(final) {
  const n = fillGallery(), all = vistas.spots.length;
  fillBook();
  $id('again').hidden = !game.won;
  if (final) {
    $id('endKicker').textContent = 'The final stroke'; $id('endTitle').textContent = 'It is yours.';
    $id('endText').textContent = 'The Spire is finished, for now. Paintings like this one never really are. Across the sky, the sleeper has opened her eyes to see it. '
      + (n ? (n === 1 ? 'Here is the view you painted on the way.' : 'Here are the views you painted on the way.') : 'The easels along the way are still waiting, if you would like to paint a view.');
    $id('wander').textContent = 'Keep wandering';
  } else {
    $id('endKicker').textContent = 'Your sketchbook';
    $id('endTitle').textContent = n === 0 ? 'Nothing painted yet' : n === all ? 'Every view is yours' : n + ' of ' + all + ' views painted';
    $id('endText').textContent = 'Sit at an easel to paint what it looks out on; each finished picture is yours to save. Below is everything else you have found.';
    $id('wander').textContent = 'Back to the world';
    game.state = 'gallery'; hud.prompt(null);
  }
  $id('ending').classList.remove('hidden');
  document.exitPointerLock?.();
}
document.getElementById('wander').addEventListener('click', () => {
  document.getElementById('ending').classList.add('hidden');
  game.state = 'play'; hud.show(true);
  canvas.requestPointerLock?.()?.catch?.(() => {});
  if (game.won) hint('door', 'The door of the Spire stands open now.', 8000);
  if (game.won) setTimeout(() => hint('photo', 'Press C to stop the world and take a picture of it.', 7000), 9000);
});

// ---------------------------------------------------------------- the settings panel
function openMenu() {
  if (game.menu || (game.state !== 'title' && game.state !== 'play')) return;
  game.menu = game.state;
  if (game.menu === 'play') { game.state = 'menu'; saveGame(); hud.prompt(null); hud.show(false); }
  else $id('title').classList.add('hidden');
  keys.clear(); pressed.clear(); dragging = false;
  $id('menuKicker').textContent = game.menu === 'title' ? 'Before you set out' : 'A moment\u2019s pause';
  $id('resume').textContent = game.menu === 'title' ? 'Done' : 'Back to the world';
  $id('startOver').hidden = !(game.started || game.resumed);
  $id('saveNote').textContent = store.ok && settings.stored
    ? 'Your painting is kept in this browser as you go. Close the window whenever you like.'
    : 'This browser is not letting the painting be kept, so it will last only as long as this window stays open.';
  $id('sketchNote').hidden = !sketches.painted;
  $id('sketchNote').textContent = sketches.painted === sketches.total ? 'You have painted every sketch.' : `You have painted ${sketches.painted} of ${sketches.total} sketches.`;
  $id('again2').hidden = !game.won;
  const n = secrets.found, all = secrets.places.length;
  $id('foundNote').hidden = !n;
  $id('foundNote').textContent = n === all ? 'You have found every hidden place.' : `You have found ${n} of ${all} hidden places.`;
  $id('menu').classList.remove('hidden');
  document.exitPointerLock?.();
  $id('resume').focus({ preventScroll: true });
}
function closeMenu() {
  if (!game.menu) return;
  const from = game.menu;
  game.menu = null;
  $id('menu').classList.add('hidden');
  document.activeElement?.blur?.();
  if (from === 'title') { $id('title').classList.remove('hidden'); return; }
  game.state = 'play'; game.lookIdle = 0; hud.show(true);
  canvas.requestPointerLock?.()?.catch?.(() => {});
  // closing with Esc cannot take the mouse back by itself, so say how
  setTimeout(() => {
    if (game.state === 'play' && document.pointerLockElement !== canvas) { game.unlocked = true; hud.hint('Click to look around again', 7000); }
  }, 600);
}
$id('openSettings').addEventListener('click', openMenu);
$id('resume').addEventListener('click', closeMenu);
// starting over asks twice, then washes the saved journey away and loads the world fresh (settings are kept)
for (const id of ['startOver', 'titleOver']) {
  const btn = $id(id), label = btn.textContent;
  let timer = 0;
  btn.addEventListener('click', () => {
    if (btn.dataset.armed) { store.clear(); location.reload(); return; }
    btn.dataset.armed = '1'; btn.textContent = 'Wash it all away? Click again';
    clearTimeout(timer);
    timer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = label; }, 4500);
  });
}

// a second journey: the canvas is washed clean, but what was earned comes along
// (the paints found in hidden places, the companions' colours, and the reach of the great brush)
function secondJourney() {
  store.restart({
    v: SAVE_VERSION, at: Date.now(), fresh: true, journey: game.journey + 1,
    keep: palette().filter((i) => PAINTS[i].hidden), tints: blots.map((b) => b.color), reach: !!game.reach,
    hints: ['move', 'paint', 'skate', 'glide', 'map', 'wind', 'rise', 'gallery', 'photo'].filter((k) => game.hints[k]),
  });
  location.reload();
}
for (const id of ['again', 'again2']) {
  const btn = $id(id), label = btn.textContent;
  let timer = 0;
  btn.addEventListener('click', () => {
    if (btn.dataset.armed) { secondJourney(); return; }
    btn.dataset.armed = '1'; btn.textContent = 'Wash the canvas, keep the palette? Click again';
    clearTimeout(timer);
    timer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = label; }, 5000);
  });
}

// ---------------------------------------------------------------- photo mode: stop the world, move the camera, keep the picture
const photo = { yaw: 0, pitch: 0.2, dist: 8, focus: new V3(), hid: null };
function openPhoto() {
  if (game.state !== 'play') return;
  game.state = 'photo';
  // start from exactly what is on screen: the camera where it is, turning about the point it was looking at
  const d = Math.max(3, camera.position.distanceTo(camTarget));
  camera.getWorldDirection(photo.focus).multiplyScalar(d).add(camera.position);
  const v = tmp.subVectors(camera.position, photo.focus);
  photo.dist = v.length(); photo.pitch = Math.asin(clamp(v.y / photo.dist, -1, 1)); photo.yaw = Math.atan2(v.x, v.z);
  hud.show(false); hud.prompt(null);
  keys.clear(); dragging = false; document.activeElement?.blur?.();
  $id('photoBar').classList.add('on');
}
function closePhoto() {
  if (game.state !== 'photo') return;
  showPainter(true);
  game.state = 'play'; game.lookIdle = 0;
  hud.show(true); keys.clear();
  $id('photoBar').classList.remove('on');
}
/** In a photo the painter (with their cape, ribbons and shadow) can step out of the picture. */
function showPainter(on) {
  if (on) { if (photo.hid) { for (const [o, was] of photo.hid) o.visible = was; photo.hid = null; } return; }
  if (photo.hid) return;
  photo.hid = [player.group, player.cape.mesh, ...player.ribbons.map((r) => r.mesh), shadow].map((o) => [o, o.visible]);
  for (const [o] of photo.hid) o.visible = false;
}
function updatePhoto(dt) {
  if (pressed.has('KeyC') || pressed.has('Escape')) { closePhoto(); return; }
  if (pressed.has('KeyV')) showPainter(!!photo.hid);
  if (pressed.has('Enter')) game.shot = savePicture;
  // the point the camera turns about moves with W A S D, level with the ground, and up and down with Space and Shift
  const sp = (3 + photo.dist * 0.55) * dt, fz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), fx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  photo.focus.x += (-Math.sin(photo.yaw) * fz + Math.cos(photo.yaw) * fx) * sp;
  photo.focus.z += (-Math.cos(photo.yaw) * fz - Math.sin(photo.yaw) * fx) * sp;
  photo.focus.y += ((keys.has('Space') ? 1 : 0) - (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0)) * sp;
  if (keys.has('ArrowLeft')) photo.yaw += dt * 1.6;
  if (keys.has('ArrowRight')) photo.yaw -= dt * 1.6;
  if (keys.has('ArrowUp')) photo.pitch = clamp(photo.pitch + dt, -1.25, 1.4);
  if (keys.has('ArrowDown')) photo.pitch = clamp(photo.pitch - dt, -1.25, 1.4);
  const cy = Math.cos(photo.pitch);
  camPos.set(photo.focus.x + Math.sin(photo.yaw) * cy * photo.dist, photo.focus.y + Math.sin(photo.pitch) * photo.dist, photo.focus.z + Math.cos(photo.yaw) * cy * photo.dist);
  const gh = world.groundHeight(camPos.x, camPos.z, camPos.y + 3);
  if (gh > -Infinity && camPos.y < gh + 0.4) camPos.y = gh + 0.4;
  interior.clampCamera(camPos);
  camera.position.copy(camPos);
  camera.lookAt(photo.focus);
}
/** Hand the picture on screen to the browser to keep as a file. */
function savePicture(blob) {
  if (!blob) return;
  const a = document.createElement('a'), stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = URL.createObjectURL(blob); a.download = `everpainting-${stamp}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------------------------------------------------------------- keeping the journey
const r2 = (v) => Math.round(v * 100) / 100;
let saveT = 6;
function snapshot() {
  // somewhere solid to come back to: where the painter stands, or the last safe ground if they are in the air or on a bridge
  const solid = player.grounded && !player.lift && !player.ride && world.islandAt(player.pos.x, player.pos.z);
  const p = player.seat ? player.seat.pos : solid ? player.pos : player.safe;
  return {
    v: SAVE_VERSION, at: Date.now(),
    pos: [r2(p.x), r2(p.y), r2(p.z)], heading: r2(player.heading),
    sparks: sparks.map((sp) => (sp.taken ? 1 : 0)),
    blots: blots.map((b) => (b.awake ? b.slot : -1)), tints: blots.map((b) => b.color),
    drops: drops.items.map((d) => (d.taken ? 1 : 0)),
    bridges: world.bridges.map((b) => Math.round(b.progress * 1000) / 1000),
    vistas: vistas.spots.map((v) => (v.done ? 1 : 0)),
    won: game.won, dayGoal: r2(game.dayGoal), paint: game.paint, playT: Math.round(game.playT), hints: Object.keys(game.hints),
    journey: game.journey, keep: game.keep,
    garden: garden.save(), strikes: painter.log, secrets: secrets.save(), sketches: sketches.save(), pieces: pieces.save(), reach: !!game.reach,
  };
}
function saveGame() { if (game.started) store.write(snapshot()); }
const saveSoon = () => { saveT = Math.min(saveT, 0.6); };
/** A finished painting is kept as a picture of its own, so it comes back exactly as it was painted. */
function keepPicture(v) {
  try { store.setPicture(vistas.spots.indexOf(v), vistas.picture(v).toDataURL('image/jpeg', 0.9)); } catch (e) { store.ok = false; }
  saveSoon();
}
/** Put the world back the way an earlier visit left it. Runs once, before the first frame. */
function restore(d) {
  game.journey = Math.max(1, Math.floor(Number(d.journey)) || 1);
  game.keep = Array.isArray(d.keep) ? d.keep.filter((i) => Number.isInteger(i) && PAINTS[i] && PAINTS[i].hidden) : [];
  (d.bridges || []).forEach((p, i) => { const br = world.bridges[i]; if (br && p > br.progress) br.set(p); });
  (d.sparks || []).forEach((taken, i) => { const sp = sparks[i]; if (sp && taken) { sp.taken = true; sp.g.visible = false; game.sparks++; } });
  player.setSparks(game.sparks);
  (d.drops || []).forEach((taken, i) => { const dr = drops.items[i]; if (dr && taken) { dr.taken = true; dr.m.visible = false; } });
  garden.load(d.garden);
  secrets.load(d.secrets);
  sketches.load(d.sketches);
  pieces.load(d.pieces);
  painter.replay(d.strikes);
  (d.vistas || []).forEach((done, i) => {
    const v = vistas.spots[i], url = v && done ? store.picture(i) : null;
    if (url) { game.vistas++; vistas.restore(v, url, () => { game.vistas--; }); }
  });
  for (const k of d.hints || []) game.hints[k] = true;
  pieces.easel.seen = !!game.hints.bigEasel;
  holdSparks();
  game.playT = Number(d.playT) || 0;
  setPaint(Number.isInteger(d.paint) ? d.paint : 2, true);

  // the painter, back on the ground where they stood
  const p = new V3().fromArray(Array.isArray(d.pos) ? d.pos : []), heading = Number.isFinite(d.heading) ? d.heading : Math.PI;
  const gh = Number.isFinite(p.x + p.y + p.z) ? world.groundHeight(p.x, p.z, p.y + 2) : -Infinity;
  if (gh > -Infinity) p.y = gh; else p.copy(start);
  player.teleport(p, heading);
  game.titleYaw = 0.38 + heading - Math.PI;
  view.yaw = game.yaw = game.titleYaw;
  // companions gather round again, in the order they were woken
  (d.tints || []).forEach((hex, i) => { if (blots[i] && /^#[0-9a-f]{6}$/i.test(hex)) blots[i].setColor(hex); });
  (d.blots || []).map((slot, i) => ({ slot, b: blots[i] })).filter((e) => e.b && e.slot >= 0).sort((a, b) => a.slot - b.slot).forEach(({ b }, n) => {
    b.wake(game.friends++); b.pop = 0;
    b.g.position.set(p.x + Math.cos(n * 2.1) * 2.2, p.y + 1.2, p.z + Math.sin(n * 2.1) * 2.2);
  });

  game.dayGoal = clamp(Number(d.dayGoal) || 0, 0, 1.25);
  if (d.won) {
    // the last stroke stays laid, and it stays night
    game.won = true; game.endShown = true; game.dayGoal = 1.25;
    hud.questDone();
    const f = world.finale;
    f.visible = true; f.geometry.setDrawRange(0, f.userData.segs * f.userData.vps);
    world.sky.material.uniforms.glow.value = 1;
    post.sat = 1.42;
    sights.muse.wake(true);
  }
  if (d.reach) takeReach(true);
  game.day = game.dayGoal; day.set(game.day);
  game.resumed = !d.fresh;          // (a second journey that has not begun yet is a beginning, not a continuing)
}

// ---------------------------------------------------------------- sizing
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h, false);
  const s = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(s.x, s.y);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  document.getElementById('hud').style.zoom = clamp(Math.min(w / 1500, h / 860), 0.55, 1.2);
  const ps = post.ih / (2 * Math.tan((camera.fov * Math.PI) / 360));
  fx.mat.uniforms.scale.value = ps;
  world.petals.material.uniforms.scale.value = ps;
}
addEventListener('resize', resize);
resize();

let lastVolume = 0.8;       // what M brings the sound back to
const settings = createSettings((key, v) => {
  if (key === 'volume') sound.setVolume(v);
  else if (key === 'music') sound.setMusic(v);
  else if (key === 'filter') post.mode = v;
  else if (key === 'detail') { post.maxH = [540, 760, 1080][v]; resize(); }
  else if (key === 'sharp') post.sharp = v ? 1 : 0;
});

// ---------------------------------------------------------------- camera
const camTarget = new V3().copy(player.pos).add(new V3(0, 1.6, 0));
const camPos = new V3();
const tmp = new V3(), tmp2 = new V3();
const view = { yaw: game.yaw, pitch: game.pitch };      // what the camera actually shows: game.yaw/pitch, smoothed
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function updateCamera(dt, snap = false) {
  const playing = game.state === 'play';
  if (game.cut) { game.cut = false; snap = true; view.yaw = game.yaw; view.pitch = game.pitch; }      // stepping through a door: no gliding across
  // the opening shot settles down behind the painter once the game begins
  if (playing && game.intro < 1) game.intro = Math.min(1, game.intro + dt / 3.6);
  const k = game.intro * game.intro * (3 - 2 * game.intro);

  // Left alone, the camera settles to a comfortable height, and while a wind is carrying the painter it turns to
  // look along the current. It does not turn to follow ordinary walking. The controls are relative to the camera, so
  // if the view turned toward a painter who is walking sideways, "sideways" would turn with it, and the two would
  // chase each other round: holding A used to swing the view right round by itself.
  game.lookIdle += dt;
  if (playing && settings.values.follow && game.lookIdle > 1.8 && Math.hypot(player.vel.x, player.vel.z) > 2.5) {
    const ramp = Math.min(1, (game.lookIdle - 1.8) / 1.5);
    if (player.ride) {
      const d = angDiff(player.heading - Math.PI, game.yaw);
      game.yaw += d * (0.5 + 0.5 * Math.cos(d)) * ramp * (1 - Math.exp(-1.8 * dt));
    }
    game.pitch += ((player.ride || player.gliding ? 0.3 : 0.16) - game.pitch) * ramp * (1 - Math.exp(-0.5 * dt));
  }
  const q = snap ? 1 : 1 - Math.exp(-18 * dt);
  view.yaw += angDiff(game.yaw, view.yaw) * q; view.pitch += (game.pitch - view.pitch) * q;

  // the camera eases back and the view widens whenever the painter is flowing: skating, gliding, riding wind
  const flow = player.ride ? 1 : player.gliding ? 0.8 : player.surfing ? 0.5 : 0;
  game.flow += (flow - game.flow) * (1 - Math.exp(-2.2 * dt));
  const dist = lerp(16, game.dist + game.flow * 3.2, k);
  const lift = lerp(3.4, 1.75, k);
  const side = lerp(-5.5 * clamp((camera.aspect - 0.9) / 0.8, 0, 1), 0.95, k);   // title: the painter stands off to the right
  game.restBlend = clamp(game.restBlend + (game.rest ? dt / 3.8 : -dt / 1.7), 0, 1);
  const rk = game.restBlend * game.restBlend * (3 - 2 * game.restBlend);
  const fov = 56 + game.flow * 9 - rk * (game.lastRest ? game.lastRest.fovDrop : 0);
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const cy = Math.cos(view.pitch), sy = Math.sin(view.pitch);
  const rx = Math.cos(view.yaw), rz = -Math.sin(view.yaw);
  tmp.set(player.pos.x + rx * side, player.pos.y + lift, player.pos.z + rz * side);
  // follow closely sideways, a little more lazily up and down so jumps and bobbing do not shake the view
  const kh = snap ? 1 : 1 - Math.exp(-11 * dt), kv = snap ? 1 : 1 - Math.exp(-(player.grounded ? 7 : 11) * dt);
  camTarget.x += (tmp.x - camTarget.x) * kh; camTarget.z += (tmp.z - camTarget.z) * kh; camTarget.y += (tmp.y - camTarget.y) * kv;
  camPos.set(camTarget.x + Math.sin(view.yaw) * cy * dist, camTarget.y + sy * dist, camTarget.z + Math.cos(view.yaw) * cy * dist);
  const gh = world.groundHeight(camPos.x, camPos.z, camPos.y + 3);
  if (gh > -Infinity && camPos.y < gh + 1.1) camPos.y = gh + 1.1;
  interior.clampCamera(camPos);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
  if (rk > 0 && game.lastRest) {
    // the resting shot: wide, a little to one side of the painter, drifting very slowly
    const v = game.lastRest;
    tmp.copy(v.camPos).addScaledVector(v.right, Math.sin(uTime.value * 0.13) * 0.7).addScaledVector(v.dir, Math.min(2.4, game.restT * 0.05));
    camera.position.lerp(tmp, rk);
    camera.lookAt(tmp2.copy(camTarget).lerp(v.camLook, rk));
  }
}

const UP = new V3(0, 1, 0);
function updateShadow() {
  // cast away from the sun, so it slides out from under the painter as they leave the ground
  const p = player.pos, lift = Math.max(0, p.y - world.groundHeight(p.x, p.z, p.y + 0.6));
  const sun = world.light.sun.position, flat = Math.hypot(sun.x, sun.z) || 1;           // the sun moves through the day
  const off = 0.3 + Math.min(lift, 12) * Math.min(1.5, (flat / Math.max(0.2, sun.y)) * 0.76);
  const x = p.x - (sun.x / flat) * off, z = p.z - (sun.z / flat) * off;
  let gh = world.groundHeight(x, z, p.y + 0.6);
  if (gh === -Infinity) gh = world.groundHeight(p.x, p.z, p.y + 0.6);
  const h = p.y - gh;
  shadow.visible = gh > -Infinity && h < 16;
  if (!shadow.visible) return;
  // lie along the slope of whatever is underfoot
  const e = 0.5, top = gh + 1.5;
  const gx = world.groundHeight(x + e, z, top) - world.groundHeight(x - e, z, top);
  const gz = world.groundHeight(x, z + e, top) - world.groundHeight(x, z - e, top);
  if (Number.isFinite(gx) && Number.isFinite(gz)) shadow.quaternion.setFromUnitVectors(UP, tmp.set(-gx, 2 * e, -gz).normalize());
  shadow.position.set(x, gh + 0.06, z);
  shadow.scale.set(1.75 + Math.max(0, h) * 0.07, 1, 1.45 + Math.max(0, h) * 0.07);
  shadow.material.opacity = 0.8 * clamp(1 - h / 16, 0, 1);
}

// ---------------------------------------------------------------- game rules
const PATH_COLORS = ['#f8dccb', '#f4b9c6', '#f9e6b4', '#ef8fa6', '#f6c56e', '#fff4e2'];
const SOFT = ['#fff6e2', '#f7a8c8', '#b8a8f0', '#ffe2a0'];
function hint(key, text, ms = 6500) {
  if (game.hints[key]) return;
  game.hints[key] = true;
  hud.hint(text, ms);
}

// the world wakes where the painter walks: buds open, trees blossom, and each one plays a note
function bloomEvent(ev) {
  tmp.set(ev.x, ev.y, ev.z);
  let fan = null, fd = 14 * 14;
  for (const b of blots) { if (!b.awake) continue; const d = (b.g.position.x - ev.x) ** 2 + (b.g.position.z - ev.z) ** 2; if (d < fd) { fd = d; fan = b; } }
  if (fan) fan.cheer(0.15);
  if (ev.type === 'bud') {
    tmp.y += 1.1;
    fx.burst(tmp, 22, { speed: 4, up: 4.5, colors: [ev.color, ev.color, '#fff6e2'], size: 0.34, life: 0.9, gravity: 9 });
    sound.pluck(true);
    if (game.playT > 10) hint('bud', 'The buds were only waiting for someone to pass.');
  } else {
    fx.burst(tmp, 36, { speed: 3.2 * ev.s, up: 1.2, colors: ['#fff0f6', '#ffc6de', '#fff4c8'], size: 0.3, life: 2.4, gravity: 2.2, spread: 2.2 * ev.s });
    sound.play('blossom'); sound.pluck(true);
  }
}
// companions bob and let go of a fleck of colour on the note they sing
sound.onSing = (k) => {
  const b = blots.find((q) => q.awake && q.slot === k);
  if (!b || game.state === 'title') return;
  b.sing();
  fx.emit(tmp2.copy(b.g.position).setY(b.g.position.y + 0.9), 0, 1.5, 0, b.color, 0.2, 0.9, 0, 1.3);
};

function collectSpark(s) {
  s.taken = true; s.g.visible = false; game.sparks++;
  player.setSparks(game.sparks);
  fx.burst(s.g.position, 46, { speed: 7, up: 6, colors: ['#fff6d0', '#ffd060', '#ff9a3a', '#ff8ab0'], size: 0.42, life: 1.2, boost: 1.6 });
  sound.play('spark');
  hud.toast(game.sparks >= 3 ? 'The last stroke can be laid' : 'Spark of inspiration', `${game.sparks} of 3`);
  post.flash = 0.25;
  sights.muse.stir();
  cheerAll();
  saveSoon();
}

function wakeBlot(b) {
  b.wake(game.friends++);
  tmp.copy(b.g.position); tmp.y += 0.8;
  fx.burst(tmp, 54, { speed: 7, up: 7, colors: [b.color, b.color, '#fff6e2'], size: 0.5, life: 1.1 });
  const gh = world.groundHeight(tmp.x, tmp.z, 1e9);
  if (gh > -Infinity) for (let i = 0; i < 3; i++) splats.add(tmp.x + (Math.random() - 0.5) * 3, gh, tmp.z + (Math.random() - 0.5) * 3, 0.7 + Math.random() * 1.2);
  sound.play('wake');
  hint('friend', 'It was only waiting for some colour. It will follow you now.');
  saveSoon();
}

// which paint is on the brush: Q or right-click for the next one, 1-8 to pick
const palette = () => PAINTS.map((p, i) => i).filter((i) => !PAINTS[i].hidden || game.keep.includes(i) || secrets.places.some((s) => s.found && s.paint === i));
function setPaint(i, quiet = false) {
  const list = palette();
  game.paint = list.includes(i) ? i : list[0];
  const hex = PAINTS[game.paint].hex;
  player.setPaint(hex);
  if (quiet) return;
  hud.palette(list.map((k) => PAINTS[k]), list.indexOf(game.paint));
  sound.chime(game.paint);
  fx.burst(tmp.copy(player.pos).setY(player.pos.y + 2.3), 10, { speed: 2.4, up: 2.6, colors: [hex], size: 0.26, life: 0.6 });
}
setPaint(game.paint, true);

function doSwing() {
  if (!player.swing()) return;
  const hex = PAINTS[game.paint].hex;
  swings.fire(player.pos, player.heading, hex);
  sound.play('swing'); sound.chime(game.chime++);
  // the swing paints: a fan of strokes on the ground ahead, and colour soaked into whatever stands in reach
  painter.strike(player.pos, player.heading, hex, undefined, true, !!game.reach);
  const sx = player.pos.x + Math.sin(player.heading) * 2.6, sz = player.pos.z + Math.cos(player.heading) * 2.6;
  garden.tintNear(sx, sz, game.reach ? 6 : 4.2, hex);
  sights.birds.startle(sx, sz, player.pos.y, 6);
  if (!world.islandAt(sx, sz)) {
    // out on a bridge there is no canvas underfoot, so the swing leaves a daub instead
    const gh = world.groundHeight(sx, sz, player.pos.y + 1.5);
    if (gh > -Infinity && Math.abs(gh - player.pos.y) < 2) splats.add(sx, gh, sz, 0.8 + Math.random() * 0.9);
  }
  fx.burst(tmp.set(sx, player.pos.y + 1, sz), 14, { speed: 4, up: 3.5, size: 0.34, life: 0.7, colors: [hex, hex, '#fff6e2'] });
  for (const b of blots) {
    if (!b.awake) { if (b.g.position.distanceTo(player.pos) < 4.6) wakeBlot(b); continue; }
    const q = b.g.position;
    if ((q.x - sx) ** 2 + (q.z - sz) ** 2 < 2.3 * 2.3 && Math.abs(q.y - player.pos.y - 1) < 3 && b.color !== hex) {       // squarely in the way of the brush, not merely nearby
      b.splash(hex);
      fx.burst(tmp.copy(q).setY(q.y + 0.5), 16, { speed: 3.5, up: 3.5, colors: [hex, hex, '#fff6e2'], size: 0.3, life: 0.7 });
      hint('tint', 'They keep whatever colour you give them.');
      saveSoon();
    }
  }
  garden.wakeNear(player.pos, 5.2);
  for (const { sketch, fresh } of sketches.strike(sx, sz, player.pos, hex)) paintSketch(sketch, fresh, hex);
  for (const spring of pieces.strike(sx, sz, player.pos, hex, PAINTS[game.paint].glow || 1)) {
    // the pool takes the colour at once; the fall follows it down
    fx.burst(spring.top, 30, { speed: 4.5, up: 5, colors: [hex, hex, '#ffffff'], size: 0.36, life: 1.0, gravity: 8 });
    sound.play('pour'); sound.pluck(true);
    if (!game.hints.dyed) { game.hints.dyed = true; hud.toast('The water takes your colour', 'Weeping Palette', 3600); }
    if (spring.index === 0 && springSpark.locked) { springSpark.locked = false; if (!springSpark.taken) fx.burst(spring.top, 26, { speed: 5, up: 7, colors: ['#fff6d0', '#ffd060', '#ff9a3a'], size: 0.4, life: 1.1, boost: 1.5 }); }
    saveSoon();
  }
}

/** A sketch has just taken paint: it becomes real (or changes colour), and the world notices. */
function paintSketch(s, fresh, hex) {
  fx.burst(s.top, fresh ? 46 : 18, { speed: fresh ? 6 : 3.5, up: fresh ? 6 : 3.5, colors: [hex, hex, '#fff6e2', '#ffffff'], size: fresh ? 0.42 : 0.3, life: fresh ? 1.2 : 0.7, gravity: 7 });
  sound.pluck(true);
  saveSoon();
  if (!fresh) return;
  sound.play('blossom'); post.flash = 0.12;
  const n = sketches.painted, all = sketches.total;
  hud.toast(s.name, `Painted into being · ${n} of ${all}`, 3200);
  if (n === all) setTimeout(() => hud.toast('Every sketch is real', 'Nothing left unpainted', 4200), 3600);
  // a few flowers come up around it, and the nearest companion is delighted
  for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.283 + Math.random(), d = 1.6 + Math.random() * 1.6; garden.spawn(s.pos.x + Math.cos(a) * d, s.pos.z + Math.sin(a) * d, s.pos.y, 1, 0.2 + k * 0.07); }
  let fan = null, fd = 12 * 12;
  for (const b of blots) { if (!b.awake) continue; const d = (b.g.position.x - s.pos.x) ** 2 + (b.g.position.z - s.pos.z) ** 2; if (d < fd) { fd = d; fan = b; } }
  if (fan) fan.cheer(0.2);
  hint('repaint', 'Swing at it again with another colour to repaint it.', 6500);
}

// ---------------------------------------------------------------- hidden places
function findSecret(s) {
  secrets.find(s);
  const hex = PAINTS[s.paint].hex;
  fx.burst(s.top, 60, { speed: 6, up: 7, colors: [hex, hex, '#fff6e2', '#ffd060'], size: 0.44, life: 1.4, gravity: 7, boost: 1.5 });
  sound.play('vista'); post.flash = 0.2;
  hud.toast(s.name, 'A hidden place', 4400);
  setPaint(s.paint);
  hud.hint(PAINTS[s.paint].name + ' is on your palette now &nbsp;·&nbsp; a paint found nowhere else', 7000);
  cheerAll();
  saveSoon();
}

// ---------------------------------------------------------------- the Spire: in through the door, up the light, out at the top
/** Stepping through a door is a cut through white: the painter and their companions are simply somewhere else. */
function moveTo(p, heading, yaw) {
  player.teleport(p, heading);
  blots.forEach((b, n) => { if (b.awake) b.g.position.set(p.x + Math.cos(n * 2.1) * 2.2, p.y + 1.2, p.z + Math.sin(n * 2.1) * 2.2); });
  game.yaw = yaw; game.pitch = 0.16; game.lookIdle = 0; game.cut = true; game.facing = null;
  post.flash = 1;
  saveSoon();
}
function enterSpire() {
  moveTo(interior.entry, Math.PI, 0);
  game.hints.atelier = true;
  sound.play('vista');
  hud.toast('The Atelier', 'Inside the Spire', 3800);
  hint('hang', 'Every view you paint at an easel hangs here.', 7500);
}
function leaveSpire() {
  tmp.copy(world.gate); tmp.z += 6; tmp.y = world.groundHeight(tmp.x, tmp.z, tmp.y + 3);
  moveTo(tmp, 0, Math.PI);
  sound.play('wind');
}
function reachNest() {
  moveTo(interior.nest.pos, interior.nest.heading, -Math.PI / 2);
  sound.play('vista');
  hud.toast('The Crow\u2019s Nest', 'Above everything', 3800);
  hint('nest', 'Hold Space in the air to glide back down &nbsp;·&nbsp; or see where the wind goes.', 8500);
}

// ---------------------------------------------------------------- resting at a vista
const IDLE = { mx: 0, mz: 0, jump: false, jumpHeld: false, surf: false };
function sitDown(v) {
  game.rest = game.lastRest = v; game.restT = 0; game.restBloom = 1.5;
  player.sit(v.pos, v.heading);
  vistas.snapshot(v);
  sound.setRest(true); sound.play('sit');
  hud.rest(true); hud.prompt(null); hud.clearHint();
  hud.toast(v.name, 'A place to rest', 4200);
}
function standUp() {
  game.rest = null; game.lookIdle = 0;
  player.stand();
  sound.setRest(false);
  hud.rest(false);
  if (game.vistas > 0) hint('gallery', 'Press G at any time to look at your paintings');
  saveSoon();
}
function updateRest(dt, t) {
  const v = game.rest;
  game.restT += dt;
  player.seat.painting = game.restT > 1.2 && v.progress < 1;
  player.update(dt, t, IDLE, view.yaw, world);
  for (const b of blots) b.update(dt, t, player);
  // the painter paints the view; when the canvas is covered it is theirs to keep
  const before = v.progress;
  if (player.seat.painting && vistas.paint(v, dt)) {
    game.vistas++;
    sound.play('vista'); post.flash = 0.12;
    fx.burst(v.canvasAt, 34, { speed: 4, up: 4, colors: ['#fff6d0', '#ffd060', '#ff8ab0', '#62e6dc'], size: 0.3, life: 1.3, gravity: 5, boost: 1.4 });
    hud.toast('The view is yours', `${game.vistas} of ${vistas.spots.length} painted`, 3600);
    cheerAll();
  }
  if (before < 1 && v.progress >= 1) keepPicture(v);
  // flowers come up around the stool for as long as the painter stays
  game.restBloom -= dt;
  if (game.restBloom <= 0) {
    game.restBloom = 0.5;
    const a = Math.random() * 6.283, d = 1.5 + Math.random() * 4.5;
    if (garden.spawn(v.pos.x + Math.cos(a) * d, v.pos.z + Math.sin(a) * d, v.pos.y)) sound.pluck();
  }
  if (game.restT > 9) hint('rise', 'Stay as long as you like &nbsp;·&nbsp; any key to go on');
  if (game.restT > 0.9 && ['KeyE', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Attack', 'Enter', 'Escape'].some((k) => pressed.has(k))) standUp();
  hud.prompt(null);
  updateCamera(dt);
}

function updatePlay(dt, t) {
  game.playT += dt;
  if (game.rest) { updateRest(dt, t); return; }
  const input = {
    mx: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
    mz: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    jump: pressed.has('Space'), jumpHeld: keys.has('Space'),
    surf: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
  if (keys.has('ArrowLeft') || keys.has('ArrowRight') || keys.has('ArrowUp') || keys.has('ArrowDown')) game.lookIdle = 0;
  if (keys.has('ArrowLeft')) game.yaw += dt * 1.9;
  if (keys.has('ArrowRight')) game.yaw -= dt * 1.9;
  if (keys.has('ArrowUp')) game.pitch = clamp(game.pitch + dt * 1.1, -0.45, 1.15);
  if (keys.has('ArrowDown')) game.pitch = clamp(game.pitch - dt * 1.1, -0.45, 1.15);
  if (pressed.has('Attack') || keys.has('Attack') || keys.has('KeyJ') || keys.has('KeyF')) doSwing();
  const paints = palette();
  if (pressed.has('KeyQ') || pressed.has('NextPaint')) setPaint(paints[(paints.indexOf(game.paint) + 1) % paints.length]);
  paints.forEach((p, k) => { if (k < 10 && pressed.has('Digit' + ((k + 1) % 10))) setPaint(p); });

  const events = player.update(dt, t, input, view.yaw, world);
  const inside = interior.inside(player.pos);
  if (inside) {
    interior.contain(player.pos);
    // the column of light in the middle of the hall: step into it and it lifts the painter out through the vault
    if (player.lift) { if (player.lift.t > 0.82) { reachNest(); return; } }
    else if (player.grounded && Math.hypot(player.pos.x - interior.center.x, player.pos.z - interior.center.z) < 1.6) {
      player.lift = { from: player.pos.clone(), to: interior.liftTop.clone(), t: 0 };
      player.vel.set(0, 0, 0);
      sound.play('wind');
    }
    if (player.lift) fx.burst(tmp.copy(player.pos).setY(player.pos.y + 0.6), 3, { speed: 2, up: 3, colors: ['#fff6d0', '#ffe2a0', '#ffffff'], size: 0.3, life: 0.8, gravity: -1, boost: 1.4 });
  }
  for (const e of events) {
    if (e === 'jump') sound.play('jump');
    if (e === 'jump' || e === 'doublejump') for (const b of blots) b.hop(0.12 + b.slot * 0.08);
    if (e === 'doublejump') { sound.play('jump'); fx.burst(player.pos, 16, { speed: 4, up: 1, size: 0.3, life: 0.5, colors: SOFT }); }
    if (e === 'land') { sound.play('land'); fx.burst(player.pos, 8, { speed: 3, up: 2, colors: PATH_COLORS, size: 0.25, life: 0.4 }); }
    if (e === 'step') { sound.play('step'); fx.burst(player.pos, 2, { speed: 1.1, up: 1.3, colors: PATH_COLORS, size: 0.17, life: 0.32, spread: 0.1 }); }
    if (e === 'glide') sound.play('glide');
    if (e === 'wind') { sound.play('wind'); hint('wind', 'The wind carries you. Press Space to let go.'); }
    if (e === 'settle') fx.burst(player.pos, 20, { speed: 3, up: 3, colors: SOFT, size: 0.3, life: 0.8 });
  }
  // flowers come up in the painter's wake, each new patch plucking a note in time with the music,
  // which itself gains a layer with the first bridge and with every spark
  if (garden.trail(player, dt)) sound.pluck();
  sound.setLevel(game.won ? 5 : (world.bridges[0].progress >= 1 ? 1 : 0) + game.sparks, game.friends);

  // trails of colour while flowing
  if (player.surfing) fx.burst(player.pos, 2, { speed: 2.2, up: 2.4, colors: PATH_COLORS, size: 0.36, life: 0.7, gravity: 8 });
  if (player.ride || player.lift) fx.burst(tmp.copy(player.pos).setY(player.pos.y + 0.9), 2, { speed: 1.6, up: 0.6, colors: SOFT, size: 0.3, life: 0.9, gravity: 1 });

  // falling is not failing: below everything nearby, the paint simply carries you back
  if (!player.lift && !player.ride && !player.grounded) {
    let floor = Infinity;
    for (const isl of world.islands) if (Math.hypot(isl.x - player.pos.x, isl.z - player.pos.z) < isl.r + 90) floor = Math.min(floor, isl.y);
    floor = Math.min(floor, secrets.floor(player.pos));
    if (floor === Infinity) floor = player.safe.y - 14;
    if (player.pos.y < floor - 9) { player.floatBack(); sound.play('wind'); }
  }

  if (!game.reach && sights.brush.reach(player.pos)) takeReach();
  // a pot of paint, somewhere off the path
  const found = secrets.near(player.pos);
  if (found) findSecret(found);

  // pickups
  for (const s of sparks) if (!s.taken && !s.locked && s.k > 0.75 && s.g.position.distanceTo(player.pos) < 2.6) collectSpark(s);       // (a freed spark takes a moment to rise)
  if (heapSpark.locked && !heapSpark.taken && heapSpark.g.position.distanceTo(player.pos) < 9) hint('heap', 'Something is glowing under the leaves.', 7000);
  if (springSpark.locked && !springSpark.taken && springSpark.g.position.distanceTo(player.pos) < 9) hint('spring', 'A spark is caught in the spring. Give the water a colour.', 7500);
  for (const d of drops.items) {
    if (d.taken) continue;
    const p = d.m.position;
    if (Math.abs(p.x - player.pos.x) < 1.4 && Math.abs(p.z - player.pos.z) < 1.4 && Math.abs(p.y - player.pos.y - 1) < 2) {
      d.taken = true; d.m.visible = false;
      fx.burst(p, 12, { speed: 3.5, up: 4, colors: [d.color, '#fff6e2'], size: 0.3, life: 0.6 });
      sound.chime(game.chime++);
    }
  }

  // sleepers and companions
  for (const b of blots) {
    if (b.update(dt, t, player) === 'wake') wakeBlot(b);
    else if (!b.awake && !game.hints.sleeper && b.g.position.distanceTo(player.pos) < 11) hint('sleeper', 'Something colourless is asleep here.');
  }

  // --- painting bridges
  let prompt = null, progress = 0;
  const hold = keys.has('KeyE');
  for (const br of world.bridges) {
    if (br.progress >= 1) continue;
    const head = br.head();
    const near = player.pos.distanceTo(br.anchor) < 6 || (br.progress > 0 && player.pos.distanceTo(head) < 5.5);
    if (!near || !player.grounded) continue;
    if (game.sparks < br.need) {
      const n = br.need - game.sparks;
      prompt = `The sketch will not hold paint yet &mdash; ${n} more spark${n > 1 ? 's' : ''} of inspiration`;
    } else {
      prompt = '<kbd>E</kbd>Hold to paint the bridge'; progress = br.progress;
      if (hold) {
        const before = br.progress;
        br.set(br.progress + dt / 2.8);
        fx.burst(br.head(), 5, { speed: 4, up: 4, colors: PATH_COLORS, size: 0.45, life: 0.7 });
        game.paintSfx -= dt;
        if (game.paintSfx <= 0) { sound.play('paint'); game.paintSfx = 0.12; }
        if (before < 1 && br.progress >= 1) {
          sound.play('bridge'); post.flash = 0.3;
          hud.toast('The stroke holds', br.need ? 'The way to the Spire' : 'A bridge of wet paint');
          for (let i = 0; i < br.N; i += 6) fx.burst(br.pts[i], 6, { speed: 3, up: 5, size: 0.4, life: 1 });
          saveSoon();
        }
      }
    }
    break;
  }

  // --- the gate
  if (!game.won && player.pos.distanceTo(world.gate) < 6.5) {
    prompt = '<kbd>E</kbd>Hold to unveil the final stroke';
    if (hold) {
      game.gateHold += dt / 1.8;
      fx.burst(tmp.copy(world.gate).setY(world.gate.y + 3), 3, { speed: 5, up: 6, colors: ['#fff6d0', '#ffd060'], size: 0.4 });
      if (game.gateHold >= 1) startFinale();
    } else game.gateHold = Math.max(0, game.gateHold - dt);
    progress = game.gateHold;
  } else if (game.won && !inside && player.grounded && player.pos.distanceTo(world.gate) < 5.6) {
    // once the last stroke is laid, the door stands open
    prompt = '<kbd>E</kbd>Step inside';
    if (pressed.has('KeyE')) { enterSpire(); return; }
  }
  if (inside) {
    if (player.grounded && player.pos.distanceTo(interior.exit) < 3) {
      prompt = '<kbd>E</kbd>Step back outside';
      if (pressed.has('KeyE')) { leaveSpire(); return; }
    }
    // standing in front of a frame: say which view it is
    const frame = interior.facing(player.pos);
    if (frame !== game.facing) {
      game.facing = frame;
      if (frame) hud.toast(frame.done ? frame.name : 'A frame still waiting', frame.done ? 'Your painting' : '', 2600);
    }
  }
  // --- an easel and a stool: somewhere to sit
  if (!prompt && player.grounded) {
    const v = vistas.near(player.pos);
    if (v) {
      prompt = '<kbd>E</kbd>Rest a while';
      if (pressed.has('KeyE')) { sitDown(v); return; }
    }
  }
  if (!game.hints.sketch && sketches.waiting(player.pos)) hint('sketch', 'Someone sketched this and never painted it. Swing your brush at it.', 7500);
  if (!game.hints.vista) for (const v of vistas.spots) if (v.pos.distanceTo(player.pos) < 13) hint('vista', 'An easel and a stool, looking out. A good place to rest.');
  hud.prompt(prompt, progress);

  // --- where next? no markers: a few golden flecks drift from the painter toward it
  let goal = null, objective;
  if (game.won) { objective = 'The painting is complete'; if (!game.hints.atelier) goal = world.gate; }       // the open door is the one thing left to point at
  else if (world.bridges[0].progress < 1) { goal = world.bridges[0].anchor; objective = 'Paint the sketched bridge (hold E)'; }
  else if (game.sparks < 3) {
    let best = 1e9;
    for (const s of sparks) if (!s.taken) { const d = s.g.position.distanceTo(player.pos); if (d < best) { best = d; goal = s.locked && s.lure ? s.lure : s.g.position; } }
    objective = `Gather sparks of inspiration (${game.sparks}/3)`;
  } else if (world.bridges[3].progress < 1) { goal = world.bridges[3].anchor; objective = 'Lay the last bridge to the Spire'; }
  else { goal = world.gate; objective = 'Step up to the glowing gate'; }
  hud.objective(objective);
  game.guideT -= dt;
  if (goal && game.guideT <= 0 && !player.ride && !player.lift) {
    game.guideT = 0.22;
    tmp2.subVectors(goal, player.pos);
    const d = tmp2.length();
    if (d > 7) {
      tmp2.multiplyScalar(1 / d);
      tmp.set(player.pos.x + (Math.random() - 0.5) * 2.4 + tmp2.x * 1.5, player.pos.y + 0.8 + Math.random() * 1.4, player.pos.z + (Math.random() - 0.5) * 2.4 + tmp2.z * 1.5);
      fx.emit(tmp, tmp2.x * 7, tmp2.y * 7 + 0.6, tmp2.z * 7, Math.random() < 0.5 ? '#ffd27a' : '#ffe6a8', 0.17, 1.7, 0, 1.6);
    }
  }

  // gentle teaching, one line at a time
  if (game.playT > 4) hint('move', 'Walk with W A S D &nbsp;·&nbsp; look around with the mouse');
  if (game.playT > 13) hint('paint', 'Click to paint the world around you &nbsp;·&nbsp; Q changes colour');
  if (game.playT > 24) hint('skate', 'Hold Shift to skate across the paint');
  if (game.playT > 35) hint('glide', 'Space to jump &nbsp;·&nbsp; hold it in the air to glide');
  if (game.playT > 50) hint('map', 'Press H if you ever want the map &nbsp;·&nbsp; Esc for settings');

  // island name cards
  if (player.grounded && player.lastIsland !== game.shownIsland && player.lastIsland !== undefined) {
    if (game.shownIsland !== undefined) hud.toast(world.islands[player.lastIsland].name);
    game.shownIsland = player.lastIsland;
  }
  updateCamera(dt);
}

// ---------------------------------------------------------------- finale
const finaleFrom = new V3(), finaleLook = new V3();
function startFinale() {
  game.state = 'finale'; game.finaleT = 0; game.won = true; game.gateHold = 0;
  hud.prompt(null); hud.questDone(); hud.show(false);
  document.exitPointerLock?.();
  sound.play('finale'); sound.setLevel(5, game.friends);
  garden.wakeAll(world.castlePos);
  post.flash = 0.9;
  world.finale.visible = true; world.finale.geometry.setDrawRange(0, 0);
  finaleFrom.copy(camera.position); finaleLook.copy(camTarget);
  saveSoon();
}
function updateFinale(dt, t) {
  game.finaleT += dt;
  const T = game.finaleT, c = world.castlePos;
  const u = clamp(T / 3.2, 0, 1), e = u * u * (3 - 2 * u);
  const a = 0.35 + T * 0.07;
  tmp.set(c.x + Math.sin(a) * 78, c.y + 20 + T * 1.2, c.z + Math.cos(a) * 96);
  camera.position.lerpVectors(finaleFrom, tmp, e);
  tmp2.set(c.x, c.y + 34, c.z);
  camTarget.lerpVectors(finaleLook, tmp2, e);
  camera.lookAt(camTarget);
  const f = world.finale, p = clamp((T - 0.6) / 6.5, 0, 1), seg = Math.floor(p * f.userData.segs);
  f.geometry.setDrawRange(0, seg * f.userData.vps);
  if (p > 0 && p < 1) fx.burst(f.userData.pts[seg], 8, { speed: 9, up: 6, colors: ['#fff6d0', '#ffd060', '#ffffff', '#ff8ab0'], size: 0.9, life: 1.2, gravity: 6 });
  world.sky.material.uniforms.glow.value = clamp(T / 6, 0, 1);
  game.dayGoal = Math.max(game.dayGoal, 1 + 0.25 * clamp(T / 6, 0, 1));          // night falls as the last stroke is laid
  post.sat = 1.22 + clamp(T / 6, 0, 1) * 0.2;
  if (T > 3.6) sights.muse.wake();
  player.animate(dt, t);
  for (const b of blots) b.update(dt, t, player);
  if (T > 9.5 && !game.endShown) {
    game.endShown = true;
    openGallery(true);
  }
}

// ---------------------------------------------------------------- an earlier visit, if there was one
{
  const saved = store.read();
  if (saved) {
    try { restore(saved); } catch (e) { console.warn('The saved journey could not be restored', e); }
  }
  if (game.resumed) {
    $id('begin').textContent = 'Continue';
    $id('titleText').textContent = game.won
      ? 'The last stroke is laid, and the paint is still wet where you left it. Wander on, or wash the canvas clean and begin again.'
      : 'The paint is still wet where you left it. Carry on from here, or wash the canvas clean and begin again.';
    $id('titleOver').hidden = false;
  }
  if (game.journey > 1) {
    $id('titleKicker').textContent = `A ${nth(game.journey)} wander`;
    if (!game.resumed) {
      $id('begin').textContent = 'Begin again';
      $id('titleText').textContent = 'The canvas is clean again; your palette is not. The paints you found, your companions\u2019 colours and whatever the great brush lent you have come along.';
      $id('titleOver').hidden = false;
    }
  }
}

// ---------------------------------------------------------------- loop
hud.show(false);
let last = performance.now(), time = 0, mapT = 0, shown = false;
function tick(dt) {
  if (game.state === 'photo') { updatePhoto(dt); pressed.clear(); return; }       // the world holds still
  time += dt;
  uTime.value = time;

  if (pressed.has('KeyP')) { settings.set('filter', (settings.values.filter + 1) % 3); hud.toast(['Paint filter off', 'Painterly', 'Heavy impasto'][post.mode], '', 1200); }
  if (pressed.has('KeyM')) {
    if (settings.values.volume > 0) { lastVolume = settings.values.volume; settings.set('volume', 0); } else settings.set('volume', lastVolume);
    hud.toast(settings.values.volume > 0 ? 'Sound on' : 'Sound off', '', 1000);
  }
  if (pressed.has('Escape') && game.state === 'play' && !game.rest) openMenu();
  if (pressed.has('KeyH') && game.state === 'play') hud.toggleFull();
  if (game.state === 'title' && (pressed.has('Enter') || pressed.has('Space'))) begin();
  if (pressed.has('KeyC') && game.state === 'play') openPhoto();
  if (pressed.has('KeyG') && game.state === 'play' && !game.rest) openGallery(false);
  else if (game.state === 'gallery' && (pressed.has('KeyG') || pressed.has('Escape') || pressed.has('Enter'))) $id('wander').click();

  if (game.state === 'play') updatePlay(dt, time);
  else if (game.state === 'finale') updateFinale(dt, time);
  else if (game.state === 'gallery' || game.state === 'menu') player.animate(dt, time);
  else {
    // title: idle, with a slow drifting camera
    player.animate(dt, time);
    game.yaw = game.titleYaw + Math.sin(time * 0.12) * 0.1; game.pitch = 0.17 + Math.sin(time * 0.09) * 0.03;
    updateCamera(dt, true);
  }
  pressed.clear();
  // the journey is written down every few seconds, and sooner when something has just happened
  if (game.started) { saveT -= dt; if (saveT <= 0) { saveT = 6; saveGame(); } }
  // the day is as late as the farthest point the painter has reached, and it never runs backwards
  if (game.state === 'play') game.dayGoal = Math.max(game.dayGoal, clamp((world.spawn.z - player.pos.z) / (world.spawn.z - world.gate.z), 0, 1));
  game.day += (game.dayGoal - game.day) * (1 - Math.exp(-(game.state === 'finale' ? 0.5 : 0.2) * dt));
  day.set(game.day);
  sound.flow(game.state === 'play' ? game.flow : 0);

  world.update(time, dt);
  world.petals.material.uniforms.camPos.value.copy(camera.position);
  for (const s of sparks) if (!s.taken) s.update(time, dt);
  drops.update(time);
  swings.update(dt);
  for (const ev of garden.update(dt, time, game.state === 'play' ? player : null)) bloomEvent(ev);
  painter.update(dt);
  vistas.update(time);
  secrets.update(time);
  interior.update(time);
  for (const ev of sights.update(dt, time, game.state === 'title' ? null : player)) {
    if (ev.type === 'flock') { sound.play('wings'); hint('birds', 'Paper birds. They never go far.', 5000); }
  }
  for (const ev of pieces.update(dt, time, game.state === 'play' ? player : null)) {
    if (ev.type === 'rustle') sound.play('rustle');
    else if (ev.type === 'heap') {
      // the leaves are off it: the spark rises
      heapSpark.locked = false;
      if (!heapSpark.taken) { fx.burst(tmp.copy(heapSpark.g.position), 30, { speed: 5, up: 7, colors: ['#fff6d0', '#ffd060', '#ff9a3a'], size: 0.4, life: 1.1, boost: 1.5 }); sound.pluck(true); }
    } else if (ev.type === 'easelStart') {
      hud.toast('The Last Easel', 'Everything you have painted so far', 4600);
      sound.play('sit');
    } else if (ev.type === 'easelDone') {
      // the picture is finished, and it leaves the painter something
      game.hints.bigEasel = true;
      holdSparks();
      post.flash = 0.14; sound.play('vista');
      fx.burst(pieces.easel.center, 50, { speed: 8, up: 5, colors: ['#fff6d0', '#ffd060', '#ff8ab0', '#62e6dc'], size: 0.5, life: 1.5, gravity: 4, boost: 1.4 });
      if (!easelSpark.taken) { fx.burst(tmp.copy(easelSpark.g.position).setY(easelSpark.base), 40, { speed: 6, up: 6, colors: ['#fff6d0', '#ffd060', '#ff9a3a'], size: 0.42, life: 1.2, boost: 1.5 }); hint('easelSpark', 'The canvas has caught up with you, and left you something.', 7000); }
      cheerAll();
      saveSoon();
    }
  }
  for (const ev of sketches.update(dt, time, game.state === 'play' ? player : null)) {
    if (ev.type === 'bell') { sound.chime(game.chime++); fx.burst(ev.sketch.top, 6, { speed: 1.6, up: 1.6, colors: [ev.sketch.hex, '#fff6e2'], size: 0.22, life: 0.8, gravity: 1 }); }
  }
  for (const b of blots) if (b.puff) { b.puff = false; fx.emit(tmp.copy(b.g.position).setY(b.g.position.y + 0.75), 0.25, 0.7, 0.1, '#fff6ee', 0.16, 1.9, 0, 1); }
  world.petals.visible = !interior.inside(camera.position);
  splats.update(dt);
  fx.update(dt);
  updateShadow();
  post.flash = Math.max(0, post.flash - dt * 1.6);

  mapT -= dt;
  if (mapT <= 0 && hud.isFull()) { hud.minimap(player, sparks); mapT = 0.05; }
}
function draw() {
  if (window.__game && window.__game.free) { camera.position.fromArray(window.__game.free.p); camera.lookAt(...window.__game.free.t); }
  post.render(scene, camera);
  if (game.shot) { const deliver = game.shot; game.shot = null; canvas.toBlob(deliver, 'image/png'); }         // (taken at once, while the frame is still there to take)
  if (!shown) { shown = true; document.getElementById('fade').classList.add('clear'); }
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!window.__game.paused) tick(dt);          // (debug: __game.paused holds the world still; __game.step() still advances it)
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// small debug handle for the console
window.__game = { game, player, world, post, camera, secrets, interior, sketches, pieces, sights, photo, mouse, openPhoto, closePhoto, fillBook, secondJourney, findSecret, enterSpire, leaveSpire, reachNest, blots, sparks, keys, pressed, garden, sound, painter, vistas, day, settings, store, saveGame, snapshot, openMenu, closeMenu, begin, doSwing, openGallery, sitDown, standUp, step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) tick(dt); draw(); }, tp(i) { const isl = world.islands[i]; const p = new V3(isl.x, 0, isl.z + isl.r * 0.5); p.y = world.groundHeight(p.x, p.z, 1e9); player.teleport(p); } };
