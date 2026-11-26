// v6.0 Derbys & Choreos: famous rivalries, head-to-head records, derby atmosphere and the fan choreography
// (Blockfahne) that the home end shows before kick-off in the 3D stadium.
import { clamp } from '../core/rng.js';

export const DERBIES = [
  ['BVB', 'S04', 'Revierderby'], ['HSV', 'SVW', 'Nordderby'], ['KOE', 'BMG', 'Rheinderby'], ['FCB', 'BVB', 'Der Klassiker'], ['SGE', 'M05', 'Rhein-Main-Derby'],
  ['FCU', 'BSC', 'Berliner Stadtderby'], ['HSV', 'STP', 'Hamburger Stadtderby'], ['FCN', 'SGF', 'Frankenderby'], ['H96', 'EBS', 'Niedersachsenderby'], ['VFB', 'KSC', 'Baden-Württemberg-Derby'],
  ['BOC', 'S04', 'Revierderby'], ['BOC', 'BVB', 'Revierderby'], ['KOE', 'F95', 'Rheinderby'], ['KOE', 'VIK', 'Kölner Stadtderby'], ['MSV', 'RWE', 'Revierderby'], ['AAC', 'KOE', 'Rheinlandderby'],
  ['WOB', 'H96', 'Niedersachsenderby'], ['FCK', 'SVW2', 'Südwestderby'], ['FCM', 'SGD', 'Ostderby'], ['SGD', 'FCE', 'Ostderby'],
  ['MUN', 'MCI', 'Manchester-Derby'], ['LIV', 'EVE', 'Merseyside-Derby'], ['ARS', 'TOT', 'North London Derby'], ['LIV', 'MUN', 'Nordwest-Derby'], ['CHE', 'TOT', 'London-Derby'], ['NEW', 'SUN', 'Tyne-Wear-Derby'],
  ['AVL', 'BIR', 'Second City Derby'], ['LEE', 'MUN', 'Roses Derby'], ['WHU', 'MIL', 'Docklands-Derby'], ['SOU', 'POR', 'South Coast Derby'], ['NFO', 'DER', 'East-Midlands-Derby'], ['WBA', 'WOL', 'Black-Country-Derby'], ['SWA', 'CAR', 'South Wales Derby'], ['SHU', 'MID', 'Yorkshire-Derby'], ['BLB', 'BUR', 'East-Lancashire-Derby'], ['IPS', 'NOR', 'East-Anglian-Derby'],
  ['RMA', 'FCB2', 'El Clásico'], ['RMA', 'ATM', 'Derbi madrileño'], ['FCB2', 'ESP', 'Derbi barceloní'], ['SEV', 'BET', 'Gran Derbi'], ['ATH', 'RSO', 'Derbi vasco'], ['VAL', 'LEV', 'Derbi valenciano'], ['CEL', 'DEP', 'Derbi gallego'],
  ['INT', 'MIL2', 'Derby della Madonnina'], ['ROM', 'LAZ', 'Derby della Capitale'], ['JUV', 'TOR', 'Derby della Mole'], ['JUV', 'INT', "Derby d'Italia"], ['GEN', 'SAM', 'Derby della Lanterna'], ['NAP', 'ROM', 'Derby del Sole'], ['FIO', 'BOL2', 'Derby dell\'Appennino'],
  ['PSG', 'OM', 'Le Classique'], ['OL', 'ASM', 'Rhône-Côte-d\'Azur'], ['OM', 'NIC', 'Derby de la Côte'], ['LIL', 'RCL', 'Derby du Nord'], ['REN', 'FCL', 'Derby breton'], ['REN', 'SB29', 'Derby breton'], ['PSG', 'PFC', 'Derby parisien'],
  ['AFC', 'FEY', 'De Klassieker'], ['AFC', 'PSV', 'De Topper'], ['FEY', 'SPA', 'Rotterdamse derby'], ['FEY', 'EXC', 'Rotterdamse derby'], ['GRO', 'HEE', 'Derby van het Noorden'], ['TWE', 'GAE', 'Derby van het Oosten'],
  ['SLB', 'SPO', 'Derby de Lisboa'], ['FCP', 'SLB', 'O Clássico'], ['FCP', 'SPO', 'Clássico'], ['SCB', 'VSC', 'Derby do Minho'],
  ['GS', 'FB', 'Kıtalar Arası Derbi'], ['BJK', 'FB', 'İstanbul Derbisi'], ['GS', 'BJK', 'İstanbul Derbisi'], ['TS', 'FB', 'Karadeniz-Derby'],
  ['CFC', 'RFC', 'Old Firm'], ['HOM', 'HIB', 'Edinburgh Derby'], ['DUU', 'DFC', 'Dundee Derby'], ['ABE', 'RFC', 'Aberdeen–Rangers'],
];
const MAP = new Map();
for (const [a, b, n] of DERBIES) { MAP.set(`${a}|${b}`, n); MAP.set(`${b}|${a}`, n); }

