import { IS_MOBILE } from '../../core/device.js';
import { prefetchCrowd } from '../../render/audio.js';
// Matchday: pre-match, live 3D match with HUD (speed, cameras, subs, tactics, stats), instant sim, report.
import { recordLive } from '../../manager/analysisHub.js';
import { taskEvent } from '../../manager/progress.js';
import { MatchEngine } from '../../match/engine.js';
import { endWeek } from '../turn.js';
import { wmCommit } from './wm.js';
import { tourneyCommit } from './tourney.js';
import { unityMatch, unrealMatch } from './unityMatch.js';
import { ensureLineup, teamStrength, FORMATIONS, PRESETS, effectiveRating } from '../../match/tactics.js';
import { simAheadButton, bindSimAhead } from './simAhead.js';
import { pressQuestions, applyPressAnswer, postPressQuestions } from '../../manager/events.js';
import { autoPress } from '../../manager/staff.js';
import { Commentator } from '../../match/commentary.js';
import { opponentReport, suggestTactic, TACTIC_LABEL } from '../../manager/analysis.js';
import { TALKS, talkHint, holdTalk, reactionText } from '../../manager/teamtalk.js';
import { userCupFixture, resolveCupFixture, cupById } from '../../manager/cups.js';
import { isDirector, ensureCoach, coachDecides } from '../../manager/director.js';

export const currentFixture = (w) => userCupFixture(w) || userFixture(w);
const cupLabel = (w, fx) => { const c = cupById(w, fx.cup); const rd = c.rounds[fx.round]; if (fx.group) return `${c.name} · Gruppe ${fx.group} · ${fx.md}. Spieltag`; return `${c.name} · ${rd.name}${rd.weeks.length > 1 ? (fx.leg === 0 ? ' · Hinspiel' : ' · Rückspiel') : ''}`; };
import { userFixture, applyMatchResult, finishWeek, newRng, userLeague, isUserSeasonOver, quickSim, computeTable } from '../../manager/season.js';
import { MatchView } from '../../render/matchView.js';
import { CAMERA_MODES } from '../../render/camera.js';
import { isMatchToday, daysToMatch, nextUserMatchDay, dateOf, fmtDate } from '../../manager/calendar.js';
import { aiEdge } from '../../manager/difficulty.js';
import { recordFriendly } from '../../manager/preseason.js';
import { derbyName, choreoActive, headToHead } from '../../manager/derby.js';
import { refFor, REF_STYLE } from '../../manager/referees.js';
import { canKonferenz } from './konferenz.js';
import { conditions, WEATHER_NAME, TOD_NAME, renderWeather, matchFactors, ensurePitch, pitchLabel } from '../../manager/weather.js';
import { crest, esc, shortName, ratingClass, toast, bar, flag, modal, portrait } from '../dom.js';

export { conditions, WEATHER_NAME } from '../../manager/weather.js';
const isBigMatch = (w, fx) => !!fx.cup || (w.clubs[fx.h].rep + w.clubs[fx.a].rep > 164);

function lineupList(w, club) {
  const L = club.lineup; const slots = FORMATIONS[L.formation];
  return `<ol class="lineup">${L.xi.map((id, i) => { const p = w.players[id]; return `<li><span class="pos">${slots[i][0]}</span><span class="nm">${flag(p.nation)}<span>${esc(shortName(p))}</span></span><b class="${ratingClass(effectiveRating(p, slots[i][0]))}">${effectiveRating(p, slots[i][0])}</b></li>`; }).join('')}</ol>
    <p class="muted">Bank: ${L.bench.map((id) => esc(w.players[id].lastName)).join(', ')}</p>`;
}

