import { registerCustomClubs } from '../data/customRegistry.js';
// Brings saves of older versions (and freshly generated worlds) up to the current data format.
import { RNG } from '../core/rng.js';
import { ensureEconomy } from './economy.js';
import { ensureTraining } from './training.js';
import { ensureTransferState } from './transfers.js';
import { CLUB_INFO } from '../data/clubInfo.js';
import { CLUB_FOUNDED } from '../data/clubInfoExtra.js';

export const WORLD_VERSION = 3;

export function migrateWorld(world) {
  for (const p of Object.values(world.players || {})) if (p.photo) delete p.photo; // v7.0.5: own uploaded photos removed – only the built-in real photos are shown
  registerCustomClubs(world);
  const rng = new RNG((world.seed || 1) + 99);
  for (const club of Object.values(world.clubs)) {
    const league = world.leagues.find((l) => l.id === club.leagueId);
    ensureEconomy(club, league);
    ensureTraining(club);
    if ((world.version || 1) < 2 && world.userClubId != null) club.wageBudget = Math.round(club.wageBudget * 1.75);
    club.loanedOut ||= [];
    club.history ||= [];
    club.info ||= { founded: CLUB_INFO[club.short]?.founded ?? CLUB_FOUNDED[club.short] ?? null, titles: CLUB_INFO[club.short]?.titles ?? null };
  }
  ensureTransferState(world);
  const oldSave = (world.version || 1) < 2 && world.userClubId != null;
  for (const p of Object.values(world.players)) {
    if (oldSave) p.wage = Math.round(Math.min(p.wage * 1.7, 8e6 + p.value * 0.08) / 1000) * 1000;
    if (p.releaseClause === undefined) p.releaseClause = rng.chance(0.25) ? Math.round((p.value * rng.range(1.7, 3)) / 1e5) * 1e5 : null;
    p.prog ||= {};
    p.career ||= [];
    p.moves ||= [];
    if (p.loan === undefined) p.loan = null;
  }
  world.version = WORLD_VERSION;
  return world;
}
