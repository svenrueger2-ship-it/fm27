// "Vorspulen": simulate several matchdays at once (5 Spieltage, rest of the first half, whole season).
// Deliberately tucked away behind a small button + confirmation so it is not triggered by accident.
import { finishWeek, newRng, userLeague, computeTable, isUserSeasonOver } from '../../manager/season.js';
import { modal, confirmDialog, esc, crest, toast } from '../dom.js';
import { stopReason, autopilotSnapshot } from '../../manager/staff.js';

export function simAheadButton() {
  return `<div class="sim-ahead"><button class="btn sm ghost" id="sim-ahead" title="Mehrere Spieltage auf einmal simulieren">⏩ Vorspulen …</button></div>`;
}

export function bindSimAhead(app, root) {
  const b = root.querySelector('#sim-ahead');
  if (b) b.onclick = () => openSimAhead(app);
}

export function openSimAhead(app) {
  const w = app.world;
  const L = userLeague(w);
  const total = L.fixtures.length, left = total - w.week, half = Math.ceil(total / 2);
  const toHalf = half - w.week;
  const opts = [
    ['auto', left, '🤖 Autopilot: bis zum nächsten wichtigen Ereignis'],
    ['1', 1, 'Nächster Spieltag'],
    ['5', Math.min(5, left), '5 Spieltage'],
    ['half', toHalf, `Bis Ende Hinrunde (Spieltag ${half})`],
    ['season', left, `Ganze restliche Saison (bis Spieltag ${total})`],
  ].filter(([, n]) => n > 0);
  const m = modal(`<h3>⏩ Vorspulen</h3>
    <p class="muted">Alle Spiele – auch deine eigenen – werden ohne 3D-Ansicht simuliert. Deine aktuelle Aufstellung und Taktik werden verwendet. Training, Finanzen und KI-Transfers laufen normal weiter.</p>
    <div class="sim-opts">${opts.map(([k, n, label]) => `<button class="btn" data-k="${k}" data-n="${n}"><b>${esc(label)}</b><small>${k === 'auto' ? 'stoppt bei Angeboten, Vorschlägen, Ereignissen, Verletzungen' : `${n} Spieltag${n > 1 ? 'e' : ''}`}</small></button>`).join('')}</div>`);
  m.el.querySelectorAll('[data-n]').forEach((btn) => (btn.onclick = async () => {
    const n = +btn.dataset.n, auto = btn.dataset.k === 'auto';
    m.close();
    if (!(await confirmDialog(auto ? 'Autopilot starten? Es wird simuliert, bis etwas deine Aufmerksamkeit braucht.' : `Wirklich ${n} Spieltag${n > 1 ? 'e' : ''} am Stück simulieren? Das lässt sich nicht rückgängig machen.`, 'Ja, simulieren'))) return;
    run(app, n, auto);
  }));
}

async function run(app, n, auto = false) {
  const w = app.world, club = app.club;
  const L = userLeague(w);
  const rankBefore = computeTable(L).findIndex((r) => r.id === club.id) + 1;
  const m = modal(`<h3>Simuliere …</h3><div class="progress"><i id="sa-bar" style="width:0%"></i></div><p class="muted" id="sa-txt"></p>`);
  m.el.querySelector('.modal-x')?.remove();
  const results = [];
  let stop = null;
  for (let i = 0; i < n && !isUserSeasonOver(w); i++) {
    const wk = w.week;
    const snap = autopilotSnapshot(w);
    finishWeek(w, newRng(w));
    if (auto) stop = stopReason(w, snap);
    const fx = L.fixtures[wk]?.find((x) => x.h === club.id || x.a === club.id);
    if (fx) results.push({ wk: wk + 1, fx });
    m.el.querySelector('#sa-bar').style.width = `${((i + 1) / n) * 100}%`;
    m.el.querySelector('#sa-txt').textContent = `Spieltag ${wk + 1} gespielt`;
    await new Promise((r) => setTimeout(r, 30));
    if (stop) break;
  }
  await app.autosave();
  const rankAfter = computeTable(L).findIndex((r) => r.id === club.id) + 1;
  let pts = 0;
  const rows = results.map(({ wk, fx }) => {
    const home = fx.h === club.id, my = home ? fx.hg : fx.ag, op = home ? fx.ag : fx.hg;
    const res = my > op ? 'S' : my < op ? 'N' : 'U'; pts += res === 'S' ? 3 : res === 'U' ? 1 : 0;
    const O = w.clubs[home ? fx.a : fx.h];
    return `<li><span>${wk}.</span><i class="res ${res}">${res}</i>${crest(O, 22)} ${home ? 'vs' : '@'} ${esc(O.name)}<b>${my}:${op}</b></li>`;
  }).join('');
  m.close();
  const off = w.transfer?.offers?.length || 0;
  const r = modal(`<h3>Vorspulen abgeschlossen</h3>
    <p><b>${results.length}</b> Spiele · <b>${pts}</b> Punkte · Tabellenplatz <b>${rankBefore}. → ${rankAfter}.</b></p>
    <ul class="sim-res">${rows}</ul>${stop ? `<p>🤖 Autopilot gestoppt: <b>${esc(stop)}</b></p>` : ''}${off ? `<p class="muted">📨 ${off} offene Transferangebot(e) warten auf dich.</p>` : ''}
    <div class="row-actions end"><button class="btn primary" id="sa-ok">Weiter</button></div>`);
  r.el.querySelector('#sa-ok').onclick = () => { r.close(); app.go(isUserSeasonOver(w) ? 'seasonEnd' : stop && /Vorschläge/.test(stop) ? 'staff' : 'home'); };
  toast('Simulation fertig');
}
