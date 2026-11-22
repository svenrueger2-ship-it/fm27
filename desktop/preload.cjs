// Exposes a tiny, safe API to the launcher and the game – no Node access for the pages.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bakusa', {
  quit: () => ipcRenderer.send('bakusa:quit'),
  toggleFullscreen: () => ipcRenderer.send('bakusa:fullscreen'),
  onUpdate: (cb) => ipcRenderer.on('bakusa:update', (_e, d) => cb(d)),
  installUpdate: () => ipcRenderer.send('bakusa:install-update'),
  checkUpdate: () => ipcRenderer.send('bakusa:check-update'),
  // launcher (v2.6)
  launch: (opts) => ipcRenderer.send('bakusa:launch', opts),
  minimize: () => ipcRenderer.send('bakusa:minimize'),
  close: () => ipcRenderer.send('bakusa:close'),
  getInfo: () => ipcRenderer.invoke('bakusa:info'),
  openReleases: () => ipcRenderer.send('bakusa:releases'),
  platform: 'windows',
});
