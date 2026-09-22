# Node Runtime

How Node actually executes your code. Every other module in this repo sits on
top of what is here: the event loop is why one slow handler stalls a whole
service, streams are why a file download does not need the file to fit in RAM,
and "workers share nothing" is why the caching and rate-limiting modules put
their state in Redis.

No infrastructure. Everything is core Node.

| File | What it teaches |
|---|---|
| `01_event_loop.ts` | Phase ordering, `nextTick` vs microtasks (and the ESM twist), blocking, starvation, measuring loop lag |
| `02_streams.ts` | Readable/Writable/Transform, chunk boundaries, `pipeline()` vs `.pipe()`, async iteration |
| `03_backpressure.ts` | What `write()`'s return value means and what ignoring it costs |
| `04_worker_threads.ts` | Moving CPU-bound work off the main thread; what crosses the boundary |
| `05_cluster.ts` | Using every core, connection-level balancing, and what workers do not share |

## The one sentence version

**Node runs your JavaScript on one thread.** Everything below follows from that.

I/O does not block because libuv does it elsewhere and calls you back.
*Your code* blocks, always, because there is nowhere else for it to run. A
300ms loop is 300ms during which your service answers nobody — `01` measures
exactly that, and the gap it prints is every waiting user's added latency.

## What each file is really about

**`01_event_loop.ts`** — the ordering puzzle is the famous part, but the useful
part is the last section. `monitorEventLoopDelay` gives you a histogram of how
late the loop is running, maintained by libuv at nearly no cost. Export its p99
as a gauge next to the metrics in [../observability/](../observability/). It
rises before latency does and before error rate does, which makes it the best
early warning a Node service has.

There is also a wrinkle worth knowing in this repo specifically: at the top
level of an ES module, promise callbacks run *before* `process.nextTick`
callbacks, which is the opposite of what every article says. An ESM module body
is itself evaluated as a microtask, so the microtask queue is already draining
when your code runs. In CommonJS, or inside any callback, you get the textbook
order. `01` prints both.

**`02_streams.ts`** — the memory demo is the argument: 38MB held at once with
`readFileSync`, versus a 64KB ceiling streaming the same file. The second number
does not change if the file is 38GB.

The subtler lesson is chunk boundaries. A 64KB read splits wherever 64KB lands,
which is mid-line, mid-JSON-object, mid-UTF-8-character. Any Transform that
parses has to carry a remainder between calls, and `splitLines()` shows the
shape. Forgetting it produces a parser that works on small inputs and corrupts
large ones.

**`03_backpressure.ts`** — the highest-value file here. `write()` returns
`false` to mean "stop", and nothing makes you listen. The demo writes 400 chunks
into a slow sink two ways: ignoring the signal queues 25MB in memory, honouring
it peaks at 0.1MB. Same bytes, same result, one of them dies under load.

You will rarely write the drain loop by hand. Use `pipeline()`. The loop is
there so the automatic version stops being magic.

**`04_worker_threads.ts`** — a worker turns a 1290ms stall into a 13ms one. But
workers cost a few MB and tens of milliseconds to start, and `postMessage`
copies by default, so a big payload can cost more than the work you moved.
Reach for one when the work is CPU-bound and slow. Never for I/O: that is
already off-thread, and wrapping a query in a worker only adds a copy.

**`05_cluster.ts`** — three things, and the second surprises people. Forked
workers share a socket and spread load, 15/15/15/15 across four workers. Over a
single keep-alive connection, the same 60 requests all land on one worker,
because a cluster balances *connections*, not requests, and every modern HTTP
client keeps connections alive. And a blocked worker still blocks whoever is
already connected to it, so more workers lower the odds without removing them.

## Run

```bash
npm install                    # from the repo root (nothing beyond core Node here)

npx tsx 01_event_loop.ts       # prints and exits
npx tsx 02_streams.ts          # writes a ~38MB fixture to a temp dir, cleans up after
npx tsx 03_backpressure.ts     # prints and exits
npx tsx 04_worker_threads.ts   # spawns workers, takes a few seconds
npx tsx 05_cluster.ts          # forks 4 workers on :8123, load-tests itself, exits
WORKERS=8 npx tsx 05_cluster.ts
```

All five run to completion. None of them leave a server up.

## Where this shows up elsewhere in the repo

- [../rate-limiting/](../rate-limiting/) and [../caching/](../caching/) keep
  state in Redis rather than in a variable. `05` is the reason.
- [../observability/](../observability/) exports metrics; event loop lag from
  `01` belongs among them.
- [../pagination/](../pagination/) exists partly because returning 100k rows at
  once is the `02` memory problem wearing a database costume.
- [../websockets/](../websockets/) holds connections in a process-local map,
  which works precisely until you run more than one process.
