// v3.1: live match in the Unity WebGL engine (iframe + postMessage). Falls back to the classic 3D mode.
import { crest, esc, modal } from '../dom.js';
import { ensureLineup } from '../../match/tactics.js';
import { UNITY_URL, buildUnitySetup, unityResult } from '../../match/unityBridge.js';
import { conditions, commitResult, currentFixture } from './match.js';

const LOAD_TIMEOUT = 60000;

export function unityMatch(app, el, params) {
  const w = app.world, S = app.settings;
  const fx = currentFixture(w);
  const H = w.clubs[fx.h], A = w.clubs[fx.a];
  ensureLineup(H, w.players); ensureLineup(A, w.players);
  const cond = conditions(w, fx);
  const seed = (w.season * 1000 + w.week * 17 + H.id * 31 + A.id) >>> 0;
  const setup = buildUnitySetup(w, H, A, S, cond, seed);
  const userSide = H.id === w.userClubId ? 0 : A.id === w.userClubId ? 1 : -1;
  const pl = (id) => w.players[id];
  let frame = null, sent = false, done = false, speed = setup.speed || 1, mentality = userSide >= 0 ? setup.match[userSide ? 'away' : 'home'].mentality : 0;
  const ticker = [];

  el.innerHTML = `<div class="u-match">
    <div class="u-stage"><iframe id="u-frame" title="Unity 3D" allow="autoplay; fullscreen" src="${(() => { try { return localStorage.getItem('fm27UnityUrl') || UNITY_URL; } catch { return UNITY_URL; } })()}?v=${Date.now() >> 22}"></iframe>
      <div class="u-bug"><span>${crest(H, 26)}<b>${esc(H.short)}</b></span><em id="u-score">0 : 0</em><span><b>${esc(A.short)}</b>${crest(A, 26)}</span><i id="u-clock">00:00</i></div>
      <div class="u-feed" id="u-feed"></div>
      <div class="u-load" id="u-load"><div><b>Unity-3D-Engine wird geladen …</b><div class="u-bar"><i id="u-prog"></i></div><small id="u-hint">Beim ersten Mal einmalig ca. 15–30 MB, danach aus dem Zwischenspeicher.</small>
        <div class="row-actions center"><button class="btn ghost sm" id="u-classic">Klassisch spielen</button></div></div></div>
    </div>
    <div class="u-ctrl">
      <div class="seg" id="u-speed">${[1, 2, 4, 8].map((v) => `<button data-sp="${v}" class="${v === speed ? 'on' : ''}">${v}x</button>`).join('')}</div>
      <select id="u-cam" class="input"><option value="tv">TV-Kamera</option><option value="wide">Weit</option><option value="behind">Hinter dem Tor</option><option value="bird">Vogelperspektive</option></select>
      ${userSide >= 0 ? `<div class="seg" id="u-ment" title="Ausrichtung">${[[-2, 'Mauern'], [-1, 'Defensiv'], [0, 'Normal'], [1, 'Offensiv'], [2, 'Alles nach vorn']].map(([v, l]) => `<button data-m="${v}" class="${v === mentality ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
      <button class="btn sm ghost" id="u-pause">⏸ Pause</button>
      <button class="btn sm" id="u-end">⏭ Spiel beenden</button>
    </div></div>`;
  const $ = (q) => el.querySelector(q);
  frame = $('#u-frame');
  const send = (method, payload) => { try { frame.contentWindow.postMessage({ fm27host: { method, payload: typeof payload === 'string' ? payload : JSON.stringify(payload) } }, '*'); } catch { /* frame gone */ } };
  const cmd = (c) => send('Command', { side: userSide < 0 ? 0 : userSide, value: 0, fvalue: 0, outId: 0, text: '', ...c });

  const fail = (why) => {
    if (done) return;
    $('#u-load').classList.add('err');
    $('#u-load').innerHTML = `<div><b>Unity-3D ist gerade nicht verfügbar</b><small>${esc(why)}</small><div class="row-actions center"><button class="btn primary" id="u-classic2">Klassisch spielen</button><button class="btn ghost" id="u-retry">Erneut versuchen</button></div></div>`;
    $('#u-classic2').onclick = () => app.go('match', { mode: '3d' });
    $('#u-retry').onclick = () => app.go('match', { mode: 'unity' });
  };
  if (!navigator.onLine) setTimeout(() => fail('Keine Internetverbindung – die Unity-Engine wird beim ersten Start aus dem Netz geladen.'), 50);
  const timer = setTimeout(() => { if (!sent) fail('Die Engine hat nicht rechtzeitig geantwortet. Wahrscheinlich ist der erste Unity-Build noch nicht veröffentlicht.'); }, LOAD_TIMEOUT);

  const startMatch = () => { if (sent) return; sent = true; clearTimeout(timer); send('Setup', setup); $('#u-load')?.remove(); };
  const feed = (text, cls = '') => { ticker.unshift(`<div class="${cls}">${text}</div>`); $('#u-feed').innerHTML = ticker.slice(0, 4).join(''); };
  const nameOf = (id) => esc(pl(id)?.lastName || 'Eigentor');

  const onMsg = (ev) => {
    if (ev.source !== frame?.contentWindow) return;
    const m = ev.data?.fm27unity; if (!m) return;
    switch (m.type) {
      case 'progress': { const p = $('#u-prog'); if (p) p.style.width = `${m.text}%`; break; }
      case 'ready': case 'loaded': startMatch(); break;
      case 'error': fail(m.text || 'Unbekannter Fehler'); break;
      case 'state': if (m.state) { $('#u-score').textContent = `${m.state.home} : ${m.state.away}`; $('#u-clock').textContent = m.state.clock; } break;
      case 'event': {
        const e = m.ev; if (!e) break;
        const club = e.side === 0 ? H : e.side === 1 ? A : null;
        if (e.type === 'goal') { feed(`⚽ ${e.minute}' <b>${nameOf(e.player)}</b> (${esc(club?.short || '')})${e.assist ? ` · Vorlage ${nameOf(e.assist)}` : ''}`, 'goal'); $('.u-bug').classList.remove('flash'); void $('.u-bug').offsetWidth; $('.u-bug').classList.add('flash'); }
        else if (e.type === 'yellow') feed(`🟨 ${e.minute}' ${nameOf(e.player)}`);
        else if (e.type === 'red') feed(`🟥 ${e.minute}' ${nameOf(e.player)}`, 'bad');
        else if (e.type === 'save') feed(`🧤 ${e.minute}' Parade ${nameOf(e.player)}`);
        else if (e.type === 'penalty') feed(`❗ ${e.minute}' Elfmeter für ${esc(club?.short || '')}`);
        else if (e.type === 'halftime' || e.type === 'fulltime') feed(`⏱ ${esc(e.text)}`);
        break;
      }
      case 'summary': if (!done) { done = true; report(unityResult(m.summary, setup, w)); } break;
    }
  };
  window.addEventListener('message', onMsg);

  el.querySelectorAll('#u-speed [data-sp]').forEach((b) => (b.onclick = () => { speed = +b.dataset.sp; cmd({ type: 'speed', fvalue: speed }); el.querySelectorAll('#u-speed button').forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#u-cam').onchange = (e) => cmd({ type: 'camera', text: e.target.value });
  el.querySelectorAll('#u-ment [data-m]').forEach((b) => (b.onclick = () => { mentality = +b.dataset.m; cmd({ type: 'mentality', value: mentality }); feed(`📣 Ausrichtung: ${esc(b.textContent)}`); el.querySelectorAll('#u-ment button').forEach((x) => x.classList.toggle('on', x === b)); }));
  let paused = false;
  $('#u-pause').onclick = () => { paused = !paused; cmd({ type: paused ? 'pause' : 'resume' }); $('#u-pause').textContent = paused ? '▶ Weiter' : '⏸ Pause'; };
  $('#u-end').onclick = () => { if (!sent) return; const m = modal(`<h3>Spiel sofort beenden?</h3><p class="muted">Der Rest wird in Sekundenbruchteilen von der KI zu Ende gespielt.</p><div class="row-actions end"><button class="btn ghost" id="no">Abbrechen</button><button class="btn primary" id="yes">Beenden</button></div>`); m.el.querySelector('#no').onclick = () => m.close(); m.el.querySelector('#yes').onclick = () => { m.close(); cmd({ type: 'finish' }); }; };
  $('#u-classic').onclick = () => app.go('match', { mode: '3d' });

  function report(r) {
    window.removeEventListener('message', onMsg);
    frame?.remove(); frame = null;
    const goals = r.events.filter((e) => e.type === 'goal');
    const st = r.stats;
    const row = (l, a, b) => `<div class="u-st"><b>${a}</b><span>${l}</span><b>${b}</b></div>`;
    const rated = (side) => setup.match[side].players.map((p) => ({ p, r: r.ratings[p.id] ?? 6 })).sort((x, y) => y.r - x.r).slice(0, 4)
      .map((x) => `<div class="pl-row"><span class="pos">${x.p.pos}</span><span class="nm">${esc(x.p.name)}</span><b>${x.r.toFixed(1)}</b></div>`).join('');
    el.innerHTML = `<div class="page narrow report">
      <div class="card big-result"><small class="muted">UNITY-3D · NEUE KI</small><div class="ov-score">${crest(H, 56)}<b>${r.hg} : ${r.ag}</b>${crest(A, 56)}</div>
        <div class="goals-list">${goals.map((g) => `<p class="${g.side === 'h' ? 'l' : 'r'}">${g.minute}' ⚽ ${nameOf(g.player)}</p>`).join('') || '<p class="muted">Keine Tore.</p>'}</div></div>
      <div class="card"><h3>Statistik</h3>${row('Ballbesitz', st[0].possession + ' %', st[1].possession + ' %')}${row('Schüsse', st[0].shots, st[1].shots)}${row('aufs Tor', st[0].onTarget, st[1].onTarget)}${row('xG', st[0].xg.toFixed(2), st[1].xg.toFixed(2))}${row('Pässe (angekommen)', `${st[0].passes} (${st[0].passesOk})`, `${st[1].passes} (${st[1].passesOk})`)}${row('Zweikämpfe gewonnen', st[0].tackles, st[1].tackles)}${row('Fouls', st[0].fouls, st[1].fouls)}${row('Ecken', st[0].corners, st[1].corners)}${row('Paraden', st[0].saves, st[1].saves)}</div>
      <div class="grid-2"><div class="card"><h3>${esc(H.short)} – Beste Noten</h3>${rated('home')}</div><div class="card"><h3>${esc(A.short)} – Beste Noten</h3>${rated('away')}</div></div>
      <div class="row-actions center"><button class="btn primary lg" id="cont">Weiter</button></div></div>`;
    el.querySelector('#cont').onclick = () => commitResult(app, { r, H, A, friendly: false });
  }

  return () => { clearTimeout(timer); window.removeEventListener('message', onMsg); frame?.remove(); };
}
