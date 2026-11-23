// v5.2 Editor: own newspaper articles and social posts, playable match scenes (any two clubs,
// preset score and minute, optional goal), a player editor and a club editor.
import { esc, toast, crest, confirmDialog } from '../dom.js';
import { ensureMedia, PAPERS } from '../../manager/media.js';
import { POS_ORDER } from '../../data/attributes.js';

const TONES = [['top', '🔥 Jubel'], ['ok', '🙂 Positiv'], ['bad', '😕 Kritisch'], ['crisis', '🚨 Krise']];
const GOALS = [['none', 'Frei spielen'], ['win', 'Spiel gewinnen'], ['draw', 'Mindestens Remis'], ['hold', 'Vorsprung/Abstand halten']];
const PRESETS = [
  { name: 'Aufholjagd', hg: 0, ag: 2, minute: 60, goal: 'win', text: '0:2 nach einer Stunde – dreh das Spiel!' },
  { name: 'Last-Minute-Drama', hg: 1, ag: 1, minute: 85, goal: 'win', text: 'Fünf Minuten für den Siegtreffer.' },
  { name: 'Abwehrschlacht', hg: 1, ag: 0, minute: 70, goal: 'hold', text: 'Bring die knappe Führung über die Zeit.' },
  { name: 'Unterzahl-Krimi', hg: 2, ag: 2, minute: 75, goal: 'draw', text: 'Halte wenigstens den Punkt.' },
];

