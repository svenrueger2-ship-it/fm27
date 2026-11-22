// Dressing room dynamics (v2.0): hierarchy, cliques, team spirit, conflicts between players,
// the players' council with its requests and team events.
import { money } from '../core/fmt.js';
import { clamp } from '../core/rng.js';
import { traits, leadership, ensureCaptain } from './players.js';

const LANG = {
  Deutschsprachig: ['GER', 'AUT', 'SUI'], Englischsprachig: ['ENG', 'SCO', 'WAL', 'IRL', 'NIR', 'USA', 'CAN', 'AUS', 'JAM', 'NZL'],
  'Spanisch & Portugiesisch': ['ESP', 'POR', 'BRA', 'ARG', 'URU', 'COL', 'ECU', 'PAR', 'CHI', 'PER', 'VEN', 'MEX', 'CRC', 'PAN'],
  Französischsprachig: ['FRA', 'BEL', 'SEN', 'CIV', 'CMR', 'MLI', 'GUI', 'BFA', 'COD', 'MAR', 'ALG', 'TUN', 'LUX'],
  Skandinavisch: ['DEN', 'SWE', 'NOR', 'FIN', 'ISL'], 'Osteuropa & Balkan': ['POL', 'CRO', 'SRB', 'UKR', 'CZE', 'SVK', 'SVN', 'HUN', 'ROU', 'BIH', 'ALB', 'GEO', 'KOS', 'MKD', 'MNE', 'BUL', 'TUR', 'GRE'],
  Italienisch: ['ITA'], Niederländisch: ['NED'],
};
const langOf = (nat) => Object.keys(LANG).find((k) => LANG[k].includes(nat)) || 'International';
const stamp = (w) => w.season * 100 + w.week;
const squadOf = (w, club) => club.squad.map((id) => w.players[id]).filter((p) => p && p.clubId === club.id);

export function ensureKabine(world, club = world.clubs[world.userClubId]) {
  if (club.spirit == null) club.spirit = 60;
  club.kabine ||= { conflicts: [], council: null, lastEvent: -99, log: [] };
  return club.kabine;
}

export function hierarchy(world, club) {
  ensureCaptain(world, club);
  const ps = squadOf(world, club);
  const ranked = ps.map((p) => ({ p, l: leadership(p) + (p.id === club.captain ? 25 : 0) + Math.min(10, (p.seasonsAtClub || 0) * 2) })).sort((a, b) => b.l - a.l);
  const out = {};
  ranked.forEach(({ p }, i) => {
    const newcomer = (p.moves || []).some((m) => m.season === world.season) || (p.joined === world.season);
    out[p.id] = p.id === club.captain || i === 0 ? 'Leitwolf' : i < 4 ? 'Führungsspieler' : newcomer ? 'Neuzugang' : p.age <= 21 ? 'Talent' : 'Etabliert';
  });
  return out;
}

export function cliques(world, club) {
  const ps = squadOf(world, club);
  const groups = {};
  for (const p of ps) (groups[langOf(p.nation)] ||= []).push(p);
  const young = ps.filter((p) => p.age <= 22), old = ps.filter((p) => p.age >= 30);
  const res = Object.entries(groups).filter(([, a]) => a.length >= 3).map(([name, a]) => ({ name, members: a, mood: Math.round(a.reduce((s, p) => s + p.morale, 0) / a.length), kind: 'Sprache' }));
  if (young.length >= 4) res.push({ name: 'Junge Wilde', members: young, mood: Math.round(young.reduce((s, p) => s + p.morale, 0) / young.length), kind: 'Alter' });
  if (old.length >= 3) res.push({ name: 'Routiniers', members: old, mood: Math.round(old.reduce((s, p) => s + p.morale, 0) / old.length), kind: 'Alter' });
  return res.sort((a, b) => b.members.length - a.members.length);
}

