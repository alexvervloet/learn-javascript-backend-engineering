/**
 * ACID Properties
 * ===============
 *   Atomicity   — all-or-nothing; a failure rolls back every change in the tx.
 *   Consistency — only valid states; CHECK/FK/UNIQUE are enforced, a violation aborts.
 *   Isolation   — concurrent txns behave as if serial (see 02_isolation.ts).
 *   Durability  — committed data survives crashes (Postgres WAL); can't be shown
 *                 in a script, but it's why COMMIT can be slow.
 *
 * Domain: bank accounts. accounts(id, owner, balance CHECK balance >= 0).
 * In pg you control the transaction with explicit BEGIN/COMMIT/ROLLBACK queries.
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 01_acid.ts
 */

import * as db from "./db.js";

async function demoAtomicitySuccess() {
  console.log("=".repeat(60));
  console.log("ATOMICITY — successful transfer");
  console.log("=".repeat(60));
  await db.resetAccounts();

  console.log("Before:");
  await db.printTable("SELECT owner, balance FROM accounts ORDER BY id", ["owner", "balance"]);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE accounts SET balance = balance - 200 WHERE owner = 'Alice'");
    await client.query("UPDATE accounts SET balance = balance + 200 WHERE owner = 'Bob'");
    await client.query("COMMIT");
  } finally {
    await client.end();
  }

  console.log("After transferring $200 from Alice to Bob:");
  await db.printTable("SELECT owner, balance FROM accounts ORDER BY id", ["owner", "balance"]);
  console.log("Both rows updated together — neither commits without the other.\n");
}

async function demoAtomicityFailure() {
  console.log("=".repeat(60));
  console.log("ATOMICITY — failed transfer rolls back completely");
  console.log("=".repeat(60));
  await db.resetAccounts();

  console.log("Transferring $1500 from Alice (balance $1000) — the debit leaves her");
  console.log("at -500, which the CHECK (balance >= 0) rejects.\n");

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE accounts SET balance = balance - 1500 WHERE owner = 'Alice'");
    await client.query("UPDATE accounts SET balance = balance + 1500 WHERE owner = 'Bob'");
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(`Transaction rolled back: ${err instanceof Error ? err.message : String(err)}\n`);
  } finally {
    await client.end();
  }

  console.log("Balances after the failed transfer:");
  await db.printTable("SELECT owner, balance FROM accounts ORDER BY id", ["owner", "balance"]);
  console.log("Both rows unchanged — the rollback undid the debit too.\n");
}

async function demoConsistency() {
  console.log("=".repeat(60));
  console.log("CONSISTENCY — constraints enforce valid state");
  console.log("=".repeat(60));
  await db.resetAccounts();

  console.log("Inserting an account with a negative balance directly...\n");
  const client = await db.getClient();
  try {
    await client.query("INSERT INTO accounts (owner, balance) VALUES ('Eve', -100)");
  } catch (err) {
    console.log(`Rejected: ${err instanceof Error ? err.message : String(err)}\n`);
  } finally {
    await client.end();
  }
  console.log("The CHECK fires for app code, migrations, or raw SQL alike —");
  console.log("constraints make invalid states literally unreachable.\n");
}

async function main() {
  await db.setupSchema();
  await demoAtomicitySuccess();
  await demoAtomicityFailure();
  await demoConsistency();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
