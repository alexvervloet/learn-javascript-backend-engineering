/**
 * Streams
 * ========
 * A stream processes data in chunks instead of holding all of it at once. That
 * is the whole idea, and it is what lets a 256MB container serve a 4GB file
 * download.
 *
 * Four kinds:
 *
 *   Readable   — you read from it          (fs.createReadStream, an HTTP request)
 *   Writable   — you write to it           (fs.createWriteStream, an HTTP response)
 *   Duplex     — both, independently       (a TCP socket)
 *   Transform  — a Duplex where output is a function of input  (gzip, a parser)
 *
 * The memory argument is the one that matters. `fs.readFile` on a 1GB file
 * allocates 1GB and your process dies at 10 concurrent requests. A stream holds
 * one chunk — 64KB by default — however large the file is.
 *
 * Run:  npx tsx 02_streams.ts
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const tmp = path.join(os.tmpdir(), "node-runtime-streams");

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// --- 1. Memory: read it all vs stream it ------------------------------------
async function memory(): Promise<void> {
  console.log("\n--- Reading a file two ways ---");
  const file = path.join(tmp, "big.txt");

  // ~40MB of text, written in chunks so building the fixture does not itself
  // blow up the demo.
  const line = `${"x".repeat(99)}\n`;
  const out = fs.createWriteStream(file);
  for (let i = 0; i < 400_000; i++) {
    // Ignoring the return value here is exactly the bug 03 is about; this
    // fixture is small enough not to care, and 03 shows what it costs.
    out.write(line);
  }
  await new Promise<void>((resolve) => out.end(resolve));
  const { size } = fs.statSync(file);
  console.log(`  fixture: ${mb(size)}`);

  // `arrayBuffers`, not `heapUsed`. A Buffer's bytes live outside the V8 heap,
  // so heapUsed reports ~0 for a 40MB readFileSync and makes the two approaches
  // look identical. Measuring the wrong counter is the usual reason people
  // conclude streams "do not actually save memory".
  const held = (): number => process.memoryUsage().arrayBuffers;

  // Whole file into memory at once. The buffer stays referenced until the end
  // of this function, which is the point — that is what a request handler doing
  // readFile holds for the whole response.
  const baseline = held();
  const buffer = fs.readFileSync(file);
  console.log(`  readFileSync     → holding ${mb(held() - baseline)} at once (file is ${mb(buffer.length)})`);

  // Same file, counting bytes as they go past.
  //
  // Measuring the stream by allocation counters is misleading: the 64KB chunks
  // become garbage immediately, and `arrayBuffers` tracks whatever the garbage
  // collector has not got around to yet, which is tens of megabytes of dead
  // objects. The number that means something is how much the stream is holding
  // LIVE at any moment, which `readableLength` reports directly.
  // What is live at any moment is the current chunk, and highWaterMark is the
  // ceiling on its size. `for await` pulls exactly one chunk per iteration, so
  // the largest chunk seen is the most this loop ever held.
  const HWM = 64 * 1024;
  let counted = 0;
  let chunks = 0;
  let largest = 0;
  for await (const chunk of fs.createReadStream(file, { highWaterMark: HWM })) {
    const size = (chunk as Buffer).length;
    counted += size;
    largest = Math.max(largest, size);
    chunks += 1;
  }
  console.log(`  createReadStream → read all ${mb(counted)} in ${chunks} chunks,`);
  console.log(`                     largest chunk ${(largest / 1024).toFixed(0)}KB (highWaterMark is ${HWM / 1024}KB)`);
  console.log("");
  console.log("  The first number scales with the file. The second is capped by");
  console.log("  highWaterMark and does not move whether the file is 38MB or 38GB.");
  console.log(`  (the ${mb(buffer.length)} buffer is still referenced right here, which is the whole problem:`);
  console.log("   ten concurrent requests doing this is ten times that much resident)");
}

// --- 2. Transform streams ---------------------------------------------------
// A Transform is the unit of composition: it takes chunks in, pushes chunks out,
// and knows nothing about where either end connects.
function upperCase(): Transform {
  return new Transform({
    transform(chunk, _encoding, callback) {
      // callback(err, data) — calling it is how you signal "ready for more".
      // Forgetting to call it is the classic Transform bug: the pipeline simply
      // stops, with no error and no exit.
      callback(null, String(chunk).toUpperCase());
    },
  });
}

// Chunk boundaries do not respect your data format. A 64KB read can split a
// line, a JSON object, or a multi-byte character down the middle. Any parsing
// Transform has to carry a remainder between calls.
function splitLines(): Transform {
  let remainder = "";
  return new Transform({
    readableObjectMode: true,
    transform(chunk, _encoding, callback) {
      const text = remainder + String(chunk);
      const lines = text.split("\n");
      // The last element is either an incomplete line or "" — either way it is
      // not ours to emit yet.
      remainder = lines.pop() ?? "";
      for (const line of lines) this.push(line);
      callback();
    },
    flush(callback) {
      // End of input: whatever is left is a complete final line.
      if (remainder.length > 0) this.push(remainder);
      callback();
    },
  });
}

async function transforms(): Promise<void> {
  console.log("\n--- Transform streams ---");
  const source = Readable.from(["hello world\nsecond li", "ne here\nthird line"]);

  const lines: string[] = [];
  const collect = new Writable({
    objectMode: true,
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });

  await pipeline(source, splitLines(), collect);
  console.log(`  input arrived in 3 chunks, split mid-word`);
  console.log(`  lines out: ${JSON.stringify(lines)}`);
  console.log("  'second li' + 'ne here' was rejoined — that is the remainder buffer.");

  const shouted: string[] = [];
  await pipeline(
    Readable.from(["quiet"]),
    upperCase(),
    new Writable({
      write(chunk, _e, cb) {
        shouted.push(String(chunk));
        cb();
      },
    })
  );
  console.log(`  upperCase transform: ${JSON.stringify(shouted)}`);
}

// --- 3. pipeline() vs .pipe() ------------------------------------------------
// Both connect streams. Only one cleans up.
async function pipelineVsPipe(): Promise<void> {
  console.log("\n--- pipeline() vs .pipe() ---");
  const file = path.join(tmp, "big.txt");
  const gz = path.join(tmp, "big.txt.gz");

  await pipeline(fs.createReadStream(file), zlib.createGzip(), fs.createWriteStream(gz));
  const raw = fs.statSync(file).size;
  const packed = fs.statSync(gz).size;
  console.log(`  gzipped ${mb(raw)} → ${mb(packed)} through a 3-stage pipeline`);

  // Why not .pipe()? Because .pipe() does not forward errors and does not
  // destroy the other streams when one fails. A failed .pipe() chain leaks the
  // file descriptors of every stream in it, and in a server that is a slow leak
  // that ends in EMFILE: "too many open files".
  //
  // pipeline() destroys every stream in the chain on error or early close, and
  // the promise form rejects so you can actually handle it.
  try {
    await pipeline(
      fs.createReadStream(path.join(tmp, "does-not-exist.txt")),
      zlib.createGzip(),
      fs.createWriteStream(path.join(tmp, "never-written.gz"))
    );
  } catch (err) {
    console.log(`  a broken pipeline rejects: ${(err as NodeJS.ErrnoException).code}`);
    console.log("  and every stream in the chain was destroyed. .pipe() would");
    console.log("  have swallowed this and leaked two file descriptors.");
  }
}

// --- 4. Async iteration ------------------------------------------------------
// `for await...of` over a Readable is usually the most readable option, and it
// gets backpressure right for free — the loop body's await is what paces the
// producer. The cost is that you lose the parallelism a pipeline of Transforms
// would give you, since each iteration is sequential.
async function asyncIteration(): Promise<void> {
  console.log("\n--- for await...of over a stream ---");
  let lineCount = 0;
  const stream = fs.createReadStream(path.join(tmp, "big.txt"), { encoding: "utf8" });
  for await (const chunk of stream.pipe(splitLines())) {
    lineCount += 1;
    if (lineCount >= 1000) {
      // Breaking out destroys the stream, which closes the file descriptor.
      // Worth knowing: an early `break` or `return` is not a leak here.
      break;
    }
    void chunk;
  }
  console.log(`  read ${lineCount} lines, then broke out early`);
  console.log("  breaking destroys the stream and releases the file descriptor.");
}

async function main(): Promise<void> {
  console.log("=== Streams ===");
  fs.mkdirSync(tmp, { recursive: true });
  try {
    await memory();
    await transforms();
    await pipelineVsPipe();
    await asyncIteration();
    console.log("\nNext: 03_backpressure.ts — what happens when the reader is slower.");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}

export { upperCase, splitLines };
