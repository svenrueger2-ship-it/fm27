import { generateWorld } from '../src/data/generator.js';
import { ensureLineup } from '../src/match/tactics.js';
import { MatchEngine } from '../src/match/engine.js';
const t0 = Date.now();
const world = generateWorld(12345);
console.log('world gen ms', Date.now() - t0, 'clubs', Object.keys(world.clubs).length, 'players', Object.keys(world.players).length);
const n = +process.argv[2] || 6;
let goals = 0, tot = { shots: 0, onT: 0, passes: 0, ok: 0, fouls: 0, y: 0, r: 0, corners: 0, off: 0, saves: 0 };
const types = {}; const dbg = {};
for (let i = 0; i < n; i++) {
  const ids = world.leagues[0].clubIds;
  const h = world.clubs[ids[i % ids.length]], a = world.clubs[ids[(i * 5 + 3) % ids.length]];
  const hl = ensureLineup(h, world.players), al = ensureLineup(a, world.players);
  const e = new MatchEngine({ home: h, away: a, db: world.players, homeLineup: hl, awayLineup: al, seed: 100 + i });
  e.on((ev) => { types[ev.type] = (types[ev.type] || 0) + 1; });
  const s = Date.now(); let steps = 0;
  while (!e.runSteps(600)) { steps += 600; if (steps > 200000) { console.log('STUCK', e.phase, e.time); break; } }
  const r = e.result(); for (const k in e.dbg) dbg[k] = (dbg[k] || 0) + e.dbg[k];
  goals += r.hg + r.ag;
  for (const st of r.stats) { tot.shots += st.shots; tot.onT += st.onTarget; tot.passes += st.passes; tot.ok += st.passesOk; tot.fouls += st.fouls; tot.y += st.yellow; tot.r += st.red; tot.corners += st.corners; tot.off += st.offsides; tot.saves += st.saves; }
  console.log(`${h.short} ${r.hg}:${r.ag} ${a.short}  ms=${Date.now() - s} steps=${steps} poss=${r.stats[0].possession}% shots ${r.stats[0].shots}-${r.stats[1].shots} passes ${r.stats[0].passes}/${r.stats[0].passesOk}`);
}
console.log('avg goals', (goals / n).toFixed(2));
for (const k in tot) tot[k] = (tot[k] / n).toFixed(1);
console.log('per match', tot);
console.log('events', types); for (const k in dbg) dbg[k] = +(dbg[k] / n).toFixed(1); console.log('dbg', dbg);
