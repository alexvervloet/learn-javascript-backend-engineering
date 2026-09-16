/**
 * Testing Async Functions
 * =======================
 * In Node, async is the default for I/O — and Jest handles it natively. Return
 * the promise (or use an `async` test body and `await`); Jest waits for it.
 * Nothing extra to install — it's built in.
 *
 * Key tools:
 *   - async/await in the test body
 *   - .resolves / .rejects matchers for promise-returning calls
 *   - Promise.all for concurrent execution
 *   - jest.fn().mockResolvedValue / mockRejectedValue for async dependencies
 *     (a plain jest.fn already returns a thenable when you want it to)
 *
 * Run:
 *   npm test -- backends/learning/testing-concepts/04-async-testing/01_async_functions
 */


import { jest, test, expect } from "@jest/globals";
// ---------------------------------------------------------------------------
// Async functions under test
// ---------------------------------------------------------------------------

interface FetchedUser {
  id: number;
  username: string;
}

async function fetchUser(userId: number): Promise<FetchedUser> {
  await Promise.resolve(); // simulate I/O without actually waiting
  if (userId <= 0) throw new Error(`Invalid userId: ${userId}`);
  return { id: userId, username: `user_${userId}` };
}

async function fetchUsersConcurrently(userIds: number[]): Promise<FetchedUser[]> {
  return Promise.all(userIds.map((id) => fetchUser(id)));
}

interface ApiResponse {
  data: string;
}

// The narrowest interface the function needs, so a test can pass an object
// with just `get` on it.
interface ApiClient {
  get(endpoint: string): Promise<ApiResponse>;
}

async function callExternalApi(client: ApiClient, endpoint: string): Promise<ApiResponse> {
  return client.get(endpoint);
}

// ---------------------------------------------------------------------------
// 1. Basic async test — await works normally
// ---------------------------------------------------------------------------

test("fetchUser returns a user object", async () => {
  const user = await fetchUser(1);
  expect(user.id).toBe(1);
  expect(user.username).toBe("user_1");
});

test("fetchUser rejects for an invalid id (.rejects matcher)", async () => {
  await expect(fetchUser(-1)).rejects.toThrow("Invalid userId");
});

test(".resolves matcher reads a resolved value", async () => {
  await expect(fetchUser(2)).resolves.toEqual({ id: 2, username: "user_2" });
});

// ---------------------------------------------------------------------------
// 2. Concurrent execution with Promise.all
// ---------------------------------------------------------------------------

test("fetch users concurrently", async () => {
  const users = await fetchUsersConcurrently([1, 2, 3]);
  expect(users).toHaveLength(3);
  expect(new Set(users.map((u) => u.id))).toEqual(new Set([1, 2, 3]));
});

test("Promise.all rejects if any task rejects", async () => {
  await expect(fetchUsersConcurrently([1, -1, 3])).rejects.toThrow();
});

// ---------------------------------------------------------------------------
// 3. Mocking async dependencies
//    mockResolvedValue / mockRejectedValue make a jest.fn awaitable.
// ---------------------------------------------------------------------------

test("async mock resolves a value", async () => {
  const client = {
    get: jest.fn<ApiClient["get"]>().mockResolvedValue({ data: "result" }),
  };

  const response = await callExternalApi(client, "/users/1");

  expect(response.data).toBe("result");
  expect(client.get).toHaveBeenCalledWith("/users/1");
});

test("async mock rejects", async () => {
  const client = {
    get: jest.fn<ApiClient["get"]>().mockRejectedValue(new Error("timeout")),
  };
  await expect(callExternalApi(client, "/users/1")).rejects.toThrow("timeout");
});

// ---------------------------------------------------------------------------
// 4. Swapping an async dependency (the patch-an-async-function equivalent)
// ---------------------------------------------------------------------------

interface AppConfig {
  debug: boolean;
  maxConnections: number;
}

type ConfigLoader = () => Promise<AppConfig>;

async function startApp(loadConfig: ConfigLoader): Promise<string> {
  const config = await loadConfig();
  return config.debug ? "debug mode" : "production mode";
}

test("inject a fake async config loader", async () => {
  const loadConfig = jest
    .fn<ConfigLoader>()
    .mockResolvedValue({ debug: true, maxConnections: 5 });
  expect(await startApp(loadConfig)).toBe("debug mode");
});

// ---------------------------------------------------------------------------
// 5. Async resource cleanup (the async-context-manager equivalent)
//    JS uses try/finally (or `await using` with Symbol.asyncDispose) to
//    guarantee teardown even when the body throws.
// ---------------------------------------------------------------------------

class AsyncResource {
  name: string;
  closed = false;

  constructor(name: string) {
    this.name = name;
  }

  async read(): Promise<string> {
    return `data from ${this.name}`;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

test("resource is cleaned up on the happy path", async () => {
  const resource = new AsyncResource("db");
  // Assigned inside the try, so the annotation has to be written out.
  let data: string | undefined;
  try {
    data = await resource.read();
  } finally {
    await resource.close();
  }
  expect(data).toBe("data from db");
  expect(resource.closed).toBe(true);
});

test("resource is cleaned up even when the body throws", async () => {
  const resource = new AsyncResource("conn");
  await expect(
    (async () => {
      try {
        throw new Error("simulated error");
      } finally {
        await resource.close();
      }
    })()
  ).rejects.toThrow("simulated error");
  expect(resource.closed).toBe(true);
});
