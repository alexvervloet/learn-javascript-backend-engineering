// Shared test setup — imported at the top of every bookmark-manager test file.
// It swaps in a fake Redis and stubs the background queue so no broker is
// needed.
//
// The `./env.js` import MUST stay first: it sets DATABASE_URL, and ESM evaluates
// imported modules in order, before this module's own body runs. See env.ts.
import "./env.js";

import http from "node:http";

import { beforeAll, beforeEach, afterAll } from "@jest/globals";
import RedisMock from "ioredis-mock";
import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";

import { setRedis, getRedis } from "../app/redis_client.js";
import app from "../app/main.js";
import prisma from "../app/database.js";
import * as tasks from "../app/tasks.js";
import { createAccessToken, hashPassword } from "../app/security.js";
import type { User } from "../app/generated/prisma/index.js";

setRedis(new RedisMock());

// Stub the enqueue side of the metadata task so tests never touch BullMQ/Redis.
// We're not testing the worker here, only that the task gets enqueued.
tasks.fetchBookmarkMetadata.delay = async () => {
  // The real .delay resolves to a BullMQ Job. Nothing under test reads it, and
  // fabricating one would be worse than saying so, hence the cast.
  return undefined as never;
};

// One server per test file, not one per request.
//
// `request(app)` looks cheap, but supertest's Test constructor runs
// http.createServer(app) every time it is called, then listens on an ephemeral
// port and closes the server once the response lands. This file makes roughly a
// hundred requests, and the suite as a whole several hundred, so that is several
// hundred listen/close cycles inside one Jest worker — slow, and enough socket
// churn to make rare, hard-to-place failures possible.
//
// Handing supertest a server that is already listening skips all of it:
// Test.serverAddress only creates one when app.address() returns null, and only
// closes the one it created.
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
// unique, and 22000+ is below the ephemeral range on both macOS (49152+) and
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
  await listenForThisWorker(server, 22000);
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

interface NewUser {
  email: string;
  username: string;
  password: string;
}

type AuthHeaders = Record<string, string>;

interface Fixture {
  user: User;
  headers: AuthHeaders;
}

async function createUser({ email, username, password }: NewUser): Promise<User> {
  return prisma.user.create({
    data: { email, username, passwordHash: hashPassword(password) },
  });
}

function authHeadersFor(username: string): AuthHeaders {
  return { Authorization: `Bearer ${createAccessToken(username)}` };
}

// The default test fixtures.
async function defaultUser(): Promise<Fixture> {
  const user = await createUser({
    email: "test@example.com",
    username: "testuser",
    password: "testpass123",
  });
  return { user, headers: authHeadersFor(user.username) };
}

async function otherUser(): Promise<Fixture> {
  const user = await createUser({
    email: "other@example.com",
    username: "otheruser",
    password: "otherpass123",
  });
  return { user, headers: authHeadersFor(user.username) };
}

async function resetDb(): Promise<void> {
  await prisma.bookmark.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

// Clear the fake Redis between tests so blocklist/click state doesn't leak.
beforeEach(async () => {
  await resetDb();
  await getRedis().flushall();
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
  await getRedis().quit();
});

export {
  api,
  prisma,
  getRedis,
  createUser,
  authHeadersFor,
  defaultUser,
  otherUser,
};
export type { NewUser, AuthHeaders, Fixture };
