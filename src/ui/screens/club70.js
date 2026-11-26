// v7.0 screens: museum (3D), fans & ultras, club politics, pitch & weather, youth 2.0
import { crest, esc, money, toast, flag, pname, ratingClass } from '../dom.js';
import { newRng, userLeague } from '../../manager/season.js';
import { trophies, legendsOf, kitGallery, retireNumber, canRetire } from '../../manager/museum.js';
import { createMuseum } from '../../render/museum3d.js';
import { ensureFans, currentDemand, answerDemand, COLLECTIONS, chooseCollection, seasonTicketQuote, sellSeasonTickets, PROTESTS } from '../../manager/fans.js';
import { ensurePolitics, STYLES, FACTIONS, REQUESTS, endorse, requestVote } from '../../manager/politics.js';
import { ensurePitch, pitchLabel, PITCH_UPGRADES, KEEPER_COST, buyPitch, conditions, WEATHER_NAME } from '../../manager/weather.js';
import { ensureRefs, refFor, REF_STYLE } from '../../manager/referees.js';
import { ensureYouthLeague, youthTable } from '../../manager/youthLeague.js';
import { youthPlayers } from '../../manager/youth.js';
import { ensureMood } from '../../manager/events.js';

const sl = (s) => `${s}/${String((s + 1) % 100).padStart(2, '0')}`;
const bar = (v, cls = '') => `<div class="tbar ${cls}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`;

