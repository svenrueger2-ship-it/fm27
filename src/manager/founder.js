// Found your own club (v2.0): name, crest and kit are designed by the user; the club replaces the
// weakest team of the lowest league of the chosen country and starts with a modest squad and budget.
import { generatePlayer, marketValue } from '../data/generator.js';
import { registerCustomClubs } from '../data/customRegistry.js';
import { CRESTS } from '../data/crests.js';
import { RNG } from '../core/rng.js';
import { wScale } from './gender.js';

export const SYMBOLS = {
  none: '',
  star: '<path d="M50 30 L56 46 L73 46 L59 56 L64 72 L50 62 L36 72 L41 56 L27 46 L44 46 Z" fill="C3"/>',
  ball: '<circle cx="50" cy="52" r="17" fill="#fff" stroke="C3" stroke-width="2.5"/><path d="M50 43 L58 49 L55 58 L45 58 L42 49 Z" fill="C3"/><path d="M50 43 V36 M58 49 L65 46 M55 58 L59 65 M45 58 L41 65 M42 49 L35 46" stroke="C3" stroke-width="2"/>',
  crown: '<path d="M30 64 L33 42 L42 52 L50 36 L58 52 L67 42 L70 64 Z" fill="C3"/><rect x="30" y="64" width="40" height="6" fill="C3"/>',
  bolt: '<path d="M55 30 L36 56 L49 56 L44 76 L65 48 L52 48 Z" fill="C3"/>',
  anchor: '<circle cx="50" cy="36" r="5" fill="none" stroke="C3" stroke-width="3.5"/><path d="M50 41 V72 M38 50 H62 M32 60 C34 72 46 74 50 72 C54 74 66 72 68 60" fill="none" stroke="C3" stroke-width="4" stroke-linecap="round"/>',
  tower: '<path d="M36 74 V44 H40 V38 H45 V44 H48 V38 H52 V44 H55 V38 H60 V44 H64 V74 Z" fill="C3"/><rect x="46" y="58" width="8" height="16" rx="4" fill="C1"/>',
  wave: '<path d="M28 50 Q36 42 44 50 T60 50 T76 50 M28 62 Q36 54 44 62 T60 62 T76 62" fill="none" stroke="C3" stroke-width="4.5" stroke-linecap="round"/>',
  eagle: '<path d="M50 34 C46 40 40 42 28 40 C34 48 40 50 44 50 C38 54 34 58 32 64 C40 62 46 58 50 56 C54 58 60 62 68 64 C66 58 62 54 56 50 C60 50 66 48 72 40 C60 42 54 40 50 34 Z" fill="C3"/><circle cx="50" cy="38" r="3" fill="C1"/>',
  tree: '<path d="M50 30 L68 56 H58 L66 66 H54 V76 H46 V66 H34 L42 56 H32 Z" fill="C3"/>',
};
export const SHAPES = {
  shield: 'M50 4 L92 16 V48 C92 74 74 90 50 96 C26 90 8 74 8 48 V16 Z',
  round: 'M50 4 A46 46 0 1 0 50.01 4 Z',
  classic: 'M12 6 H88 V52 C88 76 70 92 50 96 C30 92 12 76 12 52 Z',
  diamond: 'M50 2 L96 50 L50 98 L4 50 Z',
  badge: 'M50 4 L88 12 L94 50 L80 84 L50 96 L20 84 L6 50 L12 12 Z',
};
export const DIVISIONS = ['keine', 'vertikal', 'horizontal', 'diagonal', 'streifen', 'kreuz'];

