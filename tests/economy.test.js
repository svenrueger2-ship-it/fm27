// Checks finances, squad sizes, development and transfer activity over two seasons.
import { generateWorld } from '../src/data/generator.js';
import { finishWeek, endSeason, isUserSeasonOver, newRng } from '../src/manager/season.js';
const w = generateWorld(7);
w.userClubId = w.leagues[0].clubIds[5];
const young = Object.values(w.players).filter((p) => p.age <= 20).slice(0, 300).map((p) => ({ id: p.id, ovr: p.ovr, pot: p.pot }));
const report = (label) => {
  for (const l of w.leagues) {
    const cs = l.clubIds.map((id) => w.clubs[id]);
    const avg = (f) => (cs.reduce((s, c) => s + f(c), 0) / cs.length);
    console.log(label, l.name.padEnd(15), 'Budget Ø', (avg((c) => c.budget) / 1e6).toFixed(1).padStart(6), 'Mio | min', (Math.min(...cs.map((c) => c.budget)) / 1e6).toFixed(1).padStart(6), '| Kader Ø', avg((c) => c.squad.length).toFixed(1), '| Stärke Ø', avg((c) => c.squad.reduce((s, id) => s + w.players[id].ovr, 0) / c.squad.length).toFixed(1));
  }
};
report('Start ');
for (let s = 0; s < 2; s++) {
  while (!isUserSeasonOver(w)) finishWeek(w, newRng(w));
  endSeason(w, newRng(w));
  report('S' + (s + 1) + '    ');
}
const dev = young.map((y) => w.players[y.id] ? w.players[y.id].ovr - y.ovr : null).filter((x) => x != null);
console.log('Entwicklung U20 nach 2 Saisons: Ø +' + (dev.reduce((a, b) => a + b, 0) / dev.length).toFixed(1), 'max', Math.max(...dev));
console.log('Transfers gesamt:', w.transfer.history.length, 'Freie Spieler:', w.freeAgents.length, 'Spieler:', Object.keys(w.players).length);
for (const l of w.leagues) {
  const cs = l.clubIds.map((id) => w.clubs[id]).filter((c) => c.finance.lastSeason);
  const s = (k) => cs.reduce((a, c) => a + c.finance.lastSeason[k], 0) / cs.length / 1e6;
  console.log(l.name.padEnd(15), 'Tickets', s('tickets').toFixed(1), 'TV', s('tv').toFixed(1), 'Spons', s('sponsors').toFixed(1), 'Merch', s('merch').toFixed(1), 'Prämie', s('prize').toFixed(1), 'Gehälter', s('wages').toFixed(1), 'Anlagen', s('facilities').toFixed(1));
}
