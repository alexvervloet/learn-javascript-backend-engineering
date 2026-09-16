/**
 * Concept 01 — Unary RPC
 *
 * gRPC is a high-performance RPC framework built on HTTP/2 and Protocol Buffers.
 * Instead of routes and JSON, you define services and messages in a .proto
 * schema and call generated methods directly.
 *
 * UNARY RPC — the simplest pattern: one request → one response.
 *
 *   REST:  POST /users {"name":"Alex"} → 200 {"id":1,"name":"Alex"}
 *   gRPC:  SayHello({name:"Alex"})      → {message:"Hello, Alex!"}
 *
 * In Node we load greeter.proto at runtime (see load.js — no codegen). That
 * gives us:
 *   proto.Greeter           — client constructor + `.service` definition
 *   proto.Greeter.service   — pass to server.addService with your handlers
 *
 * Handlers are `(call, callback)` functions: `call.request` is the message,
 * `callback(err, reply)` returns the response. Field names are camelCased by the
 * loader (proto `user_id` → `call.request.userId`).
 *
 * HOW TO RUN:
 *   npm install        (from the repo root)
 *   npx tsx 01_unary.ts
 */

import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

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


const PORT = 50051;
// The message shapes from greeter.proto. proto-loader parses the .proto at
// runtime, so these interfaces are a claim about it rather than generated from
// it — keep them next to the service that uses them, and remember the loader
// camelCases field names (proto user_id becomes userId).
interface HelloRequest {
  name: string;
}

interface HelloReply {
  message: string;
}

interface GetUserRequest {
  userId: number;
}

interface User {
  id: number;
  name: string;
  email: string;
}

const { Greeter } = loadProto("greeter.proto");

// ---------------------------------------------------------------------------
// Server implementation — one handler per RPC method.
// ---------------------------------------------------------------------------

const handlers = {
  SayHello(
    call: grpc.ServerUnaryCall<HelloRequest, HelloReply>,
    callback: grpc.sendUnaryData<HelloReply>
  ) {
    console.log(`  [server] SayHello called: name=${JSON.stringify(call.request.name)}`);
    callback(null, { message: `Hello, ${call.request.name}!` });
  },

  GetUser(
    call: grpc.ServerUnaryCall<GetUserRequest, User>,
    callback: grpc.sendUnaryData<User>
  ) {
    const userId = call.request.userId;
    console.log(`  [server] GetUser called: userId=${userId}`);
    // Keyed by an id that arrives over the wire, so Record is what allows the
    // lookup — and what forces the miss below to be handled.
    const users: Record<number, User> = {
      1: { id: 1, name: "Alex", email: "alex@example.com" },
      2: { id: 2, name: "Dana", email: "dana@example.com" },
    };
    const found = users[userId];
    if (!found) {
      // Return an error by passing a { code, details } object to the callback.
      callback({ code: grpc.status.NOT_FOUND, details: `User ${userId} not found` });
      return;
    }
    callback(null, found);
  },
};

function makeServer(): grpc.Server {
  const server = new grpc.Server();
  server.addService(Greeter.service, handlers);
  return server;
}

// bindAsync binds the port and starts the server; wrap it in a promise.
function startServer(server: grpc.Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err) =>
      err ? reject(err) : resolve()
    );
  });
}

// ---------------------------------------------------------------------------
// Client calls
// ---------------------------------------------------------------------------

// A dynamically-loaded client stub. The method names come from the .proto at
// runtime, so they are index signatures rather than declared methods — the
// price of skipping codegen, stated here instead of at every call.
type UnaryCallback<T> = (err: grpc.ServiceError | null, res: T) => void;

interface GreeterClient extends grpc.Client {
  // The overloads are ordered with the two-argument form last, because that is
  // the one promisify() resolves against.
  SayHello: {
    (req: HelloRequest, opts: grpc.CallOptions, cb: UnaryCallback<HelloReply>): void;
    (req: HelloRequest, cb: UnaryCallback<HelloReply>): void;
  };
  GetUser(req: GetUserRequest, cb: UnaryCallback<User>): void;
}

async function runClient(): Promise<void> {
  // A client (stub) is the connection handle. createInsecure = no TLS (dev only).
  // The stub's methods come from the .proto at runtime, so the loader's
  // ServiceClient type knows nothing about them. GreeterClient above is the
  // declaration of what this particular .proto produces.
  const client = new Greeter(
    `localhost:${PORT}`,
    grpc.credentials.createInsecure()
  ) as unknown as GreeterClient;
  // Callback-style stubs promisify cleanly for async/await.
  const sayHello = promisify(client.SayHello).bind(client);
  const getUser = promisify(client.GetUser).bind(client);

  console.log("\n1. SayHello:");
  const reply = await sayHello({ name: "Alex" });
  console.log(`   reply.message = ${JSON.stringify(reply.message)}`);

  console.log("\n2. GetUser (existing user):");
  const user = await getUser({ userId: 1 });
  console.log(`   id=${user.id}  name=${JSON.stringify(user.name)}  email=${JSON.stringify(user.email)}`);

  console.log("\n3. GetUser (missing user — expect NOT_FOUND):");
  try {
    await getUser({ userId: 99 });
  } catch (e) {
    console.log(`   status code:    ${grpc.status[asGrpcError(e).code]} (${asGrpcError(e).code})`);
    console.log(`   status details: ${asGrpcError(e).details}`);
  }

  console.log("\n4. SayHello with a tight deadline (expect DEADLINE_EXCEEDED):");
  try {
    // A deadline is an absolute time. 1ms from now will almost certainly expire.
    await new Promise<HelloReply>((resolve, reject) => {
      client.SayHello(
        { name: "Timeout Test" },
        { deadline: Date.now() + 1 },
        (err, res) => (err ? reject(err) : resolve(res))
      );
    });
  } catch (e) {
    console.log(`   status code:    ${grpc.status[asGrpcError(e).code]} (${asGrpcError(e).code})`);
  }

  client.close();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("CONCEPT 01 — Unary RPC");
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
