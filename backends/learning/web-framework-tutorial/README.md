# Web Framework Tutorial

A guided tour of building HTTP APIs on the 2026 Node stack: **Express**, with
**Zod** for request validation, **multer** for uploads, **cookie-parser** for
cookies, **better-sqlite3** for the database, and **ws** for WebSockets.

This is step 2 of the repo's [learning path](../../../README.md), and the first
backend code most people here will write.

## How this module is shaped

Every other folder under `learning/` is a set of numbered files you run one at a
time. This one is two servers you start and then poke at. That is deliberate: the
subject is a *running HTTP API*, and the things worth learning — how a route
matches, what middleware order does, what a 422 body looks like — only exist
while something is listening on a port.

So the reading order is not a file listing, it is the table below. Start the
server, then work down it, running each `curl` and reading the handler it hits.

```bash
npm install                     # from the repo root
npx tsx tutorial/server.ts      # http://localhost:8000
```

Leave it running in one terminal and use another for the curls. Both servers
watch nothing, so restart after an edit.

## Part 1 — `tutorial/server.ts`

The core of an HTTP API: getting data out of a request, validating it, and
answering.

| # | Concept | Where | Try it |
|---|---|---|---|
| 1 | Path and query parameters | `tutorial/server.ts:119` | `curl 'localhost:8000/items/42?q=hi'` |
| 2 | Request body, validated with Zod | `:144` | `curl -X POST localhost:8000/items/ -H 'Content-Type: application/json' -d '{"name":"Foo","price":35.4,"tax":3.2}'` |
| 3 | Query validation — length and pattern | `:94` | `curl 'localhost:8000/items/limited/?q=ab'` — 422, `q` needs 3+ letters |
| 4 | Path parameter bounds | `:162` | `curl localhost:8000/items/validated/9999` — 422, max is 1000 |
| 5 | Cookies and headers | `:174` | `curl -b 'session=abc' localhost:8000/cookies/` |
| 6 | File uploads with multer | `:184` | `curl -F 'file=@README.md' localhost:8000/files/upload` |
| 7 | Error handling and status codes | `:197` | `curl -i localhost:8000/errors/not-found/7` — 404 |
| 8 | SQLite CRUD | `:214` | `curl -X POST localhost:8000/heroes/ -H 'Content-Type: application/json' -d '{"name":"Ada","secret_name":"Lovelace","age":36}'` |

The Zod schemas the validating routes use are at the top, `:61`.

### What to actually notice

**Route order matters, and getting it wrong is silent.** Concept 3 sits above
concept 1 in the file, which looks out of order until you see why. Express matches
routes in declaration order and stops at the first hit, and `/items/limited/` fits
the `/items/:item_id` pattern perfectly well — `item_id` just comes out as the
string `"limited"`. Declared the other way round, the validation handler never
runs and the request still succeeds, against the wrong route, with no warning
anywhere. (It was that way round until recently; the bug is why the table lists
the line numbers it does.)

The rule: specific paths before parameterised ones. It is the same rule that makes
the [url-shortener](../../url-shortener/) capstone mount its catch-all
`/:shortCode` redirect last, after `/auth`, `/urls` and `/health`.

**Validation is middleware, not a step inside the handler.** `validate(Item)` runs
before the handler and returns 422 on bad input, so by the time your code runs the
body is the right shape. That separation is what the capstones do too.

**Send one response per request.** Every handler ends in exactly one `res.json`,
`res.send` or `res.redirect`. Sending twice throws
`ERR_HTTP_HEADERS_SENT`, and it is usually a missing `return`.

**422 vs 400.** Malformed JSON that Express cannot parse is a 400. Well-formed
JSON that fails the schema is a 422. Compare `/errors/bad-request` against a
failing POST to `/items/`.

## Part 2 — `advanced/server.ts`

Everything past the basic request/response cycle.

```bash
npx tsx advanced/server.ts      # http://localhost:8001
```

| # | Concept | Where | Try it |
|---|---|---|---|
| 1 | Settings from environment variables | `advanced/server.ts:40` | `curl localhost:8001/advanced/settings` |
| 2 | Startup hooks | `:53` | `curl localhost:8001/advanced/lifespan/log` |
| 3 | Middleware that times the request | `:59` | `curl -i localhost:8001/advanced/settings` — look for `X-Process-Time` |
| 4 | Streaming a response | `:68` | `curl -N localhost:8001/stream/text` |
| 5 | Server-sent events | `:78` | `curl -N localhost:8001/stream/sse` |
| 6 | Status codes: 201 on create, 200 on update | `:87` | `curl -i -X PUT 'localhost:8001/advanced/items/new-one?name=Hat'` — 201, then run it again for 200 |
| 7 | Custom content types | `:107` | `curl localhost:8001/advanced/custom/html` |
| 8 | Setting and clearing cookies | `:129` | `curl -i -X POST localhost:8001/advanced/cookies/set` |
| 9 | Custom headers and dynamic status | `:145` | `curl -i 'localhost:8001/advanced/status/dynamic?found=false'` — 404 |
| 10 | Middleware factories (parameterised deps) | `:155` | `curl 'localhost:8001/advanced/deps/short?q=abcd'` then `/deps/long?q=abcd` — same input, different verdict |
| 11 | HTTP Basic Auth | `:181` | `curl -u admin:password123 localhost:8001/advanced/basic-auth` |
| 12 | Reading the raw request | `:204` | `curl localhost:8001/advanced/request-info` |
| 13 | Sub-applications | `:216` | `curl localhost:8001/subapp/` |
| 14 | Base64 in JSON | `:232` | `curl -X POST localhost:8001/advanced/base64/encode -H 'Content-Type: application/json' -d '{"text":"hello"}'` |
| 15 | Typed pagination | `:244` | `curl 'localhost:8001/advanced/pagination/paginated?skip=5&limit=5'` |
| 16 | WebSockets | `:253` | See the frontend playground below |

### What to actually notice

**Basic auth compares in constant time.** `crypto.timingSafeEqual` throws when the
two buffers differ in length, so the helper checks lengths first and returns false.
Getting that wrong turned every non-matching password length into a 500 — see
`LESSONS.md` at the repo root, which is where that bug was found.

**WebSockets share the HTTP server.** The `ws` server attaches to the existing
`server` via the `upgrade` event rather than binding its own port. One process,
one port, two protocols.

**Streaming means writing before you are finished.** The SSE route writes, flushes
and waits in a loop. Nothing is buffered until the end, which is why `curl -N`
(no buffering) is needed to see it arrive in pieces.

## The paired frontends

Both servers have a React playground that lists the endpoints and lets you fire
them from a browser, which is easier than curl for the streaming and WebSocket
routes:

```bash
cd ../../../frontends/web-framework-tutorial   # pairs with tutorial/ on :8000
npm install && npm run dev

cd ../../../frontends/web-framework-advanced   # pairs with advanced/ on :8001
npm install && npm run dev
```

Start the matching backend first or every request in the playground will fail.

## Where to go next

[testing-concepts](../testing-concepts/) is step 3, and it tests an Express app
much like this one. [backend-concepts](../backend-concepts/) then takes each
piece further: real auth instead of basic auth, rate limiting, caching, and
WebSockets with rooms.
