/*
Docker Security & Best Practices
==================================

FILES:
  Dockerfile.insecure  6 deliberate issues ([ISSUE N])
  Dockerfile           secure implementation ([FIX N])
  docker-compose.yml   hardened runtime options
  app/server.js        /whoami and /secrets/check to verify
  secrets/             files mounted at /run/secrets/ by Compose

--- 1. NON-ROOT USER ---

Containers run as root (uid 0) by default. Fix with a USER instruction:
  RUN groupadd --system --gid 1001 appgroup && \
      useradd  --system --uid 1001 --gid appgroup --no-create-home appuser
  RUN chown -R appuser:appgroup /app   # while still root
  USER appuser
Verify: curl /whoami → {"uid":1001,"is_root":false}. Ports < 1024 need root or
NET_BIND_SERVICE — listen on 8000+ and let a proxy handle 80/443.
(Alpine: addgroup -S / adduser -S -G.)

--- 2. READ-ONLY FILESYSTEM ---

  read_only: true
  tmpfs: [/tmp]
Blocks runtime writes (malware, tampering, leaked temp files). Node rarely needs
to write to its app dir; give /tmp via tmpfs for anything that does.

--- 3. SECRET MANAGEMENT ---

NEVER: ENV/ARG secrets (visible in inspect/history forever), COPY .env / secrets/.
DO:
  A) runtime env for non-sensitive config (visible in inspect — config only).
  B) Docker secrets — compose `secrets:` → /run/secrets/<name>, read as a file,
     not an env var (this project). In Swarm/K8s the orchestrator manages them.
  C) BuildKit secret mounts for build-time secrets:
     RUN --mount=type=secret,id=npm_token npm ci   (docker build --secret id=npm_token,src=...)
  D) external stores (Vault, AWS/GCP Secret Manager) in production.
Verify: curl /secrets/check → {"secret_mounted":true,"secret_in_env":false}.

--- 4. PIN BASE IMAGES ---

  worst:  node:latest
  ok:     node:20
  better: node:20-bookworm-slim          (version + OS variant)
  best:   node:20-bookworm-slim@sha256:... (immutable digest — byte-for-byte reproducible)
Get the digest: docker inspect --format='{{index .RepoDigests 0}}' node:20-bookworm-slim.
Pinned digests don't auto-patch — use Renovate/Dependabot to bump monthly.

--- 5. IMAGE SCANNING ---

  docker scout cves <image>            # Docker Desktop
  trivy image <image>                  # open source
  trivy image --exit-code 1 --severity CRITICAL <image>   # fail CI on criticals
Fewer packages = fewer CVEs: full > slim > alpine > distroless
(gcr.io/distroless/nodejs22-debian12 — no shell, smallest surface; :debug for a shell).

--- CHECKLIST ---

  [ ] base pinned to version+variant (digest for reproducibility)
  [ ] multi-stage — toolchain absent from runtime
  [ ] no secrets in ENV/ARG/COPY; .env + secrets/ in .dockerignore
  [ ] COPY specific dirs, not COPY . .
  [ ] non-root USER (explicit uid/gid); chown before USER
  [ ] HEALTHCHECK defined
  [ ] compose: secrets:, read_only + tmpfs, no-new-privileges, cap_drop: [ALL],
      127.0.0.1 bind for non-public services, internal services have no ports:
  [ ] scan in CI; auto-update base digests
*/
export {};
