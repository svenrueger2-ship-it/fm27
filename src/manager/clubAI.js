// Club AI (v0.9): every computer club has an identity (philosophy), a head coach with style and
// quality, and plans its squad like a real sporting director: it analyses gaps (depth, quality, age,
// expiring contracts), scouts fitting targets, bids, gets refused or countered, fights bidding wars,
// sells surplus players, loans out talents and sacks its coach when results do not match expectations.
import { money } from '../core/fmt.js';
import { clamp } from '../core/rng.js';
import { PRESETS, FORMATIONS, autoLineup, teamStrength } from '../match/tactics.js';
import { makeCoach } from './director.js';
import { askingPrice, contractDemand, executeTransfer, windowInfo, news } from './transfers.js';
import { computeTable } from './season.js';

export const PHILOSOPHIES = {
  star: { label: 'Starensemble', desc: 'kauft fertige Topspieler, verkauft nur ungern', maxAge: 30, potW: 0.15, spend: 0.75, sell: 1.45, loanOut: 0.2 },
  ausbildung: { label: 'Ausbildungsverein', desc: 'setzt auf junge Talente und verkauft teuer weiter', maxAge: 23, potW: 0.85, spend: 0.45, sell: 0.95, loanOut: 0.7 },
  sparen: { label: 'Sparkurs', desc: 'holt ablösefreie und günstige Spieler, verkauft gern', maxAge: 31, potW: 0.2, spend: 0.28, sell: 0.85, loanOut: 0.4 },
  tradition: { label: 'Traditionsverein', desc: 'bevorzugt Spieler aus dem eigenen Land', maxAge: 29, potW: 0.4, spend: 0.5, sell: 1.15, loanOut: 0.5 },
  daten: { label: 'Datenanalyse', desc: 'sucht unterbewertete Spieler und auslaufende Verträge', maxAge: 27, potW: 0.5, spend: 0.5, sell: 1.0, loanOut: 0.55 },
};

const GROUPS = {
  TW: { pos: ['TW'], depth: 3, search: 'TW' },
  IV: { pos: ['IV'], depth: 4, search: 'IV' },
  AV: { pos: ['LV', 'RV'], depth: 4, search: null },
  ZM: { pos: ['DM', 'ZM'], depth: 5, search: null },
  OFF: { pos: ['OM', 'LA', 'RA', 'LM', 'RM'], depth: 5, search: null },
  ST: { pos: ['ST'], depth: 3, search: 'ST' },
};
export const groupOf = (pos) => Object.keys(GROUPS).find((g) => GROUPS[g].pos.includes(pos)) || 'ZM';
const GROUP_LABEL = { TW: 'Torhüter', IV: 'Innenverteidiger', AV: 'Außenverteidiger', ZM: 'zentrale Mittelfeldspieler', OFF: 'Offensivspieler', ST: 'Stürmer' };
const GROUP_DAT = { TW: 'Torhütern', IV: 'Innenverteidigern', AV: 'Außenverteidigern', ZM: 'zentralen Mittelfeldspielern', OFF: 'Offensivspielern', ST: 'Stürmern' };

const isUser = (world, club) => club.id === world.userClubId;
const leagueOf = (world, club) => world.leagues.find((l) => l.id === club.leagueId);

// ------------------------------------------------------------------ identity
function pickPhilosophy(rng, club, world) {
  const L = leagueOf(world, club);
  const top = L.clubIds.map((id) => world.clubs[id]).sort((a, b) => b.rep - a.rep).indexOf(club);
  if (top <= 1 && club.rep >= 82) return rng.chance(0.85) ? 'star' : 'daten';
  return rng.weighted(Object.keys(PHILOSOPHIES), (k) => ({ star: club.rep > 78 ? 1.2 : 0.1, ausbildung: 1.4, sparen: club.rep < 60 ? 1.6 : 0.6, tradition: 1.0, daten: 0.9 }[k]));
}

export function ensureClubAI(world, rng) {
  world.coachPool ||= [];
  for (const club of Object.values(world.clubs)) {
    if (club.ai) continue;
    const coach = makeCoach(rng, club.rep);
    coach.formation = club.tactic.formation; coach.style = club.tactic.preset || coach.style;
    club.ai = { philosophy: pickPhilosophy(rng, club, world), coach, pressure: 0, listed: [], log: [] };
  }
  while (world.coachPool.length < 10) world.coachPool.push(makeCoach(rng, rng.int(40, 90)));
}

