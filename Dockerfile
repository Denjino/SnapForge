# ---- Dependencies ----
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
# Install Chromium + all required system libraries automatically
RUN npx playwright install --with-deps chromium

# ---- Build ----
FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run build

# ---- Production ----
# Re-use deps stage (has node_modules + system libs + Chromium)
FROM deps AS runner
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

EXPOSE 3000
CMD ["node", "server.js"]
