// Calendar (v2.9): maps season weeks to real dates. Each week runs Monday–Sunday: cup / European games on Wednesday,
// league games on Sunday (matching the training week plan Mo–Sa). Days in between are training days.
import { userFixture } from './season.js';
import { userCupFixture, roundFixtures } from './cups.js';
import { INTL_WEEKS } from './nationals.js';
import { DAYS } from './training.js';

export const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WD_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const CUP_DAY = 2, LEAGUE_DAY = 6; // like the training week plan: sessions Mo–Sa, match on Sunday

export function seasonStart(season) { const d = new Date(season, 7, 15); while (d.getDay() !== 1) d.setDate(d.getDate() + 1); return d; }
export function dateOf(world, week = world.week, day = world.day || 0) { const d = seasonStart(world.season); d.setDate(d.getDate() + week * 7 + day); return d; }
export const fmtDate = (d, long = false) => `${long ? WD_LONG[(d.getDay() + 6) % 7] : WD[(d.getDay() + 6) % 7]}, ${d.getDate()}. ${long ? MONTHS[d.getMonth()] : MONTHS[d.getMonth()].slice(0, 3) + '.'} ${d.getFullYear()}`;
export function weekOfDate(world, d) { const ms = d - seasonStart(world.season); return { week: Math.floor(ms / 864e5 / 7), day: ((Math.floor(ms / 864e5) % 7) + 7) % 7 }; }

/** Everything that happens on a given week/day for the user (for the grid and the day stepper). */
export function dayInfo(world, week, day) {
  const out = [];
  const club = world.clubs[world.userClubId], L = world.leagues.find((l) => l.id === club.leagueId);
  if (day === LEAGUE_DAY) {
    const m = L.fixtures[week]?.find((x) => x.h === club.id || x.a === club.id);
    if (m) out.push({ kind: 'league', m, home: m.h === club.id, opp: world.clubs[m.h === club.id ? m.a : m.h], label: `${L.name} · ${week + 1}. Spieltag` });
  }
  if (day === CUP_DAY) {
    for (const c of world.cups || []) for (const rd of c.rounds) for (const f of roundFixtures(rd)) {
      if (f.week === week && (f.h === club.id || f.a === club.id)) out.push({ kind: 'cup', m: f, home: f.h === club.id, opp: world.clubs[f.h === club.id ? f.a : f.h], label: `${c.name} · ${rd.name}` });
    }
  }
  if (INTL_WEEKS.includes(week) && day === 3) out.push({ kind: 'intl', label: 'Länderspiele' });
  return out;
}

/** The match of the current week the user still has to play, with its weekday. */
export function nextUserMatchDay(world) {
  if (userCupFixture(world)) return CUP_DAY;
  if (userFixture(world)?.hg == null && userFixture(world)) return LEAGUE_DAY;
  return null;
}

export function trainingOfDay(world, day) {
  const tr = world.clubs[world.userClubId]?.training;
  const key = tr?.plan?.[day];
  return key || null;
}
export { DAYS };
