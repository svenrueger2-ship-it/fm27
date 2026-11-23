import { isMatchToday, daysToMatch } from '../../manager/calendar.js';
import { mgrPortrait } from './managerCreate.js';
import { styleOf, STYLES } from '../../data/styles.js';
import { anaSummary, heatSvg } from '../../manager/playerAna.js';
// Club HQ dashboard, squad (cards & table), player profile, league tables & fixtures.
import { projectPlayer, projectionSvg } from '../../manager/projection.js';
import { computeTable, userLeague, userFixture, isUserSeasonOver } from '../../manager/season.js';
import { teamStrength, ensureLineup } from '../../match/tactics.js';
import { OUTFIELD_ATTRS, GK_ATTRS, POSITIONS, POS_ORDER } from '../../data/attributes.js';
import { estimate, knowledge, windowInfo } from '../../manager/transfers.js';
import { crest, esc, money, flag, nationName, pname, shortName, ratingClass, portrait, bar, modal, toast, confirmDialog } from '../dom.js';
import { transferActions } from './transfers.js';

function sparkline(values, w = 300, h = 60) {
  if (values.length < 2) return '<p class="muted">Noch keine Daten – die Kurve füllt sich mit jedem Spieltag.</p>';
  const min = Math.min(...values), max = Math.max(...values), r = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 6 - ((v - min) / r) * (h - 12)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3dffa0" stop-opacity=".45"/><stop offset="1" stop-color="#3dffa0" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L ${w} ${h} L 0 ${h} Z" fill="url(#sg)"/><path d="${d}" fill="none" stroke="#3dffa0" stroke-width="2.5"/></svg>`;
}

import { clubModal, careerHtml } from './clubProfile.js';
import { PROMO_RULES, newRng } from '../../manager/season.js';
import { userCupFixture, cupById } from '../../manager/cups.js';
import { isDirector, coachCandidates, hireCoach } from '../../manager/director.js';
import { ensureMood, ensureSponsors, resolveEvent, isDeadlineDay } from '../../manager/events.js';

