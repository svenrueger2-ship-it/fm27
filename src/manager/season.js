import { weeklySkills, gainXp } from './progress.js';
// Season logic: fixtures, tables, quick simulation of AI matches, week/season progression.
import { RNG, clamp } from '../core/rng.js';
import { teamStrength, ensureLineup, FORMATIONS } from '../match/tactics.js';
import { computeOverall, OUTFIELD_ATTRS, GK_ATTRS, POS_WEIGHTS } from '../data/attributes.js';
import { generatePlayer, marketValue } from '../data/generator.js';
import { weeklyFinance, seasonFinanceClose } from './economy.js';
import { weeklyTraining, recoverInjury } from './training.js';
import { weeklyTransfers, seasonTransfers } from './transfers.js';
import { rollEvent, moodAfterMatch, sponsorSeasonClose, ensureMood, moodChange } from './events.js';
import { createCups, weeklyCups, catchUpCups } from './cups.js';
import { ensureYouth, weeklyYouth, seasonYouth, updateValues } from './youth.js';
import { weeklyStaff } from './staff.js';
import { payBonuses } from './agents.js';
import { statMatch, checkAchievements, seasonChallenge } from './achievements.js';
import { weeklyKabine, seasonKabine } from './kabine.js';
import { mediaAfterMatch, weeklyMedia, seasonRecords, addTitleToLegends } from './media.js';
import { weeklyBiz, seasonBiz, applyLicence } from './clubbiz.js';
import { weeklyCareer, careerSeasonEnd } from './career.js';
import { intlBreak, playTournament, ensureIntl } from './nationals.js';
import { weeklyNet } from './scoutnet.js';
import { weeklyPlayers, weeklyLoans, seasonLoanDecisions } from './players.js';
import { ensureClubAI, weeklyCoaches, tickBounce, coachEdge, seasonCoaches } from './clubAI.js';
import { coachDecides, coachTrainingFactor, coachAfterMatch, isDirector, ensureCoach } from './director.js';

export function buildFixtures(clubIds, rng) {
  const ids = [...clubIds];
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  if (ids.length % 2) ids.push(null);
  const n = ids.length, rounds = n - 1, half = n / 2;
  const first = [];
  let arr = [...ids];
  for (let r = 0; r < rounds; r++) {
    const md = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a == null || b == null) continue;
      md.push(r % 2 === 0 ? { h: a, a: b, hg: null, ag: null } : { h: b, a: a, hg: null, ag: null });
    }
    first.push(md);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  const second = first.map((md) => md.map((m) => ({ h: m.a, a: m.h, hg: null, ag: null })));
  return [...first, ...second];
}

