# syntax=docker/dockerfile:1
FROM node:22 AS builder
WORKDIR /app
COPY app/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# BUILD_SHA is passed from CI via --build-arg BUILD_SHA=${{ github.sha }} and
# baked into the image as an ENV so /version can read it at runtime. Placed late
# so changing the SHA doesn't bust the npm-install layer — only the final COPY
# and this ARG/ENV change per commit.
ARG BUILD_SHA=local-build
ENV BUILD_SHA=$BUILD_SHA

RUN groupadd -g 1001 appgroup && useradd -u 1001 -g appgroup appuser
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup app/ .

USER appuser
EXPOSE 8000
CMD ["node", "server.ts"]
