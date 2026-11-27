// v7.0.6: "Verlassen" bar – back to the main menu or straight out to Windows (saves first when a career is running).
import { confirmDialog, toast } from './dom.js';

export const isDesktop = () => !!window.bakusa;
export function quitApp() {
  if (window.bakusa?.close) window.bakusa.close(); else if (window.bakusa?.quit) window.bakusa.quit();
  else { try { window.close(); } catch {} toast('Im Browser bitte einfach den Tab schließen.'); }
}

/** HTML of the bar; `menu` = we are in the main menu (no running career). */
export function exitBarHtml({ menu = false } = {}) {
  return `<div class="exit-bar"><span>🚪 Verlassen</span>
    <button class="btn ghost" data-exit="menu">🏠 ${menu ? 'Zurück zum Menü' : 'Speichern & zum Hauptmenü'}</button>
    <button class="btn ghost danger" data-exit="quit">⏻ ${menu ? '' : 'Speichern & '}${isDesktop() ? 'zu Windows' : 'Spiel beenden'}</button></div>`;
}

/** Binds the buttons of every exit bar inside `root`. `onMenu` replaces the default "back to menu" (used inside the main menu). */
export function bindExitBar(app, root, { onMenu, close } = {}) {
  root.querySelectorAll('[data-exit]').forEach((b) => (b.onclick = async () => {
    const quit = b.dataset.exit === 'quit';
    if (app.world && app.world.mode !== 'wm' && app.slot) { try { await app.save(app.slot, true); toast('Spielstand gespeichert'); } catch {} }
    else if (app.world && !app.slot && !(await confirmDialog('Dieses Spiel ist nicht gespeichert. Trotzdem verlassen?', 'Verlassen'))) return;
    close?.();
    if (quit) return quitApp();
    if (onMenu) return onMenu();
    app.world = null; app.go('start');
  }));
}
