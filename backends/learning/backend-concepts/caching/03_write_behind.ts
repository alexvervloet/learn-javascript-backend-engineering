/**
 * Write-Behind (Write-Back)
 * ==========================
 * Writes go to the cache immediately and return; a separate flush step drains a
 * pending queue to the DB in batches.
 *
 *   WRITE → write cache → push job onto pending queue → return (don't wait for DB)
 *   FLUSH → read queue → batch-write DB → clear queue
 *
 * Pro: extremely low write latency; bursts are absorbed by the queue; repeated
 * updates to one key collapse into a single DB write. Con: a Redis crash before
 * flush loses pending writes. Use for view counts / "last seen" metrics — never
 * for orders or financial records.
 *
 * Run:  docker compose up -d (Redis)  →  npx tsx 03_write_behind.ts
 */

import { fileURLToPath } from "node:url";

import * as cache from "./cache.js";
import * as db from "./db.js";
import type { Product } from "./db.js";

const PENDING_KEY = cache.pendingWritesKey();

async function updateStock(productId: number, newStock: number): Promise<void> {
  const key = cache.productKey(productId);
  const raw = await cache.client.get(key);
  if (raw) {
    const data = cache.deserialise(raw);
    data.stock = newStock;
    await cache.client.set(key, JSON.stringify(data), "EX", cache.PRODUCT_TTL);
    console.log(`    CACHE SET  ${JSON.stringify(key)}  stock → ${newStock}`);
  } else {
    console.log(`    CACHE COLD ${JSON.stringify(key)}  (queuing write anyway)`);
  }

  await cache.client.rpush(PENDING_KEY, JSON.stringify({ productId, stock: newStock }));
  console.log(`    QUEUE PUSH pending:writes  (${await cache.client.llen(PENDING_KEY)} items in queue)`);
}

async function flushPendingWrites() {
  const length = await cache.client.llen(PENDING_KEY);
  if (length === 0) {
    console.log("    FLUSH      nothing to flush");
    return 0;
  }

  const rawJobs = await cache.client.lrange(PENDING_KEY, 0, -1);
  await cache.client.ltrim(PENDING_KEY, length, -1); // drop the items we just read

  // Coalesce: the last update per productId wins.
  const coalesced = new Map();
  for (const raw of rawJobs) {
    const job = JSON.parse(raw);
    coalesced.set(job.productId, job);
  }
  console.log(`    FLUSH      ${length} queued writes → ${coalesced.size} unique products`);

  const update = db.db.prepare("UPDATE products SET stock = ? WHERE id = ?");
  const tx = db.db.transaction((jobs) => {
    for (const job of jobs) {
      const product = db.getProduct(job.productId);
      if (product) {
        update.run(job.stock, job.productId);
        console.log(`    DB UPDATE  product ${job.productId}: stock ${product.stock} → ${job.stock}`);
      }
    }
  });
  tx([...coalesced.values()]);
  console.log("    FLUSH      committed");
  return coalesced.size;
}

async function main(): Promise<void> {
  db.resetSchema();
  await cache.client.flushdb();
  const products = db.seed();
  const hub = products[1]; // USB-C Hub, stock=130
  await cache.client.set(cache.productKey(hub.id), cache.serialise(hub), "EX", cache.PRODUCT_TTL);

  console.log("\n=== 1. Burst of stock updates — fast, no DB writes yet ===");
  for (const newStock of [129, 128, 127, 126, 125]) {
    // eslint-disable-next-line no-await-in-loop
    await updateStock(hub.id, newStock);
  }

  console.log("\n  DB right now (before flush):");
  // getProduct is nullable because a cache demo has to model a miss. hub was
  // seeded above, so ?. is enough to satisfy that without a check here.
  console.log(`    DB stock = ${db.getProduct(hub.id)?.stock}  (still 130 — writes are queued)`);
  const cached = await cache.client.get(cache.productKey(hub.id));
  if (cached) console.log(`    Cache stock = ${cache.deserialise(cached).stock}  (already updated to 125)`);

  console.log("\n=== 2. Flush pending writes to DB ===");
  await flushPendingWrites();

  console.log("\n=== 3. Verify DB now matches cache ===");
  console.log(`\n    DB stock    = ${db.getProduct(hub.id)?.stock}  (expected 125)`);

  console.log("\n=== 4. The risk: crash before flush ===");
  console.log(`
  If Redis crashes after step 1 but before step 2, the cache is gone, the DB
  still has the old value, and the queued writes are lost. That's the
  fundamental trade-off of write-behind — fine for metrics, not for orders.`);

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

export { updateStock, flushPendingWrites };