export function dashboardScreen(app, el) {
  const w = app.world, club = app.club;
  const L = userLeague(w);
  const table = computeTable(L);
  const rank = table.findIndex((r) => r.id === club.id) + 1;
  const row = table[rank - 1];
  const fx = userCupFixture(w) || userFixture(w);
  const players = club.squad.map((id) => w.players[id]);
  const injured = players.filter((p) => p.injury > 0), susp = players.filter((p) => p.suspension > 0);
  const str = Math.round(teamStrength(club, w.players));
  const around = table.slice(Math.max(0, rank - 3), Math.max(0, rank - 3) + 5);
  const H = fx ? w.clubs[fx.h] : null, A = fx ? w.clubs[fx.a] : null;
  const opp = fx ? (fx.h === club.id ? A : H) : null;
  const top = [...players].sort((a, b) => b.stats.goals * 3 + b.ovr - (a.stats.goals * 3 + a.ovr)).slice(0, 4);
  const hist = (club.finance?.history || []).filter((h) => h.season === w.season).map((h) => h.balance);
  const win = windowInfo(w);
  const mood = ensureMood(w); ensureSponsors(w, club);
  const rum = (w.rumours || []).slice(0, 6);
  const meter = (v) => `<div class="meter mood"><i style="width:${v}%;background:${v < 30 ? '#ff4d6a' : v < 55 ? '#ffd24a' : '#3ddc84'}"></i></div>`;
  const moodTxt = (v) => (v >= 80 ? 'begeistert' : v >= 60 ? 'zufrieden' : v >= 40 ? 'abwartend' : v >= 20 ? 'unruhig' : 'wütend');
  const sc = w.scenario && !w.scenario.done ? w.scenario : null;
  el.innerHTML = `<div class="page">
    ${sc ? `<div class="scenario-bar"><span>🎬</span><div class="grow"><small class="muted">SZENARIO · ${esc(sc.name)}</small><b>Ziel: ${esc(sc.goal)}</b></div><div><small class="muted">Aktuell</small><b>Platz ${rank}</b></div><div><small class="muted">Spiele übrig</small><b>${Math.max(0, L.fixtures.length - w.week)}</b></div>${sc.id === 'pleite' ? `<div><small class="muted">Kontostand</small><b class="${club.budget >= 0 ? 'good' : 'bad'}">${money(club.budget)}</b></div>` : ''}</div>` : ''}
    ${isDeadlineDay(win) ? `<div class="deadline"><b>⏰ DEADLINE DAY</b><span>Das ${esc(win.name)} schließt nach diesem Spieltag. Die Gerüchteküche brodelt – letzte Chance für Transfers!</span><button class="btn sm primary" data-nav2="transfers">Zum Transfermarkt</button></div>` : ''}
    <div class="grid-2">
      <div class="card club-hero" style="--c1:${club.colors.primary}">
        <div class="wm">${crest(club, 300)}</div>
        ${crest(club, 92)}<div style="position:relative"><small style="letter-spacing:.2em;text-transform:uppercase;color:#fff;opacity:.8">${esc(L.name)} · Saison ${w.season}/${String((w.season + 1) % 100).padStart(2, '0')}</small><h2>${esc(club.name)}</h2>
        <p>🏟️ ${esc(club.stadium.name)} · ${club.stadium.capacity.toLocaleString('de-DE')} Plätze</p>
        <div class="kpis"><div><small>Tabelle</small><b>${rank}.</b></div><div><small>Teamstärke</small><b class="${ratingClass(str)}">${str}</b></div><div><small>Punkte</small><b>${row?.pts ?? 0}</b></div><div><small>Vertrautheit</small><b>${Math.round((club.familiarity ?? 0.7) * 100)}%</b></div></div>
        <p class="muted hero-mgr" style="color:#d8e4fa">${w.manager?.looks ? `<span class="linkish" id="to-prof">${mgrPortrait(w, 30)}</span>` : ''}${isDirector(w) ? `Sportdirektor · Trainer: ${esc(w.coach?.name || '–')}` : `Manager: ${esc(w.manager?.name && w.manager.name !== 'Manager' ? w.manager.name : 'Du')}`} · Vorstandsziel: <b>${esc(w.manager?.goal || '–')}</b></p>
        <button class="btn sm" id="club-hist">📜 Vereinsprofil & Historie</button></div>
      </div>
      <div class="card next-match" style="--h1:${H?.colors.primary || '#333'};--a1:${A?.colors.primary || '#333'}">
        <div class="matchday-strip"></div>
        <h3>⚽ Nächstes Spiel</h3>
        ${fx ? `<div class="vs"><div>${crest(H, 64)}<strong>${esc(H.short)}</strong><small>${esc(H.name)}</small></div><div class="mid">VS</div><div>${crest(A, 64)}<strong>${esc(A.short)}</strong><small>${esc(A.name)}</small></div></div>
          <div class="chips"><span class="chip">${fx.cup ? `🏆 ${esc(cupById(w, fx.cup).name)} · ${esc(fx.group ? `Gruppe ${fx.group}` : cupById(w, fx.cup).rounds[fx.round].name)}` : `${esc(L.name)} · Spieltag ${w.week + 1}`}</span><span class="chip">${fx.h === club.id ? '🏠 Heimspiel' : '✈️ Auswärts'}</span><span class="chip">${table.some((r) => r.id === opp.id) ? `Gegner Platz ${table.findIndex((r) => r.id === opp.id) + 1}` : `Gegner aus ${esc(w.leagues.find((l) => l.id === opp.leagueId)?.name || '')}`} · Stärke ${Math.round(teamStrength(opp, w.players))}</span></div>
          <div class="row-actions center"><button class="btn primary lg" id="go-md">${isMatchToday(w) ? 'Zum Spieltag ▶' : `📅 Noch ${daysToMatch(w) ?? '–'} Tag(e) · Kalender ▶`}</button></div>`
          : isUserSeasonOver(w) ? `<p>Alle Saisonspiele sind absolviert.</p><button class="btn primary" id="go-end">Saison abschließen</button>` : '<p>Spielfrei an diesem Spieltag.</p><button class="btn primary" id="go-md">Spieltag simulieren</button>'}
      </div>
    </div>
    <div class="grid-4">
      <div class="card"><h3>📈 Kontostand</h3><b style="font-family:var(--display);font-size:1.8rem">${money(club.budget)}</b>${sparkline(hist)}<button class="btn ghost sm" data-nav2="finance">Finanzen →</button></div>
      <div class="card"><h3>🏆 Tabelle</h3><table class="tbl compact"><tbody>${around.map((r) => {
        const i = table.indexOf(r) + 1; const c = w.clubs[r.id];
        return `<tr class="${c.id === club.id ? 'me' : ''}"><td>${i}</td><td>${crest(c, 18)} ${esc(c.short)}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`;
      }).join('')}</tbody></table><button class="btn ghost sm" data-nav2="league">Ganze Tabelle →</button></div>
      <div class="card"><h3>🩺 Kaderstatus</h3>
        <p>${injured.length ? injured.map((p) => `🩹 ${esc(shortName(p))} (${p.injury} Wo.)`).join('<br>') : '✅ Keine Verletzten'}</p>
        <p>${susp.length ? susp.map((p) => `🟥 ${esc(shortName(p))} gesperrt`).join('<br>') : '✅ Keine Sperren'}</p>
        <p class="muted">${win.open ? `🔓 ${win.name}: noch ${win.closesIn} Woche(n)` : `🔒 Transferfenster öffnet in ${win.opensIn} Woche(n)`}</p>
        ${w.transfer?.offers?.length ? `<button class="btn sm" data-nav2="transfers">📨 ${w.transfer.offers.length} Angebot(e) prüfen</button>` : ''}</div>
      <div class="card"><h3>⭐ Schlüsselspieler</h3>${top.map((p) => `<div class="mini-player" data-p="${p.id}">${portrait(p, club, 36)}<span>${esc(shortName(p))}<br><small>${p.pos} · ${p.stats.goals} Tore · ${p.stats.assists} Vorl.</small></span><b class="${ratingClass(p.ovr)}" style="font-family:var(--display);font-size:1.4rem">${p.ovr}</b></div>`).join('')}</div>
    </div>
    <div class="grid-2">
      <div class="card"><h3>🧭 Stimmung im Verein</h3>
        <div class="kv"><span>Vorstand</span><b>${mood.board} · ${moodTxt(mood.board)}</b></div>${meter(mood.board)}
        <div class="kv"><span>Fans</span><b>${mood.fans} · ${moodTxt(mood.fans)}</b></div>${meter(mood.fans)}
        <p class="muted">Ergebnisse, Antworten auf Pressekonferenzen und deine Entscheidungen bei Ereignissen beeinflussen die Stimmung.</p>
        ${w.pendingEvent ? '<button class="btn sm primary" id="open-ev">❗ Offene Entscheidung</button>' : ''}</div>
      ${isDirector(w) && w.coach ? `<div class="card"><h3>👔 Cheftrainer</h3><div class="kv"><span>${esc(w.coach.name)}</span><b>${'★'.repeat(w.coach.quality)}${'☆'.repeat(5 - w.coach.quality)}</b></div>
        <div class="kv"><span>Spielstil</span><b>${esc(w.coach.style)} · ${esc(w.coach.formation)}</b></div>
        <div class="kv"><span>Bilanz</span><b>${w.coach.games} Spiele · ${w.coach.games ? (w.coach.pts / w.coach.games).toFixed(2).replace('.', ',') : '–'} Punkte/Spiel</b></div>
        <div class="kv"><span>Gehalt</span><b>${money(w.coach.wage)}/Saison · ${w.coach.years} J.</b></div>
        <button class="btn sm" id="coach">Trainer wechseln …</button></div>` : ''}
      <div class="card"><h3>📨 Posteingang vom Stab</h3>${(() => { const ib = openInbox(w); return ib.length ? ib.slice(0, 3).map((x) => `<p class="small">• ${esc(x.title)}</p>`).join('') + `<button class="btn sm primary" data-nav2="staff">${ib.length} Vorschlag${ib.length > 1 ? 'e' : ''} ansehen →</button>` : `<p class="muted">Nichts zu entscheiden. Dein Stab kümmert sich${w.staff ? ` um ${Object.values(w.staff.delegate).filter((m) => m === 'auto').length} Bereiche automatisch` : ''}.</p><button class="btn sm ghost" data-nav2="staff">Stab & Delegation →</button>`; })()}</div>
      <div class="card"><h3>🗞️ Gerüchteküche</h3>${rum.length ? `<div class="rumours">${rum.map((r) => `<div class="rum"><span><b>${esc(r.name)}</b> ${w.clubs[r.from] ? `(${esc(w.clubs[r.from].short)})` : ''} → ${esc(w.clubs[r.to]?.short || '?')}</span><small>${esc(r.source)} · Glaubwürdigkeit ${'●'.repeat(Math.round(r.reliability * 5))}${'○'.repeat(5 - Math.round(r.reliability * 5))} · ${esc(r.status)}</small></div>`).join('')}</div>` : '<p class="muted">Gerüchte gibt es, sobald ein Transferfenster geöffnet ist.</p>'}</div>
    </div>
    <div class="grid-2">
      <div class="card"><h3>📰 Nachrichten</h3><div class="news">${(w.news || []).slice(0, 9).map((n) => `<p><small>Saison ${n.season}${n.week ? ` · Woche ${n.week}` : ''}</small>${esc(n.text)}</p>`).join('') || '<p class="muted">Keine Nachrichten.</p>'}</div></div>
      <div class="card"><h3>🏋️ Trainingsbericht</h3>${(w.trainingReport?.items || []).slice(0, 8).map((r) => `<p>${r.type === 'up' ? '📈' : '🩹'} ${esc(r.text)}</p>`).join('') || '<p class="muted">Der erste Bericht kommt nach dem nächsten Spieltag.</p>'}
        <button class="btn ghost sm" data-nav2="training">Training →</button></div>
    </div></div>`;
  el.querySelector('#to-prof')?.addEventListener('click', () => app.go('profile'));
  el.querySelector('#go-md')?.addEventListener('click', () => app.go(isMatchToday(w) ? 'matchday' : 'calendar'));
  const showEvent = () => {
    const ev = w.pendingEvent; if (!ev) return;
    const m = modal(`<div class="event"><h3>${esc(ev.title)}</h3><p>${esc(ev.text)}</p><div class="sim-opts">${ev.options.map(([l], k) => `<button class="btn" data-ev="${k}"><b>${esc(l)}</b></button>`).join('')}</div></div>`);
    m.el.querySelectorAll('[data-ev]').forEach((b) => (b.onclick = () => { const msg = resolveEvent(w, +b.dataset.ev, newRng(w)); m.close(); modal(`<h3>Entscheidung getroffen</h3><p>${esc(msg)}</p>`); app.render(); }));
  };
  el.querySelector('#open-ev')?.addEventListener('click', showEvent);
  el.querySelector('#coach')?.addEventListener('click', () => {
    const cands = coachCandidates(w, newRng(w));
    const sev = Math.round(w.coach.wage * Math.max(0.5, w.coach.years) / 1e4) * 1e4;
    const m = modal(`<h3>👔 Neuen Cheftrainer verpflichten</h3><p class="muted">Abfindung für ${esc(w.coach.name)}: <b>${money(sev)}</b>. Bessere Trainer holen mehr aus dem Kader und verbessern das Training.</p>
      <div class="sim-opts">${cands.map((c, k) => `<button class="btn" data-k="${k}"><b>${esc(c.name)} ${'★'.repeat(c.quality)}${'☆'.repeat(5 - c.quality)}</b><small>${esc(c.style)} · ${esc(c.formation)} · ${money(c.wage)}/Saison · ${c.years} Jahre</small></button>`).join('')}</div>`);
    m.el.querySelectorAll('[data-k]').forEach((b) => (b.onclick = async () => {
      const c = cands[+b.dataset.k];
      if (!(await confirmDialog(`${w.coach.name} entlassen und ${c.name} verpflichten?`, 'Verpflichten'))) return;
      hireCoach(w, c); m.close(); toast(`${c.name} ist neuer Cheftrainer`); app.render();
    }));
  });
  if (w.pendingEvent && !app._evShown?.[w.week]) { (app._evShown ||= {})[w.week] = true; setTimeout(showEvent, 300); }
  el.querySelector('#club-hist')?.addEventListener('click', () => clubModal(app, club, { onPlayer: (p) => playerModal(app, p) }));
  el.querySelector('#go-end')?.addEventListener('click', () => app.go('seasonEnd'));
  el.querySelectorAll('[data-nav2]').forEach((b) => b.addEventListener('click', () => app.go(b.dataset.nav2)));
  el.querySelectorAll('[data-p]').forEach((d) => d.addEventListener('click', () => playerModal(app, w.players[d.dataset.p])));
}

