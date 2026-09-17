// Shared test setup: savepoint-based isolation + factory helpers.
//
// installIsolation() wraps each test in a SAVEPOINT and rolls it back afterwards,
// so every test starts from a clean database. Factories return rows with
// sensible, overridable defaults for building test data.

import http from "node:http";

import { beforeAll, beforeEach, afterEach, afterAll } from "@jest/globals";
import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";

import { app } from "../app/main.js";
import { db } from "../app/db.js";
import type { PostRow, UserRow } from "../app/db.js";

// One server for the whole test file, rather than one per request.
//
// `request(app)` reads as if it just sends a request, but supertest's Test
// constructor calls http.createServer(app) every time, listens on an ephemeral
// port, and closes the server when the response arrives. At 40 requests in this
// folder that is 40 listen/close cycles for no benefit.
//
// Give supertest a server that is already listening and it skips all of that:
// it only creates one when app.address() returns null, and only closes the one
// it created. api() is the accessor; call it inside a test, after beforeAll.
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
// unique, and 21000+ is below the ephemeral range on both macOS (49152+) and
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
  await listenForThisWorker(server, 21000);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
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

interface UserOverrides {
  username?: string;
  email?: string;
}

interface PostOverrides {
  title?: string;
  body?: string;
  published?: boolean;
}

function installIsolation(): void {
  // Braced bodies so the hooks return void rather than the Database handle
  // exec() returns for chaining, which Jest would read as a return value.
  beforeEach(() => {
    db.exec("SAVEPOINT test");
  });
  afterEach(() => {
    db.exec("ROLLBACK TO test");
  });
}

// Returns UserRow, not UserRow | null: the row was just inserted on this
// connection, so reading it back cannot miss.
function makeUser({ username = "alice", email }: UserOverrides = {}): UserRow {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (username, email) VALUES (?, ?)")
    .run(username, email ?? `${username}@example.com`);
  const user = db
    .prepare<[number], UserRow>("SELECT * FROM users WHERE id = ?")
    .get(Number(lastInsertRowid));
  if (!user) throw new Error("Inserted user could not be read back");
  return user;
}

function makePost(
  user: UserRow,
  { title = "Test Post", body = "Body text.", published = true }: PostOverrides = {}
): PostRow {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO posts (user_id, title, body, published) VALUES (?, ?, ?, ?)")
    .run(user.id, title, body, published ? 1 : 0);
  const post = db
    .prepare<[number], PostRow>("SELECT * FROM posts WHERE id = ?")
    .get(Number(lastInsertRowid));
  if (!post) throw new Error("Inserted post could not be read back");
  return post;
}

export { db, api, installIsolation, makeUser, makePost };
