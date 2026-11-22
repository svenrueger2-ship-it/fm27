// Simulates two complete seasons (all leagues) incl. promotion/relegation and checks invariants.
import { generateWorld } from '../src/data/generator.js';
import { finishWeek, endSeason, isUserSeasonOver, computeTable, newRng } from '../src/manager/season.js';
const w = generateWorld(42);
w.userClubId = w.leagues[1].clubIds[0];
for (let s = 0; s < 2; s++) {
  while (!isUserSeasonOver(w)) finishWeek(w, newRng(w));
  const sum = endSeason(w, newRng(w));
  const t = computeTable(w.leagues[0]);
  console.log(`Saison ${sum.season}: Nutzer Platz ${sum.user.rank} (${sum.user.league}) · Aufsteiger ${sum.promoted.length} · Absteiger ${sum.relegated.length}`);
  for (const l of w.leagues) {
    const n = l.clubIds.length, set = new Set(l.clubIds);
    if (set.size !== n) throw new Error('duplicate club in ' + l.id);
    for (const id of l.clubIds) if (w.clubs[id].leagueId !== l.id) throw new Error('league mismatch');
  }
  for (const c of Object.values(w.clubs)) if (c.squad.some((id) => !w.players[id])) throw new Error('missing player');
}
console.log('OK – Spieler:', Object.keys(w.players).length, 'Saison jetzt', w.season);
