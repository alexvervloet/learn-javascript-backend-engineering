# syntax=docker/dockerfile:1
# =============================================================================
# Dockerfile — secure implementation. Each [FIX N] matches [ISSUE N] in
# Dockerfile.insecure.  Build: docker compose build
# =============================================================================

# [FIX 1] Pin version + OS variant (not :latest, not major-only). For maximum
# reproducibility also pin the digest: FROM node:22-bookworm-slim@sha256:...
FROM node:22-bookworm-slim AS builder
WORKDIR /build
COPY app/package*.json ./
# [FIX 5] Cache mount for npm downloads (kept out of image layers). Build-time
# secrets (e.g. a private registry token) would use --mount=type=secret here,
# never ARG.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# =============================================================================
# Runtime stage
# =============================================================================
# [FIX 3] Minimal base — slim, ~200MB vs ~1.1GB full. Smaller attack surface.
FROM node:22-bookworm-slim

# [FIX 6] Create a non-root user before anything else (must be done as root).
RUN groupadd --system --gid 1001 appgroup && \
    useradd --system --uid 1001 --gid appgroup --no-create-home appuser

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /build/node_modules ./node_modules
# [FIX 4] Copy only app code, not secrets/config/.git (defence-in-depth with .dockerignore).
COPY app/ .
RUN chown -R appuser:appgroup /app   # set ownership while still root

# [FIX 6] Drop to the non-root user for all later steps + the runtime process.
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=10s \
  CMD node -e "fetch('http://localhost:8000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.ts"]
