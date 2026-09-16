# Rate Limiting

Protect an API from abuse and overload by capping how many requests an
identifier (user/IP) may make. Three algorithms, all backed by Redis (ioredis)
with atomic Lua scripts.

| File | Algorithm | Trade-off |
|---|---|---|
| `01_fixed_window.ts` | Fixed window (INCR + EXPIRE) | simplest; allows a boundary burst |
| `02_sliding_window.ts` | Sliding window (sorted set) | accurate; one entry per request |
| `03_token_bucket.ts` | Token bucket | allows bursts up to capacity, then a steady rate |
| `04_middleware.ts` | Sliding window as Express middleware | per-route limits + standard headers |

`redis_rl.ts` holds the shared ioredis client. The Lua scripts run on the Redis
server, so each check-and-update is atomic.

## Run

```bash
docker compose up -d        # Redis on :6379
npm install                 # from the repo root
npx tsx 01_fixed_window.ts
npx tsx 04_middleware.ts       # Express server on :8000
for i in $(seq 1 5); do curl -si localhost:8000/search | head -1; done
```

