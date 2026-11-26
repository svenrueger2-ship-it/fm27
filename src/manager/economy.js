// Finances & club development: weekly income/expenses for every club, ledger + balance history,
// facilities (training ground, youth academy, medical department, stadium expansion).
import { isHumanClub } from './hotseat.js';
import { clamp } from '../core/rng.js';
import { skillRank } from './progress.js';
import { ensureStadium, weeklyConstruction, hospitalityIncome, interiorIncome, interiorWeekly, standingShare, screensBonus, lightsBonus, awayIncome, familyBonus } from './stadiumBuild.js';
import { wScale } from './gender.js';

export const FACILITIES = {
  training: { name: 'Trainingsgelände', desc: 'Schnellere Spielerentwicklung im Training.', max: 5 },
  youth: { name: 'Jugendakademie', desc: 'Bessere Talente beim Nachwuchs-Jahrgang zum Saisonende.', max: 5 },
  medical: { name: 'Medizinische Abteilung', desc: 'Weniger Trainingsverletzungen, schnellere Genesung.', max: 5 },
};

const tierFactor = (league) => (league.tier === 1 ? 1 : league.tier === 2 ? 0.55 : 0.3);

export function ensureEconomy(club, league) {
  if (!club.facilities) club.facilities = { training: Math.max(1, Math.min(5, Math.round(club.rep / 22))), youth: Math.max(1, Math.min(5, Math.round(club.rep / 25))), medical: Math.max(1, Math.min(5, Math.round(club.rep / 24))) };
  if (!club.finance) club.finance = { history: [], ledger: [], season: emptySeason(), ticketPrice: Math.round(12 + club.rep * 0.45 * (0.6 + 0.4 * tierFactor(league))) };
  if (!club.wageBudget) club.wageBudget = 1e6;
  ensureStadium(club, league?.country);
  return club;
}

export function emptySeason() {
  return { tickets: 0, hospitality: 0, tv: 0, sponsors: 0, merch: 0, transfersIn: 0, transfersOut: 0, wages: 0, facilities: 0, construction: 0, prize: 0, stock: 0 };
}

export function seasonWeeks(league) { return league.fixtures.length || 34; }

export function attendance(club, league, rank) {
  const n = league.clubIds.length;
  const formBonus = rank ? (1 - rank / n) * 0.12 : 0;
  const priceEffect = clamp(1.15 - club.finance.ticketPrice / (20 + club.rep * 0.7), 0.6, 1.1);
  const fill = clamp((0.5 + club.rep / 230 + formBonus) * priceEffect, 0.25, 1);
  return Math.round(club.stadium.capacity * fill);
}

export function weeklyWages(world, club) {
  let s = 0;
  for (const id of club.squad) { const p = world.players[id]; s += p.loan && p.loan.to === club.id ? p.wage * p.loan.wageShare : p.wage; }
  // players loaned out: parent club pays the remaining share
  for (const id of club.loanedOut || []) { const p = world.players[id]; if (p?.loan) s += p.wage * (1 - p.loan.wageShare); }
  return s;
}

// Called once per week for every club.
export function weeklyFinance(world, club, league, { homeGame, rank }) {
  ensureEconomy(club, league);
  const W = seasonWeeks(league), F = club.finance, tf = tierFactor(league);
  const rows = [];
  const add = (key, label, amount) => { if (!amount) return; F.season[key] += amount; rows.push({ key, label, amount: Math.round(amount) }); };
  if (homeGame) {
    const att = Math.round(attendance(club, league, rank) * (club.id === world.userClubId && world.fans?.protest?.type === 'boycott' ? 0.82 : 1));
    const st = club.seasonTix?.season === world.season ? club.seasonTix.share * 0.92 : 0; // v7.0: season tickets were paid in advance
    add('tickets', `Ticketverkauf (${att.toLocaleString('de-DE')} Zuschauer)`, att * F.ticketPrice * (1 - standingShare(club.stadium.layout) * 0.45) * (1 - st));
    add('hospitality', 'VIP-Logen & Hospitality', hospitalityIncome(club));
    add('tickets', 'Gästeblock', awayIncome(club));
    add('hospitality', 'Catering, Fanshop & Fan-Zone', interiorIncome(club));
    F.lastAttendance = att;
  }
  add('tv', 'TV-Gelder', (league.tv * 1e6 * (0.3 + 0.55 * (club.rep / 100)) * lightsBonus(club)) / W);
  add('sponsors', club.sponsorDeals ? 'Kleinere Partner' : 'Sponsoren', (Math.pow(club.rep, 2) * 2600 * (0.25 + 0.75 * tf) * (club.sponsorDeals ? 0.35 : 1) * wScale(club)) / W);
  add('merch', 'Merchandising', (Math.pow(club.rep, 2) * 900 * wScale(club) * (club.merchMult || 1) * (club.retroBoost ? 1.08 : 1) * (0.35 + 0.65 * tf) * (club.form ?? 1) * screensBonus(club) * familyBonus(club) * (club.biz ? 1 + ((club.biz.shop ?? 1) - 1) * 0.12 : 1)) / W);
  add('sponsors', 'Museum & Medienzentrum', interiorWeekly(club));
  if (club.biz) add('sponsors', 'Mitgliedsbeiträge', (club.biz.members * (club.biz.fee || 72)) / W);
  if (club.stadium.naming) add('sponsors', `Namensrechte ${club.stadium.naming.brand}`, club.stadium.naming.perSeason / W);
  if (club.sponsorDeals) for (const d of Object.values(club.sponsorDeals)) if (d) add('sponsors', `${d.slotName}: ${d.brand}`, d.perSeason / W);
  if (club.id === world.userClubId && skillRank(world, 'finanzen')) { const base = rows.filter((r) => ['tickets', 'sponsors', 'merch'].includes(r.key)).reduce((s, r) => s + r.amount, 0); if (base > 0) add('sponsors', 'Vermarktungsgeschick (Manager-Skill)', base * 0.025 * skillRank(world, 'finanzen')); }
  add('wages', 'Gehälter', -weeklyWages(world, club) / W);
  if (world.mode === 'director' && world.coach && club.id === world.userClubId) add('wages', `Cheftrainer ${world.coach.name}`, -world.coach.wage / W);
  if (isHumanClub(world, club.id)) {
    const staff = Object.values(world.staff?.members || {}).reduce((a, m) => a + m.wage, 0) + (world.scoutNet?.scouts || []).reduce((a, s) => a + s.wage, 0);
    add('wages', 'Trainerstab & Scouts', -staff / W);
  }
  const f = club.facilities;
  add('facilities', 'Unterhalt Anlagen & Stadion', -((f.training + f.youth + f.medical) * 9000 + club.stadium.capacity * 0.9) * (0.5 + 0.5 * tf));
  weeklyConstruction(world, club);
  const net = rows.reduce((s, r) => s + r.amount, 0);
  club.budget = Math.round(club.budget + net);
  if (isHumanClub(world, club.id)) {
    F.ledger.unshift({ season: world.season, week: world.week + 1, rows, net: Math.round(net) });
    F.ledger = F.ledger.slice(0, 60);
  }
  F.history.push({ season: world.season, week: world.week + 1, balance: club.budget });
  if (F.history.length > 120) F.history.shift();
  return net;
}

