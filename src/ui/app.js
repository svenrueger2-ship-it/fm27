import { isMatchToday } from '../manager/calendar.js';
import { GAME_VERSION } from '../data/patchnotes.js';
// Application shell: routing, layout, autosave. Screens live in ./screens/*.
import { loadSettings, saveSettings, saveGame } from '../storage/db.js';
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
import { clubDesignScreen } from './screens/clubDesign.js';
import { editorScreen } from './screens/editor.js';
import { boerseScreen } from './screens/boerse.js';
import { prepScreen } from './screens/prep.js';
import { campusScreen } from './screens/campus.js';
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
import { calendarScreen } from './screens/calendar.js';
import { managerCreateScreen, mgrNeedsCreation } from './screens/managerCreate.js';
import { dateOf, fmtDate } from '../manager/calendar.js';
import { openTasks } from '../manager/progress.js';
import { navHtml, placeInk, openPalette, icon, parentNav, subnavHtml } from './nav.js';
import { openInbox } from '../manager/staff.js';
import { applyTheme } from './theme.js';
import { animateNumbers, runCeremonies } from './fx.js';
import { mobileFit } from './mobileFit.js';
import { hotTurnScreen } from './screens/hotseat.js';
import { tourneyScreen } from './screens/tourney.js';
import { museumScreen, fansScreen, politicsScreen, pitchScreen, youthScreen } from './screens/club70.js';
import { konferenzScreen } from './screens/konferenz.js';
import { wmScreen, wmGroupsScreen, wmKoScreen, wmSquadScreen, confirmQuit } from './screens/wm.js';
import { WM_NATIONS } from '../manager/wm.js';
import { isHot, humanName } from '../manager/hotseat.js';
import { windowInfo } from '../manager/transfers.js';

const NAV = [
  ['home', 'Vereinszentrale', '🏟️', 'Zentrale'], ['staff', 'Stab & Posteingang', '🧑‍💼', 'Stab'], ['matchday', 'Spieltag', '⚽', 'Spiel'], ['squad', 'Kader', '👥', 'Kader'], ['kabine', 'Kabine', '🛋️', 'Kabine'], ['tactics', 'Taktik', '📋', 'Taktik'],
  ['training', 'Training', '🏋️', 'Training'], ['transfers', 'Transfers & Scouting', '🔄', 'Transfer'], ['finance', 'Finanzen & Ausbau', '💶', 'Finanzen'], ['stadium', 'Stadion', '🏟️', 'Stadion'], ['campus', 'Trainingszentrum', '🏗️', 'Campus'], ['design', 'Trikot & Wappen', '🎨', 'Design'], ['boerse', 'Börse', '📈', 'Börse'],
  ['league', 'Liga', '🏆', 'Liga'], ['analysis', 'Analyse-Hub', '📊', 'Analyse'], ['cups', 'Pokale & Europa', '🏅', 'Pokale'], ['world', 'Fußballwelt', '🌍', 'Welt'], ['career', 'Karriere', '👔', 'Karriere'], ['media', 'Medien', '📰', 'Medien'], ['editor', 'Editor', '✍️', 'Editor'], ['achievements', 'Erfolge', '🏅', 'Erfolge'], ['profile', 'Manager-Profil', '🎖️', 'Profil'], '-', ['saves', 'Spielstände', '💾', 'Speichern'], ['settings', 'Einstellungen', '⚙️', 'Optionen'],
];
const SCREENS = { home: dashboardScreen, squad: squadScreen, tactics: tacticsScreen, matchday: matchdayScreen, league: leagueScreen, saves: savesScreen, settings: settingsScreen, seasonEnd: seasonEndScreen, transfers: transfersScreen, finance: financeScreen, training: trainingScreen, stadium: stadiumScreen, cups: cupsScreen, staff: staffScreen, world: worldScreen, career: careerScreen, media: mediaScreen, founder: founderScreen, kabine: kabineScreen, achievements: achievementsScreen, analysis: analysisScreen, profile: profileScreen, calendar: calendarScreen, mgrCreate: managerCreateScreen, hotTurn: hotTurnScreen, wm: wmScreen, wmGroups: wmGroupsScreen, wmKo: wmKoScreen, wmSquad: wmSquadScreen, design: clubDesignScreen, editor: editorScreen, boerse: boerseScreen, prep: prepScreen, campus: campusScreen, tourney: tourneyScreen, museum: museumScreen, fans: fansScreen, politics: politicsScreen, pitch: pitchScreen, youth: youthScreen, konferenz: konferenzScreen };

