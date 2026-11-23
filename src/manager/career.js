// Career (v1.0): manager reputation, board ultimatum and sacking, job offers from other clubs,
// switching clubs mid-career, and the national team job alongside the club.
import { clamp } from '../core/rng.js';
import { ensureMood } from './events.js';
import { computeTable } from './season.js';
import { ensureCoach, coachDecides, isDirector } from './director.js';
import { ranking, nationSquad } from './nationals.js';

const leagueOf = (w, c) => w.leagues.find((l) => l.id === c.leagueId);

export function boardGoal(world, club) {
  const L = leagueOf(world, club);
  return club.rep > 85 ? 'Meisterschaft' : club.rep > 74 ? 'Internationale Plätze' : club.rep > 62 ? 'Gesichertes Mittelfeld' : L.tier > 1 && club.rep > 55 ? 'Aufstiegsplätze' : 'Klassenerhalt';
}
export function goalRank(world, club, goal) {
  const n = leagueOf(world, club).clubIds.length;
  return { Meisterschaft: 1, 'Internationale Plätze': 6, 'Gesichertes Mittelfeld': Math.round(n * 0.55), Aufstiegsplätze: 3, Klassenerhalt: n - 3 }[goal] ?? Math.round(n / 2);
}

export function ensureCareer(world) {
  if (world.career) return world.career;
  const club = world.clubs[world.userClubId];
  world.career = { rep: Math.round(clamp(club ? club.rep * 0.55 + 12 : 40, 20, 80)), clubs: [{ clubId: world.userClubId, from: world.season, to: null }], seasons: [], titles: [], offers: [], nat: null, natOffer: null, ultimatum: false, sacked: 0 };
  return world.career;
}

export function repLabel(r) { return r >= 90 ? 'Weltklasse' : r >= 78 ? 'International gefragt' : r >= 65 ? 'Renommiert' : r >= 50 ? 'Etabliert' : r >= 35 ? 'Aufstrebend' : 'Unbekannt'; }

// ------------------------------------------------------------------ weekly: board pressure, sacking, offers
export function weeklyCareer(world, rng) {
  const C = ensureCareer(world);
  const club = world.clubs[world.userClubId], M = ensureMood(world);
  if (world.week < 6 || C.pendingSack) return;
  if (M.board <= 22 && !C.ultimatum) {
    C.ultimatum = true;
    const L = leagueOf(world, club), rank = computeTable(L).findIndex((r) => r.id === club.id) + 1;
    world.news.unshift({ season: world.season, week: world.week, text: `⚠️ Ultimatum! Der Vorstand ist mit Platz ${rank} unzufrieden. Ohne Besserung in den nächsten Wochen bist du ${isDirector(world) ? 'deinen Job als Sportdirektor' : 'deinen Job'} los.` });
  }
  if (M.board > 35) C.ultimatum = false;
  if (C.ultimatum && M.board <= 12 && rng.chance(0.4)) { sackUser(world, rng); return; }
  // mid-season: a successful manager attracts bigger clubs
  if (world.week >= 18 && world.week % 6 === 0 && rng.chance(clamp((C.rep - 55) / 80, 0, 0.35))) makeOffers(world, rng, 1, 'Winter');
}

function candidates(world, minRep, maxRep) {
  return Object.values(world.clubs).filter((c) => c.id !== world.userClubId && c.rep >= minRep && c.rep <= maxRep);
}

export function makeOffers(world, rng, n, why) {
  const C = ensureCareer(world), cur = world.clubs[world.userClubId];
  const cands = candidates(world, Math.max(cur.rep - 12, C.rep - 15), Math.max(C.rep + 12, cur.rep + 5)).filter((c) => !C.offers.some((o) => o.clubId === c.id));
  for (let i = 0; i < n && cands.length; i++) {
    const c = cands.splice(Math.floor(rng.next() * cands.length), 1)[0];
    C.offers.push({ clubId: c.id, goal: boardGoal(world, c), wage: Math.round((0.5 + c.rep / 40) * 1e6 / 1e5) * 1e5, season: world.season, week: world.week, why });
    world.news.unshift({ season: world.season, week: world.week, text: `📞 Jobangebot: ${c.name} möchte dich als ${isDirector(world) ? 'Sportdirektor' : 'Trainer'} verpflichten (Ziel: ${boardGoal(world, c)}). Antwort unter „Karriere“.` });
  }
  C.offers = C.offers.slice(-5);
}

