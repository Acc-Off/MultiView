# syntax=docker/dockerfile:1

# =============================================================
# MultiView Dockerfile (multi-stage build)
#   Stage 1: build the frontend (vite) -> dist/
#   Stage 2: build the backend (tsc) -> dist/, and install the production dependencies
#   Stage 3: runtime image (backend dist + production node_modules + frontend dist)
#
# Stages 1 and 2 produce only platform-independent files, so they always run on the build
# machine's own platform. Stage 3 copies files and runs nothing. Building the image for another
# architecture (e.g. arm64 on an amd64 machine) therefore needs no emulation.
# =============================================================

# The Node version is pinned and bumped deliberately rather than left to a floating tag.
# Node 24.19 - 24.21 abort intermittently in native addons built on node::ObjectWrap
# (nodejs/node#65446). better-sqlite3 uses Node-API since 13.0 and is not affected, but keep this
# in mind before adding another native addon.
ARG NODE_VERSION=24.21.0

# -------------------------------------------------------------
# Stage 1: frontend build
# -------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies first so this layer stays cached while only sources change
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy the sources and build (vite build --mode prod -> dist/)
COPY frontend/ ./
RUN npm run build

# -------------------------------------------------------------
# Stage 2: backend build
# -------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS backend-builder
WORKDIR /app/server

# better-sqlite3 ships prebuilt Node-API binaries for every platform inside the package
# (including Alpine/musl on x64 and arm64), so nothing is compiled here. server/.npmrc turns
# install scripts off, which keeps npm from trying to rebuild it with node-gyp.
COPY server/package.json server/package-lock.json server/.npmrc ./
RUN npm ci

COPY server/ ./
RUN npm run build

# Drop devDependencies, and the SQLite binaries for platforms this image never runs on
RUN npm prune --omit=dev \
 && find node_modules/better-sqlite3/prebuilds -type f ! -name 'linuxmusl-*' -delete

# -------------------------------------------------------------
# Stage 3: runtime image
# -------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine
WORKDIR /app

ENV NODE_ENV=production
# Fixed paths for config.yaml, the SQLite database and the static frontend, all meant to be
# used with volume mounts. The server starts with cwd=/app, so without these it would look
# for ../config and friends.
ENV CONFIG_PATH=/app/config/config.yaml
ENV DB_PATH=/app/data/multiview.db
ENV PUBLIC_DIR=./public
ENV PORT=3000

# Backend build output and production dependencies
COPY --from=backend-builder /app/server/dist ./server/dist
COPY --from=backend-builder /app/server/node_modules ./server/node_modules
COPY --from=backend-builder /app/server/package.json ./server/package.json

# Static frontend
COPY --from=frontend-builder /app/frontend/dist ./public

# Mount points, so they exist even when nothing is mounted. They are created with WORKDIR
# instead of RUN to keep this stage free of commands (see the note at the top).
WORKDIR /app/config
WORKDIR /app/data
WORKDIR /app

EXPOSE 3000

# Liveness check against /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server/dist/index.js"]