export function computeTable(league) {
  const rows = {};
  for (const id of league.clubIds) rows[id] = { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
  for (const md of league.fixtures) for (const m of md) {
    if (m.hg == null) continue;
    const H = rows[m.h], A = rows[m.a];
    H.p++; A.p++; H.gf += m.hg; H.ga += m.ag; A.gf += m.ag; A.ga += m.hg;
    if (m.hg > m.ag) { H.w++; A.l++; H.pts += 3; H.form.push('S'); A.form.push('N'); }
    else if (m.hg < m.ag) { A.w++; H.l++; A.pts += 3; A.form.push('S'); H.form.push('N'); }
    else { H.d++; A.d++; H.pts++; A.pts++; H.form.push('U'); A.form.push('U'); }
  }
  for (const [id, d] of Object.entries(league.deductions || {})) if (rows[id]) { rows[id].pts -= d; rows[id].deduction = d; }
  return Object.values(rows).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

export function userFixture(world) {
  const club = world.clubs[world.userClubId];
  const league = world.leagues.find((l) => l.id === club.leagueId);
  const md = league.fixtures[world.week];
  if (!md) return null;
  return md.find((m) => m.h === club.id || m.a === club.id) || null;
}

export function userLeague(world) {
  return world.leagues.find((l) => l.id === world.clubs[world.userClubId].leagueId);
}

function pickScorer(rng, ids, players, slots) {
  return rng.weighted(ids.map((id, i) => ({ id, pos: slots[i][0] })), (e) => {
    const p = players[e.id];
    const base = { ST: 10, LA: 6, RA: 6, OM: 5, LM: 3, RM: 3, ZM: 2.2, DM: 1, IV: 0.8, LV: 0.8, RV: 0.8, TW: 0 }[e.pos] ?? 1;
    return base * (p.attrs.abschluss / 60) ** 2;
  }).id;
}

// Statistical simulation used for all non-3D matches (and the "Sofort" option of AI matches)
export function quickSim(world, m, rng) {
  const H = world.clubs[m.h], A = world.clubs[m.a];
  const prepE = (c) => (c.matchPrep && c.matchPrep.week === world.week ? c.matchPrep.prep * 0.5 + c.matchPrep.setpiece * 0.25 : 0) + (c.spirit != null ? (c.spirit - 60) / 25 : 0);
  const sh = teamStrength(H, world.players) + coachEdge(world, H) + prepE(H), sa = teamStrength(A, world.players) + coachEdge(world, A) + prepE(A);
  const mh = (H.tactic.mentality - 0.5) * 0.4, ma = (A.tactic.mentality - 0.5) * 0.4;
  const lh = clamp(1.45 * Math.exp((sh - sa) * 0.075) * (1 + mh) * (1 + ma * 0.5), 0.15, 5);
  const la = clamp(1.12 * Math.exp((sa - sh) * 0.075) * (1 + ma) * (1 + mh * 0.5), 0.1, 5);
  m.hg = rng.poisson(lh); m.ag = rng.poisson(la);
  const events = [];
  for (const [club, goals, side] of [[H, m.hg, 'h'], [A, m.ag, 'a']]) {
    const L = club.lineup; const slots = FORMATIONS[L.formation];
    for (let g = 0; g < goals; g++) {
      const scorer = pickScorer(rng, L.xi, world.players, slots);
      let assist = null;
      if (rng.chance(0.72)) { assist = rng.pick(L.xi.filter((id) => id !== scorer && world.players[id].pos !== 'TW')); }
      events.push({ type: 'goal', side, player: scorer, assist, minute: rng.int(1, 90) });
    }
    L.xi.forEach((id) => {
      if (rng.chance(0.11)) events.push({ type: 'yellow', side, player: id, minute: rng.int(1, 90) });
      if (rng.chance(0.012)) events.push({ type: 'injury', side, player: id, minute: rng.int(1, 90), weeks: rng.int(1, 6) });
    });
  }
  m.goals = events.filter((e) => e.type === 'goal').map((e) => ({ side: e.side, min: e.minute })).sort((a, b) => a.min - b.min);
  applyMatchResult(world, m, { events, minutes: null, fitness: null }, rng);
  return m;
}

// Applies results to player database (shared by 3D engine & quick sim).
export function applyMatchResult(world, m, result, rng) {
  const H = world.clubs[m.h], A = world.clubs[m.a];
  for (const [club, side] of [[H, 'h'], [A, 'a']]) {
    const xi = club.lineup.xi;
    const played = result.played?.[side] || xi;
    for (const id of played) {
      const p = world.players[id]; if (!p) continue;
      p.stats.apps++;
      p.playedThisWeek = true;
      const fit = result.fitness?.[id];
      p.fitness = clamp(fit != null ? fit : p.fitness - rng.range(18, 30) * (1.3 - p.attrs.ausdauer / 140), 25, 100);
    }
    for (const id of club.squad) if (world.players[id].suspension > 0 && !played.includes(id)) world.players[id].suspension--;
  }
  for (const e of result.events) {
    const p = world.players[e.player]; if (!p) continue;
    if (e.type === 'goal' && !e.own) { p.stats.goals++; if (e.assist && world.players[e.assist]) world.players[e.assist].stats.assists++; }
    if (e.type === 'yellow') { p.stats.yellow++; p.yellow++; if (p.yellow >= 5) { p.suspension = 1; p.yellow = 0; } }
    if (e.type === 'red') { p.stats.red++; p.suspension = 2; }
    if (e.type === 'injury') p.injury = Math.max(p.injury, e.weeks || 1);
  }
  // performance bonuses agreed in contracts (v2.0)
  if (world.userClubId === H.id || world.userClubId === A.id) {
    const uc = world.clubs[world.userClubId], side = uc.id === H.id ? 'h' : 'a';
    payBonuses(world, uc, result.played?.[side] || uc.lineup?.xi || [], result.events);
    if (!m.friendly) statMatch(world, side === 'h' ? m.hg : m.ag, side === 'h' ? m.ag : m.hg);
  }
  // morale / form
  const diff = m.hg - m.ag;
  if (world.userClubId === H.id || world.userClubId === A.id) {
    const uc = world.clubs[world.userClubId], d = uc.id === H.id ? diff : -diff;
    uc.formRun = d > 0 ? Math.max(1, (uc.formRun || 0) + 1) : d < 0 ? Math.min(-1, (uc.formRun || 0) - 1) : 0;
    const opp = uc.id === H.id ? A : H;
    moodAfterMatch(world, d, teamStrength(uc, world.players) - teamStrength(opp, world.players));
    mediaAfterMatch(world, { ...m, events: result.events }, rng);
    if (!m.cup) coachAfterMatch(world, d > 0 ? 3 : d === 0 ? 1 : 0);
  }
  for (const [club, d] of [[H, diff], [A, -diff]]) {
    for (const id of club.squad) {
      const p = world.players[id];
      const inXI = club.lineup.xi.includes(id);
      p.morale = clamp(p.morale + (d > 0 ? 3 : d < 0 ? -3 : 0) + (inXI ? 1 : -1), 10, 99);
      if (inXI) p.form = clamp(p.form + (d > 0 ? 4 : d < 0 ? -4 : 0) + rng.int(-3, 3), 10, 99);
    }
  }
}

// Plays every remaining fixture of the current week (except optionally the user's 3D match) and advances.
export function finishWeek(world, rng) {
  ensureClubAI(world, rng);
  if (!world.cups) { createCups(world, rng); catchUpCups(world, rng, quickSim); }
  if (isDirector(world)) { ensureCoach(world, rng); coachDecides(world); world.clubs[world.userClubId].coachFactor = coachTrainingFactor(world, world.clubs[world.userClubId]); }
  weeklyCups(world, rng, quickSim);
  for (const league of world.leagues) {
    const md = league.fixtures[world.week];
    if (!md) continue;
    for (const m of md) {
      if (m.hg != null) continue;
      ensureLineup(world.clubs[m.h], world.players); ensureLineup(world.clubs[m.a], world.players);
      quickSim(world, m, rng);
    }
  }
  // weekly recovery
  for (const id in world.players) {
    const p = world.players[id];
    p.fitness = clamp(p.fitness + 22 + p.attrs.ausdauer * 0.08, 0, 100);
    recoverInjury(p, world.clubs[p.clubId], rng);
  }
  // finances & training for every club
  for (const league of world.leagues) {
    const md = league.fixtures[world.week];
    if (!md) continue;
    const table = computeTable(league);
    for (const id of league.clubIds) {
      const club = world.clubs[id];
      const rank = table.findIndex((r) => r.id === id) + 1;
      weeklyFinance(world, club, league, { homeGame: md.some((m) => m.h === id), rank });
      const rep = weeklyTraining(world, club, rng);
      if (id === world.userClubId) world.trainingReport = { season: world.season, week: world.week + 1, items: rep };
    }
  }
  weeklyTransfers(world, rng);
  ensureIntl(world); intlBreak(world, rng);
  if (world.userClubId != null) weeklyNet(world, rng);
  if (world.userClubId != null) {
    ensureYouth(world, rng); weeklyYouth(world, rng); rollEvent(world, rng);
    const fam = world.clubs[world.userClubId].stadium.layout?.family || 0; if (fam && rng.chance(fam * 0.3)) moodChange(world, 0, 1); // family stand wins young fans
  }
  updateValues(world);
  weeklyCoaches(world, rng); tickBounce(world);
  world.week++;
  for (const c of Object.values(world.clubs)) if (c.id !== world.userClubId) c.lineup = null; // AI re-picks
  weeklyStaff(world, rng);
  if (world.userClubId != null) { weeklyPlayers(world, rng); weeklyLoans(world); weeklyCareer(world, rng); weeklyBiz(world, rng); weeklyMedia(world, rng); weeklyKabine(world, rng); weeklySkills(world); checkAchievements(world); }
}

export function seasonLength(world) {
  return Math.max(...world.leagues.map((l) => l.fixtures.length));
}

export function isUserSeasonOver(world) { return world.week >= userLeague(world).fixtures.length; }

function developPlayer(p, rng) {
  // growth happens weekly in training; here only ageing and a potential re-assessment
  p.age++;
  if (p.age >= 24) p.pot = Math.max(p.ovr, p.pot - rng.int(0, p.age >= 28 ? 3 : 1));
  else if (rng.chance(0.15)) p.pot = Math.min(97, p.pot + rng.int(1, 4)); // late bloomer
  p.ovr = computeOverall(p.attrs, p.pos);
  p.value = marketValue(p.ovr, p.age, p.pot);
}

// Promotion/relegation rules of the leagues linked in this game (season 2026/27).
// Bundesliga: 17th+18th down, 16th plays the relegation vs. 3rd of 2. Bundesliga. 2. Bundesliga: 1st+2nd up,
// 17th+18th down, 16th vs. 3rd of the 3. Liga. 3. Liga: 1st+2nd up (4 relegated to the Regionalliga – not modelled).
// Premier League: 3 down. Championship: 1st+2nd up, 3rd–6th play-offs for the third place.
export const PROMO_RULES = {
  de1: { down: 2, playoff: 'relegation' }, de2: { up: 2, down: 2, playoff: 'relegation' }, de3: { up: 2, playoff: 'relegation' },
  en1: { down: 3 }, en2: { up: 2, playoff: 'playoffs' },
};

// Statistical single match / two-legged tie incl. extra time and penalties (no away-goals rule).
function simGoals(world, h, a, rng, neutral = false) {
  const H = world.clubs[h], A = world.clubs[a];
  const sh = teamStrength(H, world.players), sa = teamStrength(A, world.players);
  const adv = neutral ? 1.28 : 1.45, dis = neutral ? 1.28 : 1.12;
  return [rng.poisson(clamp(adv * Math.exp((sh - sa) * 0.075), 0.15, 5)), rng.poisson(clamp(dis * Math.exp((sa - sh) * 0.075), 0.1, 5))];
}
export function simTie(world, first, second, rng, twoLegs) {
  for (const id of [first, second]) ensureLineup(world.clubs[id], world.players);
  const legs = [];
  let gA = 0, gB = 0; // goals of `first`, `second`
  if (twoLegs) {
    const [h1, a1] = simGoals(world, first, second, rng); legs.push({ h: first, a: second, hg: h1, ag: a1 });
    const [h2, a2] = simGoals(world, second, first, rng); legs.push({ h: second, a: first, hg: h2, ag: a2 });
    gA = h1 + a2; gB = a1 + h2;
  } else {
    const [h1, a1] = simGoals(world, first, second, rng, true); legs.push({ h: first, a: second, hg: h1, ag: a1 }); gA = h1; gB = a1;
  }
  let extra = '';
  if (gA === gB) {
    const [e1, e2] = simGoals(world, second, first, rng).map((g) => Math.round(g * 0.33));
    gB += e1; gA += e2; extra = ' n. V.';
    if (gA === gB) {
      const sa = teamStrength(world.clubs[first], world.players), sb = teamStrength(world.clubs[second], world.players);
      const aWins = rng.chance(clamp(0.5 + (sa - sb) * 0.01, 0.3, 0.7));
      const pw = 4 + rng.int(0, 1), pl = pw - 1 - rng.int(0, 1);
      extra = ` n. V., ${aWins ? pw : pl}:${aWins ? pl : pw} i. E.`;
      if (aWins) gA += 0.5; else gB += 0.5;
    }
  }
  const winner = gA > gB ? first : second, loser = winner === first ? second : first;
  const agg = `${Math.floor(gA)}:${Math.floor(gB)}`;
  const legsTxt = legs.map((l) => `${l.hg}:${l.ag}`).join(', ');
  return { first, second, legs, winner, loser, text: twoLegs ? `Gesamt ${agg}${extra} – ${legsTxt}` : `${agg}${extra}` };
}

// End of season: promotion/relegation, ageing, retirements, youth intake, new fixtures.
export function endSeason(world, rng) {
  // simulate all remaining fixtures of every league
  while (world.week < seasonLength(world)) finishWeek(world, rng);
  seasonLoanDecisions(world, rng);
  const tournament = playTournament(world, rng);
  const summary = { season: world.season, champions: {}, promoted: [], relegated: [], user: null, tournament: tournament ? { name: tournament.name, winner: tournament.winner, runnerUp: tournament.runnerUp, topScorer: tournament.topScorer } : null };
  const tables = {};
  for (const l of world.leagues) { tables[l.id] = computeTable(l); summary.champions[l.id] = tables[l.id][0].id; world.clubs[tables[l.id][0].id].stats.titles++; }
  for (const l of world.leagues) tables[l.id].forEach((r, i) => { summary.prizes = summary.prizes || {}; summary.prizes[r.id] = seasonFinanceClose(world, world.clubs[r.id], l, i + 1); });
  // club season records (Vereinshistorie)
  for (const l of world.leagues) tables[l.id].forEach((r, i) => {
    const c = world.clubs[r.id];
    (c.history ||= []).push({ season: world.season, league: l.name, tier: l.tier, rank: i + 1, of: tables[l.id].length, pts: r.pts, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, champion: i === 0 });
  });
  const ul = userLeague(world);
  summary.user = { league: ul.name, rank: tables[ul.id].findIndex((r) => r.id === world.userClubId) + 1 };
  const cupWins = (world.cups || []).filter((c) => c.winner === world.userClubId).map((c) => c.name);
  summary.career = careerSeasonEnd(world, rng, { rank: summary.user.rank, cupWins, tournament });
  seasonRecords(world, summary.user.rank, tables[ul.id][summary.user.rank - 1].pts);
  seasonKabine(world, world.career?.seasons?.slice(-1)[0]?.reached);
  if (summary.user.rank === 1) addTitleToLegends(world);
  for (let i = 0; i < cupWins.length; i++) addTitleToLegends(world);
  summary.sponsorNotes = sponsorSeasonClose(world, world.clubs[world.userClubId], summary.user.rank);
  summary.bizNotes = seasonBiz(world, summary.user.rank);
  for (const t of summary.bizNotes) world.news.unshift({ season: world.season + 1, week: 0, text: t });
  for (const t of summary.sponsorNotes) world.news.unshift({ season: world.season + 1, week: 0, text: `🤝 ${t}` });
  const md = ensureMood(world); md.board = Math.round(md.board * 0.7 + 18); md.fans = Math.round(md.fans * 0.7 + 20);
  // promotion / relegation between linked leagues (rules researched for 2026/27, see PROMO_RULES)
  summary.playoffs = [];
  for (const l of world.leagues) {
    if (!l.lower) continue;
    const lower = world.leagues.find((x) => x.id === l.lower);
    const R = PROMO_RULES[l.id] || { down: l.releg, playoff: null };
    const RL = PROMO_RULES[lower.id] || { up: lower.promo };
    const tu = tables[l.id], tl = tables[lower.id];
    const down = tu.slice(-R.down).map((r) => r.id);
    const up = tl.slice(0, RL.up).map((r) => r.id);
    if (R.playoff === 'relegation') {
      // German model: 16th of the upper league vs 3rd of the lower league, two legs, lower side at home first,
      // extra time and penalties after the second leg, no away-goals rule.
      const upperId = tu[tu.length - R.down - 1].id, lowerId = tl[RL.up].id;
      const tie = simTie(world, lowerId, upperId, rng, true);
      summary.playoffs.push({ name: `Relegation ${l.name} / ${lower.name}`, ...tie });
      if (tie.winner === lowerId) { down.push(upperId); up.push(lowerId); }
    } else if (RL.playoff === 'playoffs') {
      // English model: 3v6 and 4v5 over two legs (higher seed at home in the 2nd leg), one-off final at Wembley
      const s1 = simTie(world, tl[5].id, tl[2].id, rng, true), s2 = simTie(world, tl[4].id, tl[3].id, rng, true);
      const fin = simTie(world, s1.winner, s2.winner, rng, false);
      summary.playoffs.push({ name: `${lower.name} Play-off Halbfinale`, ...s1 }, { name: `${lower.name} Play-off Halbfinale`, ...s2 }, { name: `${lower.name} Play-off Finale (Wembley)`, ...fin });
      up.push(fin.winner);
      if (down.length < up.length) down.push(tu[tu.length - down.length - 1].id);
    }
    l.clubIds = l.clubIds.filter((id) => !down.includes(id)).concat(up);
    lower.clubIds = lower.clubIds.filter((id) => !up.includes(id)).concat(down);
    up.forEach((id) => { world.clubs[id].leagueId = l.id; summary.promoted.push(id); });
    down.forEach((id) => { world.clubs[id].leagueId = lower.id; summary.relegated.push(id); });
  }
  for (const l of world.leagues) l.deductions = {};
  applyLicence(world);
  for (const id of summary.promoted) { const h = world.clubs[id].history; if (h?.length) h[h.length - 1].moved = 'auf'; }
  for (const id of summary.relegated) { const h = world.clubs[id].history; if (h?.length) h[h.length - 1].moved = 'ab'; }
  for (const po of summary.playoffs) {
    const W = world.clubs[po.winner], Lo = world.clubs[po.loser];
    world.news.unshift({ season: world.season + 1, week: 0, text: `${po.name}: ${W.name} setzt sich gegen ${Lo.name} durch (${po.text}).` });
  }
  // players
  for (const club of Object.values(world.clubs)) {
    const country = world.leagues.find((l) => l.id === club.leagueId).country;
    for (const id of [...club.squad]) {
      const p = world.players[id];
      developPlayer(p, rng);
      if (p.stats.apps || !(p.career || []).length) (p.career ||= []).push({ season: world.season, club: club.short, clubId: club.id, apps: p.stats.apps, goals: p.stats.goals, assists: p.stats.assists, ovr: p.ovr });
      p.stats = { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, rating: 0 };
      p.yellow = 0; p.suspension = 0;
      if (p.age >= 34 && rng.chance((p.age - 33) * 0.3)) {
        // retirement + youth replacement
        club.squad = club.squad.filter((x) => x !== id);
        delete world.players[id];
        const y = generatePlayer(rng, world.nextPlayerId++, p.pos, Math.round(clamp(40 + club.rep * 0.25 + rng.normal(0, 4), 35, 75)), rng.int(16, 18), country, club.rep);
        y.clubId = club.id; y.number = p.number; y.pot = clamp(y.pot + rng.int(0, 10), y.ovr, 96);
        world.players[y.id] = y; club.squad.push(y.id);
        if (club.id === world.userClubId) world.news.unshift({ week: 0, season: world.season + 1, text: `${p.firstName} ${p.lastName} beendet seine Karriere. Jugendspieler ${y.firstName} ${y.lastName} (${y.age}) rückt in den Kader.` });
      }
    }
    club.lineup = null;
  }
  seasonTransfers(world, rng);
  seasonCoaches(world, rng);
  // youth academy: U19 season, ageing and the new intake (they start in the U19, not in the pro squad)
  summary.youth = [];
  summary.youthLeague = seasonYouth(world, rng);
  if (world.coach) world.coach.years = Math.max(1, world.coach.years - 1);
  if (summary.promoted.includes(world.userClubId)) (world.achFlags ||= {}).promoted = true;
  { const r = summary.user.rank, xp = (r === 1 ? 400 : 0) + cupWins.length * 250 + (summary.promoted.includes(world.userClubId) ? 300 : 0) + (summary.career?.delta > 0 ? 120 : 0) + Math.max(0, 60 - r * 3);
    gainXp(world, xp, `Saisonabschluss ${world.season}/${String((world.season + 1) % 100).padStart(2, '0')}: Platz ${r}`); }
  seasonChallenge(world, summary);
  checkAchievements(world);
  world.history.push(summary);
  world.season++;
  world.week = 0;
  for (const l of world.leagues) l.fixtures = buildFixtures(l.clubIds, rng);
  // cups: archive winners, new competitions qualified via the final tables
  summary.cups = (world.cups || []).map((c) => ({ name: c.name, winner: c.winner }));
  (world.cupHistory ||= []).push({ season: world.season - 1, cups: summary.cups });
  createCups(world, rng, tables);
  return summary;
}

export function newRng(world) { return new RNG((world.seed + world.season * 1000 + world.week * 17 + Date.now()) >>> 0); }
