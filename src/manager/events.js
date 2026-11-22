// Off-pitch life of the user's club: sponsor deals, board & fan mood, press conferences,
// random events with decisions, transfer rumours and Deadline Day.
import { clamp } from '../core/rng.js';
import { generatePlayer } from '../data/generator.js';

const tf = (league) => (league.tier === 1 ? 1 : league.tier === 2 ? 0.55 : 0.3);
const per = (n) => Math.round(n / 1e4) * 1e4;
const leagueOf = (world, club) => world.leagues.find((l) => l.id === club.leagueId);

// ------------------------------------------------------------------ board & fans
export function ensureMood(world) { world.mood ||= { board: 62, fans: 64 }; return world.mood; }
export function moodChange(world, board = 0, fans = 0) {
  const m = ensureMood(world);
  m.board = clamp(Math.round(m.board + board), 0, 100); m.fans = clamp(Math.round(m.fans + fans), 0, 100);
}
export function moodAfterMatch(world, diff, strengthGap) {
  // strengthGap > 0: user was the favourite
  if (diff > 0) moodChange(world, 2 + (strengthGap < -3 ? 2 : 0), 3 + (strengthGap < -3 ? 3 : 0));
  else if (diff < 0) moodChange(world, -2 - (strengthGap > 3 ? 2 : 0), -3 - (strengthGap > 3 ? 3 : 0));
  else moodChange(world, strengthGap > 3 ? -1 : 1, 0);
}

// ------------------------------------------------------------------ sponsors
export const SPONSOR_SLOTS = { shirt: { name: 'Trikotsponsor', share: 0.4 }, kit: { name: 'Ausrüster', share: 0.18 }, sleeve: { name: 'Ärmelsponsor', share: 0.12 } };
const BRANDS = { shirt: ['Volta Energie', 'Nordbank', 'Turbo Telecom', 'Lumen Air', 'Orbita Versicherung', 'Hansa Logistik', 'Krone Mobil', 'Solaris'], kit: ['Strider', 'Velox Sport', 'Apex', 'Kinetic', 'Puma-Line', 'Fennek'], sleeve: ['PixelWerk', 'Bergquell', 'Alpenbank', 'Nova Bet', 'Zephyr', 'Kaiser Brau'] };

export function genericSponsorValue(club, league) { return Math.pow(club.rep, 2) * 2600 * (0.25 + 0.75 * tf(league)); }

export function ensureSponsors(world, club) {
  if (club.sponsorDeals) return club.sponsorDeals;
  const L = leagueOf(world, club), G = genericSponsorValue(club, L);
  club.sponsorDeals = {};
  for (const [k, s] of Object.entries(SPONSOR_SLOTS)) {
    club.sponsorDeals[k] = { slot: k, slotName: s.name, brand: BRANDS[k][(club.id + k.length) % BRANDS[k].length], perSeason: per(G * s.share), years: 1, bonus: null, existing: true };
  }
  return club.sponsorDeals;
}

export function sponsorOffers(world, club, slot, rng) {
  const L = leagueOf(world, club), G = genericSponsorValue(club, L) * SPONSOR_SLOTS[slot].share;
  const table = world.leagues.find((l) => l.id === club.leagueId).clubIds.length;
  return [0, 1, 2].map((k) => {
    const years = [2, 3, 5][k];
    const target = Math.max(1, Math.round(table * [0.35, 0.5, 0.25][k]));
    const base = G * [1.0, 0.92, 1.12][k] * rng.range(0.92, 1.12) * (1 + (ensureMood(world).fans - 50) / 400);
    return {
      slot, slotName: SPONSOR_SLOTS[slot].name, brand: BRANDS[slot][(k * 3 + world.season + club.id) % BRANDS[slot].length],
      perSeason: per(base), years,
      bonus: k === 1 ? { rank: target, amount: per(G * 0.5) } : k === 2 ? { rank: Math.max(1, Math.round(table * 0.2)), amount: per(G * 0.3) } : null,
    };
  });
}

