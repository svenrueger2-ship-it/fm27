// v5.2 Börse screen: IPO conditions and offer, share price chart, capital increase, buyback, dividend policy.
import { esc, money, toast, confirmDialog } from '../dom.js';
import { userLeague } from '../../manager/season.js';
import { valuation, ipoChecks, canIPO, goPublic, issueShares, buyback, setDividend, SHARES, MAX_FLOAT } from '../../manager/stock.js';

function chart(hist) {
  if (hist.length < 2) return '<p class="muted">Der Kursverlauf erscheint nach dem ersten Spieltag.</p>';
  const W = 640, H = 180, ps = hist.map((h) => h.p), lo = Math.min(...ps) * 0.97, hi = Math.max(...ps) * 1.03;
  const x = (i) => (i / (hist.length - 1)) * W, y = (p) => H - ((p - lo) / (hi - lo || 1)) * H;
  const d = hist.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(h.p).toFixed(1)}`).join(' ');
  const up = ps[ps.length - 1] >= ps[0];
  return `<svg class="stock-chart" viewBox="0 0 ${W} ${H + 20}" preserveAspectRatio="none"><path d="${d} L${W} ${H} L0 ${H} Z" fill="${up ? 'rgba(61,255,160,.12)' : 'rgba(255,77,106,.12)'}"/><path d="${d}" fill="none" stroke="${up ? '#3dffa0' : '#ff4d6a'}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
    <text x="4" y="14" fill="currentColor" font-size="12" opacity=".6">${hi.toFixed(2)} €</text><text x="4" y="${H - 4}" fill="currentColor" font-size="12" opacity=".6">${lo.toFixed(2)} €</text></svg>`;
}

export function boerseScreen(app, el) {
  const w = app.world;
  let pct = 25;
  const draw = () => {
    const club = app.club, L = userLeague(w), S = club.stock;
    const val = valuation(w, club, L), price = val / SHARES;
    let body;
    if (!S?.listed) {
      const checks = ipoChecks(w, club, L);
      const cash = Math.round(SHARES * (pct / 100) * price * 0.94 / 1e5) * 1e5;
      body = `<div class="grid-2"><div class="card"><h3>📈 Börsengang vorbereiten</h3>
        <p class="muted">Verkaufe bis zu ${MAX_FLOAT} % deines Vereins an der Börse. Die Mehrheit bleibt beim Verein (50+1-Regel). Danach zählen Kurs, Aktionäre und Dividenden.</p>
        <ul class="checks">${checks.map((c) => `<li class="${c.ok ? 'good' : 'bad'}">${c.ok ? '✔' : '✘'} ${esc(c.text)}</li>`).join('')}</ul>
        <div class="kv"><span>Unternehmenswert (Schätzung)</span><b>${money(val)}</b></div>
        <div class="kv"><span>Ausgabepreis je Aktie</span><b>${price.toFixed(2)} €</b></div>
        <label class="field">Anteil an der Börse: <b id="pv">${pct} %</b><input type="range" id="pct" min="5" max="${MAX_FLOAT}" step="1" value="${pct}"></label>
        <div class="kv"><span>Erlös nach Bankgebühren (6 %)</span><b id="cash">${money(cash)}</b></div>
        <div class="row-actions end"><button class="btn primary" id="ipo" ${canIPO(w, club, L) ? '' : 'disabled'}>🔔 Börsengang starten</button></div></div>
        <div class="card"><h3>So funktioniert's</h3><ul class="muted small">
          <li>Der Kurs bewegt sich jede Woche: Siege, Tabellenplatz und Finanzen treiben ihn, dazu etwas Marktrauschen.</li>
          <li>Mit einer <b>Kapitalerhöhung</b> holst du später weiteres Geld – das verwässert den Kurs.</li>
          <li>Per <b>Aktienrückkauf</b> holst du Anteile zurück. Kaufst du alles zurück, geht der Verein von der Börse.</li>
          <li>Am letzten Spieltag zahlt der Verein die festgelegte <b>Dividende</b>. Keine Dividende ärgert die Aktionäre.</li>
          <li>Sinkt die Aktionärsstimmung stark, setzt das den Vorstand unter Druck.</li></ul></div></div>`;
    } else {
      const ch = (S.price / S.ipoPrice - 1) * 100;
      const last = S.history.at(-2)?.p ?? S.price, wk = (S.price / last - 1) * 100;
      const cap = S.price * SHARES;
      body = `<div class="sb-top"><div class="card"><h3>${esc(club.short)} · Aktie</h3><div class="stock-head"><b>${S.price.toFixed(2)} €</b><span class="${wk >= 0 ? 'good' : 'bad'}">${wk >= 0 ? '▲' : '▼'} ${wk.toFixed(1)} % Woche</span><span class="${ch >= 0 ? 'good' : 'bad'}">${ch >= 0 ? '+' : ''}${ch.toFixed(1)} % seit Börsengang</span></div>${chart(S.history)}</div>
        <div class="card sb-stats">
          <div class="sb-kpi"><small>Börsenwert</small><b>${money(cap)}</b></div>
          <div class="sb-kpi"><small>Streubesitz</small><b>${S.float} %</b><em>Verein hält ${100 - S.float} %</em></div>
          <div class="sb-kpi"><small>Aktionärsstimmung</small><b>${Math.round(S.mood)}</b><div class="meter"><i style="width:${Math.round(S.mood)}%"></i></div></div>
          <div class="sb-kpi"><small>Eingenommen</small><b>${money(S.raised)}</b></div>
          <div class="sb-kpi"><small>Ausgezahlte Dividenden</small><b>${money(S.paid)}</b></div>
          <div class="sb-kpi"><small>Börsengang</small><b>Saison ${S.ipoSeason}</b><em>Ausgabepreis ${S.ipoPrice.toFixed(2)} €</em></div>
        </div></div>
        <div class="grid-2"><div class="card"><h3>💰 Kapital</h3>
          <label class="field">Menge: <b id="pv">${pct} %</b><input type="range" id="pct" min="1" max="${Math.max(1, Math.max(MAX_FLOAT - S.float, S.float))}" value="${Math.min(pct, Math.max(1, Math.max(MAX_FLOAT - S.float, S.float)))}"></label>
          <div class="row-actions"><button class="btn primary" id="issue" ${S.float >= MAX_FLOAT ? 'disabled' : ''}>Kapitalerhöhung</button><button class="btn" id="buy">Aktien zurückkaufen</button></div>
          <p class="muted small" id="hint"></p></div>
          <div class="card"><h3>💶 Dividende</h3><p class="muted small">Anteil vom Saisongewinn, der am letzten Spieltag an die Aktionäre geht.</p>
          <div class="opt-row">${[0, 0.1, 0.2, 0.3, 0.5].map((r) => `<button class="chip-btn ${S.dividend === r ? 'on' : ''}" data-div="${r}">${r ? Math.round(r * 100) + ' %' : 'Keine'}</button>`).join('')}</div></div></div>`;
    }
    el.innerHTML = `<div class="page"><div class="page-head"><h2>📈 Börse</h2></div>${body}</div>`;
    const $ = (s) => el.querySelector(s);
    const slider = $('#pct');
    const hint = () => {
      if (!S?.listed) { $('#pv').textContent = `${pct} %`; $('#cash').textContent = money(Math.round(SHARES * (pct / 100) * price * 0.94 / 1e5) * 1e5); return; }
      $('#pv').textContent = `${pct} %`;
      $('#hint').textContent = `Kapitalerhöhung bringt ca. ${money(SHARES * (Math.min(pct, MAX_FLOAT - S.float) / 100) * S.price * 0.92)} · Rückkauf kostet ca. ${money(SHARES * (Math.min(pct, S.float) / 100) * S.price * 1.06)}`;
    };
    if (slider) { pct = +slider.value; slider.oninput = (e) => { pct = +e.target.value; hint(); }; hint(); }
    $('#ipo') && ($('#ipo').onclick = async () => {
      if (!(await confirmDialog(`${pct} % von ${club.name} an die Börse bringen? Das lässt sich nur durch teuren Rückkauf rückgängig machen.`, 'Börsengang'))) return;
      const r = goPublic(w, club, L, pct); toast(r.ok ? `Börsengang geglückt: ${money(r.cash)}` : r.msg); draw();
    });
    $('#issue') && ($('#issue').onclick = async () => { if (!(await confirmDialog(`Neue Aktien über ${Math.min(pct, MAX_FLOAT - S.float)} % ausgeben?`, 'Ausgeben'))) return; const r = issueShares(w, club, pct); toast(r.ok ? `Kapitalerhöhung: ${money(r.cash)}` : r.msg); draw(); });
    $('#buy') && ($('#buy').onclick = async () => { if (!(await confirmDialog(`${Math.min(pct, S.float)} % der Aktien zurückkaufen?`, 'Zurückkaufen'))) return; const r = buyback(w, club, pct); toast(r.ok ? `Rückkauf: ${money(r.cost)}` : r.msg); draw(); });
    el.querySelectorAll('[data-div]').forEach((b) => (b.onclick = () => { setDividend(club, +b.dataset.div); toast('Dividendenpolitik gespeichert'); draw(); }));
  };
  draw();
}
