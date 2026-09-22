/**
 * Cluster
 * ========
 * One Node process uses one core. A 12-core machine running one Node process is
 * using 8% of the CPU you paid for.
 *
 * `cluster` forks N copies of the process. They share a listening socket, and
 * the OS (or Node's round-robin scheduler) hands each incoming connection to
 * one of them. Every worker is a full process with its own memory and its own
 * event loop, so one worker blocking or crashing does not stop the others.
 *
 * The thing to internalise: workers share NOTHING. No variables, no in-memory
 * cache, no sessions, no rate-limit counters, no WebSocket connection registry.
 * Anything that must be seen by every worker goes in Redis or a database. This
 * is the same constraint as running N containers, which is why the usual advice
 * is to skip `cluster` and let your orchestrator run N replicas — it gets you
 * rolling restarts, health checks and per-instance limits for free.
 *
 * Cluster still earns its place when you have one big machine and no
 * orchestrator, or want to use every core inside a single container.
 *
 * Run:  npx tsx 05_cluster.ts          (forks, load-tests itself, exits)
 *       WORKERS=8 npx tsx 05_cluster.ts
 */

import cluster from "node:cluster";
import http from "node:http";
import os from "node:os";
import { fileURLToPath } from "node:url";

const PORT = 8123;
const WORKERS = Number(process.env.WORKERS || Math.min(4, os.cpus().length));
const REQUESTS = 60;

// ---------------------------------------------------------------------------
// Worker: an ordinary HTTP server. Nothing here knows it is in a cluster.
// ---------------------------------------------------------------------------
function startWorker(): void {
  // A per-worker counter, to make the "workers share nothing" point concrete.
  // Each process has its own copy starting at zero.
  let handled = 0;

  const server = http.createServer((req, res) => {
    handled += 1;
    if (req.url === "/burn") {
      // Block THIS worker for 200ms. The others keep serving, which is the
      // difference between cluster and a single process.
      const until = Date.now() + 200;
      while (Date.now() < until) {
        /* spin */
      }
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ pid: process.pid, handledByThisWorker: handled }));
  });

  server.listen(PORT);

  // The primary tells workers to stop once the demo is done. A real service
  // does this on SIGTERM: stop accepting, finish in-flight requests, then exit.
  process.on("message", (msg) => {
    if (msg === "shutdown") {
      server.close(() => process.exit(0));
    }
  });
}

// ---------------------------------------------------------------------------
// Primary: fork, drive some load through, report, shut down.
// ---------------------------------------------------------------------------
// `agent` matters here more than it looks. Node's default global agent keeps
// connections alive, and a cluster balances CONNECTIONS, not requests — so every
// request reusing one socket lands on the same worker. Passing `agent: false`
// opens a fresh connection each time, which is what spreads the load.
function get(path: string, agent: http.Agent | false = false): Promise<{ pid: number }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ port: PORT, path, agent }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
  });
}

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    try {
      await get("/");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("workers never came up");
}

async function startPrimary(): Promise<void> {
  console.log("=== Cluster ===");
  console.log(`primary pid ${process.pid} on a ${os.cpus().length}-core machine`);
  console.log(`forking ${WORKERS} workers, all listening on :${PORT}\n`);

  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  // A worker that dies gets replaced. Without this a crash permanently reduces
  // your capacity, and a crash loop is silent until every worker is gone.
  cluster.on("exit", (worker, code, signal) => {
    if (code !== 0 && !worker.exitedAfterDisconnect) {
      console.log(`  worker ${worker.process.pid} died (${signal || code}) — replacing it`);
      cluster.fork();
    }
  });

  await waitForServer();

  // --- Distribution, one connection per request -----------------------------
  console.log(`--- ${REQUESTS} requests, a new connection each time ---`);
  const byPid = new Map<number, number>();
  for (let i = 0; i < REQUESTS; i++) {
    const { pid } = await get("/");
    byPid.set(pid, (byPid.get(pid) ?? 0) + 1);
  }
  for (const [pid, count] of [...byPid].sort((a, b) => a[0] - b[0])) {
    console.log(`  worker ${pid}: ${String(count).padStart(3)} requests  ${"█".repeat(count)}`);
  }
  console.log(`  spread over ${byPid.size} workers — one socket, N processes accepting.\n`);

  // --- The same load over one kept-alive connection -------------------------
  // This is the trap. Cluster hands out CONNECTIONS, so a client that reuses
  // one gets one worker for its entire session, however much traffic it sends.
  console.log(`--- the same ${REQUESTS} requests over a single keep-alive connection ---`);
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  const keepAlivePids = new Map<number, number>();
  for (let i = 0; i < REQUESTS; i++) {
    const { pid } = await get("/", agent);
    keepAlivePids.set(pid, (keepAlivePids.get(pid) ?? 0) + 1);
  }
  for (const [pid, count] of [...keepAlivePids].sort((a, b) => a[0] - b[0])) {
    console.log(`  worker ${pid}: ${String(count).padStart(3)} requests  ${"█".repeat(count)}`);
  }
  agent.destroy();
  console.log(`  ${keepAlivePids.size} worker(s). Every modern HTTP client keeps connections`);
  console.log(`  alive by default, so a proxy in front of this — or a browser, or`);
  console.log(`  another service — pins itself to one worker and your other cores`);
  console.log(`  idle. Balance at the proxy, or accept connection-level skew.\n`);

  // --- One worker blocked ---------------------------------------------------
  console.log("--- One worker blocked for 200ms, others still serving ---");
  const blocked = get("/burn");
  await new Promise((r) => setTimeout(r, 10)); // let /burn get picked up first

  const timings = await Promise.all(
    Array.from({ length: 8 }, async () => {
      const t = Date.now();
      await get("/");
      return Date.now() - t;
    })
  );
  await blocked;

  const fast = timings.filter((t) => t < 100).length;
  const slow = timings.length - fast;
  console.log(`  8 normal requests sent while one worker span for 200ms`);
  console.log(`  ${fast} returned in under 100ms; ${slow} waited behind the busy worker`);
  console.log(`  (timings: ${timings.map((t) => `${t}ms`).join(", ")})`);
  console.log("  A single process would have made all eight wait. Note that cluster");
  console.log("  does NOT route around a busy worker — whoever accepted the");
  console.log("  connection owns it, so some requests still queue. More workers");
  console.log("  reduce the odds; they do not remove them.\n");

  console.log("--- What workers do NOT share ---");
  console.log(`
  Each worker reported its own handledByThisWorker counter, and they are all
  different. That counter is the simplest possible example of state that looks
  fine in development, where you run one process, and silently breaks in
  production, where you run N:

    in-memory rate limiting   → each worker allows the full quota, so the real
                                limit is N times what you configured
    in-memory sessions        → a user is logged in on one worker and anonymous
                                on the next request
    in-memory caches          → N copies, N cold starts, N invalidation misses
    WebSocket connections     → a broadcast reaches only the clients attached
                                to the worker that sent it

  All four are fixed the same way: move the state to Redis. ../rate-limiting/
  and ../caching/ already do it that way, and this is why.`);

  for (const worker of Object.values(cluster.workers ?? {})) {
    worker?.send("shutdown");
  }
  setTimeout(() => process.exit(0), 500);
}

if (cluster.isPrimary && process.argv[1] === fileURLToPath(import.meta.url)) {
  void startPrimary();
} else if (!cluster.isPrimary) {
  startWorker();
}

export { startWorker };
