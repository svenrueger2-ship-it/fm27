// v5.0: Deadline-Day live ticker – the last day of a transfer window is played out as a live feed:
// an extra round of AI deals, rumours and last-minute offers for the user's players, revealed with a clock.
import { aiMarket } from './clubAI.js';
import { generateOffers, windowInfo, ensureTransferState } from './transfers.js';
import { isDeadlineDay, rollRumours } from './events.js';
import { forEachHuman, isHumanClub } from './hotseat.js';

export const tickerKey = (w) => `${w.season}-${w.week}`;
export function tickerAvailable(w) { const win = windowInfo(w); return isDeadlineDay(win) && w.deadlineTicker?.key !== tickerKey(w); }

/** Runs the deadline round once and returns the timeline (minutes from 9:00 to 23:59). */
export function runDeadline(w, rng) {
  const T = ensureTransferState(w);
  const h0 = T.history.length;
  const offersBefore = new Set((T.offers || []).map((o) => o.id));
  aiMarket(w, rng); aiMarket(w, rng);
  forEachHuman(w, () => { ensureTransferState(w); rollRumours(w, rng, 4); generateOffers(w, rng); });
  const deals = T.history.slice(0, T.history.length - h0);
  const ev = [];
  for (const d of deals) {
    const to = w.clubs[d.to], from = d.from != null ? w.clubs[d.from] : null;
    const big = d.fee >= 25e6;
    ev.push({ t: 0, kind: big ? 'breaking' : 'deal', text: `${big ? '🚨 BREAKING: ' : '✍️ '}${d.name} wechselt ${from ? `von ${from.short} ` : 'ablösefrei '}zu ${to.short}${d.fee ? ` – ${(d.fee / 1e6).toFixed(1).replace('.', ',')} Mio. €` : ''}`, club: to.id, mine: isHumanClub(w, d.to) || isHumanClub(w, d.from) });
  }
  for (const r of (w.rumours || []).filter((r) => r.season === w.season && r.week === w.week + 1).slice(0, 6)) ev.push({ t: 0, kind: 'rumour', text: `👀 ${r.source}: ${r.name} vor Wechsel zu ${w.clubs[r.to]?.short || '?'}?`, club: r.to });
  for (const o of (T.offers || []).filter((o) => !offersBefore.has(o.id))) { const p = w.players[o.playerId]; if (p) ev.push({ t: 0, kind: 'offer', text: `📩 Last-Minute-Angebot: ${w.clubs[o.clubId]?.short || '?'} will ${p.lastName} – ${(o.fee / 1e6).toFixed(1).replace('.', ',')} Mio. €`, mine: true }); }
  // spread over the day, the big ones late in the evening
  const n = ev.length;
  ev.forEach((e) => { e.t = rng.next(); }); // random order, the breaking news come last
  ev.sort((a, b) => (a.kind === 'breaking') - (b.kind === 'breaking') || a.t - b.t);
  ev.forEach((e, i) => { e.t = Math.round(60 * 9 + ((i + 0.6) / Math.max(1, n)) * (60 * 14.9)); });
  w.deadlineTicker = { key: tickerKey(w), events: ev };
  return ev;
}
