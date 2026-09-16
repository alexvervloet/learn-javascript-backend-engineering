/**
 * Cache Stampede (Thundering Herd)
 * =================================
 * When many requests arrive for a key that just expired, every one misses and
 * hits the DB at once. Two fixes:
 *
 *   1. Redis lock (mutex): the first requester acquires a SET NX lock, fetches
 *      from DB, populates cache, releases. Others wait, then read the warm cache.
 *      Result: exactly ONE DB query per stampede.
 *   2. Probabilistic early expiry (XFetch): each reader occasionally refreshes
 *      slightly early with a probability that rises near expiry — no locking,
 *      no synchronized burst. Best under sustained sequential traffic.
 *
 * Node is single-threaded, so we simulate concurrency with Promise.all over
 * async requests whose "DB query" awaits a latency sleep, letting them interleave.
 *
 * Run:  docker compose up -d (Redis)  →  npx tsx 05_stampede.ts
 */

import { fileURLToPath } from "node:url";

import * as cache from "./cache.js";
import * as db from "./db.js";
import type { Product } from "./db.js";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const DB_LATENCY = 50; // ms — simulated query time

let dbHits = 0;
const recordDbHit = () => {
  dbHits += 1;
};

// ── Naive cache-aside, no protection ────────────────────────────────────────

async function getProductNaive(productId: number): Promise<Product | null> {
  const key = cache.productKey(productId);
  const raw = await cache.client.get(key);
  if (raw !== null) return cache.deserialise(raw);

  await sleep(DB_LATENCY);
  recordDbHit();
  const product = db.getProduct(productId);
  if (product === null) return null;
  const serialised = cache.serialise(product);
  await cache.client.set(key, serialised, "EX", cache.PRODUCT_TTL);
  return cache.deserialise(serialised);
}

// ── Solution 1: Redis lock (mutex) ──────────────────────────────────────────

async function getProductWithLock(productId: number): Promise<Product | null> {
  const key = cache.productKey(productId);
  const lock = cache.lockKey(productId);

  for (;;) {
    const raw = await cache.client.get(key);
    if (raw !== null) return cache.deserialise(raw);

    const acquired = await cache.setNx(lock, "1", cache.LOCK_TTL);
    if (acquired) {
      try {
        const again = await cache.client.get(key); // double-check
        if (again !== null) return cache.deserialise(again);

        await sleep(DB_LATENCY);
        recordDbHit();
        const product = db.getProduct(productId);
        if (product === null) return null;
        const serialised = cache.serialise(product);
        await cache.client.set(key, serialised, "EX", cache.PRODUCT_TTL);
        return cache.deserialise(serialised);
      } finally {
        await cache.client.del(lock);
      }
    }
    await sleep(10); // lock held by another request — wait and retry
  }
}

// Both getProduct variants have this shape, so naming it lets runConcurrent
// take either one and still check the call.
type ProductLoader = (productId: number) => Promise<Product | null>;

async function runConcurrent(
  fn: ProductLoader,
  productId: number,
  n: number,
  label: string
): Promise<number> {
  dbHits = 0;
  const start = Date.now();
  await Promise.all(Array.from({ length: n }, () => fn(productId)));
  console.log(`  ${label.padEnd(40)}  DB hits: ${String(dbHits).padStart(2)}  (${Date.now() - start}ms)`);
  return dbHits;
}

async function main(): Promise<void> {
  db.resetSchema();
  await cache.client.flushdb();
  const [keyboard] = db.seed();
  const N = 20;

  console.log(`\n=== Cold-cache stampede: ${N} concurrent requests, no cached value ===\n`);
  await cache.client.flushdb();
  const naive = await runConcurrent(getProductNaive, keyboard.id, N, "Naive (no protection)");
  await cache.client.flushdb();
  const locked = await runConcurrent(getProductWithLock, keyboard.id, N, "Redis lock");

  console.log(`
  Cold-start summary:
    Naive:      ${naive} DB hits — every request misses and queries the DB
    Redis lock: ${locked} DB hit  — one request fetches, the rest read the warm cache`);

  console.log(`\n=== Expiry-time stampede: ${N} concurrent requests just as TTL expires ===\n`);
  const serialised = cache.serialise(keyboard);

  await cache.client.flushdb();
  await cache.client.set(cache.productKey(keyboard.id), serialised, "EX", 1);
  await sleep(1100); // let it expire
  const naiveExpiry = await runConcurrent(getProductNaive, keyboard.id, N, "Naive at expiry");

  await cache.client.flushdb();
  await cache.client.set(cache.productKey(keyboard.id), serialised, "EX", 1);
  await sleep(1100);
  const lockExpiry = await runConcurrent(getProductWithLock, keyboard.id, N, "Redis lock at expiry");

  console.log(`
  Expiry-time summary:
    Naive at expiry:      ${naiveExpiry} DB hits — same stampede as cold start
    Redis lock at expiry: ${lockExpiry} DB hit  — the lock serialises access

  Probabilistic early expiry (XFetch) instead refreshes a hot key slightly before
  its TTL fires, so under sustained traffic there's no synchronized burst at all —
  and no lock contention, which matters at millions of requests per second.`);

  await cache.client.quit();
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { getProductNaive, getProductWithLock };
