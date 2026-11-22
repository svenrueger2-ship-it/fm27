// Player relations (v0.9): personalities, one-to-one talks, promises that are tracked and can be
// broken, the captaincy, players who ask for a talk or want to leave — and loans with reports,
// buy options and buy obligations in both directions.
import { money } from '../core/fmt.js';
import { clamp } from '../core/rng.js';
import { taskEvent } from './progress.js';
import { autoLineup } from '../match/tactics.js';
import { news, windowInfo, askingPrice, ensureTransferState } from './transfers.js';
import { bookTransfer } from './economy.js';
import { squadNeeds } from './clubAI.js';

const TRAITS = {
  Professionell: [0.6, 0.6, 0.2, 0.5], Ehrgeizig: [0.95, 0.35, 0.5, 0.55], Ruhig: [0.4, 0.6, 0.1, 0.4], Loyal: [0.45, 0.95, 0.2, 0.5],
  Temperamentvoll: [0.7, 0.45, 0.9, 0.5], Launisch: [0.5, 0.3, 0.85, 0.2], Führungsspieler: [0.75, 0.7, 0.35, 0.95], Lässig: [0.3, 0.5, 0.3, 0.2],
  Teamplayer: [0.5, 0.75, 0.2, 0.65], Perfektionist: [0.85, 0.5, 0.55, 0.6],
};
export function traits(p) { const t = TRAITS[p.personality] || [0.5, 0.5, 0.4, 0.4]; return { ambition: t[0], loyalty: t[1], temper: t[2], lead: t[3] }; }
export const leadership = (p) => Math.round(traits(p).lead * 45 + clamp(p.age - 20, 0, 12) * 1.6 + p.ovr * 0.2 + p.professionalism * 0.12);
const stamp = (w) => w.season * 100 + w.week;
const userClub = (w) => w.clubs[w.userClubId];

// ------------------------------------------------------------------ captain
export function ensureCaptain(world, club = userClub(world)) {
  const ps = club.squad.map((id) => world.players[id]).filter((p) => p && !(p.loan && p.loan.to === club.id));
  if (!club.captain || !club.squad.includes(club.captain)) club.captain = ps.sort((a, b) => leadership(b) - leadership(a))[0]?.id ?? null;
  if (club.vice && (!club.squad.includes(club.vice) || club.vice === club.captain)) club.vice = null;
  return club.captain;
}
export function setCaptain(world, id) {
  const club = userClub(world), old = world.players[club.captain], p = world.players[id];
  if (!p || club.captain === id) return null;
  let msg = `${p.lastName} ist neuer Kapitän.`;
  p.morale = clamp(p.morale + 10, 0, 99);
  if (old) {
    club.vice = old.id;
    const t = traits(old);
    if (t.ambition > 0.65 || t.lead > 0.8) { old.morale = clamp(old.morale - 14, 0, 99); msg += ` ${old.lastName} ist enttäuscht über den Verlust der Binde.`; if (t.temper > 0.7) old.wantsTalk = true; }
    else msg += ` ${old.lastName} wird Vizekapitän.`;
  }
  club.captain = id;
  // the team reacts to how fitting the choice is
  const best = Math.max(...club.squad.map((x) => leadership(world.players[x])));
  const fit = leadership(p) - best;
  for (const x of club.squad) if (x !== id) world.players[x].morale = clamp(world.players[x].morale + (fit > -5 ? 2 : fit < -15 ? -3 : 0), 0, 99);
  news(world, `🎖️ ${msg}`);
  return msg;
}

// ------------------------------------------------------------------ talks
export const TALKS = [
  ['praise', '👏 Loben', 'Für gute Leistungen anerkennen'],
  ['criticize', '☝️ Kritisieren', 'Mehr Einsatz einfordern'],
  ['promiseStart', '🤝 Stammplatz versprechen', 'Mind. 5 der nächsten 8 Spiele in der Startelf'],
  ['promiseRotation', '🔄 Einsatzzeit versprechen', 'Mind. 3 der nächsten 8 Spiele in der Startelf'],
  ['future', '🧭 Über die Zukunft sprechen', 'Rolle, Ziele und Wechselgedanken klären'],
];

export function canTalk(world, p) { return p.talkAt !== stamp(world); }