export function signSponsor(world, club, offer) {
  ensureSponsors(world, club)[offer.slot] = { ...offer };
  world.news.unshift({ season: world.season, week: world.week + 1, text: `🤝 Neuer ${offer.slotName}: ${offer.brand} zahlt ${(offer.perSeason / 1e6).toFixed(1).replace('.', ',')} Mio. € pro Saison (${offer.years} Jahre).` });
}

// season end: performance bonuses and contract expiry
export function sponsorSeasonClose(world, club, rank) {
  if (!club.sponsorDeals) return [];
  const notes = [];
  for (const [k, d] of Object.entries(club.sponsorDeals)) {
    if (!d) continue;
    if (d.bonus && rank <= d.bonus.rank) { club.budget += d.bonus.amount; notes.push(`${d.brand} zahlt Erfolgsbonus (${(d.bonus.amount / 1e6).toFixed(1).replace('.', ',')} Mio. €)`); }
    d.years--;
    if (d.years <= 0) { club.sponsorDeals[k] = null; notes.push(`Vertrag mit ${d.brand} (${d.slotName}) ausgelaufen – neuen Partner suchen!`); }
  }
  return notes;
}

// ------------------------------------------------------------------ press conference
export function pressQuestions(world, club, opp, lastResult, rng) {
  const squad = club.squad.map((id) => world.players[id]).sort((a, b) => b.ovr - a.ovr);
  const star = squad[0], young = squad.find((p) => p.age <= 21 && p.ovr >= 65) || squad[5];
  const qs = [];
  if (lastResult === 'S') qs.push({ q: 'Nach dem Sieg zuletzt: Ist Ihre Mannschaft jetzt in Topform?', a: [['Wir sind hungrig und wollen nachlegen!', { team: 3, board: 1, fans: 2 }], ['Ein Sieg ist nur ein Sieg – wir bleiben demütig.', { board: 2 }], ['Darüber mache ich mir keine Gedanken.', {}]] });
  else if (lastResult === 'N') qs.push({ q: 'Nach der Niederlage wächst der Druck. Wie reagieren Sie?', a: [['Ich nehme die Verantwortung auf mich.', { team: 3, board: 1 }], ['Einige Spieler müssen sich steigern.', { team: -4, board: 2, fans: 1 }], ['Wir hatten Pech, das gleicht sich aus.', { fans: -2 }]] });
  qs.push({ q: `Was erwarten Sie gegen ${opp.name}?`, a: [['Wir gewinnen dieses Spiel.', { team: 2, fans: 3, risk: true }], [`${opp.short} ist stark, aber wir sind bereit.`, { team: 1, board: 1 }], ['Ein Punkt wäre in Ordnung.', { team: -1, fans: -3, board: 1 }]] });
  if (star) qs.push({ q: `Gerüchte besagen, ${star.firstName} ${star.lastName} könnte den Verein verlassen. Ihr Kommentar?`, star: star.id, a: [['Er ist unverkäuflich.', { player: 8, board: -1 }], ['Jeder Spieler hat seinen Preis.', { player: -8, board: 3 }], ['Zu Gerüchten sage ich nichts.', {}]] });
  if (young) qs.push({ q: `Bekommt ${young.firstName} ${young.lastName} mehr Spielzeit?`, star: young.id, a: [['Er hat eine große Zukunft vor sich.', { player: 6, fans: 2 }], ['Er muss sich noch hinten anstellen.', { player: -5 }], ['Wir werden sehen.', {}]] });
  return qs.slice(0, 3);
}

