// 7.0: weather & pitch, referees, fans, politics, youth league, museum over two seasons
import { generateWorld } from '../src/data/generator.js';
import { finishWeek, endSeason, isUserSeasonOver, newRng } from '../src/manager/season.js';
import { ensureFans, answerDemand, sellSeasonTickets, chooseCollection } from '../src/manager/fans.js';
import { ensurePolitics, requestVote, endorse } from '../src/manager/politics.js';
import { trophies, kitGallery } from '../src/manager/museum.js';
import { ensureRefs } from '../src/manager/referees.js';
import { ensurePitch } from '../src/manager/weather.js';
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok ', m); };
const w = generateWorld(70); w.userClubId = w.leagues[0].clubIds[0]; w.manager = { name: 'Test Coach' };
const club = w.clubs[w.userClubId];
ensureFans(w); ensurePolitics(w, newRng(w));
ok(sellSeasonTickets(w, 400).ok, 'Dauerkarten verkauft');
ok(chooseCollection(w, 'retro', newRng(w)).ok, 'Kollektion gewählt');
let demands = 0, votes = 0;
for (let s = 0; s < 3; s++) {
  while (!isUserSeasonOver(w)) {
    finishWeek(w, newRng(w));
    if (w.fans.demand) { demands++; answerDemand(w, demands % 2 === 0, newRng(w)); }
    if (w.week === 10) { const r = requestVote(w, 'budget', newRng(w)); if (r.ok) votes++; }
    if (w.politics.candidates && w.politics.endorse == null) endorse(w, 0);
  }
  endSeason(w, newRng(w));
}
const Y = w.u19;
ok(Y && Y.md > 0 && Y.results.length > 0, `U19-Liga läuft (${Y?.md} Spieltage)`);
ok((Y.champions || []).length >= 2, `U19-Meister gekürt (${Y.champions.length})`);
ok(demands > 0, `Ultra-Forderungen: ${demands}`);
ok(votes >= 2, `Aufsichtsrat-Abstimmungen: ${votes}`);
ok(w.politics.log.some((l) => /Präsident/.test(l.text)), 'Präsidentschaftswahl stattgefunden');
ok(ensureRefs(w).list.reduce((s, r) => s + r.games, 0) > 1000, 'Schiedsrichter gebucht');
ok(ensurePitch(club).q >= 20 && ensurePitch(club).q <= 100, `Rasen ${ensurePitch(club).q}`);
ok(kitGallery(club, w.season).length >= 3, 'Trikot-Galerie');
console.log('Trophäen', trophies(w, club).map((t) => t.title).join(', ') || '–', '· Ultras', Math.round(w.fans.ultras), '· Fanclubs', w.fans.clubs, '· Budget', Math.round(club.budget / 1e6), 'Mio');
console.log(process.exitCode ? 'V70 FAILED' : 'V70 OK');
