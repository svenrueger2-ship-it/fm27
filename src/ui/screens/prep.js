// v6.0 Saisonvorbereitung screen: camp, tour, friendlies (live in 3D or simulated).
import { esc, money, toast, crest, confirmDialog } from '../dom.js';
import { CAMPS, TOURS, MAX_FRIENDLIES, prepOpen, ensurePrep, bookCamp, bookTour, tourIncome, friendlyOptions, simFriendly, recordFriendly } from '../../manager/preseason.js';
import { newRng } from '../../manager/season.js';

export function prepScreen(app, el) {
  const w = app.world, club = app.club;
  const draw = () => {
    if (!prepOpen(w)) {
      el.innerHTML = `<div class="page"><div class="page-head"><h2>☀️ Saisonvorbereitung</h2></div><div class="card"><p class="muted">Die Vorbereitung ist vorbei – die Saison läuft. Im nächsten Sommer geht es wieder ins Trainingslager.</p>${summary(w, club)}</div></div>`;
      return;
    }
    const P = ensurePrep(w);
    const opts = friendlyOptions(w, club);
    el.innerHTML = `<div class="page"><div class="page-head"><h2>☀️ Saisonvorbereitung ${w.season}/${String((w.season + 1) % 100).padStart(2, '0')}</h2><div class="row-actions"><span class="muted">Kontostand ${money(club.budget)}</span></div></div>
      <p class="muted">Bevor der erste Spieltag angepfiffen wird: Trainingslager buchen, auf Reisen gehen, Testspiele planen. Alles ist freiwillig – wer gar nichts macht, startet ohne Bonus.</p>
      <div class="grid-2">
        <div class="card"><h3>⛺ Trainingslager ${P.camp ? '✓' : ''}</h3>
          ${CAMPS.map((c) => `<div class="facility ${P.camp === c.id ? 'picked' : ''}"><div><b>${esc(c.name)}</b> <small class="muted">${esc(c.place)}</small><br><small class="muted">${esc(c.desc)} · Vertrautheit +${Math.round(c.fam * 100)} % · Teamgeist +${c.spirit} · Fitness +${c.fit}</small></div>
            ${P.camp ? (P.camp === c.id ? '<span class="good">Gebucht</span>' : '') : `<button class="btn sm primary" data-camp="${c.id}" ${club.budget < c.cost ? 'disabled' : ''}>${money(c.cost)}</button>`}</div>`).join('')}</div>
        <div class="card"><h3>✈️ Reise & Vermarktung ${P.tour ? '✓' : ''}</h3>
          ${TOURS.map((t) => { const ok = (club.rep || 0) >= t.minRep; return `<div class="facility ${P.tour === t.id ? 'picked' : ''}"><div><b>${esc(t.name)}</b><br><small class="muted">${esc(t.desc)}${t.income ? ` · Einnahmen ca. ${money(tourIncome(club, t))} · Fitness ${t.fit}` : ''}${!ok ? ` · ab Ruf ${t.minRep}` : ''}</small></div>
            ${P.tour ? (P.tour === t.id ? '<span class="good">Geplant</span>' : '') : `<button class="btn sm ${t.id === 'none' ? '' : 'primary'}" data-tour="${t.id}" ${ok ? '' : 'disabled'}>${t.id === 'none' ? 'Daheim bleiben' : 'Buchen'}</button>`}</div>`; }).join('')}</div>
      </div>
      <div class="card"><h3>🤝 Testspiele (${P.friendlies.length}/${MAX_FRIENDLIES})</h3>
        ${P.friendlies.length ? `<div class="prep-res">${P.friendlies.map((f) => { const o = w.clubs[f.opp]; return `<span class="chip">${crest(club, 16)} ${f.hg}:${f.ag} ${crest(o, 16)} ${esc(o.short)}</span>`; }).join('')}</div>` : ''}
        ${P.friendlies.length < MAX_FRIENDLIES ? `<p class="muted small">Jedes Testspiel bringt Vertrautheit (+2 %) und Zuschauereinnahmen. Ergebnisse zählen nicht für die Statistik.</p>
        <div class="prep-opp">${opts.map((o) => `<div class="prep-card">${crest(o, 44)}<b>${esc(o.name)}</b><small class="muted">${esc(w.leagues.find((l) => l.id === o.leagueId)?.name || '')}</small><div class="row-actions"><button class="btn sm primary" data-live="${o.id}">▶ Live</button><button class="btn sm" data-sim="${o.id}">⏭ Simulieren</button></div></div>`).join('')}</div>` : '<p class="good">Testspielprogramm komplett.</p>'}
      </div>
      <div class="row-actions end"><button class="btn primary lg" id="prep-done">Vorbereitung abschließen → Spieltag 1</button></div></div>`;
    el.querySelectorAll('[data-camp]').forEach((b) => (b.onclick = async () => { const c = CAMPS.find((x) => x.id === b.dataset.camp); if (!(await confirmDialog(`${c.name} für ${money(c.cost)} buchen?`, 'Buchen'))) return; const r = bookCamp(w, club, c.id); toast(r.ok ? 'Trainingslager gebucht' : r.msg); draw(); }));
    el.querySelectorAll('[data-tour]').forEach((b) => (b.onclick = () => { const r = bookTour(w, club, b.dataset.tour, newRng(w)); toast(r.ok ? (r.income ? `Tour gebucht: +${money(r.income)}${r.hurt?.length ? ` · ${r.hurt.length} Verletzte` : ''}` : 'Ihr bleibt zu Hause') : r.msg); draw(); }));
    el.querySelectorAll('[data-sim]').forEach((b) => (b.onclick = () => { const o = w.clubs[+b.dataset.sim]; const r = simFriendly(w, club, o, newRng(w)); recordFriendly(w, club, o, r.hg, r.ag); toast(`Testspiel: ${club.short} ${r.hg}:${r.ag} ${o.short}`); draw(); }));
    el.querySelectorAll('[data-live]').forEach((b) => (b.onclick = () => app.go('match', { friendly: true, home: club.id, away: +b.dataset.live, mode: '3d', prep: true })));
    el.querySelector('#prep-done').onclick = () => { ensurePrep(w).closed = true; app.go('matchday'); };
  };
  draw();
}

function summary(w, club) {
  const P = w.prep; if (!P || P.season !== w.season) return '';
  const c = CAMPS.find((x) => x.id === P.camp), t = TOURS.find((x) => x.id === P.tour);
  return `<p>${c ? `⛺ ${esc(c.name)}` : '⛺ Kein Trainingslager'} · ${t && t.id !== 'none' ? `✈️ ${esc(t.name)}` : '✈️ Keine Reise'} · 🤝 ${P.friendlies.length} Testspiel(e)</p>`;
}
