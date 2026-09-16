/**
 * 03_signing.ts — Webhook Signature Verification
 *
 * Anyone who knows your webhook URL can POST fake events. Signatures prove the
 * event came from the real sender (Stripe-style):
 *
 *   Sender:   HMAC-SHA256(secret, "{timestamp}.{body}") → X-Webhook-Signature
 *             + X-Webhook-Timestamp headers
 *   Receiver: recompute the HMAC with the shared secret; reject on mismatch
 *             (tampered) or stale timestamp (replay).
 *
 * The shared secret lives on both sides and is never sent in a request. Node's
 * `crypto.timingSafeEqual` does the constant-time compare (a plain === leaks
 * where the strings first differ).
 *
 * Run:  npx tsx 03_signing.ts
 */

import { fileURLToPath } from "node:url";

import crypto from "node:crypto";

const SECRET = "shared-webhook-secret-never-send-this-in-a-request";
const TOLERANCE_SECONDS = 300; // reject events older than 5 minutes

// ── Sender side ─────────────────────────────────────────────────────────────

function sign(body: string, timestamp: number, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex");
}

// The three headers a signed webhook carries. Naming the return type is what
// makes headers["X-Webhook-Signature"] below a string rather than a maybe.
interface SignedHeaders {
  "Content-Type": string;
  "X-Webhook-Timestamp": string;
  "X-Webhook-Signature": string;
}

function buildSignedHeaders(body: string, secret: string): SignedHeaders {
  const ts = Math.floor(Date.now() / 1000);
  return {
    "Content-Type": "application/json",
    "X-Webhook-Timestamp": String(ts),
    "X-Webhook-Signature": sign(body, ts, secret),
  };
}

// ── Receiver side ───────────────────────────────────────────────────────────

function verify(
  body: string,
  timestamp: number,
  receivedSig: string,
  secret: string
): void {
  const age = Math.abs(Date.now() / 1000 - timestamp);
  if (age > TOLERANCE_SECONDS) throw new Error(`Event is ${age.toFixed(0)}s old — possible replay attack`);

  const expected = sign(body, timestamp, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(receivedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Signature mismatch — payload may have been tampered");
  }
}

function demo(): void {
  const payload = { event: "payment.succeeded", id: "evt_abc123", data: { amount: 4999 } };
  const body = JSON.stringify(payload);
  const headers = buildSignedHeaders(body, SECRET);
  const ts = Number(headers["X-Webhook-Timestamp"]);
  const sig = headers["X-Webhook-Signature"];

  console.log("=== Sender ===");
  console.log(`  Timestamp : ${ts}`);
  console.log(`  Signature : ${sig.slice(0, 32)}…`);

  const tryVerify = (label: string, b: string, t: number, s: string): void => {
    console.log(`\n=== Receiver: ${label} ===`);
    try {
      verify(b, t, s, SECRET);
      console.log("  OK — signature verified");
    } catch (err) {
      console.log(`  REJECTED — ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  tryVerify("valid event", body, ts, sig);
  tryVerify("tampered payload (amount → 0)", JSON.stringify({ ...payload, data: { amount: 0 } }), ts, sig);
  const oldTs = Math.floor(Date.now() / 1000) - 600;
  tryVerify("replay attack (10 minutes old)", body, oldTs, sign(body, oldTs, SECRET));
  tryVerify("wrong secret", body, ts, sign(body, ts, "wrong-secret"));
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) demo();

export { sign, verify, buildSignedHeaders };
