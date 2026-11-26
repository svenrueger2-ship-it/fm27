// v6.0: EURO and World Cup are part of every career. In a tournament summer the national coaches nominate
// their 26, the tournament is played round by round (group matchdays, knock-out rounds) and the user follows
// it – or, as national coach, plays the matches of his nation live in 3D.
import { clamp } from '../core/rng.js';
import { news } from './transfers.js';
import { tournamentFor, ensureIntl, ranking, nationSquad, simIntl, byNation, capSquad, groupTable, EUROPE } from './nationals.js';
import { natSquad } from './career.js';
import { generatePlayer } from '../data/generator.js';
import { defaultTactic, ensureLineup } from '../match/tactics.js';
import { WM_NATIONS } from './wm.js';
import { WM_LOGOS } from '../data/wmLogos.js';
import { NATIONS } from '../data/names.js';

const PAIRS = [[[0, 1], [2, 3]], [[0, 2], [3, 1]], [[3, 0], [1, 2]]];
const GROUP_STAGES = ['1. Gruppenspieltag', '2. Gruppenspieltag', '3. Gruppenspieltag'];

export const userNat = (world) => world.career?.nat || null;
export function stageName(T) {
  if (T.done) return 'Beendet';
  return T.stage < 3 ? GROUP_STAGES[T.stage] : T.koNames[T.stage - 3];
}

/** Starts the tournament of the coming summer (called at the end of the season instead of the old instant sim). */
export function startTourney(world, rng) {
  const year = world.season + 1, D = tournamentFor(year);
  if (!D) return null;
  const I = ensureIntl(world), map = byNation(world);
  let field = ranking(world).map((r) => r.nat);
  if (D.kind === 'em') field = field.filter((n) => EUROPE.has(n));
  const hosts = D.host.filter((h) => I.elo[h] != null);
  field = [...new Set([...hosts.slice(0, D.kind === 'em' ? 1 : 3), ...field])].slice(0, D.teams);
  const nG = field.length / 4;
  const pots = [0, 1, 2, 3].map((k) => field.slice(k * nG, k * nG + nG).sort(() => rng.next() - 0.5));
  const groups = Array.from({ length: nG }, (_, i) => ({ name: String.fromCharCode(65 + i), teams: pots.map((p) => p[i]).filter(Boolean), games: [] }));
  const koNames = D.teams === 48 ? ['Sechzehntelfinale', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'] : ['Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'];
  const T = { ...D, year, season: world.season, field, groups, koNames, stage: 0, rounds: [], order: null, goals: {}, squads: {}, done: false, nominated: false };
  world.tourney = T;
  nominate(world, rng, map);
  const own = Object.entries(T.squads).flatMap(([nat, ids]) => ids.filter((id) => world.players[id]?.clubId === world.userClubId).map((id) => [nat, world.players[id]]));
  news(world, `🌍 ${T.name}: ${field.length} Nationen, ${nG} Gruppen. ${own.length ? `Von deinem Verein nominiert: ${own.map(([n, p]) => `${p.lastName} (${n})`).join(', ')}.` : 'Kein Spieler deines Vereins ist nominiert.'}`);
  return T;
}

/** Nominations: every nation calls up 26 players (your own pick if you are national coach). */
export function nominate(world, rng, map = byNation(world)) {
  const T = world.tourney; if (!T) return;
  const mine = userNat(world);
  for (const n of T.field) T.squads[n] = (n === mine ? natSquad(world) : nationSquad(world, n, map)).slice(0, 26).map((p) => p.id);
  if (!T.nominated) {
    // morale: called-up players are proud, snubbed regulars disappointed
    const uc = world.clubs[world.userClubId];
    const called = new Set(Object.values(T.squads).flat());
    for (const id of uc?.squad || []) {
      const p = world.players[id]; if (!p || p.women) continue;
      if (called.has(id)) { p.morale = clamp(p.morale + 4, 0, 99); (p.honours ||= []); }
      else if (p.ovr >= 78 && T.field.includes(p.nation)) { p.morale = clamp(p.morale - 5, 0, 99); news(world, `😤 ${p.firstName} ${p.lastName} ist nicht für ${p.nation} nominiert – er ist enttäuscht.`); }
    }
    T.nominated = true;
  }
}

/** Fixtures of the current stage: [{a, b, group?}] */
export function stageFixtures(T) {
  if (T.done) return [];
  if (T.stage < 3) return T.groups.flatMap((g) => (g.teams.length === 4 ? PAIRS[T.stage].map(([i, j]) => ({ a: g.teams[i], b: g.teams[j], group: g.name })) : []));
  const out = [];
  for (let i = 0; i + 1 < T.order.length; i += 2) out.push({ a: T.order[i], b: T.order[i + 1], ko: true });
  return out;
}
export const userFixture = (world) => { const n = userNat(world), T = world.tourney; return n && T ? stageFixtures(T).find((f) => f.a === n || f.b === n) || null : null; };

function count(T, m) { for (const id of m.scorers || []) T.goals[id] = (T.goals[id] || 0) + 1; }

/** Plays the current stage. `live` = result of the user's nation match played in 3D ({ga, gb, scorers, winner, note}). */
export function playStage(world, rng, live = null) {
  const T = world.tourney; if (!T || T.done) return null;
  const map = byNation(world), mine = userNat(world);
  const fx = stageFixtures(T), played = [];
  for (const f of fx) {
    let m;
    if (live && mine && (f.a === mine || f.b === mine)) m = { a: f.a, b: f.b, ...live };
    else m = simIntl(world, rng, f.a, f.b, map, { ko: !!f.ko });
    count(T, m);
    played.push({ ...f, ga: m.ga, gb: m.gb, note: m.note || '', winner: m.winner });
    if (f.group) T.groups.find((g) => g.name === f.group).games.push({ a: m.a, b: m.b, ga: m.ga, gb: m.gb });
  }
  if (T.stage < 3) {
    if (T.stage === 2) {
      for (const g of T.groups) g.table = groupTable(g);
      const koSize = T.teams === 48 ? 32 : 16;
      const firsts = T.groups.map((g) => g.table[0].nat), seconds = T.groups.map((g) => g.table[1].nat);
      const thirds = T.groups.map((g) => g.table[2]).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga)).slice(0, koSize - firsts.length - seconds.length).map((r) => r.nat);
      const rest = [...seconds, ...thirds].sort(() => rng.next() - 0.5);
      const order = [];
      firsts.forEach((f, i) => order.push(f, rest[i]));
      order.push(...rest.slice(firsts.length));
      T.order = order;
    } else for (const g of T.groups) g.table = groupTable(g);
  } else {
    T.rounds.push({ name: T.koNames[T.stage - 3], ties: played.map((p) => ({ a: p.a, b: p.b, ga: p.ga, gb: p.gb, note: p.note, winner: p.winner })) });
    T.order = played.map((p) => p.winner);
  }
  const mineGame = mine && played.find((p) => p.a === mine || p.b === mine);
  T.last = { stage: stageName(T), games: played.length, mine: mineGame || null };
  T.stage++;
  if (T.stage >= 3 && T.order?.length === 1) finishTourney(world, rng, map);
  return played;
}

