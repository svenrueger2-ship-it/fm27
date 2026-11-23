// Training: team focus, intensity, individual focus per player, tactical familiarity, weekly report.
import { TRAINING_FOCUS, ensureTraining, SESSIONS, DAYS, PLAN_TEMPLATES, weekMix, startRetrain, MAX_MENTORS } from '../../manager/training.js';
import { leadership } from '../../manager/players.js';
import { OUTFIELD_ATTRS, GK_ATTRS, POSITIONS, POS_WEIGHTS } from '../../data/attributes.js';
import { esc, pname, ratingClass, portrait, bar, toast } from '../dom.js';
import { playerModal } from './manager.js';
import { STYLES, styleOf, learnable, startStyleTrain } from '../../data/styles.js';

const FOCUS_ICONS = { ausgewogen: '⚖️', fitness: '🏃', technik: '🎯', angriff: '⚽', verteidigung: '🛡️', taktik: '🧠' };
const ATTR_NAME = Object.fromEntries([...OUTFIELD_ATTRS, ...GK_ATTRS]);

export function trainingScreen(app, el) {
  const w = app.world, club = app.club;
  const tr = ensureTraining(club);
  if (tr.plan === undefined) tr.plan = [...PLAN_TEMPLATES.standard.plan];
  club.mentors ||= {};
  const draw = () => {
    const mix = weekMix(tr);
    const ps = club.squad.map((id) => w.players[id]).sort((a, b) => a.age - b.age || b.pot - a.pot);
    const fac = club.facilities.training;
    const risk = (0.004 * tr.intensity * (1.5 - club.facilities.medical * 0.13) * 100 * club.squad.length).toFixed(1);
    el.innerHTML = `<div class="page"><div class="page-head"><h2>Training</h2><span class="chip">🏋️ Trainingsgelände Stufe ${fac} · 🩺 Medizin Stufe ${club.facilities.medical}</span></div>
      <div class="card"><div class="page-head" style="margin:0"><h3>📅 Trainingswoche</h3>
          <label class="check"><input type="checkbox" id="useplan" ${tr.plan ? 'checked' : ''}> Wochenplan verwenden</label></div>
        ${tr.plan ? `<div class="week-plan">${tr.plan.map((k, i) => `<div class="day"><small>${DAYS[i]}</small><button class="sess" data-day="${i}"><span>${SESSIONS[k].icon}</span><b>${SESSIONS[k].name}</b></button></div>`).join('')}<div class="day"><small>So</small><div class="sess gameday"><span>🏟️</span><b>Spieltag</b></div></div></div>
          <div class="opt-row">${Object.entries(PLAN_TEMPLATES).map(([k, t]) => `<button class="chip-btn" data-tpl="${k}">${esc(t.name)}</button>`).join('')}</div>
          <div class="plan-sum"><span>Entwicklung <b>${Math.round((0.35 + mix.dev * 0.85) * 100)} %</b></span><span>Fitness <b class="${mix.fit >= 0 ? 'good' : 'bad'}">${mix.fit >= 0 ? '+' : ''}${Math.round(mix.fit * 0.55 * (0.6 + tr.intensity * 0.6))}</b></span><span>Verletzungsrisiko <b class="${mix.inj > 5 ? 'bad' : ''}">${mix.inj > 5.5 ? 'hoch' : mix.inj > 3.5 ? 'mittel' : 'niedrig'}</b></span><span>Spielvorbereitung <b>${mix.prep ? `+${mix.prep}` : '–'}</b></span><span>Standards <b>${mix.setpiece ? `+${mix.setpiece}` : '–'}</b></span><span>Teamgeist <b>${mix.spirit ? `+${mix.spirit}` : '–'}</b></span></div>`
          : '<p class="muted">Klassisches Training mit einem Schwerpunkt für die ganze Woche (unten).</p>'}
      </div>
      <div class="grid-2">
        <div class="card ${tr.plan ? 'dim' : ''}"><h3>Mannschaftstraining – Schwerpunkt${tr.plan ? ' <small class="muted">(nur ohne Wochenplan)</small>' : ''}</h3>
          <div class="grid-3">${Object.entries(TRAINING_FOCUS).map(([k, f]) => `<button class="btn ${tr.focus === k ? 'active' : ''}" data-focus="${k}" style="white-space:normal;text-align:left;padding:.8rem"><div style="font-size:1.6rem">${FOCUS_ICONS[k]}</div><b>${f.name}</b><br><small>${f.desc}</small></button>`).join('')}</div>
          <label class="slider"><span>Intensität: <b id="int">${Math.round(tr.intensity * 100)} %</b> <small>Mehr Intensität = schnellere Entwicklung, aber mehr Müdigkeit und Trainingsverletzungen.</small></span><div><em>locker</em><input type="range" id="intensity" min="20" max="100" value="${Math.round(tr.intensity * 100)}"><em>hart</em></div></label>
          <p class="muted" id="risk">Erwartete Trainingsverletzungen: ca. ${risk} pro 100 Spielerwochen im Kader.</p>
        </div>
        <div class="card"><h3>🧠 Taktische Vertrautheit</h3>
          <p>${esc(club.tactic.formation)} · ${esc(club.tactic.preset || 'Individuell')}</p>
          <div class="meter" style="height:16px"><i style="width:${Math.round((club.familiarity ?? 0.7) * 100)}%"></i></div>
          <p class="muted">${Math.round((club.familiarity ?? 0.7) * 100)} % – Je vertrauter die Mannschaft mit Formation und Spielstil ist, desto sicherer sind Passentscheidungen und Positionsspiel im 3D-Spiel. Häufige Formationswechsel senken den Wert, Taktiktraining erhöht ihn schneller.</p>
          <h3 style="margin-top:1rem">📋 Letzter Wochenbericht</h3>
          ${(w.trainingReport?.items || []).slice(0, 10).map((r) => `<p>${r.type === 'up' ? '📈' : '🩹'} ${esc(r.text)}${r.gains ? ` <small>(${[...new Set(r.gains)].map((g) => ATTR_NAME[g]).join(', ')})</small>` : ''}</p>`).join('') || '<p class="muted">Noch kein Bericht – er erscheint nach dem nächsten Spieltag.</p>'}
        </div>
      </div>
      <div class="card table-wrap"><h3>Einzeltraining</h3><table class="tbl"><thead><tr><th>Spieler</th><th>Pos</th><th>Alter</th><th>Stärke</th><th>Potenzial</th><th>Entwicklung</th><th>Fitness</th><th>Individueller Schwerpunkt</th><th>Umschulung</th><th>Spielstil</th><th>Mentor</th></tr></thead><tbody>
        ${ps.map((p) => { const room = p.pot - p.ovr; const keys = Object.keys(POS_WEIGHTS[p.pos]);
          return `<tr data-p="${p.id}"><td class="nm">${portrait(p, club, 26)}<span>${esc(pname(p))}</span></td><td><span class="pos pos-${POSITIONS[p.pos].group}">${p.pos}</span></td><td>${p.age}</td>
          <td><b class="${ratingClass(p.ovr)}">${p.ovr}</b></td><td>${p.pot}</td><td>${bar(p.ovr, p.pot, room > 8 ? 'r-elite' : 'r-high')} <small>${room > 0 ? `+${room} möglich` : 'ausgereizt'}</small></td><td>${bar(p.fitness, 100, p.fitness < 70 ? 'warn' : '')}</td>
          <td><select class="input" data-ind="${p.id}"><option value="">– keiner –</option>${keys.map((k) => `<option value="${k}" ${tr.individual[p.id] === k ? 'selected' : ''}>${ATTR_NAME[k]} (${p.attrs[k]})</option>`).join('')}</select></td>
          <td>${p.pos === 'TW' ? '–' : `<select class="input sm" data-rt="${p.id}"><option value="">${(p.altPos || []).length ? `kann: ${p.altPos.join(', ')}` : '–'}</option>${['IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LM', 'RM', 'LA', 'RA', 'ST'].filter((x) => x !== p.pos && !(p.altPos || []).includes(x)).map((x) => `<option ${p.retrain?.pos === x ? 'selected' : ''}>${x}</option>`).join('')}</select>${p.retrain ? `<div class="meter sm"><i style="width:${Math.round(p.retrain.progress * 100)}%"></i></div>` : ''}`}</td>
          <td>${(() => { const cur = styleOf(p), L = learnable(p); if (p.pos === 'TW') return '–';
            return `${cur ? `<small>${cur.icon} ${esc(cur.name)}</small>` : ''}${L.length || p.styleTrain ? `<select class="input sm" data-st="${p.id}"><option value="">${cur ? 'umlernen…' : 'Stil lernen…'}</option>${L.map((k) => `<option value="${k}" ${p.styleTrain?.id === k ? 'selected' : ''}>${STYLES[k].icon} ${STYLES[k].name}${p.styleTalent === k ? ' ⭐' : ''}</option>`).join('')}</select>` : '<small class="muted">noch nichts lernbar</small>'}${p.styleTrain ? `<div class="meter sm"><i style="width:${Math.round(p.styleTrain.progress * 100)}%"></i></div>` : ''}`; })()}</td>
          <td>${p.age <= 22 ? `<select class="input sm" data-men="${p.id}"><option value="">–</option>${club.mentors[p.id] != null && w.players[club.mentors[p.id]] ? `<option value="${club.mentors[p.id]}" selected>${esc(w.players[club.mentors[p.id]].lastName)}</option>` : ''}</select>` : Object.values(club.mentors).includes(p.id) ? '<small>Mentor 🎓</small>' : '–'}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
    el.querySelector('#useplan').onchange = (e) => { tr.plan = e.target.checked ? [...PLAN_TEMPLATES.standard.plan] : null; draw(); };
    el.querySelectorAll('[data-tpl]').forEach((b) => (b.onclick = () => { tr.plan = [...PLAN_TEMPLATES[b.dataset.tpl].plan]; toast(`Vorlage: ${PLAN_TEMPLATES[b.dataset.tpl].name}`, 1000); draw(); }));
    el.querySelectorAll('[data-day]').forEach((b) => (b.onclick = () => {
      const i = +b.dataset.day, keys = Object.keys(SESSIONS);
      const host = document.createElement('div'); host.className = 'sess-pick';
      host.innerHTML = keys.map((k) => `<button data-k="${k}" class="${tr.plan[i] === k ? 'on' : ''}"><span>${SESSIONS[k].icon}</span><b>${SESSIONS[k].name}</b><small>${esc(SESSIONS[k].desc)}</small></button>`).join('');
      b.closest('.day').appendChild(host);
      host.querySelectorAll('[data-k]').forEach((x) => (x.onclick = (ev) => { ev.stopPropagation(); tr.plan[i] = x.dataset.k; draw(); }));
      setTimeout(() => document.addEventListener('click', function off(ev) { if (!host.contains(ev.target)) { host.remove(); document.removeEventListener('click', off); } }), 0);
    }));
    el.querySelectorAll('[data-rt]').forEach((s2) => { s2.onclick = (e) => e.stopPropagation(); s2.onchange = () => { startRetrain(w.players[s2.dataset.rt], s2.value || null); toast(s2.value ? `Umschulung auf ${s2.value} gestartet (ca. 4 Monate)` : 'Umschulung beendet', 1400); draw(); }; });
    el.querySelectorAll('[data-st]').forEach((s2) => { s2.onclick = (e) => e.stopPropagation(); s2.onchange = () => { startStyleTrain(w.players[s2.dataset.st], s2.value || null); toast(s2.value ? `Stil-Training „${STYLES[s2.value].name}“ gestartet (ca. 3 Monate)` : 'Stil-Training beendet', 1400); draw(); }; });
    // v4.0: mentor options are filled when the list is opened (hundreds of <option>s made the screen slow on phones)
    const menOpts = (p) => `<option value="">–</option>${club.squad.map((id) => w.players[id]).filter((m) => m.age >= 27 && m.id !== p.id).sort((a, b) => (b.pos === p.pos) - (a.pos === p.pos) || leadership(b) - leadership(a)).map((m) => `<option value="${m.id}" ${club.mentors[p.id] === m.id ? 'selected' : ''}>${esc(m.lastName)} (${m.pos}, ${m.age})</option>`).join('')}`;
    el.querySelectorAll('[data-men]').forEach((s2) => { const fill = () => { if (s2.dataset.full) return; s2.dataset.full = '1'; s2.innerHTML = menOpts(w.players[s2.dataset.men]); }; s2.addEventListener('pointerdown', fill); s2.addEventListener('focus', fill); s2.addEventListener('keydown', fill); });
    el.querySelectorAll('[data-men]').forEach((s2) => { s2.onclick = (e) => e.stopPropagation(); s2.onchange = () => {
      if (s2.value && Object.keys(club.mentors).length >= MAX_MENTORS && !club.mentors[s2.dataset.men]) { toast(`Maximal ${MAX_MENTORS} Mentorenpaare.`); draw(); return; }
      if (s2.value) club.mentors[s2.dataset.men] = +s2.value; else delete club.mentors[s2.dataset.men]; toast(s2.value ? 'Mentor zugewiesen' : 'Mentor entfernt', 1000); }; });
    el.querySelectorAll('[data-focus]').forEach((b) => (b.onclick = () => { tr.focus = b.dataset.focus; toast(`Schwerpunkt: ${TRAINING_FOCUS[tr.focus].name}`, 1200); draw(); }));
    const it = el.querySelector('#intensity');
    it.oninput = () => { tr.intensity = +it.value / 100; el.querySelector('#int').textContent = it.value + ' %'; };
    it.onchange = draw;
    el.querySelectorAll('[data-ind]').forEach((s) => {
      s.onclick = (e) => e.stopPropagation();
      s.onchange = () => { if (s.value) tr.individual[s.dataset.ind] = s.value; else delete tr.individual[s.dataset.ind]; toast('Einzeltraining gesetzt', 1000); };
    });
    el.querySelectorAll('tr[data-p]').forEach((t) => (t.onclick = () => playerModal(app, w.players[t.dataset.p], { onChange: draw })));
  };
  draw();
}
