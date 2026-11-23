// Procedural world generator: clubs + players for all leagues.
import { RNG, clamp } from '../core/rng.js';
import { NATIONS, NATION_MIX } from './names.js';
import { LEAGUES, KIT_COLORS } from './leagues.js';
import { OUTFIELD_ATTRS, GK_ATTRS, POS_WEIGHTS, computeOverall } from './attributes.js';
import { defaultTactic } from '../match/tactics.js';
import { buildFixtures, leagueFixtures } from '../manager/season.js';
import { migrateWorld } from '../manager/migrate.js';
import { REAL_SQUADS } from './realSquads.js';
import { NATION_SKIN } from './nationsExtra.js';
import { STARS } from './stars.js';
import { CLUB_INFO } from './clubInfo.js';
import { CLUB_FOUNDED } from './clubInfoExtra.js';
import { createCups } from '../manager/cups.js';
import { updateValues } from '../manager/youth.js';
import { ensureClubAI } from '../manager/clubAI.js';

const SQUAD_TEMPLATE = ['TW', 'TW', 'TW', 'IV', 'IV', 'IV', 'IV', 'LV', 'LV', 'RV', 'RV', 'DM', 'DM', 'ZM', 'ZM', 'ZM', 'OM', 'LM', 'RM', 'LA', 'RA', 'ST', 'ST', 'ST'];
const PERSONALITIES = [
  ['Professionell', 85], ['Ehrgeizig', 75], ['Ruhig', 65], ['Loyal', 70], ['Temperamentvoll', 45],
  ['Launisch', 30], ['Führungsspieler', 80], ['Lässig', 35], ['Teamplayer', 70], ['Perfektionist', 90],
];
const HAIR_COLORS = ['#1a1410', '#2b1d14', '#4a3020', '#6b4a2b', '#a0743c', '#d9b86a', '#e8d6a0', '#8a2c12', '#222222', '#555555'];
const SKIN_LIGHT = ['#f3d2b8', '#eac0a0', '#e0b090', '#d6a27e'];
const SKIN_MID = ['#c68e64', '#b57b52', '#a56b45'];
const SKIN_DARK = ['#8a5636', '#6e4128', '#55311d', '#3f2416'];

export function pickNation(rng, country) {
  const mix = NATION_MIX[country] || NATION_MIX.DE;
  const keys = Object.keys(mix);
  return rng.weighted(keys, (k) => mix[k]);
}

function skinFor(rng, nat) {
  const g = NATIONS[nat] ? null : NATION_SKIN[nat];
  if (g === 'd') return rng.chance(0.9) ? rng.pick(SKIN_DARK) : rng.pick(SKIN_MID);
  if (g === 'b' || g === 'a') return rng.chance(0.6) ? rng.pick(SKIN_MID) : rng.pick(SKIN_LIGHT);
  if (g === 'm') return rng.pick([...SKIN_LIGHT, ...SKIN_LIGHT, ...SKIN_MID, ...SKIN_DARK]);
  if (g === 'l') return rng.chance(0.92) ? rng.pick(SKIN_LIGHT) : rng.pick(SKIN_MID);
  if (nat === 'SEN' || nat === 'NGA') return rng.chance(0.9) ? rng.pick(SKIN_DARK) : rng.pick(SKIN_MID);
  if (nat === 'BRA') return rng.pick([...SKIN_LIGHT, ...SKIN_MID, ...SKIN_DARK]);
  if (nat === 'FRA' || nat === 'ENG' || nat === 'NED' || nat === 'BEL') {
    const r = rng.next();
    return r < 0.7 ? rng.pick(SKIN_LIGHT) : r < 0.82 ? rng.pick(SKIN_MID) : rng.pick(SKIN_DARK);
  }
  if (nat === 'ESP' || nat === 'ITA' || nat === 'POR' || nat === 'ARG') return rng.chance(0.75) ? rng.pick(SKIN_LIGHT) : rng.pick(SKIN_MID);
  const r = rng.next();
  return r < 0.85 ? rng.pick(SKIN_LIGHT) : r < 0.93 ? rng.pick(SKIN_MID) : rng.pick(SKIN_DARK);
}

