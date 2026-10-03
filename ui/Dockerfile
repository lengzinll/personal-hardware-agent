# 1. Dependency installation stage (cached until package.json / bun.lock change)
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# 2. Build stage with Next.js build cache mount
FROM oven/bun:1.4-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Mount Next.js build cache to speed up subsequent builds
RUN --mount=type=cache,target=/app/.next/cache \
    bun run build

# 3. Lean production runner
FROM oven/bun:1.4-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["bun", "run", "server.js"]
