// Entry point
import { App } from './ui/app.js';
import { preloadCrests } from './render/crestImages.js';
import { loadGame } from './storage/db.js';

const root = document.getElementById('app');
if (/FM27-Android/.test(navigator.userAgent)) document.documentElement.classList.add('android');
const app = new App(root);
window.ufm = app; // handy for debugging in the console
preloadCrests().finally(async () => {
  app.render();
  // v2.6: the launcher can open the game straight into a save (#continue=slot)
  const m = location.hash.match(/continue=([^&]+)/);
  if (m) {
    history.replaceState(null, '', location.pathname);
    const slot = decodeURIComponent(m[1]);
    const w = await loadGame(slot);
    if (w) { app.world = w; app.slot = slot === 'auto' ? 'slot1' : slot; app.go('home'); }
  }
});
