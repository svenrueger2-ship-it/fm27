// v5.1: FIFA World Cup 2026 mode – nation picker, hub (next match, group, results), all groups,
// knock-out bracket and the squad. Matches are played in the classic 3D engine (live or instant).
import { crest, esc, toast, modal, confirmDialog, portrait, ratingClass } from '../dom.js';
import { createWM, WM_GROUPS, WM_NATIONS, WM_ROUNDS, wmTable, userFixtureWM, roundFixtures, isPlayed, finishRound, bookWM, shootout, topScorers, wmLevel } from '../../manager/wm.js';
import { WM_LOGOS } from '../../data/wmLogos.js';
import { RNG } from '../../core/rng.js';
import { ensureLineup, teamStrength } from '../../match/tactics.js';
import { POSITIONS } from '../../data/attributes.js';

const logo = (n, s = 34) => `<img class="crest" src="${WM_LOGOS[n]}" width="${s}" height="${s}" alt="${n}" style="object-fit:contain">`;
const nm = (n) => WM_NATIONS[n]?.[0] || n;
const rngOf = (w) => new RNG((w.seed || 1) * 31 + w.wm.round * 977 + Object.keys(w.wm.goals).length * 13);

/** Start screen inside the main menu: pick one of the 48 nations. */
export function wmStartHtml() {
  return `<div class="sv-panel wm-pick"><h2>🏆 WM 2026</h2><p class="muted">Die echte Weltmeisterschaft in USA, Kanada und Mexiko: 48 Teams, Gruppen A–L wie bei der Auslosung. Wähle deine Nation, nominiere 26 Spieler und spiele jedes Spiel live im 3D-Stadion oder sofort.</p>
    <div class="wm-groups">${Object.entries(WM_GROUPS).map(([g, t]) => `<div class="wm-g"><b>Gruppe ${g}</b>${t.map((n) => `<button class="wm-n" data-wmn="${n}">${logo(n, 26)}<span>${esc(nm(n))}</span><small>${wmLevel(n)}</small></button>`).join('')}</div>`).join('')}</div></div>`;
}
export function bindWmStart(app, root) {
  root.querySelectorAll('[data-wmn]').forEach((b) => (b.onclick = async () => {
    root.querySelectorAll('[data-wmn]').forEach((x) => (x.disabled = true));
    b.querySelector('small').textContent = '⏳';
    await new Promise((r) => setTimeout(r, 40));
    const w = createWM(b.dataset.wmn);
    app.world = w; app.pendingWorld = null; app.slot = 'wm';
    await app.save('wm', true);
    app.go('wm');
  }));
}

