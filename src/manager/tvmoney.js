// v7.0.6: TV money – the league pool is split like real distribution keys (DFL style):
// 45 % equal share, 35 % performance (5-year ranking), 15 % reach & interest (reputation),
// 5 % youth (young home-grown players). On top: Topspiel bonus for the matchday's TV highlight
// and international TV marketing for clubs in Europe. Paid weekly, shown in the finances.
import { wScale } from './gender.js';

const KEYS = [['sockel', 'Sockelbetrag (gleich für alle)', 0.45], ['leistung', 'Leistung (5-Jahres-Wertung)', 0.35], ['interesse', 'Reichweite & Interesse', 0.15], ['nachwuchs', 'Nachwuchs (junge Eigengewächse)', 0.05]];
export const TV_KEYS = KEYS;
const EURO_TV = { cl: 0.35, el: 0.12, ecl: 0.06 }; // in units of the league's per-club TV figure

/** remembers the final league position (for the 5-year ranking) – called at season end */
export function recordTvRank(club, league, rank) {
  const n = league.clubIds.length;
  // normalised score 0..1, the higher division always ranks above the lower one
  const score = (n - rank) / Math.max(1, n - 1) + (4 - (league.tier || 1)) * 1.0;
  club.tvRanks = [...(club.tvRanks || []), score].slice(-5);
}

function fiveYear(world, club) {
  const r = club.tvRanks?.length ? club.tvRanks : null;
  if (!r) return club.rep / 100 + (4 - (world.leagues.find((l) => l.id === club.leagueId)?.tier || 1)); // no history yet: reputation
  // weighted like the DFL: newer seasons count more (5-4-3-2-1)
  let s = 0, wsum = 0; r.forEach((v, i) => { const w = i + 1; s += v * w; wsum += w; });
  return s / wsum;
}

/** Season shares of every club in a league (cached per season). */
export function tvTable(world, league) {
  if (league._tv?.season === world.season && league._tv.n === league.clubIds.length) return league._tv.rows;
  const unit = (league.tv || 0) * 1e6;

  const clubs = league.clubIds.map((id) => world.clubs[id]).filter(Boolean);
  const pool = clubs.reduce((a, c) => a + unit * (0.3 + 0.55 * (c.rep / 100)), 0); // same total as before, newly distributed
  const n = clubs.length || 1;
  const perf = clubs.map((c) => ({ c, v: fiveYear(world, c) })).sort((a, b) => b.v - a.v);
  const perfW = new Map(perf.map((x, i) => [x.c.id, n - i])); const perfSum = (n * (n + 1)) / 2;
  const intW = new Map(clubs.map((c) => [c.id, Math.pow(c.rep, 3)])); const intSum = [...intW.values()].reduce((a, b) => a + b, 0) || 1;
  const yW = new Map(clubs.map((c) => [c.id, 1 + c.squad.filter((id) => { const p = world.players[id]; return p && p.age <= 23 && p.nation === league.country; }).length]));
  const ySum = [...yW.values()].reduce((a, b) => a + b, 0) || 1;
  const rows = clubs.map((c) => {
    const parts = {
      sockel: (pool * KEYS[0][2]) / n,
      leistung: (pool * KEYS[1][2] * perfW.get(c.id)) / perfSum,
      interesse: (pool * KEYS[2][2] * intW.get(c.id)) / intSum,
      nachwuchs: (pool * KEYS[3][2] * yW.get(c.id)) / ySum,
    };
    const euro = (world.cups || []).filter((k) => k.type === 'euro' && k.season === world.season && k.entrants?.includes(c.id)).reduce((a, k) => a + unit * (EURO_TV[k.id] || 0.06), 0);
    if (euro) parts.international = euro;
    for (const k in parts) parts[k] *= wScale(c);
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    return { id: c.id, parts, total, perfRank: perf.findIndex((x) => x.c.id === c.id) + 1 };
  }).sort((a, b) => b.total - a.total);
  rows.forEach((r, i) => (r.rank = i + 1));
  league._tv = { season: world.season, n: league.clubIds.length, rows };
  return rows;
}

export const tvShare = (world, club, league) => tvTable(world, league).find((r) => r.id === club.id) || { parts: {}, total: 0, rank: 0 };

/** The matchday's TV highlight in a league: the fixture with the most combined reputation. */
export function topGameOf(world, league, week = world.week) {
  const fx = (league.fixtures?.[week] || []).filter((f) => f.h != null && f.a != null);
  let best = null, bs = -1;
  for (const f of fx) { const s = (world.clubs[f.h]?.rep || 0) + (world.clubs[f.a]?.rep || 0); if (s > bs) { bs = s; best = f; } }
  return best;
}
export const topGameBonus = (league) => Math.round(((league.tv || 0) * 1e6 * 0.006) / 1e4) * 1e4;
