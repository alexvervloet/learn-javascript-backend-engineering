# Backend Concepts

Focused demos for common backend patterns, translated to the 2026 Node stack.
Each subfolder is a self-contained runnable example.

## Modules

| Folder | What it covers | Stack |
|---|---|---|
| [caching/](caching/) | Cache-aside, write-through/behind, invalidation, stampede | ioredis + better-sqlite3 |
| [jwt-rbac/](jwt-rbac/) | JWT auth with role-based access control | jsonwebtoken + Express |
| [kafka-demo/](kafka-demo/) | Producing/consuming, groups, partitions, worker | KafkaJS |
| [oauth2/](oauth2/) | OAuth2 authorization code flow (GitHub) | Express + express-session |
| [observability/](observability/) | Structured logging, metrics, tracing, correlation IDs | pino + prom-client + OpenTelemetry |
| [pagination/](pagination/) | Offset vs cursor pagination | Express + better-sqlite3 |
| [rate-limiting/](rate-limiting/) | Fixed/sliding window, token bucket, middleware | ioredis (Lua) + Express |
| [testing/](testing/) | Route + dependency integration testing | Jest + supertest + Zod |
| [webhooks/](webhooks/) | Receiving, signing, retries, idempotency | Express + node:crypto |
| [websockets/](websockets/) | Real-time bidirectional comms + SSE | ws + Express |

Most folders are runnable demos (some need Redis/Kafka via their `docker-compose.yml`).
`testing/` contains real Jest tests that run as part of `npm test`.
