# ---- Base ----
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y \
    libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    libxshmfence1 libx11-xcb1 fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
RUN npx playwright install chromium

# ---- Build ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /root/.cache /root/.cache
COPY . .
RUN npm run build

# ---- Production ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy playwright node_modules (not included in standalone since it's external)
COPY --from=deps /app/node_modules/playwright ./node_modules/playwright
COPY --from=deps /app/node_modules/playwright-core ./node_modules/playwright-core

# Copy Playwright browsers
COPY --from=deps /root/.cache /root/.cache

EXPOSE 3000
CMD ["node", "server.js"]
