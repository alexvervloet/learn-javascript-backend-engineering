/**
 * Concept 04 — Testing Email
 *
 * Two complementary strategies for testing email:
 *
 *   UNIT TESTS — use a fake transport so nothing hits the network. nodemailer
 *     ships `jsonTransport: true`, which serialises the message instead of
 *     sending it. Fast, isolated, CI-friendly. Assert the message was built
 *     correctly (recipient, subject, parts).
 *
 *   INTEGRATION TESTS — send to Mailpit and query its HTTP API to assert
 *     receipt. Catches real rendering/delivery bugs. Requires Docker, so they're
 *     gated behind MAILPIT=1 and skipped in normal `npm test` runs.
 *
 * Unit tests verify your *code*; integration tests verify the *email* end-to-end.
 *
 * HOW TO RUN:
 *   npm test                                  # unit tests only
 *   docker compose up -d && MAILPIT=1 npm test -- email-concepts   # + integration
 */

import { describe, test, expect, beforeEach } from "@jest/globals";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type JSONTransport from "nodemailer/lib/json-transport/index.js";

// The JSON transport serialises each message onto info.message instead of
// sending it, so its SentMessageInfo is the type these tests work with.
type JsonTransporter = Transporter<JSONTransport.SentMessageInfo>;

const MAILPIT_API = "http://localhost:8025/api/v1";

// ---------------------------------------------------------------------------
// Application code under test. The transport is injected so the same functions
// run against the JSON transport in unit tests and against Mailpit in
// integration tests — dependency inversion, no mocking required.
// ---------------------------------------------------------------------------

// Generic over the transport's result type, which is the point the module is
// making: the same function runs against the JSON transport in unit tests and a
// real SMTP transport in integration tests, and the signature says so instead of
// picking one.
async function sendWelcomeEmail<T>(
  transport: Transporter<T>,
  to: string,
  name: string
): Promise<T> {
  return transport.sendMail({
    from: { name: "My App", address: "app@example.com" },
    to,
    subject: `Welcome to My App, ${name}!`,
    text: `Hi ${name}, thanks for signing up!`,
    html: `<h1>Hi ${name}!</h1><p>Thanks for signing up!</p>`,
  });
}

async function sendPasswordReset<T>(
  transport: Transporter<T>,
  to: string,
  token: string
): Promise<T> {
  return transport.sendMail({
    from: "app@example.com",
    to,
    subject: "Reset your password",
    text: `Your reset link: https://example.com/reset?token=${token}`,
  });
}

// `jsonTransport` serialises each message to JSON on `info.message` instead of
// sending it — the cleanest fake for unit tests.
// The serialised message is arbitrary JSON as far as the compiler knows, so the
// shape the assertions rely on is stated here rather than assumed at each one.
interface SentMessage {
  from: { name?: string; address: string };
  to: { name?: string; address: string }[];
  subject: string;
  text?: string;
  html?: string;
}

function parseSent(info: JSONTransport.SentMessageInfo): SentMessage {
  return JSON.parse(info.message) as SentMessage;
}

// ---------------------------------------------------------------------------
// UNIT TESTS — JSON transport, no network
// ---------------------------------------------------------------------------

describe("sendWelcomeEmail (unit)", () => {
  const transport = nodemailer.createTransport({ jsonTransport: true });

  test("addresses the message to the given recipient", async () => {
    const info = await sendWelcomeEmail(transport, "alex@example.com", "Alex");
    const msg = parseSent(info);
    expect(msg.to[0].address).toBe("alex@example.com");
  });

  test("subject contains the recipient's name", async () => {
    const info = await sendWelcomeEmail(transport, "x@example.com", "Dana");
    expect(parseSent(info).subject).toContain("Dana");
  });

  test("includes an HTML part", async () => {
    const info = await sendWelcomeEmail(transport, "x@example.com", "Jordan");
    expect(parseSent(info).html).toContain("<h1>");
  });
});

describe("sendPasswordReset (unit)", () => {
  const transport = nodemailer.createTransport({ jsonTransport: true });

  test("reset link with token is in the body", async () => {
    const info = await sendPasswordReset(transport, "user@example.com", "tok_secret_xyz");
    const msg = parseSent(info);
    expect(msg.text).toContain("tok_secret_xyz");
    expect(msg.text).toContain("https://example.com/reset");
  });

  test("has the expected subject line", async () => {
    const info = await sendPasswordReset(transport, "user@example.com", "tok");
    expect(parseSent(info).subject).toBe("Reset your password");
  });
});

// ---------------------------------------------------------------------------
// INTEGRATION TESTS — send to Mailpit, query its API. Gated behind MAILPIT=1.
// ---------------------------------------------------------------------------

const integration = process.env.MAILPIT ? describe : describe.skip;

integration("sendWelcomeEmail (integration, Mailpit)", () => {
  const transport = nodemailer.createTransport({ host: "localhost", port: 1025, secure: false });

  beforeEach(async () => {
    await fetch(`${MAILPIT_API}/messages`, { method: "DELETE" });
  });

  // Mailpit's REST responses arrive as unknown from fetch().json(), so the
  // fields these tests read are declared rather than assumed.
  interface MailpitList {
    total: number;
    messages: { ID: string; Subject: string; To: { Address: string }[] }[];
  }

  interface MailpitMessage {
    HTML: string;
    Text: string;
  }

  test("email arrives in Mailpit", async () => {
    await sendWelcomeEmail(transport, "alex@example.com", "Alex");
    const data = (await fetch(`${MAILPIT_API}/messages`).then((r) =>
      r.json()
    )) as MailpitList;
    expect(data.total).toBe(1);
    expect(data.messages[0]?.To[0]?.Address).toBe("alex@example.com");
    expect(data.messages[0]?.Subject).toContain("Welcome");
  });

  test("both HTML and text parts are delivered", async () => {
    await sendWelcomeEmail(transport, "test@example.com", "Tester");
    const list = (await fetch(`${MAILPIT_API}/messages`).then((r) =>
      r.json()
    )) as MailpitList;
    const full = (await fetch(`${MAILPIT_API}/message/${list.messages[0]?.ID}`).then((r) =>
      r.json()
    )) as MailpitMessage;
    expect(full.HTML).toBeTruthy();
    expect(full.Text).toBeTruthy();
  });
});

export { sendWelcomeEmail, sendPasswordReset };