export function simToEnd(world, rng) { let n = 0; while (world.tourney && !world.tourney.done && n++ < 12) playStage(world, rng); }

function finishTourney(world, rng, map) {
  const T = world.tourney, I = ensureIntl(world);
  T.done = true;
  const winner = T.order[0];
  const fin = T.rounds[T.rounds.length - 1].ties[0];
  T.winner = winner; T.runnerUp = fin.winner === fin.a ? fin.b : fin.a;
  const top = Object.entries(T.goals).sort((a, b) => b[1] - a[1])[0];
  T.topScorer = top ? { id: +top[0], goals: top[1], name: `${world.players[top[0]]?.firstName || ''} ${world.players[top[0]]?.lastName || ''}`.trim(), nat: world.players[top[0]]?.nation } : null;
  for (const n of T.field) capSquad(world, n, map, rng, { fatigue: 0 });
  for (const id of T.squads[winner] || []) { const p = world.players[id]; if (!p) continue; (p.honours ||= []).push(`${T.kind === 'wm' ? 'Weltmeister' : 'Europameister'} ${T.year}`); p.morale = clamp(p.morale + 12, 0, 99); p.value = Math.round(p.value * 1.08); }
  // tired stars at the start of the season
  const reached = {}; for (const r of T.rounds) for (const t of r.ties) { reached[t.a] = (reached[t.a] || 0) + 1; reached[t.b] = (reached[t.b] || 0) + 1; }
  for (const [nat, ids] of Object.entries(T.squads)) for (const id of ids) { const p = world.players[id]; if (p) p.fitness = clamp(p.fitness - 4 - (reached[nat] || 0) * 3, 50, 100); }
  I.tournaments.unshift({ kind: T.kind, name: T.name, year: T.year, host: T.host, groups: T.groups, rounds: T.rounds, winner, runnerUp: T.runnerUp, topScorer: T.topScorer });
  news(world, `🏆 ${T.name}: ${winner} ist ${T.kind === 'wm' ? 'Weltmeister' : 'Europameister'}! Finale ${fin.a} ${fin.ga}:${fin.gb}${fin.note} ${fin.b}.${T.topScorer ? ` Torschützenkönig: ${T.topScorer.name} (${T.topScorer.goals} Tore).` : ''}`);
  // career: result as national coach
  const C = world.career, mine = userNat(world);
  if (C && mine) {
    const inKo = T.rounds.filter((r) => r.ties.some((t) => t.a === mine || t.b === mine));
    const out = winner === mine ? 'Titel' : T.runnerUp === mine ? 'Finale' : inKo.length ? `K.o.-Runde (${inKo[inKo.length - 1].name})` : T.field.includes(mine) ? 'Gruppenphase' : 'nicht qualifiziert';
    C.natResults = [...(C.natResults || []), { name: T.name, out }];
    C.rep = clamp(C.rep + (out === 'Titel' ? 10 : out === 'Finale' ? 5 : out.startsWith('K.o.') ? 1 : -4), 5, 99);
    if (out === 'Titel') C.titles.push({ season: world.season, nat: mine, title: T.name });
    news(world, `🎽 Als Nationaltrainer ${mine}: ${T.name} – ${out}.`);
  }
  cleanupNationClubs(world);
}

