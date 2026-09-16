/**
 * Savepoints
 * ==========
 * A savepoint is a named marker inside a transaction. ROLLBACK TO SAVEPOINT
 * undoes only the work since that marker, without aborting the whole transaction.
 *
 *   SAVEPOINT <name>            mark a position
 *   ROLLBACK TO SAVEPOINT <name> undo since the marker
 *   RELEASE SAVEPOINT <name>    discard the marker (commits nothing)
 *
 * Use case: batch processing where one bad item shouldn't poison the whole batch.
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 03_savepoints.ts
 */

import { DatabaseError } from "pg";

import * as db from "./db.js";

// A caught value is `unknown`. pg throws DatabaseError for server-side
// failures, and that is the class carrying the SQLSTATE code these demos print
// (40001 = serialization failure, 23505 = unique violation, and so on).
function sqlstate(err: unknown): string {
  return err instanceof DatabaseError ? (err.code ?? "unknown") : "unknown";
}


const TRANSFERS = [
  ["Alice", "Bob", 200], // valid
  ["Alice", "Carol", 5000], // invalid — Alice lacks funds
  ["Bob", "Carol", 50], // valid
  ["Carol", "Bob", 9999], // invalid — Carol lacks funds
  ["Bob", "Alice", 75], // valid
];

async function processWithoutSavepoints() {
  console.log("=".repeat(60));
  console.log("WITHOUT SAVEPOINTS — one bad transfer kills the batch");
  console.log("=".repeat(60));
  await db.resetAccounts();

  const client = await db.getClient();
  let done = 0;
  try {
    await client.query("BEGIN");
    for (let i = 0; i < TRANSFERS.length; i += 1) {
      const [sender, receiver, amount] = TRANSFERS[i];
      await client.query("UPDATE accounts SET balance = balance - $1 WHERE owner = $2", [amount, sender]);
      await client.query("UPDATE accounts SET balance = balance + $1 WHERE owner = $2", [amount, receiver]);
      console.log(`  Transfer ${i + 1}: ${sender} → ${receiver}  $${amount} ... queued`);
      done += 1;
    }
    await client.query("COMMIT");
    console.log(`\n  Committed ${done} transfers.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(`\n  ${sqlstate(err)} — entire batch rolled back. ${done} valid transfers lost.\n`);
  } finally {
    await client.end();
  }

  console.log("Balances after failed batch:");
  await db.printTable("SELECT owner, balance FROM accounts ORDER BY id", ["owner", "balance"]);
}

async function processWithSavepoints() {
  console.log("=".repeat(60));
  console.log("WITH SAVEPOINTS — bad transfers skipped, good ones kept");
  console.log("=".repeat(60));
  await db.resetAccounts();

  const client = await db.getClient();
  let succeeded = 0;
  let skipped = 0;
  try {
    await client.query("BEGIN");
    for (let i = 0; i < TRANSFERS.length; i += 1) {
      const [sender, receiver, amount] = TRANSFERS[i];
      await client.query(`SAVEPOINT sp_${i}`);
      try {
        await client.query("UPDATE accounts SET balance = balance - $1 WHERE owner = $2", [amount, sender]);
        await client.query("UPDATE accounts SET balance = balance + $1 WHERE owner = $2", [amount, receiver]);
        await client.query(`RELEASE SAVEPOINT sp_${i}`);
        succeeded += 1;
        console.log(`  Transfer ${i + 1}: ${sender} → ${receiver}  $${amount}  ✓ queued`);
      } catch {
        await client.query(`ROLLBACK TO SAVEPOINT sp_${i}`);
        skipped += 1;
        console.log(`  Transfer ${i + 1}: ${sender} → ${receiver}  $${amount}  ✗ skipped (insufficient funds)`);
      }
    }
    await client.query("COMMIT");
  } finally {
    await client.end();
  }

  console.log(`\n  Committed ${succeeded} transfers, skipped ${skipped}.\n`);
  console.log("Balances after partial batch:");
  await db.printTable("SELECT owner, balance FROM accounts ORDER BY id", ["owner", "balance"]);
  console.log("The valid transfers committed together; savepoints peeled off the bad work.\n");
}

async function main() {
  await db.setupSchema();
  await processWithoutSavepoints();
  await processWithSavepoints();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
