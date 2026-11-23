// v4.0: phone layout helper. When a screen in landscape is taller than ~1.2 screens and is built from
// stacked cards, the cards flow into two columns (CSS columns) so almost everything fits on one page.
// Long lists keep their own scroll area (CSS), the page itself barely scrolls.
import { IS_MOBILE } from '../core/device.js';

const SKIP = new Set(['match', 'tactics', 'calendar', 'home', 'mgrCreate', 'seasonEnd']);
let obs = null, raf = 0;

function fit(app, content) {
  raf = 0;
  const page = content.querySelector(':scope > .page');
  if (!page || SKIP.has(app.screen) || innerHeight > 600 || innerWidth < innerHeight) return;
  if (page.classList.contains('flow2') || page.dataset.flowChecked) return;
  page.dataset.flowChecked = '1';
  const cards = [...page.children].filter((c) => c.classList.contains('card') || c.classList.contains('grid-2') || c.classList.contains('grid2') || c.classList.contains('grid-3'));
  if (cards.length < 2) return;
  const before = document.scrollingElement.scrollHeight;
  if (before < innerHeight * 1.2) return;
  page.classList.add('flow2');
  const after = document.scrollingElement.scrollHeight;
  if (after > before * 0.92) page.classList.remove('flow2'); // no real gain → keep the normal layout
}

export function mobileFit(app, content) {
  if (!IS_MOBILE || !content) return;
  obs?.disconnect();
  const run = () => { if (!raf) raf = requestAnimationFrame(() => fit(app, content)); };
  obs = new MutationObserver(run);
  obs.observe(content, { childList: true });
  run();
}