export function marketValue(ovr, age, pot) {
  let v = Math.pow(10, (ovr - 45) / 11.5) * 20000;
  if (age < 24) v *= 1 + Math.max(0, pot - ovr) * 0.035;
  if (age > 29) v *= Math.max(0.15, 1 - (age - 29) * 0.14);
  if (v > 1e6) return Math.round(v / 1e5) * 1e5;
  return Math.round(v / 1e4) * 1e4;
}

export function generatePlayer(rng, id, pos, targetOvr, age, country, clubRep = 60, real = null) {
  const nat = real ? real.nat : pickNation(rng, country);
  const N = NATIONS[nat] || NATIONS.GER;
  const attrs = {};
  const w = POS_WEIGHTS[pos];
  const isGK = pos === 'TW';
  for (const [k] of OUTFIELD_ATTRS) {
    let off;
    if (isGK) off = (k === 'kraft' || k === 'sprungkraft') ? -5 : (k === 'passspiel' ? -25 : -35);
    else off = w[k] ? 2 + w[k] * 3 : -10;
    attrs[k] = targetOvr + off + rng.normal(0, 6);
  }
  for (const [k] of GK_ATTRS) {
    attrs[k] = isGK ? targetOvr + (w[k] ? 2 : -6) + rng.normal(0, 5) : rng.range(8, 22);
  }
  // Physical archetypes: some fast, some strong
  if (!isGK && rng.chance(0.25)) { attrs.tempo += 8; attrs.beschleunigung += 8; attrs.kraft -= 5; }
  else if (!isGK && rng.chance(0.2)) { attrs.kraft += 8; attrs.kopfball += 5; attrs.tempo -= 5; }
  // Age effects on physicals
  if (age > 30) { attrs.tempo -= (age - 30) * 2; attrs.beschleunigung -= (age - 30) * 2; attrs.ausdauer -= (age - 30) * 1.5; }
  // Normalise to target overall
  for (let iter = 0; iter < 3; iter++) {
    for (const k in attrs) attrs[k] = clamp(Math.round(attrs[k]), 5, 99);
    const o = computeOverall(attrs, pos);
    const diff = targetOvr - o;
    if (Math.abs(diff) < 1) break;
    for (const k in w) attrs[k] += diff;
  }
  for (const k in attrs) attrs[k] = clamp(Math.round(attrs[k]), 5, 99);
  const ovr = computeOverall(attrs, pos);
  let pot = ovr;
  if (age < 25) pot = clamp(Math.round(ovr + rng.range(2, 6) * (25 - age) * 0.8 + rng.normal(0, 3)), ovr, 96);
  else if (age < 28) pot = ovr + rng.int(0, 3);
  const [personality, professionalism] = rng.pick(PERSONALITIES);
  const value = marketValue(ovr, age, pot);
  const wageFactor = 0.14 + clubRep / 600;
  const height = Math.round(clamp(rng.normal(isGK ? 190 : pos === 'IV' ? 187 : pos === 'ST' ? 183 : 179, 5), 165, 202));
  return {
    id, firstName: real ? real.first : rng.pick(N.first), lastName: real ? real.last : rng.pick(N.last), nation: nat, real: !!real, age, pos,
    attrs, ovr, pot, value,
    wage: Math.max(24000, Math.round(Math.min(value * wageFactor, 8e6 + value * 0.08) / 1000) * 1000),
    contract: rng.int(1, 5), fitness: 100, morale: rng.int(60, 90), form: rng.int(55, 80),
    personality, professionalism: clamp(professionalism + rng.int(-10, 10), 10, 99),
    looks: { skin: skinFor(rng, nat), hair: rng.pick(HAIR_COLORS), hairStyle: rng.int(0, 4), height, beard: rng.chance(0.3) },
    number: 0, injury: 0, suspension: 0, yellow: 0,
    stats: { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, rating: 0 },
    clubId: null,
  };
}