const SQUAD_COLS = [
  ['number', 'Nr'], ['name', 'Name'], ['pos', 'Pos'], ['age', 'Alter'], ['ovr', 'Stärke'], ['pot', 'Pot.'],
  ['fitness', 'Fitness'], ['morale', 'Moral'], ['form', 'Form'], ['value', 'Marktwert'], ['contract', 'Vertrag'], ['goals', 'Tore'],
];

function six(p) {
  const a = p.attrs;
  if (p.pos === 'TW') return [['REF', a.reflexe], ['FAN', a.fangen], ['STE', a.tw_stellung], ['HER', a.herauslaufen], ['ABS', a.abschlag], ['SPR', a.sprungkraft]];
  return [['TEM', Math.round((a.tempo + a.beschleunigung) / 2)], ['SCH', Math.round((a.abschluss + a.schusskraft) / 2)], ['PAS', Math.round((a.passspiel + a.uebersicht) / 2)],
    ['DRI', Math.round((a.dribbling + a.ballkontrolle + a.technik) / 3)], ['DEF', Math.round((a.tackling + a.stellungsspiel) / 2)], ['PHY', Math.round((a.kraft + a.ausdauer + a.sprungkraft) / 3)]];
}
export function playerCard(p, club, extra = '') {
  const tier = p.age <= 21 && p.pot >= 84 ? 'special' : p.ovr >= 80 ? 'gold' : p.ovr >= 68 ? 'silver' : 'bronze';
  return `<div class="pcard ${tier}" data-p="${p.id}"><div class="ovr"><b>${p.ovr}</b><span>${p.pos}</span></div><div class="flag">${flag(p.nation)}</div>
    ${portrait(p, club, 78)}<div class="nm">${esc(p.lastName)}</div>
    <div class="six">${six(p).map(([k, v]) => `<span><b>${v}</b>${k}</span>`).join('')}</div>
    <div class="st">${p.injury > 0 ? '🩹' : ''}${p.suspension > 0 ? '🟥' : ''}${extra}</div></div>`;
}