export function crestSvg(c) {
  const shape = SHAPES[c.shape] || SHAPES.shield;
  const clip = `<clipPath id="cl"><path d="${shape}"/></clipPath>`;
  let div = '';
  const C2 = c.c2;
  if (c.division === 'vertikal') div = `<rect x="50" y="0" width="50" height="100" fill="${C2}"/>`;
  else if (c.division === 'horizontal') div = `<rect x="0" y="50" width="100" height="50" fill="${C2}"/>`;
  else if (c.division === 'diagonal') div = `<path d="M0 0 L100 100 L0 100 Z" fill="${C2}"/>`;
  else if (c.division === 'streifen') div = [14, 38, 62, 86].map((x) => `<rect x="${x - 6}" y="0" width="12" height="100" fill="${C2}"/>`).join('');
  else if (c.division === 'kreuz') div = `<rect x="42" y="0" width="16" height="100" fill="${C2}"/><rect x="0" y="40" width="100" height="16" fill="${C2}"/>`;
  const sym = (SYMBOLS[c.symbol] || '').replaceAll('C3', c.c3).replaceAll('C1', c.c1);
  const txt = (c.text || '').slice(0, 4).toUpperCase();
  const year = c.year ? `<text x="50" y="${c.shape === 'round' ? 88 : 86}" text-anchor="middle" font-family="Arial,Helvetica" font-weight="700" font-size="9" fill="${c.c3}">${c.year}</text>` : '';
  const text = txt ? `<text x="50" y="${c.symbol === 'none' ? 60 : 27}" text-anchor="middle" font-family="Arial Black,Arial,Helvetica" font-weight="900" font-size="${c.symbol === 'none' ? (txt.length > 3 ? 22 : 28) : txt.length > 3 ? 12 : 15}" fill="${c.c3}" letter-spacing="1">${txt}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${clip}</defs><g clip-path="url(#cl)"><rect width="100" height="100" fill="${c.c1}"/>${div}</g><path d="${shape}" fill="none" stroke="${c.c3}" stroke-width="4"/>${sym}${text}${year}</svg>`;
}
export const crestDataUrl = (c) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(crestSvg(c))))}`;

export function shortFrom(name, world) {
  const words = name.replace(/[^A-Za-zÄÖÜäöüß0-9 ]/g, '').split(/\s+/).filter(Boolean);
  let s = (words.length >= 2 ? words.map((w) => w[0]).join('') : (words[0] || 'NEU').slice(0, 3)).toUpperCase().slice(0, 4);
  if (s.length < 2) s = (s + 'FC').slice(0, 3);
  let base = s, i = 2;
  const taken = new Set(Object.values(world.clubs).map((c) => c.short).concat(Object.keys(CRESTS)));
  while (taken.has(s)) s = `${base.slice(0, 3)}${i++}`;
  return s;
}

export const FOUND_TARGETS = [
  { id: 'de3', label: 'Deutschland · 3. Liga' },
  { id: 'de2', label: 'Deutschland · 2. Bundesliga (schwerer Start)' },
  { id: 'en2', label: 'England · Championship' },
];

// replaces the weakest club of the target league with the new club
export function foundClub(world, cfg) {
  const rng = new RNG((world.seed ^ 0x5eed) >>> 0);
  const L = world.leagues.find((l) => l.id === cfg.league) || world.leagues.find((l) => l.id === 'de3');
  const victimId = [...L.clubIds].sort((a, b) => world.clubs[a].rep - world.clubs[b].rep)[0];
  const club = world.clubs[victimId];
  for (const id of club.squad) delete world.players[id];
  const short = shortFrom(cfg.short || cfg.name, world);
  const rep = L.tier === 3 || L.id === 'de3' ? 36 : 44;
  Object.assign(club, {
    name: cfg.name, short, rep, squad: [], lineup: null, history: [], stats: { titles: 0 },
    colors: { primary: cfg.kit.primary, secondary: cfg.kit.secondary, shorts: cfg.kit.shorts, socks: cfg.kit.socks },
    away: { primary: cfg.kit.secondary, secondary: cfg.kit.primary, shorts: cfg.kit.primary, socks: cfg.kit.secondary },
    stadium: { name: cfg.stadium || `Sportpark ${cfg.city || cfg.name.split(' ').slice(-1)[0]}`, capacity: 6500, level: 1 },
    budget: 2.5e6, info: { founded: world.season, titles: null, city: cfg.city || '' },
    custom: { crest: crestDataUrl(cfg.crest), crestCfg: cfg.crest, kitStyle: cfg.kit.style, founded: world.season },
  });
  delete club.ai; delete club.biz; delete club.finance;
  // modest squad: experienced lower-league pros plus some hungry youngsters
  const country = L.country;
  const POS = ['TW', 'TW', 'TW', 'IV', 'IV', 'IV', 'IV', 'LV', 'LV', 'RV', 'RV', 'DM', 'DM', 'ZM', 'ZM', 'ZM', 'OM', 'LA', 'RA', 'LM', 'RM', 'ST', 'ST', 'ST'];
  const used = new Set();
  for (const pos of POS) {
    const age = rng.chance(0.3) ? rng.int(18, 21) : rng.int(22, 33);
    const ovr = Math.round(Math.max(50, Math.min(72, (L.id === "de3" ? 64 : 68) + rng.normal(0, 3.5) + (age < 22 ? -3 : 0))));
    const p = generatePlayer(rng, world.nextPlayerId++, pos, ovr, age, country, rep);
    if (age < 22) p.pot = Math.min(85, p.ovr + rng.int(8, 22));
    p.clubId = club.id; let n; do n = rng.int(1, 40); while (used.has(n)); used.add(n); p.number = n;
    p.contract = rng.int(1, 3); p.wage = Math.round((12000 + ovr * 900) / 1000) * 1000;
    p.value = Math.round(marketValue(p.ovr, p.age, p.pot) * wScale(p));
    world.players[p.id] = p; club.squad.push(p.id);
  }
  registerCustomClubs(world);
  return club;
}
