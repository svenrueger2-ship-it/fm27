// Staff & inbox: delegation per area (me / ask / auto), the staff members and the inbox with proposals.
import { esc, money, modal, toast } from '../dom.js';
import { AREAS, ROLES, ensureStaff, openInbox, actInbox, staffCandidates, hireStaff, staffWages } from '../../manager/staff.js';
import { newRng } from '../../manager/season.js';
import { isDirector } from '../../manager/director.js';

const MODES = [['me', 'Ich'], ['ask', 'Vorschlag'], ['auto', 'Stab macht']];
const stars = (q) => '★'.repeat(q) + '☆'.repeat(5 - q);

export function staffScreen(app, el) {
  const w = app.world;
  ensureStaff(w, newRng(w));
  const draw = () => {
    const S = w.staff, open = openInbox(w), log = (w.inbox || []).filter((x) => x.done).slice(0, 12);
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🧑‍💼 Stab & Posteingang</h2>
      <div class="row-actions"><button class="btn sm" id="all-auto">Alles dem Stab überlassen</button><button class="btn sm ghost" id="all-me">Alles selbst machen</button></div></div>
      <div class="grid2">
        <div class="card"><h3>📨 Posteingang ${open.length ? `<span class="tag">${open.length}</span>` : ''}</h3>
          ${open.length ? open.map((x) => `<div class="inbox-item"><div><small class="muted">${esc(ROLES[x.from] || 'Stab')} · Woche ${x.week + 1}</small><p>${esc(x.title)}</p></div>
            <div class="row-actions">${x.actions.map((a) => `<button class="btn sm ${a.k === 'yes' ? 'primary' : 'ghost'}" data-i="${x.id}" data-k="${a.k}">${esc(a.label)}</button>`).join('')}</div></div>`).join('') : '<p class="muted">Keine offenen Vorschläge. Dein Stab meldet sich, wenn es etwas zu entscheiden gibt.</p>'}
          ${log.length ? `<h4 style="margin-top:14px">Zuletzt erledigt</h4>${log.map((x) => `<p class="muted small">${x.auto ? '🤖' : x.choice === 'yes' ? '✅' : '✖'} ${esc(x.title)}</p>`).join('')}` : ''}
        </div>
        <div class="card"><h3>⚙️ Wer macht was?</h3>
          <p class="muted">„Vorschlag“: der Stab meldet sich im Posteingang. „Stab macht“: wird automatisch erledigt und protokolliert.</p>
          <div class="deleg">${AREAS.map(([k, label, icon, desc]) => {
            const locked = k === 'lineup' && isDirector(w);
            return `<div class="deleg-row"><div><b>${icon} ${esc(label)}</b><small class="muted">${locked ? 'Im Sportdirektor-Modus stellt der Cheftrainer auf.' : esc(desc)}</small></div>
              <div class="tabs small" style="margin:0">${MODES.map(([m, l]) => `<button ${locked ? 'disabled' : ''} data-a="${k}" data-m="${m}" class="${S.delegate[k] === m ? 'active' : ''}">${l}</button>`).join('')}</div></div>`;
          }).join('')}</div>
        </div>
      </div>
      <div class="card"><h3>👥 Dein Stab · ${money(staffWages(w))} pro Saison</h3>
        <div class="staff-grid">${Object.entries(S.members).map(([r, m]) => `<div class="staff-card"><small class="muted">${ROLES[r]}</small><b>${esc(m.name)}</b><span class="stars">${stars(m.quality)}</span>
          <small>${{ assistant: 'Bessere Vorschläge für Aufstellung, Training und Verträge', physio: 'Verletzungen heilen schneller', youth: 'U19-Talente entwickeln sich schneller', scout: 'Scouts arbeiten schneller und genauer' }[r]}</small>
          <small class="muted">${money(m.wage)}/Saison</small>${m.quality < 5 ? `<button class="btn sm" data-hire="${r}">Ersetzen …</button>` : ''}</div>`).join('')}</div>
      </div></div>`;
    el.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => { S.delegate[b.dataset.a] = b.dataset.m; draw(); }));
    el.querySelector('#all-auto').onclick = () => { for (const [k] of AREAS) S.delegate[k] = 'auto'; toast('Dein Stab übernimmt alle Bereiche.'); draw(); };
    el.querySelector('#all-me').onclick = () => { for (const [k] of AREAS) S.delegate[k] = 'me'; draw(); };
    el.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => {
      const r = actInbox(w, +b.dataset.i, b.dataset.k, newRng(w));
      if (r?.msg) toast(r.msg);
      app.autosave?.(); app.refreshChrome?.(); draw();
    }));
    el.querySelectorAll('[data-hire]').forEach((b) => (b.onclick = () => {
      const role = b.dataset.hire;
      const cands = staffCandidates(w, newRng(w), role).filter((c) => c.quality > S.members[role].quality);
      const m = modal(`<h3>Neuer ${ROLES[role]}</h3><div class="sim-opts">${cands.map((c, i) => `<button class="btn" data-c="${i}"><b>${esc(c.name)} ${stars(c.quality)}</b><small>Ablöse ${money(c.fee)} · Gehalt ${money(c.wage)}/Saison</small></button>`).join('')}</div>`);
      m.el.querySelectorAll('[data-c]').forEach((x) => (x.onclick = () => { const r = hireStaff(w, cands[+x.dataset.c]); toast(r.ok ? 'Verpflichtet!' : r.msg); m.close(); draw(); }));
    }));
  };
  draw();
}
