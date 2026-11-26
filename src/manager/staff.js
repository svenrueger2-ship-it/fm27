// Staff & automation (v0.9): an assistant coach, a physio, a youth coach and a chief scout who take
// work off the user's hands. For every area the user decides: do it myself ("me"), the staff suggests
// and I confirm in the inbox ("ask"), or the staff does it on its own ("auto").
import { money } from '../core/fmt.js';
import { clamp } from '../core/rng.js';
import { autoLineup, ensureLineup } from '../match/tactics.js';
import { TRAINING_FOCUS, ensureTraining, PLAN_TEMPLATES } from './training.js';
import { contractDemand, extendContract, assignScout, searchMarket, maxScouts, askingPrice, respondOffer, ensureTransferState } from './transfers.js';
import { youthPlayers, promoteYouth, releaseYouth } from './youth.js';
import { squadNeeds } from './clubAI.js';
import { isDirector } from './director.js';

export const AREAS = [
  ['lineup', 'Aufstellung', '📋', 'Verletzte, gesperrte oder platte Spieler aus der Startelf nehmen'],
  ['training', 'Training', '🏋️', 'Schwerpunkt, Intensität und Einzeltraining nach Bedarf'],
  ['contracts', 'Verträge', '✍️', 'Wichtige Spieler rechtzeitig verlängern'],
  ['youth', 'U19', '🌱', 'Reife Talente hochziehen, chancenlose verabschieden'],
  ['scouting', 'Scouting', '🔭', 'Spieler für Kaderlücken beobachten lassen'],
  ['offers', 'Angebote', '📨', 'Transferangebote für eigene Spieler bewerten'],
  ['press', 'Presse', '🎤', 'Pressekonferenzen übernehmen'],
];
export const ROLES = { assistant: 'Co-Trainer', physio: 'Physiotherapeut', youth: 'Jugendtrainer', scout: 'Chefscout' };
const FIRST = ['Lars', 'Mats', 'Felix', 'Jonas', 'Tim', 'Ole', 'Paul', 'Erik', 'Hannes', 'Kai', 'Nils', 'Moritz', 'Jan', 'Rafael', 'Diego', 'Simon'];
const LAST = ['Becker', 'Wolf', 'Schreiber', 'Krause', 'Hofmann', 'Brandt', 'Peters', 'Graf', 'Engel', 'Seidel', 'Vogel', 'Roth', 'Kuhn', 'Pohl', 'Arnold', 'Busch'];

