// Manager progression (v2.5): XP, levels, skill tree, daily & weekly tasks (based on the real date).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const SKILLS = [
  { id: 'verhandlung', icon: '🤝', name: 'Verhandlungsgeschick', ranks: ['Ablöseforderungen −4 %', 'Ablöseforderungen −8 %', 'Ablöseforderungen −12 %'] },
  { id: 'motivator', icon: '🔥', name: 'Motivator', ranks: ['Moral im Kader +0,3 pro Woche', 'Moral +0,6 pro Woche', 'Moral +0,9 pro Woche'] },
  { id: 'taktiker', icon: '🧠', name: 'Taktikfuchs', ranks: ['Taktik-Vertrautheit +0,6 % pro Woche', '+1,2 % pro Woche', '+1,8 % pro Woche'] },
  { id: 'jugend', icon: '🌱', name: 'Talentförderer', ranks: ['Spieler bis 21 entwickeln sich 7 % schneller', '14 % schneller', '21 % schneller'] },
  { id: 'scouting', icon: '🕵️', name: 'Scouting-Auge', ranks: ['+1 Scout-Auftrag gleichzeitig', '+2 Aufträge, Berichte aus fremden Ligen in 1 Woche', '+3 Aufträge'] },
  { id: 'medien', icon: '🎙️', name: 'Medienprofi', ranks: ['Fans & Vorstand +0,15 Stimmung pro Woche', '+0,3 pro Woche', '+0,45 pro Woche'] },
  { id: 'finanzen', icon: '💼', name: 'Vermarkter', ranks: ['+2,5 % auf Ticket-, Sponsor- & Merch-Einnahmen', '+5 %', '+7,5 %'] },
];

export const xpForLevel = (L) => Math.round(120 * Math.pow(L, 1.25)); // XP from level L to L+1
export const MAX_LEVEL = 30;

export function ensureMgr(world) {
  world.mgr ||= { xp: 0, level: 1, points: 0, skills: {}, log: [], levelUps: [] };
  return world.mgr;
}
export function skillRank(world, id) { return world?.mgr?.skills?.[id] || 0; }

export function gainXp(world, amount, why) {
  if (!world?.userClubId || world.presim || amount <= 0) return;
  const M = ensureMgr(world);
  M.xp += Math.round(amount);
  M.log.unshift({ season: world.season, week: world.week, xp: Math.round(amount), why }); M.log = M.log.slice(0, 40);
  while (M.level < MAX_LEVEL && M.xp >= xpForLevel(M.level)) { M.xp -= xpForLevel(M.level); M.level++; M.points++; M.levelUps.push(M.level); }
}

export function buySkill(world, id) {
  const M = ensureMgr(world), r = M.skills[id] || 0;
  if (M.points < 1 || r >= 3) return false;
  M.points--; M.skills[id] = r + 1; return true;
}

/** Weekly skill effects for the user club (called from finishWeek's user block). */
export function weeklySkills(world) {
  const club = world.clubs[world.userClubId]; if (!club) return;
  const mot = skillRank(world, 'motivator'), tak = skillRank(world, 'taktiker'), med = skillRank(world, 'medien');
  if (mot) for (const id of club.squad) { const p = world.players[id]; if (p) p.morale = clamp((p.morale ?? 70) + 0.3 * mot, 0, 100); }
  if (tak && club.familiarity != null) club.familiarity = Math.min(1, club.familiarity + 0.006 * tak);
  if (med && world.mood) { world.mood.board = clamp(world.mood.board + 0.15 * med, 0, 100); world.mood.fans = clamp(world.mood.fans + 0.15 * med, 0, 100); }
}

/** XP + task tracking for a competitive match of the user club. */
export function progressMatch(world, gf, ga) {
  gainXp(world, (gf > ga ? 25 : gf === ga ? 10 : 3) + gf * 2 + (ga === 0 ? 5 : 0), gf > ga ? `Sieg ${gf}:${ga}` : gf === ga ? `Remis ${gf}:${ga}` : `Niederlage ${gf}:${ga}`);
  taskEvent(world, 'match'); if (gf > ga) taskEvent(world, 'win'); if (ga === 0) taskEvent(world, 'clean');
  if (gf) taskEvent(world, 'goals', gf); if (gf - ga >= 3) taskEvent(world, 'bigwin');
}

