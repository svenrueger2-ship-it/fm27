// Desktop shell (Electron) for FUSSBALL MANAGER 2027 © BAKUSA – Windows 10/11
// v0.8: auto-update via GitHub Releases (only the installed version; the portable .exe cannot update itself)
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

let win = null;
const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };

function setupUpdater() {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) { send('bakusa:update', { state: 'portable', version: app.getVersion() }); return; }
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => send('bakusa:update', { state: 'checking' }));
  autoUpdater.on('update-available', (i) => send('bakusa:update', { state: 'available', version: i.version }));
  autoUpdater.on('update-not-available', () => send('bakusa:update', { state: 'latest', version: app.getVersion() }));
  autoUpdater.on('download-progress', (p) => send('bakusa:update', { state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => send('bakusa:update', { state: 'ready', version: i.version }));
  autoUpdater.on('error', (e) => send('bakusa:update', { state: 'error', message: String(e?.message || e).slice(0, 160) }));
  ipcMain.on('bakusa:install-update', () => autoUpdater.quitAndInstall(false, true));
  ipcMain.on('bakusa:check-update', () => autoUpdater.checkForUpdates().catch(() => {}));
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 2500);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 3600 * 1000);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 640,
    backgroundColor: '#07060f', title: 'FUSSBALL MANAGER 2027 © BAKUSA', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'app', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false, preload: path.join(__dirname, 'preload.cjs') },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.once('did-finish-load', setupUpdater);
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'Escape' && win.isFullScreen()) win.setFullScreen(false);
    if (input.key === 'F12') win.webContents.toggleDevTools();
  });
  win.on('page-title-updated', (e) => e.preventDefault());
  ipcMain.on('bakusa:quit', () => app.quit());
  ipcMain.on('bakusa:fullscreen', () => win.setFullScreen(!win.isFullScreen()));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

// only one instance (important for the updater)
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(createWindow);
}
app.on('window-all-closed', () => app.quit());
