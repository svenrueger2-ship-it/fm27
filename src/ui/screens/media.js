// Media screen (v5.5 Medienhaus): newspaper front page with full articles & reader, article archive,
// Social Media 2.0 (club/player/manager accounts, replies, trends, own posts), news ticker, quotes,
// records & hall of fame.
import { crest, esc, flag, modal, toast } from '../dom.js';
import { ensureMedia, ensureRecords, hallOfFame, leagueRecords } from '../../manager/media.js';
import { ensureNewsroom, PAPER_INFO, MGR_POSTS, managerPost, canPostThisWeek } from '../../manager/newsroom.js';
import { newRng } from '../../manager/season.js';

const sl = (s) => `${s}/${String((s + 1) % 100).padStart(2, '0')}`;
const TYPE = { match: '⚽ Spielbericht', rundschau: '📋 Rundschau', kolumne: '🖋️ Kolumne', interview: '🎙️ Interview', portrait: '🌱 Porträt', boulevard: '⭐ Boulevard', umfrage: '📊 Umfrage', elf: '⭐ Elf des Spieltags', geruecht: '🔎 Gerüchte', saison: '📅 Saisonbilanz' };
const fmtK = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' Mio.' : n >= 1e4 ? Math.round(n / 1000) + ' Tsd.' : (n || 0).toLocaleString('de-DE'));
const grade = (g) => g.toFixed(1).replace('.', ',');
const gCls = (g) => (g <= 2 ? 'g-top' : g <= 3 ? 'g-ok' : g <= 4 ? 'g-mid' : 'g-bad');

