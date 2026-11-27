// v7.0.6: "Vergessen-Check" – before kickoff a popup lists what the manager may have forgotten,
// each with a button that leads straight there. Can be hidden for the week or switched off in the settings.
import { esc, modal, money } from './dom.js';
import { windowInfo } from '../manager/transfers.js';
import { isDirector } from '../manager/director.js';
import { autoPress } from '../manager/staff.js';

const pn = (p) => `${p.firstName ? p.firstName[0] + '. ' : ''}${p.lastName}`;

export function forgottenItems(app, fx) {
  const w = app.world, club = w.clubs[w.userClubId], out = [];
  const xi = (club.lineup?.xi || []).map((id) => w.players[id]).filter(Boolean);
  const dir = isDirector(w);
  if (!dir) {
    const inj = xi.filter((p) => p.injury > 0), sus = xi.filter((p) => p.suspension > 0);
    if (inj.length) out.push({ ico: '🚑', text: `Verletzt in der Startelf: ${inj.map(pn).join(', ')}`, go: 'tactics', btn: 'Aufstellung' });
    if (sus.length) out.push({ ico: '🟥', text: `Gesperrt in der Startelf: ${sus.map(pn).join(', ')}`, go: 'tactics', btn: 'Aufstellung' });
    const tired = xi.filter((p) => (p.fitness ?? 100) < 62 && !p.injury);
    if (tired.length) out.push({ ico: '🥵', text: `Wenig Kraft: ${tired.map((p) => `${pn(p)} (${Math.round(p.fitness)} %)`).join(', ')}`, go: 'tactics', btn: 'Aufstellung' });
    if (xi.length && xi.length < 11) out.push({ ico: '⚠️', text: `Nur ${xi.length} Spieler in der Startelf`, go: 'tactics', btn: 'Aufstellung' });
    if (!(w.talk && w.talk.season === w.season && w.talk.week === w.week)) out.push({ ico: '🗣️', text: 'Noch keine Kabinenansprache gehalten', click: '#talk', btn: 'Ansprache' });
  }
  if (w.pressWeek !== w.week && !autoPress(w)) out.push({ ico: '🎤', text: 'Pressekonferenz noch offen', click: '#press', btn: 'Zur Presse' });
  const key = club.squad.map((id) => w.players[id]).filter((p) => p && !p.loan).sort((a, b) => b.ovr - a.ovr).slice(0, 11);
  const exp = key.filter((p) => p.contract <= 1 && !p.preContract);
  if (exp.length) out.push({ ico: '📄', text: `Vertrag läuft im Sommer aus: ${exp.slice(0, 4).map(pn).join(', ')}${exp.length > 4 ? ` +${exp.length - 4}` : ''}`, go: 'transfers', tab: 'kader', btn: 'Verlängern' });
  const wi = windowInfo(w);
  if (wi.open && wi.closesIn <= 1) out.push({ ico: '⏰', text: `${wi.name} schließt nach diesem Spieltag`, go: 'transfers', btn: 'Transfers' });
  if (club.squad.length < 18) out.push({ ico: '👥', text: `Nur ${club.squad.length} Spieler im Kader – verstärke dich`, go: 'transfers', btn: 'Transfers' });
  if (club.budget < 0) out.push({ ico: '💸', text: `Konto im Minus (${money(club.budget)}) – es fallen Zinsen an`, go: 'finance', btn: 'Finanzen' });
  return out;
}

/** Runs `proceed` right away, or after the manager confirmed the reminder popup. */
export function preKickoff(app, fx, proceed, root = document) {
  const w = app.world;
  if (app.settings.reminders === false || w.remindSkip === `${w.season}-${w.week}`) return proceed();
  const items = forgottenItems(app, fx);
  if (!items.length) return proceed();
  const M = modal(`<h3>🔔 Bevor es losgeht …</h3>
    <p class="muted">Dein Co-Trainer hat noch ${items.length === 1 ? 'einen Punkt' : `${items.length} Punkte`} auf dem Zettel:</p>
    <div class="remind-list">${items.map((it, i) => `<div class="remind"><i>${it.ico}</i><span>${esc(it.text)}</span><button class="btn sm" data-r="${i}">${esc(it.btn)} →</button></div>`).join('')}</div>
    <label class="remind-skip"><input type="checkbox" id="r-skip"> Diese Woche nicht mehr erinnern</label>
    <div class="row-actions end"><button class="btn" id="r-back">Zurück</button><button class="btn primary" id="r-go">Trotzdem anpfeifen ▶</button></div>
    <p class="muted small">Ausschalten kannst du die Erinnerungen in den Einstellungen unter „Ablauf“.</p>`);
  const skip = () => { if (M.el.querySelector('#r-skip').checked) w.remindSkip = `${w.season}-${w.week}`; };
  M.el.querySelector('#r-back').onclick = () => { skip(); M.close(); };
  M.el.querySelector('#r-go').onclick = () => { w.remindSkip = `${w.season}-${w.week}`; M.close(); proceed(); };
  M.el.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => {
    const it = items[+b.dataset.r]; skip(); M.close();
    if (it.click) root.querySelector(it.click)?.click();
    else { if (it.tab && app.tf) app.tf.tab = it.tab; app.go(it.go); }
  }));
}