export const coachQuality = (world, club) => (isUser(world, club) ? (world.coach?.quality ?? 3) : club.ai?.coach?.quality ?? 3);

// ------------------------------------------------------------------ squad analysis
export function squadNeeds(world, club) {
  const ps = club.squad.map((id) => world.players[id]).filter(Boolean);
  const L = autoLineup(club, world.players, club.tactic.formation);
  const xi = L.xi.map((id) => world.players[id]).filter(Boolean);
  const xiAvg = xi.reduce((s, p) => s + p.ovr, 0) / Math.max(1, xi.length);
  const slots = FORMATIONS[L.formation];
  const needs = [];
  for (const [g, G] of Object.entries(GROUPS)) {
    const inG = ps.filter((p) => G.pos.includes(p.pos) && !(p.loan && p.loan.from === club.id));
    const starters = L.xi.map((id, i) => ({ p: world.players[id], slot: slots[i][0] })).filter((x) => G.pos.includes(x.slot) && x.p);
    const weakest = starters.length ? Math.min(...starters.map((x) => x.p.ovr)) : xiAvg - 8;
    const deficit = Math.max(0, G.depth - inG.length);
    const qualityGap = Math.max(0, xiAvg - weakest - 2);
    const ageing = starters.filter((x) => x.p.age >= 31).length;
    const expiring = inG.filter((p) => p.contract <= 1 && p.ovr >= xiAvg - 3).length;
    const score = deficit * 3 + qualityGap * 0.9 + ageing * 1.8 + expiring * 1.5;
    if (score < 2.5) continue;
    // concrete position to look for: the slot of the weakest starter, otherwise the thinnest position in the group
    const slotPos = starters.sort((a, b) => a.p.ovr - b.p.ovr)[0]?.slot;
    const pos = G.search || slotPos || G.pos.slice().sort((a, b) => ps.filter((p) => p.pos === a).length - ps.filter((p) => p.pos === b).length)[0];
    const starter = qualityGap > 2 || ageing > 0;
    const reason = deficit > 0 ? `zu wenige ${GROUP_LABEL[g]} (${inG.length}/${G.depth})` : qualityGap > 2 ? `Qualitätslücke bei den ${GROUP_DAT[g]}` : ageing ? `alternde ${GROUP_LABEL[g]}` : `auslaufende Verträge bei den ${GROUP_DAT[g]}`;
    needs.push({ group: g, pos, score, minOvr: Math.round(starter ? Math.max(weakest + 2, xiAvg - 2) : xiAvg - 9), starter, reason });
  }
  return needs.sort((a, b) => b.score - a.score);
}

const ovrCap = (club) => club.rep * 0.45 + 58;

// how much a club wants to keep a player (1 = average, higher = key player)
function keepFactor(world, club, p) {
  const sorted = club.squad.map((id) => world.players[id]).sort((a, b) => b.ovr - a.ovr);
  const r = sorted.indexOf(p);
  const inG = club.squad.map((id) => world.players[id]).filter((q) => groupOf(q.pos) === groupOf(p.pos)).length;
  let k = r < 3 ? 1.35 : r < 11 ? 1.12 : 0.85;
  if (inG <= GROUPS[groupOf(p.pos)].depth - 1) k *= 1.2;
  if (p.contract <= 1) k *= 0.8;
  return k * (PHILOSOPHIES[club.ai?.philosophy]?.sell ?? 1);
}

// ------------------------------------------------------------------ AI → AI market
function scoreTarget(world, buyer, p, need, fee) {
  const P = PHILOSOPHIES[buyer.ai.philosophy];
  const country = leagueOf(world, buyer).country;
  let s = (p.ovr - need.minOvr) * 1.2 + (p.pot - p.ovr) * P.potW - fee / Math.max(2e6, buyer.budget) * 6;
  if (buyer.ai.philosophy === 'tradition' && p.nation === country) s += 4;
  if (buyer.ai.philosophy === 'daten') s += (p.value / Math.max(1, fee)) * 3 + (p.contract <= 1 ? 3 : 0) + (p.stats?.rating > 7 ? 2 : 0);
  if (buyer.ai.philosophy === 'sparen' && fee === 0) s += 5;
  if (p.age > P.maxAge) s -= (p.age - P.maxAge) * 2.5;
  return s;
}