// ------------------------------------------------------------------ daily & weekly tasks
const DAILY = [
  { kind: 'match', goal: 2, text: 'Bestreite 2 Pflichtspiele', xp: 60 },
  { kind: 'win', goal: 1, text: 'Gewinne ein Pflichtspiel', xp: 70 },
  { kind: 'goals', goal: 4, text: 'Erziele 4 Tore', xp: 70 },
  { kind: 'clean', goal: 1, text: 'Spiele zu Null', xp: 80 },
  { kind: 'live', goal: 1, text: 'Schaue ein Spiel im 3D-Modus', xp: 70 },
  { kind: 'talk', goal: 1, text: 'Führe ein Einzelgespräch mit einem Spieler', xp: 50 },
  { kind: 'press', goal: 2, text: 'Beantworte 2 Fragen auf der Pressekonferenz', xp: 50 },
  { kind: 'swipe', goal: 10, text: 'Bewerte 10 Spieler im Transfer-Swipe', xp: 50 },
  { kind: 'scout', goal: 1, text: 'Schicke einen Scout los', xp: 50 },
  { kind: 'bigwin', goal: 1, text: 'Gewinne mit 3 Toren Unterschied', xp: 110 },
];
const WEEKLY = [
  { kind: 'win', goal: 5, text: 'Gewinne 5 Pflichtspiele', xp: 300, cash: 500000 },
  { kind: 'goals', goal: 15, text: 'Erziele 15 Tore', xp: 280, cash: 400000 },
  { kind: 'live', goal: 3, text: 'Schaue 3 Spiele im 3D-Modus', xp: 260, cash: 300000 },
  { kind: 'clean', goal: 3, text: 'Spiele dreimal zu Null', xp: 300, cash: 400000 },
  { kind: 'sign', goal: 1, text: 'Verpflichte einen neuen Spieler', xp: 220, cash: 0 },
  { kind: 'match', goal: 8, text: 'Bestreite 8 Pflichtspiele', xp: 240, cash: 300000 },
];
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (pool, n, seed) => { const a = pool.map((x, i) => ({ x, k: hash(`${seed}-${i}`) })).sort((p, q) => p.k - q.k); const out = [], kinds = new Set(); for (const { x } of a) { if (kinds.has(x.kind)) continue; kinds.add(x.kind); out.push(x); if (out.length === n) break; } return out; };
export function dayKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function weekKey(d = new Date()) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0')}`; }

export function ensureTasks(world, now = new Date()) {
  const M = ensureMgr(world), dk = dayKey(now), wk = weekKey(now);
  if (M.tasks?.day !== dk) M.tasks = { day: dk, list: pick(DAILY, 3, dk).map((t) => ({ ...t, id: `d-${dk}-${t.kind}`, prog: 0, claimed: false })) };
  if (M.wtasks?.week !== wk) M.wtasks = { week: wk, list: pick(WEEKLY, 2, wk).map((t) => ({ ...t, id: `w-${wk}-${t.kind}`, prog: 0, claimed: false })) };
  return { daily: M.tasks.list, weekly: M.wtasks.list };
}
export function taskEvent(world, kind, n = 1) {
  if (!world?.userClubId || world.presim) return;
  const T = ensureTasks(world);
  for (const t of [...T.daily, ...T.weekly]) if (t.kind === kind && !t.claimed) t.prog = Math.min(t.goal, t.prog + n);
}
export function openTasks(world) { const T = ensureTasks(world); return [...T.daily, ...T.weekly].filter((t) => t.prog >= t.goal && !t.claimed).length; }
export function claimTask(world, id) {
  const T = ensureTasks(world), t = [...T.daily, ...T.weekly].find((x) => x.id === id);
  if (!t || t.claimed || t.prog < t.goal) return null;
  t.claimed = true;
  gainXp(world, t.xp, `Aufgabe: ${t.text}`);
  if (t.cash) { const c = world.clubs[world.userClubId]; c.budget += t.cash; }
  return t;
}
