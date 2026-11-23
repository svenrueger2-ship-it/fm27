// v4.0: team talks before kick-off and at half-time. The squad reacts depending on the situation
// (favourite/underdog, score, form), its personalities (hot-heads, leaders) and the manager's standing.
// The reaction changes the players' morale and a match focus that every engine reads:
// calm (decision noise, <1 = better), work (top speed / intensity) and foul (temperament on the pitch).
import { clamp } from '../core/rng.js';
import { temperOf, isLeader } from '../data/styles.js';

export const TALKS = {
  heiss: { icon: '🔥', name: 'Heiß machen', desc: 'Emotionen, Kampf, Leidenschaft' },
  ruhe: { icon: '🧘', name: 'Ruhe & Fokus', desc: 'Konzentriert bleiben, Plan durchziehen' },
  druck: { icon: '😤', name: 'Klare Ansage', desc: 'Kritik, mehr Einsatz einfordern' },
  lob: { icon: '👏', name: 'Loben', desc: 'Stärken betonen, Selbstvertrauen geben' },
  vertrauen: { icon: '🤝', name: 'Vertrauen', desc: 'Ohne Druck – ihr könnt das' },
};

const REACT = [
  { min: 0.62, key: 'top', label: 'begeistert', icon: '🤩', morale: 5, focus: { calm: 0.8, work: 1.05, fam: 0.06, foul: 1 } },
  { min: 0.22, key: 'gut', label: 'motiviert', icon: '💪', morale: 2, focus: { calm: 0.9, work: 1.02, fam: 0.03, foul: 1 } },
  { min: -0.2, key: 'neutral', label: 'gleichgültig', icon: '😐', morale: 0, focus: { calm: 1, work: 1, foul: 1 } },
  { min: -9, key: 'schlecht', label: 'verunsichert', icon: '😟', morale: -4, focus: { calm: 1.2, work: 0.97, fam: -0.06, foul: 1 } },
];

/**
 * ctx: { diff: own strength − opponent strength, lead: goal difference (half-time, else 0),
 *        half: true at half-time, form: +1 / 0 / −1, rep: manager reputation 0..100 }
 */
export function talkFit(key, ctx, players) {
  const { diff = 0, lead = 0, half = false, form = 0, rep = 50 } = ctx;
  const n = Math.max(1, players.length);
  const temper = players.reduce((s, p) => s + temperOf(p), 0) / n;
  const leaders = players.filter(isLeader).length;
  const fav = clamp(diff / 8, -1, 1); // >0 favourite
  let s = 0;
  if (key === 'heiss') s = 0.35 - fav * 0.45 + (half && lead < 0 ? 0.35 : 0) - (half && lead > 1 ? 0.3 : 0) - temper * 0.25;
  if (key === 'ruhe') s = 0.15 + fav * 0.35 + (half && lead > 0 ? 0.35 : 0) - (half && lead < 0 ? 0.25 : 0) + temper * 0.3;
  if (key === 'druck') s = -0.15 + (half && lead < 0 ? 0.55 : 0) + (form < 0 ? 0.3 : 0) - (form > 0 ? 0.35 : 0) - (half && lead > 0 ? 0.4 : 0) + (rep - 50) / 100 - temper * 0.35 + leaders * 0.08;
  if (key === 'lob') s = 0.05 + (form > 0 ? 0.35 : 0) + (half && lead > 0 ? 0.3 : 0) - (half && lead > 1 ? 0.35 : 0) - (half && lead < 0 ? 0.4 : 0) - fav * 0.15;
  if (key === 'vertrauen') s = 0.22 - Math.abs(fav) * 0.12 + leaders * 0.05;
  return s;
}

/** Hint for the UI: how the assistant reads the room (no exact numbers). */
export function talkHint(ctx, players) {
  const best = Object.keys(TALKS).map((k) => [k, talkFit(k, ctx, players)]).sort((a, b) => b[1] - a[1])[0][0];
  const temper = players.reduce((s, p) => s + temperOf(p), 0) / Math.max(1, players.length);
  const bits = [];
  if (ctx.half) bits.push(ctx.lead > 0 ? 'Wir führen' : ctx.lead < 0 ? 'Wir liegen hinten' : 'Es steht unentschieden');
  else bits.push(ctx.diff > 3 ? 'Wir sind Favorit' : ctx.diff < -3 ? 'Wir sind Außenseiter' : 'Ein Spiel auf Augenhöhe');
  if (temper > 0.5) bits.push('viele Hitzköpfe in der Kabine');
  if (players.some(isLeader)) bits.push('ein Führungsspieler hilft');
  return { text: bits.join(', ') + '.', best };
}

/** Hold the talk: returns { reaction, focus, best[], worst[] } and changes the players' morale. */
export function holdTalk(key, ctx, players, rng) {
  const base = talkFit(key, ctx, players);
  const res = { key, per: [], focus: null, reaction: null };
  let sum = 0;
  for (const p of players) {
    // every player reacts a little differently: hot-heads to emotion, professionals to calm words
    const t = temperOf(p);
    let s = base + rng.normal(0, 0.22);
    if (key === 'heiss') s += (t - 0.4) * 0.3;
    if (key === 'druck' && (p.personality === 'Launisch' || (p.morale ?? 60) < 40)) s -= 0.35;
    if (key === 'ruhe' && p.personality === 'Professionell') s += 0.15;
    if (key === 'lob' && p.personality === 'Lässig') s -= 0.2;
    const r = REACT.find((x) => s >= x.min);
    p.morale = clamp(Math.round((p.morale ?? 60) + r.morale * (ctx.half ? 0.6 : 1)), 0, 99);
    res.per.push({ id: p.id, r: r.key });
    sum += s;
  }
  const avg = sum / Math.max(1, players.length);
  const R = REACT.find((x) => avg >= x.min);
  res.reaction = { key: R.key, label: R.label, icon: R.icon };
  res.focus = { ...R.focus };
  if (key === 'heiss') res.focus.foul = 1.12; // fired-up teams go in harder
  if (key === 'ruhe') res.focus.foul = 0.92;
  return res;
}

export const reactionText = (res) => ({
  top: 'Die Mannschaft ist voll da – man spürt die Energie in der Kabine.',
  gut: 'Die Spieler nicken, die Botschaft ist angekommen.',
  neutral: 'Die Worte verpuffen, die Spieler wirken abwesend.',
  schlecht: 'Unruhe in der Kabine – einige Spieler wirken verunsichert.',
})[res.reaction.key];