export function spiritFactors(world, club) {
  const ps = squadOf(world, club);
  const morale = ps.reduce((s, p) => s + p.morale, 0) / Math.max(1, ps.length);
  const unhappy = ps.filter((p) => p.wantsOut || p.morale < 32).length;
  const cap = world.players[club.captain];
  const cl = cliques(world, club).filter((c) => c.kind === 'Sprache');
  const biggest = cl[0] ? cl[0].members.length / ps.length : 0;
  const isolated = cl.filter((c) => c.mood < 45).length;
  const f = [
    ['Stimmung der Spieler', (morale - 55) * 0.45],
    ['Form der Mannschaft', clamp((club.formRun || 0) * 2.2, -9, 9)],
    ['Kapitän', cap ? (leadership(cap) - 60) / 4 : -3],
    ['Unzufriedene Spieler', -unhappy * 2.2],
    ['Grüppchenbildung', biggest > 0.55 ? -5 : biggest > 0.4 ? -2 : 1],
    ['Frustrierte Gruppen', -isolated * 3],
    ['Offene Konflikte', -(club.kabine?.conflicts?.filter((c) => !c.done).length || 0) * 4],
  ];
  return f.map(([label, v]) => ({ label, v: Math.round(v * 10) / 10 }));
}

// ------------------------------------------------------------------ weekly
export function weeklyKabine(world, rng) {
  const club = world.clubs[world.userClubId]; if (!club) return;
  const K = ensureKabine(world, club);
  const target = 60 + spiritFactors(world, club).reduce((s, f) => s + f.v, 0);
  club.spirit = clamp(club.spirit + (target - club.spirit) * 0.15 + (club.spiritBoost || 0), 5, 99);
  club.spiritBoost = 0;
  // team spirit also lifts or drags the players' morale
  for (const p of squadOf(world, club)) p.morale = clamp(Math.round(p.morale + (club.spirit - 60) / 30), 5, 99);
  // conflicts
  const open = K.conflicts.filter((c) => !c.done);
  if (open.length < 2 && rng.chance(clamp((60 - club.spirit) / 120, 0.02, 0.35))) makeConflict(world, rng, club);
  for (const c of open) { c.weeks = (c.weeks || 0) + 1; if (c.weeks >= 3) { c.done = true; c.result = 'eskaliert'; club.spirit = clamp(club.spirit - 6, 5, 99); for (const id of [c.a, c.b]) if (world.players[id]) world.players[id].morale = clamp(world.players[id].morale - 8, 5, 99); log(world, club, `💥 Der Streit zwischen ${name(world, c.a)} und ${name(world, c.b)} ist eskaliert – die Kabine ist gespalten.`); } }
  // players' council every 5 weeks
  if (world.week > 0 && world.week % 5 === 0 && !K.council) makeCouncil(world, rng, club);
}
const name = (w, id) => w.players[id] ? w.players[id].lastName : 'ein Spieler';
function log(world, club, text) { const K = club.kabine; K.log.unshift({ season: world.season, week: world.week, text }); K.log = K.log.slice(0, 30); world.news.unshift({ season: world.season, week: world.week, text }); }

const CONFLICTS = [
  ['Stammplatz', (a, b) => `${a} fühlt sich gegenüber ${b} benachteiligt und hat sich im Training mit ihm angelegt.`],
  ['Kabinenzoff', (a, b) => `${a} und ${b} sind nach der letzten Niederlage in der Kabine aneinandergeraten.`],
  ['Interview', (a, b) => `${a} hat in einem Interview gegen ${b} gestichelt.`],
  ['Disziplin', (a, b) => `${a} wirft ${b} mangelnden Einsatz vor.`],
];
function makeConflict(world, rng, club) {
  const ps = squadOf(world, club);
  const hot = ps.filter((p) => traits(p).temper > 0.6 || p.morale < 40 || p.wantsOut);
  if (!hot.length) return;
  const a = rng.pick(hot);
  const others = ps.filter((p) => p !== a && (p.pos === a.pos || Math.abs(p.ovr - a.ovr) < 6));
  const b = others.length ? rng.pick(others) : rng.pick(ps.filter((p) => p !== a));
  if (!b) return;
  const [kind, txt] = rng.pick(CONFLICTS);
  club.kabine.conflicts.unshift({ id: (club.kabine.nextId = (club.kabine.nextId || 0) + 1), a: a.id, b: b.id, kind, text: txt(a.lastName, b.lastName), at: stamp(world), done: false });
  log(world, club, `⚡ Ärger in der Kabine: ${txt(a.lastName, b.lastName)}`);
}