function findTargets(world, rng, buyer, need) {
  const P = PHILOSOPHIES[buyer.ai.philosophy];
  const budget = buyer.budget * P.spend;
  const cap = ovrCap(buyer);
  const ids = Object.keys(world.players);
  const out = [];
  const consider = (p) => {
    if (!p || p.youthOf || p.loan || p.clubId === buyer.id || p.clubId === world.userClubId) return;
    if (!require_compat(need.pos, p.pos) || p.ovr < need.minOvr || p.ovr > cap) return;
    if (p.clubId && world.clubs[p.clubId].squad.length <= 20) return;
    const fee = p.clubId ? askingPrice(world, p, true) : 0;
    if (fee > budget) return;
    out.push({ p, fee, s: scoreTarget(world, buyer, p, need, fee) + rng.normal(0, 1.5) });
  };
  for (let i = 0; i < 220; i++) consider(world.players[ids[Math.floor(rng.next() * ids.length)]]);
  for (const id of world.transfer?.listed || []) consider(world.players[id]);
  for (const id of world.freeAgents || []) consider(world.players[id]);
  return out.sort((a, b) => b.s - a.s).slice(0, 3);
}
const COMPAT = { TW: ['TW'], IV: ['IV'], LV: ['LV', 'LM'], RV: ['RV', 'RM'], DM: ['DM', 'ZM'], ZM: ['ZM', 'DM', 'OM'], OM: ['OM', 'ZM'], LA: ['LA', 'LM', 'RA'], RA: ['RA', 'RM', 'LA'], LM: ['LM', 'LA'], RM: ['RM', 'RA'], ST: ['ST'] };
function require_compat(want, have) { return (COMPAT[want] || [want]).includes(have); }

// does the selling AI club accept the bid? → 'yes' | 'counter' (with fee) | 'no'
function sellerVerdict(world, seller, p, fee, rng) {
  const ask = askingPrice(world, p) * keepFactor(world, seller, p);
  if (fee >= ask) return { v: 'yes' };
  if (fee >= ask * 0.82) return rng.chance(0.5) ? { v: 'counter', fee: Math.round(ask / 1e5) * 1e5 } : { v: 'yes' };
  return { v: 'no' };
}

function aiDeal(world, rng, buyer, need, hot) {
  const targets = findTargets(world, rng, buyer, need);
  for (const t of targets) {
    const p = t.p, seller = p.clubId ? world.clubs[p.clubId] : null;
    let fee = t.fee;
    if (seller) {
      fee = Math.round((t.fee * rng.range(0.8, 0.98)) / 1e4) * 1e4;
      let v = sellerVerdict(world, seller, p, fee, rng);
      if (v.v === 'counter' && v.fee <= buyer.budget * PHILOSOPHIES[buyer.ai.philosophy].spend * 1.1) { fee = v.fee; v = { v: 'yes' }; }
      if (v.v !== 'yes') { buyer.ai.log.unshift(`${world.season}/${world.week + 1}: Angebot für ${p.lastName} abgelehnt`); continue; }
      // bidding war: a bigger club may hijack the deal
      if (hot || rng.chance(0.12)) {
        const rival = Object.values(world.clubs).filter((c) => c !== buyer && c !== seller && !isUser(world, c) && c.rep > buyer.rep && ovrCap(c) >= p.ovr && c.budget * PHILOSOPHIES[c.ai.philosophy].spend > fee * 1.15 && squadNeeds(world, c).some((n) => require_compat(n.pos, p.pos))).sort((a, b) => b.rep - a.rep)[0];
        if (rival) {
          const rivalFee = Math.round((fee * rng.range(1.1, 1.3)) / 1e5) * 1e5;
          const canMatch = buyer.budget * PHILOSOPHIES[buyer.ai.philosophy].spend > rivalFee * 1.05 && rng.chance(0.4);
          const winner = canMatch && rng.chance(0.5 + (buyer.rep - rival.rep) * 0.02) ? buyer : rival;
          const finalFee = winner === buyer ? Math.round((rivalFee * 1.05) / 1e5) * 1e5 : rivalFee;
          const d = contractDemand(world, p, winner);
          executeTransfer(world, p, seller, winner, finalFee, d.wage, rng.int(d.minY, d.maxY));
          reportDeal(world, `🔥 Bieterwettkampf um ${p.firstName} ${p.lastName}: ${winner.name} setzt sich gegen ${(winner === buyer ? rival : buyer).name} durch – ${money(finalFee)} an ${seller.short}.`, [winner, seller, buyer, rival]);
          return true;
        }
      }
    }
    const d = contractDemand(world, p, buyer);
    if (!d.willing && rng.chance(0.7)) continue;
    executeTransfer(world, p, seller, buyer, fee, d.wage, rng.int(d.minY, d.maxY));
    reportDeal(world, `KI-Transfer: ${p.firstName} ${p.lastName} (${p.pos}, ${p.ovr}) wechselt ${seller ? `von ${seller.short} ` : 'ablösefrei '}zu ${buyer.name}${fee ? ` für ${money(fee)}` : ''} – Grund: ${need.reason}.`, [buyer, seller], fee);
    buyer.ai.log.unshift(`${world.season}/${world.week + 1}: ${p.lastName} geholt (${need.reason})`);
    buyer.ai.log = buyer.ai.log.slice(0, 20);
    return true;
  }
  return false;
}

