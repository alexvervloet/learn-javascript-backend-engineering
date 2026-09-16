/**
 * Mocking a whole module under ESM
 * ================================
 * `jest.mock("./services")` is the CommonJS API. It relies on Jest hoisting the
 * call above the `require`s, which works because `require` runs where it is
 * written. ESM `import` statements are hoisted and evaluated before any code in
 * the file, so there is nowhere to put a `jest.mock` call early enough.
 *
 * The ESM replacement is two steps:
 *
 *   1. `jest.unstable_mockModule(path, factory)` registers the mock. It is NOT
 *      hoisted, so it must physically appear before the import it affects.
 *   2. `await import(path)` loads the module afterwards. Top-level await is what
 *      makes step 2 come second.
 *
 * The golden rule is unchanged: mock the module that the code under test
 * imports. checkout.ts imports "./services.js", so that is the path to mock.
 *
 * Run:
 *   npm test -- backends/learning/testing-concepts/02-mocking/01_mock_module
 */

import { jest, describe, test, expect, beforeEach } from "@jest/globals";

import type { EmailSender, PaymentProcessor, WeatherSource } from "./services.js";

// The constructor mocks are declared here, before the factory, so each one can
// be given a type.
//
// The return type is Partial<...> on purpose: each test supplies only the
// methods the code under test actually calls. Saying Partial keeps the useful
// half of the checking — a misspelled method name or a wrong argument type is
// still a compile error — while allowing the methods a given test does not need.
// `as any` would have waved through both.
const EmailServiceMock = jest.fn<() => Partial<EmailSender>>();
const PaymentServiceMock = jest.fn<() => Partial<PaymentProcessor>>();
const WeatherClientMock = jest.fn<() => Partial<WeatherSource>>();

// Registered before the dynamic import below, which is the whole point.
jest.unstable_mockModule("./services.js", () => ({
  EmailService: EmailServiceMock,
  PaymentService: PaymentServiceMock,
  WeatherClient: WeatherClientMock,
}));

// Top-level await, so this runs after the mock is registered. A static import
// at the top of the file would have been evaluated first and would have pulled
// in the real services.
const checkout = await import("./checkout.js");

// Reset mock state (calls + implementations) between tests for isolation.
beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Mocked class: configure the instance the code constructs
//    mockImplementation lets each `new EmailService()` return our fake instance.
// ---------------------------------------------------------------------------

describe("registerUser", () => {
  test("sends a welcome email", async () => {
    const sendWelcome = jest.fn<EmailSender["sendWelcome"]>().mockResolvedValue(true);
    EmailServiceMock.mockImplementation(() => ({ sendWelcome }));

    const result = await checkout.registerUser("alice@example.com");

    expect(result.status).toBe("active");
    expect(sendWelcome).toHaveBeenCalledWith("alice@example.com");
  });

  test("returns a user object with the email", async () => {
    EmailServiceMock.mockImplementation(() => ({
      sendWelcome: jest.fn<EmailSender["sendWelcome"]>().mockResolvedValue(true),
    }));
    const result = await checkout.registerUser("bob@example.com");
    expect(result.email).toBe("bob@example.com");
  });

  test("instantiates EmailService exactly once", async () => {
    EmailServiceMock.mockImplementation(() => ({
      sendWelcome: jest.fn<EmailSender["sendWelcome"]>().mockResolvedValue(true),
    }));
    await checkout.registerUser("carol@example.com");
    expect(EmailServiceMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Controlling return values to drive branches
// ---------------------------------------------------------------------------

test("completePurchase success path", async () => {
  PaymentServiceMock.mockImplementation(() => ({
    charge: jest
      .fn<PaymentProcessor["charge"]>()
      .mockResolvedValue({ status: "success", chargeId: "ch_abc123" }),
  }));

  const result = await checkout.completePurchase(1, 5000, "tok_visa");

  expect(result.chargeId).toBe("ch_abc123");
  expect(result.orderId).toBe(100);
});

test("completePurchase throws on a declined charge", async () => {
  PaymentServiceMock.mockImplementation(() => ({
    charge: jest
      .fn<PaymentProcessor["charge"]>()
      .mockResolvedValue({ status: "declined", chargeId: null }),
  }));

  await expect(checkout.completePurchase(1, 5000, "tok_bad")).rejects.toThrow("Payment failed");
});

test("getWeatherAlert flags extreme heat", async () => {
  WeatherClientMock.mockImplementation(() => ({
    getTemperature: jest.fn<WeatherSource["getTemperature"]>().mockResolvedValue(42),
  }));
  const alert = await checkout.getWeatherAlert("Phoenix");
  expect(alert).toContain("Extreme heat");
  expect(alert).toContain("42");
});

test("getWeatherAlert returns null in the normal range", async () => {
  WeatherClientMock.mockImplementation(() => ({
    getTemperature: jest.fn<WeatherSource["getTemperature"]>().mockResolvedValue(20),
  }));
  expect(await checkout.getWeatherAlert("London")).toBeNull();
});

// ---------------------------------------------------------------------------
// 3. Asserting a path is NOT taken — registerUser never charges anything
// ---------------------------------------------------------------------------

test("registerUser never touches the payment service", async () => {
  const charge = jest.fn<PaymentProcessor["charge"]>();
  EmailServiceMock.mockImplementation(() => ({
    sendWelcome: jest.fn<EmailSender["sendWelcome"]>().mockResolvedValue(true),
  }));
  PaymentServiceMock.mockImplementation(() => ({ charge }));

  await checkout.registerUser("alice@example.com");

  expect(charge).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// 4. Fake timers — skipping a wall-clock wait
//    Without fake timers, a real setTimeout would make the test wait.
// ---------------------------------------------------------------------------

async function slowHealthCheck(): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  return "ok";
}

test("fake timers skip the 10s wait", async () => {
  jest.useFakeTimers();
  const promise = slowHealthCheck();
  jest.advanceTimersByTime(10_000); // fast-forward instead of waiting
  await expect(promise).resolves.toBe("ok");
  jest.useRealTimers();
});

// Section 5 of the CommonJS version used jest.requireActual to get the real
// WeatherClient back inside a file that had already mocked it. ESM has no
// equivalent: once a specifier is mocked for a module registry, every import of
// it in that file gets the mock. Spying on a real instance now lives in
// 04_spies_and_partial.test.ts, which never mocks the module at all.
