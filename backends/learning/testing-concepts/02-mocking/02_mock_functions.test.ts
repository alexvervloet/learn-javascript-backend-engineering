/**
 * jest.fn() — standalone mock functions
 * =====================================
 * `jest.fn()` is a function that records every call. Hand one to code under test
 * as a fake dependency (dependency injection).
 *
 * In TypeScript, give it the signature it stands in for:
 *
 *   jest.fn<EmailSender["send"]>()
 *
 * Without the type argument the mock accepts any arguments and returns unknown,
 * and mockResolvedValue has nothing to check the value against. With it, a
 * mockResolvedValue of the wrong shape is a compile error.
 *
 * Configure behaviour:
 *   fn.mockReturnValue(x)        what fn() returns
 *   fn.mockResolvedValue(x)      what an async fn() resolves to
 *
 * Assert on calls (matchers throw on failure):
 *   expect(fn).toHaveBeenCalled()
 *   expect(fn).toHaveBeenCalledTimes(n)
 *   expect(fn).toHaveBeenCalledWith(...args)
 *   expect(fn).not.toHaveBeenCalled()
 *
 * Inspect calls directly:
 *   fn.mock.calls           array of arg-arrays, one per call
 *   fn.mock.results         array of { type, value }
 *
 * Run:
 *   npm test -- backends/learning/testing-concepts/02-mocking/02_mock_functions
 */

import { jest, test, expect } from "@jest/globals";

import type { EmailSender, PaymentProcessor, ChargeResult } from "./services.js";

// ---------------------------------------------------------------------------
// 1. Injecting a mock dependency
// ---------------------------------------------------------------------------

// The parameter is typed as the interface, not as the concrete class. That is
// what lets a test pass an object with just `send` on it.
async function sendNotification(
  emailService: Pick<EmailSender, "send">,
  userEmail: string,
  message: string
): Promise<void> {
  await emailService.send(userEmail, "Notification", message);
}

test("sendNotification calls send with the right args", async () => {
  const emailService = {
    send: jest.fn<EmailSender["send"]>().mockResolvedValue(true),
  };

  await sendNotification(emailService, "alice@example.com", "Your order shipped.");

  expect(emailService.send).toHaveBeenCalledWith(
    "alice@example.com",
    "Notification",
    "Your order shipped."
  );
});

// ---------------------------------------------------------------------------
// 2. mockResolvedValue — control what an async mock resolves to
// ---------------------------------------------------------------------------

async function processPayment(
  paymentService: Pick<PaymentProcessor, "charge">,
  amount: number,
  token: string
): Promise<string | null> {
  const result = await paymentService.charge(amount, token);
  return result.chargeId;
}

test("processPayment returns the charge id", async () => {
  const paymentService = {
    charge: jest
      .fn<PaymentProcessor["charge"]>()
      .mockResolvedValue({ status: "success", chargeId: "ch_xyz" }),
  };

  expect(await processPayment(paymentService, 1000, "tok_abc")).toBe("ch_xyz");
});

// ---------------------------------------------------------------------------
// 3. Call count and call inspection
// ---------------------------------------------------------------------------

async function batchNotify(
  emailService: Pick<EmailSender, "send">,
  emails: string[]
): Promise<void> {
  for (const email of emails) {
    // eslint-disable-next-line no-await-in-loop
    await emailService.send(email, "Batch", "Hello");
  }
}

test("batchNotify calls send once per email", async () => {
  const emailService = {
    send: jest.fn<EmailSender["send"]>().mockResolvedValue(true),
  };
  await batchNotify(emailService, ["a@x.com", "b@x.com", "c@x.com"]);
  expect(emailService.send).toHaveBeenCalledTimes(3);
});

test("batchNotify sends to the correct addresses in order", async () => {
  const emailService = {
    send: jest.fn<EmailSender["send"]>().mockResolvedValue(true),
  };
  await batchNotify(emailService, ["a@x.com", "b@x.com"]);

  // mock.calls is an array of argument arrays — one entry per call. Because the
  // mock carries a signature, each entry is typed [string, string, string].
  expect(emailService.send.mock.calls).toEqual([
    ["a@x.com", "Batch", "Hello"],
    ["b@x.com", "Batch", "Hello"],
  ]);
});

// ---------------------------------------------------------------------------
// 4. Asserting a path is NOT taken
// ---------------------------------------------------------------------------

function notifyIfOptedIn(
  emailService: Pick<EmailSender, "send">,
  email: string,
  optedIn: boolean
): void {
  if (optedIn) void emailService.send(email, "News", "...");
}

test("opted-out user receives no email", () => {
  const emailService = { send: jest.fn<EmailSender["send"]>() };
  notifyIfOptedIn(emailService, "alice@example.com", false);
  expect(emailService.send).not.toHaveBeenCalled();
});

test("opted-in user receives an email", () => {
  const emailService = { send: jest.fn<EmailSender["send"]>() };
  notifyIfOptedIn(emailService, "bob@example.com", true);
  expect(emailService.send).toHaveBeenCalledTimes(1);
});

// ---------------------------------------------------------------------------
// 5. Mocking a chained / nested return shape
// ---------------------------------------------------------------------------

interface ChargeRecord extends ChargeResult {
  customer: { email: string };
}

interface ChargeLookup {
  getCharge(chargeId: string): ChargeRecord;
}

function getUserEmailDomain(paymentService: ChargeLookup, chargeId: string): string | undefined {
  const email = paymentService.getCharge(chargeId).customer.email;
  return email.split("@")[1];
}

test("nested return values", () => {
  const paymentService = {
    getCharge: jest.fn<ChargeLookup["getCharge"]>().mockReturnValue({
      status: "success",
      chargeId: "ch_123",
      customer: { email: "alice@example.com" },
    }),
  };

  expect(getUserEmailDomain(paymentService, "ch_123")).toBe("example.com");
  expect(paymentService.getCharge).toHaveBeenCalledWith("ch_123");
});