/** Name of the derby between two clubs, or null. */
export function derbyName(world, hId, aId) {
  const H = world.clubs[hId], A = world.clubs[aId];
  if (!H || !A) return null;
  const n = MAP.get(`${H.short}|${A.short}`) || (H.menShort && A.menShort ? MAP.get(`${H.menShort}|${A.menShort}`) : null);
  if (n) return H.women ? `${n} der Frauen` : n;
  // same city counts as a local derby (e.g. promoted clubs)
  const ch = H.info?.city, ca = A.info?.city;
  if (ch && ch === ca && H.leagueId === A.leagueId) return `${ch}er Stadtderby`;
  return null;
}
export function rivalsOf(world, club) {
  const out = [];
  for (const [a, b, n] of DERBIES) {
    const other = a === club.short ? b : b === club.short ? a : null;
    if (!other) continue;
    const c = Object.values(world.clubs).find((x) => x.short === other && !x.nation);
    if (c && !out.some((o) => o.club.id === c.id)) out.push({ club: c, name: n });
  }
  return out;
}

const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
/** Head-to-head record from the view of club `id` against `other`. */
export function headToHead(world, id, other) {
  const R = world.rivalry?.[key(id, other)];
  if (!R) return { games: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, last: [] };
  const me = id < other ? 'a' : 'b', you = me === 'a' ? 'b' : 'a';
  return { games: R.games, w: R[me + 'w'], d: R.d, l: R[you + 'w'], gf: R[me + 'g'], ga: R[you + 'g'], last: R.last || [], biggest: R.big };
}

/** Called after every derby (league or cup, simulated or live). Returns the derby name or null. */
export function recordDerby(world, m) {
  const name = derbyName(world, m.h, m.a);
  if (!name || m.hg == null || m.friendly) return null;
  world.rivalry ||= {};
  const k = key(m.h, m.a), R = (world.rivalry[k] ||= { games: 0, aw: 0, bw: 0, d: 0, ag: 0, bg: 0, last: [] });
  const hSide = m.h < m.a ? 'a' : 'b', aSide = hSide === 'a' ? 'b' : 'a';
  R.games++; R[hSide + 'g'] += m.hg; R[aSide + 'g'] += m.ag;
  if (m.hg > m.ag) R[hSide + 'w']++; else if (m.ag > m.hg) R[aSide + 'w']++; else R.d++;
  R.last.unshift({ s: world.season, h: m.h, a: m.a, hg: m.hg, ag: m.ag }); R.last = R.last.slice(0, 8);
  const margin = Math.abs(m.hg - m.ag);
  if (!R.big || margin > Math.abs(R.big.hg - R.big.ag)) R.big = { s: world.season, h: m.h, a: m.a, hg: m.hg, ag: m.ag };
  // the derby result moves the whole squad and the fans much more than a normal match
  const uid = world.userClubId;
  if (uid === m.h || uid === m.a) {
    const d = uid === m.h ? m.hg - m.ag : m.ag - m.hg;
    const club = world.clubs[uid];
    for (const id of club.squad) { const p = world.players[id]; if (p) p.morale = clamp(p.morale + (d > 0 ? 4 : d < 0 ? -4 : 0), 10, 99); }
    if (world.mood) world.mood.fans = clamp((world.mood.fans ?? 60) + (d > 0 ? 5 : d < 0 ? -5 : 1), 0, 100);
    const opp = world.clubs[uid === m.h ? m.a : m.h];
    world.news?.unshift({ season: world.season, week: world.week + 1, text: d > 0 ? `🔥 ${name} gewonnen! ${m.hg}:${m.ag} – die Stadt gehört uns. Die Fans feiern bis in die Nacht.` : d < 0 ? `💔 ${name} verloren (${m.hg}:${m.ag}). Gegen ${opp.name} tut das doppelt weh.` : `⚖️ ${name} endet ${m.hg}:${m.ag} – keiner hat die Stadt erobert.` });
  }
  return name;
}

