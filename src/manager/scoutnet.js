// Scouting network (v0.9): hire scouts, send them to regions of the world with a search focus
// (position, max. age). They raise the knowledge of players there week by week, deliver reports with
// their best finds and — in regions outside the big leagues — discover unknown talents that can be
// signed as free agents.
import { genderOk, feminize, userIsW, wScale } from './gender.js';
import { clamp } from '../core/rng.js';
import { generatePlayer, marketValue } from '../data/generator.js';
import { NATIONS } from '../data/names.js';
import { news, ensureTransferState } from './transfers.js';
import { staffQ } from './staff.js';
import { taskEvent } from './progress.js';

export const REGIONS = {
  DE: { name: 'Deutschland', nations: ['GER', 'AUT', 'SUI'], leagues: ['de1', 'de2', 'de3'] },
  EN: { name: 'Britische Inseln', nations: ['ENG', 'SCO', 'WAL', 'IRL', 'NIR'], leagues: ['en1', 'en2'] },
  ES: { name: 'Spanien & Portugal', nations: ['ESP', 'POR'], leagues: ['es1'] },
  IT: { name: 'Italien', nations: ['ITA'], leagues: ['it1'] },
  FR: { name: 'Frankreich & Benelux', nations: ['FRA', 'BEL', 'NED', 'LUX'], leagues: ['fr1'] },
  NO: { name: 'Skandinavien', nations: ['DEN', 'SWE', 'NOR', 'FIN', 'ISL'], leagues: [], exotic: true },
  OST: { name: 'Osteuropa & Balkan', nations: ['POL', 'CRO', 'SRB', 'UKR', 'CZE', 'SVK', 'SVN', 'HUN', 'ROU', 'BIH', 'ALB', 'GEO', 'KOS', 'MKD', 'MNE', 'BUL', 'TUR', 'GRE'], leagues: [], exotic: true },
  SA: { name: 'Südamerika', nations: ['BRA', 'ARG', 'URU', 'COL', 'ECU', 'PAR', 'CHI', 'PER', 'VEN'], leagues: [], exotic: true },
  AF: { name: 'Afrika', nations: ['SEN', 'CIV', 'NGA', 'GHA', 'CMR', 'MAR', 'ALG', 'TUN', 'EGY', 'MLI', 'GUI', 'COD', 'BFA'], leagues: [], exotic: true },
  AS: { name: 'Asien & Nordamerika', nations: ['JPN', 'KOR', 'AUS', 'USA', 'CAN', 'MEX', 'IRN', 'KSA'], leagues: [], exotic: true },
};
const FIRST = ['Heiko', 'Rainer', 'Bruno', 'Carlos', 'Javier', 'Pierre', 'Sven', 'Tomasz', 'Kenji', 'Moussa', 'Luca', 'Rui'];
const LAST = ['Gerland', 'Möller', 'Albers', 'Duarte', 'Ortega', 'Laurent', 'Nyberg', 'Kowalski', 'Tanaka', 'Diallo', 'Bianchi', 'Costa'];

export function ensureNet(world) {
  world.scoutNet ||= { scouts: [], finds: [], nextId: 1 };
  return world.scoutNet;
}
export const maxNetScouts = (world) => 2 + Math.floor((world.clubs[world.userClubId].facilities?.youth ?? 2) / 2) + (staffQ(world, 'scout') >= 4 ? 1 : 0);

