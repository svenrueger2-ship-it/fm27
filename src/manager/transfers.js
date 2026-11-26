// Transfer market: windows, asking prices, bids & counter offers, contract negotiations, release clauses,
import { genderOk } from './gender.js';
import { diff } from './difficulty.js';
// loans with buy option, incoming offers for own players, contract extensions, free agents,
// scouting knowledge/reports and AI-to-AI transfers.
import { isHumanClub, forEachHuman, isHot } from './hotseat.js';
import { money, eur } from '../core/fmt.js';
import { rollRumours, confirmRumour, isDeadlineDay } from './events.js';
import { clamp } from '../core/rng.js';
import { POS_WEIGHTS, POS_COMPAT } from '../data/attributes.js';
import { FORMATIONS, autoLineup } from '../match/tactics.js';
import { bookTransfer, weeklyWages } from './economy.js';
import { aiMarket, clubWants, aiRenews } from './clubAI.js';
import { paySellOn, weeklyAgents, seasonPreContracts, applyPackage } from './agents.js';
import { statTransfer } from './achievements.js';
import { skillRank, taskEvent } from './progress.js';

// ----------------------------------------------------------------- setup / helpers
export function ensureTransferState(world) {
  world.transfer ||= { offers: [], history: [], listed: [], nextId: 1, pending: null };
  world.scouting ||= { knowledge: {}, watch: [], assignments: [], reports: {} };
  world.freeAgents ||= [];
  return world.transfer;
}

const leagueOf = (world, club) => world.leagues.find((l) => l.id === club.leagueId);
function userLeagueLen(world) { return leagueOf(world, world.clubs[world.userClubId]).fixtures.length; }

export function windowInfo(world) {
  const len = userLeagueLen(world), mid = Math.floor(len / 2);
  if (world.week < 6) return { open: true, name: 'Sommer-Transferfenster', closesIn: 6 - world.week };
  if (world.week >= mid - 1 && world.week < mid + 3) return { open: true, name: 'Winter-Transferfenster', closesIn: mid + 3 - world.week };
  return { open: false, name: 'Transferfenster geschlossen', opensIn: world.week < mid - 1 ? mid - 1 - world.week : len - world.week };
}

export function news(world, text) {
  world.news ||= [];
  world.news.unshift({ season: world.season, week: world.week + 1, text });
  world.news = world.news.slice(0, 60);
}

function clubRankOf(world, club, p) {
  const sorted = club.squad.map((id) => world.players[id]).sort((a, b) => b.ovr - a.ovr);
  return sorted.indexOf(p);
}

export function askingPrice(world, p, ai = false) {
  if (!p.clubId) return 0;
  const club = world.clubs[p.clubId];
  // the market value already accounts for the contract length – clubs only add a small premium for long deals
  let f = p.contract <= 1 ? 0.9 : p.contract === 2 ? 1.0 : p.contract === 3 ? 1.06 : 1.12;
  const r = clubRankOf(world, club, p);
  if (r >= 0 && r < 3) f *= 1.35; else if (r >= 0 && r < 11) f *= 1.15; else f *= 0.9;
  if (club.budget < 0) f *= 0.85;
  if (world.transfer?.listed?.includes(p.id)) f *= 0.85;
  if (!ai && p.clubId !== world.userClubId) f *= 1 - 0.04 * skillRank(world, 'verhandlung');
  if (!ai && p.clubId !== world.userClubId && world.difficulty) f *= diff(world).price; // v5.2
  const v = p.value * f;
  return v > 1e6 ? Math.round(v / 1e5) * 1e5 : Math.round(v / 1e4) * 1e4;
}

// ----------------------------------------------------------------- scouting
export function knowledge(world, p) {
  if (p.clubId === world.userClubId) return 100;
  const k = world.scouting?.knowledge?.[p.id];
  if (k != null) return k;
  const uc = world.clubs[world.userClubId];
  return p.clubId && world.clubs[p.clubId]?.leagueId === uc.leagueId ? 40 : 15;
}

export function estimate(world, p) {
  const k = knowledge(world, p);
  const e = Math.round(((100 - k) / 100) * 6), ep = Math.round(((100 - k) / 100) * 14);
  // deterministic jitter so the estimate does not reveal the true value as the middle
  const j = ((p.id * 7919) % 5) - 2;
  const mid = clamp(p.ovr + Math.round((j * e) / 3), 30, 99);
  const pmid = clamp(p.pot + Math.round((j * ep) / 4), mid, 99);
  return { k, ovr: mid, ovrLo: Math.max(30, mid - e), ovrHi: Math.min(99, mid + e), potLo: Math.max(mid, pmid - ep), potHi: Math.min(99, pmid + ep), exact: k >= 100 };
}

