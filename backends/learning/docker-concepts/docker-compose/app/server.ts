/*
 * Docker Compose Practice API (Express)
 * Three services, each reachable by its Compose service name:
 *   app:8000 · db:5432 (Postgres) · redis:6379
 * Connection strings come from env vars set in docker-compose.yml.
 */

import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import express from "express";
// ioredis is a CommonJS package whose class is both the default and a named
// export. Under nodenext the default import resolves to the module namespace,
// which is not constructable, so take the named one.
import { Redis } from "ioredis";
import { Pool } from "pg";

const app = express();
app.use(express.json());

// Request-ID middleware: tag every request, log it, return it as a header so a
// single id traces a request across all service logs.
app.use((req, res, next) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  res.set("X-Request-ID", requestId);
  res.on("finish", () =>
    console.log(`${new Date().toISOString()} request_id=${requestId} ${req.method} ${req.path} ${res.statusCode}`)
  );
  next();
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const ITEMS_CACHE_KEY = "items:all";
const CACHE_TTL = 300;

app.get("/", (_req, res) => res.json({ message: "Docker Compose Practice API", env: process.env.APP_ENV || "production" }));

app.get("/health", async (_req, res) => {
  let dbOk = false;
  let redisOk = false;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch {
    /* db down */
  }
  try {
    await redis.ping();
    redisOk = true;
  } catch {
    /* redis down */
  }
  res.json({ status: dbOk && redisOk ? "ok" : "degraded", db: dbOk, redis: redisOk });
});

app.get("/items", async (_req, res) => {
  // Cache-aside: serve from Redis if present, else query Postgres and backfill.
  const cached = await redis.get(ITEMS_CACHE_KEY);
  if (cached) return res.json({ items: JSON.parse(cached), source: "cache" });

  const { rows } = await pool.query("SELECT id, name, description, created_at::text FROM items ORDER BY id");
  await redis.set(ITEMS_CACHE_KEY, JSON.stringify(rows), "EX", CACHE_TTL);
  return res.json({ items: rows, source: "db" });
});

app.post("/items", async (req, res) => {
  const { name, description = null } = req.body;
  const { rows } = await pool.query("INSERT INTO items (name, description) VALUES ($1,$2) RETURNING id", [name, description]);
  await redis.del(ITEMS_CACHE_KEY); // invalidate so the next GET re-queries the DB
  res.status(201).json({ id: rows[0].id, name, description });
});

app.delete("/items/cache", async (_req, res) => {
  await redis.del(ITEMS_CACHE_KEY);
  res.json({ message: "cache cleared" });
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(8000, () => console.log("listening on http://0.0.0.0:8000"));
}

export { app, pool, redis };
