import { FACE_ATLAS, FACE_COUNT, FACE_COLS, FACE_ROWS } from '../data/faces.js';
// Small DOM + formatting helpers shared by all screens.
import { NATIONS } from '../data/names.js';
import { NATIONS_EXTRA } from '../data/nationsExtra.js';
import { CRESTS } from '../data/crests.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const moneyExact = (v) => _eur(v);
export { money } from '../core/fmt.js';
import { eur as _eur, dec2 as _dec2 } from '../core/fmt.js';

// Flags are drawn with CSS (emoji flags do not render on Windows). h = horizontal bands, v = vertical bands.
const FLAGS = {
  GER: ['h', '#000', '#dd0000', '#ffce00'], AUT: ['h', '#ed2939', '#fff', '#ed2939'], NED: ['h', '#ae1c28', '#fff', '#21468b'], FRA: ['v', '#002395', '#fff', '#ed2939'],
  ITA: ['v', '#009246', '#fff', '#ce2b37'], BEL: ['v', '#000', '#fdda24', '#ef3340'], IRL: ['v', '#169b62', '#fff', '#ff883e'], ESP: ['h', '#aa151b', '#f1bf00', '#f1bf00', '#aa151b'],
  HUN: ['h', '#cd2a3e', '#fff', '#436f4d'], BUL: ['h', '#fff', '#00966e', '#d62612'], RUS: ['h', '#fff', '#0039a6', '#d52b1e'], LUX: ['h', '#ed2939', '#fff', '#00a1de'],
  EST: ['h', '#0072ce', '#000', '#fff'], LTU: ['h', '#fdb913', '#006a44', '#c1272d'], ROU: ['v', '#002b7f', '#fcd116', '#ce1126'], MLI: ['v', '#14b53a', '#fcd116', '#ce1126'],
  GUI: ['v', '#ce1126', '#fcd116', '#009460'], CIV: ['v', '#f77f00', '#fff', '#009e60'], NGA: ['v', '#008751', '#fff', '#008751'], CMR: ['v', '#007a5e', '#ce1126', '#fcd116'],
  SEN: ['v', '#00853f', '#fdef42', '#e31b23'], POL: ['h', '#fff', '#dc143c'], UKR: ['h', '#0057b7', '#ffd700'], ARM: ['h', '#d90012', '#0033a0', '#f2a800'],
  COL: ['h', '#fcd116', '#fcd116', '#003893', '#ce1126'], GAB: ['h', '#009e60', '#fcd116', '#3a75c4'], SLE: ['h', '#1eb53a', '#fff', '#0072c6'], YEM: ['h', '#ce1126', '#fff', '#000'],
  GHA: ['h', '#ce1126', '#fcd116', '#006b3f'], BOL: ['h', '#d52b1e', '#f9e300', '#007934'], SRB: ['h', '#c6363c', '#0c4076', '#fff'], SVN: ['h', '#fff', '#005da4', '#ed1c24'],
  SVK: ['h', '#fff', '#0b4ea2', '#ee1c25'], CRO: ['h', '#ff0000', '#fff', '#171796'], SUI: ['x', '#da291c'], DEN: ['n', '#c8102e', '#fff'], SWE: ['n', '#006aa7', '#fecc00'],
  NOR: ['n', '#ba0c2f', '#fff'], FIN: ['n', '#fff', '#002f6c'], ISL: ['n', '#02529c', '#fff'], ENG: ['c', '#fff', '#ce1124'], SCO: ['s', '#005eb8', '#fff'],
  WAL: ['h', '#fff', '#00b140'], POR: ['v', '#006600', '#ff0000', '#ff0000'], ARG: ['h', '#74acdf', '#fff', '#74acdf'], URU: ['h', '#fff', '#0038a8', '#fff', '#0038a8'],
  BRA: ['d', '#009c3b', '#ffdf00'], JPN: ['o', '#fff', '#bc002d'], TUR: ['o', '#e30a17', '#fff'], KOR: ['o', '#fff', '#cd2e3a'], MAR: ['o', '#c1272d', '#006233'],
  ALG: ['v', '#006233', '#fff'], TUN: ['o', '#e70013', '#fff'], USA: ['h', '#b22234', '#fff', '#b22234', '#fff', '#b22234'], CAN: ['v', '#d52b1e', '#fff', '#d52b1e'],
  GRE: ['h', '#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf'], CZE: ['h', '#fff', '#d7141a'], BIH: ['d', '#002395', '#fecb00'], KOS: ['o', '#244aa5', '#d0a650'],
  ALB: ['o', '#e41e20', '#000'], AUS: ['o', '#012169', '#fff'], NIR: ['c', '#fff', '#cc0000'], GEO: ['c', '#fff', '#ff0000'], ECU: ['h', '#ffdd00', '#ffdd00', '#034ea2', '#ed1c24'],
};
export const flag = (nat) => {
  const name = esc(nationName(nat));
  const f = FLAGS[nat];
  if (!f) return `<span class="flg code" title="${name}">${esc(String(nat).slice(0, 3))}</span>`;
  const [t, ...c] = f;
  let bg;
  if (t === 'h' || t === 'v') { const n = c.length; bg = `linear-gradient(${t === 'h' ? '180deg' : '90deg'}, ${c.map((col, i) => `${col} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`).join(', ')})`; }
  else if (t === 'n') bg = `linear-gradient(90deg, transparent 30%, ${c[1]} 30% 42%, transparent 42%), linear-gradient(180deg, transparent 42%, ${c[1]} 42% 58%, transparent 58%), ${c[0]}`;
  else if (t === 'c') bg = `linear-gradient(90deg, transparent 43%, ${c[1]} 43% 57%, transparent 57%), linear-gradient(180deg, transparent 40%, ${c[1]} 40% 60%, transparent 60%), ${c[0]}`;
  else if (t === 'x') bg = `linear-gradient(90deg, transparent 40%, #fff 40% 60%, transparent 60%) center/60% 22% no-repeat, linear-gradient(180deg, transparent 20%, #fff 20% 80%, transparent 80%) center/20% 70% no-repeat, ${c[0]}`;
  else if (t === 's') bg = `linear-gradient(33deg, transparent 45%, ${c[1]} 45% 55%, transparent 55%), linear-gradient(-33deg, transparent 45%, ${c[1]} 45% 55%, transparent 55%), ${c[0]}`;
  else if (t === 'd') bg = `radial-gradient(circle at 50% 50%, ${c[1]} 0 28%, transparent 29%), ${c[0]}`;
  else bg = `radial-gradient(circle at ${nat === 'JPN' || nat === 'KOR' ? '50%' : '42%'} 50%, ${c[1]} 0 26%, transparent 27%), ${c[0]}`;
  return `<span class="flg" title="${name}" style="background:${bg}"></span>`;
};
export function nationName(nat) { return NATIONS[nat]?.name || NATIONS_EXTRA[nat]?.name || nat; }
export const pname = (p) => `${p.firstName} ${p.lastName}`.trim();
export const shortName = (p) => (p.firstName ? `${p.firstName[0]}. ${p.lastName}` : p.lastName);