import { ensureYouth, youthPlayers, promoteYouth, releaseYouth } from '../../manager/youth.js';
import { ensureCaptain } from '../../manager/players.js';
import { openInbox } from '../../manager/staff.js';

function youthView(app) {
  const w = app.world, club = app.club;
  if (!w.youth) ensureYouth(w, newRng(w));
  const ys = youthPlayers(w).sort((a, b) => b.pot - a.pot || b.ovr - a.ovr);
  const yl = w.youthLeague;
  return `<div class="card" style="margin-bottom:12px"><b>🌱 U19 · Nachwuchsleistungszentrum (Stufe ${club.facilities?.youth ?? 2})</b>
    <p class="muted" style="margin:4px 0 0">${ys.length} Talente · entwickeln sich jede Woche im Training. Mit 20 müssen sie hochgezogen werden oder gehen.${yl ? ` Letzte Saison: Platz ${yl.rank}/${yl.of} in der ${yl.name}.` : ''}</p></div>
    <div class="card table-wrap"><table class="tbl squad"><thead><tr><th>Name</th><th>Pos</th><th>Alter</th><th>Stärke</th><th>Potenzial</th><th>Marktwert</th><th></th></tr></thead><tbody>
    ${ys.map((p) => `<tr><td class="nm">${portrait(p, club, 26)}<span>${flag(p.nation)} ${esc(pname(p))}${p.pot >= 82 ? ' <i class="tag">Juwel</i>' : ''}${p.styleTalent && STYLES[p.styleTalent] ? ` <i class="tag b" title="Talent für diesen Spielstil – lernt ihn fast doppelt so schnell">${STYLES[p.styleTalent].icon} ${STYLES[p.styleTalent].name}-Talent</i>` : ''}${p.age >= 19 ? ' <i class="tag r">letztes Jahr</i>' : ''}</span></td>
      <td><span class="pos pos-${POSITIONS[p.pos].group}">${p.pos}</span></td><td>${p.age}</td><td><b class="${ratingClass(p.ovr)}">${p.ovr}</b></td><td>${p.pot}</td><td>${money(p.value)}</td>
      <td style="white-space:nowrap"><button class="btn small primary" data-up="${p.id}">⬆ Hochziehen</button> <button class="btn small ghost" data-rel="${p.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Keine Talente im Kader.</td></tr>'}
    </tbody></table></div>`;
}

export function squadScreen(app, el) {
  const w = app.world, club = app.club;
  let sort = app.squadSort || { key: 'pos', dir: 1 };
  let filter = 'ALLE';
  let view = app.squadView || 'karten';
  const draw = () => {
    ensureLineup(club, w.players);
    if (view === 'u19' && !w.youth) ensureYouth(w, newRng(w));
    let ps = club.squad.map((id) => w.players[id]);
    if (filter !== 'ALLE') ps = ps.filter((p) => POSITIONS[p.pos].group === filter);
    const val = (p, k) => k === 'name' ? p.lastName : k === 'pos' ? POS_ORDER.indexOf(p.pos) : k === 'goals' ? p.stats.goals : p[k];
    ps.sort((a, b) => { const x = val(a, sort.key), y = val(b, sort.key); return (x > y ? 1 : x < y ? -1 : b.ovr - a.ovr) * sort.dir; });
    const xi = new Set(club.lineup.xi), bench = new Set(club.lineup.bench);
    ensureCaptain(w, club);
    const capTag = (p) => (club.captain === p.id ? ' <i class="tag cap">C</i>' : '') + (p.wantsTalk ? ' <i class="tag y">💬</i>' : '') + (p.wantsOut ? ' <i class="tag r">✈️</i>' : '');
    el.innerHTML = `<div class="page"><div class="page-head"><h2>${view === 'u19' ? `U19 · ${(w.youth || []).length} Talente` : `Kader · ${club.squad.length} Spieler`}</h2>
      <div class="row-actions"><div class="tabs small" style="margin:0">${['ALLE', 'TW', 'ABW', 'MF', 'ANG'].map((g) => `<button data-f="${g}" class="${g === filter ? 'active' : ''}">${g === 'ALLE' ? 'Alle' : g}</button>`).join('')}</div>
      <div class="tabs small" style="margin:0">${[['karten', '🃏 Karten'], ['tabelle', '☰ Tabelle'], ['u19', '🌱 U19']].map(([v, l]) => `<button data-v="${v}" class="${v === view ? 'active' : ''}">${l}</button>`).join('')}</div></div></div>
      ${view === 'u19' ? youthView(app) : view === 'karten' ? `<div class="pcard-grid">${ps.map((p) => playerCard(p, club, (xi.has(p.id) ? ' <i class="tag">S11</i>' : bench.has(p.id) ? ' <i class="tag b">Bank</i>' : '') + capTag(p))).join('')}</div>` : `
      <div class="card table-wrap"><table class="tbl squad"><thead><tr>${SQUAD_COLS.map(([k, l]) => `<th data-k="${k}" class="${sort.key === k ? 'sorted' : ''}">${l}${sort.key === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${ps.map((p) => `<tr data-p="${p.id}" class="${p.injury > 0 ? 'inj' : ''}">
        <td>${p.number}</td><td class="nm">${portrait(p, club, 26)}<span>${flag(p.nation)} ${esc(pname(p))}${capTag(p)}${xi.has(p.id) ? ' <i class="tag">S11</i>' : bench.has(p.id) ? ' <i class="tag b">Bank</i>' : ''}${p.injury > 0 ? ' <i class="tag r">verletzt</i>' : ''}${p.suspension > 0 ? ' <i class="tag r">gesperrt</i>' : ''}${p.loan ? ' <i class="tag b">Leihe</i>' : ''}</span></td>
        <td><span class="pos pos-${POSITIONS[p.pos].group}">${p.pos}</span></td><td>${p.age}</td>
        <td><b class="${ratingClass(p.ovr)}">${p.ovr}</b></td><td>${p.pot}</td>
        <td>${bar(p.fitness, 100, p.fitness < 70 ? 'warn' : '')}</td><td>${bar(p.morale)}</td><td>${bar(p.form)}</td>
        <td>${money(p.value)}</td><td>${w.season + p.contract}</td><td>${p.stats.goals}</td></tr>`).join('')}</tbody></table></div>`}</div>`;
    el.querySelectorAll('th[data-k]').forEach((th) => th.addEventListener('click', () => {
      const k = th.dataset.k; sort = { key: k, dir: sort.key === k ? -sort.dir : (k === 'name' || k === 'pos' || k === 'number' ? 1 : -1) };
      app.squadSort = sort; draw();
    }));
    el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; draw(); }));
    el.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.v; app.squadView = view; draw(); }));
    el.querySelectorAll('[data-p]').forEach((tr) => tr.addEventListener('click', () => playerModal(app, w.players[tr.dataset.p], { onChange: draw })));
    el.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
      if (club.squad.length >= 32) { toast('Profikader ist voll (max. 32).'); return; }
      const p = w.players[b.dataset.up]; promoteYouth(w, p.id); app.autosave?.(); toast(`${p.lastName} ist jetzt Profi.`); draw();
    }));
    el.querySelectorAll('[data-rel]').forEach((b) => b.addEventListener('click', async () => {
      const p = w.players[b.dataset.rel];
      if (await confirmDialog(`${pname(p)} aus der U19 entlassen?`)) { releaseYouth(w, p.id); app.autosave?.(); draw(); }
    }));
  };
  draw();
}

