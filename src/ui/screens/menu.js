import { IS_MOBILE } from '../../core/device.js';
// Start menu, new game / club selection, save slots, settings, season end.
import { wmStartHtml, bindWmStart } from './wm.js';
import { isHot, allSeasonsOver, setupHotseat, humanName } from '../../manager/hotseat.js';
import { endWeek } from '../turn.js';
import { buildStory, showStory } from '../story.js';
import { ceremony } from '../fx.js';
import { generateWorld } from '../../data/generator.js';
import { teamStrength } from '../../match/tactics.js';
import { listSaves, loadGame, saveGame, deleteGame, saveSettings, loadSettings } from '../../storage/db.js';
import { computeTable, endSeason, newRng, userLeague, userFixture, isUserSeasonOver } from '../../manager/season.js';
import { CHALLENGES, startChallenge, checkAchievements } from '../../manager/achievements.js';
import { applyTheme } from '../theme.js';
import { SCENARIOS, scenarioRecords, buildScenario, evaluateScenario } from '../../manager/scenarios.js';
import { gainXp } from '../../manager/progress.js';
import { PATCHNOTES, GAME_VERSION } from '../../data/patchnotes.js';
import { ensureCoach, coachDecides } from '../../manager/director.js';
import { crest, esc, money, toast, modal, confirmDialog, flag, nationName } from '../dom.js';
import { CAMERA_MODES } from '../../render/camera.js';
import { startMenuScene } from '../../render/menuScene.js';

const isDesktop = () => !!window.bakusa;

