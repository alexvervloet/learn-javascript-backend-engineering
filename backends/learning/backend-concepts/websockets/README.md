# WebSockets & SSE

Real-time communication with the [`ws`](https://github.com/websockets/ws) library
(WebSockets) and Express (static pages + Server-Sent Events).

| File | What it teaches |
|---|---|
| `01_echo.ts` | Connection lifecycle: handshake, `message`, `close`; echo server |
| `02_broadcast.ts` | A ConnectionManager broadcasting to all clients; stale-socket cleanup |
| `03_rooms.ts` | Named rooms via the URL path (`noServer` upgrade routing) |
| `04_sse.ts` | Server-Sent Events: push-only feeds over plain HTTP, named events |

`static/chat.html` and `static/sse.html` are browser test pages — they use the
native `WebSocket` / `EventSource` APIs.

## Run

```bash
npm install                 # from the repo root (ws, express)
npx tsx 01_echo.ts             # open http://localhost:8000
npx tsx 04_sse.ts
curl -N localhost:8000/stream/deploy-log
```