export function bookTransfer(club, amount, label, world) {
  const F = club.finance;
  if (!F) return;
  if (amount > 0) F.season.transfersIn += amount; else F.season.transfersOut += amount;
  club.budget = Math.round(club.budget + amount);
  if (world && isHumanClub(world, club.id)) F.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'transfer', label, amount: Math.round(amount) }], net: Math.round(amount) });
}

export function facilityCost(club, key, league) {
  const lvl = club.facilities[key];
  return Math.round(((lvl + 1) * (lvl + 1) * 650000 * (0.4 + 0.6 * tierFactor(league))) / 1e4) * 1e4;
}

export function stadiumExpansionCost(club) { return Math.round((5000 * (1800 + club.stadium.capacity * 0.02)) / 1e5) * 1e5; }

export function upgradeFacility(world, club, key, league) {
  const cost = facilityCost(club, key, league);
  if (club.facilities[key] >= FACILITIES[key].max) return { ok: false, msg: 'Maximale Stufe erreicht' };
  if (club.budget < cost) return { ok: false, msg: 'Nicht genug Geld' };
  club.budget -= cost; club.finance.season.construction -= cost;
  club.facilities[key]++;
  club.finance.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'construction', label: `Ausbau ${FACILITIES[key].name} → Stufe ${club.facilities[key]}`, amount: -cost }], net: -cost });
  return { ok: true, cost };
}

export function expandStadium(world, club) {
  const cost = stadiumExpansionCost(club);
  if (club.stadium.capacity >= 90000) return { ok: false, msg: 'Maximale Stadiongröße erreicht' };
  if (club.budget < cost) return { ok: false, msg: 'Nicht genug Geld' };
  club.budget -= cost; club.finance.season.construction -= cost;
  club.stadium.capacity += 5000; club.stadium.level = (club.stadium.level || 1) + 1;
  club.finance.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'construction', label: `Stadionausbau auf ${club.stadium.capacity.toLocaleString('de-DE')} Plätze`, amount: -cost }], net: -cost });
  return { ok: true, cost };
}

// End-of-season prize money by final rank & new wage budget.
export function seasonFinanceClose(world, club, league, rank) {
  ensureEconomy(club, league);
  const n = league.clubIds.length;
  const prize = Math.round(league.tv * 1e6 * 0.25 * ((n - rank + 1) / n));
  club.budget += prize; club.finance.season.prize += prize;
  const s = club.finance.season;
  const income = s.tickets + (s.hospitality || 0) + s.tv + s.sponsors + s.merch + s.prize;
  // naming-rights contract runs out
  const nm = club.stadium.naming;
  if (nm && --nm.yearsLeft <= 0) { club.stadium.naming = null; club.stadium.name = club.stadium.baseName || club.stadium.name; if (isHumanClub(world, club.id)) world.news.unshift({ season: world.season + 1, week: 0, text: `Der Namensrechte-Vertrag mit ${nm.brand} ist ausgelaufen.` }); }
  club.wageBudget = Math.round(Math.max(club.wageBudget * 0.9, income * 0.72) / 1e5) * 1e5;
  club.finance.lastSeason = { ...s, season: world.season };
  club.finance.season = emptySeason();
  return prize;
}
