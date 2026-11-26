// Stadium builder: every club owns a stadium layout (four stands with size, tiers, standing/seating,
// roof and VIP boxes plus floodlights, video walls, pitch and naming rights). Changes are construction
// projects that cost money and take weeks; while a stand is being rebuilt it holds fewer spectators.
// The same layout drives the capacity, matchday income and the 3D stadium.
import { clamp } from '../core/rng.js';
import { wScale } from './gender.js';

export const STAND_NAMES = ['Haupttribüne', 'Gegengerade', 'Heimkurve', 'Gästekurve'];
// v5.2: stands can carry their own names (e.g. "Südtribüne", "Uwe-Seeler-Tribüne")
export const standName = (club, i) => club?.stadium?.layout?.stands?.[i]?.name || STAND_NAMES[i];

// v5.2: interior fit-out (Innenausbau). Each level is a small construction project.
export const INTERIOR = [
  { key: 'catering', icon: '🍺', name: 'Gastronomie & Catering', max: 3, cost: 1.4e6, weeks: 3, desc: 'Mehr Kioske, Bierstände und ein Restaurant: Einnahmen an jedem Heimspiel' },
  { key: 'shop', icon: '🛍️', name: 'Fanshop im Stadion', max: 3, cost: 1.1e6, weeks: 3, desc: 'Trikots und Schals direkt am Spieltag: Matchday- und Merchandising-Einnahmen' },
  { key: 'fanzone', icon: '🎪', name: 'Fan-Zone & Biergarten', max: 2, cost: 1.8e6, weeks: 4, desc: 'Treffpunkt vor dem Anpfiff: bessere Stimmung, stabilere Zuschauerzahlen' },
  { key: 'museum', icon: '🏆', name: 'Vereinsmuseum & Stadionführung', max: 2, cost: 2.5e6, weeks: 6, desc: 'Pokale, Geschichte, Führungen: Einnahmen auch ohne Spiel, mehr Stimmung' },
  { key: 'wlan', icon: '📶', name: 'Stadion-WLAN & Vereins-App', max: 2, cost: 0.9e6, weeks: 2, desc: 'Bezahlen per App, Live-Daten: mehr Sponsoren- und Catering-Erlöse' },
  { key: 'presse', icon: '🎙️', name: 'Medienzentrum', max: 2, cost: 1.3e6, weeks: 3, desc: 'Moderne Pressekonferenz und TV-Studio: höhere Sponsoren-Einnahmen' },
  { key: 'kabine', icon: '🚿', name: 'Kabinentrakt & Regeneration', max: 3, cost: 1.6e6, weeks: 4, desc: 'Eisbecken, Sauna, Taktikraum: Spieler regenerieren nach Heimspielen schneller' },
];
export const interiorLevel = (club, key) => club.stadium.layout.interior?.[key] || 0;
export function interiorOptions(club) {
  const out = [];
  for (const it of INTERIOR) {
    const lv = interiorLevel(club, it.key);
    const busy = club.stadium.projects.some((p) => p.key === 'interior' && p.to === it.key);
    out.push({ ...it, level: lv, busy, done: lv >= it.max, opt: lv >= it.max || busy ? null : { key: 'interior', to: it.key, label: `${it.name} Stufe ${lv + 1}`, cost: Math.round(it.cost * (lv + 1) * (1 + lv * 0.35) / 1e5) * 1e5, weeks: it.weeks + lv } });
  }
  return out;
}
// extra income at every home game from the interior
export function interiorIncome(club) {
  const L = (k) => interiorLevel(club, k), r = club.rep || 50;
  return Math.round((L('catering') * 1 + L('shop') * 0.75 + L('fanzone') * 0.5 + L('wlan') * 0.35) * (7000 + r * 260));
}
export function interiorWeekly(club) { // museum tours + media centre (every week)
  const L = (k) => interiorLevel(club, k), r = club.rep || 50;
  return Math.round(L('museum') * (2500 + r * 90) + L('presse') * (1800 + r * 70));
}
const STAND_LEN = [117, 117, 74, 74];
export const MAX_SIZE = 10, MAX_TIERS = 3;
export const ROOF_NAMES = ['Kein Dach', 'Teilüberdacht', 'Komplett überdacht'];
export const PITCH_NAMES = { natur: 'Naturrasen', hybrid: 'Hybridrasen', heizung: 'Hybridrasen mit Rasenheizung' };

