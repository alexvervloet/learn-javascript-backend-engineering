/*
 * Integration tests — run INSIDE the Docker environment where db and redis are
 * reachable. They're gated behind DOCKER_IT so the repo's top-level `npm test`
 * (which has no Postgres/Redis) skips them.
 *
 * HOW TO RUN:
 *   # inside the running dev container (bind mount → sees live edits)
 *   docker compose exec app npm test
 *   # fresh container against the built image (what CI does)
 *   docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm app
 */

import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";

import type { Express } from "express";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

// Only run when explicitly inside the Docker integration environment.
const suite = process.env.DOCKER_IT ? describe : describe.skip;

suite("Docker Compose API (integration)", () => {
  // Filled in by beforeAll, so the annotations have to be written out.
  let app: Express;
  let pool: Pool;
  let redis: Redis;

  beforeAll(async () => {
    // A dynamic import rather than require(): this module is ESM, and the
    // import is deliberately late so the server does not connect to Postgres
    // and Redis when the suite is skipped outside Docker.
    ({ app, pool, redis } = await import("../server.js"));
  });
  afterAll(async () => {
    await pool.end();
    redis.disconnect();
  });

  test("GET / returns 200 with a request id header", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toHaveLength(8);
  });

  test("GET /health reports db + redis reachable", async () => {
    const res = await request(app).get("/health");
    expect(res.body.db).toBe(true);
    expect(res.body.redis).toBe(true);
    expect(res.body.status).toBe("ok");
  });

  test("second GET /items is served from cache", async () => {
    await request(app).delete("/items/cache");
    expect((await request(app).get("/items")).body.source).toBe("db");
    expect((await request(app).get("/items")).body.source).toBe("cache");
  });

  test("POST /items creates and invalidates the cache", async () => {
    await request(app).get("/items"); // prime cache
    const created = await request(app).post("/items").send({ name: "from-test" });
    expect(created.status).toBe(201);
    expect((await request(app).get("/items")).body.source).toBe("db"); // cache busted
  });
});