export function talk(world, id, kind, rng) {
  const p = world.players[id], t = traits(p), club = userClub(world);
  if (!canTalk(world, p)) return { mood: 0, reply: `${p.firstName} winkt ab: „Wir haben diese Woche doch schon gesprochen, Trainer.“` };
  p.talkAt = stamp(world); p.wantsTalk = false; taskEvent(world, 'talk');
  const before = p.morale;
  let reply = '';
  const goodForm = p.form >= 60 || (p.stats.apps >= 3 && p.stats.rating >= 6.9);
  if (kind === 'praise') {
    if (goodForm) { p.morale += 7; reply = '„Danke, Trainer! Das tut gut – ich will genau so weitermachen.“'; }
    else if (t.ambition > 0.8) { p.morale += 1; reply = '„Ehrlich gesagt weiß ich selbst, dass ich gerade nicht gut spiele.“'; }
    else { p.morale += 4; p.form -= t.temper < 0.3 ? 2 : 0; reply = '„Freut mich, dass Sie das so sehen.“'; }
  } else if (kind === 'criticize') {
    if (p.form < 48) {
      if (p.professionalism >= 70 || t.ambition > 0.75) { p.morale -= 3; p.form += 9; reply = '„Sie haben recht. Ich werde im Training mehr investieren.“'; }
      else if (t.temper > 0.7) { p.morale -= 15; if (rng.chance(0.35)) p.wantsOut = true; reply = `„Das ist unfair! Ich bin nicht der Einzige, der schlecht spielt.“${p.wantsOut ? ' Er denkt jetzt über einen Wechsel nach.' : ''}`; }
      else { p.morale -= 6; p.form += 4; reply = '„Okay … ich verstehe.“'; }
    } else { p.morale -= 11; reply = '„Wie bitte? Ich spiele doch ordentlich!“'; if (t.temper > 0.7) p.wantsTalk = true; }
  } else if (kind === 'promiseStart' || kind === 'promiseRotation') {
    if (p.promise) return { mood: 0, reply: `„Sie haben mir schon etwas versprochen – halten Sie das erst mal ein.“` };
    const start = kind === 'promiseStart';
    p.promise = { type: start ? 'Stammplatz' : 'Einsatzzeit', need: start ? 5 : 3, of: 8, at: stamp(world), season: world.season, base: p.stats.apps, weeks: 0 };
    p.morale += start ? 12 : 7; p.wantsOut = start ? false : p.wantsOut;
    reply = start ? '„Danke für das Vertrauen! Ich werde Sie nicht enttäuschen.“' : '„Mehr will ich gar nicht – nur meine Chance.“';
  } else if (kind === 'future') {
    if (p.wantsOut) {
      const cap = club.rep * 0.45 + 58;
      const ch = clamp(t.loyalty * 0.55 + (cap >= p.ovr ? 0.2 : -0.15) + (p.morale - 50) / 250, 0.05, 0.9);
      if (rng.chance(ch)) { p.wantsOut = false; p.morale += 9; reply = '„Sie haben mich überzeugt. Ich bleibe und gebe alles für den Verein.“'; }
      else { p.morale -= 4; reply = '„Ich habe mich entschieden. Ich möchte gehen – bitte legen Sie mir keine Steine in den Weg.“'; }
    } else {
      const xi = (club.lineup?.xi || []).includes(p.id);
      p.morale += xi ? 3 : t.ambition > 0.7 ? -2 : 2;
      reply = xi ? '„Ich fühle mich wohl hier. Meine Rolle passt.“' : t.ambition > 0.7 ? '„Ich will mehr spielen. Wenn das nicht klappt, muss ich nachdenken.“' : '„Ich warte geduldig auf meine Chance.“';
    }
  }
  p.morale = clamp(Math.round(p.morale), 5, 99); p.form = clamp(Math.round(p.form), 10, 99);
  return { mood: Math.round(p.morale - before), reply };
}