function squadOvr(rng, rep, idx, pos) {
  const mean = 44 + rep * 0.39;
  const firstChoice = { TW: 0, IV: 2, LV: 1, RV: 1, DM: 1, ZM: 2, OM: 1, LM: 1, RM: 1, LA: 1, RA: 1, ST: 1 };
  return { mean, fc: firstChoice[pos] };
}

export function generateWorld(seed = (Math.random() * 1e9) | 0) {
  const rng = new RNG(seed);
  const world = { version: 1, seed, season: 2026, week: 0, userClubId: null, leagues: [], clubs: {}, players: {}, news: [], history: [], nextPlayerId: 1 };
  let clubId = 1;
  for (const L of LEAGUES) clubId = buildLeague(world, L, rng, clubId);
  migrateWorld(world);
  createCups(world, rng);
  ensureClubAI(world, rng);
  updateValues(world);
  return world;
}

/** v5.0: old saves get the leagues added later (Eredivisie, Liga Portugal, Süper Lig, Premiership) at the next season start. */
export function addMissingLeagues(world, rng) {
  const added = [];
  let id = Math.max(0, ...Object.keys(world.clubs).map(Number)) + 1;
  for (const L of LEAGUES) {
    if (world.leagues.some((l) => l.id === L.id)) continue;
    id = buildLeague(world, L, rng, id);
    added.push(L.name);
  }
  if (added.length) ensureClubAI(world, rng);
  return added;
}

