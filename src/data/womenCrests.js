// v6.0: women's teams show the crest of their club's men's team (FCBF → FCB …)
import { CRESTS } from './crests.js';
import { LEAGUES } from './leagues.js';
for (const L of LEAGUES) if (L.women) for (const c of L.clubs) { const [, short, , , , , men] = c; if (men && CRESTS[men] && !CRESTS[short]) CRESTS[short] = CRESTS[men]; }
export const WOMEN_CRESTS = true;
