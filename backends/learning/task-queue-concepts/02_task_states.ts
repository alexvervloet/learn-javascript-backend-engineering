/**
 * Concept 02 — Job States & Progress
 *
 * Every BullMQ job moves through a lifecycle, stored in Redis:
 *
 *   waiting → active → completed
 *                    ↘ failed
 *           ↘ delayed (scheduled for later, then back to waiting)
 *
 * (There's also `waiting-children` for flows, and `prioritized`.)
 *
 * Notes:
 *   - An unknown job id resolves to state "unknown" — the queue genuinely
 *     doesn't have it.
 *   - For progress, call `job.updateProgress()`. Progress can be a number or an
 *     object and is delivered live via QueueEvents ("progress") or read from
 *     `job.progress`.
 *   - On failure, the thrown Error's message + stack are stored on the job
 *     (`job.failedReason`, `job.stacktrace`).
 *
 * HOW TO RUN THIS FILE:
 *   Terminal 1:  docker compose up
 *   Terminal 2:  npx tsx 02_task_states.ts
 */

import { fileURLToPath } from "node:url";

import { Queue, Worker, QueueEvents, Job } from "bullmq";
import { connection } from "./connection.js";

const QUEUE_NAME = "task_states";

// ---------------------------------------------------------------------------
// Job logic
// ---------------------------------------------------------------------------

// The progress payload this job reports. BullMQ accepts any JSON here, so
// naming the shape is what keeps the producer and the listener in step.
interface Progress {
  current: number;
  total: number;
  pct: number;
}

async function longRunningJob(
  job: Job,
  steps: number
): Promise<{ message: string; stepsCompleted: number }> {
  for (let i = 0; i < steps; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    // updateProgress pushes a custom payload a caller can read live.
    await job.updateProgress({
      current: i + 1,
      total: steps,
      pct: Math.round(((i + 1) / steps) * 100),
    });
  }
  return { message: "done", stepsCompleted: steps };
}

function alwaysFails() {
  throw new Error("This job always raises an exception.");
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("CONCEPT 02 — Job States & Progress");
  console.log("=".repeat(60));

  const queue = new Queue(QUEUE_NAME, { connection });
  const queueEvents = new QueueEvents(QUEUE_NAME, { connection });
  await queueEvents.waitUntilReady();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === "longRunningJob") return longRunningJob(job, job.data.steps);
      if (job.name === "alwaysFails") return alwaysFails();
      throw new Error(`Unknown job: ${job.name}`);
    },
    { connection }
  );

  // --- Normal lifecycle with live progress ---
  console.log("\n1. Normal lifecycle (waiting → active → completed), with progress:");
  const seen = new Set();
  const onProgress = ({ jobId, data }: { jobId: string; data: unknown }): void => {
    const key = JSON.stringify(data);
    if (!seen.has(key)) {
      console.log(`     progress job=${jobId.slice(0, 8)}… ${key}`);
      seen.add(key);
    }
  };
  queueEvents.on("progress", onProgress);

  const job = await queue.add("longRunningJob", { steps: 4 });
  const result = await job.waitUntilFinished(queueEvents);
  queueEvents.off("progress", onProgress);
  console.log(`   Final state: ${await job.getState()}`);
  console.log(`   Result:      ${JSON.stringify(result)}`);

  // --- Failure state ---
  console.log("\n2. Failure state:");
  const failing = await queue.add("alwaysFails", {}, { attempts: 1 });
  try {
    await failing.waitUntilFinished(queueEvents);
  } catch (err) {
    console.log(`   waitUntilFinished rejected: ${err instanceof Error ? err.message : String(err)}`);
  }
  // Job.id is optional on the type — a job that has not been added yet has
  // none — and fromId can return undefined for an id Redis does not know.
  const reloaded = failing.id ? await Job.fromId(queue, failing.id) : undefined;
  console.log(`   State:        ${await reloaded?.getState()}`);
  console.log(`   failedReason: ${reloaded?.failedReason}`);
  console.log(`   stack (1st line): ${reloaded?.stacktrace?.[0]?.split("\n")[0]}`);

  // --- Unknown job id ---
  console.log("\n3. Unknown job id resolves to 'unknown' (no record in Redis):");
  const ghost = await Job.fromId(queue, "does-not-exist");
  console.log(`   Job lookup: ${ghost}`); // undefined — no record in Redis

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

export { longRunningJob, alwaysFails, QUEUE_NAME };
