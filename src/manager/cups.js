// Cup competitions: national cups (DFB-Pokal, FA Cup, Copa del Rey, Coppa Italia, Coupe de France)
// and European cups (Champions League, Europa League). Knock-out format; European rounds are
// two-legged (final single match on neutral ground), national cups single matches with extra time
// and penalties. The lower-league side gets home advantage in the DFB-Pokal.
import { isHumanClub } from './hotseat.js';
import { clamp } from '../core/rng.js';
import { teamStrength, ensureLineup } from '../match/tactics.js';

export const NATIONAL = {
  DE: { name: 'DFB-Pokal', short: 'DFB', leagues: ['de1', 'de2', 'de3'], size: 64, lowerHome: true, prize: [0.21e6, 0.42e6, 0.84e6, 1.68e6, 3.4e6, 4.5e6] },
  EN: { name: 'FA Cup', short: 'FAC', leagues: ['en1', 'en2'], size: 64, prize: [0.1e6, 0.2e6, 0.4e6, 0.8e6, 1.5e6, 3.6e6] },
  ES: { name: 'Copa del Rey', short: 'CDR', leagues: ['es1'], size: 32, prize: [0.3e6, 0.6e6, 1.2e6, 2.4e6, 4e6] },
  IT: { name: 'Coppa Italia', short: 'CIT', leagues: ['it1'], size: 32, prize: [0.3e6, 0.6e6, 1.2e6, 2.4e6, 4e6] },
  NL: { name: 'KNVB Beker', short: 'KNVB', leagues: ['nl1'], size: 16, prize: [0.15e6, 0.3e6, 0.6e6, 1.2e6] },
  PT: { name: 'Taça de Portugal', short: 'TDP', leagues: ['pt1'], size: 16, prize: [0.15e6, 0.3e6, 0.6e6, 1.2e6] },
  TR: { name: 'Türkiye Kupası', short: 'TK', leagues: ['tr1'], size: 16, prize: [0.15e6, 0.3e6, 0.6e6, 1.2e6] },
  SC: { name: 'Scottish Cup', short: 'SCUP', leagues: ['sc1'], size: 16, prize: [0.08e6, 0.16e6, 0.3e6, 0.6e6] },
  FR: { name: 'Coupe de France', short: 'CDF', leagues: ['fr1'], size: 32, prize: [0.2e6, 0.4e6, 0.8e6, 1.6e6, 3e6] },
};
// European places (season 1 by reputation, afterwards by final league position)
// Champions League (v0.9): 32 teams, 8 groups of four, then knock-out from the round of 16
const CL_PLACES = { de1: 6, en1: 7, es1: 7, it1: 7, fr1: 5 };
const EL_PLACES = { de1: 3, en1: 3, es1: 3, it1: 3, fr1: 4 };
const ECL_PLACES = { de1: 3, en1: 3, es1: 3, it1: 3, fr1: 4 };
// v5.0 places [CL, EL, ECL] per league – 32 / 16 / 16
const EURO_V5 = { de1: [6, 2, 2], en1: [6, 2, 2], es1: [6, 2, 2], it1: [6, 2, 2], fr1: [3, 2, 2], nl1: [2, 2, 1], pt1: [2, 2, 2], tr1: [0, 2, 2], sc1: [1, 0, 1] };
// Europa League and Conference League (v1.0): 16 teams each, 4 groups, then quarter-finals
const SMALL_WEEKS = [[3, 5, 9, 11, 14, 16], [25, 27], [29, 31], [33]];
const SMALL_NAMES = ['Gruppenphase', 'Viertelfinale', 'Halbfinale', 'Finale'];
const CL_WEEKS = [[3, 5, 9, 11, 14, 16], [20, 22], [25, 27], [29, 31], [33]];
const CL_NAMES = ['Gruppenphase', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'];
const NAT_WEEKS = { 64: [2, 7, 12, 18, 24, 30], 32: [7, 12, 18, 24, 30], 16: [12, 18, 24, 30] };
const EURO_WEEKS = [[8, 10], [14, 16], [20, 22], [28]];
const ROUND_NAMES = { 64: ['1. Runde', '2. Runde', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'], 32: ['1. Runde', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'], 16: ['Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'] };

const tierOf = (world, id) => world.leagues.find((l) => l.id === world.clubs[id].leagueId)?.tier ?? 9;

function shuffle(rng, arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

// ranking per league: previous final table if available, otherwise reputation
function ranking(world, lid, tables) {
  const L = world.leagues.find((l) => l.id === lid);
  if (tables?.[lid]) return tables[lid].map((r) => r.id).filter((id) => L.clubIds.includes(id) || true);
  return [...L.clubIds].sort((a, b) => world.clubs[b].rep - world.clubs[a].rep);
}

export function createCups(world, rng, tables = null) {
  const cups = [];
  for (const [country, cfg] of Object.entries(NATIONAL)) {
    const ids = cfg.leagues.flatMap((lid) => world.leagues.find((l) => l.id === lid)?.clubIds || []);
    if (ids.length < 4) continue;
    const size = cfg.size;
    // byes for the strongest clubs if the field is smaller than the bracket
    const sorted = [...ids].sort((a, b) => tierOf(world, a) - tierOf(world, b) || world.clubs[b].rep - world.clubs[a].rep);
    const entrants = sorted.slice(0, size);
    // the strongest clubs get a bye if the field is smaller than the bracket; everyone else is drawn
    const byes = Math.max(0, size - entrants.length);
    const order = [];
    for (const id of entrants.slice(0, byes)) order.push(id, null);
    order.push(...shuffle(rng, entrants.slice(byes)));
    cups.push(newCup({ id: `cup-${country}`, name: cfg.name, short: cfg.short, type: 'national', country, entrants, order, weeks: NAT_WEEKS[size], names: ROUND_NAMES[size], legs: 1, prize: cfg.prize, lowerHome: !!cfg.lowerHome }, world, rng));
  }
  // European cups – ranking of the previous season
  const cl = [], el = [], ecl = [];
  // v5.0: with the Eredivisie, Liga Portugal, Süper Lig and Scottish Premiership the places are shared out anew
  const big = world.leagues.some((l) => l.id === 'nl1');
  const P = big ? EURO_V5 : Object.fromEntries(Object.keys(CL_PLACES).map((lid) => [lid, [CL_PLACES[lid], EL_PLACES[lid], ECL_PLACES[lid]]]));
  for (const [lid, [n, e, c]] of Object.entries(P)) {
    if (!world.leagues.some((l) => l.id === lid)) continue;
    const r = ranking(world, lid, tables).filter((id) => world.clubs[id].leagueId === lid);
    cl.push(...r.slice(0, n)); el.push(...r.slice(n, n + e)); ecl.push(...r.slice(n + e, n + e + c));
  }
  cups.push(newGroupCup({ id: 'cl', name: 'Champions League', short: 'CL', type: 'euro', entrants: cl.slice(0, 32), weeks: CL_WEEKS, names: CL_NAMES, legs: 2, prize: [0, 11e6, 12.5e6, 15e6, 18.5e6, 20e6], start: 18.6e6, groupWin: 2.1e6, groupDraw: 0.7e6 }, world, rng));
  cups.push(newGroupCup({ id: 'el', name: 'Europa League', short: 'EL', type: 'euro', entrants: el.slice(0, 16), weeks: SMALL_WEEKS, names: SMALL_NAMES, legs: 2, prize: [0, 2.6e6, 4.6e6, 6e6, 8.6e6], start: 4.3e6, groupWin: 0.63e6, groupDraw: 0.21e6 }, world, rng));
  if (ecl.length >= 16) cups.push(newGroupCup({ id: 'ecl', name: 'Conference League', short: 'ECL', type: 'euro', entrants: ecl.slice(0, 16), weeks: SMALL_WEEKS, names: SMALL_NAMES, legs: 2, prize: [0, 1.3e6, 2.5e6, 4e6, 7e6], start: 3.2e6, groupWin: 0.5e6, groupDraw: 0.17e6 }, world, rng));
  world.cups = cups;
  // starting money for European participants
  for (const c of cups.filter((x) => x.start)) for (const id of c.entrants) if (id != null) payout(world, id, c.start, `${c.name}: Startprämie`);
  return cups;
}

function newCup(cfg, world, rng) {
  const cup = { ...cfg, season: world.season, rounds: [], winner: null };
  cup.rounds.push(drawRound(cup, 0, cfg.order || seededPairs(cfg.entrants, rng), world));
  delete cup.order;
  return cup;
}

// group stage: 4 pots by strength, no two clubs of the same league in one group (where possible)
function newGroupCup(cfg, world, rng) {
  const cup = { ...cfg, season: world.season, rounds: [], winner: null };
  const ids = [...cfg.entrants].sort((a, b) => world.clubs[b].rep - world.clubs[a].rep);
  const nG = Math.floor(ids.length / 4);
  const pots = [0, 1, 2, 3].map((k) => shuffle(rng, ids.slice(k * nG, k * nG + nG)));
  const groups = 'ABCDEFGH'.slice(0, nG).split('').map((name) => ({ name, ids: [] }));
  for (const pot of pots) for (const id of pot) {
    const lg = world.clubs[id].leagueId;
    const free = groups.filter((g) => g.ids.length < pots.indexOf(pot) + 1);
    const g = free.find((x) => !x.ids.some((o) => world.clubs[o].leagueId === lg)) || free[0];
    g.ids.push(id);
  }
  // double round robin: 1-2 3-4 | 1-3 2-4 | 1-4 2-3, mirrored in the second half
  const PAIRS = [[[0, 1], [2, 3]], [[2, 0], [3, 1]], [[0, 3], [1, 2]]];
  for (const g of groups) {
    g.fixtures = [];
    for (let md = 0; md < 6; md++) {
      for (const [x, y] of PAIRS[md % 3]) {
        const [h, a] = md < 3 ? [g.ids[x], g.ids[y]] : [g.ids[y], g.ids[x]];
        g.fixtures.push({ h, a, hg: null, ag: null, cup: cup.id, round: 0, group: g.name, md: md + 1, week: cfg.weeks[0][md] });
      }
    }
  }
  cup.rounds.push({ name: cfg.names[0], weeks: cfg.weeks[0], ties: [], groups, group: true, done: false });
  return cup;
}

export function groupTable(world, g) {
  const rows = Object.fromEntries(g.ids.map((id) => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const f of g.fixtures) {
    if (f.hg == null) continue;
    const H = rows[f.h], A = rows[f.a];
    H.p++; A.p++; H.gf += f.hg; H.ga += f.ag; A.gf += f.ag; A.ga += f.hg;
    if (f.hg > f.ag) { H.w++; A.l++; H.pts += 3; } else if (f.hg < f.ag) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  }
  return Object.values(rows).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || world.clubs[b.id].rep - world.clubs[a.id].rep);
}

export const roundFixtures = (rd) => (rd.group ? rd.groups.flatMap((g) => g.fixtures) : rd.ties.flatMap((t) => t.fixtures));

// European draw: avoid same-country pairings in the first round where possible
function seededPairs(ids, rng) {
  const pool = shuffle(rng, ids.filter((x) => x != null));
  const out = [];
  while (pool.length) {
    const a = pool.shift();
    let k = pool.findIndex((b) => b && a && b !== a && Math.floor(b / 1) % 1 === 0);
    if (k < 0) k = 0;
    out.push(a, pool.splice(k, 1)[0] ?? null);
  }
  return out;
}

function drawRound(cup, r, order, world) {
  const weeks = cup.weeks[r];
  const legWeeks = Array.isArray(weeks) ? weeks : [weeks];
  const final = r === cup.names.length - 1;
  const ties = [];
  for (let i = 0; i < order.length; i += 2) {
    let a = order[i], b = order[i + 1];
    if (a == null || b == null) { ties.push({ a: a ?? b, b: null, fixtures: [], winner: a ?? b, bye: true }); continue; }
    // DFB-Pokal: the lower-league club plays at home
    if (cup.lowerHome && tierOf(world, b) > tierOf(world, a)) [a, b] = [b, a];
    const fixtures = legWeeks.map((wk, leg) => ({ h: leg === 0 ? a : b, a: leg === 0 ? b : a, hg: null, ag: null, cup: cup.id, round: r, leg, week: wk, neutral: final && legWeeks.length === 1 }));
    ties.push({ a, b, fixtures, winner: null });
  }
  return { name: cup.names[r], weeks: legWeeks, ties, done: false };
}

export function cupFixturesOfWeek(world, week = world.week) {
  const out = [];
  for (const c of world.cups || []) for (const rd of c.rounds) if (!rd.done) for (const f of roundFixtures(rd)) if (f.week === week && f.hg == null) out.push(f);
  return out;
}

export function userCupFixture(world) {
  return cupFixturesOfWeek(world).find((f) => f.h === world.userClubId || f.a === world.userClubId) || null;
}

export const cupById = (world, id) => (world.cups || []).find((c) => c.id === id);

// After a cup match has a result: decide the tie when all legs are played.
export function resolveCupFixture(world, f, rng, live = null) {
  const cup = cupById(world, f.cup), rd = cup.rounds[f.round];
  if (f.group) {
    // group match: prize money per win / draw, news for the user's club
    if (f.hg > f.ag) payout(world, f.h, cup.groupWin, `${cup.name}: Sieg Gruppenphase`);
    else if (f.hg < f.ag) payout(world, f.a, cup.groupWin, `${cup.name}: Sieg Gruppenphase`);
    else { payout(world, f.h, cup.groupDraw, `${cup.name}: Remis Gruppenphase`); payout(world, f.a, cup.groupDraw, `${cup.name}: Remis Gruppenphase`); }
    if (f.h === world.userClubId || f.a === world.userClubId) {
      const g = rd.groups.find((x) => x.name === f.group), pos = groupTable(world, g).findIndex((r) => r.id === world.userClubId) + 1;
      world.news.unshift({ season: world.season, week: world.week + 1, text: `⭐ ${cup.name}, Gruppe ${f.group}, ${f.md}. Spieltag: ${world.clubs[f.h].short} ${f.hg}:${f.ag} ${world.clubs[f.a].short} – du bist Gruppen-${pos}.` });
    }
    return;
  }
  const tie = rd.ties.find((t) => t.fixtures.includes(f));
  if (!tie || tie.winner != null) return;
  if (tie.fixtures.some((x) => x.hg == null)) return;
  let ga = 0, gb = 0;
  for (const x of tie.fixtures) { if (x.h === tie.a) { ga += x.hg; gb += x.ag; } else { ga += x.ag; gb += x.hg; } }
  let note = '';
  if (ga === gb) {
    // extra time and penalties (no away goals rule)
    const last = tie.fixtures[tie.fixtures.length - 1];
    const sa = teamStrength(world.clubs[tie.a], world.players), sb = teamStrength(world.clubs[tie.b], world.players);
    if (live?.et != null) { ga += live.et[0]; gb += live.et[1]; }
    else if (rng.chance(0.35)) { if (rng.chance(clamp(0.5 + (sa - sb) * 0.02, 0.25, 0.75))) ga++; else gb++; note = ' n. V.'; }
    if (ga === gb) {
      const aWins = live?.pens != null ? live.pens : rng.chance(clamp(0.5 + (sa - sb) * 0.008, 0.38, 0.62));
      const w5 = 4 + rng.int(0, 1), l5 = w5 - 1 - rng.int(0, 1);
      note = ` n. V., ${aWins ? w5 : l5}:${aWins ? l5 : w5} i. E.`;
      last.pens = aWins === (last.h === tie.a) ? [w5, l5] : [l5, w5];
      tie.winner = aWins ? tie.a : tie.b;
    } else tie.winner = ga > gb ? tie.a : tie.b;
    if (!note) note = ' n. V.';
    last.extra = note.trim();
  } else tie.winner = ga > gb ? tie.a : tie.b;
  tie.agg = [ga, gb]; tie.note = note;
  const W = world.clubs[tie.winner], Lo = world.clubs[tie.winner === tie.a ? tie.b : tie.a];
  if (tie.a === world.userClubId || tie.b === world.userClubId) {
    world.news.unshift({ season: world.season, week: world.week + 1, text: `🏆 ${cup.name}, ${rd.name}: ${tie.winner === world.userClubId ? `Weiter! ${W.name} setzt sich gegen ${Lo.name} durch` : `Aus! ${Lo.name} scheidet gegen ${W.name} aus`} (${ga}:${gb}${note}).` });
  }
  const prize = cup.prize?.[f.round + 1];
  if (prize && f.round + 1 < cup.names.length) payout(world, tie.winner, prize, `${cup.name}: Prämie ${cup.names[f.round + 1]}`);
}

function payout(world, clubId, amount, label) {
  const c = world.clubs[clubId]; if (!c) return;
  c.budget += amount;
  if (c.finance) {
    c.finance.season.prize = (c.finance.season.prize || 0) + amount;
    if (isHumanClub(world, clubId)) c.finance.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'prize', label, amount }], net: amount });
  }
}

