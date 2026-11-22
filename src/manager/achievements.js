// Achievements, challenges and career statistics (v2.0).
import { progressMatch, taskEvent, gainXp } from './progress.js';
const GLOBAL_KEY = 'ufm3d-achievements';

export function ensureStats(world) {
  world.userStats ||= { matches: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, spent: 0, earned: 0, bought: 0, sold: 0, maxBuy: null, maxSell: null, preContracts: 0, youthPromoted: 0 };
  return world.userStats;
}
export function statMatch(world, gf, ga) {
  const S = ensureStats(world);
  S.matches++; S.gf += gf; S.ga += ga; if (gf > ga) S.w++; else if (gf === ga) S.d++; else S.l++;
  progressMatch(world, gf, ga);
}
export function statTransfer(world, p, from, to, fee) {
  const S = ensureStats(world), me = world.userClubId;
  if (to?.id === me) { taskEvent(world, 'sign'); S.bought++; S.spent += fee; if (!S.maxBuy || fee > S.maxBuy.fee) S.maxBuy = { fee, name: `${p.firstName} ${p.lastName}`, season: world.season }; if (world.challenge?.id === 'jugend' && fee > 0 && world.challenge.status === 'running') failChallenge(world, 'Du hast eine Ablöse bezahlt.'); }
  if (from?.id === me) { S.sold++; S.earned += fee; if (!S.maxSell || fee > S.maxSell.fee) S.maxSell = { fee, name: `${p.firstName} ${p.lastName}`, season: world.season }; }
}

