// Dressing room: team spirit, hierarchy, cliques, conflicts, players' council, team events.
import { esc, toast, portrait, flag, pname } from '../dom.js';
import { ensureKabine, hierarchy, cliques, spiritFactors, spiritLabel, CONFLICT_OPTIONS, resolveConflict, answerCouncil, TEAM_EVENTS, teamEvent } from '../../manager/kabine.js';
import { newRng } from '../../manager/season.js';
import { playerModal } from './manager.js';

const ROLE_ORDER = ['Leitwolf', 'Führungsspieler', 'Etabliert', 'Neuzugang', 'Talent'];
const ROLE_ICON = { Leitwolf: '🐺', Führungsspieler: '⭐', Etabliert: '🧱', Neuzugang: '🆕', Talent: '🌱' };

export function kabineScreen(app, el) {
  const w = app.world, club = app.club;
  const draw = () => {
    const K = ensureKabine(w, club), H = hierarchy(w, club), CL = cliques(w, club), F = spiritFactors(w, club);
    const open = K.conflicts.filter((c) => !c.done);
    const s = Math.round(club.spirit);
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🛋️ Kabine</h2></div>
      <div class="grid2">
        <div class="card"><h3>Teamgeist</h3><div class="spirit"><b class="${s >= 65 ? 'good' : s < 45 ? 'bad' : ''}">${s}</b><span>${spiritLabel(s)}</span></div><div class="rep-bar"><i style="width:${s}%"></i></div>
          <p class="muted small">Teamgeist wirkt sich auf die Moral, die Abstimmung im 3D-Spiel und die simulierten Ergebnisse aus.</p>
          ${F.map((f) => `<div class="kv"><span>${esc(f.label)}</span><b class="${f.v > 0 ? 'good' : f.v < 0 ? 'bad' : ''}">${f.v > 0 ? '+' : ''}${f.v}</b></div>`).join('')}
          <h3 style="margin-top:14px">🎉 Teamevent</h3><div class="sim-opts">${TEAM_EVENTS.map((e) => `<button class="btn" data-ev="${e.id}"><b>${e.icon} ${esc(e.name)} · ${(e.cost / 1000).toFixed(0)} Tsd. €</b><small>${esc(e.desc)} Teamgeist +${e.spirit}</small></button>`).join('')}</div>
        </div>
        <div class="card"><h3>⚡ Konflikte ${open.length ? `<span class="tag r">${open.length}</span>` : ''}</h3>
          ${open.length ? open.map((c) => `<div class="conflict"><p>${esc(c.text)}${c.ignored ? ' <small class="muted">(ignoriert)</small>' : ''}</p><div class="opt-row">${CONFLICT_OPTIONS.map(([k, l, d]) => `<button class="btn sm ${k === 'talk' ? 'primary' : ''}" title="${esc(d)}" data-cf="${c.id}" data-how="${k}">${l}</button>`).join('')}</div></div>`).join('') : '<p class="muted">Keine offenen Konflikte – Ruhe in der Kabine.</p>'}
          <h3 style="margin-top:14px">🪑 Spielerrat</h3>
          ${K.council ? `<p>${esc(K.council.text)}</p><p class="muted small">Vertreten durch ${K.council.leaders.map((id) => esc(w.players[id]?.lastName || '')).join(', ')}</p><div class="row-actions"><button class="btn primary sm" id="c-yes">Zustimmen</button><button class="btn ghost sm" id="c-no">Ablehnen</button></div>` : '<p class="muted">Der Spielerrat meldet sich etwa alle fünf Wochen mit Anliegen der Mannschaft.</p>'}
          <h3 style="margin-top:14px">📜 Kabinen-Chronik</h3>${K.log.slice(0, 8).map((l) => `<p class="small">Wo. ${l.week + 1}: ${esc(l.text)}</p>`).join('') || '<p class="muted">Noch nichts passiert.</p>'}
        </div>
      </div>
      <div class="grid2">
        <div class="card"><h3>🐺 Hierarchie</h3>${ROLE_ORDER.map((r) => { const ps = club.squad.filter((id) => H[id] === r).map((id) => w.players[id]); return ps.length ? `<div class="hier"><b>${ROLE_ICON[r]} ${r}</b><div>${ps.map((p) => `<span class="hp" data-p="${p.id}">${portrait(p, club, 26)} ${esc(p.lastName)}</span>`).join('')}</div></div>` : ''; }).join('')}</div>
        <div class="card"><h3>👥 Grüppchen</h3>${CL.map((g) => `<div class="hier"><b>${esc(g.name)} <small class="muted">${g.members.length} Spieler · Stimmung <span class="${g.mood < 45 ? 'bad' : g.mood > 65 ? 'good' : ''}">${g.mood}</span></small></b><div>${g.members.map((p) => `<span class="hp" data-p="${p.id}">${flag(p.nation)} ${esc(p.lastName)}</span>`).join('')}</div></div>`).join('') || '<p class="muted">Keine ausgeprägten Gruppen.</p>'}
          <p class="muted small">Eine dominante Gruppe oder frustrierte Grüppchen belasten den Teamgeist. Neuzugänge aus derselben Sprachgruppe integrieren sich schneller.</p></div>
      </div></div>`;
    el.querySelectorAll('[data-ev]').forEach((b) => (b.onclick = () => { const r = teamEvent(w, b.dataset.ev); toast(r.msg); draw(); }));
    el.querySelectorAll('[data-cf]').forEach((b) => (b.onclick = () => { const r = resolveConflict(w, +b.dataset.cf, b.dataset.how, newRng(w)); if (r) toast(r.text); draw(); }));
    el.querySelector('#c-yes')?.addEventListener('click', () => { toast(answerCouncil(w, true)); draw(); });
    el.querySelector('#c-no')?.addEventListener('click', () => { toast(answerCouncil(w, false)); draw(); });
    el.querySelectorAll('[data-p]').forEach((x) => (x.onclick = () => playerModal(app, w.players[x.dataset.p], { onChange: draw })));
  };
  draw();
}
