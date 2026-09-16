/**
 * 04_reliability.ts — Retries, Backoff, and Idempotency
 *
 * Real webhook delivery needs:
 *   1. Retries with exponential backoff (1s, 2s, 4s…) so a struggling receiver
 *      isn't hammered.
 *   2. At-least-once delivery — retrying means a receiver may get an event twice;
 *      the sender can't guarantee exactly-once.
 *   3. Idempotency on the receiver — track processed event IDs and skip dupes.
 *
 * Two Express apps in one module (sender + receiver). The /flaky endpoint fails
 * twice then succeeds, and the /processed count stays 1 thanks to idempotency.
 *
 * Run:  npx tsx 04_reliability.ts   (receiver :8001, sender :8000)
 *   curl -X POST 'localhost:8000/webhooks/register?url=http://localhost:8001/flaky'
 *   curl -X POST 'localhost:8000/orders?item=headphones'
 *   curl localhost:8001/processed
 */

import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import express from "express";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_ATTEMPTS = 5;
const BASE_DELAY = 1000; // ms, doubles each retry

// ── Sender ──────────────────────────────────────────────────────────────────

// The envelope the sender delivers and the receiver de-duplicates on.
interface WebhookEvent {
  id: string;
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// One row of the receiver's processed log.
interface ProcessedEntry {
  id: string;
  event: string;
  via?: string;
}

const senderApp = express();
senderApp.use(express.json());
// Declared with its element type, because it starts empty.
const registeredUrls: string[] = [];

senderApp.post("/webhooks/register", (req, res) => {
  // Express 5 types a query value as string | string[] | ParsedQs, since a
  // client can repeat a name. Only a single string is a usable URL.
  const url = typeof req.query.url === "string" ? req.query.url : undefined;
  if (url && !registeredUrls.includes(url)) registeredUrls.push(url);
  res.json({ registered: url });
});

senderApp.post("/orders", (req, res) => {
  const orderId = crypto.randomUUID().slice(0, 8);
  const event: WebhookEvent = {
    id: `evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    event: "order.created",
    timestamp: new Date().toISOString(),
    data: { order_id: orderId, item: String(req.query.item ?? "") },
  };
  void dispatchWithRetry(event, [...registeredUrls]);
  res.json({ order_id: orderId });
});

async function tryDeliver(url: string, body: string): Promise<boolean> {
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(5000),
    });
    return resp.status < 500;
  } catch {
    return false;
  }
}

async function dispatchWithRetry(event: WebhookEvent, urls: string[]): Promise<void> {
  const body = JSON.stringify(event);
  for (const url of urls) {
    let delivered = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      if (await tryDeliver(url, body)) {
        console.log(`[Delivered] ${event.event} → ${url} (attempt ${attempt})`);
        delivered = true;
        break;
      }
      const delay = BASE_DELAY * 2 ** (attempt - 1);
      console.log(`[Retry ${attempt}/${MAX_ATTEMPTS}] ${url} — backing off ${delay / 1000}s`);
      // eslint-disable-next-line no-await-in-loop
      if (attempt < MAX_ATTEMPTS) await sleep(delay);
    }
    if (!delivered) console.log(`[Dead letter] ${event.id} → ${url} gave up after ${MAX_ATTEMPTS} attempts`);
  }
}

// ── Receiver ────────────────────────────────────────────────────────────────

const receiverApp = express();
receiverApp.use(express.json());
const processedIds = new Set<string>();
const processedLog: ProcessedEntry[] = [];
let flakyCalls = 0;

receiverApp.post("/webhook", (req, res) => {
  // The body arrives unvalidated from the network, so this is a claim about
  // its shape rather than a check of it.
  const { id, event } = req.body as { id: string; event: string };
  if (processedIds.has(id)) {
    console.log(`[Duplicate] ${id} — skipping`);
    return res.json({ status: "duplicate" });
  }
  processedIds.add(id);
  processedLog.push({ id, event });
  console.log(`[Processed] ${id}`);
  return res.json({ status: "ok" });
});

receiverApp.post("/flaky", (req, res) => {
  flakyCalls += 1;
  if (flakyCalls <= 2) {
    console.log(`[Flaky] call #${flakyCalls} — returning 500`);
    return res.status(500).json({ error: "temporary failure" });
  }
  // The body arrives unvalidated from the network, so this is a claim about
  // its shape rather than a check of it.
  const { id, event } = req.body as { id: string; event: string };
  if (processedIds.has(id)) {
    console.log(`[Duplicate] ${id} — skipping (flaky endpoint)`);
    return res.json({ status: "duplicate" });
  }
  processedIds.add(id);
  processedLog.push({ id, event, via: "flaky" });
  console.log(`[Processed] ${id} (flaky endpoint, call #${flakyCalls})`);
  return res.json({ status: "ok" });
});

receiverApp.get("/processed", (_req, res) => res.json({ count: processedLog.length, events: processedLog }));

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  receiverApp.listen(8001, () => console.log("receiver on http://localhost:8001"));
  senderApp.listen(8000, () => console.log("sender on http://localhost:8000"));
}

export { senderApp, receiverApp };
