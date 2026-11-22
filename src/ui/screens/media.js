// Media screen: newspaper front page, social feed, press quotes, records and hall of fame.
import { crest, esc, flag } from '../dom.js';
import { ensureMedia, ensureRecords, hallOfFame, leagueRecords } from '../../manager/media.js';

export function mediaScreen(app, el) {
  const w = app.world;
  app.mediaTab ||= 'zeitung';
  const draw = () => {
    const M = ensureMedia(w), R = ensureRecords(w), tab = app.mediaTab;
    let body = '';
    if (tab === 'zeitung') {
      const [top, ...rest] = M.headlines;
      body = top ? `<div class="paper"><div class="paper-head">${esc(top.paper)} <small>Saison ${top.season}/${String((top.season + 1) % 100).padStart(2, '0')} · ${top.cup ? 'Pokal' : `${top.week + 1}. Spieltag`}</small></div>
        <h1 class="tone-${top.tone}">${esc(top.title)}</h1><p class="paper-sub">${esc(top.sub)} <b>${esc(top.score)}</b></p>
        ${M.quotes[0] ? `<blockquote>„${esc(M.quotes[0].text)}“<cite>– der Trainer auf der Pressekonferenz</cite></blockquote>` : ''}
        <div class="paper-cols">${rest.slice(0, 9).map((h) => `<article><small>${esc(h.paper)} · ${h.cup ? 'Pokal' : `${h.week + 1}. Spieltag`}</small><h3 class="tone-${h.tone}">${esc(h.title)}</h3><p>${esc(h.score)} – ${esc(h.sub)}</p></article>`).join('')}</div></div>`
        : '<div class="card"><p class="muted">Noch keine Berichte. Nach deinem ersten Spiel schreibt die Presse über deinen Verein.</p></div>';
    } else if (tab === 'social') {
      body = `<div class="feed">${M.feed.slice(0, 40).map((f) => `<div class="post ${f.kind}"><div class="ava">${f.kind === 'press' ? '📰' : f.club != null ? crest(w.clubs[f.club], 30) : '👤'}</div><div><b>${esc(f.name)}</b>${f.verified ? ' <span class="ver">✔</span>' : ''} <small class="muted">${esc(f.user)} · ${f.cup ? '' : `Woche ${f.week + 1}`}</small><p>${esc(f.text)}</p><small class="muted">❤️ ${f.likes.toLocaleString('de-DE')}</small></div></div>`).join('') || '<p class="muted">Noch keine Beiträge.</p>'}</div>`;
    } else if (tab === 'quotes') {
      body = `<div class="card">${M.quotes.map((q) => `<div class="quote"><small class="muted">Saison ${q.season}/${String((q.season + 1) % 100).padStart(2, '0')}, Woche ${q.week + 1} · ${esc(q.q)}</small><p>„${esc(q.text)}“</p></div>`).join('') || '<p class="muted">Noch keine Zitate. Gib nach dem Spiel eine Pressekonferenz.</p>'}</div>`;
    } else {
      const H = hallOfFame(w), LR = leagueRecords(w);
      const rec = (l, r) => `<div class="kv"><span>${l}</span><b>${r ? `${esc(r.text)} <small class="muted">(${r.season}/${String((r.season + 1) % 100).padStart(2, '0')})</small>` : '–'}</b></div>`;
      body = `<div class="grid2"><div class="card"><h3>📈 Vereinsrekorde (deine Amtszeit)</h3>${rec('Höchster Sieg', R.biggestWin)}${rec('Höchste Niederlage', R.biggestLoss)}${rec('Torreichstes Spiel', R.mostGoalsGame)}
          <div class="kv"><span>Längste Serie ohne Niederlage</span><b>${R.unbeatenMax} Spiele</b></div>
          <div class="kv"><span>Beste Saison</span><b>${R.bestSeason ? `${R.bestSeason.pts} Punkte, Platz ${R.bestSeason.rank} (${R.bestSeason.season}/${String((R.bestSeason.season + 1) % 100).padStart(2, '0')})` : '–'}</b></div>
          <h3 style="margin-top:14px">🏆 Rekordmeister (seit Spielbeginn)</h3>${LR.champions.map((c) => `<p>${crest(c.club, 18)} ${esc(c.club.name)} – ${c.n}×</p>`).join('') || '<p class="muted">Nach der ersten Saison.</p>'}
          <h4>Meiste Punkte in einer Saison</h4>${LR.mostPoints.map((r) => `<p class="small">${crest(r.club, 16)} ${esc(r.club.short)} ${r.pts} Pkt. (${r.season}/${String((r.season + 1) % 100).padStart(2, '0')}, ${esc(r.league)})</p>`).join('') || '<p class="muted">–</p>'}</div>
        <div class="card table-wrap"><h3>🌟 Hall of Fame</h3><p class="muted">Die Legenden deiner Vereine – Einsätze, Tore, Titel und Treue über alle Saisons.</p>
          <table class="tbl compact"><thead><tr><th>#</th><th>Spieler</th><th>Saisons</th><th>Spiele</th><th>Tore</th><th>Vorl.</th><th>Titel</th><th>Ø</th></tr></thead><tbody>
          ${H.slice(0, 20).map((l, i) => `<tr><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td>${flag(l.nation)} ${esc(l.name)} <small class="muted">${l.pos} · ${esc(w.clubs[l.club]?.short || '')}</small></td><td>${l.seasons}</td><td>${l.apps}</td><td>${l.goals}</td><td>${l.assists}</td><td>${l.titles}</td><td>${l.avg || '–'}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Die Hall of Fame füllt sich nach der ersten Saison.</td></tr>'}</tbody></table></div></div>`;
    }
    el.innerHTML = `<div class="page"><div class="page-head"><h2>📰 Medien</h2></div>
      <div class="tabs">${[['zeitung', '📰 Zeitung'], ['social', '💬 Social Media'], ['quotes', '🎤 Zitate'], ['records', '🏆 Rekorde & Hall of Fame']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>${body}</div>`;
    el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { app.mediaTab = b.dataset.t; draw(); }));
  };
  draw();
}