export class App {
  constructor(root) {
    addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && this.world) { e.preventDefault(); openPalette(this); } });
    if (window.bakusa?.onUpdate) window.bakusa.onUpdate((u) => this.onUpdate(u));
    if (window.bakusa?.onLive) window.bakusa.onLive((l) => this.onLive(l));
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
    // v3.0.4: no career without your own manager – old saves get the editor once too
    if (this.world?.mode !== 'wm' && mgrNeedsCreation(this.world) && !['mgrCreate', 'start', 'new', 'founder', 'saves', 'settings', 'hotTurn'].includes(screen)) screen = 'mgrCreate';
    this.screen = screen; this.params = params;
    if (this.pendingLive && screen !== 'match') setTimeout(() => this.applyLive?.(), 800);
    document.body.classList.toggle('no-anim', this.settings.animations === false);
    this.render();
    requestAnimationFrame(() => animateNumbers(this.root || document));
    if (screen !== 'live') setTimeout(() => runCeremonies(this), 350);
    if (this.settings.achToasts === false) { if (this.world?.mgr) this.world.mgr.levelUps = []; if (this.world) this.world.achToast = []; }
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
    // v5.1: World Cup mode has its own small shell (overview, groups, knock-out, squad, tactics)
    if (this.world?.mode === 'wm') {
      const W = this.world.wm, c = this.club;
      document.documentElement.style.setProperty('--club1', c.colors.primary); document.documentElement.style.setProperty('--club2', c.colors.secondary);
      const tabs = [['wm', '🏟️ Übersicht'], ['wmGroups', '📊 Gruppen'], ['wmKo', '🏆 K.-o.-Runde'], ['wmSquad', '👥 Kader'], ['tactics', '📋 Taktik']];
      r.innerHTML = `<div class="shell wm-shell"><header class="topbar"><div class="brand"><span class="logo">FM<b>2027</b></span></div>
        <div class="club-chip">${crest(c, 30)}<div><strong>WM 2026 · ${esc(WM_NATIONS[W.nat][0])}</strong><small>${W.done ? 'Turnier beendet' : ['1. Spieltag', '2. Spieltag', '3. Spieltag', 'Sechzehntelfinale', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'][W.round]}</small></div></div>
        <nav class="wm-tabs">${tabs.map(([k, l]) => `<button data-nav="${k}" class="${this.screen === k ? 'active' : ''}">${l}</button>`).join('')}</nav>
        <div class="top-stats"><button class="btn sm ghost" id="wm-quit">Hauptmenü</button></div></header><main class="content" id="content"></main></div>`;
      r.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.nav)));
      r.querySelector('#wm-quit').onclick = () => confirmQuit(this);
      const fn = ['wm', 'wmGroups', 'wmKo', 'wmSquad', 'tactics'].includes(this.screen) ? SCREENS[this.screen] : wmScreen;
      this.cleanup = fn(this, r.querySelector('#content'), this.params) || null;
      mobileFit(this, r.querySelector('#content'));
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
          <div class="club-chip">${crest(club, 30)}<div><strong>${isHot(w) ? `<span class="hot-chip">👤 ${esc(humanName(w, w.hot.active))}</span> ` : ''}${esc(club.name)}</strong><small>${esc(league.name)} · ${isUserSeasonOver(w) ? 'Saisonende' : `Spieltag ${md}`} · <button class="linkish date-chip" id="top-date">📅 ${esc(fmtDate(dateOf(w)))}</button></small></div></div>
          <button class="top-search" id="top-search">${icon('search', 16)}<span>Suchen …</span><kbd>Strg K</kbd></button>
          <div class="top-stats"><span class="win ${win.open ? 'open' : ''}">${win.open ? `🔓 Transferfenster · noch ${win.closesIn} Wo.` : '🔒 Transferfenster zu'}</span><span>Kontostand <b>${money(club.budget)}</b></span><button class="btn primary sm" id="top-next">${isUserSeasonOver(w) && !isMatchToday(w) ? 'Saison abschließen' : isMatchToday(w) ? 'Zum Spieltag ▶' : 'Weiter ▶'}</button></div>
        </header>
        ${navHtml(parentNav(this.screen), { transfers: offers, kabine: (w.clubs[w.userClubId]?.kabine?.conflicts?.some((c) => !c.done) || w.clubs[w.userClubId]?.kabine?.council) ? '!' : 0, profile: openTasks(w) + (w.mgr?.points || 0) + (w.career?.offers?.length || 0) + (w.career?.natOffer ? 1 : 0), staff: inbox, squad: (w.clubs[w.userClubId]?.kabine?.conflicts?.some((c) => !c.done) || w.clubs[w.userClubId]?.kabine?.council) ? '!' : 0, league: w.tourney && !w.tourney.done ? '!' : 0, finance: (w.fans?.demand ? 1 : 0) + (w.politics?.candidates && w.politics.endorse == null ? 1 : 0) || 0 }, this.settings.navPinned, w.mgr?.level || 1)}
        <main class="content" id="content"></main>
      </div>`;
    r.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.nav)));
    r.querySelector('#rail-pin')?.addEventListener('click', () => { this.settings.navPinned = !this.settings.navPinned; saveSettings(this.settings); this.render(); });
    r.querySelector('#top-search')?.addEventListener('click', () => openPalette(this));
    r.querySelector('#top-date')?.addEventListener('click', () => this.go('calendar'));
    this.world.eventRate = this.settings.events || 'normal';
    document.body.classList.toggle('nav-pinned', !!this.settings.navPinned);
    requestAnimationFrame(() => placeInk(r));
    r.querySelector('#top-next').addEventListener('click', () => {
      if (isMatchToday(w)) return this.go('matchday');
      if (w.tourney && !w.tourney.done) { const b = this.screen === 'tourney' && document.getElementById('t-next'); if (b) return b.click(); return this.go('tourney'); }
      if (isUserSeasonOver(w)) return this.go('seasonEnd');
      // v3.0.4: already in the calendar → "Weiter" moves on one day instead of re-opening the same screen
      const step = this.screen === 'calendar' && document.getElementById('cal-step');
      if (step && !step.disabled) step.click(); else this.go('calendar');
    });
    const fn = SCREENS[this.screen] || dashboardScreen;
    this.cleanup = fn(this, r.querySelector('#content'), this.params) || null;
    const sub = subnavHtml(this.screen, w);
    if (sub) { const pg = r.querySelector('#content .page') || r.querySelector('#content'); pg.insertAdjacentHTML('afterbegin', sub); pg.querySelectorAll('.subnav [data-nav]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.nav))); }
    mobileFit(this, r.querySelector('#content'));
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

  // v2.7 live update: new game files were downloaded in the background – reload without reinstalling
  onLive(l) {
    if (l.state !== 'installed' || l.version === GAME_VERSION) return;
    let bar = document.getElementById('update-bar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'update-bar'; document.body.appendChild(bar); }
    this.pendingLive = l;
    const apply = async () => {
      if (this.liveApplying) return;
      // never interrupt a running 3D match – the update is applied right after it
      if (this.screen === 'match') { bar.innerHTML = `✨ Version <b>${l.version}</b> wird nach diesem Spiel automatisch installiert.`; return; }
      this.liveApplying = true;
      let n = 3;
      const tick = async () => {
        bar.innerHTML = `✨ Update auf Version <b>${l.version}</b> – Spielstand wird gesichert, Neustart in ${n} …`;
        if (n-- > 0) return setTimeout(tick, 1000);
        if (this.world) await this.save(this.slot || 'slot1', true);
        window.bakusa.reloadGame(this.world ? this.slot || 'slot1' : null);
      };
      tick();
    };
    this.applyLive = apply;
    apply();
  }

  async autosave() {
    if (!this.settings.autosave || !this.world) return;
    try { await saveGame('auto', this.world, 'Autosave · ' + this.club.name); } catch (e) { console.warn('autosave', e); }
  }

  nextFixture() { return userFixture(this.world); }
}
