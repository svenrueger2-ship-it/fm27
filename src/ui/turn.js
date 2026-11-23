// v5.0: one place where the user's week ends. Single player: simulate the week. Hotseat: hand the
// device to the next manager first; the week is simulated once everybody has played.
import { finishWeek, newRng } from '../manager/season.js';
import { isHot, endTurn } from '../manager/hotseat.js';

export async function endWeek(app, after = 'calendar') {
  const w = app.world;
  if (isHot(w)) {
    const r = endTurn(w);
    if (r.handover != null) { if ((w.day || 0) > 6) w.day = 6; await app.autosave(); app.go('hotTurn', { reason: 'turn' }); return 'handover'; }
    finishWeek(w, newRng(w));
    await app.autosave();
    app.go('hotTurn', { reason: 'week' });
    return 'week';
  }
  finishWeek(w, newRng(w));
  await app.autosave();
  if (after) app.go(after);
  return 'week';
}
