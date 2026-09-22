/**
 * The Event Loop
 * ===============
 * Node runs your JavaScript on one thread. Everything you know about Node's
 * concurrency follows from that single fact: nothing else runs while your code
 * is running, and "async" means "come back to me later", never "in parallel".
 *
 * The loop cycles through phases. The ones worth knowing:
 *
 *   timers          → setTimeout / setInterval callbacks whose time has come
 *   pending         → some system-level callbacks
 *   poll            → wait for I/O, run I/O callbacks (this is where time goes)
 *   check           → setImmediate callbacks
 *   close           → 'close' handlers
 *
 * Between every callback, Node drains two queues that are NOT phases and always
 * jump ahead of the next one:
 *
 *   process.nextTick queue   → drained first, completely
 *   microtask queue          → then promises, completely
 *
 * "Completely" is the dangerous word. A nextTick callback that queues another
 * nextTick callback starves the loop forever, which 04 demonstrates.
 *
 * Run:  npx tsx 01_event_loop.ts
 */

import { fileURLToPath } from "node:url";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// --- 1. Ordering ------------------------------------------------------------
// The classic interview question, and genuinely useful: it tells you which of
// your callbacks wins a race.
//
// It also has a wrinkle that almost every article on the subject gets wrong,
// and that this repo runs into by default. Run the same four schedulers from a
// callback and from the top level of an ES module and you get two different
// answers. See the comment under `orderingAtTopLevel` for why.
function scheduleFour(): { seen: string[]; done: Promise<string[]> } {
  const seen: string[] = [];
  setTimeout(() => seen.push("setTimeout 0"), 0);
  setImmediate(() => seen.push("setImmediate"));
  Promise.resolve().then(() => seen.push("promise"));
  process.nextTick(() => seen.push("nextTick"));
  seen.push("synchronous");

  // Give every phase a chance to run before reading the result.
  const done = new Promise<string[]>((resolve) => setTimeout(() => resolve(seen), 10));
  return { seen, done };
}

async function ordering(): Promise<void> {
  console.log("\n--- Ordering: from inside a callback ---");
  // Scheduled from a timer callback, so the loop is in a normal phase and the
  // documented rule holds: nextTick drains first, then promises.
  const fromCallback = await new Promise<string[]>((resolve) => {
    setTimeout(() => {
      void scheduleFour().done.then(resolve);
    }, 0);
  });
  console.log(`  ${fromCallback.join("  →  ")}`);
  console.log("  sync, then the nextTick queue, then the microtask queue,");
  console.log("  and only then does the loop move on to its phases.");

  console.log("\n--- Ordering: from the top level of an ES module ---");
  const fromModuleBody = await scheduleFour().done;
  console.log(`  ${fromModuleBody.join("  →  ")}`);
  console.log("  promise and nextTick have swapped. Not a bug:");
  console.log("  an ES module body is itself evaluated as a microtask, so the");
  console.log("  microtask queue is ALREADY draining. A .then() queued here");
  console.log("  joins the drain in progress; nextTick has to wait for it to");
  console.log("  finish. In CommonJS the module body runs synchronously and");
  console.log("  you get the textbook order instead.");
  console.log("  Worth knowing because this repo is ESM everywhere, so the");
  console.log("  order you read about is not the order you get at file scope.");
}

// --- 2. setTimeout(0) vs setImmediate ---------------------------------------
// At the top level these two race and the winner is genuinely nondeterministic:
// it depends on how long the process took to start relative to the timer's 1ms
// floor. Inside an I/O callback the order is fixed, because the loop is already
// past the timers phase and reaches `check` first.
async function timeoutVsImmediate(): Promise<void> {
  console.log("\n--- setTimeout(0) vs setImmediate, inside an I/O callback ---");
  const fs = await import("node:fs");
  await new Promise<void>((resolve) => {
    fs.readFile(fileURLToPath(import.meta.url), () => {
      const order: string[] = [];
      setTimeout(() => order.push("setTimeout"), 0);
      setImmediate(() => {
        order.push("setImmediate");
        setTimeout(() => {
          console.log(`  ${order.join("  →  ")}`);
          console.log("  setImmediate always wins here: the poll phase hands off");
          console.log("  to check before looping back around to timers.");
          resolve();
        }, 10);
      });
    });
  });
}

