# Multi-stage build for Jang Heritage. Three stages:
#   1. deps    — install + compile native modules (nodejieba, sharp)
#   2. builder — `pnpm build` produces .next/standalone
#   3. runner  — slim production image, runs as non-root, no build tools
#
# Build locally to sanity-check before pushing:
#   docker build -t jang-heritage .
#   docker run --rm -p 3000:3000 --env-file .env jang-heritage

ARG NODE_VERSION=24
# Debian trixie (13) ships glibc 2.41. nodejieba's amd64 prebuilt requires
# glibc 2.38, which bookworm-slim (Debian 12, glibc 2.36) doesn't have, so
# trixie is the floor we need to avoid runtime "GLIBC_2.38 not found".

############# Stage 1: deps + native compile ###################################
FROM node:${NODE_VERSION}-trixie-slim AS deps
WORKDIR /app

# nodejieba needs python + g++ to compile the C++ binding. sharp prebuilds
# usually exist for linux/amd64 + linux/arm64 so we don't need extra here,
# but the toolchain helps if it ever falls back to source.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts=false

############# Stage 2: build ###################################################
FROM node:${NODE_VERSION}-trixie-slim AS builder
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars Payload's importmap generation expects to exist. Real
# values come from the runtime env in Dokploy; placeholders here keep the
# build deterministic.
ENV NODE_ENV=production
ENV PAYLOAD_SECRET=build-time-placeholder
ENV DATABASE_URL=postgres://placeholder@placeholder:5432/placeholder
ENV S3_BUCKET=placeholder
ENV S3_ACCESS_KEY_ID=placeholder
ENV S3_SECRET_ACCESS_KEY=placeholder
ENV S3_ENDPOINT=https://placeholder
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

############# Stage 3: runner ##################################################
FROM node:${NODE_VERSION}-trixie-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user, owns the app dir. Reduces blast radius if the runtime is
# ever compromised.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Bring in the standalone bundle, the public assets, and the prebuilt static
# pages. node_modules already inside .next/standalone via Next.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Project has no /public directory yet (no static assets outside Next's
# bundle). Add `COPY --from=builder ... /app/public ./public` here if/when
# one is introduced.

# Native bindings live in node_modules outside the standalone bundle when
# they're declared as serverExternalPackages — pull them in explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/nodejieba ./node_modules/nodejieba

USER nextjs
EXPOSE 3000

# Standalone Next.js entry point.
CMD ["node", "server.js"]
