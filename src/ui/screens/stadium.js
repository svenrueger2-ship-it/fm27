// Stadium builder screen: live 3D preview, stand-by-stand construction, global upgrades,
// running projects, naming rights and renaming.
import { STAND_NAMES, standName, interiorOptions, interiorIncome, interiorWeekly, ROOF_NAMES, PITCH_NAMES, projectOptions, globalOptions, startProject, standCapacity, standingShare, atmosphere, hospitalityIncome, namingOffers, recomputeCapacity } from '../../manager/stadiumBuild.js';
import { attendance } from '../../manager/economy.js';
import { userLeague, computeTable, newRng } from '../../manager/season.js';
import { createStadiumPreview } from '../../render/stadiumPreview.js';
import { esc, money, toast, confirmDialog, modal } from '../dom.js';

export function stadiumScreen(app, el) {
  const w = app.world;
  let preview = null, pvT = 0, big = null;
  let tab = app.stadiumTab || 'overview';
  const draw = () => {
    const club = app.club, st = club.stadium, L = st.layout, lg = userLeague(w);
    const rank = computeTable(lg).findIndex((r) => r.id === club.id) + 1;
    const att = attendance(club, lg, rank);
    const f = st.capFactor || 1;
    const stand = (i) => {
      const S = L.stands[i];
      const cap = Math.round(standCapacity(L, i, { ignoreWork: true }) * f / 10) * 10;
      const opts = projectOptions(club, i);
      return `<div class="sb-stand ${S.building ? 'building' : ''}"><div class="sb-sh"><b>${esc(standName(club, i))}</b><button class="btn xs ghost" data-sname="${i}" title="Tribüne umbenennen">✏️</button><span>${cap.toLocaleString('de-DE')} Plätze</span></div>
        ${S.name ? `<small class="muted">${STAND_NAMES[i]}</small>` : ''}
        <div class="sb-tags"><span>${S.tiers} ${S.tiers > 1 ? 'Ränge' : 'Rang'}</span><span>Größe ${S.size}/10</span><span>${S.standing ? '🧍 Stehplätze unten' : '💺 Sitzplätze'}</span><span>${ROOF_NAMES[S.roof]}</span><span>${S.boxes ? `VIP ${'★'.repeat(S.boxes)}` : 'keine Logen'}</span></div>
        ${S.building ? `<p class="sb-work">🏗️ Baustelle: ${esc(S.building)}</p>` : `<div class="sb-opts">${opts.map((o, k) => `<button class="btn sm" data-stand="${i}" data-o="${k}" ${club.budget < o.cost ? 'disabled' : ''}><span>${esc(o.label)}</span><small>${money(o.cost)} · ${o.weeks} Wo.</small></button>`).join('')}</div>`}</div>`;
    };
    const g = globalOptions(club), inner = interiorOptions(club);
    const projects = `<div class="card"><h3>🏗️ Laufende Bauprojekte</h3>${st.projects.length ? st.projects.map((p) => `<div class="sb-proj"><span>${esc(p.label)}</span><div class="meter"><i style="width:${Math.round((1 - p.weeks / p.total) * 100)}%"></i></div><small>noch ${p.weeks} Wo.</small></div>`).join('') : '<p class="muted">Keine Baustelle. Wähle in den Reitern einen Ausbau.</p>'}</div>`;
    const TABS = [['overview', '🏟️ Übersicht'], ['stands', '🧱 Tribünen'], ['interior', '🍺 Innenausbau'], ['tech', '⚙️ Technik & Rasen']];
    let body = '';
    if (tab === 'overview') body = `<div class="sb-top">
        <div class="card sb-view"><div class="sb-canvas" id="sb3d"></div><div class="sb-overlay"><b>${esc(st.name)}</b><small>Ziehen zum Drehen · Mausrad/Pinch zum Zoomen</small></div><button class="btn sm primary sb-big" id="bigview" style="position:absolute;right:12px;bottom:12px;top:auto;left:auto;z-index:3">⛶ Großansicht</button></div>
        <div class="card sb-stats">
          <div class="sb-kpi"><small>Kapazität</small><b>${st.capacity.toLocaleString('de-DE')}</b>${st.fullCapacity > st.capacity ? `<em>nach Bauende ${st.fullCapacity.toLocaleString('de-DE')}</em>` : ''}</div>
          <div class="sb-kpi"><small>Erwartete Zuschauer</small><b>${att.toLocaleString('de-DE')}</b></div>
          <div class="sb-kpi"><small>Stimmung</small><b>${atmosphere(club)}</b><em>Stehplätze, Dächer, Fan-Zone & Museum</em></div>
          <div class="sb-kpi"><small>Stehplatzanteil</small><b>${Math.round(standingShare(L) * 100)} %</b></div>
          <div class="sb-kpi"><small>VIP + Innenausbau / Heimspiel</small><b>${money(hospitalityIncome(club) + interiorIncome(club))}</b></div>
          <div class="sb-kpi"><small>Namensrechte / Saison</small><b>${st.naming ? money(st.naming.perSeason) : '–'}</b>${st.naming ? `<em>${esc(st.naming.brand)} · noch ${st.naming.yearsLeft} Saison(s)</em>` : ''}</div>
          <div class="sb-kpi"><small>Kontostand</small><b>${money(club.budget)}</b></div>
          <div class="sb-misc">${[0, 1, 2, 3].map((i) => `<span>${esc(standName(club, i))}</span>`).join('')}</div>
        </div></div>${projects}`;
    if (tab === 'stands') body = `<p class="muted">Tippe auf ✏️, um einer Tribüne einen eigenen Namen zu geben – z. B. nach einer Vereinslegende.</p><div class="sb-grid">${[0, 1, 2, 3].map(stand).join('')}</div>`;
    if (tab === 'interior') body = `<div class="sb-inner">${inner.map((it, k) => `<div class="card sb-in ${it.busy ? 'building' : ''}"><div class="sb-sh"><b>${it.icon} ${esc(it.name)}</b><span class="stars">${'●'.repeat(it.level)}${'○'.repeat(it.max - it.level)}</span></div><small class="muted">${esc(it.desc)}</small>
        ${it.done ? '<p class="good">✔ Voll ausgebaut</p>' : it.busy ? '<p class="sb-work">🏗️ Im Bau</p>' : `<button class="btn sm primary" data-in="${k}" ${club.budget < it.opt.cost ? 'disabled' : ''}>Stufe ${it.level + 1} · ${money(it.opt.cost)} · ${it.opt.weeks} Wo.</button>`}</div>`).join('')}</div>
        <p class="muted">Aktuelle Zusatzeinnahmen: ${money(interiorIncome(club))} pro Heimspiel + ${money(interiorWeekly(club))} pro Woche (Museum & Medienzentrum). Kabinentrakt: +${(L.interior?.kabine || 0) * 2} Fitness pro Woche.</p>`;
    if (tab === 'tech') body = `<div class="grid-2"><div class="card"><h3>⚙️ Stadiontechnik & Rasen</h3><div class="sb-misc"><span>💡 Flutlicht ${L.lights}/3</span><span>📺 ${L.screens} Videowand/-wände</span><span>🌱 ${PITCH_NAMES[L.pitch]}</span><span>Gästeblock: ${['klein', 'mit Trennzaun', 'groß'][L.away ?? 1]}</span><span>Familienbereich: ${['keiner', 'vorhanden', 'groß'][L.family ?? 0]}</span></div>
        ${g.length ? g.map((o, k) => `<div class="facility"><div><b>${esc(o.label)}</b><br><small>${esc(o.desc)}</small></div><button class="btn sm primary" data-g="${k}" ${club.budget < o.cost ? 'disabled' : ''}>${money(o.cost)} · ${o.weeks} Wo.</button></div>`).join('') : '<p class="muted">Alles auf dem neuesten Stand.</p>'}</div>${projects}</div>`;
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🏟️ ${esc(st.name)}</h2><div class="row-actions"><button class="btn sm" id="rename">✏️ Stadion umbenennen</button><button class="btn sm primary" id="naming">💼 Namensrechte</button></div></div>
      <div class="tabs sb-tabs">${TABS.map(([k, l]) => `<button class="${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    preview?.dispose(); preview = null; clearTimeout(pvT);
    const host = el.querySelector('#sb3d');
    if (host) pvT = setTimeout(() => { if (host.isConnected) preview = createStadiumPreview(host, { club, quality: app.settings.quality }); }, 30);
    el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = app.stadiumTab = b.dataset.tab; draw(); }));
    const go = async (opt, standIdx) => {
      if (!(await confirmDialog(`${standIdx != null ? standName(club, standIdx) + ': ' : ''}${opt.label} für ${money(opt.cost)}? Bauzeit ${opt.weeks} Wochen.`, 'Bauen'))) return;
      const r = startProject(w, club, opt, standIdx);
      toast(r.ok ? 'Bauarbeiten gestartet' : r.msg);
      draw();
    };
    el.querySelectorAll('[data-stand]').forEach((b) => (b.onclick = () => go(projectOptions(club, +b.dataset.stand)[+b.dataset.o], +b.dataset.stand)));
    el.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => go(globalOptions(club)[+b.dataset.g], null)));
    el.querySelectorAll('[data-in]').forEach((b) => (b.onclick = () => go(interiorOptions(club)[+b.dataset.in].opt, null)));
    el.querySelectorAll('[data-sname]').forEach((b) => (b.onclick = () => {
      const i = +b.dataset.sname, S = L.stands[i];
      const m = modal(`<h3>Tribüne umbenennen</h3><p class="muted">${STAND_NAMES[i]}</p><label class="field">Name<input id="nn" maxlength="34" value="${esc(S.name || '')}" placeholder="${STAND_NAMES[i]}"></label><div class="row-actions end"><button class="btn" id="reset">Standardname</button><button class="btn primary" id="ok">Speichern</button></div>`);
      m.el.querySelector('#ok').onclick = () => { const v = m.el.querySelector('#nn').value.trim(); S.name = v || null; if (v) w.news.unshift({ season: w.season, week: w.week + 1, text: `🏟️ Die ${STAND_NAMES[i]} heißt ab sofort „${v}“.` }); m.close(); toast('Tribüne umbenannt'); draw(); };
      m.el.querySelector('#reset').onclick = () => { S.name = null; m.close(); draw(); };
    }));
    el.querySelector('#bigview')?.addEventListener('click', () => {
      const m = modal(`<div class="sb-full"><div class="sb-full-head"><b>${esc(st.name)}</b><small>${st.capacity.toLocaleString('de-DE')} Plätze · ${[0, 1, 2, 3].map((i) => esc(standName(club, i))).join(' · ')}</small></div><div class="sb-full-canvas" id="sbbig"></div></div>`, { wide: true, onClose: () => { big?.dispose(); big = null; } });
      m.el.closest('.modal-wrap').classList.add('full');
      setTimeout(() => { const h = m.el.querySelector('#sbbig'); if (h?.isConnected) big = createStadiumPreview(h, { club, quality: app.settings.quality }); }, 30);
    });
    el.querySelector('#rename').onclick = () => {
      if (st.naming) return toast(`Solange der Vertrag mit ${st.naming.brand} läuft, trägt das Stadion dessen Namen.`);
      const m = modal(`<h3>Stadion umbenennen</h3><label class="field">Neuer Name<input id="nn" maxlength="40" value="${esc(st.name)}"></label><div class="row-actions end"><button class="btn primary" id="ok">Speichern</button></div>`);
      m.el.querySelector('#ok').onclick = () => { const v = m.el.querySelector('#nn').value.trim(); if (v) { st.name = v; st.baseName = v; toast('Stadion umbenannt'); } m.close(); draw(); };
    };
    el.querySelector('#naming').onclick = () => namingDialog(app, club, () => draw());
  };
  draw();
  return () => { clearTimeout(pvT); preview?.dispose(); big?.dispose(); };
}

function namingDialog(app, club, done) {
  const w = app.world, st = club.stadium;
  if (st.naming) return toast(`Vertrag mit ${st.naming.brand} läuft noch ${st.naming.yearsLeft} Saison(s).`);
  const rng = newRng(w);
  const offers = namingOffers(club, rng, userLeague(w).tier);
  const m = modal(`<h3>💼 Namensrechte verkaufen</h3><p class="muted">Ein Sponsor zahlt jedes Jahr dafür, dass das Stadion seinen Namen trägt. Fans mögen das nicht immer – die Stimmung leidet nicht, aber der Traditionsname verschwindet für die Laufzeit.</p>
    <div class="sim-opts">${offers.map((o, k) => `<button class="btn" data-k="${k}"><b>${esc(o.name)}</b><small>${money(o.perSeason)} pro Saison · ${o.years} Jahre</small></button>`).join('')}</div>
    <p class="muted">Tipp: Bei längeren Verträgen zahlt der Sponsor mehr pro Jahr. Du kannst auch nachverhandeln – mit Risiko.</p>
    <div class="row-actions end"><button class="btn" id="haggle">Nachverhandeln (+15 %)</button></div>`);
  let pick = 2;
  m.el.querySelectorAll('[data-k]').forEach((b) => (b.onclick = async () => {
    const o = offers[+b.dataset.k];
    if (!(await confirmDialog(`${o.years}-Jahres-Vertrag mit ${o.brand} über ${money(o.perSeason)} pro Saison unterschreiben? Das Stadion heißt dann „${o.name}“.`, 'Unterschreiben'))) return;
    sign(o); m.close();
  }));
  const sign = (o) => {
    st.baseName ||= st.name;
    st.naming = { brand: o.brand, perSeason: o.perSeason, yearsLeft: o.years };
    st.name = o.name; st.namingRound = (st.namingRound || 0) + 1;
    w.news.unshift({ season: w.season, week: w.week + 1, text: `💼 Namensrechte: Das Stadion heißt ab sofort „${o.name}“ (${money(o.perSeason)} pro Saison, ${o.years} Jahre).` });
    toast('Vertrag unterschrieben'); done();
  };
  m.el.querySelector('#haggle').onclick = () => {
    const o = offers[pick];
    if (rng.chance(0.55)) { o.perSeason = Math.round(o.perSeason * 1.15 / 1e5) * 1e5; toast(`${o.brand} legt nach: ${money(o.perSeason)} pro Saison`); sign(o); m.close(); }
    else { toast(`${o.brand} zieht sein Angebot zurück.`); offers.splice(pick, 1); m.close(); st.namingRound = (st.namingRound || 0) + 1; }
  };
}