// ------------------------------------------------------------------ choreography
export const CHOREO_STYLES = { wappen: 'Wappen-Blockfahne', streifen: 'Streifen', schriftzug: 'Schriftzug', karo: 'Karo-Mosaik', herz: 'Herz', sterne: 'Sterne & Titel', schal: 'Schalparade' };
export const CHOREO_WHEN = { derby: 'Nur bei Derbys', top: 'Derbys & Topspiele', immer: 'Bei jedem Heimspiel' };
export function defaultChoreo(club) {
  return { style: 'wappen', c1: club.colors?.primary || '#c00', c2: club.colors?.secondary || '#fff', c3: '#f5c542', text: (club.name || '').toUpperCase().slice(0, 28), pyro: true, when: 'top' };
}
/** Does the home club show its choreo in this match? (`cup` and `big` from the match screen) */
export function choreoActive(world, home, away, { big = false } = {}) {
  const c = home.choreo || (derbyName(world, home.id, away.id) ? defaultChoreo(home) : null);
  if (!c) return null;
  const derby = !!derbyName(world, home.id, away.id);
  const on = c.when === 'immer' || (c.when === 'top' && (derby || big)) || (c.when === 'derby' && derby) || (!home.choreo && derby);
  return on ? c : null;
}

/** Draws the choreo onto a canvas (2:… landscape). `crestImg` is an optional loaded image of the club crest. */
export function drawChoreo(cv, cfg, club, crestImg) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const c1 = cfg.c1, c2 = cfg.c2, c3 = cfg.c3;
  g.fillStyle = c1; g.fillRect(0, 0, W, H);
  const text = (cfg.text || '').toUpperCase();
  const bigText = (t, y, size, col) => {
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    let s = size; g.font = `900 ${s}px "Barlow Condensed", Impact, sans-serif`;
    while (g.measureText(t).width > W * 0.9 && s > 20) { s -= 4; g.font = `900 ${s}px "Barlow Condensed", Impact, sans-serif`; }
    g.fillText(t, W / 2, y);
  };
  if (cfg.style === 'streifen') {
    const n = 14; for (let i = 0; i < n; i += 2) { g.fillStyle = c2; g.fillRect((i * W) / n, 0, W / n, H); }
    g.fillStyle = c1; g.fillRect(0, H * 0.62, W, H * 0.3);
    if (text) bigText(text, H * 0.77, H * 0.24, c2);
  } else if (cfg.style === 'karo') {
    const s = H / 6; for (let y = 0; y < 6; y++) for (let x = 0; x < W / s; x++) if ((x + y) % 2) { g.fillStyle = c2; g.fillRect(x * s, y * s, s, s); }
    if (text) { g.fillStyle = c1; g.fillRect(W * 0.1, H * 0.36, W * 0.8, H * 0.28); bigText(text, H * 0.5, H * 0.22, c3); }
  } else if (cfg.style === 'herz') {
    g.fillStyle = c2; const cx = W / 2, cy = H * 0.46, r = H * 0.26;
    g.beginPath(); g.moveTo(cx, cy + r * 1.3); g.bezierCurveTo(cx - r * 2.2, cy - r * 0.2, cx - r * 0.9, cy - r * 1.6, cx, cy - r * 0.5);
    g.bezierCurveTo(cx + r * 0.9, cy - r * 1.6, cx + r * 2.2, cy - r * 0.2, cx, cy + r * 1.3); g.fill();
    if (text) bigText(text, H * 0.88, H * 0.16, c3);
  } else if (cfg.style === 'sterne') {
    g.fillStyle = c2; g.fillRect(0, 0, W, H * 0.12); g.fillRect(0, H * 0.88, W, H * 0.12);
    const n = Math.max(1, Math.min(9, cfg.stars || 3));
    for (let i = 0; i < n; i++) star(g, W / 2 + (i - (n - 1) / 2) * H * 0.22, H * 0.34, H * 0.09, c3);
    if (text) bigText(text, H * 0.66, H * 0.22, c2);
  } else if (cfg.style === 'schal') {
    for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(0, (i * H) / 9, W, H / 9); }
    if (text) { g.fillStyle = c1; g.fillRect(W * 0.18, H * 0.33, W * 0.64, H * 0.34); bigText(text, H * 0.5, H * 0.24, c2); }
  } else if (cfg.style === 'schriftzug') {
    g.fillStyle = c2; g.fillRect(0, H * 0.08, W, H * 0.04); g.fillRect(0, H * 0.88, W, H * 0.04);
    bigText(text || club?.short || 'FM27', H * 0.5, H * 0.52, c2);
  } else { // wappen
    g.fillStyle = c2; g.fillRect(0, 0, W * 0.08, H); g.fillRect(W * 0.92, 0, W * 0.08, H);
    const s = H * 0.62;
    if (crestImg) g.drawImage(crestImg, W / 2 - s / 2, H * 0.05, s, s);
    else { g.fillStyle = c2; g.beginPath(); g.arc(W / 2, H * 0.36, s * 0.42, 0, Math.PI * 2); g.fill(); bigText(club?.short || '', H * 0.36, s * 0.36, c1); }
    if (text) bigText(text, H * 0.82, H * 0.2, c2);
  }
  return cv;
}
function star(g, x, y, r, col) {
  g.fillStyle = col; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
