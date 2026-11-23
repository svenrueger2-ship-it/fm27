// v5.2 Börsengang: the managed club can go public, sell up to 49 % of its shares (50+1 rule),
// raise more capital later, buy shares back and pay dividends. The share price moves every week
// with results, table position, finances and market noise; unhappy shareholders put the board under pressure.
import { clamp } from '../core/rng.js';
import { moodChange } from './events.js';

export const SHARES = 10_000_000; // total number of shares
export const MAX_FLOAT = 49;
const per = (n) => Math.round(n / 1e5) * 1e5;

export function squadValue(world, club) { return club.squad.reduce((s, id) => s + (world.players[id]?.value || 0), 0); }

// company valuation in €
export function valuation(world, club, league) {
  const tier = league?.tier || 1;
  const brand = Math.pow(club.rep || 50, 2) * 26000 * (tier === 1 ? 1 : tier === 2 ? 0.5 : 0.25);
  const stadium = (club.stadium?.capacity || 10000) * 1100;
  return Math.max(5e6, brand + stadium + squadValue(world, club) * 0.6 + Math.max(-2e7, club.budget || 0));
}

export function ipoChecks(world, club, league) {
  return [
    { ok: (club.rep || 0) >= 50, text: 'Ruf mindestens 50' },
    { ok: (league?.tier || 3) <= 2, text: 'Erste oder zweite Liga' },
    { ok: (club.budget || 0) >= 0, text: 'Keine Schulden auf dem Konto' },
    { ok: (club.stadium?.capacity || 0) >= 15000, text: 'Stadion mit mindestens 15.000 Plätzen' },
  ];
}
export const canIPO = (world, club, league) => !club.stock?.listed && ipoChecks(world, club, league).every((c) => c.ok);

function book(world, club, label, amount) {
  const F = club.finance; if (!F) return;
  F.season.stock = (F.season.stock || 0) + amount;
  F.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'stock', label, amount: Math.round(amount) }], net: Math.round(amount) });
}

export function goPublic(world, club, league, pct) {
  pct = clamp(Math.round(pct), 5, MAX_FLOAT);
  if (!canIPO(world, club, league)) return { ok: false, msg: 'Voraussetzungen für den Börsengang nicht erfüllt' };
  const price = Math.round((valuation(world, club, league) / SHARES) * 100) / 100;
  const cash = per(SHARES * (pct / 100) * price * 0.94); // 6 % bank fees
  club.stock = { listed: true, ipoSeason: world.season, ipoPrice: price, price, float: pct, history: [{ s: world.season, w: world.week, p: price }], mood: 60, dividend: 0, paid: 0, raised: cash, lastRank: null };
  club.budget += cash; book(world, club, `Börsengang (${pct} % der Aktien)`, cash);
  world.news?.unshift({ season: world.season, week: world.week + 1, text: `📈 Börsengang! ${club.name} ist an der Börse – Ausgabepreis ${price.toFixed(2)} €, Erlös ${Math.round(cash / 1e6)} Mio. €.` });
  return { ok: true, cash, price };
}

export function issueShares(world, club, pct) {
  const S = club.stock; if (!S?.listed) return { ok: false, msg: 'Nicht börsennotiert' };
  pct = Math.min(Math.round(pct), MAX_FLOAT - S.float);
  if (pct <= 0) return { ok: false, msg: `Mehr als ${MAX_FLOAT} % dürfen nicht verkauft werden (50+1-Regel)` };
  const cash = per(SHARES * (pct / 100) * S.price * 0.92);
  S.float += pct; S.raised += cash; S.price = Math.round(S.price * (1 - pct * 0.006) * 100) / 100; S.mood = clamp(S.mood - pct * 0.8, 0, 100);
  club.budget += cash; book(world, club, `Kapitalerhöhung (+${pct} %)`, cash);
  return { ok: true, cash };
}

