# syntax=docker/dockerfile:1
# Multi-stage Node build — builder installs deps, runtime copies only node_modules.

FROM node:22 AS builder
WORKDIR /app
COPY app/package*.json ./
# Cache mount keeps npm's cache out of the image layers.
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY app/ .

EXPOSE 8000
CMD ["node", "server.ts"]
