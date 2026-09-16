/**
 * Concurrent Queries — The Payoff
 * ================================
 * The point of async: run independent queries in parallel.
 *
 *   sequential: await a(); await b();          → timeA + timeB
 *   concurrent: await Promise.all([a(), b()]); → max(timeA, timeB)
 *
 * Promise.all runs the coroutines concurrently; each uses its own pooled
 * connection so they don't block each other. It pays off when one request makes
 * several independent I/O calls — the profile of a REST API.
 *
 * It does NOT help dependent queries, CPU-bound work, or already-instant queries.
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 05_concurrent_queries.ts
 */

import * as db from "./db.js";

const LATENCY_S = 0.05; // 50ms simulated slow query via pg_sleep

import type { Product } from "./db.js";

async function fetchProduct(id: number): Promise<{ id: number; name: string } | null> {
  // pg_sleep makes real DB latency so the timing numbers are meaningful.
  await db.pool.query(`SELECT pg_sleep(${LATENCY_S})`);
  const p = (await db.pool.query<Product>("SELECT * FROM products WHERE id = $1", [id]))
    .rows[0];
  if (!p) return null;
  return { id: p.id, name: p.name };
}

async function main(): Promise<void> {
  await db.resetSchema();
  const products = await db.seed();
  const ids = [...products, ...products, ...products].map((p) => p.id); // 9 queries

  console.log(`\n=== 1. Sequential — ${ids.length} queries, one at a time ===`);
  let start = Date.now();
  const seq = [];
  for (const id of ids) seq.push(await fetchProduct(id)); // eslint-disable-line no-await-in-loop
  const seqMs = Date.now() - start;
  console.log(`  Time: ${(seqMs / 1000).toFixed(2)}s  (expected ~${(ids.length * LATENCY_S).toFixed(2)}s)`);

  console.log(`\n=== 2. Concurrent — ${ids.length} queries via Promise.all ===`);
  start = Date.now();
  await Promise.all(ids.map(fetchProduct));
  const conMs = Date.now() - start;
  console.log(`  Time: ${(conMs / 1000).toFixed(2)}s  (expected ~${LATENCY_S.toFixed(2)}s, limited by the pool size)`);

  console.log(`\n  Speedup: ${(seqMs / conMs).toFixed(1)}x`);

  console.log("\n=== 3. Detail-page pattern — independent fetches in parallel ===");
  start = Date.now();
  const [product, stock, price] = await Promise.all([
    db.pool.query("SELECT pg_sleep(0.04)").then(() => "product details loaded"),
    db.pool.query("SELECT pg_sleep(0.06)").then(() => "stock levels loaded"),
    db.pool.query("SELECT pg_sleep(0.05)").then(() => "price history loaded"),
  ]);
  console.log(`  ${product}\n  ${stock}\n  ${price}`);
  console.log(`  Total: ${((Date.now() - start) / 1000).toFixed(2)}s  (≈0.06s — the slowest call, not the sum)`);

  await db.pool.end();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