export function maxScouts(world) { return 2 + Math.floor((world.clubs[world.userClubId].facilities?.youth ?? 2) / 2) + skillRank(world, 'scouting'); }

export function assignScout(world, playerId) {
  const S = world.scouting;
  if (S.assignments.some((a) => a.playerId === playerId)) return { ok: false, msg: 'Wird bereits beobachtet' };
  if (S.assignments.length >= maxScouts(world)) return { ok: false, msg: `Alle ${maxScouts(world)} Scouts sind im Einsatz` };
  const p = world.players[playerId];
  const sameLeague = p.clubId && world.clubs[p.clubId].leagueId === world.clubs[world.userClubId].leagueId;
  const weeks = sameLeague || skillRank(world, 'scouting') >= 2 ? 1 : 2;
  S.assignments.push({ playerId, weeksLeft: weeks });
  if (!S.watch.includes(playerId)) S.watch.push(playerId);
  taskEvent(world, 'scout');
  return { ok: true, weeks };
}

export function scoutReport(world, p) {
  const keys = Object.keys(POS_WEIGHTS[p.pos]);
  const sorted = keys.slice().sort((a, b) => p.attrs[b] - p.attrs[a]);
  const uc = world.clubs[world.userClubId];
  const XI = uc.lineup?.xi?.map((id) => world.players[id]).filter(Boolean) || [];
  const samePos = XI.filter((q) => POS_COMPAT[p.pos]?.includes(q.pos));
  const best = samePos.length ? Math.max(...samePos.map((q) => q.ovr)) : 0;
  let rec;
  if (p.ovr >= best + 3) rec = 'Sofortige Verstärkung für die Startelf.';
  else if (p.pot >= best + 6 && p.age <= 22) rec = 'Großes Talent – Investition in die Zukunft.';
  else if (p.ovr >= best - 3) rec = 'Gleichwertige Alternative, sinnvoll für die Kaderbreite.';
  else rec = 'Keine Verstärkung für das aktuelle Team.';
  return { strengths: sorted.slice(0, 3), weaknesses: sorted.slice(-2), rec, week: world.week, season: world.season };
}

function weeklyScouting(world) {
  const S = world.scouting;
  for (const a of S.assignments) a.weeksLeft--;
  for (const a of S.assignments.filter((x) => x.weeksLeft <= 0)) {
    const p = world.players[a.playerId];
    if (!p) continue;
    S.knowledge[p.id] = 100;
    S.reports[p.id] = scoutReport(world, p);
    news(world, `Scoutingbericht fertig: ${p.firstName} ${p.lastName} (${p.pos}, ${p.age}) – Stärke ${p.ovr}, Potenzial ${p.pot}.`);
  }
  S.assignments = S.assignments.filter((x) => x.weeksLeft > 0);
}

// ----------------------------------------------------------------- contracts
export function contractDemand(world, p, club) {
  const own = p.clubId === club.id && !(p.loan && p.loan.to === club.id);
  const ceiling = club.rep * 0.45 + 58 + (own ? 4 : 0);
  const willing = p.ovr <= ceiling || (own && p.morale > 60);
  let wage = Math.max(p.wage * (own ? 1.08 : 1.15), Math.min(p.value * 0.1, 8e6 + p.value * 0.06), p.women ? 6000 : 20000);
  wage *= 1 + clamp((p.ovr - (club.rep * 0.4 + 45)) / 60, -0.2, 0.5);
  if (own) wage *= p.morale > 75 ? 0.95 : p.morale < 45 ? 1.15 : 1;
  const minY = p.age >= 31 ? 1 : 2, maxY = p.age >= 32 ? 2 : 5;
  return { wage: Math.round(wage / 1000) * 1000, minY, maxY, willing, reason: willing ? '' : `${p.lastName} sieht ${club.name} sportlich nicht auf seinem Niveau.` };
}

export function wageRoom(world, club, newWage, oldWage = 0) {
  return weeklyWages(world, club) - oldWage + newWage <= club.wageBudget * 1.05;
}

export function extendContract(world, playerId, wage, years) {
  const p = world.players[playerId], club = world.clubs[world.userClubId];
  const d = contractDemand(world, p, club);
  if (!d.willing) return { ok: false, msg: d.reason };
  if (years < d.minY || years > d.maxY) return { ok: false, msg: `Laufzeit muss zwischen ${d.minY} und ${d.maxY} Jahren liegen.` };
  if (wage < d.wage * 0.97) return { ok: false, msg: `${p.lastName} fordert mindestens ${eur(d.wage)} pro Jahr.` };
  if (!wageRoom(world, club, wage, p.wage)) return { ok: false, msg: 'Das Gehaltsbudget reicht dafür nicht aus.' };
  // the new deal starts after the running season, so 'years' are added on top of it
  p.wage = wage; p.contract = Math.max(p.contract, years + 1); p.morale = clamp(p.morale + 8, 0, 99);
  news(world, `${p.firstName} ${p.lastName} verlängert bis ${world.season + p.contract}.`);
  return { ok: true };
}

