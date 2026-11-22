// Agents & contracts (v2.0): every player has an agent with greed, patience and an agent fee.
// Contract poker with signing fee, agent fee, release clause, goal & appearance bonuses;
// pre-contracts (Bosman) for players in the last year of their contract – in both directions;
// release clauses that rich clubs can trigger; sell-on percentages on outgoing transfers.
import { clamp } from '../core/rng.js';
import { contractDemand, news, ensureTransferState, executeTransfer } from './transfers.js';
import { ensureStats } from './achievements.js';

const eur = (n) => `${Math.round(n).toLocaleString('de-DE')} €`; // exact amounts in negotiations (v2.9)
const AGENTS = [
  ['Jorge Mendoza', 1.3, 2, 0.1], ['Pini Zahavsky', 1.25, 2, 0.12], ['Volker Struth', 1.12, 3, 0.08], ['Rafaela Pimenta', 1.22, 2, 0.1],
  ['Kia Joorab', 1.15, 3, 0.09], ['Marc Kosicke', 1.05, 4, 0.06], ['Giuliano Bertolucci', 1.1, 3, 0.07], ['Sascha Breese', 1.0, 4, 0.05],
  ['Dirk Hebel', 0.95, 4, 0.05], ['Familienberater', 0.9, 5, 0.03], ['Roman Grill', 1.08, 3, 0.07], ['Lena Wiedemann', 1.0, 4, 0.05],
];
export function agentOf(p) {
  const tier = p.ovr >= 84 ? [0, 1, 3, 4] : p.ovr >= 76 ? [2, 4, 6, 10] : [5, 7, 8, 9, 11];
  const [name, greed, patience, fee] = AGENTS[tier[p.id % tier.length]];
  return { name, greed, patience, fee };
}

// package value from the player's point of view (per year, in €)
function packageValue(p, o) {
  const yrs = Math.max(1, o.years);
  const expGoals = p.pos === 'ST' ? 12 : ['LA', 'RA', 'OM'].includes(p.pos) ? 7 : ['ZM', 'LM', 'RM'].includes(p.pos) ? 3 : 1;
  const clauseBonus = o.clause ? clamp(1 - o.clause / Math.max(1, p.value * 3), 0, 0.6) * p.wage * 0.25 : 0;
  return o.wage + (o.signing || 0) / yrs + (o.goalBonus || 0) * expGoals + (o.appBonus || 0) * 25 + clauseBonus;
}

export function demandPackage(world, p, club) {
  const d = contractDemand(world, p, club), A = agentOf(p);
  const own = p.clubId === club.id;
  const target = d.wage * A.greed * (own ? 0.98 : 1.03);
  return { ...d, agent: A, target, agentFee: Math.round((own ? d.wage * 0.5 : d.wage * 1.2) * A.fee * 10 / 1e4) * 1e4, signing: Math.round((target * 0.3) / 1e4) * 1e4 };
}

// one round of contract poker → { status: 'accepted' | 'counter' | 'broken', msg, counter }
export function pokerRound(world, p, club, offer, state) {
  const D = demandPackage(world, p, club);
  if (!D.willing) return { status: 'broken', msg: D.reason };
  if (offer.years < D.minY || offer.years > D.maxY) return { status: 'counter', msg: `${D.agent.name}: „Über ${offer.years} Jahre reden wir nicht. ${D.minY}–${D.maxY} Jahre.“` };
  const v = packageValue(p, offer);
  const feeOk = (offer.agentFee || 0) >= D.agentFee * 0.8;
  state.rounds = (state.rounds || 0) + 1;
  if (v >= D.target * 0.97 && feeOk) return { status: 'accepted', msg: `${D.agent.name}: „Wir haben einen Deal!“` };
  const gap = v / D.target;
  if (state.rounds > D.agent.patience + 1 || gap < 0.72) {
    state.broken = true;
    if (p.clubId === club.id) p.morale = clamp(p.morale - 6, 5, 99);
    return { status: 'broken', msg: `${D.agent.name}: „Das ist respektlos. Wir beenden die Gespräche.“` };
  }
  const need = Math.round(((D.target - v) * Math.max(1, offer.years)) / 1e4) * 1e4;
  const ask = !feeOk ? `Ich erwarte ein Beraterhonorar von mindestens ${eur(D.agentFee)}.` : gap > 0.9 ? `Legen Sie noch etwa ${eur(need)} über die Laufzeit drauf – als Handgeld, Gehalt oder Prämien.` : `Mein Spieler ist mehr wert. Wir sind noch weit auseinander.`;
  return { status: 'counter', msg: `${D.agent.name} (Runde ${state.rounds}/${D.agent.patience + 1}): „${ask}“` };
}

// apply an accepted package to the player (wage, years, bonuses, clause) and pay one-off fees
export function applyPackage(world, p, club, offer) {
  const one = (offer.signing || 0) + (offer.agentFee || 0);
  club.budget -= one;
  if (one && club.finance) club.finance.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'wages', label: `Handgeld & Berater ${p.lastName}`, amount: -one }], net: -one });
  p.bonus = offer.goalBonus || offer.appBonus ? { goal: offer.goalBonus || 0, app: offer.appBonus || 0 } : null;
  p.releaseClause = offer.clause || null;
}