function radar(p) {
  const groups = p.pos === 'TW'
    ? [['Reflexe', p.attrs.reflexe], ['Fangen', p.attrs.fangen], ['Stellung', p.attrs.tw_stellung], ['Herauslaufen', p.attrs.herauslaufen], ['Abschlag', p.attrs.abschlag], ['Sprungkraft', p.attrs.sprungkraft]]
    : [['Tempo', (p.attrs.tempo + p.attrs.beschleunigung) / 2], ['Schuss', (p.attrs.abschluss + p.attrs.schusskraft) / 2], ['Pass', (p.attrs.passspiel + p.attrs.uebersicht) / 2],
      ['Dribbling', (p.attrs.dribbling + p.attrs.ballkontrolle + p.attrs.technik) / 3], ['Defensive', (p.attrs.tackling + p.attrs.stellungsspiel) / 2], ['Physis', (p.attrs.kraft + p.attrs.ausdauer + p.attrs.sprungkraft) / 3]];
  const R = 70, cx = 100, cy = 90, n = groups.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
  const rings = [0.25, 0.5, 0.75, 1].map((r) => `<polygon points="${groups.map((_, i) => pt(i, r).join(',')).join(' ')}" fill="none" stroke="#2a3a5c"/>`).join('');
  const shape = groups.map(([, v], i) => pt(i, v / 100).join(',')).join(' ');
  const labels = groups.map(([l, v], i) => { const [x, y] = pt(i, 1.22); return `<text x="${x}" y="${y}" text-anchor="middle" font-size="10" fill="#9fb0cc">${l} ${Math.round(v)}</text>`; }).join('');
  return `<svg viewBox="-28 -6 256 196" class="radar">${rings}<polygon points="${shape}" fill="rgba(61,220,132,.28)" stroke="#3ddc84" stroke-width="2"/>${labels}</svg>`;
}