// ----------------------------------------------------------------- user buying
/** v6.0: value the selling club puts on a player offered in a swap */
export function swapValue(world, seller, sp) {
  const want = clubWants(world, seller, sp);
  return Math.round((askingPrice(world, sp, true) * (want >= 1 ? 0.85 : want > 0.3 ? 0.65 : 0.4)) / 1e4) * 1e4;
}
export function makeBid(world, playerId, fee, swaps = []) {
  const ban = world.clubs[world.userClubId].biz?.transferBan;
  if (ban && world.week < 20) return { result: 'rejected', reason: 'Transfersperre (Lizenzauflage) – Käufe erst ab dem Winter möglich.' };
  const T = ensureTransferState(world);
  const p = world.players[playerId], buyer = world.clubs[world.userClubId];
  const free = !p.clubId;
  if (!free && !windowInfo(world).open) return { result: 'rejected', reason: 'Das Transferfenster ist geschlossen.' };
  if (buyer.squad.length >= 32) return { result: 'rejected', reason: 'Dein Kader ist voll (max. 32 Spieler).' };
  if (free) { T.pending = { playerId, fee: 0, type: 'buy' }; return { result: 'accepted', fee: 0 }; }
  if (fee > buyer.budget) return { result: 'rejected', reason: 'Dafür reicht dein Budget nicht.' };
  const seller = world.clubs[p.clubId];
  if (p.loan) return { result: 'rejected', reason: 'Der Spieler ist derzeit verliehen.' };
  if (p.releaseClause && fee >= p.releaseClause) { T.pending = { playerId, fee, type: 'buy' }; return { result: 'accepted', fee, clause: true }; }
  if (p.buyBack?.club === buyer.id && world.season <= p.buyBack.until && fee >= p.buyBack.price) { T.pending = { playerId, fee, type: 'buy' }; return { result: 'accepted', fee, clause: true, buyBack: true }; }
  const pitch = (T.pitches || []).find((x) => x.playerId === playerId && world.week - x.week < 2);
  swaps = (swaps || []).filter((id) => buyer.squad.includes(id) && id !== playerId && !world.players[id]?.loan).slice(0, 2);
  const sv = swaps.reduce((a, id) => a + swapValue(world, seller, world.players[id]), 0);
  if (swaps.length && seller.squad.length + swaps.length > 32) return { result: 'rejected', reason: `${seller.name} hat keinen Platz im Kader für Tauschspieler.` };
  let ask = askingPrice(world, p);
  if (pitch) ask = Math.round((ask * (1 - pitch.discount)) / 1e4) * 1e4;
  const r = clubRankOf(world, seller, p);
  if (r >= 0 && r < 3 && seller.rep > buyer.rep + 12) return { result: 'rejected', reason: `${seller.name} gibt einen Leistungsträger nicht an einen kleineren Verein ab.` };
  if (seller.squad.length <= 19) return { result: 'rejected', reason: `${seller.name} hat einen zu kleinen Kader, um zu verkaufen.` };
  if (fee + sv >= ask) { T.pending = { playerId, fee, type: 'buy', swaps }; return { result: 'accepted', fee, swaps }; }
  if (fee + sv >= ask * 0.6) {
    // v6.0: the AI often asks for one of your players instead of the missing money
    const gap = ask - fee - sv;
    const wantP = buyer.squad.map((id) => world.players[id]).filter((q) => q && q.id !== playerId && !swaps.includes(q.id) && !q.loan && clubWants(world, seller, q) >= 1)
      .map((q) => ({ q, v: swapValue(world, seller, q) })).filter((x) => x.v >= gap * 0.6 && x.v <= gap * 1.6).sort((a, b) => Math.abs(a.v - gap) - Math.abs(b.v - gap))[0];
    if (wantP && Math.random() < 0.6) {
      const rest = Math.max(0, Math.round((fee + gap - wantP.v) / 1e4) * 1e4);
      return { result: 'countered', counter: rest, wantPlayer: wantP.q.id, swaps: [...swaps, wantP.q.id], reason: `${seller.name} schlägt vor: ${eur(rest)} plus ${wantP.q.firstName} ${wantP.q.lastName}.` };
    }
    if (fee + sv >= ask * 0.8 || Math.random() < 0.5) {
      const counter = Math.max(0, Math.round((ask * (0.95 + Math.random() * 0.06) - sv) / 1e4) * 1e4);
      return { result: 'countered', counter, swaps, reason: `${seller.name} verlangt ${eur(counter)}${swaps.length ? ' zusätzlich zum Tauschspieler' : ''}.` };
    }
  }
  return { result: 'rejected', reason: `${seller.name} lehnt ab – das Angebot ist zu niedrig.` };
}