export function sackUser(world, rng) {
  const C = ensureCareer(world), club = world.clubs[world.userClubId];
  C.sacked++; C.rep = clamp(C.rep - 8, 10, 100); C.ultimatum = false;
  C.pendingSack = { clubId: club.id, season: world.season, week: world.week };
  world.news.unshift({ season: world.season, week: world.week, text: `🚪 Entlassen! ${club.name} trennt sich von dir. Du musst dir einen neuen Verein suchen.` });
  // offers from smaller clubs – there is always at least one way back
  C.offers = [];
  const cands = candidates(world, Math.max(25, C.rep - 35), C.rep + 2).sort(() => rng.next() - 0.5).slice(0, 4);
  for (const c of cands) C.offers.push({ clubId: c.id, goal: boardGoal(world, c), wage: Math.round((0.4 + c.rep / 50) * 1e6 / 1e5) * 1e5, season: world.season, week: world.week, why: 'Neuanfang' });
}

// take a job: the old club becomes an AI club, user-specific state is reset
export function takeJob(world, clubId, rng) {
  const C = ensureCareer(world), old = world.clubs[world.userClubId], club = world.clubs[clubId];
  const last = C.clubs[C.clubs.length - 1]; if (last) last.to = world.season;
  C.clubs.push({ clubId, from: world.season, to: null });
  C.offers = []; C.pendingSack = null; C.ultimatum = false;
  // youth academy players belong to the old club and leave with it
  for (const id of world.youth || []) delete world.players[id];
  world.youth = null; world.youthLeague = null;
  if (world.transfer) { world.transfer.offers = []; world.transfer.listed = []; world.transfer.negotiations = {}; }
  if (world.scouting) world.scouting.assignments = [];
  world.inbox = [];
  old.lineup = null; club.lineup = null;
  world.userClubId = clubId;
  world.mood = { board: 66, fans: 60 };
  world.manager = { ...(world.manager || {}), goal: boardGoal(world, club) };
  if (isDirector(world)) { world.coach = null; ensureCoach(world, rng); coachDecides(world); }
  world.news.unshift({ season: world.season, week: world.week, text: `✍️ Neuer Job: Du übernimmst ${club.name}. Der Vorstand erwartet: ${boardGoal(world, club)}.` });
}

// ------------------------------------------------------------------ season end
export function careerSeasonEnd(world, rng, { rank, cupWins, tournament }) {
  const C = ensureCareer(world), club = world.clubs[world.userClubId];
  const goal = world.manager?.goal || boardGoal(world, club);
  const target = goalRank(world, club, goal);
  const L = leagueOf(world, club);
  const titles = [];
  if (rank === 1) titles.push(`Meister ${L.name}`);
  for (const c of cupWins) titles.push(c);
  let delta = (target - rank) * (L.tier === 1 ? 1.3 : 0.8) + titles.length * 5 + (L.tier === 1 ? 1 : -1);
  if (rank <= target) delta += 2;
  C.rep = Math.round(clamp(C.rep + delta, 5, 99));
  C.seasons.push({ season: world.season, clubId: club.id, league: L.name, rank, goal, reached: rank <= target, titles, rep: C.rep });
  for (const t of titles) C.titles.push({ season: world.season, clubId: club.id, title: t });
  const lv = legendStatus(world).level; if (lv > (C.legendLevel ?? 0)) { C.legendLevel = lv; world.news.unshift({ season: world.season + 1, week: 0, text: `${LEGEND_LEVELS[lv][1]} Neuer Legendenstatus: Du bist jetzt „${LEGEND_LEVELS[lv][2]}“.` }); }
  // national team job
  if (C.nat && tournament) {
    const T = tournament, mine = C.nat;
    const out = T.winner === mine ? 'Titel' : T.runnerUp === mine ? 'Finale' : T.rounds.some((r) => r.ties.some((t) => t.a === mine || t.b === mine)) ? `K.o.-Runde (${T.rounds.filter((r) => r.ties.some((t) => t.a === mine || t.b === mine)).slice(-1)[0].name})` : T.groups.some((g) => g.teams.includes(mine)) ? 'Gruppenphase' : 'nicht qualifiziert';
    C.natResults = [...(C.natResults || []), { name: T.name, out }];
    C.rep = clamp(C.rep + (out === 'Titel' ? 10 : out === 'Finale' ? 5 : out.startsWith('K.o.') ? 1 : -4), 5, 99);
    if (out === 'Titel') C.titles.push({ season: world.season, nat: mine, title: T.name });
    world.news.unshift({ season: world.season + 1, week: 0, text: `🎽 Als Nationaltrainer ${mine}: ${T.name} – ${out}.` });
  }
  // offers for next season
  C.offers = C.offers.filter((o) => o.season === world.season);
  if (rank <= target || rng.chance(0.3)) makeOffers(world, rng, rank <= target ? rng.int(1, 3) : 1, 'Sommer');
  // national team offer for renowned managers
  if (!C.nat && C.rep >= 62 && rng.chance(0.5)) {
    const R = ranking(world);
    const lo = Math.round(clamp((100 - C.rep) * 1.2, 0, 50));
    const pool = R.slice(lo, lo + 15).map((r) => r.nat);
    if (pool.length) { C.natOffer = pool[Math.floor(rng.next() * pool.length)]; world.news.unshift({ season: world.season + 1, week: 0, text: `🎽 Anfrage: Der Verband von ${C.natOffer} will dich zusätzlich als Nationaltrainer. Antwort unter „Karriere“.` }); }
  }
  return { delta: Math.round(delta * 10) / 10, rep: C.rep, titles };
}