// ------------------------------------------------------------------ live matches: temporary national teams
export function nationClub(world, nat, rng) {
  const T = world.tourney;
  T.clubIds ||= {};
  if (T.clubIds[nat] && world.clubs[T.clubIds[nat]]) return world.clubs[T.clubIds[nat]];
  const id = 95000 + Object.keys(T.clubIds).length;
  const [name, c1, c2] = WM_NATIONS[nat] || [NATIONS[nat]?.name || nat, '#ffffff', '#1b1b1b'];
  const lvl = 72;
  const club = { id, name, short: nat, rep: lvl, leagueId: 'tourney', national: true, nation: nat, crest: WM_LOGOS[nat] || null,
    colors: { primary: c1, secondary: c2, shorts: c2, socks: c1 }, away: { primary: c2, secondary: c1, shorts: c1, socks: c2 },
    stadium: { name: `${T.name} · Finalstadion`, capacity: 70000, level: 5 }, budget: 0, wageBudget: 0,
    squad: (T.squads[nat] || []).filter((pid) => world.players[pid]), tactic: defaultTactic(rng, lvl), lineup: null, stats: { titles: 0 }, history: [], facilities: { training: 3, youth: 3, medical: 3 } };
  // fill gaps with generated players so every nation can field a full team
  const need = { TW: 2, IV: 4, LV: 1, RV: 1, ZM: 4, ST: 3 };
  const have = (pos) => club.squad.filter((pid) => world.players[pid].pos === pos).length;
  for (const [pos, n] of Object.entries(need)) while (have(pos) < n) {
    const p = generatePlayer(rng, world.nextPlayerId++, pos, Math.round(clamp(lvl - 6 + rng.normal(0, 3), 50, 84)), rng.int(21, 31), 'DE', 60);
    const N = NATIONS[nat]; if (N) { p.firstName = N.first[rng.int(0, N.first.length - 1)]; p.lastName = N.last[rng.int(0, N.last.length - 1)]; }
    p.nation = nat; p.clubId = id; p.tourneyOnly = true; world.players[p.id] = p; club.squad.push(p.id);
  }
  world.clubs[id] = club; T.clubIds[nat] = id;
  ensureLineup(club, world.players);
  return club;
}
export function cleanupNationClubs(world) {
  const T = world.tourney; if (!T?.clubIds) return;
  for (const id of Object.values(T.clubIds)) { const c = world.clubs[id]; if (!c) continue; for (const pid of c.squad) if (world.players[pid]?.tourneyOnly) delete world.players[pid]; delete world.clubs[id]; }
  T.clubIds = {};
  if (world.tourneyRestore != null) { world.userClubId = world.tourneyRestore; world.tourneyRestore = null; }
}
