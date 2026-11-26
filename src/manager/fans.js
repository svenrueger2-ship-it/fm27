// v7.0 Fan-Ökosystem: fan clubs, the ultras with their own demands and protests (banners, silence,
// boycott), a fan-shop collection designed by you and season tickets at a price you set.
import { clamp } from '../core/rng.js';
import { news } from './transfers.js';
import { moodChange, ensureMood } from './events.js';

const DEMANDS = [
  { id: 'steh', text: 'Die Ultras fordern günstigere Stehplätze – „Fußball muss bezahlbar bleiben!“', yes: 'Stehplatzpreise runter (−8 % Ticketpreis)', no: 'Preise bleiben',
    accept: (w, c) => { c.finance.ticketPrice = Math.max(5, Math.round(c.finance.ticketPrice * 0.92)); return { ultras: 14, fans: 3, board: -1 }; }, decline: { ultras: -12, fans: -2 } },
  { id: 'pyro', text: 'Die Kurve will beim Derby Pyrotechnik zünden dürfen. Der Verband droht mit Strafen.', yes: 'Augen zudrücken (Strafe möglich)', no: 'Klare Ansage: keine Pyro',
    accept: (w, c, rng) => { if (rng.chance(0.55)) { const f = Math.round((c.rep * 900 * (c.women ? 0.1 : 1)) / 1e3) * 1e3; c.budget -= f; news(w, `🔥 Pyro im Block – der Verband verhängt ${f.toLocaleString('de-DE')} € Strafe.`); } return { ultras: 12, fans: 2, board: -3 }; }, decline: { ultras: -10, fans: 0, board: 1 } },
  { id: 'einsatz', text: 'Spruchband im Training: „Wir wollen euch kämpfen sehen!“ Die Ultras wollen ein Treffen mit der Mannschaft.', yes: 'Treffen mit der Mannschaft', no: 'Kein Treffen',
    accept: (w, c) => { for (const id of c.squad) { const p = w.players[id]; p.morale = clamp(p.morale + (w.clubs[w.userClubId].formRun < 0 ? -2 : 2), 0, 99); } return { ultras: 10, fans: 2 }; }, decline: { ultras: -8 } },
  { id: 'tradition', text: 'Die Fans wollen ein Traditionstrikot im Stil der Gründerjahre.', yes: 'Retro-Trikot auflegen (300 Tsd. €)', no: 'Ablehnen',
    accept: (w, c) => { const cost = c.women ? 30000 : 300000; c.budget -= cost; c.retroBoost = 6; return { ultras: 8, fans: 5 }; }, decline: { ultras: -4, fans: -1 } },
  { id: 'investor', text: 'Großes Spruchband: „Kein Verkauf unserer Seele – 50+1 bleibt!“ Die Kurve verlangt ein klares Bekenntnis gegen Investoren.', yes: 'Öffentliches Bekenntnis zu 50+1', no: 'Schweigen',
    accept: (w, c) => { (c.biz ||= {}).no50 = w.season; return { ultras: 15, fans: 4, board: -2 }; }, decline: { ultras: -9, fans: -2 } },
  { id: 'auswaerts', text: 'Die Fanclubs bitten um Zuschüsse für die Busse zu den Auswärtsspielen.', yes: 'Zuschuss zahlen (150 Tsd. €)', no: 'Kein Geld dafür',
    accept: (w, c) => { c.budget -= c.women ? 15000 : 150000; return { ultras: 9, fans: 4, clubs: 3 }; }, decline: { ultras: -6, fans: -1 } },
];
const PROTESTS = {
  banner: { name: 'Spruchbänder', text: (c) => `Protest in der Kurve: Spruchbänder gegen die Vereinsführung von ${c.short}.` },
  silence: { name: 'Stimmungsboykott', text: (c) => `Stimmungsboykott: Die ersten 12 Minuten bleibt die Kurve von ${c.short} still.` },
  boycott: { name: 'Boykott', text: (c) => `Boykott-Aufruf: Viele Dauerkarteninhaber von ${c.short} bleiben dem nächsten Heimspiel fern.` },
};
export const COLLECTIONS = [
  { id: 'retro', name: 'Retro-Kollektion', desc: 'Trikots und Schals im Stil der 80er.', icon: '📼' },
  { id: 'street', name: 'Streetwear', desc: 'Hoodies, Caps, Sneaker-Kooperation – modern und jung.', icon: '🧢' },
  { id: 'premium', name: 'Premium Edition', desc: 'Limitierte Stücke, hoher Preis, Sammlerware.', icon: '💎' },
  { id: 'family', name: 'Family & Kids', desc: 'Kinder-Trikots, Plüschmaskottchen, günstige Preise.', icon: '🧸' },
];