const cupWon = (w, id) => (w.cupHistory || []).some((h) => h.cup === id && h.winner === w.userClubId) || (w.cups || []).some((c) => c.id === id && c.winner === w.userClubId);
const titles = (w) => w.career?.titles || [];
export const ACHIEVEMENTS = [
  { id: 'first_win', icon: '✅', name: 'Der erste Dreier', desc: 'Gewinne dein erstes Pflichtspiel.', check: (w) => ensureStats(w).w >= 1 },
  { id: 'big_win', icon: '💥', name: 'Schützenfest', desc: 'Gewinne ein Spiel mit 5 Toren Unterschied.', check: (w) => (w.records?.biggestWin?.d || 0) >= 5 },
  { id: 'unbeaten10', icon: '🧱', name: 'Bollwerk', desc: '10 Pflichtspiele in Folge ohne Niederlage.', check: (w) => (w.records?.unbeatenMax || 0) >= 10 },
  { id: 'unbeaten25', icon: '🏰', name: 'Unbesiegbar', desc: '25 Pflichtspiele in Folge ohne Niederlage.', check: (w) => (w.records?.unbeatenMax || 0) >= 25 },
  { id: 'wins100', icon: '💯', name: 'Hundert Siege', desc: 'Gewinne 100 Pflichtspiele.', check: (w) => ensureStats(w).w >= 100 },
  { id: 'champion', icon: '🏆', name: 'Meister!', desc: 'Gewinne eine Meisterschaft.', check: (w) => titles(w).some((t) => t.title?.startsWith('Meister')) },
  { id: 'champion3', icon: '👑', name: 'Dynastie', desc: 'Gewinne drei Meisterschaften.', check: (w) => titles(w).filter((t) => t.title?.startsWith('Meister')).length >= 3 },
  { id: 'cup', icon: '🥇', name: 'Pokalheld', desc: 'Gewinne einen nationalen Pokal.', check: (w) => titles(w).some((t) => /Pokal|Cup|Copa|Coppa|Coupe/.test(t.title || '')) },
  { id: 'cl', icon: '⭐', name: 'Europas Krone', desc: 'Gewinne die Champions League.', check: (w) => titles(w).some((t) => t.title === 'Champions League') },
  { id: 'el', icon: '🟠', name: 'Europa-Sieger', desc: 'Gewinne die Europa League.', check: (w) => titles(w).some((t) => t.title === 'Europa League') },
  { id: 'ecl', icon: '🟢', name: 'Conference-Champion', desc: 'Gewinne die Conference League.', check: (w) => titles(w).some((t) => t.title === 'Conference League') },
  { id: 'double', icon: '✌️', name: 'Das Double', desc: 'Meisterschaft und Pokal in einer Saison.', check: (w) => (w.career?.seasons || []).some((s) => s.titles.some((t) => t.startsWith('Meister')) && s.titles.some((t) => /Pokal|Cup|Copa|Coppa|Coupe/.test(t))) },
  { id: 'treble', icon: '🔱', name: 'Triple', desc: 'Meister, Pokalsieger und Champions-League-Sieger in einer Saison.', check: (w) => (w.career?.seasons || []).some((s) => s.titles.length >= 3 && s.titles.includes('Champions League')) },
  { id: 'promotion', icon: '⬆️', name: 'Aufstieg', desc: 'Steige in eine höhere Liga auf.', check: (w) => !!w.achFlags?.promoted },
  { id: 'goal_reached', icon: '🎯', name: 'Ziel erreicht', desc: 'Erfülle das Saisonziel des Vorstands.', check: (w) => (w.career?.seasons || []).some((s) => s.reached) },
  { id: 'five_goals', icon: '🎯', name: 'Zielstrebig', desc: 'Erfülle fünfmal das Saisonziel.', check: (w) => (w.career?.seasons || []).filter((s) => s.reached).length >= 5 },
  { id: 'seasons5', icon: '📅', name: 'Urgestein', desc: 'Spiele 5 Saisons.', check: (w) => (w.career?.seasons || []).length >= 5 },
  { id: 'seasons10', icon: '🗓️', name: 'Legende an der Seitenlinie', desc: 'Spiele 10 Saisons.', check: (w) => (w.career?.seasons || []).length >= 10 },
  { id: 'rep80', icon: '🌟', name: 'International gefragt', desc: 'Erreiche einen Manager-Ruf von 80.', check: (w) => (w.career?.rep || 0) >= 80 },
  { id: 'rep95', icon: '💫', name: 'Weltklasse-Trainer', desc: 'Erreiche einen Manager-Ruf von 95.', check: (w) => (w.career?.rep || 0) >= 95 },
  { id: 'sacked', icon: '🚪', name: 'Rauswurf', desc: 'Werde entlassen. Passiert den Besten.', check: (w) => (w.career?.sacked || 0) >= 1 },
  { id: 'jobhop', icon: '🧳', name: 'Wandervogel', desc: 'Trainiere drei verschiedene Vereine.', check: (w) => new Set((w.career?.clubs || []).map((c) => c.clubId)).size >= 3 },
  { id: 'natcoach', icon: '🎽', name: 'Bundestrainer', desc: 'Übernimm eine Nationalmannschaft.', check: (w) => !!w.career?.nat },
  { id: 'worldchamp', icon: '🌍', name: 'Weltmeister-Trainer', desc: 'Gewinne die WM oder EM als Nationaltrainer.', check: (w) => titles(w).some((t) => t.nat) },
  { id: 'big_buy', icon: '💸', name: 'Rekordtransfer', desc: 'Kaufe einen Spieler für mindestens 80 Mio. €.', check: (w) => (ensureStats(w).maxBuy?.fee || 0) >= 80e6 },
  { id: 'big_sell', icon: '💰', name: 'Verkaufsgenie', desc: 'Verkaufe einen Spieler für mindestens 60 Mio. €.', check: (w) => (ensureStats(w).maxSell?.fee || 0) >= 60e6 },
  { id: 'bosman', icon: '📝', name: 'Bosman-Coup', desc: 'Verpflichte einen Spieler per Vorvertrag.', check: (w) => ensureStats(w).preContracts >= 1 },
  { id: 'rich', icon: '🏦', name: 'Volle Kasse', desc: 'Habe über 150 Mio. € auf dem Konto.', check: (w) => (w.clubs[w.userClubId]?.budget || 0) >= 150e6 },
  { id: 'stadium', icon: '🏟️', name: 'Fußballtempel', desc: 'Baue dein Stadion auf mindestens 60.000 Plätze aus.', check: (w) => (w.clubs[w.userClubId]?.stadium?.capacity || 0) >= 60000 },
  { id: 'members', icon: '👥', name: 'Mitgliederrekord', desc: 'Dein Verein hat 150.000 Mitglieder.', check: (w) => (w.clubs[w.userClubId]?.biz?.members || 0) >= 150000 },
  { id: 'spirit', icon: '🤝', name: 'Eine Einheit', desc: 'Erreiche einen Teamgeist von 90.', check: (w) => (w.clubs[w.userClubId]?.spirit || 0) >= 90 },
  { id: 'youth', icon: '🌱', name: 'Aus der eigenen Jugend', desc: 'Ziehe 5 U19-Talente zu den Profis hoch.', check: (w) => ensureStats(w).youthPromoted >= 5 },
  { id: 'legend', icon: '🏛️', name: 'Vereinslegende', desc: 'Ein Spieler absolviert 150 Spiele unter dir.', check: (w) => Object.values(w.legends || {}).some((l) => l.apps >= 150) },
  { id: 'founder', icon: '✨', name: 'Vereinsgründer', desc: 'Gründe deinen eigenen Verein.', check: (w) => Object.values(w.clubs).some((c) => c.custom && c.id === w.userClubId) },
  { id: 'founder_top', icon: '🚀', name: 'Vom Acker in die Beletage', desc: 'Führe deinen selbst gegründeten Verein in die höchste Liga.', check: (w) => { const c = w.clubs[w.userClubId]; return !!c?.custom && w.leagues.find((l) => l.id === c.leagueId)?.tier === 1; } },
  { id: 'challenge', icon: '🎖️', name: 'Herausforderung gemeistert', desc: 'Schließe eine Herausforderung erfolgreich ab.', check: (w) => w.challenge?.status === 'won' },
];

