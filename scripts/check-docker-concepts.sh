#!/usr/bin/env bash
#
# Builds every Dockerfile under backends/learning/docker-concepts and checks that
# each image actually starts.
#
# Building is not enough on its own. These images all ran `CMD ["node","server.js"]`
# against a server.ts file for a while: they built fine and died the moment anyone
# ran them, which is the failure a learner hits and CI did not. So each image is
# started and has to log its listening line before it counts as passing.
#
# docker-debugging/broken is deliberately misconfigured — it listens on 9000
# instead of 8000 (that is BUG 1 of the exercise). It still has to START, because
# the exercise tells you to find BUG 1 by reading the container's logs.
#
# Usage: scripts/check-docker-concepts.sh

set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
concepts="$root/backends/learning/docker-concepts"

# Dockerfile path -> build context, relative to $concepts.
# Dockerfile.insecure is the security module's counter-example; it is meant to be
# a bad image, not a broken one, so it is built and run like the rest.
specs=(
  "docker-cicd/Dockerfile|docker-cicd|8000"
  "docker-compose/Dockerfile|docker-compose|8000"
  "docker-debugging/broken/Dockerfile|docker-debugging/broken|9000"
  "docker-multi-stage/Dockerfile|docker-multi-stage|8000"
  "docker-multi-stage/Dockerfile.alpine|docker-multi-stage|8000"
  "docker-multi-stage/Dockerfile.buildargs|docker-multi-stage|8000"
  "docker-multi-stage/Dockerfile.single|docker-multi-stage|8000"
  "docker-multi-stage/Dockerfile.slim|docker-multi-stage|8000"
  "docker-reverse-proxy/Dockerfile|docker-reverse-proxy|8000"
  "docker-security/Dockerfile|docker-security|8000"
  "docker-security/Dockerfile.insecure|docker-security|8000"
)

failed=0

for spec in "${specs[@]}"; do
  IFS='|' read -r dockerfile context port <<<"$spec"
  tag="docker-concepts-check/$(echo "$dockerfile" | tr '/.' '--' | tr '[:upper:]' '[:lower:]')"

  printf '%-46s ' "$dockerfile"

  if ! build_out=$(docker build -q -f "$concepts/$dockerfile" -t "$tag" "$concepts/$context" 2>&1); then
    echo "BUILD FAILED"
    echo "$build_out" | tail -15 | sed 's/^/    /'
    failed=1
    continue
  fi
  printf 'build ok  '

  # No port publishing: the log line is the signal, and binding a host port makes
  # parallel CI jobs collide.
  if ! cid=$(docker run -d "$tag" 2>&1); then
    echo "RUN FAILED"
    echo "$cid" | sed 's/^/    /'
    failed=1
    continue
  fi

  started=0
  for _ in $(seq 1 20); do
    if docker logs "$cid" 2>&1 | grep -qi "listening on .*:$port"; then
      started=1
      break
    fi
    # An image that exits immediately will never log it; stop waiting on it.
    if [ "$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null)" != "true" ]; then
      break
    fi
    sleep 0.5
  done

  if [ "$started" = "1" ]; then
    echo "starts ok (:$port)"
  else
    echo "DID NOT START"
    docker logs "$cid" 2>&1 | tail -15 | sed 's/^/    /'
    failed=1
  fi

  docker rm -f "$cid" >/dev/null 2>&1
  docker rmi -f "$tag" >/dev/null 2>&1
done

if [ "$failed" -ne 0 ]; then
  echo
  echo "One or more docker-concepts images failed to build or start."
  exit 1
fi

echo
echo "All ${#specs[@]} docker-concepts images build and start."
