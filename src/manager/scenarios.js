// Szenario-Modus (v2.5): a pre-simulated world with a concrete mission.
import { generateWorld } from '../data/generator.js';
import { finishWeek, newRng, computeTable } from './season.js';

const KEY = 'ufm3d-scenarios';
export const SCENARIOS = [
  { id: 'rettung', icon: '🆘', name: 'Mission Klassenerhalt', league: 'de1', week: 24, diff: 'Schwer',
    desc: 'Bundesliga, 24. Spieltag: Dein Klub steht auf einem direkten Abstiegsplatz, mehrere Punkte hinter dem rettenden Ufer. 10 Spiele, um das Wunder zu schaffen.', goal: 'Platz 15 oder besser', check: (r) => r.rank <= 15 },
  { id: 'titel', icon: '🏆', name: 'Titelrennen', league: 'de1', week: 26, diff: 'Mittel',
    desc: 'Bundesliga, 26. Spieltag: Du bist Zweiter, knapp hinter dem Spitzenreiter. 8 Endspiele um die Meisterschale.', goal: 'Deutscher Meister werden', check: (r) => r.rank === 1 },
  { id: 'aufstieg', icon: '🚀', name: 'Aufstiegsjagd', league: 'de2', week: 24, diff: 'Mittel',
    desc: '2. Bundesliga, 24. Spieltag: Dein Team ist in Lauerstellung auf Platz 4 – der direkte Aufstieg ist noch drin.', goal: 'Platz 1 oder 2', check: (r) => r.rank <= 2 },
  { id: 'pleite', icon: '💸', name: 'Finanzkrise', league: 'de1', week: 0, diff: 'Schwer',
    desc: 'Saisonstart in der Bundesliga mit 15 Mio. € Schulden. Der Vorstand verlangt schwarze Zahlen bis Saisonende – ohne abzusteigen.', goal: 'Kontostand im Plus & Platz 15 oder besser', check: (r, w) => r.rank <= 15 && w.clubs[w.userClubId].budget >= 0 },
  { id: 'premier', icon: '🦁', name: 'Rettung auf der Insel', league: 'en1', week: 28, diff: 'Sehr schwer',
    desc: 'Premier League, 28. Spieltag: Platz 19, die Lage ist ernst. 10 Spiele bleiben dir.', goal: 'Platz 17 oder besser', check: (r) => r.rank <= 17 },
];

export function scenarioRecords() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function saveRecord(id, won) { try { const r = scenarioRecords(); r[id] = { won: (r[id]?.won || false) || won, tries: (r[id]?.tries || 0) + 1 }; localStorage.setItem(KEY, JSON.stringify(r)); } catch {} }

// Flip one of the club's results by one step: up (loss→draw→win) or down (win→draw→loss).
function nudge(L, id, dir, upto) {
  const ms = L.fixtures.slice(0, upto).flat().filter((m) => (m.h === id || m.a === id) && m.hg != null);
  for (let i = ms.length - 1; i >= 0; i--) {
    const m = ms[i], home = m.h === id, gf = home ? m.hg : m.ag, ga = home ? m.ag : m.hg;
    const set = (f, a) => { if (home) { m.hg = f; m.ag = a; } else { m.ag = f; m.hg = a; } };
    if (dir > 0 && gf < ga) { set(ga, ga); return true; }
    if (dir > 0 && gf === ga) { set(gf + 1, ga); return true; }
    if (dir < 0 && gf > ga) { set(ga, ga); return true; }
    if (dir < 0 && gf === ga) { set(gf, ga + 1); return true; }
  }
  return false;
}
const pts = (L, id) => computeTable(L).find((r) => r.id === id).pts;
const rankOf = (L, id) => computeTable(L).findIndex((r) => r.id === id) + 1;

