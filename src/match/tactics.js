// Formations, tactic presets and lineup selection. Used by manager UI AND match engine.
import { POS_COMPAT, computeOverall } from '../data/attributes.js';

// Slot coordinates in team-local space: x = depth (0 = defensive line, 1 = most advanced),
// z = -1 (left) .. +1 (right) seen in attacking direction.
const BACK4 = [['LV', 0.02, -0.82], ['IV', 0, -0.3], ['IV', 0, 0.3], ['RV', 0.02, 0.82]];
export const FORMATIONS = {
  '4-4-2': [['TW', 0, 0], ...BACK4, ['LM', 0.45, -0.82], ['ZM', 0.38, -0.25], ['ZM', 0.38, 0.25], ['RM', 0.45, 0.82], ['ST', 0.92, -0.22], ['ST', 0.9, 0.22]],
  '4-3-3': [['TW', 0, 0], ...BACK4, ['DM', 0.24, 0], ['ZM', 0.46, -0.42], ['ZM', 0.46, 0.42], ['LA', 0.86, -0.8], ['ST', 0.96, 0], ['RA', 0.86, 0.8]],
  '4-2-3-1': [['TW', 0, 0], ...BACK4, ['DM', 0.26, -0.26], ['DM', 0.26, 0.26], ['LA', 0.7, -0.8], ['OM', 0.64, 0], ['RA', 0.7, 0.8], ['ST', 0.96, 0]],
  '4-1-4-1': [['TW', 0, 0], ...BACK4, ['DM', 0.22, 0], ['LM', 0.52, -0.82], ['ZM', 0.48, -0.3], ['ZM', 0.48, 0.3], ['RM', 0.52, 0.82], ['ST', 0.95, 0]],
  '3-5-2': [['TW', 0, 0], ['IV', 0, -0.5], ['IV', 0, 0], ['IV', 0, 0.5], ['LM', 0.42, -0.9], ['DM', 0.24, 0], ['ZM', 0.46, -0.36], ['ZM', 0.46, 0.36], ['RM', 0.42, 0.9], ['ST', 0.92, -0.2], ['ST', 0.9, 0.2]],
  '5-4-1': [['TW', 0, 0], ['LV', 0.06, -0.9], ['IV', 0, -0.45], ['IV', 0, 0], ['IV', 0, 0.45], ['RV', 0.06, 0.9], ['LM', 0.4, -0.78], ['ZM', 0.36, -0.25], ['ZM', 0.36, 0.25], ['RM', 0.4, 0.78], ['ST', 0.9, 0]],
};

export const PRESETS = {
  'Ausgewogen':     { mentality: 0.5,  pressing: 0.5,  line: 0.5,  width: 0.55, tempo: 0.5,  directness: 0.45, compactness: 0.5, offsideTrap: false },
  'Hohes Pressing': { mentality: 0.65, pressing: 0.92, line: 0.82, width: 0.6,  tempo: 0.75, directness: 0.45, compactness: 0.7, offsideTrap: true },
  'Ballbesitz':     { mentality: 0.6,  pressing: 0.65, line: 0.65, width: 0.75, tempo: 0.3,  directness: 0.15, compactness: 0.5, offsideTrap: false },
  'Konter':         { mentality: 0.35, pressing: 0.3,  line: 0.3,  width: 0.5,  tempo: 0.85, directness: 0.8,  compactness: 0.7, offsideTrap: false },
  'Mauern':         { mentality: 0.15, pressing: 0.15, line: 0.1,  width: 0.35, tempo: 0.5,  directness: 0.75, compactness: 0.95, offsideTrap: false },
};

export function defaultTactic(rng, rep) {
  const forms = Object.keys(FORMATIONS);
  const formation = rep > 80 ? rng.pick(['4-3-3', '4-2-3-1', '4-3-3']) : rep < 55 ? rng.pick(['4-4-2', '5-4-1', '4-1-4-1']) : rng.pick(forms);
  const presetName = rep > 82 ? rng.pick(['Hohes Pressing', 'Ballbesitz']) : rep < 55 ? rng.pick(['Konter', 'Mauern', 'Ausgewogen']) : rng.pick(Object.keys(PRESETS));
  return { formation, preset: presetName, ...PRESETS[presetName] };
}

