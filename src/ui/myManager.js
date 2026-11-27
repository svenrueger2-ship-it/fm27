// v7.0.6: "Mein Manager" – one manager profile for all careers. Created once in the main menu (mandatory on the
// first start) and used as the default whenever a new career begins. Stored locally on this device.
import { esc, modal, portrait, toast } from './dom.js';

const KEY = 'fm27-my-manager';
export const DEFAULT_MANAGER = { first: 'Sven', last: 'Rüger', age: 38, nat: 'GER', face: 0, outfit: 'anzug', bg: 'profi', spec: 'taktiker' };
export function loadMyManager() { try { const m = JSON.parse(localStorage.getItem(KEY) || 'null'); return m && m.first && m.last ? m : null; } catch { return null; } }
export function saveMyManager(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch {} }

/** Opens the editor. forced = first start: cannot be closed without creating the manager. */
export async function myManagerModal(app, { forced = false, onDone } = {}) {
  const [{ FACE_COUNT }, MC, { SKILLS }] = await Promise.all([import('../data/faces.js'), import('./screens/managerCreate.js'), import('../manager/progress.js')]);
  const { OUTFITS, BACKGROUNDS, NATS } = MC;
  const st = { ...DEFAULT_MANAGER, ...(loadMyManager() || {}) };
  const m = modal('<div class="mym"></div>', { forced, wide: true });
  const host = m.el.querySelector('.mym');
  const colors = () => { const o = OUTFITS.find((x) => x.id === st.outfit) || OUTFITS[0]; return o.club ? { primary: '#2a2f45', secondary: '#e6e8f2' } : { primary: o.c1, secondary: o.c2 }; };
  const valid = () => st.first.trim().length >= 2 && st.last.trim().length >= 2;
  const draw = () => {
    host.innerHTML = `<h3>👔 ${forced ? 'Erstelle deinen Manager' : 'Mein Manager'}</h3>
      <p class="muted">${forced ? 'Bevor es losgeht: Dein Manager wird für jede neue Karriere automatisch übernommen – du kannst ihn jederzeit im Menü unter „👔 Mein Manager“ ändern.' : 'Wird bei jeder neuen Karriere automatisch übernommen.'}</p>
      <div class="mym-grid"><div class="mym-face">${portrait({ id: -1, looks: { face: st.face } }, { colors: colors() }, 130)}
        <div class="row-actions center"><button class="btn sm" id="y-prev">◀</button><button class="btn sm" id="y-rnd">🎲</button><button class="btn sm" id="y-next">▶</button></div><small class="muted">Gesicht ${st.face + 1} / ${FACE_COUNT}</small></div>
      <div>
        <div class="mc-row"><label class="field">Vorname<input id="y-first" maxlength="16" value="${esc(st.first)}"></label><label class="field">Nachname<input id="y-last" maxlength="20" value="${esc(st.last)}"></label></div>
        <div class="mc-row"><label class="field">Nationalität<select id="y-nat" class="input">${NATS.map(([k, v]) => `<option value="${k}" ${k === st.nat ? 'selected' : ''}>${v.flag} ${esc(v.name)}</option>`).join('')}</select></label>
          <label class="field">Alter: <b id="y-agev">${st.age}</b><input id="y-age" type="range" min="28" max="70" value="${st.age}"></label></div>
        <div class="mc-row"><label class="field">Outfit<select id="y-out" class="input">${OUTFITS.map((o) => `<option value="${o.id}" ${o.id === st.outfit ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
          <label class="field">Werdegang<select id="y-bg" class="input">${BACKGROUNDS.map((b) => `<option value="${b.id}" ${b.id === st.bg ? 'selected' : ''}>${b.icon} ${esc(b.name)} (${esc(b.fx)})</option>`).join('')}</select></label></div>
        <label class="field">Spezialisierung<select id="y-spec" class="input">${SKILLS.map((s) => `<option value="${s.id}" ${s.id === st.spec ? 'selected' : ''}>${s.icon} ${esc(s.name)}</option>`).join('')}</select></label>
      </div></div>
      <div class="row-actions end">${forced ? '' : '<button class="btn ghost" id="y-cancel">Abbrechen</button>'}<button class="btn primary lg" id="y-ok" ${valid() ? '' : 'disabled'}>${forced ? 'Manager erstellen ▶' : '💾 Speichern'}</button></div>`;
    const q = (s) => host.querySelector(s);
    q('#y-first').oninput = (e) => { st.first = e.target.value; q('#y-ok').disabled = !valid(); };
    q('#y-last').oninput = (e) => { st.last = e.target.value; q('#y-ok').disabled = !valid(); };
    q('#y-nat').onchange = (e) => (st.nat = e.target.value);
    q('#y-age').oninput = (e) => { st.age = +e.target.value; q('#y-agev').textContent = st.age; };
    q('#y-out').onchange = (e) => { st.outfit = e.target.value; draw(); };
    q('#y-bg').onchange = (e) => (st.bg = e.target.value);
    q('#y-spec').onchange = (e) => (st.spec = e.target.value);
    const face = (i) => { st.face = (i + FACE_COUNT) % FACE_COUNT; draw(); };
    q('#y-prev').onclick = () => face(st.face - 1); q('#y-next').onclick = () => face(st.face + 1); q('#y-rnd').onclick = () => face(Math.floor(Math.random() * FACE_COUNT));
    q('#y-cancel')?.addEventListener('click', () => m.close());
    q('#y-ok').onclick = () => {
      if (!valid()) return;
      saveMyManager({ ...st, first: st.first.trim(), last: st.last.trim() });
      toast(`👔 ${st.first.trim()} ${st.last.trim()} gespeichert`);
      m.close(); onDone?.();
    };
  };
  draw();
}