export const rowsForSize = (size, tier) => Math.max(6, 4 + size * 3 - tier * 3);
const seatsPerRow = (stand, tier) => (STAND_LEN[stand] + tier * 10) / 0.55;
export const STANDING_FACTOR = 1.7;

export function standCapacity(layout, i, { ignoreWork = false } = {}) {
  const s = layout.stands[i];
  let c = 0;
  for (let t = 0; t < s.tiers; t++) c += rowsForSize(s.size, t) * seatsPerRow(i, t) * (s.standing && t === 0 ? STANDING_FACTOR : 1);
  if (!ignoreWork && s.building) c *= 0.5;
  return c;
}

export function rawCapacity(layout, opts) { return [0, 1, 2, 3].reduce((sum, i) => sum + standCapacity(layout, i, opts), 0); }

export function recomputeCapacity(club) {
  const st = club.stadium;
  st.capacity = Math.round((rawCapacity(st.layout) * (st.capFactor || 1)) / 50) * 50;
  st.fullCapacity = Math.round((rawCapacity(st.layout, { ignoreWork: true }) * (st.capFactor || 1)) / 50) * 50;
  return st.capacity;
}

// Share of the capacity that is standing room (cheaper tickets, better atmosphere)
export function standingShare(layout) {
  const total = rawCapacity(layout, { ignoreWork: true });
  let st = 0;
  layout.stands.forEach((s, i) => { if (s.standing) st += rowsForSize(s.size, 0) * seatsPerRow(i, 0) * STANDING_FACTOR; });
  return total ? st / total : 0;
}

export function atmosphere(club) {
  const L = club.stadium.layout;
  const roofs = L.stands.reduce((s, x) => s + x.roof, 0) / 8;
  const inner = (L.interior?.fanzone || 0) * 2 + (L.interior?.museum || 0) * 1.5;
  return Math.round(clamp(45 + standingShare(L) * 70 + roofs * 18 + (club.rep - 50) * 0.25 + ((L.away ?? 1) - 1) * 3 + inner, 20, 99));
}

// Builds a plausible layout for an existing stadium so that the computed capacity matches the real one.
export function defaultLayout(club, country) {
  const target = club.stadium.capacity || 20000;
  const german = country === 'DE';
  const layout = {
    stands: [0, 1, 2, 3].map((i) => ({ size: 1, tiers: 1, standing: german && i === 2, roof: target > 15000 ? 2 : target > 8000 ? 1 : 0, boxes: i === 0 ? (target > 40000 ? 2 : target > 15000 ? 1 : 0) : 0, building: null })),
    lights: target > 30000 ? 3 : target > 10000 ? 2 : 1, screens: target > 45000 ? 2 : target > 15000 ? 1 : 0,
    pitch: target > 40000 ? 'heizung' : target > 15000 ? 'hybrid' : 'natur',
  };
  let guard = 0;
  while (rawCapacity(layout) < target * 0.97 && guard++ < 200) {
    const s = layout.stands.reduce((best, x, i) => (x.size >= MAX_SIZE && x.tiers >= MAX_TIERS ? best : x.size + x.tiers * MAX_SIZE * (i > 1 ? 1.25 : 1) < best.score ? { i, score: x.size + x.tiers * MAX_SIZE * (i > 1 ? 1.25 : 1) } : best), { i: 0, score: 1e9 });
    if (s.score === 1e9) break;
    const st = layout.stands[s.i];
    if (st.size < MAX_SIZE) st.size++;
    else if (st.tiers < MAX_TIERS) { st.tiers++; st.size = 6; }
    else break;
  }
  return layout;
}

export function ensureStadium(club, country) {
  const st = club.stadium;
  if (!st.layout) {
    st.layout = defaultLayout(club, country);
    st.capFactor = clamp(st.capacity / rawCapacity(st.layout), 0.6, 1.6);
    st.projects = [];
    st.naming = null;
    st.baseName = st.name;
  }
  st.projects ||= [];
  recomputeCapacity(club);
  return st;
}

// ------------------------------------------------------------------ construction projects
const per = (n) => Math.round(n / 1e5) * 1e5;

