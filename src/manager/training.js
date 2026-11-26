// Training & development: team focus, intensity, individual focus, tactical familiarity.
// Players develop week by week depending on age, potential, training, facility level,
// match time, fitness, injuries and professionalism.
import { pitchInjuryFactor } from './stadiumBuild.js';
import { clamp } from '../core/rng.js';
import { skillRank } from './progress.js';
import { computeOverall, POS_WEIGHTS, OUTFIELD_ATTRS, GK_ATTRS } from '../data/attributes.js';
import { marketValue } from '../data/generator.js';
import { wScale } from './gender.js';

export const TRAINING_FOCUS = {
  ausgewogen: { name: 'Ausgewogen', attrs: null, desc: 'Entwicklung entsprechend der Position.' },
  fitness: { name: 'Athletik', attrs: ['tempo', 'beschleunigung', 'ausdauer', 'kraft', 'sprungkraft'], desc: 'Tempo, Ausdauer, Kraft. Bessere Erholung.' },
  technik: { name: 'Technik', attrs: ['technik', 'dribbling', 'ballkontrolle', 'passspiel'], desc: 'Ballbehandlung und Passspiel.' },
  angriff: { name: 'Angriff', attrs: ['abschluss', 'schusskraft', 'kopfball', 'dribbling'], desc: 'Torabschluss und Offensivaktionen.' },
  verteidigung: { name: 'Verteidigung', attrs: ['tackling', 'stellungsspiel', 'kopfball', 'kraft'], desc: 'Zweikämpfe und Stellungsspiel.' },
  taktik: { name: 'Taktik', attrs: ['uebersicht', 'stellungsspiel', 'passspiel'], desc: 'Schnellere Vertrautheit mit Formation und Spielstil.' },
};
export const ALL_ATTRS = [...OUTFIELD_ATTRS, ...GK_ATTRS];

// ------------------------------------------------------------------ Training 2.0: weekly plan (v2.0)
export const SESSIONS = {
  erholung: { name: 'Regeneration', icon: '🧘', dev: 0.25, fit: 7, inj: 0.2, desc: 'Auslaufen, Sauna, Physio – Fitness kommt zurück.' },
  kondition: { name: 'Kondition', icon: '🏃', dev: 1, fit: -6, inj: 1.5, attrs: ['tempo', 'beschleunigung', 'ausdauer', 'kraft', 'sprungkraft'], desc: 'Athletik und Ausdauer, aber anstrengend.' },
  technik: { name: 'Technik', icon: '🎯', dev: 1, fit: -2, inj: 0.7, attrs: ['technik', 'dribbling', 'ballkontrolle', 'passspiel'], desc: 'Ballbehandlung, Passspiel, Dribbling.' },
  taktik: { name: 'Taktik', icon: '🧠', dev: 0.6, fit: -1, inj: 0.4, fam: 0.035, attrs: ['uebersicht', 'stellungsspiel'], desc: 'Laufwege und System – mehr Vertrautheit.' },
  abschluss: { name: 'Torabschluss', icon: '⚽', dev: 1, fit: -3, inj: 0.8, attrs: ['abschluss', 'schusskraft', 'kopfball'], desc: 'Schusstraining und Flanken.' },
  abwehr: { name: 'Defensive', icon: '🛡️', dev: 1, fit: -3, inj: 1.1, attrs: ['tackling', 'stellungsspiel', 'kopfball', 'kraft'], desc: 'Zweikämpfe, Kopfbälle, Abwehrkette.' },
  standards: { name: 'Standards', icon: '🚩', dev: 0.6, fit: -1, inj: 0.3, attrs: ['schusskraft', 'technik', 'kopfball'], setpiece: 1, desc: 'Ecken und Freistöße einstudieren.' },
  gegner: { name: 'Spielvorbereitung', icon: '🔎', dev: 0.3, fit: -1, inj: 0.3, prep: 1, desc: 'Gezielt auf den nächsten Gegner einstellen (Bonus im Spiel).' },
  teambuilding: { name: 'Teambuilding', icon: '🤝', dev: 0, fit: 2, inj: 0, spirit: 3, morale: 2, desc: 'Gemeinsame Aktivität – stärkt den Teamgeist.' },
  frei: { name: 'Frei', icon: '🌴', dev: 0, fit: 9, inj: 0, morale: 3, desc: 'Freier Tag – gut für Kopf und Körper.' },
};
export const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const PLAN_TEMPLATES = {
  standard: { name: 'Standardwoche', plan: ['erholung', 'technik', 'kondition', 'taktik', 'gegner', 'standards'] },
  intensiv: { name: 'Intensiv', plan: ['kondition', 'technik', 'kondition', 'abschluss', 'abwehr', 'gegner'] },
  englisch: { name: 'Englische Woche', plan: ['erholung', 'frei', 'taktik', 'erholung', 'gegner', 'erholung'] },
  jugend: { name: 'Entwicklung', plan: ['technik', 'abschluss', 'technik', 'abwehr', 'kondition', 'erholung'] },
  locker: { name: 'Locker', plan: ['frei', 'erholung', 'technik', 'teambuilding', 'gegner', 'erholung'] },
};
export function weekMix(tr) {
  if (!tr.plan) return null;
  const mix = { attrs: {}, dev: 0, fit: 0, inj: 0, fam: 0, prep: 0, setpiece: 0, spirit: 0, morale: 0 };
  for (const k of tr.plan) {
    const S = SESSIONS[k] || SESSIONS.erholung;
    mix.dev += S.dev / tr.plan.length; mix.fit += S.fit; mix.inj += S.inj; mix.fam += S.fam || 0; mix.prep += S.prep || 0; mix.setpiece += S.setpiece || 0; mix.spirit += S.spirit || 0; mix.morale += S.morale || 0;
    for (const a of S.attrs || []) mix.attrs[a] = (mix.attrs[a] || 0) + 1;
  }
  return mix;
}