export function signPending(world, wage, years) {
  const T = world.transfer, pend = T.pending;
  if (!pend) return { ok: false, msg: 'Keine Verhandlung offen' };
  const p = world.players[pend.playerId], club = world.clubs[world.userClubId];
  const d = contractDemand(world, p, club);
  if (!d.willing) { T.pending = null; return { ok: false, msg: d.reason, end: true } ; }
  if (years < d.minY || years > d.maxY) return { ok: false, msg: `Laufzeit muss zwischen ${d.minY} und ${d.maxY} Jahren liegen.` };
  if (wage < d.wage * 0.97) {
    pend.tries = (pend.tries || 0) + 1;
    if (pend.tries >= 3) { T.pending = null; return { ok: false, end: true, msg: `${p.lastName} bricht die Verhandlungen ab.` }; }
    return { ok: false, msg: `${p.lastName} fordert ${eur(d.wage)} pro Jahr (Versuch ${pend.tries}/3).` };
  }
  if (!wageRoom(world, club, wage)) return { ok: false, msg: 'Das Gehaltsbudget reicht dafür nicht aus. Verkaufe Spieler oder biete weniger.' };
  if (pend.type === 'buy') {
    const seller = p.clubId ? world.clubs[p.clubId] : null;
    executeTransfer(world, p, seller, club, pend.fee, wage, years);
    if (seller) for (const sid of pend.swaps || []) { const sp = world.players[sid]; if (sp && sp.clubId === club.id) executeTransfer(world, sp, club, seller, 0, sp.wage, Math.max(2, sp.contract || 2)); }
    if (p.buyBack?.club === club.id) p.buyBack = null;
    T.pitches = (T.pitches || []).filter((x) => x.playerId !== p.id);
  }
  T.pending = null;
  return { ok: true };
}

export function executeTransfer(world, p, from, to, fee, wage, years) {
  ensureTransferState(world);
  if (!genderOk(to, p)) return; // v6.0 women's and men's football stay separate
  if (from && fee && p.sellOn && p.sellOn.club !== to.id) { const share = Math.round((fee * p.sellOn.pct) / 100 / 1e4) * 1e4; from.budget -= share; paySellOn(world, p, fee); }
  if (p.preContract && p.preContract.club !== to.id) p.preContract = null;
  if (world.userClubId != null && (from?.id === world.userClubId || to.id === world.userClubId)) statTransfer(world, p, from, to, fee);
  if (from) {
    from.squad = from.squad.filter((id) => id !== p.id);
    if (from.lineup) { from.lineup = null; }
    bookTransfer(from, fee, `Verkauf ${p.firstName} ${p.lastName} an ${to.short}`, world);
  } else world.freeAgents = world.freeAgents.filter((id) => id !== p.id);
  bookTransfer(to, -fee, `Kauf ${p.firstName} ${p.lastName}${from ? ' von ' + from.short : ' (ablösefrei)'}`, world);
  to.squad.push(p.id);
  to.lineup = null;
  if (from && p.stats?.apps) (p.career ||= []).push({ season: world.season, club: from.short, clubId: from.id, apps: p.stats.apps, goals: p.stats.goals, assists: p.stats.assists, ovr: p.ovr, part: true });
  (p.moves ||= []).push({ season: world.season, week: world.week + 1, from: from?.short || null, to: to.short, fee });
  confirmRumour(world, p, to);
  p.clubId = to.id; p.wage = wage; p.contract = years; p.morale = clamp(p.morale + 10, 0, 99);
  p.loan = null; p.listed = false;
  const used = new Set([...to.squad.map((id) => world.players[id].number), ...(to.retired || []).map((r) => r.num)]);
  if (used.has(p.number) || p.number === 0) { let n = 2; while (used.has(n)) n++; p.number = n; }
  if (to.id === world.userClubId) { world.scouting.knowledge[p.id] = 100; }
  const T = world.transfer;
  T.listed = T.listed.filter((id) => id !== p.id);
  T.offers = T.offers.filter((o) => o.playerId !== p.id);
  T.history.unshift({ season: world.season, week: world.week + 1, playerId: p.id, name: `${p.firstName} ${p.lastName}`, from: from?.id ?? null, to: to.id, fee });
  T.history = T.history.slice(0, 300);
  if (to.id === world.userClubId || from?.id === world.userClubId)
    news(world, `Transfer: ${p.firstName} ${p.lastName} wechselt ${from ? `von ${from.name} ` : 'ablösefrei '}zu ${to.name}${fee ? ` (${money(fee)})` : ''}.`);
}