function reportDeal(world, text, clubs, fee = 0) {
  const ul = world.clubs[world.userClubId]?.leagueId;
  if (fee >= 15e6 || clubs.some((c) => c && c.leagueId === ul)) news(world, text);
}

// surplus: big squads release or list players, development clubs loan out talents to lower leagues
function aiSurplus(world, rng, club) {
  const ps = club.squad.map((id) => world.players[id]).sort((a, b) => a.ovr - b.ovr);
  const T = world.transfer;
  if (club.squad.length > 27) {
    const p = ps.find((q) => !q.loan && q.age >= 27 && !T.listed.includes(q.id));
    if (p) { T.listed.push(p.id); club.ai.listed.push(p.id); }
  }
  const P = PHILOSOPHIES[club.ai.philosophy];
  if (club.squad.length > 24 && rng.chance(P.loanOut * 0.4)) {
    const talent = ps.find((q) => q.age <= 21 && q.pot >= q.ovr + 8 && !q.loan);
    if (!talent) return;
    const tier = leagueOf(world, club).tier ?? 1;
    const host = Object.values(world.clubs).filter((c) => !isUser(world, c) && c !== club && (leagueOf(world, c).tier ?? 1) >= tier && c.squad.length < 27 && ovrCap(c) >= talent.ovr && squadNeeds(world, c).some((n) => require_compat(n.pos, talent.pos)));
    const to = host.length ? rng.pick(host) : null;
    if (!to) return;
    club.squad = club.squad.filter((id) => id !== talent.id); club.lineup = null;
    (club.loanedOut ||= []).push(talent.id);
    to.squad.push(talent.id); to.lineup = null;
    talent.loan = { from: club.id, to: to.id, until: world.season, wageShare: 0.5, buyOption: null, ai: true };
  }
}

export function aiMarket(world, rng) {
  if (!windowInfo(world).open) return;
  const clubs = Object.values(world.clubs).filter((c) => !isUser(world, c) && c.ai);
  const deadline = windowInfo(world).closesIn <= 1;
  const n = deadline ? rng.int(18, 26) : rng.int(9, 15);
  for (let i = 0; i < n; i++) {
    const buyer = rng.weighted(clubs, (c) => 0.3 + (c.budget > 3e6 ? 1 : 0.2) * (c.squad.length < 24 ? 2 : 1));
    if (buyer.squad.length >= 30 || buyer.budget < 2e5) continue;
    const need = squadNeeds(world, buyer)[0];
    if (need) aiDeal(world, rng, buyer, need, deadline && rng.chance(0.3));
    aiSurplus(world, rng, buyer);
  }
}

// how interested an AI club is in a given player (used for offers on the user's players)
export function clubWants(world, club, p) {
  if (!club.ai || ovrCap(club) < p.ovr) return 0;
  const need = squadNeeds(world, club).find((n) => require_compat(n.pos, p.pos));
  if (!need || p.ovr < need.minOvr) return 0.15;
  return 1 + need.score * 0.1;
}

