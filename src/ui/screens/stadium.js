// Stadium builder screen: live 3D preview, stand-by-stand construction, global upgrades,
// running projects, naming rights and renaming.
import { STAND_NAMES, ROOF_NAMES, PITCH_NAMES, projectOptions, globalOptions, startProject, standCapacity, standingShare, atmosphere, hospitalityIncome, namingOffers, recomputeCapacity } from '../../manager/stadiumBuild.js';
import { attendance } from '../../manager/economy.js';
import { userLeague, computeTable, newRng } from '../../manager/season.js';
import { createStadiumPreview } from '../../render/stadiumPreview.js';
import { esc, money, toast, confirmDialog, modal } from '../dom.js';

export function stadiumScreen(app, el) {
  const w = app.world;
  let preview = null, pvT = 0;
  const draw = (rebuild3D = false) => {
    const club = app.club, st = club.stadium, L = st.layout, lg = userLeague(w);
    const rank = computeTable(lg).findIndex((r) => r.id === club.id) + 1;
    const att = attendance(club, lg, rank);
    const f = st.capFactor || 1;
    const stand = (i) => {
      const S = L.stands[i];
      const cap = Math.round(standCapacity(L, i, { ignoreWork: true }) * f / 10) * 10;
      const opts = projectOptions(club, i);
      return `<div class="sb-stand ${S.building ? 'building' : ''}"><div class="sb-sh"><b>${STAND_NAMES[i]}</b><span>${cap.toLocaleString('de-DE')} Plätze</span></div>
        <div class="sb-tags"><span>${S.tiers} ${S.tiers > 1 ? 'Ränge' : 'Rang'}</span><span>Größe ${S.size}/10</span><span>${S.standing ? '🧍 Stehplätze unten' : '💺 Sitzplätze'}</span><span>${ROOF_NAMES[S.roof]}</span><span>${S.boxes ? `VIP ${'★'.repeat(S.boxes)}` : 'keine Logen'}</span></div>
        ${S.building ? `<p class="sb-work">🏗️ Baustelle: ${esc(S.building)}</p>` : `<div class="sb-opts">${opts.map((o, k) => `<button class="btn sm" data-stand="${i}" data-o="${k}" ${club.budget < o.cost ? 'disabled' : ''}><span>${esc(o.label)}</span><small>${money(o.cost)} · ${o.weeks} Wo.</small></button>`).join('')}</div>`}</div>`;
    };
    const g = globalOptions(club);
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🏟️ Stadion bauen</h2><div class="row-actions"><button class="btn sm" id="rename">✏️ Umbenennen</button><button class="btn sm primary" id="naming">💼 Namensrechte</button></div></div>
      <div class="sb-top">
        <div class="card sb-view"><div class="sb-canvas" id="sb3d"></div><div class="sb-overlay"><b>${esc(st.name)}</b><small>Dächer durchsichtig dargestellt · Ziehen zum Drehen · Mausrad zum Zoomen</small></div></div>
        <div class="card sb-stats">
          <div class="sb-kpi"><small>Kapazität</small><b>${st.capacity.toLocaleString('de-DE')}</b>${st.fullCapacity > st.capacity ? `<em>nach Bauende ${st.fullCapacity.toLocaleString('de-DE')}</em>` : ''}</div>
          <div class="sb-kpi"><small>Erwartete Zuschauer</small><b>${att.toLocaleString('de-DE')}</b></div>
          <div class="sb-kpi"><small>Stimmung</small><b>${atmosphere(club)}</b><em>Stehplätze, Dächer & Gästeblock erhöhen sie</em></div>
          <div class="sb-kpi"><small>Gästeblock · Familienbereich</small><b>${['klein', 'mit Trennzaun', 'groß'][L.away ?? 1]} · ${['keiner', 'vorhanden', 'groß'][L.family ?? 0]}</b></div>
          <div class="sb-kpi"><small>Stehplatzanteil</small><b>${Math.round(standingShare(L) * 100)} %</b><em>günstigere Tickets, mehr Lärm</em></div>
          <div class="sb-kpi"><small>VIP-Einnahmen / Heimspiel</small><b>${money(hospitalityIncome(club))}</b></div>
          <div class="sb-kpi"><small>Namensrechte / Saison</small><b>${st.naming ? money(st.naming.perSeason) : '–'}</b>${st.naming ? `<em>${esc(st.naming.brand)} · noch ${st.naming.yearsLeft} Saison(s)</em>` : ''}</div>
          <div class="sb-kpi"><small>Kontostand</small><b>${money(club.budget)}</b></div>
          <div class="sb-misc"><span>💡 Flutlicht Stufe ${L.lights}/3</span><span>📺 ${L.screens} Videowand/-wände</span><span>🌱 ${PITCH_NAMES[L.pitch]}</span></div>
        </div>
      </div>
      <div class="sb-grid">${[0, 1, 2, 3].map(stand).join('')}</div>
      <div class="grid-2">
        <div class="card"><h3>⚙️ Stadiontechnik & Rasen</h3>${g.length ? g.map((o, k) => `<div class="facility"><div><b>${esc(o.label)}</b><br><small>${esc(o.desc)}</small></div><button class="btn sm primary" data-g="${k}" ${club.budget < o.cost ? 'disabled' : ''}>${money(o.cost)} · ${o.weeks} Wo.</button></div>`).join('') : '<p class="muted">Alles auf höchster Stufe.</p>'}</div>
        <div class="card"><h3>🏗️ Laufende Bauprojekte</h3>${st.projects.length ? st.projects.map((p) => `<div class="sb-proj"><span>${esc(p.label)}</span><div class="meter"><i style="width:${Math.round((1 - p.weeks / p.total) * 100)}%"></i></div><small>noch ${p.weeks} Woche(n)</small></div>`).join('') : '<p class="muted">Keine Baustellen. Während eines Umbaus fasst die betroffene Tribüne nur die halbe Zuschauerzahl.</p>'}</div>
      </div></div>`;
    // 3D preview
    const host = el.querySelector('#sb3d');
    // v4.0: the page appears first, the 3D preview is built right after (no frozen tap)
    preview?.dispose(); preview = null; clearTimeout(pvT);
    pvT = setTimeout(() => { if (host.isConnected) preview = createStadiumPreview(host, { club, quality: app.settings.quality }); }, 30);
    const go = async (opt, standIdx) => {
      if (!(await confirmDialog(`${standIdx != null ? STAND_NAMES[standIdx] + ': ' : ''}${opt.label} für ${money(opt.cost)}? Bauzeit ${opt.weeks} Wochen.`, 'Bauen'))) return;
      const r = startProject(w, club, opt, standIdx);
      toast(r.ok ? 'Bauarbeiten gestartet' : r.msg);
      draw(true);
    };
    el.querySelectorAll('[data-stand]').forEach((b) => (b.onclick = () => go(projectOptions(club, +b.dataset.stand)[+b.dataset.o], +b.dataset.stand)));
    el.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => go(globalOptions(club)[+b.dataset.g], null)));
    el.querySelector('#rename').onclick = () => {
      if (st.naming) return toast(`Solange der Vertrag mit ${st.naming.brand} läuft, trägt das Stadion dessen Namen.`);
      const m = modal(`<h3>Stadion umbenennen</h3><label class="field">Neuer Name<input id="nn" maxlength="40" value="${esc(st.name)}"></label><div class="row-actions end"><button class="btn primary" id="ok">Speichern</button></div>`);
      m.el.querySelector('#ok').onclick = () => { const v = m.el.querySelector('#nn').value.trim(); if (v) { st.name = v; st.baseName = v; toast('Stadion umbenannt'); } m.close(); draw(true); };
    };
    el.querySelector('#naming').onclick = () => namingDialog(app, club, () => draw(true));
  };
  draw(true);
  return () => { clearTimeout(pvT); preview?.dispose(); };
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
