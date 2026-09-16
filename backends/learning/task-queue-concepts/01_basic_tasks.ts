/**
 * Concept 01 — Defining and running jobs
 *
 * In BullMQ the unit of work is a *job* on a *queue*, not a decorated function.
 * You split the two sides of the system explicitly:
 *
 *   - A Queue is the producer handle. `queue.add(name, data, opts)` enqueues a
 *     job and returns a Job immediately.
 *   - A Worker is the consumer. You give it a processor function; it pulls jobs
 *     off the queue and runs them, in this or another process.
 *
 * Ways to enqueue:
 *   queue.add("add", { x, y })                    → run as soon as a worker is free
 *   queue.add("add", { x, y }, { delay: 10_000 }) → run after a 10s delay
 *
 * There's no "call the function directly and run it now" mode — the processor is
 * just a normal async function, so for synchronous use you call that function
 * yourself (see `add` below).
 *
 * To read a result you await `job.waitUntilFinished(queueEvents)`. Don't block
 * on that inside a web handler — enqueue and move on; that's the whole point.
 *
 * HOW TO RUN THIS FILE:
 *   Terminal 1 (broker):  docker compose up
 *   Terminal 2 (demo):    npx tsx 01_basic_tasks.ts
 *
 * This file starts its own worker in-process so a single `node` command shows
 * the full producer → worker → result round-trip.
 */

import { fileURLToPath } from "node:url";

import { Queue, Worker, QueueEvents } from "bullmq";
import { connection } from "./connection.js";

const QUEUE_NAME = "basic_tasks";

// ---------------------------------------------------------------------------
// Job logic — plain async functions. The worker dispatches on `job.name`.
// ---------------------------------------------------------------------------

function add(x: number, y: number): number {
  return x + y;
}

async function slowAdd(x: number, y: number): Promise<number> {
  // Simulates slow work (e.g. hitting an external API).
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return x + y;
}

async function sendWelcomeEmail(
  userEmail: string
): Promise<{ status: string; to: string }> {
  // In a real app this would call SES / SendGrid / SMTP.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log(`[worker] Sent welcome email to ${userEmail}`);
  return { status: "sent", to: userEmail };
}

// ---------------------------------------------------------------------------
// Worker — one processor handles every job name on the queue.
// ---------------------------------------------------------------------------

function startWorker() {
  return new Worker(
    QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case "add":
          return add(job.data.x, job.data.y);
        case "slowAdd":
          return slowAdd(job.data.x, job.data.y);
        case "sendWelcomeEmail":
          return sendWelcomeEmail(job.data.userEmail);
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    { connection }
  );
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("CONCEPT 01 — Basic Jobs");
  console.log("=".repeat(60));

  const queue = new Queue(QUEUE_NAME, { connection });
  const queueEvents = new QueueEvents(QUEUE_NAME, { connection });
  await queueEvents.waitUntilReady();
  const worker = startWorker();

  // --- Synchronous call (no broker, useful in tests) ---
  console.log("\n1. Direct call (synchronous, no worker):");
  console.log(`   add(10, 20) = ${add(10, 20)}`);

  // --- Async enqueue ---
  console.log("\n2. Async enqueue via queue.add():");
  const job = await queue.add("add", { x: 10, y: 20 });
  console.log(`   Job ID: ${job.id}`);
  console.log(`   State before finish: ${await job.getState()}`);
  const result = await job.waitUntilFinished(queueEvents);
  console.log(`   Result: ${result}`);
  console.log(`   State after finish: ${await job.getState()}`);

  // --- Delayed job (runs after a countdown) ---
  console.log("\n3. Delayed job (runs after 5s):");
  const delayed = await queue.add("slowAdd", { x: 7, y: 3 }, { delay: 5000 });
  console.log(`   Job ID: ${delayed.id}`);
  console.log("   Waiting (~8s total: 5s delay + 3s work)...");
  console.log(`   Result: ${await delayed.waitUntilFinished(queueEvents)}`);

  // --- Fire-and-forget ---
  console.log("\n4. Fire-and-forget (email send, we don't wait):");
  await queue.add("sendWelcomeEmail", { userEmail: "alex@example.com" });
  console.log("   Job enqueued. Worker will process it — we moved on immediately.");

  // Let the fire-and-forget job drain, then clean up.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await worker.close();
  await queueEvents.close();
  await queue.close();
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { add, slowAdd, sendWelcomeEmail, QUEUE_NAME, startWorker };