export function articleHtml(w, a) {
  const P = PAPER_INFO[a.paper] || { icon: '📰', motto: '' };
  const parts = [];
  if (a.poll) parts.push(`<div class="np-poll"><h4>${esc(a.poll.q)}</h4>${a.poll.opts.map(([l, v]) => `<div class="np-bar"><span>${esc(l)}</span><i style="width:${v}%"></i><b>${v} %</b></div>`).join('')}<small>${a.poll.votes.toLocaleString('de-DE')} Stimmen</small></div>`);
  if (a.xi) parts.push(`<div class="np-xi">${a.xi.map(([pos, n, c, mine]) => `<div class="${mine ? 'mine' : ''}"><small>${pos}</small><b>${esc(n)}</b><em>${esc(c)}</em></div>`).join('')}</div>`);
  if (a.results) parts.push(`<table class="np-res">${a.results.map(([h, s, x, mine]) => `<tr class="${mine ? 'mine' : ''}"><td>${esc(h)}</td><td><b>${s}</b></td><td>${esc(x)}</td></tr>`).join('')}</table>`);
  const body = (a.body || []).map((p, i) => `<p class="${i === 0 ? 'np-first' : ''}">${esc(p)}</p>`).join('');
  const qa = (a.qa || []).map(([q, r]) => `<p class="np-q">${esc(q)}</p><p class="np-a">${esc(r)}</p>`).join('');
  const side = [];
  if (a.grades?.length) side.push(`<div class="np-box"><h4>Die Noten</h4>${a.grades.map(([n, pos, g]) => `<div class="np-grade"><span>${esc(n)} <small>${pos}</small></span><b class="${gCls(g)}">${grade(g)}</b></div>`).join('')}<small class="muted">1 = Weltklasse · 6 = ungenügend</small></div>`);
  if (a.stats?.length) side.push(`<div class="np-box"><h4>Spieldaten</h4>${a.stats.map(([k, v]) => `<div class="np-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`);
  if (a.voices?.length) side.push(`<div class="np-box"><h4>Stimmen zum Spiel</h4>${a.voices.map(([who, t]) => `<blockquote>„${esc(t)}“<cite>${esc(who)}</cite></blockquote>`).join('')}</div>`);
  return `<article class="np np-${a.style || 'serioes'}">
    <header class="np-mast"><div><b>${P.icon} ${esc(a.paper)}</b><small>${esc(P.motto || '')}</small></div><small>Saison ${sl(a.season)} · Woche ${a.week + 1} · Ausgabe Nr. ${a.id}</small></header>
    <div class="np-kicker">${esc(a.kicker || TYPE[a.type] || '')}</div>
    <h1 class="tone-${a.tone}">${esc(a.title)}</h1>
    <p class="np-lead">${esc(a.lead || '')}</p>
    <div class="np-by">Von ${esc(a.author || 'Redaktion')}</div>
    <div class="np-grid"><div class="np-text">${parts.join('')}${body}${qa}</div>${side.length ? `<aside>${side.join('')}</aside>` : ''}</div>
  </article>`;
}
export function openArticle(w, id) {
  const a = ensureNewsroom(w).articles.find((x) => x.id === id);
  if (!a) return toast('Der Artikel ist nicht mehr im Archiv.');
  modal(articleHtml(w, a), { wide: true });
}

function teaser(a, big = false) {
  const P = PAPER_INFO[a.paper] || { icon: '📰' };
  const txt = a.body?.[0] || a.qa?.[0]?.[1] || (a.poll ? a.poll.opts.map(([l, v]) => `${l}: ${v} %`).join(' · ') : '') || (a.xi ? a.xi.map((x) => x[1].split(' ').slice(-1)[0]).join(', ') : '');
  return `<article class="np-teaser ${big ? 'big' : ''}" data-art="${a.id}"><small>${P.icon} ${esc(a.paper)} · ${esc(TYPE[a.type] || '')}</small><h3 class="tone-${a.tone}">${esc(a.title)}</h3><p>${esc(big ? a.lead : (txt || a.lead || '').slice(0, 150))}${!big && (txt || '').length > 150 ? '…' : ''}</p><span class="np-more">Weiterlesen →</span></article>`;
}

export function mediaScreen(app, el) {
  const w = app.world;
  app.mediaTab ||= 'zeitung';
  app.mediaFilter ||= 'all';
  const draw = () => {
    const M = ensureMedia(w), R = ensureRecords(w), tab = app.mediaTab;
    ensureNewsroom(w);
    let body = '';
    if (tab === 'zeitung') {
      const arts = M.articles;
      const custom = M.headlines.filter((h) => h.custom).slice(0, 3);
      if (!arts.length && !M.headlines.length) body = '<div class="card"><p class="muted">Noch keine Berichte. Nach deinem ersten Spiel schreibt die Presse ausführlich über deinen Verein.</p></div>';
      else {
        const lead = arts.find((a) => a.type === 'match' || a.type === 'saison') || arts[0];
        const rest = arts.filter((a) => a !== lead);
        const col = (t) => rest.filter((a) => t.includes(a.type)).slice(0, 3);
        body = `<div class="paper np-front">
          <div class="paper-head">DIE SPORTPRESSE <small>Presseschau · Saison ${sl(w.season)} · Woche ${w.week + 1}</small></div>
          <div class="np-front-grid">
            <div>${lead ? teaser(lead, true) : ''}${M.quotes[0] ? `<blockquote>„${esc(M.quotes[0].text)}“<cite>– der Trainer auf der Pressekonferenz</cite></blockquote>` : ''}
              <div class="paper-cols">${col(['match', 'rundschau', 'saison']).map((a) => teaser(a)).join('')}</div></div>
            <aside class="np-side">
              <h4>Meinung & Menschen</h4>${col(['kolumne', 'interview', 'portrait']).map((a) => teaser(a)).join('') || '<p class="small muted">Bald mehr.</p>'}
              <h4>Leute & Gerüchte</h4>${col(['boulevard', 'geruecht', 'umfrage', 'elf']).map((a) => teaser(a)).join('') || '<p class="small muted">Bald mehr.</p>'}
              ${custom.length ? `<h4>✍️ Eigene Artikel</h4>${custom.map((h) => `<article class="np-teaser"><small>${esc(h.paper)}</small><h3 class="tone-${h.tone}">${esc(h.title)}</h3><p>${esc((h.body || h.sub || '').slice(0, 140))}</p></article>`).join('')}` : ''}
            </aside>
          </div></div>`;
      }
    } else if (tab === 'archiv') {
      const f = app.mediaFilter;
      const list = M.articles.filter((a) => f === 'all' || a.type === f || a.paper === f);
      body = `<div class="card"><div class="chips">${[['all', 'Alle'], ...Object.entries(TYPE)].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
        <div class="chips" style="margin-top:6px">${Object.entries(PAPER_INFO).map(([k, P]) => `<button class="chip ${f === k ? 'on' : ''}" data-f="${esc(k)}">${P.icon} ${esc(k)}</button>`).join('')}</div></div>
        <div class="np-archive">${list.map((a) => `<div class="np-arow" data-art="${a.id}"><small>${sl(a.season)} · W${a.week + 1}</small><span>${PAPER_INFO[a.paper]?.icon || '📰'} ${esc(TYPE[a.type] || '')}</span><b class="tone-${a.tone}">${esc(a.title)}</b></div>`).join('') || '<p class="muted">Keine Artikel.</p>'}</div>`;
    } else if (tab === 'social') {
      const me = w.clubs[w.userClubId];
      const tags = {}; for (const f of M.feed.slice(0, 60)) for (const t of f.tags || []) tags[t] = (tags[t] || 0) + 1;
      const trends = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const can = canPostThisWeek(w);
      const post = (f) => `<div class="post ${f.kind}${f.mine ? ' mine' : ''}"><div class="ava">${f.kind === 'press' ? '📰' : f.kind === 'manager' ? '👔' : f.kind === 'player' ? '⚽' : f.club != null && w.clubs[f.club] ? crest(w.clubs[f.club], 30) : '👤'}</div><div class="post-b"><b>${esc(f.name)}</b>${f.verified ? ' <span class="ver">✔</span>' : ''} <small class="muted">${esc(f.user)} · Woche ${f.week + 1}</small>
        <p>${esc(f.text).replace(/\n/g, '<br>').replace(/(#[\wÄÖÜäöüß]+)/g, '<span class="htag">$1</span>')}</p>${f.photo ? '<div class="post-photo">📸</div>' : ''}
        <small class="muted post-act">❤️ ${fmtK(f.likes)}${f.shares ? ` · 🔁 ${fmtK(f.shares)}` : ''}${f.replies?.length ? ` · 💬 ${f.replies.length}` : ''}${f.article ? ` · <a href="#" data-art="${f.article}">Artikel lesen</a>` : ''}</small>
        ${(f.replies || []).map((r) => `<div class="reply ${r.rival ? 'rival' : ''}"><b>${esc(r.name)}</b> <small class="muted">${esc(r.user)}</small><p>${esc(r.text)}</p><small class="muted">❤️ ${fmtK(r.likes)}</small></div>`).join('')}</div></div>`;
      body = `<div class="grid-2 social-grid"><div class="feed">${M.feed.slice(0, 45).map(post).join('') || '<p class="muted">Noch keine Beiträge.</p>'}</div>
        <div><div class="card"><h3>${crest(me, 24)} ${esc(me.name)}</h3><div class="kv"><span>Follower (offizieller Account)</span><b>${fmtK(M.followers)}</b></div><p class="small muted">Siege, Titel und virale Posts bringen neue Follower.</p></div>
          <div class="card"><h3>✍️ Als Trainer posten</h3>${can ? `<p class="small muted">Ein Post pro Woche. Was du schreibst, hat Folgen – Fans, Mannschaft und Gegner lesen mit.</p><div class="mgr-posts">${MGR_POSTS.map((p) => `<button class="btn ghost" data-post="${p.k}">${p.icon} ${esc(p.label)}</button>`).join('')}</div>` : '<p class="muted">Du hast diese Woche schon gepostet. Nächste Woche wieder.</p>'}${M.challenge ? `<p class="tag y" style="display:block;margin-top:8px">🔥 Kampfansage läuft gegen ${esc(w.clubs[M.challenge.opp]?.name || '')}</p>` : ''}</div>
          <div class="card"><h3>📈 Trends</h3>${trends.map(([t, n]) => `<p><span class="htag">${esc(t)}</span> <small class="muted">${n} Beiträge</small></p>`).join('') || '<p class="muted small">Noch keine Trends.</p>'}</div></div></div>`;
    } else if (tab === 'ticker') {
      const hot = /verlässt|entlassen|verpflichtet|wechselt|Rekord|Meister|DEADLINE|Sperre|verletzt|Vorvertrag|trennt sich/i;
      const items = [...(w.news || []).map((n) => ({ ...n })), ...(w.coachMoves || []).slice(0, 10).map((c) => ({ season: c.season, week: c.week, text: `${w.clubs[c.club]?.name || ''}: ${c.out ? `${c.out} muss gehen, ` : ''}${c.in} übernimmt als Trainer.`, hot: true }))]
        .sort((a, b) => b.season - a.season || b.week - a.week).slice(0, 60);
      body = `<div class="ticker-card card"><div class="tv-head"><b>📺 FM-TV</b> <span>LIVE-TICKER</span></div>${items.map((n) => `<div class="tick ${n.hot || hot.test(n.text) ? 'hot' : ''}"><small>${sl(n.season)} · W${n.week}</small>${n.hot || hot.test(n.text) ? '<i>EILMELDUNG</i>' : ''}<p>${esc(n.text)}</p></div>`).join('') || '<p class="muted">Noch keine Meldungen.</p>'}</div>`;
    } else if (tab === 'quotes') {
      body = `<div class="card">${M.quotes.map((q) => `<div class="quote"><small class="muted">Saison ${sl(q.season)}, Woche ${q.week + 1} · ${esc(q.q)}</small><p>„${esc(q.text)}“</p></div>`).join('') || '<p class="muted">Noch keine Zitate. Gib vor dem Spiel eine Pressekonferenz.</p>'}</div>`;
    } else {
      const H = hallOfFame(w), LR = leagueRecords(w);
      const rec = (l, r) => `<div class="kv"><span>${l}</span><b>${r ? `${esc(r.text)} <small class="muted">(${sl(r.season)})</small>` : '–'}</b></div>`;
      body = `<div class="grid2"><div class="card"><h3>📈 Vereinsrekorde (deine Amtszeit)</h3>${rec('Höchster Sieg', R.biggestWin)}${rec('Höchste Niederlage', R.biggestLoss)}${rec('Torreichstes Spiel', R.mostGoalsGame)}
          <div class="kv"><span>Längste Serie ohne Niederlage</span><b>${R.unbeatenMax} Spiele</b></div>
          <div class="kv"><span>Beste Saison</span><b>${R.bestSeason ? `${R.bestSeason.pts} Punkte, Platz ${R.bestSeason.rank} (${sl(R.bestSeason.season)})` : '–'}</b></div>
          <h3 style="margin-top:14px">🏆 Rekordmeister (seit Spielbeginn)</h3>${LR.champions.map((c) => `<p>${crest(c.club, 18)} ${esc(c.club.name)} – ${c.n}×</p>`).join('') || '<p class="muted">Nach der ersten Saison.</p>'}
          <h4>Meiste Punkte in einer Saison</h4>${LR.mostPoints.map((r) => `<p class="small">${crest(r.club, 16)} ${esc(r.club.short)} ${r.pts} Pkt. (${sl(r.season)}, ${esc(r.league)})</p>`).join('') || '<p class="muted">–</p>'}</div>
        <div class="card table-wrap"><h3>🌟 Hall of Fame</h3><p class="muted">Die Legenden deiner Vereine – Einsätze, Tore, Titel und Treue über alle Saisons.</p>
          <table class="tbl compact"><thead><tr><th>#</th><th>Spieler</th><th>Saisons</th><th>Spiele</th><th>Tore</th><th>Vorl.</th><th>Titel</th><th>Ø</th></tr></thead><tbody>
          ${H.slice(0, 20).map((l, i) => `<tr><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td>${flag(l.nation)} ${esc(l.name)} <small class="muted">${l.pos} · ${esc(w.clubs[l.club]?.short || '')}</small></td><td>${l.seasons}</td><td>${l.apps}</td><td>${l.goals}</td><td>${l.assists}</td><td>${l.titles}</td><td>${l.avg || '–'}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Die Hall of Fame füllt sich nach der ersten Saison.</td></tr>'}</tbody></table></div></div>`;
    }
    el.innerHTML = `<div class="page"><div class="page-head"><h2>📰 Medienhaus</h2></div>
      <div class="tabs">${[['zeitung', '📰 Titelseite'], ['archiv', '🗂️ Archiv'], ['social', '💬 Social Media'], ['ticker', '📺 Ticker'], ['quotes', '🎤 Zitate'], ['records', '🏆 Rekorde & Hall of Fame']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>${body}</div>`;
    el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { app.mediaTab = b.dataset.t; draw(); }));
    el.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { app.mediaFilter = b.dataset.f; draw(); }));
    el.querySelectorAll('[data-art]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); openArticle(w, +b.dataset.art); }));
    el.querySelectorAll('[data-post]').forEach((b) => (b.onclick = () => { const r = managerPost(w, b.dataset.post, newRng(w)); toast(r.msg || (r.ok ? 'Gepostet' : 'Nicht möglich')); draw(); }));
  };
  draw();
}