export function matchdayScreen(app, el, params = {}) {
  if ((app.settings.volume ?? 0.6) > 0) prefetchCrowd();
  if (params.live) return liveMatch(app, el, params);
  const w = app.world;
  if (isUserSeasonOver(w) && !userCupFixture(w)) { app.go('seasonEnd'); return; }
  if (isDirector(w)) { ensureCoach(w, newRng(w)); coachDecides(w); }
  w.day ??= 0;
  if (!isMatchToday(w)) { // v3.0.2: the matchday opens only on the day of the match – until then the calendar runs
    const fx0 = currentFixture(w), d = daysToMatch(w), opp = fx0 && w.clubs[fx0.h === w.userClubId ? fx0.a : fx0.h];
    el.innerHTML = `<div class="page"><div class="card md-gate">
      <small class="muted">HEUTE · ${esc(fmtDate(dateOf(w), true))}</small>
      ${fx0 && d != null ? `<div class="cal-vs">${crest(w.clubs[w.userClubId], 54)}<b>VS</b>${crest(opp, 54)}</div>
        <h3>Noch ${d} Tag${d === 1 ? '' : 'e'} bis zum Spiel</h3><p class="muted">${fx0.h === w.userClubId ? 'Heimspiel' : 'Auswärtsspiel'} gegen <b>${esc(opp.name)}</b> am ${esc(fmtDate(dateOf(w, w.week, nextUserMatchDay(w)), true))}</p>`
        : '<h3>Diese Woche spielfrei</h3><p class="muted">Lass die Tage im Kalender laufen – die Welt spielt im Hintergrund weiter.</p>'}
      <div class="row-actions center"><button class="btn primary lg" id="gate-run">⏭ ${fx0 ? 'Bis zum Spieltag' : 'Woche durchlaufen'}</button><button class="btn lg" id="gate-cal">📅 Kalender</button></div></div></div>`;
    el.querySelector('#gate-cal').onclick = () => app.go('calendar');
    el.querySelector('#gate-run').onclick = () => { (app.cal ||= { auto: false, speed: 1, month: null, log: [] }).runToMatch = true; app.go('calendar'); };
    return;
  }
  const fx = currentFixture(w);
  if (!fx) {
    el.innerHTML = `<div class="page"><div class="card"><h3>Spielfrei</h3><button class="btn primary" id="sim">Spieltag simulieren</button></div>${simAheadButton()}</div>`;
    bindSimAhead(app, el);
    el.querySelector('#sim').onclick = () => endWeek(app, 'home');
    return;
  }
  const H = w.clubs[fx.h], A = w.clubs[fx.a];
  ensureLineup(H, w.players); ensureLineup(A, w.players);
  const L = userLeague(w);
  const cond = conditions(w, fx);
  const sH = teamStrength(H, w.players), sA = teamStrength(A, w.players);
  const pressByStaff = autoPress(w);
  const coachChip = (C) => { const c = C.id === w.userClubId ? (isDirector(w) ? w.coach : null) : C.ai?.coach; return c ? `<span class="chip" title="Cheftrainer">👔 ${esc(c.name)} ${'★'.repeat(c.quality)}</span>` : ''; };
  el.innerHTML = `<div class="page">
    <div class="vs-screen" style="--h1:${H.colors.primary};--a1:${A.colors.primary}">
      <div class="side">${crest(H, 110)}<h3>${esc(H.name)}</h3><div class="chips"><span class="chip">${H.tactic.formation}</span><span class="chip">${esc(H.tactic.preset || 'Individuell')}</span><span class="chip">Stärke ${Math.round(sH)}</span>${coachChip(H)}</div></div>
      <div class="mid"><small>${fx.cup ? `🏆 ${esc(cupLabel(w, fx))}` : `${esc(L.name)} · Spieltag ${w.week + 1}`}</small><b>VS</b><small>${esc(H.stadium.name)} · ${H.stadium.capacity.toLocaleString('de-DE')}</small>
        <div class="chips"><span class="chip">${TOD_NAME[cond.tod]}</span><span class="chip">${WEATHER_NAME[cond.weather]}${cond.temp != null ? ` · ${cond.temp} °C` : ''}</span><span class="chip" title="Rasenzustand im Heimstadion">🌱 Rasen: ${pitchLabel(ensurePitch(H).q)}</span>${matchFactors(w, fx).postpone ? '<span class="chip hot">⚠️ Platz gefroren – Absage droht</span>' : ''}<span class="chip" title="Schiedsrichter">🟨 ${esc(refFor(w, fx).name)} · ${esc(REF_STYLE(refFor(w, fx)))}</span>${derbyName(w, fx.h, fx.a) ? `<span class="chip hot">🔥 ${esc(derbyName(w, fx.h, fx.a))}</span>` : isBigMatch(w, fx) ? '<span class="chip">🔥 Topspiel</span>' : ''}</div></div>
      <div class="side">${crest(A, 110)}<h3>${esc(A.name)}</h3><div class="chips"><span class="chip">${A.tactic.formation}</span><span class="chip">${esc(A.tactic.preset || 'Individuell')}</span><span class="chip">Stärke ${Math.round(sA)}</span>${coachChip(A)}</div></div>
    </div>
    <div class="str-bars" style="grid-template-columns:${sH}fr ${sA}fr"><div style="background:${H.colors.primary}"></div><div style="background:${A.colors.primary}"></div></div>
    ${(() => { const dn = derbyName(w, fx.h, fx.a); if (!dn) return ''; const hh = headToHead(w, w.userClubId, w.userClubId === H.id ? A.id : H.id); const ch = choreoActive(w, H, A, { big: true }); return `<p class="derby-line">🔥 <b>${esc(dn)}</b> · Derby-Bilanz: ${hh.games ? `${hh.w} S · ${hh.d} U · ${hh.l} N (${hh.gf}:${hh.ga})` : 'noch kein Duell'}${H.id === w.userClubId ? (ch ? ' · 🎨 Deine Kurve zeigt eine Choreo' : ' · Tipp: Gestalte unter Stadion → Fankurve eine Choreo') : ''}</p>`; })()}
    <div class="row-actions center">
      <button class="btn primary lg" id="play3d">▶ Live im 3D-Stadion</button>
      <button class="btn lg" id="instant">⏭ Sofortsimulation</button>${!fx.cup && canKonferenz(w) ? '<button class="btn lg" id="konf">📻 Konferenz</button>' : ''}
      <button class="btn lg ghost" id="tac">${isDirector(w) ? `👔 Aufstellung von ${esc(w.coach?.name || 'Trainer')}` : '📋 Taktik & Aufstellung'}</button>
      <button class="btn lg ghost" id="scoutopp">🔎 Gegneranalyse</button>
      <button class="btn lg ghost" id="talk" ${talkDone(w) || isDirector(w) ? 'disabled' : ''}>🗣️ Kabinenansprache${talkDone(w) ? ' ✓' : ''}</button>
      <button class="btn lg ghost" id="press" ${w.pressWeek === w.week ? 'disabled' : ''}>🎤 Pressekonferenz${pressByStaff ? ' (Co-Trainer) ✓' : w.pressWeek === w.week ? ' ✓' : ''}</button>
    </div>
    <div class="grid-2"><div class="card"><h3>${esc(H.short)} – Startelf</h3>${lineupList(w, H)}</div><div class="card"><h3>${esc(A.short)} – Startelf</h3>${lineupList(w, A)}</div></div>
    ${simAheadButton()}
  </div>`;
  bindSimAhead(app, el);
  el.querySelector('#play3d').onclick = () => app.go('match', { mode: IS_MOBILE ? '3d' : app.settings.engine3d === 'unity' ? 'unity' : app.settings.engine3d === 'unreal' && window.bakusa?.unrealPlay ? 'unreal' : '3d' });
  el.querySelector('#instant').onclick = () => app.go('match', { mode: 'instant' });
  el.querySelector('#konf')?.addEventListener('click', () => app.go('konferenz'));
  el.querySelector('#tac').onclick = () => app.go('tactics');
  el.querySelector('#scoutopp').onclick = () => {
    const oppId = fx.h === w.userClubId ? fx.a : fx.h;
    const R = opponentReport(w, oppId);
    const SG = suggestTactic(w, R);
    const M = modal(`<h3>🔎 Gegneranalyse: ${crest(R.club, 26)} ${esc(R.club.name)}</h3>
      <p class="muted">Bericht deines Co-Trainers (${'★'.repeat(R.quality)}) – bessere Co-Trainer liefern mehr Details.</p>
      <div class="kv"><span>System · Spielstil</span><b>${esc(R.formation)} · ${esc(R.preset)}</b></div>
      ${R.coach ? `<div class="kv"><span>Trainer</span><b>${esc(R.coach.name)} ${'★'.repeat(R.coach.quality)}</b></div>` : ''}
      <div class="kv"><span>Stärke (wir / die)</span><b>${R.mine} / ${R.strength}</b></div>
      ${R.rank ? `<div class="kv"><span>Tabellenplatz</span><b>${R.rank}.${R.form ? ` · Form ${R.form.join(' ')}` : ''}</b></div>` : ''}
      <div class="kv"><span>Mannschaftsteile</span><b>${Object.entries(R.avg).map(([k, v]) => `${k} ${v}`).join(' · ')}</b></div>
      <p>Stärkster Mannschaftsteil: <b>${esc(R.strongest || '–')}</b>, schwächster: <b>${esc(R.weakest || '–')}</b>.${R.style.length ? ` Der Gegner ${esc(R.style.join(', '))}.` : ''}</p>
      ${R.danger ? `<p>⚠️ Gefährlichster Spieler: <b>${esc(R.danger.firstName)} ${esc(R.danger.lastName)}</b> (${R.danger.pos}, ${R.danger.ovr}, ${R.danger.stats.goals} Tore / ${R.danger.stats.assists} Vorlagen)</p>` : ''}
      <h4>Empfehlungen</h4>${R.tips.map((t) => `<p>• ${esc(t)}</p>`).join('') || '<p class="muted">Keine besonderen Auffälligkeiten.</p>'}
      ${Object.keys(SG.changes).length ? `<h4>📋 Taktik-Vorschlag</h4><p class="small">${SG.why.map(esc).join(' · ')}</p><p class="small">${Object.entries(SG.changes).map(([k, v]) => `${TACTIC_LABEL[k]}: <b>${Math.round((w.clubs[w.userClubId].tactic[k] ?? 0.5) * 100)} → ${Math.round(v * 100)}</b>`).join(' · ')}</p>` : ''}
      <div class="row-actions end">${Object.keys(SG.changes).length && !isDirector(w) ? '<button class="btn" id="sg-apply">✅ Vorschlag übernehmen</button>' : ''}<button class="btn primary" onclick="this.closest('.modal-wrap').remove(); window.ufm.go('tactics')">Zur Taktik</button></div>`);
    M.el.querySelector('#sg-apply')?.addEventListener('click', () => { const me = w.clubs[w.userClubId]; me.tactic = { ...me.tactic, ...SG.changes, preset: 'Individuell' }; app.autosave?.(); toast('Taktik angepasst'); M.close(); });
  };
  el.querySelector('#talk').onclick = () => {
    const me = app.club, opp = me.id === H.id ? A : H;
    const xi = me.lineup.xi.map((id) => w.players[id]).filter(Boolean);
    const ctx = { diff: teamStrength(me, w.players) - teamStrength(opp, w.players) + (me.id === H.id ? 1.5 : -1.5), form: me.formRun > 0 ? 1 : me.formRun < 0 ? -1 : 0, rep: w.career?.rep ?? 50 };
    talkModal(w, ctx, xi, false, (res) => { w.talk = { season: w.season, week: w.week, key: res.key, focus: res.focus, reaction: res.reaction }; app.autosave?.(); app.go('matchday'); });
  };
  el.querySelector('#press').onclick = () => {
    const club = app.club, opp = club.id === H.id ? A : H;
    const form = club.formRun > 0 ? 'S' : club.formRun < 0 ? 'N' : null;
    const qs = pressQuestions(w, club, opp, form, newRng(w));
    let i = 0;
    const m = modal('<div id="pc"></div>');
    const step = () => {
      const host = m.el.querySelector('#pc');
      if (i >= qs.length) { w.pressWeek = w.week; host.innerHTML = '<h3>🎤 Pressekonferenz beendet</h3><p>Die Medien werten deine Aussagen aus. Stimmung von Team, Vorstand und Fans wurde angepasst.</p>'; setTimeout(() => { m.close(); app.go('matchday'); }, 1400); return; }
      const q = qs[i];
      host.innerHTML = `<h3>🎤 Pressekonferenz · Frage ${i + 1}/${qs.length}</h3><p class="pc-q">„${esc(q.q)}“</p><div class="sim-opts">${q.a.map(([t], k) => `<button class="btn" data-a="${k}">${esc(t)}</button>`).join('')}</div>`;
      host.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => { applyPressAnswer(w, club, q, q.a[+b.dataset.a][1]); i++; step(); }));
    };
    step();
  };
}

