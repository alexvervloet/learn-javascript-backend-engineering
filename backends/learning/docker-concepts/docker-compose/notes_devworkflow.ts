/*
Development Workflow
=====================

--- HOT RELOAD ---

In docker-compose.override.yml:
  volumes: [./app:/app, /app/node_modules]   # live source, keep image's deps
  command: ["node", "--watch", "server.js"]  # built-in watcher (Node 18+)

How it works: the bind mount makes your host's ./app appear at /app in the
container (no COPY). `node --watch` watches for file changes and restarts the
process on save — typically within a second. (The anonymous /app/node_modules
volume stops the host's empty/absent node_modules from shadowing the image's.)

Mac/Docker Desktop caveat: filesystem events don't always propagate through the
VM. If --watch misses changes, restart or use a polling-based watcher.
Never use --watch in production — it adds a watcher process and restarts on any
change, briefly dropping requests.

--- RUNNING TESTS IN CONTAINERS ---

  1. docker compose exec app npm test
     Runs jest in the ALREADY-RUNNING dev container (bind mount → live code).
     Fast; requires `docker compose up` to be running.
  2. docker compose run --rm app npm test
     Fresh container (override active, bind mount). depends_on respected.
  3. docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm app
     Test override; dev override is NOT auto-applied (explicit -f). Runs against
     the BUILT IMAGE — what CI does. Sets DOCKER_IT=1 to un-skip the suite.

--- BUILD CACHE ---

  Layer cache (always on): order COPY/RUN so package*.json is copied before
    source — the npm-install layer stays cached across code changes.
  BuildKit cache mount: RUN --mount=type=cache,target=/root/.npm npm ci
    persists npm's cache OUTSIDE image layers, between builds on one machine.
  CI cache: registry-based --cache-from/--cache-to with docker buildx, since CI
    runners are fresh each run.

--- REQUEST TRACING ---

server.js tags each request with an 8-char id, logs it, and returns it as
X-Request-ID. Trace one request across services:
  docker compose logs | grep <request_id>
In multi-service systems, forward the id downstream:
  fetch(url, { headers: { "X-Request-ID": requestId } })

--- LOG COMMANDS ---

  docker compose logs -f                  # all services, color-coded, live
  docker compose logs -f app db           # specific services
  docker compose logs --tail 50 app
  docker compose logs --since 5m
  docker compose logs -f 2>&1 | grep -i error
*/
export {};
