// Runtime registry for user-created content (v2.0): custom crests and kit styles of founded clubs.
import { CRESTS } from './crests.js';
export const KIT_OVERRIDES = {};
export function registerCustomClubs(world) {
  for (const c of Object.values(world?.clubs || {})) {
    if (!c.custom) continue;
    if (c.custom.crest) CRESTS[c.short] = c.custom.crest;
    if (c.custom.kitStyle) KIT_OVERRIDES[c.short] = c.custom.kitStyle;
  }
}
