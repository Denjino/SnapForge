# SnapForge — Project Context

## What This Is
A local-first desktop toolkit. Single Electron app hosting a Next.js 14 server
that serves multiple tools from one codebase. Two tools ship today:

1. **Screenshot Capture** — Playwright + Chromium, bulk URL screenshots
2. **Image Processor** — Sharp + TinyPNG, convert/resize/compress pipeline

A third card on the hub is a "more soon" placeholder — add new tools by
creating a new `app/<tool>/` route and registering a ToolCard on the hub page.

## Stack
- **Shell:** Electron 33, `contextIsolation: true`, `sandbox: true`
- **Server:** Next.js 14 App Router (standalone output) as an Electron child
  process on a dynamic localhost port
- **UI:** React 18 + TypeScript + Tailwind (dark surface tokens)
- **Fonts:** DM Sans (body), JetBrains Mono (data/numbers)
- **State persistence:** `electron-store` for user settings, exposed to the
  renderer via a preload that publishes `window.api.settings.{get,set,has}`

## Architecture Essentials
- `electron/main.js` spawns `.next/standalone/server.js` with
  `USER_DATA_DIR=app.getPath('userData')` in env. All image-processor temp
  files live under that dir so the packaged app doesn't try to write into its
  read-only bundle.
- Per-session image buffers are held in a module-level `Map` in
  `lib/image-sessions.ts`. Works because the Next.js server is a single
  long-lived process inside Electron. Not persisted across restarts.
- TinyPNG key is user-supplied, stored via `electron-store`, and sent per-
  request in an `X-TinyPNG-Key` header. The server never logs it or echoes
  it back in responses/errors.

## Layout

```
app/
  page.tsx               hub
  layout.tsx             shared shell + <Header/>
  screenshot/            screenshot tool
  image-processor/       image processor tool + its own .css
  settings/              TinyPNG key management
  api/
    screenshot/          Playwright endpoint (unchanged)
    image/               upload | convert | resize | compress | download | zip | compression-count

components/hub/          ToolCard, Header

lib/
  brand.ts               APP_NAME, APP_TAGLINE
  accents.ts             per-tool accent palette (emerald/cyan/amber/violet/rose)
  viewports.ts           screenshot viewport presets
  sharp-utils.ts         Sharp helpers (convert, resize, info, format lookup)
  tinypng.ts             TinyPNG REST client
  image-sessions.ts      in-memory image session store
  paths.ts               USER_DATA_DIR + ensureImageDirs()
  settings-client.ts     renderer-side wrapper over window.api.settings

electron/
  main.js                IPC handlers for settings:{get,set,has}, spawns Next
  preload.js             exposes window.api.{platform,settings}

types/
  global.d.ts            window.api typings
```

## Design System
- **Surfaces:** `surface-0` through `surface-4` (darkest → lightest).
- **Border:** `#2a2a32`.
- **Per-tool accents:** emerald (screenshot), cyan (image processor). Add new
  accents via `lib/accents.ts` and reference by key from `ToolCard`.
- **Typography:** DM Sans body, JetBrains Mono for data.
- The image processor keeps its cyan glow identity via a dedicated
  `image-processor.css` that reuses SnapForge's `--surface-*` tokens but keeps
  cyan-specific gradients, glows, and button fills.

## Key Invariants (don't break these)
- `build.appId = com.snapforge.app`, `build.publish.repo = SnapForge`,
  `build.publish.owner = Denjino`. Changing the appId breaks auto-updates for
  existing installs.
- `asar: false` — required for Next.js standalone output and Sharp native
  bindings.
- Don't log or return the TinyPNG key from any server route.
- `imageSessions` must remain a module-level singleton; don't re-instantiate
  it per request.

## Extending
When adding a new tool:
1. Create `app/<tool>/page.tsx` (client component).
2. Create `app/api/<tool>/…` routes if needed. Use `lib/paths.ts` for any
   temp-file storage — never write next to the app bundle.
3. Register a `ToolCard` on `app/page.tsx` with a free accent from
   `lib/accents.ts` (add a new key if needed).
4. If the tool needs persistent user config, add a typed entry in the
   `electron-store` schema inside `electron/main.js`.
