// Sports director mode: the user plans squad, transfers, finances and the stadium while an AI head
// coach picks the line-up, tactics and substitutions. Coaches have a style, a quality and a wage and
// can be sacked and replaced.
import { money } from '../core/fmt.js';
import { PRESETS, FORMATIONS, autoLineup } from '../match/tactics.js';
import { clamp } from '../core/rng.js';

const FIRST = ['Marco', 'Thomas', 'Julian', 'Niko', 'André', 'Sebastian', 'Pep', 'Luis', 'Carlo', 'Roberto', 'Ralf', 'Xabi', 'Steffen', 'Oliver', 'Fabian', 'Daniel'];
const LAST = ['Reinhardt', 'Kessler', 'Brenner', 'Valdés', 'Moretti', 'Hartmann', 'Lindqvist', 'Novak', 'Baumann', 'Ferreira', 'Kovač', 'Weber', 'Santos', 'Albrecht', 'Lorenz', 'Romero'];
const FORMS = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '4-1-4-1'];

export const isDirector = (world) => world.mode === 'director';

export function makeCoach(rng, rep, quality = null) {
  const q = quality ?? clamp(Math.round((rep - 35) / 13 + rng.normal(0, 0.8)), 1, 5);
  const style = rng.pick(Object.keys(PRESETS));
  return {
    name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`, style, formation: rng.pick(FORMS.filter((f) => FORMATIONS[f])),
    quality: q, wage: Math.round((150000 + q * q * 260000 + rep * 12000) / 1e4) * 1e4, years: rng.int(2, 3), games: 0, pts: 0,
  };
}

export function ensureCoach(world, rng) {
  if (!isDirector(world)) return null;
  const club = world.clubs[world.userClubId];
  world.coach ||= makeCoach(rng, club.rep);
  return world.coach;
}

// applied before every user match / week: the coach decides
export function coachDecides(world) {
  if (!isDirector(world) || !world.coach) return;
  const club = world.clubs[world.userClubId], c = world.coach;
  club.tactic = { ...club.tactic, ...PRESETS[c.style], preset: c.style, formation: c.formation };
  club.lineup = autoLineup(club, world.players, c.formation);
  club.familiarity = clamp(0.68 + c.quality * 0.06, 0.6, 1);
}

export const coachTrainingFactor = (world, club) => (isDirector(world) && world.coach && club.id === world.userClubId ? 0.82 + world.coach.quality * 0.07 : 1);

export function coachCandidates(world, rng) {
  const rep = world.clubs[world.userClubId].rep;
  return [0, 1, 2].map((k) => makeCoach(rng, rep, clamp(Math.round((rep - 35) / 13) + k - 1, 1, 5)));
}

export function hireCoach(world, cand) {
  const club = world.clubs[world.userClubId];
  const old = world.coach;
  const severance = old ? Math.round(old.wage * Math.max(0.5, old.years) / 1e4) * 1e4 : 0;
  club.budget -= severance;
  if (severance) club.finance.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'wages', label: `Abfindung Trainer ${old.name}`, amount: -severance }], net: -severance });
  world.coach = { ...cand, games: 0, pts: 0 };
  world.news.unshift({ season: world.season, week: world.week + 1, text: `👔 Neuer Cheftrainer: ${cand.name} (${'★'.repeat(cand.quality)}, Spielstil ${cand.style}, ${cand.formation}).${old ? ` ${old.name} wurde entlassen (Abfindung ${money(severance)}).` : ''}` });
  coachDecides(world);
  return severance;
}

export function coachAfterMatch(world, pts) {
  if (!isDirector(world) || !world.coach) return;
  world.coach.games++; world.coach.pts += pts;
}