// Called by finishWeek before the league games: simulate all open cup games of this week, then draw.
export function weeklyCups(world, rng, quickSim) {
  for (const f of cupFixturesOfWeek(world)) {
    ensureLineup(world.clubs[f.h], world.players); ensureLineup(world.clubs[f.a], world.players);
    quickSim(world, f, rng, { cup: true });
    resolveCupFixture(world, f, rng);
  }
  advanceCups(world, rng);
}

export function advanceCups(world, rng) {
  for (const cup of world.cups || []) {
    const rd = cup.rounds[cup.rounds.length - 1];
    if (rd.group) {
      if (rd.done || rd.groups.some((g) => g.fixtures.some((f) => f.hg == null))) continue;
      rd.done = true;
      // round of 16: group winners against runners-up of another group, winners at home in the second leg
      const tabs = rd.groups.map((g) => groupTable(world, g));
      const firsts = tabs.map((t) => t[0].id), seconds = shuffle(rng, tabs.map((t) => t[1].id));
      const nG = tabs.length;
      for (let i = 0; i < nG; i++) if (tabs[i][1].id === seconds[i]) { const j = (i + 1) % nG; [seconds[i], seconds[j]] = [seconds[j], seconds[i]]; }
      const order = []; firsts.forEach((id, i) => order.push(seconds[i], id));
      for (const id of [...firsts, ...seconds]) payout(world, id, cup.prize[1], `${cup.name}: ${cup.names[1]} erreicht`);
      cup.rounds.push(drawRound(cup, 1, order, world));
      if (cup.entrants.includes(world.userClubId)) {
        const t = cup.rounds[1].ties.find((x) => x.a === world.userClubId || x.b === world.userClubId);
        world.news.unshift({ season: world.season, week: world.week + 1, text: t ? `⭐ ${cup.name}: Gruppenphase überstanden! Im ${cup.names[1]} wartet ${world.clubs[t.a === world.userClubId ? t.b : t.a].name}.` : `⭐ ${cup.name}: In der Gruppenphase ausgeschieden.` });
      }
      continue;
    }
    if (rd.done || rd.ties.some((t) => t.winner == null)) continue;
    rd.done = true;
    const winners = rd.ties.map((t) => t.winner);
    if (winners.length === 1) {
      cup.winner = winners[0];
      const W = world.clubs[cup.winner];
      W.stats.cups = (W.stats.cups || 0) + 1;
      (W.cupTitles ||= []).push({ season: world.season, name: cup.name });
      payout(world, cup.winner, cup.prize?.[cup.prize.length - 1] || 0, `${cup.name}: Siegprämie`);
      world.news.unshift({ season: world.season, week: world.week + 1, text: `🏆 ${W.name} gewinnt ${['DFB-Pokal', 'FA Cup'].includes(cup.name) ? 'den' : 'die'} ${cup.name}!` });
      continue;
    }
    cup.rounds.push(drawRound(cup, cup.rounds.length, shuffle(rng, winners), world));
    if (cup.rounds.length - 1 < cup.names.length && winners.includes(world.userClubId)) {
      const t = cup.rounds[cup.rounds.length - 1].ties.find((x) => x.a === world.userClubId || x.b === world.userClubId);
      const opp = world.clubs[t.a === world.userClubId ? t.b : t.a];
      if (opp) world.news.unshift({ season: world.season, week: world.week + 1, text: `🎱 Auslosung ${cup.name}, ${cup.rounds[cup.rounds.length - 1].name}: ${t.a === world.userClubId ? 'Heimspiel' : 'Auswärtsspiel'} gegen ${opp.name}.` });
    }
  }
}