// ----------------------------------------------------------------- loans
export function loanTerms(world, p) {
  const club = world.clubs[p.clubId];
  const r = clubRankOf(world, club, p);
  return { fee: Math.round((p.value * 0.06) / 1e4) * 1e4, possible: r >= 11 && p.age <= 30 && !p.loan, buyOption: Math.round((askingPrice(world, p) * 1.05) / 1e5) * 1e5 };
}

export function requestLoan(world, playerId, wageShare, withOption) {
  const p = world.players[playerId], to = world.clubs[world.userClubId], from = world.clubs[p.clubId];
  if (!windowInfo(world).open) return { ok: false, msg: 'Das Transferfenster ist geschlossen.' };
  const t = loanTerms(world, p);
  if (!t.possible) return { ok: false, msg: `${from.name} verleiht nur Ergänzungsspieler bis 30 Jahre.` };
  if (wageShare < 0.5) return { ok: false, msg: `${from.name} verlangt, dass du mindestens 50 % des Gehalts übernimmst.` };
  if (to.budget < t.fee) return { ok: false, msg: 'Nicht genug Budget für die Leihgebühr.' };
  if (!wageRoom(world, to, p.wage * wageShare)) return { ok: false, msg: 'Das Gehaltsbudget reicht nicht aus.' };
  if (to.squad.length >= 32) return { ok: false, msg: 'Dein Kader ist voll.' };
  from.squad = from.squad.filter((id) => id !== p.id); from.lineup = null;
  (from.loanedOut ||= []).push(p.id);
  to.squad.push(p.id); to.lineup = null;
  const obligation = withOption === 'obligation' ? { fee: Math.round((t.buyOption * 0.9) / 1e5) * 1e5, apps: 12 } : null;
  p.loan = { from: from.id, to: to.id, until: world.season, wageShare, buyOption: withOption && !obligation ? t.buyOption : null, obligation };
  bookTransfer(to, -t.fee, `Leihgebühr ${p.lastName}`, world);
  bookTransfer(from, t.fee, `Leihgebühr ${p.lastName}`, null);
  world.scouting.knowledge[p.id] = 100;
  const used = new Set([...to.squad.filter((id) => id !== p.id).map((id) => world.players[id].number), ...(to.retired || []).map((r) => r.num)]);
  if (used.has(p.number)) { let n = 2; while (used.has(n)) n++; p.number = n; }
  news(world, `Leihe: ${p.firstName} ${p.lastName} kommt bis Saisonende von ${from.name}${obligation ? ` (Kaufpflicht ab ${obligation.apps} Einsätzen: ${money(obligation.fee)})` : withOption ? ` (Kaufoption ${money(t.buyOption)})` : ''}.`);
  return { ok: true };
}

export function exerciseOption(world, playerId) {
  const p = world.players[playerId], to = world.clubs[world.userClubId];
  if (!p.loan || p.loan.to !== to.id || !p.loan.buyOption) return { ok: false, msg: 'Keine Kaufoption vorhanden.' };
  if (to.budget < p.loan.buyOption) return { ok: false, msg: 'Nicht genug Budget.' };
  const from = world.clubs[p.loan.from];
  from.loanedOut = (from.loanedOut || []).filter((id) => id !== p.id);
  bookTransfer(to, -p.loan.buyOption, `Kaufoption ${p.lastName}`, world);
  bookTransfer(from, p.loan.buyOption, `Kaufoption ${p.lastName}`, null);
  news(world, `Kaufoption gezogen: ${p.firstName} ${p.lastName} bleibt fest bei ${to.name}.`);
  p.loan = null; p.contract = Math.max(p.contract, 3);
  return { ok: true };
}

function returnLoans(world) {
  for (const p of Object.values(world.players)) {
    if (!p.loan || p.loan.until > world.season) continue;
    const to = world.clubs[p.loan.to], from = world.clubs[p.loan.from];
    to.squad = to.squad.filter((id) => id !== p.id); to.lineup = null;
    from.loanedOut = (from.loanedOut || []).filter((id) => id !== p.id);
    from.squad.push(p.id); from.lineup = null;
    if (to.id === world.userClubId) news(world, `${p.firstName} ${p.lastName} kehrt nach der Leihe zu ${from.name} zurück.`);
    p.loan = null;
  }
}

