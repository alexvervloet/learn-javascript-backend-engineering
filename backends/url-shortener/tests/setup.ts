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

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
});

const api = (): TestAgent => request(server);

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
