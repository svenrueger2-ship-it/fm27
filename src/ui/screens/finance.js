// Finances & club development: balance chart, season income/expenses, ledger, ticket prices,
// facility upgrades and stadium expansion.
import { FACILITIES, facilityCost, upgradeFacility, expandStadium, stadiumExpansionCost, attendance, weeklyWages, emptySeason } from '../../manager/economy.js';
import { userLeague, computeTable } from '../../manager/season.js';
import { esc, money, toast, confirmDialog, modal } from '../dom.js';
import { ensureSponsors, sponsorOffers, signSponsor, SPONSOR_SLOTS } from '../../manager/events.js';
import { newRng } from '../../manager/season.js';
import { tvShare, tvTable, TV_KEYS, topGameOf, topGameBonus } from '../../manager/tvmoney.js';
import { ensureBiz, shopCost, memberIncome, upgradeShop, answerInvestor } from '../../manager/clubbiz.js';

const LABELS = { stock: 'Börse', hospitality: 'VIP & Hospitality', tickets: 'Tickets', tv: 'TV-Gelder', sponsors: 'Sponsoren', merch: 'Merchandising', prize: 'Prämien', transfersIn: 'Transfererlöse', wages: 'Gehälter', facilities: 'Unterhalt', construction: 'Bau & Ausbau', transfersOut: 'Transferausgaben' };
const COLORS = { stock: '#9be15d', hospitality: '#ffe08a', tickets: '#3dffa0', tv: '#3fd8ff', sponsors: '#4d8dff', merch: '#b48cff', prize: '#ffd24a', transfersIn: '#7cffcb', wages: '#ff4d6a', facilities: '#ff9a73', construction: '#ffb84d', transfersOut: '#ff6fb0' };
const ICONS = { training: '🏋️', youth: '🌱', medical: '🩺' };

