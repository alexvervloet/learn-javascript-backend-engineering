// Shared test setup — imported at the top of every bookmark-manager test file.
// It swaps in a fake Redis and stubs the background queue so no broker is
// needed.
//
// The `./env.js` import MUST stay first: it sets DATABASE_URL, and ESM evaluates
// imported modules in order, before this module's own body runs. See env.ts.
import "./env.js";

import { beforeEach, afterAll } from "@jest/globals";
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

const api = (): TestAgent => request(app);

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