// ------------------------------------------------------------------ museum
export function museumScreen(app, el) {
  const w = app.world, club = w.clubs[w.userClubId];
  let view = null;
  const draw = () => {
    view?.dispose(); view = null;
    const T = trophies(w, club), Lg = legendsOf(w, club), K = kitGallery(club, w.season), R = club.retired || [];
    const count = (k) => T.filter((t) => t.kind === k).length;
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🏛️ Vereinsmuseum</h2><span class="muted">${esc(club.name)} · gegründet ${club.info?.founded || '–'}</span></div>
      <div class="museum-3d" id="mus3d"><div class="mus-hint">Ziehen zum Umsehen · Mausrad zum Gehen</div></div>
      <div class="grid-2">
        <div class="card"><h3>🏆 Trophäenschrank</h3>
          <div class="mus-stats"><div><b>${count('liga')}</b><small>Meistertitel im Spiel</small></div><div><b>${count('pokal') + count('europa')}</b><small>Pokale</small></div><div><b>${count('aufstieg')}</b><small>Zweitliga-Titel</small></div><div><b>${club.info?.titles ?? '–'}</b><small>Meistertitel vor 2026</small></div></div>
          ${T.length ? T.slice().reverse().map((t) => `<p class="small">🏆 <b>${esc(t.title)}</b> <span class="muted">${t.season ? sl(t.season) : ''}</span></p>`).join('') : '<p class="muted">Die Vitrinen warten auf den ersten Titel deiner Amtszeit.</p>'}</div>
        <div class="card"><h3>📜 Chronik</h3><div class="mus-chron">${(club.history || []).slice().reverse().slice(0, 14).map((h) => `<div><b>${sl(h.season)}</b><span>${esc(h.league)}</span><em>${h.rank}. Platz${h.champion ? ' 🏆' : ''}</em><small>${h.pts} Pkt · ${h.gf}:${h.ga}</small></div>`).join('') || '<p class="muted">Die Chronik beginnt mit dem Ende deiner ersten Saison.</p>'}</div></div>
      </div>
      <div class="grid-2">
        <div class="card"><h3>🌟 Legendenwand</h3>${Lg.length ? Lg.map((l) => { const c = canRetire(w, club, l); return `<div class="mus-leg"><div><b>${flag(l.nation)} ${esc(l.name)}</b><small class="muted">${l.pos} · ${l.seasons} Saisons · ${l.apps} Spiele · ${l.goals} Tore${l.titles ? ` · ${l.titles} Titel` : ''}</small></div>${c.ok ? `<button class="btn xs" data-ret="${l.id}">🎽 Nummer sperren</button>` : `<small class="muted" title="${esc(c.msg)}">${R.some((r) => r.id === l.id) ? '🎽 gesperrt' : ''}</small>`}</div>`; }).join('') : '<p class="muted">Legenden entstehen über mehrere Saisons – Einsätze, Tore, Titel und Treue.</p>'}</div>
        <div class="card"><h3>👕 Trikot-Galerie</h3><div class="mus-kits">${K.map((k) => `<div class="mus-kit"><svg viewBox="0 0 64 70" width="58"><path d="M18 4h28l16 12-8 12-6-4v42H16V24l-6 4-8-12z" fill="${k.colors.primary}" stroke="#0006"/><rect x="16" y="30" width="32" height="5" fill="${k.colors.secondary}"/></svg><small>${sl(k.season)}${k.current ? ' · aktuell' : ''}</small></div>`).join('')}</div>
          <h3 style="margin-top:12px">🎽 Gesperrte Rückennummern</h3>${R.length ? R.map((r) => `<p><b class="mus-num">${r.num}</b> ${esc(r.name)} <small class="muted">seit ${sl(r.season)}</small></p>`).join('') : '<p class="muted small">Noch keine. Ehre eine Vereinslegende, indem du ihre Nummer für immer sperrst.</p>'}</div>
      </div></div>`;
    view = createMuseum(el.querySelector('#mus3d'), { club, trophies: T, legends: Lg, kits: K, retired: R });
    el.querySelectorAll('[data-ret]').forEach((b) => (b.onclick = () => { const l = Lg.find((x) => x.id === +b.dataset.ret); const r = retireNumber(w, club, l); toast(r.msg); draw(); }));
  };
  draw();
  return () => view?.dispose();
}

// ------------------------------------------------------------------ fans
export function fansScreen(app, el) {
  const w = app.world, club = w.clubs[w.userClubId];
  const draw = () => {
    const F = ensureFans(w, club), M = ensureMood(w), D = currentDemand(w);
    const price0 = app.stPrice || seasonTicketQuote(w, 0).ref;
    const q = seasonTicketQuote(w, price0);
    const st = club.seasonTix?.season === w.season ? club.seasonTix : null;
    const col = F.collection?.season === w.season ? COLLECTIONS.find((c) => c.id === F.collection.id) : null;
    el.innerHTML = `<div class="page"><div class="page-head"><h2>📣 Fans & Kurve</h2></div>
      <div class="grid-3">
        <div class="card"><h3>🔥 Ultras</h3><b class="big">${Math.round(F.ultras)}</b><small class="muted">/100 Stimmung in der Kurve</small>${bar(F.ultras, F.ultras < 30 ? 'bad' : '')}
          ${F.protest ? `<p class="tag r" style="display:block;margin-top:8px">🚩 ${esc(PROTESTS[F.protest.type].name)} läuft – bis Woche ${F.protest.until + 1}</p>` : '<p class="small muted">Ergebnisse, Ticketpreise, Investoren und deine Antworten auf Forderungen bestimmen die Laune.</p>'}</div>
        <div class="card"><h3>🏳️ Fanclubs</h3><b class="big">${F.clubs.toLocaleString('de-DE')}</b><small class="muted">offizielle Fanclubs</small><p class="small muted">Viele Fanclubs = Unterstützung auch auswärts.</p></div>
        <div class="card"><h3>😊 Fanstimmung</h3><b class="big">${M.fans}</b><small class="muted">/100</small>${bar(M.fans)}</div>
      </div>
      <div class="grid-2">
        <div class="card"><h3>📣 Forderung der Kurve</h3>${D ? `<p>${esc(D.text)}</p><div class="row-actions"><button class="btn primary" id="d-yes">✅ ${esc(D.yes)}</button><button class="btn" id="d-no">❌ ${esc(D.no)}</button></div><p class="small muted">Ohne Antwort innerhalb von drei Wochen gilt sie als abgelehnt.</p>` : '<p class="muted">Gerade keine offenen Forderungen. Die Ultras melden sich etwa alle sechs Wochen.</p>'}</div>
        <div class="card"><h3>🎫 Dauerkarten ${sl(w.season)}</h3>${st ? `<p><b>${st.sold.toLocaleString('de-DE')}</b> Dauerkarten zu je <b>${st.price} €</b> verkauft (${Math.round(st.share * 100)} % des Stadions).</p>` : w.week > 2 ? '<p class="muted">Der Dauerkartenverkauf ist für diese Saison vorbei.</p>'
          : `<label class="field">Preis pro Dauerkarte: <b id="st-v">${price0} €</b><input type="range" id="st-p" min="${Math.round(q.ref * 0.5)}" max="${Math.round(q.ref * 1.8)}" value="${price0}"></label><p class="small">Erwartet: <b>${q.sold.toLocaleString('de-DE')}</b> Karten · Einnahmen <b>${money(q.income)}</b> sofort · Richtwert ${q.ref} €</p><p class="small muted">Dauerkarten bringen das Geld vorab, dafür verdienst du an den Spieltagen weniger. Günstige Preise freuen die Kurve.</p><button class="btn primary" id="st-go">🎫 Verkauf starten</button>`}</div>
      </div>
      <div class="grid-2">
        <div class="card"><h3>🛍️ Fanshop-Kollektion</h3>${col ? `<p>${col.icon} <b>${esc(col.name)}</b> – ${F.collection.mult >= 1.1 ? '🔥 ein Renner' : F.collection.mult >= 1 ? 'läuft solide' : 'Ladenhüter'} (Merchandising ×${F.collection.mult.toFixed(2).replace('.', ',')})</p>` : '<p class="small muted">Einmal pro Saison legst du die Kollektion fest. Was zu deinem Verein passt, verkauft sich besser.</p>'}
          <div class="coll-grid">${COLLECTIONS.map((c) => `<button class="coll ${col?.id === c.id ? 'on' : ''}" data-col="${c.id}" ${col ? 'disabled' : ''}><span>${c.icon}</span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></button>`).join('')}</div></div>
        <div class="card"><h3>📜 Aus der Kurve</h3>${F.log.slice(0, 12).map((x) => `<p class="small"><span class="muted">W${x.week + 1}</span> ${esc(x.text)}</p>`).join('') || '<p class="muted">Noch nichts los.</p>'}</div>
      </div></div>`;
    el.querySelector('#d-yes')?.addEventListener('click', () => { toast(answerDemand(w, true, newRng(w)).msg); draw(); });
    el.querySelector('#d-no')?.addEventListener('click', () => { toast(answerDemand(w, false, newRng(w)).msg); draw(); });
    const r = el.querySelector('#st-p');
    if (r) r.oninput = () => { app.stPrice = +r.value; const q2 = seasonTicketQuote(w, +r.value); el.querySelector('#st-v').textContent = `${r.value} €`; r.closest('.card').querySelector('p.small').innerHTML = `Erwartet: <b>${q2.sold.toLocaleString('de-DE')}</b> Karten · Einnahmen <b>${money(q2.income)}</b> sofort · Richtwert ${q2.ref} €`; };
    el.querySelector('#st-go')?.addEventListener('click', () => { toast(sellSeasonTickets(w, +(r?.value || price0)).msg); draw(); });
    el.querySelectorAll('[data-col]').forEach((b) => (b.onclick = () => { toast(chooseCollection(w, b.dataset.col, newRng(w)).msg); draw(); }));
  };
  draw();
}

// ------------------------------------------------------------------ politics
export function politicsScreen(app, el) {
  const w = app.world, club = w.clubs[w.userClubId];
  const draw = () => {
    const P = ensurePolitics(w, newRng(w)), S = STYLES[P.president.style], M = ensureMood(w);
    const half = `${w.season}-${w.week < 17 ? 1 : 2}`;
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🏛️ Vereinspolitik</h2><span class="muted">Nächste Präsidentschaftswahl: Sommer ${P.nextElection + 1}</span></div>
      <div class="grid-2">
        <div class="card"><h3>👔 Präsident</h3><div class="pol-pres"><span>${S.icon}</span><div><b>${esc(P.president.name)}</b><small>${esc(S.name)} · im Amt seit ${sl(P.president.since)}</small><p class="small muted">${esc(S.desc)}</p></div></div>
          <div class="kv"><span>Vertrauen in dich</span><b>${M.board}/100</b></div><div class="kv"><span>50+1</span><b>${P.president.style === 'invest' ? '⚠️ wackelt' : club.biz?.investor ? 'Investor eingestiegen' : '✅ geschützt'}</b></div></div>
        <div class="card"><h3>🗳️ Wahl</h3>${P.candidates ? `<p>Im Sommer wählen die Mitglieder. Deine Unterstützung kann den Ausschlag geben – setzt du auf den Verlierer, kostet das Vertrauen.</p>${P.candidates.map((c, i) => `<div class="pol-cand ${P.endorse === i ? 'on' : ''}"><span>${STYLES[c.style].icon}</span><div><b>${esc(c.name)}</b>${c.incumbent ? ' <small class="tag">Amtsinhaber</small>' : ''}<small class="muted">${esc(STYLES[c.style].name)} – ${esc(STYLES[c.style].desc)}</small></div><button class="btn sm ${P.endorse === i ? 'primary' : ''}" data-end="${i}">${P.endorse === i ? '✓ Unterstützt' : 'Unterstützen'}</button></div>`).join('')}<button class="btn sm ghost" data-end="-1">Neutral bleiben</button>`
          : `<p class="muted">Der Wahlkampf beginnt in der Rückrunde der Wahlsaison (${sl(P.nextElection)}).</p>`}</div>
      </div>
      <div class="grid-2">
        <div class="card"><h3>🪑 Aufsichtsrat</h3>${P.council.map((c) => `<div class="pol-mem"><span>${FACTIONS[c.faction]}</span><b>${esc(c.name)}</b><div class="pol-trust">${bar(c.trust, c.trust < 35 ? 'bad' : '')}<small>${Math.round(c.trust)}</small></div></div>`).join('')}<p class="small muted">Das Vertrauen der Mitglieder folgt Ergebnissen, Finanzen und Fanstimmung – je nach Fraktion.</p></div>
        <div class="card"><h3>📝 Antrag an den Aufsichtsrat</h3>${P.requestHalf === half ? '<p class="muted">In dieser Saisonhälfte hast du schon einen Antrag gestellt.</p>' : '<p class="small muted">Einmal pro Saisonhälfte. Mindestens 3 von 5 Stimmen nötig – eine Ablehnung kostet etwas Vertrauen.</p>'}
          <div class="pol-req">${Object.entries(REQUESTS).map(([k, r]) => `<button class="btn ghost" data-req="${k}" ${P.requestHalf === half ? 'disabled' : ''}><b>${r.icon} ${esc(r.name)}</b><small>${esc(r.desc)}</small></button>`).join('')}</div></div>
      </div>
      <div class="card"><h3>📜 Protokoll</h3>${P.log.slice(0, 10).map((x) => `<p class="small"><span class="muted">${sl(x.season)} W${x.week + 1}</span> ${esc(x.text)}</p>`).join('') || '<p class="muted">Noch keine Sitzungen.</p>'}</div></div>`;
    el.querySelectorAll('[data-end]').forEach((b) => (b.onclick = () => { const i = +b.dataset.end; if (i < 0) { P.endorse = null; toast('Du bleibst neutral'); } else toast(endorse(w, i).msg); draw(); }));
    el.querySelectorAll('[data-req]').forEach((b) => (b.onclick = () => { const r = requestVote(w, b.dataset.req, newRng(w)); toast(r.granted ? '✅ Antrag angenommen' : r.ok ? '❌ Antrag abgelehnt' : r.msg); draw(); }));
  };
  draw();
}