// AI contract policy at season end: keep the important players, let the old and weak ones go
export function aiRenews(world, club, p, rng) {
  const k = keepFactor(world, club, p);
  const P = PHILOSOPHIES[club.ai?.philosophy] || PHILOSOPHIES.tradition;
  if (club.squad.length > 30) return false;
  if (p.age >= 33 && k < 1.2) return rng.chance(0.25);
  if (p.age > P.maxAge + 4 && k < 1.1) return rng.chance(0.45);
  return rng.chance(clamp(0.45 + (k - 0.85) * 0.9, 0.35, 0.95));
}

// ------------------------------------------------------------------ coaching carousel
function applyCoach(club, c) {
  club.tactic = { ...club.tactic, ...PRESETS[c.style], preset: c.style, formation: FORMATIONS[c.formation] ? c.formation : club.tactic.formation };
  club.lineup = null;
}

export function weeklyCoaches(world, rng) {
  if (world.week < 7) return;
  for (const league of world.leagues) {
    const table = computeTable(league);
    const exp = [...league.clubIds].sort((a, b) => world.clubs[b].rep - world.clubs[a].rep);
    const n = league.clubIds.length;
    for (const id of league.clubIds) {
      const club = world.clubs[id];
      if (isUser(world, club) || !club.ai) continue;
      const rank = table.findIndex((r) => r.id === id), want = exp.indexOf(id);
      const row = table[rank];
      const form = row.form.slice(-5);
      const losses = form.filter((x) => x === 'N').length;
      let delta = Math.max(0, rank - want - 2) / n * 0.45 + (losses >= 4 ? 0.35 : losses >= 3 ? 0.12 : -0.08);
      if (rank >= n - 3 && want < n - 5) delta += 0.2;
      club.ai.pressure = clamp(club.ai.pressure * 0.9 + delta, 0, 3);
      const fresh = club.ai.coach?.since === world.season && world.week - (club.ai.coach.hiredWeek ?? 0) < 10;
      if (club.ai.pressure > 1.75 && !fresh && rng.chance(0.15)) sackCoach(world, rng, club, rank + 1);
    }
  }
}

function sackCoach(world, rng, club, rank) {
  const old = club.ai.coach;
  const pool = world.coachPool.filter((c) => c.lastClub !== club.id && c.quality >= Math.max(1, (old?.quality ?? 3) - 1)).sort((a, b) => b.quality - a.quality);
  const pick = (club.rep > 75 ? pool[0] : rng.pick(pool.length ? pool : world.coachPool)) || makeCoach(rng, club.rep);
  world.coachPool = world.coachPool.filter((c) => c !== pick);
  if (old) world.coachPool.push({ ...old, games: 0, pts: 0, lastClub: club.id });
  world.sackings = (world.sackings || 0) + 1;
  club.ai.coach = { ...pick, games: 0, pts: 0, since: world.season, hiredWeek: world.week };
  club.ai.pressure = 0;
  club.ai.bounce = 4; // new-coach bounce: short morale & strength boost
  applyCoach(club, club.ai.coach);
  for (const id of club.squad) world.players[id].morale = clamp(world.players[id].morale + 8, 0, 99);
  const ul = world.clubs[world.userClubId]?.leagueId;
  const text = `🔄 Trainerbeben bei ${club.name}: ${old?.name || 'Der Trainer'} muss nach Platz ${rank} gehen. Neuer Coach: ${pick.name} (${'★'.repeat(pick.quality)}, ${pick.style}, ${pick.formation}).`;
  if (club.leagueId === ul || club.rep >= 85) news(world, text);
  (world.coachMoves ||= []).unshift({ season: world.season, week: world.week + 1, club: club.id, out: old?.name, in: pick.name });
  world.coachMoves = world.coachMoves.slice(0, 40);
}

// small strength modifier for the statistical simulation: coach quality and new-coach bounce
export function coachEdge(world, club) {
  let e = (coachQuality(world, club) - 3) * 0.55;
  if (club.ai?.bounce > 0) e += 0.8;
  return e;
}
export function tickBounce(world) { for (const c of Object.values(world.clubs)) if (c.ai?.bounce > 0) c.ai.bounce--; }

// season end: coaches age contracts; the pool is refreshed
export function seasonCoaches(world, rng) {
  for (const c of Object.values(world.clubs)) if (c.ai) c.ai.pressure *= 0.4;
  world.coachPool = (world.coachPool || []).slice(-14);
  while (world.coachPool.length < 10) world.coachPool.push(makeCoach(rng, rng.int(40, 90)));
}

export { teamStrength };
