// Desktop shell (Electron) for FUSSBALL MANAGER 2027 © BAKUSA – Windows 10/11
// v2.6: starts with the launcher window; the game opens in its own window.
// Auto-update via GitHub Releases (only the installed version; the portable .exe cannot update itself).
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

let launcher = null, game = null, lastUpdate = null, returnToLauncher = true, quitting = false;
const RELEASES = 'https://github.com/svenrueger2-ship-it/fm27/releases';
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
  autoUpdater.on('update-downloaded', (i) => send({ state: 'ready', version: i.version }));
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
  launcher.loadFile(path.join(__dirname, 'app', 'launcher.html'));
  launcher.once('ready-to-show', () => launcher.show());
  launcher.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  launcher.on('closed', () => { launcher = null; if (!game && !quitting) app.quit(); });
}

function createGame({ slot, fullscreen } = {}) {
  if (game) { game.focus(); return; }
  game = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 640,
    backgroundColor: '#07060f', title: 'FUSSBALL MANAGER 2027 © BAKUSA', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'app', 'icon.png'), webPreferences,
  });
  game.loadFile(path.join(__dirname, 'app', 'index.html'), slot ? { hash: `continue=${encodeURIComponent(slot)}` } : undefined);
  game.once('ready-to-show', () => {
    game.maximize(); if (fullscreen) game.setFullScreen(true); game.show();
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
    if (returnToLauncher && launcher) { launcher.webContents.reload(); launcher.show(); launcher.focus(); }
    else app.quit();
  });
}

ipcMain.on('bakusa:launch', (_e, o) => { returnToLauncher = o?.returnToLauncher !== false; createGame(o || {}); });
ipcMain.on('bakusa:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('bakusa:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.on('bakusa:quit', () => { quitting = true; app.quit(); });
ipcMain.on('bakusa:fullscreen', (e) => { const w = BrowserWindow.fromWebContents(e.sender); w?.setFullScreen(!w.isFullScreen()); });
ipcMain.on('bakusa:releases', () => shell.openExternal(RELEASES));
ipcMain.handle('bakusa:info', () => ({ version: app.getVersion(), portable: isPortable(), electron: process.versions.electron, chrome: process.versions.chrome, update: lastUpdate }));

// only one instance (important for the updater)
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = game || launcher; if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); } });
  app.whenReady().then(() => { Menu.setApplicationMenu(null); createLauncher(); setupUpdater(); });
}
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => app.quit());
