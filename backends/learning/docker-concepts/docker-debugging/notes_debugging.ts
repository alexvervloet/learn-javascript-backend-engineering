/*
Container Debugging & Inspection
==================================

THE BROKEN STACK (broken/):
  broken/Dockerfile          Bug 1: wrong port (PORT=9000 vs mapped 8000)
  broken/docker-compose.yml  Bug 2: wrong db hostname ("database")
                             Bug 3: wrong init.sql mount path (/tmp)
  broken/app/server.js       Express + pg

--- docker exec ---  (run a command inside a RUNNING container)

  docker exec -it <ctr> sh                  # shell (slim/alpine: sh, not bash)
  docker compose exec app sh
  docker compose exec db psql -U postgres -d debugdb
Inside: env · cat /etc/resolv.conf (DNS, 127.0.0.11) · ls -la /app ·
  node -e "require('dns').promises.lookup('db').then(console.log)" · ps aux

--- docker logs ---  (a container's stdout/stderr)

  docker logs -f <ctr>                docker compose logs -f app
  docker logs --tail 50 <ctr>         docker logs --since 5m <ctr>
Look for: container exited immediately (stack trace / ENOTFOUND / ECONNREFUSED),
  wrong port in the "listening on ..." line, DB auth/host failures.

--- docker inspect ---  (detailed JSON; use --format to extract)

  docker inspect --format='{{.State.Status}} exit={{.State.ExitCode}}' <ctr>
  docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' <ctr>
  docker inspect --format='{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}' <ctr>
  docker inspect --format='{{.State.Health.Status}}' <ctr>

--- THE EXERCISE (fix in order) ---

  cd broken/ && docker compose up

  BUG 1 — curl localhost:8000 → connection refused, but `ps` shows app Up.
    docker compose logs app → "listening on http://0.0.0.0:9000".
    Fix: remove ENV PORT=9000 in Dockerfile; rebuild.

  BUG 2 — after fixing 1, app crashes on startup.
    docker compose logs app → getaddrinfo ENOTFOUND database.
    Fix: change "database" to "db" in DATABASE_URL; docker compose up -d app.

  BUG 3 — all healthy, app responds, but GET /items → 'relation "items" does not exist'.
    docker compose exec db ls /docker-entrypoint-initdb.d/  → empty.
    docker inspect ... Mounts → init.sql mounted at /tmp.
    Fix: mount to /docker-entrypoint-initdb.d/init.sql; docker compose down -v && up.

  Each bug needed a different tool: logs (1, 2), exec + inspect (3).

--- RESOURCE LIMITS ---

  deploy: { resources: { limits: { memory: 256M, cpus: "0.5" } } }
  Memory exceeded → OOM-kill (SIGKILL); CPU exceeded → throttled (not killed).
  docker inspect --format='{{.State.OOMKilled}}' <ctr>     docker stats
*/
export {};