// a cup round that lies in a week the league schedule has already passed (old saves) is simulated at once
export function catchUpCups(world, rng, quickSim) {
  let guard = 0;
  while (guard++ < 20) {
    const open = (world.cups || []).flatMap((c) => c.rounds.filter((r) => !r.done).flatMap((r) => roundFixtures(r).filter((f) => f.hg == null && f.week < world.week)));
    if (!open.length) break;
    for (const f of open) { ensureLineup(world.clubs[f.h], world.players); ensureLineup(world.clubs[f.a], world.players); quickSim(world, f, rng, { cup: true }); resolveCupFixture(world, f, rng); }
    advanceCups(world, rng);
  }
}

export function userCupStatus(world) {
  const out = [];
  for (const c of world.cups || []) {
    const inIt = c.entrants.includes(world.userClubId);
    if (!inIt) continue;
    const last = c.rounds[c.rounds.length - 1];
    if (last.group) {
      const g = last.groups.find((x) => x.ids.includes(world.userClubId));
      out.push({ cup: c, round: `Gruppe ${g.name} · Platz ${groupTable(world, g).findIndex((r) => r.id === world.userClubId) + 1}`, alive: true, won: false, tie: null, group: g });
      continue;
    }
    const tie = last.ties.find((t) => t.a === world.userClubId || t.b === world.userClubId);
    const out_ = !tie || (tie.winner != null && tie.winner !== world.userClubId);
    out.push({ cup: c, round: last.name, alive: !out_ && c.winner == null, won: c.winner === world.userClubId, tie });
  }
  return out;
}
