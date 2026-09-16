/**
 * Concept 04 — Bidirectional Streaming RPC
 *
 * Both sides send multiple messages independently over one persistent
 * connection. Neither side waits for the other before sending.
 *
 *   Client ── ChatMessage ──> Server
 *   Client <── [echo] ─────── Server
 *   Client ── ChatMessage ──> Server
 *   Client <── [echo] ─────── Server   …
 *
 * Uses: chat/messaging, collaborative editing, two-way telemetry, game state.
 *
 * Server side: `call` is both Readable and Writable. Listen for "data" to read,
 * `call.write()` to reply, `call.end()` on "end" to signal EOF.
 * Client side: the stub call returns the same duplex stream — write outbound
 * messages and listen for inbound ones concurrently.
 *
 * In this demo the server echoes every message with an "[echo]" prefix.
 *
 * HOW TO RUN:
 *   npx tsx 04_bidirectional_streaming.ts
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


const PORT = 50054;
// The message shape from chat.proto. proto-loader parses the .proto at runtime,
// so this is a claim about it rather than generated from it.
interface ChatMessage {
  user: string;
  text: string;
  timestamp: number;
}

const { Chat } = loadProto("chat.proto");

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Server — echo each inbound message; end when the client ends.
// ---------------------------------------------------------------------------

const handlers = {
  // A duplex stream: both directions are open at once, which is why the write
  // below happens inside the read handler rather than after it.
  Connect(call: grpc.ServerDuplexStream<ChatMessage, ChatMessage>) {
    call.on("data", (msg: ChatMessage) => {
      console.log(`  [server] received from ${JSON.stringify(msg.user)}: ${JSON.stringify(msg.text)}`);
      call.write({ user: "server", text: `[echo] ${msg.text}`, timestamp: Date.now() });
    });
    call.on("end", () => call.end());
  },
};

function makeServer(): grpc.Server {
  const server = new grpc.Server();
  server.addService(Chat.service, handlers);
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
// Client
// ---------------------------------------------------------------------------

const MESSAGES: string[] = [
  "hello there",
  "how are you?",
  "what's the weather like?",
  "tell me a joke",
  "goodbye!",
];

// Send each message with a small gap, while a "data" listener reads echoes
// concurrently — the two directions are independent.
async function sendMessages(
  call: grpc.ClientDuplexStream<ChatMessage, ChatMessage>,
  user: string,
  messages: string[]
): Promise<void> {
  for (const text of messages) {
    console.log(`  [client] sending: ${JSON.stringify(text)}`);
    call.write({ user, text, timestamp: Date.now() });
    await sleep(300);
  }
  call.end();
}

// The stub's methods come from the .proto at runtime, so the loader's
// ServiceClient type knows nothing about them.
interface ChatClient extends grpc.Client {
  Connect(): grpc.ClientDuplexStream<ChatMessage, ChatMessage>;
}

async function runClient(): Promise<void> {
  const client = new Chat(
    `localhost:${PORT}`,
    grpc.credentials.createInsecure()
  ) as unknown as ChatClient;

  console.log("\n1. Full bidirectional chat (5 messages, each echoed back):");
  await new Promise<void>((resolve, reject) => {
    const call = client.Connect();
    call.on("data", (reply: ChatMessage) =>
      console.log(`  [client] received from ${JSON.stringify(reply.user)}: ${JSON.stringify(reply.text)}`)
    );
    call.on("end", resolve);
    call.on("error", reject);
    sendMessages(call, "alex", MESSAGES).catch(reject);
  });

  console.log("\n2. Client disconnects after receiving 2 replies:");
  await new Promise<void>((resolve, reject) => {
    const call = client.Connect();
    let received = 0;
    call.on("data", (reply: ChatMessage) => {
      console.log(`  [client] received: ${JSON.stringify(reply.text)}`);
      received += 1;
      if (received === 2) {
        call.cancel();
        console.log("  [client] cancelled stream");
        resolve();
      }
    });
    call.on("end", resolve);
    // After a client cancel, the stream emits a CANCELLED error — expected here.
    call.on("error", (err: unknown) =>
      asGrpcError(err).code === grpc.status.CANCELLED ? resolve() : reject(err)
    );
    sendMessages(call, "alex", ["msg1", "msg2", "msg3", "msg4"]).catch(() => {});
  });

  client.close();
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("CONCEPT 04 — Bidirectional Streaming RPC");
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
