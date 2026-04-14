# Installing SnapForge

Download the latest release for your OS from the [**SnapForge Releases page**](https://github.com/Denjino/SnapForge/releases/latest).

## macOS

1. Pick the right `.dmg`:
   - **Apple Silicon (M1/M2/M3/M4)**: `SnapForge-*-mac-arm64.dmg`
   - **Intel**: `SnapForge-*-mac-x64.dmg`
   - Not sure? Click the Apple menu → **About This Mac**. If "Chip" starts with "Apple", pick arm64. If it says "Intel", pick x64.
2. Double-click the `.dmg`, then drag **SnapForge** into the **Applications** folder.
3. Open Applications, **right-click** SnapForge → **Open**.
4. macOS will warn *"SnapForge cannot be opened because Apple cannot check it for malicious software."*
   - Click **Open** in the next dialog.
   - This happens **once only**. After that, launch it normally.

> Why the warning? SnapForge isn't code-signed (that requires a $99/year Apple Developer cert we haven't purchased for internal use). Right-click → Open is the standard one-time bypass.

### Alternative: portable (no install)

Download the `.zip` instead of the `.dmg`. Unzip it and double-click `SnapForge.app` — it'll run from anywhere (Desktop, USB stick, etc.). Same one-time right-click → Open step applies.

---

## Windows

Pick one:

### Option A — Installer (recommended)

1. Download `SnapForge-Setup-*.exe`.
2. Double-click it. Windows SmartScreen will show a blue screen: *"Windows protected your PC"*.
3. Click **More info**, then **Run anyway**.
4. Follow the installer (you can change the install location if you want).
5. Launch SnapForge from the Start menu or desktop shortcut.

### Option B — Portable (no install)

1. Download `SnapForge-*-portable.exe`.
2. Put it anywhere you like (Desktop, Documents, USB stick).
3. Double-click to run. Same SmartScreen bypass as above, one time.

> Why the warning? Same as macOS — SnapForge isn't code-signed for wider distribution. The SmartScreen "Run anyway" option is the standard bypass and the warning only appears on first launch.

---

## First launch

The **first time** you launch SnapForge, a small "Setting up SnapForge" window appears while it downloads Chromium (~150 MB, the browser engine that actually takes the screenshots). This takes 30–60 seconds depending on your connection.

**This happens once.** Every launch after that is instant — SnapForge remembers the browser is installed.

---

## Updates

SnapForge checks for updates automatically in the background.

When a new version is available:

1. You'll see a dialog: *"SnapForge X.Y.Z has been downloaded. Restart now to apply the update."*
2. Click **Restart now** — SnapForge restarts into the new version in a few seconds.
3. Or click **Later** — the update installs automatically the next time you quit.

No manual downloads, no version drift, no need to visit the Releases page after the initial install.

---

## Uninstalling

- **macOS**: drag SnapForge from Applications to the Trash. Optionally also delete `~/Library/Application Support/SnapForge/`.
- **Windows (installer)**: Settings → Apps → SnapForge → Uninstall.
- **Windows (portable)**: just delete the `.exe`. Optionally also delete `%APPDATA%\SnapForge\`.

---

## Having trouble?

- **"The app is damaged and can't be opened"** on macOS: run `xattr -cr /Applications/SnapForge.app` in Terminal, then try again. This clears a quarantine flag.
- **Antivirus flags the Windows installer**: unsigned Electron apps occasionally get false-positive flagged. You can whitelist the file or report it as a false positive.
- **App won't start / blank window**: try quitting, then deleting the user data folder (locations above under "Uninstalling") and relaunching.

Still stuck? Ping the maintainer with a screenshot of the error.
