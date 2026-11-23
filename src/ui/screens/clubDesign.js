// v5.2: kit & crest editor for the managed club. Home and away kit (pattern + four colours),
// a crest designer (shape, division, symbol, initials, year, colours) or the original crest.
import { esc, toast, crest, confirmDialog } from '../dom.js';
import { SYMBOLS, SHAPES, DIVISIONS, crestSvg, crestDataUrl } from '../../manager/founder.js';
import { KIT_STYLES_ALL, kitStyleFor } from '../../render/kitTexture.js';
import { resetCrestImage } from '../../render/crestImages.js';
import { registerCustomClubs } from '../../data/customRegistry.js';
import { SYMBOL_NAMES, SHAPE_NAMES, STYLE_NAMES, drawShirt } from './founder.js';

const hex = (c, d) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : d);

export function clubDesignScreen(app, el) {
  const w = app.world, club = app.club;
  const cu = club.custom || {};
  const D = (app.designDraft && app.designDraft.id === club.id) ? app.designDraft : (app.designDraft = {
    id: club.id, tab: 'home',
    home: { style: cu.kitStyle || kitStyleFor(club.short), primary: hex(club.colors.primary, '#cc0000'), secondary: hex(club.colors.secondary, '#ffffff'), shorts: hex(club.colors.shorts, '#ffffff'), socks: hex(club.colors.socks, '#cc0000') },
    away: { style: cu.awayStyle || 'plain', primary: hex(club.away?.primary, '#ffffff'), secondary: hex(club.away?.secondary, '#111111'), shorts: hex(club.away?.shorts, '#111111'), socks: hex(club.away?.socks, '#ffffff') },
    useCustomCrest: !!cu.crestCfg,
    crest: cu.crestCfg ? { ...cu.crestCfg } : { shape: 'shield', division: 'vertikal', symbol: 'ball', text: club.short.slice(0, 4), year: club.info?.founded || '', c1: hex(club.colors.primary, '#0b3d91'), c2: hex(club.colors.secondary, '#ffffff'), c3: '#f5c542' },
  });
  const col = (id, v) => `<input type="color" id="${id}" value="${v}">`;
  const draw = () => {
    const kit = D.tab === 'away' ? D.away : D.home;
    const kitPanel = `<div class="opt-row">${KIT_STYLES_ALL.map((k) => `<button class="chip-btn ${kit.style === k ? 'on' : ''}" data-style="${k}">${STYLE_NAMES[k] || k}</button>`).join('')}</div>
      <div class="opt-row"><label>Hauptfarbe ${col('k1', kit.primary)}</label><label>Zweitfarbe ${col('k2', kit.secondary)}</label><label>Hose ${col('k3', kit.shorts)}</label><label>Stutzen ${col('k4', kit.socks)}</label></div>
      <div class="opt-row"><button class="btn sm ghost" id="sync">Wappenfarben übernehmen</button>${D.tab === 'away' ? '<button class="btn sm ghost" id="invert">Heimtrikot invertieren</button>' : ''}</div>`;
    const C = D.crest;
    const crestPanel = `<label class="check"><input type="checkbox" id="usec" ${D.useCustomCrest ? 'checked' : ''}> Eigenes Wappen verwenden</label>
      ${D.useCustomCrest ? `<div class="opt-row">${Object.keys(SHAPES).map((k) => `<button class="chip-btn ${C.shape === k ? 'on' : ''}" data-shape="${k}">${SHAPE_NAMES[k]}</button>`).join('')}</div>
      <div class="opt-row">${DIVISIONS.map((k) => `<button class="chip-btn ${C.division === k ? 'on' : ''}" data-div="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
      <div class="opt-row">${Object.keys(SYMBOLS).map((k) => `<button class="chip-btn ${C.symbol === k ? 'on' : ''}" data-sym="${k}">${SYMBOL_NAMES[k]}</button>`).join('')}</div>
      <div class="opt-row"><label>Kürzel <input id="c-text" class="input sm" maxlength="4" value="${esc(C.text)}" style="width:80px"></label><label>Jahr <input id="c-year" class="input sm" maxlength="4" value="${esc(String(C.year || ''))}" style="width:70px"></label>
        <label>Farbe 1 ${col('c1', C.c1)}</label><label>Farbe 2 ${col('c2', C.c2)}</label><label>Akzent ${col('c3', C.c3)}</label></div>` : '<p class="muted">Der Verein nutzt sein Originalwappen. Aktiviere das Häkchen, um ein eigenes zu entwerfen.</p>'}`;
    el.innerHTML = `<div class="page"><div class="page-head"><h2>🎨 Trikot & Wappen</h2><div class="row-actions"><button class="btn sm" id="reset">↺ Original</button><button class="btn sm primary" id="save">💾 Übernehmen</button></div></div>
      <div class="founder">
        <div class="card">
          <div class="tabs small">${[['home', '🏠 Heimtrikot'], ['away', '✈️ Auswärtstrikot'], ['crest', '🛡️ Wappen']].map(([k, l]) => `<button class="${D.tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
          ${D.tab === 'crest' ? crestPanel : kitPanel}
          <p class="muted small">Änderungen gelten nach „Übernehmen“ überall: Tabellen, 3D-Spiel, Videowand und Zeitung.</p>
        </div>
        <div class="card founder-prev">
          <div class="crest-prev">${D.useCustomCrest ? crestSvg(C) : crest({ ...club, crest: club.crest, short: club.short }, 120)}</div>
          <div class="design-kits"><div><canvas id="shirtH" width="260" height="280"></canvas><small>Heim</small></div><div><canvas id="shirtA" width="260" height="280"></canvas><small>Auswärts</small></div></div>
          <h3>${esc(club.name)}</h3>
        </div>
      </div></div>`;
    drawShirt(el.querySelector('#shirtH'), D.home); drawShirt(el.querySelector('#shirtA'), D.away);
    const $ = (s) => el.querySelector(s);
    el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { D.tab = b.dataset.tab; draw(); }));
    el.querySelectorAll('[data-style]').forEach((b) => (b.onclick = () => { kit.style = b.dataset.style; draw(); }));
    for (const [id, key] of [['k1', 'primary'], ['k2', 'secondary'], ['k3', 'shorts'], ['k4', 'socks']]) if ($(`#${id}`)) $(`#${id}`).oninput = (e) => { kit[key] = e.target.value; drawShirt($(D.tab === 'away' ? '#shirtA' : '#shirtH'), kit); };
    $('#sync') && ($('#sync').onclick = () => { Object.assign(kit, D.tab === 'away' ? { primary: C.c2, secondary: C.c1, shorts: C.c2, socks: C.c1 } : { primary: C.c1, secondary: C.c2, shorts: C.c1, socks: C.c2 }); draw(); });
    $('#invert') && ($('#invert').onclick = () => { Object.assign(D.away, { primary: D.home.secondary, secondary: D.home.primary, shorts: D.home.primary, socks: D.home.secondary }); draw(); });
    $('#usec') && ($('#usec').onchange = (e) => { D.useCustomCrest = e.target.checked; draw(); });
    el.querySelectorAll('[data-shape]').forEach((b) => (b.onclick = () => { C.shape = b.dataset.shape; draw(); }));
    el.querySelectorAll('[data-div]').forEach((b) => (b.onclick = () => { C.division = b.dataset.div; draw(); }));
    el.querySelectorAll('[data-sym]').forEach((b) => (b.onclick = () => { C.symbol = b.dataset.sym; draw(); }));
    const prev = () => { const p = el.querySelector('.crest-prev'); if (p) p.innerHTML = crestSvg(C); };
    $('#c-text') && ($('#c-text').oninput = (e) => { C.text = e.target.value; prev(); });
    $('#c-year') && ($('#c-year').oninput = (e) => { C.year = e.target.value.replace(/\D/g, ''); prev(); });
    for (const k of ['c1', 'c2', 'c3']) if ($(`#${k}`)) $(`#${k}`).oninput = (e) => { C[k] = e.target.value; prev(); };
    $('#save').onclick = () => { applyDesign(w, club, D); toast('Design übernommen'); app.render?.(); };
    $('#reset').onclick = async () => {
      if (!(await confirmDialog('Eigenes Wappen und Trikotmuster entfernen und zum Original zurückkehren? Die Trikotfarben bleiben.', 'Zurücksetzen'))) return;
      resetDesign(club); app.designDraft = null; toast('Originaldesign wiederhergestellt'); clubDesignScreen(app, el);
    };
  };
  draw();
}

export function applyDesign(world, club, D) {
  club.custom ||= {};
  Object.assign(club.colors, { primary: D.home.primary, secondary: D.home.secondary, shorts: D.home.shorts, socks: D.home.socks });
  club.away = { primary: D.away.primary, secondary: D.away.secondary, shorts: D.away.shorts, socks: D.away.socks };
  club.custom.kitStyle = D.home.style; club.custom.awayStyle = D.away.style;
  if (D.useCustomCrest) {
    club.custom.crestCfg = { ...D.crest }; club.custom.crest = crestDataUrl(D.crest);
    if (club.crest) { club.custom.origClubCrest ??= club.crest; club.crest = club.custom.crest; }
  } else dropCrest(club);
  registerCustomClubs(world); resetCrestImage(club.short);
  world.news?.unshift({ season: world.season, week: world.week + 1, text: `🎨 ${club.name} präsentiert ein neues Design${D.useCustomCrest ? ' samt neuem Wappen' : ''}.` });
}
function dropCrest(club) {
  if (club.custom.origClubCrest) { club.crest = club.custom.origClubCrest; delete club.custom.origClubCrest; }
  delete club.custom.crestCfg;
  if (club.custom.founded == null) delete club.custom.crest; // founded clubs keep their founder crest
}
export function resetDesign(club) {
  if (!club.custom) return;
  if (club.custom.founded == null) { dropCrest(club); delete club.custom.kitStyle; delete club.custom.awayStyle; }
  registerCustomClubs({ clubs: { [club.id]: club } }); resetCrestImage(club.short);
}
