# SnapForge — Desktop App

This directory contains the Electron wrapper that turns SnapForge into a standalone desktop app for macOS and Windows. The web version (Next.js + `Dockerfile` + `railway.toml`) is untouched — both builds share the same source.

**For end users:** see [`../INSTALL.md`](../INSTALL.md) for download & install instructions.
**For maintainers (you):** read on.

## Releasing a new version

```bash
# 1. Bump version in package.json (e.g. 1.0.0 → 1.0.1)
# 2. Commit the bump
git commit -am "Release v1.0.1"
# 3. Tag and push
git tag v1.0.1
git push origin main --tags
```

That's it. The `.github/workflows/release.yml` workflow will:
- Build macOS (.dmg + .zip, arm64 + x64) on a macOS runner
- Build Windows (NSIS installer + portable .exe) on a Windows runner
- Pre-bundle Chromium so first-launch is instant
- Publish everything to a GitHub Release tagged `v1.0.1`
- Upload `latest-mac.yml` / `latest.yml` update manifests alongside the binaries

Installed copies on your team's machines will pick up the update automatically within an hour (or on next launch).

## How it works

Electron boots, then:

1. Finds Playwright's Chromium (bundled with the installer in CI builds, or downloads on first launch for manual local builds).
2. Starts the Next.js standalone server on a free local port (`127.0.0.1:<random>`).
3. Opens a window pointing at that local server.
4. Checks GitHub Releases for updates in the background (once at startup, hourly thereafter).

No network services are exposed — everything runs locally.

## Quick start (run locally without packaging)

```bash
npm install
npm run build
npm run electron:dev
```

## Build installable / portable binaries

Install the toolchain first:

```bash
npm install
```

### macOS (`.dmg` + portable `.zip`)

```bash
npm run electron:build:mac
```

Output in `release/`:

- `SnapForge-1.0.0-mac-arm64.dmg` / `-x64.dmg` — double-click to install (drag to Applications)
- `SnapForge-1.0.0-mac-arm64.zip` / `-x64.zip` — unzip and double-click `SnapForge.app` to run from anywhere (fully portable)

> Note: the build is unsigned. On first launch macOS may block it — right-click the `.app` → **Open** → **Open** to bypass Gatekeeper. This is expected for self-built apps without an Apple Developer signing cert.

### Windows (portable `.exe`)

```bash
npm run electron:build:win
```

Output in `release/`:

- `SnapForge-1.0.0-portable.exe` — single-file portable. Double-click to run, no installation needed.

> Note: like the macOS build, the portable `.exe` is unsigned. SmartScreen may warn on first run — click **More info → Run anyway**.

### Both platforms in one go

```bash
npm run electron:build:all
```

Cross-compilation notes:
- Building Windows artifacts on macOS/Linux works out of the box (electron-builder handles it).
- Building macOS artifacts requires a macOS host.

## Where does Chromium get installed?

On first launch only, a ~150 MB Chromium download runs. It's cached in the Electron app's user-data folder:

- **macOS:** `~/Library/Application Support/SnapForge/`
- **Windows:** `%APPDATA%\SnapForge\`

Subsequent launches skip the download (tracked via `.chromium-installed` marker).

## Uninstall / reset

Delete the app and the user-data folder listed above. That's it — no system-wide changes.
