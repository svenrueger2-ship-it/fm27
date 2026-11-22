// Application shell: routing, layout, autosave. Screens live in ./screens/*.
import { loadSettings, saveGame } from '../storage/db.js';
import { userFixture, userLeague, isUserSeasonOver } from '../manager/season.js';
import { crest, esc, money, toast } from './dom.js';
import { startScreen, newGameScreen, savesScreen, settingsScreen, seasonEndScreen } from './screens/menu.js';
import { dashboardScreen, squadScreen, leagueScreen } from './screens/manager.js';
import { tacticsScreen } from './screens/tactics.js';
import { matchdayScreen } from './screens/match.js';
import { transfersScreen } from './screens/transfers.js';
import { financeScreen } from './screens/finance.js';
import { trainingScreen } from './screens/training.js';
import { stadiumScreen } from './screens/stadium.js';
import { cupsScreen } from './screens/cups.js';
import { staffScreen } from './screens/staff.js';
import { worldScreen } from './screens/world.js';
import { careerScreen } from './screens/career.js';
import { mediaScreen } from './screens/media.js';
import { founderScreen } from './screens/founder.js';
import { kabineScreen } from './screens/kabine.js';
import { achievementsScreen } from './screens/achievements.js';
import { analysisScreen } from './screens/analysis.js';
import { profileScreen } from './screens/profile.js';
import { openTasks } from '../manager/progress.js';
import { openInbox } from '../manager/staff.js';
import { applyTheme } from './theme.js';
import { animateNumbers, runCeremonies } from './fx.js';
import { windowInfo } from '../manager/transfers.js';

const NAV = [
  ['home', 'Vereinszentrale', '🏟️', 'Zentrale'], ['staff', 'Stab & Posteingang', '🧑‍💼', 'Stab'], ['matchday', 'Spieltag', '⚽', 'Spiel'], ['squad', 'Kader', '👥', 'Kader'], ['kabine', 'Kabine', '🛋️', 'Kabine'], ['tactics', 'Taktik', '📋', 'Taktik'],
  ['training', 'Training', '🏋️', 'Training'], ['transfers', 'Transfers & Scouting', '🔄', 'Transfer'], ['finance', 'Finanzen & Ausbau', '💶', 'Finanzen'], ['stadium', 'Stadion bauen', '🏟️', 'Stadion'],
  ['league', 'Liga', '🏆', 'Liga'], ['analysis', 'Analyse-Hub', '📊', 'Analyse'], ['cups', 'Pokale & Europa', '🏅', 'Pokale'], ['world', 'Fußballwelt', '🌍', 'Welt'], ['career', 'Karriere', '👔', 'Karriere'], ['media', 'Medien', '📰', 'Medien'], ['achievements', 'Erfolge', '🏅', 'Erfolge'], ['profile', 'Manager-Profil', '🎖️', 'Profil'], '-', ['saves', 'Spielstände', '💾', 'Speichern'], ['settings', 'Einstellungen', '⚙️', 'Optionen'],
];
const SCREENS = { home: dashboardScreen, squad: squadScreen, tactics: tacticsScreen, matchday: matchdayScreen, league: leagueScreen, saves: savesScreen, settings: settingsScreen, seasonEnd: seasonEndScreen, transfers: transfersScreen, finance: financeScreen, training: trainingScreen, stadium: stadiumScreen, cups: cupsScreen, staff: staffScreen, world: worldScreen, career: careerScreen, media: mediaScreen, founder: founderScreen, kabine: kabineScreen, achievements: achievementsScreen, analysis: analysisScreen, profile: profileScreen };

export class App {
  constructor(root) {
    if (window.bakusa?.onUpdate) window.bakusa.onUpdate((u) => this.onUpdate(u));
    this.root = root;
    this.world = null;
    this.slot = null;
    this.settings = loadSettings();
    this.screen = 'start';
    this.params = {};
    this.cleanup = null;
  }

  get club() { return this.world?.clubs[this.world.userClubId]; }

  go(screen, params = {}) {
    this.cleanup?.(); this.cleanup = null;
    // after a sacking the user has to pick a new club first
    if (this.world?.career?.pendingSack && !['career', 'start', 'new', 'founder', 'saves', 'settings'].includes(screen)) screen = 'career';
    this.screen = screen; this.params = params;
    document.body.classList.toggle('no-anim', this.settings.animations === false);
    this.render();
    requestAnimationFrame(() => animateNumbers(this.root || document));
    if (screen !== 'live') setTimeout(() => runCeremonies(this), 350);
    if (this.world?.mgr?.levelUps?.length) { const l = this.world.mgr.levelUps.splice(0); setTimeout(() => toast(`⬆️ Level ${l.at(-1)} erreicht! ${l.length > 1 ? `+${l.length} Skillpunkte` : '+1 Skillpunkt'} im Manager-Profil`, 3800), 300); }
    if (this.world?.achToast?.length) { const t = this.world.achToast.splice(0); t.forEach((x, i) => setTimeout(() => toast(`🏅 Erfolg: ${x}`, 3200), 400 + i * 900)); }
    window.scrollTo(0, 0);
  }

