import { CRESTS } from '../data/crests.js';
import { realSquadsForNewLeagues } from '../data/generator.js';
import { RNG } from '../core/rng.js';
import { migrateWorld } from '../manager/migrate.js';
// IndexedDB save system (multiple slots) + localStorage settings. Falls back to memory if unavailable.
const DB_NAME = 'ufm3d';
const STORE = 'saves';
let dbPromise = null;
const memory = new Map();

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slot' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const r = fn(store);
    t.oncomplete = () => resolve(r?.result);
    t.onerror = () => reject(t.error);
  });
}

export async function saveGame(slot, world, label) {
  const club = world.clubs[world.userClubId];
  const lg = world.leagues?.find((l) => l.id === club.leagueId);
  // small summary for the launcher / save list (v2.6)
  const meta = { short: club.short, colors: club.colors, league: lg?.name, level: world.mgr?.level || 1, scenario: world.scenario?.name || null, crest: club.custom?.crest || CRESTS[club.short] || null };
  const record = { slot, label: label || club.name, club: club.name, season: world.season, week: world.week, savedAt: Date.now(), meta, data: JSON.stringify(world) };
  const db = await openDB();
  if (!db) { memory.set(slot, record); return; }
  await tx(db, 'readwrite', (s) => s.put(record));
}

export async function listSaves() {
  const db = await openDB();
  if (!db) return [...memory.values()].map(({ data, ...r }) => r);
  const all = await new Promise((resolve) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
  return all.map(({ data, ...r }) => r).sort((a, b) => b.savedAt - a.savedAt);
}

export async function loadGame(slot) {
  const db = await openDB();
  const rec = db ? await new Promise((resolve) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(slot);
    req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null);
  }) : memory.get(slot);
  if (!rec) return null;
  const w = migrateWorld(JSON.parse(rec.data));
  // v5.0.1: real squads for the Eredivisie, Liga Portugal, Süper Lig and Scottish Premiership in 5.0.0 saves
  if (w.leagues?.some((l) => l.id === 'nl1') && !w.realV501) {
    const n = realSquadsForNewLeagues(w, new RNG((w.seed || 1) + w.season * 7 + w.week));
    if (n) {
      const ok = (id) => !!w.players[id];
      if (w.rumours) w.rumours = w.rumours.filter((r) => ok(r.player));
      if (w.transfer) { w.transfer.offers = (w.transfer.offers || []).filter((o) => ok(o.playerId)); w.transfer.listed = (w.transfer.listed || []).filter(ok); }
      if (w.scouting) { w.scouting.watch = (w.scouting.watch || []).filter(ok); w.scouting.assignments = (w.scouting.assignments || []).filter((a) => ok(a.playerId)); }
      w.freeAgents = (w.freeAgents || []).filter(ok);
      if (w.career?.natSquad) w.career.natSquad = w.career.natSquad.filter(ok);
      for (const h of w.hot?.humans || []) { const st = h.st; if (!st) continue; if (st.rumours) st.rumours = st.rumours.filter((r) => ok(r.player)); if (st.scouting) st.scouting.watch = (st.scouting.watch || []).filter(ok); if (st.transfer) st.transfer.offers = (st.transfer.offers || []).filter((o) => ok(o.playerId)); }
      w.news?.unshift({ season: w.season, week: w.week, text: `🌍 Echte Kader 2026/27 für ${n} Vereine aus Eredivisie, Liga Portugal, Süper Lig und Scottish Premiership eingespielt.` });
    }
  }
  return w;
}

export async function deleteGame(slot) {
  const db = await openDB();
  if (!db) { memory.delete(slot); return; }
  await tx(db, 'readwrite', (s) => s.delete(slot));
}

// Android app (v2.9): strong phones like the Xiaomi 15T Pro get high quality by default
import { IS_MOBILE } from '../core/device.js';
const DEFAULT_SETTINGS = { quality: IS_MOBILE ? 'hoch' : 'mittel', speed: 1, camera: 'tv', autosave: true, matchMode: '3d' };
export function loadSettings() {
  try {
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('ufm3d-settings') || '{}') };
    // v3.0.2: phones were throttled too hard in 3.0.1 – lift them to 'hoch' once
    if (IS_MOBILE && !s.gfx302) { s.gfx302 = true; if (s.quality === 'niedrig' || s.quality === 'mittel') s.quality = 'hoch'; try { localStorage.setItem('ufm3d-settings', JSON.stringify(s)); } catch { /* ignore */ } }
    return s;
  }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) {
  try { localStorage.setItem('ufm3d-settings', JSON.stringify(s)); } catch { /* ignore */ }
}
