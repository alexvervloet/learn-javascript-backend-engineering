/**
 * Server-Sent Events (SSE)
 * =========================
 * SSE is a simpler, HTTP-based alternative to WebSockets for push-only feeds.
 * The server streams newline-delimited text; the browser's EventSource handles
 * reconnection automatically. Client → server isn't possible on the same channel.
 *
 *   SSE: server→client only, plain HTTP, auto-reconnect — feeds/logs/dashboards
 *   WS:  bidirectional, needs WS-aware proxies, manual reconnect — chat/games
 *
 * Wire format: `data: <text>\n\n` per event; `event: <name>\n` adds a named type.
 * In Express you set the headers and `res.write()` chunks (no framework helper).
 *
 * Run:  npx tsx 04_sse.ts
 *   curl -N localhost:8000/stream/temperature
 *   curl -N localhost:8000/stream/deploy-log
 *   or open http://localhost:8000
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import type { Response } from "express";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static(path.join(here, "static")));
app.get("/", (_req, res) => res.sendFile(path.join(here, "static", "sse.html")));

function sseHeaders(res: Response): void {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // tells nginx not to buffer this response
  });
  res.flushHeaders();
}

// Infinite sensor feed — one reading per second.
app.get("/stream/temperature", (req, res) => {
  sseHeaders(res);
  let temp = 20.0;
  const timer = setInterval(() => {
    temp += Math.random() * 0.6 - 0.3;
    const payload = JSON.stringify({ temperature: Number(temp.toFixed(1)), timestamp: new Date().toISOString() });
    res.write(`data: ${payload}\n\n`);
  }, 1000);
  req.on("close", () => clearInterval(timer)); // stop when the client disconnects
});

// Finite deploy log — ends with a named "done" event.
app.get("/stream/deploy-log", async (req, res) => {
  sseHeaders(res);
  const steps = [
    "Pulling Docker image...",
    "Running database migrations...",
    "Seeding fixtures...",
    "Starting application server...",
    "Health check: GET /health → 200 OK",
    "Deployment complete.",
  ];
  for (const step of steps) {
    if (res.writableEnded) return;
    res.write(`data: ${step}\n\n`);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  res.write("event: done\ndata: finished\n\n"); // named event the client can listen for
  res.end();
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(8000, () => console.log("SSE server on http://localhost:8000"));
}

export { app };
