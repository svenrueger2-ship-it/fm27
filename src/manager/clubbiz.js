// Club business (v1.0): members and fan shop, investors (German 50+1 rule), takeovers by rich owners,
// debt warnings, credit line and the licensing procedure at the end of the season (conditions,
// points deduction, licence refused → forced relegation).
import { money } from '../core/fmt.js';
import { clamp } from '../core/rng.js';
import { ensureMood, moodChange } from './events.js';

const leagueOf = (w, c) => w.leagues.find((l) => l.id === c.leagueId);
const country = (w, c) => leagueOf(w, c).country;
const per = (n) => Math.round(n / 1e5) * 1e5;
const mio = (n) => `${money(n)}`;
const OWNERS = [['Gulf Sports Investment', 'Staatsfonds'], ['Redwood Capital', 'US-Investor'], ['Aurora Holdings', 'Konsortium'], ['Silk Road Sports', 'Investor aus Asien'], ['Nordlicht Beteiligungen', 'Unternehmer']];

export function ensureBiz(world, club = world.clubs[world.userClubId]) {
  if (club.biz) return club.biz;
  const tier = leagueOf(world, club).tier ?? 1;
  club.biz = {
    members: Math.round(clamp(Math.pow(club.rep / 100, 2.6) * 330000 * (tier === 1 ? 1 : 0.7), 2500, 400000) / 100) * 100,
    fee: 72, shop: 1, owner: null, investorOffer: null, licence: null, credit: 0, warnings: 0, deduction: 0, transferBan: false,
  };
  return club.biz;
}

export const shopCost = (club) => per(800000 * Math.pow(1.9, (club.biz?.shop ?? 1) - 1));
export const shopFactor = (club) => 1 + ((club.biz?.shop ?? 1) - 1) * 0.12;
export const memberIncome = (club) => Math.round((club.biz?.members || 0) * (club.biz?.fee || 72));

export function upgradeShop(world) {
  const club = world.clubs[world.userClubId], B = ensureBiz(world, club);
  if (B.shop >= 5) return { ok: false, msg: 'Der Fanshop ist bereits auf höchster Stufe.' };
  const cost = shopCost(club);
  if (club.budget < cost) return { ok: false, msg: 'Nicht genug Budget.' };
  club.budget -= cost; B.shop++;
  club.finance?.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'facilities', label: `Fanshop Stufe ${B.shop}`, amount: -cost }], net: -cost });
  return { ok: true, msg: `Fanshop auf Stufe ${B.shop} ausgebaut – mehr Merchandising-Einnahmen.` };
}

// ------------------------------------------------------------------ weekly
export function weeklyBiz(world, rng) {
  const club = world.clubs[world.userClubId]; if (!club) return;
  const B = ensureBiz(world, club), M = ensureMood(world);
  // members grow with fan mood and success, shrink in crises
  const g = (M.fans - 55) / 4000 + (club.formRun || 0) * 0.0008;
  B.members = Math.max(1500, Math.round(B.members * (1 + clamp(g, -0.006, 0.012))));
  // debts: credit line and warnings
  if (club.budget < 0) {
    B.warnings++;
    if (B.warnings === 1 || B.warnings % 6 === 0) world.news.unshift({ season: world.season, week: world.week, text: `💸 Der Kontostand ist negativ (${mio(club.budget)}). Die Bank gewährt einen Kreditrahmen, aber der Verband prüft die Lizenz am Saisonende genau.` });
    club.budget -= Math.round(Math.abs(club.budget) * 0.0012); // interest
    if (B.warnings === 4) moodChange(world, -6, -3);
  } else B.warnings = 0;
  // investors knock on the door once in a while
  if (!B.investorOffer && world.week >= 4 && world.week % 7 === 0 && rng.chance(0.18 + (club.budget < 0 ? 0.3 : 0))) makeInvestorOffer(world, rng);
}

function makeInvestorOffer(world, rng) {
  const club = world.clubs[world.userClubId], B = ensureBiz(world, club);
  const de = country(world, club) === 'DE';
  const cur = B.owner?.share || 0;
  const maxShare = de ? 49 : 100;
  if (cur >= maxShare) return;
  const [name, type] = rng.pick(OWNERS);
  const takeover = !de && rng.chance(0.35) && cur < 50;
  const share = takeover ? 80 : Math.min(maxShare - cur, rng.pick([10, 15, 20, 25]));
  const value = Math.pow(club.rep, 2.3) * 9000 * (leagueOf(world, club).tier === 1 ? 1 : 0.4);
  const money = per(value * share / 100 * rng.range(0.85, 1.2));
  B.investorOffer = { name, type, share, money, takeover, season: world.season, week: world.week,
    demand: takeover ? 'Champions League innerhalb von 2 Jahren' : rng.pick(['Platz unter den ersten 6', 'Einnahmen steigern', 'Junge Spieler entwickeln']) };
  world.news.unshift({ season: world.season, week: world.week, text: takeover
    ? `🏦 Übernahmeangebot: ${name} (${type}) will ${share} % des Vereins kaufen und ${mio(money)} investieren. Entscheidung unter „Finanzen“.`
    : `🏦 ${name} (${type}) bietet ${mio(money)} für ${share} % der Anteile${de ? ' (50+1-Regel: der Verein behält die Mehrheit)' : ''}.` });
}

