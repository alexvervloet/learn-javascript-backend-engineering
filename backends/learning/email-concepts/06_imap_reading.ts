/**
 * Concept 06 — Reading Email with IMAP
 *
 * IMAP (Internet Message Access Protocol) lets your code *read* a mailbox — the
 * receiving side of the email stack. Backend use cases: support-inbox
 * automation, email-to-action pipelines, parsing receipts/invoices, polling for
 * replies.
 *
 * In Node the modern client is **ImapFlow** (from the nodemailer author). It's
 * promise-based and hides the raw IMAP command protocol behind clean methods:
 *
 *   connect()                       → open + authenticate
 *   getMailboxLock("INBOX")         → SELECT, with a concurrency lock
 *   search({ ... })                 → returns matching message sequence numbers
 *   fetch(range, { envelope, ... }) → async-iterate messages
 *   messageFlagsAdd(range, flags)   → set \Seen, \Deleted, etc.
 *   logout()
 *
 * We use Mailpit's IMAP server (port 1143) so we can send test emails over SMTP
 * and immediately read them back. Mailpit accepts any IMAP credentials when
 * auth-accept-any is enabled.
 *
 * HOW TO RUN:
 *   docker compose up -d
 *   npx tsx 06_imap_reading.ts
 */

import { fileURLToPath } from "node:url";

import { ImapFlow } from "imapflow";
import type { ImapFlowOptions } from "imapflow";
import nodemailer from "nodemailer";

const SMTP = { host: "localhost", port: 1025, secure: false };
// Annotating the const keeps `logger: false` as the literal false ImapFlow
// accepts. Without it, TypeScript widens the property to boolean and the
// option no longer matches `Logger | false`.
const IMAP: ImapFlowOptions = {
  host: "localhost",
  port: 1143,
  secure: false,
  auth: { user: "any", pass: "any" },
  logger: false, // ImapFlow logs verbosely by default; quiet it for the demo
};

const transport = nodemailer.createTransport(SMTP);

// html is optional: two of the calls below deliberately send text-only mail.
// The JavaScript version declared four required parameters and the missing
// argument simply arrived as undefined.
async function sendTestEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  await transport.sendMail({ from: "sender@example.com", to, subject, text, html });
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("CONCEPT 06 — Reading Email with IMAP");
  console.log("=".repeat(60));

  // Seed Mailpit with messages to read back.
  console.log("\nSeeding Mailpit with test emails...");
  await sendTestEmail("inbox@example.com", "Invoice #1001",
    "Your invoice for $99.00 is attached.", "<p>Invoice <b>$99.00</b></p>");
  await sendTestEmail("inbox@example.com", "Support request: login broken",
    "Hi, I can't log in. Please help.");
  await sendTestEmail("inbox@example.com", "Invoice #1002",
    "Your invoice for $149.00 is ready.", "<p>Invoice <b>$149.00</b></p>");
  await sendTestEmail("other@example.com", "Unrelated email",
    "This one goes to a different address.");
  await new Promise((resolve) => setTimeout(resolve, 300)); // let Mailpit index

  const client = new ImapFlow(IMAP);

  // ── Connect and login ──────────────────────────────────────────────────
  console.log("\n1. Connect and authenticate:");
  await client.connect();
  console.log("   Authenticated");

  // ── List mailboxes ─────────────────────────────────────────────────────
  console.log("\n2. List mailboxes:");
  for (const mb of await client.list()) {
    console.log(`   ${mb.path}`);
  }

  // ── Select INBOX (with a lock) and read everything ─────────────────────
  const lock = await client.getMailboxLock("INBOX");
  try {
    console.log("\n3. Select INBOX:");
    // client.mailbox is `false | MailboxObject` — false when no mailbox is
    // selected — so the count is read through a check.
    const mailbox = client.mailbox;
    console.log(`   Messages in INBOX: ${mailbox ? mailbox.exists : 0}`);

    // ── Fetch and parse each message ─────────────────────────────────────
    console.log("\n4. Fetch and print each message:");
    for await (const msg of client.fetch("1:*", { envelope: true, bodyStructure: true })) {
      // envelope is optional on a fetch result: the server only returns it
      // because the query asked for it, and the type does not track that.
      const { envelope } = msg;
      const from = envelope?.from?.[0]?.address;
      const to = envelope?.to?.map((a) => a.address).join(", ");
      console.log(`\n   seq=${msg.seq}`);
      console.log(`   From:    ${from}`);
      console.log(`   To:      ${to}`);
      console.log(`   Subject: ${envelope?.subject}`);
    }

    // ── Search by subject keyword ────────────────────────────────────────
    console.log("\n5. Search SUBJECT containing 'Invoice':");
    // search() returns false when the mailbox is not selected, so the result is
    // normalised to an array before use.
    const invoiceIds = (await client.search({ subject: "Invoice" })) || [];
    console.log(`   Found ${invoiceIds.length} invoice message(s): seq ${invoiceIds.join(", ")}`);

    // ── Mark a message as read (set \Seen) ───────────────────────────────
    if (invoiceIds.length) {
      const first = invoiceIds[0];
      console.log(`\n6. Mark message ${first} as read:`);
      await client.messageFlagsAdd({ seq: String(first) }, ["\\Seen"]);
      const unseen = (await client.search({ seen: false })) || [];
      console.log(`   Unseen seq after marking: ${unseen.join(", ")}`);
      console.log(`   (message ${first} is gone from the unseen list)`);
    }

    // ── Download one message's text body ─────────────────────────────────
    console.log("\n7. Download the first message's text body:");
    const { content } = await client.download("1", undefined, { uid: false });
    const chunks = [];
    for await (const chunk of content) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    console.log(`   ${raw.split("\r\n\r\n").slice(1).join("\n").trim().slice(0, 60)}…`);
  } finally {
    lock.release();
  }

  await client.logout();
  console.log("\nDone. IMAP session closed.");
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { sendTestEmail };
