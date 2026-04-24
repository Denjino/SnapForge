// SnapForge — Electron main process
// Wraps the Next.js app in a desktop window. Hosts two tools (screenshot + image
// processor) from the same Next.js server and persists user settings (e.g. the
// TinyPNG API key) via electron-store.

const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const net = require('net');

// electron-updater is only present in packaged builds (dev skips updates)
let autoUpdater = null;
try {
  // eslint-disable-next-line global-require
  autoUpdater = require('electron-updater').autoUpdater;
} catch {
  // dev environment — ignore
}

// electron-store holds the TinyPNG API key and any future user-supplied config.
// Stored in userData (encrypted only by OS file permissions — good enough for a
// desktop tool where the user owns the machine).
let Store = null;
try {
  // electron-store v8 ships as CJS; guard for environments where it isn't installed.
  // eslint-disable-next-line global-require
  Store = require('electron-store');
} catch {
  // will be reported if the user ever tries to open settings
}

const isDev = !app.isPackaged;

let mainWindow = null;
let nextServerProcess = null;
let serverPort = 0;
let store = null;

// Resolve the root dir of the Next.js build at runtime.
// In dev: the project root. Packaged: resources/app (asar disabled for Next.js).
function appRoot() {
  return isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'app');
}

function standaloneServerPath() {
  return path.join(appRoot(), '.next', 'standalone', 'server.js');
}

function nextBinPath() {
  // Used in dev mode; packaged builds always use the standalone server.
  return path.join(appRoot(), 'node_modules', 'next', 'dist', 'bin', 'next');
}

// --- Find a free localhost port so we don't clash with anything the user is running
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// --- Ensure Playwright's Chromium is available.
// Installs Chromium into userData on first launch (~150 MB, one-time).
function ensurePlaywrightChromium() {
  const markerFile = path.join(app.getPath('userData'), '.chromium-installed');
  if (fs.existsSync(markerFile)) return true;

  const pwCli = path.join(appRoot(), 'node_modules', 'playwright', 'cli.js');
  if (!fs.existsSync(pwCli)) {
    dialog.showErrorBox(
      'SnapForge',
      'Playwright is missing from this build. Please re-download SnapForge.'
    );
    return false;
  }

  const progressWin = new BrowserWindow({
    width: 420,
    height: 160,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'SnapForge — First-time setup',
    backgroundColor: '#0b0b0f',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  progressWin.setMenuBarVisibility(false);
  progressWin.loadURL(
    'data:text/html;charset=utf-8,' +
      encodeURIComponent(
        `<html><body style="background:#0b0b0f;color:#eee;font-family:-apple-system,system-ui,sans-serif;padding:24px;">
          <h3 style="margin:0 0 8px 0;">Setting up SnapForge</h3>
          <p style="margin:0;opacity:.75;font-size:13px;">Downloading Chromium on first launch. This only happens once (~150 MB).</p>
         </body></html>`
      )
  );

  try {
    execFileSync(process.execPath, [pwCli, 'install', 'chromium'], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'inherit',
    });
    fs.writeFileSync(markerFile, new Date().toISOString());
    if (!progressWin.isDestroyed()) progressWin.close();
    return true;
  } catch (e) {
    if (!progressWin.isDestroyed()) progressWin.close();
    dialog.showErrorBox(
      'SnapForge',
      'Failed to install Chromium. Check your internet connection and restart the app.\n\n' +
        (e && e.message ? e.message : String(e))
    );
    return false;
  }
}

// --- Auto-update via GitHub Releases (electron-updater)
function setupAutoUpdater() {
  if (!autoUpdater || isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err);
  });

  autoUpdater.on('update-downloaded', (info) => {
    const res = dialog.showMessageBoxSync(mainWindow || undefined, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'SnapForge update ready',
      message: `SnapForge ${info.version} has been downloaded.`,
      detail: 'Restart now to apply the update, or it will install automatically next time you quit.',
    });
    if (res === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 60 * 60 * 1000);
}

// --- Settings store + IPC
function setupSettings() {
  if (!Store) {
    console.warn('[settings] electron-store is not installed; settings will not persist.');
    return;
  }

  store = new Store({
    name: 'snapforge-settings',
    schema: {
      tinypngApiKey: { type: 'string', default: '' },
    },
  });

  ipcMain.handle('settings:get', (_evt, key) => {
    if (!store) return null;
    return store.get(key);
  });

  ipcMain.handle('settings:set', (_evt, key, value) => {
    if (!store) return false;
    store.set(key, value);
    return true;
  });

  ipcMain.handle('settings:has', (_evt, key) => {
    if (!store) return false;
    const v = store.get(key);
    return v !== undefined && v !== null && v !== '';
  });
}

// --- Start the Next.js server as a child process.
async function startNextServer() {
  serverPort = await getFreePort();

  let cmd, args, cwd;
  if (isDev) {
    cmd = process.execPath;
    args = [nextBinPath(), 'start', '-p', String(serverPort), '-H', '127.0.0.1'];
    cwd = appRoot();
  } else {
    const serverFile = standaloneServerPath();
    if (!fs.existsSync(serverFile)) {
      throw new Error(
        `Next.js standalone build not found at ${serverFile}. Run \`npm run build\` first.`
      );
    }
    cmd = process.execPath;
    args = [serverFile];
    cwd = path.dirname(serverFile);
  }

  nextServerProcess = spawn(cmd, args, {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(serverPort),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: isDev ? 'development' : 'production',
      // Used by image-processor API routes for temp file storage — packaged
      // apps can't write next to the bundle, so we route everything through
      // Electron's userData directory.
      USER_DATA_DIR: app.getPath('userData'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  nextServerProcess.stdout.on('data', (d) => process.stdout.write(`[next] ${d}`));
  nextServerProcess.stderr.on('data', (d) => process.stderr.write(`[next] ${d}`));

  await waitForServerReady(serverPort, 30000);
}

function waitForServerReady(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) return reject(new Error('Next.js server did not start in time'));
        setTimeout(attempt, 250);
      });
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() > deadline) return reject(new Error('Next.js server did not start in time'));
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0a0a0c',
    title: 'SnapForge',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Preload only uses electron.ipcRenderer, which is available under sandbox.
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Let page <title> drive the window title so the hub / tool names appear.
  mainWindow.webContents.on('page-title-updated', (evt, title) => {
    if (!title) return;
    // Prefix with SnapForge unless the page already did.
    if (title.toLowerCase().startsWith('snapforge')) {
      mainWindow.setTitle(title);
    } else {
      mainWindow.setTitle(`SnapForge — ${title}`);
    }
    evt.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- App lifecycle
app.whenReady().then(async () => {
  try {
    setupSettings();
    if (!ensurePlaywrightChromium()) {
      app.quit();
      return;
    }
    await startNextServer();
    createWindow();
    setupAutoUpdater();
  } catch (err) {
    dialog.showErrorBox('SnapForge failed to start', err && err.message ? err.message : String(err));
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  if (nextServerProcess && !nextServerProcess.killed) {
    try {
      nextServerProcess.kill();
    } catch {
      // ignore
    }
  }
});