// weekly: promises are checked, unhappy players ask for a talk, captain influences the dressing room
export function weeklyPlayers(world, rng) {
  const club = userClub(world); if (!club) return;
  ensureCaptain(world, club);
  const cap = world.players[club.captain];
  const capEffect = cap ? (leadership(cap) - 60) / 40 : 0;
  const xiAvg = (() => { const L = club.lineup || autoLineup(club, world.players); const v = L.xi.map((id) => world.players[id]?.ovr || 0); return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length); })();
  for (const id of club.squad) {
    const p = world.players[id]; if (!p || (p.loan && p.loan.to !== club.id && p.loan.from === club.id)) continue;
    // dressing room: morale drifts toward a base level; a strong captain lifts it
    p.morale = clamp(Math.round(p.morale + (58 - p.morale) * 0.05 + capEffect), 5, 99);
    if (p.wantsOut) p.morale = Math.min(p.morale, 55);
    // promise tracking
    if (p.promise) {
      if (p.promise.season !== world.season) { p.promise.base = 0; p.promise.season = world.season; }
      p.promise.weeks++;
      if (p.promise.weeks >= p.promise.of) {
        const got = p.stats.apps - p.promise.base;
        if (got >= p.promise.need) { p.morale = clamp(p.morale + 8, 0, 99); news(world, `✅ Versprechen gehalten: ${p.lastName} hat seine ${p.promise.type === 'Stammplatz' ? 'Stammplatz-Garantie' : 'Einsatzzeit'} bekommen (${got}/${p.promise.of} Spiele).`); }
        else {
          p.morale = clamp(p.morale - 25, 0, 99); p.wantsOut = true;
          for (const x of club.squad) if (x !== id) world.players[x].morale = clamp(world.players[x].morale - 2, 0, 99);
          news(world, `💔 Versprechen gebrochen: ${p.firstName} ${p.lastName} kam nur auf ${got} von versprochenen ${p.promise.need} Einsätzen. Er fühlt sich belogen und will weg – auch die Kabine ist verstimmt.`);
        }
        p.promise = null;
      }
    }
    // ambitious players without match time ask for a talk
    if (world.week >= 6 && !p.wantsTalk && (p.talkAt == null || stamp(world) - p.talkAt > 6)) {
      const t = traits(p);
      const benched = p.stats.apps < world.week * 0.35 && p.ovr >= xiAvg - 4 && !p.injury;
      if ((p.morale < 32 || (benched && t.ambition > 0.7)) && rng.chance(0.25)) { p.wantsTalk = true; news(world, `💬 ${p.firstName} ${p.lastName} möchte mit dir sprechen${benched ? ' – er ist unzufrieden mit seiner Einsatzzeit' : ''}.`); }
    }
  }
}

// ------------------------------------------------------------------ loans: lending own players out
export function loanOutOffers(world, id, rng) {
  const p = world.players[id], me = userClub(world);
  if (!windowInfo(world).open) return { ok: false, msg: 'Das Transferfenster ist geschlossen.' };
  if (p.age > 30) return { ok: false, msg: 'Für Spieler über 30 gibt es keine Leihanfragen.' };
  if (me.squad.length <= 18) return { ok: false, msg: 'Mindestens 18 Spieler müssen im Kader bleiben.' };
  const myTier = world.leagues.find((l) => l.id === me.leagueId).tier ?? 1;
  const cands = Object.values(world.clubs).filter((c) => c.id !== me.id && c.ai && c.squad.length < 28 && c.rep * 0.45 + 58 >= p.ovr - 2 && (world.leagues.find((l) => l.id === c.leagueId).tier ?? 1) >= myTier - 0);
  // hosts where the player would actually play: his level must reach their starting XI
  const xiAvg = (c) => { const L = autoLineup(c, world.players); const v = L.xi.map((x) => world.players[x]?.ovr || 0); return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length); };
  const scored = cands.filter((c) => p.ovr >= xiAvg(c) - 2).map((c) => ({ c, s: (squadNeeds(world, c).some((n) => compatible(n.pos, p.pos)) ? 2 : 0.3) + rng.next() })).sort((a, b) => b.s - a.s).slice(0, 3);
  if (!scored.length) return { ok: false, msg: 'Kein Verein hat Interesse an einer Leihe.' };
  const offers = scored.map(({ c }, i) => {
    const share = clamp(Math.round((0.5 + c.rep / 200 + rng.range(-0.1, 0.15)) * 20) / 20, 0.5, 1);
    const fee = Math.round((p.value * rng.range(0.02, 0.06)) / 1e4) * 1e4;
    const kind = i === 0 ? 'none' : i === 1 ? 'option' : 'obligation';
    const buy = Math.round((Math.max(p.value, askingPrice(world, p)) * (kind === 'obligation' ? 1.0 : 1.15)) / 1e5) * 1e5;
    return { club: c.id, share, fee, kind, buy: kind === 'none' ? null : buy, apps: kind === 'obligation' ? 15 : null };
  });
  return { ok: true, offers };
}
const COMPAT = { TW: ['TW'], IV: ['IV'], LV: ['LV', 'LM'], RV: ['RV', 'RM'], DM: ['DM', 'ZM'], ZM: ['ZM', 'DM', 'OM'], OM: ['OM', 'ZM'], LA: ['LA', 'LM', 'RA'], RA: ['RA', 'RM', 'LA'], LM: ['LM', 'LA'], RM: ['RM', 'RA'], ST: ['ST'] };
const compatible = (want, have) => (COMPAT[want] || [want]).includes(have);