export function ensureFans(world, club = world.clubs[world.userClubId]) {
  const F = (world.fans ||= {});
  F.ultras ??= 62; F.clubs ??= Math.round(clamp((club.rep - 30) * (club.women ? 0.8 : 9), 5, 900));
  F.log ||= []; F.demand ??= null; F.protest ??= null;
  return F;
}
const log = (F, world, text) => { F.log.unshift({ season: world.season, week: world.week, text }); F.log = F.log.slice(0, 30); };

export function weeklyFans(world, rng) {
  const club = world.clubs[world.userClubId]; if (!club) return;
  const F = ensureFans(world, club), M = ensureMood(world);
  // ultras follow results, prices and investors
  const run = club.formRun || 0;
  F.ultras += (run > 0 ? 0.6 : run < 0 ? -0.9 : 0) + (M.fans - 60) / 150 + (60 - F.ultras) * 0.03;
  const fair = 20 + club.rep * 0.7;
  if (club.finance && club.finance.ticketPrice > fair * 1.15) F.ultras -= 0.8;
  if (club.biz?.investor) F.ultras -= 0.5;
  F.ultras = clamp(F.ultras, 0, 100);
  // fan clubs grow with success
  const cap = Math.round((club.rep - 25) * (club.women ? 1.2 : 13));
  F.clubs = Math.max(3, Math.min(cap, Math.round(F.clubs * (1 + clamp((M.fans - 55) / 9000, -0.003, 0.003)) + (rng.chance(0.3) ? (M.fans > 60 ? 1 : M.fans < 35 ? -1 : 0) : 0))));
  // demands every few weeks
  if (!F.demand && world.week >= 3 && world.week % 6 === 3 && rng.chance(0.75)) {
    const d = DEMANDS[Math.floor(rng.next() * DEMANDS.length)];
    F.demand = { id: d.id, week: world.week };
    log(F, world, `📣 Forderung der Ultras: ${d.text}`);
  }
  if (F.demand && world.week - F.demand.week >= 3) { answerDemand(world, false, rng); log(F, world, '📣 Keine Antwort ist auch eine Antwort – die Kurve ist sauer.'); }
  // protests when the mood is bad
  if (F.protest && world.week > F.protest.until) F.protest = null;
  if (!F.protest && F.ultras < 30 && rng.chance(0.35)) {
    const type = F.ultras < 15 ? 'boycott' : F.ultras < 22 ? 'silence' : 'banner';
    F.protest = { type, until: world.week + 2 };
    news(world, `📣 ${PROTESTS[type].text(club)}`); log(F, world, `🚩 ${PROTESTS[type].text(club)}`);
    moodChange(world, -2, -1);
  }
  if (club.retroBoost) club.retroBoost = Math.max(0, club.retroBoost - 1);
}

export function currentDemand(world) { const F = ensureFans(world); return F.demand ? { ...DEMANDS.find((d) => d.id === F.demand.id), ...F.demand } : null; }
export function answerDemand(world, yes, rng) {
  const F = ensureFans(world), club = world.clubs[world.userClubId];
  const d = currentDemand(world); if (!d) return { ok: false };
  const eff = yes ? d.accept(world, club, rng) : d.decline;
  F.ultras = clamp(F.ultras + (eff.ultras || 0), 0, 100);
  if (eff.clubs) F.clubs += eff.clubs;
  moodChange(world, eff.board || 0, eff.fans || 0);
  log(F, world, `${yes ? '✅' : '❌'} ${yes ? d.yes : d.no}`);
  F.demand = null;
  return { ok: true, msg: yes ? 'Die Kurve feiert dich' : 'Die Kurve ist enttäuscht' };
}

