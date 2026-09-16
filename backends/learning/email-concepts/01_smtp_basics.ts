/**
 * Concept 01 — SMTP Basics
 *
 * SMTP (Simple Mail Transfer Protocol) is the protocol your code uses to *submit*
 * an email to a mail server, which then delivers it to the recipient.
 *
 *                  your code
 *                     │
 *              nodemailer transport
 *                     │
 *             ┌───────▼────────┐
 *             │  SMTP server   │  ← Mailpit locally, Gmail/SES in prod
 *             └───────┬────────┘
 *                     │
 *             ┌───────▼────────┐
 *             │  Recipient's   │
 *             │  mail server   │
 *             └────────────────┘
 *
 * In Node the de-facto library is **nodemailer**. You create a *transport* once
 * and reuse it. The `secure` flag + port decide the connection mode:
 *
 *   { port: 25,  secure: false }                 Plain text — never in production
 *   { port: 587, secure: false, requireTLS:true} STARTTLS — upgrades mid-connection
 *   { port: 465, secure: true }                  TLS from the first byte (preferred)
 *
 * Mailpit listens on 1025 and accepts plain connections — ideal for local dev
 * (no certs, no real credentials).
 *
 * HOW TO RUN:
 *   docker compose up -d
 *   npx tsx 01_smtp_basics.ts
 *   Open http://localhost:8025 to see the email in Mailpit's web UI.
 */

import { fileURLToPath } from "node:url";

import nodemailer from "nodemailer";

const SMTP_HOST = "localhost";
const SMTP_PORT = 1025; // Mailpit
const FROM_ADDR = "app@example.com";
const TO_ADDR = "alex@example.com";

// ---------------------------------------------------------------------------
// One transport, reused for every send.
// ---------------------------------------------------------------------------

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false, // Mailpit is plain text
});

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("CONCEPT 01 — SMTP Basics");
  console.log("=".repeat(60));

  // ── 1. Plain SMTP send ────────────────────────────────────────────────
  console.log("\n1. Plain SMTP send (Mailpit on port 1025):");
  // verify() runs the SMTP handshake (like EHLO) without sending — handy as a
  // startup health check.
  await transport.verify();
  console.log(`   Connection to ${SMTP_HOST}:${SMTP_PORT} verified`);
  const info = await transport.sendMail({
    from: FROM_ADDR,
    to: TO_ADDR,
    subject: "Test 1 — Plain SMTP",
    text: "Hello from plain SMTP!",
  });
  console.log(`   Message sent: ${info.messageId}. Check http://localhost:8025`);

  // ── 2. STARTTLS pattern (shown, not run against Mailpit) ──────────────
  console.log("\n2. STARTTLS pattern (port 587 — Gmail/SendGrid):");
  console.log(`
   nodemailer.createTransport({
     host: "smtp.gmail.com",
     port: 587,
     secure: false,        // start plain…
     requireTLS: true,     // …then require the STARTTLS upgrade
     auth: { user: "you@gmail.com", pass: "app-password" },
   });
  `);

  // ── 3. Implicit TLS pattern (port 465) ───────────────────────────────
  console.log("3. Implicit TLS pattern (port 465 — TLS from the start):");
  console.log(`
   nodemailer.createTransport({
     host: "smtp.example.com",
     port: 465,
     secure: true,         // TLS wraps the whole connection
     auth: { user: "user@example.com", pass: "password" },
   });
  `);

  // ── 4. Debugging the SMTP conversation ───────────────────────────────
  // logger + debug print every SMTP command/response — useful for delivery bugs.
  console.log("4. Debug transport (logger: true, debug: true):");
  const debugTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    logger: true,
    debug: true,
  });
  await debugTransport.sendMail({
    from: FROM_ADDR,
    to: TO_ADDR,
    subject: "Test 2 — Debug mode",
    text: "Watching SMTP commands fly by.",
  });

  console.log("\nAll done. Open http://localhost:8025 to see the two messages.");
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { transport };
