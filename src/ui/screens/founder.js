// Club founder: name, crest editor, kit editor with live previews.
import { esc, toast } from '../dom.js';
import { SYMBOLS, SHAPES, DIVISIONS, crestSvg, foundClub, FOUND_TARGETS } from '../../manager/founder.js';
import { KIT_STYLES_ALL as KIT_STYLES, drawPattern } from '../../render/kitTexture.js';
import { confirmClub } from './menu.js';

export const SYMBOL_NAMES = { none: 'Nur Text', star: 'Stern', ball: 'Ball', crown: 'Krone', bolt: 'Blitz', anchor: 'Anker', tower: 'Turm', wave: 'Welle', eagle: 'Adler', tree: 'Baum' };
export const SHAPE_NAMES = { shield: 'Schild', classic: 'Wappen', round: 'Rund', diamond: 'Raute', badge: 'Abzeichen' };
export const STYLE_NAMES = { plain: 'Uni', stripes: 'Streifen', hoops: 'Ringel', halves: 'Hälften', sash: 'Schärpe', pinstripe: 'Nadelstreifen', chevron: 'Chevron', band: 'Brustring', quarters: 'Geviertelt', shoulders: 'Schulterpasse' };

export function founderScreen(app, el) {
  const w = app.pendingWorld;
  if (!w) { app.go('new'); return; }
  const F = (app.founder ||= {
    name: 'FC Neustadt 2026', city: 'Neustadt', stadium: '', league: 'de3',
    crest: { shape: 'shield', division: 'vertikal', symbol: 'star', text: 'FCN', year: 2026, c1: '#0b3d91', c2: '#ffffff', c3: '#f5c542' },
    kit: { style: 'stripes', primary: '#0b3d91', secondary: '#ffffff', shorts: '#0b3d91', socks: '#ffffff' },
  });
  const colorInput = (id, v) => `<input type="color" id="${id}" value="${v}">`;
  const draw = () => {
    el.innerHTML = `<div class="page narrow"><div class="page-head"><button class="btn ghost sm" id="back">← Zurück</button><h2>✨ Eigenen Verein gründen</h2></div>
      <div class="founder">
        <div class="card">
          <h3>Verein</h3>
          <label class="field">Vereinsname<input id="f-name" maxlength="30" value="${esc(F.name)}"></label>
          <label class="field">Stadt<input id="f-city" maxlength="24" value="${esc(F.city)}"></label>
          <label class="field">Stadionname (optional)<input id="f-stad" maxlength="30" value="${esc(F.stadium)}" placeholder="Sportpark ${esc(F.city)}"></label>
          <label class="field">Start in<select id="f-league" class="input">${FOUND_TARGETS.map((t) => `<option value="${t.id}" ${F.league === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></label>
          <p class="muted small">Dein Verein ersetzt den schwächsten Klub der Liga: 24 Spieler auf Drittliga-Niveau, 6.500 Plätze, 2,5 Mio. € Startkapital.</p>
          <h3 style="margin-top:14px">Wappen</h3>
          <div class="opt-row">${Object.keys(SHAPES).map((k) => `<button class="chip-btn ${F.crest.shape === k ? 'on' : ''}" data-shape="${k}">${SHAPE_NAMES[k]}</button>`).join('')}</div>
          <div class="opt-row">${DIVISIONS.map((k) => `<button class="chip-btn ${F.crest.division === k ? 'on' : ''}" data-div="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
          <div class="opt-row">${Object.keys(SYMBOLS).map((k) => `<button class="chip-btn ${F.crest.symbol === k ? 'on' : ''}" data-sym="${k}">${SYMBOL_NAMES[k]}</button>`).join('')}</div>
          <div class="opt-row"><label>Kürzel <input id="f-text" class="input sm" maxlength="4" value="${esc(F.crest.text)}" style="width:80px"></label><label>Jahr <input id="f-year" class="input sm" maxlength="4" value="${F.crest.year || ''}" style="width:80px"></label>
            <label>Farbe 1 ${colorInput('c1', F.crest.c1)}</label><label>Farbe 2 ${colorInput('c2', F.crest.c2)}</label><label>Akzent ${colorInput('c3', F.crest.c3)}</label></div>
          <h3 style="margin-top:14px">Trikot</h3>
          <div class="opt-row">${KIT_STYLES.filter((k, i, a) => a.indexOf(k) === i).map((k) => `<button class="chip-btn ${F.kit.style === k ? 'on' : ''}" data-style="${k}">${STYLE_NAMES[k] || k}</button>`).join('')}</div>
          <div class="opt-row"><label>Hauptfarbe ${colorInput('k1', F.kit.primary)}</label><label>Zweitfarbe ${colorInput('k2', F.kit.secondary)}</label><label>Hose ${colorInput('k3', F.kit.shorts)}</label><label>Stutzen ${colorInput('k4', F.kit.socks)}</label>
            <button class="btn sm ghost" id="sync">Wappenfarben übernehmen</button></div>
        </div>
        <div class="card founder-prev">
          <div class="crest-prev">${crestSvg(F.crest)}</div>
          <canvas id="shirt" width="260" height="280"></canvas>
          <h3>${esc(F.name)}</h3><p class="muted">${esc(FOUND_TARGETS.find((t) => t.id === F.league).label)} · gegründet ${w.season}</p>
          <button class="btn primary lg" id="found">Verein gründen ✨</button>
        </div>
      </div></div>`;
    drawShirt(el.querySelector('#shirt'), F.kit);
    const $ = (s) => el.querySelector(s);
    $('#back').onclick = () => app.go('new');
    const bindText = (sel, fn) => ($(sel).oninput = (e) => { fn(e.target.value); refreshPreview(); });
    bindText('#f-name', (v) => { F.name = v; });
    bindText('#f-city', (v) => { F.city = v; });
    bindText('#f-stad', (v) => { F.stadium = v; });
    bindText('#f-text', (v) => { F.crest.text = v; });
    bindText('#f-year', (v) => { F.crest.year = v.replace(/\D/g, ''); });
    $('#f-league').onchange = (e) => { F.league = e.target.value; draw(); };
    for (const [id, key] of [['c1', 'c1'], ['c2', 'c2'], ['c3', 'c3']]) $(`#${id}`).oninput = (e) => { F.crest[key] = e.target.value; refreshPreview(); };
    for (const [id, key] of [['k1', 'primary'], ['k2', 'secondary'], ['k3', 'shorts'], ['k4', 'socks']]) $(`#${id}`).oninput = (e) => { F.kit[key] = e.target.value; drawShirt($('#shirt'), F.kit); };
    el.querySelectorAll('[data-shape]').forEach((b) => (b.onclick = () => { F.crest.shape = b.dataset.shape; draw(); }));
    el.querySelectorAll('[data-div]').forEach((b) => (b.onclick = () => { F.crest.division = b.dataset.div; draw(); }));
    el.querySelectorAll('[data-sym]').forEach((b) => (b.onclick = () => { F.crest.symbol = b.dataset.sym; draw(); }));
    el.querySelectorAll('[data-style]').forEach((b) => (b.onclick = () => { F.kit.style = b.dataset.style; draw(); }));
    $('#sync').onclick = () => { Object.assign(F.kit, { primary: F.crest.c1, secondary: F.crest.c2, shorts: F.crest.c1, socks: F.crest.c2 }); draw(); };
    $('#found').onclick = () => {
      if (F.name.trim().length < 3) { toast('Bitte einen Vereinsnamen eingeben.'); return; }
      const club = foundClub(w, { ...F, name: F.name.trim(), short: F.crest.text });
      toast(`${club.name} ist gegründet!`);
      confirmClub(app, w, club.id);
    };
    function refreshPreview() { el.querySelector('.crest-prev').innerHTML = crestSvg(F.crest); el.querySelector('.founder-prev h3').textContent = F.name; }
  };
  draw();
}

export function drawShirt(cv, kit) {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  const shirt = new Path2D('M70 20 L105 8 Q130 26 155 8 L190 20 L250 70 L220 110 L195 92 L195 200 L65 200 L65 92 L40 110 L10 70 Z');
  g.save(); g.clip(shirt);
  const off = document.createElement('canvas'); off.width = 512; off.height = 256;
  drawPattern(off.getContext('2d'), 512, 256, kit, kit.style);
  g.drawImage(off, 0, 0, 256, 256, 0, 0, 260, 220);
  g.restore();
  g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke(shirt);
  g.fillStyle = kit.shorts; g.beginPath(); g.moveTo(70, 205); g.lineTo(190, 205); g.lineTo(198, 262); g.lineTo(136, 262); g.lineTo(130, 236); g.lineTo(124, 262); g.lineTo(62, 262); g.closePath(); g.fill(); g.stroke();
}
