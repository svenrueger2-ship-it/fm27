// v5.3 language support. The game is written in German; other languages are applied at runtime by a
// DOM translator: every text node and a few attributes are looked up in a dictionary (exact phrases,
// templates with {} placeholders for names and numbers, and " · "-separated parts). Player, club and
// user-written texts are never in the dictionary, so they stay untouched.
import { EN } from './en.js';

export const LANGS = [
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
];
const DICTS = { en: EN };
const KEY = 'fm27-lang';

export function getLang() {
  try { const l = localStorage.getItem(KEY); if (l && (l === 'de' || DICTS[l])) return l; } catch {}
  return 'de';
}
export function setLang(id) { try { localStorage.setItem(KEY, id); } catch {} }

// ------------------------------------------------------------------ dictionary compile
const NUM = /\d+(?:[.,]\d+)*/g;
let exact = null, numTpl = null, tpls = null, memo = null;
function compile(dict) {
  exact = new Map(); numTpl = new Map(); tpls = []; memo = new Map();
  const add = (de, en) => {
    if (!de.includes('{}')) { if (!exact.has(de)) exact.set(de, en); return; }
    if (numTpl.has(de)) return;
    numTpl.set(de, en);
    const parts = de.split('{}');
    const longest = parts.reduce((a, b) => (b.length > a.length ? b : a), '');
    if (longest.trim().length < 2) return;
    const re = new RegExp('^' + parts.map((p) => p.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('(.+?)') + '$', 's');
    tpls.push({ re, en, key: longest });
  };
  for (const [de, en] of dict) {
    add(de, en);
    // the same phrase without a leading emoji/symbol (icons are often separate elements)
    const m = LEAD.exec(de), n = LEAD.exec(en);
    if (m && m[2].length > 2) add(m[2], n ? n[2] : en);
  }
  tpls.sort((a, b) => b.key.length - a.key.length);
}
const LEAD = /^([^\p{L}\p{N}{]+)(.*)$/su;
// a captured value may be a name or number – but never a whole German sentence
const PARTICLES = new Set(['de', 'da', 'do', 'dos', 'van', 'von', 'der', 'den', 'di', 'del', 'la', 'le', 'el', 'al', 'bin', 'e', 'y', 'du', 'ter', 'vom', 'zu', 'am', 'an']);
function nameLike(v) {
  if (v.includes(', ')) return v.split(', ').every(nameLike);
  const w = v.trim().split(/\s+/);
  if (w.length > 5 || v.length > 48) return false;
  return w.every((x) => !/^\p{Ll}/u.test(x) || PARTICLES.has(x));
}
const numEN = (v) => (/^\d{1,3}(\.\d{3})+(,\d+)?$|^\d+,\d+$/.test(v) ? v.replace(/\./g, '\u0000').replace(/,/g, '.').replace(/\u0000/g, ',') : v);
function fill(en, vals) { let i = 0; return en.replace(/\{(\d?)\}/g, (_, n) => { const v = vals[n === '' ? i++ : +n] ?? ''; return numEN(v); }); }

function trCore(s) {
  const e = exact.get(s); if (e != null) return e;
  // numbers → {}
  const nums = s.match(NUM);
  if (nums) { const k = s.replace(NUM, '{}'); const t = numTpl.get(k); if (t != null) return fill(t, nums); }
  for (const t of tpls) {
    if (!s.includes(t.key)) continue;
    const m = t.re.exec(s);
    if (!m) continue;
    const vals = m.slice(1), out = [];
    let ok = true;
    for (const v of vals) { const r = trPart(v); if (r === v && /\p{L}/u.test(v) && !nameLike(v)) { ok = false; break; } out.push(r); }
    if (ok) return fill(t.en, out);
  }
  // separators: translate the parts (every part must be translated or look like a name/number)
  for (const sep of [' · ', ' – ', ': ', ' | ', ' → ']) {
    if (!s.includes(sep)) continue;
    const ps = s.split(sep), tr = ps.map(trPart);
    if (tr.some((x, i) => x !== ps[i]) && tr.every((x, i) => x !== ps[i] || !/\p{L}/u.test(ps[i]) || nameLike(ps[i]))) return tr.join(sep);
  }
  // leading emoji/symbol, numbering "2. " or trailing "(…)"
  let m = /^([^\p{L}\p{N}]+)(\p{L}.*)$/su.exec(s) || /^(\d+\.\s+)(.+)$/su.exec(s);
  if (m) { const r = trPart(m[2]); if (r !== m[2]) return m[1] + r; }
  m = /^(.+?)(\s*\([^()]*\)[.!]?)$/su.exec(s);
  if (m) { const r = trPart(m[1]); if (r !== m[1]) return r + m[2]; }
  return null;
}
function trPart(s) {
  if (!s || !/\p{L}{2}/u.test(s)) return s;
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.trim();
  if (memo.has(core)) { const r = memo.get(core); return r == null ? s : lead + r + trail; }
  const r = trCore(core);
  if (memo.size > 20000) memo.clear();
  memo.set(core, r);
  return r == null ? s : lead + r + trail;
}

// public: translate a string for the current language (for canvas texts etc.)
export function tr(s) { return CUR ? trPart(String(s)) : s; }

// ------------------------------------------------------------------ DOM translator
let CUR = null, writing = false;
const ATTRS = ['placeholder', 'title', 'aria-label', 'data-tip'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'svg']);
function skip(el) { return !el || SKIP.has(el.nodeName) || el.isContentEditable || el.closest?.('[data-noi18n]'); }

function trText(node) {
  const v = node.nodeValue; if (!v || !/\p{L}{2}/u.test(v)) return;
  const r = trPart(v);
  if (r !== v) { writing = true; node.nodeValue = r; writing = false; }
}
function trEl(el) {
  for (const a of ATTRS) { const v = el.getAttribute?.(a); if (v) { const r = trPart(v); if (r !== v) el.setAttribute(a, r); } }
  if (el.nodeName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && el.value) el.value = trPart(el.value);
  if (el.nodeName === 'OPTION' || el.nodeName === 'OPTGROUP') { const l = el.getAttribute('label'); if (l) el.setAttribute('label', trPart(l)); }
}
export function translateTree(root) {
  if (!CUR || !root) return;
  if (root.nodeType === 3) { if (!skip(root.parentElement)) trText(root); return; }
  if (root.nodeType !== 1 || skip(root)) return;
  writing = true;
  trEl(root);
  root.querySelectorAll?.('[placeholder],[title],[aria-label],[data-tip],input[type=button],optgroup').forEach((el) => { if (!skip(el)) trEl(el); });
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (skip(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  let n; while ((n = tw.nextNode())) trText(n);
  writing = false;
}

export function startI18n(lang = getLang()) {
  document.documentElement.lang = lang;
  if (lang === 'de' || !DICTS[lang]) return;
  CUR = lang; compile(DICTS[lang]);
  const pending = new Set(); let scheduled = false;
  const flush = () => { scheduled = false; for (const n of pending) if (n.isConnected) translateTree(n); pending.clear(); };
  const mo = new MutationObserver((list) => {
    if (writing) return;
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach((n) => pending.add(n));
      else if (m.type === 'characterData') pending.add(m.target);
      else if (m.type === 'attributes') pending.add(m.target);
    }
    if (!scheduled) { scheduled = true; queueMicrotask(flush); }
  });
  const go = () => { translateTree(document.body); document.title = trPart(document.title); mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); };
  if (document.body) go(); else addEventListener('DOMContentLoaded', go);
}
