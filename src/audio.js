// Procedural soundscape. The music is a small sequencer that starts as a bare pad and gains a layer each
// time the journey moves forward: a bass under the first bridge, a plucked pattern with the first spark,
// a melody with the second, the full shimmer with the third. Companions each sing a note of their own,
// and flowers opening underfoot pluck notes that land on the beat.

const CHORDS = [[146.83, 220, 369.99, 329.63], [123.47, 185, 293.66, 440], [98, 146.83, 246.94, 369.99], [110, 164.81, 277.18, 369.99]];
const PENT = [587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.5];       // D major pentatonic, D5 upward
const STEP = 0.5;                                                          // an eighth note at 60 bpm; 16 steps to a chord
const ARP = [0, 1, 2, 1, 3, 1, 2, 1];
// the melody, one phrase per chord: [step, note of PENT, length in steps]
const SONG = [
  [[0, 2, 3], [4, 3, 2], [6, 4, 2], [8, 3, 6]],
  [[0, 5, 4], [4, 4, 3], [8, 2, 7]],
  [[0, 4, 3], [4, 3, 2], [6, 5, 2], [8, 4, 6]],
  [[0, 6, 4], [4, 3, 3], [8, 1, 4], [12, 3, 4]],
];

export class Sound {
  constructor() {
    this.ctx = null;
    this.volume = 0.8; this.musicVol = 0.8;     // both 0..1, from the settings
    this.level = 0; this.friends = 0;     // how far the music has grown; how many companions sing
    this.onSing = null;                   // called (with the companion's slot) as its note sounds
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0, ctx.currentTime); this.master.gain.linearRampToValueAtTime(0.7 * this.volume, ctx.currentTime + 3.5);   // the world fades in
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(ctx.destination);
    // a soft hall: a generated impulse (dark, decaying noise) in a convolver, with one quiet echo feeding it
    this.send = ctx.createGain(); this.send.gain.value = 0.42;
    const sr = ctx.sampleRate, len = Math.floor(sr * 3.2), imp = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = imp.getChannelData(ch); let y = 0;
      for (let i = 0; i < len; i++) {
        const u = i / len, a = 0.2 + 0.6 * (1 - u);            // the tail darkens as it fades
        y += ((Math.random() * 2 - 1) - y) * a;
        d[i] = y * Math.pow(1 - u, 2.6) * Math.min(1, i / (sr * 0.012));
      }
    }
    const hall = ctx.createConvolver(); hall.buffer = imp;
    const wet = ctx.createGain(); wet.gain.value = 0.9;
    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.3;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    this.send.connect(hall); hall.connect(wet); wet.connect(this.master);
    this.send.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(hall);
    const buf = ctx.createBuffer(1, sr * 2, sr), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // a bed of moving air that rises with speed (see flow())
    const air = ctx.createBufferSource(); air.buffer = buf; air.loop = true;
    this.airBp = ctx.createBiquadFilter(); this.airBp.type = 'bandpass'; this.airBp.Q.value = 0.55; this.airBp.frequency.value = 380;
    this.airGain = ctx.createGain(); this.airGain.gain.value = 0;
    air.connect(this.airBp); this.airBp.connect(this.airGain); this.airGain.connect(this.master); this.airGain.connect(this.send);
    air.start();

    // one bus per layer of the music, so a new layer can swell in rather than switch on
    this.bus = {};
    this.music = ctx.createGain(); this.music.gain.value = 1.25 * this.musicVol;
    this.music.connect(this.master); this.music.connect(this.send);
    for (const name of ['pad', 'bass', 'arp', 'song', 'voice', 'pluck']) {
      const g = ctx.createGain(); g.gain.value = name === 'pad' || name === 'voice' || name === 'pluck' ? 1 : 0;
      g.connect(this.music);
      this.bus[name] = g;
    }
    this.stepI = 0; this.nextT = ctx.currentTime + 0.15;
    this.lastPluck = 0; this.pk = 2;
    this.applyLevel(0.05);
    this.timer = setInterval(() => this.schedule(), 100);
  }

  /** Overall loudness, 0..1. */
  setVolume(v) {
    this.volume = v;
    if (this.master) { this.master.gain.cancelScheduledValues(this.ctx.currentTime); this.master.gain.setTargetAtTime(0.7 * v, this.ctx.currentTime, 0.08); }
  }
  /** How loud the music sits under everything else, 0..1. */
  setMusic(v) {
    this.musicVol = v;
    if (this.music) this.music.gain.setTargetAtTime(1.25 * v * (this.hushK ?? 1), this.ctx.currentTime, 0.08);
  }
  /** Let the music sink away (k toward 0) or come back (1), slowly: for places where it does not belong. */
  hush(k) {
    if (k === (this.hushK ?? 1)) return;
    this.hushK = k;
    if (this.music) this.music.gain.setTargetAtTime(1.25 * this.musicVol * k, this.ctx.currentTime, 0.9);
  }

  /** How fast the painter is moving through the air, 0..1: drives the bed of wind. */
  flow(v) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.airGain.gain.setTargetAtTime(v * v * 0.085, now, 0.3);
    this.airBp.frequency.setTargetAtTime(340 + v * 760, now, 0.35);
  }

  /** Silence everything while the tab is hidden, and pick up again afterwards. */
  pause(hidden) {
    if (!this.ctx) return;
    if (hidden) this.ctx.suspend(); else this.ctx.resume();
  }

  /**
   * How far the music has grown: 0 pad and bells, 1 + bass, 2 + plucked pattern, 3 + melody,
   * 4 + the pattern doubled and the melody on every pass, 5 the finale. `friends` voices sing along.
   */
  setLevel(level, friends = this.friends) {
    this.friends = friends;
    if (level === this.level) return;
    this.level = level;
    if (this.ctx) this.applyLevel(2.4);
  }
  /** Resting at a vista: the melody comes forward whatever the level, over a high, held chord. */
  setRest(on) {
    if (!!this.resting === on) return;
    this.resting = on;
    if (this.ctx) this.applyLevel(1.5);
  }
  applyLevel(tc) {
    const now = this.ctx.currentTime, L = this.level;
    const set = (name, v) => this.bus[name].gain.setTargetAtTime(v, now, tc);
    set('bass', L >= 1 ? 1 : 0); set('arp', L >= 2 ? (this.resting ? 0.45 : 1) : 0); set('song', L >= 3 || this.resting ? 1 : 0);
    set('pad', L >= 5 ? 1.25 : 1);
  }

  // ------------------------------------------------------------------ the sequencer
  schedule() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    if (this.nextT < ctx.currentTime - 0.2) this.nextT = ctx.currentTime + 0.05;     // fell behind (tab asleep): pick up from now
    while (this.nextT < ctx.currentTime + 1.3) { this.step(this.stepI++, this.nextT); this.nextT += STEP; }
  }

  step(i, t) {
    const s = i % 16, bar = Math.floor(i / 16), ci = bar % 4, c = CHORDS[ci], L = this.level;
    if (s === 0) {
      // the pad: every chord swells in over three seconds and out over the next chord
      for (const f of c) {
        this.tone('pad', 'sine', f, t, 0.075, 3, 8); this.tone('pad', 'triangle', f, t, 0.03, 3, 8, 5); this.tone('pad', 'sine', f, t, 0.04, 3, 8, -4);
        if (L >= 4) this.tone('pad', 'sine', f * 2, t, 0.016, 4, 7, 3);
      }
      for (let k = 0; k < 4; k++) if (Math.random() < 0.75) this.bell(PENT[Math.floor(Math.random() * PENT.length)], t + 0.5 + k * 2 + Math.random() * 1.2, 0.045);
      if (L >= 1) { this.tone('bass', 'sine', c[0] / 2, t, 0.13, 1.4, 6.4); this.tone('bass', 'triangle', c[0], t, 0.022, 1.8, 6); }
      if (this.resting) { this.tone('song', 'sine', c[2] * 2, t, 0.028, 3, 7); this.tone('song', 'sine', c[3] * 2, t, 0.02, 3.5, 6.5, 4); }
    }
    if (L >= 2) {
      const notes = [c[2], c[1] * 2, c[3], c[2] * 2].sort((a, b) => a - b);
      if (s % 2 === 0) this.pluckTone('arp', notes[ARP[s / 2]], t, 0.05, 1.1);
      else if (L >= 4) this.pluckTone('arp', notes[ARP[(s - 1) / 2]] * 2, t, 0.022, 0.7);
    }
    if (this.resting || (L >= 3 && (L >= 4 || Math.floor(bar / 4) % 2 === 0))) {
      for (const [at, n, len] of SONG[ci]) if (at === s) this.flute(PENT[n] * (L >= 4 && Math.floor(bar / 4) % 2 ? 0.5 : 1), t, len * STEP, 0.05);
    }
    // each companion has its own moment in the bar and its own note
    for (let k = 0; k < this.friends; k++) {
      if ((3 + k * 5) % 16 !== s || (bar + k) % 2) continue;
      this.voice(PENT[(k * 2 + ci) % 5] * 0.5, t, 0.045);
      if (this.onSing) setTimeout(this.onSing, Math.max(0, (t - this.ctx.currentTime) * 1000), k);
    }
  }

  /** A sustained note with a slow attack and release, into one of the layer buses. */
  tone(bus, type, f, when, vol, attack, hold, detune = 0) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + attack); g.gain.linearRampToValueAtTime(0, when + hold + 3);
    o.connect(g); g.connect(this.bus[bus]);
    o.start(when); o.stop(when + hold + 3.2);
  }
  /** A plucked, kalimba-like note: a soft body with a brief bright overtone. */
  pluckTone(bus, f, when, vol, dur) {
    const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 3;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    g2.gain.setValueAtTime(vol * 0.35, when); g2.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
    o.connect(g); o2.connect(g2); g2.connect(this.bus[bus]); g.connect(this.bus[bus]);
    o.start(when); o2.start(when); o.stop(when + dur + 0.05); o2.stop(when + 0.2);
  }
  /** The melody's voice: a breathy sine with a little vibrato that arrives late. */
  flute(f, when, dur, vol) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, when); lg.gain.linearRampToValueAtTime(f * 0.006, when + Math.min(dur, 0.9));
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + 0.14); g.gain.setValueAtTime(vol, when + Math.max(0.15, dur - 0.1)); g.gain.linearRampToValueAtTime(0, when + dur + 0.5);
    o.connect(g); g.connect(this.bus.song);
    o.start(when); lfo.start(when); o.stop(when + dur + 0.6); lfo.stop(when + dur + 0.6);
  }
  /** A companion's little "ooh": a soft note that slides up into pitch. */
  voice(f, when, vol) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 0.9, when); o.frequency.exponentialRampToValueAtTime(f, when + 0.09);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.7);
    o.connect(g); g.connect(this.bus.voice);
    o.start(when); o.stop(when + 0.75);
  }

  /**
   * A flower opening plays a note. It waits for the next sixteenth so it always lands in time, and wanders
   * stepwise through the scale so a walk across fresh ground turns into a little tune. `strong` is a bud.
   */
  pluck(strong = false) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime, grid = STEP / 2;
    let t = this.nextT;
    while (t - grid >= now + 0.02) t -= grid;
    while (t < now + 0.02) t += grid;
    const gap = strong ? grid : STEP;
    if (t - this.lastPluck < gap - 0.01) { if (!strong) return; t = this.lastPluck + grid; }
    this.lastPluck = t;
    const moves = [-2, -1, -1, 1, 1, 2];
    this.pk = Math.max(0, Math.min(PENT.length - 1, this.pk + moves[Math.floor(Math.random() * moves.length)]));
    if (strong) { this.pluckTone('pluck', PENT[this.pk], t, 0.075, 1.4); this.pluckTone('pluck', PENT[this.pk] * 1.5, t + grid, 0.04, 1.2); }
    else this.pluckTone('pluck', PENT[this.pk] * 0.5, t, 0.04, 0.9);
  }

  bell(f, when, vol = 0.08, dur = 1.6) {
    if (!this.ctx) return;
    const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.01;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.master); g.connect(this.send);
    o.start(when); o2.start(when); o.stop(when + dur + 0.1); o2.stop(when + dur + 0.1);
  }

  whoosh(f0, f1, dur, vol, q = 1.2) {
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime, s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noise; s.loop = true;
    bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(f0, now); bp.frequency.exponentialRampToValueAtTime(f1, now + dur);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    s.connect(bp); bp.connect(g); g.connect(this.master); g.connect(this.send);
    s.start(now); s.stop(now + dur + 0.05);
  }

  /** Pickups and brush swings climb a pentatonic scale, so wandering plays a little melody. */
  chime(i) {
    if (!this.ctx) return;
    const scale = [587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.5, 1479.98, 1760];
    const k = i % (scale.length * 2 - 2), n = k < scale.length ? k : scale.length * 2 - 2 - k;
    this.bell(scale[n], this.ctx.currentTime, 0.06, 0.9);
  }

  play(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'swing': this.whoosh(500, 2600, 0.26, 0.2); break;
      case 'jump': this.whoosh(700, 1500, 0.16, 0.07); break;
      case 'step': this.whoosh(700 + Math.random() * 500, 320, 0.09, 0.05, 1.4); break;
      case 'land': this.whoosh(520, 140, 0.2, 0.13, 0.9); break;
      case 'spark': [587.33, 739.99, 880, 1174.66, 1479.98].forEach((f, i) => this.bell(f, t + i * 0.09, 0.09, 1.8)); break;
      case 'paint': this.whoosh(600 + Math.random() * 500, 1800 + Math.random() * 900, 0.22, 0.07, 2); break;
      case 'bridge': [392, 493.88, 587.33, 739.99, 987.77].forEach((f, i) => this.bell(f, t + i * 0.07, 0.1, 2.2)); break;
      case 'finale': [146.83, 220, 293.66, 369.99, 440, 587.33, 739.99, 880, 1174.66].forEach((f, i) => this.bell(f, t + i * 0.16, 0.12, 5)); this.whoosh(200, 5000, 3.5, 0.2, 0.5); break;
      case 'wake': [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.bell(f, t + i * 0.07, 0.08, 1.4)); break;
      case 'vista': [587.33, 739.99, 880, 1174.66, 1479.98].forEach((f, i) => this.bell(f, t + i * 0.2, 0.07, 3)); break;
      case 'sit': this.whoosh(420, 900, 0.8, 0.05, 0.7); break;
      case 'blossom': this.whoosh(900, 2600, 0.9, 0.05, 0.7); break;
      case 'wind': this.whoosh(260, 1500, 1.6, 0.16, 0.6); break;
      case 'glide': this.whoosh(500, 1100, 0.7, 0.07, 0.8); break;
      case 'wings': this.whoosh(1500, 3600, 0.5, 0.045, 0.9); break;
      case 'rustle': this.whoosh(2200 + Math.random() * 1400, 1100, 0.18, 0.03, 0.7); break;
      case 'pour': this.whoosh(1400, 380, 2.4, 0.06, 0.6); break;
      default: break;
    }
  }
}