// ------------------------------------------------------------------ pitch & weather
export function pitchScreen(app, el) {
  const w = app.world, club = w.clubs[w.userClubId];
  const draw = () => {
    const P = ensurePitch(club), L = userLeague(w);
    const next = [];
    for (let k = w.week; k < Math.min(L.fixtures.length, w.week + 5); k++) { const f = L.fixtures[k]?.find((m) => m.h === club.id || m.a === club.id); if (f) next.push({ k, f, c: conditions(w, { ...f, week: k }), ref: refFor(w, { ...f, week: k }) }); }
    ensureRefs(w);
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🌱 Rasen, Wetter & Schiedsrichter</h2></div>
      <div class="grid-2">
        <div class="card"><h3>🌱 Rasen im ${esc(club.stadium.name)}</h3><b class="big">${Math.round(P.q)}</b><small class="muted">/100 · ${pitchLabel(P.q)}</small>${bar(P.q, P.q < 50 ? 'bad' : '')}
          <p class="small muted">Ein guter Platz ist Teil des Heimvorteils. Schlechter Rasen kostet Heimstärke und erhöht das Verletzungsrisiko. Regen, Schnee und Heimspiele setzen ihm zu.</p>
          <div class="kv"><span>🔥 Rasenheizung</span><b>${P.heating ? '✅ vorhanden' : `<button class="btn xs" data-pu="heating">Einbauen · ${money(PITCH_UPGRADES.heating.cost * (club.women ? 0.25 : 1))}</button>`}</b></div>
          <div class="kv"><span>🧵 Hybridrasen</span><b>Stufe ${P.hybrid}/2 ${P.hybrid < 2 ? `<button class="btn xs" data-pu="hybrid">Ausbau · ${money(PITCH_UPGRADES.hybrid.cost * (club.women ? 0.25 : 1))}</button>` : ''}</b></div>
          <div class="kv"><span>👨‍🌾 Greenkeeper-Team</span><b>${[0, 1, 2, 3].map((k) => `<button class="chip-btn ${P.keeper === k ? 'on' : ''}" data-gk="${k}">${['Minimal', 'Normal', 'Profi', 'Elite'][k]}</button>`).join('')}</b></div>
          <p class="small muted">Greenkeeper: ${money(KEEPER_COST[P.keeper])}/Woche. Ohne Rasenheizung droht bei Schnee eine Spielabsage.</p></div>
        <div class="card"><h3>🌦️ Wetter- & Schiri-Vorschau</h3>${next.map(({ k, f, c, ref }) => `<div class="wx-row"><b>${k + 1}.</b><span>${f.h === club.id ? 'vs' : '@'} ${esc(w.clubs[f.h === club.id ? f.a : f.h].short)}</span><span>${WEATHER_NAME[c.weather]} ${c.temp} °C</span><span title="${esc(REF_STYLE(ref))}">🟨 ${esc(ref.name)} <small class="muted">${esc(REF_STYLE(ref))}</small></span></div>`).join('') || '<p class="muted">Keine Spiele mehr.</p>'}
          <p class="small muted">Regen: mehr Fehler · Schnee: weniger Tore · Hitze: schwere Beine · Sturm: lange Bälle unberechenbar.</p></div>
      </div>
      <div class="card table-wrap"><h3>🟨 Schiedsrichter der Liga</h3><table class="tbl compact"><thead><tr><th>Name</th><th>Stil</th><th>Spiele</th><th>Gelb/Spiel</th><th>Rot</th></tr></thead><tbody>${ensureRefs(w).list.slice().sort((a, b) => b.strict - a.strict).map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(REF_STYLE(r))}</td><td>${r.games}</td><td>${r.games ? (r.yellow / r.games).toFixed(1).replace('.', ',') : '–'}</td><td>${r.red}</td></tr>`).join('')}</tbody></table>
        ${(w.refs.appeals || []).length ? `<h4>⚖️ Deine Beschwerden</h4>${w.refs.appeals.slice(0, 6).map((a) => `<p class="small">${a.ok ? '✅' : '❌'} ${sl(a.season)} W${a.week + 1}: gegen ${esc(a.ref)}</p>`).join('')}` : ''}</div></div>`;
    el.querySelectorAll('[data-pu]').forEach((b) => (b.onclick = () => { const U = PITCH_UPGRADES[b.dataset.pu]; const save = U.cost; if (club.women) U.cost = save * 0.25; const r = buyPitch(w, club, b.dataset.pu); U.cost = save; toast(r.msg || (r.ok ? 'Erledigt' : 'Nicht möglich')); draw(); }));
    el.querySelectorAll('[data-gk]').forEach((b) => (b.onclick = () => { P.keeper = +b.dataset.gk; draw(); }));
  };
  draw();
}

