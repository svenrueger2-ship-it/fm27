// Cup overview: national cups and European competitions with all rounds and results.
import { crest, esc, money } from '../dom.js';
import { userCupStatus, groupTable } from '../../manager/cups.js';

export function cupsScreen(app, el) {
  const w = app.world;
  const cups = w.cups || [];
  const mine = userCupStatus(w);
  let tab = app.cupTab || mine[0]?.cup.id || cups[0]?.id;
  const draw = () => {
    app.cupTab = tab;
    const c = cups.find((x) => x.id === tab) || cups[0];
    if (!c) { el.innerHTML = '<div class="page"><div class="card"><p class="muted">Die Wettbewerbe starten mit dem ersten Spieltag.</p></div></div>'; return; }
    const tieHtml = (t, rd) => {
      if (t.bye) return `<div class="tie bye"><span>${crest(w.clubs[t.a], 18)} ${esc(w.clubs[t.a].short)}</span><small>Freilos</small></div>`;
      const A = w.clubs[t.a], B = w.clubs[t.b];
      const me = t.a === w.userClubId || t.b === w.userClubId;
      const legs = t.fixtures.map((f) => (f.hg == null ? `<small>Woche ${f.week + 1}</small>` : `<b>${f.h === t.a ? `${f.hg}:${f.ag}` : `${f.ag}:${f.hg}`}</b>`)).join(rd.weeks.length > 1 ? ' · ' : '');
      return `<div class="tie ${me ? 'me' : ''}"><span class="${t.winner === t.a ? 'win' : t.winner ? 'lose' : ''}">${crest(A, 18)} ${esc(A.short)}</span><em>${legs}${t.note ? `<small>${esc(t.note.trim())}</small>` : ''}</em><span class="r ${t.winner === t.b ? 'win' : t.winner ? 'lose' : ''}">${esc(B.short)} ${crest(B, 18)}</span></div>`;
    };
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🏆 Pokale & Europa</h2></div>
      ${mine.length ? `<div class="cup-mine">${mine.map((s) => `<div class="cm ${s.won ? 'won' : s.alive ? 'alive' : 'out'}"><b>${esc(s.cup.name)}</b><span>${s.won ? '🏆 Sieger!' : s.alive ? `noch dabei · ${esc(s.round)}` : 'ausgeschieden'}</span></div>`).join('')}</div>` : '<p class="muted">Dein Verein ist in dieser Saison in keinem Pokal vertreten.</p>'}
      <div class="tabs wrap">${cups.map((x) => `<button data-c="${x.id}" class="${x.id === c.id ? 'active' : ''}">${esc(x.name)}</button>`).join('')}</div>
      <div class="card"><h3>${esc(c.name)} ${c.season}/${String((c.season + 1) % 100).padStart(2, '0')}${c.winner ? ` · Sieger: ${crest(w.clubs[c.winner], 22)} ${esc(w.clubs[c.winner].name)}` : ''}</h3>
        <p class="muted">${c.rounds[0].group ? '8 Gruppen à 4 Teams, die ersten zwei kommen ins Achtelfinale. ' : ''}${c.type === 'euro' ? 'K.-o.-Runden mit Hin- und Rückspiel, Finale auf neutralem Platz. Keine Auswärtstorregel.' : `Einzelspiele mit Verlängerung und Elfmeterschießen${c.lowerHome ? ', der klassentiefere Verein hat Heimrecht' : ''}.`} Prämien: ${(c.prize || []).filter((p) => p > 0).map((p) => money(p)).join(' → ')}</p>
        ${c.rounds[0].group ? `<h4 style="margin-top:12px">Gruppenphase${c.rounds[0].done ? ' (beendet)' : ''}</h4><div class="groups">${c.rounds[0].groups.map((g) => `<div class="grp ${g.ids.includes(w.userClubId) ? 'me' : ''}"><b>Gruppe ${g.name}</b><table class="tbl compact"><tbody>${groupTable(w, g).map((r, i) => `<tr class="${i < 2 ? 'q' : ''} ${r.id === w.userClubId ? 'me' : ''}"><td>${i + 1}</td><td>${crest(w.clubs[r.id], 16)} ${esc(w.clubs[r.id].short)}</td><td>${r.p}</td><td>${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div>`).join('')}</div>` : ''}
        <div class="bracket">${c.rounds.filter((rd) => !rd.group).slice().reverse().map((rd) => `<div class="round"><h4>${esc(rd.name)}</h4>${rd.ties.filter((t) => !t.bye || rd === c.rounds[0]).sort((x, y) => ((y.a === w.userClubId || y.b === w.userClubId) - (x.a === w.userClubId || x.b === w.userClubId))).map((t) => tieHtml(t, rd)).join('')}</div>`).join('')}</div>
      </div>
      ${(w.cupHistory || []).length ? `<div class="card"><h3>📜 Frühere Sieger</h3>${w.cupHistory.slice().reverse().map((h) => `<p><b>${h.season}/${String((h.season + 1) % 100).padStart(2, '0')}</b> · ${h.cups.filter((x) => x.winner != null).map((x) => `${esc(x.name)}: ${esc(w.clubs[x.winner]?.short || '?')}`).join(' · ')}</p>`).join('')}</div>` : ''}
    </div>`;
    el.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { tab = b.dataset.c; draw(); }));
  };
  draw();
}