/** Builds the scenario world; returns it with userClubId set and the mission stored in world.scenario. */
export function buildScenario(id, seed) {
  const S = SCENARIOS.find((s) => s.id === id);
  const w = generateWorld(seed);
  const L = w.leagues.find((l) => l.id === S.league);
  const byRep = [...L.clubIds].sort((a, b) => w.clubs[b].rep - w.clubs[a].rep);
  const n = byRep.length;
  const pickFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let uid;
  if (id === 'rettung' || id === 'premier') uid = pickFrom(byRep.slice(n - 6, n - 2));
  else if (id === 'titel') uid = byRep[1 + Math.floor(Math.random() * 2)];
  else if (id === 'aufstieg') uid = pickFrom(byRep.slice(2, 6));
  else uid = pickFrom(byRep.slice(6, 11));
  w.userClubId = uid; w.presim = true;
  while (w.week < S.week) finishWeek(w, newRng(w));
  // shape the table to the scenario's starting situation
  const T = () => computeTable(L), up = S.week;
  if (id === 'rettung' || id === 'premier') {
    const safe = id === 'rettung' ? 15 : 17, target = id === 'rettung' ? 17 : 19;
    for (let k = 0; k < 60; k++) { const t = T(), gap = t[safe - 1].pts - pts(L, uid), r = rankOf(L, uid); if (r >= target - 1 && gap >= 5) break; if (!nudge(L, uid, -1, up)) break; }
    for (let k = 0; k < 60; k++) { const gap = T()[safe - 1].pts - pts(L, uid); if (gap <= 8) break; if (!nudge(L, uid, 1, up)) break; }
  } else if (id === 'titel' || id === 'aufstieg') {
    const ahead = id === 'titel' ? 1 : 2, myRank = id === 'titel' ? 2 : 4, gapWanted = id === 'titel' ? 3 : 4;
    for (let k = 0; k < 120; k++) {
      const t = T(), r = rankOf(L, uid);
      if (r < myRank) { nudge(L, uid, -1, up); continue; }
      const ref = t.filter((x) => x.id !== uid)[ahead - 1], gap = ref.pts - pts(L, uid);
      if (gap > gapWanted + 1) { if (!nudge(L, uid, 1, up)) nudge(L, ref.id, -1, up); continue; }
      if (gap < gapWanted - 1) { nudge(L, uid, -1, up); continue; }
      if (r > myRank) { const blocker = t[myRank - 1]; if (blocker.id !== uid) nudge(L, blocker.id, -1, up); continue; }
      break;
    }
  } else if (id === 'pleite') {
    w.clubs[uid].budget = -15e6;
  }
  // clean start for the manager
  delete w.presim;
  w.mood = { board: id === 'pleite' ? 45 : 50, fans: id === 'titel' ? 70 : 52 };
  w.career = null; w.achievements = {}; w.achToast = []; w.userStats = null; w.mgr = null; w.pendingEvent = null;
  const c = w.clubs[uid], t = T(), r = rankOf(L, uid);
  w.scenario = { id, name: S.name, goal: S.goal, league: L.id, startWeek: S.week, startRank: r, done: null };
  w.news = [{ season: w.season, week: w.week, text: `${S.icon} Szenario „${S.name}“: Du übernimmst ${c.name} auf Platz ${r}. Ziel: ${S.goal}.` }];
  w.manager = { name: 'Manager', goal: S.goal };
  w.mode = 'manager';
  return w;
}

/** Evaluate the mission at the end of the season (before endSeason resets the tables). */
export function evaluateScenario(world) {
  const sc = world.scenario; if (!sc || sc.done) return null;
  const S = SCENARIOS.find((s) => s.id === sc.id), L = world.leagues.find((l) => l.id === sc.league);
  const rank = computeTable(L).findIndex((r) => r.id === world.userClubId) + 1;
  const won = world.clubs[world.userClubId].leagueId === sc.league && S.check({ rank }, world);
  sc.done = { won, rank };
  saveRecord(sc.id, won);
  return sc.done;
}
