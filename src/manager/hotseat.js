// v5.0 Hotseat: 2–4 managers share one world on one device. Every manager-specific part of the world
// (club, career, staff, youth, inbox, scouting, media …) is stored per human and swapped in when it is
// that human's turn, so the rest of the game keeps working with world.userClubId as before.
// A round = one week: every human prepares and plays his match, then the week is simulated.

export const HOT_KEYS = ['userClubId', 'coach', 'career', 'manager', 'scouting', 'youth', 'youthLeague', 'u19', 'fans', 'politics', 'staff', 'mood', 'pendingEvent',
  'challenge', 'inbox', 'inboxId', 'mgr', 'mode', 'talk', 'swipeSkip', 'pressWeek', 'pressPromise', 'achievements', 'achToast', 'achFlags',
  'userStats', 'scoutNet', 'trainingReport', 'hub', 'lastEventId', 'lastEventAt', 'ceremonies', 'rumours', 'media'];
const TRANSFER_KEYS = ['offers', 'listed', 'pending'];

const wk = (w) => `${w.season}-${w.week}`;
export const isHot = (w) => !!(w?.hot && w.hot.humans?.length > 1);
export const humans = (w) => (isHot(w) ? w.hot.humans : []);
export const activeHuman = (w) => (isHot(w) ? w.hot.humans[w.hot.active] : null);
/** Is this club managed by a human (the active one or any other hotseat player)? */
export function isHumanClub(w, id) {
  if (id == null) return false;
  if (id === w.userClubId) return true;
  return isHot(w) && w.hot.humans.some((h) => h.clubId === id);
}

function swapOut(w) {
  const h = w.hot.humans[w.hot.active], st = {};
  for (const k of HOT_KEYS) { if (k in w) st[k] = w[k]; delete w[k]; }
  st.transfer = {};
  if (w.transfer) for (const k of TRANSFER_KEYS) { st.transfer[k] = w.transfer[k]; w.transfer[k] = k === 'pending' ? null : []; }
  h.st = st;
}
function swapIn(w, i) {
  const h = w.hot.humans[i], st = h.st || {};
  for (const k of HOT_KEYS) if (k in st) w[k] = st[k];
  w.userClubId = h.clubId;
  if (w.transfer && st.transfer) for (const k of TRANSFER_KEYS) if (k in st.transfer) w.transfer[k] = st.transfer[k];
  h.st = null;
  w.hot.active = i;
}
/** Switch the world to human i (keeps everything of the current human safe). */
export function switchHuman(w, i) {
  if (!isHot(w) || i === w.hot.active) return;
  swapOut(w); swapIn(w, i);
}
/** Run fn once for every human with his state swapped in, then restore the active human. */
export function forEachHuman(w, fn) {
  if (!isHot(w)) return fn(w, 0);
  const start = w.hot.active;
  for (let i = 0; i < w.hot.humans.length; i++) { switchHuman(w, i); fn(w, i); }
  switchHuman(w, start);
}

/** Start a hotseat game: human 0 is the one already set up; the others are added with their clubs. */
export function setupHotseat(w, players) {
  // players: [{ name, clubId }] including the first (active) one
  w.hot = { humans: players.map((p) => ({ name: p.name, clubId: p.clubId, st: null, doneWeek: -1, color: p.color })), active: 0, round: 0 };
  w.userClubId = players[0].clubId;
  for (let i = 1; i < players.length; i++) {
    w.hot.humans[i].st = { userClubId: players[i].clubId, transfer: { offers: [], listed: [], pending: null } };
  }
}

/** The next human that still has to act this week, or -1. */
export function nextPending(w) {
  if (!isHot(w)) return -1;
  const H = w.hot.humans, n = H.length;
  for (let k = 1; k <= n; k++) { const i = (w.hot.active + k) % n; if (H[i].doneWeek !== wk(w)) return i; }
  return -1;
}

/**
 * The active human ends his turn. Returns { handover: index } when another human is up,
 * or { finish: true } when the week has to be simulated now (caller runs finishWeek).
 */
export function endTurn(w) {
  if (!isHot(w)) return { finish: true };
  w.hot.humans[w.hot.active].doneWeek = wk(w);
  const next = nextPending(w);
  if (next >= 0) { switchHuman(w, next); return { handover: next }; }
  switchHuman(w, 0);
  w.hot.round++;
  return { finish: true };
}

/** Scoreboard of all humans (for the handover screen and the hotseat table). */
export function hotStandings(w, computeTable) {
  return humans(w).map((h, i) => {
    const c = w.clubs[h.clubId], L = w.leagues.find((l) => l.id === c.leagueId);
    const t = computeTable(L), rank = t.findIndex((r) => r.id === c.id) + 1, row = t[rank - 1];
    return { i, name: humanName(w, i), club: c, league: L.name, rank, pts: row?.pts ?? 0, active: i === w.hot.active, done: h.doneWeek === wk(w) };
  });
}

/** Is the season over for every hotseat human (leagues can have different lengths)? */
export function allSeasonsOver(w, isUserSeasonOver) {
  if (!isHot(w)) return isUserSeasonOver(w);
  let all = true;
  forEachHuman(w, () => { if (!isUserSeasonOver(w)) all = false; });
  return all;
}

/** Display name of human i: the created manager's name, else the name typed at setup. */
export function humanName(w, i) {
  const h = w.hot.humans[i];
  const m = i === w.hot.active ? w.manager : h.st?.manager;
  return m?.looks && m.name ? m.name : h.name;
}
