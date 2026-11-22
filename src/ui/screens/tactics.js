// Tactics: formation, presets, team instructions and lineup editor. All values drive the 3D match AI.
import { FORMATIONS, PRESETS, autoLineup, ensureLineup, effectiveRating, available, ROLE_DEFS, rolesFor, roleOf, CORNER_ROUTINES, DEFAULT_ROLE } from '../../match/tactics.js';
import { POSITIONS } from '../../data/attributes.js';
import { esc, shortName, ratingClass, toast, confirmDialog } from '../dom.js';

const SLIDERS = [
  ['mentality', 'Mentalität', 'defensiv', 'offensiv', 'Wie viele Spieler mit nach vorne gehen und wie gern geschossen wird.'],
  ['pressing', 'Pressing', 'tief', 'aggressiv', 'Ab wo und wie viele Spieler den Ballführer anlaufen und Passwege zustellen.'],
  ['line', 'Abwehrlinie', 'tief', 'hoch', 'Höhe der letzten Kette – hoch = kompakt weit vorne, aber Raum hinter der Abwehr.'],
  ['width', 'Breite', 'eng', 'breit', 'Wie breit die Mannschaft bei Ballbesitz steht.'],
  ['tempo', 'Tempo', 'ruhig', 'schnell', 'Wie schnell Entscheidungen am Ball getroffen werden.'],
  ['directness', 'Passspiel', 'kurz', 'direkt', 'Vorliebe für kurze Pässe oder lange, vertikale Bälle und Läufe in die Tiefe.'],
  ['compactness', 'Kompaktheit', 'locker', 'kompakt', 'Abstände zwischen den Mannschaftsteilen gegen den Ball.'],
];

