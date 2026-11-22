// Kalender (v2.9): month view with all matches, a day-by-day stepper with auto mode (1x/2x/4x), stop,
// "to the next match" and a daily log. Match days stop the clock – you play the game, then it goes on.
import { esc, crest, toast } from '../dom.js';
import { finishWeek, newRng, isUserSeasonOver, userLeague, dailyTick } from '../../manager/season.js';
import { dateOf, fmtDate, dayInfo, nextUserMatchDay, trainingOfDay, seasonStart, weekOfDate, WD, MONTHS, CUP_DAY, LEAGUE_DAY } from '../../manager/calendar.js';
import { SESSIONS } from '../../manager/training.js';

const SPEEDS = { 1: 1400, 2: 700, 4: 320 };

export function calendarScreen(app, el) {
  const w = app.world, club = app.club;
  w.day ??= 0;
  const st = (app.cal ||= { auto: false, speed: 1, month: null, log: [] });
  let timer = null;
  const stop = () => { st.auto = false; clearTimeout(timer); timer = null; };

  const log = (icon, text) => { st.log.unshift({ icon, text, date: fmtDate(dateOf(w)) }); st.log = st.log.slice(0, 14); };
  const todayEvents = () => dayInfo(w, w.week, w.day);
  const matchToday = () => { const md = nextUserMatchDay(w); return md != null && w.day >= md; };

  // one day forward; returns false when the clock has to stop
  const step = async () => {
    if (isUserSeasonOver(w) && !nextUserMatchDay(w)) { stop(); toast('Die Saison ist vorbei – schließe sie ab.'); app.go('seasonEnd'); return false; }
    if (matchToday()) { stop(); draw(); return false; }
    w.day++;
    if (w.day > 6) {
      finishWeek(w, newRng(w)); // a week without a match of yours (e.g. international break)
      await app.autosave();
      log('🗓️', `Neue Woche · ${w.week + 1}. Spielwoche`);
      if (w.pendingEvent) { stop(); draw(); return false; }
    }
    for (const line of dailyTick(w, newRng(w), w.day)) log(line.slice(0, 2).trim(), line.slice(2).trim()); // the world keeps turning in the background
    const key = trainingOfDay(w, w.day), S = key && SESSIONS[key];
    const ev = todayEvents().filter((e) => e.kind !== 'intl');
    if (ev.length) log(ev[0].kind === 'cup' ? '🏆' : '⚽', `Spieltag! ${ev[0].home ? 'Heim' : 'Auswärts'} gegen ${ev[0].opp?.name || ''}`);

    else if (S) log(S.icon || '🏋️', `Training: ${S.name}`);
    else log('🏋️', 'Trainingstag');
    if (matchToday()) { stop(); draw(); return false; }
    draw();
    return true;
  };
  const auto = () => { clearTimeout(timer); if (!st.auto) return; timer = setTimeout(async () => { if (await step() && st.auto) auto(); }, SPEEDS[st.speed]); };
  const toNextMatch = async () => { stop(); for (let i = 0; i < 20; i++) if (!(await step())) break; };

  const draw = () => {
    if (!el.isConnected) { stop(); return; }
    const today = dateOf(w), viewM = st.month ?? (today.getFullYear() * 12 + today.getMonth());
    const y = Math.floor(viewM / 12), mo = viewM % 12, first = new Date(y, mo, 1), lead = (first.getDay() + 6) % 7;
    const daysIn = new Date(y, mo + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="cd empty"></div>');
    for (let d = 1; d <= daysIn; d++) {
      const date = new Date(y, mo, d), { week, day } = weekOfDate(w, date);
      const isToday = date.toDateString() === today.toDateString(), past = date < today && !isToday;
      const evs = week >= 0 ? dayInfo(w, week, day) : [];
      const m = evs.find((e) => e.kind === 'league' || e.kind === 'cup');
      const res = m && m.m.hg != null ? (() => { const gf = m.home ? m.m.hg : m.m.ag, ga = m.home ? m.m.ag : m.m.hg; return `<b class="cd-res ${gf > ga ? 'w' : gf < ga ? 'l' : 'd'}">${gf}:${ga}</b>`; })() : '';
      const tr = week === w.week && !m && day < 6 && day > w.day ? trainingOfDay(w, day) : null;
      cells.push(`<div class="cd ${isToday ? 'today' : ''} ${past ? 'past' : ''} ${m ? `has-${m.kind}` : ''}"><span class="cd-n">${d}</span>
        ${m ? `<div class="cd-m">${crest(m.opp, 26)}<small>${m.home ? 'H' : 'A'}${m.kind === 'cup' ? ' · 🏆' : ''}</small>${res}</div>` : ''}
        ${evs.some((e) => e.kind === 'intl') ? '<small class="cd-tag">🌍 Länderspiele</small>' : ''}${tr && SESSIONS[tr] ? `<small class="cd-tr">${SESSIONS[tr].icon || ''} ${esc(SESSIONS[tr].name)}</small>` : ''}</div>`);
    }
    const ev = todayEvents().filter((e) => e.kind !== 'intl');
    const md = nextUserMatchDay(w);
    const upcoming = [];
    for (let wk = w.week; wk < w.week + 8 && upcoming.length < 6; wk++) for (const d of [CUP_DAY, LEAGUE_DAY]) { if (wk === w.week && d < w.day) continue; for (const e of dayInfo(w, wk, d)) if (e.m && e.m.hg == null) upcoming.push({ ...e, date: dateOf(w, wk, d) }); }
    const isMatch = matchToday();
    el.innerHTML = `<div class="page cal-page"><div class="page-head"><h2>📅 Kalender</h2><span class="chip">${esc(fmtDate(today, true))}</span></div>
      <div class="cal-top">
        <div class="card cal-today ${isMatch ? 'is-match' : ''}">
          <small class="muted">HEUTE</small><h3>${esc(fmtDate(today, true))}</h3>
          ${isMatch && ev[0] ? `<div class="cal-vs">${crest(club, 54)}<b>VS</b>${crest(ev[0].opp, 54)}</div><p><b>${esc(ev[0].label)}</b> · ${ev[0].home ? 'Heimspiel' : 'Auswärtsspiel'} gegen ${esc(ev[0].opp.name)}</p><button class="btn primary lg" id="cal-play">⚽ Zum Spiel</button>`
            : `<p class="cal-agenda">${w.day === 6 && !ev.length ? '😴 Ruhetag' : (() => { const k = trainingOfDay(w, w.day), S = k && SESSIONS[k]; return S ? `${S.icon || '🏋️'} Training: <b>${esc(S.name)}</b>` : '🏋️ Trainingstag'; })()}</p>
              ${md != null ? `<p class="muted">Nächstes Spiel: ${esc(WD[md])}, in ${md - w.day} Tag(en)</p>` : ''}`}
          ${w.pendingEvent ? '<button class="btn sm" id="cal-ev">❗ Offene Entscheidung ansehen</button>' : ''}
        </div>
        <div class="card cal-ctrl">
          <div class="cal-btns">
            <button class="btn lg" id="cal-step" ${isMatch ? 'disabled' : ''}>▶ Nächster Tag</button>
            <button class="btn lg ${st.auto ? 'active' : ''}" id="cal-auto" ${isMatch ? 'disabled' : ''}>${st.auto ? '⏸ Pause' : '⏯ Auto'}</button>
            <button class="btn lg" id="cal-stop" ${st.auto ? '' : 'disabled'}>⏹ Stopp</button>
            <button class="btn lg" id="cal-next" ${isMatch ? 'disabled' : ''}>⏭ Bis zum Spiel</button>
          </div>
          <div class="row-between"><span class="muted">Tempo im Auto-Modus</span><div class="tabs small">${[1, 2, 4].map((s) => `<button data-sp="${s}" class="${st.speed === s ? 'active' : ''}">${s}x</button>`).join('')}</div></div>
          <p class="muted" style="margin:.4rem 0 0">Auto stoppt von selbst an deinen Spieltagen und bei wichtigen Entscheidungen.</p>
          <div class="cal-log">${st.log.map((l) => `<div><i>${l.icon}</i><span>${esc(l.text)}</span><small>${esc(l.date)}</small></div>`).join('') || '<p class="muted">Noch nichts passiert – drück auf „Nächster Tag“.</p>'}</div>
        </div>
      </div>
      <div class="cal-main">
        <div class="card cal-month"><div class="row-between"><button class="btn sm" id="m-prev">‹</button><h3>${MONTHS[mo]} ${y}</h3><button class="btn sm" id="m-next">›</button></div>
          <div class="cal-grid">${WD.map((d) => `<div class="cd-h">${d}</div>`).join('')}${cells.join('')}</div></div>
        <div class="card cal-up"><h3>Nächste Spiele</h3>${upcoming.map((u) => `<div class="cu">${crest(u.opp, 30)}<div><b>${esc(u.opp.name)}</b><small>${esc(fmtDate(u.date))} · ${u.home ? 'Heim' : 'Auswärts'}</small><em>${esc(u.label)}</em></div></div>`).join('') || '<p class="muted">Keine weiteren Spiele.</p>'}</div>
      </div></div>`;
    const $ = (q) => el.querySelector(q);
    const td = document.getElementById('top-date'); if (td) td.textContent = `📅 ${fmtDate(today)}`;
    const tn = document.getElementById('top-next'); if (tn) tn.textContent = isMatch ? 'Zum Spieltag ▶' : isUserSeasonOver(w) ? 'Saison abschließen' : 'Weiter ▶';
    $('#cal-play')?.addEventListener('click', () => { stop(); app.go('matchday'); });
    $('#cal-ev')?.addEventListener('click', () => { stop(); app.go('home'); });
    $('#cal-step')?.addEventListener('click', () => { stop(); step(); });
    $('#cal-auto')?.addEventListener('click', () => { st.auto = !st.auto; if (st.auto) auto(); else stop(); draw(); });
    $('#cal-stop')?.addEventListener('click', () => { stop(); draw(); });
    $('#cal-next')?.addEventListener('click', toNextMatch);
    el.querySelectorAll('[data-sp]').forEach((b) => (b.onclick = () => { st.speed = +b.dataset.sp; draw(); if (st.auto) auto(); }));
    $('#m-prev').onclick = () => { st.month = viewM - 1; draw(); };
    $('#m-next').onclick = () => { st.month = viewM + 1; draw(); };
  };
  st.month = null;
  draw();
  if (st.runToMatch) { st.runToMatch = false; toNextMatch(); } else if (st.auto) auto();
  return () => stop();
}
