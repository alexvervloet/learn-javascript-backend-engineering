/**
 * Concept 05 — Periodic Jobs (BullMQ Job Schedulers)
 *
 * So far jobs are enqueued by your code calling queue.add(). A *Job Scheduler*
 * enqueues a job automatically on a schedule — cron jobs managed inside Node.
 * There's no separate scheduler process: a scheduler lives in the queue itself,
 * and any running Worker will pick up the jobs it produces.
 *
 *   queue.upsertJobScheduler(id, repeatOpts, template)
 *
 * `repeatOpts` is either:
 *   - { every: ms }                 → fixed interval in milliseconds
 *   - { pattern: "30 9 * * 1-5" }   → cron expression
 *
 * `upsert` means it's idempotent and keyed by `id`: calling it again with the
 * same id updates the schedule instead of creating a duplicate.
 *
 * Cron fields are the standard 5: minute hour day-of-month month day-of-week.
 *
 * HOW TO RUN THIS FILE:
 *   Terminal 1:  docker compose up
 *   Terminal 2:  npx tsx 05_periodic_tasks.ts
 *
 * This file registers the schedulers, starts a worker, and runs for ~25s so you
 * can watch the 10-second health check fire a couple of times, then cleans up
 * the schedulers and exits.
 */

import { fileURLToPath } from "node:url";

import { Queue, Worker } from "bullmq";
import { connection } from "./connection.js";

const QUEUE_NAME = "periodic_tasks";

// ---------------------------------------------------------------------------
// Job logic
// ---------------------------------------------------------------------------

const handlers = {
  healthCheck() {
    console.log("[beat] Health check: all systems OK");
    return "ok";
  },
  cleanupExpiredSessions() {
    console.log("[beat] Cleaning up expired sessions...");
    return "cleaned";
  },
  generateDailyReport() {
    console.log("[beat] Generating daily report...");
    return "report generated";
  },
  syncExternalData(source: string) {
    console.log(`[beat] Syncing data from ${source}...`);
    return `synced: ${source}`;
  },
};

// ---------------------------------------------------------------------------
// Schedule definitions. Each scheduler has a stable id, a repeat spec, and a
// job template.
// ---------------------------------------------------------------------------

const schedules = [
  // Every 10 seconds (so you see it fire quickly in the demo).
  { id: "health-check-every-10s", repeat: { every: 10_000 }, name: "healthCheck" },

  // Every minute.
  { id: "cleanup-sessions-every-minute", repeat: { every: 60_000 }, name: "cleanupExpiredSessions" },

  // cron: every day at 08:00 UTC.
  { id: "daily-report-8am", repeat: { pattern: "0 8 * * *" }, name: "generateDailyReport" },

  // cron: weekdays (Mon–Fri) at 09:30 UTC, with data.
  {
    id: "sync-crm-weekday-morning",
    repeat: { pattern: "30 9 * * 1-5" },
    name: "syncExternalData",
    data: { source: "crm" },
  },

  // cron: every Sunday at midnight UTC.
  {
    id: "sync-warehouse-weekly",
    repeat: { pattern: "0 0 * * 0" },
    name: "syncExternalData",
    data: { source: "data_warehouse" },
  },
];

// ---------------------------------------------------------------------------
// cron cheat sheet (minute hour day-of-month month day-of-week)
// ---------------------------------------------------------------------------
//   * * * * *        → every minute
//   0 * * * *        → every hour, on the hour
//   0 */2 * * *      → every 2 hours
//   30 7 * * 1-5     → 7:30 AM on weekdays
//   0 0 1 1 *        → once a year (Jan 1st, midnight)

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("CONCEPT 05 — Periodic Jobs (Job Schedulers)");
  console.log("=".repeat(60));

  const queue = new Queue(QUEUE_NAME, { connection });

  console.log("\nRegistering schedulers:");
  for (const s of schedules) {
    await queue.upsertJobScheduler(s.id, s.repeat, {
      name: s.name,
      data: s.data ?? {},
    });
    const spec = s.repeat.every ? `every ${s.repeat.every / 1000}s` : `cron "${s.repeat.pattern}"`;
    console.log(`  ${s.id}  →  ${s.name}  (${spec})`);
  }

  const worker = new Worker(
    QUEUE_NAME,
    // job.name is a string off the queue, so the handler table is indexed as a
    // Record and the miss is handled rather than assumed away.
    async (job) => {
      const handler = (handlers as Record<string, (source: string) => string>)[job.name];
      if (!handler) throw new Error(`No handler for job ${job.name}`);
      return handler((job.data as { source: string }).source);
    },
    { connection }
  );

  console.log("\nWatching for the 10s health check to fire (~25s)...\n");
  await new Promise((resolve) => setTimeout(resolve, 25_000));

  // Clean up the schedulers so repeated runs don't accumulate them.
  for (const s of schedules) await queue.removeJobScheduler(s.id);
  await worker.close();
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

export { handlers, schedules, QUEUE_NAME };