export function projectOptions(club, i) {
  const L = club.stadium.layout, s = L.stands[i];
  const f = club.stadium.capFactor || 1;
  const opts = [];
  if (s.building) return opts;
  if (s.size < MAX_SIZE) {
    const add = [...Array(s.tiers)].reduce((sum, _, t) => sum + (rowsForSize(s.size + 1, t) - rowsForSize(s.size, t)) * seatsPerRow(i, t) * (s.standing && t === 0 ? STANDING_FACTOR : 1), 0) * f;
    opts.push({ key: 'size', label: `Tribüne vergrößern (+${Math.round(add / 10) * 10} Plätze)`, cost: per(add * 3800 + 600000), weeks: 8 });
  }
  if (s.tiers < MAX_TIERS) {
    const tmp = { ...s, tiers: s.tiers + 1 };
    const add = (standCapacity({ stands: L.stands.map((x, k) => (k === i ? tmp : x)) }, i, { ignoreWork: true }) - standCapacity(L, i, { ignoreWork: true })) * f;
    opts.push({ key: 'tier', label: `${s.tiers + 1}. Rang bauen (+${Math.round(add / 10) * 10} Plätze)`, cost: per(add * 5200 + 12e6), weeks: 22 });
  }
  opts.push({ key: 'standing', label: s.standing ? 'Unterrang zu Sitzplätzen umbauen' : 'Unterrang zu Stehplätzen umbauen', cost: per(rowsForSize(s.size, 0) * seatsPerRow(i, 0) * 260 + 300000), weeks: 3 });
  if (s.roof < 2) opts.push({ key: 'roof', label: s.roof ? 'Dach komplett schließen' : 'Teildach bauen', cost: per((i < 2 ? 1 : 0.65) * (s.roof ? 9e6 : 6e6) * (0.6 + s.tiers * 0.4)), weeks: 10 });
  if (s.boxes < 3) opts.push({ key: 'boxes', label: `VIP-Logen Stufe ${s.boxes + 1}`, cost: per(3.5e6 * (s.boxes + 1)), weeks: 6 });
  return opts;
}

export function globalOptions(club) {
  const L = club.stadium.layout, opts = [];
  if (L.lights < 3) opts.push({ key: 'lights', label: `Flutlicht Stufe ${L.lights + 1}`, desc: 'Abend- und Flutlichtspiele, höhere TV-Einnahmen', cost: per(2.2e6 * L.lights), weeks: 4 });
  if (L.screens < 2) opts.push({ key: 'screens', label: `${L.screens + 1}. Videowand`, desc: 'Mehr Werbe- und Merchandising-Einnahmen', cost: per(1.6e6 * (L.screens + 1)), weeks: 3 });
  const away = L.away ?? 1, fam = L.family ?? 0;
  if (away < 2) opts.push({ key: 'away', label: away === 0 ? 'Gästeblock mit Trennzaun' : 'Großer Gästeblock', desc: 'Mehr Gästefans: Zusatzeinnahmen, bessere Derby-Stimmung, weniger Ausschreitungen', cost: per(1.2e6 * (away + 1)), weeks: 4 });
  if (fam < 2) opts.push({ key: 'family', label: fam === 0 ? 'Familienbereich' : 'Großer Familienbereich mit Kinderland', desc: 'Neue junge Fans: steigende Fanstimmung, mehr Merchandising, stabilere Zuschauerzahlen', cost: per(1.5e6 * (fam + 1)), weeks: 5 });
  if (L.pitch === 'natur') opts.push({ key: 'pitch', to: 'hybrid', label: 'Hybridrasen verlegen', desc: 'Weniger Verletzungen, besserer Ball-Lauf', cost: 2.8e6, weeks: 2 });
  else if (L.pitch === 'hybrid') opts.push({ key: 'pitch', to: 'heizung', label: 'Rasenheizung einbauen', desc: 'Bespielbar bei Frost, noch weniger Verletzungen', cost: 2.2e6, weeks: 2 });
  return opts;
}

