// Shared test setup — imported at the top of every url-shortener test file.
// It swaps in a fake Redis and stubs the background queue, so the suite needs no
// services running.
//
// The `./env.js` import MUST stay first: it sets DATABASE_URL, and ESM evaluates
// imported modules in order, before this module's own body runs. See env.ts.
import "./env.js";

import http from "node:http";

import { beforeAll, beforeEach, afterAll } from "@jest/globals";
import RedisMock from "ioredis-mock";
import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";

import app from "../app/main.js";
import prisma from "../app/database.js";
import * as cache from "../app/cache.js";
import { incrementClick } from "../app/tasks.js";
import { createAccessToken, hashPassword } from "../app/auth.js";
import type { User } from "../app/generated/prisma/index.js";

// An in-memory Redis stand-in, installed instead of calling cache.init().
// One instance for the file, flushed between tests: installing a fresh mock each
// time adds process listeners and trips Node's MaxListeners warning.
const redis = new RedisMock();
cache.setRedis(redis);

// Stub the enqueue side so tests never touch BullMQ. The worker logic is
// exercised directly by calling incrementClick(code); what the routes need is
// for .delay() not to open a connection.
const enqueued: string[] = [];
incrementClick.delay = async (shortCode: string) => {
  enqueued.push(shortCode);
  // The real .delay resolves to a BullMQ Job. Nothing under test reads it, and
  // fabricating one would be worse than saying so, hence the cast.
  return undefined as never;
};

// One server for the whole file rather than one per request: supertest's Test
// constructor calls http.createServer(app) every time it is invoked. See the
// bookmark-manager's setup.ts and LESSONS.md for the full story.
const server = http.createServer(app);

// Bind a port derived from the Jest worker rather than asking for `listen(0)`.
//
// Be honest about why this is here. Running the suite in parallel introduced a
// rare failure — about three runs in ninety — where every request in one test
// file came back 404, as though it had reached a server belonging to a different
// app. The suspect was `listen(0)`: it draws from the OS ephemeral range, and in
// parallel a dozen worker processes take and release ports in that same narrow
// band at once. Switching to deterministic ports made it go away, and 110
// consecutive runs have been clean since.
//
// What has not been demonstrated is the mechanism. Two processes were never
// caught holding the same port, and every attempt to instrument the failure
// stopped it happening, which is consistent with a timing race but proves
// nothing. Treat this as a fix that works rather than one that is understood, and
// if the 404s ever come back, start here.
//
// Each worker runs one file at a time, so the worker id alone makes the port
// unique, and 23000+ is below the ephemeral range on both macOS (49152+) and
// Linux (32768+), so nothing else should be handing these out. If something does
// hold the port, fall back to `listen(0)` and say so rather than refusing to run.
async function listenForThisWorker(target: http.Server, basePort: number): Promise<void> {
  const port = basePort + Number(process.env.JEST_WORKER_ID ?? "1");
  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error): void => reject(err);
      target.once("error", onError);
      target.listen(port, "127.0.0.1", () => {
        target.removeListener("error", onError);
        resolve();
      });
    });
  } catch {
    console.warn(
      `[tests] port ${port} is in use; falling back to an ephemeral port. ` +
        "If this suite starts failing intermittently, that fallback is why."
    );
    await new Promise<void>((resolve) => target.listen(0, "127.0.0.1", resolve));
  }
}

beforeAll(async () => {
  await listenForThisWorker(server, 23000);
});

// Guard against calling this before beforeAll has bound the port. supertest
// treats a server whose address() is null as one it should listen and then
// close itself, which half-works and turns any ordering mistake into a
// confusing 404 rather than an error naming the cause.
const api = (): TestAgent => {
  if (server.address() === null) {
    throw new Error("api() called before the test server was listening");
  }
  return request(server);
};

interface Fixture {
  user: User;
  headers: Record<string, string>;
}

async function createUser(username = "alex", password = "supersecret123"): Promise<Fixture> {
  const user = await prisma.user.create({
    data: { username, hashedPassword: hashPassword(password) },
  });
  return { user, headers: { Authorization: `Bearer ${createAccessToken(user.username)}` } };
}

// Create a short URL through the API, so tests exercise the real code path
// rather than seeding rows the routes would never have produced.
async function shorten(
  headers: Record<string, string>,
  originalUrl = "https://example.com/some/long/path",
  customCode?: string
): Promise<string> {
  const body: Record<string, unknown> = { original_url: originalUrl };
  if (customCode) body.custom_code = customCode;
  const res = await api().post("/urls").set(headers).send(body);
  if (res.status !== 201) {
    throw new Error(`shorten() expected 201, got ${res.status}: ${res.text}`);
  }
  return res.body.short_code as string;
}

async function resetDb(): Promise<void> {
  await prisma.url.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(async () => {
  await resetDb();
  enqueued.length = 0;
  await redis.flushall();
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
  await redis.quit();
});

export { api, prisma, cache, enqueued, createUser, shorten };
export type { Fixture };