function buildLeague(world, L, rng, clubId) {
  {
    const league = { id: L.id, name: L.name, country: L.country, tier: L.tier, promo: L.promo, releg: L.releg, upper: L.upper, lower: L.lower, tv: L.tv, clubIds: [], fixtures: [] };
    for (const [name, short, rep, fixedKit, stadiumName, stadiumCap] of L.clubs) {
      const kit = fixedKit || KIT_COLORS[(clubId * 7 + short.charCodeAt(0)) % KIT_COLORS.length];
      const away = KIT_COLORS[(clubId * 13 + 5) % KIT_COLORS.length];
      const capacity = Math.round((6000 + Math.pow(rep / 100, 2.4) * 78000) / 500) * 500;
      const club = {
        id: clubId, name, short, rep, leagueId: L.id,
        colors: { primary: kit[0], secondary: kit[1], shorts: kit[2], socks: kit[3] },
        away: { primary: away[0], secondary: away[1], shorts: away[2], socks: away[3] },
        stadium: { name: stadiumName || name.split(' ').slice(-1)[0] + '-Arena', capacity: stadiumCap || capacity, level: 1 + Math.floor(rep / 25) },
        budget: Math.round(Math.pow(rep / 100, 3) * L.tv * 1.6e6 / 1e5) * 1e5 + 500000,
        wageBudget: 0, squad: [], tactic: defaultTactic(rng, rep), lineup: null,
        stats: { titles: 0 }, history: [],
        info: { founded: CLUB_INFO[short]?.founded ?? CLUB_FOUNDED[short] ?? null, titles: CLUB_INFO[short]?.titles ?? null },
      };
      const used = new Set();
      const add = (p, num) => {
        p.clubId = club.id;
        while (!num || used.has(num)) num = rng.int(2, 45);
        used.add(num); p.number = num;
        world.players[p.id] = p; club.squad.push(p.id);
      };
      const real = REAL_SQUADS[short];
      if (real && real.length >= 15) {
        const mean = 44 + rep * 0.39;
        const CYCLE = { G: ['TW'], D: ['IV', 'IV', 'LV', 'RV', 'IV', 'LV', 'RV', 'IV'], M: ['ZM', 'DM', 'OM', 'LM', 'RM', 'ZM', 'DM', 'ZM', 'OM', 'RM', 'LM'], F: ['ST', 'LA', 'RA', 'ST', 'LA', 'RA', 'ST'] };
        const STARTERS = { G: 1, D: 4, M: 4, F: 3 };
        const HINT = { D: { 2: 'RV', 3: 'LV', 4: 'IV', 5: 'IV', 15: 'IV', 22: 'RV', 23: 'IV' }, M: { 6: 'DM', 8: 'ZM', 10: 'OM', 16: 'DM', 18: 'ZM' }, F: { 9: 'ST', 7: 'RA', 11: 'LA', 19: 'ST', 14: 'LA', 17: 'RA' } };
        const groups = { G: [], D: [], M: [], F: [] };
        real.forEach((r) => groups[r[2]].push(r));
        for (const g of 'GDMF') {
          groups[g].sort((a, b) => (a[0] || 99) - (b[0] || 99));
          groups[g].forEach((r, i) => {
            const [num, full, , nat] = r;
            let pos = HINT[g]?.[num] || CYCLE[g][i % CYCLE[g].length];
            const st = STARTERS[g];
            let target = mean + (i < st ? 3.5 : i < st * 2 ? -0.5 : -5) + rng.normal(0, 3);
            let age = clamp(Math.round(rng.normal(i < st ? 27 : 25, 3.5)), 18, 36);
            if (i >= st * 2 && num >= 30) { age = rng.int(17, 21); target -= 3; }
            const star = STARS[full];
            if (star) { pos = star[0]; target = star[1]; age = star[2]; } else target = Math.min(target, 83);
            let sp = full.indexOf(' ');
            if (/ (Júnior|Junior|Jr\.?|Neto|Filho)$/.test(full) && full.split(' ').length === 2) sp = -1; // "Vinícius Júnior" stays whole
            const first = sp > 0 ? full.slice(0, sp) : '';
            const last = sp > 0 ? full.slice(sp + 1) : full;
            add(generatePlayer(rng, world.nextPlayerId++, pos, Math.round(clamp(target, 35, 94)), age, L.country, rep, { nat, first, last }), num);
          });
        }
        // Fill thin position groups with generated youngsters
        const need = { TW: 2, IV: 3, LV: 1, RV: 1, ZM: 2, ST: 1 };
        for (const [pos, n] of Object.entries(need)) {
          let have = club.squad.filter((id) => world.players[id].pos === pos).length;
          while (have++ < n) add(generatePlayer(rng, world.nextPlayerId++, pos, Math.round(clamp(mean - 6 + rng.normal(0, 3), 35, 90)), rng.int(17, 21), L.country, rep), pos === 'TW' ? 40 : 0);
        }
      } else SQUAD_TEMPLATE.forEach((pos, idx) => {
        const count = SQUAD_TEMPLATE.slice(0, idx).filter((p) => p === pos).length;
        const { mean, fc } = squadOvr(rng, rep, idx, pos);
        const starter = count < Math.max(1, fc);
        let age = clamp(Math.round(rng.normal(26, 4)), 17, 36);
        let target = mean + (starter ? 3 : -3) + rng.normal(0, 3.5);
        if (!starter && rng.chance(0.3)) { age = rng.int(17, 20); target -= 6; }
        const p = generatePlayer(rng, world.nextPlayerId++, pos, Math.round(clamp(target, 35, 94)), age, L.country, rep);
        add(p, pos === 'TW' ? (count === 0 ? 1 : count === 1 ? 12 : 30 + count) : rng.int(2, 40));
      });
      club.wageBudget = Math.round(club.squad.reduce((s, id) => s + world.players[id].wage, 0) * 1.1);
      world.clubs[club.id] = club;
      league.clubIds.push(club.id);
      clubId++;
    }
    league.fixtures = leagueFixtures(league, rng);
    world.leagues.push(league);
  }
  return clubId;
}
