/**
 * Concept 02 — Server Streaming RPC
 *
 * The client sends ONE request; the server sends MANY responses over time,
 * keeping the connection open until it's done (or the client cancels).
 *
 *   Client ── SubscribeRequest ──> Server
 *   Client <── PriceUpdate (×N) ── Server
 *   Client <──────── EOF ──────── Server
 *
 * Uses: live price/metric feeds, log tailing, large result sets, progress.
 *
 * Server side: the handler gets a writable `call`. You `call.write(msg)` for each
 * message and `call.end()` to finish.
 * Client side: the stub call returns a Readable stream — listen for "data",
 * "end", and "error".
 *
 * HOW TO RUN:
 *   npx tsx 02_server_streaming.ts
 */

import { fileURLToPath } from "node:url";

import grpc from "@grpc/grpc-js";
import { loadProto } from "./load.js";

// A gRPC error carries a numeric status code and a details string. A caught
// value is `unknown`, so this narrows to that shape before reading either.
interface GrpcError {
  code: number;
  details?: string;
}

function asGrpcError(err: unknown): GrpcError {
  if (typeof err === "object" && err !== null && "code" in err) {
    return err as GrpcError;
  }
  return { code: grpc.status.UNKNOWN, details: String(err) };
}


const PORT = 50052;
// The message shapes from stock.proto. proto-loader parses the .proto at
// runtime, so these are a claim about it rather than generated from it.
interface PriceRequest {
  symbol: string;
  count: number;
}

interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

const { StockTicker } = loadProto("stock.proto");

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const handlers = {
  async StreamPrices(call: grpc.ServerWritableStream<PriceRequest, PriceUpdate>) {
    const { symbol, count } = call.request;
    console.log(`  [server] Streaming ${count} prices for ${JSON.stringify(symbol)}`);
    // Keyed by a symbol that arrives over the wire, so Record is what allows
    // the lookup and keeps the ?? fallback meaningful.
    const prices: Record<string, number> = { AAPL: 189.5, GOOG: 175.2, TSLA: 245.0 };
    const basePrice = prices[symbol] ?? 100.0;

    // `cancelled` flips to true when the client cancels — stop generating then.
    let cancelled = false;
    call.on("cancelled", () => {
      cancelled = true;
      console.log("  [server] Client cancelled, stopping stream.");
    });

    for (let i = 0; i < count; i += 1) {
      if (cancelled) return;
      const price = Number((basePrice + (Math.random() * 4 - 2)).toFixed(2));
      call.write({ symbol, price, timestamp: Date.now() });
      await sleep(200); // simulate real-time cadence
    }
    call.end();
  },
};

function makeServer(): grpc.Server {
  const server = new grpc.Server();
  server.addService(StockTicker.service, handlers);
  return server;
}

function startServer(server: grpc.Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err) =>
      err ? reject(err) : resolve()
    );
  });
}

// ---------------------------------------------------------------------------
// Client — wrap each readable stream in a promise so the demo reads linearly.
// ---------------------------------------------------------------------------

// The three knobs the demos below use. All optional but onData, which every
// call supplies — writing that out is what lets each call site pass only what
// it needs.
interface ConsumeOptions {
  onData: (update: PriceUpdate) => void;
  stopAfter?: number;
  deadlineError?: (err: unknown, resolve: (count: number) => void) => void;
}

function consume(
  stream: grpc.ClientReadableStream<PriceUpdate>,
  { onData, stopAfter, deadlineError }: ConsumeOptions
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let received = 0;
    stream.on("data", (update: PriceUpdate) => {
      onData(update);
      received += 1;
      if (stopAfter && received === stopAfter) {
        stream.cancel(); // close the stream from the client side
        resolve(received);
      }
    });
    stream.on("end", () => resolve(received));
    stream.on("error", (err: unknown) =>
      deadlineError ? deadlineError(err, resolve) : reject(err)
    );
  });
}

// The stub's methods come from the .proto at runtime, so the loader's
// ServiceClient type knows nothing about them. This is the declaration of what
// stock.proto produces.
interface StockTickerClient extends grpc.Client {
  StreamPrices(
    req: PriceRequest,
    opts?: grpc.CallOptions
  ): grpc.ClientReadableStream<PriceUpdate>;
}

async function runClient(): Promise<void> {
  const client = new StockTicker(
    `localhost:${PORT}`,
    grpc.credentials.createInsecure()
  ) as unknown as StockTickerClient;

  console.log("\n1. Stream 5 AAPL price updates:");
  await consume(client.StreamPrices({ symbol: "AAPL", count: 5 }), {
    onData: (u) => console.log(`   ${u.symbol}  $${u.price.toFixed(2)}  ts=${u.timestamp}`),
  });

  console.log("\n2. Stream 10 GOOG updates but cancel after 3:");
  await consume(client.StreamPrices({ symbol: "GOOG", count: 10 }), {
    onData: (u) => console.log(`   ${u.symbol}  $${u.price.toFixed(2)}`),
    stopAfter: 3,
  });
  console.log("   (cancelled by client)");

  console.log("\n3. Stream with a 0.5s deadline (expect DEADLINE_EXCEEDED):");
  const slow = client.StreamPrices({ symbol: "TSLA", count: 100 }, { deadline: Date.now() + 500 });
  await consume(slow, {
    onData: (u) => console.log(`   ${u.symbol}  $${u.price.toFixed(2)}`),
    deadlineError: (err: unknown, resolve: (count: number) => void) => {
      console.log(`   Timed out: ${grpc.status[asGrpcError(err).code]}`);
      resolve(0);
    },
  });

  client.close();
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("CONCEPT 02 — Server Streaming RPC");
  console.log("=".repeat(60));

  const server = makeServer();
  await startServer(server);
  try {
    await runClient();
  } finally {
    server.forceShutdown();
  }
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { makeServer, PORT };
