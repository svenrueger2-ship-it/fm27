import { IS_MOBILE } from '../../core/device.js';
// Transfers & scouting: market search, watchlist, scout assignments, bids, contract talks,
// loans with buy option, incoming offers, transfer list, contract extensions, history.
import {
  searchMarket, askingPrice, estimate, assignScout, makeBid, signPending, contractDemand, extendContract,
  loanTerms, requestLoan, exerciseOption, toggleListed, respondOffer, windowInfo, maxScouts, knowledge, wageRoom, executeTransfer,
} from '../../manager/transfers.js';
import { squadNeeds } from '../../manager/clubAI.js';
import { taskEvent } from '../../manager/progress.js';
import { projectPlayer, projectionSvg } from '../../manager/projection.js';
import { weeklyWages } from '../../manager/economy.js';
import { newRng } from '../../manager/season.js';
import { POSITIONS, POS_ORDER } from '../../data/attributes.js';
import { crest, esc, money, flag, pname, ratingClass, portrait, modal, toast, moneyInput, readMoney, fmtMoneyInput, moneyExact } from '../dom.js';
import { playerModal } from './manager.js';
import { REGIONS, ensureNet, maxNetScouts, scoutMarket, hireNetScout, fireNetScout, sendScout } from '../../manager/scoutnet.js';
import { demandPackage, pokerRound, applyPackage, agentOf, canPreContract, signPreContract } from '../../manager/agents.js';
import { TALKS, talk, canTalk, setCaptain, ensureCaptain, leadership, traits, loanOutOffers, acceptLoanOut, loanedOut, loanedIn, loanReport } from '../../manager/players.js';

const fmtRange = (e) => (e.exact ? `${e.ovr}` : `${e.ovrLo}–${e.ovrHi}`);
const potRange = (e) => (e.exact ? '' : `${e.potLo}–${e.potHi}`);

export function transfersScreen(app, el) {
  const w = app.world;
  app.tf ||= { tab: 'markt', f: { pos: 'ALLE', league: 'ALLE', maxAge: '', minOvr: '', maxPrice: '', name: '', sort: 'ovr' } };
  const S = app.tf;
  const draw = () => {
    const club = app.club, win = windowInfo(w);
    const offers = w.transfer.offers;
    const wages = weeklyWages(w, club);
    el.innerHTML = `<div class="page">
      <div class="page-head"><h2>Transfers & Scouting</h2>
        <div class="row-actions"><span class="chip">${win.open ? `🔓 ${win.name} – noch ${win.closesIn} Woche(n)` : `🔒 ${win.name} – öffnet in ${win.opensIn} Woche(n)`}</span>
        <span class="chip">💶 Budget ${money(club.budget)}</span><span class="chip">📄 Gehälter ${money(wages)} / ${money(club.wageBudget)}</span></div></div>
      <div class="tabs">${[['markt', '🔎 Transfermarkt'], ['swipe', '🃏 Swipe'], ['scouting', `🕵️ Scouting (${w.scouting.assignments.length}/${maxScouts(w)})`], ['angebote', `📨 Angebote${offers.length ? ` <b class="badge">${offers.length}</b>` : ''}`], ['kader', '📄 Verträge & Verkauf'], ['leihen', '🔁 Leihen'], ['historie', '🗂️ Transferhistorie']]
        .map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>
      <div id="tab"></div></div>`;
    el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; draw(); }));
    const T = el.querySelector('#tab');
    ({ markt, swipe, scouting, angebote, kader, leihen, historie })[S.tab](app, T, draw);
  };
  draw();
}

