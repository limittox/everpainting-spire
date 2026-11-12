// The journey is kept in this browser's own storage, so closing the tab loses nothing. The game's state is one
// small JSON record; each finished painting is kept beside it under its own key, since a picture is large and
// only changes when it is repainted.

const KEY = 'everpainting.save.v1', VIEW = 'everpainting.view.v1.';
export const SAVE_VERSION = 1;

export const store = {
  ok: true,          // false once the browser has refused to keep something
  dead: false,       // set by clear(): nothing more is written before the page reloads

  read() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      return d && d.v === SAVE_VERSION ? d : null;
    } catch (e) { return null; }
  },

  write(data) {
    if (this.dead) return false;
    try { localStorage.setItem(KEY, JSON.stringify(data)); this.ok = true; return true; } catch (e) { /* full, or not allowed */ }
    // out of room: the oldest brush strokes are the first thing to let go of
    try {
      const strikes = data.strikes || [];
      localStorage.setItem(KEY, JSON.stringify({ ...data, strikes: strikes.slice(Math.floor(strikes.length / 2)) }));
      this.ok = true; return true;
    } catch (e) { this.ok = false; return false; }
  },

  picture(i) { try { return localStorage.getItem(VIEW + i); } catch (e) { return null; } },
  setPicture(i, url) {
    if (this.dead) return false;
    try { localStorage.setItem(VIEW + i, url); return true; } catch (e) { this.ok = false; return false; }
  },

  /** Forget the journey and leave `data` in its place: the start of the next one. */
  restart(data) {
    this.clear();
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* then it is simply a fresh start */ }
  },

  /** Forget the journey (settings are kept). */
  clear() {
    this.dead = true;
    try {
      localStorage.removeItem(KEY);
      for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(VIEW)) localStorage.removeItem(k); }
    } catch (e) { /* nothing was being kept anyway */ }
  },
};
