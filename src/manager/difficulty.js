// v5.2 Schwierigkeitsgrade. Chosen at the start of a career (w.difficulty); they scale the starting budget,
// transfer prices for the user, the board's patience and the strength of computer-controlled clubs.
export const DIFFICULTIES = {
  leicht: { label: 'Leicht', icon: '🟢', budget: 1.5, price: 0.85, board: 0.6, ai: -2.5, desc: '+50 % Startbudget, günstigere Transfers, geduldiger Vorstand, schwächere KI-Gegner' },
  normal: { label: 'Normal', icon: '🟡', budget: 1, price: 1, board: 1, ai: 0, desc: 'Das ausgewogene Spielerlebnis' },
  schwer: { label: 'Schwer', icon: '🟠', budget: 0.8, price: 1.12, board: 1.35, ai: 1.5, desc: '−20 % Startbudget, teurere Transfers, ungeduldiger Vorstand, stärkere KI' },
  legende: { label: 'Legende', icon: '🔴', budget: 0.6, price: 1.25, board: 1.75, ai: 3, desc: '−40 % Startbudget, Mondpreise, gnadenloser Vorstand, KI am Limit' },
};
export const diff = (world) => DIFFICULTIES[world?.difficulty] || DIFFICULTIES.normal;

// one-time at career start (all human clubs)
export function applyDifficulty(world, key) {
  world.difficulty = DIFFICULTIES[key] ? key : 'normal';
  const d = diff(world);
  const ids = world.hot?.humans?.map((h) => h.clubId) || [world.userClubId];
  for (const id of ids) { const c = world.clubs[id]; if (c) c.budget = Math.round((c.budget * d.budget) / 1e5) * 1e5; }
}
// strength bonus for computer clubs in the quick simulation and the live engine
export const aiEdge = (world, isHuman) => (isHuman ? 0 : diff(world).ai);
