import { generateWorld } from '../src/data/generator.js';
import { newRng, finishWeek } from '../src/manager/season.js';
import { startTourney, playStage, stageFixtures, stageName, nationClub, cleanupNationClubs } from '../src/manager/tourney.js';
const w = generateWorld(3); w.userClubId = w.leagues[0].clubIds[0]; w.season = 2027;
w.career = { nat: 'GER', natSquad: null, titles: [], rep: 70, natResults: [] };
const rng = newRng(w);
const T = startTourney(w, rng);
console.log(T.name, T.field.length, T.groups.length, 'squads', Object.keys(T.squads).length, 'GER', T.squads.GER.length);
const c = nationClub(w, 'GER', rng), d = nationClub(w, 'SCO', rng); console.log('club sizes', c.squad.length, d.squad.length, c.lineup?.xi?.length);
cleanupNationClubs(w); console.log('clubs left', Object.keys(w.clubs).filter((k) => +k >= 95000).length);
while (!T.done) { const n = stageFixtures(T).length; const name = stageName(T); playStage(w, rng); console.log(name, n, T.last.mine ? `${T.last.mine.a} ${T.last.mine.ga}:${T.last.mine.gb} ${T.last.mine.b}` : ''); }
console.log('winner', T.winner, T.runnerUp, T.topScorer, w.career.natResults, w.intl.tournaments.length);
if (!T.done || !w.intl.tournaments.length) { console.error('FAIL tourney'); process.exit(1); } console.log('TOURNEY OK');
