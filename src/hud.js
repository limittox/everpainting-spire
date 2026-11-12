import { rimR } from './world.js';

const $ = (id) => document.getElementById(id);

// The screen stays almost empty: a prompt when there is something to do, a name card when you arrive
// somewhere, one quiet hint line. The map and quest text exist but stay hidden until asked for (H).
export function createHud(world) {
  const hud = $('hud'), prompt = $('prompt'), toast = $('toast'), hintEl = $('hint');
  const map = $('minimap'), ctx = map.getContext('2d');
  let toastTimer = 0, hintTimer = 0, swatchTimer = 0, lastPrompt = null, full = false;

  // pre-rendered painterly map backdrop
  const bg = document.createElement('canvas'); bg.width = bg.height = 328;
  {
    const b = bg.getContext('2d');
    const g = b.createRadialGradient(164, 150, 10, 164, 164, 170);
    g.addColorStop(0, '#4c6c9a'); g.addColorStop(1, '#27305e');
    b.fillStyle = g; b.fillRect(0, 0, 328, 328);
    for (let i = 0; i < 90; i++) {
      b.fillStyle = ['rgba(120,170,200,0.10)', 'rgba(160,120,210,0.10)', 'rgba(60,90,150,0.14)', 'rgba(240,200,220,0.05)'][i % 4];
      b.beginPath(); b.ellipse(Math.random() * 328, Math.random() * 328, 12 + Math.random() * 40, 4 + Math.random() * 10, Math.random() * 3, 0, 6.3); b.fill();
    }
  }

  return {
    show(v) { hud.classList.toggle('hidden', !v); },
    rest(on) { hud.classList.toggle('rest', on); },          // nothing but the view while resting
    toggleFull() { full = !full; hud.classList.toggle('full', full); return full; },
    isFull() { return full; },
    objective(text) { const el = $('objective'); if (el.textContent !== text) el.textContent = text; },
    questDone() { $('questMain').classList.add('done'); },
    prompt(html, progress = 0) {
      if (html !== lastPrompt) {
        lastPrompt = html;
        prompt.classList.toggle('on', !!html);
        if (html) prompt.firstElementChild.innerHTML = html;
      }
      prompt.lastElementChild.style.width = `${progress * 100}%`;
    },
    toast(title, sub = '', ms = 2600) {
      toast.innerHTML = (sub ? `<small>${sub}</small>` : '') + title;
      toast.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('on'), ms);
    },
    hint(html, ms = 6500) {
      hintEl.innerHTML = html;
      hintEl.classList.add('on');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hintEl.classList.remove('on'), ms);
    },
    /** Show the row of paints for a moment, with the loaded one enlarged. */
    palette(paints, index) {
      const el = $('swatches');
      if (el.children.length !== paints.length) el.textContent = '';          // a new paint has been found
      if (!el.children.length) for (const p of paints) { const i = document.createElement('i'); i.style.background = i.style.color = p.hex; el.appendChild(i); }
      [...el.children].forEach((c, k) => c.classList.toggle('cur', k === index));
      el.classList.add('on');
      clearTimeout(swatchTimer);
      swatchTimer = setTimeout(() => el.classList.remove('on'), 1700);
    },
    clearHint() { clearTimeout(hintTimer); hintEl.classList.remove('on'); },
    minimap(player, sparks) {
      const S = 328, C = S / 2, k = C / 92;
      const px = player.pos.x, pz = player.pos.z;
      const X = (x) => C + (x - px) * k, Y = (z) => C + (z - pz) * k;
      ctx.save();
      ctx.beginPath(); ctx.arc(C, C, C, 0, 6.3); ctx.clip();
      ctx.drawImage(bg, 0, 0);
      for (const list of [world.islets, world.islands]) for (const isl of list) {
        if (Math.abs(isl.x - px) > 150 || Math.abs(isl.z - pz) > 150) continue;
        ctx.beginPath();
        for (let i = 0; i <= 28; i++) { const th = (i / 28) * Math.PI * 2, r = rimR(isl, th); ctx.lineTo(X(isl.x + Math.cos(th) * r), Y(isl.z + Math.sin(th) * r)); }
        ctx.fillStyle = list === world.islands ? '#6fa3a8' : 'rgba(96,130,160,0.55)'; ctx.fill();
        if (list === world.islands) { ctx.strokeStyle = 'rgba(190,230,220,0.6)'; ctx.lineWidth = 2; ctx.stroke(); }
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const line = (pts, n) => { ctx.beginPath(); for (let i = 0; i <= n; i += 3) ctx.lineTo(X(pts[Math.min(i, n)].x), Y(pts[Math.min(i, n)].z)); ctx.lineTo(X(pts[n].x), Y(pts[n].z)); ctx.stroke(); };
      // wind currents
      ctx.setLineDash([3, 7]); ctx.strokeStyle = 'rgba(255,220,235,0.7)'; ctx.lineWidth = 3;
      for (const w of world.winds) if (!w.secret || w.secret.found) line(w.pts, w.n);      // side winds stay off the map until their place is found
      ctx.setLineDash([]);
      // the painted path
      ctx.strokeStyle = '#fbeec8'; ctx.lineWidth = 6;
      for (const poly of world.pathPolys) line(poly, poly.length - 1);
      for (const br of world.bridges) {
        if (br.progress < 1) { ctx.setLineDash([5, 9]); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 4; line(br.pts, br.N); ctx.setLineDash([]); }
        if (br.progress > 0) { ctx.strokeStyle = '#fbeec8'; ctx.lineWidth = 6; line(br.pts, Math.floor(br.progress * br.N)); }
      }
      for (const sp of world.secrets || []) {                  // hidden places, once found: a drop of their paint
        if (!sp.found) continue;
        ctx.fillStyle = sp.hex; ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X(sp.pos.x), Y(sp.pos.z), 5.5, 0, 6.3); ctx.fill(); ctx.stroke();
      }
      for (const v of world.vistas || []) {                    // easels: a small diamond, filled once painted
        if (v.fixed && !v.done) continue;
        ctx.save(); ctx.translate(X(v.pos.x), Y(v.pos.z)); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = v.done ? '#fff0c8' : 'rgba(40,28,80,0.7)'; ctx.strokeStyle = '#fff0c8'; ctx.lineWidth = 2;
        ctx.fillRect(-4.5, -4.5, 9, 9); ctx.strokeRect(-4.5, -4.5, 9, 9); ctx.restore();
      }
      for (const s of sparks) {
        if (s.taken) continue;
        ctx.fillStyle = '#ffd060'; ctx.beginPath(); ctx.arc(X(s.g.position.x), Y(s.g.position.z), 5, 0, 6.3); ctx.fill();
        ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 2; ctx.stroke();
      }
      {
        let dx = (world.castlePos.x - px) * k, dy = (world.castlePos.z - pz) * k;
        const d = Math.hypot(dx, dy), lim = C - 22;
        if (d > lim) { dx *= lim / d; dy *= lim / d; }
        const g = ctx.createRadialGradient(C + dx, C + dy, 0, C + dx, C + dy, 20);
        g.addColorStop(0, 'rgba(255,240,180,0.95)'); g.addColorStop(1, 'rgba(255,210,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C + dx, C + dy, 20, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#ffd060'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(C + dx, C + dy, 7, 0, 6.3); ctx.fill(); ctx.stroke();
      }
      ctx.translate(C, C); ctx.rotate(Math.PI - player.heading);
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
      ctx.fillStyle = '#4aa8ff'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
    },
  };
}
