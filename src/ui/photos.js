// v6.0 eigene Spielerfotos: the user adds real photos to players himself. They are shrunk to a 200 px
// WebP and stored in the save game only (never in the game files).
import { esc, modal, toast, portrait } from './dom.js';

/** Reads an image file and returns a square, top-anchored WebP data URL. */
export function fileToPhoto(file, size = 200) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = img.height > img.width ? (img.height - s) * 0.12 : 0;
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      cv.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      let d = cv.toDataURL('image/webp', 0.82); if (!d.startsWith('data:image/webp')) d = cv.toDataURL('image/jpeg', 0.85);
      resolve(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')); };
    img.src = url;
  });
}
function pickFiles(multiple, accept = 'image/*') {
  return new Promise((resolve) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept; inp.multiple = !!multiple;
    inp.onchange = () => resolve([...(inp.files || [])]); inp.click();
  });
}
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** single player: choose a photo */
export async function setPhoto(app, p, done) {
  const [f] = await pickFiles(false); if (!f) return;
  try { p.photo = await fileToPhoto(f); toast('Foto gespeichert'); done?.(); } catch (e) { toast(e.message); }
}
export function removePhoto(p, done) { delete p.photo; toast('Foto entfernt'); done?.(); }

/** many photos at once: each photo gets a player (pre-selected by file name: name, last name or shirt number) */
export async function bulkPhotos(app, done) {
  const all = await pickFiles(true, 'image/*,.json,.fm27photos'); if (!all.length) return;
  // photo packs (.fm27photos / .json): [{ first, last, club?, photo }] – matched by name in the whole world
  const packs = all.filter((f) => /\.(json|fm27photos)$/i.test(f.name)), files = all.filter((f) => !packs.includes(f));
  if (packs.length) {
    let n = 0, miss = [];
    const byName = new Map();
    for (const p of Object.values(app.world.players)) { const k = norm(p.firstName + p.lastName); (byName.get(k) || byName.set(k, []).get(k)).push(p); }
    for (const f of packs) {
      try {
        const data = JSON.parse(await f.text()), list = Array.isArray(data) ? data : data.photos || [];
        for (const e of list) {
          const cands = byName.get(norm((e.first || '') + (e.last || ''))) || [];
          const hit = cands.find((p) => !e.club || app.world.clubs[p.clubId]?.short === e.club) || cands[0];
          if (hit && typeof e.photo === 'string' && e.photo.startsWith('data:image/')) { hit.photo = e.photo; n++; } else miss.push(`${e.first} ${e.last}`);
        }
      } catch { toast(`${f.name}: kein gültiges Fotopaket`); }
    }
    toast(`📦 ${n} Foto(s) aus dem Paket übernommen${miss.length ? ` · ${miss.length} Spieler nicht gefunden` : ''}`);
    if (!files.length) { done?.(); return; }
  }
  const w = app.world, squad = app.club.squad.map((id) => w.players[id]).filter(Boolean).sort((a, b) => a.number - b.number);
  const items = [];
  for (const f of files.slice(0, 40)) {
    try {
      const photo = await fileToPhoto(f), base = norm(f.name.replace(/\.[^.]+$/, ''));
      const guess = squad.find((p) => base && (base === norm(p.firstName + p.lastName) || base === norm(p.lastName) || base.includes(norm(p.lastName)) || base === String(p.number)));
      items.push({ photo, name: f.name, pid: guess?.id ?? '' });
    } catch { /* skip unreadable files */ }
  }
  if (!items.length) return toast('Keine Bilder gefunden');
  const opts = (sel) => `<option value="">– nicht zuordnen –</option>${squad.map((p) => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>#${p.number} ${esc(p.firstName)} ${esc(p.lastName)}</option>`).join('')}`;
  const m = modal(`<h3>📷 Spielerfotos zuordnen</h3><p class="muted small">Wähle zu jedem Foto den Spieler. Heißt die Datei wie der Spieler (z. B. „Karius.jpg“ oder „1.jpg“ für die Rückennummer), ist er schon ausgewählt.</p>
    <div class="photo-map">${items.map((it, i) => `<div class="photo-row"><img src="${it.photo}" alt=""><div><small class="muted">${esc(it.name)}</small><select class="input" data-i="${i}">${opts(it.pid)}</select></div></div>`).join('')}</div>
    <div class="row-actions end"><button class="btn primary" id="ph-ok">Übernehmen</button></div>`, { wide: true });
  m.el.querySelector('#ph-ok').onclick = () => {
    let n = 0;
    m.el.querySelectorAll('select[data-i]').forEach((s) => { const id = +s.value; if (s.value && w.players[id]) { w.players[id].photo = items[+s.dataset.i].photo; n++; } });
    m.close(); toast(`${n} Foto(s) übernommen`); done?.();
  };
}
export { portrait };
