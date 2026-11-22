// v2.8 navigation: an icon rail with groups that expands on hover (or stays pinned), a sliding active
// indicator, live badges and a command palette (Ctrl+K) to jump to any screen or player.
import { esc } from './dom.js';

const P = {
  home: '<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  matchday: '<circle cx="12" cy="12" r="9"/><path d="m12 7.2 3.4 2.5-1.3 4h-4.2l-1.3-4zM12 3v4.2M20.6 9.3l-5.2.4M17.3 19.4l-3.2-5.7M6.7 19.4l3.2-5.7M3.4 9.3l5.2.4"/>',
  staff: '<path d="M3 13h5l1.5 3h5l1.5-3h5"/><path d="M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
  squad: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.6 14.3A5 5 0 0 1 21 19.5"/>',
  kabine: '<path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3c-.6 1.6-2.1 2.6-4 2.6S8.6 4.6 8 3z"/>',
  tactics: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><circle cx="7" cy="9" r="1.2"/><circle cx="7" cy="15" r="1.2"/><path d="M8.5 13c2-3 5-4 8-4.5m-2-1.8 2 1.8-1.6 2.2"/>',
  training: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  transfers: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  finance: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.8a4.3 4.3 0 1 0 0 6.4M7.5 10.8h6M7.5 13.2h6"/>',
  stadium: '<path d="M3 20h18M4.5 20V9.5c2.4-1.6 4.9-2.4 7.5-2.4s5.1.8 7.5 2.4V20"/><path d="M9 20v-5h6v5M12 7V3l3 1.2L12 5.4"/>',
  league: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3.2 4M16 6h3a3 3 0 0 1-3.2 4M12 13v4M8 20h8"/>',
  analysis: '<path d="M3 20h18M6 20v-7M11 20V5M16 20v-9M21 20V9"/>',
  cups: '<circle cx="12" cy="15" r="5"/><path d="m8.5 3 3.5 7 3.5-7M12 13.2v3.6"/>',
  world: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.6 3.2 14.4 0 18M12 3c-3.2 3.6-3.2 14.4 0 18"/>',
  career: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7M3 12.5h18"/>',
  media: '<path d="M4 5h13v14H5.2A1.2 1.2 0 0 1 4 17.8zM17 9h3v9a1.5 1.5 0 0 1-3 0M7 9h7M7 12.5h7M7 16h4"/>',
  achievements: '<path d="m12 3 2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  saves: '<path d="M5 3h11l3 3v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 3v5h7V3M8 21v-7h8v7"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="8" cy="14.5" r=".9" fill="currentColor"/><circle cx="12" cy="14.5" r=".9" fill="currentColor"/><circle cx="16" cy="14.5" r=".9" fill="currentColor"/>',
  pin: '<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v7"/>',
};
export const icon = (k, s = 22) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[k] || P.home}</svg>`;

export const NAV_GROUPS = [
  ['Übersicht', [['home', 'Vereinszentrale', 'Zentrale'], ['calendar', 'Kalender', 'Kalender'], ['matchday', 'Spieltag', 'Spiel'], ['staff', 'Stab & Posteingang', 'Stab']]],
  ['Mannschaft', [['squad', 'Kader', 'Kader'], ['tactics', 'Taktik', 'Taktik'], ['training', 'Training', 'Training'], ['kabine', 'Kabine', 'Kabine']]],
  ['Verein', [['transfers', 'Transfers & Scouting', 'Transfer'], ['finance', 'Finanzen & Ausbau', 'Finanzen'], ['stadium', 'Stadion bauen', 'Stadion']]],
  ['Wettbewerbe', [['league', 'Liga', 'Liga'], ['cups', 'Pokale & Europa', 'Pokale'], ['world', 'Fußballwelt', 'Welt'], ['analysis', 'Analyse-Hub', 'Analyse']]],
  ['Manager', [['career', 'Karriere', 'Karriere'], ['profile', 'Manager-Profil', 'Profil'], ['achievements', 'Erfolge', 'Erfolge'], ['media', 'Medien', 'Medien']]],
];
export const NAV_FLAT = NAV_GROUPS.flatMap(([, items]) => items).concat([['saves', 'Spielstände', 'Speichern'], ['settings', 'Einstellungen', 'Optionen']]);

export function navHtml(screen, badges, pinned, level) {
  const item = ([id, label, short]) => `<button data-nav="${id}" class="nv ${screen === id ? 'active' : ''}" title="${esc(label)}">${icon(id)}<span class="nv-l">${esc(label)}</span><span class="nv-s">${esc(short)}</span>${badges[id] ? `<b class="nv-b">${badges[id]}</b>` : ''}</button>`;
  return `<nav class="rail ${pinned ? 'pinned' : ''}">
    <div class="rail-scroll"><i class="rail-ink"></i>${NAV_GROUPS.map(([g, items]) => `<div class="rg"><small class="rg-t">${g}</small>${items.map(item).join('')}</div>`).join('')}</div>
    <div class="rail-foot">${item(['saves', 'Spielstände', 'Speichern'])}${item(['settings', 'Einstellungen', 'Optionen'])}
      <button class="nv rail-pin" id="rail-pin" title="${pinned ? 'Menü einklappen' : 'Menü dauerhaft ausklappen'}">${icon('pin', 20)}<span class="nv-l">${pinned ? 'Einklappen' : 'Anheften'}</span><span class="nv-s">${pinned ? 'Lösen' : 'Anheften'}</span></button>
      <button class="nv" data-nav="profile" title="Manager-Profil"><span class="lvl-dot">${level}</span><span class="nv-l">Level ${level}</span><span class="nv-s">Lvl ${level}</span></button></div></nav>`;
}

/** Slide the active indicator from its previous position to the active item. */
let lastInk = null;
export function placeInk(root) {
  const rail = root.querySelector('.rail-scroll'), ink = rail?.querySelector('.rail-ink'), act = rail?.querySelector('.nv.active');
  if (!ink) return;
  if (!act) { ink.style.opacity = '0'; return; }
  const top = act.getBoundingClientRect().top - rail.getBoundingClientRect().top + rail.scrollTop, h = act.offsetHeight;
  if (!rail.dataset.bound) { rail.dataset.bound = '1'; const nav = rail.closest('.rail'); const re = () => setTimeout(() => placeInk(root), 290); nav.addEventListener('mouseenter', re); nav.addEventListener('mouseleave', re); act.scrollIntoView({ block: 'nearest' }); }
  ink.style.transition = 'none'; ink.style.height = `${h}px`; ink.style.transform = `translateY(${lastInk ?? top}px)`; ink.style.opacity = '1';
  requestAnimationFrame(() => { ink.style.transition = ''; ink.style.transform = `translateY(${top}px)`; lastInk = top; });
}

// ------------------------------------------------------------------ command palette (Ctrl+K)
export function openPalette(app) {
  if (document.querySelector('.palette')) return;
  const w = app.world, club = app.club;
  const items = [
    ...NAV_FLAT.map(([id, label]) => ({ kind: 'Bereich', label, ico: id, run: () => app.go(id) })),
    { kind: 'Aktion', label: 'Spiel speichern', ico: 'saves', run: () => app.save() },
    { kind: 'Aktion', label: 'Zum nächsten Spiel', ico: 'matchday', run: () => app.go('matchday') },
    ...(club ? club.squad.map((id) => w.players[id]).filter(Boolean).map((p) => ({ kind: `Spieler · ${p.pos}`, label: `${p.firstName} ${p.lastName}`, ico: 'profile', run: async () => { const { playerModal } = await import('./screens/manager.js'); playerModal(app, p); } })) : []),
  ];
  const host = document.createElement('div');
  host.className = 'palette';
  host.innerHTML = `<div class="pal-box"><div class="pal-in">${icon('search', 20)}<input placeholder="Wohin? Bereich, Spieler oder Aktion …" autofocus><kbd>Esc</kbd></div><div class="pal-list"></div></div>`;
  document.body.appendChild(host);
  const input = host.querySelector('input'), list = host.querySelector('.pal-list');
  let sel = 0, shown = [];
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const draw = () => {
    const q = norm(input.value.trim());
    shown = (q ? items.filter((i) => norm(i.label).includes(q) || norm(i.kind).includes(q)) : items.slice(0, 22)).slice(0, 40);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = shown.map((i, k) => `<button class="pal-it ${k === sel ? 'on' : ''}" data-k="${k}">${icon(i.ico, 18)}<span>${esc(i.label)}</span><small>${esc(i.kind)}</small></button>`).join('') || '<p class="pal-empty">Nichts gefunden</p>';
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
    list.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => pick(+b.dataset.k)));
  };
  const close = () => { host.classList.add('out'); setTimeout(() => host.remove(), 160); };
  const pick = (k) => { const it = shown[k]; close(); it?.run(); };
  input.oninput = () => { sel = 0; draw(); };
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter') pick(sel);
    else if (e.key === 'Escape') close();
  };
  host.addEventListener('pointerdown', (e) => { if (e.target === host) close(); });
  draw(); setTimeout(() => input.focus(), 20);
}
