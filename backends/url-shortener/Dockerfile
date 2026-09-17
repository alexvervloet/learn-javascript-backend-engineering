FROM node:22-slim

WORKDIR /app

# Prisma's query engine links against OpenSSL, which node:22-slim does not ship.
# Without it Prisma warns on every start and falls back to guessing a version.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# The repo uses a single root package.json shared by all backends.
COPY package*.json ./
RUN npm ci

COPY backends/url-shortener ./backends/url-shortener

WORKDIR /app/backends/url-shortener
# This image is only ever run by docker-compose.yml, which supplies a Postgres
# DATABASE_URL, so the client is generated from the Postgres schema. The
# SQLite schema next to it is what local development and the test suite use.
RUN npx prisma generate --schema=prisma/postgres/schema.prisma

CMD ["npx", "tsx", "app/server.ts"]
