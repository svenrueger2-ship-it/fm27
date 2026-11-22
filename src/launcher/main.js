// FUSSBALL MANAGER 2027 © BAKUSA – Launcher (v2.6)
import { startBackground } from './bg.js';
import * as sfx from './sfx.js';
import { PATCHNOTES, GAME_VERSION } from '../data/patchnotes.js';
import { listSaves, loadSettings, saveSettings } from '../storage/db.js';
import { ACHIEVEMENTS, globalAchievements } from '../manager/achievements.js';

const B = window.bakusa || null;                       // Electron bridge (absent in the browser preview)
const LKEY = 'ufm3d-launcher';
const LS = (() => { try { return { fullscreen: false, sounds: true, motion: true, returnToLauncher: true, ...JSON.parse(localStorage.getItem(LKEY) || '{}') }; } catch { return { fullscreen: false, sounds: true, motion: true, returnToLauncher: true }; } })();
const saveLS = () => { try { localStorage.setItem(LKEY, JSON.stringify(LS)); } catch {} };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'gerade eben'; if (m < 60) return `vor ${m} Min.`; const h = Math.round(m / 60); if (h < 24) return `vor ${h} Std.`; const d = Math.round(h / 24); return d === 1 ? 'gestern' : `vor ${d} Tagen`; };
const seasonTxt = (s) => `${s}/${String((s + 1) % 100).padStart(2, '0')}`;
const lum = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const sat = (h) => { const n = parseInt(String(h).replace('#', ''), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
function accentFrom(colors) {
  if (!colors) return null;
  const c = [colors.primary, colors.secondary].filter(Boolean).sort((a, b) => sat(b) - sat(a))[0];
  if (!c || sat(c) < 0.25 || lum(c) < 0.08) return null;
  return c;
}
const rgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`; };

sfx.setSfx(LS.sounds);
const state = { gate: !!B, queued: (() => { try { const q = JSON.parse(sessionStorage.getItem('fm27-queued') || 'null'); sessionStorage.removeItem('fm27-queued'); return q; } catch { return null; } })(), tab: 'news', saves: [], update: { state: B ? 'idle' : 'browser' }, live: { state: B ? 'idle' : 'browser' }, info: { version: GAME_VERSION }, launching: false, expanded: null };

function badge(s, size = 46) {
  const m = s.meta || {}, c1 = m.colors?.primary || '#4a3d8f', c2 = m.colors?.secondary || '#ffffff';
  if (m.crest) return `<img class="crest-img" src="${m.crest}" width="${size}" height="${size}" alt="">`;
  const txt = esc((m.short || s.club || '?').slice(0, 3).toUpperCase());
  return `<svg class="mono" width="${size}" height="${size}" viewBox="0 0 48 48"><defs><linearGradient id="g${esc(s.slot)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c1}" stop-opacity=".75"/></linearGradient></defs>
    <path d="M24 2 L44 9 V24 C44 36 35 43 24 46 C13 43 4 36 4 24 V9 Z" fill="url(#g${esc(s.slot)})" stroke="${c2}" stroke-width="2.5"/>
    <text x="24" y="29" text-anchor="middle" font-family="Barlow Condensed, Inter, sans-serif" font-weight="900" font-size="${txt.length > 2 ? 13 : 16}" fill="${c2}">${txt}</text></svg>`;
}

// ------------------------------------------------------------------ layout
function shell() {
  document.body.innerHTML = `
  <canvas id="bg"></canvas><div class="grain"></div><div class="flash"></div>
  <header class="titlebar"><div class="tb-logo"><b>FM</b><i>27</i></div><div class="tb-drag"></div>
    <button class="tb-btn" id="tb-snd" title="Launcher-Sounds">${LS.sounds ? '🔊' : '🔇'}</button>
    ${B ? '<button class="tb-btn" id="tb-min" title="Minimieren">—</button><button class="tb-btn close" id="tb-close" title="Schließen">✕</button>' : ''}</header>
  <main class="stage">
    <section class="hero">
      <p class="kicker"><span class="dot"></span>BAKUSA PRESENTS</p>
      <h1 class="title"><span class="t1">FUSSBALL</span><span class="t2">MANAGER</span><span class="t3" data-text="2027">2027</span></h1>
      <p class="tagline">Dein Verein. Deine Taktik. Live in 3D.</p>
      <div class="actions">
        <button class="play" id="play"><span class="play-bg"></span><span class="play-fill"></span><span class="play-label"><span class="play-ico">▶</span><span id="play-txt">SPIELEN</span></span><span class="play-sub" id="play-sub"></span></button>
        <div id="continue"></div>
      </div>
      <div class="stats" id="stats"></div>
    </section>
    <aside class="panel">
      <nav class="tabs">${[['news', 'Neuigkeiten'], ['saves', 'Spielstände'], ['settings', 'Einstellungen'], ['info', 'Info']].map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('')}<i class="tab-ink"></i></nav>
      <div class="panel-body" id="panel"></div>
    </aside>
  </main>
  <div class="ticker"><span class="ticker-tag">NEU IN ${esc(GAME_VERSION.replace(/\.0$/, ''))}</span><div class="ticker-track"><div class="ticker-move" id="ticker"></div></div></div>
  <footer class="statusbar"><div class="upd" id="upd"></div><div class="foot-r">v${esc(GAME_VERSION)} · © 2026 BAKUSA</div></footer>`;
}

// ------------------------------------------------------------------ hero
function renderStats() {
  const got = Object.keys(globalAchievements()).length, last = state.saves[0];
  const items = [
    ['Spielstände', state.saves.length],
    ['Erfolge', `${got}<small>/${ACHIEVEMENTS.length}</small>`],
    ['Manager-Level', last?.meta?.level ?? '–'],
    ['Version', esc(GAME_VERSION)],
  ];
  $('#stats').innerHTML = items.map(([l, v], i) => `<div class="stat" style="--i:${i}"><b>${v}</b><span>${l}</span></div>`).join('');
}
function renderContinue() {
  const s = state.saves[0];
  $('#continue').innerHTML = s ? `<button class="cont" id="cont" style="--c1:${s.meta?.colors?.primary || '#6b5bd6'}">${badge(s, 52)}<span class="cont-txt"><small>WEITERSPIELEN</small><b>${esc(s.club)}</b><em>${s.meta?.scenario ? `🎬 ${esc(s.meta.scenario)} · ` : ''}Saison ${seasonTxt(s.season)} · Spieltag ${s.week + 1} · ${ago(s.savedAt)}</em></span><span class="cont-arrow">→</span></button>`
    : `<div class="cont empty"><span class="cont-txt"><small>WILLKOMMEN</small><b>Starte deine erste Karriere</b><em>Wähle aus 158 Vereinen in 8 Ligen oder gründe deinen eigenen.</em></span></div>`;
  $('#cont')?.addEventListener('click', () => launch(s.slot));
  $('#cont')?.addEventListener('pointerenter', sfx.tick);
}

// ------------------------------------------------------------------ panel tabs
// Patch-note lines are "Headline: details" or "Headline – details"; show the headline bold and the rest in full.
function noteLi(n) {
  const m = n.match(/^([^:–]{3,48})(?::| –)\s+(.+)$/);
  return m ? `<li><b>${esc(m[1])}</b><span>${esc(m[2])}</span></li>` : `<li><span>${esc(n)}</span></li>`;
}
function newsHtml() {
  const [cur, ...older] = PATCHNOTES;
  const ex = state.expanded === cur.version;
  return `<article class="feat"><div class="feat-art"><span class="feat-ver">${esc(cur.version)}</span><span class="feat-new">NEU</span></div>
    <div class="feat-body"><small>${esc(cur.date)}</small><h3>${esc(cur.title)}</h3>
    <ul class="notes">${(ex ? cur.neu : cur.neu.slice(0, 4)).map(noteLi).join('')}</ul>
    ${ex ? `${cur.verbessert?.length ? `<h4>Verbessert</h4><ul class="notes">${cur.verbessert.map(noteLi).join('')}</ul>` : ''}${cur.behoben?.length ? `<h4>Behoben</h4><ul class="notes">${cur.behoben.map(noteLi).join('')}</ul>` : ''}` : ''}
    <button class="link" data-exp="${esc(cur.version)}">${ex ? 'Weniger anzeigen' : `Alle ${cur.neu.length + (cur.verbessert?.length || 0) + (cur.behoben?.length || 0)} Änderungen anzeigen`}</button></div></article>
    <h4 class="sec">Frühere Updates</h4>
    ${older.slice(0, 10).map((v) => `<details class="old"><summary><span class="ov">${esc(v.version)}</span><span class="ot">${esc(v.title.replace(/^Version [\d.]+ – /, ''))}</span><span class="od">${v.neu.length} neu</span></summary><ul class="notes">${v.neu.map(noteLi).join('')}</ul></details>`).join('')}`;
}
function savesHtml() {
  if (!state.saves.length) return `<div class="empty-state"><div class="es-ico">💾</div><p>Noch keine Spielstände.</p><small>Sie erscheinen hier, sobald du im Spiel speicherst.</small></div>`;
  return `<div class="saves">${state.saves.map((s, i) => `<button class="save" data-slot="${esc(s.slot)}" style="--c1:${s.meta?.colors?.primary || '#6b5bd6'};--d:${i * 0.05}s">${badge(s, 40)}
    <span class="sv-txt"><b>${esc(s.label || s.club)}</b><em>${esc(s.meta?.league || '')}${s.meta?.league ? ' · ' : ''}Saison ${seasonTxt(s.season)} · Spieltag ${s.week + 1}</em></span>
    <span class="sv-meta"><span class="sv-slot">${s.slot === 'auto' ? 'Autosave' : s.slot === 'szenario' ? 'Szenario' : 'Slot ' + esc(String(s.slot).replace('slot', ''))}</span><small>${ago(s.savedAt)}</small></span></button>`).join('')}</div>`;
}
function settingsHtml() {
  const g = loadSettings();
  const seg = (id, val, opts) => `<div class="seg" data-seg="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(val) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tog = (id, on, label, sub) => `<label class="tog"><span><b>${label}</b><small>${sub}</small></span><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></label>`;
  return `<div class="set-group"><h4 class="sec">Grafik & Ton</h4>
    <div class="row"><span><b>Grafikqualität</b><small>3D-Spiel und Stadion</small></span>${seg('quality', g.quality, [['niedrig', 'Niedrig'], ['mittel', 'Mittel'], ['hoch', 'Hoch']])}</div>
    <div class="row"><span><b>Lautstärke im Spiel</b><small>Stadion-Sound und Kommentar</small></span><input type="range" min="0" max="100" value="${Math.round((g.volume ?? 0.8) * 100)}" id="vol"><output id="vol-o">${Math.round((g.volume ?? 0.8) * 100)} %</output></div>
    ${tog('fs', LS.fullscreen, 'Im Vollbild starten', 'Jederzeit mit F11 umschaltbar')}
    ${tog('snd', LS.sounds, 'Launcher-Sounds', 'Klicks und Anpfiff beim Start')}
    ${tog('motion', LS.motion, 'Animierter Hintergrund', 'Ausschalten spart Akku auf Laptops')}
    ${B ? tog('ret', LS.returnToLauncher, 'Zurück zum Launcher', 'Nach dem Beenden des Spiels den Launcher wieder öffnen') : ''}</div>
    <div class="set-group"><h4 class="sec">Updates</h4><div class="row"><span><b>Update-Quelle</b><small>GitHub · svenrueger2-ship-it/fm27</small></span><button class="btn-sm" id="chk">Jetzt prüfen</button></div>
    <div class="row"><span><b>Live-Updates</b><small>Neue Versionen werden beim Start und alle 10 Minuten geprüft und in Sekunden eingespielt – ohne Neuinstallation</small></span><span class="pill-ok">aktiv</span></div>
    ${state.info.portable ? '<p class="note">Portable Version: Spiel-Updates kommen live. Nur selten nötige App-Updates (neue Fenster-Technik) musst du hier neu herunterladen.</p>' : ''}</div>`;
}
function infoHtml() {
  const keys = [['F11', 'Vollbild an/aus'], ['Esc', 'Vollbild verlassen'], ['Leertaste', 'Pause im 3D-Spiel'], ['Enter', 'Im Launcher: Spielen']];
  return `<div class="info-hero"><div class="tb-logo big"><b>FM</b><i>27</i></div><div><b>FUSSBALL MANAGER 2027</b><small>© 2026 BAKUSA · Version ${esc(GAME_VERSION)}</small></div></div>
    <h4 class="sec">Tastenkürzel</h4><div class="keys">${keys.map(([k, l]) => `<div><kbd>${k}</kbd><span>${l}</span></div>`).join('')}</div>
    <h4 class="sec">Technik</h4><div class="kv"><span>Engine</span><b>Three.js · WebGL</b></div><div class="kv"><span>Spielstände</span><b>lokal auf diesem PC</b></div>
    ${state.info.electron ? `<div class="kv"><span>Electron / Chromium</span><b>${esc(state.info.electron)} / ${esc(state.info.chrome)}</b></div>` : ''}
    <div class="kv"><span>Spiel-Version</span><b>${esc(state.info.version)}${state.info.appVersion ? ` · App ${esc(state.info.appVersion)}` : ''}</b></div>
    <div class="kv"><span>Updates</span><b>${B ? 'Live (ohne Neuinstallation)' : 'Browser-Version'}</b></div>
    <button class="btn-sm wide" id="rel">Releases auf GitHub öffnen ↗</button>`;
}
function renderPanel() {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
  const on = $(`.tabs button[data-tab="${state.tab}"]`), ink = $('.tab-ink');
  if (on && ink) { ink.style.width = `${on.offsetWidth}px`; ink.style.transform = `translateX(${on.offsetLeft}px)`; }
  const P = $('#panel');
  P.innerHTML = `<div class="pane">${{ news: newsHtml, saves: savesHtml, settings: settingsHtml, info: infoHtml }[state.tab]()}</div>`;
  P.querySelectorAll('[data-exp]').forEach((b) => (b.onclick = () => { state.expanded = state.expanded ? null : b.dataset.exp; renderPanel(); }));
  P.querySelectorAll('.save').forEach((b) => { b.onclick = () => launch(b.dataset.slot); b.onpointerenter = sfx.tick; });
  P.querySelectorAll('[data-seg]').forEach((s) => s.querySelectorAll('button').forEach((b) => (b.onclick = () => { const g = loadSettings(); g[s.dataset.seg] = b.dataset.v; saveSettings(g); sfx.click(); renderPanel(); })));
  const vol = $('#vol'); if (vol) vol.oninput = () => { $('#vol-o').textContent = `${vol.value} %`; const g = loadSettings(); g.volume = vol.value / 100; saveSettings(g); };
  const bind = (id, key, after) => { const el = $(`#${id}`); if (el) el.onchange = () => { LS[key] = el.checked; saveLS(); sfx.click(); after?.(); }; };
  bind('fs', 'fullscreen'); bind('ret', 'returnToLauncher');
  bind('snd', 'sounds', () => { sfx.setSfx(LS.sounds); $('#tb-snd').textContent = LS.sounds ? '🔊' : '🔇'; });
  bind('motion', 'motion', () => { bg.setPaused(!LS.motion); document.body.classList.toggle('still', !LS.motion); });
  $('#chk')?.addEventListener('click', () => { B?.liveCheck?.(); B?.checkUpdate(); });
  $('#rel')?.addEventListener('click', () => B ? B.openReleases() : window.open('https://github.com/svenrueger2-ship-it/fm27/releases', '_blank'));
}

// ------------------------------------------------------------------ update status + play button
// Two update channels: "live" (game files, installed in seconds, no reinstall) and the app shell (rare).
function setLive(l) {
  state.live = { ...l };
  if (['latest', 'error', 'needs-app'].includes(l.state) || (l.state === 'needs-app' && state.info.portable)) openGate();
  if (l.state === 'installed') {
    showToast(`✓ Auf Version ${esc(l.version)} aktualisiert`, l.title ? esc(l.title.replace(/^Version [\d.]+ – /, '')) : 'Neue Inhalte geladen');
    try { if (state.queued) sessionStorage.setItem('fm27-queued', JSON.stringify(state.queued)); } catch {}
    setTimeout(() => B?.reloadLauncher(), 2200);
  }
  setUpdate({});
}
function showToast(title, sub) {
  const t = document.createElement('div'); t.className = 'ltoast'; t.innerHTML = `<b>${title}</b><small>${sub}</small>`;
  document.body.appendChild(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3200);
}
function setUpdate(u) {
  state.update = { ...state.update, ...u };
  const appU = state.update, Lv = state.live;
  // the live channel decides what is shown, unless an app (shell) update is actually in progress
  const appBusy = ['available', 'downloading', 'ready', 'installing'].includes(appU.state);
  const U = appBusy ? appU : B ? { ...Lv, state: { idle: 'idle', checking: 'checking', latest: 'latest', downloading: 'live-dl', installed: 'live-ok', 'needs-app': state.info.portable ? 'needs-portable' : 'needs-app', error: 'error' }[Lv.state] || 'idle' } : appU;
  const el = $('#upd'), play = $('#play'), sub = $('#play-sub'), txt = $('#play-txt');
  const msg = {
    browser: ['web', 'Browser-Version – immer aktuell'],
    idle: ['ok', 'Bereit'],
    checking: ['spin', 'Suche nach Updates …'],
    latest: ['ok', `Aktuell · Version ${esc(U.version || GAME_VERSION)} · automatische Live-Updates aktiv`],
    'live-dl': ['dl', `Update ${esc(U.version || '')} wird installiert · ${U.percent ?? 0} %`],
    'live-ok': ['ok', `Auf Version ${esc(U.version || '')} aktualisiert ✓`],
    'needs-app': ['dl', `Version ${esc(U.version || '')} braucht eine neue App-Version – wird im Hintergrund geladen`],
    installing: ['dl', ''],
    'needs-portable': ['gold', `Version ${esc(U.version || '')} braucht eine neue App-Version – bitte neu herunterladen`],
    available: ['dl', `Update ${esc(U.version || '')} gefunden – wird geladen …`],
    downloading: ['dl', `Update wird geladen · ${U.percent ?? 0} %`],
    ready: ['gold', `Update ${esc(U.version || '')} ist bereit`],
    portable: ['web', 'Portable Version · Updates über den Installer'],
    error: ['err', 'Update-Server nicht erreichbar – du kannst trotzdem spielen'],
  }[U.state] || ['ok', ''];
  const dl = U.state === 'downloading' || U.state === 'live-dl';
  if (U.state === 'installing') msg[1] = `App-Update ${esc(U.version || '')} wird installiert – der Launcher startet gleich neu …`;
  el.innerHTML = `<i class="ud ${msg[0]}"></i><span>${msg[1]}</span>${dl ? `<span class="mini"><b style="width:${U.percent || 0}%"></b></span>` : ''}${B && !dl && U.state !== 'checking' ? '<button class="ud-btn" id="ud-chk">Jetzt prüfen</button>' : ''}`;
  $('#ud-chk')?.addEventListener('click', () => { B.liveCheck(); B.checkUpdate(); });
  play.classList.toggle('gold', U.state === 'ready');
  play.style.setProperty('--fill', dl ? `${U.percent || 0}%` : '0%');
  play.classList.toggle('loading', dl || U.state === 'available');
  const waiting = state.gate || dl || U.state === 'live-ok' || U.state === 'installing';
  play.classList.toggle('wait', waiting);
  txt.textContent = U.state === 'installing' ? 'UPDATE …' : state.gate && !dl ? 'PRÜFE …' : dl ? 'UPDATE …' : 'SPIELEN';
  sub.textContent = state.queued && waiting ? 'Startet automatisch nach dem Update' : U.state === 'ready' ? `Version ${U.version || ''} installieren · Neustart in Sekunden` : U.state === 'live-dl' ? `Update ${U.version || ''} wird installiert · ${U.percent || 0} %` : U.state === 'downloading' ? `App-Update lädt im Hintergrund · ${U.percent || 0} %` : '';
}

// ------------------------------------------------------------------ launch
function openGate() {
  if (!state.gate) return;
  state.gate = false; setUpdate({});
  if (state.queued) { const q = state.queued; state.queued = null; launch(q.slot); }
}
async function launch(slot) {
  if (state.launching) return;
  // forced update: playing only starts once the update check (and any update) is finished
  if (state.gate || state.live.state === 'downloading' || state.live.state === 'installed' || state.update.state === 'installing') { state.queued = { slot }; sfx.click(); setUpdate({}); return; }
  if (state.update.state === 'ready' && !slot) { sfx.click(); B?.installUpdate(); return; }
  state.launching = true;
  sfx.kickoff();
  document.body.classList.add('launching');
  bg.kick();
  await new Promise((r) => setTimeout(r, 1350));
  const opts = { slot: slot || null, fullscreen: LS.fullscreen, returnToLauncher: LS.returnToLauncher };
  if (B) { B.launch(opts); setTimeout(() => { state.launching = false; document.body.classList.remove('launching'); bg.reset(); }, 2500); }
  else location.href = `index.html${slot ? `#continue=${encodeURIComponent(slot)}` : ''}`;
}

// ------------------------------------------------------------------ boot
shell();
const bg = startBackground($('#bg'));
if (!LS.motion) { bg.setPaused(true); document.body.classList.add('still'); }
$('#ticker').innerHTML = (() => { const items = PATCHNOTES[0].neu.map((n) => esc((n.match(/^([^:–]{3,60})(?::| –)/) || [0, n])[1])); const one = items.map((t) => `<span>${t}</span><i>◆</i>`).join(''); return one + one; })();
document.querySelectorAll('.tabs button').forEach((b) => { b.onclick = () => { if (state.tab === b.dataset.tab) return; state.tab = b.dataset.tab; sfx.tick(); renderPanel(); }; });
$('#play').onclick = () => launch(null);
$('#play').onpointerenter = sfx.tick;
$('#tb-snd').onclick = () => { LS.sounds = !LS.sounds; saveLS(); sfx.setSfx(LS.sounds); $('#tb-snd').textContent = LS.sounds ? '🔊' : '🔇'; if (state.tab === 'settings') renderPanel(); };
$('#tb-min')?.addEventListener('click', () => B.minimize());
$('#tb-close')?.addEventListener('click', () => B.close());
addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.target.closest('input')) launch(null); });
// magnetic play button
const play = $('#play');
play.addEventListener('pointermove', (e) => { const r = play.getBoundingClientRect(); play.style.setProperty('--mx', `${e.clientX - r.left}px`); play.style.setProperty('--my', `${e.clientY - r.top}px`); play.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.06}px, ${(e.clientY - r.top - r.height / 2) * 0.12}px)`; });
play.addEventListener('pointerleave', () => { play.style.transform = ''; });

setUpdate({});
renderPanel(); renderStats(); renderContinue();
(async () => {
  try { state.saves = await listSaves(); } catch { state.saves = []; }
  const a = accentFrom(state.saves[0]?.meta?.colors);
  if (a) { const R = document.documentElement.style; R.setProperty('--acc', a); R.setProperty('--acc-rgb', rgb(a)); if (lum(a) > 0.62) { R.setProperty('--acc-ink', '#14110a'); R.setProperty('--ink-shadow', '0'); } bg.setColors(a, '#3aa0ff'); }
  renderStats(); renderContinue(); if (state.tab === 'saves') renderPanel();
})();
if (B) {
  B.getInfo().then((i) => { state.info = { ...state.info, ...i }; if (i.live && i.live.state !== 'installed') state.live = i.live; else if (i.live?.state === 'installed') state.live = { state: 'latest', version: i.version }; if (['latest', 'error', 'needs-app'].includes(state.live.state)) openGate(); if (i.update) setUpdate(i.update); else setUpdate({}); renderPanel(); });
  // keep checking while the launcher is open
  addEventListener('focus', () => { if (Date.now() - (state.lastFocusCheck || 0) > 60000) { state.lastFocusCheck = Date.now(); B.liveCheck?.(); } });
  B.onUpdate((u) => setUpdate(u));
  B.onLive?.((l) => setLive(l));
  setTimeout(openGate, 9000); // never block longer than a few seconds when offline
}
requestAnimationFrame(() => document.body.classList.add('ready'));
