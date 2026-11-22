// UI motion (v2.5): numbers count up, trophy ceremony with confetti.
import { crest, esc } from './dom.js';

export function animateNumbers(root) {
  if (document.body.classList.contains('no-anim')) return;
  const els = root.querySelectorAll('.kpi b, .sb-kpi b, .spirit b, .count-up, .ov-kpis b, .stat-big');
  els.forEach((el) => {
    const txt = el.textContent.trim();
    const m = txt.match(/^(-?[\d.]+)(,\d+)?(\s?(?:Mio\. €|Tsd\. €|%|€)?)$/);
    if (!m || el.dataset.counted) return;
    const intPart = m[1].replace(/\./g, ''), dec = m[2] ? m[2].slice(1) : '';
    const target = parseFloat(`${intPart}${dec ? '.' + dec : ''}`);
    if (!isFinite(target) || Math.abs(target) < 2) return;
    el.dataset.counted = '1';
    const t0 = performance.now(), dur = 700 + Math.min(600, Math.log10(Math.abs(target) + 1) * 150);
    const fmt = (v) => (dec ? v.toFixed(dec.length).replace('.', ',') : Math.round(v).toLocaleString('de-DE')) + (m[3] || '');
    const step = (t) => { const u = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - u, 3); el.textContent = fmt(target * e); if (u < 1) requestAnimationFrame(step); else el.textContent = txt; };
    requestAnimationFrame(step);
  });
}

// ------------------------------------------------------------------ trophy ceremony
const TROPHY = (c1, c2) => `<svg viewBox="0 0 120 160" class="trophy"><defs><linearGradient id="tg" x1="0" x2="1"><stop offset="0" stop-color="#8a6a12"/><stop offset=".35" stop-color="#ffe680"/><stop offset=".55" stop-color="#fff6c8"/><stop offset=".8" stop-color="#d4a21c"/><stop offset="1" stop-color="#7a5a0e"/></linearGradient></defs>
  <path d="M30 10 H90 V46 C90 72 76 86 60 88 C44 86 30 72 30 46 Z" fill="url(#tg)"/><path d="M30 18 C10 18 8 46 30 56 M90 18 C110 18 112 46 90 56" fill="none" stroke="url(#tg)" stroke-width="7"/>
  <rect x="54" y="86" width="12" height="26" fill="url(#tg)"/><path d="M36 112 H84 L90 132 H30 Z" fill="url(#tg)"/><rect x="24" y="132" width="72" height="18" rx="3" fill="#2a2140"/>
  <rect x="24" y="137" width="72" height="4" fill="${c1}"/><rect x="24" y="143" width="72" height="3" fill="${c2}"/></svg>`;

export function ceremony(app, { title, sub, club, onClose }) {
  const host = document.createElement('div');
  host.className = 'ceremony';
  host.innerHTML = `<canvas></canvas><div class="cer-card"><div class="cer-glow"></div>${TROPHY(club.colors.primary, club.colors.secondary)}
    <div class="cer-crest">${crest(club, 64)}</div><h1>${esc(title)}</h1><p>${esc(sub)}</p><button class="btn primary lg">Feiern! 🎉</button></div>`;
  document.body.appendChild(host);
  const cv = host.querySelector('canvas'), g = cv.getContext('2d');
  const fit = () => { cv.width = innerWidth; cv.height = innerHeight; }; fit(); addEventListener('resize', fit);
  const cols = [club.colors.primary, club.colors.secondary, '#ffd24a', '#ffffff'];
  const P = Array.from({ length: 220 }, () => ({ x: Math.random() * cv.width, y: -Math.random() * cv.height, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 8, h: 3 + Math.random() * 5, c: cols[Math.floor(Math.random() * cols.length)] }));
  let raf;
  const loop = () => {
    g.clearRect(0, 0, cv.width, cv.height);
    for (const p of P) { p.x += p.vx + Math.sin(p.y / 50); p.y += p.vy; p.r += p.vr; if (p.y > cv.height + 20) { p.y = -20; p.x = Math.random() * cv.width; } g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); }
    raf = requestAnimationFrame(loop);
  };
  loop();
  const close = () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); host.classList.add('out'); setTimeout(() => { host.remove(); onClose?.(); }, 400); };
  host.querySelector('button').onclick = close;
}

export function queueCeremony(world, c) { (world.ceremonies ||= []).push(c); }
export function runCeremonies(app) {
  const w = app.world; if (!w?.ceremonies?.length) return;
  const c = w.ceremonies.shift();
  ceremony(app, { title: c.title, sub: c.sub, club: w.clubs[c.clubId] || app.club });
}
window.ufmFx = { ceremony };
