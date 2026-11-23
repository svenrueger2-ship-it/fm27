// v3.1: Unity 3D mode – the manager game talks to the Unity WebGL build (GitHub Pages) through postMessage.
// The Unity side lives in unity/FM27Match (C#). Without internet or before the first Unity build exists,
// the classic Three.js mode is used instead.
import { FORMATIONS } from './tactics.js';
import { styleId, temperOf } from '../data/styles.js';

export const UNITY_URL = 'https://svenrueger2-ship-it.github.io/fm27/unity/';

const avg = (...v) => Math.round(v.filter((x) => x != null).reduce((a, b) => a + b, 0) / Math.max(1, v.filter((x) => x != null).length));
const clampI = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));

function playerSetup(p, slotPos, idx) {
  const A = p.attrs || {};
  const gk = p.pos === 'TW';
  return {
    id: p.id, name: p.lastName || p.firstName || 'Spieler', number: p.number || idx + 1, pos: slotPos || p.pos, ovr: p.ovr || 60,
    pace: avg(A.tempo, A.beschleunigung), shooting: avg(A.abschluss, A.schusskraft), passing: avg(A.passspiel, A.uebersicht),
    dribbling: avg(A.dribbling, A.ballkontrolle, A.technik), defending: avg(A.tackling, A.stellungsspiel),
    physical: avg(A.kraft, A.ausdauer, A.sprungkraft, A.kopfball), gk: gk ? avg(A.reflexe, A.fangen, A.tw_stellung, A.herauslaufen) : 20,
    fitness: p.fitness ?? 100, morale: (p.morale ?? 60) / 100, skin: p.looks?.skin || '', hair: p.looks?.hair || '',
    style: styleId(p) || '', temper: temperOf(p),
  };
}

function teamSetup(club, players) {
  const L = club.lineup, T = club.tactic || {};
  const slots = FORMATIONS[L.formation] || [];
  return {
    id: club.id, name: club.name, shortName: club.short, primary: club.colors?.primary || '#c81e1e', secondary: club.colors?.secondary || '#ffffff', keeper: '#1f7a3d',
    formation: L.formation, mentality: clampI(((T.mentality ?? 0.5) - 0.5) * 4, -2, 2), pressing: T.pressing ?? 0.5, tempo: T.tempo ?? 0.5, width: T.width ?? 0.5, lineHeight: T.line ?? 0.5,
    players: L.xi.map((id, i) => playerSetup(players[id], slots[i]?.[0], i)),
    bench: (L.bench || []).slice(0, 9).map((id, i) => playerSetup(players[id], players[id]?.pos, 11 + i)),
  };
}

export function buildUnitySetup(w, H, A, S, cond, seed) {
  return {
    match: { home: teamSetup(H, w.players), away: teamSetup(A, w.players), seed: seed >>> 0, neutral: false, weather: cond?.weather === 'regen' ? 'rain' : cond?.weather === 'schnee' ? 'snow' : 'clear', homeAdvantage: 0.03 },
    speed: typeof S.speed === 'number' ? S.speed : 1, camera: 'tv', quality: S.quality || 'hoch', night: cond?.tod ? /abend|nacht|flutlicht/i.test(cond.tod) : true,
    replays: S.replays !== false, highlights: S.highlights !== false,
    userSide: w.userClubId === H.id ? 0 : w.userClubId === A.id ? 1 : -1,
  };
}

/** Converts the Unity summary into the result format the season code expects (same as the classic engine). */
export function unityResult(summary, setup, w) {
  const side = (s) => (s === 0 ? 'h' : 'a');
  const ids = { h: setup.match.home.players.map((p) => p.id), a: setup.match.away.players.map((p) => p.id) };
  const subs = { h: [], a: [] };
  const events = [];
  for (const e of summary.events || []) {
    if (e.type === 'sub' && e.player) { subs[side(e.side)].push(e.player); if (e.assist) subs[side(e.side)].push(e.assist); } // in + out both played
    if (!['goal', 'yellow', 'red'].includes(e.type)) continue;
    events.push({ type: e.type, side: side(e.side), player: e.player || null, assist: e.assist || null, minute: e.minute, own: e.type === 'goal' && !e.player });
  }
  const ratings = {}, minutes = {};
  for (const r of summary.ratings || []) { ratings[r.id] = r.rating; minutes[r.id] = r.minutes; }
  const played = { h: [...new Set([...ids.h, ...subs.h])], a: [...new Set([...ids.a, ...subs.a])] };
  const fitness = {};
  for (const id of [...played.h, ...played.a]) {
    const p = w.players[id]; if (!p) continue;
    const mins = minutes[id] ?? 90, stam = p.attrs?.ausdauer ?? 60;
    fitness[id] = Math.round(Math.max(25, Math.min(100, (p.fitness ?? 100) - mins * 0.27 * (1.3 - stam / 140))));
  }
  const st = (S) => ({ shots: S.shots, onTarget: S.onTarget, xg: Math.round(S.xg * 100) / 100, passes: S.passes, passesOk: S.passesOk, tackles: S.tackles, fouls: S.fouls, corners: S.corners, offsides: S.offsides, yellow: S.yellow, red: S.red, saves: S.saves, possession: Math.round(S.possession) });
  const ana = (summary.ratings || []).map((r) => ({ id: r.id, min: r.minutes, heat: r.heat || [], passes: r.passes, passesOk: r.passesOk, shots: r.shots, goals: r.goals, tackles: r.tackles, saves: r.saves, rating: r.rating }));
  return { hg: summary.homeGoals, ag: summary.awayGoals, events, fitness, played, ratings, stats: [st(summary.home), st(summary.away)], ana, engine: 'unity' };
}