// bonuses are paid after every match of the user's club
export function payBonuses(world, club, played, events) {
  let sum = 0;
  for (const id of played) { const p = world.players[id]; if (p?.bonus?.app) sum += p.bonus.app; }
  for (const e of events) if (e.type === 'goal' && !e.own) { const p = world.players[e.player]; if (p?.clubId === club.id && p.bonus?.goal) sum += p.bonus.goal; }
  if (sum) { club.budget -= sum; if (club.finance?.season) club.finance.season.wages = (club.finance.season.wages || 0) - sum; }
  return sum;
}

// ------------------------------------------------------------------ Bosman / pre-contracts
export const preContractOpen = (world) => world.week >= 17;
export function canPreContract(world, p) {
  return preContractOpen(world) && p.clubId && p.clubId !== world.userClubId && p.contract === 1 && !p.preContract && !p.loan;
}
export function signPreContract(world, p, offer) {
  const club = world.clubs[world.userClubId];
  ensureStats(world).preContracts++;
  const one = (offer.signing || 0) + (offer.agentFee || 0);
  club.budget -= one;
  p.preContract = { club: world.userClubId, wage: offer.wage, years: offer.years, bonus: offer.goalBonus || offer.appBonus ? { goal: offer.goalBonus || 0, app: offer.appBonus || 0 } : null, clause: offer.clause || null };
  news(world, `📝 Vorvertrag: ${p.firstName} ${p.lastName} wechselt im Sommer ablösefrei von ${world.clubs[p.clubId].short} zu ${world.clubs[world.userClubId].name}.`);
}

// weekly: AI clubs approach the user's players with expiring contracts; release clauses get triggered
export function weeklyAgents(world, rng) {
  const me = world.clubs[world.userClubId]; if (!me) return;
  if (preContractOpen(world)) {
    for (const id of me.squad) {
      const p = world.players[id];
      if (!p || p.contract !== 1 || p.preContract || p.loan || p.ovr < 62) continue;
      if (!rng.chance(0.04 + (p.wantsOut ? 0.08 : 0) + (p.morale < 45 ? 0.04 : 0))) continue;
      const suitors = Object.values(world.clubs).filter((c) => c.id !== me.id && c.rep * 0.45 + 58 >= p.ovr && c.rep >= me.rep - 8);
      if (!suitors.length) continue;
      const c = rng.pick(suitors);
      p.preContract = { club: c.id };
      news(world, `😱 ${p.firstName} ${p.lastName} hat einen Vorvertrag bei ${c.name} unterschrieben und geht im Sommer ablösefrei – sein Vertrag wurde nicht rechtzeitig verlängert.`);
    }
  }
  // release clauses
  ensureTransferState(world);
  if (world.week % 2 === 0) {
    for (const id of me.squad.slice()) {
      const p = world.players[id];
      if (!p?.releaseClause || p.loan) continue;
      if (!(world.week < 6 || (world.week >= 17 && world.week <= 20))) continue; // only in transfer windows
      const buyer = Object.values(world.clubs).filter((c) => c.id !== me.id && c.ai && c.rep > me.rep && c.budget * 0.8 >= p.releaseClause && c.rep * 0.45 + 58 >= p.ovr).sort((a, b) => b.rep - a.rep)[0];
      if (!buyer || !rng.chance(clamp(p.value / p.releaseClause - 0.6, 0, 0.6))) continue;
      const fee = p.releaseClause;
      executeTransfer(world, p, me, buyer, fee, Math.round(p.wage * 1.3 / 1000) * 1000, 4);
      news(world, `💥 Ausstiegsklausel gezogen! ${buyer.name} zahlt ${(fee / 1e6).toFixed(1).replace('.', ',')} Mio. € für ${p.firstName} ${p.lastName} – du konntest nichts tun.`);
    }
  }
}

// season end: pre-contracts become real transfers (call before contracts expire)
export function seasonPreContracts(world) {
  // runs after contracts expired: players with a pre-contract are free agents now
  for (const id of (world.freeAgents || []).slice()) {
    const p = world.players[id];
    if (!p?.preContract) continue;
    const from = null, to = world.clubs[p.preContract.club];
    if (!to) { p.preContract = null; continue; }
    void from;
    const pc = p.preContract;
    const wage = pc.wage || Math.round(p.wage * 1.2 / 1000) * 1000, years = pc.years || 3;
    p.preContract = null;
    executeTransfer(world, p, null, to, 0, wage, years);
    if (pc.bonus) p.bonus = pc.bonus;
    if (pc.clause) p.releaseClause = pc.clause;
    if (to.id === world.userClubId || p.career?.slice(-1)[0]?.clubId === world.userClubId) news(world, `🔁 Bosman-Wechsel: ${p.firstName} ${p.lastName} schließt sich ablösefrei ${to.name} an.`);
  }
}

// sell-on: when a player is transferred, the former club with a sell-on clause gets its share
export function paySellOn(world, p, fee) {
  if (!p.sellOn || !fee) return;
  const c = world.clubs[p.sellOn.club];
  const amount = Math.round((fee * p.sellOn.pct) / 100 / 1e4) * 1e4;
  if (c && amount > 0) {
    c.budget += amount;
    if (c.id === world.userClubId) news(world, `💶 Weiterverkaufsbeteiligung: ${p.lastName} wurde verkauft – du erhältst ${p.sellOn.pct} % = ${(amount / 1e6).toFixed(2).replace('.', ',')} Mio. €.`);
  }
  p.sellOn = null;
}
