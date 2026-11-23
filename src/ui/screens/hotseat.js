// v5.0: hotseat handover – "pass the device" screen with the duel table of all managers.
import { crest, esc } from '../dom.js';
import { hotStandings, isHot, humanName } from '../../manager/hotseat.js';
import { computeTable, userFixture } from '../../manager/season.js';

export function hotTurnScreen(app, el, params = {}) {
  const w = app.world;
  if (!isHot(w)) { app.go('home'); return; }
  const H = w.hot.humans[w.hot.active], club = w.clubs[H.clubId];
  const S = hotStandings(w, computeTable).sort((a, b) => a.club.leagueId.localeCompare(b.club.leagueId) || a.rank - b.rank);
  // results of last week for every human (the week counter already moved on after a simulated week)
  const wk = params.reason === 'week' ? w.week - 1 : w.week;
  const res = w.hot.humans.map((h) => {
    const c = w.clubs[h.clubId], L = w.leagues.find((l) => l.id === c.leagueId), m = L.fixtures[wk]?.find((x) => x.h === c.id || x.a === c.id);
    return m && m.hg != null ? { h, m } : null;
  }).filter(Boolean);
  const title = params.reason === 'week' ? 'Neue Spielwoche' : params.reason === 'season' ? 'Neue Saison' : 'Übergabe';
  el.innerHTML = `<div class="page narrow hot-turn" style="--c1:${club.colors.primary}">
    <div class="card hot-hero">${crest(club, 84)}<div><small class="muted">${esc(title)} · Gerät weitergeben</small><h2>👤 ${esc(humanName(w, w.hot.active))} ist dran</h2><p>${esc(club.name)}</p></div>
      <button class="btn primary lg" id="hot-go">Los geht's ▶</button></div>
    <div class="grid-2">
      <div class="card"><h3>👥 Manager-Duell</h3><table class="tbl compact"><thead><tr><th>Manager</th><th>Verein</th><th>Platz</th><th>Pkt</th><th></th></tr></thead><tbody>
        ${S.map((r) => `<tr class="${r.active ? 'me' : ''}"><td><b>${esc(r.name)}</b></td><td>${crest(r.club, 18)} ${esc(r.club.short)} <small class="muted">${esc(r.league)}</small></td><td>${r.rank}.</td><td><b>${r.pts}</b></td><td>${r.done ? '✓' : ''}</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h3>⚽ ${params.reason === 'week' ? 'Ergebnisse der Woche' : 'Schon gespielt'}</h3>${res.length ? res.map(({ h, m }) => `<p>${esc(humanName(w, w.hot.humans.indexOf(h)))}: ${crest(w.clubs[m.h], 16)} ${esc(w.clubs[m.h].short)} <b>${m.hg}:${m.ag}</b> ${esc(w.clubs[m.a].short)} ${crest(w.clubs[m.a], 16)}</p>`).join('') : '<p class="muted">Noch keine Ergebnisse.</p>'}
        ${(() => { const f = userFixture(w); if (!f) return ''; const o = w.hot.humans.find((h) => h !== H && (h.clubId === f.h || h.clubId === f.a)); return o ? `<p class="hot-duel">🔥 Direktes Duell gegen <b>${esc(humanName(w, w.hot.humans.indexOf(o)))}</b>!${f.hg != null ? ` Schon gespielt: ${f.hg}:${f.ag}` : ''}</p>` : ''; })()}</div>
    </div></div>`;
  el.querySelector('#hot-go').onclick = () => app.go('home');
}
