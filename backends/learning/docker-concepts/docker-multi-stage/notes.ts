/*
Docker Multi-Stage Builds (Node)
=================================

CONCEPTS:
  1. Dockerfile basics: FROM, RUN, COPY, CMD, ENTRYPOINT
  2. Multi-stage builds: separate builder vs runtime image
  3. Layer caching: order commands for cache hits
  4. Image size: single-stage vs slim vs multi-stage vs alpine

FILES:
  app/server.js        the Express app being containerized
  app/package.json     dependencies + lockfile drive reproducible installs
  .dockerignore        excludes node_modules, .git, notes from the build context
  Dockerfile.single    single-stage (large, simple)
  Dockerfile.slim      single-stage on a slim base
  Dockerfile           multi-stage (small, production-ready)
  Dockerfile.alpine    alpine multi-stage (smallest, caveats)
  Dockerfile.buildargs ARG vs ENV demo

--- DOCKERFILE BASICS ---

FROM <image>:<tag>     the base image. node:20 (~1.1GB full), node:20-slim
                       (~200MB), node:20-alpine (~150MB, musl libc).
RUN <command>          runs a shell command at build time; each RUN is a layer.
                       Combine related steps with && to keep layers small.
COPY <src> <dest>      copies from the build context (.) into the image;
                       .dockerignore controls what's excluded.
CMD ["node","x.js"]    default command; replaceable at runtime (docker run img bash).
ENTRYPOINT ["node"]    fixed executable; runtime args are appended, not replaced.

--- LAYER CACHING ---

Docker caches each layer by its inputs and reuses it if unchanged. Invalidation
cascades: change layer N and every layer after it rebuilds.

  WRONG (busts the install on every code change):
    COPY app/ .
    RUN npm ci
  RIGHT (deps cached independently of code):
    COPY package*.json ./
    RUN npm ci
    COPY app/ .

Rule: things that change rarely (manifests) go early; things that change often
(source) go late — i.e. `COPY package*.json` and `npm ci` before `COPY app/`.

--- MULTI-STAGE STRATEGY ---

Build deps and dev tooling are needed to install but are dead weight at runtime.
  Stage 1 (builder): full image, run `npm ci` (with a cache mount).
  Stage 2 (runtime): slim image; COPY --from=builder /app/node_modules over.
Nothing else follows — no npm cache, no dev dependencies, no toolchain.

--- IMAGE SIZE ---

  node-single  (Dockerfile.single, full base)   ~1.1 GB
  node-slim    (Dockerfile.slim, slim base)     ~250 MB
  node-multi   (Dockerfile, slim + multi-stage) ~220 MB
  node-alpine  (Dockerfile.alpine, alpine)      ~170 MB

Build them all, then: docker images | grep node-

--- PRACTICE ---

  docker build -f Dockerfile.single -t node-single .
  docker build -t node-multi .
  docker images | grep node-                       # the payoff
  docker run -p 8000:8000 node-multi
  curl localhost:8000 ; curl "localhost:8000/items/42?q=docker"
  docker history node-multi                         # see the (fewer) layers
  # Edit app/server.js, rebuild → the npm ci layer shows CACHED.
*/
export {};
