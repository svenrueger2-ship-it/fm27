// National teams (v0.9): every nation is built from the real players in the game (missing spots are
// filled up to the nation's real level), a world ranking (Elo), international breaks during the season
// with call-ups, caps, goals, fatigue and injury risk – and the big summer tournaments:
// EURO 2028 (24 teams) and World Cup 2030 (48 teams), each with group stage and knock-out rounds.
import { clamp } from '../core/rng.js';
import { news } from './transfers.js';
import { natSquad, natCoachBonus } from './career.js';

// real-world level (approx. FIFA strength 2026) – used to fill squads that have few players in our leagues
export const NATION_BASE = {
  ESP: 87, ARG: 86, FRA: 86, ENG: 85, BRA: 84, POR: 84, NED: 82, GER: 82, BEL: 80, ITA: 80, CRO: 79, URU: 79, COL: 78, MAR: 78,
  JPN: 77, SUI: 77, DEN: 77, AUT: 77, USA: 76, SEN: 76, NOR: 76, TUR: 76, MEX: 75, ECU: 75, KOR: 74, SRB: 74, UKR: 74, POL: 74, SWE: 74, CIV: 74,
  NGA: 73, HUN: 73, CZE: 73, IRN: 72, CAN: 72, ALG: 72, EGY: 72, SCO: 72, PAR: 72, GRE: 72, AUS: 71, CMR: 71, SVK: 71, ROU: 71, GEO: 71, MLI: 71,
  WAL: 70, GHA: 70, CHI: 70, SVN: 70, IRL: 70, ALB: 70, VEN: 70, COD: 70, TUN: 69, PER: 69, KSA: 68, BIH: 68, BFA: 68, FIN: 67, PAN: 67, RSA: 67,
  NIR: 66, ISL: 66, CRC: 66, UZB: 66, CPV: 66, QAT: 66, JAM: 65, KOS: 66, JOR: 64, NZL: 62, MKD: 65, MNE: 64, ISR: 66, BUL: 64, GUI: 67,
};
const EUROPE = new Set(['ESP', 'FRA', 'ENG', 'POR', 'NED', 'GER', 'BEL', 'ITA', 'CRO', 'SUI', 'DEN', 'AUT', 'NOR', 'TUR', 'SRB', 'UKR', 'POL', 'SWE', 'HUN', 'CZE', 'SCO', 'GRE', 'SVK', 'ROU', 'GEO', 'WAL', 'SVN', 'IRL', 'ALB', 'BIH', 'FIN', 'NIR', 'ISL', 'KOS', 'MKD', 'MNE', 'ISR', 'BUL']);
export const INTL_WEEKS = [8, 13, 24, 30];

// ------------------------------------------------------------------ squads & strength
function byNation(world) {
  const m = {};
  for (const p of Object.values(world.players)) if (p.clubId != null && !p.youthOf) (m[p.nation] ||= []).push(p);
  return m;
}
export function nationSquad(world, nat, map = byNation(world)) {
  return (map[nat] || []).filter((p) => p.injury <= 2).sort((a, b) => b.ovr - a.ovr).slice(0, 26);
}
export function nationStrength(world, nat, map = byNation(world)) {
  const base = NATION_BASE[nat] ?? 60;
  const own = world.career?.nat === nat && world.career.natSquad;
  const sq = own ? natSquad(world).sort((a, b) => b.ovr - a.ovr) : nationSquad(world, nat, map);
  const top = sq.slice(0, 11).map((p) => p.ovr);
  while (top.length < 11) top.push(base - 4);
  const blend = top.reduce((a, b) => a + b, 0) / 11;
  return Math.round((Math.max(blend, base * 0.96) + natCoachBonus(world, nat)) * 10) / 10;
}

export function ensureIntl(world) {
  if (world.intl) return world.intl;
  const map = byNation(world);
  const nats = Object.keys(NATION_BASE).filter((n) => NATION_BASE[n] >= 62);
  const elo = {};
  for (const n of nats) elo[n] = Math.round(1000 + (nationStrength(world, n, map) - 60) * 28);
  world.intl = { elo, results: [], tournaments: [], next: null };
  return world.intl;
}

export function ranking(world) {
  const I = ensureIntl(world);
  return Object.entries(I.elo).sort((a, b) => b[1] - a[1]).map(([nat, elo], i) => ({ nat, elo, rank: i + 1 }));
}

