// v7.0 Wetter & Rasen: every match has weather (forecast visible in advance) that changes the game –
// rain = more mistakes, snow = fewer goals and possible postponements, heat = tired legs. Each club has a
// pitch whose quality suffers from games and bad weather; heating, hybrid grass and the groundsman help.
import { clamp } from '../core/rng.js';

export const WEATHER_NAME = { klar: '🌤️ Trocken', regen: '🌧️ Regen', schnee: '❄️ Schnee', nebel: '🌫️ Nebel', hitze: '🥵 Hitze', sturm: '💨 Sturm' };
export const TOD_NAME = { tag: '☀️ Nachmittag', abend: '🌇 Abendspiel', nacht: '🌙 Flutlicht' };
const SOUTH = new Set(['ES', 'IT', 'PT', 'TR', 'FR']);

/** Weather & kick-off time of a fixture (deterministic, so it can be shown as a forecast). */
export function conditions(w, fx) {
  if (globalThis.__forceWeather) return { tod: globalThis.__forceTod || 'nacht', weather: globalThis.__forceWeather, temp: 8 }; // QA hook
  const h = (fx.h * 31 + fx.a * 17 + (fx.week ?? w?.week ?? 0) * 7 + (w?.season || 0)) % 20;
  const wk = fx.week ?? w?.week ?? 0, winter = wk >= 15 && wk <= 27, autumn = wk >= 9 && wk < 15, summer = wk <= 4 || wk >= 31;
  const country = w?.leagues?.find((l) => l.clubIds?.includes(fx.h))?.country;
  const south = SOUTH.has(country);
  let weather = winter && !south && h % 5 === 1 ? 'schnee' : (winter || autumn) && h % 9 === 4 ? 'nebel' : h % 7 === 3 || (autumn && h % 6 === 2) ? 'regen' : 'klar';
  if (weather === 'klar' && summer && (south ? h % 3 === 0 : h % 6 === 0)) weather = 'hitze';
  if (weather === 'klar' && (autumn || winter) && h % 11 === 7) weather = 'sturm';
  const base = winter ? (south ? 9 : 1) : autumn ? 10 : summer ? (south ? 31 : 26) : 15;
  const temp = Math.round(base + ((h * 7) % 9) - 4 + (weather === 'hitze' ? 6 : weather === 'schnee' ? -4 : 0));
  return { tod: h < 9 ? 'nacht' : h < 15 ? 'abend' : 'tag', weather, temp };
}
/** what the 3D view can draw */
export const renderWeather = (wx) => ({ hitze: 'klar', sturm: 'regen' }[wx] || wx);

// ------------------------------------------------------------------ pitch
export function ensurePitch(club) {
  club.pitch ||= { q: Math.round(clamp(72 + (club.rep - 60) * 0.4, 55, 92)), heating: (club.rep || 0) >= 70, hybrid: (club.rep || 0) >= 80 ? 1 : 0, keeper: 1 };
  return club.pitch;
}
export const pitchLabel = (q) => (q >= 88 ? 'Teppich' : q >= 75 ? 'Sehr gut' : q >= 62 ? 'Ordentlich' : q >= 48 ? 'Holprig' : 'Acker');
export const KEEPER_COST = [0, 6000, 15000, 30000]; // per week
export const PITCH_UPGRADES = { heating: { name: 'Rasenheizung', cost: 2.4e6, desc: 'Kein Frost, kein Schnee auf dem Platz – keine Spielabsagen.' }, hybrid: { name: 'Hybridrasen', cost: 1.6e6, max: 2, desc: 'Kunstfasern im Naturrasen: der Platz hält mehr aus.' } };

/** Effects of weather & pitch on a match: returns modifiers for the quick simulation. */
export function matchFactors(world, m) {
  const c = conditions(world, m), H = world.clubs[m.h];
  const P = H ? ensurePitch(H) : { q: 75 };
  const goals = { klar: 1, regen: 1.05, schnee: 0.86, nebel: 0.94, hitze: 0.95, sturm: 0.92 }[c.weather] || 1;
  const noise = { regen: 1.12, schnee: 1.22, nebel: 1.06, sturm: 1.15 }[c.weather] || 1;
  return {
    weather: c.weather, temp: c.temp, goals, noise,
    homeEdge: (P.q - 70) / 100 * 0.8, // a good pitch is part of home advantage
    injury: (P.q < 50 ? 1.6 : P.q < 62 ? 1.25 : 1) * (c.weather === 'schnee' || c.weather === 'regen' ? 1.15 : 1),
    fatigue: c.weather === 'hitze' ? 1.35 : c.weather === 'schnee' ? 1.1 : 1,
    postpone: c.weather === 'schnee' && !P.heating && P.q < 70,
  };
}

/** after a home game: wear and tear depending on weather; weekly recovery by the groundsman */
export function wearPitch(world, club, homeGame, weather) {
  const P = ensurePitch(club);
  if (homeGame) P.q -= 3.2 + (weather === 'regen' ? 2 : 0) + (weather === 'schnee' && !P.heating ? 3.5 : 0) + (weather === 'sturm' ? 1 : 0) - P.hybrid * 1.1;
  const top = 80 + P.keeper * 5 + P.hybrid * 3;
  if (P.q < top) P.q = Math.min(top, P.q + 0.7 + P.keeper * 0.6 + P.hybrid * 0.25);
  const wk = world.week, winter = wk >= 15 && wk <= 27;
  if (winter && !P.heating) P.q -= 0.8;
  P.q = Math.round(clamp(P.q, 20, 100) * 10) / 10;
  return P.q;
}
export function buyPitch(world, club, key) {
  const P = ensurePitch(club), U = PITCH_UPGRADES[key];
  if (!U) return { ok: false };
  if (key === 'heating' && P.heating) return { ok: false, msg: 'Schon vorhanden' };
  if (key === 'hybrid' && P.hybrid >= U.max) return { ok: false, msg: 'Maximale Stufe erreicht' };
  if (club.budget < U.cost) return { ok: false, msg: 'Dafür reicht das Budget nicht.' };
  club.budget -= U.cost;
  if (club.finance) club.finance.season.facilities = (club.finance.season.facilities || 0) - U.cost;
  if (key === 'heating') P.heating = true; else { P.hybrid++; P.q = Math.min(100, P.q + 8); }
  return { ok: true, msg: `${U.name} eingebaut` };
}
