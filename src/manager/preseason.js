// v6.0 Saisonvorbereitung: training camp, a marketing tour abroad and up to three friendlies before matchday 1.
import { clamp } from '../core/rng.js';
import { teamStrength } from '../match/tactics.js';
import { userLeague } from './season.js';

export const CAMPS = [
  { id: 'heim', name: 'Heimtrainingslager', place: 'Eigenes Trainingsgelände', cost: 0.1e6, fam: 0.02, spirit: 1, fit: 2, desc: 'Günstig, keine Reise – aber wenig Abwechslung.' },
  { id: 'alpen', name: 'Österreich · Zillertal', place: 'Höhenluft & Bergläufe', cost: 0.55e6, fam: 0.04, spirit: 3, fit: 6, desc: 'Klassiker: Kondition, Teamabend auf der Alm.' },
  { id: 'spanien', name: 'Spanien · Marbella', place: 'Perfekte Plätze, Sonne', cost: 1.1e6, fam: 0.06, spirit: 4, fit: 5, desc: 'Beste Trainingsbedingungen, hohe Taktik-Vertrautheit.' },
  { id: 'tirol', name: 'Südtirol · Seefeld', place: 'Ruhe & Regeneration', cost: 0.8e6, fam: 0.05, spirit: 5, fit: 4, desc: 'Abgeschieden – ideal für Teambuilding.' },
];
export const TOURS = [
  { id: 'none', name: 'Keine Reise', minRep: 0, income: 0, fans: 0, fit: 0, desc: 'Volle Konzentration auf die Vorbereitung.' },
  { id: 'gb', name: 'Testspiel-Turnier in England', minRep: 55, income: 0.35, fans: 1, fit: -4, desc: 'Kurze Anreise, starke Gegner, etwas Zusatzgeld.' },
  { id: 'usa', name: 'USA-Tour · New York & Los Angeles', minRep: 68, income: 0.8, fans: 3, fit: -10, desc: 'Viel Geld und neue Fans – aber Jetlag und Hitze.' },
  { id: 'asien', name: 'Asien-Tour · Tokio, Singapur, Seoul', minRep: 72, income: 1, fans: 4, fit: -12, desc: 'Der größte Merchandising-Markt – und die härteste Reise.' },
];

export function prepOpen(w) {
  if (w.mode === 'wm' || w.week !== 0) return false;
  const L = userLeague(w), fx = (L.fixtures[0] || []).find((m) => m.h === w.userClubId || m.a === w.userClubId);
  return !fx || fx.hg == null;
}
export function ensurePrep(w) {
  if (!w.prep || w.prep.season !== w.season || w.prep.club !== w.userClubId) w.prep = { season: w.season, club: w.userClubId, camp: null, tour: null, friendlies: [] };
  return w.prep;
}
export const tourIncome = (club, t) => Math.round((Math.pow(club.rep || 50, 2) * 900 * t.income) / 1e5) * 1e5;

function book(world, club, label, amount) {
  club.budget += amount;
  const F = club.finance; if (!F) return;
  const key = amount >= 0 ? 'sponsors' : 'facilities';
  F.season[key] = (F.season[key] || 0) + amount;
  F.ledger?.unshift({ season: world.season, week: world.week + 1, rows: [{ key, label, amount: Math.round(amount) }], net: Math.round(amount) });
}

export function bookCamp(world, club, id) {
  const P = ensurePrep(world), c = CAMPS.find((x) => x.id === id);
  if (!c || P.camp) return { ok: false, msg: 'Trainingslager schon gebucht' };
  if (club.budget < c.cost) return { ok: false, msg: 'Nicht genug Geld' };
  book(world, club, `Trainingslager ${c.name}`, -c.cost);
  club.familiarity = clamp((club.familiarity ?? 0.75) + c.fam, 0, 1);
  club.spirit = clamp((club.spirit ?? 60) + c.spirit, 0, 100);
  for (const id of club.squad) { const p = world.players[id]; if (p) { p.fitness = clamp(p.fitness + c.fit, 0, 100); p.morale = clamp(p.morale + 1, 10, 99); } }
  P.camp = id;
  world.news?.unshift({ season: world.season, week: 1, text: `⛺ ${club.name} bezieht das Trainingslager: ${c.name}.` });
  return { ok: true };
}