function makeStaff(rng, role, q) {
  return { role, name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`, quality: q, wage: Math.round((60000 + q * q * 45000) / 1e4) * 1e4 };
}

export function ensureStaff(world, rng) {
  if (world.staff) return world.staff;
  const club = world.clubs[world.userClubId];
  const q = clamp(Math.round((club.rep - 30) / 18), 1, 4);
  world.staff = {
    members: Object.fromEntries(Object.keys(ROLES).map((r) => [r, makeStaff(rng, r, q)])),
    delegate: { lineup: 'me', training: 'auto', contracts: 'ask', youth: 'ask', scouting: 'ask', offers: 'me', press: 'me' },
  };
  world.inbox ||= [];
  world.inboxId ||= 1;
  return world.staff;
}

export const staffQ = (world, role) => world.staff?.members?.[role]?.quality ?? 2;
export const staffWages = (world) => Object.values(world.staff?.members || {}).reduce((s, m) => s + m.wage, 0);

export function staffCandidates(world, rng, role) {
  const cur = staffQ(world, role);
  return [cur, cur + 1, cur + 2].filter((q) => q <= 5).map((q) => ({ ...makeStaff(rng, role, q), fee: Math.round((q * q * 50000) / 1e4) * 1e4 }));
}
export function hireStaff(world, cand) {
  const club = world.clubs[world.userClubId];
  if (club.budget < cand.fee) return { ok: false, msg: 'Nicht genug Budget.' };
  club.budget -= cand.fee;
  club.finance?.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'wages', label: `Verpflichtung ${ROLES[cand.role]} ${cand.name}`, amount: -cand.fee }], net: -cand.fee });
  world.staff.members[cand.role] = { role: cand.role, name: cand.name, quality: cand.quality, wage: cand.wage };
  return { ok: true };
}

// ------------------------------------------------------------------ inbox
// actions are kept in memory only (functions cannot be stored in IndexedDB); after a reload they are rebuilt
const RUNS = new Map();
function push(world, item) {
  world.inbox ||= [];
  if (item.key && world.inbox.some((x) => x.key === item.key && !x.done)) return;
  const { run, ...rest } = item;
  const id = world.inboxId++;
  if (run) RUNS.set(id, run);
  world.inbox.unshift({ id, season: world.season, week: world.week, done: false, ...rest });
  world.inbox = world.inbox.slice(0, 60);
}
export const openInbox = (world) => (world.inbox || []).filter((x) => !x.done && x.actions?.length);
function note(world, area, text) { push(world, { area, from: whoFor(area), title: text, text: '', actions: [], done: true, auto: true }); }
const whoFor = (area) => ({ lineup: 'assistant', training: 'assistant', press: 'assistant', contracts: 'assistant', offers: 'assistant', youth: 'youth', scouting: 'scout' }[area]);

// ------------------------------------------------------------------ planners (return a proposal or null)
function planLineup(world) {
  const club = world.clubs[world.userClubId];
  ensureLineup(club, world.players);
  const bad = club.lineup.xi.map((id) => world.players[id]).filter((p) => !p || p.injury > 0 || p.suspension > 0 || p.fitness < 62 || p.clubId !== club.id);
  if (!bad.length) return null;
  return { text: `${bad.map((p) => p ? `${p.lastName} (${p.injury > 0 ? 'verletzt' : p.suspension > 0 ? 'gesperrt' : p.clubId !== club.id ? 'nicht mehr im Kader' : `Fitness ${Math.round(p.fitness)} %`})` : 'Lücke').join(', ')} – ich würde umstellen.`, run: () => { club.lineup = autoLineup(club, world.players, club.tactic.formation); } };
}

function planTraining(world) {
  const club = world.clubs[world.userClubId];
  const tr = ensureTraining(club);
  const ps = club.squad.map((id) => world.players[id]);
  const fit = ps.reduce((s, p) => s + p.fitness, 0) / ps.length;
  const inj = ps.filter((p) => p.injury > 0).length;
  const h = club.history?.length ? null : null; void h;
  const L = world.leagues.find((l) => l.id === club.leagueId);
  let gf = 0, ga = 0, n = 0;
  for (const md of L.fixtures) for (const m of md) if (m.hg != null && (m.h === club.id || m.a === club.id)) { n++; gf += m.h === club.id ? m.hg : m.ag; ga += m.h === club.id ? m.ag : m.hg; }
  let focus = 'ausgewogen', why = 'alles im Lot';
  if ((club.familiarity ?? 1) < 0.85) { focus = 'taktik'; why = 'die Mannschaft ist noch nicht eingespielt'; }
  else if (fit < 72) { focus = 'fitness'; why = 'die Fitness ist zu niedrig'; }
  else if (n >= 4 && ga / n > 1.6) { focus = 'verteidigung'; why = `${(ga / n).toFixed(1).replace('.', ',')} Gegentore pro Spiel`; }
  else if (n >= 4 && gf / n < 1.1) { focus = 'angriff'; why = `nur ${(gf / n).toFixed(1).replace('.', ',')} Tore pro Spiel`; }
  const intensity = inj >= 4 ? 0.45 : fit < 75 ? 0.5 : 0.65;
  // individual focus for young talents: their weakest important attribute
  const indiv = {};
  for (const p of ps.filter((q) => q.age <= 23 && q.pot - q.ovr >= 6 && q.pos !== 'TW').slice(0, 6)) {
    const keys = ['abschluss', 'passspiel', 'dribbling', 'tackling', 'stellungsspiel', 'tempo', 'technik'];
    indiv[p.id] = keys.sort((a, b) => p.attrs[a] - p.attrs[b])[0];
  }
  if (tr.plan) {
    const tpl = fit < 72 || inj >= 4 ? 'englisch' : (club.familiarity ?? 1) < 0.85 ? 'standard' : ps.filter((q) => q.age <= 22).length >= 8 ? 'jugend' : 'standard';
    const plan = PLAN_TEMPLATES[tpl].plan;
    if (plan.join() === tr.plan.join()) return null;
    return { text: `Wochenplan „${PLAN_TEMPLATES[tpl].name}“ – ${fit < 72 ? 'die Spieler brauchen Erholung' : inj >= 4 ? 'zu viele Verletzte' : 'passt zur aktuellen Lage'}.`, key: `trp-${tpl}`, run: () => { tr.plan = [...plan]; } };
  }
  if (tr.focus === focus && Math.abs(tr.intensity - intensity) < 0.06) return null;
  return { text: `Trainingsschwerpunkt ${TRAINING_FOCUS[focus].name}, Intensität ${Math.round(intensity * 100)} % – ${why}.`, key: `tr-${focus}-${intensity}`, run: () => { tr.focus = focus; tr.intensity = intensity; tr.individual = { ...tr.individual, ...indiv }; } };
}

function planContracts(world) {
  const club = world.clubs[world.userClubId];
  const sorted = club.squad.map((id) => world.players[id]).sort((a, b) => b.ovr - a.ovr);
  const out = [];
  sorted.forEach((p, i) => {
    if (p.loan || p.contract > 1 || p.staffAsked === world.season) return;
    const important = i < 15 || (p.age <= 23 && p.pot >= 75);
    if (!important) return;
    const d = contractDemand(world, p, club);
    if (!d.willing) { if (['me', 'off'].includes(world.staff?.delegate?.contracts)) return; p.staffAsked = world.season; note(world, 'contracts', `${ROLES.assistant}: ${p.firstName} ${p.lastName} will nicht verlängern – ${d.reason} Verkaufen oder ablösefrei ziehen lassen?`); return; }
    const years = clamp(p.age >= 30 ? d.minY : 3, d.minY, d.maxY);
    out.push({ p, fail: (r) => `${ROLES.assistant}: Verlängerung mit ${p.firstName} ${p.lastName} gescheitert – ${r.msg}`, text: `${p.firstName} ${p.lastName} (${p.ovr}, ${p.age}) läuft aus – Verlängerung um ${years} ${years === 1 ? 'Jahr' : 'Jahre'} für ${d.wage >= 1e6 ? (d.wage / 1e6).toFixed(1).replace('.', ',') + ' Mio.' : Math.round(d.wage / 1000) + ' Tsd.'} €/Jahr?`, key: `ct-${p.id}-${world.season}`, run: () => { p.staffAsked = world.season; return extendContract(world, p.id, d.wage, years); } });
  });
  return out.slice(0, 3);
}

function planYouth(world) {
  if (!world.youth) return [];
  const club = world.clubs[world.userClubId];
  const sorted = club.squad.map((id) => world.players[id].ovr).sort((a, b) => b - a);
  const bar = sorted[19] ?? 55;
  const out = [];
  for (const p of youthPlayers(world)) {
    if (p.age >= 18 && p.ovr >= bar - 2 && club.squad.length < 32) out.push({ text: `U19-Talent ${p.firstName} ${p.lastName} (${p.pos}, ${p.ovr}/${p.pot}) ist bereit für die Profis.`, key: `yu-${p.id}`, label: 'Hochziehen', run: () => promoteYouth(world, p.id) });
    else if (p.age >= 19 && p.pot < bar) out.push({ text: `${p.firstName} ${p.lastName} (${p.ovr}/${p.pot}) wird es nicht zu den Profis schaffen – verabschieden?`, key: `yr-${p.id}`, label: 'Verabschieden', run: () => releaseYouth(world, p.id) });
  }
  return out.slice(0, 3);
}

function planScouting(world) {
  ensureTransferState(world);
  const club = world.clubs[world.userClubId];
  const free = maxScouts(world) - world.scouting.assignments.length;
  if (free <= 0 || openInbox(world).some((x) => x.area === 'scouting')) return [];
  const needs = squadNeeds(world, club).slice(0, 2);
  const out = [];
  for (const n of needs) {
    const cands = searchMarket(world, { pos: n.pos, maxPrice: club.budget * 0.7, minOvr: n.minOvr, maxAge: n.reason.includes('alternde') ? 26 : 29 }).filter((x) => !world.scouting.watch.includes(x.p.id) && x.p.clubId);
    const best = cands.sort((a, b) => (b.est.ovr + (b.est.potHi - b.est.ovr) * 0.3) - (a.est.ovr + (a.est.potHi - a.est.ovr) * 0.3))[0];
    if (best) out.push({ text: `Kaderlücke: ${n.reason}. ${best.p.firstName} ${best.p.lastName} (${best.p.pos}, ${best.p.age}, ${world.clubs[best.p.clubId].short}) sollten wir beobachten.`, key: `sc-${best.p.id}`, label: 'Scout schicken', run: () => assignScout(world, best.p.id) });
  }
  return out.slice(0, free);
}

function planOffers(world) {
  const club = world.clubs[world.userClubId];
  const sorted = club.squad.map((id) => world.players[id]).sort((a, b) => b.ovr - a.ovr);
  return (world.transfer?.offers || []).filter((o) => !o.staffSeen).map((o) => {
    const p = world.players[o.playerId], buyer = world.clubs[o.clubId];
    const key = sorted.indexOf(p) < 11, ask = askingPrice(world, p);
    const good = o.fee >= ask * (key ? 1.35 : 1.05);
    o.staffSeen = true;
    return { text: `${buyer.name} bietet ${money(o.fee)} für ${p.lastName}${key ? ' (Stammspieler)' : ''}. Empfehlung: ${good ? 'annehmen' : key ? 'ablehnen' : 'nachverhandeln'}.`,
      key: `of-${o.id}`, label: good ? 'Annehmen' : key ? 'Ablehnen' : 'Nachverhandeln', run: (rng) => respondOffer(world, o.id, good ? 'accept' : key ? 'reject' : 'counter', rng) };
  });
}

// ------------------------------------------------------------------ weekly run
export function weeklyStaff(world, rng) {
  if (world.userClubId == null) return;
  ensureStaff(world, rng);
  const D = world.staff.delegate;
  const handle = (area, prop) => {
    if (!prop) return;
    const mode = area === 'lineup' && isDirector(world) ? 'off' : D[area];
    if (mode === 'me' || mode === 'off') return;
    if (mode === 'auto') { const r = prop.run(rng); if (r?.ok === false) { if (prop.fail) note(world, area, prop.fail(r)); return; } note(world, area, `${ROLES[whoFor(area)]}: ${prop.text.replace(/ – ich würde umstellen\.|\?$/, '')} ✓ erledigt`); }
    else push(world, { area, from: whoFor(area), key: prop.key || `${area}-${world.season}-${world.week}`, title: prop.text, actions: [{ k: 'yes', label: prop.label || 'Umsetzen' }, { k: 'no', label: 'Ignorieren' }], run: prop.run });
  };
  handle('lineup', planLineup(world));
  if (world.week % 2 === 0) handle('training', planTraining(world));
  planContracts(world).forEach((p) => handle('contracts', p));
  planYouth(world).forEach((p) => handle('youth', p));
  if (world.week % 2 === 1) planScouting(world).forEach((p) => handle('scouting', p));
  planOffers(world).forEach((p) => handle('offers', p));
  // physio: better staff → faster recovery
  const pq = staffQ(world, 'physio');
  for (const id of world.clubs[world.userClubId].squad) { const p = world.players[id]; if (p.injury > 1 && rng.chance((pq - 2) * 0.08)) p.injury--; }
}

// pending inbox actions are stored as functions only in memory; after loading a save they are rebuilt
export function actInbox(world, id, k, rng) {
  const it = world.inbox.find((x) => x.id === id); if (!it || it.done) return null;
  it.done = true; it.choice = k;
  if (k !== 'yes') return { ok: true, msg: 'Ignoriert' };
  let run = RUNS.get(id);
  RUNS.delete(id);
  if (!run) { // rebuild after a reload
    const all = [planLineup(world), planTraining(world), ...planContracts(world), ...planYouth(world), ...planScouting(world)].filter(Boolean);
    run = all.find((p) => (p.key || '') === it.key)?.run || (it.area === 'lineup' ? planLineup(world)?.run : null);
  }
  if (!run) return { ok: false, msg: 'Der Vorschlag ist nicht mehr aktuell.' };
  const r = run(rng);
  return r?.ok === false ? r : { ok: true, msg: r?.msg || 'Umgesetzt' };
}

// press conference handled by the assistant: calm, neutral answers
export function autoPress(world) {
  if (world.staff?.delegate?.press !== 'auto' || world.pressWeek === world.week) return false;
  world.pressWeek = world.week;
  return true;
}

// Autopilot: is there something the user should look at before the next week is simulated?
export function stopReason(world, before) {
  if (openInbox(world).length > before.inbox) return 'Neue Vorschläge im Posteingang';
  if (world.pendingEvent) return 'Ein Ereignis wartet auf deine Entscheidung';
  if ((world.transfer?.offers?.length || 0) > before.offers) return 'Neues Transferangebot';
  const club = world.clubs[world.userClubId];
  const injured = club.squad.filter((id) => world.players[id].injury >= 3).length;
  if (injured > before.injured) return 'Ein Spieler hat sich länger verletzt';
  return null;
}
export function autopilotSnapshot(world) {
  const club = world.clubs[world.userClubId];
  return { inbox: openInbox(world).length, offers: world.transfer?.offers?.length || 0, injured: club.squad.filter((id) => world.players[id].injury >= 3).length };
}
