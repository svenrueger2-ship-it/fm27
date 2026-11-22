// Exposes a tiny, safe API to the game (quit / fullscreen / updates) – no Node access for the page.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bakusa', {
  quit: () => ipcRenderer.send('bakusa:quit'),
  toggleFullscreen: () => ipcRenderer.send('bakusa:fullscreen'),
  onUpdate: (cb) => ipcRenderer.on('bakusa:update', (_e, d) => cb(d)),
  installUpdate: () => ipcRenderer.send('bakusa:install-update'),
  checkUpdate: () => ipcRenderer.send('bakusa:check-update'),
  platform: 'windows',
});
