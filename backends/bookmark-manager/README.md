# Bookmark Manager

Full-featured Express backend for saving, organizing, and tagging bookmarks.

## Features

- JWT authentication (register, login, logout via a Redis token blocklist)
- CRUD for bookmarks, categories, and tags
- Redis-backed rate limiting via express-rate-limit
- BullMQ background tasks (metadata fetch + write-behind click counter)
- Prisma database migrations
- Dockerized dev environment

## Stack

| Layer | Tool |
|---|---|
| API | Express |
| Database | SQLite/PostgreSQL + Prisma |
| Migrations | Prisma Migrate |
| Cache / rate limiting | Redis (ioredis) + express-rate-limit |
| Background tasks | BullMQ |
| Validation | Zod |
| Auth | JWT (jsonwebtoken) |

## Structure

```
app/
  main.ts           — app factory, middleware, routers
  server.ts         — network entry point (listen)
  worker.ts         — BullMQ worker + scheduled flush
  config.ts         — settings from environment
  database.ts       — shared Prisma client
  security.ts       — password hashing and JWT helpers
  rate_limit.ts     — express-rate-limit setup
  redis_client.ts   — lazy Redis singleton (swappable in tests)
  tasks.ts          — background task logic + enqueue helpers
  queue.ts          — BullMQ queue setup
  dependencies.ts   — auth middleware
  exceptions.ts     — HttpError + error-handling middleware
  validate.ts       — Zod body-validation middleware
  request.ts        — AppRequest type + path/query parameter helpers
  schemas/          — Zod request schemas + response serializers
  routers/          — auth, bookmarks, categories, tags
prisma/
  schema.prisma     — models
  migrations/       — migration scripts
tests/              — Jest + supertest suite (TypeScript, run as ESM)
```

## Setup

```bash
# From the repo root, install dependencies and generate the Prisma client
npm install
npm run prisma:generate

# Run the test suite (uses an isolated SQLite database)
npm test -- backends/bookmark-manager
```

To run the full stack (API + Postgres + Redis + worker):

```bash
docker compose up -d
```

> The Prisma datasource is set to SQLite to keep the test suite self-contained.
> For a Postgres deployment, switch `provider` in `prisma/schema.prisma` to `postgresql` and
> point `DATABASE_URL` at your database.
