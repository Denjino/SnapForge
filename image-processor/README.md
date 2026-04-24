# Image Processor

A sleek web application for converting, resizing, and compressing images to optimized AVIF format.

## Features

- **AVIF Conversion**: Automatically converts PNG, JPEG, WebP images to AVIF with high-quality settings that preserve transparency and avoid banding
- **Smart Resizing**: Scale images by longest side with presets (1K, 1.5K, 2K, 3K) - downscale only
- **TinyPNG Compression**: Final optimization using TinyPNG's powerful compression API
- **Batch Processing**: Upload and process multiple images at once
- **Flexible Download**: Download individual images or all as a ZIP at any stage
- **Usage Tracking**: Monitor your TinyPNG API usage (500 free compressions/month)

## Tech Stack

- **Backend**: Node.js + Express + Sharp
- **Frontend**: React + Vite
- **Compression**: TinyPNG API
- **Styling**: Custom CSS with dark graphite/slate aesthetic

## Setup

### Prerequisites

- Node.js 18+ installed
- A TinyPNG API key (get one free at https://tinypng.com/developers)

### Installation

1. **Install server dependencies:**
   \`\`\`bash
   cd server
   npm install
   \`\`\`

2. **Install client dependencies & build:**
   \`\`\`bash
   cd client
   npm install
   npm run build
   \`\`\`

3. **Update API key (if needed):**
   
   Edit \`server/index.js\` and update the \`TINYPNG_API_KEY\` constant with your key.

### Running

**Production mode (recommended):**
\`\`\`bash
cd server
npm start
\`\`\`
Then open http://localhost:3001

**Development mode (with hot reload):**

Terminal 1:
\`\`\`bash
cd server
npm run dev
\`\`\`

Terminal 2:
\`\`\`bash
cd client
npm run dev
\`\`\`
Then open http://localhost:3000

## Usage

1. **Upload**: Drag & drop or click to select images (PNG, JPEG, WebP, AVIF)
2. **Convert**: Images are automatically converted to AVIF - download here if that's all you need
3. **Resize**: Choose a preset (1K-3K) to scale images by longest side - download here if file sizes are good
4. **Compress**: Click to run TinyPNG optimization for maximum compression

Each stage shows file sizes so you can decide when to stop and download.

## Notes on Compression Counts

- TinyPNG's free tier includes 500 compressions per month
- Each compression operation counts against your limit
- The counter shown in the app is fetched from TinyPNG's API

## License

MIT
