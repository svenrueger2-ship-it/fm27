// v3.4: per-player analysis from live 3D matches (classic, Unity and Unreal) – heatmap and per-90 values.
// Stored on the player (p.ana) for players of the user's club only, to keep save games small.

/** entries: [{ id, min, heat:[96], passes, passesOk, shots, goals, tackles, saves, rating }] */
export function recordPlayerAna(world, entries) {
  const club = world.clubs[world.userClubId];
  if (!club) return;
  const mine = new Set(club.squad);
  for (const e of entries || []) {
    const p = world.players[e.id];
    if (!p || !mine.has(e.id) || !(e.min > 0)) continue;
    const A = (p.ana ||= { g: 0, min: 0, heat: new Array(96).fill(0), pas: 0, pok: 0, sh: 0, gl: 0, tk: 0, sv: 0, rt: 0 });
    A.g++; A.min += e.min; A.pas += e.passes || 0; A.pok += e.passesOk || 0; A.sh += e.shots || 0; A.gl += e.goals || 0; A.tk += e.tackles || 0; A.sv += e.saves || 0; A.rt += e.rating || 6;
    (e.heat || []).forEach((v, i) => { if (i < 96) A.heat[i] += v; });
  }
}

/** Classic three.js engine: entries from the engine's players and its per-second position samples. */
export function classicEntries(T) {
  const P = T.analysis?.pos || {};
  const maxN = Math.max(1, ...Object.values(P).map((s) => s.n));
  return (T.players || []).filter((p) => P[p.id]).map((p) => ({
    id: p.id, min: Math.round((P[p.id].n / maxN) * 90), heat: P[p.id].heat || [],
    passes: p.stats.passes, passesOk: p.stats.passesOk, shots: p.stats.shots, goals: p.stats.goals, tackles: p.stats.tackles, saves: p.stats.saves, rating: p.rating,
  }));
}

/** Readable values for UI (per 90 minutes). */
export function anaSummary(p) {
  const A = p?.ana;
  if (!A || !A.g || A.min < 1) return null;
  const per90 = (v) => (v / A.min) * 90;
  return {
    games: A.g, min: A.min, rating: A.rt / A.g,
    passes90: per90(A.pas), passPct: A.pas ? (A.pok / A.pas) * 100 : 0, shots90: per90(A.sh), goals: A.gl, tackles90: per90(A.tk), saves90: per90(A.sv), heat: A.heat,
  };
}

/** Small heatmap SVG (team attacks to the right). */
export function heatSvg(heat, color = '#7c5cff') {
  const mx = Math.max(1, ...heat);
  const cells = heat.map((v, i) => (v ? `<rect x="${(i % 12) * 10}" y="${Math.floor(i / 12) * 10}" width="10" height="10" fill="${color}" opacity="${(0.08 + (v / mx) * 0.82).toFixed(2)}"/>` : '')).join('');
  return `<svg class="mini-heat" viewBox="-2 -2 124 84"><rect x="-2" y="-2" width="124" height="84" rx="3" fill="#1d5a2a"/>${cells}
    <g fill="none" stroke="rgba(255,255,255,.7)" stroke-width=".6"><rect x="0" y="0" width="120" height="80"/><line x1="60" y1="0" x2="60" y2="80"/><circle cx="60" cy="40" r="10"/>
    <rect x="0" y="22" width="18" height="36"/><rect x="102" y="22" width="18" height="36"/></g><text x="114" y="-3.2" font-size="4" fill="rgba(255,255,255,.6)" text-anchor="end">Angriff →</text></svg>`;
}