export function ratingClass(v) {
  return v >= 85 ? 'r-elite' : v >= 75 ? 'r-high' : v >= 65 ? 'r-good' : v >= 55 ? 'r-mid' : 'r-low';
}

export function crest(club, size = 34) {
  if (club.crest) return `<img class="crest" src="${club.crest}" width="${size}" height="${size}" alt="${esc(club.short)}" style="object-fit:contain">`;
  if (CRESTS[club.short]) return `<img class="crest" src="${CRESTS[club.short]}" width="${size}" height="${size}" alt="${esc(club.short)}" style="object-fit:contain">`;
  const c = club.colors;
  const initials = esc(club.short.slice(0, 3));
  return `<svg class="crest" width="${size}" height="${size}" viewBox="0 0 40 46" aria-hidden="true">
    <path d="M20 2 L37 8 V22 C37 33 29 41 20 44 C11 41 3 33 3 22 V8 Z" fill="${c.primary}" stroke="${c.secondary}" stroke-width="3"/>
    <path d="M20 2 L20 44" stroke="${c.secondary}" stroke-width="2" opacity=".35"/>
    <text x="20" y="27" text-anchor="middle" font-size="11" font-weight="800" font-family="Inter,Arial" fill="${c.secondary}">${initials}</text></svg>`;
}