// position retraining & mentors
export function startRetrain(p, pos) { p.retrain = pos && pos !== p.pos ? { pos, progress: 0 } : null; }
export const MAX_MENTORS = 4;

export function ensureTraining(club) {
  if (!club.training) club.training = { focus: 'ausgewogen', intensity: 0.6, individual: {} };
  if (club.familiarity == null) { club.familiarity = 0.75; club.famFormation = club.tactic.formation; club.famPreset = club.tactic.preset; }
  return club.training;
}

function ageFactor(age) { return age <= 21 ? 1 : age <= 24 ? 0.75 : age <= 27 ? 0.4 : age <= 30 ? 0.15 : 0; }

// Returns list of attribute keys that improved (for the user's training report)
export function trainPlayer(p, club, rng, youthBoost = 0) {
  const tr = club.training;
  if (p.injury > 0) return [];
  const room = Math.max(0, p.pot - p.ovr);
  let pts = (0.2 + room * 0.072) * ageFactor(p.age);
  pts *= 0.55 + club.facilities.training * 0.11;
  pts *= 0.6 + tr.intensity * 0.6;
  pts *= 0.6 + p.professionalism / 250;
  pts *= p.playedThisWeek ? 1 : 0.65;
  if (youthBoost && p.age <= 21) pts *= 1 + 0.07 * youthBoost;
  pts *= 0.75 + p.fitness / 400;
  pts *= club.coachFactor || 1;
  const mix = club._mix;
  if (mix) pts *= 0.35 + mix.dev * 0.85;
  if (club.mentorBoost?.[p.id]) pts *= club.mentorBoost[p.id];
  const gains = [];
  if (pts > 0.01 && p.ovr < p.pot) {
    const isGK = p.pos === 'TW';
    const w = POS_WEIGHTS[p.pos];
    const focus = mix ? Object.entries(mix.attrs).flatMap(([a, n]) => Array(n).fill(a)) : TRAINING_FOCUS[tr.focus]?.attrs;
    const pool = isGK ? Object.keys(w) : (focus ? focus.concat(Object.keys(w)) : Object.keys(w));
    const indiv = tr.individual?.[p.id];
    p.prog ||= {};
    let remaining = pts;
    if (indiv) { p.prog[indiv] = (p.prog[indiv] || 0) + remaining * 0.4; remaining *= 0.6; }
    const total = pool.reduce((s, k) => s + (w[k] || 1), 0);
    for (const k of pool) p.prog[k] = (p.prog[k] || 0) + (remaining * (w[k] || 1)) / total;
    for (const k in p.prog) {
      while (p.prog[k] >= 1) {
        p.prog[k] -= 1;
        if (p.attrs[k] >= 99) { p.prog[k] = 0; break; }
        p.attrs[k]++;
        if (computeOverall(p.attrs, p.pos) > p.pot) { p.attrs[k]--; p.prog[k] = 0; break; }
        gains.push(k);
      }
    }
  }
  // physical decline of veterans
  if (p.age > 29 && rng.chance((p.age - 29) * 0.06)) {
    const k = rng.pick(['tempo', 'beschleunigung', 'ausdauer', 'sprungkraft']);
    p.attrs[k] = clamp(p.attrs[k] - 1, 5, 99);
    if (p.age > 32 && rng.chance(0.4)) { const k2 = rng.pick(Object.keys(POS_WEIGHTS[p.pos])); p.attrs[k2] = clamp(p.attrs[k2] - 1, 5, 99); }
  }
  p.ovr = computeOverall(p.attrs, p.pos);
  p.pot = Math.max(p.pot, p.ovr);
  return gains;
}