// ------------------------------------------------------------------ swipe (v2.5)
// Tinder-style scouting: right = watchlist, left = skip, up = bid. The deck favours squad needs.
function swipeDeck(app) {
  const w = app.world, club = app.club, skip = (w.swipeSkip ||= []);
  const needs = squadNeeds(w, club).slice(0, 3);
  const budget = club.budget;
  const pools = (needs.length ? needs : [{ pos: 'ALLE', minOvr: 0, reason: 'beste verfügbare Spieler' }]).map((n) => searchMarket(w, { pos: n.pos, minOvr: Math.max(0, n.minOvr - 3), maxPrice: Math.max(budget * 0.9, 5e5), sort: 'ovr' }).map((r) => ({ ...r, need: n })));
  const seen = new Set(), deck = [];
  for (let i = 0; deck.length < 24 && i < 60; i++) for (const P of pools) { const r = P[i]; if (r && !seen.has(r.p.id) && !skip.includes(r.p.id) && !w.scouting.watch.includes(r.p.id)) { seen.add(r.p.id); deck.push(r); } }
  return deck;
}
function swipe(app, el, redraw) {
  const w = app.world;
  if (!app.swipe || app.swipe.w !== w || app.swipe.week !== w.week) app.swipe = { w, week: w.week, deck: swipeDeck(app), i: 0, stats: { watch: 0, skip: 0 } };
  const S = app.swipe;
  const card = (r, top) => { const { p, est, price, need } = r, c = p.clubId ? w.clubs[p.clubId] : null; const pr = projectPlayer({ ...p, ovr: est.ovr, pot: est.exact ? p.pot : Math.round((est.potLo + est.potHi) / 2) });
    return `<div class="sw-card ${top ? 'top' : ''}" style="--c1:${c?.colors.primary || '#445'};--c2:${c?.colors.secondary || '#889'}"><div class="sw-stamp sw-yes">MERKEN</div><div class="sw-stamp sw-no">WEITER</div><div class="sw-stamp sw-bid">BIETEN</div>
      <div class="sw-top">${portrait(p, c, 120)}<div class="sw-ovr"><b class="${ratingClass(est.ovr)}">${fmtRange(est)}</b><small>Pot. ${est.exact ? p.pot : potRange(est)}</small></div></div>
      <h3>${flag(p.nation)} ${esc(pname(p))}</h3><p>${p.pos} · ${p.age} Jahre · ${c ? `${crest(c, 18)} ${esc(c.short)}` : 'vereinslos'}</p>
      <div class="sw-tags"><span class="chip">Ablöse ${price ? money(price) : 'frei'}</span><span class="chip">Gehalt ${money(p.wage)}</span>${!est.exact ? '<span class="chip warn">ungescoutet</span>' : ''}</div>
      <p class="sw-need">🎯 Passt zu: ${esc(need.reason)}</p><div class="sw-proj">${projectionSvg(pr, { w: 280, h: 70, mini: true })}<small>Prognose: Höhepunkt ca. ${pr.peak.ovr} mit ${pr.peak.age}</small></div></div>`; };
  const draw = () => {
    const r = S.deck[S.i], n = S.deck[S.i + 1];
    el.innerHTML = `<div class="card sw-wrap"><div class="row-between"><h3>🃏 Transfer-Swipe</h3><span class="muted">${S.stats.watch} gemerkt · ${S.stats.skip} übersprungen · ${Math.max(0, S.deck.length - S.i)} übrig</span></div>
      <p class="muted">Ziehe nach rechts zum Merken, nach links zum Überspringen, nach oben für ein Angebot – oder nutze die Knöpfe / Pfeiltasten. Vorschläge richten sich nach den Lücken in deinem Kader und deinem Budget.</p>
      <div class="sw-stage">${r ? `${n ? card(n, false) : ''}${card(r, true)}` : `<div class="sw-empty"><p>Keine weiteren Vorschläge.</p><button class="btn" id="sw-new">🔄 Neue Vorschläge</button></div>`}</div>
      ${r ? '<div class="sw-btns"><button class="btn lg" id="sw-l" title="Überspringen">✕</button><button class="btn lg" id="sw-i" title="Profil">ℹ️</button><button class="btn lg primary" id="sw-u" title="Bieten">💰</button><button class="btn lg" id="sw-r" title="Merken">★</button></div>' : ''}</div>`;
    el.querySelector('#sw-new')?.addEventListener('click', () => { w.swipeSkip = []; app.swipe = null; swipe(app, el, redraw); });
    if (!r) return;
    const top = el.querySelector('.sw-card.top');
    const act = (dir) => {
      top.classList.add(`fly-${dir}`);
      setTimeout(() => {
        S.i++; taskEvent(w, 'swipe');
        if (dir === 'r') { if (!w.scouting.watch.includes(r.p.id)) w.scouting.watch.push(r.p.id); S.stats.watch++; toast(`★ ${r.p.lastName} auf der Beobachtungsliste`); }
        if (dir === 'l') { w.swipeSkip.push(r.p.id); w.swipeSkip = w.swipeSkip.slice(-400); S.stats.skip++; }
        if (dir === 'u') { if (!w.scouting.watch.includes(r.p.id)) w.scouting.watch.push(r.p.id); bidDialog(app, r.p, () => {}); }
        draw();
      }, 260);
    };
    el.querySelector('#sw-l').onclick = () => act('l'); el.querySelector('#sw-r').onclick = () => act('r'); el.querySelector('#sw-u').onclick = () => act('u');
    el.querySelector('#sw-i').onclick = () => playerModal(app, r.p);
    let x0 = 0, y0 = 0, drag = false;
    top.addEventListener('pointerdown', (e) => { drag = true; x0 = e.clientX; y0 = e.clientY; top.setPointerCapture(e.pointerId); top.style.transition = 'none'; });
    top.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - x0, dy = e.clientY - y0; top.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
      top.style.setProperty('--yes', Math.max(0, Math.min(1, dx / 120))); top.style.setProperty('--no', Math.max(0, Math.min(1, -dx / 120))); top.style.setProperty('--bid', Math.max(0, Math.min(1, -dy / 120))); });
    top.addEventListener('pointerup', (e) => { if (!drag) return; drag = false; const dx = e.clientX - x0, dy = e.clientY - y0; top.style.transition = '';
      if (dy < -120 && Math.abs(dy) > Math.abs(dx)) act('u'); else if (dx > 110) act('r'); else if (dx < -110) act('l'); else { top.style.transform = ''; top.style.setProperty('--yes', 0); top.style.setProperty('--no', 0); top.style.setProperty('--bid', 0); } });
  };
  const key = (e) => { if (!el.isConnected || !el.querySelector('.sw-card.top') || document.querySelector('.modal-wrap')) { if (!el.isConnected) removeEventListener('keydown', key); return; }
    const m = { ArrowLeft: '#sw-l', ArrowRight: '#sw-r', ArrowUp: '#sw-u' }[e.key]; if (m) { e.preventDefault(); el.querySelector(m).click(); } };
  if (!app._swKey) { app._swKey = key; addEventListener('keydown', key); }
  draw();
}

