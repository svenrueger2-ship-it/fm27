// Analyse-Hub (v2.5): season-long data. Trends come from the fixtures; heatmap, shot map and pass
// network are accumulated from every match the user watches in 3D.
import { computeTable, userLeague } from './season.js';
import { taskEvent } from './progress.js';

export function ensureHub(world) {
  const H = world.hub;
  if (!H || H.season !== world.season) world.hub = { season: world.season, games: 0, heat: new Array(96).fill(0), shots: [], against: [], links: {}, pos: {}, xgFor: 0, xgAg: 0, poss: 0 };
  return world.hub;
}

/** Called after a live 3D match. engineTeams: [T0, T1] from the engine; userIdx = index of the user team. */
export function recordLive(world, teams, userIdx, possession) {
  const H = ensureHub(world), T = teams[userIdx], O = teams[1 - userIdx];
  if (!T?.analysis) return;
  H.games++; taskEvent(world, 'live');
  T.analysis.heat.forEach((v, i) => (H.heat[i] += v));
  for (const s of T.analysis.shots) H.shots.push({ ...s, wk: world.week + 1 });
  for (const s of O.analysis.shots) H.against.push({ ...s, wk: world.week + 1 });
  H.shots = H.shots.slice(-260); H.against = H.against.slice(-260);
  for (const [k, n] of Object.entries(T.analysis.links)) H.links[k] = (H.links[k] || 0) + n;
  for (const [id, s] of Object.entries(T.analysis.pos)) { const q = (H.pos[id] ||= { x: 0, z: 0, n: 0, name: s.name, num: s.num }); q.x += s.x; q.z += s.z; q.n += s.n; q.name = s.name; q.num = s.num; }
  H.xgFor += T.stats.xg; H.xgAg += O.stats.xg;
  if (possession != null) H.poss += possession;
}

/** Per-matchday trend of the user's league season. */
export function seasonTrend(world) {
  const L = userLeague(world), id = world.userClubId, out = [];
  let pts = 0;
  for (let k = 0; k < L.fixtures.length; k++) {
    const m = L.fixtures[k].find((x) => x.h === id || x.a === id);
    if (!m || m.hg == null) break;
    const home = m.h === id, gf = home ? m.hg : m.ag, ga = home ? m.ag : m.hg;
    pts += gf > ga ? 3 : gf === ga ? 1 : 0;
    const t = computeTable({ ...L, fixtures: L.fixtures.slice(0, k + 1) });
    out.push({ md: k + 1, gf, ga, pts, res: gf > ga ? 'S' : gf === ga ? 'U' : 'N', rank: t.findIndex((r) => r.id === id) + 1, opp: home ? m.a : m.h, home });
  }
  return { rows: out, teams: L.clubIds.length };
}