// ----------------------------------------------------------------- selling (incoming offers)
export function toggleListed(world, playerId) {
  const T = world.transfer;
  if (T.listed.includes(playerId)) T.listed = T.listed.filter((id) => id !== playerId);
  else T.listed.push(playerId);
  return T.listed.includes(playerId);
}

export function generateOffers(world, rng) {
  const T = world.transfer, uc = world.clubs[world.userClubId];
  T.offers = T.offers.filter((o) => world.week - o.week < 2 && world.players[o.playerId]?.clubId === uc.id);
  if (!windowInfo(world).open) return;
  const clubs = Object.values(world.clubs).filter((c) => c.id !== uc.id);
  for (const id of uc.squad) {
    const p = world.players[id];
    if (p.loan || T.offers.some((o) => o.playerId === id)) continue;
    const listed = T.listed.includes(id) || p.wantsOut;
    if (!rng.chance(listed ? 0.55 : p.ovr > 72 ? 0.05 : 0.015)) continue;
    const cands = clubs.filter((c) => genderOk(c, p) && !c.nation && c.rep * 0.45 + 58 >= p.ovr && c.budget > askingPrice(world, p) * 0.8 && c.squad.length < 30);
    if (!cands.length) continue;
    // clubs with a real need for this position are far more likely to bid
    const buyer = rng.weighted(cands, (c) => clubWants(world, c, p) + 0.02);
    if (clubWants(world, buyer, p) < 0.5 && !listed && rng.chance(0.6)) continue;
    const fee = Math.round((askingPrice(world, p) * rng.range(listed ? 0.7 : 0.85, listed ? 1.0 : 1.2)) / 1e4) * 1e4;
    T.offers.push({ id: T.nextId++, playerId: id, clubId: buyer.id, fee, week: world.week, countered: false });
    news(world, `Angebot: ${buyer.name} bietet ${eur(fee)} für ${p.lastName}.`);
  }
}

export function respondOffer(world, offerId, action, rng) {
  const T = world.transfer;
  const o = T.offers.find((x) => x.id === offerId);
  if (!o) return { ok: false, msg: 'Angebot nicht mehr gültig' };
  const p = world.players[o.playerId], buyer = world.clubs[o.clubId], me = world.clubs[world.userClubId];
  if (action === 'reject') { T.offers = T.offers.filter((x) => x !== o); p.morale = clamp(p.morale - (p.ovr > 70 ? 3 : 0), 0, 99); return { ok: true, msg: 'Angebot abgelehnt' }; }
  if (action === 'counter') {
    if (o.countered) return { ok: false, msg: 'Du hast bereits nachverhandelt.' };
    o.countered = true;
    if (rng.chance(0.55) && buyer.budget > o.fee * 1.15) { o.fee = Math.round((o.fee * 1.15) / 1e4) * 1e4; return { ok: true, msg: `${buyer.name} erhöht auf ${eur(o.fee)}.` }; }
    T.offers = T.offers.filter((x) => x !== o);
    return { ok: true, msg: `${buyer.name} zieht das Angebot zurück.` };
  }
  if (me.squad.length <= 18) return { ok: false, msg: 'Mindestens 18 Spieler müssen im Kader bleiben.' };
  const d = contractDemand(world, p, buyer);
  let fee = o.fee;
  if (action === 'sellon') { fee = Math.round((o.fee * 0.9) / 1e4) * 1e4; }
  if (action === 'buyback') { fee = Math.round((o.fee * 0.92) / 1e4) * 1e4; }
  executeTransfer(world, p, me, buyer, fee, Math.max(d.wage, p.wage), Math.max(d.minY, 3));
  if (action === 'sellon') p.sellOn = { club: me.id, pct: 15 };
  if (action === 'buyback') p.buyBack = { club: me.id, price: Math.round((o.fee * 1.5) / 1e5) * 1e5, until: world.season + 2 };
  return { ok: true, msg: `${p.lastName} verkauft für ${eur(fee)}${action === 'sellon' ? ' plus 15 % Weiterverkaufsbeteiligung' : action === 'buyback' ? ` mit Rückkaufoption über ${eur(p.buyBack.price)} (bis Saison ${p.buyBack.until})` : ''}.` };
}

// ----------------------------------------------------------------- AI clubs
function weakestSlot(world, club) {
  const L = autoLineup(club, world.players, club.tactic.formation);
  const slots = FORMATIONS[L.formation];
  let worst = null;
  L.xi.forEach((id, i) => { const p = world.players[id]; const v = p ? p.ovr : 0; if (!worst || v < worst.v) worst = { v, pos: slots[i][0] }; });
  return worst;
}

