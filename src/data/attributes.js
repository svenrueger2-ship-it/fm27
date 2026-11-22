// Attribute & position definitions shared by manager and match engine.
export const OUTFIELD_ATTRS = [
  ['tempo', 'Tempo'], ['beschleunigung', 'Beschleunigung'], ['ausdauer', 'Ausdauer'], ['kraft', 'Kraft'],
  ['abschluss', 'Abschluss'], ['schusskraft', 'Schusskraft'], ['passspiel', 'Passspiel'], ['uebersicht', 'Übersicht'],
  ['technik', 'Technik'], ['dribbling', 'Dribbling'], ['ballkontrolle', 'Ballkontrolle'], ['tackling', 'Tackling'],
  ['stellungsspiel', 'Stellungsspiel'], ['kopfball', 'Kopfball'], ['sprungkraft', 'Sprungkraft'],
];
export const GK_ATTRS = [
  ['reflexe', 'Reflexe'], ['fangen', 'Fangsicherheit'], ['herauslaufen', 'Herauslaufen'],
  ['tw_stellung', 'TW-Stellungsspiel'], ['abschlag', 'Abschlag/Abwurf'],
];

export const POSITIONS = {
  TW: { name: 'Torwart', group: 'TW' },
  IV: { name: 'Innenverteidiger', group: 'ABW' },
  LV: { name: 'Linker Verteidiger', group: 'ABW' },
  RV: { name: 'Rechter Verteidiger', group: 'ABW' },
  DM: { name: 'Defensives Mittelfeld', group: 'MF' },
  ZM: { name: 'Zentrales Mittelfeld', group: 'MF' },
  OM: { name: 'Offensives Mittelfeld', group: 'MF' },
  LM: { name: 'Linkes Mittelfeld', group: 'MF' },
  RM: { name: 'Rechtes Mittelfeld', group: 'MF' },
  LA: { name: 'Linksaußen', group: 'ANG' },
  RA: { name: 'Rechtsaußen', group: 'ANG' },
  ST: { name: 'Stürmer', group: 'ANG' },
};
export const POS_ORDER = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'LM', 'RM', 'OM', 'LA', 'RA', 'ST'];

// Weights for overall rating per position
export const POS_WEIGHTS = {
  IV: { tackling: 3, stellungsspiel: 3, kopfball: 2, kraft: 2, sprungkraft: 1, tempo: 1, passspiel: 1, ballkontrolle: 0.5 },
  LV: { tempo: 2, beschleunigung: 1.5, tackling: 2, stellungsspiel: 2, passspiel: 1.5, ausdauer: 1.5, dribbling: 1, ballkontrolle: 1 },
  RV: { tempo: 2, beschleunigung: 1.5, tackling: 2, stellungsspiel: 2, passspiel: 1.5, ausdauer: 1.5, dribbling: 1, ballkontrolle: 1 },
  DM: { tackling: 2.5, stellungsspiel: 2.5, passspiel: 2.5, uebersicht: 1.5, kraft: 1.5, ausdauer: 1.5, ballkontrolle: 1 },
  ZM: { passspiel: 3, uebersicht: 2.5, ballkontrolle: 2, technik: 1.5, ausdauer: 1.5, dribbling: 1, tackling: 1, schusskraft: 0.5 },
  OM: { passspiel: 2.5, uebersicht: 2.5, technik: 2.5, dribbling: 2, ballkontrolle: 2, abschluss: 1.5, beschleunigung: 1 },
  LM: { tempo: 2, passspiel: 2, dribbling: 2, ausdauer: 1.5, technik: 1.5, ballkontrolle: 1.5, beschleunigung: 1 },
  RM: { tempo: 2, passspiel: 2, dribbling: 2, ausdauer: 1.5, technik: 1.5, ballkontrolle: 1.5, beschleunigung: 1 },
  LA: { tempo: 2.5, beschleunigung: 2, dribbling: 2.5, technik: 2, abschluss: 1.5, ballkontrolle: 1.5, passspiel: 1 },
  RA: { tempo: 2.5, beschleunigung: 2, dribbling: 2.5, technik: 2, abschluss: 1.5, ballkontrolle: 1.5, passspiel: 1 },
  ST: { abschluss: 3.5, schusskraft: 1.5, kopfball: 1.5, tempo: 1.5, beschleunigung: 1.5, ballkontrolle: 1.5, stellungsspiel: 1, kraft: 1, dribbling: 1 },
  TW: { reflexe: 3, fangen: 2.5, tw_stellung: 3, herauslaufen: 1.5, abschlag: 1, sprungkraft: 0.5 },
};

export function computeOverall(attrs, pos) {
  const w = POS_WEIGHTS[pos];
  let sum = 0, tw = 0;
  for (const k in w) { sum += (attrs[k] ?? 50) * w[k]; tw += w[k]; }
  return Math.round(sum / tw);
}

// Which positions a player can play reasonably (for lineup auto-pick)
export const POS_COMPAT = {
  TW: ['TW'], IV: ['IV', 'DM'], LV: ['LV', 'LM', 'IV'], RV: ['RV', 'RM', 'IV'], DM: ['DM', 'ZM', 'IV'],
  ZM: ['ZM', 'DM', 'OM'], OM: ['OM', 'ZM', 'ST'], LM: ['LM', 'LA', 'LV'], RM: ['RM', 'RA', 'RV'],
  LA: ['LA', 'LM', 'ST', 'RA'], RA: ['RA', 'RM', 'ST', 'LA'], ST: ['ST', 'OM', 'LA', 'RA'],
};