// ------------------------------------------------------------------ matches
function simIntl(world, rng, a, b, map, { ko = false } = {}) {
  const sa = nationStrength(world, a, map), sb = nationStrength(world, b, map);
  const la = clamp(1.18 * Math.exp((sa - sb) * 0.085), 0.15, 4.2), lb = clamp(1.18 * Math.exp((sb - sa) * 0.085), 0.15, 4.2);
  let ga = rng.poisson(la), gb = rng.poisson(lb), note = '';
  if (ko && ga === gb) {
    const ea = rng.poisson(la * 0.33), eb = rng.poisson(lb * 0.33); ga += ea; gb += eb; note = ' n. V.';
    if (ga === gb) { const aw = rng.chance(clamp(0.5 + (sa - sb) * 0.01, 0.35, 0.65)); note = aw ? ' n. V., 5:4 i. E.' : ' n. V., 4:5 i. E.'; return { a, b, ga, gb, note, winner: aw ? a : b, scorers: scorers(world, rng, map, a, ga).concat(scorers(world, rng, map, b, gb)) }; }
  }
  // Elo update
  const I = world.intl, ea = 1 / (1 + 10 ** ((I.elo[b] - I.elo[a]) / 400));
  const res = ga > gb ? 1 : ga < gb ? 0 : 0.5, k = ko ? 50 : 30;
  I.elo[a] = Math.round(I.elo[a] + k * (res - ea)); I.elo[b] = Math.round(I.elo[b] - k * (res - ea));
  return { a, b, ga, gb, note, winner: ga > gb ? a : ga < gb ? b : null, scorers: scorers(world, rng, map, a, ga).concat(scorers(world, rng, map, b, gb)) };
}

function scorers(world, rng, map, nat, goals) {
  const sq = nationSquad(world, nat, map).slice(0, 23);
  const out = [];
  for (let i = 0; i < goals; i++) {
    if (!sq.length || rng.chance(Math.max(0.08, 0.6 - sq.length * 0.04))) continue; // scorer from a league outside the game
    const w = { ST: 10, LA: 6, RA: 6, OM: 5, LM: 3, RM: 3, ZM: 2, DM: 1, IV: 0.8, LV: 0.7, RV: 0.7, TW: 0 };
    const p = rng.weighted(sq, (q) => (w[q.pos] ?? 1) * (q.attrs.abschluss / 70) ** 1.5 * (q.ovr / 80) ** 3);
    (p.intl ||= { caps: 0, goals: 0 }).goals++;
    out.push(p.id);
  }
  return out;
}

function capSquad(world, nat, map, rng, { fatigue = 0, injury = 0 } = {}) {
  const hurt = [];
  for (const p of nationSquad(world, nat, map).slice(0, 23)) {
    (p.intl ||= { caps: 0, goals: 0 }).caps++;
    if (fatigue) p.fitness = clamp(p.fitness - fatigue, 30, 100);
    if (injury && rng.chance(injury)) { const wks = rng.int(1, 4); p.injury = Math.max(p.injury, wks); hurt.push({ p, wks }); }
  }
  return hurt;
}

// ------------------------------------------------------------------ international breaks
export function intlBreak(world, rng) {
  if (!INTL_WEEKS.includes(world.week)) return;
  const I = ensureIntl(world), map = byNation(world);
  const nats = Object.keys(I.elo);
  const pool = nats.slice().sort(() => rng.next() - 0.5);
  const games = [];
  for (let i = 0; i + 1 < pool.length; i += 2) games.push(simIntl(world, rng, pool[i], pool[i + 1], map));
  I.results.unshift({ season: world.season, week: world.week, games: games.map((g) => ({ a: g.a, b: g.b, ga: g.ga, gb: g.gb })) });
  I.results = I.results.slice(0, 8);
  // call-ups of the user's players: caps, fatigue and injury risk
  const uc = world.clubs[world.userClubId];
  const called = [], hurt = [];
  for (const n of nats) {
    const sq = nationSquad(world, n, map).slice(0, 23);
    for (const p of sq) if (p.clubId === world.userClubId) called.push(p);
    hurt.push(...capSquad(world, n, map, rng, { fatigue: 9, injury: 0.012 }).filter((h) => h.p.clubId === world.userClubId));
  }
  if (uc && called.length) news(world, `🌍 Länderspielpause: ${called.length} Spieler von ${uc.short} sind unterwegs (${called.slice(0, 6).map((p) => `${p.lastName} ${p.nation}`).join(', ')}${called.length > 6 ? ' …' : ''}).${hurt.length ? ` Verletzt zurück: ${hurt.map((h) => `${h.p.lastName} (${h.wks} Wo.)`).join(', ')}.` : ''}`);
}

// ------------------------------------------------------------------ tournaments
export function tournamentFor(year) {
  if (year % 4 === 0) return { kind: 'em', name: `EURO ${year}`, teams: 24, host: year === 2028 ? ['ENG', 'SCO', 'WAL', 'IRL', 'NIR'] : ['ITA', 'TUR'] };
  if (year % 4 === 2) return { kind: 'wm', name: `WM ${year}`, teams: 48, host: year === 2030 ? ['ESP', 'POR', 'MAR'] : ['KSA'] };
  return null;
}
export function nextTournament(world) {
  for (let y = world.season + 1; y < world.season + 6; y++) { const t = tournamentFor(y); if (t) return { ...t, year: y }; }
  return null;
}

