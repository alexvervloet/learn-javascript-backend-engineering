/*
Image Optimization (Node)
=========================

CONCEPTS:
  1. Base image selection: alpine vs slim vs full
  2. Reduce image size: combine RUN layers, avoid caching cruft
  3. .dockerignore: exclude node_modules, .git, .env
  4. ARG vs ENV: build-time vs runtime variables

--- BASE IMAGE SELECTION ---

  Tag              Approx size   Notes
  node:20          ~1.1 GB       full Debian + build toolchain. Safe but fat.
  node:20-slim     ~200 MB       Debian minimal; no toolchain. Native addons may
                                 need build tools installed via apt.
  node:20-alpine   ~150 MB       musl libc; native addons may compile from source
                                 (bcrypt, sharp, better-sqlite3). Pure JS is fine.

RECOMMENDATION: node:20-slim for most services; node:20-alpine when every dep is
pure JS; full node:20 only in builder stages or local dev.

The alpine gotcha: prebuilt native addons target glibc, so on Alpine's musl libc
they may rebuild from source — for a smaller final image you sometimes add a
COMPILER, making the build more complex.

--- LAYER COMBINING ---

Docker snapshots each layer independently; a later layer that deletes a file
can't shrink an earlier layer that created it.

  WRONG (cache survives in an earlier layer):
    RUN apt-get update
    RUN apt-get install -y curl
    RUN rm -rf /var/lib/apt/lists/*
  RIGHT (install + clean in ONE layer):
    RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

For npm, prefer `npm ci` with a BuildKit cache mount
(`--mount=type=cache,target=/root/.npm`) so the cache persists OUTSIDE the
image instead of bloating a layer.

--- .DOCKERIGNORE ---

Docker sends the whole build context to the daemon before any instruction runs.
Always exclude:
  node_modules/  (reinstalled in-image; copying the host's is slow + wrong-arch)
  .git/          full history
  .env           never bake secrets into an image
  *.md, notes*.js docs / practice files

--- ARG vs ENV ---

  ARG  build-time only; gone at runtime; visible in `docker history` (not for secrets).
  ENV  persists into the image + container; override with `docker run -e`.
  Common pattern: ARG PORT=8000 then ENV PORT=${PORT}.
  Node env var to set: NODE_ENV=production (enables prod behaviour, skips dev deps).

--- COMMANDS ---

  docker build -f Dockerfile.single -t node-single .
  docker build -f Dockerfile.slim   -t node-slim   .
  docker build -t node-multi .
  docker build -f Dockerfile.alpine -t node-alpine .
  docker images | grep node-
  docker build -f Dockerfile.buildargs --build-arg PORT=9000 -t node-buildargs .
  docker run -p 9000:9000 node-buildargs
*/
export {};