export function scoutMarket(world, rng) {
  return [2, 3, 4].map((q) => ({ name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`, quality: clamp(q + (rng.chance(0.2) ? 1 : 0), 1, 5), wage: q * q * 30000 + 40000, fee: q * q * 25000 }));
}
export function hireNetScout(world, cand) {
  const N = ensureNet(world), club = world.clubs[world.userClubId];
  if (N.scouts.length >= maxNetScouts(world)) return { ok: false, msg: 'Mehr Scouts erlaubt dein Nachwuchszentrum nicht.' };
  if (club.budget < cand.fee) return { ok: false, msg: 'Nicht genug Budget.' };
  club.budget -= cand.fee;
  N.scouts.push({ id: N.nextId++, name: cand.name, quality: cand.quality, wage: cand.wage, region: null, focus: { pos: 'ALLE', maxAge: 23 }, weeks: 0 });
  return { ok: true };
}
export function fireNetScout(world, id) { const N = ensureNet(world); N.scouts = N.scouts.filter((s) => s.id !== id); }
export function sendScout(world, id, region, focus) {
  const s = ensureNet(world).scouts.find((x) => x.id === id); if (!s) return;
  taskEvent(world, 'scout');
  s.region = region; s.focus = { ...s.focus, ...focus }; s.weeks = 0;
}

function inRegion(world, p, R) {
  if (R.nations.includes(p.nation)) return true;
  return p.clubId != null && R.leagues.includes(world.clubs[p.clubId]?.leagueId);
}

// a talent from abroad that is not part of any club in the game yet
function discover(world, rng, s, R) {
  const nat = rng.pick(R.nations);
  const pos = s.focus.pos !== 'ALLE' ? s.focus.pos : rng.pick(['ST', 'LA', 'RA', 'OM', 'ZM', 'DM', 'IV', 'LV', 'RV', 'TW']);
  const age = rng.int(16, Math.min(21, s.focus.maxAge || 21));
  const p = generatePlayer(rng, world.nextPlayerId++, pos, Math.round(clamp(46 + s.quality * 3 + rng.normal(0, 5) + (age - 16) * 2, 40, 72)), age, 'DE', 50);
  const pool = NATIONS[nat] || EXTRA_NAMES[nat] || NATIONS[NAME_LIKE[nat] || 'ENG'];
  p.firstName = rng.pick(pool.first); p.lastName = rng.pick(pool.last);
  if (userIsW(world)) feminize(rng, p);
  p.pot = clamp(Math.round(p.ovr + 14 + s.quality * 2.5 + rng.normal(0, 5)), p.ovr + 6, 93);
  p.nation = nat; p.clubId = null; p.contract = 0; p.faSince = world.season; p.discovered = true; p.wage = 15000;
  p.value = Math.round(marketValue(p.ovr, p.age, p.pot) * wScale(p));
  world.players[p.id] = p;
  ensureTransferState(world);
  world.freeAgents.push(p.id);
  world.scouting.knowledge[p.id] = 100;
  return p;
}

const EXTRA_NAMES = {
  JPN: { first: ['Takumi', 'Kaoru', 'Ritsu', 'Hiroki', 'Daichi', 'Yuto', 'Kento', 'Sota'], last: ['Sato', 'Suzuki', 'Takahashi', 'Ito', 'Watanabe', 'Nakamura', 'Kobayashi', 'Yamamoto'] },
  KOR: { first: ['Min-jae', 'Hee-chan', 'Kang-in', 'Seung-ho', 'Jun-ho', 'Ji-sung'], last: ['Kim', 'Lee', 'Park', 'Hwang', 'Son', 'Jeong'] },
};
const NAME_LIKE = { URU: 'ARG', COL: 'ESP', ECU: 'ESP', PAR: 'ARG', CHI: 'ESP', PER: 'ESP', VEN: 'ESP', MEX: 'ESP', CIV: 'SEN', CMR: 'SEN', MLI: 'SEN', GUI: 'SEN', BFA: 'SEN', COD: 'NGA', GHA: 'NGA', MAR: 'FRA', ALG: 'FRA', TUN: 'FRA', EGY: 'FRA', SWE: 'DEN', NOR: 'DEN', FIN: 'DEN', ISL: 'DEN', SRB: 'CRO', BIH: 'CRO', SVN: 'CRO', MNE: 'CRO', MKD: 'CRO', ALB: 'CRO', KOS: 'CRO', UKR: 'POL', CZE: 'POL', SVK: 'POL', HUN: 'POL', ROU: 'POL', GEO: 'POL', BUL: 'POL', TUR: 'POL', GRE: 'POL', USA: 'ENG', CAN: 'ENG', AUS: 'ENG', IRN: 'FRA', KSA: 'FRA' };

export function weeklyNet(world, rng) {
  const N = world.scoutNet; if (!N?.scouts.length) return;
  ensureTransferState(world);
  const K = world.scouting.knowledge, chief = staffQ(world, 'scout');
  const all = Object.values(world.players);
  for (const s of N.scouts) {
    if (!s.region) continue;
    const R = REGIONS[s.region]; s.weeks++;
    const gain = 6 + s.quality * 3 + chief * 1.5;
    const fits = (p) => p.clubId !== world.userClubId && !p.youthOf && genderOk(world.clubs[world.userClubId], p) && (s.focus.pos === 'ALLE' || p.pos === s.focus.pos) && p.age <= (s.focus.maxAge || 40) && inRegion(world, p, R);
    const pool = all.filter(fits);
    for (let i = 0; i < Math.min(pool.length, 12 + s.quality * 4); i++) { const p = rng.pick(pool); K[p.id] = clamp((K[p.id] ?? 15) + gain, 0, 100); }
    // report every 3 weeks: the best (fully scouted) players that match the focus
    if (s.weeks % 3 === 0) {
      const best = pool.map((p) => { const ex = K[p.id] >= 100 || rng.chance(0.2 + s.quality * 0.08); if (ex) K[p.id] = 100; return ex ? p : null; }).filter(Boolean)
        .sort((a, b) => (b.ovr + (b.pot - b.ovr) * 0.5) - (a.ovr + (a.pot - a.ovr) * 0.5)).slice(0, 3);
      let found = null;
      if (R.exotic && rng.chance(0.18 + s.quality * 0.07)) found = discover(world, rng, s, R);
      const list = [...(found ? [found] : []), ...best];
      if (!list.length) continue;
      N.finds.unshift({ season: world.season, week: world.week, scout: s.name, region: R.name, ids: list.map((p) => p.id), discovered: found?.id ?? null });
      N.finds = N.finds.slice(0, 20);
      news(world, `🌍 Scout ${s.name} (${R.name}): ${found ? `Geheimtipp entdeckt – ${found.firstName} ${found.lastName} (${found.pos}, ${found.age}, ${found.nation}), Potenzial ${found.pot}, vereinslos! ` : ''}${best.length ? `Empfiehlt ${best.map((p) => `${p.lastName} (${p.pos}, ${p.age}, ${p.ovr}/${p.pot})`).join(', ')}.` : ''}`);
    }
  }
}
