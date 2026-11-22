// Achievements, challenge status and career statistics.
import { esc, money } from '../dom.js';
import { ACHIEVEMENTS, CHALLENGES, ensureStats, globalAchievements } from '../../manager/achievements.js';

export function achievementsScreen(app, el) {
  const w = app.world, S = ensureStats(w), got = w.achievements || {}, G = globalAchievements();
  const C = w.challenge, def = C && CHALLENGES.find((c) => c.id === C.id);
  const n = Object.keys(got).length;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  el.innerHTML = `<div class="page"><div class="page-head"><h2>🏅 Erfolge & Statistik</h2><span class="chip">${n}/${ACHIEVEMENTS.length} freigeschaltet</span></div>
    <div class="grid2">
      <div class="card"><h3>🎖️ Herausforderung</h3>${C ? `<p><b>${esc(def.name)}</b> – ${esc(def.desc)}</p><p class="${C.status === 'won' ? 'good' : C.status === 'failed' ? 'bad' : ''}"><b>${C.status === 'won' ? '✅ Geschafft!' : C.status === 'failed' ? `❌ Gescheitert: ${esc(C.note)}` : `⏳ Läuft · ${esc(C.note || `Start ${C.start}`)}`}</b></p>` : '<p class="muted">Keine Herausforderung gewählt. Beim Start einer neuen Karriere kannst du eine auswählen.</p>'}
        <h3 style="margin-top:14px">📊 Bilanz</h3>
        <div class="kv"><span>Pflichtspiele</span><b>${S.matches} (${S.w} S · ${S.d} U · ${S.l} N)</b></div>
        <div class="kv"><span>Siegquote</span><b>${pct(S.w, S.matches)} %</b></div>
        <div class="kv"><span>Tore</span><b>${S.gf}:${S.ga}</b></div>
        <div class="kv"><span>Transfers</span><b>${S.bought} Zugänge (${money(S.spent)}) · ${S.sold} Abgänge (${money(S.earned)})</b></div>
        <div class="kv"><span>Transferbilanz</span><b class="${S.earned - S.spent >= 0 ? 'good' : 'bad'}">${money(S.earned - S.spent)}</b></div>
        <div class="kv"><span>Teuerster Einkauf</span><b>${S.maxBuy ? `${esc(S.maxBuy.name)} · ${money(S.maxBuy.fee)}` : '–'}</b></div>
        <div class="kv"><span>Teuerster Verkauf</span><b>${S.maxSell ? `${esc(S.maxSell.name)} · ${money(S.maxSell.fee)}` : '–'}</b></div>
        <div class="kv"><span>Titel</span><b>${(w.career?.titles || []).length}</b></div>
        <div class="kv"><span>U19-Talente hochgezogen</span><b>${S.youthPromoted}</b></div>
      </div>
      <div class="card"><h3>🏅 Erfolge</h3><div class="ach-grid">${ACHIEVEMENTS.map((a) => { const g = got[a.id]; return `<div class="ach ${g ? 'on' : G[a.id] ? 'other' : ''}" title="${esc(a.desc)}"><span>${a.icon}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${g ? `<small class="good">Saison ${g.season}/${String((g.season + 1) % 100).padStart(2, '0')}</small>` : G[a.id] ? '<small class="muted">in einem anderen Spielstand erreicht</small>' : ''}</div></div>`; }).join('')}</div></div>
    </div></div>`;
}