export function positionFit(player, pos) {
  if (player.pos === pos) return 1;
  if (player.altPos?.includes(pos)) return 0.97;
  const compat = POS_COMPAT[pos] || [];
  const i = compat.indexOf(player.pos);
  if (i >= 0) return 0.93 - i * 0.03;
  if (pos === 'TW' || player.pos === 'TW') return 0.3;
  return 0.75;
}

export function effectiveRating(player, pos) {
  if (player.pos === pos) return player.ovr;
  const base = computeOverall(player.attrs, pos);
  return Math.round(base * positionFit(player, pos));
}

export function available(p) { return p && p.injury <= 0 && p.suspension <= 0; }

// Picks best XI for a formation + 7 substitutes.
export function autoLineup(club, players, formationName = club.tactic.formation) {
  const slots = FORMATIONS[formationName];
  const pool = club.squad.map((id) => players[id]).filter(available);
  const taken = new Set();
  const xi = new Array(slots.length).fill(null);
  // fill GK first, then by scarcity
  const order = slots.map((s, i) => i).sort((a, b) => (slots[a][0] === 'TW' ? -1 : slots[b][0] === 'TW' ? 1 : 0));
  for (const i of order) {
    const pos = slots[i][0];
    let best = null, bestScore = -1;
    for (const p of pool) {
      if (taken.has(p.id)) continue;
      const s = effectiveRating(p, pos) * (0.85 + 0.15 * (p.fitness / 100));
      if (s > bestScore) { bestScore = s; best = p; }
    }
    if (best) { xi[i] = best.id; taken.add(best.id); }
  }
  const rest = pool.filter((p) => !taken.has(p.id)).sort((a, b) => b.ovr - a.ovr);
  const bench = [];
  const gk = rest.find((p) => p.pos === 'TW');
  if (gk) bench.push(gk.id);
  for (const p of rest) { if (bench.length >= 7) break; if (!bench.includes(p.id)) bench.push(p.id); }
  return { formation: formationName, xi, bench };
}

export function ensureLineup(club, players) {
  const L = club.lineup;
  const valid = L && L.formation === club.tactic.formation && L.xi.length === FORMATIONS[L.formation].length &&
    L.xi.every((id) => id && club.squad.includes(id) && available(players[id]));
  if (!valid) club.lineup = autoLineup(club, players);
  else club.lineup.bench = (club.lineup.bench || []).filter((id) => club.squad.includes(id) && available(players[id]) && !club.lineup.xi.includes(id));
  return club.lineup;
}

export function teamStrength(club, players) {
  const L = ensureLineup(club, players);
  const slots = FORMATIONS[L.formation];
  let s = 0;
  L.xi.forEach((id, i) => { s += id ? effectiveRating(players[id], slots[i][0]) : 30; });
  return s / L.xi.length;
}