export function acceptNat(world) { const C = ensureCareer(world); if (!C.natOffer) return; C.nat = C.natOffer; C.natOffer = null; C.natSquad = null; world.news.unshift({ season: world.season, week: world.week, text: `🎽 Du bist neuer Nationaltrainer von ${C.nat}!` }); }
export function resignNat(world) { const C = ensureCareer(world); C.nat = null; C.natSquad = null; }

// national coach can pick his own squad (26); default = best players
export function natSquad(world) {
  const C = ensureCareer(world); if (!C.nat) return [];
  const best = nationSquad(world, C.nat);
  if (!C.natSquad) return best;
  return C.natSquad.map((id) => world.players[id]).filter((p) => p && p.nation === C.nat && p.clubId != null);
}
export function natCoachBonus(world, nat) {
  const C = world.career; if (!C?.nat || C.nat !== nat) return 0;
  return (C.rep - 60) / 20; // a renowned coach gets more out of his team
}

// ------------------------------------------------------------------ v4.0 legend status & chronicle
export const LEGEND_LEVELS = [
  [0, '🌱', 'Neuling'], [60, '📋', 'Trainer'], [160, '🎖️', 'Erfahrener Trainer'], [320, '🏅', 'Meistertrainer'],
  [560, '🏆', 'Trainerlegende'], [900, '👑', 'Ikone des Fußballs'],
];
/** Legend points from matches, wins, seasons, reached goals, titles and national team success. */
export function legendStatus(world) {
  const C = ensureCareer(world), S = world.userStats || { matches: 0, w: 0 };
  const titles = C.titles.filter((t) => !t.nat).length, natTitles = C.titles.filter((t) => t.nat).length;
  const goals = C.seasons.filter((s) => s.reached).length;
  const parts = [
    ['Spiele', S.matches * 0.5], ['Siege', S.w * 0.8], ['Saisons', C.seasons.length * 6], ['Ziele erreicht', goals * 10],
    ['Titel', titles * 45], ['Länderspieltitel', natTitles * 90], ['Ruf', Math.max(0, C.rep - 50) * 1.2],
  ];
  const pts = Math.round(parts.reduce((a, [, v]) => a + v, 0));
  let i = LEGEND_LEVELS.length - 1; while (i > 0 && pts < LEGEND_LEVELS[i][0]) i--;
  const next = LEGEND_LEVELS[i + 1];
  return { pts, level: i, icon: LEGEND_LEVELS[i][1], name: LEGEND_LEVELS[i][2], next: next ? { pts: next[0], name: next[2], icon: next[1] } : null, parts: parts.map(([k, v]) => [k, Math.round(v)]) };
}
/** Chronicle grouped by decade: clubs, titles, best finish, goals reached. */
export function chronicle(world) {
  const C = ensureCareer(world), out = {};
  for (const s of C.seasons) {
    const d = Math.floor(s.season / 10) * 10;
    const D = (out[d] ||= { decade: d, seasons: 0, clubs: new Set(), titles: [], best: 99, reached: 0 });
    D.seasons++; D.clubs.add(s.clubId); D.titles.push(...s.titles); D.best = Math.min(D.best, s.rank); if (s.reached) D.reached++;
  }
  for (const t of C.titles) if (t.nat) { const d = Math.floor(t.season / 10) * 10; (out[d] ||= { decade: d, seasons: 0, clubs: new Set(), titles: [], best: 99, reached: 0 }).titles.push(`${t.title} (Nationalteam)`); }
  return Object.values(out).sort((a, b) => b.decade - a.decade).map((D) => ({ ...D, clubs: [...D.clubs] }));
}