function fxCard(w, f) {
  const W = w.wm, H = w.clubs[W.ids[f.h]], A = w.clubs[W.ids[f.a]];
  return `<div class="wm-fx">${logo(f.h, 64)}<div><small class="muted">${esc(WM_ROUNDS[W.round])}${f.group ? ` · Gruppe ${f.group}` : ''} · ${esc(H.stadium.name)}</small><h3>${esc(nm(f.h))} – ${esc(nm(f.a))}</h3><small>Stärke ${Math.round(teamStrength(H, w.players))} : ${Math.round(teamStrength(A, w.players))}</small></div>${logo(f.a, 64)}</div>`;
}
function tableHtml(w, g, me) {
  const T = wmTable(w, g);
  return `<table class="tbl compact wm-tab"><thead><tr><th>#</th><th>Gruppe ${g}</th><th>Sp</th><th>Tore</th><th>Pkt</th></tr></thead><tbody>${T.map((r, i) => `<tr class="${r.nat === me ? 'me' : ''} ${i < 2 ? 'z-up' : i === 2 ? 'z-po' : ''}"><td>${i + 1}</td><td class="nm">${logo(r.nat, 18)} ${esc(nm(r.nat))}</td><td>${r.p}</td><td>${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table>`;
}
const resLine = (m) => `<p class="wm-res">${logo(m.h, 18)} ${esc(nm(m.h))} <b>${m.hg}:${m.ag}</b>${m.note ? `<small>${esc(m.note)}</small>` : ''} ${esc(nm(m.a))} ${logo(m.a, 18)}</p>`;

/** Hub: next match, own group, own results, actions. */
export function wmScreen(app, el) {
  const w = app.world, W = w.wm, me = W.nat;
  const f = userFixtureWM(w);
  const played = f && isPlayed(w, f);
  const myGames = [...Object.values(W.groups).flatMap((G) => G.games), ...W.ko.flatMap((k) => k.ties.filter((t) => t.winner))].filter((m) => m.h === me || m.a === me);
  const myGroup = Object.keys(W.groups).find((g) => W.groups[g].teams.includes(me));
  el.innerHTML = `<div class="page">
    ${W.done ? `<div class="card wm-champ">${logo(W.champion, 96)}<div><small class="muted">FIFA Weltmeisterschaft 2026</small><h2>${W.champion === me ? '🏆 WELTMEISTER!' : `${esc(nm(W.champion))} ist Weltmeister`}</h2><p>Finale gegen ${esc(nm(W.runnerUp))}${W.champion !== me ? ` · ${esc(nm(me))}: ${esc(W.out || 'Finale')}` : ''}</p><button class="btn primary" id="wm-new">Neue WM starten</button></div></div>` : ''}
    ${!W.done && f ? `<div class="card wm-next">${fxCard(w, f)}<div class="row-actions center">
        ${played ? '<button class="btn primary lg" id="wm-sim">⏭ Weiter zur nächsten Runde</button>' : `<button class="btn primary lg" id="wm-3d">▶ Live im 3D-Stadion</button><button class="btn lg" id="wm-inst">⏭ Sofortsimulation</button><button class="btn lg ghost" id="wm-tac">📋 Taktik & Aufstellung</button>`}</div></div>` : ''}
    ${!W.done && !f ? `<div class="card md-gate"><h3>${W.out ? `${esc(nm(me))} ist ausgeschieden (${esc(W.out)})` : 'Spielfrei'}</h3><p class="muted">Die WM läuft weiter – schau dir an, wer Weltmeister wird.</p><div class="row-actions center"><button class="btn primary lg" id="wm-round">⏭ Nächste Runde simulieren</button><button class="btn lg" id="wm-all">⏩ Bis zum Finale</button></div></div>` : ''}
    <div class="grid-2">
      <div class="card">${myGroup ? tableHtml(w, myGroup, me) : ''}<p class="muted small">Die ersten zwei jeder Gruppe und die acht besten Gruppendritten erreichen das Sechzehntelfinale.</p></div>
      <div class="card"><h3>${logo(me, 22)} Spiele von ${esc(nm(me))}</h3>${myGames.map(resLine).join('') || '<p class="muted">Noch kein Spiel.</p>'}
        <h4>⚽ Torjäger</h4>${topScorers(w, 5).map((x) => `<p class="small">${logo(x.p.nation, 16)} ${esc(x.p.firstName)} ${esc(x.p.lastName)} <b>${x.g}</b></p>`).join('') || '<p class="muted small">–</p>'}</div>
    </div></div>`;
  const play = (mode) => app.go('match', { friendly: true, home: W.ids[f.h], away: W.ids[f.a], wm: { ...f }, mode });
  el.querySelector('#wm-3d')?.addEventListener('click', () => play('3d'));
  el.querySelector('#wm-inst')?.addEventListener('click', () => play('instant'));
  el.querySelector('#wm-tac')?.addEventListener('click', () => app.go('tactics'));
  const next = async (all) => { do finishRound(w, rngOf(w)); while (all && !W.done && !userFixtureWM(w)); await app.save('wm', true); app.go('wm'); };
  el.querySelector('#wm-sim')?.addEventListener('click', () => next(false));
  el.querySelector('#wm-round')?.addEventListener('click', () => next(false));
  el.querySelector('#wm-all')?.addEventListener('click', () => next(true));
  el.querySelector('#wm-new')?.addEventListener('click', () => { app.world = null; app.go('start', { wm: true }); });
}

export function wmGroupsScreen(app, el) {
  const w = app.world, W = w.wm;
  const roundRes = W.round <= 3 ? Object.values(W.groups).flatMap((G) => G.games) : [];
  el.innerHTML = `<div class="page"><div class="page-head"><h2>Gruppen</h2><span class="chip">${esc(WM_ROUNDS[Math.min(W.round, 7)])}</span></div>
    <div class="wm-tables">${Object.keys(W.groups).map((g) => `<div class="card">${tableHtml(w, g, W.nat)}</div>`).join('')}</div>
    ${W.thirds ? `<div class="card"><h3>Gruppendritte</h3>${W.thirds.map((r, i) => `<p class="small ${i < 8 ? 'good' : 'bad'}">${i + 1}. ${logo(r.nat, 16)} ${esc(nm(r.nat))} (Gr. ${r.group}) · ${r.pts} Pkt · ${r.gf}:${r.ga}</p>`).join('')}</div>` : ''}
    ${roundRes.length ? `<div class="card"><h3>Alle Gruppenspiele</h3><div class="wm-reslist">${roundRes.map(resLine).join('')}</div></div>` : ''}</div>`;
}

export function wmKoScreen(app, el) {
  const w = app.world, W = w.wm;
  el.innerHTML = `<div class="page"><div class="page-head"><h2>K.-o.-Runde</h2></div>
    ${W.ko.length ? `<div class="wm-bracket">${W.ko.map((k) => `<div class="wm-col"><h4>${esc(k.name)}</h4>${k.ties.map((t) => `<div class="wm-tie ${t.h === W.nat || t.a === W.nat ? 'me' : ''}"><span class="${t.winner === t.h ? 'win' : ''}">${logo(t.h, 18)} ${esc(t.h)}</span><b>${t.winner ? `${t.hg}:${t.ag}` : '–'}</b><span class="${t.winner === t.a ? 'win' : ''}">${esc(t.a)} ${logo(t.a, 18)}</span>${t.note ? `<small>${esc(t.note)}</small>` : ''}</div>`).join('')}</div>`).join('')}
      ${W.done ? `<div class="wm-col"><h4>🏆 Weltmeister</h4><div class="wm-tie me">${logo(W.champion, 40)} <b>${esc(nm(W.champion))}</b></div></div>` : ''}</div>`
      : '<div class="card"><p class="muted">Die K.-o.-Runde beginnt nach dem 3. Gruppenspieltag mit dem Sechzehntelfinale (32 Teams).</p></div>'}</div>`;
}

export function wmSquadScreen(app, el) {
  const w = app.world, W = w.wm, club = app.club;
  const sq = club.squad.map((id) => w.players[id]).filter(Boolean).sort((a, b) => (POSITIONS[a.pos]?.order ?? 0) - (POSITIONS[b.pos]?.order ?? 0) || b.ovr - a.ovr);
  // the rest of the nation's players in the game – can be nominated instead
  const pool = Object.values(w.players).filter((p) => p.nation === W.nat && !club.squad.includes(p.id) && p.clubId != null && !p.youthOf).sort((a, b) => b.ovr - a.ovr).slice(0, 30);
  el.innerHTML = `<div class="page"><div class="page-head"><h2>${logo(W.nat, 30)} WM-Kader ${esc(nm(W.nat))} · ${sq.length}</h2></div>
    <div class="grid-2"><div class="card table-wrap"><h3>Nominiert</h3><table class="tbl"><tbody>${sq.map((p) => `<tr><td>${p.wmNumber || ''}</td><td class="nm">${portrait(p, club, 24)}<span>${esc(p.firstName)} ${esc(p.lastName)}${p.wmOnly ? ' <i class="tag">WM</i>' : ''}</span></td><td>${p.pos}</td><td><b class="${ratingClass(p.ovr)}">${p.ovr}</b></td><td>${p.club || (w.clubs[p.clubId] && !w.clubs[p.clubId].national ? esc(w.clubs[p.clubId].short) : '')}</td><td>${W.round === 0 && !W.groups.A.games.length ? `<button class="btn sm ghost" data-out="${p.id}">✕</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
    <div class="card table-wrap"><h3>Weitere Kandidaten</h3>${W.round === 0 && !W.groups.A.games.length ? '<p class="muted small">Vor dem ersten Spiel kannst du tauschen: erst einen Spieler streichen, dann nachnominieren (max. 26).</p>' : '<p class="muted small">Der Kader ist nach dem Turnierstart fest.</p>'}
      <table class="tbl"><tbody>${pool.map((p) => `<tr><td class="nm">${portrait(p, w.clubs[p.clubId], 24)}<span>${esc(p.firstName)} ${esc(p.lastName)}</span></td><td>${p.pos}</td><td><b class="${ratingClass(p.ovr)}">${p.ovr}</b></td><td>${esc(w.clubs[p.clubId]?.short || '')}</td><td>${W.round === 0 && !W.groups.A.games.length && sq.length < 26 ? `<button class="btn sm" data-in="${p.id}">+</button>` : ''}</td></tr>`).join('') || '<tr><td class="muted">Keine weiteren Spieler dieser Nation in den Ligen des Spiels.</td></tr>'}</tbody></table></div></div></div>`;
  el.querySelectorAll('[data-out]').forEach((b) => (b.onclick = () => { if (club.squad.length <= 18) return toast('Mindestens 18 Spieler'); club.squad = club.squad.filter((id) => id !== +b.dataset.out); club.lineup = null; ensureLineup(club, w.players); app.go('wmSquad'); }));
  el.querySelectorAll('[data-in]').forEach((b) => (b.onclick = () => { if (club.squad.length >= 26) return; club.squad.push(+b.dataset.in); club.lineup = null; ensureLineup(club, w.players); app.go('wmSquad'); }));
}

/** Books the user's live/instant match; knock-out draws go to a penalty shoot-out. */
export async function wmCommit(app, r, f) {
  const w = app.world, W = w.wm, rng = rngOf(w);
  const sideNat = (side) => (side === 'h' ? f.h : f.a);
  const scorers = (r.events || []).filter((e) => e.type === 'goal' && !e.own && e.player != null).map((e) => e.player);
  let res = { hg: r.hg, ag: r.ag, note: '', winner: r.hg > r.ag ? f.h : r.hg < r.ag ? f.a : null, scorers };
  if (!f.group && r.hg === r.ag) {
    const s = shootout(w, rng, f.h, f.a);
    res = { ...res, note: ` n. V., ${s.x}:${s.y} i. E.`, winner: s.winner };
    await new Promise((ok) => { const m = modal(`<div class="confirm-club"><div style="font-size:3rem">🥅</div><h3>Elfmeterschießen</h3><p>${logo(f.h, 40)} <b style="font-size:2rem">${s.x} : ${s.y}</b> ${logo(f.a, 40)}</p><p><b>${esc(nm(s.winner))}</b> ist weiter!</p><button class="btn primary" id="ok">Weiter</button></div>`, { onClose: ok }); m.el.querySelector('#ok').onclick = () => m.close(); });
  }
  void sideNat;
  bookWM(w, f, res);
  finishRound(w, rng);
  if (W.done) toast(W.champion === W.nat ? '🏆 WELTMEISTER!' : `${nm(W.champion)} ist Weltmeister`);
  await app.save('wm', true);
  app.go('wm');
}

export const confirmQuit = (app) => confirmDialog('WM verlassen? Der Stand ist gespeichert (Spielstand „WM“).', 'Zum Hauptmenü').then((ok) => { if (ok) { app.world = null; app.go('start'); } });