// ------------------------------------------------------------------ market
function markt(app, el, redraw) {
  const w = app.world, f = app.tf.f;
  const leagues = [['ALLE', 'Alle Ligen'], ['FREI', 'Vereinslos'], ...w.leagues.map((l) => [l.id, l.name])];
  const res = searchMarket(w, { ...f, maxAge: +f.maxAge || 0, minOvr: +f.minOvr || 0, maxPrice: (+f.maxPrice || 0) * 1e6 });
  el.innerHTML = `<div class="card"><div class="grid-4">
      <label class="field">Name<input class="input" id="f-name" value="${esc(f.name)}" placeholder="Spieler suchen…"></label>
      <label class="field">Position<select id="f-pos">${['ALLE', ...POS_ORDER].map((p) => `<option ${p === f.pos ? 'selected' : ''} value="${p}">${p === 'ALLE' ? 'Alle Positionen' : `${p} – ${POSITIONS[p].name}`}</option>`).join('')}</select></label>
      <label class="field">Liga<select id="f-league">${leagues.map(([v, l]) => `<option value="${v}" ${v === f.league ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field">Sortierung<select id="f-sort">${[['ovr', 'Stärke'], ['pot', 'Potenzial'], ['price', 'Preis'], ['age', 'Alter']].map(([v, l]) => `<option value="${v}" ${v === f.sort ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field">Max. Alter<input class="input" id="f-age" type="number" min="16" max="40" value="${esc(f.maxAge)}"></label>
      <label class="field">Min. Stärke<input class="input" id="f-ovr" type="number" min="30" max="99" value="${esc(f.minOvr)}"></label>
      <label class="field">Max. Ablöse (Mio. €)<input class="input" id="f-price" type="number" min="0" step="0.5" value="${esc(f.maxPrice)}"></label>
      <div class="field"><span>&nbsp;</span><button class="btn primary" id="f-go">Suchen</button></div>
    </div><p class="muted">Stärke und Potenzial nicht gescouteter Spieler sind nur Schätzungen (Spanne). Ein Scout liefert exakte Werte und einen Bericht.</p></div>
    <div class="card table-wrap"><table class="tbl"><thead><tr><th>Spieler</th><th>Pos</th><th>Alter</th><th>Verein</th><th>Stärke</th><th>Potenzial</th><th>Marktwert</th><th>Ablöse</th><th></th></tr></thead><tbody>
    ${res.slice(0, app.tf.lim || (IS_MOBILE ? 40 : 120)).map(({ p, est, price }) => { const c = p.clubId ? w.clubs[p.clubId] : null; const watched = w.scouting.watch.includes(p.id);
      return `<tr data-p="${p.id}"><td class="nm">${portrait(p, c, 28)}<span>${flag(p.nation)} ${esc(pname(p))}${w.transfer.listed.includes(p.id) ? ' <i class="tag y">Transferliste</i>' : ''}${p.releaseClause ? ' <i class="tag b">Klausel</i>' : ''}${p.loan ? ' <i class="tag r">verliehen</i>' : ''}</span></td>
      <td><span class="pos pos-${POSITIONS[p.pos].group}">${p.pos}</span></td><td>${p.age}</td><td>${c ? `${crest(c, 18)} ${esc(c.short)}` : '<i class="tag">vereinslos</i>'}</td>
      <td><b class="${ratingClass(est.ovr)}">${fmtRange(est)}</b>${est.exact ? ' ✓' : ''}</td><td>${est.exact ? p.pot : potRange(est)}</td><td>${money(p.value)}</td><td><b>${c ? money(price) : 'ablösefrei'}</b></td>
      <td><button class="btn sm" data-watch="${p.id}">${watched ? '★' : '☆'}</button></td></tr>`; }).join('') || '<tr><td colspan="9" class="muted">Keine Spieler gefunden.</td></tr>'}
    </tbody></table>${res.length > (app.tf.lim || (IS_MOBILE ? 40 : 120)) ? '<div class="row-actions center"><button class="btn sm" id="f-more">Mehr anzeigen</button></div>' : ''}</div>`;
  el.querySelector('#f-more')?.addEventListener('click', () => { app.tf.lim = (app.tf.lim || 40) + 40; redraw(); });
  const read = () => { f.name = el.querySelector('#f-name').value; f.pos = el.querySelector('#f-pos').value; f.league = el.querySelector('#f-league').value; f.sort = el.querySelector('#f-sort').value; f.maxAge = el.querySelector('#f-age').value; f.minOvr = el.querySelector('#f-ovr').value; f.maxPrice = el.querySelector('#f-price').value; };
  el.querySelector('#f-go').onclick = () => { read(); redraw(); };
  el.querySelectorAll('select').forEach((s) => (s.onchange = () => { read(); redraw(); }));
  el.querySelector('#f-name').onkeydown = (e) => { if (e.key === 'Enter') { read(); redraw(); } };
  el.querySelectorAll('[data-watch]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation(); const id = +b.dataset.watch; const W = w.scouting.watch;
    if (W.includes(id)) w.scouting.watch = W.filter((x) => x !== id); else W.push(id);
    redraw();
  }));
  el.querySelectorAll('tr[data-p]').forEach((tr) => (tr.onclick = () => playerModal(app, w.players[tr.dataset.p], { onChange: redraw })));
}

// ------------------------------------------------------------------ actions used by the player profile
export function transferActions(app, p, onChange) {
  const w = app.world;
  if (p.loan?.out && p.loan.from === w.userClubId) {
    const r = loanReport(w, p);
    return { html: `<div class="card" style="padding:.7rem"><b>🔁 Verliehen an ${crest(r.host, 18)} ${esc(r.host.name)}</b><p>${esc(r.text)}</p><p class="muted">${p.loan.obligation ? `Kaufpflicht ab ${p.loan.obligation.apps} Einsätzen: ${money(p.loan.obligation.fee)}` : p.loan.buyOption ? `Kaufoption für ${esc(r.host.short)}: ${money(p.loan.buyOption)}` : 'Ohne Kaufoption – kommt im Sommer zurück'}</p></div>`, bind() {} };
  }
  if (p.clubId === w.userClubId && !(p.loan && p.loan.to === w.userClubId)) {
    const listed = w.transfer.listed.includes(p.id);
    const club = app.club; ensureCaptain(w, club);
    const isCap = club.captain === p.id;
    const t = traits(p);
    return {
      html: `${p.wantsTalk ? '<p class="tag y" style="display:block;padding:.45rem .6rem">💬 möchte mit dir sprechen</p>' : ''}${p.wantsOut ? '<p class="tag r" style="display:block;padding:.45rem .6rem">✈️ will den Verein verlassen</p>' : ''}${p.promise ? `<p class="muted">🤝 Versprechen: ${esc(p.promise.type)} (${Math.max(0, p.stats.apps - p.promise.base)}/${p.promise.need} Startelf-Einsätze, noch ${p.promise.of - p.promise.weeks} Wochen)</p>` : ''}
        <div class="kv"><span>Führungsqualität</span><b>${leadership(p)}${isCap ? ' · 🎖️ Kapitän' : club.vice === p.id ? ' · Vize' : ''}</b></div>
        <div class="kv"><span>Ehrgeiz · Loyalität · Temperament</span><b>${Math.round(t.ambition * 10)} · ${Math.round(t.loyalty * 10)} · ${Math.round(t.temper * 10)}</b></div>
        <div class="kv"><span>Berater</span><b>${esc(agentOf(p).name)}</b></div>
        ${p.releaseClause || p.bonus ? `<div class="kv"><span>Klauseln</span><b>${p.releaseClause ? `Ausstieg ${money(p.releaseClause)}` : ''}${p.bonus?.goal ? ` · ${money(p.bonus.goal)}/Tor` : ''}${p.bonus?.app ? ` · ${money(p.bonus.app)}/Spiel` : ''}</b></div>` : ''}
        ${p.preContract ? `<p class="tag r" style="display:block;padding:.45rem .6rem">📝 Vorvertrag bei ${esc(w.clubs[p.preContract.club]?.name || '')} – wechselt im Sommer ablösefrei</p>` : p.contract <= 1 && w.week >= 17 ? '<p class="tag y" style="display:block;padding:.45rem .6rem">⏳ Letztes Vertragsjahr – andere Vereine dürfen jetzt Vorverträge anbieten!</p>' : ''}
        <div class="row-actions" style="margin-top:.6rem"><button class="btn primary sm" data-a="talk">💬 Gespräch</button>${isCap ? '' : '<button class="btn sm" data-a="cap">🎖️ Zum Kapitän</button>'}<button class="btn sm" data-a="loanout">🔁 Verleihen</button></div>
        <div class="row-actions"><button class="btn sm" data-a="list">${listed ? 'Von Transferliste nehmen' : 'Auf Transferliste setzen'}</button><button class="btn sm" data-a="extend">Vertrag verlängern</button></div>`,
      bind(root, close) {
        root.querySelector('[data-a=list]').onclick = () => { const on = toggleListed(w, p.id); toast(on ? 'Auf der Transferliste' : 'Von der Transferliste genommen'); close(); onChange?.(); };
        root.querySelector('[data-a=extend]').onclick = () => { close(); negotiate(app, p, 'extend', onChange); };
        root.querySelector('[data-a=talk]').onclick = () => { close(); talkDialog(app, p, onChange); };
        const c = root.querySelector('[data-a=cap]'); if (c) c.onclick = () => { const msg = setCaptain(w, p.id); toast(msg || ''); close(); onChange?.(); };
        root.querySelector('[data-a=loanout]').onclick = () => { close(); loanOutDialog(app, p, onChange); };
      },
    };
  }
  if (p.loan && p.loan.to === w.userClubId) {
    return {
      html: `<div class="row-actions">${p.loan.obligation ? `<span class="muted">📜 Kaufpflicht ab ${p.loan.obligation.apps} Einsätzen (${p.stats.apps} bisher): ${money(p.loan.obligation.fee)}</span>` : p.loan.buyOption ? `<button class="btn primary sm" data-a="opt">Kaufoption ziehen (${money(p.loan.buyOption)})</button>` : '<span class="muted">Leihspieler ohne Kaufoption</span>'}</div>`,
      bind(root, close) { const b = root.querySelector('[data-a=opt]'); if (b) b.onclick = () => { const r = exerciseOption(w, p.id); toast(r.ok ? 'Kaufoption gezogen!' : r.msg); if (r.ok) { close(); onChange?.(); } }; },
    };
  }
  const price = askingPrice(w, p), lt = p.clubId ? loanTerms(w, p) : null;
  const scouting = w.scouting.assignments.some((a) => a.playerId === p.id);
  return {
    html: `<div class="kv"><span>Geforderte Ablöse</span><b>${p.clubId ? money(price) : 'ablösefrei'}</b></div>
      ${p.releaseClause ? `<div class="kv"><span>Ausstiegsklausel</span><b>${money(p.releaseClause)}</b></div>` : ''}
      <div class="kv"><span>Berater</span><b>${esc(agentOf(p).name)}</b></div>
      ${p.clubId ? `<div class="kv"><span>Vertrag</span><b>${p.contract <= 1 ? '<span class="bad">läuft im Sommer aus</span>' : `noch ${p.contract} Jahre`}${p.preContract ? ` · Vorvertrag bei ${esc(w.clubs[p.preContract.club]?.short || '')}` : ''}</b></div>` : ''}
      <div class="row-actions" style="margin-top:.7rem">
        <button class="btn primary sm" data-a="bid">${p.clubId ? 'Angebot abgeben' : 'Vertrag anbieten'}</button>
        ${canPreContract(w, p) ? '<button class="btn sm" data-a="pre">📝 Vorvertrag (ablösefrei im Sommer)</button>' : ''}
        ${lt?.possible ? '<button class="btn sm" data-a="loan">Leihe anfragen</button>' : ''}
        ${knowledge(w, p) < 100 ? `<button class="btn sm" data-a="scout" ${scouting ? 'disabled' : ''}>${scouting ? 'Scout ist unterwegs' : '🕵️ Scout schicken'}</button>` : ''}
      </div>`,
    bind(root, close) {
      root.querySelector('[data-a=bid]').onclick = () => { close(); bidDialog(app, p, onChange); };
      const pc = root.querySelector('[data-a=pre]'); if (pc) pc.onclick = () => { close(); negotiate(app, p, 'pre', onChange); };
      const l = root.querySelector('[data-a=loan]'); if (l) l.onclick = () => { close(); loanDialog(app, p, onChange); };
      const s = root.querySelector('[data-a=scout]'); if (s) s.onclick = () => { const r = assignScout(w, p.id); toast(r.ok ? `Scout beobachtet ${p.lastName} (${r.weeks} Woche(n))` : r.msg); if (r.ok) { close(); onChange?.(); } };
    },
  };
}

function bidDialog(app, p, onChange) {
  const w = app.world, ask = askingPrice(w, p), c = p.clubId ? w.clubs[p.clubId] : null;
  if (!c) { makeBid(w, p.id, 0); negotiate(app, p, 'buy', onChange); return; }
  const m = modal(`<h3>Angebot für ${esc(pname(p))}</h3><p>${crest(c, 22)} ${esc(c.name)} · Marktwert ${money(p.value)} · Forderung ca. <b>${money(ask)}</b></p>
    <label class="field">Ablösesumme${moneyInput('fee', ask, { step: 250000 })}</label>
    <input type="range" id="feeR" min="${Math.round(ask * 0.5)}" max="${Math.round(ask * 1.5)}" step="10000" value="${ask}" style="width:100%">
    <p class="muted">Dein Budget: ${money(app.club.budget)}${p.releaseClause ? ` · Ausstiegsklausel: ${money(p.releaseClause)} (wird immer akzeptiert)` : ''}</p>
    <div id="msg"></div><div class="row-actions end"><button class="btn primary" id="send">Angebot senden</button></div>`);
  const fee = m.el.querySelector('#fee'), feeR = m.el.querySelector('#feeR');
  feeR.oninput = () => (fee.value = fmtMoneyInput(feeR.value));
  fee.addEventListener('change', () => { feeR.value = readMoney(fee); });
  m.el.querySelector('#send').onclick = () => {
    const r = makeBid(w, p.id, readMoney(fee));
    const msg = m.el.querySelector('#msg');
    if (r.result === 'accepted') { m.close(); toast(`${c.short} akzeptiert ${money(r.fee)}${r.clause ? ' (Klausel)' : ''}! Jetzt Vertrag verhandeln.`); negotiate(app, p, 'buy', onChange); }
    else if (r.result === 'countered') { msg.innerHTML = `<p class="tag y" style="display:block;padding:.5rem">↩ ${esc(r.reason)}</p><button class="btn sm" id="acc">Gegenangebot (${moneyExact(r.counter)}) annehmen</button>`; msg.querySelector('#acc').onclick = () => { fee.value = fmtMoneyInput(r.counter); m.el.querySelector('#send').click(); }; }
    else msg.innerHTML = `<p class="tag r" style="display:block;padding:.5rem">✕ ${esc(r.reason)}</p>`;
  };
}

function negotiate(app, p, mode, onChange) {
  // contract poker with the agent (v2.0): wage, years, signing fee, agent fee, clauses, bonuses
  const w = app.world, club = app.club, D = demandPackage(w, p, club);
  const state = {};
  const years0 = Math.min(D.maxY, Math.max(D.minY, 3));
  const m = modal(`<h3>✍️ Vertragspoker · ${esc(pname(p))}</h3>
    <div class="pp-head" style="margin:0 0 .6rem;padding:0;background:none">${portrait(p, club, 60)}<div><p>${p.age} Jahre · ${POSITIONS[p.pos].name} · aktuelles Gehalt ${moneyExact(p.wage)}/Jahr${mode === 'pre' ? ' · <b>Vorvertrag: kommt im Sommer ablösefrei</b>' : ''}</p>
    <p>Berater: <b>${esc(D.agent.name)}</b> · ${D.agent.greed > 1.15 ? 'gilt als knallharter Verhandler' : D.agent.greed < 1 ? 'gilt als fair' : 'verhandelt zäh'} · Geduld ${D.agent.patience + 1} Runden</p>
    <p class="muted">Erwartet grob ${moneyExact(Math.ceil(D.target / 1e4) * 1e4)}/Jahr im Gesamtpaket · Laufzeit ${D.minY}–${D.maxY} Jahre · Honorar ca. ${moneyExact(D.agentFee)}</p>${D.willing ? '' : `<p class="tag r" style="display:block;padding:.4rem">${esc(D.reason)}</p>`}</div></div>
    <div class="poker">
      <label class="field">Gehalt pro Jahr${moneyInput('wage', Math.round((D.target * 0.85) / 1e4) * 1e4, { step: 50000 })}</label>
      <label class="field">Laufzeit<select id="yrs">${[1, 2, 3, 4, 5].filter((y) => y >= D.minY && y <= D.maxY).map((y) => `<option ${y === years0 ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <label class="field">Handgeld (einmalig)${moneyInput('sign', 0, { step: 100000 })}</label>
      <label class="field">Beraterhonorar (einmalig)${moneyInput('afee', Math.round((D.agentFee * 0.8) / 1e4) * 1e4, { step: 50000 })}</label>
      <label class="field">Torprämie pro Tor${moneyInput('gb', 0, { step: 5000 })}</label>
      <label class="field">Einsatzprämie pro Spiel${moneyInput('ab', 0, { step: 2500 })}</label>
      <label class="field">Ausstiegsklausel (leer = keine)${moneyInput('cl', p.releaseClause || '', { step: 5000000, placeholder: 'keine' })}</label>
    </div>
    <p class="muted small">Handgeld, Prämien und eine Ausstiegsklausel machen das Paket attraktiver als reines Gehalt. Eine niedrige Ausstiegsklausel mögen Spieler – aber reiche Klubs können sie ziehen.</p>
    <p class="muted">Gehaltsbudget: ${money(weeklyWages(w, club))} von ${money(club.wageBudget)} verplant.</p>
    <div id="msg"></div><div class="row-actions end"><button class="btn ghost" id="cancel">Abbrechen</button><button class="btn primary" id="ok">Angebot machen</button></div>`, { onClose: () => { if (mode === 'buy' && w.transfer.pending) w.transfer.pending = null; } });
  const val = (id) => Math.max(0, readMoney(m.el.querySelector(id)));
  m.el.querySelector('#cancel').onclick = () => m.close();
  m.el.querySelector('#ok').onclick = () => {
    const offer = { wage: val('#wage'), years: +m.el.querySelector('#yrs').value, signing: val('#sign'), agentFee: val('#afee'), goalBonus: val('#gb'), appBonus: val('#ab'), clause: val('#cl') || null };
    const msg = (t, bad) => (m.el.querySelector('#msg').innerHTML = `<p class="tag ${bad ? 'r' : ''}" style="display:block;padding:.5rem">${esc(t)}</p>`);
    if (offer.signing + offer.agentFee > club.budget) { msg('Handgeld und Honorar übersteigen dein Budget.', true); return; }
    if (!wageRoom(w, club, offer.wage, mode === 'extend' ? p.wage : 0)) { msg('Das Gehaltsbudget reicht dafür nicht aus.', true); return; }
    const r = pokerRound(w, p, club, offer, state);
    if (r.status === 'counter') { msg(r.msg); return; }
    if (r.status === 'broken') { msg(r.msg, true); if (mode === 'buy') w.transfer.pending = null; m.el.querySelector('#ok').disabled = true; setTimeout(() => m.close(), 1800); return; }
    // accepted
    if (mode === 'pre') signPreContract(w, p, offer);
    else if (mode === 'extend') { p.wage = offer.wage; p.contract = Math.max(p.contract, offer.years + 1); p.morale = Math.min(99, p.morale + 8); p.preContract = null; applyPackage(w, p, club, offer); }
    else { const pend = w.transfer.pending; if (!pend) { msg('Keine Verhandlung offen.', true); return; } executeTransfer(w, p, p.clubId ? w.clubs[p.clubId] : null, club, pend.fee, offer.wage, offer.years); w.transfer.pending = null; applyPackage(w, p, club, offer); }
    m.close(); toast(mode === 'extend' ? `Vertrag mit ${p.lastName} verlängert` : mode === 'pre' ? `📝 Vorvertrag mit ${p.lastName}!` : `✍️ ${p.lastName} unterschreibt bei ${club.short}!`); onChange?.();
  };
}

function loanDialog(app, p, onChange) {
  const w = app.world, t = loanTerms(w, p);
  const m = modal(`<h3>Leihe · ${esc(pname(p))}</h3><p>Leihgebühr <b>${money(t.fee)}</b> · Gehalt ${money(p.wage)}/Jahr · Leihe bis Saisonende</p>
    <label class="slider"><span>Gehaltsübernahme <b id="ws">75 %</b></span><div><input type="range" id="share" min="25" max="100" step="5" value="75"></div></label>
    <div class="radio-row"><label><input type="radio" name="lo" value="" > Ohne Option</label><label><input type="radio" name="lo" value="option" checked> Kaufoption (${money(t.buyOption)})</label><label><input type="radio" name="lo" value="obligation"> Kaufpflicht ab 12 Einsätzen (${money(Math.round(t.buyOption * 0.9 / 1e5) * 1e5)}) – billigere Leihgebühr-Verhandlung</label></div>
    <div id="msg"></div><div class="row-actions end"><button class="btn primary" id="ok">Leihe anfragen</button></div>`);
  const sh = m.el.querySelector('#share'); sh.oninput = () => (m.el.querySelector('#ws').textContent = sh.value + ' %');
  m.el.querySelector('#ok').onclick = () => {
    const r = requestLoan(w, p.id, +sh.value / 100, m.el.querySelector('input[name=lo]:checked').value || false);
    if (r.ok) { m.close(); toast(`${p.lastName} kommt auf Leihbasis!`); onChange?.(); }
    else m.el.querySelector('#msg').innerHTML = `<p class="tag r" style="display:block;padding:.5rem">${esc(r.msg)}</p>`;
  };
}

// ------------------------------------------------------------------ talks & loans (v0.9)
function talkDialog(app, p, onChange) {
  const w = app.world;
  const m = modal(`<h3>💬 Gespräch mit ${esc(pname(p))}</h3><p class="muted">${esc(p.personality)} · Moral ${Math.round(p.morale)} · Form ${Math.round(p.form)}${p.wantsOut ? ' · will wechseln' : ''}</p>
    <div class="sim-opts">${TALKS.map(([k, l, d]) => `<button class="btn" data-t="${k}" ${!canTalk(w, p) || (p.promise && k.startsWith('promise')) ? 'disabled' : ''}><b>${l}</b><small>${esc(d)}</small></button>`).join('')}</div><div id="reply"></div>`);
  m.el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => {
    const r = talk(w, p.id, b.dataset.t, newRng(w));
    m.el.querySelectorAll('[data-t]').forEach((x) => (x.disabled = true));
    m.el.querySelector('#reply').innerHTML = `<div class="card talk-reply"><p>${esc(r.reply)}</p><small class="${r.mood >= 0 ? 'good' : 'bad'}">Moral ${r.mood >= 0 ? '+' : ''}${r.mood}</small></div>`;
    app.autosave?.(); onChange?.();
  }));
}

