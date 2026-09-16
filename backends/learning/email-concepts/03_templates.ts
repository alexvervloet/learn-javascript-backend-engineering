/**
 * Concept 03 — Email Templates with Nunjucks
 *
 * Hardcoding HTML in JS strings doesn't scale. **Nunjucks** is the JavaScript
 * port of Jinja2 — same `{% extends %}` / `{% block %}` inheritance, same
 * `{{ var }}` interpolation, same auto-escaping. So template files port over
 * almost verbatim. Templates live in templates/:
 *
 *   base.njk            — shared header/footer/styles layout
 *   welcome.njk         — new user onboarding (extends base)
 *   password_reset.njk  — password reset link (extends base)
 *
 * Nunjucks auto-escapes by default, so an XSS payload in a `name` field is
 * rendered as inert text, not executed markup.
 *
 * Design note: Jinja2's demo extracted the subject from a `{% block subject %}`.
 * Nunjucks can't render a single block in isolation, so we keep the subject in
 * JS (and pass it into the template for the <title>). That's the idiomatic JS
 * split: the template owns the body, the calling code owns the subject.
 *
 * Production caveat: many email clients (Outlook especially) ignore <style>
 * blocks and only honour inline styles. Tools like `juice` inline CSS before
 * sending. This demo keeps a <style> block for readability.
 *
 * HOW TO RUN:
 *   npm install            (from the repo root)
 *   docker compose up -d
 *   npx tsx 03_templates.ts
 *   Open http://localhost:8025 to see the rendered emails.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import nodemailer from "nodemailer";
import nunjucks from "nunjucks";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

const FROM = { name: "My App", address: "app@example.com" };

// ---------------------------------------------------------------------------
// Template engine setup
// ---------------------------------------------------------------------------

const env = nunjucks.configure(path.join(here, "templates"), {
  autoescape: true, // escape HTML entities — the default, stated for clarity
});

// Globals available in every template without passing them explicitly.
env.addGlobal("year", new Date().getFullYear());

const transport = nodemailer.createTransport({
  host: "localhost",
  port: 1025,
  secure: false,
});

// ---------------------------------------------------------------------------
// Render + send helpers
// ---------------------------------------------------------------------------

// What the render helpers below hand to sendEmail.
interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendEmail({ to, subject, html, text }: OutgoingEmail): Promise<void> {
  const info = await transport.sendMail({
    from: FROM,
    to,
    subject,
    text: text || `Please view this email in an HTML-capable mail client.\n\n${subject}`,
    html,
  });
  console.log(`   Sent to ${to}: ${JSON.stringify(subject)} (${info.messageId})`);
}

// ---------------------------------------------------------------------------
// Email-sending functions (what your app would call)
// ---------------------------------------------------------------------------

async function sendWelcomeEmail(
  to: string,
  name: string,
  verifyToken: string
): Promise<void> {
  const verifyUrl = `https://myapp.example.com/verify?token=${verifyToken}`;
  const subject = `Welcome to My App, ${name}!`;
  const html = env.render("welcome.njk", { subject, name, verifyUrl });
  const text = `Hi ${name},\n\nVerify your email: ${verifyUrl}\n\n— My App`;
  await sendEmail({ to, subject, html, text });
}

async function sendPasswordReset(
  to: string,
  name: string,
  resetToken: string,
  expiresMinutes = 30
): Promise<void> {
  const resetUrl = `https://myapp.example.com/reset?token=${resetToken}`;
  const subject = "Reset your password";
  const html = env.render("password_reset.njk", {
    subject,
    name,
    email: to,
    resetUrl,
    expiresMinutes,
  });
  const text =
    `Hi ${name},\n\nReset your password: ${resetUrl}\n` +
    `This link expires in ${expiresMinutes} minutes.\n\n— My App`;
  await sendEmail({ to, subject, html, text });
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("CONCEPT 03 — Email Templates with Nunjucks");
  console.log("=".repeat(60));

  console.log("\n1. Welcome email (new user signup):");
  await sendWelcomeEmail("newuser@example.com", "Alex", "tok_abc123xyz");

  console.log("\n2. Password reset email:");
  await sendPasswordReset("alex@example.com", "Alex", "reset_def456uvw", 30);

  console.log("\n3. Auto-escaping XSS attempt in name field:");
  await sendWelcomeEmail("hacker@example.com", '<script>alert("xss")</script>', "tok_safe");
  console.log("   The <script> tag is escaped in the rendered HTML — open Mailpit to verify.");

  console.log("\nAll done. Open http://localhost:8025 to inspect rendered emails.");
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { env, sendWelcomeEmail, sendPasswordReset };