export function playerModal(app, p, { onChange } = {}) {
  const w = app.world;
  const club = p.clubId ? w.clubs[p.clubId] : null;
  const known = knowledge(w, p) >= 100;
  const est = estimate(w, p);
  const report = w.scouting?.reports?.[p.id];
  const attrs = (p.pos === 'TW' ? [...GK_ATTRS, ...OUTFIELD_ATTRS.filter(([k]) => ['kraft', 'sprungkraft', 'passspiel', 'tempo'].includes(k))] : OUTFIELD_ATTRS);
  const fuzz = (v) => { const e = Math.round(((100 - est.k) / 100) * 10); const m = Math.round(v / 5) * 5; return [Math.max(1, m - e), Math.min(99, m + e)]; };
  const acts = transferActions(app, p, onChange);
  // v2.8: redesigned profile – hero with face, name, chips and rating rings, quick facts, then details
  const ring = (val, label, lo, hi) => { const v = typeof val === 'number' ? val : Math.round((lo + hi) / 2); return `<div class="pp-ring ${ratingClass(v)}" style="--p:${v}"><b>${val}</b><small>${label}</small></div>`; };
  const grp = POSITIONS[p.pos]?.group || '';
  const fitBar = (l, v) => `<div class="pp-mini"><span>${l}</span><i><b style="width:${Math.max(4, Math.min(100, v))}%"></b></i><em>${Math.round(v)}</em></div>`;
  const m = modal(`<div class="player-profile pp2" style="--c1:${club?.colors.primary || '#334'};--c2:${club?.colors.secondary || '#fff'}">
    <div class="pp-hero"><div class="pp-wm">${club ? crest(club, 260) : ''}</div>
      <div class="pp-face">${portrait(p, club, 150)}</div>
      <div class="pp-id"><small class="pp-first">${esc(p.firstName)}</small><h3>${esc(p.lastName)}</h3>
        <div class="pp-chips"><span class="pp-pos g-${grp}">${p.pos}</span><span>#${p.number}</span><span>${p.age} Jahre</span><span>${p.looks.height} cm</span><span>${flag(p.nation)} ${esc(nationName(p.nation))}</span>${(() => { const st = styleOf(p); return (st ? `<span class="pp-style" title="${esc(st.desc)}">${st.icon} ${esc(st.name)}</span>` : '') + (p.styleTrain && STYLES[p.styleTrain.id] ? `<span class="pp-style lrn">🎓 lernt ${STYLES[p.styleTrain.id].name} ${Math.round(p.styleTrain.progress * 100)} %</span>` : ''); })()}</div>
        <p class="pp-club">${club ? `<button class="linkish" id="pp-club">${crest(club, 22)} ${esc(club.name)}</button>` : 'Vereinslos'}${p.loan ? ` · Leihe von ${esc(w.clubs[p.loan.from].short)}` : ''}</p></div>
      <div class="pp-rings">${ring(known ? p.ovr : `${est.ovrLo}–${est.ovrHi}`, 'Stärke', est.ovrLo, est.ovrHi)}${ring(known ? p.pot : `${est.potLo}–${est.potHi}`, 'Potenzial', est.potLo, est.potHi)}</div>
    </div>
    <div class="pp-facts">
      <div><small>Marktwert</small><b>${money(p.value)}</b></div><div><small>Gehalt</small><b>${money(p.wage)}<em>/Jahr</em></b></div>
      <div><small>Vertrag bis</small><b>${w.season + p.contract}</b></div><div><small>Saison</small><b>${p.stats.apps}<em> Sp.</em> · ${p.stats.goals}<em> T.</em> · ${p.stats.assists}<em> V.</em></b></div>
      <div><small>Ø Note</small><b>${p.stats.rating ? p.stats.rating.toFixed(1).replace('.', ',') : '–'}</b></div><div><small>Persönlichkeit</small><b>${esc(p.personality)}</b></div>
    </div>
    ${p.injury > 0 || p.suspension > 0 ? `<div class="pp-alert">${p.injury > 0 ? `🩹 Verletzt · ${p.injury} Woche(n)` : ''}${p.injury > 0 && p.suspension > 0 ? ' · ' : ''}${p.suspension > 0 ? `🟥 Gesperrt · ${p.suspension} Spiel(e)` : ''}</div>` : ''}
    <div class="pp-body">
      <div class="pp-card"><h4>Attribute</h4>${!known ? '<p class="tag y" style="display:block;padding:.45rem .6rem;margin-bottom:.5rem">🕵️ Ungescoutet – Werte sind Schätzungen.</p>' : ''}
        ${attrs.map(([k, l]) => { if (known) return `<div class="attr"><span>${l}</span>${bar(p.attrs[k], 99, ratingClass(p.attrs[k]))}<b class="${ratingClass(p.attrs[k])}">${p.attrs[k]}</b></div>`;
          const [lo, hi] = fuzz(p.attrs[k]); return `<div class="attr"><span>${l}</span>${bar((lo + hi) / 2, 99, 'r-mid')}<b class="muted">${lo}-${hi}</b></div>`; }).join('')}</div>
      <div class="pp-col">
        ${known ? `<div class="pp-card pp-radar"><h4>Profil</h4>${radar(p)}</div>` : ''}
        ${(() => { const S = anaSummary(p); if (!S) return ''; const f = (v, d = 1) => v.toFixed(d).replace('.', ',');
          return `<div class="pp-card pp-ana"><div class="row-between"><h4>📊 Analyse aus Live-Spielen</h4><small class="muted">${S.games} Spiele · ${S.min} Min.</small></div>${heatSvg(S.heat, club?.colors.primary || '#7c5cff')}
            <div class="ana-grid">${p.pos === 'TW' ? `<div><b>${f(S.saves90)}</b><small>Paraden/90</small></div>` : `<div><b>${f(S.passes90, 0)}</b><small>Pässe/90</small></div><div><b>${f(S.passPct, 0)} %</b><small>Passquote</small></div><div><b>${f(S.shots90)}</b><small>Schüsse/90</small></div><div><b>${f(S.tackles90)}</b><small>Zweikämpfe/90</small></div>`}<div><b>${f(S.rating)}</b><small>Ø Note live</small></div></div></div>`; })()}
        ${known ? `<div class="pp-card"><h4>Zustand</h4>${fitBar('Fitness', p.fitness)}${fitBar('Moral', p.morale)}${fitBar('Form', p.form)}${fitBar('Professionalität', p.professionalism)}</div>` : ''}
        ${report ? `<div class="pp-card"><h4>🕵️ Scoutingbericht</h4><p>Stärken: ${report.strengths.map((k) => esc([...OUTFIELD_ATTRS, ...GK_ATTRS].find((a) => a[0] === k)?.[1] || k)).join(', ')}</p><p>Schwächen: ${report.weaknesses.map((k) => esc([...OUTFIELD_ATTRS, ...GK_ATTRS].find((a) => a[0] === k)?.[1] || k)).join(', ')}</p></div>` : ''}
        ${(() => { if (!known || p.age > 34) return ''; const pr = projectPlayer(p, { facility: club?.facilities?.training ?? 2 }); const last = pr.points[pr.points.length - 1];
          return `<div class="pp-card proj-card"><div class="row-between"><h4>📈 Entwicklungsprognose</h4><small class="muted">Höhepunkt ca. ${pr.peak.ovr} mit ${pr.peak.age}</small></div>${projectionSvg(pr)}<small class="muted">In ${last.age - p.age} Jahren: ${Math.round(last.lo)}–${Math.round(last.hi)} · Band = Spanne je nach Training, Spielzeit & Glück</small></div>`; })()}
      </div>
    </div>
    <div class="pp-actions">${acts.html}</div>
    ${careerHtml(w, p)}</div>`, { wide: true });
  acts.bind(m.el, m.close);
  m.el.querySelector('#pp-club')?.addEventListener('click', () => { m.close(); clubModal(app, club, { onPlayer: (q) => playerModal(app, q, { onChange }) }); });
}