function loanOutDialog(app, p, onChange) {
  const w = app.world;
  const r = loanOutOffers(w, p.id, newRng(w));
  if (!r.ok) { toast(r.msg); return; }
  const m = modal(`<h3>🔁 Leihanfragen für ${esc(pname(p))}</h3><p class="muted">Leihe bis Saisonende. Alle vier Wochen gibt es Leihberichte, Einsätze beim Gastverein zählen für die Entwicklung.</p>
    <div class="sim-opts">${r.offers.map((o, i) => { const c = w.clubs[o.club]; return `<button class="btn" data-o="${i}"><b>${crest(c, 20)} ${esc(c.name)}</b><small>Leihgebühr ${money(o.fee)} · übernimmt ${Math.round(o.share * 100)} % Gehalt${o.kind === 'option' ? ` · Kaufoption ${money(o.buy)}` : o.kind === 'obligation' ? ` · Kaufpflicht ab ${o.apps} Einsätzen: ${money(o.buy)}` : ' · ohne Option'}</small></button>`; }).join('')}</div>`);
  m.el.querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => { acceptLoanOut(w, p.id, r.offers[+b.dataset.o]); m.close(); toast(`${p.lastName} ist verliehen.`); app.autosave?.(); onChange?.(); }));
}

function leihen(app, el, redraw) {
  const w = app.world;
  const outs = loanedOut(w), ins = loanedIn(w);
  const row = (p) => { const r = loanReport(w, p); return `<tr data-p="${p.id}"><td class="nm">${portrait(p, w.clubs[p.clubId], 28)}<span>${esc(pname(p))}</span></td><td>${p.pos}</td><td>${p.age}</td><td>${crest(p.loan.out ? r.host : w.clubs[p.loan.from], 18)} ${esc((p.loan.out ? r.host : w.clubs[p.loan.from]).short)}</td><td>${r.apps}</td><td>${r.goals}</td><td>${p.stats.rating ? p.stats.rating.toFixed(1) : '–'}</td><td class="${r.dev > 0 ? 'good' : r.dev < 0 ? 'bad' : ''}">${r.dev >= 0 ? '+' : ''}${r.dev}</td><td>${esc(r.grade)}</td><td>${p.loan.obligation ? `Pflicht ab ${p.loan.obligation.apps}: ${money(p.loan.obligation.fee)}` : p.loan.buyOption ? `Option ${money(p.loan.buyOption)}` : '–'}</td></tr>`; };
  const head = '<thead><tr><th>Spieler</th><th>Pos</th><th>Alter</th><th>Verein</th><th>Spiele</th><th>Tore</th><th>Note</th><th>Entw.</th><th>Rolle</th><th>Option</th></tr></thead>';
  el.innerHTML = `<div class="card table-wrap"><h3>➡️ Verliehene Spieler (${outs.length})</h3>${outs.length ? `<table class="tbl">${head}<tbody>${outs.map(row).join('')}</tbody></table>` : '<p class="muted">Keine Spieler verliehen. Im Spielerprofil eigener Spieler: „Verleihen“.</p>'}</div>
    <div class="card table-wrap"><h3>⬅️ Ausgeliehene Spieler (${ins.length})</h3>${ins.length ? `<table class="tbl">${head}<tbody>${ins.map(row).join('')}</tbody></table>` : '<p class="muted">Keine Leihspieler im Kader. Auf dem Transfermarkt: Spielerprofil → „Leihe anfragen“.</p>'}</div>`;
  el.querySelectorAll('tr[data-p]').forEach((tr) => (tr.onclick = () => playerModal(app, w.players[tr.dataset.p], { onChange: redraw })));
}

