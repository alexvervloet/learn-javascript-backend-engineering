/*
CI/CD Integration — Docker Build in GitHub Actions
=====================================================

--- WHY BUILD IN CI? ---

Build the image in CI, push it, and have the server pull THAT exact image — not
one built on your laptop. "The image built in CI is what gets deployed" means
this exact binary. The git SHA baked into the image proves it: curl /version and
compare to the GitHub Actions run that produced it.

--- WORKFLOW STRUCTURE ---

Trigger: push to main / PR (path-scoped). Job on ubuntu-latest. Key steps:
  1. actions/checkout@v4
  2. docker/setup-buildx-action@v3      (BuildKit, needed for caching)
  3. docker/login-action@v3             (GHCR auth with GITHUB_TOKEN)
  4. docker/metadata-action@v5          (tags from git refs)
  5. docker/build-push-action@v6        (build + cache + push)
     with build-args: BUILD_SHA=${{ github.sha }}

--- GHCR ---

  ghcr.io/<owner>/<repo>/docker-cicd:latest
  ghcr.io/<owner>/<repo>/docker-cicd:sha-<short>
GITHUB_TOKEN is provided automatically; the job needs `permissions: packages: write`.

--- CACHING ---

  cache-from: type=gha           GitHub Actions cache — fastest in GH Actions,
  cache-to:   type=gha,mode=max  not portable. mode=max caches ALL stages
                                 (including the builder's npm ci), so installs
                                 are skipped on the next run.
  type=registry,ref=...:cache    portable across CI systems; slower.

--- TAGS vs DIGESTS ---

  Tag (mutable):    image:latest — can be rewritten any time.
  Digest (immutable): image@sha256:... — content hash, never changes.
  Production deploys should pull by DIGEST: docker pull image@sha256:...

--- BUILD ARGS + CACHE ORDER ---

  ARG BUILD_SHA=local-build
  ENV BUILD_SHA=$BUILD_SHA
Placed AFTER COPY package*.json + npm ci, so a new SHA each commit doesn't bust
the install layer — only the final layers change.

--- LANGUAGE-AGNOSTIC BY DESIGN ---

The pipeline cares only about the Dockerfile: node base images, `npm ci`, and
`npx tsx server.ts`. The build-push-action, caching, GHCR, tags-vs-digests, and
build-arg patterns are the same whatever the app is written in.

--- EXERCISES ---

  1. Push; watch the workflow in the Actions tab.
  2. docker pull ghcr.io/<owner>/<repo>/docker-cicd:latest
     docker run -p 8000:8000 ...   curl localhost:8000/version  → SHA matches.
  3. Push twice; the second run shows CACHED on the npm ci layer.
*/
export {};