export const CONFLICT_OPTIONS = [
  ['talk', '🗣️ Beide zum Gespräch bitten', 'Kostet Zeit, hilft meistens'],
  ['captain', '🎖️ Den Kapitän schlichten lassen', 'Wirkt je nach Führungsqualität'],
  ['fine', '💶 Geldstrafe für beide', 'Sofortige Ruhe, aber Moral sinkt'],
  ['ignore', '🙈 Ignorieren', 'Kann eskalieren'],
];
export function resolveConflict(world, id, how, rng) {
  const club = world.clubs[world.userClubId], K = ensureKabine(world, club);
  const c = K.conflicts.find((x) => x.id === id); if (!c || c.done) return null;
  const A = world.players[c.a], B = world.players[c.b], cap = world.players[club.captain];
  let ok = false, text = '';
  if (how === 'talk') { ok = rng.chance(0.7 + ((world.career?.rep ?? 50) - 50) / 200); text = ok ? 'Nach einem langen Gespräch geben sich beide die Hand.' : 'Das Gespräch bringt nichts – beide bleiben stur.'; }
  else if (how === 'captain') { ok = cap && rng.chance(clamp(leadership(cap) / 100, 0.3, 0.9)); text = ok ? `${cap.lastName} regelt das intern – Ruhe ist eingekehrt.` : 'Der Kapitän kann den Streit nicht schlichten.'; }
  else if (how === 'fine') { ok = true; for (const p of [A, B]) if (p) p.morale = clamp(p.morale - 7, 5, 99); club.budget += 40000; text = 'Beide zahlen eine Geldstrafe. Der Streit ist vorerst beendet.'; }
  else { c.ignored = true; return { ok: false, text: 'Du hältst dich raus. Mal sehen, ob sich das von selbst erledigt …' }; }
  if (ok) { c.done = true; c.result = how; club.spirit = clamp(club.spirit + (how === 'fine' ? 1 : 4), 5, 99); for (const p of [A, B]) if (p && how !== 'fine') p.morale = clamp(p.morale + 4, 5, 99); }
  else club.spirit = clamp(club.spirit - 2, 5, 99);
  log(world, club, `🤝 Konflikt ${A?.lastName ?? ''} / ${B?.lastName ?? ''}: ${text}`);
  return { ok, text };
}

// ------------------------------------------------------------------ players' council
const REQUESTS = [
  { id: 'frei', text: 'Die Mannschaft wünscht sich mehr freie Tage im Trainingsplan.', yes: 'Ein Tag pro Woche wird frei.', apply: (w, c) => { if (c.training?.plan) c.training.plan[1] = 'frei'; } , spirit: 5, morale: 4 },
  { id: 'praemie', text: 'Der Spielerrat fordert eine Sonderprämie, wenn das Saisonziel erreicht wird.', yes: 'Prämie zugesagt (500.000 € bei Zielerreichung).', apply: (w, c) => { c.kabine.bonusPromise = 500000; }, spirit: 7, morale: 5 },
  { id: 'trip', text: 'Die Spieler schlagen ein Kurz-Trainingslager zum Zusammenwachsen vor.', yes: 'Trainingslager gebucht (150.000 €).', apply: (w, c) => { c.budget -= 150000; c.familiarity = Math.min(1, (c.familiarity ?? 0.8) + 0.06); }, spirit: 8, morale: 3 },
  { id: 'kantine', text: 'Der Spielerrat wünscht sich einen neuen Ernährungsberater und eine bessere Kantine.', yes: 'Ernährungsberater eingestellt (80.000 €).', apply: (w, c) => { c.budget -= 80000; for (const id of c.squad) { const p = w.players[id]; p.fitness = Math.min(100, p.fitness + 5); } }, spirit: 4, morale: 3 },
  { id: 'familie', text: 'Die Spieler möchten, dass Familien öfter zum Training kommen dürfen.', yes: 'Familientage im Training eingeführt.', apply: () => {}, spirit: 4, morale: 4 },
];
function makeCouncil(world, rng, club) {
  const leaders = Object.entries(hierarchy(world, club)).filter(([, r]) => r === 'Leitwolf' || r === 'Führungsspieler').map(([id]) => +id).slice(0, 3);
  const req = rng.pick(REQUESTS.filter((r) => r.id !== club.kabine.lastRequest));
  club.kabine.council = { req: req.id, text: req.text, leaders, at: stamp(world) };
  club.kabine.lastRequest = req.id;
  log(world, club, `🪑 Der Spielerrat (${leaders.map((id) => name(world, id)).join(', ')}) bittet um ein Gespräch: ${req.text}`);
}
export function answerCouncil(world, accept) {
  const club = world.clubs[world.userClubId], K = ensureKabine(world, club), C = K.council; if (!C) return null;
  const req = REQUESTS.find((r) => r.id === C.req);
  K.council = null;
  if (accept) { req.apply(world, club); club.spirit = clamp(club.spirit + req.spirit, 5, 99); for (const id of club.squad) world.players[id].morale = clamp(world.players[id].morale + req.morale, 5, 99); log(world, club, `🪑 Spielerrat: ${req.yes}`); return req.yes; }
  club.spirit = clamp(club.spirit - 4, 5, 99);
  for (const id of C.leaders) if (world.players[id]) world.players[id].morale = clamp(world.players[id].morale - 6, 5, 99);
  log(world, club, '🪑 Spielerrat: Du lehnst die Bitte ab – die Führungsspieler sind enttäuscht.');
  return 'Abgelehnt – die Führungsspieler sind enttäuscht.';
}

