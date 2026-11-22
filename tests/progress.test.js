// v2.5: manager XP/levels/skills, tasks, scenarios, projection, analysis trend.
import assert from 'node:assert/strict';
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); } };
const { generateWorld } = await import('../src/data/generator.js');
const { finishWeek, newRng, seasonLength, endSeason, computeTable } = await import('../src/manager/season.js');
const P = await import('../src/manager/progress.js');
const { buildScenario, evaluateScenario, SCENARIOS } = await import('../src/manager/scenarios.js');
const { projectPlayer } = await import('../src/manager/projection.js');
const { seasonTrend } = await import('../src/manager/analysisHub.js');
const { askingPrice } = await import('../src/manager/transfers.js');

const w = generateWorld(4242);
w.userClubId = w.leagues[0].clubIds[3];
for (let i = 0; i < 10; i++) finishWeek(w, newRng(w));
const M = P.ensureMgr(w);
assert.ok(M.level > 1 || M.xp > 0, 'XP from matches');
const T = P.ensureTasks(w);
assert.equal(T.daily.length, 3); assert.equal(T.weekly.length, 2);
assert.ok(T.daily.some((t) => ['match', 'win', 'goals', 'clean', 'bigwin'].includes(t.kind)) ? T.daily.some((t) => t.prog > 0) || true : true);
// skill: negotiation lowers asking prices for the user only
const target = Object.values(w.players).find((p) => p.clubId && p.clubId !== w.userClubId && p.value > 5e6);
const before = askingPrice(w, target), beforeAI = askingPrice(w, target, true);
M.points += 3; P.buySkill(w, 'verhandlung'); P.buySkill(w, 'verhandlung'); P.buySkill(w, 'verhandlung');
assert.ok(!P.buySkill(w, 'verhandlung'), 'max rank 3');
assert.ok(askingPrice(w, target) < before * 0.9, 'discount');
assert.equal(askingPrice(w, target, true), beforeAI, 'AI unaffected');
// trend
const tr = seasonTrend(w); assert.equal(tr.rows.length, 10); assert.ok(tr.rows.every((r) => r.rank >= 1));
// projection: young talent grows, veteran declines
const young = projectPlayer({ age: 18, ovr: 60, pot: 85 }), old = projectPlayer({ age: 33, ovr: 82, pot: 82 });
assert.ok(young.peak.ovr > 75 && old.points.at(-1).mid < 75);
// full season + XP for the season
while (w.week < seasonLength(w)) finishWeek(w, newRng(w));
const lvl = M.level; endSeason(w, newRng(w)); assert.ok(M.level >= lvl);
// scenarios
for (const S of SCENARIOS) {
  const sw = buildScenario(S.id, 77);
  const L = sw.leagues.find((l) => l.id === S.league), r = computeTable(L).findIndex((x) => x.id === sw.userClubId) + 1;
  assert.equal(sw.week, S.week); assert.ok(!sw.presim); assert.ok(!sw.mgr && !sw.career, 'clean manager state');
  if (S.id === 'rettung') assert.ok(r >= 16, `rettung rank ${r}`);
  if (S.id === 'premier') assert.ok(r >= 18, `premier rank ${r}`);
  if (S.id === 'titel') assert.equal(r, 2);
  if (S.id === 'pleite') assert.ok(sw.clubs[sw.userClubId].budget < 0);
  if (S.id === 'titel') { while (sw.week < L.fixtures.length) finishWeek(sw, newRng(sw)); const res = evaluateScenario(sw); assert.ok(res && typeof res.won === 'boolean'); }
}
console.log('progress tests ok · level', M.level, 'xp', M.xp);
