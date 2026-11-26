// v7.0 Schiedsrichter & VAR: a pool of referees with their own character (strict or lenient, calm or
// card-happy), assigned to every match. Controversial decisions against your team can be appealed at the
// federation – sometimes it works, sometimes it costs a fine.
import { clamp } from '../core/rng.js';
import { news } from './transfers.js';
import { moodChange } from './events.js';

const FIRST = ['Felix', 'Daniel', 'Deniz', 'Tobias', 'Sascha', 'Marco', 'Patrick', 'Bastian', 'Robert', 'Harm', 'Christian', 'Benjamin', 'Sven', 'Frank', 'Matthias', 'Florian', 'Timo', 'Michael', 'Anthony', 'Michael', 'Jesús', 'Daniele', 'Clément', 'Danny'];
const LAST = ['Brych', 'Siebert', 'Aytekin', 'Stieler', 'Stegemann', 'Fritz', 'Ittrich', 'Cortus', 'Hartmann', 'Osmers', 'Dingert', 'Brand', 'Jablonski', 'Willenborg', 'Schlager', 'Badstübner', 'Gerach', 'Taylor', 'Oliver', 'Gil Manzano', 'Orsato', 'Turpin', 'Makkelie', 'Zwayer'];
export const REF_STYLE = (r) => (r.strict >= 1.25 ? 'Kartenfreund' : r.strict >= 1.08 ? 'streng' : r.strict <= 0.8 ? 'lässt laufen' : 'ausgeglichen');

export function ensureRefs(world) {
  if (world.refs?.list?.length) return world.refs;
  const list = [];
  for (let i = 0; i < 24; i++) {
    const h = (k) => { let x = ((i + 1) * 2654435761 + k * 40503) >>> 0; x ^= x >>> 15; return (x % 1000) / 1000; };
    list.push({ id: i, name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`, strict: Math.round((0.7 + h(1) * 0.75) * 100) / 100, varFreq: Math.round((0.6 + h(2) * 0.9) * 100) / 100, games: 0, yellow: 0, red: 0, pens: 0, form: 0 });
  }
  world.refs = { list, appeals: [] };
  return world.refs;
}
/** referee of a fixture (deterministic, so the matchday screen can show him in advance) */
export function refFor(world, m) {
  const R = ensureRefs(world).list;
  return R[Math.abs(m.h * 7 + m.a * 13 + (m.week ?? world.week) * 3 + world.season) % R.length];
}
export function bookRef(world, m, events) {
  const r = refFor(world, m); r.games++;
  for (const e of events || []) { if (e.type === 'yellow') r.yellow++; if (e.type === 'red') r.red++; }
  return r;
}

/** after a match of the user's club: was there something to complain about? */
export function checkControversy(world, m, events, side, rng, pushInbox) {
  const r = refFor(world, m);
  const mine = (e) => e.side === side;
  const red = (events || []).find((e) => e.type === 'red' && mine(e));
  const noGoal = (events || []).find((e) => e.type === 'nogoal' && mine(e));
  const gf = side === 'h' ? m.hg : m.ag, ga = side === 'h' ? m.ag : m.hg;
  const close = ga - gf === 1 && r.strict >= 1.15 && rng.chance(0.35);
  if (!red && !noGoal && !close) return null;
  const p = red ? world.players[red.player] : null;
  const what = red ? `die Rote Karte gegen ${p?.lastName || 'deinen Spieler'}` : noGoal ? 'das aberkannte Tor' : 'mehrere strittige Pfiffe';
  pushInbox({ area: 'press', from: 'assistant', title: `Schiedsrichter ${r.name} (${REF_STYLE(r)}) – ${what}. Beschwerde beim Verband einlegen?`, text: 'Erfolgsaussicht etwa ein Drittel. Bei Ablehnung droht eine Geldstrafe.',
    key: `ref-${world.season}-${world.week}`, label: 'Beschwerde einlegen',
    run: (rng2) => appeal(world, { ref: r.id, player: red?.player ?? null, kind: red ? 'red' : noGoal ? 'goal' : 'calls' }, rng2 || rng) });
  return r;
}

export function appeal(world, a, rng) {
  const R = ensureRefs(world), r = R.list[a.ref], club = world.clubs[world.userClubId];
  const ok = rng.chance(a.kind === 'red' ? 0.38 : a.kind === 'goal' ? 0.28 : 0.2);
  R.appeals.unshift({ season: world.season, week: world.week, ref: r.name, kind: a.kind, ok });
  R.appeals = R.appeals.slice(0, 20);
  if (ok) {
    if (a.player != null && world.players[a.player]) world.players[a.player].suspension = Math.max(0, world.players[a.player].suspension - 1);
    r.form -= 1; moodChange(world, 1, 2);
    for (const id of club.squad) { const p = world.players[id]; p.morale = clamp(p.morale + 2, 0, 99); }
    news(world, `⚖️ Beschwerde erfolgreich: Der Verband gibt ${club.short} recht – ${a.kind === 'red' ? 'die Sperre wird verkürzt' : 'der Schiedsrichter wird eine Woche nicht angesetzt'}.`);
    return { ok: true, msg: 'Der Verband gibt dir recht!' };
  }
  const fine = Math.round(((club.rep || 60) * 1200 * (club.women ? 0.1 : 1)) / 1e3) * 1e3;
  club.budget -= fine; moodChange(world, -1, 0);
  news(world, `⚖️ Beschwerde abgewiesen: ${club.short} muss ${fine.toLocaleString('de-DE')} € Strafe zahlen.`);
  return { ok: true, msg: `Abgewiesen – ${fine.toLocaleString('de-DE')} € Strafe` };
}
