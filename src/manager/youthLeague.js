// v7.0 Jugend 2.0: the U19 really plays – a league with the clubs of your division (table, results,
// top scorers), a youth tournament in the winter break, and life at the academy (school, homesickness,
// breakthroughs) that shapes every talent's story.
import { clamp } from '../core/rng.js';
import { news } from './transfers.js';
import { youthPlayers } from './youth.js';
import { moodChange } from './events.js';

const ATT = { ST: 10, LA: 6, RA: 6, OM: 5, LM: 3, RM: 3, ZM: 2, DM: 1, IV: 0.7, LV: 0.7, RV: 0.7, TW: 0 };

function strengthOf(world, club) {
  if (club.id === world.userClubId) {
    const ys = youthPlayers(world).map((p) => p.ovr).sort((a, b) => b - a).slice(0, 11);
    while (ys.length < 11) ys.push(40);
    return ys.reduce((a, b) => a + b, 0) / 11 + (world.clubs[world.userClubId].campus?.internat || 0) * 0.8;
  }
  return 38 + club.rep * 0.22 + (club.facilities?.youth || 2) * 1.6;
}
// round-robin with the circle method
function schedule(ids) {
  const t = ids.slice(); if (t.length % 2) t.push(null);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const md = [];
    for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a != null && b != null) md.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(md);
    t.splice(1, 0, t.pop());
  }
  return rounds.concat(rounds.map((md) => md.map(([a, b]) => [b, a])));
}

export function ensureYouthLeague(world) {
  const club = world.clubs[world.userClubId]; if (!club) return null;
  const Y = world.u19;
  if (Y && Y.season === world.season && Y.leagueOf === club.leagueId) return Y;
  const L = world.leagues.find((l) => l.id === club.leagueId);
  const ids = L.clubIds.slice(0, 18);
  if (!ids.includes(club.id)) ids[ids.length - 1] = club.id;
  world.u19 = { season: world.season, leagueOf: club.leagueId, name: `U19-${club.women ? 'Juniorinnen' : 'Junioren'}-Liga`, ids, rounds: schedule(ids), md: 0,
    table: Object.fromEntries(ids.map((id) => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }])), results: [], scorers: {}, cup: null, life: Y?.life || [], champions: Y?.champions || [] };
  return world.u19;
}
export const youthTable = (Y) => Object.values(Y.table).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);

function play(world, rng, a, b) {
  const A = world.clubs[a], B = world.clubs[b];
  const sa = strengthOf(world, A), sb = strengthOf(world, B);
  const ga = rng.poisson(clamp(1.5 * Math.exp((sa - sb) * 0.06), 0.2, 4.5)), gb = rng.poisson(clamp(1.2 * Math.exp((sb - sa) * 0.06), 0.15, 4.2));
  const scorers = [];
  const uid = world.userClubId;
  if (a === uid || b === uid) {
    const ys = youthPlayers(world).filter((p) => p.injury <= 0);
    for (const p of ys) { (p.ystats ||= { apps: 0, goals: 0 }).apps++; }
    const n = a === uid ? ga : gb;
    for (let k = 0; k < n && ys.length; k++) {
      const tot = ys.reduce((s, p) => s + (ATT[p.pos] ?? 1) * (p.attrs?.abschluss || 50), 0);
      let r = rng.next() * tot, sc = ys[0];
      for (const p of ys) { r -= (ATT[p.pos] ?? 1) * (p.attrs?.abschluss || 50); if (r <= 0) { sc = p; break; } }
      sc.ystats.goals++; scorers.push(sc.id);
      world.u19.scorers[sc.id] = (world.u19.scorers[sc.id] || 0) + 1;
      sc.morale = clamp(sc.morale + 2, 0, 99);
    }
  }
  return { a, b, ga, gb, scorers };
}
function book(Y, m) {
  const A = Y.table[m.a], B = Y.table[m.b];
  A.p++; B.p++; A.gf += m.ga; A.ga += m.gb; B.gf += m.gb; B.ga += m.ga;
  if (m.ga > m.gb) { A.w++; B.l++; A.pts += 3; } else if (m.ga < m.gb) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
}

const LIFE = [
  { id: 'heimweh', w: (I) => 1.4 - I * 0.35, text: (p) => `${p.firstName} ${p.lastName} hat Heimweh – die Familie ist weit weg.`, eff: (p) => { p.morale = clamp(p.morale - 8, 0, 99); } },
  { id: 'abi', w: () => 0.7, text: (p) => `${p.firstName} ${p.lastName} hat das Abitur bestanden! Jetzt zählt nur noch Fußball.`, eff: (p) => { p.morale = clamp(p.morale + 6, 0, 99); } },
  { id: 'schule', w: (I) => 1 - I * 0.2, text: (p) => `Schlechte Noten bei ${p.firstName} ${p.lastName} – die Lehrer schlagen Alarm. Weniger Training bis zum Halbjahr.`, eff: (p) => { p.morale = clamp(p.morale - 3, 0, 99); } },
  { id: 'durchbruch', w: (I) => 0.6 + I * 0.25, text: (p) => `Knoten geplatzt: ${p.firstName} ${p.lastName} macht im Training riesige Fortschritte.`, eff: (p) => { p.ovr = Math.min(p.pot, p.ovr + 2); } },
  { id: 'kapitaen', w: () => 0.5, text: (p) => `${p.firstName} ${p.lastName} wird Kapitän der U19 – ein echter Anführer.`, eff: (p) => { p.morale = clamp(p.morale + 5, 0, 99); (p.traits ||= []).includes('Führungsspieler') || p.traits.push('Führungsspieler'); } },
  { id: 'scout', w: () => 0.45, text: (p) => `Ausländische Scouts haben ${p.firstName} ${p.lastName} beobachtet. Sein Berater wird nervös.`, eff: (p) => { p.morale = clamp(p.morale - 2, 0, 99); } },
  { id: 'verletzt', w: (I) => 0.5 - I * 0.08, text: (p) => `${p.firstName} ${p.lastName} hat sich im Jugendspiel verletzt (2 Wochen).`, eff: (p) => { p.injury = Math.max(p.injury, 2); } },
];

