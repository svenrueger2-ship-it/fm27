// Club profile ("Vereinshistorie") and player career section.
import { crest, esc, money, modal, portrait, flag, ratingClass, pname } from '../dom.js';
import { computeTable } from '../../manager/season.js';
import { teamStrength } from '../../match/tactics.js';
import { PHILOSOPHIES, squadNeeds } from '../../manager/clubAI.js';

export function clubModal(app, club, { onPlayer } = {}) {
  const w = app.world;
  const L = w.leagues.find((l) => l.id === club.leagueId);
  const t = computeTable(L);
  const rank = t.findIndex((r) => r.id === club.id) + 1;
  const hist = [...(club.history || [])].reverse();
  const gameTitles = hist.filter((h) => h.champion && h.tier === 1).length;
  const top = club.squad.map((id) => w.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr).slice(0, 6);
  const transfers = (w.transfer?.history || []).filter((x) => x.to === club.id || x.from === club.id).slice(0, 8);
  const info = club.info || {};
  const m = modal(`<div class="club-profile" style="--c1:${club.colors.primary};--c2:${club.colors.secondary}">
    <div class="cp-head">${crest(club, 84)}<div><small>${esc(L.name)} · aktuell Platz ${rank}</small><h3>${esc(club.name)}</h3>
      <p>🏟️ ${esc(club.stadium.name)} · ${club.stadium.capacity.toLocaleString('de-DE')} Plätze</p></div></div>
    <div class="cp-facts">
      <div><small>Gegründet</small><b>${info.founded || '–'}</b></div>
      <div><small>Meistertitel (real)</small><b>${info.titles ?? '–'}</b></div>
      <div><small>Titel im Spiel</small><b>${gameTitles}</b></div>
      <div><small>Teamstärke</small><b>${Math.round(teamStrength(club, w.players))}</b></div>
      <div><small>Kontostand</small><b>${money(club.budget)}</b></div>
    </div>
    ${club.ai && club.id !== w.userClubId ? `<div class="cp-ai"><div><small>Vereinsphilosophie</small><b>${esc(PHILOSOPHIES[club.ai.philosophy].label)}</b><span class="muted">${esc(PHILOSOPHIES[club.ai.philosophy].desc)}</span></div>
      <div><small>Cheftrainer</small><b>${esc(club.ai.coach.name)} ${'★'.repeat(club.ai.coach.quality)}</b><span class="muted">${esc(club.ai.coach.style)} · ${esc(club.ai.coach.formation)}${club.ai.pressure > 1.2 ? ' · <b style="color:#ff6b6b">wackelt</b>' : ''}</span></div>
      <div><small>Sucht gerade</small><b>${esc(squadNeeds(w, club).slice(0, 2).map((n) => n.pos).join(', ') || 'nichts Dringendes')}</b><span class="muted">${esc(squadNeeds(w, club)[0]?.reason || 'Kader ist gut besetzt')}</span></div></div>` : ''}
    <div class="grid-2">
      <div><h4>Saisonhistorie</h4>${hist.length ? `<table class="tbl compact"><thead><tr><th>Saison</th><th>Liga</th><th>Platz</th><th>Pkt</th><th>Tore</th><th></th></tr></thead><tbody>
        ${hist.map((h) => `<tr><td>${h.season}/${String((h.season + 1) % 100).padStart(2, '0')}</td><td>${esc(h.league)}</td><td><b>${h.rank}.</b></td><td>${h.pts}</td><td>${h.gf}:${h.ga}</td><td>${h.champion ? '🏆' : ''}${h.moved === 'auf' ? ' ⬆️' : h.moved === 'ab' ? ' ⬇️' : ''}</td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">Die Historie füllt sich mit jeder abgeschlossenen Saison deiner Karriere.</p>'}
        <h4>Transfers</h4>${transfers.length ? `<ul class="cp-list">${transfers.map((x) => `<li>${x.to === club.id ? '⬅️' : '➡️'} <b>${esc(x.name)}</b> ${x.to === club.id ? `von ${esc(w.clubs[x.from]?.short || 'vereinslos')}` : `zu ${esc(w.clubs[x.to]?.short || '?')}`} · ${x.fee ? money(x.fee) : 'ablösefrei'}</li>`).join('')}</ul>` : '<p class="muted">Noch keine Transfers in dieser Karriere.</p>'}</div>
      <div><h4>Stars im Kader</h4><div class="cp-stars">${top.map((p) => `<button class="cp-star" data-pp="${p.id}">${portrait(p, club, 44)}<span>${flag(p.nation)} ${esc(pname(p))}<small>${p.pos} · ${p.age} J.</small></span><b class="${ratingClass(p.ovr)}">${p.ovr}</b></button>`).join('')}</div></div>
    </div></div>`, { wide: true });
  m.el.querySelectorAll('[data-pp]').forEach((b) => (b.onclick = () => { m.close(); onPlayer?.(w.players[b.dataset.pp]); }));
  return m;
}

export function careerHtml(w, p) {
  const rows = [...(p.career || [])].reverse();
  const moves = [...(p.moves || [])].reverse();
  const cur = p.clubId ? w.clubs[p.clubId] : null;
  return `<div class="career"><h4>Karriere</h4>
    <table class="tbl compact"><thead><tr><th>Saison</th><th>Verein</th><th>Spiele</th><th>Tore</th><th>Vorl.</th><th>Stärke</th></tr></thead><tbody>
    ${cur ? `<tr class="me"><td>${w.season}/${String((w.season + 1) % 100).padStart(2, '0')}</td><td>${crest(cur, 16)} ${esc(cur.short)}</td><td>${p.stats.apps}</td><td>${p.stats.goals}</td><td>${p.stats.assists}</td><td>${p.ovr}</td></tr>` : ''}
    ${rows.map((r) => { const c = w.clubs[r.clubId]; return `<tr><td>${r.season}/${String((r.season + 1) % 100).padStart(2, '0')}</td><td>${c ? crest(c, 16) : ''} ${esc(r.club)}${r.part ? ' <small class="muted">(bis Wechsel)</small>' : ''}</td><td>${r.apps}</td><td>${r.goals}</td><td>${r.assists}</td><td>${r.ovr ?? '–'}</td></tr>`; }).join('')}
    </tbody></table>
    ${moves.length ? `<h4>Wechsel</h4><ul class="cp-list">${moves.map((x) => `<li>${x.season}/${String((x.season + 1) % 100).padStart(2, '0')} · ${esc(x.from || 'vereinslos')} → <b>${esc(x.to)}</b> · ${x.fee ? money(x.fee) : 'ablösefrei'}</li>`).join('')}</ul>` : ''}
    <p class="muted">Die Karriere wird ab Saison 2026/27 im Spiel aufgezeichnet.</p></div>`;
}
