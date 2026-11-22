import { generateWorld } from '../src/data/generator.js';
import { ensureLineup } from '../src/match/tactics.js';
import { MatchEngine } from '../src/match/engine.js';
const world = generateWorld(12345);
const stat = {};
for (let i = 0; i < 4; i++) {
  const ids = world.leagues[0].clubIds;
  const h = world.clubs[ids[i]], a = world.clubs[ids[i + 6]];
  const e = new MatchEngine({ home: h, away: a, db: world.players, homeLineup: ensureLineup(h, world.players), awayLineup: ensureLineup(a, world.players), seed: i });
  // record risk vs outcome buckets for ground passes
  const reg = e.registerPass.bind(e);
  e.registerPass = (p, r, tx, tz) => { const est = p.action?.estRisk; reg(p, r, tx, tz); e.pass.est = est; };
  const rec = e.receive.bind(e);
  e.receive = (p) => { const ps = e.pass; if (ps && ps.est != null && ps.from !== p) { const k = ps.kind + '_' + Math.min(9, Math.floor(ps.est * 10)); stat[k] = stat[k] || [0, 0]; stat[k][p.team === ps.team ? 0 : 1]++; } return rec(p); };
  while (!e.runSteps(1000));
}
for (const k of Object.keys(stat).sort()) console.log(k, stat[k], (stat[k][0] / (stat[k][0] + stat[k][1]) * 100).toFixed(0) + '%');
