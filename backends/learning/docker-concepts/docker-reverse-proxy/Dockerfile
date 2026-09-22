# syntax=docker/dockerfile:1
FROM node:22 AS builder
WORKDIR /app
COPY app/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd -g 1001 appgroup && useradd -u 1001 -g appgroup appuser
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup app/ .

USER appuser
# No EXPOSE — the port is internal only; nginx is the entry point.
CMD ["node", "server.ts"]
