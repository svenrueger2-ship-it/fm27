import { IS_MOBILE } from './core/device.js';
// Entry point
import { App } from './ui/app.js';
import { preloadCrests } from './render/crestImages.js';
import { loadGame } from './storage/db.js';
import { startI18n, setLang } from './i18n/i18n.js';
{ const lm = location.hash.match(/lang=(\w+)/); if (lm) setLang(lm[1]); }
startI18n();

const root = document.getElementById('app');
if (/FM27-Android/.test(navigator.userAgent)) document.documentElement.classList.add('android');
if (IS_MOBILE) {
  document.documentElement.classList.add('mobile');
  // v3.0.1 landscape lock: works in fullscreen / installed app; otherwise a "please rotate" hint is shown in portrait
  const lock = () => { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch { /* unsupported */ } };
  lock(); document.addEventListener('fullscreenchange', lock);
  document.addEventListener('pointerdown', function once() { document.removeEventListener('pointerdown', once);
    if (!document.fullscreenElement && !/FM27-Android/.test(navigator.userAgent)) document.documentElement.requestFullscreen?.().then(lock).catch(() => {}); }, { once: true });
  const hint = document.createElement('div'); hint.className = 'rotate-hint';
  hint.innerHTML = '<div><div class="rh-ico">📱</div><b>Bitte Handy drehen</b><small>FUSSBALL MANAGER 2027 wird im Querformat gespielt</small></div>';
  document.body.appendChild(hint);
}
const app = new App(root);
// v7.0.5: after an update show what's new – also when the game restarts straight into a save
setTimeout(() => import('./ui/whatsnew.js').then((m) => m.showWhatsNew(null)).catch(() => {}), 1500);
window.ufm = app; // handy for debugging in the console
import('./manager/tourney.js').then((m) => { window.ufmDev = { startTourney: m.startTourney }; }).catch(() => {});
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
