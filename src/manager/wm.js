// v5.1: FIFA World Cup 2026 mode – the real tournament (48 teams, groups A–L from the draw of 5 Dec 2025,
// hosts USA/Mexico/Canada): pick a nation, nominate 26 players, play every match live in 3D or instantly.
// Group stage (3 matchdays) → round of 32 (top two + 8 best third-placed) → round of 16 → QF → SF → final.
import { RNG, clamp } from '../core/rng.js';
import { generateWorld, generatePlayer } from '../data/generator.js';
import { NATIONS } from '../data/names.js';
import { defaultTactic, ensureLineup, teamStrength } from '../match/tactics.js';
import { NATION_BASE } from './nationals.js';
import { WM_LOGOS } from '../data/wmLogos.js';

export const WM_GROUPS = {
  A: ['MEX', 'RSA', 'KOR', 'CZE'], B: ['SUI', 'CAN', 'BIH', 'QAT'], C: ['BRA', 'MAR', 'SCO', 'HAI'], D: ['USA', 'AUS', 'PAR', 'TUR'],
  E: ['GER', 'CIV', 'ECU', 'CUW'], F: ['NED', 'JPN', 'SWE', 'TUN'], G: ['BEL', 'EGY', 'IRN', 'NZL'], H: ['ESP', 'CPV', 'URU', 'KSA'],
  I: ['FRA', 'NOR', 'SEN', 'IRQ'], J: ['ARG', 'AUT', 'ALG', 'JOR'], K: ['COL', 'POR', 'COD', 'UZB'], L: ['ENG', 'CRO', 'GHA', 'PAN'],
};
// German name, shirt, secondary/shorts colour
export const WM_NATIONS = {
  MEX: ['Mexiko', '#006847', '#ffffff'], RSA: ['Südafrika', '#ffb612', '#007749'], KOR: ['Südkorea', '#c60c30', '#ffffff'], CZE: ['Tschechien', '#d7141a', '#ffffff'],
  SUI: ['Schweiz', '#d52b1e', '#ffffff'], CAN: ['Kanada', '#d80621', '#ffffff'], BIH: ['Bosnien-Herzegowina', '#002395', '#fecb00'], QAT: ['Katar', '#8a1538', '#ffffff'],
  BRA: ['Brasilien', '#fedf00', '#009b3a'], MAR: ['Marokko', '#c1272d', '#006233'], SCO: ['Schottland', '#0b2a5b', '#ffffff'], HAI: ['Haiti', '#00209f', '#d21034'],
  USA: ['USA', '#ffffff', '#0a3161'], AUS: ['Australien', '#ffcd00', '#00843d'], PAR: ['Paraguay', '#d52b1e', '#ffffff'], TUR: ['Türkei', '#e30a17', '#ffffff'],
  GER: ['Deutschland', '#ffffff', '#111111'], CIV: ['Elfenbeinküste', '#f77f00', '#009e60'], ECU: ['Ecuador', '#ffdd00', '#034ea2'], CUW: ['Curaçao', '#002b7f', '#f9e814'],
  NED: ['Niederlande', '#f36c21', '#111111'], JPN: ['Japan', '#0a2a8c', '#ffffff'], SWE: ['Schweden', '#fecc00', '#006aa7'], TUN: ['Tunesien', '#e70013', '#ffffff'],
  BEL: ['Belgien', '#c8102e', '#111111'], EGY: ['Ägypten', '#c8102e', '#ffffff'], IRN: ['Iran', '#ffffff', '#da0000'], NZL: ['Neuseeland', '#ffffff', '#111111'],
  ESP: ['Spanien', '#c60b1e', '#ffc400'], CPV: ['Kap Verde', '#003893', '#ffffff'], URU: ['Uruguay', '#5cbfeb', '#111111'], KSA: ['Saudi-Arabien', '#ffffff', '#006c35'],
  FRA: ['Frankreich', '#002395', '#ffffff'], NOR: ['Norwegen', '#ba0c2f', '#ffffff'], SEN: ['Senegal', '#ffffff', '#00853f'], IRQ: ['Irak', '#007a3d', '#ffffff'],
  ARG: ['Argentinien', '#75aadb', '#ffffff'], AUT: ['Österreich', '#ed2939', '#ffffff'], ALG: ['Algerien', '#ffffff', '#006233'], JOR: ['Jordanien', '#ffffff', '#ce1126'],
  COL: ['Kolumbien', '#fcd116', '#003893'], POR: ['Portugal', '#c8102e', '#046a38'], COD: ['DR Kongo', '#007fff', '#ce1021'], UZB: ['Usbekistan', '#ffffff', '#1eb53a'],
  ENG: ['England', '#ffffff', '#00247d'], CRO: ['Kroatien', '#ff0000', '#ffffff'], GHA: ['Ghana', '#ffffff', '#111111'], PAN: ['Panama', '#d21034', '#ffffff'],
};
const LEVEL = { HAI: 64, CUW: 65, JOR: 66, UZB: 69, NZL: 66, CPV: 67, QAT: 67, IRQ: 67, KSA: 69, PAN: 68, RSA: 69, BIH: 72, IRN: 73, COD: 71, GHA: 72, TUN: 71, CZE: 74, AUS: 72 };
const HOSTS = ['USA', 'MEX', 'CAN'];
export const WM_ROUNDS = ['1. Spieltag', '2. Spieltag', '3. Spieltag', 'Sechzehntelfinale', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'];
const VENUES = ['Estadio Azteca, Mexiko-Stadt', 'MetLife Stadium, New York/New Jersey', 'SoFi Stadium, Los Angeles', 'AT&T Stadium, Dallas', 'Arrowhead Stadium, Kansas City', 'NRG Stadium, Houston', 'Mercedes-Benz Stadium, Atlanta', 'Lincoln Financial Field, Philadelphia', 'Hard Rock Stadium, Miami', 'Gillette Stadium, Boston', "Levi's Stadium, San Francisco", 'Lumen Field, Seattle', 'BMO Field, Toronto', 'BC Place, Vancouver', 'Estadio Akron, Guadalajara', 'Estadio BBVA, Monterrey'];
const PAIRS = [[[0, 1], [2, 3]], [[0, 2], [3, 1]], [[3, 0], [1, 2]]];

export const isWM = (w) => w?.mode === 'wm';
export const wmLevel = (n) => LEVEL[n] ?? NATION_BASE[n] ?? 70;
const natClub = (w, n) => w.clubs[w.wm.ids[n]];

/** Builds the world for the World Cup mode: real players from all leagues, missing spots filled per nation. */
export function createWM(nat, seed = (Math.random() * 1e9) | 0) {
  const w = generateWorld(seed);
  const rng = new RNG(seed + 26);
  w.mode = 'wm';
  const byNat = {};
  for (const p of Object.values(w.players)) if (p.clubId != null && !p.youthOf) (byNat[p.nation] ||= []).push(p);
  const ids = {};
  let id = 9000;
  const league = { id: 'wm', name: 'WM 2026', country: 'WM', tier: 0, promo: 0, releg: 0, clubIds: [], fixtures: [] };
  for (const g of Object.keys(WM_GROUPS)) for (const n of WM_GROUPS[g]) {
    const [name, c1, c2] = WM_NATIONS[n];
    const lvl = wmLevel(n);
    const club = { id, name, short: n, rep: lvl, leagueId: 'wm', national: true, crest: WM_LOGOS[n], group: g,
      colors: { primary: c1, secondary: c2, shorts: c2, socks: c1 }, away: { primary: c2, secondary: c1, shorts: c1, socks: c2 },
      stadium: { name: VENUES[id % VENUES.length], capacity: 70000, level: 5 }, budget: 0, wageBudget: 0,
      squad: [], tactic: defaultTactic(rng, lvl), lineup: null, stats: { titles: 0 }, history: [], facilities: { training: 3, youth: 3, medical: 3 } };
    // the 26 best real players of this nation, then generated players for the gaps (by position)
    const pool = (byNat[n] || []).sort((a, b) => b.ovr - a.ovr);
    const pick = [];
    const want = { TW: 3, D: 8, M: 8, F: 6 };
    const grp = (pos) => (pos === 'TW' ? 'TW' : ['IV', 'LV', 'RV'].includes(pos) ? 'D' : ['ST', 'LA', 'RA'].includes(pos) ? 'F' : 'M');
    const have = { TW: 0, D: 0, M: 0, F: 0 };
    for (const p of pool) { const k = grp(p.pos); if (have[k] < want[k] + 2 && pick.length < 26) { pick.push(p); have[k]++; } }
    const FILL = { TW: ['TW'], D: ['IV', 'LV', 'RV', 'IV'], M: ['ZM', 'DM', 'OM', 'LM', 'RM'], F: ['ST', 'LA', 'RA'] };
    for (const k of ['TW', 'D', 'M', 'F']) {
      let i = 0;
      while (have[k] < want[k] && pick.length < 26) {
        const pos = FILL[k][i++ % FILL[k].length];
        const p = generatePlayer(rng, w.nextPlayerId++, pos, Math.round(clamp(lvl - 6 + rng.normal(0, 3), 45, 86)), rng.int(20, 32), 'DE', lvl * 0.9);
        const N = NATIONS[n];
        if (N) { p.firstName = N.first[rng.int(0, N.first.length - 1)]; p.lastName = N.last[rng.int(0, N.last.length - 1)]; }
        p.nation = n; p.clubId = id; p.wmOnly = true;
        w.players[p.id] = p; pick.push(p); have[k]++;
      }
    }
    club.squad = pick.map((p) => p.id);
    // every player gets his shirt number for the tournament
    const used = new Set();
    const gk = pick.find((p) => p.pos === 'TW');
    if (gk) { gk.wmNumber = 1; used.add(1); }
    for (const p of pick) { if (p === gk) continue; let num = p.number >= 2 && p.number <= 26 && !used.has(p.number) ? p.number : 0; for (let k = 2; !num && k <= 99; k++) if (!used.has(k)) num = k; used.add(num); p.wmNumber = num; }
    w.clubs[id] = club; league.clubIds.push(id); ids[n] = id; id++;
  }
  w.leagues.push(league);
  w.wm = { nat, ids, round: 0, groups: Object.fromEntries(Object.entries(WM_GROUPS).map(([g, t]) => [g, { teams: t, games: [] }])), ko: [], goals: {}, done: false, champion: null, log: [] };
  w.userClubId = ids[nat];
  w.manager = { name: 'Nationaltrainer', goal: 'Weltmeister', wm: true };
  for (const n of Object.keys(ids)) ensureLineup(natClub(w, n), w.players);
  return w;
}

/** Group table with points, goal difference, goals. */
export function wmTable(w, g) {
  const G = w.wm.groups[g];
  const r = Object.fromEntries(G.teams.map((n) => [n, { nat: n, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const m of G.games) {
    const A = r[m.h], B = r[m.a]; A.p++; B.p++; A.gf += m.hg; A.ga += m.ag; B.gf += m.ag; B.ga += m.hg;
    if (m.hg > m.ag) { A.w++; B.l++; A.pts += 3; } else if (m.hg < m.ag) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
  }
  return Object.values(r).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || wmLevel(y.nat) - wmLevel(x.nat));
}

/** All fixtures of the current round: [{ h, a, group?, tie? }] as nation codes. */
export function roundFixtures(w) {
  const W = w.wm, r = W.round;
  if (r <= 2) return Object.entries(W.groups).flatMap(([g, G]) => PAIRS[r].map(([i, j]) => ({ h: G.teams[i], a: G.teams[j], group: g })));
  const K = W.ko[r - 3];
  return K ? K.ties.map((t, i) => ({ h: t.h, a: t.a, tie: i })) : [];
}
export const userFixtureWM = (w) => (w.wm.done ? null : roundFixtures(w).find((f) => f.h === w.wm.nat || f.a === w.wm.nat) || null);
export const isPlayed = (w, f) => (f.group ? w.wm.groups[f.group].games.some((m) => m.h === f.h && m.a === f.a) : w.wm.ko[w.wm.round - 3]?.ties[f.tie]?.winner != null);

function strength(w, n) { const c = natClub(w, n); ensureLineup(c, w.players); return teamStrength(c, w.players) + (HOSTS.includes(n) ? 1.5 : 0); }

function scorers(w, rng, n, goals) {
  const c = natClub(w, n), xi = (c.lineup?.xi || c.squad.slice(0, 11)).map((id) => w.players[id]).filter(Boolean);
  const W = { ST: 10, LA: 6, RA: 6, OM: 5, LM: 3, RM: 3, ZM: 2, DM: 1, IV: 0.8, LV: 0.7, RV: 0.7, TW: 0 };
  const out = [];
  for (let i = 0; i < goals; i++) { const p = rng.weighted(xi, (q) => (W[q.pos] ?? 1) * (q.ovr / 80) ** 3); if (p) out.push(p.id); }
  return out;
}

/** Penalty shoot-out for a drawn knock-out match (also after a live 3D match). */
export function shootout(w, rng, h, a) {
  const sh = strength(w, h), sa = strength(w, a);
  let x = 0, y = 0;
  for (let k = 0; k < 5; k++) { if (rng.chance(clamp(0.76 + (sh - sa) * 0.004, 0.6, 0.9))) x++; if (rng.chance(clamp(0.76 + (sa - sh) * 0.004, 0.6, 0.9))) y++; }
  while (x === y) { if (rng.chance(0.75)) x++; if (rng.chance(0.75)) y++; }
  return { x, y, winner: x > y ? h : a };
}

export function simWM(w, rng, f, ko) {
  const sh = strength(w, f.h), sa = strength(w, f.a);
  const lh = clamp(1.3 * Math.exp((sh - sa) * 0.08), 0.15, 4.5), la = clamp(1.3 * Math.exp((sa - sh) * 0.08), 0.15, 4.5);
  let hg = rng.poisson(lh), ag = rng.poisson(la), note = '';
  const sc = scorers(w, rng, f.h, hg).concat(scorers(w, rng, f.a, ag));
  if (ko && hg === ag) {
    const eh = rng.poisson(lh * 0.3), ea = rng.poisson(la * 0.3); hg += eh; ag += ea; sc.push(...scorers(w, rng, f.h, eh), ...scorers(w, rng, f.a, ea)); note = ' n. V.';
    if (hg === ag) { const s = shootout(w, rng, f.h, f.a); return { hg, ag, note: ` n. V., ${s.x}:${s.y} i. E.`, winner: s.winner, scorers: sc }; }
  }
  return { hg, ag, note, winner: hg > ag ? f.h : hg < ag ? f.a : null, scorers: sc };
}

/** Books a result (from a simulation or the user's live match). */
export function bookWM(w, f, res) {
  const W = w.wm;
  for (const id of res.scorers || []) W.goals[id] = (W.goals[id] || 0) + 1;
  if (f.group) W.groups[f.group].games.push({ h: f.h, a: f.a, hg: res.hg, ag: res.ag });
  else Object.assign(W.ko[W.round - 3].ties[f.tie], { hg: res.hg, ag: res.ag, note: res.note || '', winner: res.winner });
}

/** Simulates the rest of the round and moves on. Returns a short news line about the user's nation. */
export function finishRound(w, rng) {
  const W = w.wm, ko = W.round >= 3;
  for (const f of roundFixtures(w)) if (!isPlayed(w, f)) bookWM(w, f, simWM(w, rng, f, ko));
  // fitness: players recover between matches
  for (const n of Object.keys(W.ids)) for (const id of natClub(w, n).squad) { const p = w.players[id]; if (p) p.fitness = clamp((p.fitness ?? 100) + 30, 0, 100); }
  if (W.round === 2) buildR32(w, rng);
  else if (W.round >= 3) {
    const winners = W.ko[W.round - 3].ties.map((t) => t.winner);
    if (winners.length === 1) { W.done = true; W.champion = winners[0]; const t = W.ko[W.round - 3].ties[0]; W.runnerUp = t.winner === t.h ? t.a : t.h; return; }
    const ties = []; for (let i = 0; i < winners.length; i += 2) ties.push({ h: winners[i], a: winners[i + 1] });
    W.ko.push({ name: WM_ROUNDS[W.round + 1], ties });
  }
  W.round++;
  if (!W.out && W.round >= 3 && !roundFixtures(w).some((f) => f.h === W.nat || f.a === W.nat)) W.out = WM_ROUNDS[Math.min(W.round - 1, 7)];
}

function buildR32(w, rng) {
  const W = w.wm, tabs = Object.keys(W.groups).map((g) => wmTable(w, g));
  W.thirds = tabs.map((t, i) => ({ ...t[2], group: Object.keys(W.groups)[i] })).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
  const thirds = W.thirds.slice(0, 8).map((r) => r.nat);
  const firsts = tabs.map((t) => t[0].nat), seconds = tabs.map((t) => t[1].nat);
  // group winners meet runners-up of other groups or third-placed teams; no rematch of the same group
  const rest = [...seconds.slice(6), ...seconds.slice(0, 6).reverse(), ...thirds].map((n) => n);
  const ties = [];
  const groupOf = (n) => Object.keys(WM_GROUPS).find((g) => WM_GROUPS[g].includes(n));
  for (const f of firsts) { let k = rest.findIndex((n) => groupOf(n) !== groupOf(f)); if (k < 0) k = 0; ties.push({ h: f, a: rest.splice(k, 1)[0] }); }
  while (rest.length) ties.push({ h: rest.shift(), a: rest.pop() });
  // spread the group winners over both halves of the bracket
  const top = ties.slice(0, 12), low = ties.slice(12), out = [];
  for (let i = 0; i < 4; i++) out.push(top[i], low[i], top[i + 4], top[i + 8]);
  W.ko.push({ name: WM_ROUNDS[3], ties: out });
}

export function topScorers(w, n = 10) {
  return Object.entries(w.wm.goals).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, g]) => ({ p: w.players[id], g }));
}
