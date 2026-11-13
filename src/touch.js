// Touch: a thumb on the left of the screen walks, a thumb on the right looks, and the buttons do the rest.
// Everything here only feeds the same keys the keyboard feeds, so the game itself cannot tell the difference.

const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

/** `keys` and `pressed` are the game's own sets of held and just-pressed keys; `look(dx, dy)` turns the camera. */
export function setupTouch(canvas, keys, pressed, look) {
  const ui = document.getElementById('touch'), stick = document.getElementById('stick'), knob = stick.firstElementChild;
  const state = { on: false, move: null, look: null };
  const use = () => { if (!state.on) { state.on = true; document.body.classList.add('touch'); } };
  if (matchMedia('(pointer: coarse)').matches) use();          // a phone or a tablet: the controls are there from the start

  /** The stick, pushed (dx, dy) from where the thumb came down: eight ways, like the keys. */
  const steer = (dx, dy) => {
    const len = Math.hypot(dx, dy), t = len * 0.38;
    const want = len < 14 ? [] : [dy < -t && 'KeyW', dy > t && 'KeyS', dx < -t && 'KeyA', dx > t && 'KeyD'];
    for (const k of MOVE) if (want.includes(k)) keys.add(k); else keys.delete(k);
    const m = Math.min(1, 44 / (len || 1));
    knob.style.transform = `translate(${dx * m}px, ${dy * m}px)`;
  };
  const drop = () => { state.move = null; stick.classList.remove('on'); for (const k of MOVE) keys.delete(k); };

  canvas.addEventListener('touchstart', (e) => {
    use();
    e.preventDefault();          // (no pretend mouse afterwards: a thumb on the picture is not a click on it)
    for (const t of e.changedTouches) {
      if (!state.move && t.clientX < innerWidth * 0.45) {
        state.move = { id: t.identifier, x: t.clientX, y: t.clientY };
        stick.style.left = t.clientX + 'px'; stick.style.top = t.clientY + 'px'; stick.classList.add('on');
        steer(0, 0);
      } else if (!state.look) state.look = { id: t.identifier, x: t.clientX, y: t.clientY };
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (state.move && t.identifier === state.move.id) steer(t.clientX - state.move.x, t.clientY - state.move.y);
      else if (state.look && t.identifier === state.look.id) { look(t.clientX - state.look.x, t.clientY - state.look.y); state.look.x = t.clientX; state.look.y = t.clientY; }
    }
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (state.move && t.identifier === state.move.id) drop();
      else if (state.look && t.identifier === state.look.id) state.look = null;
    }
  };
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('touchcancel', end);

  // the buttons: each is a key, held for as long as the thumb is on it
  for (const b of ui.querySelectorAll('button')) {
    const key = b.dataset.key;
    b.addEventListener('touchstart', (e) => { e.preventDefault(); use(); keys.add(key); pressed.add(key); b.classList.add('down'); }, { passive: false });
    const up = (e) => { e.preventDefault(); keys.delete(key); b.classList.remove('down'); };
    b.addEventListener('touchend', up);
    b.addEventListener('touchcancel', up);
  }

  return {
    /** Has a finger been used (or is this a touch device)? */
    get on() { return state.on; },
    /** Show the controls while the game is being played, and let go of everything when it is not. */
    show(v) {
      v = v && state.on;
      if (ui.hidden === !v) return;
      ui.hidden = !v;
      if (!v) { drop(); state.look = null; for (const b of ui.querySelectorAll('button')) { keys.delete(b.dataset.key); b.classList.remove('down'); } }
    },
  };
}
