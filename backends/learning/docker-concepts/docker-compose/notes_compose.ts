/*
Docker Compose — Multi-Service Setup
======================================

SERVICES:
  app    Express API (built from Dockerfile)   → localhost:8000
  db     PostgreSQL 16                          → localhost:5432
  redis  Redis 7                                → localhost:6379

FILES:
  docker-compose.yml          base config (production-like)
  docker-compose.override.yml dev overrides (bind mount + node --watch)
  docker-compose.test.yml     run jest against the built image
  Dockerfile                  multi-stage Node build
  app/server.js               Express using Postgres + Redis
  init.sql                    schema + seed, runs on first DB startup
  .env / .env.example         loaded automatically by Compose

--- docker-compose.yml STRUCTURE ---

Top-level keys: services, volumes, networks (Compose creates a default network).
Each service: image | build, ports, environment, volumes, depends_on,
healthcheck, restart, command.

--- SERVICE NETWORKING ---

Compose puts all services on a shared network; each is reachable at its SERVICE
NAME as the hostname.
  DATABASE_URL: postgresql://postgres:pass@db:5432/appdb   ← "db", not localhost
  REDIS_URL:    redis://redis:6379                          ← "redis"
"localhost" inside a container means THAT container. From your host you reach
services only through mapped ports (localhost:8000, :5432, :6379).

--- NAMED VOLUMES vs BIND MOUNTS ---

  Named volume (postgres_data:/var/lib/postgresql/data): Docker-managed; survives
    `docker compose down`, deleted only by `down -v`. For databases.
  Bind mount (./app:/app): host path mapped into the container; edits are live.
    For dev hot reload.

--- depends_on DONE RIGHT ---

  WRONG: depends_on: [db]            ← waits for the container to START only
  RIGHT: depends_on: { db: { condition: service_healthy } }
Combined with a db healthcheck (pg_isready), the app won't start until Postgres
actually accepts connections. No sleeps, no retry loops.

--- .env FILE ---

Compose auto-loads .env from the project dir and substitutes ${VAR} /
${VAR:-default} in the yaml. It does NOT auto-inject into containers — list
vars under `environment:`. Never commit .env; commit .env.example.

--- COMMANDS ---

  docker compose up                 # build if needed, override auto-applied
  docker compose up -d              # background
  docker compose logs -f [service]  # follow logs
  docker compose build app && docker compose up -d --no-deps app   # rebuild app only
  docker compose down               # stop (keep volumes)
  docker compose down -v            # stop + wipe volumes
  docker compose ps                 # status (shows healthy/unhealthy)
  docker compose exec app sh        # shell in a running container
  docker compose exec db psql -U postgres -d appdb
  docker compose exec redis redis-cli

--- EXERCISES ---

  1. docker compose up — watch redis/db start first, app wait for health checks.
  2. Cache: curl /items (source: db) → curl /items (source: cache) →
     curl -X DELETE /items/cache → curl /items (source: db).
  3. POST an item, then curl /items — cache was invalidated (source: db).
  4. Persistence: POST an item, `down`, `up -d`, item survives (named volume);
     `down -v`, `up -d`, back to seed only (init.sql re-ran).
*/
export {};