function patchHtml() {
  const sec = (title, items, cls) => items?.length ? `<h5 class="${cls}">${title}</h5><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
  return PATCHNOTES.map((p, i) => `<article class="pn ${i === 0 ? 'open' : ''}">
    <button class="pn-head"><span class="pn-ver">v${esc(p.version)}</span><span class="pn-title">${esc(p.title)}</span><small>${esc(p.date)}</small></button>
    <div class="pn-body">${sec('Neu', p.neu, 'n')}${sec('Verbessert', p.verbessert, 'v')}${sec('Behoben', p.behoben, 'b')}${sec('Geplant', p.geplant, 'g')}</div></article>`).join('');
}

// Career snapshot from a loaded world (centre panel of the start screen)
function careerHtml(w, save) {
  const club = w.clubs[w.userClubId];
  if (!club) return '';
  const L = userLeague(w);
  const table = computeTable(L);
  const rank = table.findIndex((r) => r.id === club.id) + 1;
  let last = null;
  for (let i = Math.min(w.week, L.fixtures.length) - 1; i >= 0 && !last; i--) last = L.fixtures[i].find((m) => (m.h === club.id || m.a === club.id) && m.hg != null) || null;
  const next = userFixture(w);
  const vs = (m) => { const H = w.clubs[m.h], A = w.clubs[m.a]; return `<div class="sv-match">${crest(H, 34)}<b>${esc(H.short)}</b><span>${m.hg != null ? `${m.hg} : ${m.ag}` : 'vs'}</span><b>${esc(A.short)}</b>${crest(A, 34)}</div>`; };
  const news = (w.news || []).slice(0, 5);
  const tr = (w.transfer?.history || []).slice(0, 5);
  const season = `${w.season}/${String((w.season + 1) % 100).padStart(2, '0')}`;
  return `<div class="sv-club" style="--c1:${club.colors.primary};--c2:${club.colors.secondary}">${crest(club, 86)}
      <div><small>Aktueller Verein · ${esc(save.slot === 'auto' ? 'Autosave' : 'Slot ' + save.slot.replace('slot', ''))}</small><h2>${esc(club.name)}</h2>
      <p>${esc(L.name)} · Saison ${season} · Spieltag ${Math.min(w.week + 1, L.fixtures.length)}</p></div>
      <div class="sv-rank"><b>${rank}.</b><small>Platz</small></div></div>
    <div class="sv-grid">
      <div class="sv-card"><h4>Letztes Ergebnis</h4>${last ? vs(last) : '<p class="muted">Noch kein Spiel absolviert.</p>'}</div>
      <div class="sv-card"><h4>Nächstes Spiel</h4>${next ? vs(next) : '<p class="muted">Saison beendet.</p>'}</div>
      <div class="sv-card"><h4>Tabelle</h4><ol class="sv-table">${table.slice(Math.max(0, Math.min(rank - 3, table.length - 5)), Math.max(5, Math.min(rank + 2, table.length))).map((r) => `<li class="${r.id === club.id ? 'me' : ''}"><span>${table.indexOf(r) + 1}</span>${esc(w.clubs[r.id].name)}<b>${r.pts}</b></li>`).join('')}</ol></div>
      <div class="sv-card"><h4>Kontostand</h4><p class="sv-big">${money(club.budget)}</p><p class="muted">Vorstandsziel: ${esc(w.manager?.goal || '–')}</p></div>
      <div class="sv-card wide"><h4>Aktuelle Nachrichten</h4>${news.length ? `<ul class="sv-news">${news.map((n) => `<li>${esc(n.text)}</li>`).join('')}</ul>` : '<p class="muted">Keine Nachrichten.</p>'}</div>
      <div class="sv-card wide"><h4>Letzte Transferaktivitäten</h4>${tr.length ? `<ul class="sv-news">${tr.map((t) => `<li><b>${esc(t.name)}</b> → ${esc(w.clubs[t.to]?.short || '?')}${t.from != null ? ` (von ${esc(w.clubs[t.from]?.short || '?')})` : ''} · ${t.fee ? money(t.fee) : 'ablösefrei'}</li>`).join('')}</ul>` : '<p class="muted">Noch keine Transfers.</p>'}</div>
    </div>`;
}

function welcomeHtml() {
  return `<div class="sv-welcome"><div class="kicker"><i></i> Live-3D-Matchengine · v${GAME_VERSION}</div>
    <h1><span>Fussball</span><span>Manager</span><b>2027</b></h1><p class="by">© BAKUSA</p>
    <p class="sub">Übernimm einen von 224 echten Vereinen aus zwölf Ligen, verhandle Transfers, entwickle Talente – und verfolge jedes Spiel live in einer 3D-Partie, die von der KI gespielt wird.</p>
    <div class="sv-feat"><div><b>12</b><small>Ligen</small></div><div><b>224</b><small>Vereine</small></div><div><b>3D</b><small>Live-Spiele</small></div><div><b>∞</b><small>Saisons</small></div></div>
    <button class="btn primary lg" data-go="new">▶ Karriere starten</button></div>`;
}

export function startScreen(app, el) {
  el.innerHTML = `
    <div class="menu-bg" id="mbg"></div><div class="menu-shade"></div>
    <div class="start3">
      <aside class="sm-nav">
        <div class="sm-brand"><b>FUSSBALL MANAGER</b><span>2027</span><small>© BAKUSA</small></div>
        <nav>
          <button data-go="new"><i>▶</i>Karriere starten</button>
          <button data-go="continue" id="m-cont"><i>▶</i>Karriere fortsetzen</button>
          <button data-go="load"><i>💾</i>Spielstand laden</button>
          <button data-go="clubs"><i>🛡️</i>Vereinsauswahl</button>
          <button data-go="comps"><i>🏆</i>Wettbewerbe</button>
          <button data-go="stats"><i>📊</i>Statistiken</button>
          <button data-go="scenarios"><i>🎬</i>Szenarien</button>
          <button data-go="wm"><i>🏆</i>WM 2026</button>
          <button data-go="quick"><i>⚽</i>Schnelles 3D-Spiel</button>
          <button data-go="settings"><i>⚙️</i>Einstellungen</button>
          <button data-go="credits"><i>✦</i>Credits</button>
          <button data-go="quit" class="quit"><i>⏻</i>Beenden</button>
        </nav>
        <p class="sm-ver">Version ${GAME_VERSION} · ${isDesktop() ? 'Windows' : /FM27-Android/.test(navigator.userAgent) ? 'Android-App' : 'Browser'}</p>
      </aside>
      <main class="sm-center" id="m-center">${welcomeHtml()}</main>
      <aside class="sm-notes"><div class="pn-top"><small>BAKUSA</small><h3>Patchnotes</h3></div><div class="pn-list">${patchHtml()}</div></aside>
    </div>`;
  // phones: no live 3D scene behind the menu (it costs battery and makes the menu sluggish)
  const stopScene = IS_MOBILE ? (() => {}) : startMenuScene(el.querySelector('#mbg'), app.settings.quality);
  const center = el.querySelector('#m-center');
  let latest = null, latestWorld = null;
  el.querySelectorAll('.pn-head').forEach((h) => (h.onclick = () => h.parentElement.classList.toggle('open')));
  const showSaves = async () => {
    const saves = await listSaves();
    center.innerHTML = `<div class="sv-panel"><h2>Spielstand laden</h2>${saves.length ? `<div class="save-list">${saves.map((x) => saveRow(x)).join('')}</div>` : '<p class="muted">Noch keine Spielstände vorhanden.</p>'}</div>`;
    bindSaveRows(app, center, showSaves);
  };
  const needWorld = (fn) => { if (latestWorld) return fn(latestWorld); fn(app.pendingWorld || (app.pendingWorld = generateWorld())); };
  const actions = {
    new: () => app.go('new'),
    clubs: () => app.go('new'),
    continue: async () => {
      if (!latest) return toast('Noch kein Spielstand vorhanden – starte eine neue Karriere.');
      const w = latestWorld || (await loadGame(latest.slot));
      if (!w) return toast('Spielstand nicht gefunden');
      app.world = w; app.slot = latest.slot === 'auto' ? 'slot1' : latest.slot; app.go('home');
    },
    load: showSaves,
    comps: () => needWorld((w) => { center.innerHTML = competitionsHtml(w); }),
    stats: () => needWorld((w) => { center.innerHTML = statsHtml(w, !!latestWorld); }),
    scenarios: () => {
      const rec = scenarioRecords();
      center.innerHTML = `<div class="sv-panel"><h2>🎬 Szenario-Modus</h2><p class="muted">Steig mitten in eine Saison ein – mit einer klaren Mission. Die Welt wird bis zum Startpunkt vorsimuliert, der Verein wird zufällig passend gewählt.</p>
        <div class="sc-list">${SCENARIOS.map((s) => `<button class="sc-item" data-sc="${s.id}"><span>${s.icon}</span><div><b>${esc(s.name)}</b><em>${esc(s.diff)}</em>${rec[s.id]?.won ? '<em class="good">✓ geschafft</em>' : rec[s.id] ? `<em>${rec[s.id].tries} Versuch(e)</em>` : ''}<small>${esc(s.desc)}</small><small><b>Ziel:</b> ${esc(s.goal)}</small></div></button>`).join('')}</div></div>`;
      center.querySelectorAll('[data-sc]').forEach((b) => (b.onclick = async () => {
        center.querySelectorAll('[data-sc]').forEach((x) => (x.disabled = true));
        b.querySelector('small').textContent = '⏳ Welt wird simuliert …';
        await new Promise((r) => setTimeout(r, 60));
        const w = buildScenario(b.dataset.sc);
        app.world = w; app.pendingWorld = null; app.slot = 'szenario';
        await app.save('szenario', true);
        app.go('home');
      }));
    },
    wm: () => { center.innerHTML = wmStartHtml(); bindWmStart(app, center); },
    quick: () => {
      const w = generateWorld();
      const ids = [...w.leagues[0].clubIds].sort((a, b) => w.clubs[b].rep - w.clubs[a].rep);
      w.userClubId = ids[0]; app.world = w; app.slot = null;
      app.go('match', { friendly: true, home: ids[0], away: ids[1] });
    },
    settings: () => settingsModal(app),
    credits: () => modal(`<h3>Credits</h3><p><b>FUSSBALL MANAGER 2027 © BAKUSA</b></p>
      <p>Spielidee & Leitung: BAKUSA</p><p>Entwicklung: BAKUSA mit Claude (Anthropic)</p>
      <p class="muted">3D-Grafik: three.js · Desktop: Electron · Schriften: Barlow Condensed, Inter<br>Ligen, Kader und Wappen: Stand Saison 2026/27. Ratings und Alter sind Schätzungen des Spiels.</p>`),
    quit: () => { if (window.bakusa?.close) window.bakusa.close(); else if (window.bakusa?.quit) window.bakusa.quit(); else { try { window.close(); } catch {} toast('Im Browser bitte einfach den Tab schließen.'); } },
  };
  el.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => actions[b.dataset.go]?.()));
  center.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g && center.contains(g)) actions[g.dataset.go]?.(); });
  // load the most recent save for "Karriere fortsetzen" and the career overview
  (async () => {
    try {
      const saves = (await listSaves()).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      latest = saves[0] || null;
      const btn = el.querySelector('#m-cont');
      if (!latest) { btn.classList.add('dim'); return; }
      latestWorld = await loadGame(latest.slot);
      if (latestWorld && el.isConnected && center.querySelector('.sv-welcome')) center.innerHTML = `<div class="sv-panel">${careerHtml(latestWorld, latest)}<div class="row-actions"><button class="btn primary lg" data-go="continue">▶ Karriere fortsetzen</button><button class="btn lg" data-go="new">Neue Karriere</button></div></div>`;
    } catch (e) { console.warn('start overview', e); }
  })();
  return stopScene;
}

function competitionsHtml(w) {
  const desc = {
    de1: '18 Vereine · Plätze 17–18 steigen direkt ab · Platz 16 spielt Relegation gegen den Dritten der 2. Bundesliga (Hin- und Rückspiel, Verlängerung und Elfmeterschießen, keine Auswärtstorregel)',
    de2: '18 Vereine · Plätze 1–2 steigen direkt auf · Platz 3 spielt Relegation gegen den 16. der Bundesliga · Plätze 17–18 steigen ab · Platz 16 spielt Relegation gegen den Dritten der 3. Liga',
    de3: '20 Vereine · Plätze 1–2 steigen direkt auf · Platz 3 spielt Relegation gegen den 16. der 2. Bundesliga · Abstieg in die Regionalliga wird noch nicht simuliert',
    en1: '20 Vereine · Plätze 18–20 steigen in die Championship ab',
    en2: '24 Vereine · Plätze 1–2 steigen direkt auf · Plätze 3–6 spielen Play-offs (Halbfinale Hin- und Rückspiel, Finale in Wembley) um den dritten Aufstiegsplatz',
    es1: '20 Vereine · Segunda División ist noch nicht im Spiel, daher kein Auf- und Abstieg',
    it1: '20 Vereine · Serie B ist noch nicht im Spiel, daher kein Auf- und Abstieg',
    fr1: '18 Vereine · Ligue 2 ist noch nicht im Spiel, daher kein Auf- und Abstieg',
  };
  return `<div class="sv-panel"><h2>Wettbewerbe</h2><div class="comp-grid">${w.leagues.map((l) => {
    const t = computeTable(l); const top = l.clubIds.map((id) => w.clubs[id]).sort((a, b) => b.rep - a.rep).slice(0, 5);
    return `<div class="sv-card"><h4>${esc(l.name)}</h4><p class="muted">${esc(desc[l.id] || '')}</p>
      <div class="comp-crests">${top.map((c) => crest(c, 30)).join('')}</div>${t[0]?.p ? `<p>Tabellenführer: <b>${esc(w.clubs[t[0].id].name)}</b> (${t[0].pts} Pkt.)</p>` : ''}</div>`;
  }).join('')}</div></div>`;
}

function statsHtml(w, fromSave) {
  const ps = Object.values(w.players).filter((p) => p.clubId != null);
  const list = (title, arr, val) => `<div class="sv-card"><h4>${title}</h4><ol class="sv-table">${arr.map((p) => `<li><span></span>${esc(`${p.firstName} ${p.lastName}`.trim())} <small>${esc(w.clubs[p.clubId]?.short || '')}</small><b>${val(p)}</b></li>`).join('')}</ol></div>`;
  const by = (f) => [...ps].sort((a, b) => f(b) - f(a)).slice(0, 8);
  const played = ps.some((p) => p.stats?.apps);
  return `<div class="sv-panel"><h2>Statistiken</h2><p class="muted">${fromSave ? 'Aus deinem letzten Spielstand.' : 'Vorschau einer neuen Welt – Saisonwerte entstehen erst durch gespielte Partien.'}</p>
    <div class="comp-grid">
      ${played ? list('Torjäger', by((p) => p.stats.goals), (p) => p.stats.goals) : ''}
      ${played ? list('Vorlagengeber', by((p) => p.stats.assists), (p) => p.stats.assists) : ''}
      ${list('Stärkste Spieler', by((p) => p.ovr), (p) => p.ovr)}
      ${list('Größte Talente (U21)', by((p) => (p.age <= 21 ? p.pot : 0)), (p) => p.pot)}
      ${list('Höchste Marktwerte', by((p) => p.value), (p) => money(p.value))}
    </div></div>`;
}

function saveRow(s) {
  const d = new Date(s.savedAt);
  return `<div class="save-row" data-slot="${esc(s.slot)}">
    <div><strong>${esc(s.label)}</strong><small>${s.slot === 'auto' ? 'Autosave' : s.slot === 'szenario' ? 'Szenario' : 'Slot ' + esc(s.slot.replace('slot', ''))} · Saison ${s.season} · Woche ${s.week + 1} · ${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</small></div>
    <div class="row-actions"><button class="btn sm primary" data-act="load">Laden</button><button class="btn sm danger" data-act="del">Löschen</button></div></div>`;
}

function bindSaveRows(app, host, refresh) {
  host.querySelectorAll('.save-row').forEach((row) => {
    const slot = row.dataset.slot;
    row.querySelector('[data-act=load]').onclick = async () => {
      const w = await loadGame(slot);
      if (!w) return toast('Spielstand nicht gefunden');
      app.world = w; app.slot = slot === 'auto' ? 'slot1' : slot;
      toast('Spielstand geladen');
      app.go('home');
    };
    row.querySelector('[data-act=del]').onclick = async () => {
      if (!(await confirmDialog('Diesen Spielstand wirklich löschen?', 'Löschen'))) return;
      await deleteGame(slot); toast('Gelöscht'); refresh();
    };
  });
}

import { DIFFICULTIES, applyDifficulty } from '../../manager/difficulty.js';
export function newGameScreen(app, el) {
  if (!app.pendingWorld) app.pendingWorld = generateWorld();
  const w = app.pendingWorld;
  let leagueId = app.params.league || 'de1';
  const draw = () => {
    const L = w.leagues.find((l) => l.id === leagueId);
    const clubs = L.clubIds.map((id) => w.clubs[id]).sort((a, b) => b.rep - a.rep);
    el.innerHTML = `
      <div class="page narrow">
        <div class="page-head"><button class="btn ghost sm" id="back">← Zurück</button><h2>Verein wählen</h2><button class="btn sm primary" id="found">✨ Eigenen Verein gründen</button><button class="btn ghost sm" id="reroll" title="Neue Welt mit anderen Spielern generieren">🎲 Neue Welt</button></div>
        <div class="tabs">${w.leagues.map((l) => `<button data-l="${l.id}" class="${l.id === leagueId ? 'active' : ''}">${esc(l.name)}</button>`).join('')}</div>
        <div class="club-grid">${clubs.map((c) => {
          const str = Math.round(teamStrength(c, w.players));
          const stars = Math.max(1, Math.round((c.rep - 35) / 12));
          return `<button class="club-card" data-c="${c.id}" style="--c1:${c.colors.primary};--c2:${c.colors.secondary}">
            ${crest(c, 44)}<div class="cc-body"><strong>${esc(c.name)}</strong>
            <small>${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 5 - stars))}</small>
            <div class="cc-stats"><span>Stärke <b>${str}</b></span><span>Budget <b>${money(c.budget)}</b></span><span>${esc(c.stadium.name)} · ${c.stadium.capacity.toLocaleString('de-DE')}</span></div></div></button>`;
        }).join('')}</div>
      </div>`;
    el.querySelector('#back').onclick = () => app.go('start');
    el.querySelector('#reroll').onclick = () => { app.pendingWorld = generateWorld(); app.go('new', { league: leagueId }); };
    el.querySelector('#found').onclick = () => app.go('founder');
    el.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => { leagueId = b.dataset.l; draw(); }));
    el.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => confirmClub(app, w, +b.dataset.c)));
  };
  draw();
}

export function confirmClub(app, w, id) {
  const c = w.clubs[id];
  const L = w.leagues.find((l) => l.id === c.leagueId);
  const goal = c.rep > 85 ? 'Meisterschaft' : c.rep > 74 ? 'Internationale Plätze' : c.rep > 62 ? 'Gesichertes Mittelfeld' : L.tier > 1 && c.rep > 55 ? 'Aufstiegsplätze' : 'Klassenerhalt';
  const m = modal(`
    <div class="confirm-club">${crest(c, 64)}<h3>${esc(c.name)}</h3>
    <p>${esc(L.name)} · Vorstandsziel: <b>${goal}</b></p>
    <div class="mode-pick"><b>Spielmodus</b>
      <label><input type="radio" name="mode" value="manager" checked><span><b>Trainer & Manager</b><small>Du machst alles: Aufstellung, Taktik, Wechsel, Transfers, Finanzen.</small></span></label>
      <label><input type="radio" name="mode" value="director"><span><b>Sportdirektor</b><small>Du planst Kader, Transfers, Finanzen und Stadion. Ein KI-Cheftrainer stellt auf, wählt die Taktik und wechselt ein – du kannst ihn entlassen.</small></span></label></div>
    <div class="mode-pick diff-pick"><b>Schwierigkeitsgrad</b>${Object.entries(DIFFICULTIES).map(([k, d]) => `<label><input type="radio" name="diff" value="${k}" ${k === 'normal' ? 'checked' : ''}><span><b>${d.icon} ${d.label}</b><small>${esc(d.desc)}</small></span></label>`).join('')}</div>
        <label class="field">Herausforderung (optional)<select id="chal" class="input">${CHALLENGES.map((c) => `<option value="${c.id}" title="${esc(c.desc)}">${esc(c.name)}${c.id !== 'none' ? ` – ${esc(c.desc)}` : ''}</option>`).join('')}</select></label>
    <details class="hot-setup"><summary>👥 Mehrspieler auf einem Gerät (Hotseat)</summary>
      <p class="muted small">2–4 Manager, abwechselnd am selben Gerät. Jeder hat eigenen Verein, Karriere, Stab und Posteingang. Direkte Duelle sind möglich.</p>
      <label class="field">Dein Name<input id="hp0" class="input" maxlength="18" value="Spieler 1"></label>
      <div id="hot-rows"></div><button class="btn sm" id="hot-add">+ Mitspieler</button></details>
    <div class="row-actions end"><button class="btn primary" id="go">Weiter: Manager erstellen ▶</button></div></div>`);
  const clubOpts = (sel) => w.leagues.map((L) => `<optgroup label="${esc(L.name)}">${L.clubIds.map((cid) => w.clubs[cid]).sort((a, b) => b.rep - a.rep).map((c2) => `<option value="${c2.id}" ${c2.id === sel ? 'selected' : ''}>${esc(c2.name)}</option>`).join('')}</optgroup>`).join('');
  const rows = m.el.querySelector('#hot-rows');
  m.el.querySelector('#hot-add').onclick = () => {
    const n = rows.children.length; if (n >= 3) return toast('Maximal 4 Manager');
    const pick = w.leagues.find((l) => l.id === c.leagueId).clubIds.map((x) => w.clubs[x]).filter((x) => x.id !== id).sort((a, b) => Math.abs(a.rep - c.rep) - Math.abs(b.rep - c.rep))[n]?.id;
    const r = document.createElement('div'); r.className = 'hot-row';
    r.innerHTML = `<input class="input" maxlength="18" value="Spieler ${n + 2}"><select class="input">${clubOpts(pick)}</select><button class="btn sm ghost" title="Entfernen">✕</button>`;
    r.querySelector('button').onclick = () => r.remove();
    rows.appendChild(r);
  };
  m.el.querySelector('#go').onclick = async () => {
    w.userClubId = id;
    w.manager = { name: 'Manager', goal }; // the manager himself is created in the next step (v3.0.4)
    w.mode = m.el.querySelector('input[name=mode]:checked')?.value || 'manager';
    if (w.mode === 'director') { const rng = newRng(w); ensureCoach(w, rng); coachDecides(w); }
    w.news = [{ season: w.season, week: 0, text: `Willkommen bei ${c.name}! Der Vorstand erwartet: ${goal}.` }];
    const extra = [...rows.children].map((r) => ({ name: r.querySelector('input').value.trim() || 'Spieler', clubId: +r.querySelector('select').value }));
    if (extra.length) {
      const ids = new Set([id]);
      for (const e of extra) { if (ids.has(e.clubId)) { toast('Jeder Manager braucht einen eigenen Verein'); return; } ids.add(e.clubId); }
      setupHotseat(w, [{ name: m.el.querySelector('#hp0').value.trim() || 'Spieler 1', clubId: id }, ...extra]);
      for (let i = 1; i < w.hot.humans.length; i++) { const hc = w.clubs[w.hot.humans[i].clubId], hl = w.leagues.find((l) => l.id === hc.leagueId);
        w.hot.humans[i].st.manager = { name: w.hot.humans[i].name, goal: hc.rep > 85 ? 'Meisterschaft' : hc.rep > 74 ? 'Internationale Plätze' : hc.rep > 62 ? 'Gesichertes Mittelfeld' : hl.tier > 1 && hc.rep > 55 ? 'Aufstiegsplätze' : 'Klassenerhalt' };
        w.hot.humans[i].st.mode = 'manager'; }
    }
    applyDifficulty(w, m.el.querySelector('input[name=diff]:checked')?.value || 'normal');
    startChallenge(w, m.el.querySelector('#chal').value);
    checkAchievements(w);
    app.world = w; app.pendingWorld = null; app.slot = 'slot1';
    m.close();
    await app.save('slot1', true);
    app.go('home');
  };
}

export function savesScreen(app, el) {
  const draw = async () => {
    const saves = await listSaves();
    el.innerHTML = `<div class="page"><h2>Spielstände</h2>
      <div class="card"><h3>Speichern</h3><div class="row-actions">${['slot1', 'slot2', 'slot3'].map((s, i) => `<button class="btn" data-save="${s}">In Slot ${i + 1} speichern</button>`).join('')}</div>
      <p class="muted">Nach jedem Spieltag wird automatisch gespeichert (Autosave, abschaltbar in den Einstellungen).</p></div>
      <div class="card"><h3>Vorhandene Spielstände</h3>${saves.length ? `<div class="save-list">${saves.map(saveRow).join('')}</div>` : '<p class="muted">Keine Spielstände.</p>'}</div>
      <div class="card"><button class="btn ghost" id="to-menu">Zum Hauptmenü</button></div></div>`;
    el.querySelectorAll('[data-save]').forEach((b) => (b.onclick = async () => { await app.save(b.dataset.save); draw(); }));
    bindSaveRows(app, el, draw);
    el.querySelector('#to-menu').onclick = async () => { if (await confirmDialog('Zum Hauptmenü? Nicht gespeicherter Fortschritt geht verloren.', 'Zum Hauptmenü')) { app.world = null; app.go('start'); } };
  };
  draw();
}

// v2.7: settings grouped in tabs – display, 3D match, sound, game flow, data
const SET_TABS = [['anzeige', '🖥️ Anzeige'], ['spiel3d', '🏟️ 3D-Spiel'], ['ton', '🔊 Ton'], ['ablauf', '⚙️ Spielablauf'], ['daten', '💾 Daten']];
const LKEY = 'ufm3d-launcher';
const launcherCfg = () => { try { return JSON.parse(localStorage.getItem(LKEY) || '{}'); } catch { return {}; } };
function settingsForm(app, tab = app.setTab || 'anzeige') {
  const s = app.settings, L = launcherCfg(), desk = !!window.bakusa?.toggleFullscreen;
  const opt = (v, cur, label) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
  const sel = (id, label, sub, cur, opts) => `<div class="set-row"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><select id="${id}" class="input">${opts.map(([v, l]) => opt(v, cur, l)).join('')}</select></div>`;
  const tog = (id, label, sub, on) => `<label class="set-row tog-row"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i class="sw"></i></label>`;
  const rng = (id, label, sub, val, min, max, step, fmt) => `<div class="set-row"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output>${fmt(val)}</output></div>`;
  const pct = (v) => `${Math.round(v * 100)} %`;
  const body = {
    anzeige: () => `
      ${desk ? `<div class="set-row"><span><b>Vollbild</b><small>Auch jederzeit mit F11</small></span><button class="btn sm" id="s-fsnow">⛶ Vollbild umschalten</button></div>${tog('s-fsstart', 'Im Vollbild starten', 'Das Spiel öffnet sich direkt im Vollbild', !!L.fullscreen)}` : ''}
      ${sel('s-ui', 'Größe der Oberfläche', 'Schrift, Knöpfe und Karten', s.uiScale ?? 1, [[0.85, '85 %'], [0.9, '90 %'], [1, '100 %'], [1.1, '110 %'], [1.25, '125 %']])}
      ${sel('s-theme', 'Farbschema', 'Akzentfarben der Oberfläche', s.theme === 'violett' ? 'violett' : 'verein', [['verein', 'Vereinsfarben'], ['violett', 'Klassisch Violett']])}
      ${sel('s-mode', 'Darstellung', '', s.mode === 'hell' ? 'hell' : 'dunkel', [['dunkel', 'Dunkel'], ['hell', 'Hell']])}
      ${tog('s-anim', 'Animierte Übergänge', 'Seitenwechsel, hochzählende Zahlen, Pokal-Zeremonie', s.animations !== false)}
      ${tog('s-story', 'Saison-Story am Saisonende', '', s.story !== false)}
      ${tog('s-acht', 'Meldungen für Erfolge & Level-Ups', '', s.achToasts !== false)}`,
    spiel3d: () => `
      ${IS_MOBILE ? '' : sel('s-eng', '3D-Engine', 'Unity/Unreal: neue Grafik & Spieler-KI (Beta). Unreal nur in der Windows-App, einmalig auf dem PC bauen', ['unity', 'unreal'].includes(s.engine3d) ? s.engine3d : 'klassisch', [['klassisch', 'Klassisch (Three.js)'], ['unity', 'Unity (Beta)'], ...(window.bakusa?.unrealPlay ? [['unreal', 'Unreal Engine 5 (Windows, Beta)']] : [])])}
      ${sel('s-q', 'Grafikqualität', 'Auf schwächeren PCs „Niedrig“ oder „Mittel“', s.quality, [['niedrig', 'Niedrig'], ['mittel', 'Mittel'], ['hoch', 'Hoch'], ['ultra', 'Ultra']])}
      ${sel('s-sp', 'Standard-Spielgeschwindigkeit', '', s.speed, [[1, '1x'], [2, '2x'], [4, '4x'], [8, '8x'], ['highlights', 'Nur Highlights']])}
      ${sel('s-cam', 'Standard-Kamera', '', s.camera, CAMERA_MODES)}
      ${tog('s-rep', 'Wiederholungen nach Toren', 'Multi-Kamera-Replay nach jedem Treffer', s.replays !== false)}
      ${tog('s-hl', 'Highlights nach dem Abpfiff', 'Unity/Unreal: Tore und Großchancen als Zusammenschnitt', s.highlights !== false)}
      ${tog('s-wfx', 'Wetter-Effekte', 'Regen, Schnee und Nebel im Stadion', s.weatherFx !== false)}
      ${tog('s-pyro', 'Pyrotechnik & Rauch', 'Bengalos und Rauch in den Fankurven', s.pyro !== 'aus')}
      ${tog('s-var', 'VAR-Überprüfungen', '', s.var !== false)}
      ${tog('s-commbar', 'Kommentarzeile', 'TV-Kommentar unten im Bild', s.commBar !== false)}
      ${tog('s-l3', 'Bauchbinden', 'Torschützen-Einblendungen mit Spielerbild', s.lowerThirds !== false)}
      ${tog('s-conf', 'Konferenz-Meldungen', 'Tore aus anderen Stadien während deines Spiels', s.confToasts !== false)}
      ${tog('s-fps', 'FPS-Anzeige', 'Bilder pro Sekunde oben rechts', s.fps !== false)}`,
    ton: () => `
      ${rng('s-vol', 'Gesamtlautstärke', 'Alles im Stadion', s.volume ?? 0.6, 0, 1, 0.05, pct)}
      ${rng('s-crowd', 'Fan-Atmosphäre', 'Grundrauschen und Spannung der Zuschauer', s.crowd ?? 1, 0, 1.5, 0.05, pct)}
      ${tog('s-chants', 'Fangesänge', 'Gesänge und Klatsch-Rhythmen in ruhigen Phasen', s.chants !== false)}
      ${tog('s-ann', 'Stadionsprecher', 'Computerstimme bei Toren und Wechseln', s.announcer === true)}
      ${tog('s-com', 'TV-Kommentar vorlesen', 'Der Kommentar wird zusätzlich gesprochen', !!s.commentary)}`,
    ablauf: () => `
      ${sel('s-ev', 'Ereignisse & Entscheidungen', 'Wie oft Anfragen wie Spenden, Benefiz oder Sponsorendeals auftauchen', s.events || 'normal', [['oft', 'Oft'], ['normal', 'Normal'], ['selten', 'Selten'], ['aus', 'Aus']])}
      ${tog('s-auto', 'Automatisch speichern', 'Nach jedem Spieltag in den Autosave-Platz', !!s.autosave)}
      ${tog('s-subs', 'Automatische Auswechslungen', 'Der Co-Trainer wechselt bei Verletzungen und Müdigkeit', s.autoSubs !== false)}`,
    daten: () => `
      <div class="set-row"><span><b>Spielstand exportieren</b><small>Als Datei sichern – z. B. für einen anderen PC</small></span><button class="btn sm" id="s-exp" ${app.world ? '' : 'disabled'}>⬇ Exportieren</button></div>
      <div class="set-row"><span><b>Spielstand importieren</b><small>Eine exportierte .fm27-Datei laden</small></span><label class="btn sm">⬆ Importieren<input type="file" id="s-imp" accept=".fm27,.json" hidden></label></div>
      <div class="set-row"><span><b>Erfolge zurücksetzen</b><small>Löscht die spielstandübergreifenden Erfolge</small></span><button class="btn sm danger" id="s-rach">Zurücksetzen</button></div>
      <div class="set-row"><span><b>Einstellungen zurücksetzen</b><small>Alles wieder auf Standard</small></span><button class="btn sm" id="s-rset">Standard</button></div>
      <p class="muted">Version ${esc(GAME_VERSION)} · Spielstände liegen lokal auf diesem Gerät.</p>`,
  };
  return `<div class="set-tabs">${SET_TABS.map(([k, l]) => `<button data-stab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div><div class="settings">${body[tab]()}</div>`;
}
function bindSettings(app, root, redraw) {
  const s = app.settings, $ = (q) => root.querySelector(q);
  root.querySelectorAll('[data-stab]').forEach((b) => (b.onclick = () => { app.setTab = b.dataset.stab; redraw(); }));
  const map = {
    's-q': (v) => (s.quality = v), 's-sp': (v) => (s.speed = v === 'highlights' ? v : +v), 's-cam': (v) => (s.camera = v), 's-ui': (v) => (s.uiScale = +v),
    's-theme': (v) => (s.theme = v), 's-ev': (v) => { s.events = v; if (window.ufm?.world) window.ufm.world.eventRate = v; }, 's-mode': (v) => (s.mode = v), 's-vol': (v) => (s.volume = +v), 's-crowd': (v) => (s.crowd = +v), 's-eng': (v) => (s.engine3d = v),
  };
  const bools = { 's-anim': 'animations', 's-story': 'story', 's-acht': 'achToasts', 's-rep': 'replays', 's-hl': 'highlights', 's-wfx': 'weatherFx', 's-var': 'var', 's-commbar': 'commBar', 's-l3': 'lowerThirds', 's-conf': 'confToasts', 's-fps': 'fps', 's-chants': 'chants', 's-ann': 'announcer', 's-com': 'commentary', 's-auto': 'autosave', 's-subs': 'autoSubs' };
  const commit = () => { saveSettings(s); applyTheme(s, window.ufm?.world ? window.ufm.club : null); toast('Einstellungen gespeichert', 1200); };
  for (const [id, fn] of Object.entries(map)) { const el = $(`#${id}`); if (!el) continue; el.addEventListener(el.type === 'range' ? 'input' : 'change', () => { fn(el.value); if (el.nextElementSibling?.tagName === 'OUTPUT') el.nextElementSibling.textContent = `${Math.round(el.value * 100)} %`; }); el.addEventListener('change', commit); }
  for (const [id, key] of Object.entries(bools)) { const el = $(`#${id}`); if (el) el.addEventListener('change', () => { s[key] = el.checked; commit(); }); }
  const pyro = $('#s-pyro'); if (pyro) pyro.onchange = () => { s.pyro = pyro.checked ? 'normal' : 'aus'; commit(); };
  $('#s-fsnow')?.addEventListener('click', () => window.bakusa.toggleFullscreen());
  const fss = $('#s-fsstart'); if (fss) fss.onchange = () => { const L = launcherCfg(); L.fullscreen = fss.checked; try { localStorage.setItem(LKEY, JSON.stringify(L)); } catch {} toast('Gespeichert – gilt ab dem nächsten Start', 1500); };
  $('#s-exp')?.addEventListener('click', () => {
    const w = app.world, c = app.club;
    const blob = new Blob([JSON.stringify({ format: 'fm27-save', version: GAME_VERSION, exportedAt: Date.now(), world: w })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `FM27-${c.short}-${w.season}-Spieltag${w.week + 1}.fm27`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Spielstand exportiert');
  });
  $('#s-imp')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text()), world = data.world || data;
      if (!world?.clubs || !world?.userClubId) throw new Error('keine FM27-Datei');
      await saveGame('import', world, `Import · ${world.clubs[world.userClubId].name}`);
      const w = await loadGame('import'); app.world = w; app.slot = 'import';
      toast('Spielstand importiert'); app.go('home');
    } catch (err) { toast(`Import fehlgeschlagen: ${err.message}`, 3500); }
  });
  $('#s-rach')?.addEventListener('click', async () => { if (await confirmDialog('Alle spielstandübergreifenden Erfolge löschen?', 'Löschen')) { localStorage.removeItem('ufm3d-achievements'); toast('Erfolge zurückgesetzt'); } });
  $('#s-rset')?.addEventListener('click', async () => { if (await confirmDialog('Alle Einstellungen auf Standard zurücksetzen?', 'Zurücksetzen')) { localStorage.removeItem('ufm3d-settings'); Object.keys(s).forEach((k) => delete s[k]); Object.assign(s, loadSettings()); commit(); redraw(); } });
}
export function settingsScreen(app, el) {
  const draw = () => {
    const w = app.world, cur = w?.difficulty || 'normal';
    const diffCard = w && w.mode !== 'wm' ? `<div class="card"><h3>🎚️ Schwierigkeitsgrad</h3><p class="muted small">Gilt ab sofort für Transfers, Vorstand und KI-Stärke. Das Startbudget bleibt unverändert.</p><div class="opt-row">${Object.entries(DIFFICULTIES).map(([k, d]) => `<button class="chip-btn ${cur === k ? 'on' : ''}" data-diff="${k}" title="${esc(d.desc)}">${d.icon} ${d.label}</button>`).join('')}</div></div>` : '';
    el.innerHTML = `<div class="page narrow"><h2>⚙️ Einstellungen</h2>${diffCard}<div class="card">${settingsForm(app)}</div></div>`;
    el.querySelectorAll('[data-diff]').forEach((b) => (b.onclick = () => { w.difficulty = b.dataset.diff; toast(`Schwierigkeitsgrad: ${DIFFICULTIES[w.difficulty].label}`); draw(); }));
    bindSettings(app, el, draw);
  };
  draw();
}
function settingsModal(app) {
  const m = modal('<div class="set-host"></div>');
  const host = m.el.querySelector('.set-host');
  const draw = () => { host.innerHTML = `<h3>⚙️ Einstellungen</h3>${settingsForm(app)}`; bindSettings(app, host, draw); };
  draw();
}

export function seasonEndScreen(app, el) {
  const w = app.world;
  if (!isUserSeasonOver(w)) { el.innerHTML = '<div class="page"><p>Die Saison läuft noch.</p></div>'; return; }
  if (isHot(w) && !allSeasonsOver(w, isUserSeasonOver)) { // v5.0: wait for the other hotseat managers
    el.innerHTML = `<div class="page narrow"><div class="card md-gate"><h3>🏁 Deine Saison ist beendet</h3><p class="muted">Die anderen Manager spielen ihre Saison noch zu Ende. Danach wird die Saison für alle gemeinsam abgeschlossen.</p><div class="row-actions center"><button class="btn primary lg" id="hot-pass">➡️ Zug beenden</button></div></div></div>`;
    el.querySelector('#hot-pass').onclick = () => endWeek(app, null);
    return;
  }
  const L = userLeague(w);
  const table = computeTable(L);
  const rank = table.findIndex((r) => r.id === w.userClubId) + 1;
  el.innerHTML = `<div class="page narrow"><h2>Saisonende ${w.season}/${String((w.season + 1) % 100).padStart(2, '0')}</h2>
    <div class="card big-result"><div>${crest(app.club, 56)}</div><div><h3>Platz ${rank} in der ${esc(L.name)}</h3>
    <p>Meister: <b>${esc(w.clubs[table[0].id].name)}</b> mit ${table[0].pts} Punkten.</p><p class="muted">Vorstandsziel: ${esc(w.manager?.goal || '–')}</p></div></div>
    <div class="card"><p>Beim Abschluss werden alle restlichen Partien simuliert, Auf- und Abstieg ausgeführt, Spieler altern und entwickeln sich, ältere Spieler beenden ihre Karriere und Jugendspieler rücken nach.</p>
    <button class="btn primary" id="end">Saison abschließen & neue Saison starten</button></div><div id="sum"></div></div>`;
  el.querySelector('#end').onclick = async () => {
    const rng = newRng(w);
    const story = buildStory(w);
    const scRes = evaluateScenario(w);
    if (scRes) { if (scRes.won) gainXp(w, 600, `Szenario geschafft: ${w.scenario.name}`);
      await new Promise((res) => { const m = modal(`<div class="confirm-club"><div style="font-size:3.4rem">${scRes.won ? '🎉' : '💔'}</div><h3>${scRes.won ? 'Mission erfüllt!' : 'Mission gescheitert'}</h3><p>Szenario „${esc(w.scenario.name)}“ – Ziel: ${esc(w.scenario.goal)}</p><p>Endplatzierung: <b>Platz ${scRes.rank}</b>${w.scenario.id === 'pleite' ? ` · Kontostand ${money(app.club.budget)}` : ''}</p><p class="muted">${scRes.won ? '+600 XP. ' : ''}Du kannst die Karriere mit diesem Verein normal fortsetzen.</p><div class="row-actions end"><button class="btn primary" id="ok">Weiter</button></div></div>`, { onClose: res }); m.el.querySelector('#ok').onclick = () => { m.close(); }; }); }
    const s = endSeason(w, rng);
    const titles = [...(story.champion ? [{ title: 'MEISTER!', sub: `${app.club.name} gewinnt die ${story.league}` }] : []), ...story.cups.map((n) => ({ title: 'POKALSIEG!', sub: `${app.club.name} holt den ${n}` }))];
    if (app.settings.story !== false) await showStory(story, w, s);
    if (app.settings.animations !== false) for (const t of titles) await new Promise((res) => { ceremony(app, { ...t, club: app.club, onClose: res }); });
    const promo = s.promoted.map((id) => w.clubs[id].name), rel = s.relegated.map((id) => w.clubs[id].name);
    const champs = Object.entries(s.champions).map(([lid, cid]) => `<li>${esc(w.leagues.find((l) => l.id === lid).name)}: <b>${esc(w.clubs[cid].name)}</b></li>`).join('');
    w.news.unshift({ season: w.season, week: 0, text: `Neue Saison ${w.season}/${String((w.season + 1) % 100).padStart(2, '0')} beginnt. Letzte Saison: Platz ${s.user.rank}.` });
    el.querySelector('#sum').innerHTML = `<div class="card"><h3>Meister</h3><ul>${champs}</ul><h3>Aufsteiger</h3><p>${esc(promo.join(', ') || '–')}</p><h3>Absteiger</h3><p>${esc(rel.join(', ') || '–')}</p>
      ${s.tournament ? `<h3>🌍 ${esc(s.tournament.name)}</h3><p>${flag(s.tournament.winner)} <b>${esc(nationName(s.tournament.winner))}</b> gewinnt das Turnier gegen ${esc(nationName(s.tournament.runnerUp))}.${s.tournament.topScorer ? ` Torschützenkönig: ${esc(s.tournament.topScorer.name)} (${s.tournament.topScorer.goals} Tore).` : ''}</p>` : ''}
      ${s.playoffs?.length ? `<h3>Relegation & Play-offs</h3><ul class="po-list">${s.playoffs.map((po) => `<li><span>${esc(po.name)}</span><b>${esc(w.clubs[po.first].short)} – ${esc(w.clubs[po.second].short)}</b> <em>${esc(po.text)}</em> → <strong>${esc(w.clubs[po.winner].name)}</strong></li>`).join('')}</ul>` : ''}
      ${s.humans ? `<h3>👥 Hotseat</h3><ul>${s.humans.map((x, i) => `<li>${esc(humanName(w, i))} (${esc(w.clubs[w.hot.humans[i].clubId].short)}): Platz <b>${x.user.rank}</b> in der ${esc(x.user.league)}${x.cupWins.length ? ` · 🏆 ${esc(x.cupWins.join(', '))}` : ''}</li>`).join('')}</ul>` : ''}
      <button class="btn primary" id="cont">Weiter zur neuen Saison</button></div>`;
    el.querySelector('#end').disabled = true;
    await app.autosave();
    el.querySelector('#cont').onclick = () => app.go(isHot(w) ? 'hotTurn' : 'home', { reason: 'season' });
  };
}