export function weeklyYouthLeague(world, rng) {
  const Y = ensureYouthLeague(world); if (!Y) return;
  const club = world.clubs[world.userClubId];
  // one U19 matchday per week (no games in the winter break)
  const L = world.leagues.find((l) => l.id === club.leagueId);
  const weeksLeft = (L?.fixtures.length || 34) - world.week, roundsLeft = Y.rounds.length - Y.md;
  const breakWeek = world.week >= 16 && world.week <= 18 && roundsLeft < weeksLeft - 3;
  const n = breakWeek ? 0 : roundsLeft >= weeksLeft ? Math.min(2, roundsLeft) : 1;
  for (let k = 0; k < n && Y.md < Y.rounds.length; k++) {
    const res = Y.rounds[Y.md].map(([a, b]) => play(world, rng, a, b));
    res.forEach((m) => book(Y, m));
    const mine = res.find((m) => m.a === club.id || m.b === club.id);
    Y.results.unshift({ md: Y.md + 1, week: world.week, games: res.map(({ a, b, ga, gb }) => ({ a, b, ga, gb })), mine: mine ? { a: mine.a, b: mine.b, ga: mine.ga, gb: mine.gb, scorers: mine.scorers } : null });
    Y.results = Y.results.slice(0, 8);
    Y.md++;
    if (Y.md === Y.rounds.length) {
      const t = youthTable(Y), champ = world.clubs[t[0].id];
      Y.champions.unshift({ season: world.season, club: champ.id });
      news(world, `🌱 ${champ.name} ist ${Y.name.replace('-Liga', '')}-Meister.${champ.id === club.id ? ' Deine U19 holt den Titel!' : ''}`);
      if (champ.id === club.id) { moodChange(world, 3, 2); for (const p of youthPlayers(world)) p.pot = Math.min(96, p.pot + 1); }
    }
  }
  // winter tournament (weeks 16–18): 8 teams, knock-out
  if (world.week === 16 && !Y.cup) startCup(world, rng);
  if (Y.cup && !Y.cup.done && world.week >= 16 && world.week <= 18) playCupRound(world, rng);
  // academy life
  const ys = youthPlayers(world);
  if (ys.length && rng.chance(0.45)) {
    const I = club.campus?.internat || 0;
    const ev = rng.weighted(LIFE, (e) => Math.max(0.05, e.w(I)));
    const p = ys[Math.floor(rng.next() * ys.length)];
    ev.eff(p);
    const text = ev.text(p);
    (p.ystory ||= []).push(`${world.season}/${String((world.season + 1) % 100).padStart(2, '0')}: ${text}`);
    Y.life.unshift({ season: world.season, week: world.week, text, pid: p.id });
    Y.life = Y.life.slice(0, 25);
  }
}

function startCup(world, rng) {
  const club = world.clubs[world.userClubId];
  const big = Object.values(world.clubs).filter((c) => !c.nation && !c.national && c.id !== club.id && !!c.women === !!club.women).sort((a, b) => b.rep - a.rep).slice(0, 20);
  const field = [club.id, ...big.sort(() => rng.next() - 0.5).slice(0, 7).map((c) => c.id)].sort(() => rng.next() - 0.5);
  world.u19.cup = { name: `${club.women ? 'Juniorinnen' : 'Junioren'}-Hallenmasters ${world.season + 1}`, rounds: [], order: field, done: false, winner: null };
  news(world, `🏆 Deine U19 spielt beim ${world.u19.cup.name} gegen Europas beste Nachwuchsteams.`);
}
function playCupRound(world, rng) {
  const C = world.u19.cup, names = ['Viertelfinale', 'Halbfinale', 'Finale'];
  const ties = [];
  for (let i = 0; i + 1 < C.order.length; i += 2) {
    const m = play(world, rng, C.order[i], C.order[i + 1]);
    let winner = m.ga > m.gb ? m.a : m.ga < m.gb ? m.b : null, note = '';
    if (!winner) { winner = rng.chance(0.5) ? m.a : m.b; note = ' i. E.'; }
    ties.push({ a: m.a, b: m.b, ga: m.ga, gb: m.gb, note, winner });
  }
  C.rounds.push({ name: names[C.rounds.length] || 'Runde', ties });
  C.order = ties.map((t) => t.winner);
  if (C.order.length === 1) {
    C.done = true; C.winner = C.order[0];
    const uid = world.userClubId;
    news(world, `🏆 ${C.name}: ${world.clubs[C.winner].name} gewinnt das Turnier.${C.winner === uid ? ' Riesenjubel bei deiner U19!' : ''}`);
    if (C.winner === uid) { moodChange(world, 2, 2); for (const p of youthPlayers(world)) p.morale = clamp(p.morale + 6, 0, 99); }
  }
}