// --- 3. Blocking the loop ---------------------------------------------------
// This is the one that matters in production. A CPU-bound loop does not just
// make itself slow — it makes every other pending request wait, because there
// is no other thread to serve them.
async function blocking(): Promise<void> {
  console.log("\n--- Blocking the loop ---");

  // A heartbeat that should fire every 10ms.
  const ticks: number[] = [];
  let last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    ticks.push(now - last);
    last = now;
  }, 10);

  await sleep(60);

  // Now hog the CPU for ~300ms. Nothing else can run.
  const until = Date.now() + 300;
  let churn = 0;
  while (Date.now() < until) {
    churn += Math.sqrt(churn + 1);
  }

  await sleep(60);
  clearInterval(timer);

  const worst = Math.max(...ticks);
  console.log(`  heartbeat was scheduled every 10ms`);
  console.log(`  longest gap actually observed: ${worst}ms`);
  console.log(`  that gap is every user's request queued behind a busy loop.`);
  console.log(`  (churn=${churn.toFixed(0)}, kept so the work is not optimised away)`);
}

// --- 4. Starving the loop with nextTick -------------------------------------
// process.nextTick runs before the loop continues, and its queue is drained
// completely. A nextTick that schedules another nextTick never lets go.
function starvation(): Promise<void> {
  return new Promise((resolve) => {
    console.log("\n--- nextTick starvation ---");
    let depth = 0;
    let timerFired = false;

    setTimeout(() => {
      timerFired = true;
    }, 0);

    const recurse = (): void => {
      depth += 1;
      if (depth < 1000) {
        // In real code this is usually accidental: a recursive nextTick in an
        // error path, or a library draining a queue the wrong way.
        process.nextTick(recurse);
        return;
      }
      console.log(`  drained ${depth} nextTick callbacks back to back`);
      console.log(`  the 0ms timer fired during that: ${timerFired}`);
      console.log(`  it could not — the loop never got to its timers phase.`);
      resolve();
    };
    process.nextTick(recurse);
  });
}

// --- 5. Measuring lag -------------------------------------------------------
// You cannot fix what you cannot see. Event loop lag is the single most useful
// health metric a Node service can export; it goes up before anything else does.
async function measuringLag(): Promise<void> {
  console.log("\n--- Measuring event loop lag ---");
  const { monitorEventLoopDelay } = await import("node:perf_hooks");

  // A histogram maintained by libuv itself, so measuring costs almost nothing.
  // This belongs next to the prom-client gauges in ../observability/.
  const histogram = monitorEventLoopDelay({ resolution: 5 });
  histogram.enable();

  await sleep(50);
  const until = Date.now() + 200;
  while (Date.now() < until) {
    /* block */
  }
  await sleep(50);

  histogram.disable();
  const ms = (n: number): string => (n / 1e6).toFixed(1);
  console.log(`  mean: ${ms(histogram.mean)}ms   p99: ${ms(histogram.percentile(99))}ms   max: ${ms(histogram.max)}ms`);
  console.log("  export p99 as a gauge and alert on it. A healthy service sits");
  console.log("  near zero; anything above ~50ms means requests are queueing.");
}

async function main(): Promise<void> {
  console.log("=== The Event Loop ===");
  await ordering();
  await timeoutVsImmediate();
  await blocking();
  await starvation();
  await measuringLag();
  console.log("\nNext: 02_streams.ts — how to handle data that does not fit in memory.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}

export { ordering, blocking, starvation };
