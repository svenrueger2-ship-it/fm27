// Desktop shell (Electron) for FUSSBALL MANAGER 2027 © BAKUSA – Windows 10/11
// v2.6: starts with the launcher window; the game opens in its own window.
// Auto-update via GitHub Releases (only the installed version; the portable .exe cannot update itself).
const { app, BrowserWindow, Menu, shell, ipcMain, net } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

let launcher = null, game = null, lastUpdate = null, returnToLauncher = true, quitting = false, installShell = null;
const RELEASES = 'https://github.com/svenrueger2-ship-it/fm27/releases';

// ------------------------------------------------------------------ live updates (v2.7)
// The game and the launcher are plain HTML files. New versions are fetched from the "live" release on GitHub,
// checked against their SHA-256 and stored in the user folder – no installer, no restart of the app.
// Only when the Electron shell itself changes (SHELL_API) a regular app update is needed.
const SHELL_API = 1;
const LIVE = process.env.FM27_LIVE_URL || 'https://github.com/svenrueger2-ship-it/fm27/releases/download/live/';
const CONTENT_FILES = ['index.html', 'launcher.html'];
const contentRoot = () => path.join(app.getPath('userData'), 'content');
let live = { state: 'idle' }, liveBusy = null;
const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; } return 0; };
// content version shipped inside the app (written by build.mjs); the shell version is app.getVersion()
function bundledVersion() { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'app', 'version.json'), 'utf8')).version; } catch { return app.getVersion(); } }
function activeContent() {
  try {
    const cur = JSON.parse(fs.readFileSync(path.join(contentRoot(), 'current.json'), 'utf8'));
    const dir = path.join(contentRoot(), cur.version);
    if (cmpVer(cur.version, bundledVersion()) > 0 && CONTENT_FILES.every((f) => fs.existsSync(path.join(dir, f)))) return { version: cur.version, dir };
  } catch { /* none yet */ }
  return { version: bundledVersion(), dir: path.join(__dirname, 'app') };
}
const contentFile = (f) => path.join(activeContent().dir, f);
const sendLive = (d) => { live = d; broadcast('bakusa:live', d); };
async function fetchBuf(url, onBytes) {
  const res = await net.fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader(), parts = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(Buffer.from(value)); n += value.length; onBytes?.(n); }
  return Buffer.concat(parts);
}
function liveCheck() {
  if (liveBusy) return liveBusy;
  liveBusy = (async () => {
    const cur = activeContent();
    sendLive({ state: 'checking', version: cur.version });
    try {
      const man = JSON.parse((await fetchBuf(LIVE + 'manifest.json')).toString('utf8'));
      if (cmpVer(man.version, cur.version) <= 0) return sendLive({ state: 'latest', version: cur.version });
      if ((man.shellApi || 1) > SHELL_API) return sendLive({ state: 'needs-app', version: man.version, current: cur.version });
      const total = CONTENT_FILES.reduce((s, f) => s + (man.files[f]?.size || 0), 0) || 1;
      const tmp = path.join(contentRoot(), `${man.version}.part`), dst = path.join(contentRoot(), man.version);
      fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
      let done = 0;
      for (const f of CONTENT_FILES) {
        const meta = man.files[f]; if (!meta) throw new Error(`${f} fehlt im Manifest`);
        const buf = await fetchBuf(LIVE + f, (n) => sendLive({ state: 'downloading', version: man.version, percent: Math.min(99, Math.round(((done + n) / total) * 100)) }));
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        if (hash !== meta.sha256) throw new Error(`Prüfsumme von ${f} stimmt nicht`);
        fs.writeFileSync(path.join(tmp, f), buf); done += buf.length;
      }
      fs.rmSync(dst, { recursive: true, force: true }); fs.renameSync(tmp, dst);
      fs.writeFileSync(path.join(contentRoot(), 'current.json'), JSON.stringify({ version: man.version, installedAt: Date.now() }));
      // keep only the active version
      for (const d of fs.readdirSync(contentRoot())) if (d !== man.version && d !== 'current.json') fs.rmSync(path.join(contentRoot(), d), { recursive: true, force: true });
      sendLive({ state: 'installed', version: man.version, from: cur.version, title: man.title || '' });
    } catch (e) {
      sendLive({ state: 'error', version: cur.version, message: String(e?.message || e).slice(0, 160) });
    }
  })().finally(() => { liveBusy = null; });
  return liveBusy;
}
const isPortable = () => !app.isPackaged || !!process.env.PORTABLE_EXECUTABLE_DIR;
const broadcast = (ch, data) => { for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(ch, data); };
const webPreferences = { contextIsolation: true, sandbox: true, backgroundThrottling: false, preload: path.join(__dirname, 'preload.cjs') };