function liveMatch(app, el, params) {
  if (params.mode === 'unity' && !params.friendly) return unityMatch(app, el, params);
  if (params.mode === 'unreal' && !params.friendly) return unrealMatch(app, el, params);
  const w = app.world, S = app.settings;
  const friendly = !!params.friendly;
  const fx = friendly ? { h: params.home, a: params.away } : currentFixture(w);
  const H = w.clubs[fx.h], A = w.clubs[fx.a];
  ensureLineup(H, w.players); ensureLineup(A, w.players);
  const director = !friendly && isDirector(w);
  const userTeam = params.scene ? (params.scene.side === 'a' ? 1 : 0) : director ? -1 : H.id === w.userClubId ? 0 : A.id === w.userClubId ? 1 : -1;
  const engine = new MatchEngine({ home: H, away: A, db: w.players, homeLineup: H.lineup, awayLineup: A.lineup, userTeam, autoSubsUser: director || S.autoSubs !== false });
  const T0 = engine.teams[0], T1 = engine.teams[1];
  const cond0 = friendly ? null : conditions(w, fx);
  engine.weather = cond0?.weather || 'klar';
  engine.weatherNoise = { regen: 1.12, schnee: 1.22, nebel: 1.06, sturm: 1.15 }[engine.weather] || 1;
  engine.refStrict = friendly ? 1 : refFor(w, fx).strict; // v7.0 referee character
  const derby = !friendly ? derbyName(w, H.id, A.id) : null;
  engine.bigMatch = !friendly && (isBigMatch(w, fx) || !!derby);
  engine.derby = derby;
  engine.choreo = !friendly && !params.wm ? choreoActive(w, H, A, { big: engine.bigMatch }) : null;
  // match preparation from the training week and team spirit (v2.0)
  for (const T of engine.teams) { const c = T.club; if (c.matchPrep?.week === w.week) T.familiarity = Math.min(1, (T.familiarity ?? 0.8) + c.matchPrep.prep * 0.05); if (c.spirit != null) T.familiarity = Math.min(1, Math.max(0.4, (T.familiarity ?? 0.8) + (c.spirit - 60) / 400)); }
  if (!friendly && userTeam >= 0 && talkDone(w)) engine.setFocus(userTeam, w.talk.focus);
  if (!friendly && userTeam >= 0 && w.difficulty && w.difficulty !== 'normal') { const T = engine.teams[1 - userTeam]; T.familiarity = Math.max(0.45, Math.min(1, (T.familiarity ?? 0.8) + aiEdge(w, false) * 0.025)); } // v5.2
  let htTalk = false;
  // v5.2 editor: match scene with preset score and minute
  const scene = params.scene;
  if (scene) {
    engine.teams[0].score = scene.hg | 0; engine.teams[1].score = scene.ag | 0;
    const min = Math.max(1, Math.min(89, scene.minute | 0));
    if (min > 45) { engine.half = 2; htTalk = true; }
    engine.time = (min - 1) * 60;
    for (const T of engine.teams) for (const p of T.players) p.energy = Math.max(0.55, 1 - (min / 90) * 0.32);
    if (min > 45) engine.startKickoff?.(1 - (engine.firstKickoff ?? 0), true);
  }
  engine.pyro = S.pyro || 'normal';
  engine.manualSP = S.manualSP !== false && !director; // v6.0
  if (S.var === false) engine.varRate = 0;
  // Konferenz: the other matches of this matchday are decided now and revealed minute by minute
  const others = [];
  if (!friendly && !fx.cup) {
    const md = userLeague(w).fixtures[w.week] || [];
    const rngO = newRng(w);
    for (const m of md) { if (m === fx || m.hg != null) continue; ensureLineup(w.clubs[m.h], w.players); ensureLineup(w.clubs[m.a], w.players); quickSim(w, m, rngO); others.push(m); }
  }
  let lastConfGoals = 0;
  let view = null, finished = false, speed = S.speed || 1, instantRunning = false;
  const chip = (T) => `<span class="sb-team" style="--c1:${T.kit.primary};--c2:${T.kit.secondary}"><i></i>${esc(T.club.short)}</span>`;
  el.innerHTML = `<div class="match">
    <div class="stage" id="stage"></div>
    <div class="cmd-banner" id="cmd"><i></i><div><b></b><small></small></div></div><div class="shout-chip" id="shchip"></div>
    <div class="hud-top">
      <div class="scoreboard"><span class="live">● LIVE</span>${chip(T0)}<b id="sc">0 : 0</b>${chip(T1)}<span class="clock" id="clk">00:00</span></div>
      <div class="hud-right"><span id="fps" class="fps">– FPS</span><button class="btn icon" id="fs" title="Vollbild">⛶</button></div>
    </div>
    <div class="goal-banner" id="banner"></div>
    <div class="lower-third" id="lt"></div>
    <div class="comm" id="comm"><i>🎙️</i><span></span></div>
    <div class="replay-tag" id="replay"><span>⟲ WIEDERHOLUNG</span><button class="btn sm" id="skipRep">Überspringen ⏭</button></div>
    <div class="intro" id="intro"><div class="bar-top"><small>Live · ${esc(H.stadium.name)}</small><b>${esc(H.name)} – ${esc(A.name)}</b><small style="color:#cfe0ff;letter-spacing:.1em">${params.wm ? 'FIFA WM 2026' : params.tourney ? esc(w.tourney?.name || 'Turnier') : friendly ? 'Testspiel' : derby ? `🔥 ${esc(derby)} · ${esc(w.leagues.find((l) => l.id === H.leagueId).name)}` : `${esc(w.leagues.find((l) => l.id === H.leagueId).name)} · Spieltag ${w.week + 1}`}</small></div>
      <div class="lineups">${[T0, T1].map((T) => `<div class="lu" style="--c1:${T.kit.primary}"><b>${esc(T.club.short)} · ${T.formation}</b>${T.players.map((p) => `${p.data.number} ${esc(p.data.lastName)}`).join('<br>')}</div>`).join('')}</div>
      <button class="btn primary skip" id="skipIntro">Anpfiff ▶</button></div>
    <div class="ticker" id="ticker"></div>
    <div class="sel-chip" id="selchip"></div>
    <div class="hud-bottom">
      <div class="ctrl-group">
        <button class="btn icon" id="pause" title="Pause">⏸</button>
        ${[1, 2, 4, 8].map((s) => `<button class="btn sm sp" data-sp="${s}">${s}x</button>`).join('')}
        <button class="btn sm sp" data-sp="highlights">Highlights</button>
        <button class="btn sm" id="instant" title="Rest sofort simulieren">⏭ Sofort</button>
      </div>
      <div class="ctrl-group">
        <select id="cam">${CAMERA_MODES.map(([v, l]) => `<option value="${v}">${l}-Kamera</option>`).join('')}</select>
        <button class="btn sm" data-panel="cam">🎥</button>
        <button class="btn sm" data-panel="stats">Statistik</button>
        <button class="btn sm" data-panel="lineups">Teams</button>
        ${others.length ? '<button class="btn sm" data-panel="conf">Konferenz</button>' : ''}
        ${userTeam >= 0 ? '<button class="btn sm" data-panel="shouts">📣 Kommandos</button><button class="btn sm" data-panel="subs">Wechsel</button><button class="btn sm" data-panel="tactic">Taktik</button>' : ''}
      </div>
    </div>
    <div class="panel" id="panel"></div>
    <div class="overlay" id="overlay"></div>
    <div class="aim-ov" id="aim"></div>
  </div>`;
  const $ = (s) => el.querySelector(s);
  const camSel = $('#cam'); camSel.value = S.camera || 'tv';
  const markSpeed = () => el.querySelectorAll('.sp').forEach((b) => b.classList.toggle('active', String(b.dataset.sp) === String(speed)));
  markSpeed();
  let panel = null;
  let hudT = 0;
  let lastTick = performance.now();
  const update = (v) => {
    if (userTeam >= 0 && (v.frameCount & 15) === 0) { const U = engine.teams[userTeam], sh = U.shout, c = $('#shchip'); if (c) { const on = sh && sh.until > engine.simTime; c.classList.toggle('show', !!on); if (on) c.textContent = `📣 ${({ druck: 'Mehr Druck', ruhe: 'Ruhig bleiben', pressing: 'Pressing', dicht: 'Hinten dicht', fluegel: 'Über die Flügel', konter: 'Konter' })[sh.key] || sh.key} · noch ${Math.max(1, Math.ceil((sh.until - engine.simTime) / 60))}'`; } }
    { const now = performance.now(); if (!view?.replay && !view?.paused) say(commentator.tick((now - lastTick) / 1000 * (typeof speed === 'number' ? speed : 4))); lastTick = now; }
    hudT += 1;
    if (hudT % 6 !== 0) return;
    $('#sc').textContent = `${T0.score} : ${T1.score}`;
    $('#clk').textContent = engine.clockText();
    if (S.fps !== false) $('#fps').textContent = `${v.fps} FPS`; else $('#fps').style.display = 'none';
    const s = view.rig.selected;
    const sc = $('#selchip');
    if (s && !s.offPitch) { sc.style.display = 'flex'; sc.innerHTML = `<b>#${s.data.number} ${esc(s.data.lastName)}</b><small>${s.role} · Kondition</small>${bar(s.energy * 100, 100, s.energy < 0.6 ? 'warn' : '')}`; }
    else sc.style.display = 'none';
    if (panel === 'stats' || panel === 'lineups' || panel === 'conf' || panel === 'shouts') renderPanel();
    if (others.length) {
      const min = engine.minute();
      const now = others.reduce((sum, m) => sum + (m.goals || []).filter((g) => g.min <= min).length, 0);
      if (now > lastConfGoals) {
        for (const m of others) for (const g of (m.goals || []).filter((x) => x.min <= min)) {
          if (g.shown) continue; g.shown = true;
          const sc = w.clubs[g.side === 'h' ? m.h : m.a];
          const [hg, ag] = confScore(m, min);
          if (S.confToasts !== false) toast(`⚽ Konferenz ${g.min}': Tor für ${sc.short}! ${w.clubs[m.h].short} ${hg}:${ag} ${w.clubs[m.a].short}`, 3500);
        }
        lastConfGoals = now;
      }
    }
  };
  const startView = () => {
    const cond = friendly ? { tod: ['nacht', 'abend', 'tag'][Math.floor(Math.random() * 3)], weather: ['klar', 'klar', 'regen', 'schnee', 'nebel'][Math.floor(Math.random() * 5)] } : cond0;
    engine.weather = cond.weather; engine.weatherNoise = { regen: 1.12, schnee: 1.22, nebel: 1.06, sturm: 1.15 }[cond.weather] || 1;
    view = new MatchView($('#stage'), engine, { quality: S.quality, speed, camera: camSel.value, onFrame: update, tod: cond.tod, weather: S.weatherFx === false ? 'klar' : renderWeather(cond.weather), replays: S.replays !== false,
      audio: { volume: S.volume ?? 0.6, announcer: S.announcer === true, commentary: !!S.commentary, crowd: S.crowd ?? 1, chants: S.chants !== false },
      onReplay: (on, label) => { $('#replay')?.classList.toggle('show', on); const sp = $('#replay span'); if (sp) sp.textContent = `⟲ WIEDERHOLUNG${label ? ` · ${label}` : ''}`; } });
    $('#intro').classList.add('show');
    const endIntro = () => { view.skipIntro(); $('#intro')?.classList.remove('show'); };
    $('#skipIntro').onclick = endIntro;
    $('#skipRep').onclick = () => view.stopReplay();
    const iv = setInterval(() => { if (!view || !view.intro) { clearInterval(iv); $('#intro')?.classList.remove('show'); } }, 250);
    window.ufmView = view;
    view.renderer.domElement.addEventListener('click', (e) => {
      const p = view.pickPlayer(e.clientX, e.clientY);
      view.rig.selected = p && view.rig.selected !== p ? p : null;
    });
  };
  const ticker = (e) => {
    const icons = { goal: '⚽', yellow: '🟨', red: '🟥', sub: '🔁', injury: '🩹', save: '🧤', penalty: '❗', offside: '🚩', halftime: '⏱', fulltime: '🏁', kickoff2: '▶', miss: '↗', coach: '📋', var: '📺', nogoal: '❌' };
    if (!icons[e.type]) return;
    const t = $('#ticker');
    const d = document.createElement('div');
    d.className = `tk tk-${e.type}`;
    d.innerHTML = `<small>${e.minuteText || ''}</small> ${icons[e.type]} ${esc(e.text)}`;
    t.prepend(d);
    while (t.children.length > 5) t.lastChild.remove();
    setTimeout(() => d.classList.add('fade'), 9000);
  };
  let ltTimer = null;
  const lowerThird = (e) => {
    const T = engine.teams[e.team]; const p = T?.players.find((q) => q.id === e.player);
    const lt = $('#lt'); if (!lt || !p) return;
    const label = { goal: 'TOR', yellow: 'Gelbe Karte', red: 'Rote Karte', sub: 'Eingewechselt', injury: 'Verletzt', save: 'Parade' }[e.type];
    if (!label) return;
    lt.style.setProperty('--c1', T.kit.primary); lt.style.setProperty('--c2', T.kit.secondary);
    const extra = e.type === 'goal' ? ` · ${p.data.stats.goals + p.stats.goals}. Saisontor` : e.type === 'save' ? ` · ${p.stats.saves || 1}. Parade heute` : '';
    lt.innerHTML = `<div class="ltp">${portrait(p.data, T.club, 46)}</div><div class="num">${p.data.number}</div><div class="txt"><b>${esc(p.data.firstName)} ${esc(p.data.lastName)}</b><small>${label} · ${esc(T.club.short)} · ${e.minuteText}${extra}</small></div>`;
    lt.classList.add('show'); clearTimeout(ltTimer); ltTimer = setTimeout(() => lt.classList.remove('show'), 4200);
  };
  const commentator = new Commentator(engine);
  let commTimer = null;
  const say = (line) => {
    if (!line || instantRunning || S.commBar === false) return;
    const c = $('#comm'); if (!c) return;
    c.querySelector('span').textContent = line; c.classList.add('show');
    clearTimeout(commTimer); commTimer = setTimeout(() => c.classList.remove('show'), 5200);
    view?.audio?.comment(line);
  };
  engine.on((e) => {
    ticker(e);
    say(commentator.onEvent(e));
    if (!instantRunning && S.lowerThirds !== false) lowerThird(e);
    if (e.type === 'goal') {
      const b = $('#banner');
      if (!b) return;
      const T = engine.teams[e.team];
      b.innerHTML = `<div style="--c1:${T.kit.primary}"><b>TOR!</b><span>${esc(T.club.name)}</span><small>${esc(e.text.replace(/^TOR für [^!]+! /, ''))} · ${T0.score}:${T1.score}</small></div>`;
      b.classList.add('show'); setTimeout(() => b.classList.remove('show'), 3800);
    }
    if (e.type === 'var' && (e.overturned || e.confirmed)) {
      const b = $('#banner');
      if (b) { b.innerHTML = `<div style="--c1:${e.overturned ? '#ff4d4d' : '#3ddc84'}"><b>${e.overturned ? 'KEIN TOR' : 'TOR ZÄHLT'}</b><span>Videobeweis</span><small>${esc(e.text.replace(/^[^ ]+ /, ''))}</small></div>`; b.classList.add('show'); setTimeout(() => b.classList.remove('show'), 3400); }
    }
    if (e.type === 'aim') { if (!view || instantRunning) engine.setAim(null); else showAim(e.kind); }
    if (e.type === 'halftime') setTimeout(() => showBreak(false), 50);
    if (e.type === 'fulltime') setTimeout(() => showBreak(true), 50);
  });

  let statTab = 'overview';
  const pitchSvg = (inner) => `<svg viewBox="-2 -2 124 84" class="an-pitch"><rect x="0" y="0" width="120" height="80" rx="2" fill="#1f5a2c"/>
    <g fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".5"><rect x="0" y="0" width="120" height="80"/><line x1="60" y1="0" x2="60" y2="80"/><circle cx="60" cy="40" r="10"/>
    <rect x="0" y="18" width="18" height="44"/><rect x="102" y="18" width="18" height="44"/><rect x="0" y="30" width="6" height="20"/><rect x="114" y="30" width="6" height="20"/></g>${inner}
    <text x="118" y="78" text-anchor="end" font-size="3.2" fill="rgba(255,255,255,.7)">Angriffsrichtung →</text></svg>`;
  const px = (x) => ((x + 52.5) / 105) * 120, pz = (z) => ((z + 34) / 68) * 80;
  const analysisHtml = (T) => {
    const A = T.analysis;
    if (statTab === 'heat') {
      const max = Math.max(1, ...A.heat);
      return pitchSvg(A.heat.map((v, i) => `<rect x="${(i % 12) * 10}" y="${Math.floor(i / 12) * 10}" width="10" height="10" fill="${T.kit.primary}" opacity="${(v / max * 0.85).toFixed(2)}"/>`).join(''));
    }
    if (statTab === 'net') {
      const P = A.pos, links = Object.entries(A.links).map(([k, n]) => { const [a, b] = k.split('>'); return { a: P[a], b: P[b], n }; }).filter((l) => l.a && l.b && l.n >= 2);
      const maxN = Math.max(1, ...links.map((l) => l.n));
      const ln = links.map((l) => `<line x1="${px(l.a.x / l.a.n)}" y1="${pz(l.a.z / l.a.n)}" x2="${px(l.b.x / l.b.n)}" y2="${pz(l.b.z / l.b.n)}" stroke="#fff" stroke-opacity="${(0.15 + 0.7 * l.n / maxN).toFixed(2)}" stroke-width="${(0.3 + 1.6 * l.n / maxN).toFixed(2)}"/>`).join('');
      const dots = Object.values(P).map((s) => `<g><circle cx="${px(s.x / s.n)}" cy="${pz(s.z / s.n)}" r="3.2" fill="${T.kit.primary}" stroke="${T.kit.secondary}" stroke-width=".6"/><text x="${px(s.x / s.n)}" y="${pz(s.z / s.n) + 1.2}" text-anchor="middle" font-size="3" font-weight="700" fill="${T.kit.secondary}">${s.num}</text><text x="${px(s.x / s.n)}" y="${pz(s.z / s.n) + 6.5}" text-anchor="middle" font-size="2.6" fill="#fff">${esc(s.name)}</text></g>`).join('');
      return pitchSvg(ln + dots);
    }
    if (statTab === 'shots') {
      return pitchSvg(A.shots.map((sh) => `<circle cx="${px(sh.x)}" cy="${pz(sh.z)}" r="${(1.2 + sh.xg * 6).toFixed(1)}" fill="${sh.goal ? '#ffd24a' : T.kit.primary}" fill-opacity="${sh.goal ? 0.95 : 0.6}" stroke="#fff" stroke-width=".4"><title>${esc(sh.name)} ${sh.min}' · xG ${sh.xg.toFixed(2)}${sh.goal ? ' · TOR' : ''}</title></circle>`).join(''))
        + `<p class="muted">${A.shots.length} Schüsse · xG ${A.shots.reduce((s, x) => s + x.xg, 0).toFixed(2)} · gelb = Tor · Kreisgröße = Torchance (xG)</p>`;
    }
    return '';
  };
  const statsHtml = () => {
    const tabs = `<div class="tabs small wrap">${[['overview', 'Übersicht'], ['heat', 'Heatmap'], ['net', 'Positionen & Passnetz'], ['shots', 'Schusskarte']].map(([k, l]) => `<button data-stab="${k}" class="${statTab === k ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    if (statTab !== 'overview') return `<h3>Live-Analyse</h3>${tabs}<div class="an-grid">${[T0, T1].map((T) => `<div><h4>${esc(T.club.short)}</h4>${analysisHtml(T)}</div>`).join('')}</div>`;
    const r = engine.result().stats;
    const row = (l, a, b, pct = false) => { const t = (a + b) || 1; return `<div class="st-row"><b>${a}${pct ? '%' : ''}</b><div><span>${l}</span><div class="st-bar"><i style="width:${(a / t) * 100}%"></i></div></div><b>${b}${pct ? '%' : ''}</b></div>`; };
    return `<h3>Statistik</h3>${tabs}${row('Ballbesitz', r[0].possession, r[1].possession, true)}${row('Schüsse', r[0].shots, r[1].shots)}${row('Aufs Tor', r[0].onTarget, r[1].onTarget)}
      ${row('xG', +r[0].xg.toFixed(2), +r[1].xg.toFixed(2))}${row('Pässe', r[0].passes, r[1].passes)}${row('Angekommen', r[0].passesOk, r[1].passesOk)}${row('Zweikämpfe gew.', r[0].tackles, r[1].tackles)}
      ${row('Fouls', r[0].fouls, r[1].fouls)}${row('Ecken', r[0].corners, r[1].corners)}${row('Abseits', r[0].offsides, r[1].offsides)}${row('Gelb', r[0].yellow, r[1].yellow)}${row('Rot', r[0].red, r[1].red)}${row('Paraden', r[0].saves, r[1].saves)}`;
  };
  const teamHtml = (T) => `<div class="pl-team"><h4>${esc(T.club.short)} · ${T.formation}</h4>${T.players.filter((p) => !p.offPitch).map((p) => `<div class="pl-row ${p.leaving ? 'off' : ''}" data-sel="${p.team}-${p.id}"><span class="pos">${p.role}</span><span class="nm">${esc(p.data.lastName)}${p.yellow ? ' 🟨' : ''}${p.sentOff ? ' 🟥' : ''}${p.injured ? ' 🩹' : ''}</span>${bar(p.energy * 100, 100, p.energy < 0.6 ? 'warn' : '')}<b>${p.rating.toFixed(1)}</b></div>`).join('')}</div>`;
  const confScore = (m, min) => { const gs = (m.goals || []).filter((g) => g.min <= min); return [gs.filter((g) => g.side === 'h').length, gs.filter((g) => g.side === 'a').length]; };
  const confHtml = () => {
    const min = engine.minute(), L = userLeague(w);
    const rows = others.map((m) => { const [hg, ag] = confScore(m, min); return `<div class="conf-row"><span>${crest(w.clubs[m.h], 18)} ${esc(w.clubs[m.h].short)}</span><b>${hg} : ${ag}</b><span>${esc(w.clubs[m.a].short)} ${crest(w.clubs[m.a], 18)}</span></div>`; }).join('');
    // live table with the current scores of this matchday
    const tmp = { clubIds: L.clubIds, fixtures: L.fixtures.map((md, i) => (i !== w.week ? md : md.map((m) => {
      if (m === fx) return { ...m, hg: T0.score, ag: T1.score };
      const [hg, ag] = confScore(m, min); return { ...m, hg, ag };
    }))) };
    const t = computeTable(tmp);
    const me = t.findIndex((r) => r.id === w.userClubId);
    const part = t.slice(Math.max(0, Math.min(me - 3, t.length - 7)), Math.max(7, Math.min(me + 4, t.length)));
    return `<h3>📻 Konferenz · ${min}'</h3><div class="conf">${rows}</div><h4>Live-Tabelle</h4><table class="tbl compact"><tbody>${part.map((r) => `<tr class="${r.id === w.userClubId ? 'me' : ''}"><td>${t.indexOf(r) + 1}</td><td>${crest(w.clubs[r.id], 16)} ${esc(w.clubs[r.id].short)}</td><td>${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table>`;
  };
  let subOut = null;
  const renderPanel = () => {
    const P = $('#panel');
    if (!panel) { P.classList.remove('open'); P.innerHTML = ''; return; }
    P.classList.add('open');
    if (panel === 'stats') P.innerHTML = statsHtml();
    else if (panel === 'conf') P.innerHTML = confHtml();
    else if (panel === 'shouts') {
      const U = engine.teams[userTeam], sh = U.shout;
      const SH = [['druck', '🔥 Mehr Druck!', 'Offensiver, schneller, mehr Risiko'], ['ruhe', '🧘 Ruhig bleiben', 'Ball laufen lassen, Tempo raus'], ['pressing', '⚡ Pressing!', 'Früh anlaufen, Linie hoch'],
        ['dicht', '🧱 Hinten dicht machen', 'Tief und kompakt verteidigen'], ['fluegel', '↔️ Über die Flügel', 'Breit spielen, Flanken'], ['konter', '🏃 Konter!', 'Schnell und direkt nach Ballgewinn']];
      P.innerHTML = `<h3>📣 Kommandos von der Seitenlinie</h3><p class="muted">Ein Kommando wirkt etwa 10 Spielminuten, danach spielt dein Team wieder deine eingestellte Taktik.</p>
        ${sh ? `<p class="tag" style="display:block;padding:.45rem .6rem">Aktiv: <b>${esc(SH.find((x) => x[0] === sh.key)?.[1] || sh.key)}</b> · noch ca. ${Math.max(1, Math.ceil((sh.until - engine.simTime) / 60))} Min.</p>` : ''}
        <div class="shout-grid">${SH.map(([k, l, d]) => `<button class="btn ${sh?.key === k ? 'active' : ''}" data-shout="${k}"><b>${l}</b><small>${d}</small></button>`).join('')}</div>`;
    }
    else if (panel === 'lineups') P.innerHTML = `<h3>Aufstellungen</h3><div class="pl-grid">${teamHtml(T0)}${teamHtml(T1)}</div><p class="muted">Tippe einen Spieler an, um ihm mit der Spielerkamera zu folgen.</p>`;
    else if (panel === 'cam') P.innerHTML = `<h3>Kamera</h3>
      <label class="slider"><span>Zoom</span><div><em>−</em><input type="range" id="c-z" min="50" max="200" value="${Math.round(view.rig.zoom * 100)}"><em>+</em></div></label>
      <label class="slider"><span>Höhe</span><div><em>tief</em><input type="range" id="c-h" min="40" max="200" value="${Math.round(view.rig.height * 100)}"><em>hoch</em></div></label>
      <label class="slider"><span>Kamerageschwindigkeit</span><div><em>weich</em><input type="range" id="c-s" min="30" max="300" value="${Math.round(view.rig.speed * 100)}"><em>schnell</em></div></label>
      <p class="muted">Freie Kamera: ziehen = drehen, zwei Finger/Mausrad = zoomen, rechte Maustaste = verschieben.</p>`;
    else if (panel === 'subs') {
      const U = engine.teams[userTeam];
      P.innerHTML = `<h3>Auswechslungen (${U.subsLeft} übrig)</h3><p class="muted">${subOut ? 'Jetzt Einwechselspieler wählen.' : 'Zuerst den Spieler wählen, der raus soll.'}</p>
        <div class="pl-team">${U.players.filter((p) => !p.offPitch && !p.leaving && !p.sentOff).map((p) => `<button class="pl-row ${subOut === p.id ? 'sel' : ''}" data-out="${p.id}"><span class="pos">${p.role}</span><span class="nm">${esc(p.data.lastName)}${p.injured ? ' 🩹' : ''}</span>${bar(p.energy * 100, 100, p.energy < 0.6 ? 'warn' : '')}<b>${p.rating.toFixed(1)}</b></button>`).join('')}</div>
        <h4>Bank</h4><div class="pl-team">${U.bench.map((id) => w.players[id]).map((p) => `<button class="pl-row" data-in="${p.id}" ${subOut && U.subsLeft > 0 ? '' : 'disabled'}><span class="pos">${p.pos}</span><span class="nm">${esc(p.lastName)}</span><b class="${ratingClass(p.ovr)}">${p.ovr}</b></button>`).join('') || '<p class="muted">Keine Spieler mehr auf der Bank.</p>'}</div>`;
    } else if (panel === 'tactic') {
      const U = engine.teams[userTeam], t = U.tactic;
      P.innerHTML = `<h3>Taktik im Spiel</h3><div class="tabs small wrap">${Object.keys(FORMATIONS).map((f) => `<button data-f="${f}" class="${U.formation === f ? 'active' : ''}">${f}</button>`).join('')}</div>
        <div class="tabs small wrap">${Object.keys(PRESETS).map((p) => `<button data-pr="${p}">${p}</button>`).join('')}</div>
        ${[['mentality', 'Mentalität'], ['pressing', 'Pressing'], ['line', 'Abwehrlinie'], ['tempo', 'Tempo'], ['directness', 'Direktheit']].map(([k, l]) => `<label class="slider"><span>${l}</span><div><input type="range" min="0" max="100" value="${Math.round(t[k] * 100)}" data-tk="${k}"></div></label>`).join('')}
        <p class="muted">Änderungen wirken sofort auf das Verhalten deiner Spieler.</p>`;
    }
    bindPanel();
  };
  // v2.8: clear feedback for every command given from the touchline
  let cmdTimer;
  const cmd = (icon, title, sub = '', kind = 'ok') => {
    const c = $('#cmd'); if (!c) return;
    c.className = `cmd-banner show ${kind}`; c.querySelector('i').textContent = icon; c.querySelector('b').textContent = title; c.querySelector('small').textContent = sub;
    clearTimeout(cmdTimer); cmdTimer = setTimeout(() => c.classList.remove('show'), 2600);
  };
  const bindPanel = () => {
    const P = $('#panel');
    P.querySelector('#c-z')?.addEventListener('input', (e) => (view.rig.zoom = e.target.value / 100));
    P.querySelector('#c-h')?.addEventListener('input', (e) => (view.rig.height = e.target.value / 100));
    P.querySelector('#c-s')?.addEventListener('input', (e) => (view.rig.speed = e.target.value / 100));
    P.querySelectorAll('[data-sel]').forEach((r) => r.addEventListener('click', () => {
      const [t, id] = r.dataset.sel.split('-').map(Number);
      view.rig.selected = engine.teams[t].players.find((p) => p.id === id) || null;
      camSel.value = 'spieler'; view.setCamera('spieler');
    }));
    P.querySelectorAll('[data-stab]').forEach((b) => b.addEventListener('click', () => { statTab = b.dataset.stab; renderPanel(); }));
    P.querySelectorAll('[data-shout]').forEach((b) => b.addEventListener('click', () => { const label = b.querySelector('b')?.textContent || b.dataset.shout; if (engine.shout(userTeam, b.dataset.shout)) { cmd('📣', `Kommando: ${label}`, 'Die Mannschaft setzt es ab sofort um · ca. 10 Minuten'); view?.stadium?.excite?.(0.6); } else cmd('⛔', 'Kommando nicht möglich', 'Bitte gleich noch einmal versuchen', 'err'); renderPanel(); }));
    P.querySelectorAll('[data-out]').forEach((b) => b.addEventListener('click', () => { subOut = +b.dataset.out; renderPanel(); }));
    P.querySelectorAll('[data-in]').forEach((b) => b.addEventListener('click', () => {
      const outP = engine.teams[userTeam].players.find((p) => p.id === subOut), inP = w.players[+b.dataset.in];
      if (engine.substitute(userTeam, subOut, +b.dataset.in)) cmd('🔁', `Wechsel: ${inP?.lastName || ''} für ${outP?.data.lastName || ''}`, `Noch ${engine.teams[userTeam].subsLeft} Wechsel übrig`);
      else cmd('⛔', 'Wechsel nicht möglich', engine.teams[userTeam].subsLeft <= 0 ? 'Keine Wechsel mehr übrig' : 'Spieler nicht verfügbar', 'err');
      subOut = null; renderPanel();
    }));
    const U = engine.teams[userTeam];
    P.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { engine.setTactic(userTeam, { ...U.tactic, formation: b.dataset.f }); cmd('📋', `Neue Formation: ${b.dataset.f}`, 'Die Spieler nehmen ihre neuen Positionen ein'); renderPanel(); }));
    P.querySelectorAll('[data-pr]').forEach((b) => b.addEventListener('click', () => { engine.setTactic(userTeam, { ...U.tactic, ...PRESETS[b.dataset.pr], formation: U.formation }); cmd('🎯', `Spielstil: ${b.dataset.pr}`, 'Gilt ab sofort'); renderPanel(); }));
    P.querySelectorAll('[data-tk]').forEach((i) => i.addEventListener('change', () => { engine.setTactic(userTeam, { ...U.tactic, [i.dataset.tk]: i.value / 100, formation: U.formation }); const lab = i.closest('.slider')?.querySelector('span')?.textContent || ''; cmd('🎚️', `${lab}: ${i.value} %`, 'Taktik angepasst – wirkt sofort'); }));
  };
  el.querySelectorAll('[data-panel]').forEach((b) => b.addEventListener('click', () => { panel = panel === b.dataset.panel ? null : b.dataset.panel; subOut = null; renderPanel(); }));
  el.querySelectorAll('.sp').forEach((b) => b.addEventListener('click', () => { speed = b.dataset.sp === 'highlights' ? 'highlights' : +b.dataset.sp; view.setSpeed(speed); markSpeed(); }));
  $('#pause').onclick = () => { view.setPaused(!view.paused); $('#pause').textContent = view.paused ? '▶' : '⏸'; };
  camSel.onchange = () => view.setCamera(camSel.value);
  $('#fs').onclick = () => {
    const root = el.querySelector('.match');
    try {
      if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
      else {
        const r = (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root);
        r?.catch?.(() => toast('Vollbild wird hier nicht unterstützt'));
      }
    } catch { toast('Vollbild wird hier nicht unterstützt'); }
  };
  $('#instant').onclick = () => runInstant();

  function showBreak(full) {
    const O = $('#overlay');
    if (finished || instantRunning || !O) return;
    O.classList.add('show');
    O.innerHTML = `<div class="ov-card"><h2>${full ? 'Abpfiff' : 'Halbzeit'}</h2><div class="ov-score">${crest(T0.club, 40)}<b>${T0.score} : ${T1.score}</b>${crest(T1.club, 40)}</div>${statsHtml()}
      ${!full && userTeam >= 0 && !friendly && !director && !htTalk ? '<button class="btn lg" id="ov-talk">🗣️ Halbzeitansprache</button> ' : ''}<button class="btn primary lg" id="ov-go">${full ? 'Zur Spielauswertung' : '2. Halbzeit starten'}</button></div>`;
    O.querySelector('#ov-talk')?.addEventListener('click', () => {
      const U = engine.teams[userTeam], Op = engine.teams[1 - userTeam];
      const xi = U.players.filter((p) => !p.offPitch && !p.sentOff).map((p) => p.data);
      const ctx = { half: true, lead: U.score - Op.score, diff: teamStrength(U.club, w.players) - teamStrength(Op.club, w.players), form: 0, rep: w.career?.rep ?? 50 };
      talkModal(w, ctx, xi, true, (res) => {
        htTalk = true;
        const prev = U.focus || { calm: 1, work: 1, foul: 1 };
        engine.setFocus(userTeam, { calm: (prev.calm + res.focus.calm * 2) / 3, work: (prev.work + res.focus.work * 2) / 3, fam: ((prev.fam || 0) + (res.focus.fam || 0) * 2) / 3, foul: res.focus.foul });
        cmd(res.reaction.icon, `Halbzeitansprache: ${TALKS[res.key].name}`, `Die Mannschaft ist ${res.reaction.label}`);
        O.querySelector('#ov-talk')?.remove();
      });
    });
    O.querySelector('#ov-go').onclick = () => {
      O.classList.remove('show'); O.innerHTML = '';
      if (full) report(); else engine.resume();
    };
  }

  // v6.0 set pieces taken by the user: aim in the goal, then time the power bar
  function showAim(kind) {
    const A = $('#aim'); if (!A) return;
    view.setPaused(true);
    const tk = engine.aimRequest?.taker || '';
    const done = (aim) => { A.classList.remove('show'); A.innerHTML = ''; engine.setAim(aim); view?.setPaused(false); const pb = $('#pause'); if (pb) pb.textContent = '⏸'; };
    if (kind === 'corner') {
      A.innerHTML = `<div class="aim-card"><h3>🚩 Ecke · ${esc(tk)}</h3><p class="muted">Wohin soll die Ecke?</p><div class="aim-row">${[['nah', '⤴ Erster Pfosten'], ['fern', '⤵ Zweiter Pfosten'], ['mix', '🎯 Elfmeterpunkt'], ['kurz', '↔ Kurz ausführen']].map(([k, l]) => `<button class="btn" data-r="${k}">${l}</button>`).join('')}</div><button class="btn ghost sm" data-r="ai">🤖 KI entscheiden lassen</button></div>`;
      A.classList.add('show');
      A.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => done(b.dataset.r === 'ai' ? null : { routine: b.dataset.r })));
      return;
    }
    const keeper = kind === 'keep';
    const title = keeper ? `🧤 Elfmeter gegen dich – ${esc(tk)} läuft an` : kind === 'pen' ? `⚽ Elfmeter · ${esc(tk)}` : `🎯 Freistoß · ${esc(tk)}`;
    A.innerHTML = `<div class="aim-card"><h3>${title}</h3><p class="muted" id="aimhint">${keeper ? 'Tippe, in welche Ecke dein Torwart springt.' : 'Tippe ins Tor, wohin du schießen willst.'}</p>
      <svg viewBox="-20 -14 340 130" class="aim-goal" id="aimgoal"><rect x="-20" y="96" width="340" height="20" fill="#2f7a3a"/><rect x="0" y="0" width="300" height="100" fill="rgba(255,255,255,.06)" stroke="#fff" stroke-width="5"/>
        <g stroke="rgba(255,255,255,.18)" stroke-width="1">${Array.from({ length: 14 }, (_, i) => `<line x1="${i * 21.4}" y1="0" x2="${i * 21.4}" y2="100"/>`).join('')}${Array.from({ length: 5 }, (_, i) => `<line x1="0" y1="${i * 20}" x2="300" y2="${i * 20}"/>`).join('')}</g>
        ${!keeper && kind === 'fk' ? '<g fill="#223" opacity=".85"><rect x="70" y="40" width="20" height="60" rx="8"/><rect x="92" y="38" width="20" height="62" rx="8"/><rect x="114" y="40" width="20" height="60" rx="8"/><rect x="136" y="39" width="20" height="61" rx="8"/></g>' : ''}
        <circle id="aimdot" r="9" cx="-100" cy="-100" fill="#ffd400" stroke="#000" stroke-width="2"/></svg>
      <div class="aim-power" id="aimpow" hidden><div class="aim-bar"><i class="sweet"></i><i class="mark" id="aimmark"></i></div><button class="btn primary lg" id="aimgo">Schießen!</button><small class="muted">Stoppe den Balken im grünen Bereich. Zu viel Kraft = über die Latte.</small></div>
      <button class="btn ghost sm" id="aimai">🤖 ${keeper ? 'Torwart selbst entscheiden lassen' : 'KI schießen lassen'}</button></div>`;
    A.classList.add('show');
    let target = null, raf = 0, t0 = 0;
    A.querySelector('#aimai').onclick = () => { cancelAnimationFrame(raf); done(null); };
    const svg = A.querySelector('#aimgoal');
    svg.onclick = (ev) => {
      if (target && !keeper) return;
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * 340 - 20, py = ((ev.clientY - r.top) / r.height) * 130 - 14;
      const z = ((px - 150) / 150) * 3.66, y = Math.max(0.1, ((100 - py) / 100) * 2.44);
      const dot = A.querySelector('#aimdot'); dot.setAttribute('cx', px); dot.setAttribute('cy', py);
      target = { z, y };
      if (keeper) { setTimeout(() => done({ dive: z, dy: y }), 250); return; }
      A.querySelector('#aimhint').textContent = 'Jetzt im richtigen Moment schießen!';
      A.querySelector('#aimpow').hidden = false;
      const mark = A.querySelector('#aimmark'); t0 = performance.now();
      const loop = (now) => { const ph = ((now - t0) / 1100) % 2, v = ph < 1 ? ph : 2 - ph; mark.style.left = (v * 100) + '%'; mark.dataset.v = v; raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      const fire = () => { cancelAnimationFrame(raf); const v = +mark.dataset.v || 0; const q = 1 - Math.min(1, Math.abs(v - 0.7) / 0.32); done({ z: target.z, y: target.y, q, power: v }); };
      A.querySelector('#aimgo').onclick = fire;
    };
  }

  function runInstant() {
    if (instantRunning || finished) return;
    instantRunning = true;
    engine.manualSP = false; if (engine.aimRequest) { engine.setAim(null); $('#aim')?.classList.remove('show'); }
    view?.dispose(); view = null;
    const O = $('#overlay');
    O.classList.add('show');
    O.innerHTML = `<div class="ov-card"><h2>Simulation läuft…</h2><div class="progress"><i id="prog"></i></div><p id="pscore" class="ov-score"></p></div>`;
    const tick = () => {
      const done = engine.runSteps(1500);
      const pct = Math.min(100, (engine.time / 5700) * 100);
      const pr = O.querySelector('#prog'); if (pr) pr.style.width = pct + '%';
      const ps = O.querySelector('#pscore'); if (ps) ps.textContent = `${engine.clockText()} · ${T0.score} : ${T1.score}`;
      if (done) { O.classList.remove('show'); report(); } else setTimeout(tick, 0);
    };
    setTimeout(tick, 30);
  }

  function report() {
    if (finished) return; finished = true;
    const r = engine.result();
    view?.dispose(); view = null;
    const goals = engine.events.filter((e) => e.type === 'goal');
    const ratings = (T) => T.players.filter((p) => p.minuteIn != null).map((p) => `<div class="pl-row"><span class="pos">${p.role}</span><span class="nm">${esc(p.data.lastName)}${p.stats.goals ? ' ⚽'.repeat(p.stats.goals) : ''}</span><b class="${ratingClass(p.rating * 10)}">${Math.max(3, Math.min(10, p.rating)).toFixed(1)}</b></div>`).join('');
    el.innerHTML = `<div class="page narrow report">
      <div class="card big-result"><div class="ov-score">${crest(H, 56)}<b>${r.hg} : ${r.ag}</b>${crest(A, 56)}</div>
        <div class="goals-list">${goals.map((g) => `<p class="${g.team === 0 ? 'l' : 'r'}">${g.minuteText} ⚽ ${esc(g.text.replace(/^TOR für [^!]+! /, ''))}</p>`).join('') || '<p class="muted">Keine Tore.</p>'}</div></div>
      <div class="card">${statsHtml()}</div>
      <div class="grid-2"><div class="card"><h3>${esc(H.short)} – Noten</h3>${ratings(T0)}</div><div class="card"><h3>${esc(A.short)} – Noten</h3>${ratings(T1)}</div></div>
      <div class="row-actions center">${userTeam >= 0 && !friendly ? '<button class="btn lg ghost" id="postpress">🎤 Pressekonferenz</button>' : ''}<button class="btn primary lg" id="cont">Weiter</button></div></div>`;
    el.querySelector('#postpress')?.addEventListener('click', (ev) => {
      const me = engine.teams[userTeam], op = engine.teams[1 - userTeam];
      const rated = me.players.filter((p) => p.minuteIn != null).sort((a, b) => b.rating - a.rating);
      const qs = postPressQuestions(w, app.club, { gf: me.score, ga: op.score, opp: op.club, best: rated[0]?.rating >= 7.6 ? rated[0].data : null, worst: rated[rated.length - 1]?.rating <= 5.6 ? rated[rated.length - 1].data : null, varOff: engine.events.some((e) => e.type === 'nogoal' && e.team === userTeam) });
      ev.target.disabled = true;
      let i = 0;
      const m = modal('<div id="pp"></div>');
      const step = () => {
        if (i >= qs.length) { m.el.querySelector('#pp').innerHTML = '<h3>🎤 Pressekonferenz beendet</h3><p class="muted">Deine Antworten wirken sich auf Moral, Vorstand und Fans aus.</p>'; return; }
        const q = qs[i];
        m.el.querySelector('#pp').innerHTML = `<h3>🎤 Frage ${i + 1}/${qs.length}</h3><p><b>${esc(q.q)}</b></p><div class="sim-opts">${q.a.map(([t], k) => `<button class="btn" data-a="${k}">${esc(t)}</button>`).join('')}</div>`;
        m.el.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => { applyPressAnswer(w, app.club, q, q.a[+b.dataset.a][1]); taskEvent(w, 'press'); (w.media ||= {}).quotes = [{ season: w.season, week: w.week, text: q.a[+b.dataset.a][0], q: q.q }, ...((w.media.quotes) || [])].slice(0, 30); i++; step(); }));
      };
      step();
    });
    el.querySelector('#cont').onclick = () => commitResult(app, { r, H, A, friendly, scene: params.scene, prep: params.prep, wm: params.wm, tourney: params.tourney, record: (w2) => { const ui = engine.teams.findIndex((T) => T.club.id === w2.userClubId); if (ui >= 0) recordLive(w2, engine.teams, ui, r.stats?.[ui]?.possession); } });
  }

  if (params.mode === 'instant') { runInstant(); }
  else startView();
  return () => { view?.dispose(); };
}

// v3.1: shared by the classic 3D mode and the Unity mode – books the result into the season
export async function commitResult(app, { r, H, A, friendly, record, wm, scene, prep, tourney }) {
  const w = app.world;
  if (wm) return wmCommit(app, r, wm);
  if (tourney) return tourneyCommit(app, r, tourney);
  if (prep) { recordFriendly(w, H, A, r.hg, r.ag); app.go('prep'); return; }
  if (scene) { sceneOutcome(w, scene, r); app.go('editor', { tab: 'scene' }); return; }
  if (friendly) { app.world = null; app.go('start'); return; }
  const rng = newRng(w);
  const m = currentFixture(w);
  m.hg = r.hg; m.ag = r.ag;
  applyMatchResult(w, m, r, rng);
  record?.(w);
  for (const id in r.ratings) {
    const p = w.players[id]; if (!p || !p.stats.apps) continue;
    // average over the rated (3D) matches only – simulated games have no rating (fix v2.5)
    const n = (p.stats.rN = (p.stats.rN || 0) + 1);
    p.stats.rating = ((n > 1 ? p.stats.rating || 0 : 0) * (n - 1) + r.ratings[id]) / n;
  }
  const me = w.clubs[w.userClubId];
  const myG = me.id === H.id ? r.hg : r.ag, opG = me.id === H.id ? r.ag : r.hg;
  const opp = me.id === H.id ? A : H;
  w.news.unshift({ season: w.season, week: w.week + 1, text: `${myG > opG ? 'Sieg' : myG < opG ? 'Niederlage' : 'Unentschieden'} gegen ${opp.name}: ${r.hg}:${r.ag}.` });
  for (const e of r.events) if (e.type === 'injury' && e.weeks >= 1 && me.squad.includes(e.player)) w.news.unshift({ season: w.season, week: w.week + 1, text: `${w.players[e.player].lastName} fällt verletzt ca. ${e.weeks} Woche(n) aus.` });
  w.news = w.news.slice(0, 40);
  if (m.cup) {
    // cup game played – the league match of this week is still to come
    resolveCupFixture(w, m, rng);
    if (!userFixture(w) && !userCupFixture(w)) { await endWeek(app, 'home'); return; }
    await app.autosave();
    w.day = Math.max(w.day || 0, 3);
    toast('Weiter geht es mit dem Ligaspiel am Sonntag');
    app.go('calendar');
    return;
  }
  await endWeek(app, 'calendar');
}

// ------------------------------------------------------------------ v4.0 team talk
function talkDone(w) { return w.talk && w.talk.season === w.season && w.talk.week === w.week; }

function talkModal(w, ctx, xi, half, done) {
  const H = talkHint(ctx, xi);
  const m = modal(`<h3>🗣️ ${half ? 'Halbzeitansprache' : 'Kabinenansprache'}</h3>
    <p class="muted">Co-Trainer: ${esc(H.text)} Mein Tipp: <b>${TALKS[H.best].icon} ${TALKS[H.best].name}</b>.</p>
    <div class="talk-grid">${Object.entries(TALKS).map(([k, t]) => `<button class="btn" data-talk="${k}"><b>${t.icon} ${t.name}</b><small>${t.desc}</small></button>`).join('')}</div><div id="talk-res"></div>`);
  m.el.querySelectorAll('[data-talk]').forEach((b) => (b.onclick = () => {
    const res = holdTalk(b.dataset.talk, ctx, xi, newRng(w));
    const per = { top: 0, gut: 0, neutral: 0, schlecht: 0 }; res.per.forEach((x) => per[x.r]++);
    m.el.querySelector('.talk-grid').remove();
    m.el.querySelector('#talk-res').innerHTML = `<div class="talk-res"><b>${res.reaction.icon} Die Mannschaft ist ${esc(res.reaction.label)}</b><p>${esc(reactionText(res))}</p>
      <p class="small muted">🤩 ${per.top} · 💪 ${per.gut} · 😐 ${per.neutral} · 😟 ${per.schlecht}</p><button class="btn primary" id="talk-ok">Weiter</button></div>`;
    m.el.querySelector('#talk-ok').onclick = () => { m.close(); done(res); };
  }));
}

// v5.2: result of an editor match scene (no effect on the season)
function sceneOutcome(w, scene, r) {
  const mine = scene.side === 'a' ? r.ag - r.hg : r.hg - r.ag;
  const ok = scene.goal === 'win' ? mine > 0 : scene.goal === 'draw' ? mine >= 0 : scene.goal === 'hold' ? mine >= (scene.side === 'a' ? scene.ag - scene.hg : scene.hg - scene.ag) : null;
  const e = (w.editor ||= { articles: [], scenes: [] });
  const sc = e.scenes.find((x) => x.id === scene.id);
  if (sc) { sc.played = (sc.played || 0) + 1; sc.last = `${r.hg}:${r.ag}`; if (ok) sc.won = (sc.won || 0) + 1; }
  toast(ok == null ? `Szene beendet: ${r.hg}:${r.ag}` : ok ? `🏆 Szene geschafft! Endstand ${r.hg}:${r.ag}` : `❌ Szene nicht geschafft – ${r.hg}:${r.ag}`);
}
