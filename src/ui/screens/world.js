// "Fußballwelt": world ranking, national teams, tournaments (EURO / WM), coaching carousel and the
// identities of all AI clubs.
import { crest, esc, flag, nationName, pname, ratingClass, portrait } from '../dom.js';
import { ensureIntl, ranking, nationSquad, nationStrength, nextTournament } from '../../manager/nationals.js';
import { PHILOSOPHIES, squadNeeds } from '../../manager/clubAI.js';
import { playerModal } from './manager.js';
import { clubModal } from './clubProfile.js';

export function worldScreen(app, el) {
  const w = app.world;
  ensureIntl(w);
  const home = { DE: 'GER', EN: 'ENG', ES: 'ESP', IT: 'ITA', FR: 'FRA' }[w.leagues.find((l) => l.id === app.club.leagueId).country] || 'GER';
  app.worldTab ||= 'rank'; app.worldNat ||= home;
  const draw = () => {
    const tab = app.worldTab, R = ranking(w), next = nextTournament(w);
    const T = w.intl.tournaments;
    let body = '';
    if (tab === 'rank') {
      body = `<div class="card table-wrap"><h3>🌍 Weltrangliste (Elo)</h3><table class="tbl compact"><thead><tr><th>#</th><th>Nation</th><th>Elo</th><th>Stärke</th><th>Spieler im Spiel</th><th></th></tr></thead><tbody>
        ${R.slice(0, 60).map((r) => { const n = Object.values(w.players).filter((p) => p.nation === r.nat && p.clubId != null).length; return `<tr data-nat="${r.nat}" class="${r.nat === home ? 'me' : ''}"><td>${r.rank}</td><td>${flag(r.nat)} ${esc(nationName(r.nat))}</td><td><b>${r.elo}</b></td><td>${nationStrength(w, r.nat)}</td><td>${n}</td><td>›</td></tr>`; }).join('')}</tbody></table></div>`;
    } else if (tab === 'nat') {
      const sq = nationSquad(w, app.worldNat);
      body = `<div class="card"><div class="page-head" style="margin:0"><h3>${flag(app.worldNat)} ${esc(nationName(app.worldNat))} · Stärke ${nationStrength(w, app.worldNat)} · Platz ${R.find((r) => r.nat === app.worldNat)?.rank ?? '–'}</h3>
        <select id="natsel" class="input" style="max-width:240px">${R.map((r) => `<option value="${r.nat}" ${r.nat === app.worldNat ? 'selected' : ''}>${esc(nationName(r.nat))}</option>`).join('')}</select></div>
        <p class="muted">Aufgebot aus allen Spielern dieser Nation in den Ligen des Spiels (stärkste 26). Spieler deines Vereins sind markiert.</p>
        <table class="tbl compact"><thead><tr><th>Spieler</th><th>Pos</th><th>Alter</th><th>Verein</th><th>Stärke</th><th>Länderspiele</th><th>Tore</th></tr></thead><tbody>
        ${sq.map((p) => `<tr data-p="${p.id}" class="${p.clubId === w.userClubId ? 'me' : ''}"><td class="nm">${portrait(p, w.clubs[p.clubId], 24)}<span>${esc(pname(p))}${(p.honours || []).length ? ` <i class="tag">🏆${p.honours.length}</i>` : ''}</span></td><td>${p.pos}</td><td>${p.age}</td><td>${crest(w.clubs[p.clubId], 16)} ${esc(w.clubs[p.clubId].short)}</td><td><b class="${ratingClass(p.ovr)}">${p.ovr}</b></td><td>${p.intl?.caps || 0}</td><td>${p.intl?.goals || 0}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Keine Spieler dieser Nation in den Ligen des Spiels.</td></tr>'}</tbody></table></div>`;
    } else if (tab === 'cups') {
      const t = T[0];
      body = `<div class="card"><h3>🏆 Turniere</h3><p>${next ? `Nächstes Turnier: <b>${esc(next.name)}</b> im Sommer ${next.year} (${next.teams} Teams, Gastgeber ${next.host.map((h) => esc(nationName(h))).join(', ')}) – wird am Ende der Saison ${next.year - 1}/${String(next.year % 100).padStart(2, '0')} ausgespielt.` : ''}</p>
        ${T.length ? T.map((x) => `<p>• <b>${esc(x.name)}</b>: ${flag(x.winner)} ${esc(nationName(x.winner))} vor ${esc(nationName(x.runnerUp))}${x.topScorer ? ` · Torschützenkönig ${esc(x.topScorer.name)} (${x.topScorer.goals})` : ''}</p>`).join('') : '<p class="muted">Noch kein Turnier gespielt.</p>'}</div>
        ${t ? `<div class="card"><h3>${esc(t.name)} · Gruppenphase</h3><div class="groups">${t.groups.map((g) => `<div class="grp"><b>Gruppe ${g.name}</b><table class="tbl compact"><tbody>${g.table.map((r, i) => `<tr class="${i < 2 ? 'q' : ''}"><td>${i + 1}</td><td>${flag(r.nat)} ${esc(r.nat)}</td><td>${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div>`).join('')}</div>
          <div class="bracket">${t.rounds.map((rd) => `<div class="round"><h4>${esc(rd.name)}</h4>${rd.ties.map((x) => `<div class="tie"><span class="${x.winner === x.a ? 'win' : 'lose'}">${flag(x.a)} ${esc(x.a)}</span><em><b>${x.ga}:${x.gb}</b>${x.note ? `<small>${esc(x.note.trim())}</small>` : ''}</em><span class="r ${x.winner === x.b ? 'win' : 'lose'}">${esc(x.b)} ${flag(x.b)}</span></div>`).join('')}</div>`).join('')}</div></div>` : ''}
        ${w.intl.results.length ? `<div class="card"><h3>Letzte Länderspiele (Woche ${w.intl.results[0].week + 1})</h3><div class="intl-res">${w.intl.results[0].games.slice(0, 30).map((g) => `<span>${flag(g.a)} ${g.a} <b>${g.ga}:${g.gb}</b> ${g.b} ${flag(g.b)}</span>`).join('')}</div></div>` : ''}`;
    } else if (tab === 'coaches') {
      const mv = w.coachMoves || [];
      body = `<div class="card"><h3>🔄 Trainerkarussell</h3>${mv.length ? `<table class="tbl compact"><thead><tr><th>Saison</th><th>Woche</th><th>Verein</th><th>Entlassen</th><th>Neu</th></tr></thead><tbody>${mv.map((m) => `<tr><td>${m.season}/${String((m.season + 1) % 100).padStart(2, '0')}</td><td>${m.week}</td><td>${crest(w.clubs[m.club], 16)} ${esc(w.clubs[m.club].name)}</td><td>${esc(m.out || '–')}</td><td><b>${esc(m.in)}</b></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Noch keine Entlassungen. Vereine, die hinter ihren Erwartungen zurückbleiben, ziehen irgendwann die Reißleine.</p>'}
        <h4 style="margin-top:14px">Vereinslose Trainer</h4><p>${(w.coachPool || []).slice().sort((a, b) => b.quality - a.quality).map((c) => `${esc(c.name)} ${'★'.repeat(c.quality)}`).join(' · ')}</p></div>`;
    } else {
      const lg = w.leagues.find((l) => l.id === (app.worldLeague || app.club.leagueId));
      body = `<div class="card table-wrap"><div class="page-head" style="margin:0"><h3>🧠 Vereins-KI: Philosophie, Trainer, Kaderplanung</h3><select id="lgsel" class="input" style="max-width:240px">${w.leagues.map((l) => `<option value="${l.id}" ${l.id === lg.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
        <table class="tbl compact"><thead><tr><th>Verein</th><th>Philosophie</th><th>Trainer</th><th>Stil</th><th>Druck</th><th>Sucht</th><th>Budget</th></tr></thead><tbody>
        ${lg.clubIds.map((id) => w.clubs[id]).filter((c) => c.ai && c.id !== w.userClubId).sort((a, b) => b.rep - a.rep).map((c) => { const n = squadNeeds(w, c)[0]; const pr = c.ai.pressure; return `<tr data-club="${c.id}"><td>${crest(c, 18)} ${esc(c.name)}</td><td>${esc(PHILOSOPHIES[c.ai.philosophy].label)}</td><td>${esc(c.ai.coach.name)} ${'★'.repeat(c.ai.coach.quality)}</td><td>${esc(c.ai.coach.style)} · ${esc(c.ai.coach.formation)}</td><td><span class="${pr > 1.2 ? 'bad' : pr > 0.6 ? '' : 'good'}">${pr > 1.2 ? 'wackelt' : pr > 0.6 ? 'erhöht' : 'ruhig'}</span></td><td>${n ? esc(n.pos) : '–'}</td><td>${(c.budget / 1e6).toFixed(1).replace('.', ',')} Mio.</td></tr>`; }).join('')}</tbody></table></div>`;
    }
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🌍 Fußballwelt</h2></div>
      <div class="tabs">${[['rank', '🌍 Weltrangliste'], ['nat', '🎽 Nationalteams'], ['cups', '🏆 EM & WM'], ['coaches', '🔄 Trainerkarussell'], ['ai', '🧠 Vereins-KI']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>${body}</div>`;
    el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { app.worldTab = b.dataset.t; draw(); }));
    el.querySelectorAll('tr[data-nat]').forEach((tr) => (tr.onclick = () => { app.worldNat = tr.dataset.nat; app.worldTab = 'nat'; draw(); }));
    el.querySelector('#natsel')?.addEventListener('change', (e) => { app.worldNat = e.target.value; draw(); });
    el.querySelector('#lgsel')?.addEventListener('change', (e) => { app.worldLeague = e.target.value; draw(); });
    el.querySelectorAll('tr[data-p]').forEach((tr) => (tr.onclick = () => playerModal(app, w.players[tr.dataset.p], { onChange: draw })));
    el.querySelectorAll('tr[data-club]').forEach((tr) => (tr.onclick = () => clubModal(app, w.clubs[tr.dataset.club], { onPlayer: (p) => playerModal(app, p) })));
  };
  draw();
}