// ------------------------------------------------------------------ team events
export const TEAM_EVENTS = [
  { id: 'grill', name: 'Grillabend', icon: '🍖', cost: 20000, spirit: 4, desc: 'Locker beisammen sein.' },
  { id: 'bowling', name: 'Bowling & Kart', icon: '🎳', cost: 35000, spirit: 5, desc: 'Ein bisschen Wettkampf außerhalb des Platzes.' },
  { id: 'fans', name: 'Fan-Abend', icon: '🎉', cost: 25000, spirit: 3, fans: 4, desc: 'Mannschaft trifft Fanclubs – auch die Fans freuen sich.' },
  { id: 'trip', name: 'Mannschaftsfahrt', icon: '🚌', cost: 180000, spirit: 9, desc: 'Ein Wochenende weg – schweißt zusammen.' },
];
export function teamEvent(world, id) {
  const club = world.clubs[world.userClubId], K = ensureKabine(world, club);
  const E = TEAM_EVENTS.find((e) => e.id === id);
  if (stamp(world) - K.lastEvent < 4) return { ok: false, msg: 'Das letzte Teamevent ist noch keine 4 Wochen her.' };
  if (club.budget < E.cost) return { ok: false, msg: 'Nicht genug Budget.' };
  club.budget -= E.cost; K.lastEvent = stamp(world);
  club.spirit = clamp(club.spirit + E.spirit, 5, 99);
  for (const pid of club.squad) world.players[pid].morale = clamp(world.players[pid].morale + 2, 5, 99);
  if (E.fans && world.mood) world.mood.fans = clamp(world.mood.fans + E.fans, 0, 100);
  log(world, club, `${E.icon} ${E.name}: Die Mannschaft verbringt einen gelungenen Abend zusammen.`);
  return { ok: true, msg: `${E.name} – Teamgeist +${E.spirit}` };
}
export function spiritLabel(s) { return s >= 80 ? 'Eingeschworene Einheit' : s >= 65 ? 'Gute Stimmung' : s >= 50 ? 'Durchwachsen' : s >= 35 ? 'Angespannt' : 'Zerstritten'; }

// season end: promised bonuses are paid (or broken)
export function seasonKabine(world, reached) {
  const club = world.clubs[world.userClubId], K = club?.kabine; if (!K) return;
  if (K.bonusPromise) {
    if (reached) { club.budget -= K.bonusPromise; log(world, club, `💶 Die versprochene Prämie (${money(K.bonusPromise)}) wird ausgezahlt.`); club.spirit = clamp(club.spirit + 5, 5, 99); }
    K.bonusPromise = 0;
  }
  for (const p of squadOf(world, club)) p.seasonsAtClub = (p.seasonsAtClub || 0) + 1;
}