// press conference after the match (v1.0)
export function postPressQuestions(world, club, info) {
  const { gf, ga, opp, best, worst, varOff } = info;
  const qs = [];
  if (gf > ga) qs.push({ q: `${gf}:${ga} gegen ${opp.short} – wie bewerten Sie den Sieg?`, a: [['Ein Sieg der ganzen Mannschaft, ich bin stolz.', { team: 3, fans: 1 }], ['Wir können noch viel besser spielen.', { team: -1, board: 2 }], ['Die drei Punkte zählen, sonst nichts.', { board: 1 }]] });
  else if (gf < ga) qs.push({ q: `Die ${gf}:${ga}-Niederlage gegen ${opp.short}: Was lief schief?`, a: [['Das geht auf meine Kappe.', { team: 3, board: -1, fans: 1 }], ['Einige Spieler haben heute nicht ihr Niveau erreicht.', { team: -5, board: 1 }], ['Der Schiedsrichter hat das Spiel entschieden.', { fans: 3, board: -3, money: -25000 }]] });
  else qs.push({ q: `Ein ${gf}:${ga} gegen ${opp.short} – Punkt gewonnen oder zwei verloren?`, a: [['Ein verdienter Punkt.', { board: 1 }], ['Zwei verlorene Punkte, das ärgert mich.', { team: 1, fans: 2 }], ['Wir nehmen es, wie es kommt.', {}]] });
  if (varOff) qs.push({ q: 'Ihr Tor wurde nach Videobeweis aberkannt. Ihre Meinung zum VAR?', a: [['Die Entscheidung war korrekt.', { board: 2 }], ['Der VAR zerstört den Fußball!', { fans: 4, board: -2, money: -15000 }], ['Kein Kommentar.', {}]] });
  if (best) qs.push({ q: `${best.firstName} ${best.lastName} war heute der beste Mann auf dem Platz. Ein Sonderlob?`, star: best.id, a: [['Ein Weltklasse-Spiel von ihm!', { player: 6, team: -1 }], ['Er hat seinen Job gemacht, wie alle.', { team: 2 }], ['Ich hebe keinen Spieler hervor.', {}]] });
  else if (worst) qs.push({ q: `${worst.firstName} ${worst.lastName} hatte einen schwachen Tag. Bekommt er weiter Ihr Vertrauen?`, star: worst.id, a: [['Natürlich, jeder hat mal einen schlechten Tag.', { player: 5 }], ['Er muss sich steigern.', { player: -6, board: 1 }], ['Darüber sprechen wir intern.', { player: 1 }]] });
  return qs.slice(0, 3);
}

export function applyPressAnswer(world, club, q, eff) {
  if (eff.money) club.budget += eff.money;
  if (eff.team) for (const id of club.squad) { const p = world.players[id]; p.morale = clamp(p.morale + eff.team, 10, 99); }
  if (eff.player && q.star && world.players[q.star]) world.players[q.star].morale = clamp(world.players[q.star].morale + eff.player, 10, 99);
  moodChange(world, eff.board || 0, eff.fans || 0);
  if (eff.risk) world.pressPromise = { week: world.week };
}

