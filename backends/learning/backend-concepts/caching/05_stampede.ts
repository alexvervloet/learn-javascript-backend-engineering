/**
 * Cache Stampede (Thundering Herd)
 * =================================
 * When many requests arrive for a key that just expired, every one misses and
 * hits the DB at once. Two fixes:
 *
 *   1. Redis lock (mutex): the first requester acquires a SET NX lock, fetches
 *      from DB, populates cache, releases. Others wait, then read the warm cache.
 *      Result: exactly ONE DB query per stampede.
 *   2. Probabilistic early expiry (XFetch): each reader decides on its own whether
 *      to refresh slightly early, with a probability that climbs as the entry
 *      nears expiry. No lock, no waiting, and no moment where every reader misses
 *      at once — the herd is spread out in time instead of serialised.
 *
 * The XFetch test is  now - delta * BETA * ln(random()) >= expiry,  where delta is
 * how long the last recompute took. ln(random()) is negative, so the left side is
 * always ahead of `now`; a slow recompute (large delta) looks further ahead and so
 * refreshes earlier, which is the point — expensive entries get more warning.
 *
 * Node is single-threaded, so we simulate concurrency with Promise.all over
 * async requests whose "DB query" awaits a latency sleep, letting them interleave.
 *
 * Run:  docker compose up -d (Redis)  →  npx tsx 05_stampede.ts
 */

import crypto from "node:crypto";
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

// Same thing with a settable TTL, so the sustained-traffic timeline at the end
// can compare naive and XFetch on equal terms.
async function getProductNaiveTtl(productId: number, ttlSeconds: number): Promise<Product | null> {
  const key = cache.productKey(productId);
  const raw = await cache.client.get(key);
  if (raw !== null) return cache.deserialise(raw);

  await sleep(DB_LATENCY);
  recordDbHit();
  const product = db.getProduct(productId);
  if (product === null) return null;
  const serialised = cache.serialise(product);
  await cache.client.set(key, serialised, "EX", ttlSeconds);
  return cache.deserialise(serialised);
}

// ── Solution 1: Redis lock (mutex) ──────────────────────────────────────────

// Waiters give up eventually rather than spinning forever: if the lock holder
// dies the lock expires after LOCK_TTL, but an unbounded retry loop turns any
// unexpected state into a hung request instead of a visible error.
const MAX_WAIT_MS = (cache.LOCK_TTL + 1) * 1000;
const RETRY_MS = 10;

async function getProductWithLock(productId: number): Promise<Product | null> {
  const key = cache.productKey(productId);
  const lock = cache.lockKey(productId);
  // A value only this caller knows, so releasing can check we still hold the lock.
  const token = crypto.randomUUID();
  const deadline = Date.now() + MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const raw = await cache.client.get(key);
    if (raw !== null) return cache.deserialise(raw);

    const acquired = await cache.setNx(lock, token, cache.LOCK_TTL);
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
        // Not client.del(lock): see releaseLock in cache.ts for why the token
        // has to be compared server-side before deleting.
        await cache.releaseLock(lock, token);
      }
    }
    await sleep(RETRY_MS); // lock held by another request — wait and retry
  }
  throw new Error(`Timed out waiting for the cache lock on product ${productId}`);
}

// ── Solution 2: probabilistic early expiry (XFetch) ─────────────────────────

// Stored alongside the value: when it expires, and how long the last recompute
// took. Both are what the XFetch test reads.
interface XFetchEntry {
  product: Product;
  deltaMs: number;
  expiresAtMs: number;
}

// Higher BETA = refresh earlier and more often. 1.0 is the usual production
// default. This demo runs at 5 because delta here is a 50ms fake query, and at
// BETA 1 the early-refresh window would be a couple of hundred milliseconds —
// real, but too narrow to see on the timeline below. A service whose recompute
// takes seconds gets that width for free at BETA 1.
const BETA = 5.0;