// ----------------------------------------------------------------- weekly & seasonal hooks
export function weeklyTransfers(world, rng) {
  ensureTransferState(world);
  const win = windowInfo(world);
  // v5.0: everything that concerns a manager runs for every hotseat human with his own state
  forEachHuman(world, () => {
    ensureTransferState(world);
    weeklyScouting(world);
    if (world.userClubId != null) weeklyAgents(world, rng);
    generateOffers(world, rng);
    if (world.userClubId != null) weeklyPitches(world, rng); // v6.0
    if (win.open) rollRumours(world, rng, isDeadlineDay(win) ? 5 : 2);
    if (isDeadlineDay(win)) generateOffers(world, rng); // Deadline Day: late offers for the user's players
    // contract expiry warnings
    const uc = world.clubs[world.userClubId];
    if (uc && world.week === userLeagueLen(world) - 6) {
      const exp = uc.squad.map((id) => world.players[id]).filter((p) => p.contract <= 1 && !p.loan);
      if (exp.length) news(world, `${isHot(world) ? `${uc.short}: ` : ''}Vertragsende im Sommer: ${exp.map((p) => p.lastName).join(', ')}. Verlängere rechtzeitig unter „Transfers → Verträge“.`);
    }
  });
  aiMarket(world, rng);
  if (isDeadlineDay(win)) news(world, `⏰ DEADLINE DAY! Heute schließt das ${win.name}. Letzte Chance für Transfers – die Gerüchteküche brodelt.`);
}

// Season end: loans return, contracts expire → free agents, AI renewals, old free agents retire.
export function seasonTransfers(world, rng) {
  ensureTransferState(world);
  returnLoans(world);
  for (const id of world.freeAgents.slice()) { const p = world.players[id]; if (!p || p.faSince < world.season) { world.freeAgents = world.freeAgents.filter((x) => x !== id); delete world.players[id]; } }
  for (const club of Object.values(world.clubs)) {
    for (const id of club.squad.slice()) {
      const p = world.players[id];
      p.contract--;
      if (p.contract > 0) continue;
      const user = isHumanClub(world, club.id);
      if (!user && !p.preContract && aiRenews(world, club, p, rng)) { p.contract = rng.int(1, p.age > 31 ? 1 : 4); p.wage = Math.round(p.wage * 1.08 / 1000) * 1000; continue; }
      club.squad = club.squad.filter((x) => x !== id); club.lineup = null;
      p.clubId = null; p.faSince = world.season; p.contract = 0;
      world.freeAgents.push(id);
      if (user) news(world, `${p.firstName} ${p.lastName} verlässt den Verein ablösefrei (Vertrag ausgelaufen).`);
    }
  }
  seasonPreContracts(world);
  // AI clubs refill thin squads with free agents (or youth if nobody fits)
  for (const club of Object.values(world.clubs)) {
    if (isHumanClub(world, club.id)) continue;
    let guard = 0;
    while (club.squad.length < 23 && guard++ < 8) {
      const need = weakestSlot(world, club);
      const cap = club.rep * 0.45 + 58;
      const fa = world.freeAgents.map((id) => world.players[id]).filter((p) => p && genderOk(club, p) && p.ovr <= cap && (!need || POS_COMPAT[need.pos]?.includes(p.pos))).sort((a, b) => b.ovr - a.ovr)[0]
        || world.freeAgents.map((id) => world.players[id]).filter((p) => p && genderOk(club, p) && p.ovr <= cap).sort((a, b) => b.ovr - a.ovr)[0];
      if (!fa) break;
      const d = contractDemand(world, fa, club);
      executeTransfer(world, fa, null, club, 0, d.wage, rng.int(d.minY, d.maxY));
    }
  }
  // v2.9: the user's squad must never be unplayable after expiring contracts / retirements:
  // below 16 players the U19 talents move up first, then cheap free agents are signed as cover
  forEachHuman(world, () => userSeasonSquad(world));
}

