// v6.0 Trainingszentrum screen: 3D campus + building list.
import { esc, money, toast, confirmDialog } from '../dom.js';
import { campusOptions, startCampus, ensureCampus, campusUpkeep } from '../../manager/campus.js';
import { userLeague } from '../../manager/season.js';
import { createCampusPreview } from '../../render/campusPreview.js';

export function campusScreen(app, el) {
  const w = app.world;
  let view = null, t = 0;
  const draw = () => {
    const club = app.club, L = userLeague(w), C = ensureCampus(club);
    const opts = campusOptions(club, L);
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🏗️ Trainingszentrum</h2><div class="row-actions"><span class="muted">Kontostand ${money(club.budget)} · Unterhalt ${money(campusUpkeep(club))}/Woche</span></div></div>
      <div class="card sb-view campus-view"><div class="sb-canvas" id="camp3d"></div><div class="sb-overlay"><b>Trainingsgelände ${esc(club.name)}</b><small>${C.build ? `🏗️ Baustelle: ${esc(C.build.name)} · noch ${C.build.weeks} Wo.` : 'Ziehen zum Drehen · Mausrad/Pinch zum Zoomen'}</small></div></div>
      <div class="sb-inner">${opts.map((o) => `<div class="card sb-in ${o.busy ? 'building' : ''}"><div class="sb-sh"><b>${o.icon} ${esc(o.name)}</b><span class="stars">${'●'.repeat(o.level)}${'○'.repeat(Math.max(0, o.max - o.level))}</span></div><small class="muted">${esc(o.desc)}</small>
        ${o.done ? '<p class="good">✔ Voll ausgebaut</p>' : o.busy ? `<p class="sb-work">🏗️ Im Bau · noch ${C.build.weeks} Wo.</p>` : `<button class="btn sm primary" data-b="${o.key}" ${club.budget < o.cost || C.build ? 'disabled' : ''}>Stufe ${o.level + 1} · ${money(o.cost)} · ${o.weeks} Wo.</button>`}</div>`).join('')}</div>
      <p class="muted small">Auf dem Gelände kann immer nur eine Baustelle gleichzeitig laufen. Neue Gebäude kosten wöchentlichen Unterhalt.</p></div>`;
    view?.dispose(); view = null; clearTimeout(t);
    const host = el.querySelector('#camp3d');
    t = setTimeout(() => { if (host.isConnected) view = createCampusPreview(host, { club }); }, 30);
    el.querySelectorAll('[data-b]').forEach((b) => (b.onclick = async () => {
      const o = opts.find((x) => x.key === b.dataset.b);
      if (!(await confirmDialog(`${o.name} auf Stufe ${o.level + 1} ausbauen? ${money(o.cost)}, Bauzeit ${o.weeks} Wochen.`, 'Bauen'))) return;
      const r = startCampus(w, club, o.key, L); toast(r.ok ? 'Bauarbeiten gestartet' : r.msg); draw();
    }));
  };
  draw();
  return () => { clearTimeout(t); view?.dispose(); };
}