export function startProject(world, club, opt, stand = null) {
  if (club.budget < opt.cost) return { ok: false, msg: 'Nicht genug Geld auf dem Konto' };
  const st = club.stadium;
  const disc = club.buildDiscount || 0; club.buildDiscount = 0; const cost = Math.round(opt.cost * (1 - disc)); // v7.0 board subsidy
  club.budget -= cost; club.finance.season.construction -= cost;
  const proj = { key: opt.key, to: opt.to, stand, label: (stand != null ? standName(club, stand) + ': ' : '') + opt.label, weeks: opt.weeks, total: opt.weeks, cost: opt.cost };
  st.projects.push(proj);
  if (stand != null) st.layout.stands[stand].building = proj.label;
  recomputeCapacity(club);
  club.finance.ledger.unshift({ season: world.season, week: world.week + 1, rows: [{ key: 'construction', label: `Baubeginn – ${proj.label}`, amount: -opt.cost }], net: -opt.cost });
  return { ok: true };
}

function finishProject(world, club, p) {
  const L = club.stadium.layout;
  const s = p.stand != null ? L.stands[p.stand] : null;
  if (p.key === 'size') s.size++;
  if (p.key === 'tier') { s.tiers++; }
  if (p.key === 'standing') s.standing = !s.standing;
  if (p.key === 'roof') s.roof++;
  if (p.key === 'boxes') s.boxes++;
  if (p.key === 'lights') L.lights++;
  if (p.key === 'screens') L.screens++;
  if (p.key === 'pitch') L.pitch = p.to;
  if (p.key === 'away') L.away = (L.away ?? 1) + 1;
  if (p.key === 'family') L.family = (L.family ?? 0) + 1;
  if (p.key === 'interior') { L.interior ||= {}; L.interior[p.to] = (L.interior[p.to] || 0) + 1; }
  if (s) s.building = null;
  club.stadium.level = (club.stadium.level || 1) + 1;
  recomputeCapacity(club);
  if (club.id === world.userClubId) world.news.unshift({ season: world.season, week: world.week + 1, text: `🏗️ Fertiggestellt: ${p.label}. Das Stadion fasst jetzt ${club.stadium.capacity.toLocaleString('de-DE')} Zuschauer.` });
}

// called weekly for every club
export function weeklyConstruction(world, club) {
  const st = club.stadium;
  if (!st.projects?.length) return;
  for (const p of st.projects) p.weeks--;
  const done = st.projects.filter((p) => p.weeks <= 0);
  st.projects = st.projects.filter((p) => p.weeks > 0);
  for (const p of done) finishProject(world, club, p);
}

// matchday extras (per home game)
export function hospitalityIncome(club) {
  const boxes = club.stadium.layout.stands.reduce((s, x) => s + x.boxes, 0);
  return Math.round(boxes * (18000 + club.rep * 900));
}
export function awayIncome(club) { return Math.round(((club.stadium.layout.away ?? 1) * 0.6) * (9000 + club.rep * 450)); }
export function familyBonus(club) { return 1 + (club.stadium.layout.family ?? 0) * 0.04; }
export function namingIncomePerSeason(club) { return club.stadium.naming?.perSeason || 0; }
export function screensBonus(club) { return 1 + club.stadium.layout.screens * 0.04; }
export function lightsBonus(club) { return 1 + (club.stadium.layout.lights - 1) * 0.03; }
export function pitchInjuryFactor(club) { return { natur: 1, hybrid: 0.88, heizung: 0.8 }[club.stadium.layout.pitch] || 1; }

// naming-rights offers
const NAMING_BRANDS = ['Allianz', 'Volta Energie', 'Nordbank', 'Krone Mobil', 'Solaris', 'Orbita', 'Turbo Telecom', 'Lumen Air', 'Bergquell', 'PixelWerk', 'Hansa Logistik', 'Alpenbank'];
export function namingOffers(club, rng, leagueTier = 1) {
  const base = Math.pow(club.rep, 2) * 1400 * (leagueTier === 1 ? 1 : leagueTier === 2 ? 0.45 : 0.2) * (club.stadium.capacity / 40000 + 0.4) * wScale(club);
  return [0, 1, 2].map((k) => {
    const brand = NAMING_BRANDS[(club.id * 3 + k * 5 + (club.stadium.namingRound || 0)) % NAMING_BRANDS.length];
    const years = [3, 5, 8][k];
    return { brand, name: `${brand} ${['Arena', 'Park', 'Stadion'][k]}`, perSeason: per(base * (0.85 + k * 0.12) * rng.range(0.9, 1.1)), years };
  });
}
