// Opponent analysis (v1.0): what the assistant coach finds out about the next opponent.
// Depth of the report grows with the assistant's quality.
import { autoLineup, teamStrength, FORMATIONS } from '../match/tactics.js';
import { computeTable } from './season.js';
import { staffQ } from './staff.js';

const GROUP = { TW: 'Tor', IV: 'Abwehr', LV: 'Abwehr', RV: 'Abwehr', DM: 'Mittelfeld', ZM: 'Mittelfeld', LM: 'Mittelfeld', RM: 'Mittelfeld', OM: 'Angriff', LA: 'Angriff', RA: 'Angriff', ST: 'Angriff' };

export function opponentReport(world, oppId) {
  const opp = world.clubs[oppId], me = world.clubs[world.userClubId];
  const q = staffQ(world, 'assistant');
  const L = autoLineup(opp, world.players, opp.tactic.formation);
  const slots = FORMATIONS[L.formation];
  const xi = L.xi.map((id, i) => ({ p: world.players[id], slot: slots[i][0] })).filter((x) => x.p);
  const groups = {};
  for (const x of xi) (groups[GROUP[x.slot]] ||= []).push(x.p.ovr);
  const avg = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]));
  const sorted = Object.entries(avg).filter(([k]) => k !== 'Tor').sort((a, b) => b[1] - a[1]);
  const danger = xi.filter((x) => GROUP[x.slot] === 'Angriff' || GROUP[x.slot] === 'Mittelfeld').map((x) => x.p).sort((a, b) => (b.stats.goals * 2 + b.stats.assists + b.ovr / 4) - (a.stats.goals * 2 + a.stats.assists + a.ovr / 4))[0];
  const lg = world.leagues.find((l) => l.clubIds.includes(oppId));
  const row = computeTable(lg).find((r) => r.id === oppId);
  const T = opp.tactic;
  const style = [];
  if (T.pressing > 0.65) style.push('presst sehr hoch');
  else if (T.pressing < 0.35) style.push('lauert tief und kompakt');
  if (T.directness > 0.6) style.push('spielt schnell und vertikal');
  else if (T.directness < 0.35) style.push('kontrolliert das Spiel mit kurzen Pässen');
  if (T.line > 0.65) style.push('steht mit der Abwehr sehr hoch');
  if (T.width > 0.65) style.push('kommt viel über die Flügel');
  const tips = [];
  if (T.line > 0.6) tips.push('Schnelle Stürmer und direkte Bälle hinter die Kette (Passspiel „direkt“, Konterstürmer).');
  if (T.pressing > 0.65) tips.push('Gegen das Pressing hilft ein mitspielender Torwart oder lange Bälle auf einen Zielspieler.');
  if (T.pressing < 0.35 && T.line < 0.45) tips.push('Gegen einen tiefen Block: Geduld, Breite, Schattenstürmer und Flanken auf starke Kopfballspieler.');
  if (sorted.length && sorted[sorted.length - 1][0] === 'Abwehr') tips.push('Die Abwehr ist ihr schwächster Mannschaftsteil – mutig nach vorne spielen.');
  if (danger && q >= 2) tips.push(`${danger.lastName} eng decken – er ist ihr gefährlichster Mann.`);
  const sOpp = teamStrength(opp, world.players), sMe = teamStrength(me, world.players);
  return {
    club: opp, formation: L.formation, preset: T.preset || 'Individuell', style, avg, strongest: sorted[0]?.[0], weakest: sorted[sorted.length - 1]?.[0],
    danger: q >= 2 ? danger : null, form: q >= 3 && row ? row.form.slice(-5) : null, rank: row ? computeTable(lg).indexOf(row) + 1 : null,
    coach: opp.ai?.coach || null, tips: tips.slice(0, q >= 4 ? 4 : q >= 3 ? 3 : 2), quality: q, strength: Math.round(sOpp), mine: Math.round(sMe),
  };
}

// v4.0: concrete tactic proposal from the opponent report – the user can take it over with one tap.
export function suggestTactic(world, R) {
  const me = world.clubs[world.userClubId], T = R.club.tactic, cur = me.tactic;
  const ch = {}, why = [];
  const fav = R.mine - R.strength;
  if (T.line > 0.6) { ch.directness = 0.75; ch.tempo = 0.75; why.push('Hohe Abwehr → direkt und schnell hinter die Kette'); }
  else if (T.pressing < 0.35 && T.line < 0.45) { ch.width = 0.8; ch.tempo = 0.4; ch.directness = 0.3; why.push('Tiefer Block → Breite und Geduld'); }
  if (T.pressing > 0.65) { ch.directness = Math.max(ch.directness ?? 0, 0.65); why.push('Hohes Pressing → Pressing mit langen Bällen überspielen'); }
  if (T.width > 0.65) { ch.compactness = 0.7; why.push('Flügelspiel → kompakt verschieben'); }
  if (fav < -5) { ch.mentality = 0.35; ch.pressing = 0.35; ch.line = 0.35; why.push('Gegner klar stärker → tiefer stehen, kontern'); }
  else if (fav > 5) { ch.mentality = 0.65; ch.pressing = 0.7; why.push('Wir sind Favorit → mutig, früh anlaufen'); }
  if (R.weakest === 'Abwehr' && fav > -5) { ch.mentality = Math.max(ch.mentality ?? 0.5, 0.6); why.push('Schwache Abwehr → offensiver'); }
  const changes = Object.fromEntries(Object.entries(ch).filter(([k, v]) => Math.abs((cur[k] ?? 0.5) - v) > 0.06));
  return { changes, why: why.slice(0, R.quality >= 3 ? 4 : 2) };
}

export const TACTIC_LABEL = { mentality: 'Mentalität', pressing: 'Pressing', line: 'Abwehrlinie', width: 'Breite', tempo: 'Tempo', directness: 'Direktheit', compactness: 'Kompaktheit' };
