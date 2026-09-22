# =============================================================================
# MULTI-STAGE DOCKERFILE — smaller, cleaner, production-ready
#
# Problem: dev/build tooling and dev dependencies are needed to install/build
# but waste space at runtime. A running Node server only needs production deps.
#
# Solution: two stages.
#   Stage 1 (builder): install ALL deps (incl. anything needed to build)
#   Stage 2 (runtime): slim image, copy ONLY the production node_modules + code
#
# Build: docker build -t node-multi .
# Run:   docker run -p 8000:8000 node-multi
# =============================================================================

# syntax=docker/dockerfile:1

# ---- Stage 1: builder ----
# AS builder names the stage so stage 2 can COPY --from=builder.
FROM node:22 AS builder
WORKDIR /app

# Copy ONLY the manifests first so the npm-install layer caches independently
# of source changes. package-lock.json drives reproducible installs.
COPY app/package*.json ./
# --mount=type=cache persists npm's cache between builds without bloating layers.
# --omit=dev installs production dependencies only.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# ---- Stage 2: runtime ----
# node:22-slim is Debian stripped to the Node runtime (~200MB vs ~1.1GB full).
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy just the installed node_modules from the builder — no npm cache, no dev tools.
COPY --from=builder /app/node_modules ./node_modules
COPY app/ .

EXPOSE 8000

# CMD vs ENTRYPOINT:
#   CMD ["node","server.ts"]   default command, fully replaceable:
#                              docker run node-multi bash  → replaces CMD
#   ENTRYPOINT ["node"]        fixed executable; runtime args are appended.
# CMD is more flexible for dev; ENTRYPOINT when the image has one fixed purpose.
CMD ["node", "server.ts"]