export function acceptLoanOut(world, id, o) {
  const p = world.players[id], me = userClub(world), to = world.clubs[o.club];
  me.squad = me.squad.filter((x) => x !== id); me.lineup = null;
  if (me.captain === id) me.captain = null;
  (me.loanedOut ||= []).push(id);
  to.squad.push(id); to.lineup = null;
  p.loan = { from: me.id, to: to.id, until: world.season, wageShare: o.share, buyOption: o.kind === 'option' ? o.buy : null, obligation: o.kind === 'obligation' ? { fee: o.buy, apps: o.apps } : null, out: true };
  p.loanBase = { ovr: p.ovr, apps: p.stats.apps, goals: p.stats.goals, at: stamp(world) };
  ensureTransferState(world);
  world.transfer.listed = world.transfer.listed.filter((x) => x !== id);
  if (o.fee) bookTransfer(me, o.fee, `Leihgebühr ${p.lastName}`, world);
  news(world, `🔁 ${p.firstName} ${p.lastName} wird bis Saisonende an ${to.name} verliehen (${Math.round(o.share * 100)} % Gehaltsübernahme${o.kind === 'option' ? `, Kaufoption ${money(o.buy)}` : o.kind === 'obligation' ? `, Kaufpflicht ab ${o.apps} Einsätzen: ${money(o.buy)}` : ''}).`);
}

export function loanedOut(world) { return (userClub(world).loanedOut || []).map((id) => world.players[id]).filter((p) => p && p.loan?.from === world.userClubId); }
export function loanedIn(world) { return userClub(world).squad.map((id) => world.players[id]).filter((p) => p?.loan && p.loan.to === world.userClubId); }

export function loanReport(world, p) {
  const b = p.loanBase || { ovr: p.ovr, apps: 0, goals: 0 };
  const apps = p.stats.apps - (p.loan?.out ? b.apps : 0), goals = p.stats.goals - (p.loan?.out ? b.goals : 0);
  const dev = p.ovr - b.ovr;
  const host = world.clubs[p.loan.to];
  const grade = apps >= world.week * 0.6 ? 'Stammspieler' : apps >= world.week * 0.3 ? 'Rotationsspieler' : apps > 0 ? 'Joker' : 'kaum Einsätze';
  return { apps, goals, dev, grade, host, text: `${p.lastName} bei ${host.short}: ${apps} Spiele, ${goals} Tore, ${grade}, Entwicklung ${dev >= 0 ? '+' : ''}${dev}${p.stats.rating ? `, Ø Note ${p.stats.rating.toFixed(1)}` : ''}.` };
}

export function weeklyLoans(world) {
  const me = userClub(world); if (!me) return;
  const outs = loanedOut(world);
  if (world.week % 4 === 0 && world.week > 0) {
    const lines = [...outs, ...loanedIn(world)].map((p) => (p.loan.out ? '➡️ ' : '⬅️ ') + loanReport(world, p).text);
    if (lines.length) news(world, `📝 Leihberichte: ${lines.join(' ')}`);
  }
}

// before the season-end loop: options and obligations decide where a loaned player plays next season
export function seasonLoanDecisions(world, rng) {
  const me = userClub(world); if (!me) return;
  for (const p of loanedOut(world)) {
    const host = world.clubs[p.loan.to], r = loanReport(world, p);
    let buy = null;
    if (p.loan.obligation && r.apps >= p.loan.obligation.apps) buy = { fee: p.loan.obligation.fee, why: `Kaufpflicht greift (${r.apps} Einsätze)` };
    else if (p.loan.buyOption && r.apps >= 10 && host.budget >= p.loan.buyOption && rng.chance(0.65)) buy = { fee: p.loan.buyOption, why: 'Kaufoption gezogen' };
    if (!buy) continue;
    me.loanedOut = (me.loanedOut || []).filter((x) => x !== p.id);
    bookTransfer(me, buy.fee, `Verkauf ${p.lastName} (${buy.why})`, world);
    bookTransfer(host, -buy.fee, `Kauf ${p.lastName}`, null);
    (p.moves ||= []).push({ season: world.season, week: world.week, from: me.short, to: host.short, fee: buy.fee });
    p.clubId = host.id; p.loan = null; p.contract = Math.max(p.contract, 3);
    news(world, `💶 ${host.name}: ${buy.why} – ${p.firstName} ${p.lastName} wechselt fest für ${money(buy.fee)}.`);
  }
  for (const p of loanedIn(world)) {
    if (!p.loan.obligation || p.stats.apps < p.loan.obligation.apps) continue;
    const from = world.clubs[p.loan.from];
    from.loanedOut = (from.loanedOut || []).filter((x) => x !== p.id);
    bookTransfer(me, -p.loan.obligation.fee, `Kaufpflicht ${p.lastName}`, world);
    bookTransfer(from, p.loan.obligation.fee, `Verkauf ${p.lastName}`, null);
    p.clubId = me.id; p.loan = null; p.contract = Math.max(p.contract, 3);
    news(world, `📜 Kaufpflicht: ${p.firstName} ${p.lastName} hat ${p.stats.apps} Einsätze – er gehört jetzt fest zu ${me.name}.`);
  }
}
