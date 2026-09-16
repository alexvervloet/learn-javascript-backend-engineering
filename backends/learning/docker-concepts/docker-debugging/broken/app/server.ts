import express from "express";
import { Pool } from "pg";

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// PORT comes from the env. The broken Dockerfile sets it to 9000 (Bug 1) while
// docker-compose maps host 8000 → container 8000 — so nothing listens on 8000.
const PORT = Number(process.env.PORT || 8000);

app.get("/", (_req, res) => res.json({ status: "ok" }));

app.get("/items", async (_req, res) => {
  const { rows } = await pool.query("SELECT id, name FROM items ORDER BY id");
  res.json(rows);
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: true });
  } catch {
    res.json({ status: "degraded", db: false });
  }
});

app.listen(PORT, () => console.log(`listening on http://0.0.0.0:${PORT}`));