export function answerInvestor(world, accept) {
  const club = world.clubs[world.userClubId], B = ensureBiz(world, club), o = B.investorOffer;
  if (!o) return null;
  B.investorOffer = null;
  if (!accept) { moodChange(world, -1, 3); return 'Angebot abgelehnt – die Fans freuen sich, der Vorstand ist skeptisch.'; }
  club.budget += o.money;
  club.finance?.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'sponsors', label: `Investor ${o.name} (${o.share} %)`, amount: o.money }], net: o.money });
  const share = (B.owner?.share || 0) + o.share;
  B.owner = { name: o.name, type: o.type, share, since: world.season, demand: o.demand, majority: share > 50 };
  if (o.takeover) { club.rep = Math.min(99, club.rep + 4); moodChange(world, 4, -6); }
  else moodChange(world, 3, -4);
  world.news.unshift({ season: world.season, week: world.week, text: `🏦 ${o.name} steigt mit ${o.share} % ein – ${mio(o.money)} fließen in die Vereinskasse.${o.takeover ? ' Der neue Mehrheitseigner erwartet schnellen Erfolg.' : ''}` });
  return 'Investor eingestiegen.';
}

// ------------------------------------------------------------------ season end: members & licence
export function seasonBiz(world, rank) {
  const club = world.clubs[world.userClubId], B = ensureBiz(world, club), L = leagueOf(world, club);
  const notes = [];
  // licensing procedure
  const S = club.finance?.lastSeason || {};
  const revenue = Math.max(5e6, ['tickets', 'hospitality', 'tv', 'sponsors', 'merch', 'prize'].reduce((a, k) => a + Math.max(0, S[k] || 0), 0));
  B.deduction = 0; B.transferBan = false;
  if (club.budget < -revenue * 0.25 && L.lower) {
    B.licence = { status: 'verweigert', season: world.season };
    B.forcedDown = true;
    notes.push(`⛔ Lizenz verweigert! Bei ${mio(club.budget)} Schulden steigt ${club.name} zwangsweise ab.`);
  } else if (club.budget < 0) {
    B.licence = { status: 'Auflagen', season: world.season };
    B.deduction = club.budget < -revenue * 0.1 ? 6 : 3;
    B.transferBan = true;
    notes.push(`⚠️ Lizenz nur unter Auflagen: ${B.deduction} Punkte Abzug in der neuen Saison und Transfersperre bis zum Winter.`);
  } else B.licence = { status: 'erteilt', season: world.season };
  // owner demands
  if (B.owner?.majority) {
    const ok = rank <= 4;
    if (!ok) { moodChange(world, -10, 0); notes.push(`🏦 Mehrheitseigner ${B.owner.name} ist unzufrieden mit Platz ${rank}.`); }
  }
  notes.push(`👥 ${B.members.toLocaleString('de-DE')} Mitglieder bringen ${mio(memberIncome(club))} Beiträge.`);
  return notes;
}

// applied after promotion/relegation: forced relegation and points deduction for the new season
export function applyLicence(world) {
  const club = world.clubs[world.userClubId], B = club.biz; if (!B) return;
  if (B.forcedDown) {
    B.forcedDown = false;
    const L = leagueOf(world, club), lower = world.leagues.find((l) => l.id === L.lower);
    if (lower) {
      // swap with the best non-promoted team of the lower league
      const swap = lower.clubIds.map((id) => world.clubs[id]).sort((a, b) => b.rep - a.rep)[0];
      L.clubIds = L.clubIds.filter((id) => id !== club.id).concat(swap.id);
      lower.clubIds = lower.clubIds.filter((id) => id !== swap.id).concat(club.id);
      club.leagueId = lower.id; swap.leagueId = L.id;
      world.news.unshift({ season: world.season, week: 0, text: `⛔ Zwangsabstieg: ${club.name} spielt wegen der verweigerten Lizenz in der ${lower.name}. ${swap.name} rückt nach.` });
    }
  }
  if (B.deduction) { const L = leagueOf(world, club); (L.deductions ||= {})[club.id] = B.deduction; }
}
