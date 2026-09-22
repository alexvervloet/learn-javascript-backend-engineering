/**
 * Backpressure
 * =============
 * What happens when the producer is faster than the consumer.
 *
 * Writing to a stream does not mean the bytes went anywhere. `write()` returns
 * a boolean: `true` means "I took it, keep going", `false` means "my buffer is
 * past its highWaterMark, please stop until I emit 'drain'".
 *
 * Nothing enforces it. Ignore the return value and `write()` still accepts
 * everything you give it — by queueing it in memory. A fast producer feeding a
 * slow consumer then grows an unbounded in-memory queue, and the process dies
 * of heap exhaustion while every counter says the code is "async" and "non
 * blocking".
 *
 * This is the most common way a Node service falls over under load, and it is
 * invisible in development where the consumer is a local disk and always fast.
 *
 * Run:  npx tsx 03_backpressure.ts
 */

import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const CHUNK = Buffer.alloc(64 * 1024, 0x61); // 64KB of 'a'
const TOTAL_CHUNKS = 400;

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// A deliberately slow consumer: 2ms per chunk. Stands in for a network socket,
// an S3 upload, or a database — anything not a local SSD.
function slowSink(label: string, onWrite?: (buffered: number) => void): Writable {
  return new Writable({
    highWaterMark: 64 * 1024,
    write(chunk, _encoding, callback) {
      void chunk;
      void label;
      setTimeout(() => {
        onWrite?.(0);
        callback();
      }, 2);
    },
  });
}

// --- 1. Ignoring the signal -------------------------------------------------
async function ignoringBackpressure(): Promise<void> {
  console.log("\n--- Ignoring write()'s return value ---");

  let peakBuffered = 0;
  const sink = slowSink("ignored");

  for (let i = 0; i < TOTAL_CHUNKS; i++) {
    // The bug, in one line. write() returns false long before this loop ends
    // and nothing here looks at it, so every remaining chunk is queued in
    // memory rather than waiting its turn.
    sink.write(CHUNK);
    peakBuffered = Math.max(peakBuffered, sink.writableLength);
  }

  console.log(`  wrote ${TOTAL_CHUNKS} x 64KB as fast as the loop could go`);
  console.log(`  peak queued in memory: ${mb(peakBuffered)}`);
  console.log(`  the sink can absorb 64KB at a time; the rest is sitting in RAM.`);
  console.log(`  scale the producer up and this is the OOM kill.`);

  sink.destroy();
}

// --- 2. Respecting it by hand ------------------------------------------------
async function respectingBackpressure(): Promise<void> {
  console.log("\n--- Honouring write() and waiting for 'drain' ---");

  let peakBuffered = 0;
  let pauses = 0;
  const sink = slowSink("respected");

  for (let i = 0; i < TOTAL_CHUNKS; i++) {
    const ok = sink.write(CHUNK);
    peakBuffered = Math.max(peakBuffered, sink.writableLength);
    if (!ok) {
      // Stop pushing until the consumer says it has room. This await is the
      // entire mechanism: the producer's speed becomes the consumer's speed.
      pauses += 1;
      await new Promise((resolve) => sink.once("drain", resolve));
    }
  }
  await new Promise<void>((resolve) => sink.end(resolve));

  console.log(`  same ${TOTAL_CHUNKS} chunks, paused ${pauses} times on 'drain'`);
  console.log(`  peak queued in memory: ${mb(peakBuffered)}`);
  console.log(`  memory is now bounded by highWaterMark, not by how much data exists.`);
}

// --- 3. Letting pipeline do it ----------------------------------------------
// You almost never write the loop above. pipeline() and .pipe() both propagate
// backpressure automatically; pipeline() also cleans up on failure, which is
// why it is the one to reach for (see 02).
async function withPipeline(): Promise<void> {
  console.log("\n--- Letting pipeline() handle it ---");

  let peakBuffered = 0;
  const sink = slowSink("pipeline");
  const source = Readable.from(
    (function* () {
      for (let i = 0; i < TOTAL_CHUNKS; i++) yield CHUNK;
    })()
  );

  const sample = setInterval(() => {
    peakBuffered = Math.max(peakBuffered, sink.writableLength);
  }, 1);

  await pipeline(source, sink);
  clearInterval(sample);

  console.log(`  peak queued in memory: ${mb(peakBuffered)}`);
  console.log(`  no manual drain handling, same bounded memory.`);
  console.log(`  This is why "just use pipeline()" is the advice.`);
}

// --- 4. Where it bites in a real service ------------------------------------
function whereItBites(): void {
  console.log("\n--- The shapes to watch for ---");
  console.log(`
  res.write() in a loop
      An export endpoint streaming 100k rows to a client on hotel wifi. The
      database hands you rows quickly, the socket drains slowly, and the
      difference accumulates in your heap. One slow client, one dead process.

  Forwarding an upload
      req.pipe(somewhereElse) is fine. Reading the whole request into a Buffer
      and then writing it is not, and body parsers do the former by default —
      check what yours is configured to do with large payloads.

  A queue consumer that does not await
      Pulling jobs in a loop without awaiting the handler is the same bug with
      different words: the producer (the queue) outruns the consumer (your
      handler) and the backlog lives in memory instead of in the broker.

  The tell in all three: memory that tracks request volume rather than request
  concurrency. Graph heap next to in-flight requests — if heap climbs while
  concurrency is flat, something is buffering that should be waiting.`);
}

async function main(): Promise<void> {
  console.log("=== Backpressure ===");
  await ignoringBackpressure();
  await respectingBackpressure();
  await withPipeline();
  whereItBites();
  console.log("\nNext: 04_worker_threads.ts — moving CPU work off the loop.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}

export { slowSink };