// True when this reader should refresh before the entry has actually expired.
// ln(random()) is negative, so `now - deltaMs * BETA * ln(...)` always looks
// ahead of now; the closer to expiry, the likelier that lands past it.
function shouldRefreshEarly(entry: XFetchEntry, now: number): boolean {
  return now - entry.deltaMs * BETA * Math.log(Math.random()) >= entry.expiresAtMs;
}

async function getProductXFetch(
  productId: number,
  ttlSeconds: number = cache.PRODUCT_TTL
): Promise<Product | null> {
  const key = `xfetch:${cache.productKey(productId)}`;
  const raw = await cache.client.get(key);

  if (raw !== null) {
    const entry = JSON.parse(raw) as XFetchEntry;
    if (!shouldRefreshEarly(entry, Date.now())) return entry.product;
    // Fall through and recompute early — no lock, no waiting.
  }

  const startedAt = Date.now();
  await sleep(DB_LATENCY);
  recordDbHit();
  const product = db.getProduct(productId);
  if (product === null) return null;

  const deltaMs = Date.now() - startedAt;
  const entry: XFetchEntry = {
    product,
    deltaMs,
    expiresAtMs: Date.now() + ttlSeconds * 1000,
  };
  // The Redis TTL is the real backstop; XFetch only ever refreshes before it.
  await cache.client.set(key, JSON.stringify(entry), "EX", ttlSeconds);
  return product;
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
    Redis lock at expiry: ${lockExpiry} DB hit  — the lock serialises access`);

  // XFetch is about sustained traffic, so poll steadily across two TTLs and
  // print when each approach went to the database. Naive has a cliff exactly at
  // expiry; XFetch refreshes somewhere before it, and never serves a miss.
  const TTL = 4; // seconds — short so the timeline fits on screen
  const STEP = 200; // ms between requests
  const STEPS = 45; // ~9s, a little over two TTLs

  async function timeline(
    label: string,
    load: (id: number) => Promise<Product | null>
  ): Promise<string> {
    await cache.client.flushdb();
    dbHits = 0;
    let marks = "";
    let last = 0;
    for (let i = 0; i < STEPS; i += 1) {
      await load(keyboard.id);
      marks += dbHits > last ? "D" : ".";
      last = dbHits;
      await sleep(STEP);
    }
    console.log(`  ${label.padEnd(12)} ${marks}   ${dbHits} DB hits`);
    return marks;
  }

  console.log(`\n=== Sustained traffic: 1 request every ${STEP}ms for ${(STEPS * STEP) / 1000}s, TTL ${TTL}s ===`);
  console.log("      (D = went to the database, . = served from cache)\n");
  await timeline("Naive", (id) => getProductNaiveTtl(id, TTL));
  await timeline("Naive", (id) => getProductNaiveTtl(id, TTL));
  await timeline("XFetch", (id) => getProductXFetch(id, TTL));
  await timeline("XFetch", (id) => getProductXFetch(id, TTL));
  await timeline("XFetch", (id) => getProductXFetch(id, TTL));

  console.log(`
  Read the two Naive rows against the three XFetch rows. Naive's D is in the same
  column every run, because the TTL fires at a fixed time — and under real load
  that column is where every concurrent request misses at once. XFetch's D moves,
  and lands before the expiry rather than on it. That jitter is the whole
  mechanism: there is no single instant when the cache is cold for everybody.

  The lock and XFetch both avoid the stampede, and they pay for it differently.
  The lock guarantees exactly one DB query, at the cost of every other request
  blocking until the holder finishes — a latency spike for N-1 callers, and one
  more thing that can deadlock or leak. XFetch never blocks anyone and never
  serves a cold miss, but it accepts a small amount of redundant work: the count
  above is random, and occasionally more than one.

  Rule of thumb: lock when the recompute is expensive enough that doing it twice
  really hurts; XFetch when latency matters more and a duplicate query is cheap.
  XFetch also needs sustained traffic — an entry nobody reads is never refreshed
  early, so it still expires and the next reader takes a cold miss.`);

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

export { getProductNaive, getProductWithLock, getProductXFetch };
