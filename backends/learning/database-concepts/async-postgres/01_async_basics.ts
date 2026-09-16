/**
 * Async Postgres Basics (node-postgres)
 * ======================================
 * In Node there's no sync/async driver split — `pg` is async. A `Pool` is the
 * standard handle; `pool.query(sql, params)` runs a parameterised query and
 * resolves to `{ rows, rowCount }`.
 *
 *   pool.query("SELECT ... WHERE id = $1", [id])   parameterised ($1, $2, …)
 *   INSERT ... RETURNING *                          get the new row back in one call
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 01_async_basics.ts
 */

import * as db from "./db.js";

async function main() {
  await db.resetSchema();

  console.log("\n=== 1. INSERT (RETURNING gives the new row) ===");
  const products = await db.seed();
  for (const p of products) console.log(`    Inserted: ${p.name} ($${p.price}, stock ${p.stock})`);
  const keyboard = products[0];
  const hub = products[1];

  console.log("\n=== 2. SELECT by primary key ===");
  const byId = (await db.pool.query("SELECT * FROM products WHERE id = $1", [keyboard.id])).rows[0];
  console.log(`    ${byId.name} — $${byId.price}`);

  console.log("\n=== 3. SELECT with a WHERE clause ===");
  const cheap = (await db.pool.query("SELECT * FROM products WHERE price < $1 ORDER BY price", ["80"])).rows;
  console.log("    Products under $80:");
  for (const p of cheap) console.log(`      ${p.name} — $${p.price}`);

  console.log("\n=== 4. UPDATE (RETURNING the updated row) ===");
  const updated = (await db.pool.query("UPDATE products SET price = $1 WHERE id = $2 RETURNING *", ["89.99", keyboard.id])).rows[0];
  console.log(`    ${updated.name}: now $${updated.price}`);

  console.log("\n=== 5. DELETE ===");
  await db.pool.query("DELETE FROM products WHERE id = $1", [hub.id]);
  const remaining = (await db.pool.query("SELECT * FROM products ORDER BY id")).rows;
  console.log(`    Remaining: ${remaining.length} products`);
  for (const p of remaining) console.log(`      ${p.name}`);

  await db.pool.end();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
