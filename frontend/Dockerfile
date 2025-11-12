# syntax=docker/dockerfile:1

# --- Base (corepack/pnpm available) ---
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
# Enable pnpm via Corepack
RUN corepack enable && corepack prepare pnpm@9 --activate

# --- Deps (dev deps for building) ---
FROM base AS deps
WORKDIR /app
# Only lockfile + manifest for better caching
COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./
# Ensure no stray workspace file makes pnpm think this is a monorepo
RUN rm -f pnpm-workspace.yaml
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build
RUN pnpm prune --prod

# --- Runner (pnpm available at runtime) ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Activate pnpm in the runtime too (fixes "Cannot find module '/app/pnpm'")
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy built app + pruned node_modules
COPY --from=build /app ./

# (Optional) drop privileges
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
USER nextjs

EXPOSE 3000
CMD ["pnpm", "start"]
