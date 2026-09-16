/*
Reverse Proxy Pattern with nginx
==================================

A reverse proxy sits in front of one or more backends. Clients talk to the proxy;
it forwards to the right backend. The client never reaches the app directly.

  Client → nginx (port 80) → app (port 8000, internal only)

WHY: hide internal ports, terminate TLS (nginx does HTTPS, app speaks HTTP),
path-based routing, serve static files, rate limiting, load balancing.

--- expose: vs ports: ---

  ports: ["80:80"]   published to the host — curl localhost works.
  expose: ["8000"]   documents the port; NOT published — curl localhost:8000 fails.
Here nginx has ports:["80:80"] (reachable) and app has expose:["8000"] (internal).

--- nginx upstream + headers (nginx/default.conf) ---

  upstream app { server app:8000; }   # "app" = Compose service name (Docker DNS)
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Host $host;        # keep the original Host, not "app:8000"

Without these, the app sees nginx's internal IP and "app:8000" as Host. Read the
forwarded values in Express via req.headers["x-real-ip"], etc. (set
`app.set("trust proxy", true)` if you rely on req.ip behind a proxy).

--- path-based routing ---

  location /api/    { proxy_pass http://api_service; }
  location /static/ { root /var/www; }            # nginx serves these directly
  location /        { proxy_pass http://frontend; }

--- COMMANDS ---

  docker compose up --build
  curl localhost          # works (nginx → app)
  curl localhost:8000     # connection refused (app not published)
  curl localhost/headers  # see the forwarded headers
  docker compose up -d --scale app=3   # nginx round-robins across 3 app containers
  docker compose exec nginx nginx -T   # dump resolved config
*/
export {};
