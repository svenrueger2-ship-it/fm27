// Career screen: reputation, history, titles, job offers, sacking and the national team job.
import { crest, esc, flag, nationName, money, confirmDialog, toast, pname, ratingClass } from '../dom.js';
import { ensureCareer, repLabel, takeJob, acceptNat, resignNat, natSquad } from '../../manager/career.js';
import { ensureMood } from '../../manager/events.js';
import { newRng } from '../../manager/season.js';
import { nationSquad, nextTournament, nationStrength } from '../../manager/nationals.js';

export function careerScreen(app, el) {
  const w = app.world;
  const draw = () => {
    const C = ensureCareer(w), M = ensureMood(w), club = w.clubs[w.userClubId];
    const sacked = C.pendingSack;
    const offerCard = (o) => { const c = w.clubs[o.clubId], L = w.leagues.find((l) => l.id === c.leagueId); return `<div class="job-card">${crest(c, 44)}<div><b>${esc(c.name)}</b><small class="muted">${esc(L.name)} · Ansehen ${c.rep} · Budget ${money(c.budget)}</small><small>Ziel: <b>${esc(o.goal)}</b> · Gehalt ${money(o.wage)}/Saison</small></div><button class="btn primary sm" data-job="${o.clubId}">Annehmen</button></div>`; };
    const nat = C.nat, nt = nextTournament(w);
    el.innerHTML = `<div class="page"><div class="page-head"><h2>👔 Karriere</h2></div>
      ${sacked ? `<div class="card sack"><h3>🚪 Du wurdest entlassen</h3><p>${esc(w.clubs[sacked.clubId].name)} hat sich von dir getrennt. Diese Vereine wollen dir eine neue Chance geben – wähle deinen neuen Klub:</p><div class="jobs">${C.offers.map(offerCard).join('')}</div></div>` : ''}
      <div class="grid2">
        <div class="card"><h3>Dein Ruf</h3><div class="rep-bar"><i style="width:${C.rep}%"></i></div><p><b>${C.rep}/100</b> · ${repLabel(C.rep)}${C.sacked ? ` · ${C.sacked}× entlassen` : ''}</p>
          <div class="kv"><span>Aktueller Verein</span><b>${crest(club, 18)} ${esc(club.name)}</b></div>
          <div class="kv"><span>Vorstandsziel</span><b>${esc(w.manager?.goal || '–')}</b></div>
          <div class="kv"><span>Vertrauen Vorstand · Fans</span><b class="${M.board < 25 ? 'bad' : ''}">${M.board} · ${M.fans}</b></div>
          ${C.ultimatum ? '<p class="bad"><b>⚠️ Ultimatum des Vorstands läuft!</b></p>' : ''}
          <h4 style="margin-top:12px">Titel (${C.titles.length})</h4>${C.titles.length ? C.titles.map((t) => `<p>🏆 ${esc(t.title)} ${t.season}/${String((t.season + 1) % 100).padStart(2, '0')}${t.clubId != null ? ` · ${esc(w.clubs[t.clubId].short)}` : ''}</p>`).join('') : '<p class="muted">Noch keine Titel.</p>'}
        </div>
        <div class="card"><h3>📞 Jobangebote</h3>${!sacked && C.offers.length ? `<div class="jobs">${C.offers.map(offerCard).join('')}</div><p class="muted small">Ein Wechsel ist sofort möglich. Dein U19-Kader und laufende Verhandlungen bleiben beim alten Verein.</p>` : !sacked ? '<p class="muted">Keine Angebote. Erfolge und ein guter Ruf locken größere Vereine an – meist im Sommer, manchmal auch in der Winterpause.</p>' : ''}
          <h3 style="margin-top:14px">🎽 Nationalmannschaft</h3>
          ${nat ? `<p>Du bist Nationaltrainer von ${flag(nat)} <b>${esc(nationName(nat))}</b> (Stärke ${nationStrength(w, nat)}).${nt ? ` Nächstes Turnier: ${esc(nt.name)}.` : ''}</p><button class="btn sm" id="natpick">Kader nominieren</button> <button class="btn sm ghost" id="natquit">Zurücktreten</button>${(C.natResults || []).map((r) => `<p class="small">• ${esc(r.name)}: ${esc(r.out)}</p>`).join('')}`
            : C.natOffer ? `<p>Der Verband von ${flag(C.natOffer)} <b>${esc(nationName(C.natOffer))}</b> bietet dir den Posten an – zusätzlich zum Verein.</p><button class="btn primary sm" id="natyes">Annehmen</button> <button class="btn sm ghost" id="natno">Ablehnen</button>`
            : '<p class="muted">Mit einem Ruf ab ca. 62 melden sich Nationalverbände (meist im Sommer).</p>'}
        </div>
      </div>
      <div class="card table-wrap"><h3>Stationen & Saisons</h3><table class="tbl compact"><thead><tr><th>Saison</th><th>Verein</th><th>Liga</th><th>Platz</th><th>Ziel</th><th>Titel</th><th>Ruf</th></tr></thead><tbody>
        ${C.seasons.slice().reverse().map((s) => `<tr><td>${s.season}/${String((s.season + 1) % 100).padStart(2, '0')}</td><td>${crest(w.clubs[s.clubId], 16)} ${esc(w.clubs[s.clubId].short)}</td><td>${esc(s.league)}</td><td><b>${s.rank}.</b></td><td class="${s.reached ? 'good' : 'bad'}">${esc(s.goal)} ${s.reached ? '✓' : '✗'}</td><td>${esc(s.titles.join(', ') || '–')}</td><td>${s.rep}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Die erste Saison läuft.</td></tr>'}</tbody></table>
        <p class="muted small">Vereine: ${C.clubs.map((c) => `${esc(w.clubs[c.clubId].short)} (${c.from}${c.to ? `–${c.to}` : '–heute'})`).join(' → ')}</p></div></div>`;
    el.querySelectorAll('[data-job]').forEach((b) => (b.onclick = async () => {
      const c = w.clubs[b.dataset.job];
      if (!sacked && !(await confirmDialog(`Wirklich zu ${c.name} wechseln? ${club.name} verlässt du sofort.`, 'Ja, wechseln'))) return;
      takeJob(w, +b.dataset.job, newRng(w)); app.autosave?.(); toast(`Willkommen bei ${c.name}!`); app.go('home');
    }));
    el.querySelector('#natyes')?.addEventListener('click', () => { acceptNat(w); draw(); });
    el.querySelector('#natno')?.addEventListener('click', () => { C.natOffer = null; draw(); });
    el.querySelector('#natquit')?.addEventListener('click', async () => { if (await confirmDialog('Als Nationaltrainer zurücktreten?')) { resignNat(w); draw(); } });
    el.querySelector('#natpick')?.addEventListener('click', () => natPicker(app, draw));
  };
  draw();
}

function natPicker(app, done) {
  const w = app.world, C = w.career;
  const pool = nationSquad(w, C.nat).concat(Object.values(w.players).filter((p) => p.nation === C.nat && p.clubId != null && !p.youthOf)).filter((p, i, a) => a.indexOf(p) === i).sort((a, b) => b.ovr - a.ovr).slice(0, 45);
  const sel = new Set(natSquad(w).map((p) => p.id));
  const host = document.createElement('div'); host.className = 'modal-wrap';
  const render = () => {
    host.innerHTML = `<div class="modal wide"><h3>${flag(C.nat)} Kader nominieren (${sel.size}/26)</h3><div class="nat-list">${pool.map((p) => `<label class="${sel.has(p.id) ? 'on' : ''}"><input type="checkbox" data-n="${p.id}" ${sel.has(p.id) ? 'checked' : ''}> <b class="${ratingClass(p.ovr)}">${p.ovr}</b> ${p.pos} ${esc(pname(p))} <small class="muted">${p.age} · ${esc(w.clubs[p.clubId].short)}</small></label>`).join('')}</div>
      <div class="row-actions end"><button class="btn ghost" id="np-auto">Automatisch</button><button class="btn primary" id="np-ok">Übernehmen</button></div></div>`;
    host.querySelectorAll('[data-n]').forEach((c) => (c.onchange = () => { const id = +c.dataset.n; if (c.checked && sel.size < 26) sel.add(id); else sel.delete(id); render(); }));
    host.querySelector('#np-auto').onclick = () => { C.natSquad = null; host.remove(); done(); };
    host.querySelector('#np-ok').onclick = () => { C.natSquad = [...sel]; host.remove(); toast('Kader nominiert'); done(); };
  };
  render(); document.body.appendChild(host);
  host.addEventListener('click', (e) => { if (e.target === host) host.remove(); });
}