export function buyback(world, club, pct) {
  const S = club.stock; if (!S?.listed) return { ok: false, msg: 'Nicht börsennotiert' };
  pct = Math.min(Math.round(pct), S.float);
  const cost = per(SHARES * (pct / 100) * S.price * 1.06);
  if (club.budget < cost) return { ok: false, msg: 'Nicht genug Geld für den Rückkauf' };
  club.budget -= cost; S.float -= pct; S.price = Math.round(S.price * (1 + pct * 0.004) * 100) / 100; S.mood = clamp(S.mood + pct * 0.5, 0, 100);
  book(world, club, `Aktienrückkauf (${pct} %)`, -cost);
  if (S.float <= 0) { club.stock = { ...S, listed: false, float: 0, delisted: world.season }; world.news?.unshift({ season: world.season, week: world.week + 1, text: `📉 ${club.name} hat alle Aktien zurückgekauft und geht von der Börse.` }); }
  return { ok: true, cost };
}

export const setDividend = (club, rate) => { if (club.stock) club.stock.dividend = clamp(rate, 0, 0.5); };

// weekly price movement; called for every listed club in finishWeek
export function weeklyStock(world, club, league, rank, rng) {
  const S = club.stock; if (!S?.listed) return;
  const n = league.clubIds.length, expected = Math.max(1, Math.round(n * (1 - (club.rep - 40) / 60)));
  const run = club.formRun || 0;
  let drift = run * 0.006 + (expected - rank) / n * 0.02 + (club.budget < 0 ? -0.02 : 0.002);
  if (S.lastRank != null) drift += (S.lastRank - rank) * 0.004;
  const fair = valuation(world, club, league) / SHARES;
  drift += clamp((fair - S.price) / Math.max(0.1, S.price), -0.3, 0.3) * 0.05; // mean reversion to the fair value
  const noise = (rng ? rng.range(-1, 1) : Math.random() * 2 - 1) * 0.025;
  S.price = Math.max(0.2, Math.round(S.price * (1 + drift + noise) * 100) / 100);
  S.lastRank = rank;
  S.history.push({ s: world.season, w: world.week, p: S.price }); if (S.history.length > 80) S.history.shift();
  const perf = S.price / S.ipoPrice;
  S.mood = clamp(S.mood + (perf > 1.1 ? 0.6 : perf < 0.8 ? -0.8 : 0) + (run > 2 ? 0.5 : run < -2 ? -0.7 : 0), 0, 100);
  if (club.id === world.userClubId) {
    if (S.mood < 25 && (!rng || rng.chance(0.4))) moodChange(world, -1, 0);
    if (S.mood < 12 && !S.warned) { S.warned = true; world.news?.unshift({ season: world.season, week: world.week + 1, text: `📉 Aktionärsaufstand bei ${club.name}: Großinvestoren fordern Konsequenzen – der Vorstand gerät unter Druck.` }); }
    if (S.mood > 30) S.warned = false;
  }
  // last matchday: dividend from the season result
  if (world.week >= league.fixtures.length - 1 && S.paidSeason !== world.season) payDividend(world, club);
}

export function payDividend(world, club) {
  const S = club.stock; if (!S?.listed) return 0;
  S.paidSeason = world.season;
  if (!S.dividend) { S.mood = clamp(S.mood - 4, 0, 100); return 0; }
  const F = club.finance?.season || {};
  const net = Object.values(F).reduce((a, v) => a + (+v || 0), 0);
  const base = Math.max(0, net) * S.dividend * (S.float / 100);
  const amount = per(Math.max(base, S.dividend * 0.02 * SHARES * S.price * (S.float / 100)));
  if (club.budget < amount) { S.mood = clamp(S.mood - 6, 0, 100); return 0; }
  club.budget -= amount; S.paid += amount; S.mood = clamp(S.mood + 6 + S.dividend * 20, 0, 100); S.price = Math.round(S.price * 1.03 * 100) / 100;
  book(world, club, 'Dividende an die Aktionäre', -amount);
  world.news?.unshift({ season: world.season, week: world.week + 1, text: `💶 ${club.name} schüttet ${Math.round(amount / 1e5) / 10} Mio. € Dividende an die Aktionäre aus.` });
  return amount;
}