// ------------------------------------------------------------------ random events
const EVENTS = [
  { id: 'late', when: () => true, make: (w, c, rng) => { const p = rng.pick(c.squad.map((id) => w.players[id])); return { title: '⏰ Zu spät zum Training', text: `${p.firstName} ${p.lastName} ist heute 40 Minuten zu spät zum Training erschienen.`, player: p.id,
    options: [['Geldstrafe verhängen', { player: -6, board: 2, money: 0 }], ['Unter vier Augen ermahnen', { player: -2 }], ['Nicht weiter beachten', { team: -1 }]] }; } },
  { id: 'protest', when: (w, c) => (c.formRun || 0) <= -3 || ensureMood(w).fans < 30, make: () => ({ title: '📢 Fanprotest', text: 'Nach der schwachen Serie protestieren Fans vor der Geschäftsstelle und fordern ein Gespräch.',
    options: [['Mit den Fans sprechen', { fans: 8, board: -1 }], ['Öffentliches Statement', { fans: 3 }], ['Ignorieren', { fans: -6, board: -2 }]] }) },
  { id: 'shoot', when: () => true, make: (w, c) => ({ title: '📸 Werbedreh', text: 'Ein Sponsor möchte einen Werbespot mit der Mannschaft drehen – am freien Tag.',
    options: [['Zusagen (+250.000 €)', { money: 250000, team: -2 }], ['Absagen', { board: -1 }]] }) },
  { id: 'pyro', when: () => true, make: (w, c) => ({ title: '🔥 Pyrotechnik', text: 'Beim letzten Heimspiel wurde Pyrotechnik gezündet. Der Verband verhängt eine Geldstrafe.',
    options: [['Strafe zahlen (−80.000 €)', { money: -80000 }], ['Strafe zahlen & Fanclub sperren', { money: -80000, fans: -7, board: 3 }]] }) },
  { id: 'wish', when: (w, c) => c.squad.some((id) => w.players[id].morale < 45 && w.players[id].ovr > 70), make: (w, c) => { const p = c.squad.map((id) => w.players[id]).filter((x) => x.morale < 45 && x.ovr > 70)[0]; return { title: '✈️ Wechselwunsch', text: `${p.firstName} ${p.lastName} ist unzufrieden und lässt über seinen Berater einen Wechselwunsch ausrichten.`, player: p.id,
    options: [['Persönliches Gespräch', { player: 10, chance: 0.6 }], ['Auf die Transferliste setzen', { list: true, player: 4 }], ['Wunsch ablehnen', { player: -10, board: 1 }]] }; } },
  { id: 'homesick', when: (w, c) => c.squad.some((id) => w.players[id].age <= 23 && w.players[id].nation !== natOf(w, c)), make: (w, c) => { const p = c.squad.map((id) => w.players[id]).find((x) => x.age <= 23 && x.nation !== natOf(w, c)); return { title: '🏠 Heimweh', text: `${p.firstName} ${p.lastName} hat Heimweh und wirkt im Training abwesend.`, player: p.id,
    options: [['Familie einfliegen lassen (−40.000 €)', { money: -40000, player: 12 }], ['Mentaltrainer einschalten (−15.000 €)', { money: -15000, player: 6 }], ['Abwarten', { player: -6 }]] }; } },
  { id: 'talent', when: () => true, make: (w, c, rng) => ({ title: '🌟 Talent entdeckt', text: 'Dein Scout hat bei einem Regionalturnier ein 16-jähriges Ausnahmetalent entdeckt.',
    options: [['Sofort unter Vertrag nehmen (−150.000 €)', { money: -150000, youth: true }], ['Weiter beobachten', {}]] }) },
  { id: 'party', when: () => true, make: () => ({ title: '🎉 Mannschaftsabend', text: 'Der Mannschaftsrat fragt, ob das Team nach dem nächsten Spiel gemeinsam feiern darf.',
    options: [['Erlauben', { team: 5, fitness: -5 }], ['Verbieten', { team: -3, board: 1 }]] }) },
  { id: 'board', when: (w) => ensureMood(w).board > 75, make: (w, c) => ({ title: '💰 Vorstand zufrieden', text: 'Der Vorstand ist mit deiner Arbeit sehr zufrieden und bietet zusätzliches Transferbudget an.',
    options: [['Dankend annehmen (+2 Mio. €)', { money: 2e6, board: -5 }], ['Ablehnen – solide wirtschaften', { board: 6 }]] }) },
  { id: 'charity', when: () => true, make: () => ({ title: '🤝 Benefizaktion', text: 'Ein Kinderhospiz fragt, ob Spieler die Station besuchen.',
    options: [['Gerne, mit der ganzen Mannschaft', { fans: 5, team: 2 }], ['Nur die Kapitäne', { fans: 2 }]] }) },
];
const natOf = (w, c) => ({ DE: 'GER', EN: 'ENG', ES: 'ESP', IT: 'ITA', FR: 'FRA' }[leagueOf(w, c).country] || 'GER');

export function rollEvent(world, rng) {
  if (world.pendingEvent || rng.next() > 0.3) return null;
  const c = world.clubs[world.userClubId];
  const pool = EVENTS.filter((e) => e.when(world, c) && e.id !== world.lastEventId);
  if (!pool.length) return null;
  const ev = rng.pick(pool);
  world.pendingEvent = { id: ev.id, ...ev.make(world, c, rng) };
  world.lastEventId = ev.id;
  return world.pendingEvent;
}

