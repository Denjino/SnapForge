// SnapForge — Electron preload
// Exposes a minimal, typed bridge to the renderer so the Next.js UI can read/write
// persistent settings without enabling nodeIntegration.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    has: (key) => ipcRenderer.invoke('settings:has', key),
  },
});