export function bookTour(world, club, id, rng = Math) {
  const P = ensurePrep(world), t = TOURS.find((x) => x.id === id);
  if (!t || P.tour) return { ok: false, msg: 'Reise schon geplant' };
  if ((club.rep || 0) < t.minRep) return { ok: false, msg: 'Für diese Tour ist dein Verein international noch nicht bekannt genug' };
  P.tour = id;
  if (id === 'none') return { ok: true };
  const inc = tourIncome(club, t);
  book(world, club, t.name, inc);
  if (world.mood) world.mood.fans = clamp((world.mood.fans ?? 60) + t.fans, 0, 100);
  club.rep = clamp((club.rep || 50) + (t.fans >= 3 ? 1 : 0), 1, 99);
  const hurt = [];
  for (const pid of club.squad) {
    const p = world.players[pid]; if (!p) continue;
    p.fitness = clamp(p.fitness + t.fit, 30, 100);
    if (t.fit <= -10 && (rng.random ? rng.random() : Math.random()) < 0.03) { p.injury = Math.max(p.injury || 0, 1 + Math.floor(Math.random() * 3)); hurt.push(p); }
  }
  world.news?.unshift({ season: world.season, week: 1, text: `✈️ ${t.name}: ${Math.round(inc / 1e5) / 10} Mio. € Einnahmen, neue Fans – ${hurt.length ? `${hurt.map((p) => p.lastName).join(', ')} kommt verletzt zurück.` : 'alle kommen gesund zurück.'}` });
  return { ok: true, income: inc, hurt };
}

/** Friendly candidates: three smaller clubs from home, three big names abroad. */
export function friendlyOptions(world, club) {
  const P = ensurePrep(world), taken = new Set(P.friendlies.map((f) => f.opp));
  const home = world.leagues.find((l) => l.clubIds.includes(club.id));
  const country = home?.country;
  const all = Object.values(world.clubs).filter((c) => !c.nation && c.id !== club.id && !taken.has(c.id) && c.leagueId !== 'wm' && !!c.women === !!club.women);
  const lg = (c) => world.leagues.find((l) => l.id === c.leagueId);
  const small = all.filter((c) => lg(c)?.country === country && (lg(c)?.tier || 1) > (home?.tier || 1)).sort((a, b) => b.rep - a.rep).slice(0, 3);
  const big = all.filter((c) => lg(c)?.country !== country && (lg(c)?.tier || 1) === 1).sort((a, b) => b.rep - a.rep).slice(0, 12);
  const pick = big.filter((_, i) => (i + world.season) % 4 === 0).slice(0, 3);
  return [...small, ...(pick.length ? pick : big.slice(0, 3))];
}

/** Quick result of a friendly (no stats, no season effects). */
export function simFriendly(world, club, opp, rng) {
  const sh = teamStrength(club, world.players), sa = teamStrength(opp, world.players);
  const R = () => (rng ? rng.random() : Math.random());
  const pois = (l) => { let k = 0, p = 1; const L = Math.exp(-l); do { k++; p *= R(); } while (p > L); return k - 1; };
  const hg = pois(clamp(1.5 * Math.exp((sh - sa) * 0.07), 0.2, 5)), ag = pois(clamp(1.1 * Math.exp((sa - sh) * 0.07), 0.1, 5));
  return { hg, ag };
}
export function recordFriendly(world, club, opp, hg, ag) {
  const P = ensurePrep(world);
  P.friendlies.push({ opp: opp.id, hg, ag });
  club.familiarity = clamp((club.familiarity ?? 0.75) + 0.02, 0, 1);
  const gate = Math.round((opp.rep * opp.rep * 18) / 1e4) * 1e4;
  book(world, club, `Testspiel gegen ${opp.name}`, gate);
  const d = hg - ag;
  for (const id of club.squad) { const p = world.players[id]; if (p) p.morale = clamp(p.morale + (d > 0 ? 1 : d < 0 ? -1 : 0), 10, 99); }
  if (d > 0 && opp.rep > (club.rep || 50) + 5 && world.mood) world.mood.fans = clamp((world.mood.fans ?? 60) + 2, 0, 100);
  world.news?.unshift({ season: world.season, week: 1, text: `🤝 Testspiel: ${club.short} ${hg}:${ag} ${opp.short}.` });
  return gate;
}
export const MAX_FRIENDLIES = 3;