export function tacticsScreen(app, el) {
  const w = app.world, club = app.club, T = club.tactic;
  let selSlot = null;
  const draw = () => {
    const L = ensureLineup(club, w.players);
    const slots = FORMATIONS[L.formation];
    const xiSet = new Set(L.xi);
    const pool = club.squad.map((id) => w.players[id]).sort((a, b) => b.ovr - a.ovr);
    const slotXY = (s) => ({ x: 150 + s[2] * 118, y: s[0] === 'TW' ? 386 : 332 - s[1] * 278 });
    const dir = w.mode === 'director' && w.coach;
    const SP = (T.setPieces ||= {});
    el.innerHTML = `<div class="page"><div class="page-head"><h2>Taktik</h2><div class="row-actions">${dir ? '' : '<button class="btn sm" id="auto">Automatisch aufstellen</button>'}</div></div>
    ${dir ? `<div class="card director-note">👔 <b>Sportdirektor-Modus:</b> Cheftrainer <b>${w.coach.name}</b> (${'★'.repeat(w.coach.quality)}${'☆'.repeat(5 - w.coach.quality)}) stellt auf und spielt <b>${w.coach.style}</b> im <b>${w.coach.formation}</b>. Du kannst ihn in der Vereinszentrale ersetzen.</div>` : ''}
    <div class="tactics-grid ${dir ? 'locked' : ''}">
      <div class="card">
        <div class="tabs small">${Object.keys(FORMATIONS).map((f) => `<button data-form="${f}" class="${f === L.formation ? 'active' : ''}">${f}</button>`).join('')}</div>
        <svg class="pitch-svg" viewBox="0 0 300 436">
          <rect x="4" y="4" width="292" height="412" rx="6" fill="#1f6b33" stroke="#cfe" stroke-width="1.5"/>
          ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="4" y="${4 + i * 59}" width="292" height="29.5" fill="#22763a"/>`).join('')}
          <line x1="4" y1="210" x2="296" y2="210" stroke="#cfe" stroke-width="1.5"/><circle cx="150" cy="210" r="36" fill="none" stroke="#cfe" stroke-width="1.5"/>
          <rect x="70" y="352" width="160" height="64" fill="none" stroke="#cfe" stroke-width="1.5"/><rect x="70" y="4" width="160" height="64" fill="none" stroke="#cfe" stroke-width="1.5"/>
          ${slots.map((s, i) => { const p = w.players[L.xi[i]]; const { x, y } = slotXY(s); const r = p ? effectiveRating(p, s[0]) : 0;
            return `<g class="slot ${selSlot === i ? 'sel' : ''}" data-slot="${i}" transform="translate(${x},${y})"><circle r="16" fill="${club.colors.primary}" stroke="${selSlot === i ? '#ffd34d' : club.colors.secondary}" stroke-width="${selSlot === i ? 4 : 2}"/>
            <text y="4" text-anchor="middle" font-size="10" font-weight="700" fill="${club.colors.secondary}">${s[0]}</text>
            <text y="30" text-anchor="middle" font-size="10" fill="#fff">${p ? esc(p.lastName.slice(0, 11)) : '—'}</text><text y="41" text-anchor="middle" font-size="9" fill="#bfe">${p ? r : ''}</text>${roleOf(T, i, s[0]) !== DEFAULT_ROLE[s[0]] ? `<text y="51" text-anchor="middle" font-size="7.5" fill="#ffd34d">${esc(ROLE_DEFS[roleOf(T, i, s[0])].label)}</text>` : ''}</g>`; }).join('')}
        </svg>
        <p class="muted">${selSlot != null ? `Position <b>${slots[selSlot][0]}</b> gewählt – tippe rechts auf einen Spieler.` : 'Tippe auf eine Position, um sie neu zu besetzen.'}</p>
      </div>
      <div class="card">
        <h3>Spielstil</h3>
        <div class="tabs small wrap">${Object.keys(PRESETS).map((p) => `<button data-preset="${p}" class="${T.preset === p ? 'active' : ''}">${p}</button>`).join('')}</div>
        ${SLIDERS.map(([k, l, lo, hi, tip]) => `<label class="slider"><span>${l} <small>${tip}</small></span><div><em>${lo}</em><input type="range" min="0" max="100" value="${Math.round(T[k] * 100)}" data-k="${k}"><em>${hi}</em></div></label>`).join('')}
        <label class="check"><input type="checkbox" id="trap" ${T.offsideTrap ? 'checked' : ''}> Abseitsfalle (Abwehr rückt nicht mit Gegenspielern zurück)</label>
      </div>
      <div class="card">
        ${selSlot != null ? `<h3>Rolle für ${slots[selSlot][0]}</h3><div class="role-list">${rolesFor(slots[selSlot][0]).map((r) => `<button class="role ${roleOf(T, selSlot, slots[selSlot][0]) === r.key ? 'on' : ''}" data-role="${r.key}"><b>${esc(r.label)}</b><small>${esc(r.desc)}</small></button>`).join('')}</div>` : ''}
        <h3>Spieler ${selSlot != null ? `für ${slots[selSlot][0]}` : ''}</h3>
        <div class="pick-list">${pool.map((p) => {
          const inXI = xiSet.has(p.id), onBench = L.bench.includes(p.id);
          const r = selSlot != null ? effectiveRating(p, slots[selSlot][0]) : p.ovr;
          return `<button class="pick ${inXI ? 'xi' : onBench ? 'bench' : ''}" data-pick="${p.id}" ${available(p) ? '' : 'disabled'}>
            <span class="pos pos-${POSITIONS[p.pos].group}">${p.pos}</span><span class="nm">${esc(shortName(p))}</span>
            <small>${inXI ? 'Startelf' : onBench ? 'Bank' : ''}${!available(p) ? (p.injury > 0 ? 'verletzt' : 'gesperrt') : ''}</small><b class="${ratingClass(r)}">${r}</b></button>`;
        }).join('')}</div>
        <p class="muted">Bank: ${L.bench.map((id) => esc(w.players[id].lastName)).join(', ') || '–'} · Lang drücken / Doppeltipp auf Spieler setzt ihn auf die Bank.</p>
      </div>
    </div>
    <div class="grid2 ${dir ? 'locked' : ''}">
      <div class="card"><h3>⚽ Standardsituationen</h3>
        <div class="kv"><span>Eckball-Variante</span><div class="tabs small" style="margin:0">${Object.entries(CORNER_ROUTINES).map(([k, l]) => `<button data-cr="${k}" class="${(SP.cornerRoutine || 'mix') === k ? 'active' : ''}">${l}</button>`).join('')}</div></div>
        ${[['corner', 'Eckenschütze', (p) => p.attrs.passspiel + p.attrs.technik], ['freekick', 'Freistoßschütze', (p) => p.attrs.abschluss + p.attrs.schusskraft + p.attrs.technik], ['penalty', 'Elfmeterschütze', (p) => p.attrs.abschluss + p.attrs.schusskraft * 0.3]].map(([k, l, sc]) => {
          const xi = L.xi.map((id) => w.players[id]).filter((p) => p && p.pos !== 'TW').sort((a, b) => sc(b) - sc(a));
          return `<div class="kv"><span>${l}</span><select class="input sm" data-sp="${k}"><option value="">Automatisch (${esc(xi[0]?.lastName || '–')})</option>${xi.map((p) => `<option value="${p.id}" ${SP[k] === p.id ? 'selected' : ''}>${esc(p.lastName)} (${Math.round(sc(p) / (k === 'penalty' ? 1.3 : k === 'corner' ? 2 : 3))})</option>`).join('')}</select></div>`;
        }).join('')}
      </div>
      <div class="card"><h3>💾 Taktikvorlagen</h3>
        <div class="row-actions"><input class="input sm" id="tplname" maxlength="24" placeholder="Name, z. B. Heimspiel Pressing"><button class="btn sm primary" id="tplsave">Aktuelle Taktik speichern</button></div>
        ${(club.tacticTemplates || []).map((t, i) => `<div class="kv"><span><b>${esc(t.name)}</b> <small class="muted">${esc(t.tactic.formation)} · ${esc(t.tactic.preset || 'Individuell')}</small></span><span><button class="btn sm" data-tpl="${i}">Laden</button> <button class="btn sm ghost" data-tdel="${i}">✕</button></span></div>`).join('') || '<p class="muted">Speichere Varianten für Heim, Auswärts, Führung oder Rückstand und wechsle mit einem Klick.</p>'}
      </div>
    </div></div>`;
    if (el.querySelector('#auto')) el.querySelector('#auto').onclick = () => { club.lineup = autoLineup(club, w.players, T.formation); toast('Beste Elf aufgestellt'); draw(); };
    el.querySelectorAll('[data-form]').forEach((b) => (b.onclick = () => { T.formation = b.dataset.form; T.roles = {}; club.lineup = autoLineup(club, w.players, T.formation); selSlot = null; draw(); }));
    el.querySelectorAll('[data-preset]').forEach((b) => (b.onclick = () => { Object.assign(T, PRESETS[b.dataset.preset]); T.preset = b.dataset.preset; draw(); }));
    el.querySelectorAll('input[type=range]').forEach((i) => i.addEventListener('input', () => { T[i.dataset.k] = +i.value / 100; T.preset = 'Individuell'; el.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('active')); }));
    el.querySelector('#trap').onchange = (e) => { T.offsideTrap = e.target.checked; };
    el.querySelectorAll('[data-role]').forEach((b) => (b.onclick = () => { (T.roles ||= {})[selSlot] = b.dataset.role; draw(); }));
    el.querySelectorAll('[data-cr]').forEach((b) => (b.onclick = () => { T.setPieces.cornerRoutine = b.dataset.cr; draw(); }));
    el.querySelectorAll('[data-sp]').forEach((s2) => (s2.onchange = () => { T.setPieces[s2.dataset.sp] = s2.value ? +s2.value : null; toast('Schütze festgelegt'); }));
    el.querySelector('#tplsave').onclick = () => {
      const name = el.querySelector('#tplname').value.trim() || `Vorlage ${(club.tacticTemplates || []).length + 1}`;
      (club.tacticTemplates ||= []).push({ name, tactic: JSON.parse(JSON.stringify({ ...T, formation: club.lineup?.formation || T.formation })) });
      club.tacticTemplates = club.tacticTemplates.slice(-8); toast(`„${name}“ gespeichert`); draw();
    };
    el.querySelectorAll('[data-tpl]').forEach((b) => (b.onclick = () => {
      const t = club.tacticTemplates[+b.dataset.tpl];
      Object.assign(T, JSON.parse(JSON.stringify(t.tactic)));
      if (club.lineup?.formation !== T.formation) club.lineup = autoLineup(club, w.players, T.formation);
      toast(`„${t.name}“ geladen`); draw();
    }));
    el.querySelectorAll('[data-tdel]').forEach((b) => (b.onclick = async () => { if (await confirmDialog('Vorlage löschen?')) { club.tacticTemplates.splice(+b.dataset.tdel, 1); draw(); } }));
    el.querySelectorAll('[data-slot]').forEach((g) => g.addEventListener('click', () => { selSlot = selSlot === +g.dataset.slot ? null : +g.dataset.slot; draw(); }));
    el.querySelectorAll('[data-pick]').forEach((b) => {
      b.addEventListener('dblclick', () => toBench(+b.dataset.pick));
      let t; b.addEventListener('touchstart', () => { t = setTimeout(() => toBench(+b.dataset.pick), 550); }, { passive: true });
      b.addEventListener('touchend', () => clearTimeout(t));
      b.addEventListener('click', () => {
        if (selSlot == null) return;
        const id = +b.dataset.pick;
        const L2 = club.lineup;
        const prev = L2.xi[selSlot];
        const at = L2.xi.indexOf(id);
        if (at >= 0) L2.xi[at] = prev; else { L2.bench = L2.bench.filter((x) => x !== id); if (prev && L2.bench.length < 7) L2.bench.push(prev); }
        L2.xi[selSlot] = id;
        selSlot = null; draw();
      });
    });
  };
  const toBench = (id) => {
    const L2 = club.lineup;
    if (L2.xi.includes(id)) return toast('Spieler steht in der Startelf');
    if (L2.bench.includes(id)) L2.bench = L2.bench.filter((x) => x !== id);
    else if (L2.bench.length < 7) L2.bench.push(id); else return toast('Bank ist voll (7)');
    draw();
  };
  draw();
}
