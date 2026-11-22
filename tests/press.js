import { generateWorld } from '../src/data/generator.js';
import { ensureLineup, PRESETS } from '../src/match/tactics.js';
import { MatchEngine } from '../src/match/engine.js';
const world = generateWorld(12345);
const preset = process.argv[2] || 'Ausgewogen';
let ok = 0, all = 0, shots = 0, goals = 0, poss=[0,0];
for (let i = 0; i < 6; i++) {
  const ids = world.leagues[0].clubIds;
  const h = world.clubs[ids[i]], a = world.clubs[ids[i + 6]];
  h.tactic = { ...h.tactic, ...PRESETS[preset] }; a.tactic = { ...a.tactic, ...PRESETS[process.argv[3] || preset] };
  const e = new MatchEngine({ home: h, away: a, db: world.players, homeLineup: ensureLineup(h, world.players), awayLineup: ensureLineup(a, world.players), seed: i });
  while (!e.runSteps(1000));
  const r = e.result();
  for (const s of r.stats) { ok += s.passesOk; all += s.passes; shots += s.shots; }
  goals += r.hg + r.ag; poss[0]+=r.stats[0].possession;
}
console.log(preset, 'vs', process.argv[3] || preset, 'completion', (ok / all * 100).toFixed(0) + '%', 'passes/match', (all / 6).toFixed(0), 'shots', (shots / 6).toFixed(1), 'goals', (goals / 6).toFixed(2), 'homePoss', (poss[0]/6).toFixed(0));