/** home strength / attendance effects of fan mood (used by the quick simulation and the finances) */
export function fanEffects(world, club) {
  if (club.id !== world.userClubId || !world.fans) return { home: 0, attendance: 1 };
  const F = world.fans, P = F.protest;
  return {
    home: (F.ultras - 60) / 100 * 0.5 - (P?.type === 'silence' ? 0.5 : P?.type === 'boycott' ? 0.7 : 0),
    attendance: P?.type === 'boycott' ? 0.82 : 1,
    away: F.clubs > 250 ? 0.25 : F.clubs > 80 ? 0.12 : 0,
  };
}

// ------------------------------------------------------------------ fan shop collection & season tickets
export function chooseCollection(world, id, rng) {
  const club = world.clubs[world.userClubId], F = ensureFans(world, club);
  if (F.collection?.season === world.season) return { ok: false, msg: 'Die Kollektion für diese Saison steht schon.' };
  const C = COLLECTIONS.find((c) => c.id === id); if (!C) return { ok: false };
  // how well it sells depends on the club (young fan base, tradition …) and a bit of luck
  const taste = { retro: (club.info?.founded || 1950) < 1920 ? 0.12 : 0.03, street: club.rep > 75 ? 0.1 : 0.02, premium: club.rep > 82 ? 0.14 : -0.05, family: (club.stadium?.layout?.family || 0) * 0.06 + 0.03 }[id] || 0;
  const mult = Math.round((1 + taste + rng.range(-0.08, 0.14)) * 100) / 100;
  F.collection = { season: world.season, id, mult };
  club.merchMult = mult;
  log(F, world, `${C.icon} Neue Fanshop-Kollektion „${C.name}“ – erste Verkaufszahlen: ${mult >= 1.1 ? 'Renner!' : mult >= 1 ? 'solide' : 'Ladenhüter'}`);
  return { ok: true, msg: `${C.name} im Fanshop` };
}
export function seasonTicketQuote(world, price) {
  const club = world.clubs[world.userClubId], M = ensureMood(world);
  const ref = (club.finance?.ticketPrice || 30) * 13; // ~ 13 matches worth
  const share = clamp(0.22 + M.fans / 220 + (ensureFans(world).ultras - 50) / 400 - (price / ref - 1) * 0.55, 0.04, 0.7);
  const sold = Math.round(club.stadium.capacity * share);
  return { ref: Math.round(ref), share, sold, income: sold * price };
}
export function sellSeasonTickets(world, price) {
  const club = world.clubs[world.userClubId];
  if (club.seasonTix?.season === world.season) return { ok: false, msg: 'Die Dauerkarten sind schon verkauft.' };
  if (world.week > 2) return { ok: false, msg: 'Dauerkarten gibt es nur vor dem Saisonstart.' };
  const q = seasonTicketQuote(world, price);
  club.seasonTix = { season: world.season, price, sold: q.sold, share: q.share };
  club.budget += q.income;
  if (club.finance) { club.finance.season.tickets = (club.finance.season.tickets || 0) + q.income; club.finance.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'tickets', label: `Dauerkarten (${q.sold.toLocaleString('de-DE')} × ${price} €)`, amount: q.income }], net: q.income }); }
  const F = ensureFans(world, club);
  F.ultras = clamp(F.ultras + (price < q.ref * 0.85 ? 6 : price > q.ref * 1.2 ? -8 : 0), 0, 100);
  log(F, world, `🎫 ${q.sold.toLocaleString('de-DE')} Dauerkarten zu je ${price} € verkauft.`);
  return { ok: true, msg: `${q.sold.toLocaleString('de-DE')} Dauerkarten verkauft` };
}
export { PROTESTS };
