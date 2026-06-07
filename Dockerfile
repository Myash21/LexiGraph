# ============================================================
# LexiGraph — Dockerfile for Azure Container Apps
# Multi-stage build: keeps the final image lean
# ============================================================

# ── Stage 1: Install dependencies ──────────────────────────
FROM oven/bun:1-debian AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Stage 2: Production image ──────────────────────────────
FROM oven/bun:1-debian AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

CMD ["bun", "run", "start"]
