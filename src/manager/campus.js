// v6.0 Trainingszentrum (campus): the three classic facilities plus new buildings, each a construction
// project of a few weeks with a real effect. Shown in 3D on the campus screen.
import { clamp } from '../core/rng.js';
import { FACILITIES, facilityCost } from './economy.js';

export const BUILDINGS = [
  { key: 'training', fac: true, icon: '⚽', name: 'Trainingsplätze', desc: 'Mehr und bessere Plätze: schnellere Entwicklung im Training.' },
  { key: 'youth', fac: true, icon: '🌱', name: 'Nachwuchsleistungszentrum', desc: 'Bessere Talente im Nachwuchs-Jahrgang.' },
  { key: 'medical', fac: true, icon: '🩺', name: 'Reha-Zentrum', desc: 'Weniger Trainingsverletzungen, schnellere Genesung.' },
  { key: 'gym', icon: '🏋️', name: 'Kraft- & Athletikhalle', max: 3, cost: 1.2e6, weeks: 4, upkeep: 9000, desc: '+1,5 Fitness pro Woche und Stufe für den ganzen Kader.' },
  { key: 'analysis', icon: '📊', name: 'Analyse- & Videoraum', max: 3, cost: 0.9e6, weeks: 3, upkeep: 7000, desc: 'Taktik-Vertrautheit wächst jede Woche schneller.' },
  { key: 'internat', icon: '🏠', name: 'Jugendinternat', max: 3, cost: 1.5e6, weeks: 6, upkeep: 12000, desc: 'U19-Talente entwickeln sich schneller.' },
  { key: 'canteen', icon: '🥗', name: 'Kantine & Ernährung', max: 2, cost: 0.6e6, weeks: 2, upkeep: 6000, desc: 'Bessere Laune: Moral im Kader steigt jede Woche leicht.' },
  { key: 'hall', icon: '🏟️', name: 'Trainingshalle', max: 1, cost: 2.4e6, weeks: 8, upkeep: 15000, desc: 'Training bei Schnee und Regen: Wetter bremst die Vorbereitung nicht mehr (+Vertrautheit im Winter).' },
];
export const campusLevel = (club, key) => (FACILITIES[key] ? club.facilities?.[key] ?? 1 : club.campus?.[key] ?? 0);
export const ensureCampus = (club) => (club.campus ||= { build: null });

export function campusOptions(club, league) {
  const C = ensureCampus(club);
  return BUILDINGS.map((b) => {
    const lv = campusLevel(club, b.key), max = b.fac ? FACILITIES[b.key].max : b.max;
    const busy = C.build?.key === b.key;
    const cost = b.fac ? facilityCost(club, b.key, league) : Math.round((b.cost * (1 + lv * 0.6)) / 1e5) * 1e5;
    const weeks = b.fac ? 3 + lv : b.weeks + lv;
    return { ...b, level: lv, max, busy, done: lv >= max, cost, weeks };
  });
}

export function startCampus(world, club, key, league) {
  const C = ensureCampus(club);
  if (C.build) return { ok: false, msg: 'Es läuft schon eine Baustelle auf dem Gelände' };
  const o = campusOptions(club, league).find((x) => x.key === key);
  if (!o || o.done) return { ok: false, msg: 'Maximale Stufe erreicht' };
  if (club.budget < o.cost) return { ok: false, msg: 'Nicht genug Geld' };
  const disc = club.buildDiscount || 0; club.buildDiscount = 0; // v7.0 board subsidy
  club.budget -= Math.round(o.cost * (1 - disc));
  if (club.finance) { club.finance.season.construction -= o.cost; club.finance.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'construction', label: `Trainingszentrum: ${o.name} → Stufe ${o.level + 1}`, amount: -o.cost }], net: -o.cost }); }
  C.build = { key, weeks: o.weeks, total: o.weeks, name: o.name };
  return { ok: true };
}

/** weekly: construction progress + building effects (user clubs) */
export function weeklyCampus(world, club) {
  const C = ensureCampus(club);
  if (C.build && --C.build.weeks <= 0) {
    const b = C.build; C.build = null;
    if (FACILITIES[b.key]) club.facilities[b.key] = (club.facilities[b.key] || 0) + 1;
    else C[b.key] = (C[b.key] || 0) + 1;
    world.news?.unshift({ season: world.season, week: world.week + 1, text: `🏗️ Trainingszentrum: ${b.name} fertig – jetzt Stufe ${campusLevel(club, b.key)}.` });
  }
  const gym = C.gym || 0, canteen = C.canteen || 0;
  if (gym || canteen) for (const id of club.squad) { const p = world.players[id]; if (!p) continue; if (gym) p.fitness = clamp(p.fitness + gym * 1.5, 0, 100); if (canteen) p.morale = clamp(p.morale + canteen * 0.3, 10, 99); }
  if (C.analysis) club.familiarity = clamp((club.familiarity ?? 0.75) + C.analysis * 0.004, 0, 1);
  if (C.hall && world.week >= 12 && world.week <= 22) club.familiarity = clamp((club.familiarity ?? 0.75) + 0.004, 0, 1);
}
export function campusUpkeep(club) {
  const C = club.campus; if (!C) return 0;
  return BUILDINGS.filter((b) => !b.fac).reduce((s, b) => s + (C[b.key] || 0) * b.upkeep, 0);
}