// Generated SVG portrait from appearance data
// Drawn player portrait (no photos): built deterministically from the player's looks so it
// matches his 3D model – skin tone, hair colour/style, beard, face shape, kit colours and number.
function shade(hex, f) {
  const n = parseInt((hex || '#888').slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
// v2.8: AI face photos from the sprite atlas – random but stable per player (hash of the id)
let faceCssReady = false;
export function faceIndex(p) { let x = ((p.id + 1) * 2654435761) >>> 0; x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0; x ^= x >>> 16; return (x >>> 0) % FACE_COUNT; }
export function portrait(p, club, size = 64) {
  if (p.photo) { const c1 = club?.colors?.primary || '#3a3358'; return `<span class="portrait pphoto" aria-hidden="true" style="width:${size}px;height:${size}px;--c1:${c1};background-image:url(${p.photo}),linear-gradient(160deg,color-mix(in srgb,var(--c1) 70%,#1a1530),#120d24 85%)"></span>`; } // v6.0 own photo
  if (!faceCssReady) { const b64 = FACE_ATLAS.slice(FACE_ATLAS.indexOf(',') + 1), bin = atob(b64), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    const url = URL.createObjectURL(new Blob([u8], { type: 'image/webp' })); // a blob URL – large data: URLs are not drawn in CSS
    const st = document.createElement('style'); st.textContent = `.pface{background-image:url("${url}"),linear-gradient(160deg,color-mix(in srgb,var(--c1) 70%,#1a1530),#120d24 85%)}`; document.head.appendChild(st); faceCssReady = true; }
  const i = p.looks?.face ?? faceIndex(p), c1 = club?.colors?.primary || '#3a3358', c2 = club?.colors?.secondary || '#ffffff';
  const col = i % FACE_COLS, row = Math.floor(i / FACE_COLS);
  return `<span class="portrait pface" aria-hidden="true" style="width:${size}px;height:${size}px;--c1:${c1};--c2:${c2};background-size:${FACE_COLS * 100}% ${FACE_ROWS * 100}%, auto;background-position:${(col / (FACE_COLS - 1)) * 100}% ${(row / (FACE_ROWS - 1)) * 100}%, 0 0">${p.number && size >= 56 ? `<i>${p.number}</i>` : ''}</span>`;
}
export function svgPortrait(p, club, size = 64) {
  const L = p.looks || {};
  const skin = L.skin || '#e0b090', hair = L.hair || '#333';
  const shirt = club?.colors?.primary || '#3a3358', sec = club?.colors?.secondary || '#fff';
  const h = (k) => { let x = (p.id * 2654435761 + k * 40503) >>> 0; x ^= x >>> 15; return (x % 1000) / 1000; };
  const uid = `pt${p.id}_${size}`;
  const fw = 12 + h(1) * 2.6, fh = 14.5 + h(2) * 2;          // face width / height
  const jaw = 0.78 + h(3) * 0.16;                             // jaw narrowness
  const eyeY = 29 + h(4) * 1.4, eyeDx = 5 + h(5) * 0.8;
  const brow = 0.9 + h(6) * 1.3;
  const eyeCol = ['#2b1d14', '#3b2a1c', '#4a6a8a', '#3d6b4a', '#1c1c1c'][Math.floor(h(7) * 5)];
  const style = L.hairStyle ?? Math.floor(h(8) * 5);
  const top = 30 - fh;                                         // top of the head
  const hairs = [
    // 0 short crop with side part
    `<path d="M${32 - fw - 1} ${top + 12} C${32 - fw} ${top - 1} ${32 + fw} ${top - 2} ${32 + fw + 1} ${top + 12} C${32 + fw - 3} ${top + 5} ${36} ${top + 4} ${30} ${top + 6} C${26} ${top + 7} ${32 - fw + 3} ${top + 7} ${32 - fw - 1} ${top + 12}Z" fill="${hair}"/>`,
    // 1 buzz cut
    `<path d="M${32 - fw} ${top + 11} C${32 - fw} ${top + 1} ${32 + fw} ${top + 1} ${32 + fw} ${top + 11} C${32 + fw - 2} ${top + 6} ${32 - fw + 2} ${top + 6} ${32 - fw} ${top + 11}Z" fill="${hair}" opacity=".78"/>`,
    // 2 longer hair to the neck
    `<path d="M${32 - fw - 2} ${top + 24} C${32 - fw - 4} ${top - 2} ${32 + fw + 4} ${top - 2} ${32 + fw + 2} ${top + 24} L${32 + fw - 1} ${top + 24} C${32 + fw} ${top + 9} ${32 - fw} ${top + 9} ${32 - fw + 1} ${top + 24}Z" fill="${hair}"/>`,
    // 3 curly / afro
    `<g fill="${hair}">${[...Array(9)].map((_, i) => { const a = Math.PI * (0.05 + (i / 8) * 0.9); return `<circle cx="${(32 - Math.cos(a) * (fw + 1)).toFixed(1)}" cy="${(top + 9 - Math.sin(a) * 7).toFixed(1)}" r="${(4.2 + h(20 + i)).toFixed(1)}"/>`; }).join('')}<ellipse cx="32" cy="${top + 7}" rx="${fw}" ry="6"/></g>`,
    // 4 bald / shaved
    `<path d="M${32 - fw + 1} ${top + 10} C${32 - fw + 2} ${top + 4} ${32 + fw - 2} ${top + 4} ${32 + fw - 1} ${top + 10}" fill="none" stroke="${hair}" stroke-width=".8" opacity=".35"/>`,
  ];
  const bt = L.beard ? Math.floor(h(9) * 3) : -1;
  const beard = bt === 0 ? `<path d="M${32 - fw * jaw} 33 C${32 - fw * 0.7} ${30 + fh} ${32 + fw * 0.7} ${30 + fh} ${32 + fw * jaw} 33 C${32 + 6} 40 ${32 - 6} 40 ${32 - fw * jaw} 33Z" fill="${hair}" opacity=".9"/>`
    : bt === 1 ? `<path d="M${32 - fw * jaw} 32 C${32 - fw * 0.7} ${30 + fh} ${32 + fw * 0.7} ${30 + fh} ${32 + fw * jaw} 32" fill="none" stroke="${hair}" stroke-width="2.4" opacity=".35"/>`
    : bt === 2 ? `<path d="M29 38.5 Q32 ${30 + fh + 1} 35 38.5 Q32 40.5 29 38.5Z M28 36.4 Q32 35 36 36.4" fill="${hair}" stroke="${hair}" stroke-width=".9" opacity=".85"/>` : '';
  const face = `M${32 - fw} 28 C${32 - fw} ${top + 2} ${32 + fw} ${top + 2} ${32 + fw} 28 C${32 + fw} ${33} ${32 + fw * jaw} ${30 + fh - 2} 32 ${30 + fh} C${32 - fw * jaw} ${30 + fh - 2} ${32 - fw} 33 ${32 - fw} 28Z`;
  return `<svg class="portrait" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="${uid}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(shirt, 0.55)}"/><stop offset="1" stop-color="#120d24"/></linearGradient>
      <radialGradient id="${uid}s" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="${shade(skin, 1.08)}"/><stop offset="1" stop-color="${shade(skin, 0.82)}"/></radialGradient></defs>
    <rect width="64" height="64" rx="14" fill="url(#${uid}b)"/>
    <path d="M0 52 L64 40 L64 46 L0 58Z" fill="${sec}" opacity=".12"/>
    <path d="M4 64 C6 50 18 45.5 32 45.5 C46 45.5 58 50 60 64Z" fill="${shirt}"/>
    <path d="M4 64 C6 50 18 45.5 32 45.5" fill="none" stroke="${shade(shirt, 0.7)}" stroke-width="1.2"/>
    <path d="M25.5 46 L32 52.5 L38.5 46" fill="none" stroke="${sec}" stroke-width="2.6" stroke-linejoin="round"/>
    <text x="48" y="60" font-size="8" font-weight="800" text-anchor="middle" fill="${sec}" opacity=".85" font-family="Arial">${p.number || ''}</text>
    <path d="M27 ${30 + fh - 4} L27 47 Q32 50 37 47 L37 ${30 + fh - 4}Z" fill="${shade(skin, 0.86)}"/>
    <ellipse cx="${32 - fw - 0.6}" cy="30" rx="1.9" ry="3" fill="${shade(skin, 0.9)}"/><ellipse cx="${32 + fw + 0.6}" cy="30" rx="1.9" ry="3" fill="${shade(skin, 0.9)}"/>
    <path d="${face}" fill="url(#${uid}s)"/>
    ${hairs[style] || hairs[0]}
    <path d="M${32 - eyeDx - 2.6} ${eyeY - 3.2} Q${32 - eyeDx} ${eyeY - 4.4} ${32 - eyeDx + 2.6} ${eyeY - 3.3}" stroke="${shade(hair, 0.8)}" stroke-width="${brow}" fill="none" stroke-linecap="round"/>
    <path d="M${32 + eyeDx - 2.6} ${eyeY - 3.3} Q${32 + eyeDx} ${eyeY - 4.4} ${32 + eyeDx + 2.6} ${eyeY - 3.2}" stroke="${shade(hair, 0.8)}" stroke-width="${brow}" fill="none" stroke-linecap="round"/>
    <ellipse cx="${32 - eyeDx}" cy="${eyeY}" rx="2.1" ry="1.25" fill="#f4f1ea"/><ellipse cx="${32 + eyeDx}" cy="${eyeY}" rx="2.1" ry="1.25" fill="#f4f1ea"/>
    <circle cx="${32 - eyeDx + 0.2}" cy="${eyeY}" r=".95" fill="${eyeCol}"/><circle cx="${32 + eyeDx + 0.2}" cy="${eyeY}" r=".95" fill="${eyeCol}"/>
    <path d="M32 ${eyeY + 1} L${30.6 - h(10)} ${eyeY + 6.5} Q32 ${eyeY + 7.5} ${33.4 + h(10)} ${eyeY + 6.5}" fill="none" stroke="${shade(skin, 0.7)}" stroke-width=".9" stroke-linejoin="round"/>
    <path d="M${29 - h(11)} ${eyeY + 10} Q32 ${eyeY + 11.2 + h(12)} ${35 + h(11)} ${eyeY + 10}" stroke="${shade(skin, 0.55)}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
    ${beard}
  </svg>`;
}

export function bar(v, max = 100, cls = '') {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return `<div class="bar ${cls}"><i style="width:${pct}%"></i></div>`;
}

export function toast(msg, ms = 2600) {
  let host = $('#toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms);
}

export function modal(html, { wide = false, onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><button class="modal-x" aria-label="Schließen">✕</button>${html}</div>`;
  document.body.appendChild(wrap);
  const close = () => { wrap.remove(); onClose?.(); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('.modal-x').addEventListener('click', close);
  return { el: wrap.querySelector('.modal'), close };
}

// In-page confirmation (native confirm() is blocked in sandboxed frames)
export function confirmDialog(text, okLabel = 'OK') {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(`<p style="margin:.4rem 1.6rem 1rem 0">${esc(text)}</p><div class="row-actions end"><button class="btn ghost" data-c="0">Abbrechen</button><button class="btn primary" data-c="1">${esc(okLabel)}</button></div>`,
      { onClose: () => { if (!done) resolve(false); } });
    m.el.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { done = true; resolve(b.dataset.c === '1'); m.close(); }));
  });
}

// ------------------------------------------------------------------ money inputs (v2.9)
// Commercial formatting while typing: "1.500.000 €". Accepts "1,5 Mio", "750 Tsd", "2m", "300k" too.
export const fmtMoneyInput = (v) => (v == null || v === '' ? '' : _dec2(Math.round(+v * 100) / 100));
export function parseMoney(str) {
  if (str == null) return 0;
  const t = String(str).trim().toLowerCase().replace(/€/g, '').replace(/\s+/g, '');
  if (!t) return 0;
  const m = t.match(/^([\d.,]+)(mio|mrd|m|tsd|k|t)?\.?$/);
  if (!m) return Math.round(+t.replace(/\D/g, '') || 0);
  let num = m[1];
  const unit = m[2];
  if (unit || /,\d{1,2}$/.test(num)) num = +num.replace(/\./g, '').replace(',', '.'); else num = +num.replace(/[.,]/g, '');
  const mul = unit === 'mrd' ? 1e9 : unit === 'mio' || unit === 'm' ? 1e6 : unit === 'tsd' || unit === 'k' || unit === 't' ? 1e3 : 1;
  return Math.round((num || 0) * mul * 100) / 100;
}
export function moneyInput(id, value, { step = 10000, placeholder = '' } = {}) {
  return `<span class="minput"><button type="button" class="mi-b" data-mstep="-${step}" data-for="${id}" aria-label="weniger">−</button><input class="input" id="${id}" type="text" inputmode="numeric" autocomplete="off" data-money value="${value === '' || value == null ? '' : fmtMoneyInput(value)}" placeholder="${placeholder}"><i>€</i><button type="button" class="mi-b" data-mstep="${step}" data-for="${id}" aria-label="mehr">+</button></span>`;
}
export const readMoney = (el) => parseMoney(el?.value);
if (typeof document !== 'undefined' && !window.__moneyBound) {
  window.__moneyBound = true;
  // live formatting with thousands separators; keep the caret at the same digit position
  document.addEventListener('input', (e) => {
    const el = e.target; if (!el.matches?.('input[data-money]')) return;
    if (/[a-zA-Z,]/.test(el.value)) return; // user types "1,5 Mio" – format on blur
    const digitsBefore = el.value.slice(0, el.selectionStart).replace(/\D/g, '').length;
    const n = el.value.replace(/\D/g, '');
    el.value = n ? (+n).toLocaleString('de-DE') : '';
    let pos = 0, seen = 0; while (pos < el.value.length && seen < digitsBefore) { if (/\d/.test(el.value[pos])) seen++; pos++; }
    el.setSelectionRange(pos, pos);
  });
  document.addEventListener('focusout', (e) => { const el = e.target; if (el.matches?.('input[data-money]') && el.value.trim()) el.value = fmtMoneyInput(parseMoney(el.value)); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-mstep]'); if (!b) return;
    const el = document.getElementById(b.dataset.for); if (!el) return;
    el.value = fmtMoneyInput(Math.max(0, parseMoney(el.value) + +b.dataset.mstep));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
