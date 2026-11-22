// Analyse-Hub (v2.5): season trends, accumulated heatmap / shot map / pass network, top performers.
import { esc, crest, pname } from '../dom.js';
import { ensureHub, seasonTrend } from '../../manager/analysisHub.js';

const PX = (x) => ((x + 52.5) / 105) * 120, PZ = (z) => ((z + 34) / 68) * 80;
const pitch = (inner) => `<svg viewBox="-2 -2 124 84" class="an-pitch"><rect x="0" y="0" width="120" height="80" rx="2" fill="#1f5a2c"/>
  <g fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".5"><rect x="0" y="0" width="120" height="80"/><line x1="60" y1="0" x2="60" y2="80"/><circle cx="60" cy="40" r="10"/>
  <rect x="0" y="18" width="18" height="44"/><rect x="102" y="18" width="18" height="44"/><rect x="0" y="30" width="6" height="20"/><rect x="114" y="30" width="6" height="20"/></g>${inner}
  <text x="118" y="78" text-anchor="end" font-size="3.2" fill="rgba(255,255,255,.7)">Angriffsrichtung →</text></svg>`;

function trendSvg(T) {
  const R = T.rows, n = Math.max(R.length, 2), W = 620, H = 200, padL = 28, padB = 22;
  const X = (i) => padL + (i / (n - 1)) * (W - padL - 10);
  const Y = (rank) => 10 + ((rank - 1) / Math.max(1, T.teams - 1)) * (H - padB - 70);
  const maxG = Math.max(3, ...R.map((r) => Math.max(r.gf, r.ga)));
  const base = H - padB - 30, gh = 26;
  const bars = R.map((r, i) => `<rect x="${X(i) - 3}" y="${base - (r.gf / maxG) * gh}" width="6" height="${(r.gf / maxG) * gh}" fill="var(--acc)" rx="1"><title>${r.md}. Spieltag: ${r.gf}:${r.ga}</title></rect>
    <rect x="${X(i) - 3}" y="${base + 2}" width="6" height="${(r.ga / maxG) * gh}" fill="#ff7a7a" opacity=".75" rx="1"/>`).join('');
  const line = R.map((r, i) => `${X(i)},${Y(r.rank)}`).join(' ');
  const dots = R.map((r, i) => `<circle cx="${X(i)}" cy="${Y(r.rank)}" r="3.4" fill="${r.res === 'S' ? '#3ddc84' : r.res === 'U' ? '#ffd24a' : '#ff6b6b'}"><title>${r.md}. Spieltag · Platz ${r.rank} · ${r.gf}:${r.ga} · ${r.pts} Pkt.</title></circle>`).join('');
  const ticks = [1, Math.ceil(T.teams / 2), T.teams].map((v) => `<text x="${padL - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="10" fill="currentColor" opacity=".55">${v}.</text><line x1="${padL}" x2="${W - 10}" y1="${Y(v)}" y2="${Y(v)}" stroke="currentColor" stroke-opacity=".08"/>`).join('');
  const xt = R.filter((_, i) => i % Math.ceil(n / 12) === 0).map((r) => `<text x="${X(r.md - 1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="currentColor" opacity=".55">${r.md}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" class="trend-svg">${ticks}<polyline points="${line}" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" class="st-draw" pathLength="1"/>${dots}${bars}${xt}</svg>`;
}

export function analysisScreen(app, el) {
  const w = app.world, club = app.club, H = ensureHub(w), T = seasonTrend(w), R = T.rows;
  const tab = (app.anTab ||= 'heat');
  const g = R.length, pts = R.at(-1)?.pts || 0, gf = R.reduce((s, r) => s + r.gf, 0), ga = R.reduce((s, r) => s + r.ga, 0);
  const form = R.slice(-5).map((r) => `<i class="f-${r.res}">${r.res}</i>`).join('');
  const kpi = (label, val, sub = '') => `<div class="kpi"><small>${label}</small><b>${val}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
  const squad = club.squad.map((id) => w.players[id]).filter((p) => p && p.stats.apps);
  const perf = [...squad].sort((a, b) => b.stats.goals * 2 + b.stats.assists - (a.stats.goals * 2 + a.stats.assists) || (b.stats.rating || 0) - (a.stats.rating || 0)).slice(0, 10);
  const pitchPanel = () => {
    if (!H.games) return '<p class="muted">Noch keine Daten. Heatmap, Schusskarte und Passnetz sammeln sich aus jedem Spiel, das du im 3D-Modus schaust.</p>';
    if (tab === 'heat') { const mx = Math.max(1, ...H.heat); return pitch(H.heat.map((v, i) => `<rect x="${(i % 12) * 10}" y="${Math.floor(i / 12) * 10}" width="10" height="10" fill="${club.colors.primary}" opacity="${(v / mx * 0.85).toFixed(2)}"/>`).join('')); }
    if (tab === 'shots') {
      const sh = H.shots, xg = sh.reduce((s, x) => s + x.xg, 0), goals = sh.filter((s) => s.goal).length;
      return pitch(sh.map((s) => `<circle cx="${PX(s.x)}" cy="${PZ(s.z)}" r="${(1 + s.xg * 5).toFixed(1)}" fill="${s.goal ? '#ffd24a' : club.colors.primary}" fill-opacity="${s.goal ? 0.95 : 0.5}" stroke="#fff" stroke-width=".3"><title>${esc(s.name)} · ${s.wk}. Woche ${s.min}' · xG ${s.xg.toFixed(2)}</title></circle>`).join(''))
        + `<p class="muted">${sh.length} Schüsse · ${goals} Tore · xG ${xg.toFixed(1)} → ${goals >= xg ? `Chancenverwertung <b class="good">+${(goals - xg).toFixed(1)}</b> über Erwartung` : `<b class="bad">${(goals - xg).toFixed(1)}</b> unter Erwartung`}</p>`;
    }
    const P = H.pos, ids = Object.keys(P).sort((a, b) => P[b].n - P[a].n).slice(0, 13);
    const links = Object.entries(H.links).map(([k, n]) => { const [a, b] = k.split('>'); return { a: P[a], b: P[b], n, ok: ids.includes(a) && ids.includes(b) }; }).filter((l) => l.ok && l.n >= Math.max(2, H.games));
    const maxN = Math.max(1, ...links.map((l) => l.n));
    return pitch(links.map((l) => `<line x1="${PX(l.a.x / l.a.n)}" y1="${PZ(l.a.z / l.a.n)}" x2="${PX(l.b.x / l.b.n)}" y2="${PZ(l.b.z / l.b.n)}" stroke="#fff" stroke-opacity="${(0.15 + 0.7 * l.n / maxN).toFixed(2)}" stroke-width="${(0.3 + 1.8 * l.n / maxN).toFixed(2)}"/>`).join('')
      + ids.map((id) => { const s = P[id], x = PX(s.x / s.n), z = PZ(s.z / s.n); return `<g><circle cx="${x}" cy="${z}" r="3.2" fill="${club.colors.primary}" stroke="${club.colors.secondary}" stroke-width=".6"/><text x="${x}" y="${z + 1.2}" text-anchor="middle" font-size="3" font-weight="700" fill="${club.colors.secondary}">${s.num}</text><text x="${x}" y="${z + 6.5}" text-anchor="middle" font-size="2.6" fill="#fff">${esc(s.name)}</text></g>`; }).join(''))
      + '<p class="muted">Durchschnittspositionen und häufigste Passwege über alle geschauten Spiele.</p>';
  };
  const hist = (club.history || []).slice(-6).reverse();
  el.innerHTML = `<div class="page"><div class="page-head"><h2>📊 Analyse-Hub</h2><span class="chip">${g} Spieltage · ${H.games} Spiele in 3D analysiert</span></div>
    <div class="kpis an-kpis">${kpi('Punkte / Spiel', g ? (pts / g).toFixed(2).replace('.', ',') : '–', `${pts} Punkte`)}${kpi('Tore / Spiel', g ? (gf / g).toFixed(1).replace('.', ',') : '–', `${gf} Tore`)}${kpi('Gegentore / Spiel', g ? (ga / g).toFixed(1).replace('.', ',') : '–', `${ga} Gegentore`)}
      ${kpi('xG für / gegen', H.games ? `${(H.xgFor / H.games).toFixed(1).replace('.', ',')} / ${(H.xgAg / H.games).toFixed(1).replace('.', ',')}` : '–', 'pro Spiel (3D)')}${kpi('Ballbesitz', H.games && H.poss ? `${Math.round(H.poss / H.games)} %` : '–', 'Schnitt (3D)')}
      <div class="kpi"><small>Form</small><b class="form-row">${form || '–'}</b></div></div>
    <div class="card"><h3>📈 Saisonverlauf</h3>${g ? trendSvg(T) : '<p class="muted">Der Verlauf erscheint nach dem ersten Spieltag.</p>'}<p class="muted">Linie = Tabellenplatz (Punkte: grün Sieg, gelb Remis, rot Niederlage) · Balken = Tore (oben) und Gegentore (unten) je Spieltag</p></div>
    <div class="grid2">
      <div class="card"><div class="row-between"><h3>🗺️ Spielanalyse</h3><div class="tabs small">${[['heat', 'Heatmap'], ['shots', 'Schusskarte'], ['net', 'Passnetz']].map(([k, l]) => `<button data-at="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}</div></div>${pitchPanel()}</div>
      <div class="card"><h3>⭐ Leistungsträger</h3><table class="tbl"><thead><tr><th>Spieler</th><th>Sp.</th><th>Tore</th><th>Vorl.</th><th>Ø Note</th></tr></thead><tbody>
        ${perf.map((p) => `<tr data-p="${p.id}" class="clickable"><td>${esc(pname(p))} <small class="muted">${p.pos}</small></td><td>${p.stats.apps}</td><td>${p.stats.goals}</td><td>${p.stats.assists}</td><td>${p.stats.rating ? p.stats.rating.toFixed(1).replace('.', ',') : '–'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Noch keine Einsätze.</td></tr>'}</tbody></table>
        <h3 style="margin-top:14px">🗂️ Saisonvergleich</h3><table class="tbl"><thead><tr><th>Saison</th><th>Liga</th><th>Platz</th><th>Punkte</th><th>Tore</th></tr></thead><tbody>
        ${hist.map((h) => `<tr><td>${h.season}/${String((h.season + 1) % 100).padStart(2, '0')}</td><td>${esc(h.league)}</td><td>${h.champion ? '🏆 ' : ''}${h.rank}.</td><td>${h.pts}</td><td>${h.gf}:${h.ga}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Noch keine abgeschlossene Saison.</td></tr>'}</tbody></table></div>
    </div></div>`;
  el.querySelectorAll('[data-at]').forEach((b) => (b.onclick = () => { app.anTab = b.dataset.at; analysisScreen(app, el); }));
  el.querySelectorAll('[data-p]').forEach((r) => (r.onclick = async () => { const { playerModal } = await import('./manager.js'); playerModal(app, w.players[r.dataset.p]); }));
}
