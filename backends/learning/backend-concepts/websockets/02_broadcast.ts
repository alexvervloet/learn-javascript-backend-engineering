/**
 * WebSocket Broadcast: Chat Room
 * ================================
 * A ConnectionManager tracks every client and broadcasts to all at once — the
 * basis of any multi-user real-time feature (chat, live dashboards, cursors).
 *
 * Detecting stale connections: a client can drop without a close frame. The `ws`
 * library exposes readyState; we skip/clean sockets that aren't OPEN.
 *
 * This Set lives in ONE process. Multiple workers/containers each have their own,
 * so production backs broadcast with Redis pub/sub so a message reaches clients
 * on any process.
 *
 * Run:  npx tsx 02_broadcast.ts  →  open http://localhost:8000 in two tabs
 */

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { WebSocketServer, WebSocket } from "ws";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static(path.join(here, "static")));
app.get("/", (_req, res) => res.sendFile(path.join(here, "static", "chat.html")));

class ConnectionManager {
  // Set<WebSocket> rather than a bare Set: broadcast() reaches for readyState
  // and send(), and the element type is what makes those checkable.
  active = new Set<WebSocket>();

  add(ws: WebSocket): void {
    this.active.add(ws);
    console.log(`  + client connected   (total: ${this.active.size})`);
  }

  remove(ws: WebSocket): void {
    this.active.delete(ws);
    console.log(`  - client disconnected  (total: ${this.active.size})`);
  }

  broadcast(message: string): void {
    for (const ws of this.active) {
      if (ws.readyState === WebSocket.OPEN) ws.send(message);
      else this.remove(ws); // stale socket found mid-broadcast
    }
  }
}

const manager = new ConnectionManager();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  manager.add(ws);
  ws.on("message", (data) => {
    const text = data.toString();
    console.log(`  message: ${JSON.stringify(text)}`);
    manager.broadcast(text);
  });
  ws.on("close", () => manager.remove(ws));
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(8000, () => console.log("broadcast server on http://localhost:8000"));
}

export { server, ConnectionManager };
