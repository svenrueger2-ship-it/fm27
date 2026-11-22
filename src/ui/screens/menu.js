// Start menu, new game / club selection, save slots, settings, season end.
import { buildStory, showStory } from '../story.js';
import { ceremony } from '../fx.js';
import { generateWorld } from '../../data/generator.js';
import { teamStrength } from '../../match/tactics.js';
import { listSaves, loadGame, deleteGame, saveSettings, loadSettings } from '../../storage/db.js';
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
    <p class="sub">Übernimm einen von 158 echten Vereinen aus acht Ligen, verhandle Transfers, entwickle Talente – und verfolge jedes Spiel live in einer 3D-Partie, die von der KI gespielt wird.</p>
    <div class="sv-feat"><div><b>8</b><small>Ligen</small></div><div><b>158</b><small>Vereine</small></div><div><b>3D</b><small>Live-Spiele</small></div><div><b>∞</b><small>Saisons</small></div></div>
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
          <button data-go="continue" id="m-cont"><i>⏵</i>Karriere fortsetzen</button>
          <button data-go="load"><i>💾</i>Spielstand laden</button>
          <button data-go="clubs"><i>🛡️</i>Vereinsauswahl</button>
          <button data-go="comps"><i>🏆</i>Wettbewerbe</button>
          <button data-go="stats"><i>📊</i>Statistiken</button>
          <button data-go="scenarios"><i>🎬</i>Szenarien</button>
          <button data-go="quick"><i>⚽</i>Schnelles 3D-Spiel</button>
          <button data-go="settings"><i>⚙️</i>Einstellungen</button>
          <button data-go="credits"><i>✦</i>Credits</button>
          <button data-go="quit" class="quit"><i>⏻</i>Beenden</button>
        </nav>
        <p class="sm-ver">Version ${GAME_VERSION} · ${isDesktop() ? 'Windows' : 'Browser'}</p>
      </aside>
      <main class="sm-center" id="m-center">${welcomeHtml()}</main>
      <aside class="sm-notes"><div class="pn-top"><small>BAKUSA</small><h3>Patchnotes</h3></div><div class="pn-list">${patchHtml()}</div></aside>
    </div>`;
  const stopScene = startMenuScene(el.querySelector('#mbg'), app.settings.quality);
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
      if (latestWorld && el.isConnected && center.querySelector('.sv-welcome')) center.innerHTML = `<div class="sv-panel">${careerHtml(latestWorld, latest)}<div class="row-actions"><button class="btn primary lg" data-go="continue">⏵ Karriere fortsetzen</button><button class="btn lg" data-go="new">Neue Karriere</button></div></div>`;
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
    <label class="field">Dein Managername<input id="mgr" maxlength="28" placeholder="z. B. Alex Berger"></label>
    <div class="mode-pick"><b>Spielmodus</b>
      <label><input type="radio" name="mode" value="manager" checked><span><b>Trainer & Manager</b><small>Du machst alles: Aufstellung, Taktik, Wechsel, Transfers, Finanzen.</small></span></label>
      <label><input type="radio" name="mode" value="director"><span><b>Sportdirektor</b><small>Du planst Kader, Transfers, Finanzen und Stadion. Ein KI-Cheftrainer stellt auf, wählt die Taktik und wechselt ein – du kannst ihn entlassen.</small></span></label></div>
    <label class="field">Herausforderung (optional)<select id="chal" class="input">${CHALLENGES.map((c) => `<option value="${c.id}" title="${esc(c.desc)}">${esc(c.name)}${c.id !== 'none' ? ` – ${esc(c.desc)}` : ''}</option>`).join('')}</select></label>
    <div class="row-actions end"><button class="btn primary" id="go">Karriere starten</button></div></div>`);
  m.el.querySelector('#go').onclick = async () => {
    w.userClubId = id;
    w.manager = { name: m.el.querySelector('#mgr').value.trim() || 'Manager', goal };
    w.mode = m.el.querySelector('input[name=mode]:checked')?.value || 'manager';
    if (w.mode === 'director') { const rng = newRng(w); ensureCoach(w, rng); coachDecides(w); }
    w.news = [{ season: w.season, week: 0, text: `Willkommen bei ${c.name}! Der Vorstand erwartet: ${goal}.` }];
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

function settingsForm(app) {
  const s = app.settings;
  const opt = (v, cur, label) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
  return `<div class="settings">
    <label class="field">Grafikqualität<select id="s-q">${[['niedrig', 'Niedrig'], ['mittel', 'Mittel'], ['hoch', 'Hoch'], ['ultra', 'Ultra']].map(([v, l]) => opt(v, s.quality, l)).join('')}</select></label>
    <label class="field">Standard-Spielgeschwindigkeit<select id="s-sp">${[[1, '1x'], [2, '2x'], [4, '4x'], [8, '8x'], ['highlights', 'Nur Highlights']].map(([v, l]) => opt(v, s.speed, l)).join('')}</select></label>
    <label class="field">Standard-Kamera<select id="s-cam">${CAMERA_MODES.map(([v, l]) => opt(v, s.camera, l)).join('')}</select></label>
    <label>Farbschema <select id="s-theme" class="input"><option value="verein" ${s.theme !== 'violett' ? 'selected' : ''}>Vereinsfarben</option><option value="violett" ${s.theme === 'violett' ? 'selected' : ''}>Klassisch Violett</option></select></label>
    <label>Darstellung <select id="s-mode" class="input"><option value="dunkel" ${s.mode !== 'hell' ? 'selected' : ''}>Dunkel</option><option value="hell" ${s.mode === 'hell' ? 'selected' : ''}>Hell</option></select></label>
    <label class="check"><input type="checkbox" id="s-anim" ${s.animations !== false ? 'checked' : ''}> Animierte Übergänge & Pokal-Zeremonie</label>
    <label class="check"><input type="checkbox" id="s-story" ${s.story !== false ? 'checked' : ''}> Saison-Story am Saisonende</label>
    <label>Stadion-Sound <input type="range" id="s-vol" min="0" max="1" step="0.05" value="${s.volume ?? 0.6}"></label>
    <label class="check"><input type="checkbox" id="s-ann" ${s.announcer !== false ? 'checked' : ''}> Stadionsprecher (Sprachausgabe)</label>
    <label class="check"><input type="checkbox" id="s-com" ${s.commentary ? 'checked' : ''}> TV-Kommentar vorlesen</label>
    <label class="check"><input type="checkbox" id="s-pyro" ${s.pyro !== 'aus' ? 'checked' : ''}> Pyrotechnik & Rauch in den Fankurven</label>
    <label class="check"><input type="checkbox" id="s-var" ${s.var !== false ? 'checked' : ''}> VAR-Überprüfungen im Spiel</label>
    <label class="check"><input type="checkbox" id="s-auto" ${s.autosave ? 'checked' : ''}> Automatisch speichern</label>
    <label class="check"><input type="checkbox" id="s-subs" ${s.autoSubs !== false ? 'checked' : ''}> Automatische Auswechslungen für mein Team</label>
    <p class="muted">Tipp: Auf Smartphones „Niedrig" oder „Mittel" wählen. Die FPS-Anzeige siehst du im 3D-Spiel oben rechts.</p>
  </div>`;
}
function bindSettings(app, root) {
  const s = app.settings;
  const upd = () => {
    s.quality = root.querySelector('#s-q').value;
    const sp = root.querySelector('#s-sp').value; s.speed = sp === 'highlights' ? sp : +sp;
    s.camera = root.querySelector('#s-cam').value;
    s.autosave = root.querySelector('#s-auto').checked;
    s.autoSubs = root.querySelector('#s-subs').checked;
    s.pyro = root.querySelector('#s-pyro').checked ? 'normal' : 'aus';
    s.volume = +root.querySelector('#s-vol').value;
    s.theme = root.querySelector('#s-theme').value; s.mode = root.querySelector('#s-mode').value; s.animations = root.querySelector('#s-anim').checked; s.story = root.querySelector('#s-story').checked;
    s.announcer = root.querySelector('#s-ann').checked;
    s.commentary = root.querySelector('#s-com').checked;
    s.var = root.querySelector('#s-var').checked;
    saveSettings(s);
    applyTheme(s, window.ufm?.world ? window.ufm.club : null);
  };
  root.querySelectorAll('select,input').forEach((i) => i.addEventListener('change', () => { upd(); toast('Einstellungen gespeichert', 1200); }));
}
export function settingsScreen(app, el) {
  el.innerHTML = `<div class="page narrow"><h2>Einstellungen</h2><div class="card">${settingsForm(app)}</div></div>`;
  bindSettings(app, el);
}
function settingsModal(app) {
  const m = modal(`<h3>Einstellungen</h3>${settingsForm(app)}`);
  bindSettings(app, m.el);
}

export function seasonEndScreen(app, el) {
  const w = app.world;
  if (!isUserSeasonOver(w)) { el.innerHTML = '<div class="page"><p>Die Saison läuft noch.</p></div>'; return; }
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
      <button class="btn primary" id="cont">Weiter zur neuen Saison</button></div>`;
    el.querySelector('#end').disabled = true;
    await app.autosave();
    el.querySelector('#cont').onclick = () => app.go('home');
  };
}