  render() {
    const r = this.root;
    if (!this.world || this.screen === 'start' || this.screen === 'new' || this.screen === 'founder') {
      applyTheme(this.settings, null);
      r.innerHTML = '<div class="menu-root"></div>';
      const el = r.firstChild;
      if (this.screen === 'new') newGameScreen(this, el); else if (this.screen === 'founder') founderScreen(this, el); else this.cleanup = startScreen(this, el) || null;
      return;
    }
    if (this.screen === 'match') {
      r.innerHTML = '<div class="match-root"></div>';
      this.cleanup = matchdayScreen(this, r.firstChild, { live: true, ...this.params }) || null;
      return;
    }
    const club = this.club, w = this.world;
    const league = userLeague(w);
    const rs = document.documentElement.style;
    rs.setProperty('--club1', club.colors.primary); rs.setProperty('--club2', club.colors.secondary);
    applyTheme(this.settings, club);
    const win = windowInfo(w);
    const offers = w.transfer?.offers?.length || 0;
    const inbox = openInbox(w).length;
    const md = Math.min(w.week + 1, league.fixtures.length);
    r.innerHTML = `
      <div class="shell">
        <header class="topbar">
          <div class="brand"><span class="logo">FM<b>2027</b><small class="by">© BAKUSA</small></span></div>
          <div class="club-chip">${crest(club, 30)}<div><strong>${esc(club.name)}</strong><small>${esc(league.name)} · Saison ${w.season}/${String((w.season + 1) % 100).padStart(2, '0')} · ${isUserSeasonOver(w) ? 'Saisonende' : `Spieltag ${md}`}</small></div></div>
          <div class="top-stats"><span class="win ${win.open ? 'open' : ''}">${win.open ? `🔓 Transferfenster · noch ${win.closesIn} Wo.` : '🔒 Transferfenster zu'}</span><span>Kontostand <b>${money(club.budget)}</b></span><button class="btn primary sm" id="top-next">${isUserSeasonOver(w) ? 'Saison abschließen' : 'Zum Spieltag ▶'}</button></div>
        </header>
        <nav class="sidenav">${NAV.map((n) => { if (n === '-') return '<div class="sep"></div>'; const [id, label, ic, short] = n; return `<button data-nav="${id}" class="${this.screen === id ? 'active' : ''}"><span>${ic}</span><em>${label}${id === 'transfers' && offers ? `<b class="badge">${offers}</b>` : ''}${id === 'kabine' && (w.clubs[w.userClubId]?.kabine?.conflicts?.some((c) => !c.done) || w.clubs[w.userClubId]?.kabine?.council) ? '<b class="badge">!</b>' : ''}${id === 'profile' && (openTasks(w) + (w.mgr?.points || 0)) ? `<b class="badge">${openTasks(w) + (w.mgr?.points || 0)}</b>` : ''}${id === 'staff' && inbox ? `<b class="badge">${inbox}</b>` : ''}${id === 'career' && (w.career?.offers?.length || w.career?.natOffer) ? `<b class="badge">${(w.career.offers.length) + (w.career.natOffer ? 1 : 0)}</b>` : ''}</em><i>${short}</i></button>`; }).join('')}</nav>
        <main class="content" id="content"></main>
      </div>`;
    r.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.nav)));
    r.querySelector('#top-next').addEventListener('click', () => this.go(isUserSeasonOver(w) ? 'seasonEnd' : 'matchday'));
    const fn = SCREENS[this.screen] || dashboardScreen;
    this.cleanup = fn(this, r.querySelector('#content'), this.params) || null;
  }

  async save(slot = this.slot || 'slot1', silent = false) {
    this.slot = slot;
    try { await saveGame(slot, this.world); if (!silent) toast('Spielstand gespeichert'); }
    catch (e) { console.error(e); toast('Speichern fehlgeschlagen'); }
  }

  // desktop launcher: auto-update state from Electron (GitHub Releases)
  onUpdate(u) {
    this.update = u;
    let bar = document.getElementById('update-bar');
    if (u.state === 'available' || u.state === 'downloading' || u.state === 'ready') {
      if (!bar) { bar = document.createElement('div'); bar.id = 'update-bar'; document.body.appendChild(bar); }
      bar.innerHTML = u.state === 'ready'
        ? `⬇ Update <b>v${u.version}</b> ist bereit. <button class="btn small primary" id="upd-go">Jetzt neu starten</button> <span class="muted">(oder beim Beenden)</span>`
        : u.state === 'downloading' ? `⬇ Update wird geladen … ${u.percent ?? 0}%` : `⬇ Neue Version <b>v${u.version}</b> gefunden – wird geladen …`;
      const go = bar.querySelector('#upd-go'); if (go) go.onclick = () => window.bakusa.installUpdate();
    } else if (bar) bar.remove();
  }

  async autosave() {
    if (!this.settings.autosave || !this.world) return;
    try { await saveGame('auto', this.world, 'Autosave · ' + this.club.name); } catch (e) { console.warn('autosave', e); }
  }

  nextFixture() { return userFixture(this.world); }
}
