# SnapForge

Bulk URL screenshot tool with viewport presets. Paste a list of URLs, pick your viewports, and capture everything in one go.

![SnapForge](https://img.shields.io/badge/Next.js-14-black) ![Playwright](https://img.shields.io/badge/Playwright-latest-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Bulk capture** — paste multiple URLs or import from a `.txt` file
- **Viewport presets** — Desktop HD, Desktop, Laptop, iPad Pro, iPad, iPhone 15 Pro, iPhone SE, Pixel 7
- **Custom viewport** — set any width × height
- **Full page screenshots** — captures entire scrollable page or just the viewport
- **Configurable wait time** — let lazy-loaded content and animations settle
- **Auto cookie/popup dismissal** — attempts to hide overlay banners before capture
- **Live progress tracking** — see each capture as it completes
- **Individual + bulk download** — download one at a time or all at once

## Quick Start (Local)

```bash
# Clone
git clone https://github.com/YOUR_USER/snapforge.git
cd snapforge

# Install dependencies + Playwright Chromium
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Prerequisites

- Node.js 20+
- Playwright will auto-install Chromium via the `postinstall` script

## Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select this repo
4. Railway auto-detects the Dockerfile — no config needed
5. Once deployed, you'll get a public URL

**Note:** Railway's free tier works fine for personal use. The Dockerfile handles all Playwright/Chromium dependencies.

## Deploy to Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo
4. Set:
   - **Runtime:** Docker
   - **Plan:** Starter or higher (needs ~1GB RAM for Chromium)
5. Deploy

## Deploy to Fly.io

```bash
# Install flyctl if you haven't
brew install flyctl

# From the project root
fly launch
fly deploy
```

## Project Structure

```
snapforge/
├── app/
│   ├── api/
│   │   └── screenshot/
│   │       └── route.ts      # Playwright screenshot endpoint
│   ├── globals.css            # Styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Main UI
├── lib/
│   └── viewports.ts           # Viewport preset definitions
├── Dockerfile                 # Production container
├── next.config.js
├── tailwind.config.js
└── package.json
```

## API

### `POST /api/screenshot`

```json
{
  "url": "https://stripe.com",
  "width": 1440,
  "height": 900,
  "deviceScaleFactor": 1,
  "isMobile": false,
  "fullPage": true,
  "waitTime": 3000
}
```

**Response:**

```json
{
  "image": "<base64 PNG>",
  "url": "https://stripe.com",
  "width": 1440,
  "height": 900,
  "timestamp": "2026-03-12T..."
}
```

### `GET /api/screenshot`

Health check → `{ "status": "ok" }`

## Extending

Some ideas for Claude Code to build on:

- **Batch zip download** — server-side zip generation with `archiver` (already in dependencies)
- **Scheduled captures** — cron job to re-capture URLs on a schedule
- **Diff mode** — compare screenshots over time to catch visual regressions
- **PDF export** — combine screenshots into a PDF report for client delivery
- **Auth support** — login to sites before screenshotting (Playwright has full cookie/session support)
- **Supabase integration** — store screenshots and metadata for a persistent gallery
- **Webhook notifications** — ping a Slack/Discord channel when a batch completes

## License

MIT
