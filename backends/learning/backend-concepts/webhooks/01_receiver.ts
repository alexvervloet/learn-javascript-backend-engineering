/**
 * 01_receiver.ts — The Receiver Side
 *
 * A webhook is just an HTTP POST someone else sends to your server (GitHub merges
 * a PR, Stripe processes a payment, …). Your job:
 *   1. Accept the POST.
 *   2. Return 2xx FAST, before doing real work.
 *   3. Do the actual work asynchronously / on a queue.
 *
 * Respond fast because senders have short timeouts (5–30s) and will retry — and
 * re-deliver the same event — if you're slow.
 *
 * Run:  npx tsx 01_receiver.ts   (listens on :8001)
 *   curl -X POST localhost:8001/webhook -H 'Content-Type: application/json' \
 *     -d '{"event":"order.created","id":"evt_001","data":{"order_id":42}}'
 */

import { fileURLToPath } from "node:url";

import express from "express";

// The envelope every webhook in this folder sends. Naming it keeps the sender
// and the receiver from drifting apart without a compile error.
interface WebhookEvent {
  id: string;
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface ReceivedEvent {
  received_at: string;
  event: string;
  id: string;
  payload: WebhookEvent;
}

const app = express();
app.use(express.json());

// Declared with its element type, because it starts empty and there is nothing
// for the compiler to infer from.
const receivedEvents: ReceivedEvent[] = [];

app.post("/webhook", (req, res) => {
  // The body arrives unvalidated from the network, so this is a claim about
  // its shape. A real receiver would parse it with Zod before trusting it.
  const payload = req.body as WebhookEvent;
  receivedEvents.push({
    received_at: new Date().toISOString(),
    event: payload.event,
    id: payload.id,
    payload,
  });
  console.log(`[Received] ${payload.event} id=${payload.id}`);

  // Kick off work without blocking the response. In production: enqueue instead.
  setImmediate(() => console.log(`[Processing] ${payload.event}: ${JSON.stringify(payload.data)}`));

  res.json({ status: "accepted" });
});

app.get("/events", (_req, res) => res.json(receivedEvents));

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(8001, () => console.log("receiver on http://localhost:8001"));
}

export { app };
