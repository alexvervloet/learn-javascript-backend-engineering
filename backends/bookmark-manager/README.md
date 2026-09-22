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

The stack comes up on Postgres, applies migrations, and serves the API on
port 8002. `docker compose down -v` removes the containers and the volume.

### Deploying this anywhere real

`SECRET_KEY` defaults to `change-me-in-production` so a fresh clone starts with
no setup. That default signs every JWT this app issues, which means anyone who
has read this repo can forge a token for any account.

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
| `prisma/schema.prisma` | `sqlite` | local development and `npm test` (no database to start) |
| `prisma/postgres/schema.prisma` | `postgresql` | `docker-compose.yml` |

The models below the datasource block are identical in both, and each has its
own migration history in the matching dialect. `npm run prisma:check` (which CI
runs) compares the two model blocks and fails if they drift, so a model edited
in one file and forgotten in the other is caught at review time rather than on
someone's first `docker compose up`.
