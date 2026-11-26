// v7.0 Samstags-Konferenz: every match of your league at the same time – each one on its own tilted
// 3D mini pitch with a live ball, a big stage that jumps to the game where a goal falls ("TOR in …!"),
// a radio ticker and the live table. Your own match is simulated and part of the conference.
import { crest, esc, toast } from '../dom.js';
import { newRng, quickSim, computeTable, userLeague } from '../../manager/season.js';
import { ensureLineup } from '../../match/tactics.js';

export function canKonferenz(w) {
  const L = userLeague(w), md = L?.fixtures[w.week];
  return !!md?.find((m) => (m.h === w.userClubId || m.a === w.userClubId) && m.hg == null);
}

export function konferenzScreen(app, el) {
  const w = app.world, L = userLeague(w), md = L.fixtures[w.week] || [];
  const me = w.userClubId;
  // play every game of the matchday now (results are fixed, the conference replays them minute by minute)
  if (md.some((m) => m.hg == null)) {
    const rng = newRng(w);
    for (const m of md) { if (m.hg != null) continue; ensureLineup(w.clubs[m.h], w.players); ensureLineup(w.clubs[m.a], w.players); quickSim(w, m, rng); }
    app.save?.(app.slot || 'slot1', true);
  }
  const before = computeTable({ ...L, fixtures: L.fixtures.map((x, i) => (i === w.week ? x.map((m) => ({ ...m, hg: null, ag: null })) : x)) });
  const games = md.map((m, i) => ({ i, m, H: w.clubs[m.h], A: w.clubs[m.a], goals: (m.goals || []).slice().sort((a, b) => a.min - b.min), h: 0, a: 0, mine: m.h === me || m.a === me }));
  const city = (c) => c.info?.city || c.stadium?.name || c.short;
  el.innerHTML = `<div class="konf"><div class="konf-top"><div><b>📻 SAMSTAGSKONFERENZ</b><small>${esc(L.name)} · ${w.week + 1}. Spieltag</small></div><div class="konf-clock" id="kclock">0'</div>
      <div class="konf-ctl"><button class="btn xs" data-sp="1">1×</button><button class="btn xs on" data-sp="2">2×</button><button class="btn xs" data-sp="5">5×</button><button class="btn xs" id="kend">⏭ Ende</button></div></div>
    <div class="konf-main"><div class="konf-stage" id="kstage"><div class="ks-pitch"><i class="ks-ball" id="kball"></i><i class="ks-goal l"></i><i class="ks-goal r"></i></div><div class="ks-info" id="kinfo"><b>Anpfiff in allen Stadien!</b></div></div>
      <aside class="konf-side"><h4>📻 Radio</h4><div class="konf-radio" id="kradio"></div><h4>📊 Live-Tabelle</h4><div id="ktable" class="konf-table"></div></aside></div>
    <div class="konf-grid">${games.map((g) => `<div class="kg ${g.mine ? 'mine' : ''}" id="kg${g.i}"><div class="kg-score">${crest(g.H, 20)}<b id="ks${g.i}">0:0</b>${crest(g.A, 20)}</div><div class="kg-names"><span>${esc(g.H.short)}</span><span>${esc(g.A.short)}</span></div><div class="kg-pitch"><i class="kg-ball" id="kb${g.i}"></i></div></div>`).join('')}</div>
    <div class="konf-foot" id="kfoot"></div></div>`;
  const radio = el.querySelector('#kradio'), stage = el.querySelector('#kstage'), info = el.querySelector('#kinfo');
  let minute = 0, speed = 2, focus = games.find((g) => g.mine) || games[0], flash = 0, raf, last = performance.now(), done = false;
  const say = (t, hot) => { radio.insertAdjacentHTML('afterbegin', `<p class="${hot ? 'hot' : ''}"><b>${Math.min(90, Math.floor(minute))}'</b> ${t}</p>`); };
  const table = () => {
    const rows = before.map((r) => ({ ...r }));
    for (const g of games) { const H = rows.find((r) => r.id === g.H.id), A = rows.find((r) => r.id === g.A.id); if (!H || !A) continue; H.gf += g.h; H.ga += g.a; A.gf += g.a; A.ga += g.h; if (g.h > g.a) H.pts += 3; else if (g.h < g.a) A.pts += 3; else { H.pts++; A.pts++; } }
    rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    el.querySelector('#ktable').innerHTML = rows.map((r, i) => { const prev = before.findIndex((b) => b.id === r.id); return `<p class="${r.id === me ? 'mine' : ''}"><span>${i + 1}.</span>${crest(w.clubs[r.id], 14)} ${esc(w.clubs[r.id].short)} <em class="${prev > i ? 'up' : prev < i ? 'dn' : ''}">${prev > i ? '▲' : prev < i ? '▼' : ''}</em><b>${r.pts}</b></p>`; }).join('');
  };
  table();
  say('Anpfiff! Alle Spiele laufen.');
  const setFocus = (g, goalTxt) => {
    focus = g; flash = 2.6;
    stage.classList.remove('goal'); void stage.offsetWidth; stage.classList.add('goal');
    info.innerHTML = `<div class="ks-teams">${crest(g.H, 40)}<b>${g.h}:${g.a}</b>${crest(g.A, 40)}</div><b class="ks-tor">${goalTxt}</b>`;
    el.querySelectorAll('.kg').forEach((x) => x.classList.remove('focus')); el.querySelector(`#kg${g.i}`)?.classList.add('focus');
  };
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (done) return;
    const prevMin = minute;
    minute += dt * speed * 1.6; // ~28 s for 90 minutes at 2×
    if (prevMin < 45 && minute >= 45) say('Halbzeit in allen Stadien.');
    for (const g of games) {
      for (const gl of g.goals) {
        if (gl.done || gl.min > minute) continue;
        gl.done = true;
        if (gl.side === 'h') g.h++; else g.a++;
        const team = gl.side === 'h' ? g.H : g.A;
        const p = w.players[gl.p];
        el.querySelector(`#ks${g.i}`).textContent = `${g.h}:${g.a}`;
        const tile = el.querySelector(`#kg${g.i}`); tile.classList.remove('flash'); void tile.offsetWidth; tile.classList.add('flash');
        const txt = `TOR in ${esc(city(g.H))}! ${esc(team.short)}${p ? ` – ${esc(p.lastName)}` : ''} (${gl.min}.) · ${g.h}:${g.a}`;
        say(txt, true); setFocus(g, `⚽ ${txt}`);
        table();
      }
    }
    // balls: drift around, the focus game's ball runs on the big stage
    const t = now / 1000;
    for (const g of games) { const b = el.querySelector(`#kb${g.i}`); if (b) b.style.transform = `translate(${50 + Math.sin(t * 1.3 + g.i) * 38}%, ${50 + Math.cos(t * 1.7 + g.i * 2) * 30}%)`; }
    const kb = el.querySelector('#kball');
    if (kb) { const toGoal = flash > 0 ? (focus.goals.find((x) => x.done && Math.abs(x.min - minute) < 3)?.side === 'h' ? 1 : -1) : 0; kb.style.left = `${50 + (flash > 0 ? toGoal * (46 - flash * 8) : Math.sin(t * 0.9) * 30)}%`; kb.style.top = `${50 + Math.cos(t * 1.4) * (flash > 0 ? 4 : 24)}%`; }
    flash = Math.max(0, flash - dt);
    el.querySelector('#kclock').textContent = `${Math.min(90, Math.floor(minute))}'`;
    if (minute >= 92) finish();
  };
  const finish = () => {
    if (done) return; done = true;
    for (const g of games) { g.h = g.m.hg; g.a = g.m.ag; el.querySelector(`#ks${g.i}`).textContent = `${g.h}:${g.a}`; }
    table();
    say('Abpfiff! Alle Spiele sind beendet.', true);
    const mine = games.find((g) => g.mine);
    el.querySelector('#kclock').textContent = 'Ende';
    el.querySelector('#kfoot').innerHTML = `<div class="konf-end">${mine ? `<span>Dein Spiel: ${crest(mine.H, 24)} <b>${mine.m.hg}:${mine.m.ag}</b> ${crest(mine.A, 24)}</span>` : ''}<button class="btn primary" id="kgo">Weiter ▶</button></div>`;
    el.querySelector('#kgo').onclick = () => { (app.cal ||= { auto: false, speed: 1, month: null, log: [] }).runToMatch = false; app.go('calendar'); };
  };
  el.querySelectorAll('[data-sp]').forEach((b) => (b.onclick = () => { speed = +b.dataset.sp; el.querySelectorAll('[data-sp]').forEach((x) => x.classList.toggle('on', x === b)); }));
  el.querySelector('#kend').onclick = () => { minute = 95; for (const g of games) for (const gl of g.goals) gl.done = true; finish(); };
  raf = requestAnimationFrame(loop);
  void toast;
  return () => cancelAnimationFrame(raf);
}
