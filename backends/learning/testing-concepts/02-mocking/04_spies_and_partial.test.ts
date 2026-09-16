/**
 * Spies, partial mocks & interface safety
 * =======================================
 * In the JavaScript version of this module, the note here said that matching a
 * mock to the real interface — method names AND signatures — was mostly a
 * TypeScript concern. Now that the repo is TypeScript, most of it happens at
 * compile time:
 *
 *   - jest.spyOn(obj, "sned") does not compile. The second argument is typed as
 *     keyof typeof obj, so a misspelled name is caught before the test runs.
 *   - spy.mockResolvedValue(x) does not compile unless x matches what the real
 *     method returns.
 *   - A hand-rolled fake declared as EmailSender must have every method, with
 *     the right signatures.
 *
 * What is left for runtime:
 *
 *   - jest.spyOn also THROWS if the property is missing, which still matters
 *     when the object's type was widened or came from untyped code.
 *   - spyOn keeps the real implementation until you override it, and
 *     mockRestore() puts the original back.
 *
 * This file never mocks the services module, so every instance below is real.
 *
 * Run:
 *   npm test -- backends/learning/testing-concepts/02-mocking/04_spies_and_partial
 */

import { jest, test, expect } from "@jest/globals";

import { EmailService, WeatherClient } from "./services.js";
import type { EmailSender } from "./services.js";

// ---------------------------------------------------------------------------
// 1. The footgun TypeScript closes: an untyped fake accepts anything
// ---------------------------------------------------------------------------

test("a fake declared as the interface must match it", () => {
  // Declaring the type is what does the work. Rename `send` to `sned` here and
  // this stops compiling; in the JavaScript version it compiled and the test
  // passed while the code under test called a method that did not exist.
  const fake: Pick<EmailSender, "send"> = {
    send: jest.fn<EmailSender["send"]>(),
  };
  expect(fake.send).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// 2. jest.spyOn catches a nonexistent method — now at compile time
// ---------------------------------------------------------------------------

test("spyOn throws when the method does not exist", () => {
  const service = new EmailService();
  // `jest.spyOn(service, "sned")` is a compile error: "sned" is not a key of
  // EmailService. Forcing past the type is the only way to reach the runtime
  // check, and the cast is what makes the bypass visible in review.
  const typoName = "sned" as unknown as keyof EmailService;
  expect(() => jest.spyOn(service, typoName)).toThrow();
});

test("spyOn works for a real method", () => {
  const service = new EmailService();
  const spy = jest.spyOn(service, "send").mockResolvedValue(true);
  expect(typeof service.send).toBe("function");
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

// ---------------------------------------------------------------------------
// 3. spyOn preserves the real implementation until you override it
// ---------------------------------------------------------------------------

test("spy can record calls while still running the real method", async () => {
  const service = new EmailService();
  // No mockImplementation → the real send runs, but the spy records the call.
  const spy = jest.spyOn(service, "send");

  const result = await service.send("a@x.com", "Hi", "body");

  expect(result).toBe(true); // real return value
  expect(spy).toHaveBeenCalledWith("a@x.com", "Hi", "body");
  spy.mockRestore();
});

test("mockRestore puts the original method back", async () => {
  const service = new EmailService();
  // The JS version faked a string here. send() returns Promise<boolean>, so the
  // compiler now requires a boolean — which is the signature checking this
  // module is about. false is distinguishable from the real true.
  const spy = jest.spyOn(service, "send").mockResolvedValue(false);

  expect(await service.send("a@x.com", "s", "b")).toBe(false);
  spy.mockRestore();
  expect(await service.send("a@x.com", "s", "b")).toBe(true); // real again
});

// ---------------------------------------------------------------------------
// 4. Asserting exact call arguments
// ---------------------------------------------------------------------------

test("assert the precise arguments a method was called with", async () => {
  const service = new EmailService();
  const spy = jest.spyOn(service, "sendWelcome").mockResolvedValue(true);

  await service.sendWelcome("alice@example.com");

  expect(spy).toHaveBeenCalledWith("alice@example.com");
  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});

// ---------------------------------------------------------------------------
// 5. Spying on a real instance of a class the other file mocks
//    01_mock_module.test.ts replaces the whole services module, so it cannot
//    reach the real WeatherClient. ESM has no jest.requireActual. Keeping the
//    real-instance test in a file that never mocks is the ESM answer.
// ---------------------------------------------------------------------------

test("spyOn a method on a real instance", async () => {
  const client = new WeatherClient();
  jest.spyOn(client, "getTemperature").mockResolvedValue(5);

  expect(await client.isHot("Oslo")).toBe(false);
});
