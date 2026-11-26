// v7.0 Vereinsmuseum: trophy room, club chronicle, legends wall, shirt gallery of every season and
// retired shirt numbers – everything your club has achieved in the game, in one walk-through 3D hall.
import { hallOfFame } from './media.js';

export function trophies(world, club) {
  const out = [];
  for (const h of club.history || []) if (h.champion) out.push({ kind: h.tier === 1 ? 'liga' : 'aufstieg', title: `Meister ${h.league}`, season: h.season });
  for (const t of world.career?.titles || []) {
    if (t.clubId !== club.id || /^Meister /.test(t.title)) continue;
    out.push({ kind: /Champions|Europa|Conference|Super/.test(t.title) ? 'europa' : 'pokal', title: t.title, season: t.season });
  }
  for (const c of world.u19?.champions || []) if (c.club === club.id) out.push({ kind: 'jugend', title: 'U19-Meister', season: c.season });
  if (world.u19?.cup?.winner === club.id) out.push({ kind: 'jugend', title: world.u19.cup.name, season: world.season });
  return out.sort((a, b) => a.season - b.season);
}
export const legendsOf = (world, club) => hallOfFame(world).filter((l) => l.club === club.id).slice(0, 12);

/** shirt of every season (recorded at the end of the season, plus the current one) */
export function kitGallery(club, season) {
  const list = (club.kitHistory || []).slice();
  list.push({ season, colors: { ...club.colors }, current: true });
  return list.slice(-12);
}
export function recordKit(world, club) {
  club.kitHistory ||= [];
  if (!club.kitHistory.some((k) => k.season === world.season)) club.kitHistory.push({ season: world.season, colors: { ...club.colors } });
}

export function canRetire(world, club, legend) {
  if ((club.retired || []).some((r) => r.id === legend.id)) return { ok: false, msg: 'Seine Nummer hängt schon unter dem Dach.' };
  if (legend.seasons < 3 && legend.titles < 2) return { ok: false, msg: 'Erst ab drei Saisons oder zwei Titeln im Verein.' };
  const p = world.players[legend.id];
  if (p && p.clubId === club.id) return { ok: false, msg: 'Er spielt noch für den Verein.' };
  return { ok: true };
}
export function retireNumber(world, club, legend) {
  const c = canRetire(world, club, legend); if (!c.ok) return c;
  const num = legend.number ?? world.players[legend.id]?.number ?? null;
  if (!num || num === 1) return { ok: false, msg: 'Keine Rückennummer bekannt.' };
  if ((club.retired || []).some((r) => r.num === num)) return { ok: false, msg: `Die ${num} ist schon gesperrt.` };
  (club.retired ||= []).push({ id: legend.id, num, name: legend.name, season: world.season });
  (world.news ||= []).unshift({ season: world.season, week: world.week + 1, text: `🎽 Zu Ehren von ${legend.name}: Die Nummer ${num} wird bei ${club.short} nie wieder vergeben.` });
  return { ok: true, msg: `Nummer ${num} gesperrt` };
}
export const retiredSet = (club) => new Set((club?.retired || []).map((r) => r.num));
