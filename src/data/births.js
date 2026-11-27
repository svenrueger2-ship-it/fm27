// v7.0.6: real birth dates (DFB-Datencenter, kicker) – lookup by name, order of name parts does not matter.
import { BIRTHDATES } from './birthdates.js';

export const birthKey = (name) => String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ø/g, 'o').replace(/ß/g, 'ss').replace(/ł/g, 'l').replace(/ı/g, 'i').replace(/æ/g, 'ae')
  .split(/[^a-z0-9]+/).filter(Boolean).sort().join(' ');

/** 'yyyy-mm-dd' or null */
export const realBirth = (first, last) => BIRTHDATES[birthKey(`${first || ''} ${last || ''}`)] || null;

/** Age at the start of a season (1 July of the season year). */
export function ageAt(born, season) {
  const [y, m] = born.split('-').map(Number);
  return season - y - (m > 6 ? 1 : 0);
}

export const fmtBorn = (born) => born.split('-').reverse().join('.');

/** Gives every real player his real birth date and the matching age (new and old saves). */
export function applyBirthdates(world) {
  const season = world.season || 2026;
  for (const p of Object.values(world.players || {})) {
    if (!p.real || p.born || p.women) continue;
    const b = realBirth(p.firstName, p.lastName);
    if (!b) continue;
    p.born = b;
    const a = ageAt(b, season);
    if (a >= 15 && a <= 45) p.age = a;
  }
}
