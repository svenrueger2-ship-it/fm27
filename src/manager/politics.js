// v7.0 Vereinspolitik: the club has a president and a supervisory board with factions. Every three
// seasons the members elect the president (you can back a candidate), the board votes on your requests
// (more budget, help with the stadium, the academy, a new contract) and the 50+1 rule is defended or not.
import { clamp } from '../core/rng.js';
import { news } from './transfers.js';
import { moodChange, ensureMood } from './events.js';

const FIRST = ['Hans-Joachim', 'Bernd', 'Karl-Heinz', 'Ulrike', 'Matthias', 'Petra', 'Reinhard', 'Claudia', 'Axel', 'Sabine', 'Herbert', 'Andrea', 'Wolfgang', 'Jutta', 'Rüdiger', 'Martina', 'Dieter', 'Christiane'];
const LAST = ['Reuter', 'Hoffmann', 'Brandt', 'Kessler', 'Lorenz', 'Seidel', 'Hartwig', 'Vogel', 'Krämer', 'Schulte', 'Engel', 'Franke', 'Busch', 'Albrecht', 'Wendt', 'Haas', 'Böhm', 'Lindner'];
export const STYLES = {
  tradition: { name: 'Traditionalist', icon: '🧣', desc: 'Mitgliederverein, 50+1 heilig, nah an den Fans. Keine Investoren.', fans: 4, wage: 1, investor: 0 },
  invest: { name: 'Investorenfreund', icon: '💼', desc: 'Öffnet den Verein für Geldgeber – mehr Budget, aber die Kurve tobt.', fans: -5, wage: 1.1, investor: 2.2 },
  spar: { name: 'Sparkommissar', icon: '🧮', desc: 'Schuldenfrei um jeden Preis: kleineres Gehaltsbudget, viel Geduld.', fans: -1, wage: 0.92, investor: 0.6 },
  vision: { name: 'Visionär', icon: '🚀', desc: 'Große Pläne: Stadion, Campus, Jugend – gibt Geld für Infrastruktur.', fans: 2, wage: 1.02, investor: 1 },
};
export const FACTIONS = { fans: '🧣 Fan-Vertreter', wirtschaft: '💼 Wirtschaft', sport: '⚽ Sport', mitglieder: '👥 Mitglieder' };
export const REQUESTS = {
  budget: { name: 'Mehr Transferbudget', icon: '💶', desc: '+15 % Kontostand als Sonderzuschuss.', bias: { wirtschaft: -10, sport: 10 } },
  wages: { name: 'Höheres Gehaltsbudget', icon: '📄', desc: '+10 % Gehaltsbudget für diese Saison.', bias: { wirtschaft: -12, sport: 8 } },
  stadium: { name: 'Zuschuss Stadion & Campus', icon: '🏟️', desc: '30 % Rabatt auf den nächsten Ausbau.', bias: { fans: 8, wirtschaft: 4 } },
  youth: { name: 'Offensive Jugend', icon: '🌱', desc: 'Nachwuchsleistungszentrum eine Stufe hoch.', bias: { mitglieder: 10, fans: 6 } },
  contract: { name: 'Vertragsverlängerung für dich', icon: '✍️', desc: 'Mehr Rückhalt: Vorstandsvertrauen +12.', bias: { sport: 6 } },
};
const pick = (rng, a) => a[Math.floor(rng.next() * a.length)];
const person = (rng) => `${pick(rng, FIRST)} ${pick(rng, LAST)}`;

export function ensurePolitics(world, rng) {
  if (world.politics) return world.politics;
  const r = rng || { next: Math.random };
  const club = world.clubs[world.userClubId];
  const style = club?.biz?.investor ? 'invest' : (club?.rep || 60) > 80 ? 'vision' : pick(r, ['tradition', 'tradition', 'spar', 'vision']);
  world.politics = {
    president: { name: person(r), style, since: world.season },
    council: Object.keys(FACTIONS).concat(['mitglieder']).map((f) => ({ name: person(r), faction: f, trust: Math.round(45 + r.next() * 30) })),
    nextElection: world.season + 2, endorse: null, candidates: null, requestHalf: null, log: [],
  };
  return world.politics;
}
const log = (P, world, text) => { P.log.unshift({ season: world.season, week: world.week, text }); P.log = P.log.slice(0, 30); };
export const styleOf = (world) => STYLES[world.politics?.president?.style] || STYLES.tradition;

