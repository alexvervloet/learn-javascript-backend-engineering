/**
 * Concept 05 — The Transactional Email Pattern
 *
 * In production you rarely send via raw SMTP. You use a transactional email
 * service (Resend, Postmark, SendGrid, SES). They manage deliverability (IP
 * reputation, DKIM, bounces), analytics, retries, and rate limits, and you call
 * an HTTP API instead of juggling SMTP credentials everywhere.
 *
 * The right architecture is an abstraction layer:
 *   - Define an `EmailSender` shape: `send(email) -> { id, status }`.
 *   - Write concrete senders: `SmtpSender` (dev/test) and `ResendSender` (prod).
 *   - Pick the sender from environment config, not hardcoded in callers.
 *   - Business logic (sendWelcome, sendReset) talks to the interface.
 *
 * Same dependency-inversion pattern used for databases:
 *   app → Repository → { SQLite (test) | Postgres (prod) }
 *   app → EmailSender → { SmtpSender (dev) | ResendSender (prod) }
 *
 * JS note: there's no `abstract class` keyword, but "an object with a `send`
 * method" is the idiomatic interface — duck typing. We use a base class only to
 * document the contract and fail loudly if a subclass forgets to implement it.
 *
 * HOW TO RUN:
 *   docker compose up -d
 *   npx tsx 05_transactional_pattern.ts
 *   Open http://localhost:8025 to see the email.
 */

import { fileURLToPath } from "node:url";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// ---------------------------------------------------------------------------
// The EmailSender contract
// ---------------------------------------------------------------------------

// The message every backend accepts, and the result every backend returns.
// Writing both down is what makes the two senders below interchangeable in a
// checkable way rather than by convention.
interface Email {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName: string;
  fromAddress: string;
  replyTo?: string;
  tags?: string[];
}

interface SendResult {
  id: string;
  status: string;
}

// `abstract` is the TypeScript form of what the JavaScript version expressed by
// throwing from the base method: a subclass that forgets send() now fails to
// compile instead of failing on the first email it tries to deliver.
abstract class EmailSender {
  abstract send(email: Email): Promise<SendResult>;
}

// ---------------------------------------------------------------------------
// Backend 1 — SMTP via nodemailer (local dev / integration tests → Mailpit)
// ---------------------------------------------------------------------------

class SmtpSender extends EmailSender {
  private transport: Transporter;

  constructor({ host = "localhost", port = 1025 }: { host?: string; port?: number } = {}) {
    super();
    this.transport = nodemailer.createTransport({ host, port, secure: false });
  }

  override async send(email: Email): Promise<SendResult> {
    const info = await this.transport.sendMail({
      from: { name: email.fromName, address: email.fromAddress },
      to: email.to,
      replyTo: email.replyTo,
      subject: email.subject,
      text: email.text || `Please view this email in an HTML-capable client.\n\n${email.subject}`,
      html: email.html,
    });
    return { id: info.messageId, status: "sent" };
  }
}

// ---------------------------------------------------------------------------
// Backend 2 — Resend HTTP API (production)
//
// To run for real: set RESEND_API_KEY and construct with { simulate: false }.
// ---------------------------------------------------------------------------

class ResendSender extends EmailSender {
  static API_URL = "https://api.resend.com/emails";

  private apiKey: string | undefined;
  private simulate: boolean;

  constructor({ apiKey, simulate = true }: { apiKey?: string; simulate?: boolean } = {}) {
    super();
    this.apiKey = apiKey;
    this.simulate = simulate;
  }

  override async send(email: Email): Promise<SendResult> {
    const payload = {
      from: `${email.fromName} <${email.fromAddress}>`,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text || email.subject,
      tags: (email.tags ?? []).map((name) => ({ name, value: "1" })),
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    };

    if (this.simulate) {
      console.log(`   [Resend SIMULATED] POST ${ResendSender.API_URL}`);
      console.log(`   payload keys: ${Object.keys(payload).join(", ")}`);
      return { id: "resend-simulated-id-001", status: "simulated" };
    }

    const res = await fetch(ResendSender.API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Resend error ${res.status}: ${await res.text()}`);
    }
    // fetch().json() is unknown — nothing guarantees a remote API's shape.
    const data = (await res.json()) as { id: string };
    return { id: data.id, status: "sent" };
  }
}

// ---------------------------------------------------------------------------
// Business logic — talks to the interface, not a backend
// ---------------------------------------------------------------------------

class EmailService {
  private sender: EmailSender;

  constructor(sender: EmailSender) {
    this.sender = sender;
  }

  async sendWelcome(to: string, name: string, verifyToken: string): Promise<SendResult> {
    const verifyUrl = `https://myapp.example.com/verify?token=${verifyToken}`;
    const result = await this.sender.send({
      to,
      subject: `Welcome to My App, ${name}!`,
      html: `<h1>Hi ${name}!</h1><p>Click <a href="${verifyUrl}">here</a> to verify.</p>`,
      text: `Hi ${name},\n\nVerify your account: ${verifyUrl}\n`,
      fromName: "My App",
      fromAddress: "app@example.com",
      tags: ["welcome", "onboarding"],
    });
    console.log(`   sendWelcome → ${JSON.stringify(result)}`);
    return result;
  }

  async sendPasswordReset(to: string, name: string, token: string): Promise<SendResult> {
    const resetUrl = `https://myapp.example.com/reset?token=${token}`;
    const result = await this.sender.send({
      to,
      subject: "Reset your password",
      html: `<p>Hi ${name}, <a href="${resetUrl}">reset your password</a>.</p>`,
      text: `Hi ${name},\n\nReset your password: ${resetUrl}\n`,
      fromName: "My App",
      fromAddress: "app@example.com",
      replyTo: "support@myapp.example.com",
      tags: ["password-reset", "transactional"],
    });
    console.log(`   sendPasswordReset → ${JSON.stringify(result)}`);
    return result;
  }
}

// ---------------------------------------------------------------------------
// Factory — choose backend from environment
// ---------------------------------------------------------------------------

function makeEmailService() {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    console.log("   Using ResendSender (RESEND_API_KEY is set)");
    return new EmailService(new ResendSender({ apiKey, simulate: false }));
  }
  console.log("   Using SmtpSender → Mailpit (no RESEND_API_KEY in env)");
  return new EmailService(new SmtpSender());
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("CONCEPT 05 — Transactional Email Pattern");
  console.log("=".repeat(60));

  console.log("\n1. Dev mode (SmtpSender → Mailpit):");
  const dev = new EmailService(new SmtpSender());
  await dev.sendWelcome("alex@example.com", "Alex", "tok_verify_abc");
  await dev.sendPasswordReset("alex@example.com", "Alex", "tok_reset_xyz");

  console.log("\n2. Production mode (ResendSender, simulate=true — no real API call):");
  const prod = new EmailService(new ResendSender({ apiKey: "fake-key", simulate: true }));
  await prod.sendWelcome("dana@example.com", "Dana", "tok_verify_def");

  console.log("\n3. Factory (auto-detects from environment):");
  const service = makeEmailService();
  await service.sendWelcome("user@example.com", "User", "tok_factory_ghi");

  console.log("\nCheck http://localhost:8025 for messages sent via SmtpSender.");
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { EmailSender, SmtpSender, ResendSender, EmailService, makeEmailService };
