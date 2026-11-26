// Preloaded crest images for canvas textures (kits, video walls).
import { CRESTS } from '../data/crests.js';
import '../data/womenCrests.js';
const cache = new Map();
export function crestImage(short) {
  if (!CRESTS[short]) return null;
  if (!cache.has(short)) { const img = new Image(); img.src = CRESTS[short]; cache.set(short, img); }
  const img = cache.get(short);
  return img.complete && img.naturalWidth ? img : null;
}
export function preloadCrests() {
  return Promise.all(Object.keys(CRESTS).map((k) => new Promise((res) => {
    crestImage(k); const img = cache.get(k);
    if (img.complete) res(); else { img.onload = img.onerror = () => res(); }
  })));
}

export function resetCrestImage(short) { cache.delete(short); }
