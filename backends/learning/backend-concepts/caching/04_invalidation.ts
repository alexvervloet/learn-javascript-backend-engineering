/**
 * Cache Invalidation Strategies
 * ===============================
 * "There are only two hard things in Computer Science: cache invalidation and
 * naming things." Three strategies for keeping cache consistent with the DB:
 *
 *   1. TTL-based     — let a short TTL expire entries. Simple; tolerates a
 *                      window of staleness.
 *   2. Event-driven  — DELETE the cache key at the point of the DB write. Zero
 *                      staleness, but every write path must know the cache.
 *   3. Versioned keys— embed a version in the key; bump it to invalidate a whole
 *                      category at once. Old keys decay via TTL.
 *
 * Run:  docker compose up -d (Redis)  →  npx tsx 04_invalidation.ts
 */

import { fileURLToPath } from "node:url";

import * as cache from "./cache.js";
import * as db from "./db.js";
import type { Product } from "./db.js";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// ── Strategy 1: TTL-based ───────────────────────────────────────────────────

async function demoTtlBased() {
  console.log("\n=== Strategy 1: TTL-based invalidation ===");
  console.log("  Set a short TTL; stale data lasts at most TTL seconds. No write-time code.");

  db.resetSchema();
  await cache.client.flushdb();
  const [keyboard] = db.seed();

  const shortTtl = 4;
  const key = cache.productKey(keyboard.id);
  await cache.client.set(key, cache.serialise(keyboard), "EX", shortTtl);
  console.log(`  Cached ${JSON.stringify(key)} with TTL=${shortTtl}s`);

  db.db.prepare("UPDATE products SET price = ? WHERE id = ?").run("999.99", keyboard.id);
  console.log("  DB updated (price → 999.99) — cache still has old price");
  // client.get returns string | null, so the value is read out first rather
  // than passed straight into deserialise.
  const stale = await cache.client.get(key);
  console.log(`  Cache price: ${stale === null ? "MISS" : cache.deserialise(stale).price}  (stale!)`);

  console.log(`  Waiting ${shortTtl}s for TTL expiry...`);
  await sleep((shortTtl + 1) * 1000);
  console.log(`  After TTL expiry: ${await cache.client.get(key)}  (MISS — next read refreshes)`);
}

// ── Strategy 2: Event-driven ────────────────────────────────────────────────

async function demoEventDriven() {
  console.log("\n\n=== Strategy 2: Event-driven invalidation ===");
  console.log("  Delete the cache key at the DB write. No staleness; every writer must do it.");

  db.resetSchema();
  await cache.client.flushdb();
  const hub = db.seed()[1];

  const key = cache.productKey(hub.id);
  await cache.client.set(key, cache.serialise(hub), "EX", 60);
  console.log(`  Cached ${JSON.stringify(key)}`);

  // A write path that correctly invalidates the cache.
  db.db.prepare("UPDATE products SET price = ? WHERE id = ?").run("39.99", hub.id);
  await cache.client.del(key);
  console.log(`  DB updated + cache DEL ${JSON.stringify(key)}`);
  console.log(`  Cache after write: ${await cache.client.get(key)}  (MISS — immediately consistent)`);
  console.log("  Failure mode: a writer that forgets the DEL serves stale data until TTL.");
}

// ── Strategy 3: Versioned keys ──────────────────────────────────────────────

const versions = new Map<string, number>(); // in production: a Redis INCR counter

const getVersion = (ns: string): number => versions.get(ns) ?? 1;
const bumpVersion = (ns: string): number => {
  const next = getVersion(ns) + 1;
  versions.set(ns, next);
  return next;
};
const versionedKey = (ns: string, id: number): string => `${ns}:v${getVersion(ns)}:${id}`;

async function demoVersionedKeys() {
  console.log("\n\n=== Strategy 3: Versioned keys ===");
  console.log("  Embed a version in the key; bump it to invalidate a whole category at once.");

  db.resetSchema();
  await cache.client.flushdb();
  db.seed();

  for (const p of db.allProducts()) {
    const key = versionedKey("product", p.id);
    // eslint-disable-next-line no-await-in-loop
    await cache.client.set(key, cache.serialise(p), "EX", 60);
    console.log(`  Cached ${JSON.stringify(key)}`);
  }
  console.log(`\n  Current version: ${getVersion("product")}`);

  console.log("\n  Running bulk price update (20% discount)...");
  const update = db.db.prepare("UPDATE products SET price = ? WHERE id = ?");
  for (const p of db.allProducts()) update.run((Number(p.price) * 0.8).toFixed(2), p.id);

  const newV = bumpVersion("product");
  console.log(`  Version bumped to ${newV} — old keys (v${newV - 1}:*) are unreachable, decay via TTL`);

  for (const p of db.allProducts()) {
    const key = versionedKey("product", p.id);
    // eslint-disable-next-line no-await-in-loop
    const raw = await cache.client.get(key);
    if (raw === null) {
      console.log(`  MISS ${JSON.stringify(key)}  → DB fallback → re-cached`);
      // eslint-disable-next-line no-await-in-loop
      await cache.client.set(key, cache.serialise(p), "EX", 60);
    } else {
      console.log(`  HIT  ${JSON.stringify(key)}`);
    }
  }
}

async function main(): Promise<void> {
  await demoTtlBased();
  await demoEventDriven();
  await demoVersionedKeys();

  console.log("\n=== Summary ===");
  console.log(`
  Strategy        Consistency   Best for
  TTL-based       Eventually    data where brief staleness is OK
  Event-driven    Immediate     critical data, single write path
  Versioned keys  Immediate     bulk invalidation of related keys`);

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

export { demoTtlBased, demoEventDriven, demoVersionedKeys };
