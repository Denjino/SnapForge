# SnapForge

A small toolkit of local-first desktop tools, bundled as a single Electron app.
Currently ships with two tools; more are planned. Everything runs on your
machine — no cloud, no accounts.

![Electron](https://img.shields.io/badge/Electron-33-47848F) ![Next.js](https://img.shields.io/badge/Next.js-14-black) ![License](https://img.shields.io/badge/license-MIT-blue)

## Tools

### Screenshot Capture
Bulk-capture screenshots across viewports, backed by Playwright + headless
Chromium.

- Paste URLs or import from a `.txt`
- Viewport presets (Desktop HD/1440/Laptop, iPad Pro/iPad, iPhone 15 Pro/SE, Pixel 7) + custom W×H
- Full-page captures, cookie/popup auto-dismissal, configurable wait time
- Download individually or as a single ZIP

### Image Processor
Convert, resize, and compress images with Sharp + TinyPNG.

- Convert to AVIF or WebP (keeps original if smaller)
- Downscale to 1K / 1.5K / 2K / 3K longest side (downscale only)
- Optional TinyPNG compression (format-preserving)
- Per-image and ZIP download

## Quick Start (Desktop App)

```bash
npm install
npm run electron:dev      # build + launch as a desktop app
```

First launch downloads Chromium (~150 MB) into your user data dir — one time.

## Quick Start (Web Dev)

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

While developing outside of Electron, `window.api` (provided by the preload)
isn't available. You can exercise the image processor's compression step by
setting `NEXT_PUBLIC_DEV_TINYPNG_KEY` in a local `.env` file — never commit it.

## Settings & the TinyPNG Key

The Image Processor's compression step uses your own TinyPNG API key. Get a
free one at <https://tinify.com/dashboard/api>. Open the app → gear icon →
**Settings** → paste the key → **Save**.

- The key is stored locally via `electron-store` in the app's userData dir.
- It is sent from the desktop app directly to `api.tinify.com` — nowhere else.
- The key is passed per-request in an `X-TinyPNG-Key` header and never
  written to logs or response bodies.

## Build Desktop Installers

```bash
npm run electron:build:mac    # .dmg + .zip for arm64 + x64
npm run electron:build:win    # NSIS installer + portable .exe (x64)
npm run electron:build:all    # both
```

Artifacts land in `release/`. Releases are published automatically to
`Denjino/SnapForge` (`build.publish` in `package.json`) — the Electron app
auto-updates from there on subsequent runs.

## Architecture

```
snapforge/
├── electron/
│   ├── main.js           # Electron main: spawns Next.js, IPC handlers, updater
│   ├── preload.js        # Exposes window.api.settings {get,set,has}
│   └── assets/           # Build resources (icons)
├── app/
│   ├── page.tsx          # Hub (tool chooser)
│   ├── layout.tsx        # Shared shell + Header
│   ├── screenshot/       # Screenshot Capture tool
│   ├── image-processor/  # Image Processor tool
│   ├── settings/         # TinyPNG key management
│   └── api/
│       ├── screenshot/   # Playwright screenshot endpoint
│       └── image/        # upload / convert / resize / compress / download / zip / compression-count
├── components/
│   └── hub/              # ToolCard, Header
├── lib/
│   ├── brand.ts, accents.ts
│   ├── viewports.ts      # Screenshot preset definitions
│   ├── sharp-utils.ts    # Image conversion / resize helpers
│   ├── tinypng.ts        # TinyPNG REST client
│   ├── image-sessions.ts # In-memory session store (per-image buffers)
│   ├── paths.ts          # Resolves USER_DATA_DIR for temp storage
│   └── settings-client.ts# Renderer-side wrapper for window.api.settings
└── types/
    └── global.d.ts       # window.api typings
```

### Runtime model
- Electron main spawns the Next.js standalone server as a child process on a
  free localhost port, then loads it in a `BrowserWindow`.
- `USER_DATA_DIR` is passed into the child-process env so API routes know where
  to write temp image files (inside userData — the app bundle is read-only on
  mac/Windows).
- Per-session image buffers live in a module-level `Map` in
  `lib/image-sessions.ts`. This works because Next.js runs as a single long-lived
  Node process under Electron. Not persisted across restarts.
- Both tools share the SnapForge surface tokens. Each tool has its own accent
  for visual identification (screenshot = emerald, image processor = cyan).

## API

### `POST /api/screenshot`
Unchanged from prior versions — see inline source for schema.

### `POST /api/image/upload`
`multipart/form-data` with `images` field (max 50 files, 50 MB each). Returns
`{ sessionId, images }`.

### `POST /api/image/convert`
Body `{ sessionId, imageIds, format: 'avif' | 'webp' }`.

### `POST /api/image/resize`
Body `{ sessionId, imageIds, preset: '1k' | '1.5k' | '2k' | '3k' }`.

### `POST /api/image/compress`
Header `X-TinyPNG-Key: <key>`. Body `{ sessionId, imageIds }`. Returns the
updated images and the monthly compression count.

### `GET /api/image/download/:sessionId/:imageId`
Stream a single processed image with a sensible filename.

### `GET /api/image/zip/:sessionId`
Stream a zip of every image in the session.

### `GET /api/image/compression-count`
Header `X-TinyPNG-Key: <key>`. Proxies the TinyPNG monthly usage counter.

## License

MIT