// Weekly training for a whole club. Returns report entries for the user club.
export function weeklyTraining(world, club, rng) {
  ensureTraining(club);
  const tr = club.training;
  const report = [];
  const medical = club.facilities?.medical ?? 2;
  const mix = club._mix = weekMix(tr);
  // mentors: experienced players pass on know-how to youngsters
  club.mentorBoost = {};
  for (const [young, mentor] of Object.entries(club.mentors || {})) {
    const y = world.players[young], m = world.players[mentor];
    if (!y || !m || y.clubId !== club.id || m.clubId !== club.id) { delete club.mentors[young]; continue; }
    const sameLine = (POS_WEIGHTS[y.pos] && y.pos === m.pos) ? 0.08 : 0;
    club.mentorBoost[young] = 1.12 + sameLine + (m.professionalism - 60) / 400;
    if (rng.chance(0.06) && y.professionalism < m.professionalism) y.professionalism++;
  }
  for (const id of club.squad) {
    const p = world.players[id];
    const before = p.ovr;
    const gains = trainPlayer(p, club, rng, club.id === world.userClubId ? skillRank(world, 'jugend') : 0);
    // training load
    if (mix) { p.fitness = clamp(p.fitness + mix.fit * 0.55 * (0.6 + tr.intensity * 0.6), 30, 100); p.morale = clamp(p.morale + mix.morale * 0.5, 0, 99); }
    else p.fitness = clamp(p.fitness - (tr.intensity - 0.4) * 10 + (tr.focus === 'fitness' ? 3 : 0), 30, 100);
    // position retraining: ~16 weeks to learn a new position
    if (p.retrain && club.id === world.userClubId) {
      p.retrain.progress += (0.05 + (p.attrs.uebersicht || 50) / 2500) * (p.age <= 24 ? 1.3 : p.age >= 30 ? 0.7 : 1);
      if (p.retrain.progress >= 1) { (p.altPos ||= []).push(p.retrain.pos); report.push({ type: 'up', player: p.id, text: `${p.lastName} beherrscht jetzt auch die Position ${p.retrain.pos}.` }); p.retrain = null; }
    }
    const injBase = mix ? 0.0011 * mix.inj : 0.004;
    if (p.injury <= 0 && rng.chance(injBase * tr.intensity * (1.5 - medical * 0.13) * pitchInjuryFactor(club))) {
      p.injury = rng.int(1, 3);
      if (club.id === world.userClubId) report.push({ type: 'injury', player: p.id, text: `${p.lastName} hat sich im Training verletzt (${p.injury} Wo.).` });
    }
    if (p.ovr > before) {
      p.value = Math.round(marketValue(p.ovr, p.age, p.pot) * wScale(p));
      if (club.id === world.userClubId) report.push({ type: 'up', player: p.id, text: `${p.lastName} verbessert sich auf ${p.ovr} (+${p.ovr - before}).`, gains });
    } else if (p.ovr < before) p.value = Math.round(marketValue(p.ovr, p.age, p.pot) * wScale(p));
    p.playedThisWeek = false;
  }
  // tactical familiarity
  if (club.famFormation !== club.tactic.formation) { club.familiarity *= 0.55; club.famFormation = club.tactic.formation; }
  if (club.famPreset !== club.tactic.preset) { club.familiarity *= 0.85; club.famPreset = club.tactic.preset; }
  club.familiarity = clamp(club.familiarity + 0.03 + (mix ? mix.fam : (tr.focus === 'taktik' ? 0.06 : 0) * tr.intensity), 0, 1);
  // match preparation for the next opponent and set pieces (used by the match simulation)
  club.matchPrep = mix ? { prep: mix.prep, setpiece: mix.setpiece, week: world.week + 1 } : null;
  if (mix?.spirit) club.spiritBoost = (club.spiritBoost || 0) + mix.spirit;
  return report;
}

// Faster injury recovery with a better medical department.
export function recoverInjury(p, club, rng) {
  if (p.injury <= 0) return;
  p.injury--;
  if (p.injury > 0 && rng.chance((club?.facilities?.medical ?? 2) * 0.06)) p.injury--;
}
