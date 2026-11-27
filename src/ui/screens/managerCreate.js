// v3.0.4 Manager-Editor: every career starts with creating your own manager (name, look, background, specialty).
import { esc, portrait, toast } from '../dom.js';
import { FACE_COUNT } from '../../data/faces.js';
import { NATIONS_EXTRA } from '../../data/nationsExtra.js';
import { SKILLS, ensureMgr } from '../../manager/progress.js';
import { ensureMood } from '../../manager/events.js';
import { loadMyManager, saveMyManager } from '../myManager.js';

export const OUTFITS = [
  { id: 'anzug', name: 'Schwarzer Anzug', c1: '#1b1b24', c2: '#d9d9e6' },
  { id: 'navy', name: 'Navy-Sakko', c1: '#1d2f5c', c2: '#e7ecff' },
  { id: 'grau', name: 'Grauer Anzug', c1: '#4a4d57', c2: '#f2f2f2' },
  { id: 'club', name: 'Trainingsanzug (Vereinsfarben)', club: true },
  { id: 'mantel', name: 'Langer Mantel', c1: '#2b2420', c2: '#c9a27a' },
  { id: 'casual', name: 'Lässig (Pulli)', c1: '#6b2d3c', c2: '#f5d7de' },
];
export const BACKGROUNDS = [
  { id: 'nat', icon: '🏅', name: 'Ex-Nationalspieler', desc: 'Die Fans lieben dich von Tag 1.', fx: 'Fans +8' },
  { id: 'profi', icon: '⚽', name: 'Ex-Profi', desc: 'Kennt die Kabine von innen.', fx: 'Fans +4 · Vorstand +3' },
  { id: 'akademie', icon: '🎓', name: 'Trainerakademie', desc: 'Fußballlehrer-Lizenz mit Bestnote.', fx: 'Vorstand +8' },
  { id: 'quer', icon: '💡', name: 'Quereinsteiger', desc: 'Datenanalyst ohne Profikarriere.', fx: '+1 Skillpunkt' },
];
export const NATS = Object.entries(NATIONS_EXTRA).sort((a, b) => a[1].name.localeCompare(b[1].name, 'de'));

export const mgrOutfit = (w) => {
  const o = OUTFITS.find((x) => x.id === w.manager?.looks?.outfit) || OUTFITS[0];
  const club = w.clubs?.[w.userClubId];
  return o.club && club ? club.colors : { primary: o.c1, secondary: o.c2 };
};
/** The manager's portrait (face from the face atlas, outfit colours as background ring). */
export function mgrPortrait(w, size = 64) {
  return portrait({ id: -1, looks: { face: w.manager?.looks?.face ?? 0 } }, { colors: mgrOutfit(w) }, size);
}
export const mgrNeedsCreation = (w) => w && w.userClubId != null && !w.manager?.looks;

