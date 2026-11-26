// Delegation check: with every area set to "auto", the staff must actually do the work.
import { generateWorld } from '../src/data/generator.js';
import { finishWeek, endSeason, isUserSeasonOver, newRng } from '../src/manager/season.js';
import { ensureStaff, weeklyStaff, openInbox } from '../src/manager/staff.js';
import { ensureTransferState } from '../src/manager/transfers.js';
import { ensureLineup } from '../src/match/tactics.js';
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok ', m); };
const w = generateWorld(7);
w.userClubId = w.leagues[0].clubIds[3];
const rng = newRng(w);
ensureStaff(w, rng);
for (const k of Object.keys(w.staff.delegate)) w.staff.delegate[k] = 'auto';
ensureTransferState(w);
const club = w.clubs[w.userClubId];
ensureLineup(club, w.players);
// 1) lineup: injure two starters
const xi = club.lineup.xi.slice(0, 2);
for (const id of xi) w.players[id].injury = 4;
weeklyStaff(w, rng);
ok(!club.lineup.xi.some((id) => w.players[id].injury > 0), 'Aufstellung: Verletzte werden ersetzt');
// 2) contracts: let 3 key players run out
const top = club.squad.map((id) => w.players[id]).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
for (const p of top) { p.contract = 1; delete p.staffAsked; }
weeklyStaff(w, rng);
const ext = top.filter((p) => p.contract > 1).length;
const notes = (w.inbox || []).filter((x) => x.area === 'contracts');
ok(ext === 3 || ext + notes.filter((x) => /will nicht|gescheitert/.test(x.title)).length >= top.filter((p) => p.contract === 1 || p.contract > 1).length, `Verträge: ${ext}/3 verlängert, Rest gemeldet`);
// 3) offers: an incoming offer is answered
const seller = top[0];
w.transfer.offers.push({ id: w.transfer.nextId++, playerId: club.squad.find((id) => !top.includes(w.players[id])), clubId: w.leagues[0].clubIds[0], fee: 1e5, week: w.week, countered: false });
const before = w.transfer.offers.length;
weeklyStaff(w, rng);
ok(w.transfer.offers.every((o) => o.staffSeen), 'Angebote: vom Stab bearbeitet');
void seller; void before;
// 4) whole season on autopilot: no open inbox items, XI always fit, contracts handled
let badWeeks = 0;
while (!isUserSeasonOver(w)) {
  finishWeek(w, newRng(w));
  const c = w.clubs[w.userClubId];
  if (c.lineup?.xi?.some((id) => { const p = w.players[id]; return !p || p.injury > 0 || p.suspension > 0 || p.clubId !== c.id; })) badWeeks++;
}
ok(badWeeks === 0, `Saison: Startelf jede Woche spielfähig (${badWeeks} Problemwochen)`);
ok(openInbox(w).length === 0, `Saison: keine offenen Vorschläge bei Vollautomatik (${openInbox(w).length})`);
const expiring = club.squad.map((id) => w.players[id]).sort((a, b) => b.ovr - a.ovr).slice(0, 15).filter((p) => p.contract <= 1 && !p.loan);
const reported = expiring.filter((p) => (w.inbox || []).some((x) => x.area === 'contracts' && x.title.includes(p.lastName)));
ok(expiring.length === reported.length, `Saisonende: auslaufende Leistungsträger ${expiring.length}, davon vom Stab verlängert/gemeldet ${reported.length}`);
endSeason(w, newRng(w));
console.log(process.exitCode ? 'STAFF TEST FAILED' : 'STAFF OK');
const byArea = {};
for (const x of w.inbox || []) if (x.auto) byArea[x.area] = (byArea[x.area] || 0) + 1;
console.log('Erledigt vom Stab (letzte 60 Einträge):', JSON.stringify(byArea), '· Scouts im Einsatz:', w.scouting.assignments.length, '· Training:', JSON.stringify({ f: club.training?.focus, i: club.training?.intensity }));