// ------------------------------------------------------------------ scouting
function scouting(app, el, redraw) {
  const w = app.world, S = w.scouting;
  const watch = S.watch.map((id) => w.players[id]).filter(Boolean);
  el.innerHTML = `<div class="grid-2">
    <div class="card"><h3>Scouts im Einsatz (${S.assignments.length}/${maxScouts(w)})</h3>
      ${S.assignments.map((a) => { const p = w.players[a.playerId]; return `<div class="mini-player" data-p="${p.id}">${portrait(p, w.clubs[p.clubId], 34)}<span>${esc(pname(p))}<br><small>${p.pos} · ${p.age} J.</small></span><small>noch ${a.weeksLeft} Wo.</small></div>`; }).join('') || '<p class="muted">Kein Scout unterwegs. Schicke Scouts über das Spielerprofil auf dem Transfermarkt los.</p>'}
      <p class="muted">Mehr Scouts gibt es mit einer besseren Jugendakademie (Finanzen & Ausbau).</p></div>
    <div class="card"><h3>Scoutingberichte</h3>
      ${Object.entries(S.reports).slice(-8).reverse().map(([id, r]) => { const p = w.players[id]; if (!p) return ''; return `<div class="mini-player" data-p="${p.id}">${portrait(p, w.clubs[p.clubId], 34)}<span>${esc(pname(p))} <b class="${ratingClass(p.ovr)}">${p.ovr}</b> / Pot. ${p.pot}<br><small>${esc(r.rec)}</small></span></div>`; }).join('') || '<p class="muted">Noch keine Berichte.</p>'}</div>
  </div>
  ${netHtml(w)}
  <div class="card"><h3>Beobachtungsliste (${watch.length})</h3>
    <div class="pcard-grid">${watch.map((p) => miniCard(w, p)).join('') || '<p class="muted">Markiere Spieler auf dem Transfermarkt mit ☆.</p>'}</div></div>`;
  el.querySelectorAll('[data-p]').forEach((d) => (d.onclick = () => playerModal(app, w.players[d.dataset.p], { onChange: redraw })));
  bindNet(app, el, redraw);
}

