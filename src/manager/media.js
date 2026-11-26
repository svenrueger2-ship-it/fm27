// Media & social (v1.0): newspaper headlines after every match of the user's club, a social-media feed
// with fan, journalist and rival posts, quotes from press conferences, plus records & hall of fame.
import { clamp } from '../core/rng.js';
import { writeMatchReport, socialAfterMatch, weeklyNewsroom, writeSeasonReview } from './newsroom.js';

export const PAPERS = ['Sport-Kurier', 'Der Ballblick', 'Kicker-Express', 'Abendpost Sport', 'Fußball Heute'];
const JOURNOS = [['Mia Lorenz', 'mialorenz_fussball'], ['Tobias Kern', 'kern_reports'], ['Laura Vidal', 'lvidal_insider'], ['Jan Wolters', 'wolters_live']];
const FIRST = ['Ben', 'Lena', 'Kevin', 'Tom', 'Sarah', 'Mehmet', 'Lukas', 'Jana', 'Dennis', 'Nico', 'Anna', 'Marco', 'Paul', 'Sven'];
const pick = (rng, a) => a[Math.floor(rng.next() * a.length)];
const handleFor = (rng, club) => `${pick(rng, ['', 'echter_', 'immer_', 'ultra_'])}${club.short.toLowerCase()}${pick(rng, ['fan', '_ultra', '_forever', '1904', '_block', '_jung', '_mama', 'liebe'])}${rng.int(1, 99)}`;

export function ensureMedia(world) { world.media ||= { headlines: [], feed: [], quotes: [] }; world.media.feed ||= []; world.media.headlines ||= []; world.media.quotes ||= []; return world.media; }
const push = (arr, x, max) => { arr.unshift(x); if (arr.length > max) arr.length = max; };

// called after each match of the user's club
export function mediaAfterMatch(world, m, rng) {
  const M = ensureMedia(world);
  const me = world.clubs[world.userClubId];
  const home = m.h === me.id, opp = world.clubs[home ? m.a : m.h];
  const gf = home ? m.hg : m.ag, ga = home ? m.ag : m.hg, d = gf - ga;
  const run = me.formRun || 0;
  const big = opp.rep >= me.rep + 6, weak = opp.rep <= me.rep - 10;
  const paper = pick(rng, PAPERS);
  let title, sub, tone;
  if (d >= 3) { title = pick(rng, [`${me.short} zerlegt ${opp.short}!`, `Gala! ${gf}:${ga}-Schützenfest gegen ${opp.short}`, `${opp.short} chancenlos – ${me.short} in Torlaune`]); tone = 'top'; }
  else if (d > 0 && big) { title = pick(rng, [`Sensation! ${me.short} schlägt ${opp.short}`, `David besiegt Goliath: ${gf}:${ga} gegen ${opp.short}`, `Coup gegen ${opp.short}!`]); tone = 'top'; }
  else if (d > 0 && run >= 4) { title = `${me.short} nicht zu stoppen – ${run}. Sieg in Serie`; tone = 'top'; }
  else if (d > 0) { title = pick(rng, [`Arbeitssieg für ${me.short}`, `${me.short} holt drei Punkte gegen ${opp.short}`, `${gf}:${ga} – ${me.short} bleibt dran`]); tone = 'ok'; }
  else if (d === 0) { title = pick(rng, [`Remis zwischen ${me.short} und ${opp.short}`, `Punkteteilung beim ${home ? 'Heimspiel' : 'Auswärtsspiel'}`, `${gf}:${ga} – ${weak ? 'zwei Punkte verschenkt' : 'ein Punkt für die Moral'}`]); tone = weak ? 'bad' : 'ok'; }
  else if (d <= -3) { title = pick(rng, [`Debakel! ${me.short} geht gegen ${opp.short} unter`, `${ga}:${gf}-Klatsche – Krisenstimmung bei ${me.short}`, `Blamage für ${me.short}`]); tone = 'crisis'; }
  else if (run <= -3) { title = `${me.short} in der Krise – ${-run}. Niederlage in Folge`; tone = 'crisis'; }
  else { title = pick(rng, [`Niederlage gegen ${opp.short}`, `${me.short} verliert ${gf}:${ga}`, weak ? `Peinlich: ${me.short} patzt gegen ${opp.short}` : `Knappe Pleite bei ${opp.short}`]); tone = weak ? 'crisis' : 'bad'; }
  const mood = world.mood || { board: 60, fans: 60 };
  sub = tone === 'crisis' ? (mood.board < 30 ? 'Wackelt jetzt der Trainerstuhl?' : 'Die Fans fordern eine Reaktion.') : tone === 'top' ? 'Die Fans feiern ihre Mannschaft.' : tone === 'bad' ? 'Die Stimmung wird unruhiger.' : 'Solide Leistung, viel Luft nach oben.';
  push(M.headlines, { season: world.season, week: world.week, paper, title, sub, tone, score: `${world.clubs[m.h].short} ${m.hg}:${m.ag} ${world.clubs[m.a].short}`, cup: !!m.cup }, 40);
  // v5.5 Medienhaus: full article + Social Media 2.0
  let art = null;
  try { art = writeMatchReport(world, m, rng); } catch (e) { console.warn('newsroom', e); }
  socialAfterMatch(world, m, rng, art);
  if (art) Object.assign(M.headlines[0], { article: art.id });
  // records
  updateRecords(world, m);
}

