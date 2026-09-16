/**
 * Row-Level Locking
 * =================
 * Postgres auto-locks rows during UPDATE/DELETE. Sometimes you must lock rows you
 * intend to update but haven't yet — to close the read-then-write race (TOCTOU).
 *
 *   SELECT ... FOR UPDATE              lock the rows now; others block until commit
 *   SELECT ... FOR UPDATE SKIP LOCKED  skip already-locked rows instead of blocking
 *                                      (the standard pattern for Postgres job queues)
 *
 * TOCTOU = Time-Of-Check to Time-Of-Use: the gap between reading and acting.
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 04_locking.ts
 */

import * as db from "./db.js";

async function demoToctou() {
  console.log("=".repeat(60));
  console.log("TOCTOU PROBLEM — the race between read and write");
  console.log("=".repeat(60));
  await db.resetInventory();
  console.log("Two customers both try to buy the last Widget (stock = 1).\n");

  const a = await db.getClient();
  const b = await db.getClient();
  try {
    await a.query("BEGIN");
    await b.query("BEGIN");
    const stockA = (await a.query("SELECT stock FROM inventory WHERE product = 'Widget'")).rows[0].stock;
    console.log(`  Customer A reads stock = ${stockA}  → decides to purchase`);
    const stockB = (await b.query("SELECT stock FROM inventory WHERE product = 'Widget'")).rows[0].stock;
    console.log(`  Customer B reads stock = ${stockB}  → also decides to purchase`);
    console.log("\n  Both saw 1 and will decrement — an oversell without locking.\n");
    await a.query("ROLLBACK");
    await b.query("ROLLBACK");
  } finally {
    await a.end();
    await b.end();
  }
}

async function demoSelectForUpdate() {
  console.log("=".repeat(60));
  console.log("SELECT FOR UPDATE — lock the row at read time");
  console.log("=".repeat(60));
  await db.resetInventory();

  const a = await db.getClient();
  const b = await db.getClient();
  try {
    await a.query("BEGIN");
    const stockA = (await a.query("SELECT stock FROM inventory WHERE product = 'Widget' FOR UPDATE")).rows[0].stock;
    console.log(`  Customer A reads stock = ${stockA}  (row is now locked)`);
    await a.query("UPDATE inventory SET stock = stock - 1 WHERE product = 'Widget'");
    await a.query("COMMIT");
    console.log("  Customer A decrements to 0 and COMMITS (lock released)\n");

    await b.query("BEGIN");
    const stockB = (await b.query("SELECT stock FROM inventory WHERE product = 'Widget' FOR UPDATE")).rows[0].stock;
    console.log(`  Customer B reads stock = ${stockB}  (after A's commit)`);
    if (stockB > 0) {
      await b.query("UPDATE inventory SET stock = stock - 1 WHERE product = 'Widget'");
      await b.query("COMMIT");
      console.log("  Customer B purchases — stock decremented");
    } else {
      await b.query("ROLLBACK");
      console.log("  Customer B sees stock = 0 — purchase rejected\n");
    }
  } finally {
    await a.end();
    await b.end();
  }

  console.log("Final inventory:");
  await db.printTable("SELECT product, stock FROM inventory", ["product", "stock"]);
  console.log("FOR UPDATE makes the read+write one atomic unit; no one slips in between.\n");
}

async function demoSkipLocked() {
  console.log("=".repeat(60));
  console.log("SKIP LOCKED — parallel workers claiming jobs without blocking");
  console.log("=".repeat(60));
  await db.resetJobs();
  console.log("Two workers pull from a queue; SKIP LOCKED hands each a different job.\n");

  const claim = `
    SELECT id, payload FROM jobs WHERE status = 'pending'
    ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`;

  const a = await db.getClient();
  const b = await db.getClient();
  try {
    await a.query("BEGIN");
    await b.query("BEGIN");
    const jobA = (await a.query(claim)).rows[0];
    await a.query("UPDATE jobs SET status = 'processing' WHERE id = $1", [jobA.id]);
    console.log(`  Worker A claims: id=${jobA.id}  payload=${JSON.stringify(jobA.payload)}`);

    const jobB = (await b.query(claim)).rows[0];
    await b.query("UPDATE jobs SET status = 'processing' WHERE id = $1", [jobB.id]);
    console.log(`  Worker B claims: id=${jobB.id}  payload=${JSON.stringify(jobB.payload)}`);
    console.log("\n  Both claimed different jobs with no blocking.\n");

    await a.query("UPDATE jobs SET status = 'done' WHERE id = $1", [jobA.id]);
    await b.query("UPDATE jobs SET status = 'done' WHERE id = $1", [jobB.id]);
    await a.query("COMMIT");
    await b.query("COMMIT");
  } finally {
    await a.end();
    await b.end();
  }

  console.log("Jobs after both workers finish:");
  await db.printTable("SELECT id, payload, status FROM jobs ORDER BY id", ["id", "payload", "status"]);
}

async function main() {
  await db.setupSchema();
  await demoToctou();
  await demoSelectForUpdate();
  await demoSkipLocked();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
