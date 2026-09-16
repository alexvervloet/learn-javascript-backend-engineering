/**
 * WebSocket Basics: Echo Server
 * ==============================
 * WebSockets give a persistent, bidirectional channel over one TCP connection.
 * Either side can send at any time — no request/response cycle.
 *
 *   Client ── HTTP Upgrade ──▶ Server ── 101 Switching Protocols ──▶ (handshake)
 *   Client ── "hello" ───────▶ Server ── "Echo: hello" ───────────▶
 *
 * In Node the standard library is `ws`. We attach a WebSocketServer to an HTTP
 * server that also serves the static test page.
 *
 * Lifecycle: "connection" event → "message" handler → "close" event.
 *
 * Run:  npx tsx 01_echo.ts
 *   Open http://localhost:8000 and connect to ws://localhost:8000/ws,
 *   or:  wscat -c ws://localhost:8000/ws
 */

import { fileURLToPath } from "node:url";

import http from "node:http";
import path from "node:path";
import express from "express";
import { WebSocketServer } from "ws";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static(path.join(here, "static")));
app.get("/", (_req, res) => res.sendFile(path.join(here, "static", "chat.html")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  console.log(`Client connected: ${req.socket.remoteAddress}`);
  ws.on("message", (data) => {
    const message = data.toString();
    console.log(`  ← received: ${JSON.stringify(message)}`);
    const reply = `Echo: ${message}`;
    ws.send(reply);
    console.log(`  → sent:     ${JSON.stringify(reply)}`);
  });
  ws.on("close", () => console.log("Client disconnected"));
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(8000, () => console.log("echo server on http://localhost:8000 (ws://localhost:8000/ws)"));
}

export { server };
