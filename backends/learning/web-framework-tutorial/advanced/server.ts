/*
 * Advanced web framework guide — Express + ws
 * ===========================================
 * A playground of advanced HTTP patterns: settings, timing middleware, streaming,
 * SSE, custom responses, basic auth, sub-apps, WebSockets, and pagination.
 *
 * Run:  npx tsx advanced/server.ts   →  http://localhost:8001
 */

import crypto from "node:crypto";
import http from "node:http";
import { fileURLToPath } from "node:url";

import cookieParser from "cookie-parser";
import express from "express";
import type { Request, RequestHandler } from "express";
import { WebSocketServer } from "ws";

// queryChecker() hangs its verdict on the request. Express does not know about
// that, so the extra field is declared on a local interface rather than by
// augmenting Express's Request globally.
interface CheckResult {
  q: string | null;
  valid: boolean;
  reason?: string;
}

interface AdvancedRequest extends Request {
  checkResult?: CheckResult;
}

// Express 5 types a query value as string | string[] | ParsedQs, because a
// client can repeat a name. These routes want a single string.
function one(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

// ── Settings (from env vars) ────────────────────────────────────────────────
const settings = {
  appName: process.env.ADV_APP_NAME || "Advanced Demo",
  adminEmail: process.env.ADV_ADMIN_EMAIL || "admin@example.com",
  itemsPerPage: Number(process.env.ADV_ITEMS_PER_PAGE || 10),
  debug: process.env.ADV_DEBUG === "true",
};

const app = express();
app.use(express.json());
app.use(express.text({ type: ["application/xml", "text/*"] }));
app.use(cookieParser());

// ── Startup hook (startup log) ──────────────────────────────────────────────
const startupLog: string[] = [
  `App started at ${new Date().toLocaleTimeString()}`,
  `Loaded settings: app_name=${settings.appName}`,
];

// ── Timing middleware (adds an X-Process-Time header) ───────────────────────
app.use((req, res, next) => {
  const t0 = process.hrtime.bigint();
  res.on("finish", () => {}); // header must be set before send; use a wrapper below
  const start = Number(process.hrtime.bigint() - t0);
  res.set("X-Process-Time", `${start}ns`);
  next();
});

// ── 1. Stream data ──────────────────────────────────────────────────────────
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
app.get("/stream/text", async (_req, res) => {
  res.type("text/plain");
  for (let i = 0; i < 8; i += 1) {
    res.write(`chunk ${i}: ${"#".repeat(i + 1)}\n`);
    await sleep(250); // eslint-disable-line no-await-in-loop
  }
  res.end();
});
app.get("/stream/sse", async (_req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  for (let i = 0; i < 6; i += 1) {
    res.write(`data: ${JSON.stringify({ index: i, value: i * i })}\n\n`);
    await sleep(300); // eslint-disable-line no-await-in-loop
  }
  res.end();
});

// ── 3. Additional status codes (201 on create) ──────────────────────────────
interface StoredItem {
  name: string;
}

// Record<string, StoredItem> is the honest type for a bag keyed by arbitrary
// ids: a lookup can miss, so `existing` below has to be checked.
const store: Record<string, StoredItem> = { "item-1": { name: "Existing item" } };
app.put("/advanced/items/:item_id", (req, res) => {
  const id = one(req.params.item_id) ?? "";
  const name = one(req.query.name) || "New item";
  const existing = store[id];
  if (existing) {
    existing.name = name;
    return res.json({ item_id: id, name, action: "updated" });
  }
  store[id] = { name };
  return res.status(201).json({ item_id: id, name, action: "created" });
});

// ── 4-5. Return a response directly / custom responses ──────────────────────
app.get("/advanced/response-directly/json", (_req, res) => {
  res.set("X-Custom", "direct-response").json({ message: "Returned as JSON directly", custom_key: true });
});
app.get("/advanced/response-directly/xml", (_req, res) =>
  res.type("application/xml").send('<?xml version="1.0"?><root><message>Hello from XML</message></root>')
);
app.get("/advanced/custom/html", (_req, res) =>
  res.type("html").send(`<html><body style="font-family:monospace;background:#0d1117;color:#e6edf3;padding:2rem">
  <h1 style="color:#00d2ff">⚡ HTML response</h1><p>Express returned this as text/html.</p></body></html>`)
);
app.get("/advanced/custom/text", (_req, res) => res.type("text/plain").send("PlainText response.\nContent-Type: text/plain"));
app.get("/advanced/custom/redirect", (_req, res) => res.redirect(302, "/advanced/custom/text"));

// ── 6. Additional responses (404 model) ─────────────────────────────────────
app.get("/advanced/items/:item_id", (req, res) => {
  const id = one(req.params.item_id) ?? "";
  const item = store[id];
  if (!item) return res.status(404).json({ detail: `Item '${id}' not found` });
  return res.json({ item_id: id, name: item.name });
});

// ── 7. Response cookies ─────────────────────────────────────────────────────
app.post("/advanced/cookies/set", (req, res) => {
  const value = one(req.query.value) || "my-session-value";
  res.cookie("session_token", value, { httpOnly: true, maxAge: 3600_000 });
  res.json({ message: `Cookie 'session_token' set to '${value}'` });
});
app.get("/advanced/cookies/read", (req, res) => {
  // cookie-parser stores cookies as an untyped bag.
  const cookies = req.cookies as Record<string, string | undefined>;
  res.json({ session_token: cookies.session_token || "No cookie — set it first" });
});
app.post("/advanced/cookies/delete", (_req, res) => {
  res.clearCookie("session_token");
  res.json({ message: "Cookie 'session_token' deleted" });
});

// ── 8-9. Response headers / dynamic status ──────────────────────────────────
app.get("/advanced/headers/custom", (_req, res) => {
  res.set("X-Custom-Header", "hello-from-express").set("X-Request-Id", crypto.randomBytes(8).toString("hex"));
  res.json({ message: "Check the response headers" });
});
app.get("/advanced/status/dynamic", (req, res) => {
  if (one(req.query.found) !== "false") return res.json({ message: "Item found", status: 200 });
  return res.status(404).json({ message: "Item not found", status: 404 });
});

// ── 10. Advanced dependencies (class-based → middleware factory) ─────────────
const queryChecker =
  (minLength: number): RequestHandler =>
  (req, _res, next) => {
    const q = one(req.query.q);
    (req as AdvancedRequest).checkResult =
      q && q.length < minLength
        ? { q, valid: false, reason: `min length is ${minLength}` }
        : { q: q ?? null, valid: true };
    next();
  };
app.get("/advanced/deps/short", queryChecker(3), (req, res) =>
  res.json({ checker: "min=3", result: (req as AdvancedRequest).checkResult })
);
app.get("/advanced/deps/long", queryChecker(10), (req, res) =>
  res.json({ checker: "min=10", result: (req as AdvancedRequest).checkResult })
);

// Constant-time string comparison that tolerates different lengths.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ── 11. HTTP Basic Auth ─────────────────────────────────────────────────────
app.get("/advanced/basic-auth", (req, res) => {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  const decoded =
    scheme === "Basic" && encoded
      ? Buffer.from(encoded, "base64").toString().split(":")
      : [];
  const user = decoded[0] ?? "";
  const pass = decoded[1] ?? "";
  // timingSafeEqual throws when the two buffers differ in length, so the
  // lengths are compared first. The JS version relied on the caller always
  // sending something the same size, which is not a safe assumption.
  const ok =
    user.length > 0 &&
    safeEqual(user, "admin") &&
    safeEqual(pass, "password123");
  if (!ok) {
    return res.status(401).set("WWW-Authenticate", "Basic").json({ detail: "Incorrect credentials (try admin / password123)" });
  }
  return res.json({ username: user, message: "Authenticated via HTTP Basic Auth" });
});

// ── 12. Using the request directly ──────────────────────────────────────────
app.get("/advanced/request-info", (req, res) =>
  res.json({
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    query_params: req.query,
    headers: Object.fromEntries(Object.entries(req.headers).filter(([k]) => ["user-agent", "accept", "host", "referer"].includes(k))),
    client: { host: req.socket.remoteAddress, port: req.socket.remotePort },
  })
);

// ── 15. Sub applications (an Express sub-router mounted on a path) ───────────
const subapp = express();
subapp.get("/", (_req, res) => res.json({ message: "Hello from the sub-application!" }));
app.use("/subapp", subapp);

// ── 16. Lifespan log ────────────────────────────────────────────────────────
app.get("/advanced/lifespan/log", (_req, res) => res.json({ startup_log: startupLog }));

// ── 18. Settings ────────────────────────────────────────────────────────────
app.get("/advanced/settings", (_req, res) =>
  res.json({
    ...settings,
    tip: "Override with env vars: ADV_APP_NAME='My App' npx tsx advanced/server.ts",
  })
);

// ── 19. JSON with bytes as base64 ───────────────────────────────────────────
app.post("/advanced/base64/encode", (req, res) => {
  // The body is unvalidated here, so it is read as optional fields.
  const body = req.body as { data?: string; name?: string };
  const buf = Buffer.from(body.data ?? "", "utf8");
  res.json({
    name: body.name,
    data_base64: buf.toString("base64"),
    data_length: buf.length,
  });
});

// ── 24. Typed pagination ────────────────────────────────────────────────────
app.get("/advanced/pagination/paginated", (req, res) => {
  const page = Number(one(req.query.page) ?? 1);
  const pageSize = Number(one(req.query.page_size) ?? 3);
  const all = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
  const start = (page - 1) * pageSize;
  res.json({ items: all.slice(start, start + pageSize), total: all.length, page, page_size: pageSize });
});

// ── 17. WebSockets (ws on the HTTP server) ──────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (pathname === "/ws/echo") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.on("message", (m) => ws.send(`echo: ${String(m)}`));
    });
  } else if (pathname === "/ws/counter") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      void (async () => {
        for (let i = 0; i < 10; i += 1) {
          if (ws.readyState !== ws.OPEN) return;
          ws.send(JSON.stringify({ count: i, square: i * i }));
          await sleep(500); // eslint-disable-line no-await-in-loop
        }
        ws.send(JSON.stringify({ done: true }));
      })();
    });
  } else {
    socket.destroy();
  }
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(8001, () => console.log("advanced app on http://localhost:8001"));
}

export { app, server };
