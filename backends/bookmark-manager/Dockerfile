FROM node:22-slim

WORKDIR /app

# The repo uses a single root package.json shared by all backends.
COPY package*.json ./
RUN npm ci

COPY backends/bookmark-manager ./backends/bookmark-manager

WORKDIR /app/backends/bookmark-manager
RUN npx prisma generate --schema=prisma/schema.prisma

CMD ["npx", "tsx", "app/server.ts"]
