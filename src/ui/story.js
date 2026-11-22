// Saison-Story (v2.5): an Instagram-style animated season review.
import { crest, esc, money, portrait } from './dom.js';
import { computeTable, userLeague } from '../manager/season.js';

/** Collect the story data before endSeason resets the stats. */
export function buildStory(world) {
  const club = world.clubs[world.userClubId];
  const L = userLeague(world);
  const table = computeTable(L);
  const rank = table.findIndex((r) => r.id === club.id) + 1;
  const row = table[rank - 1];
  const squad = club.squad.map((id) => world.players[id]).filter(Boolean);
  // snapshot: endSeason resets p.stats before the slides are rendered
  const snap = (p) => p && { ...p, stats: { ...p.stats } };
  const top = snap([...squad].sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists)[0]);
  const score = (p) => p.ovr + p.stats.goals * 0.6 + p.stats.assists * 0.4 + Math.min(34, p.stats.apps) * 0.25;
  const best = snap(squad.filter((p) => p.id !== top?.id && p.stats.apps >= 5).sort((a, b) => score(b) - score(a))[0]);
  let bigWin = null, pts = [], cum = 0;
  for (const md of L.fixtures) {
    const m = md.find((x) => x.h === club.id || x.a === club.id);
    if (!m || m.hg == null) continue;
    const home = m.h === club.id, gf = home ? m.hg : m.ag, ga = home ? m.ag : m.hg;
    cum += gf > ga ? 3 : gf === ga ? 1 : 0; pts.push(cum);
    if (gf > ga && (!bigWin || gf - ga > bigWin.gf - bigWin.ga || (gf - ga === bigWin.gf - bigWin.ga && gf > bigWin.gf))) bigWin = { gf, ga, opp: world.clubs[home ? m.a : m.h], home };
  }
  const moves = Object.values(world.players).flatMap((p) => (p.moves || []).filter((mv) => mv.season === world.season && (mv.to === club.short || mv.from === club.short)).map((mv) => ({ p, ...mv })));
  const ins = moves.filter((m) => m.to === club.short).sort((a, b) => (b.fee || 0) - (a.fee || 0));
  const outs = moves.filter((m) => m.from === club.short).sort((a, b) => (b.fee || 0) - (a.fee || 0));
  const cups = (world.cups || []).filter((c) => c.winner === club.id).map((c) => c.name);
  return { season: world.season, club, league: L.name, rank, of: table.length, row, champion: rank === 1, top, best, bigWin, pts, ins, outs, cups, rep0: world.career?.rep ?? null };
}

const pn = (p) => `${p.firstName} ${p.lastName}`;