export function editorScreen(app, el, params = {}) {
  const w = app.world, me = app.club;
  const E = (w.editor ||= { articles: [], scenes: [] });
  E.articles ||= []; E.scenes ||= [];
  let tab = params.tab || app.editorTab || 'paper';
  const A = (app.edArticle ||= { paper: PAPERS[0], title: '', sub: '', body: '', tone: 'ok', author: w.manager?.name || '', social: '' });
  const S = (app.edScene ||= { name: 'Meine Szene', h: me.id, a: null, hg: 0, ag: 1, minute: 70, goal: 'win', side: 'h' });
  const clubOptions = (sel) => w.leagues.map((l) => `<optgroup label="${esc(l.name)}">${l.clubIds.map((id) => `<option value="${id}" ${+sel === id ? 'selected' : ''}>${esc(w.clubs[id].name)}</option>`).join('')}</optgroup>`).join('');
  if (S.a == null) S.a = w.leagues.find((l) => l.clubIds.includes(me.id))?.clubIds.find((id) => id !== me.id) ?? me.id;

  const draw = () => {
    app.editorTab = tab;
    let body = '';
    if (tab === 'paper') {
      body = `<div class="grid-2"><div class="card"><h3>📰 Artikel schreiben</h3>
        <label class="field">Zeitung<select id="a-paper" class="input">${PAPERS.map((p) => `<option ${A.paper === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}<option value="__own" ${!PAPERS.includes(A.paper) ? 'selected' : ''}>Eigene Zeitung …</option></select></label>
        ${!PAPERS.includes(A.paper) ? `<label class="field">Name der Zeitung<input id="a-own" maxlength="30" value="${esc(A.paper)}"></label>` : ''}
        <label class="field">Schlagzeile<input id="a-title" maxlength="80" value="${esc(A.title)}" placeholder="z. B. Sensation im Derby!"></label>
        <label class="field">Unterzeile<input id="a-sub" maxlength="120" value="${esc(A.sub)}"></label>
        <label class="field">Artikeltext<textarea id="a-body" rows="5" maxlength="1200">${esc(A.body)}</textarea></label>
        <label class="field">Autor<input id="a-author" maxlength="30" value="${esc(A.author)}"></label>
        <div class="opt-row">${TONES.map(([k, l]) => `<button class="chip-btn ${A.tone === k ? 'on' : ''}" data-tone="${k}">${l}</button>`).join('')}</div>
        <label class="field">Social-Media-Post dazu (optional)<input id="a-social" maxlength="140" value="${esc(A.social)}" placeholder="#${esc(me.short)} …"></label>
        <div class="row-actions end"><button class="btn primary" id="a-pub">🗞️ Veröffentlichen</button></div></div>
        <div class="card"><h3>Vorschau</h3><div class="paper mini"><div class="paper-head">${esc(A.paper)}</div><h1 class="tone-${A.tone}">${esc(A.title || 'Deine Schlagzeile')}</h1><p class="paper-sub">${esc(A.sub)}</p><p class="paper-body">${esc(A.body)}</p></div>
        <h3 style="margin-top:12px">Deine Artikel</h3>${E.articles.length ? E.articles.slice(0, 15).map((x, i) => `<div class="facility"><div><b>${esc(x.title)}</b><br><small class="muted">${esc(x.paper)} · Saison ${x.season}, Woche ${x.week + 1}</small></div><button class="btn sm ghost" data-del="${i}">🗑️</button></div>`).join('') : '<p class="muted">Noch keine eigenen Artikel.</p>'}</div></div>`;
    } else if (tab === 'scene') {
      body = `<div class="grid-2"><div class="card"><h3>🎬 Spielszene erstellen</h3>
        <p class="muted small">Stelle eine Situation nach und spiele sie in 3D. Szenen zählen nicht für die Saison.</p>
        <div class="opt-row">${PRESETS.map((p, i) => `<button class="chip-btn" data-pre="${i}" title="${esc(p.text)}">${esc(p.name)}</button>`).join('')}</div>
        <label class="field">Name<input id="s-name" maxlength="40" value="${esc(S.name)}"></label>
        <label class="field">Heim<select id="s-h" class="input">${clubOptions(S.h)}</select></label>
        <label class="field">Auswärts<select id="s-a" class="input">${clubOptions(S.a)}</select></label>
        <div class="opt-row"><label>Spielstand <input id="s-hg" type="number" min="0" max="9" class="input sm" style="width:60px" value="${S.hg}"> : <input id="s-ag" type="number" min="0" max="9" class="input sm" style="width:60px" value="${S.ag}"></label>
          <label>Minute <input id="s-min" type="number" min="1" max="89" class="input sm" style="width:70px" value="${S.minute}"></label></div>
        <div class="opt-row"><span class="muted">Ziel:</span>${GOALS.map(([k, l]) => `<button class="chip-btn ${S.goal === k ? 'on' : ''}" data-goal="${k}">${l}</button>`).join('')}</div>
        <div class="opt-row"><span class="muted">Du spielst:</span><button class="chip-btn ${S.side === 'h' ? 'on' : ''}" data-side="h">Heim</button><button class="chip-btn ${S.side === 'a' ? 'on' : ''}" data-side="a">Auswärts</button></div>
        <div class="row-actions end"><button class="btn" id="s-save">💾 Speichern</button><button class="btn primary" id="s-play">▶ Szene spielen</button></div></div>
        <div class="card"><h3>Gespeicherte Szenen</h3>${E.scenes.length ? E.scenes.map((x, i) => `<div class="facility"><div>${crest(w.clubs[x.h], 20)} <b>${esc(x.name)}</b><br><small class="muted">${esc(w.clubs[x.h]?.short || '?')} ${x.hg}:${x.ag} ${esc(w.clubs[x.a]?.short || '?')} · ab ${x.minute}. Min. · ${GOALS.find((g) => g[0] === x.goal)?.[1] || ''}${x.played ? ` · ${x.won || 0}/${x.played} geschafft, zuletzt ${x.last}` : ''}</small></div><div class="row-actions"><button class="btn sm primary" data-play="${i}">▶</button><button class="btn sm ghost" data-sdel="${i}">🗑️</button></div></div>`).join('') : '<p class="muted">Noch keine Szenen gespeichert.</p>'}</div></div>`;
    } else if (tab === 'player') {
      const sq = me.squad.map((id) => w.players[id]).filter(Boolean).sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos));
      body = `<div class="card table-wrap"><h3>👤 Spieler-Editor</h3><p class="muted small">Namen, Rückennummern und Positionen deines Kaders anpassen.</p>
        <table class="tbl compact"><thead><tr><th>Nr.</th><th>Vorname</th><th>Nachname</th><th>Pos.</th><th>Alter</th></tr></thead><tbody>
        ${sq.map((p) => `<tr data-pid="${p.id}"><td><input class="input sm" type="number" min="1" max="99" style="width:56px" data-f="number" value="${p.number}"></td><td><input class="input sm" maxlength="20" data-f="firstName" value="${esc(p.firstName)}"></td><td><input class="input sm" maxlength="24" data-f="lastName" value="${esc(p.lastName)}"></td>
          <td><select class="input sm" data-f="pos">${POS_ORDER.map((k) => `<option ${p.pos === k ? 'selected' : ''}>${k}</option>`).join('')}</select></td><td>${p.age}</td></tr>`).join('')}</tbody></table>
        <div class="row-actions end"><button class="btn primary" id="p-save">💾 Kader speichern</button></div></div>`;
    } else {
      body = `<div class="card"><h3>🏛️ Vereins-Editor</h3>
        <label class="field">Vereinsname<input id="c-name" maxlength="34" value="${esc(me.name)}"></label>
        <label class="field">Stadt<input id="c-city" maxlength="24" value="${esc(me.info?.city || '')}"></label>
        <label class="field">Gründungsjahr<input id="c-found" maxlength="4" value="${esc(String(me.info?.founded || ''))}"></label>
        <label class="field">Vereinsmotto<input id="c-motto" maxlength="60" value="${esc(me.motto || '')}" placeholder="z. B. Echte Liebe"></label>
        <label class="field">Fan-Hymne / Einlaufmusik (Titel)<input id="c-anthem" maxlength="40" value="${esc(me.anthem || '')}"></label>
        <p class="muted small">Trikot, Wappen und Stadion bearbeitest du unter 🎨 Trikot & Wappen bzw. 🏟️ Stadion.</p>
        <div class="row-actions end"><button class="btn" id="c-design">🎨 Zu Trikot & Wappen</button><button class="btn primary" id="c-save">💾 Speichern</button></div></div>`;
    }
    el.innerHTML = `<div class="page"><div class="page-head"><h2>✍️ Editor</h2></div>
      <div class="tabs">${[['paper', '📰 Zeitungsartikel'], ['scene', '🎬 Spielszenen'], ['player', '👤 Spieler'], ['club', '🏛️ Verein']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>${body}</div>`;
    bind();
  };

  const $ = (s) => el.querySelector(s);
  const bind = () => {
    el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { tab = b.dataset.t; draw(); }));
    if (tab === 'paper') {
      $('#a-paper').onchange = (e) => { A.paper = e.target.value === '__own' ? 'Meine Zeitung' : e.target.value; draw(); };
      $('#a-own') && ($('#a-own').oninput = (e) => { A.paper = e.target.value || 'Meine Zeitung'; });
      for (const [id, k] of [['#a-title', 'title'], ['#a-sub', 'sub'], ['#a-body', 'body'], ['#a-author', 'author'], ['#a-social', 'social']]) $(id).oninput = (e) => { A[k] = e.target.value; const pv = el.querySelector('.paper.mini'); if (pv) { pv.querySelector('h1').textContent = A.title || 'Deine Schlagzeile'; pv.querySelector('.paper-sub').textContent = A.sub; pv.querySelector('.paper-body').textContent = A.body; } };
      el.querySelectorAll('[data-tone]').forEach((b) => (b.onclick = () => { A.tone = b.dataset.tone; draw(); }));
      $('#a-pub').onclick = () => {
        if (A.title.trim().length < 3) return toast('Bitte eine Schlagzeile eingeben.');
        publishArticle(w, A);
        app.edArticle = null; toast('Artikel veröffentlicht – zu sehen unter 📰 Medien'); editorScreen(app, el, { tab: 'paper' });
      };
      el.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { const x = E.articles.splice(+b.dataset.del, 1)[0]; const M = ensureMedia(w); M.headlines = M.headlines.filter((h) => h.id !== x.id); draw(); }));
    } else if (tab === 'scene') {
      const read = () => { S.name = $('#s-name').value.trim() || 'Szene'; S.h = +$('#s-h').value; S.a = +$('#s-a').value; S.hg = Math.max(0, Math.min(9, +$('#s-hg').value || 0)); S.ag = Math.max(0, Math.min(9, +$('#s-ag').value || 0)); S.minute = Math.max(1, Math.min(89, +$('#s-min').value || 1)); };
      el.querySelectorAll('[data-pre]').forEach((b) => (b.onclick = () => { read(); const p = PRESETS[+b.dataset.pre]; Object.assign(S, { name: p.name, hg: p.hg, ag: p.ag, minute: p.minute, goal: p.goal, side: 'h' }); toast(p.text); draw(); }));
      el.querySelectorAll('[data-goal]').forEach((b) => (b.onclick = () => { read(); S.goal = b.dataset.goal; draw(); }));
      el.querySelectorAll('[data-side]').forEach((b) => (b.onclick = () => { read(); S.side = b.dataset.side; draw(); }));
      $('#s-save').onclick = () => { read(); if (S.h === S.a) return toast('Bitte zwei verschiedene Vereine wählen.'); E.scenes.unshift({ ...S, id: Date.now() }); E.scenes = E.scenes.slice(0, 20); toast('Szene gespeichert'); draw(); };
      $('#s-play').onclick = () => { read(); if (S.h === S.a) return toast('Bitte zwei verschiedene Vereine wählen.'); const sc = { ...S, id: Date.now() }; E.scenes.unshift(sc); E.scenes = E.scenes.slice(0, 20); playScene(app, sc); };
      el.querySelectorAll('[data-play]').forEach((b) => (b.onclick = () => playScene(app, E.scenes[+b.dataset.play])));
      el.querySelectorAll('[data-sdel]').forEach((b) => (b.onclick = () => { E.scenes.splice(+b.dataset.sdel, 1); draw(); }));
    } else if (tab === 'player') {
      $('#p-save').onclick = () => {
        let n = 0; const used = new Map();
        el.querySelectorAll('tr[data-pid]').forEach((tr) => {
          const p = w.players[+tr.dataset.pid]; if (!p) return;
          const get = (f) => tr.querySelector(`[data-f="${f}"]`).value.trim();
          const num = Math.max(1, Math.min(99, +get('number') || p.number));
          if (used.has(num)) return; used.set(num, p.id);
          const nf = get('firstName') || p.firstName, nl = get('lastName') || p.lastName, pos = get('pos');
          if (nf !== p.firstName || nl !== p.lastName || num !== p.number || pos !== p.pos) n++;
          Object.assign(p, { firstName: nf, lastName: nl, number: num, pos });
        });
        me.lineup = null; toast(`${n} Spieler aktualisiert`); draw();
      };
    } else {
      $('#c-design').onclick = () => app.go('design');
      $('#c-save').onclick = () => {
        const name = $('#c-name').value.trim(); if (name.length < 3) return toast('Name zu kurz');
        me.name = name; me.info ||= {}; me.info.city = $('#c-city').value.trim(); const f = +$('#c-found').value; if (f > 1800 && f < 2100) me.info.founded = f;
        me.motto = $('#c-motto').value.trim(); me.anthem = $('#c-anthem').value.trim();
        toast('Verein gespeichert'); app.render?.();
      };
    }
  };
  draw();
}

export function publishArticle(w, A) {
  const E = (w.editor ||= { articles: [], scenes: [] });
  const M = ensureMedia(w);
  const id = Date.now() + Math.floor(Math.random() * 1000);
  const art = { id, season: w.season, week: w.week, paper: A.paper, title: A.title.trim(), sub: A.sub.trim(), body: A.body.trim(), tone: A.tone, author: A.author.trim(), score: '', custom: true };
  M.headlines.unshift(art); M.headlines = M.headlines.slice(0, 40);
  E.articles.unshift({ id, title: art.title, paper: art.paper, season: art.season, week: art.week });
  if (A.social?.trim()) { M.feed.unshift({ season: w.season, week: w.week, user: `@${(A.author || 'fan').toLowerCase().replace(/[^a-z0-9]/g, '') || 'fan'}`, name: A.author || 'Fan', text: A.social.trim(), likes: 50 + Math.floor(Math.random() * 3000), kind: 'fan', club: w.userClubId }); M.feed = M.feed.slice(0, 80); }
  return art;
}

function playScene(app, sc) {
  if (!app.world.clubs[sc.h] || !app.world.clubs[sc.a]) return toast('Verein nicht gefunden');
  app.go('match', { friendly: true, home: sc.h, away: sc.a, mode: '3d', scene: sc });
}
