/**
 * Concept 02 — Message Building
 *
 * An email is structured as MIME (Multipurpose Internet Mail Extensions): a tree
 * of "parts" so one message can carry text, HTML, and attachments together.
 *
 *   Plain text only:           text/plain
 *   HTML + plain fallback:     multipart/alternative { text/plain, text/html }
 *   HTML + attachment:         multipart/mixed { multipart/alternative, file }
 *
 * With nodemailer you never build that tree by hand. You pass a flat options
 * object and it assembles the correct MIME structure:
 *
 *   { text }                          → text/plain
 *   { text, html }                    → multipart/alternative
 *   { text, html, attachments: [...] }→ multipart/mixed
 *
 * Address fields accept strings, "Name <addr>" strings, arrays, or
 * { name, address } objects.
 *
 * HOW TO RUN:
 *   docker compose up -d
 *   npx tsx 02_message_building.ts
 *   Open http://localhost:8025 — you should see four messages.
 */

import { fileURLToPath } from "node:url";

import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

const FROM = { name: "My App", address: "app@example.com" };

const transport = nodemailer.createTransport({
  host: "localhost",
  port: 1025,
  secure: false,
});

// nodemailer's own Options type describes every field a message may carry, so
// a misspelled header here is a compile error rather than a silently dropped
// field.
async function send(message: SMTPTransport.Options): Promise<void> {
  const info = await transport.sendMail(message);
  console.log(`   Sent: ${JSON.stringify(message.subject)} (${info.messageId})`);
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("CONCEPT 02 — Message Building");
  console.log("=".repeat(60));

  // ── 1. Plain text ──────────────────────────────────────────────────────
  console.log("\n1. Plain text message:");
  await send({
    from: FROM, // nodemailer formats this as "My App <app@example.com>"
    to: "alex@example.com",
    subject: "Test 1 — Plain text",
    text: "Hello Alex,\n\nThis is a plain text email.\n\n— My App",
  });

  // ── 2. HTML + plain-text fallback ──────────────────────────────────────
  // Providing both `text` and `html` produces multipart/alternative. Clients
  // that render HTML show the html part; others fall back to text.
  console.log("\n2. HTML + plain-text fallback (multipart/alternative):");
  await send({
    from: FROM,
    to: "alex@example.com",
    subject: "Test 2 — HTML email",
    text: "Hello Alex,\n\nThis is the plain text fallback.",
    html: `<html>
  <body>
    <h2>Hello Alex,</h2>
    <p>This is an <strong>HTML</strong> email with a plain-text fallback.</p>
  </body>
</html>`,
  });

  // ── 3. Multiple recipients, CC, BCC, Reply-To, custom headers ──────────
  // BCC recipients are delivered but never appear in the message headers —
  // nodemailer handles the envelope/header split for you.
  console.log("\n3. Multiple To, CC, BCC, Reply-To, custom header:");
  await send({
    from: FROM,
    to: ["alex@example.com", "dana@example.com"],
    cc: "boss@example.com",
    bcc: "secret@example.com",
    replyTo: "support@example.com",
    subject: "Test 3 — Multiple recipients",
    headers: { "X-Campaign-ID": "welcome-series-01" }, // custom X- headers for tracking
    text: "This goes to Alex and Dana, CC's the boss.",
  });

  // ── 4. File attachments ────────────────────────────────────────────────
  // `attachments` accepts Buffers, strings, streams, or file paths. content +
  // contentType + filename is the most common shape.
  console.log("\n4. Email with attachments:");
  await send({
    from: FROM,
    to: "alex@example.com",
    subject: "Test 4 — Attachment",
    text: "Please find the report attached.",
    html: "<p>Please find the report attached.</p>",
    attachments: [
      {
        filename: "report.csv",
        content: "name,score\nAlex,95\nDana,88\nJordan,72\n",
        contentType: "text/csv",
      },
      {
        filename: "report.pdf",
        content: Buffer.from("%PDF-1.4 fake content for demo"),
        contentType: "application/octet-stream",
      },
    ],
  });

  console.log("\nAll done. Open http://localhost:8025 to inspect all four messages.");
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { transport, send };