function slides(S, world, after) {
  const c = S.club, out = [];
  const sea = `${S.season}/${String((S.season + 1) % 100).padStart(2, '0')}`;
  out.push(`<div class="st-big">${crest(c, 110)}</div><p class="st-kicker">Deine Saison</p><h1>${sea}</h1><p>${esc(c.name)} · ${esc(S.league)}</p>`);
  const max = Math.max(3, ...S.pts), w = 300, h = 120;
  const line = S.pts.map((v, i) => `${(i / Math.max(1, S.pts.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  out.push(`<p class="st-kicker">Abschluss</p><h1 class="st-num">${S.rank}.</h1><p>von ${S.of} · ${S.row.pts} Punkte, ${S.row.w} Siege, ${S.row.gf}:${S.row.ga} Tore</p>
    <svg viewBox="-4 -4 ${w + 8} ${h + 8}" class="st-chart"><polyline points="${line}" fill="none" stroke="var(--acc)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" pathLength="1" class="st-draw"/></svg><p class="muted">Punkteverlauf</p>`);
  if (S.top && S.top.stats.goals > 0) out.push(`<p class="st-kicker">Torjäger</p><div class="st-big">${portrait(S.top, c, 120)}</div><h2>${esc(pn(S.top))}</h2><h1 class="st-num">${S.top.stats.goals}</h1><p>Tore · ${S.top.stats.assists} Vorlagen · ${S.top.stats.apps} Spiele</p>`);
  if (S.best) out.push(`<p class="st-kicker">Spieler der Saison</p><div class="st-big">${portrait(S.best, c, 120)}</div><h2>${esc(pn(S.best))}</h2><p>${esc(S.best.pos)} · Stärke ${S.best.ovr} · ${S.best.stats.apps} Einsätze</p>`);
  if (S.bigWin) out.push(`<p class="st-kicker">Höchster Sieg</p><div class="st-duo">${crest(c, 70)}<h1 class="st-num">${S.bigWin.gf}:${S.bigWin.ga}</h1>${crest(S.bigWin.opp, 70)}</div><p>${S.bigWin.home ? 'zu Hause gegen' : 'auswärts bei'} ${esc(S.bigWin.opp.name)}</p>`);
  if (S.ins.length || S.outs.length) out.push(`<p class="st-kicker">Transfers</p><div class="st-cols"><div><h3>↘ Zugänge</h3>${S.ins.slice(0, 4).map((m) => `<p>${esc(pn(m.p))}<em>${m.fee ? money(m.fee) : 'ablösefrei'}</em></p>`).join('') || '<p class="muted">keine</p>'}</div>
    <div><h3>↗ Abgänge</h3>${S.outs.slice(0, 4).map((m) => `<p>${esc(pn(m.p))}<em>${m.fee ? money(m.fee) : 'ablösefrei'}</em></p>`).join('') || '<p class="muted">keine</p>'}</div></div>`);
  const titles = [...(S.champion ? [`Meister ${S.league}`] : []), ...S.cups];
  if (titles.length) out.push(`<p class="st-kicker">Titel</p><div class="st-big st-trophy">🏆</div>${titles.map((t) => `<h2>${esc(t)}</h2>`).join('')}`);
  if (after?.career) {
    const d = after.career.delta;
    out.push(`<p class="st-kicker">Dein Ruf als Trainer</p><h1 class="st-num">${Math.round(after.career.rep)}</h1><p class="${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '▲ +' : '▼ '}${d}</p><p class="muted">${after.promoted?.includes(c.id) ? 'Aufgestiegen! ' : ''}${after.relegated?.includes(c.id) ? 'Abgestiegen. ' : ''}Weiter geht's in die nächste Saison.</p>`);
  }
  return out;
}

export function showStory(S, world, after) {
  return new Promise((resolve) => {
    const sl = slides(S, world, after);
    const host = document.createElement('div');
    host.className = 'story';
    host.style.setProperty('--c1', S.club.colors.primary); host.style.setProperty('--c2', S.club.colors.secondary);
    host.innerHTML = `<div class="st-frame"><div class="st-bars">${sl.map(() => '<i><b></b></i>').join('')}</div><button class="st-x" aria-label="Schließen">✕</button>
      <div class="st-body"></div><div class="st-tap st-l"></div><div class="st-tap st-r"></div><p class="st-hint">Tippen: weiter · halten: Pause</p></div>`;
    document.body.appendChild(host);
    const body = host.querySelector('.st-body'), bars = [...host.querySelectorAll('.st-bars b')];
    const DUR = 5200;
    let i = -1, t0 = 0, paused = false, pauseAt = 0, raf;
    const show = (k) => {
      if (k >= sl.length) return close();
      i = Math.max(0, k); t0 = performance.now();
      bars.forEach((b, j) => (b.style.width = j < i ? '100%' : '0%'));
      body.innerHTML = `<div class="st-slide">${sl[i]}</div>`;
    };
    const tick = (t) => {
      if (!paused) { const u = (t - t0) / DUR; bars[i].style.width = `${Math.min(100, u * 100)}%`; if (u >= 1) show(i + 1); }
      raf = requestAnimationFrame(tick);
    };
    const close = () => { cancelAnimationFrame(raf); removeEventListener('keydown', key); host.classList.add('out'); setTimeout(() => { host.remove(); resolve(); }, 300); };
    const key = (e) => { if (e.key === 'ArrowRight' || e.key === ' ') show(i + 1); else if (e.key === 'ArrowLeft') show(i - 1); else if (e.key === 'Escape') close(); };
    addEventListener('keydown', key);
    host.querySelector('.st-r').onclick = () => show(i + 1);
    host.querySelector('.st-l').onclick = () => show(i - 1);
    host.querySelector('.st-x').onclick = close;
    const frame = host.querySelector('.st-frame');
    frame.addEventListener('pointerdown', () => { paused = true; pauseAt = performance.now(); });
    frame.addEventListener('pointerup', () => { if (paused) { t0 += performance.now() - pauseAt; paused = false; } });
    show(0); raf = requestAnimationFrame(tick);
  });
}