// ------------------------------------------------------------------ challenges
export const CHALLENGES = [
  { id: 'none', name: 'Keine Herausforderung', desc: 'Freies Spiel.' },
  { id: 'durchmarsch', name: 'Durchmarsch', desc: 'Erreiche innerhalb von 3 Saisons die höchste Liga deines Landes (nur mit einem Klub aus Liga 2 oder 3).', seasons: 3 },
  { id: 'europa', name: 'Europa ruft', desc: 'Qualifiziere dich innerhalb von 4 Saisons für die Champions League.', seasons: 4 },
  { id: 'jugend', name: 'Nur Eigengewächse', desc: 'Kaufe 3 Saisons lang keinen Spieler gegen Ablöse und erreiche dabei jedes Saisonziel.', seasons: 3 },
  { id: 'sparkurs', name: 'Sparkommissar', desc: 'Starte mit nur 10 % des Budgets und beende 3 Saisons ohne Minus auf dem Konto.', seasons: 3 },
  { id: 'titel', name: 'Titelhamster', desc: 'Gewinne innerhalb von 5 Saisons mindestens 4 Titel.', seasons: 5 },
];
export function startChallenge(world, id) {
  if (!id || id === 'none') { world.challenge = null; return; }
  world.challenge = { id, start: world.season, status: 'running', note: '' };
  if (id === 'sparkurs') { const c = world.clubs[world.userClubId]; c.budget = Math.round(c.budget * 0.1 / 1e5) * 1e5; }
}
function failChallenge(world, why) { world.challenge.status = 'failed'; world.challenge.note = why; world.news.unshift({ season: world.season, week: world.week, text: `❌ Herausforderung gescheitert: ${why}` }); }
function winChallenge(world) { world.challenge.status = 'won'; world.news.unshift({ season: world.season, week: world.week, text: `🎖️ Herausforderung „${CHALLENGES.find((c) => c.id === world.challenge.id).name}“ gemeistert!` }); }

export function seasonChallenge(world, summary) {
  const C = world.challenge; if (!C || C.status !== 'running') return;
  const def = CHALLENGES.find((c) => c.id === C.id), done = world.season - C.start + 1;
  const club = world.clubs[world.userClubId], tier = world.leagues.find((l) => l.id === club.leagueId)?.tier;
  const last = world.career?.seasons?.slice(-1)[0];
  if (C.id === 'durchmarsch' && tier === 1) return winChallenge(world);
  if (C.id === 'europa' && summary?.user?.rank <= ({ de1: 6, en1: 7, es1: 7, it1: 7, fr1: 5 }[club.leagueId] || 0)) return winChallenge(world);
  if (C.id === 'jugend' && last && !last.reached) return failChallenge(world, 'Saisonziel verpasst.');
  if (C.id === 'sparkurs' && club.budget < 0) return failChallenge(world, 'Das Konto stand am Saisonende im Minus.');
  if (C.id === 'titel' && (world.career?.titles || []).filter((t) => t.season >= C.start).length >= 4) return winChallenge(world);
  if (done >= def.seasons) { if (['jugend', 'sparkurs'].includes(C.id)) winChallenge(world); else failChallenge(world, `Nach ${def.seasons} Saisons nicht geschafft.`); }
  else C.note = `Saison ${done}/${def.seasons}`;
}

// ------------------------------------------------------------------ unlocks
export function checkAchievements(world) {
  if (world.presim) return [];
  world.achievements ||= {};
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (world.achievements[a.id]) continue;
    let ok = false; try { ok = a.check(world); } catch { ok = false; }
    if (!ok) continue;
    world.achievements[a.id] = { season: world.season, week: world.week };
    fresh.push(a);
    world.news.unshift({ season: world.season, week: world.week, text: `🏅 Erfolg freigeschaltet: ${a.icon} ${a.name} – ${a.desc}` });
  }
  if (fresh.length) {
    (world.achToast ||= []).push(...fresh.map((a) => `${a.icon} ${a.name}`));
    for (const a of fresh) gainXp(world, 50, `Erfolg: ${a.name}`);
    try { const g = JSON.parse(localStorage.getItem(GLOBAL_KEY) || '{}'); for (const a of fresh) g[a.id] ||= Date.now(); localStorage.setItem(GLOBAL_KEY, JSON.stringify(g)); } catch {}
  }
  return fresh;
}
export function globalAchievements() { try { return JSON.parse(localStorage.getItem(GLOBAL_KEY) || '{}'); } catch { return {}; } }
