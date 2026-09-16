/**
 * Write-Through
 * ==============
 * Every write goes to BOTH the database and the cache in the same operation, so
 * the cache is never stale right after a write and reads never pay a cold start.
 *
 *   WRITE → write DB → write cache (same data, same moment)
 *   READ  → cache hit (populated on the last write); DB fallback only if cold
 *
 * vs cache-aside: cache-aside fills the cache lazily on the first read miss;
 * write-through fills it eagerly on every write. Cost: every write also writes
 * Redis, and the two writes aren't atomic (mitigated by short TTLs / retries).
 *
 * Run:  docker compose up -d (Redis)  →  npx tsx 02_write_through.ts
 */

import { fileURLToPath } from "node:url";

import * as cache from "./cache.js";
import * as db from "./db.js";
import type { Product } from "./db.js";

// The fields a caller may change. Partial<Product> minus the id, so a typo in a
// column name is a compile error instead of malformed SQL at runtime.
type ProductFields = Partial<Omit<Product, "id">>;

async function createProduct(
  name: string,
  price: string,
  stock: number
): Promise<Product> {
  const info = db.db
    .prepare("INSERT INTO products (name, price, stock) VALUES (?, ?, ?)")
    .run(name, price, stock);
  const product = db.getProduct(Number(info.lastInsertRowid));
  // Inserted on this connection a line ago, so a miss is impossible.
  if (product === null) throw new Error("Inserted product could not be read back");
  console.log(`    DB INSERT   product ${product.id}: ${JSON.stringify(product.name)}`);

  const key = cache.productKey(product.id);
  await cache.client.set(key, cache.serialise(product), "EX", cache.PRODUCT_TTL);
  console.log(`    CACHE SET   ${JSON.stringify(key)}  TTL=${cache.PRODUCT_TTL}s`);
  return product;
}

async function updateProduct(
  productId: number,
  fields: ProductFields
): Promise<Product> {
  const product = db.getProduct(productId);
  if (product === null) throw new Error(`Product ${productId} not found`);

  const cols = Object.keys(fields) as (keyof ProductFields)[];
  const sql = `UPDATE products SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`;
  db.db.prepare(sql).run(...cols.map((c) => fields[c] ?? null), productId);
  const updated = db.getProduct(productId);
  if (updated === null) throw new Error(`Product ${productId} vanished mid-update`);
  console.log(`    DB UPDATE   product ${productId}: ${JSON.stringify(fields)}`);

  // Pipeline: queue SET + EXPIRE together, sent in one round-trip.
  const key = cache.productKey(productId);
  await cache.client.pipeline().set(key, cache.serialise(updated)).expire(key, cache.PRODUCT_TTL).exec();
  console.log(`    CACHE SET   ${JSON.stringify(key)}  (pipeline, TTL=${cache.PRODUCT_TTL}s)`);
  return updated;
}

async function getProduct(productId: number): Promise<Product | null> {
  const key = cache.productKey(productId);
  const raw = await cache.client.get(key);
  if (raw !== null) {
    console.log(`    CACHE HIT   ${JSON.stringify(key)}`);
    return cache.deserialise(raw);
  }
  console.log(`    CACHE MISS  ${JSON.stringify(key)}  → DB fallback`);
  const product = db.getProduct(productId);
  if (product) await cache.client.set(key, cache.serialise(product), "EX", cache.PRODUCT_TTL);
  return product ? cache.deserialise(cache.serialise(product)) : null;
}

async function main(): Promise<void> {
  db.resetSchema();
  await cache.client.flushdb();

  console.log("\n=== 1. Create product — DB + cache written together ===");
  const keyboard = await createProduct("Mechanical Keyboard", "99.99", 50);

  console.log("\n=== 2. Read immediately — cache is already warm ===");
  console.log(`    Returned:  ${JSON.stringify(await getProduct(keyboard.id))}`);

  console.log("\n=== 3. Update price — cache updated in the same operation ===");
  await updateProduct(keyboard.id, { price: "89.99" });

  console.log("\n=== 4. Read after update — still a hit, fresh value ===");
  console.log(`    Returned:  ${JSON.stringify(await getProduct(keyboard.id))}`);
  await cache.printCacheState("Cache after update", cache.productKey(keyboard.id));

  console.log("\n=== 5. Two fields updated in one call ===");
  await updateProduct(keyboard.id, { price: "79.99", stock: 45 });
  console.log(`    Returned:  ${JSON.stringify(await getProduct(keyboard.id))}`);

  console.log("\n=== 6. Cache-aside fallback (simulate cold start) ===");
  await cache.client.del(cache.productKey(keyboard.id));
  console.log(`    Manually deleted ${JSON.stringify(cache.productKey(keyboard.id))}`);
  console.log(`    Returned:  ${JSON.stringify(await getProduct(keyboard.id))}`);

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

export { createProduct, updateProduct, getProduct };
