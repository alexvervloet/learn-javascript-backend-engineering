/**
 * Dynamic mock behaviour
 * ======================
 * A family of jest.fn helpers makes a mock behave differently per call:
 *
 *   sequence of values   → mockReturnValueOnce / mockResolvedValueOnce (chained)
 *   throw / reject       → mockImplementation(() => { throw }) / mockRejectedValue
 *   dynamic by argument  → mockImplementation((arg) => ...)
 *
 * "Once" variants queue up per-call behaviour; once exhausted, the base
 * implementation (or mockResolvedValue) is used as the fallback.
 *
 * Run:
 *   npm test -- backends/learning/testing-concepts/02-mocking/03_side_effects
 */

import { jest, test, expect } from "@jest/globals";

// ---------------------------------------------------------------------------
// Code under test
// ---------------------------------------------------------------------------

// The dependencies are described by the narrowest interface each function
// needs, which is what lets the tests pass a one-method object.
interface Sender {
  send(to: string, subject: string, body: string): Promise<boolean>;
}

interface PriceResponse {
  price: number;
}

interface ApiClient {
  get(path: string): Promise<PriceResponse>;
}

async function sendWithRetry(
  emailService: Sender,
  to: string,
  retries = 3
): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await emailService.send(to, "Retry test", "...");
    } catch (err) {
      if (attempt === retries - 1) throw err;
    }
  }
  return false;
}

async function fetchPrice(apiClient: ApiClient, itemId: string): Promise<number> {
  const response = await apiClient.get(`/prices/${itemId}`);
  return response.price;
}

// ---------------------------------------------------------------------------
// 1. Sequence of outcomes — fail twice, then succeed
// ---------------------------------------------------------------------------

test("retry succeeds on the third attempt", async () => {
  const send = jest
    .fn<Sender["send"]>()
    .mockRejectedValueOnce(new Error("timeout"))
    .mockRejectedValueOnce(new Error("timeout"))
    .mockResolvedValueOnce(true);

  const result = await sendWithRetry({ send }, "alice@example.com", 3);

  expect(result).toBe(true);
  expect(send).toHaveBeenCalledTimes(3);
});

test("retry re-throws after all attempts are exhausted", async () => {
  const send = jest.fn<Sender["send"]>().mockRejectedValue(new Error("timeout")); // always fails
  await expect(sendWithRetry({ send }, "alice@example.com", 3)).rejects.toThrow("timeout");
});

test("different resolved value per call", async () => {
  const get = jest
    .fn<ApiClient["get"]>()
    .mockResolvedValueOnce({ price: 9.99 })
    .mockResolvedValueOnce({ price: 14.99 })
    .mockResolvedValueOnce({ price: 4.99 });
  const api = { get };

  expect(await fetchPrice(api, "widget")).toBe(9.99);
  expect(await fetchPrice(api, "gadget")).toBe(14.99);
  expect(await fetchPrice(api, "doohickey")).toBe(4.99);
});

// ---------------------------------------------------------------------------
// 2. Rejecting with an error
// ---------------------------------------------------------------------------

test("mockRejectedValue throws when awaited", async () => {
  const send = jest
    .fn<Sender["send"]>()
    .mockRejectedValue(new Error("SMTP server unreachable"));
  await expect(send("x@example.com", "s", "b")).rejects.toThrow("SMTP server unreachable");
});

// ---------------------------------------------------------------------------
// 3. mockImplementation — dynamic response based on arguments
// ---------------------------------------------------------------------------

test("implementation chooses output by argument", async () => {
  const priceDb: Record<string, PriceResponse> = {
    "/prices/widget": { price: 9.99 },
    "/prices/gadget": { price: 24.99 },
  };
  const get = jest.fn<ApiClient["get"]>().mockImplementation(async (path) => {
    const found = priceDb[path];
    if (found === undefined) throw new Error(`Unknown path: ${path}`);
    return found;
  });
  const api = { get };

  expect(await fetchPrice(api, "widget")).toBe(9.99);
  expect(await fetchPrice(api, "gadget")).toBe(24.99);
  await expect(fetchPrice(api, "unknown")).rejects.toThrow("Unknown path");
});

// ---------------------------------------------------------------------------
// 4. "Once" behaviour falls back to the base implementation
// ---------------------------------------------------------------------------

test("once-implementations run first, then the default takes over", () => {
  const fn = jest
    .fn<() => string>()
    .mockReturnValue("default_response")
    .mockReturnValueOnce("first_call_override");

  expect(fn()).toBe("first_call_override"); // queued once-value
  expect(fn()).toBe("default_response"); // falls back to the base value
  expect(fn()).toBe("default_response");
});