// scouting network (v0.9)
function netHtml(w) {
  const N = ensureNet(w);
  const finds = N.finds.slice(0, 5);
  return `<div class="card"><div class="page-head" style="margin:0"><h3>🌍 Scouting-Netzwerk (${N.scouts.length}/${maxNetScouts(w)})</h3>${N.scouts.length < maxNetScouts(w) ? '<button class="btn sm primary" id="net-hire">+ Scout einstellen</button>' : ''}</div>
    <p class="muted">Schicke Scouts in Regionen der Welt. Sie decken dort Spieler auf, schicken alle drei Wochen Empfehlungen – und finden in exotischen Regionen unbekannte Talente ohne Verein.</p>
    ${N.scouts.map((s) => `<div class="net-row"><div><b>${esc(s.name)}</b> <span class="stars">${'★'.repeat(s.quality)}</span><small class="muted"> ${money(s.wage)}/Saison${s.region ? ` · seit ${s.weeks} Wo. in ${esc(REGIONS[s.region].name)}` : ' · ohne Auftrag'}</small></div>
      <div class="row-actions"><select class="input sm" data-reg="${s.id}"><option value="">Region wählen …</option>${Object.entries(REGIONS).map(([k, R]) => `<option value="${k}" ${s.region === k ? 'selected' : ''}>${esc(R.name)}${R.exotic ? ' ✨' : ''}</option>`).join('')}</select>
      <select class="input sm" data-pos="${s.id}">${['ALLE', ...POS_ORDER].map((p) => `<option ${s.focus.pos === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <select class="input sm" data-age="${s.id}">${[19, 21, 23, 26, 30, 40].map((a) => `<option value="${a}" ${s.focus.maxAge === a ? 'selected' : ''}>bis ${a === 40 ? 'alle' : a + ' J.'}</option>`).join('')}</select>
      <button class="btn sm ghost" data-fire="${s.id}">✕</button></div></div>`).join('') || '<p class="muted">Noch keine Scouts im Netzwerk.</p>'}
    ${finds.length ? `<h4 style="margin-top:12px">Letzte Empfehlungen</h4>${finds.map((f) => `<div class="net-find"><small class="muted">${esc(f.scout)} · ${esc(f.region)} · Woche ${f.week + 1}</small><div class="row-actions">${f.ids.map((id) => w.players[id]).filter(Boolean).map((p) => `<button class="btn sm ${p.id === f.discovered ? 'primary' : ''}" data-p="${p.id}">${p.id === f.discovered ? '✨ ' : ''}${flag(p.nation)} ${esc(p.lastName)} · ${p.pos} · ${p.age} · ${p.ovr}/${p.pot}${p.clubId ? '' : ' · vereinslos'}</button>`).join('')}</div></div>`).join('')}` : ''}
  </div>`;
}
function bindNet(app, el, redraw) {
  const w = app.world;
  el.querySelector('#net-hire')?.addEventListener('click', () => {
    const c = scoutMarket(w, newRng(w));
    const m = modal(`<h3>Scout einstellen</h3><div class="sim-opts">${c.map((x, i) => `<button class="btn" data-c="${i}"><b>${esc(x.name)} ${'★'.repeat(x.quality)}</b><small>Handgeld ${money(x.fee)} · Gehalt ${money(x.wage)}/Saison</small></button>`).join('')}</div>`);
    m.el.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { const r = hireNetScout(w, c[+b.dataset.c]); toast(r.ok ? 'Scout eingestellt – schick ihn in eine Region.' : r.msg); m.close(); redraw(); }));
  });
  const upd = (id) => sendScout(w, +id, el.querySelector(`[data-reg="${id}"]`).value || null, { pos: el.querySelector(`[data-pos="${id}"]`).value, maxAge: +el.querySelector(`[data-age="${id}"]`).value });
  el.querySelectorAll('[data-reg],[data-pos],[data-age]').forEach((s) => (s.onchange = () => { upd(s.dataset.reg || s.dataset.pos || s.dataset.age); toast('Auftrag aktualisiert'); redraw(); }));
  el.querySelectorAll('[data-fire]').forEach((b) => (b.onclick = () => { fireNetScout(w, +b.dataset.fire); redraw(); }));
}

function miniCard(w, p) {
  const e = estimate(w, p), c = p.clubId ? w.clubs[p.clubId] : null;
  const tier = e.ovr >= 80 ? 'gold' : e.ovr >= 68 ? 'silver' : 'bronze';
  return `<div class="pcard ${p.age <= 21 && e.potHi >= 82 ? 'special' : tier}" data-p="${p.id}"><div class="ovr"><b>${e.exact ? p.ovr : e.ovr}</b><span>${p.pos}</span></div><div class="flag">${flag(p.nation)}</div>
    ${portrait(p, c, 72)}<div class="nm">${esc(p.lastName)}</div><small style="color:inherit;opacity:.75">${c ? esc(c.short) : 'vereinslos'} · ${p.age} J. · ${e.exact ? `Pot. ${p.pot}` : `~${e.ovrLo}-${e.ovrHi}`}</small>
    <div class="six"><span><b>${money(askingPrice(w, p)).replace(' €', '')}</b></span></div></div>`;
}

// ------------------------------------------------------------------ incoming offers
function angebote(app, el, redraw) {
  const w = app.world;
  const offers = w.transfer.offers;
  el.innerHTML = `<div class="card"><h3>Eingehende Angebote</h3>
    ${offers.map((o) => { const p = w.players[o.playerId], c = w.clubs[o.clubId]; return `<div class="facility"><div>${crest(c, 40)}</div><div><b>${esc(c.name)}</b> bietet <b class="pos-amt">${money(o.fee)}</b> für ${esc(pname(p))} (${p.pos}, ${p.ovr})<br><small>Marktwert ${money(p.value)} · Angebot gültig bis Woche ${o.week + 3}</small></div>
      <div class="row-actions"><button class="btn primary sm" data-o="${o.id}" data-a="accept">Annehmen</button><button class="btn sm" data-o="${o.id}" data-a="sellon" title="10 % weniger Ablöse, dafür 15 % bei jedem Weiterverkauf">Annehmen + 15 % Weiterverkauf</button><button class="btn sm" data-o="${o.id}" data-a="counter" ${o.countered ? 'disabled' : ''}>Nachverhandeln</button><button class="btn sm danger" data-o="${o.id}" data-a="reject">Ablehnen</button></div></div>`; }).join('') || '<p class="muted">Keine Angebote. Setze Spieler auf die Transferliste, um Interessenten anzulocken (nur im Transferfenster).</p>'}</div>`;
  el.querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => { const r = respondOffer(w, +b.dataset.o, b.dataset.a, newRng(w)); toast(r.msg); app.render(); }));
}

// ------------------------------------------------------------------ own squad: contracts & selling
function kader(app, el, redraw) {
  const w = app.world, club = app.club;
  const ps = club.squad.map((id) => w.players[id]).sort((a, b) => a.contract - b.contract || b.ovr - a.ovr);
  el.innerHTML = `<div class="card table-wrap"><table class="tbl"><thead><tr><th>Spieler</th><th>Pos</th><th>Alter</th><th>Stärke</th><th>Gehalt/Jahr</th><th>Vertrag bis</th><th>Marktwert</th><th>Status</th><th></th></tr></thead><tbody>
    ${ps.map((p) => { const loanIn = p.loan && p.loan.to === club.id; const listed = w.transfer.listed.includes(p.id);
      return `<tr data-p="${p.id}"><td class="nm">${portrait(p, club, 26)}<span>${esc(pname(p))}</span></td><td><span class="pos pos-${POSITIONS[p.pos].group}">${p.pos}</span></td><td>${p.age}</td><td><b class="${ratingClass(p.ovr)}">${p.ovr}</b></td>
      <td>${money(p.wage)}</td><td>${loanIn ? `Leihe bis ${p.loan.until}` : `<b class="${p.contract <= 1 ? 'r-low' : ''}">${w.season + p.contract}</b>`}</td><td>${money(p.value)}</td>
      <td>${loanIn ? '<i class="tag b">Leihspieler</i>' : listed ? '<i class="tag y">Transferliste</i>' : p.contract <= 1 ? '<i class="tag r">läuft aus</i>' : ''}</td>
      <td>${loanIn ? (p.loan.buyOption ? `<button class="btn sm" data-opt="${p.id}">Option ${money(p.loan.buyOption)}</button>` : '') : `<button class="btn sm" data-ext="${p.id}">Verlängern</button> <button class="btn sm" data-list="${p.id}">${listed ? 'Runter' : 'Liste'}</button>`}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  el.querySelectorAll('[data-ext]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); negotiate(app, w.players[b.dataset.ext], 'extend', redraw); }));
  el.querySelectorAll('[data-list]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); toggleListed(w, +b.dataset.list); redraw(); }));
  el.querySelectorAll('[data-opt]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const r = exerciseOption(w, +b.dataset.opt); toast(r.ok ? 'Kaufoption gezogen' : r.msg); redraw(); }));
  el.querySelectorAll('tr[data-p]').forEach((tr) => (tr.onclick = () => playerModal(app, w.players[tr.dataset.p], { onChange: redraw })));
}

function historie(app, el) {
  const w = app.world, H = w.transfer.history.slice(0, 80);
  el.innerHTML = `<div class="card table-wrap"><table class="tbl"><thead><tr><th>Saison/Woche</th><th>Spieler</th><th>Von</th><th>Zu</th><th>Ablöse</th></tr></thead><tbody>
    ${H.map((h) => `<tr class="${h.to === w.userClubId || h.from === w.userClubId ? 'me' : ''}"><td>${h.season} · W${h.week}</td><td>${esc(h.name)}</td><td>${h.from ? `${crest(w.clubs[h.from], 18)} ${esc(w.clubs[h.from].short)}` : 'vereinslos'}</td><td>${crest(w.clubs[h.to], 18)} ${esc(w.clubs[h.to].short)}</td><td><b>${h.fee ? money(h.fee) : 'ablösefrei'}</b></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Noch keine Transfers.</td></tr>'}
    </tbody></table></div>`;
}
