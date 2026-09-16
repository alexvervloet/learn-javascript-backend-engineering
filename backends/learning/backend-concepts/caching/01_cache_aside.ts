/**
 * Cache-Aside (Lazy Loading)
 * ===========================
 * The most common pattern. The app manages the cache manually: read cache first,
 * fall back to the DB on a miss, write back to the cache.
 *
 *   READ:  cache HIT  → return cached value
 *          cache MISS → query DB → store in cache → return
 *   WRITE: write to DB → DELETE the cached entry (invalidate, don't update)
 *
 * Why delete rather than update on write? Updating risks a split-brain if the
 * write half-fails. Deleting means the next read just takes a fresh miss —
 * simpler and safer. Trade-off: the first read after a write pays one DB hit.
 *
 * Run:  docker compose up -d (Redis)  →  npx tsx 01_cache_aside.ts
 */

import { fileURLToPath } from "node:url";

import * as cache from "./cache.js";
import * as db from "./db.js";
import type { Product } from "./db.js";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function getProduct(productId: number): Promise<Product | null> {
  const key = cache.productKey(productId);
  const raw = await cache.client.get(key);

  if (raw !== null) {
    console.log(`    CACHE HIT  ${JSON.stringify(key)}  (TTL=${await cache.client.ttl(key)}s remaining)`);
    return cache.deserialise(raw);
  }

  console.log(`    CACHE MISS ${JSON.stringify(key)}  → querying database...`);
  const product = db.getProduct(productId);
  if (product === null) return null;

  const serialised = cache.serialise(product);
  await cache.client.set(key, serialised, "EX", cache.PRODUCT_TTL);
  console.log(`    CACHE SET  ${JSON.stringify(key)}  TTL=${cache.PRODUCT_TTL}s`);
  return cache.deserialise(serialised);
}

async function updatePrice(productId: number, newPrice: string): Promise<void> {
  const product = db.getProduct(productId);
  if (product === null) throw new Error(`Product ${productId} not found`);

  db.db.prepare("UPDATE products SET price = ? WHERE id = ?").run(newPrice, productId);
  console.log(`    DB WRITE   product ${productId}: price ${product.price} → ${newPrice}`);

  // Invalidate rather than update — see the module docstring for why.
  const key = cache.productKey(productId);
  await cache.client.del(key);
  console.log(`    CACHE DEL  ${JSON.stringify(key)}  (invalidated)`);
}

async function main(): Promise<void> {
  db.resetSchema();
  await cache.client.flushdb();
  const [keyboard] = db.seed();

  console.log("\n=== 1. First access — cold cache ===");
  await getProduct(keyboard.id);

  console.log("\n=== 2. Second access — warm cache (no DB query) ===");
  console.log(`    Returned: ${JSON.stringify(await getProduct(keyboard.id))}`);

  console.log("\n=== 3. Third access — still warm ===");
  await getProduct(keyboard.id);
  await cache.printCacheState("After three reads", cache.productKey(keyboard.id));

  console.log("\n=== 4. Price update — cache invalidated ===");
  await updatePrice(keyboard.id, "89.99");
  await cache.printCacheState("After update", cache.productKey(keyboard.id));

  console.log("\n=== 5. Next read after invalidation — cold again ===");
  console.log(`    Returned: ${JSON.stringify(await getProduct(keyboard.id))}`);

  console.log(`\n=== 6. TTL expiry — wait ${cache.PRODUCT_TTL}s ===`);
  await sleep((cache.PRODUCT_TTL + 1) * 1000);
  await cache.printCacheState("After TTL expiry", cache.productKey(keyboard.id));

  console.log("\n=== 7. Access after TTL expiry — cold again ===");
  await getProduct(keyboard.id);

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

export { getProduct, updatePrice };