// weekly league round-up and rumours become posts too
export function weeklyMedia(world, rng) {
  const M = ensureMedia(world);
  weeklyNewsroom(world, rng);
  if (rng.chance(0.4) && world.rumours?.length) { const r = world.rumours[0]; const [jn, jh] = pick(rng, JOURNOS); push(M.feed, { season: world.season, week: world.week, user: `@${jh}`, name: jn, text: `🔎 Exklusiv: ${r.text || ''}`.slice(0, 220), likes: rng.int(300, 9000), kind: 'press', verified: true }, 80); }
}

// ------------------------------------------------------------------ records & hall of fame
export function ensureRecords(world) {
  world.records ||= { biggestWin: null, biggestLoss: null, mostGoalsGame: null, bestSeason: null, attendance: 0, unbeaten: 0, unbeatenMax: 0 };
  return world.records;
}
function updateRecords(world, m) {
  const R = ensureRecords(world), me = world.userClubId;
  const home = m.h === me, gf = home ? m.hg : m.ag, ga = home ? m.ag : m.hg;
  const rec = { season: world.season, week: world.week, text: `${world.clubs[m.h].short} ${m.hg}:${m.ag} ${world.clubs[m.a].short}`, d: gf - ga, t: gf + ga };
  if (gf > ga && (!R.biggestWin || rec.d > R.biggestWin.d)) R.biggestWin = rec;
  if (gf < ga && (!R.biggestLoss || rec.d < R.biggestLoss.d)) R.biggestLoss = rec;
  if (!R.mostGoalsGame || rec.t > R.mostGoalsGame.t) R.mostGoalsGame = rec;
  R.unbeaten = gf >= ga ? R.unbeaten + 1 : 0; R.unbeatenMax = Math.max(R.unbeatenMax, R.unbeaten);
}

// season end: club legends (apps / goals for the user's club across seasons) and best season
export function seasonRecords(world, rank, pts) {
  const R = ensureRecords(world);
  const me = world.clubs[world.userClubId];
  if (!R.bestSeason || pts > R.bestSeason.pts) R.bestSeason = { season: world.season, pts, rank, club: me.short };
  try { writeSeasonReview(world, rank, pts); } catch (e) { console.warn('newsroom', e); }
  world.legends ||= {};
  for (const id of me.squad) {
    const p = world.players[id]; if (!p || !p.stats.apps) continue;
    const L = (world.legends[id] ||= { id, name: `${p.firstName} ${p.lastName}`, pos: p.pos, nation: p.nation, club: me.id, apps: 0, goals: 0, assists: 0, seasons: 0, titles: 0, ratingSum: 0 });
    L.apps += p.stats.apps; L.goals += p.stats.goals; L.assists += p.stats.assists; L.seasons++; L.ratingSum += (p.stats.rating || 6.5) * p.stats.apps; L.name = `${p.firstName} ${p.lastName}`;
  }
}
export function addTitleToLegends(world) { for (const id of world.clubs[world.userClubId].squad) if (world.legends?.[id]) world.legends[id].titles++; }

export function hallOfFame(world) {
  const all = Object.values(world.legends || {});
  const score = (l) => l.apps * 0.6 + l.goals * 2 + l.assists + l.titles * 15 + l.seasons * 4;
  return all.map((l) => ({ ...l, score: Math.round(score(l)), avg: l.apps ? Math.round((l.ratingSum / l.apps) * 10) / 10 : 0 })).sort((a, b) => b.score - a.score);
}

// league records over all seasons (from club histories)
export function leagueRecords(world) {
  const out = [];
  for (const c of Object.values(world.clubs)) for (const h of c.history || []) out.push({ club: c, ...h });
  const champs = {};
  for (const r of out) if (r.champion) champs[r.club.id] = (champs[r.club.id] || 0) + 1;
  return {
    mostPoints: out.filter((r) => r.tier === 1).sort((a, b) => b.pts - a.pts).slice(0, 5),
    mostGoals: out.filter((r) => r.tier === 1).sort((a, b) => b.gf - a.gf).slice(0, 5),
    champions: Object.entries(champs).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ club: world.clubs[id], n })),
  };
}
export const clampLikes = (n) => clamp(n, 0, 1e6);
