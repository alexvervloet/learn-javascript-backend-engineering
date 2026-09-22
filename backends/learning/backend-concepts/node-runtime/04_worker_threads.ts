/**
 * Worker Threads
 * ===============
 * 01 showed that CPU-bound work blocks everything. Worker threads are the fix:
 * real OS threads, each with its own V8 isolate and its own event loop.
 *
 * What they are not is a general concurrency tool. Each worker costs a few MB
 * and tens of milliseconds to start, and nothing is shared by default — values
 * sent between threads are structured-cloned, so passing a big object costs a
 * copy at both ends.
 *
 * Use one when the work is CPU-bound and takes long enough to matter: image
 * resizing, hashing, compression, parsing a large document, crypto. Do NOT use
 * one for I/O. I/O is already off-thread in libuv, and wrapping a database
 * query in a worker makes it slower, not faster.
 *
 * This file is both the parent and the worker: `isMainThread` picks a side.
 * That keeps the demo to one file, and it is a real pattern.
 *
 * Run:  npx tsx 04_worker_threads.ts
 */

import os from "node:os";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

const here = fileURLToPath(import.meta.url);

// The CPU-bound job. Deliberately dumb arithmetic so it is obviously not I/O.
function crunch(iterations: number): number {
  let total = 0;
  for (let i = 0; i < iterations; i++) {
    total += Math.sqrt(i) * Math.sin(i);
  }
  return total;
}

const ITERATIONS = 20_000_000;

// ---------------------------------------------------------------------------
// Worker side. Runs when this file is loaded by `new Worker(here)`.
// ---------------------------------------------------------------------------
if (!isMainThread) {
  const result = crunch((workerData as { iterations: number }).iterations);
  parentPort?.postMessage(result);
}

// ---------------------------------------------------------------------------
// Parent side.
// ---------------------------------------------------------------------------

function runInWorker(iterations: number): Promise<number> {
  return new Promise((resolve, reject) => {
    // tsx registers a loader that lets a worker start from a .ts file. Plain
    // `node` would need the worker to be .js, or the same --import flag.
    const worker = new Worker(here, { workerData: { iterations } });
    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      // A worker that exits without posting a message would leave this promise
      // pending forever, so a non-zero exit has to reject explicitly.
      if (code !== 0) reject(new Error(`worker exited with code ${code}`));
    });
  });
}

// --- 1. On the main thread: everything stops --------------------------------
async function onMainThread(): Promise<void> {
  console.log("\n--- CPU work on the main thread ---");

  const gaps: number[] = [];
  let last = Date.now();
  const heartbeat = setInterval(() => {
    const now = Date.now();
    gaps.push(now - last);
    last = now;
  }, 10);

  const started = Date.now();
  const result = crunch(ITERATIONS);
  const elapsed = Date.now() - started;

  await new Promise((r) => setTimeout(r, 50));
  clearInterval(heartbeat);

  console.log(`  crunch() took ${elapsed}ms`);
  console.log(`  worst heartbeat gap during it: ${Math.max(...gaps)}ms`);
  console.log(`  every request in flight waited that long. (result ${result.toFixed(2)})`);
}

// --- 2. In a worker: the loop stays responsive ------------------------------
async function inWorker(): Promise<void> {
  console.log("\n--- The same work in a worker thread ---");

  const gaps: number[] = [];
  let last = Date.now();
  const heartbeat = setInterval(() => {
    const now = Date.now();
    gaps.push(now - last);
    last = now;
  }, 10);

  const started = Date.now();
  const result = await runInWorker(ITERATIONS);
  const elapsed = Date.now() - started;

  clearInterval(heartbeat);

  console.log(`  same crunch() took ${elapsed}ms wall clock (includes ~30ms worker startup)`);
  console.log(`  worst heartbeat gap during it: ${Math.max(...gaps)}ms`);
  console.log(`  the main thread kept serving. (result ${result.toFixed(2)})`);
}

// --- 3. A pool, because starting a worker is not free ------------------------
async function pool(): Promise<void> {
  console.log("\n--- Four workers in parallel ---");

  const jobs = 4;
  const started = Date.now();
  const results = await Promise.all(
    Array.from({ length: jobs }, () => runInWorker(ITERATIONS))
  );
  const elapsed = Date.now() - started;

  console.log(`  ${jobs} jobs of ${ITERATIONS.toLocaleString()} iterations each`);
  console.log(`  wall clock: ${elapsed}ms on a ${os.cpus().length}-core machine`);
  console.log(`  sequentially this would be roughly 4x the single-job time.`);
  console.log(`  (all results equal: ${results.every((r) => r === results[0])})`);
  console.log("");
  console.log("  In a real service you keep a pool of long-lived workers rather");
  console.log("  than spawning one per request — startup is milliseconds, and at");
  console.log("  request rates worth optimising that dominates. Node ships no");
  console.log("  pool; piscina is the usual choice, or write ~50 lines yourself.");
}

// --- 4. What crosses the boundary -------------------------------------------
function whatCrosses(): void {
  console.log("\n--- What actually crosses between threads ---");
  console.log(`
  Structured clone (the default)
      postMessage copies. Sending a 100MB object costs a 100MB allocation in
      the receiving thread plus the serialisation. For big payloads that copy
      can cost more than the work you moved off the main thread.

  Transferables
      postMessage(buf, [buf.buffer]) MOVES an ArrayBuffer instead of copying
      it. O(1), and the sender's buffer becomes unusable afterwards — that
      detachment is what makes it safe.

  SharedArrayBuffer
      Genuinely shared memory, no copy, and now you own the data races. Use
      Atomics for anything you did not just write yourself. Worth it for large
      numeric workloads, rarely worth it otherwise.

  Nothing else
      No shared globals, no shared module state, no closures. Each worker
      re-imports the module graph from scratch. A module-level cache in the
      parent is invisible to the worker, which surprises people once each.`);
}

async function main(): Promise<void> {
  console.log("=== Worker Threads ===");
  console.log(`(${os.cpus().length} logical cores available)`);
  await onMainThread();
  await inWorker();
  await pool();
  whatCrosses();
  console.log("\nNext: 05_cluster.ts — using every core for HTTP.");
}

if (isMainThread && process.argv[1] === here) {
  void main();
}

export { crunch, runInWorker };
