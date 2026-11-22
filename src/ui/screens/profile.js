// Manager-Profil (v2.5): level, XP, skill tree, daily & weekly tasks.
import { esc, money, toast } from '../dom.js';
import { mgrPortrait } from './managerCreate.js';
import { NATIONS_EXTRA } from '../../data/nationsExtra.js';
import { SKILLS, ensureMgr, xpForLevel, buySkill, ensureTasks, claimTask, MAX_LEVEL } from '../../manager/progress.js';

const untilMidnight = () => { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); const h = Math.floor((m - n) / 36e5), mi = Math.floor(((m - n) % 36e5) / 6e4); return `${h} Std. ${mi} Min.`; };
const untilMonday = () => { const n = new Date(), d = (8 - (n.getDay() || 7)) % 7 || 7, m = new Date(n); m.setDate(n.getDate() + d); m.setHours(0, 0, 0, 0); return `${Math.floor((m - n) / 864e5)} T. ${Math.floor(((m - n) % 864e5) / 36e5)} Std.`; };

export function profileScreen(app, el) {
  const w = app.world, M = ensureMgr(w), T = ensureTasks(w);
  const need = xpForLevel(M.level), pct = M.level >= MAX_LEVEL ? 100 : Math.round((M.xp / need) * 100);
  const title = M.level >= 25 ? 'Trainerlegende' : M.level >= 18 ? 'Meistertrainer' : M.level >= 12 ? 'Erfahrener Coach' : M.level >= 6 ? 'Etablierter Trainer' : 'Jungtrainer';
  const task = (t) => `<div class="task ${t.claimed ? 'claimed' : t.prog >= t.goal ? 'ready' : ''}"><div><b>${esc(t.text)}</b><div class="tbar"><i style="width:${(t.prog / t.goal) * 100}%"></i></div><small>${t.prog}/${t.goal} · ${t.xp} XP${t.cash ? ` · ${money(t.cash)} Prämie` : ''}</small></div>
    ${t.claimed ? '<span class="chip">✓ erhalten</span>' : t.prog >= t.goal ? `<button class="btn sm primary" data-claim="${t.id}">Abholen</button>` : ''}</div>`;
  el.innerHTML = `<div class="page"><div class="page-head"><h2>🎖️ Manager-Profil</h2>${M.points ? `<span class="chip good">${M.points} Skillpunkt${M.points > 1 ? 'e' : ''} verfügbar</span>` : ''}</div>
    <div class="grid2">
      <div class="card lvl-card"><div class="lvl-ring" style="--p:${pct}"><b>${M.level}</b><small>Level</small></div>
        <div class="lvl-face">${mgrPortrait(w, 84)}</div><div><h3>${esc(w.manager?.name || 'Manager')}</h3><p class="muted">${title}${w.manager?.age ? ` · ${NATIONS_EXTRA[w.manager.nat]?.flag || ''} ${w.manager.bornSeason != null ? w.season - w.manager.bornSeason : w.manager.age} Jahre` : ''}</p><button class="btn sm ghost" id="mgr-edit">✏️ Manager bearbeiten</button><div class="tbar big"><i style="width:${pct}%"></i></div><small>${M.level >= MAX_LEVEL ? 'Maximales Level erreicht' : `${M.xp} / ${need} XP bis Level ${M.level + 1}`}</small>
        <p class="muted" style="margin-top:.5rem">XP gibt es für Siege, Tore, Titel, Erfolge und erledigte Aufgaben. Jedes Level bringt einen Skillpunkt.</p></div></div>
      <div class="card"><div class="row-between"><h3>📅 Tagesaufgaben</h3><small class="muted">neu in ${untilMidnight()}</small></div>${T.daily.map(task).join('')}
        <div class="row-between" style="margin-top:12px"><h3>🗓️ Wochenaufgaben</h3><small class="muted">neu in ${untilMonday()}</small></div>${T.weekly.map(task).join('')}</div>
    </div>
    <div class="card"><h3>🌳 Fähigkeiten</h3><div class="skill-grid">${SKILLS.map((s) => { const r = M.skills[s.id] || 0; return `<div class="skill ${r ? 'on' : ''}"><div class="row-between"><b>${s.icon} ${esc(s.name)}</b><span class="pips">${[1, 2, 3].map((k) => `<i class="${k <= r ? 'on' : ''}"></i>`).join('')}</span></div>
      <ul>${s.ranks.map((t, k) => `<li class="${k < r ? 'got' : k === r ? 'next' : ''}">${k < r ? '✓' : k + 1}. ${esc(t)}</li>`).join('')}</ul>
      ${r < 3 ? `<button class="btn sm ${M.points ? 'primary' : ''}" data-skill="${s.id}" ${M.points ? '' : 'disabled'}>Stufe ${r + 1} lernen</button>` : '<span class="chip good">Gemeistert</span>'}</div>`; }).join('')}</div></div>
    <div class="card"><h3>📜 Letzte XP</h3>${M.log.slice(0, 12).map((l) => `<div class="kv"><span>${esc(l.why)}</span><b class="good">+${l.xp} XP</b></div>`).join('') || '<p class="muted">Noch keine Erfahrungspunkte – bestreite dein erstes Spiel!</p>'}</div></div>`;
  el.querySelector('#mgr-edit')?.addEventListener('click', () => app.go('mgrCreate'));
  el.querySelectorAll('[data-skill]').forEach((b) => (b.onclick = () => { if (buySkill(w, b.dataset.skill)) { toast('Fähigkeit gelernt!'); app.go('profile'); } }));
  el.querySelectorAll('[data-claim]').forEach((b) => (b.onclick = () => { const t = claimTask(w, b.dataset.claim); if (t) { toast(`+${t.xp} XP${t.cash ? ` · ${money(t.cash)}` : ''}`); app.go('profile'); } }));
}
