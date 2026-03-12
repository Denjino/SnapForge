# SnapForge — Project Context

## What This Is
A self-hosted bulk URL screenshot tool built with Next.js 14 (App Router) and Playwright. Users paste URLs, pick viewport presets, and get PNG screenshots.

## Stack
- **Framework:** Next.js 14 with App Router, TypeScript
- **Screenshot engine:** Playwright with headless Chromium
- **Styling:** Tailwind CSS with custom dark theme (see `tailwind.config.js`)
- **Fonts:** DM Sans (body), JetBrains Mono (code/data)
- **Deployment:** Docker → Railway / Render / Fly.io

## Architecture
- Single-page app at `/app/page.tsx` — all UI state lives here
- API route at `/app/api/screenshot/route.ts` — takes URL + viewport config, returns base64 PNG
- Viewport presets defined in `/lib/viewports.ts`
- Browser instance is reused across requests (singleton pattern in the API route)

## Design System
- **Surface colors:** `surface-0` (#0a0a0c) through `surface-4` (#2a2a32)
- **Accent:** Emerald green (#6ee7b7) — used for active states, CTAs, progress
- **Border:** #2a2a32
- **Text:** Gray-200 for body, white for headings, muted (#6b7280) for secondary

## Key Patterns
- URLs are processed sequentially (not parallel) to avoid overwhelming the server
- Cookie/popup overlays are auto-dismissed via DOM manipulation before screenshot
- Full page captures by default, configurable per-session
- Wait time slider (0–10s) for sites with lazy-loaded content

## Extension Points
When adding features, maintain:
1. The dark surface-based aesthetic
2. JetBrains Mono for any data/code display
3. Sequential processing with real-time progress updates
4. The API route pattern (POST with JSON body, return base64)
