/**
 * Connection Pool Configuration
 * ==============================
 * Opening a fresh TCP connection to Postgres takes ~1–5ms — negligible per
 * request, crippling at 1000 req/s. A pool keeps connections open and reuses them.
 *
 * node-postgres Pool knobs:
 *   max                     max connections in the pool
 *   connectionTimeoutMillis wait this long for a free connection, else error
 *   idleTimeoutMillis       close a connection after it's idle this long
 *   maxLifetimeSeconds      retire a connection older than this — the proactive
 *                           guard against firewalls/DBs closing idle conns
 *
 * (pg has no built-in pre-ping; you typically rely on error handling + retry,
 * or maxLifetimeSeconds to avoid stale connections.)
 *
 * Run:  docker compose up -d (Postgres)  →  npx tsx 03_connection_pool.ts
 */

import * as db from "./db.js";
import type { Pool } from "pg";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Check out a client, hold it for `ms`, then release.
async function hold(pool: Pool, ms: number): Promise<void> {
  const client = await pool.connect();
  await client.query("SELECT 1");
  await sleep(ms);
  client.release();
}

async function main(): Promise<void> {
  console.log("\n=== Pool lifecycle — watch connections come and go ===");
  const pool = db.makePool({ max: 3, connectionTimeoutMillis: 5000 });
  await db.resetSchema(pool);

  db.printPoolStatus(pool, "Start — no connections yet");

  // Hold all 3 connections concurrently.
  const held = [hold(pool, 1000), hold(pool, 1000), hold(pool, 1000)];
  await sleep(100);
  db.printPoolStatus(pool, "3 clients checked out — pool full (max=3)");

  // A 4th request must wait for one to free up.
  const queued = hold(pool, 100);
  await sleep(100);
  db.printPoolStatus(pool, "4th request queued (waiting > 0)");

  await Promise.all([...held, queued]);
  await sleep(50);
  db.printPoolStatus(pool, "All released — connections idle in the pool");

  await pool.end();
  console.log("\n  pool.end() closes all idle connections (call at app shutdown).");

  console.log("\n=== Other knobs ===");
  console.log(`  connectionTimeoutMillis — see 04_pool_exhaustion.ts for what the timeout looks like.
  idleTimeoutMillis — idle connections close automatically, freeing DB memory.
  maxLifetimeSeconds — retire old connections so firewalls/DB restarts don't hand you a dead one.`);
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
