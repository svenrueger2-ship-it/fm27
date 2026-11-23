// Youth academy (U19) for the user's club and realistic market values for all players.
import { rollStyleTalent } from '../data/styles.js';
import { clamp } from '../core/rng.js';
import { generatePlayer, marketValue } from '../data/generator.js';
import { trainPlayer } from './training.js';
import { skillRank } from './progress.js';
import { ensureStats } from './achievements.js';

const YPOS = ['TW', 'IV', 'IV', 'LV', 'RV', 'DM', 'ZM', 'ZM', 'OM', 'LA', 'RA', 'ST', 'ST'];

export function youthPlayers(world) {
  return (world.youth || []).map((id) => world.players[id]).filter(Boolean);
}

function makeYouth(world, rng, club, age) {
  const lvl = club.facilities?.youth ?? 2;
  const country = world.leagues.find((l) => l.id === club.leagueId).country;
  const y = generatePlayer(rng, world.nextPlayerId++, rng.pick(YPOS), Math.round(clamp(27 + club.rep * 0.14 + lvl * 1.6 + (age - 15) * 2.5 + rng.normal(0, 4), 26, 62)), age, country, club.rep);
  y.pot = clamp(Math.round(44 + club.rep * 0.18 + lvl * 2 + rng.normal(0, 6) + (rng.chance(0.03 + lvl * 0.015) ? rng.int(6, 12) : 0)), y.ovr + 4, 94);
  y.clubId = null; y.youthOf = club.id; y.contract = 0; y.wage = 0; y.prog = {}; y.loan = null; y.releaseClause = null; y.career = []; y.moves = [];
  y.value = marketValue(y.ovr, y.age, y.pot);
  rollStyleTalent(y, rng);
  world.players[y.id] = y;
  return y;
}

export function ensureYouth(world, rng) {
  if (world.youth) return world.youth;
  const club = world.clubs[world.userClubId];
  world.youth = [];
  for (let i = 0; i < 12; i++) world.youth.push(makeYouth(world, rng, club, rng.int(15, 18)).id);
  world.youthLeague = null;
  return world.youth;
}

// weekly development of the U19 using the club's training setup and academy level
export function weeklyYouth(world, rng) {
  if (!world.youth) return;
  const club = world.clubs[world.userClubId];
  const lvl = club.facilities?.youth ?? 2;
  const fake = { ...club, facilities: { ...club.facilities, training: Math.max(1, lvl - 1) }, coachFactor: 0.55 };
  for (const p of youthPlayers(world)) { if (p.styleTalent === undefined) rollStyleTalent(p, rng); p.playedThisWeek = true; trainPlayer(p, fake, rng, skillRank(world, 'jugend')); p.value = marketValue(p.ovr, p.age, p.pot); }
}

export function promoteYouth(world, id) {
  const club = world.clubs[world.userClubId], p = world.players[id];
  world.youth = world.youth.filter((x) => x !== id);
  p.youthOf = null; p.clubId = club.id; p.contract = 3; p.wage = Math.round((18000 + p.ovr * 900) / 1000) * 1000;
  const used = new Set(club.squad.map((x) => world.players[x].number)); let n = 30; while (used.has(n)) n++; p.number = n;
  club.squad.push(id); club.lineup = null;
  ensureStats(world).youthPromoted++;
  world.news.unshift({ season: world.season, week: world.week + 1, text: `🌱 ${p.firstName} ${p.lastName} (${p.age}) wird aus der U19 in den Profikader hochgezogen.` });
}

export function releaseYouth(world, id) {
  world.youth = world.youth.filter((x) => x !== id);
  delete world.players[id];
}

// season end: ageing, U19 league placement, players who are too old must leave, new intake
export function seasonYouth(world, rng) {
  if (!world.youth) return null;
  const club = world.clubs[world.userClubId], lvl = club.facilities?.youth ?? 2;
  const ys = youthPlayers(world);
  const str = ys.length ? ys.map((p) => p.ovr).sort((a, b) => b - a).slice(0, 11).reduce((s, x) => s + x, 0) / Math.min(11, ys.length) : 30;
  const league = world.leagues.find((l) => l.id === club.leagueId);
  const field = league.clubIds.map((id) => ({ id, s: id === club.id ? str : 24 + world.clubs[id].rep * 0.25 + (world.clubs[id].facilities?.youth ?? 2) * 2 + rng.normal(0, 3) }));
  field.sort((a, b) => b.s - a.s);
  const rank = field.findIndex((f) => f.id === club.id) + 1;
  world.youthLeague = { season: world.season, rank, of: field.length, name: `U19-${league.country === 'DE' ? 'Bundesliga' : 'Liga'}` };
  const gone = [];
  for (const p of ys) { p.age++; if (p.age >= 20) { gone.push(p); releaseYouth(world, p.id); } }
  const intake = [];
  for (let i = 0; i < 2 + Math.ceil(lvl / 2); i++) { const y = makeYouth(world, rng, club, 15); world.youth.push(y.id); intake.push(y); }
  world.news.unshift({ season: world.season + 1, week: 0, text: `🌱 U19: Platz ${rank} in der ${world.youthLeague.name}. Neuer Jahrgang: ${intake.map((y) => `${y.lastName} (${y.pos})`).join(', ')}.${gone.length ? ` Zu alt für die U19 und verabschiedet: ${gone.map((p) => p.lastName).join(', ')}.` : ''}` });
  return { rank, intake: intake.length, gone: gone.length };
}

// ------------------------------------------------------------------ market values
const LEAGUE_VALUE = { en1: 1.45, es1: 1.12, it1: 1.05, de1: 1.0, fr1: 0.85, en2: 0.5, de2: 0.38, de3: 0.16 };
const POS_VALUE = { TW: 0.72, IV: 0.95, LV: 0.92, RV: 0.92, DM: 0.98, ZM: 1.0, LM: 1.0, RM: 1.0, OM: 1.08, LA: 1.12, RA: 1.12, ST: 1.15 };
export function playerValue(world, p) {
  let v = marketValue(p.ovr, p.age, p.pot);
  const club = p.clubId != null ? world.clubs[p.clubId] : null;
  v *= club ? LEAGUE_VALUE[club.leagueId] ?? 0.8 : 0.6;
  v *= POS_VALUE[p.pos] ?? 1;
  if (club) v *= p.contract <= 0 ? 0.3 : p.contract === 1 ? 0.6 : p.contract === 2 ? 0.88 : 1;
  if (p.stats?.apps >= 5) v *= clamp(0.85 + ((p.stats.rating || 6.5) - 6.5) * 0.25 + (p.stats.goals + p.stats.assists * 0.6) / Math.max(10, p.stats.apps) * 0.6, 0.75, 1.4);
  if (p.injury > 6) v *= 0.85;
  if (v > 8e7) v = 8e7 * Math.pow(v / 8e7, 0.6); // the very top of the market is flatter
  return v > 1e6 ? Math.round(v / 1e5) * 1e5 : Math.round(v / 1e4) * 1e4;
}
export function updateValues(world) {
  for (const id in world.players) { const p = world.players[id]; if (!p.youthOf) p.value = playerValue(world, p); }
}