function groupTable(g) {
  const r = Object.fromEntries(g.teams.map((n) => [n, { nat: n, p: 0, pts: 0, gf: 0, ga: 0 }]));
  for (const m of g.games) { const A = r[m.a], B = r[m.b]; A.p++; B.p++; A.gf += m.ga; A.ga += m.gb; B.gf += m.gb; B.ga += m.ga; if (m.ga > m.gb) A.pts += 3; else if (m.ga < m.gb) B.pts += 3; else { A.pts++; B.pts++; } }
  return Object.values(r).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
}

// played at the end of a season whose summer has a tournament
export function playTournament(world, rng) {
  const year = world.season + 1, T = tournamentFor(year);
  if (!T) return null;
  const I = ensureIntl(world), map = byNation(world);
  let field = ranking(world).map((r) => r.nat);
  if (T.kind === 'em') field = field.filter((n) => EUROPE.has(n));
  const hosts = T.host.filter((h) => I.elo[h] != null);
  field = [...new Set([...hosts.slice(0, T.kind === 'em' ? 1 : 3), ...field])].slice(0, T.teams);
  const nG = T.teams / 4;
  const pots = [0, 1, 2, 3].map((k) => field.slice(k * nG, k * nG + nG).sort(() => rng.next() - 0.5));
  const groups = Array.from({ length: nG }, (_, i) => ({ name: String.fromCharCode(65 + i), teams: pots.map((p) => p[i]).filter(Boolean), games: [] }));
  const goalsBy = {};
  const count = (g) => g.scorers.forEach((id) => (goalsBy[id] = (goalsBy[id] || 0) + 1));
  for (const g of groups) {
    for (let i = 0; i < g.teams.length; i++) for (let j = i + 1; j < g.teams.length; j++) { const m = simIntl(world, rng, g.teams[i], g.teams[j], map); g.games.push({ a: m.a, b: m.b, ga: m.ga, gb: m.gb }); count(m); }
    g.table = groupTable(g);
  }
  // qualifiers: top two of every group plus the best third-placed teams
  const firsts = groups.map((g) => g.table[0].nat), seconds = groups.map((g) => g.table[1].nat);
  const koSize = T.teams === 48 ? 32 : 16;
  const thirds = groups.map((g) => g.table[2]).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga)).slice(0, koSize - firsts.length - seconds.length).map((r) => r.nat);
  let order = [];
  const rest = [...seconds, ...thirds].sort(() => rng.next() - 0.5);
  firsts.forEach((f, i) => { order.push(f, rest[i]); });
  order.push(...rest.slice(firsts.length));
  const names = koSize === 32 ? ['Sechzehntelfinale', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'] : ['Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'];
  const rounds = [];
  for (const name of names) {
    const ties = [];
    for (let i = 0; i < order.length; i += 2) { const m = simIntl(world, rng, order[i], order[i + 1], map, { ko: true }); count(m); ties.push({ a: m.a, b: m.b, ga: m.ga, gb: m.gb, note: m.note, winner: m.winner }); }
    rounds.push({ name, ties });
    order = ties.map((t) => t.winner);
  }
  const winner = order[0];
  const top = Object.entries(goalsBy).sort((a, b) => b[1] - a[1])[0];
  // caps, fatigue for the new season and honours
  for (const n of field) capSquad(world, n, map, rng, { fatigue: 0 });
  const finalTie = rounds[rounds.length - 1].ties[0];
  for (const p of nationSquad(world, winner, map).slice(0, 26)) { (p.honours ||= []).push(`${T.kind === 'wm' ? 'Weltmeister' : 'Europameister'} ${year}`); p.morale = clamp(p.morale + 12, 0, 99); p.value = Math.round(p.value * 1.08); }
  const res = { ...T, year, groups, rounds, winner, runnerUp: finalTie.winner === finalTie.a ? finalTie.b : finalTie.a, topScorer: top ? { id: +top[0], goals: top[1], name: `${world.players[top[0]]?.firstName || ''} ${world.players[top[0]]?.lastName || ''}`.trim(), nat: world.players[top[0]]?.nation } : null };
  I.tournaments.unshift(res);
  news(world, `🏆 ${T.name}: ${winner} ist ${T.kind === 'wm' ? 'Weltmeister' : 'Europameister'}! Finale ${finalTie.a} ${finalTie.ga}:${finalTie.gb}${finalTie.note} ${finalTie.b}.${res.topScorer ? ` Torschützenkönig: ${res.topScorer.name} (${res.topScorer.goals} Tore).` : ''}`);
  const mine = Object.values(world.players).filter((p) => p.clubId === world.userClubId && field.includes(p.nation) && nationSquad(world, p.nation, map).slice(0, 26).includes(p));
  if (mine.length) news(world, `🌍 Bei der ${T.name} dabei: ${mine.map((p) => `${p.lastName} (${p.nation})`).join(', ')}.`);
  return res;
}
