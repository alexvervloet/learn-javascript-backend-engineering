# URL Shortener

Express service that shortens URLs, tracks clicks, and redirects visitors.

## Features

- JWT authentication (register, login)
- Shorten long URLs to auto-generated slugs
- HTTP redirect on slug lookup
- Click tracking via BullMQ background tasks
- Redis cache for frequently-accessed slugs
- Prisma database migrations

## Stack

| Layer | Tool |
|---|---|
| API | Express |
| Database | SQLite/PostgreSQL + Prisma |
| Migrations | Prisma Migrate |
| Cache | Redis (ioredis) |
| Background tasks | BullMQ |
| Validation | Zod |
| Auth | JWT (jsonwebtoken) |

## Structure

```
app/
  main.ts       — app factory; mounts routers (redirect last, it's a catch-all)
  server.ts     — network entry point (listen + cache init)
  worker.ts     — BullMQ worker for click increments
  database.ts   — shared Prisma client
  models        — see prisma/schema.prisma
  schemas.ts    — Zod request schemas + response serializers
  shortener.ts  — slug generation logic
  cache.ts      — Redis helpers
  queue.ts      — BullMQ queue setup
  tasks.ts      — click-increment task + enqueue helper
  auth.ts       — hashing, JWT, and auth middleware
  errors.ts     — HttpError + error-handling middleware
  config.ts     — settings read from the environment
  validate.ts   — Zod body-validation middleware
  request.ts    — path and query parameter helpers
  routers/
    auth.ts     — register and login
    urls.ts     — create and list shortened URLs
    redirect.ts — slug → redirect with click tracking
prisma/
  schema.prisma — URL and user models (SQLite, for local development)
  migrations/   — SQLite migration scripts
  postgres/     — the same models with a postgresql datasource, used by Compose
tests/
  env.ts        — DATABASE_URL and secrets, imported first (see the file)
  setup.ts      — fake Redis, stubbed queue, fixtures, shared server
  auth.test.ts  — register, token, and what a protected route rejects
  urls.test.ts  — create, custom codes, pagination, stats, soft delete
  redirect.test.ts — the hot path: cache fill, cache hit, invalidation, clicks
```

## Setup

```bash
# From the repo root, install dependencies and generate the Prisma client
npm install
npm run prisma:generate

# Run the test suite (isolated SQLite + an in-memory Redis, no services needed)
npm test -- backends/url-shortener

# Create the database schema, then run the API
cd backends/url-shortener
DATABASE_URL=file:./prisma/dev.db npx prisma migrate deploy --schema=prisma/schema.prisma
DATABASE_URL=file:./prisma/dev.db npx tsx app/server.ts
```

Or run the full stack (API + Postgres + Redis + worker):

```bash
docker compose up -d
```

The stack comes up on Postgres, applies migrations, and serves the API on
port 8000. `docker compose down -v` removes the containers and the volume.

### Deploying this anywhere real

`JWT_SECRET` defaults to `change-me-to-a-long-random-string` so a fresh clone
starts with no setup. That default signs every JWT this app issues, which means
anyone who has read this repo can forge a token for any account.

So `app/config.ts` refuses to start when it sees that placeholder and
`ENVIRONMENT=production` (or `NODE_ENV=production`), and it also rejects any
secret shorter than 32 characters. HS256 signs with the raw secret, so a short
one can be brute-forced offline from a single captured token.

Generate a real one:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The crash is deliberate. A default secret is worse than no default because
nothing appears to go wrong: the app boots, signs tokens and serves traffic
exactly as it would with a real secret. A deployment that will not start gets
noticed; one that quietly accepts forged tokens does not.

### Two Prisma schemas, and why

Prisma requires `provider` to be a literal in the schema file. It cannot be read
from an environment variable, so one schema cannot serve both SQLite and
Postgres. This project keeps both:

| File | Provider | Used by |
|---|---|---|
| `prisma/schema.prisma` | `sqlite` | local development (no database to start) |
| `prisma/postgres/schema.prisma` | `postgresql` | `docker-compose.yml` |

The models below the datasource block are identical in both, and each has its
own migration history in the matching dialect. `npm run prisma:check` (which CI
runs) compares the two model blocks and fails if they drift.