export function leagueScreen(app, el) {
  const w = app.world;
  let lid = app.leagueTab || app.club.leagueId;
  let view = 'table';
  const draw = () => {
    const L = w.leagues.find((l) => l.id === lid);
    const t = computeTable(L);
    const n = t.length;
    const md = Math.min(app.mdView ?? (w.week > 0 ? w.week - 1 : 0), L.fixtures.length - 1);
    const scorers = L.clubIds.flatMap((cid) => w.clubs[cid].squad.map((id) => w.players[id])).filter((p) => p.stats.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists).slice(0, 15);
    el.innerHTML = `<div class="page">
      <div class="tabs">${w.leagues.map((l) => `<button data-l="${l.id}" class="${l.id === lid ? 'active' : ''}">${esc(l.name)}</button>`).join('')}</div>
      <div class="tabs small">${[['table', 'Tabelle'], ['fixtures', 'Spielplan'], ['scorers', 'Torjäger']].map(([v, l]) => `<button data-v="${v}" class="${v === view ? 'active' : ''}">${l}</button>`).join('')}</div>
      <div class="card table-wrap">${view === 'table' ? `<table class="tbl league"><thead><tr><th>#</th><th>Verein</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Tore</th><th>Diff</th><th>Pkt</th><th>Form</th></tr></thead><tbody>
        ${t.map((r, i) => { const c = w.clubs[r.id]; const R = PROMO_RULES[L.id] || {};
          const up = L.tier === 1 ? 4 : (R.up ?? L.promo), down = L.lower ? (R.down ?? L.releg) : 0;
          const zone = i < up ? 'z-up' : (R.playoff === 'playoffs' && i < 6) || (R.playoff === 'relegation' && L.upper && i === up) ? 'z-po' : down && i >= n - down ? 'z-down' : (R.playoff === 'relegation' && L.lower && i === n - down - 1) ? 'z-po' : '';
          return `<tr class="${c.id === w.userClubId ? 'me' : ''} ${zone}" data-club="${c.id}"><td>${i + 1}</td><td class="nm">${crest(c, 20)} <span>${esc(c.name)}</span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}:${r.ga}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b>${r.deduction ? `<small class="bad" title="Punktabzug (Lizenzauflage)"> −${r.deduction}</small>` : ""}</td><td class="form">${r.form.slice(-5).map((f) => `<i class="f-${f}">${f}</i>`).join('')}</td></tr>`; }).join('')}
        </tbody></table><p class="muted legend"><i class="lg up"></i> ${L.tier === 1 ? 'Internationale Plätze' : 'Aufstieg'} <i class="lg po"></i> Relegation / Play-offs <i class="lg down"></i> Abstieg · Verein anklicken für Profil & Historie</p>`
      : view === 'fixtures' ? `<div class="md-nav"><button class="btn sm" id="prev">◀</button><b>Spieltag ${md + 1} / ${L.fixtures.length}</b><button class="btn sm" id="next">▶</button></div>
        <div class="fixtures">${L.fixtures[md].map((m) => `<div class="fx ${m.h === w.userClubId || m.a === w.userClubId ? 'me' : ''}"><span>${esc(w.clubs[m.h].name)} ${crest(w.clubs[m.h], 18)}</span><b>${m.hg == null ? '– : –' : `${m.hg} : ${m.ag}`}</b><span>${crest(w.clubs[m.a], 18)} ${esc(w.clubs[m.a].name)}</span></div>`).join('')}</div>`
      : `<table class="tbl"><thead><tr><th>#</th><th>Spieler</th><th>Verein</th><th>Tore</th><th>Vorl.</th><th>Spiele</th></tr></thead><tbody>${scorers.map((p, i) => `<tr data-p="${p.id}"><td>${i + 1}</td><td>${flag(p.nation)} ${esc(pname(p))}</td><td>${esc(w.clubs[p.clubId].short)}</td><td><b>${p.stats.goals}</b></td><td>${p.stats.assists}</td><td>${p.stats.apps}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Noch keine Tore.</td></tr>'}</tbody></table>`}
      </div></div>`;
    el.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => { lid = b.dataset.l; app.leagueTab = lid; app.mdView = null; draw(); }));
    el.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.v; draw(); }));
    el.querySelector('#prev')?.addEventListener('click', () => { app.mdView = Math.max(0, md - 1); draw(); });
    el.querySelector('#next')?.addEventListener('click', () => { app.mdView = Math.min(L.fixtures.length - 1, md + 1); draw(); });
    el.querySelectorAll('tr[data-p]').forEach((tr) => tr.addEventListener('click', () => playerModal(app, w.players[tr.dataset.p])));
    el.querySelectorAll('tr[data-club]').forEach((tr) => tr.addEventListener('click', () => clubModal(app, w.clubs[tr.dataset.club], { onPlayer: (p) => playerModal(app, p) })));
  };
  draw();
}
