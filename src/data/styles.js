// v3.4: playing styles – how a player decides on the pitch (shoot, pass, dribble, press).
// Every engine reads the same effects: classic 3D (ai.js), Unity (C#) and Unreal (C++).
export const STYLES = {
  knipser: { name: 'Knipser', icon: '🎯', desc: 'Schießt bei jeder Gelegenheit selbst', fx: { shot: 1.3, passFinal: -0.006 } },
  spielmacher: { name: 'Spielmacher', icon: '🧠', desc: 'Sucht den tödlichen Pass in die Tiefe', fx: { prog: 1.7, calm: 0.85 } },
  dribbler: { name: 'Dribbelkünstler', icon: '🪄', desc: 'Geht ins Eins-gegen-eins', fx: { drib: 0.012 } },
  fluegel: { name: 'Flügelflitzer', icon: '⚡', desc: 'Zieht zur Grundlinie und flankt', fx: { cross: 0.03, drib: 0.004 } },
  zweikampf: { name: 'Zweikampfmonster', icon: '🛡️', desc: 'Presst aggressiv, gewinnt Zweikämpfe, foult öfter', fx: { press: 1.35, tackle: 0.06, foul: 1.25 } },
  ballsicher: { name: 'Ballsicher', icon: '🧊', desc: 'Spielt sichere Pässe, verliert kaum Bälle', fx: { calm: 0.7, safe: 1.25 } },
};
const NONE = { fx: {} };

// deterministic per player: same squad, same styles – about 55 % of players get one
function pickStyle(p) {
  const A = p.attrs || {}, pos = p.pos;
  if (pos === 'TW') return null;
  const h = ((p.id * 2654435761) >>> 0) / 4294967296;
  if (h < 0.45) return null;
  const cand = [];
  if (['ST', 'LA', 'RA', 'OM'].includes(pos) && (A.abschluss ?? 0) >= 66) cand.push('knipser', 'knipser');
  if (['ZM', 'OM', 'DM'].includes(pos) && (A.uebersicht ?? 0) >= 66) cand.push('spielmacher', 'spielmacher');
  if ((A.dribbling ?? 0) >= 70 && !['IV', 'DM'].includes(pos)) cand.push('dribbler');
  if (['LM', 'RM', 'LA', 'RA', 'LV', 'RV'].includes(pos) && (A.tempo ?? 0) >= 70) cand.push('fluegel', 'fluegel');
  if (['IV', 'DM', 'ZM', 'LV', 'RV'].includes(pos) && (A.tackling ?? 0) >= 66) cand.push('zweikampf', 'zweikampf');
  if ((A.passspiel ?? 0) >= 68 && ['IV', 'DM', 'ZM'].includes(pos)) cand.push('ballsicher');
  if (!cand.length) return null;
  return cand[Math.floor(((h - 0.45) / 0.55) * cand.length) % cand.length];
}

/** The player's style id (assigned once, stored on the player). */
export function styleId(p) {
  if (!p) return null;
  if (p.style === undefined) p.style = pickStyle(p);
  return p.style;
}
export const styleOf = (p) => STYLES[styleId(p)] || null;
export const styleFx = (p) => (STYLES[styleId(p)] || NONE).fx;

/** Temperament 0..1 from the off-pitch personality (more fouls/cards when high). */
const TEMPER = { Temperamentvoll: 0.9, Launisch: 0.85, Ehrgeizig: 0.5, Perfektionist: 0.55, Führungsspieler: 0.35, Professionell: 0.2, Ruhig: 0.1, Loyal: 0.2, Lässig: 0.3, Teamplayer: 0.2 };
export const temperOf = (p) => TEMPER[p?.personality] ?? 0.4;
export const isLeader = (p) => p?.personality === 'Führungsspieler';

// ------------------------------------------------------------------ v4.0 style training
// Which styles a player can learn: position fit and the key attribute a bit below the natural threshold.
const LEARN = {
  knipser: { pos: ['ST', 'LA', 'RA', 'OM'], attr: 'abschluss', min: 60 },
  spielmacher: { pos: ['ZM', 'OM', 'DM'], attr: 'uebersicht', min: 60 },
  dribbler: { pos: ['ST', 'LA', 'RA', 'OM', 'LM', 'RM', 'ZM', 'LV', 'RV'], attr: 'dribbling', min: 63 },
  fluegel: { pos: ['LM', 'RM', 'LA', 'RA', 'LV', 'RV'], attr: 'tempo', min: 63 },
  zweikampf: { pos: ['IV', 'DM', 'ZM', 'LV', 'RV'], attr: 'tackling', min: 60 },
  ballsicher: { pos: ['IV', 'DM', 'ZM'], attr: 'passspiel', min: 61 },
};
export const learnKey = (id) => LEARN[id]?.attr;
/** Styles this player could learn now (talent lowers the threshold by 8). */
export function learnable(p) {
  if (!p || p.pos === 'TW') return [];
  return Object.entries(LEARN).filter(([id, L]) => id !== styleId(p) && L.pos.includes(p.pos) && (p.attrs?.[L.attr] ?? 0) >= L.min - (p.styleTalent === id ? 8 : 0)).map(([id]) => id);
}
export function startStyleTrain(p, id) { p.styleTrain = id && learnable(p).includes(id) ? { id, progress: 0 } : null; }
/** Weekly progress: ~12 weeks, faster for young, professional, talented players and better facilities. */
export function weeklyStyleTrain(world, club, rng) {
  const out = [];
  for (const id of club.squad) {
    const p = world.players[id]; if (!p?.styleTrain) continue;
    if (!learnable(p).includes(p.styleTrain.id)) { p.styleTrain = null; continue; }
    const fac = club.facilities?.training ?? 2;
    const sp = 0.07 * (p.age <= 23 ? 1.3 : p.age >= 30 ? 0.7 : 1) * (0.75 + (p.professionalism ?? 60) / 200) * (0.85 + fac * 0.06) * (p.styleTalent === p.styleTrain.id ? 1.8 : 1) * (p.injury > 0 ? 0.3 : 1);
    p.styleTrain.progress = Math.min(1, p.styleTrain.progress + sp * (0.85 + rng.next() * 0.3));
    if (p.styleTrain.progress >= 1) {
      const st = STYLES[p.styleTrain.id];
      p.style = p.styleTrain.id; p.styleTrain = null;
      const k = LEARN[p.style].attr; if (p.attrs[k] < 99) p.attrs[k]++;
      out.push(`${st.icon} ${p.firstName} ${p.lastName} beherrscht jetzt den Spielstil „${st.name}“.`);
    }
  }
  return out;
}
/** Youth: about a third of new academy players show a talent for a style that fits their position. */
export function rollStyleTalent(p, rng) {
  p.styleTalent = null;
  if (p.pos === 'TW' || !rng.chance(0.35)) return;
  const fit = Object.entries(LEARN).filter(([, L]) => L.pos.includes(p.pos)).map(([id]) => id);
  if (fit.length) p.styleTalent = fit[Math.floor(rng.next() * fit.length)];
}
