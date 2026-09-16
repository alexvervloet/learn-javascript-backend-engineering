/**
 * WebSocket Rooms
 * ================
 * Clients join a named room via the URL path; messages broadcast only to others
 * in the same room (Slack channels, game lobbies, segmented broadcast).
 *
 *   ws://localhost:8000/ws/general?username=alice
 *   ws://localhost:8000/ws/dev?username=carol   ← isolated from #general
 *
 * `ws` doesn't do path params, so we parse req.url ourselves. Still one process —
 * production uses Redis pub/sub per "room:{name}" channel to span workers.
 *
 * Run:  npx tsx 03_rooms.ts  →  open http://localhost:8000, connect tabs to
 *   ws://localhost:8000/ws/general?username=alice and .../ws/dev?username=carol
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

class RoomManager {
  rooms = new Map<string, Set<WebSocket>>(); // room → Set<ws>

  join(room: string, ws: WebSocket): void {
    // Map.get returns Set | undefined, so the set is captured once rather than
    // fetched again on the next line and assumed present.
    let members = this.rooms.get(room);
    if (!members) {
      members = new Set<WebSocket>();
      this.rooms.set(room, members);
    }
    members.add(ws);
    console.log(`  + [${room}] client joined   (room size: ${members.size})`);
  }

  leave(room: string, ws: WebSocket): void {
    this.rooms.get(room)?.delete(ws);
    console.log(`  - [${room}] client left   (room size: ${this.rooms.get(room)?.size ?? 0})`);
  }

  broadcast(room: string, message: string): void {
    for (const ws of this.rooms.get(room) ?? []) {
      if (ws.readyState === WebSocket.OPEN) ws.send(message);
      else this.leave(room, ws);
    }
  }
}

const manager = new RoomManager();
const server = http.createServer(app);
// noServer mode: route the upgrade ourselves so we can read the room + username.
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const match = url.pathname.match(/^\/ws\/([^/]+)$/);
  if (!match) {
    socket.destroy();
    return;
  }
  const room = decodeURIComponent(match[1] ?? "");
  const username = url.searchParams.get("username") || "anonymous";
  wss.handleUpgrade(req, socket, head, (ws) => {
    manager.join(room, ws);
    manager.broadcast(room, `*** ${username} joined #${room} ***`);
    ws.on("message", (data) => manager.broadcast(room, `[${username}] ${data.toString()}`));
    ws.on("close", () => {
      manager.leave(room, ws);
      manager.broadcast(room, `*** ${username} left #${room} ***`);
    });
  });
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(8000, () => console.log("rooms server on http://localhost:8000"));
}

export { server, RoomManager };
