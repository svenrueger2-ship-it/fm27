// v7.0.5: "What's new" popup – shown once after every update, in the menu and in-game (after a live update
// the game restarts straight into the save, so the menu would never show it).
import { esc, modal } from './dom.js';
import { PATCHNOTES, GAME_VERSION } from '../data/patchnotes.js';

const KEY = 'fm27-seen-version';
export function showWhatsNew(onAll) {
  try {
    if (localStorage.getItem(KEY) === GAME_VERSION) return false;
    localStorage.setItem(KEY, GAME_VERSION);
  } catch { return false; }
  if (document.querySelector('.pn-new')) return false;
  const p = PATCHNOTES[0];
  const items = [...(p.neu || []), ...(p.verbessert || []), ...(p.behoben || [])].slice(0, 8);
  const m = modal(`<div class="pn-new"><small>✅ Update installiert · Neu in Version ${esc(p.version)}</small><h2>${esc(p.title)}</h2><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><div class="row-actions"><button class="btn primary" id="pn-ok">Los geht's</button>${onAll ? '<button class="btn ghost" id="pn-all">Alle Patchnotes</button>' : ''}</div></div>`);
  m.el.querySelector('#pn-ok').onclick = () => m.close();
  m.el.querySelector('#pn-all')?.addEventListener('click', () => { m.close(); onAll(); });
  return true;
}

/** Update ready: ask whether to restart now or later. */
export function askRestart({ version, now, laterText }) {
  if (document.querySelector('.upd-ask')) return;
  const m = modal(`<div class="upd-ask pn-new"><small>⬇ Update bereit</small><h2>Version ${esc(version)} ist da</h2><p>Das Update ist heruntergeladen. Dein Spielstand wird vor dem Neustart automatisch gesichert.</p><div class="row-actions"><button class="btn primary" id="upd-now">🔄 Jetzt neu starten</button><button class="btn ghost" id="upd-later">Später</button></div><p class="small muted">${esc(laterText)}</p></div>`);
  m.el.querySelector('#upd-now').onclick = () => { m.close(); now(); };
  m.el.querySelector('#upd-later').onclick = () => m.close();
}
