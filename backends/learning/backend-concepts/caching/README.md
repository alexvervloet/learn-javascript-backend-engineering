# Caching

Reading from a database is slow relative to memory. **Caching** stores the result
of an expensive operation somewhere fast (Redis) so you can reuse it. The trade:
memory for speed, freshness for performance — cached data can be stale until it
expires or is invalidated.

Good caching is mostly deciding: what to cache, how long (TTL), and when to
invalidate.

## Stack

- **Redis** via [`ioredis`](https://github.com/redis/ioredis) (the cache)
- **better-sqlite3** (the "slow" source of truth — in-memory so no Postgres needed)

## What the files cover

| File | What it teaches |
|---|---|
| `01_cache_aside.ts` | Check cache, fall back to DB on a miss, write back; invalidate on write |
| `02_write_through.ts` | Write to cache and DB together — cache never cold |
| `03_write_behind.ts` | Write to cache, flush to DB in the background — fastest, lossy |
| `04_invalidation.ts` | TTL, event-driven, and versioned-key invalidation |
| `05_stampede.ts` | The thundering-herd problem, and two fixes: a Redis lock and probabilistic early expiry (XFetch) |

`db.ts` is the SQLite source of truth; `cache.ts` holds the ioredis client + key/serialisation helpers.

### Two ways to stop a stampede

`05_stampede.ts` runs both and shows what each costs.

A **Redis lock** guarantees exactly one database query: the first request in
acquires the lock and fetches, everyone else waits and then reads the warm cache.
The cost is that waiting — N-1 requests take a latency hit — plus a lock you now
have to release correctly. Note that releasing is `releaseLock` in `cache.ts`, not
`DEL`: if your work outran the lock's TTL, the lock you are about to delete may
already belong to someone else.

**XFetch** (probabilistic early expiry) has each reader roll the dice on
refreshing slightly early, with the odds rising as the entry nears expiry. Nobody
waits and nobody serves a cold miss, but you accept the occasional duplicate
query. It needs steady traffic to work: an entry nobody reads never gets
refreshed early, so it expires like any other.

Reach for the lock when a duplicate recompute is expensive. Reach for XFetch when
latency matters more and a duplicate query is cheap.

## How to run

```bash
docker compose up -d          # Redis on :6379
npm install                   # from the repo root
npx tsx 01_cache_aside.ts
npx tsx 05_stampede.ts
```

