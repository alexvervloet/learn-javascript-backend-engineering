/**
 * 02_sender.ts — The Sender Side
 *
 * Now our service fires webhooks when something happens:
 *   1. Consumers register a URL with us.
 *   2. On an event, we POST to every registered URL.
 *   3. We don't block the main request on delivery.
 *
 * Uses the built-in `fetch` (Node 18+) — no HTTP-client dependency needed.
 *
 * Run (with 01_receiver.ts on :8001):  npx tsx 02_sender.ts   (listens on :8000)
 *   curl -X POST 'localhost:8000/webhooks/register?url=http://localhost:8001/webhook'
 *   curl -X POST 'localhost:8000/orders?item=keyboard'
 */

import { fileURLToPath } from "node:url";

import crypto from "node:crypto";
import express from "express";

// The envelope every webhook in this folder sends. Naming it keeps the sender
// and the receiver from drifting apart without a compile error.
interface WebhookEvent {
  id: string;
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const app = express();
app.use(express.json());

const registeredUrls: string[] = [];

app.post("/webhooks/register", (req, res) => {
  // Express 5 types a query value as string | string[] | ParsedQs, since a
  // client can repeat a name. Only a single string is a usable URL.
  const url = typeof req.query.url === "string" ? req.query.url : undefined;
  if (url && !registeredUrls.includes(url)) registeredUrls.push(url);
  res.json({ registered: url, total_registered: registeredUrls.length });
});

app.get("/webhooks", (_req, res) => res.json(registeredUrls));

app.post("/orders", (req, res) => {
  const orderId = crypto.randomUUID().slice(0, 8);
  const event: WebhookEvent = {
    id: `evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    event: "order.created",
    timestamp: new Date().toISOString(),
    data: { order_id: orderId, item: String(req.query.item ?? "") },
  };
  // Fire and forget — the response doesn't wait for delivery.
  void dispatchWebhooks(event);
  res.json({ order_id: orderId, status: "created" });
});

async function dispatchWebhooks(event: WebhookEvent): Promise<void> {
  const body = JSON.stringify(event);
  await Promise.all(
    registeredUrls.map(async (url) => {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(5000),
        });
        console.log(`[Dispatched] ${event.event} → ${url} (${resp.status})`);
      } catch (err) {
        console.log(`[Dispatch failed] ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(8000, () => console.log("sender on http://localhost:8000"));
}

export { app };