// ------------------------------------------------------------------ youth 2.0
export function youthScreen(app, el) {
  const w = app.world, club = w.clubs[w.userClubId];
  const Y = ensureYouthLeague(w);
  const t = youthTable(Y), ys = youthPlayers(w).sort((a, b) => b.pot - a.pot);
  const sc = Object.entries(Y.scorers).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const last = Y.results[0];
  el.innerHTML = `<div class="page"><div class="page-head"><h2>🌱 Jugend · ${esc(Y.name)}</h2><span class="muted">Spieltag ${Y.md}/${Y.rounds.length}</span></div>
    <div class="grid-2">
      <div class="card table-wrap"><h3>📊 Tabelle</h3><table class="tbl compact"><thead><tr><th>#</th><th>Verein</th><th>Sp</th><th>Tore</th><th>Pkt</th></tr></thead><tbody>${t.map((r, i) => `<tr class="${r.id === club.id ? 'mine' : ''}"><td>${i + 1}</td><td>${crest(w.clubs[r.id], 16)} ${esc(w.clubs[r.id].short)} U19</td><td>${r.p}</td><td>${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div>
      <div>
        <div class="card"><h3>⚽ Letzter Spieltag</h3>${last?.mine ? `<p class="yl-mine">${crest(w.clubs[last.mine.a], 22)} <b>${last.mine.ga}:${last.mine.gb}</b> ${crest(w.clubs[last.mine.b], 22)} <small class="muted">${last.mine.scorers.map((id) => esc(w.players[id]?.lastName || '')).join(', ')}</small></p>` : ''}${last ? last.games.slice(0, 9).map((g) => `<p class="small">${esc(w.clubs[g.a].short)} ${g.ga}:${g.gb} ${esc(w.clubs[g.b].short)}</p>`).join('') : '<p class="muted">Der erste U19-Spieltag folgt nach dieser Woche.</p>'}</div>
        <div class="card"><h3>🥇 Torjäger</h3>${sc.map(([id, g]) => { const p = w.players[id]; return p ? `<p class="small"><b>${g}</b> ${esc(pname(p))} <span class="muted">${p.pos}</span></p>` : ''; }).join('') || '<p class="muted small">Noch keine Tore.</p>'}</div>
        ${Y.cup ? `<div class="card"><h3>🏆 ${esc(Y.cup.name)}</h3>${Y.cup.rounds.map((r) => `<h4>${esc(r.name)}</h4>${r.ties.map((x) => `<p class="small ${x.a === club.id || x.b === club.id ? 'mine' : ''}">${esc(w.clubs[x.a].short)} ${x.ga}:${x.gb}${x.note} ${esc(w.clubs[x.b].short)}</p>`).join('')}`).join('') || '<p class="muted small">Auslosung steht – los geht es in der Winterpause.</p>'}${Y.cup.done ? `<p>🏆 <b>${esc(w.clubs[Y.cup.winner].name)}</b></p>` : ''}</div>` : '<div class="card"><h3>🏆 Hallenmasters</h3><p class="muted small">In der Winterpause spielt deine U19 gegen sieben der besten Nachwuchsteams Europas.</p></div>'}
      </div>
    </div>
    <div class="grid-2">
      <div class="card"><h3>🏠 Internats-Leben</h3>${Y.life.slice(0, 10).map((x) => `<p class="small"><span class="muted">W${x.week + 1}</span> ${esc(x.text)}</p>`).join('') || '<p class="muted small">Schule, Heimweh, Durchbrüche – hier erfährst du, was deine Talente neben dem Platz erleben. Ein Jugendinternat im Trainingszentrum hilft.</p>'}</div>
      <div class="card"><h3>⭐ Talente & ihre Geschichte</h3>${ys.slice(0, 8).map((p) => `<details class="yl-story"><summary><b class="${ratingClass(p.ovr)}">${p.ovr}</b>/<b>${p.pot}</b> ${esc(pname(p))} <span class="muted">${p.pos} · ${p.age} J.${p.ystats ? ` · ${p.ystats.apps} Sp., ${p.ystats.goals} Tore` : ''}</span></summary>${(p.ystory || []).map((s) => `<p class="small">• ${esc(s)}</p>`).join('') || '<p class="small muted">Noch ein unbeschriebenes Blatt.</p>'}</details>`).join('') || '<p class="muted">Keine Jugendspieler.</p>'}</div>
    </div></div>`;
}
