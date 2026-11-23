// Runtime registry for user-created content (v2.0): custom crests and kit styles of founded clubs.
import { CRESTS } from './crests.js';
export const KIT_OVERRIDES = {};
const ORIG = {}; // real crests that a custom design replaced (v5.2: reset in the crest editor)
export const originalCrest = (short) => (short in ORIG ? ORIG[short] : CRESTS[short]);
export function registerCustomClubs(world) {
  for (const c of Object.values(world?.clubs || {})) {
    if (!c.custom) continue;
    if (c.custom.crest) { if (!(c.short in ORIG)) ORIG[c.short] = CRESTS[c.short]; CRESTS[c.short] = c.custom.crest; }
    else if (c.short in ORIG) { if (ORIG[c.short]) CRESTS[c.short] = ORIG[c.short]; else delete CRESTS[c.short]; }
    if (c.custom.kitStyle) KIT_OVERRIDES[c.short] = c.custom.kitStyle; else delete KIT_OVERRIDES[c.short];
  }
}
