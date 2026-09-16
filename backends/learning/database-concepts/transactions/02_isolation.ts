/**
 * Isolation Levels
 * ================
 * Isolation is a dial. Postgres implements three of the four SQL levels
 * (READ UNCOMMITTED is promoted to READ COMMITTED):
 *
 *   READ COMMITTED  — prevents dirty reads; allows non-repeatable/phantom/write-skew
 *   REPEATABLE READ — also prevents non-repeatable + phantom; allows write skew
 *   SERIALIZABLE    — prevents all of the above; may abort txns you must retry
 *
 * Higher isolation = fewer anomalies but more contention. Default: READ COMMITTED.
 * Two pg clients simulate concurrent sessions, interleaved manually.
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 02_isolation.ts
 */

import { DatabaseError } from "pg";

import * as db from "./db.js";

// A caught value is `unknown`. pg throws DatabaseError for server-side
// failures, and that is the class carrying the SQLSTATE code these demos print
// (40001 = serialization failure, 23505 = unique violation, and so on).
function sqlstate(err: unknown): string {
  return err instanceof DatabaseError ? (err.code ?? "unknown") : "unknown";
}


async function demoNonRepeatableRead() {
  console.log("=".repeat(60));
  console.log("NON-REPEATABLE READ — READ COMMITTED allows it");
  console.log("=".repeat(60));
  await db.resetAccounts();

  const a = await db.getClient();
  const b = await db.getClient();
  try {
    await a.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    const first = (await a.query("SELECT balance FROM accounts WHERE owner = 'Alice'")).rows[0].balance;
    console.log(`  Tx A reads Alice's balance:        $${first}`);

    await b.query("UPDATE accounts SET balance = balance - 300 WHERE owner = 'Alice'");
    console.log("  Tx B updates Alice: -$300 and COMMITS");

    const second = (await a.query("SELECT balance FROM accounts WHERE owner = 'Alice'")).rows[0].balance;
    console.log(`  Tx A reads Alice's balance again:  $${second}  ← DIFFERENT\n`);
    await a.query("COMMIT");
  } finally {
    await a.end();
    await b.end();
  }
  console.log("Under READ COMMITTED, each statement sees freshly committed data.\n");
}

async function demoRepeatableRead() {
  console.log("=".repeat(60));
  console.log("REPEATABLE READ — snapshot frozen at transaction start");
  console.log("=".repeat(60));
  await db.resetAccounts();

  const a = await db.getClient();
  const b = await db.getClient();
  try {
    await a.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const first = (await a.query("SELECT balance FROM accounts WHERE owner = 'Alice'")).rows[0].balance;
    console.log(`  Tx A reads Alice's balance:        $${first}`);

    await b.query("UPDATE accounts SET balance = balance - 300 WHERE owner = 'Alice'");
    console.log("  Tx B updates Alice: -$300 and COMMITS");

    const second = (await a.query("SELECT balance FROM accounts WHERE owner = 'Alice'")).rows[0].balance;
    console.log(`  Tx A reads Alice's balance again:  $${second}  ← SAME\n`);
    await a.query("COMMIT");
  } finally {
    await a.end();
    await b.end();
  }
  console.log("REPEATABLE READ snapshots the DB at the transaction's first query.\n");
}

async function demoWriteSkew() {
  console.log("=".repeat(60));
  console.log("WRITE SKEW — REPEATABLE READ does not prevent it");
  console.log("=".repeat(60));
  await db.resetDoctors();
  console.log("Rule: at least one doctor on-call. Alice and Bob both go off-call.\n");

  const a = await db.getClient();
  const b = await db.getClient();
  try {
    await a.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await b.query("BEGIN ISOLATION LEVEL REPEATABLE READ");

    const countA = (await a.query("SELECT COUNT(*) FROM doctors WHERE on_call = TRUE")).rows[0].count;
    console.log(`  Tx A (Alice) sees ${countA} on-call — safe to go off-call`);
    const countB = (await b.query("SELECT COUNT(*) FROM doctors WHERE on_call = TRUE")).rows[0].count;
    console.log(`  Tx B (Bob)   sees ${countB} on-call — safe to go off-call`);

    await a.query("UPDATE doctors SET on_call = FALSE WHERE name = 'Alice'");
    await a.query("COMMIT");
    console.log("  Tx A sets Alice off-call and COMMITS");
    await b.query("UPDATE doctors SET on_call = FALSE WHERE name = 'Bob'");
    await b.query("COMMIT");
    console.log("  Tx B sets Bob off-call and COMMITS\n");
  } finally {
    await a.end();
    await b.end();
  }

  console.log("Result:");
  await db.printTable("SELECT name, on_call FROM doctors ORDER BY id", ["name", "on_call"]);
  console.log("Nobody is on-call — each decision was locally valid, the combination wasn't.\n");
}

async function demoSerializable() {
  console.log("=".repeat(60));
  console.log("SERIALIZABLE — detects and aborts conflicting transactions");
  console.log("=".repeat(60));
  await db.resetDoctors();

  const a = await db.getClient();
  const b = await db.getClient();
  try {
    await a.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await b.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

    console.log(`  Tx A sees ${(await a.query("SELECT COUNT(*) FROM doctors WHERE on_call = TRUE")).rows[0].count} on-call — tries to go off-call`);
    console.log(`  Tx B sees ${(await b.query("SELECT COUNT(*) FROM doctors WHERE on_call = TRUE")).rows[0].count} on-call — tries to go off-call`);

    await a.query("UPDATE doctors SET on_call = FALSE WHERE name = 'Alice'");
    await a.query("COMMIT");
    console.log("  Tx A commits successfully");

    try {
      await b.query("UPDATE doctors SET on_call = FALSE WHERE name = 'Bob'");
      await b.query("COMMIT");
    } catch (err) {
      await b.query("ROLLBACK").catch(() => {});
      console.log(`  Tx B got a serialization error (${sqlstate(err)}) — rolled back\n`);
    }
  } finally {
    await a.end();
    await b.end();
  }

  console.log("Result:");
  await db.printTable("SELECT name, on_call FROM doctors ORDER BY id", ["name", "on_call"]);
  console.log("Postgres aborted Tx B — the app MUST retry the whole transaction.\n");
}

async function main() {
  await db.setupSchema();
  await demoNonRepeatableRead();
  await demoRepeatableRead();
  await demoWriteSkew();
  await demoSerializable();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