export function weeklyPolitics(world, rng) {
  const club = world.clubs[world.userClubId]; if (!club) return;
  const P = ensurePolitics(world, rng), M = ensureMood(world);
  const run = club.formRun || 0;
  for (const c of P.council) {
    const f = c.faction;
    const d = (run > 0 ? 0.6 : run < 0 ? -0.8 : 0) + (f === 'fans' ? (M.fans - 55) / 80 : f === 'wirtschaft' ? (club.budget > 0 ? 0.2 : -0.6) : f === 'sport' ? run * 0.2 : (M.board - 55) / 100);
    c.trust = clamp(Math.round((c.trust + d) * 10) / 10, 0, 100);
  }
  // election campaign in the last weeks of an election season
  if (world.season >= P.nextElection && !P.candidates && world.week >= 22) {
    const styles = Object.keys(STYLES).filter((s) => s !== P.president.style);
    P.candidates = [{ name: P.president.name, style: P.president.style, incumbent: true }, { name: person(rng), style: pick(rng, styles) }];
    news(world, `🗳️ Präsidentschaftswahl im Sommer: ${P.president.name} (${STYLES[P.president.style].name}) gegen ${P.candidates[1].name} (${STYLES[P.candidates[1].style].name}). Wen unterstützt du?`);
    log(P, world, `🗳️ Wahlkampf: ${P.candidates[0].name} gegen ${P.candidates[1].name}`);
  }
}

export function endorse(world, idx) { const P = ensurePolitics(world); if (!P.candidates) return { ok: false }; P.endorse = idx; return { ok: true, msg: `Du unterstützt ${P.candidates[idx].name}` }; }

/** at the end of the season: election if due */
export function seasonPolitics(world, rng) {
  const P = ensurePolitics(world, rng); if (!P.candidates) return null;
  const M = ensureMood(world);
  let pInc = 0.5 + (M.board - 50) / 120 + (M.fans - 50) / 160;
  if (P.endorse === 0) pInc += 0.12; else if (P.endorse === 1) pInc -= 0.12;
  const incWins = rng.chance(clamp(pInc, 0.12, 0.88));
  const win = P.candidates[incWins ? 0 : 1], lose = P.candidates[incWins ? 1 : 0];
  const pct = Math.round(clamp(50 + (incWins ? 1 : -1) * (Math.abs(pInc - 0.5) * 60 + rng.range(1, 9)), 38, 79));
  const winPct = Math.max(pct, 100 - pct);
  if (P.endorse != null) moodChange(world, P.candidates[P.endorse] === win ? 8 : -10, 0);
  if (!incWins) { P.president = { name: win.name, style: win.style, since: world.season + 1 }; for (const c of P.council) c.trust = clamp(c.trust + (c.faction === 'fans' ? STYLES[win.style].fans * 2 : 0), 0, 100); }
  moodChange(world, 0, STYLES[win.style].fans * (incWins ? 0 : 1));
  const txt = `🗳️ ${win.name} (${STYLES[win.style].name}) ${incWins ? 'bleibt' : 'wird neuer'} Präsident – ${winPct} % gegen ${lose.name}.${P.endorse != null ? (P.candidates[P.endorse] === win ? ' Dein Kandidat hat gewonnen – der Vorstand steht hinter dir.' : ' Du hast auf den Falschen gesetzt …') : ''}`;
  news(world, txt); log(P, world, txt);
  P.candidates = null; P.endorse = null; P.nextElection = world.season + 3;
  return { win, winPct };
}

/** supervisory-board vote on a request (once per half season) */
export function requestVote(world, key, rng) {
  const P = ensurePolitics(world, rng), R = REQUESTS[key], club = world.clubs[world.userClubId];
  const half = `${world.season}-${world.week < 17 ? 1 : 2}`;
  if (P.requestHalf === half) return { ok: false, msg: 'Der Aufsichtsrat tagt erst in der nächsten Saisonhälfte wieder.' };
  P.requestHalf = half;
  const M = ensureMood(world), st = styleOf(world);
  const votes = P.council.map((c) => {
    let p = c.trust / 100 + (M.board - 55) / 200 + (R.bias[c.faction] || 0) / 100;
    if (key === 'budget' || key === 'wages') p += (st.wage - 1) * 2;
    return { ...c, yes: rng.chance(clamp(p, 0.05, 0.95)) };
  });
  const yes = votes.filter((v) => v.yes).length, ok = yes >= 3;
  if (ok) {
    if (key === 'budget') { const add = Math.round(Math.max(club.budget, 2e6 * (club.women ? 0.1 : 1)) * 0.15 / 1e4) * 1e4; club.budget += add; }
    if (key === 'wages') club.wageBudget = Math.round(club.wageBudget * 1.1);
    if (key === 'stadium') club.buildDiscount = 0.3;
    if (key === 'youth') club.facilities.youth = Math.min(5, (club.facilities.youth || 1) + 1);
    if (key === 'contract') moodChange(world, 12, 0);
  } else moodChange(world, -2, 0);
  const txt = `🏛️ Aufsichtsrat – „${R.name}“: ${yes}:${5 - yes} – ${ok ? 'angenommen' : 'abgelehnt'}.`;
  log(P, world, txt); news(world, txt);
  return { ok: true, granted: ok, votes, msg: txt };
}