// ------------------------------------------------------------------ player roles (v1.0)
// px/dx: shift forward (local metres) with / without the ball, pz: width factor with the ball,
// wide: minimum width with the ball, shot/drib: decision multipliers, gk: sweeper keeper distance.
export const ROLE_DEFS = {
  tw: { label: 'Torwart', pos: ['TW'], desc: 'Bleibt auf der Linie, klassisches Torwartspiel.' },
  sweeper: { label: 'Mitspielender Torwart', pos: ['TW'], gk: 5, desc: 'Steht weit vor dem Tor, fängt Steilpässe ab, spielt mit.' },
  iv: { label: 'Innenverteidiger', pos: ['IV'], desc: 'Hält die Position in der Kette.' },
  ballspiel: { label: 'Ballspielender IV', pos: ['IV'], px: 3, desc: 'Schiebt mit Ball ins Mittelfeld und eröffnet das Spiel.' },
  vorstopper: { label: 'Vorstopper', pos: ['IV'], dx: 3, desc: 'Verteidigt aggressiv nach vorne, attackiert früh.' },
  av: { label: 'Außenverteidiger', pos: ['LV', 'RV'], desc: 'Ausgewogen zwischen Abwehr und Angriff.' },
  wingback: { label: 'Schienenspieler', pos: ['LV', 'RV'], px: 8, wide: 30, desc: 'Läuft die ganze Linie hoch und gibt Breite.' },
  inversav: { label: 'Inverser AV', pos: ['LV', 'RV'], px: 4, pz: 0.42, desc: 'Rückt mit Ball ins Zentrum und bildet eine Dreierreihe vor der Abwehr.' },
  defav: { label: 'Defensiver AV', pos: ['LV', 'RV'], px: -7, dx: -1, desc: 'Bleibt hinten und sichert ab.' },
  sechser: { label: 'Abräumer', pos: ['DM'], dx: 2, desc: 'Jagt Bälle im Mittelfeld.' },
  anker: { label: 'Anker', pos: ['DM'], px: -5, dx: -3, desc: 'Steht vor der Abwehr wie eine Wand.' },
  tiefspielmacher: { label: 'Tiefer Spielmacher', pos: ['DM', 'ZM'], px: -3, drib: -0.004, desc: 'Lenkt das Spiel aus der Tiefe mit langen Bällen.' },
  zm: { label: 'Zentraler Mittelfeldspieler', pos: ['ZM', 'LM', 'RM'], desc: 'Ausgewogene Rolle.' },
  b2b: { label: 'Box-to-Box', pos: ['ZM', 'DM'], px: 7, dx: 1, shot: 1.2, desc: 'Arbeitet von Strafraum zu Strafraum, schaltet sich in den Angriff ein.' },
  mezzala: { label: 'Mezzala', pos: ['ZM'], px: 5, pz: 1.6, shot: 1.1, desc: 'Weicht in die Halbräume aus und kommt aus der zweiten Reihe.' },
  om: { label: 'Zehner', pos: ['OM'], desc: 'Klassischer Spielmacher hinter den Spitzen.' },
  schatten: { label: 'Schattenstürmer', pos: ['OM'], px: 7, shot: 1.35, desc: 'Stößt in den Strafraum wie ein zweiter Stürmer.' },
  fluegel: { label: 'Flügelspieler', pos: ['LA', 'RA', 'LM', 'RM'], wide: 29, desc: 'Bleibt an der Seitenlinie, dribbelt und flankt.' },
  inverswing: { label: 'Inverser Flügel', pos: ['LA', 'RA', 'LM', 'RM'], pz: 0.62, shot: 1.35, drib: 0.004, desc: 'Zieht nach innen auf den starken Fuß und sucht den Abschluss.' },
  konterfl: { label: 'Konterflügel', pos: ['LA', 'RA', 'LM', 'RM'], dx: 9, desc: 'Arbeitet wenig nach hinten und lauert auf Konter.' },
  st: { label: 'Stürmer', pos: ['ST'], desc: 'Vollstrecker im Strafraum.' },
  falsche9: { label: 'Falsche Neun', pos: ['ST', 'OM'], px: -9, shot: 0.75, desc: 'Lässt sich fallen, zieht Verteidiger raus und öffnet Räume.' },
  ziel: { label: 'Zielspieler', pos: ['ST'], px: 2, pz: 0.45, desc: 'Bleibt zentral, behauptet Bälle und gewinnt Kopfbälle.' },
  konterst: { label: 'Konterstürmer', pos: ['ST'], dx: 9, px: 3, desc: 'Bleibt vorne, startet in die Tiefe.' },
};
export const DEFAULT_ROLE = { TW: 'tw', IV: 'iv', LV: 'av', RV: 'av', DM: 'sechser', ZM: 'zm', LM: 'zm', RM: 'zm', OM: 'om', LA: 'fluegel', RA: 'fluegel', ST: 'st' };
export const rolesFor = (pos) => Object.entries(ROLE_DEFS).filter(([, r]) => r.pos.includes(pos)).map(([k, r]) => ({ key: k, ...r }));
export const roleOf = (tactic, slotIndex, pos) => { const k = tactic.roles?.[slotIndex]; return ROLE_DEFS[k] && ROLE_DEFS[k].pos.includes(pos) ? k : DEFAULT_ROLE[pos]; };
export const CORNER_ROUTINES = { mix: 'Gemischt', nah: 'Erster Pfosten', fern: 'Zweiter Pfosten', kurz: 'Kurz ausführen' };