export function managerCreateScreen(app, el) {
  const w = app.world, club = w.clubs[w.userClubId], editing = !!w.manager?.looks;
  const my = !editing ? loadMyManager() : null; // v7.0.6: your saved manager from the menu is the default
  const old = w.manager?.looks ? w.manager : my ? { ...(w.manager || {}), first: my.first, last: my.last, age: my.age, nat: my.nat, looks: { face: my.face, outfit: my.outfit }, background: my.bg, spec: my.spec } : (w.manager || {});
  const [f0, ...l0] = (old.name && old.name !== 'Manager' ? old.name : '').split(' ');
  const st = {
    first: old.first ?? f0 ?? '', last: old.last ?? l0.join(' ') ?? '', age: old.age ?? 38, nat: old.nat ?? 'GER',
    face: old.looks?.face ?? Math.floor(Math.random() * FACE_COUNT), outfit: old.looks?.outfit ?? 'anzug',
    bg: old.background ?? 'profi', spec: old.spec ?? 'taktiker',
  };
  const shown = () => ({ manager: { looks: { face: st.face, outfit: st.outfit } }, clubs: w.clubs, userClubId: w.userClubId });
  const valid = () => st.first.trim().length >= 2 && st.last.trim().length >= 2;

  const preview = () => {
    const n = NATIONS_EXTRA[st.nat], B = BACKGROUNDS.find((b) => b.id === st.bg), S = SKILLS.find((s) => s.id === st.spec);
    return `<div class="mc-card" style="--c1:${mgrOutfit(shown()).primary};--c2:${mgrOutfit(shown()).secondary}">
      <div class="mc-face">${mgrPortrait(shown(), 150)}</div>
      <small>${editing ? 'DEIN MANAGER' : 'NEUER MANAGER'}</small>
      <h2>${esc(st.first.trim() || 'Vorname')}<b>${esc(st.last.trim() || 'Nachname')}</b></h2>
      <div class="mc-chips"><span>${n?.flag || ''} ${esc(n?.name || '')}</span><span>${st.age} Jahre</span></div>
      <div class="mc-chips"><span>${B.icon} ${esc(B.name)}</span><span>${S.icon} ${esc(S.name)}</span></div>
      <p class="mc-club">${club ? `Trainer bei <b>${esc(club.name)}</b>` : ''}</p></div>`;
  };
  const draw = () => {
    el.innerHTML = `<div class="page mc-page"><div class="page-head"><h2>👔 ${editing ? 'Manager bearbeiten' : 'Erstelle deinen Manager'}</h2>${editing ? '' : '<span class="chip">Schritt 2 von 2</span>'}</div>
      ${my ? `<div class="card mc-quick"><div><small class="muted">DEIN MANAGER AUS DEM MENÜ</small><h3>👔 ${esc(my.first)} ${esc(my.last)}</h3><p class="muted small">Alles ist schon ausgefüllt – direkt starten oder unten anpassen.</p></div><button class="btn primary lg" id="mc-quick">▶ Mit ${esc(my.first)} ${esc(my.last)} starten</button></div>` : ''}
      <div class="mc-grid"><div class="mc-prev">${preview()}</div>
      <div class="mc-form">
        <div class="card"><h3>Name & Herkunft</h3>
          <div class="mc-row"><label class="field">Vorname<input id="mc-first" maxlength="16" value="${esc(st.first)}" placeholder="z. B. Alex"></label>
          <label class="field">Nachname<input id="mc-last" maxlength="20" value="${esc(st.last)}" placeholder="z. B. Berger"></label></div>
          <div class="mc-row"><label class="field">Nationalität<select id="mc-nat" class="input">${NATS.map(([k, v]) => `<option value="${k}" ${k === st.nat ? 'selected' : ''}>${v.flag} ${esc(v.name)}</option>`).join('')}</select></label>
          <label class="field">Alter: <b id="mc-agev">${st.age}</b><input id="mc-age" type="range" min="28" max="70" value="${st.age}"></label></div></div>
        <div class="card"><div class="row-between"><h3>Aussehen</h3><span class="muted small">Gesicht ${st.face + 1} / ${FACE_COUNT}</span></div>
          <div class="mc-faces"><button class="btn sm" id="mc-prev">◀</button><div class="mc-strip">${[-3, -2, -1, 0, 1, 2, 3].map((d) => { const i = (st.face + d + FACE_COUNT) % FACE_COUNT;
            return `<button class="mc-f ${d === 0 ? 'on' : ''}" data-face="${i}">${portrait({ id: -1, looks: { face: i } }, { colors: mgrOutfit(shown()) }, 54)}</button>`; }).join('')}</div>
          <button class="btn sm" id="mc-next">▶</button><button class="btn sm" id="mc-rnd">🎲 Zufall</button></div>
          <div class="mc-opts">${OUTFITS.map((o) => `<button class="mc-o ${o.id === st.outfit ? 'on' : ''}" data-outfit="${o.id}"><i style="background:${o.club ? `linear-gradient(135deg, ${club?.colors.primary || '#333'} 50%, ${club?.colors.secondary || '#fff'} 50%)` : `linear-gradient(135deg, ${o.c1} 60%, ${o.c2} 60%)`}"></i>${esc(o.name)}</button>`).join('')}</div></div>
        <div class="card"><h3>Werdegang ${editing ? '<small class="muted">(Bonus nur beim Erstellen)</small>' : ''}</h3><div class="mc-pick">${BACKGROUNDS.map((b) => `<button class="mc-p ${b.id === st.bg ? 'on' : ''}" data-bg="${b.id}" ${editing ? 'disabled' : ''}><b>${b.icon} ${esc(b.name)}</b><small>${esc(b.desc)}</small><em>${esc(b.fx)}</em></button>`).join('')}</div></div>
        <div class="card"><h3>Spezialisierung ${editing ? '<small class="muted">(fest)</small>' : '<small class="muted">– Stufe 1 gratis</small>'}</h3><div class="mc-pick">${SKILLS.map((s) => `<button class="mc-p ${s.id === st.spec ? 'on' : ''}" data-spec="${s.id}" ${editing ? 'disabled' : ''}><b>${s.icon} ${esc(s.name)}</b><small>${esc(s.ranks[0])}</small></button>`).join('')}</div></div>
        <div class="row-actions end">${editing ? '<button class="btn ghost" id="mc-cancel">Abbrechen</button>' : ''}<button class="btn primary lg" id="mc-go" ${valid() ? '' : 'disabled'}>${editing ? 'Speichern' : 'Karriere beginnen ▶'}</button></div>
      </div></div></div>`;
    const q = (s) => el.querySelector(s);
    const refresh = () => { q('.mc-prev').innerHTML = preview(); q('#mc-go').disabled = !valid(); };
    q('#mc-first').oninput = (e) => { st.first = e.target.value; refresh(); };
    q('#mc-last').oninput = (e) => { st.last = e.target.value; refresh(); };
    q('#mc-nat').onchange = (e) => { st.nat = e.target.value; refresh(); };
    q('#mc-age').oninput = (e) => { st.age = +e.target.value; q('#mc-agev').textContent = st.age; refresh(); };
    const setFace = (i) => { st.face = (i + FACE_COUNT) % FACE_COUNT; draw(); };
    q('#mc-prev').onclick = () => setFace(st.face - 1); q('#mc-next').onclick = () => setFace(st.face + 1);
    q('#mc-rnd').onclick = () => setFace(Math.floor(Math.random() * FACE_COUNT));
    el.querySelectorAll('[data-face]').forEach((b) => (b.onclick = () => setFace(+b.dataset.face)));
    el.querySelectorAll('[data-outfit]').forEach((b) => (b.onclick = () => { st.outfit = b.dataset.outfit; draw(); }));
    el.querySelectorAll('[data-bg]').forEach((b) => (b.onclick = () => { st.bg = b.dataset.bg; draw(); }));
    el.querySelectorAll('[data-spec]').forEach((b) => (b.onclick = () => { st.spec = b.dataset.spec; draw(); }));
    q('#mc-cancel')?.addEventListener('click', () => app.go('profile'));
    q('#mc-quick')?.addEventListener('click', () => q('#mc-go').click());
    q('#mc-go').onclick = async () => {
      if (!valid()) return;
      const first = st.first.trim(), last = st.last.trim();
      w.manager = { ...old, name: `${first} ${last}`, first, last, age: st.age, nat: st.nat, looks: { face: st.face, outfit: st.outfit } };
      if (!editing) {
        if (!loadMyManager()) saveMyManager({ first, last, age: st.age, nat: st.nat, face: st.face, outfit: st.outfit, bg: st.bg, spec: st.spec });
        w.manager.background = st.bg; w.manager.spec = st.spec; w.manager.bornSeason = w.season - st.age;
        const M = ensureMgr(w), mood = ensureMood(w);
        M.skills[st.spec] = Math.max(1, M.skills[st.spec] || 0);
        if (st.bg === 'nat') mood.fans = Math.min(100, mood.fans + 8);
        if (st.bg === 'profi') { mood.fans = Math.min(100, mood.fans + 4); mood.board = Math.min(100, mood.board + 3); }
        if (st.bg === 'akademie') mood.board = Math.min(100, mood.board + 8);
        if (st.bg === 'quer') M.points += 1;
        (w.news ||= []).unshift({ season: w.season, week: w.week, text: `${club ? club.name + ' präsentiert' : 'Vorgestellt:'} ${first} ${last} (${st.age}, ${NATIONS_EXTRA[st.nat]?.name || ''}) als neuen Cheftrainer.` });
      }
      await app.save(app.slot || 'slot1', true);
      toast(editing ? 'Manager gespeichert' : `Willkommen, ${first} ${last}!`);
      app.go(editing ? 'profile' : 'home');
    };
  };
  draw();
}
