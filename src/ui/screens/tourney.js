// v6.0: EURO / World Cup inside the career – nominations, groups, knock-out bracket, top scorers,
// round-by-round simulation and live 3D matches for the user as national coach.
import { esc, flag, nationName, crest, toast, modal, pname, ratingClass } from '../dom.js';
import { newRng } from '../../manager/season.js';
import { stageFixtures, stageName, playStage, simToEnd, userNat, userFixture, nominate, nationClub, cleanupNationClubs } from '../../manager/tourney.js';
import { natPicker } from './career.js';

const nm = (n) => `${flag(n)} ${esc(nationName(n))}`;

export function tourneyScreen(app, el) {
  const w = app.world;
  if (w.tourneyRestore != null) cleanupNationClubs(w); // a live match was left without result
  const T = w.tourney;
  app.tourTab ||= 'overview';
  if (!T) {
    const last = w.intl?.tournaments?.[0];
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🌍 EM / WM</h2></div><div class="card"><p class="muted">Gerade läuft kein Turnier. EM und WM werden in den Sommerpausen gespielt – mit Nominierungen, Gruppenphase und K.-o.-Runde.</p>${last ? `<p>Zuletzt: <b>${esc(last.name)}</b> – Sieger ${nm(last.winner)}, Finalgegner ${nm(last.runnerUp)}.</p>` : ''}</div></div>`;
    return;
  }
  const mine = userNat(w);
  const draw = () => {
    const tab = app.tourTab;
    const fx = stageFixtures(T), uf = userFixture(w);
    const own = Object.entries(T.squads).flatMap(([n, ids]) => ids.map((id) => w.players[id]).filter((p) => p && p.clubId === w.userClubId).map((p) => [n, p]));
    let body = '';
    if (tab === 'overview') {
      body = `<div class="grid-2"><div class="card"><h3>${T.done ? '🏆 Turnier beendet' : `▶ ${esc(stageName(T))}`}</h3>
        ${T.done ? `<div class="t-champ">${flag(T.winner)}<b>${esc(nationName(T.winner))}</b><small>${T.kind === 'wm' ? 'Weltmeister' : 'Europameister'} ${T.year}</small></div><p>Finalgegner: ${nm(T.runnerUp)}${T.topScorer ? ` · Torschützenkönig: <b>${esc(T.topScorer.name)}</b> (${T.topScorer.goals} Tore)` : ''}</p><button class="btn primary" id="t-home">Weiter zur Saison ▶</button>`
        : `${uf ? `<div class="t-mine"><small>Dein Spiel als Nationaltrainer</small><b>${nm(uf.a)} – ${nm(uf.b)}</b><div class="row-actions"><button class="btn primary" id="t-live">⚽ Live in 3D</button><button class="btn" id="t-next">⏩ Simulieren</button></div></div>` : `<button class="btn primary" id="t-next">⏩ ${esc(stageName(T))} spielen</button>`}
          <button class="btn ghost" id="t-all">⏭ Turnier zu Ende simulieren</button>
          <div class="t-fx">${fx.slice(0, 24).map((f) => `<div class="${f.a === mine || f.b === mine ? 'mine' : ''}"><span>${nm(f.a)}</span><em>${f.group ? `Gr. ${f.group}` : 'K.o.'}</em><span>${nm(f.b)}</span></div>`).join('')}</div>`}
        ${T.last ? `<p class="small muted">Zuletzt gespielt: ${esc(T.last.stage)}${T.last.mine ? ` · Dein Spiel: ${nm(T.last.mine.a)} ${T.last.mine.ga}:${T.last.mine.gb}${esc(T.last.mine.note || '')} ${nm(T.last.mine.b)}` : ''}</p>` : ''}</div>
        <div class="card"><h3>🎽 Nominierungen</h3>${mine ? `<p>Du bist Nationaltrainer von ${nm(mine)}.</p>${T.stage === 0 && !T.done ? '<button class="btn sm" id="t-pick">Kader nominieren</button>' : ''}` : ''}
          <h4>Spieler deines Vereins (${own.length})</h4>${own.length ? own.map(([n, p]) => `<p class="small">${flag(n)} <b class="${ratingClass(p.ovr)}">${p.ovr}</b> ${esc(pname(p))} <span class="muted">${p.pos}</span></p>`).join('') : '<p class="muted small">Keiner deiner Spieler ist dabei – dafür startet dein Kader ausgeruht in die Saison.</p>'}
          <p class="small muted">Nominierte Spieler kommen müder zurück, je weiter ihr Land kommt. Weltmeister gewinnen Moral und Marktwert.</p></div></div>`;
    } else if (tab === 'groups') {
      body = `<div class="t-groups">${T.groups.map((g) => { const t = g.table || g.teams.map((n) => ({ nat: n, p: 0, pts: 0, gf: 0, ga: 0 })); return `<div class="card"><h4>Gruppe ${g.name}</h4><table class="tbl compact"><tbody>${t.map((r, i) => `<tr class="${r.nat === mine ? 'mine' : ''} ${i < 2 ? 'q' : ''}"><td>${i + 1}</td><td>${nm(r.nat)}</td><td>${r.p}</td><td>${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table>${g.games.map((m) => `<p class="small muted">${m.a} ${m.ga}:${m.gb} ${m.b}</p>`).join('')}</div>`; }).join('')}</div>`;
    } else if (tab === 'ko') {
      body = T.rounds.length ? `<div class="t-ko">${T.rounds.map((r) => `<div class="card"><h4>${esc(r.name)}</h4>${r.ties.map((t) => `<p class="${t.a === mine || t.b === mine ? 'mine' : ''}"><span class="${t.winner === t.a ? 'w' : ''}">${nm(t.a)}</span> <b>${t.ga}:${t.gb}</b><small>${esc(t.note || '')}</small> <span class="${t.winner === t.b ? 'w' : ''}">${nm(t.b)}</span></p>`).join('')}</div>`).join('')}</div>` : '<div class="card"><p class="muted">Die K.-o.-Runde beginnt nach dem 3. Gruppenspieltag.</p></div>';
    } else if (tab === 'squads') {
      body = `<div class="t-groups">${T.field.map((n) => `<div class="card"><h4>${nm(n)}</h4>${(T.squads[n] || []).slice(0, 26).map((id) => w.players[id]).filter(Boolean).map((p) => `<p class="small ${p.clubId === w.userClubId ? 'mine' : ''}"><b class="${ratingClass(p.ovr)}">${p.ovr}</b> ${esc(pname(p))} <span class="muted">${p.pos} · ${esc(w.clubs[p.clubId]?.short || '')}</span></p>`).join('') || '<p class="muted small">Kader aus Spielern außerhalb unserer Ligen.</p>'}</div>`).join('')}</div>`;
    } else {
      const top = Object.entries(T.goals).sort((a, b) => b[1] - a[1]).slice(0, 15);
      body = `<div class="card"><h3>⚽ Torjäger</h3>${top.map(([id, g], i) => { const p = w.players[id]; return p ? `<p>${i + 1}. ${flag(p.nation)} ${esc(pname(p))} <b>${g}</b></p>` : ''; }).join('') || '<p class="muted">Noch keine Tore.</p>'}</div>`;
    }
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🌍 ${esc(T.name)}</h2><span class="muted">${T.field.length} Nationen · Gastgeber ${T.host.map((h) => flag(h)).join(' ')}</span></div>
      <div class="tabs">${[['overview', '📋 Übersicht'], ['groups', '📊 Gruppen'], ['ko', '🏆 K.-o.-Runde'], ['squads', '🎽 Kader'], ['scorers', '⚽ Torjäger']].map(([k, l]) => `<button data-tt="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>${body}</div>`;
    el.querySelectorAll('[data-tt]').forEach((b) => (b.onclick = () => { app.tourTab = b.dataset.tt; draw(); }));
    el.querySelector('#t-next')?.addEventListener('click', () => { playStage(w, newRng(w)); toast(T.done ? `🏆 ${nationName(T.winner)} gewinnt die ${T.name}!` : `${T.last.stage} gespielt`); draw(); });
    el.querySelector('#t-all')?.addEventListener('click', () => { simToEnd(w, newRng(w)); draw(); });
    el.querySelector('#t-home')?.addEventListener('click', () => app.go('home'));
    el.querySelector('#t-pick')?.addEventListener('click', () => natPicker(app, () => { nominate(w, newRng(w)); draw(); }));
    el.querySelector('#t-live')?.addEventListener('click', () => {
      const rng = newRng(w), f = userFixture(w);
      const A = nationClub(w, f.a, rng), B = nationClub(w, f.b, rng);
      w.tourneyRestore = w.userClubId; w.userClubId = (f.a === mine ? A : B).id;
      app.go('match', { friendly: true, home: A.id, away: B.id, tourney: f, mode: '3d' });
    });
  };
  draw();
}

/** Books a live tournament match and returns to the tournament screen. */
export async function tourneyCommit(app, r, f) {
  const w = app.world, rng = newRng(w);
  const scorers = (r.events || []).filter((e) => e.type === 'goal' && !e.own && e.player != null && !w.players[e.player]?.tourneyOnly).map((e) => e.player);
  let res = { ga: r.hg, gb: r.ag, scorers, note: '', winner: r.hg > r.ag ? f.a : r.hg < r.ag ? f.b : null };
  if (f.ko && r.hg === r.ag) {
    const aw = rng.chance(0.5);
    res = { ...res, note: aw ? ' n. V., 5:4 i. E.' : ' n. V., 4:5 i. E.', winner: aw ? f.a : f.b };
    await new Promise((ok) => { const m = modal(`<div class="confirm-club"><div style="font-size:3rem">🥅</div><h3>Elfmeterschießen</h3><p><b>${esc(nationName(res.winner))}</b> ist weiter!</p><button class="btn primary" id="ok">Weiter</button></div>`, { onClose: ok }); m.el.querySelector('#ok').onclick = () => m.close(); });
  }
  cleanupNationClubs(w);
  playStage(w, rng, res);
  if (w.tourney?.done) toast(`🏆 ${nationName(w.tourney.winner)} gewinnt die ${w.tourney.name}!`);
  await app.save(app.slot || 'slot1', true);
  app.go('tourney');
}
void crest;