function setupUpdater() {
  if (isPortable()) { lastUpdate = { state: 'portable', version: app.getVersion() }; broadcast('bakusa:update', lastUpdate); return; }
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  const send = (d) => { lastUpdate = d; broadcast('bakusa:update', d); };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }));
  autoUpdater.on('update-available', (i) => send({ state: 'available', version: i.version }));
  autoUpdater.on('update-not-available', () => send({ state: 'latest', version: app.getVersion() }));
  autoUpdater.on('download-progress', (p) => send({ state: 'downloading', percent: Math.round(p.percent), version: lastUpdate?.version }));
  // forced update (v2.7): install silently right away – if a match is running, as soon as the game window closes
  installShell = () => { quitting = true; autoUpdater.quitAndInstall(true, true); };
  autoUpdater.on('update-downloaded', (i) => { send({ state: 'installing', version: i.version }); if (!game) setTimeout(installShell, 1500); });
  autoUpdater.on('error', (e) => send({ state: 'error', message: String(e?.message || e).slice(0, 160) }));
  ipcMain.on('bakusa:install-update', () => { quitting = true; autoUpdater.quitAndInstall(false, true); });
  ipcMain.on('bakusa:check-update', () => autoUpdater.checkForUpdates().catch(() => {}));
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 1200);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 3600 * 1000);
}

function createLauncher() {
  launcher = new BrowserWindow({
    width: 1280, height: 760, minWidth: 1100, minHeight: 680, frame: false, resizable: true, maximizable: false,
    backgroundColor: '#05040b', title: 'FUSSBALL MANAGER 2027 – Launcher', show: false, icon: path.join(__dirname, 'app', 'icon.png'), webPreferences,
  });
  launcher.loadFile(contentFile('launcher.html'));
  launcher.once('ready-to-show', () => launcher.show());
  launcher.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  launcher.on('closed', () => { launcher = null; if (!game && !quitting) app.quit(); });
}

function createGame({ slot, fullscreen } = {}) {
  if (game) { game.focus(); return; }
  game = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 640, fullscreen: !!fullscreen,
    backgroundColor: '#07060f', title: 'FUSSBALL MANAGER 2027 © BAKUSA', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'app', 'icon.png'), webPreferences,
  });
  game.loadFile(contentFile('index.html'), slot ? { hash: `continue=${encodeURIComponent(slot)}` } : undefined);
  game.once('ready-to-show', () => {
    if (!fullscreen) game.maximize();
    game.show();
    if (fullscreen) { game.setFullScreen(true); setTimeout(() => { if (game && !game.isFullScreen()) game.setFullScreen(true); }, 300); }
    if (launcher) launcher.hide();
    if (lastUpdate) game.webContents.send('bakusa:update', lastUpdate);
  });
  game.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { game.setFullScreen(!game.isFullScreen()); e.preventDefault(); }
    if (input.key === 'Escape' && game.isFullScreen()) game.setFullScreen(false);
    if (input.key === 'F12') game.webContents.toggleDevTools();
  });
  game.on('page-title-updated', (e) => e.preventDefault());
  game.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  game.on('closed', () => {
    game = null;
    if (quitting) return;
    if (lastUpdate?.state === 'installing' && installShell) return installShell();
    if (returnToLauncher && launcher) { launcher.webContents.reload(); launcher.show(); launcher.focus(); }
    else app.quit();
  });
}

ipcMain.on('bakusa:launch', async (_e, o) => { returnToLauncher = o?.returnToLauncher !== false; if (liveBusy) await liveBusy; createGame(o || {}); });
ipcMain.handle('bakusa:live-check', () => liveCheck().then(() => live));
ipcMain.on('bakusa:reload-launcher', () => launcher?.loadFile(contentFile('launcher.html')));
ipcMain.on('bakusa:reload-game', (_e, slot) => { if (game) game.loadFile(contentFile('index.html'), slot ? { hash: `continue=${encodeURIComponent(slot)}` } : undefined); });
ipcMain.on('bakusa:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('bakusa:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.on('bakusa:quit', () => { quitting = true; app.quit(); });
ipcMain.on('bakusa:fullscreen', (e) => { const w = BrowserWindow.fromWebContents(e.sender); w?.setFullScreen(!w.isFullScreen()); });
ipcMain.on('bakusa:releases', () => shell.openExternal(RELEASES));
ipcMain.handle('bakusa:info', () => ({ version: activeContent().version, appVersion: app.getVersion(), live, portable: isPortable(), electron: process.versions.electron, chrome: process.versions.chrome, update: lastUpdate }));

// only one instance (important for the updater)
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = game || launcher; if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); } });
  app.whenReady().then(() => { Menu.setApplicationMenu(null); createLauncher(); setupUpdater(); setTimeout(liveCheck, 900); setInterval(liveCheck, 10 * 60 * 1000); });
}
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => app.quit());
