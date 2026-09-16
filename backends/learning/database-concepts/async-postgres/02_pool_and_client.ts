/**
 * Pool vs Client, and the Release Trap
 * =====================================
 * The key lifecycle lesson in node-postgres is pool.query vs pool.connect — and
 * remembering to release a connection you check out.
 *
 *   pool.query(...)   grabs a connection, runs ONE statement, releases it
 *                     automatically. Each call may use a different connection,
 *                     so it can't span a transaction.
 *   pool.connect()    checks out a dedicated client you keep across several
 *                     statements (BEGIN…COMMIT). You MUST client.release() it,
 *                     or that connection leaks and the pool eventually exhausts.
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 02_pool_and_client.ts
 */

import * as db from "./db.js";

async function main() {
  await db.resetSchema();
  const [keyboard] = await db.seed();

  console.log("\n=== 1. pool.query — autocommit, one statement at a time ===");
  console.log("  Each call borrows + returns a connection; fine for independent statements.");
  await db.pool.query("UPDATE products SET stock = stock - 1 WHERE id = $1", [keyboard.id]);
  console.log(`  stock now: ${(await db.pool.query("SELECT stock FROM products WHERE id = $1", [keyboard.id])).rows[0].stock}`);

  console.log("\n=== 2. pool.connect — a dedicated client for a transaction ===");
  console.log("  A multi-statement transaction needs ONE client across all statements.");
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE products SET price = price * 1.1 WHERE id = $1", [keyboard.id]);
    await client.query("UPDATE products SET stock = stock + 5 WHERE id = $1", [keyboard.id]);
    await client.query("COMMIT");
    console.log("  transaction committed");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release(); // ALWAYS release — even on error
  }

  console.log("\n=== 3. The release trap — forgetting to release leaks a connection ===");
  console.log(`
  const client = await pool.connect();
  await client.query(...);
  // ...no client.release()  ← connection never returns to the pool
  After max such leaks, pool.connect() hangs forever (or times out). The
  try/finally above is the standard guard — release() in finally, no exceptions.`);

  db.printPoolStatus(db.pool, "Pool after the transaction");
  await db.pool.end();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
