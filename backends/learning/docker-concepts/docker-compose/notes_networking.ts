/*
Docker Compose — Networking & Communication
============================================

--- THE COMPOSE NETWORK ---

`docker compose up` creates a network (<project>_default) and attaches every
service. Docker's internal DNS resolves each SERVICE NAME to its container IP:
  inside a container:  "db" → db's IP, "redis" → redis's IP
  from your host:      those names don't resolve; use mapped ports.
This is why DATABASE_URL uses "db:5432", not "localhost:5432".

Services can reach each other on ANY port over this network regardless of
ports:/expose:. Those keys only control reachability from OUTSIDE Docker.

--- ports: vs expose: ---

  ports: ["5432:5432"]   reachable from other services AND your host (and the
                         network, if unfirewalled). host:container mapping.
  expose: ["5432"]       reachable from other services only; documents the port.
  neither listed         still reachable service-to-service (network is open),
                         just not from the host.
Rule: only map ports for services that must be reached from outside Docker —
usually just the API. In production, db/redis have no ports:.

--- HEALTH CHECKS ---

  healthcheck:
    test:         the command to run
    interval:     how often (default 30s)
    timeout:      max time per check (default 30s)
    retries:      failures before "unhealthy" (default 3)
    start_period: grace window before failures count (default 0s)

test forms: ["CMD", exe, args...] (no shell) · ["CMD-SHELL", "string"] (via sh).
This project:
  db:    pg_isready -U postgres -d appdb            (built into postgres image)
  redis: redis-cli ping                             (built into redis image)
  app:   node -e "fetch('http://localhost:8000/health')..."  (Node's global fetch;
         slim images have no curl). start_period gives the server time to boot.

--- depends_on CONDITIONS ---

  service_started               container started (NOT ready) — wrong for DBs
  service_healthy               health check passed — correct for db/redis
  service_completed_successfully container exited 0 — for migration/seed runners

Without a health condition the app may connect before Postgres is ready and
crash; with service_healthy Compose waits until pg_isready passes.

--- COMMANDS ---

  docker compose ps                                          # health status
  docker inspect --format='{{.State.Health.Status}}' <ctr>   # one service
  docker compose exec app node -e "require('dns').promises.lookup('db').then(console.log)"
*/
export {};
