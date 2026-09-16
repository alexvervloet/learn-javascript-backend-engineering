# Async Postgres (node-postgres)

## What is this?

Node does I/O asynchronously by default: when code talks to a database it doesn't
block the thread — the event loop handles other work and resumes when the result
is ready. That's what lets one process serve thousands of concurrent requests
without a thread per request.

**[node-postgres](https://node-postgres.com)** (`pg`) is the standard Postgres
client for Node. A `Pool` keeps a set of connections open and hands them out;
`pool.query()` borrows and returns one automatically, while `pool.connect()`
checks out a dedicated client you must release (needed for multi-statement
transactions).

## The key idea

```js
// Borrow a connection, run one statement, return it — fully async.
const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
```

`await` suspends just this request while the query runs; the event loop keeps
serving others.

## When does it matter?

Async shines when an app is **I/O bound** — mostly waiting on databases, APIs, or
files. Running independent queries with `Promise.all` turns "sum of latencies"
into "max latency". It doesn't help CPU-heavy work.

## What the files cover

| File | What it teaches |
|---|---|
| `01_async_basics.ts` | CRUD with `pool.query` and `RETURNING` |
| `02_pool_and_client.ts` | `pool.query` vs `pool.connect`, transactions, the release trap |
| `03_connection_pool.ts` | Pool config: `max`, `connectionTimeoutMillis`, `idleTimeoutMillis`, `maxLifetimeSeconds` |
| `04_pool_exhaustion.ts` | What happens when all connections are busy — timeouts and how to fix it |
| `05_concurrent_queries.ts` | Running queries concurrently with `Promise.all` |

## How to run

```bash
docker compose up -d        # Postgres (set DB_NAME=async_demo)
npm install                 # from the repo root
npx tsx 01_async_basics.ts
npx tsx 05_concurrent_queries.ts
```