// the user's squad must stay playable (also for every hotseat human)
function userSeasonSquad(world) {
  ensureTransferState(world);
  const me = world.clubs[world.userClubId];
  if (me && me.squad.length < 16) {
    const before = me.squad.length;
    const youth = (world.youth || []).map((id) => world.players[id]).filter((p) => p && p.age >= 16).sort((a, b) => b.ovr - a.ovr);
    for (const y of youth) { if (me.squad.length >= 16) break; world.youth = world.youth.filter((x) => x !== y.id); y.youthOf = null; y.clubId = me.id; y.contract = 3; y.wage = Math.round((18000 + y.ovr * 900) / 1000) * 1000; me.squad.push(y.id); }
    let guard = 0;
    while (me.squad.length < 16 && guard++ < 20) {
      const need = weakestSlot(world, me);
      const pool = world.freeAgents.map((id) => world.players[id]).filter((p) => p && genderOk(me, p) && p.ovr <= me.rep * 0.45 + 52);
      const fa = pool.filter((p) => !need || POS_COMPAT[need.pos]?.includes(p.pos)).sort((a, b) => b.ovr - a.ovr)[0] || pool.sort((a, b) => b.ovr - a.ovr)[0];
      if (!fa) break;
      const d = contractDemand(world, fa, me);
      executeTransfer(world, fa, null, me, 0, Math.round(d.wage * 0.8), 1);
    }
    me.lineup = null;
    if (me.squad.length > before) news(world, `⚠️ Notkader: Nur noch ${before} Spieler unter Vertrag – ${me.squad.length - before} Spieler (U19 und vereinslose Profis) wurden aufgefüllt. Verstärke dich auf dem Transfermarkt!`);
  }
  world.transfer.listed = world.transfer.listed.filter((id) => world.players[id]?.clubId === world.userClubId);
  world.transfer.offers = [];
}

export function searchMarket(world, f = {}) {
  const uc = world.userClubId;
  const out = [];
  for (const p of Object.values(world.players)) {
    if (p.clubId === uc || (p.loan && p.loan.to === uc)) continue;
    if (!genderOk(world.clubs[uc], p)) continue;
    if (f.pos && f.pos !== 'ALLE' && p.pos !== f.pos) continue;
    if (f.maxAge && p.age > f.maxAge) continue;
    if (f.league && f.league !== 'ALLE') { if (f.league === 'FREI') { if (p.clubId) continue; } else if (!p.clubId || world.clubs[p.clubId].leagueId !== f.league) continue; }
    if (f.listed && !world.transfer.listed.includes(p.id)) continue;
    const est = estimate(world, p);
    if (f.minOvr && est.ovr < f.minOvr) continue;
    const price = askingPrice(world, p);
    if (f.maxPrice && price > f.maxPrice) continue;
    if (f.name && !(`${p.firstName} ${p.lastName}`.toLowerCase().includes(f.name.toLowerCase()))) continue;
    out.push({ p, est, price });
  }
  out.sort((a, b) => (f.sort === 'pot' ? b.est.potHi - a.est.potHi : f.sort === 'price' ? a.price - b.price : f.sort === 'age' ? a.p.age - b.p.age : b.est.ovr - a.est.ovr));
  return out.slice(0, 120);
}

// ----------------------------------------------------------------- v6.0 agents pitch players to you
const AGENT_NAMES = ['Pini Zahavi Jr.', 'Volker Struth-Agentur', 'Rogon Sportmanagement', 'Gestifute Partner', 'ProSoccer Consulting', 'Elite Football Agency', 'Stellar Group', 'Lagardère Talents', 'Unique Sports Group'];
export function weeklyPitches(world, rng) {
  const T = ensureTransferState(world), uc = world.clubs[world.userClubId];
  T.pitches = (T.pitches || []).filter((x) => world.week - x.week < 2 && world.players[x.playerId] && world.players[x.playerId].clubId !== uc.id);
  if (!windowInfo(world).open || T.pitches.length >= 3 || !rng.chance(0.45)) return;
  const need = weakestSlot(world, uc);
  const strength = uc.squad.map((id) => world.players[id]?.ovr || 0).sort((a, b) => b - a)[10] || 60;
  const pool = [...(world.freeAgents || []), ...(T.listed || []), ...Object.values(world.clubs).filter((c) => c.id !== uc.id && !c.nation).flatMap((c) => c.squad.slice(-6))]
    .map((id) => world.players[id]).filter((p) => p && !p.loan && p.clubId !== uc.id && (!need || p.pos === need.pos) && p.ovr >= strength - 4 && p.ovr <= strength + 8 && genderOk(uc, p));
  if (!pool.length) return;
  const p = rng.pick(pool);
  if (T.pitches.some((x) => x.playerId === p.id)) return;
  const agent = rng.pick(AGENT_NAMES), discount = rng.pick([0.08, 0.1, 0.12, 0.15]);
  T.pitches.push({ id: (T.nextId = (T.nextId || 1) + 1), playerId: p.id, agent, discount, week: world.week });
  news(world, `📞 Berater-Angebot: ${agent} bietet dir ${p.firstName} ${p.lastName} (${p.pos}, ${p.age}) an – ${Math.round(discount * 100)} % unter der üblichen Ablöse, nur diese Woche.`);
}