export function resolveEvent(world, k, rng) {
  const ev = world.pendingEvent; if (!ev) return null;
  const [label, eff] = ev.options[k];
  const c = world.clubs[world.userClubId];
  const p = ev.player ? world.players[ev.player] : null;
  let msg = label;
  const ok = eff.chance == null || rng.chance(eff.chance);
  if (eff.money) { c.budget += eff.money; c.finance.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'event', label: ev.title.replace(/^\S+\s/, ''), amount: eff.money }], net: eff.money }); }
  if (eff.team) for (const id of c.squad) world.players[id].morale = clamp(world.players[id].morale + eff.team, 10, 99);
  if (eff.fitness) for (const id of c.squad) world.players[id].fitness = clamp(world.players[id].fitness + eff.fitness, 30, 100);
  if (p && eff.player) p.morale = clamp(p.morale + (ok ? eff.player : -eff.player), 10, 99);
  if (eff.list && p) { world.transfer.listed ||= []; if (!world.transfer.listed.includes(p.id)) world.transfer.listed.push(p.id); }
  if (eff.youth) {
    const L = leagueOf(world, c);
    const y = generatePlayer(rng, world.nextPlayerId++, rng.pick(['ZM', 'OM', 'ST', 'IV', 'LA', 'RA']), Math.round(46 + c.rep * 0.15 + rng.normal(0, 3)), 16, L.country, c.rep);
    y.pot = clamp(y.ovr + rng.int(22, 34), y.ovr, 94); y.clubId = c.id; y.contract = 3; y.wage = 24000; y.prog = {}; y.loan = null; y.releaseClause = null; y.career = []; y.moves = [];
    const used = new Set(c.squad.map((id) => world.players[id].number)); let n = 36; while (used.has(n)) n++; y.number = n;
    world.players[y.id] = y; c.squad.push(y.id);
    msg += ` – ${y.firstName} ${y.lastName} (${y.pos}, Potenzial ~${y.pot}) ist jetzt in deinem Kader.`;
  }
  if (eff.chance != null) msg += ok ? ' – das Gespräch hat geholfen.' : ' – das Gespräch hat nichts gebracht.';
  moodChange(world, eff.board || 0, eff.fans || 0);
  world.news.unshift({ season: world.season, week: world.week + 1, text: `${ev.title}: ${msg}` });
  world.pendingEvent = null;
  return msg;
}

// ------------------------------------------------------------------ rumours & Deadline Day
const SOURCES = [['Kicker-Insider', 0.7], ['Transferexperte', 0.6], ['Lokalzeitung', 0.45], ['Boulevard', 0.25], ['Social Media', 0.15], ['Spielerberater', 0.4]];
export function rollRumours(world, rng, n = 3) {
  world.rumours ||= [];
  const clubs = Object.values(world.clubs);
  for (let i = 0; i < n; i++) {
    const buyer = rng.pick(clubs.filter((c) => c.rep > 60));
    const cands = clubs.filter((c) => c.id !== buyer.id && c.rep < buyer.rep + 5).flatMap((c) => c.squad.map((id) => world.players[id])).filter((p) => p && p.ovr >= buyer.rep * 0.62 + 20 && p.ovr <= buyer.rep * 0.62 + 34);
    if (!cands.length) continue;
    const p = rng.pick(cands);
    const [src, rel] = rng.pick(SOURCES);
    world.rumours.unshift({ season: world.season, week: world.week + 1, player: p.id, name: `${p.firstName} ${p.lastName}`.trim(), from: p.clubId, to: buyer.id, source: src, reliability: rel, status: 'Gerücht' });
  }
  world.rumours = world.rumours.slice(0, 30);
}
export function confirmRumour(world, p, to) {
  for (const r of world.rumours || []) if (r.player === p.id) r.status = r.to === to.id ? 'Bestätigt ✅' : 'Falsch ❌';
}
export function isDeadlineDay(info) { return info.open && info.closesIn === 1; }