function lineChart(hist) {
  if (hist.length < 2) return '<p class="muted">Der Verlauf erscheint nach den ersten Spieltagen.</p>';
  const W = 600, H = 220, P = 30;
  const vals = hist.map((h) => h.balance), min = Math.min(0, ...vals), max = Math.max(...vals), r = max - min || 1;
  const x = (i) => P + (i / (hist.length - 1)) * (W - P - 8), y = (v) => H - 20 - ((v - min) / r) * (H - 40);
  const d = hist.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(h.balance).toFixed(1)}`).join(' ');
  const ticks = [min, (min + max) / 2, max].map((v) => `<text x="2" y="${y(v) + 4}" fill="#8ea2c4" font-size="10">${(v / 1e6).toFixed(0)}M</text><line x1="${P}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(120,160,230,.12)"/>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd8ff" stop-opacity=".5"/><stop offset="1" stop-color="#3fd8ff" stop-opacity="0"/></linearGradient></defs>
    ${ticks}${min < 0 ? `<line x1="${P}" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="#ff4d6a" stroke-dasharray="4 4"/>` : ''}
    <path d="${d} L ${x(hist.length - 1)} ${H - 20} L ${P} ${H - 20} Z" fill="url(#fg)"/><path d="${d}" fill="none" stroke="#3fd8ff" stroke-width="2.5"/></svg>`;
}

function donut(parts) {
  const total = parts.reduce((s, p) => s + p.v, 0);
  if (!total) return '<svg class="donut" viewBox="0 0 160 160"><circle cx="80" cy="80" r="70" fill="none" stroke="rgba(120,160,230,.15)" stroke-width="22"/><text x="80" y="84" text-anchor="middle" fill="#8ea2c4" font-size="12">noch leer</text></svg>';
  let a = -Math.PI / 2;
  const arcs = parts.map((p) => {
    const a2 = a + (p.v / total) * Math.PI * 2;
    const large = a2 - a > Math.PI ? 1 : 0;
    const r = 70, cx = 80, cy = 80;
    const path = `M ${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r} A ${r} ${r} 0 ${large} 1 ${cx + Math.cos(a2) * r} ${cy + Math.sin(a2) * r}`;
    a = a2;
    return `<path d="${path}" fill="none" stroke="${p.c}" stroke-width="22"/>`;
  }).join('');
  return `<svg class="donut" viewBox="0 0 160 160">${arcs}<text x="80" y="84" text-anchor="middle" fill="#eef3fb" font-size="14" font-weight="800">${money(total).replace(' €', '')}</text></svg>`;
}

export function financeScreen(app, el) {
  const w = app.world;
  const draw = () => {
    const club = app.club, F = club.finance, L = userLeague(w);
    const S = F.season || emptySeason();
    const inc = ['tickets', 'hospitality', 'tv', 'sponsors', 'merch', 'prize', 'transfersIn', 'stock'].map((k) => ({ k, v: Math.max(0, S[k] || 0) }));
    const exp = ['wages', 'facilities', 'construction', 'transfersOut', 'stock'].map((k) => ({ k, v: Math.abs(Math.min(0, S[k] || 0)) }));
    const sumI = inc.reduce((s, x) => s + x.v, 0), sumE = exp.reduce((s, x) => s + x.v, 0);
    const wages = weeklyWages(w, club);
    const rank = computeTable(L).findIndex((r) => r.id === club.id) + 1;
    const att = attendance(club, L, rank);
    el.innerHTML = `<div class="page"><div class="page-head"><h2>Finanzen & Vereinsentwicklung</h2></div>
      <div class="grid-4">
        <div class="card"><h3>💶 Kontostand</h3><b style="font-family:var(--display);font-size:2rem" class="${club.budget < 0 ? 'neg-amt' : ''}">${money(club.budget)}</b>${club.transferBudget != null ? `<p class="muted">Transferbudget vom Vorstand: <b>${money(Math.max(0, Math.min(club.budget, club.transferBudget)))}</b> · Verkäufe füllen es zur Hälfte wieder auf.</p>` : '<p class="muted">Ist zugleich dein Transferbudget.</p>'}</div>
        <div class="card"><h3>📄 Gehaltsbudget</h3><b style="font-family:var(--display);font-size:1.5rem">${money(wages)}</b><small> / ${money(club.wageBudget)}</small><div class="meter" style="margin-top:.5rem"><i style="width:${Math.min(100, (wages / club.wageBudget) * 100)}%;${wages > club.wageBudget ? 'background:#ff4d6a' : ''}"></i></div></div>
        <div class="card"><h3>👥 Zuschauer</h3><b style="font-family:var(--display);font-size:1.5rem">${(F.lastAttendance || att).toLocaleString('de-DE')}</b><small> / ${club.stadium.capacity.toLocaleString('de-DE')}</small><p class="muted">Prognose nächstes Heimspiel: ${att.toLocaleString('de-DE')}</p></div>
        <div class="card"><h3>📊 Saisonbilanz</h3><b style="font-family:var(--display);font-size:1.5rem" class="${sumI - sumE >= 0 ? 'pos-amt' : 'neg-amt'}">${sumI - sumE >= 0 ? '+' : ''}${money(sumI - sumE)}</b><p class="muted">Einnahmen ${money(sumI)} · Ausgaben ${money(sumE)}</p></div>
      </div>
      ${(() => { const B = ensureBiz(w, club), o = B.investorOffer; return `<div class="grid-2">
        <div class="card"><h3>🏛️ Verein & Mitglieder</h3>
          <div class="kv"><span>Mitglieder</span><b>${B.members.toLocaleString('de-DE')} · ${money(memberIncome(club))}/Saison</b></div>
          <div class="kv"><span>Fanshop</span><b>Stufe ${B.shop}/5 (+${(B.shop - 1) * 12} % Merchandising) ${B.shop < 5 ? `<button class="btn sm" id="shop">Ausbauen · ${money(shopCost(club))}</button>` : ''}</b></div>
          <div class="kv"><span>Eigentümer</span><b>${B.owner ? `${esc(B.owner.name)} (${esc(B.owner.type)}) · ${B.owner.share} %${B.owner.majority ? ' · Mehrheit' : ''}` : 'Mitgliedergeführter Verein'}</b></div>
          ${B.owner ? `<div class="kv"><span>Erwartung des Investors</span><b>${esc(B.owner.demand)}</b></div>` : ''}
          <div class="kv"><span>Lizenz</span><b class="${B.licence?.status === 'erteilt' || !B.licence ? 'good' : 'bad'}">${B.licence ? `${esc(B.licence.status)} (${B.licence.season}/${String((B.licence.season + 1) % 100).padStart(2, '0')})` : 'Prüfung am Saisonende'}${B.transferBan ? ' · Transfersperre bis Winter' : ''}</b></div>
          ${club.budget < 0 ? `<p class="bad small">💸 Negativer Kontostand: Zinsen fallen an. Bleibt das Konto am Saisonende im Minus, gibt es Auflagen (Punktabzug, Transfersperre) – bei hohen Schulden droht der Lizenzentzug.</p>` : ''}
        </div>
        <div class="card"><h3>🏦 Investoren</h3>${o ? `<p><b>${esc(o.name)}</b> (${esc(o.type)}) bietet <b>${money(o.money)}</b> für <b>${o.share} %</b> der Anteile${o.takeover ? ' – das wäre eine <b>Übernahme</b>' : ''}.</p><p class="muted">Bedingung: ${esc(o.demand)}. Fans sehen Investoren kritisch.${w.leagues.find((l) => l.id === club.leagueId).country === 'DE' ? ' In Deutschland gilt die 50+1-Regel: mehr als 49 % sind nicht möglich.' : ''}</p>
          <div class="row-actions"><button class="btn primary sm" id="inv-yes">Annehmen</button><button class="btn ghost sm" id="inv-no">Ablehnen</button></div>` : '<p class="muted">Kein Angebot. Investoren melden sich von Zeit zu Zeit – besonders, wenn das Geld knapp wird.</p>'}</div>
      </div>`; })()}
      <div class="grid-2">
        <div class="card"><h3>📈 Kontoverlauf</h3>${lineChart(F.history.slice(-60))}</div>
        <div class="card"><h3>Einnahmen & Ausgaben (Saison)</h3><div class="grid-2" style="align-items:center">
          <div style="text-align:center">${donut(inc.map((x) => ({ v: x.v, c: COLORS[x.k] })))}<small>Einnahmen</small></div>
          <div style="text-align:center">${donut(exp.map((x) => ({ v: x.v, c: COLORS[x.k] })))}<small>Ausgaben</small></div></div>
          <div class="chips" style="justify-content:flex-start">${[...inc, ...exp].filter((x) => x.v).map((x) => `<span class="chip"><span style="color:${COLORS[x.k]}">●</span> ${LABELS[x.k]} ${money(x.v)}</span>`).join('')}</div></div>
      </div>
      <div class="grid-2">
        <div class="card"><h3>🏗️ Vereinsentwicklung</h3>
          ${Object.entries(FACILITIES).map(([k, f]) => { const lvl = club.facilities[k], cost = facilityCost(club, k, L); return `<div class="facility"><div class="ic">${ICONS[k]}</div><div><b>${f.name}</b> <span class="stars">${'★'.repeat(lvl)}${'☆'.repeat(f.max - lvl)}</span><br><small>${f.desc}</small></div>
            <button class="btn sm ${lvl < f.max ? 'primary' : ''}" data-up="${k}" ${lvl >= f.max ? 'disabled' : ''}>${lvl >= f.max ? 'Maximal' : `Ausbau ${money(cost)}`}</button></div>`; }).join('')}
          <div class="facility"><div class="ic">🏟️</div><div><b>Stadionausbau</b> <small>${club.stadium.capacity.toLocaleString('de-DE')} Plätze</small><br><small>Tribünen, Ränge, Steh- und Sitzplätze, Dächer, VIP-Logen, Flutlicht und Namensrechte – mit 3D-Vorschau.</small></div>
            <button class="btn sm primary" id="stad">Zum Stadion-Baukasten →</button></div>
          <label class="slider"><span>🎟️ Ticketpreis: <b id="tp">${F.ticketPrice} €</b> <small>Höhere Preise = mehr Einnahmen pro Fan, aber weniger Zuschauer.</small></span><div><em>günstig</em><input type="range" id="price" min="8" max="120" value="${F.ticketPrice}"><em>teuer</em></div></label>
          <p class="muted" id="att">Erwartete Zuschauer: ${att.toLocaleString('de-DE')} · Einnahmen/Heimspiel ca. ${money(att * F.ticketPrice)}</p>
        </div>
        <div class="card"><h3>🤝 Sponsoren</h3>${Object.entries(SPONSOR_SLOTS).map(([k, sl]) => { const d = ensureSponsors(w, club)[k]; return `<div class="facility"><div><b>${sl.name}</b><br>${d ? `<small>${esc(d.brand)} · ${money(d.perSeason)}/Saison · noch ${d.years} Saison(s)${d.bonus ? ` · Bonus ${money(d.bonus.amount)} bei Platz ${d.bonus.rank} oder besser` : ''}${d.existing ? ' · Altvertrag' : ''}</small>` : '<small class="neg-amt">Kein Partner – hier entgeht dir Geld!</small>'}</div>
            <button class="btn sm ${d && !d.existing ? '' : 'primary'}" data-sp="${k}">${d && !d.existing ? 'Läuft' : 'Verhandeln'}</button></div>`; }).join('')}
          <p class="muted">Die Höhe der Angebote hängt von Ruf, Liga und Fanstimmung ab. Altverträge laufen zum Saisonende aus.</p></div>
        ${tvCard(w, club)}
        <div class="card"><h3>🧾 Buchungen</h3><div class="ledger">${F.ledger.slice(0, 25).flatMap((e) => e.rows.map((r) => `<div><span><small>S${e.season} W${e.week}</small> ${esc(r.label)}</span><b class="${r.amount >= 0 ? 'pos-amt' : 'neg-amt'}">${r.amount >= 0 ? '+' : ''}${money(r.amount)}</b></div>`)).join('') || '<p class="muted">Noch keine Buchungen.</p>'}</div></div>
      </div></div>`;
    el.querySelector('#shop')?.addEventListener('click', () => { const r = upgradeShop(w); toast(r.msg); draw(); });
    el.querySelector('#inv-yes')?.addEventListener('click', async () => { if (await confirmDialog('Investor wirklich einsteigen lassen? Das lässt sich nicht rückgängig machen.', 'Ja, annehmen')) { toast(answerInvestor(w, true)); draw(); } });
    el.querySelector('#inv-no')?.addEventListener('click', () => { toast(answerInvestor(w, false)); draw(); });
    el.querySelectorAll('[data-up]').forEach((b) => (b.onclick = async () => {
      const k = b.dataset.up;
      if (!(await confirmDialog(`${FACILITIES[k].name} für ${money(facilityCost(club, k, L))} ausbauen?`, 'Ausbauen'))) return;
      const r = upgradeFacility(w, club, k, L); toast(r.ok ? `${FACILITIES[k].name} ausgebaut!` : r.msg); draw();
    }));
    el.querySelector('#stad').onclick = () => app.go('stadium');
    el.querySelectorAll('[data-sp]').forEach((b) => (b.onclick = () => {
      const slot = b.dataset.sp, cur = club.sponsorDeals?.[slot];
      if (cur && !cur.existing) return toast(`Vertrag mit ${cur.brand} läuft noch ${cur.years} Saison(s).`);
      const rng = newRng(w);
      const offers = sponsorOffers(w, club, slot, rng);
      const m = modal(`<h3>🤝 ${SPONSOR_SLOTS[slot].name}: Angebote</h3><div class="sim-opts">${offers.map((o, k) => `<button class="btn" data-o="${k}"><b>${esc(o.brand)} · ${money(o.perSeason)}/Saison</b><small>${o.years} Jahre${o.bonus ? ` · +${money(o.bonus.amount)} Bonus bei Platz ${o.bonus.rank} oder besser` : ' · ohne Bonus'}</small></button>`).join('')}</div>
        <div class="row-actions end"><button class="btn" id="hag">Nachverhandeln (+12 %, Risiko)</button></div>`);
      const take = (o) => { signSponsor(w, club, o); toast(`Vertrag mit ${o.brand} unterschrieben`); m.close(); draw(); };
      m.el.querySelectorAll('[data-o]').forEach((x) => (x.onclick = () => take(offers[+x.dataset.o])));
      m.el.querySelector('#hag').onclick = () => {
        const o = offers[0];
        if (rng.chance(0.5)) { o.perSeason = Math.round(o.perSeason * 1.12 / 1e4) * 1e4; toast(`${o.brand} erhöht auf ${money(o.perSeason)}!`); take(o); }
        else { toast(`${o.brand} ist verärgert und zieht zurück.`); offers.shift(); m.el.querySelector('[data-o="0"]')?.remove(); m.el.querySelector('#hag').remove(); }
      };
    }));
    const pr = el.querySelector('#price');
    pr.oninput = () => {
      F.ticketPrice = +pr.value; el.querySelector('#tp').textContent = pr.value + ' €';
      const a = attendance(club, L, rank); el.querySelector('#att').textContent = `Erwartete Zuschauer: ${a.toLocaleString('de-DE')} · Einnahmen/Heimspiel ca. ${money(a * F.ticketPrice)}`;
    };
  };
  draw();
}

// v7.0.6: TV money card – distribution key, TV table and Topspiel bonus
function tvCard(w, club) {
  const L = userLeague(w); if (!L) return '';
  const me = tvShare(w, club, L), T = tvTable(w, L), mx = Math.max(...T.map((r) => r.total), 1);
  const labels = Object.fromEntries(TV_KEYS.map(([k, l]) => [k, l])); labels.international = 'Internationale Vermarktung (Europapokal)';
  const top = topGameOf(w, L), isTop = top && (top.h === club.id || top.a === club.id);
  const around = T.filter((r) => r.rank <= 3 || Math.abs(r.rank - me.rank) <= 1 || r.rank === T.length);
  return `<div class="card tv-card"><h3>📺 Fernsehgelder</h3>
    <div class="kv"><span>Deine TV-Gelder diese Saison</span><b>${money(me.total)}</b></div>
    <div class="kv"><span>Platz in der TV-Tabelle (${esc(L.name)})</span><b>${me.rank}. von ${T.length}</b></div>
    ${Object.entries(me.parts).map(([k, v]) => `<div class="tv-row"><span>${esc(labels[k] || k)}</span><i style="width:${Math.round((v / me.total) * 100)}%"></i><b>${money(v)}</b></div>`).join('')}
    <p class="muted small">Ausgezahlt in Wochenraten. Die Leistungssäule zählt die letzten 5 Saisons (neuere stärker) – gute Platzierungen bringen in den Folgejahren mehr Geld.</p>
    <div class="kv"><span>📡 Topspiel-Prämie</span><b>${money(topGameBonus(L))} je Live-Topspiel${isTop ? ' · <span class="good">diese Woche dabei!</span>' : ''}</b></div>
    <h4>TV-Tabelle</h4><div class="tv-table">${around.map((r) => `<div class="${r.id === club.id ? 'me' : ''}"><span>${r.rank}.</span><span>${esc(w.clubs[r.id].short)}</span><i style="width:${Math.round((r.total / mx) * 100)}%"></i><b>${money(r.total)}</b></div>`).join('')}</div>
  </div>`;
}
