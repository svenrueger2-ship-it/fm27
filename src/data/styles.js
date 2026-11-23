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
