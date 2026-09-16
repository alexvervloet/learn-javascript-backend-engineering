/**
 * Concept 05 — Error Handling & Metadata
 *
 * ERRORS
 * ------
 * gRPC has its own status codes (grpc.status.*), separate from HTTP:
 *   OK, NOT_FOUND, INVALID_ARGUMENT, UNAUTHENTICATED, PERMISSION_DENIED,
 *   ALREADY_EXISTS, RESOURCE_EXHAUSTED, UNAVAILABLE, DEADLINE_EXCEEDED,
 *   INTERNAL, UNIMPLEMENTED.
 *
 *   Server returns an error: callback({ code: grpc.status.NOT_FOUND, details })
 *   Client catches it:        err.code (number), err.details (string)
 *
 * METADATA
 * --------
 * Metadata is key/value pairs sent alongside an RPC — gRPC's "headers". Used for
 * auth tokens, request IDs, tracing. Keys are lowercase ASCII; binary values use
 * a "-bin" suffix.
 *
 *   Client → Server:  pass a grpc.Metadata as the 2nd stub arg
 *   Server reads:     call.metadata.get("x-request-id")
 *   Server → Client:  call.sendMetadata(md)        (initial, before the body)
 *                     callback(null, reply, md)     (trailing, after the body)
 *   Client reads:     "metadata" event (initial), "status" event (trailing)
 *
 * HOW TO RUN:
 *   npx tsx 05_errors_and_metadata.ts
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


const PORT = 50055;
const { Greeter } = loadProto("greeter.proto");

// The message shapes from greeter.proto. proto-loader parses the .proto at
// runtime, so these are a claim about it rather than generated from it.
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

// Keyed by an id that arrives over the wire, so Record is what allows the
// lookup and forces the miss to be handled.
const KNOWN_USERS: Record<number, User> = {
  1: { id: 1, name: "Alex", email: "alex@example.com" },
  2: { id: 2, name: "Dana", email: "dana@example.com" },
};

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const handlers = {
  SayHello(
    call: grpc.ServerUnaryCall<HelloRequest, HelloReply>,
    callback: grpc.sendUnaryData<HelloReply>
  ) {
    // Metadata.get returns (string | Buffer)[] — a gRPC header can carry binary
    // values — so each read is converted before use.
    const requestId = String(call.metadata.get("x-request-id")[0] ?? "unknown");
    const lang = String(call.metadata.get("accept-language")[0] ?? "en");
    console.log(`  [server] SayHello  request-id=${requestId}  lang=${lang}`);

    if (!call.request.name) {
      callback({ code: grpc.status.INVALID_ARGUMENT, details: "name must not be empty" });
      return;
    }

    const greetings: Record<string, string> = { en: "Hello", es: "Hola", fr: "Bonjour" };
    const greeting = greetings[lang] || "Hello";

    // Initial metadata is flushed to the client before the response body.
    const initial = new grpc.Metadata();
    initial.set("x-served-by", "greeter-server-1");
    initial.set("x-request-id", requestId); // echo it back
    call.sendMetadata(initial);

    // Trailing metadata rides along with the final status (like HTTP trailers).
    const trailing = new grpc.Metadata();
    trailing.set("x-processing-ms", "12");
    callback(null, { message: `${greeting}, ${call.request.name}!` }, trailing);
  },

  GetUser(
    call: grpc.ServerUnaryCall<GetUserRequest, User>,
    callback: grpc.sendUnaryData<User>
  ) {
    const userId = call.request.userId;
    if (userId <= 0) {
      callback({ code: grpc.status.INVALID_ARGUMENT, details: `user_id must be positive, got ${userId}` });
      return;
    }
    const user = KNOWN_USERS[userId];
    if (!user) {
      callback({ code: grpc.status.NOT_FOUND, details: `user ${userId} does not exist` });
      return;
    }
    callback(null, user);
  },
};

function makeServer(): grpc.Server {
  const server = new grpc.Server();
  server.addService(Greeter.service, handlers);
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
// Client helpers
// ---------------------------------------------------------------------------

// The stub's methods come from the .proto at runtime and are reached by name
// here, so the client is indexed as a map of call functions. That is the shape
// a dynamic loader really produces.
type UnaryCall = (
  request: unknown,
  metadata: grpc.Metadata,
  options: grpc.CallOptions,
  cb: (err: grpc.ServiceError | null, response: never) => void
) => grpc.ClientUnaryCall;

type DynamicClient = grpc.Client & Record<string, UnaryCall>;

interface CallOutcome<T> {
  response: T;
  initialMetadata?: grpc.Metadata;
  call: grpc.ClientUnaryCall;
}

// Call a unary method capturing the response plus both metadata channels.
function callWithMetadata<T>(
  client: DynamicClient,
  method: string,
  request: unknown,
  metadata: grpc.Metadata,
  options: grpc.CallOptions = {}
): Promise<CallOutcome<T>> {
  return new Promise<CallOutcome<T>>((resolve, reject) => {
    // Assigned by the "metadata" listener below, so the annotation is explicit.
    let initialMetadata: grpc.Metadata | undefined;
    const fn = client[method];
    if (!fn) {
      reject(new Error(`No such method: ${method}`));
      return;
    }
    // .call(client, ...) matters: a gRPC stub method reads `this` internally,
    // so invoking the extracted function directly would lose the receiver.
    const call = fn.call(client, request, metadata, options, (err, response) =>
      err ? reject(err) : resolve({ response: response as T, initialMetadata, call })
    );
    call.on("metadata", (md: grpc.Metadata) => {
      initialMetadata = md;
    });
  });
}

function printRpcError(e: unknown): void {
  console.log(`   RpcError  code=${grpc.status[asGrpcError(e).code]}  details=${JSON.stringify(asGrpcError(e).details)}`);
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

async function runClient(): Promise<void> {
  const client = new Greeter(
    `localhost:${PORT}`,
    grpc.credentials.createInsecure()
  ) as unknown as DynamicClient;

  console.log("\n1. SayHello with client metadata (request-id, language):");
  const md = new grpc.Metadata();
  md.set("x-request-id", "abc-123");
  md.set("accept-language", "es"); // server will greet in Spanish
  const { response, initialMetadata } = await callWithMetadata<HelloReply>(
    client,
    "SayHello",
    { name: "Alex" },
    md
  );
  console.log(`   reply: ${JSON.stringify(response.message)}`);
  console.log(`   initial metadata:  x-served-by=${initialMetadata?.get("x-served-by")[0]}`);

  console.log("\n2. SayHello with empty name (expect INVALID_ARGUMENT):");
  try {
    await callWithMetadata(client, "SayHello", { name: "" }, new grpc.Metadata());
  } catch (e) {
    printRpcError(e);
  }

  console.log("\n3. GetUser for missing ID (expect NOT_FOUND):");
  try {
    await callWithMetadata(client, "GetUser", { userId: 99 }, new grpc.Metadata());
  } catch (e) {
    printRpcError(e);
  }

  console.log("\n4. GetUser with invalid ID (expect INVALID_ARGUMENT):");
  try {
    await callWithMetadata(client, "GetUser", { userId: -5 }, new grpc.Metadata());
  } catch (e) {
    printRpcError(e);
  }

  console.log("\n5. SayHello with impossibly tight deadline (expect DEADLINE_EXCEEDED):");
  try {
    await callWithMetadata(client, "SayHello", { name: "Timeout" }, new grpc.Metadata(), {
      deadline: Date.now() + 1,
    });
  } catch (e) {
    printRpcError(e);
  }

  console.log("\n6. GetUser (valid) after all the errors above:");
  const { response: user } = await callWithMetadata<User>(
    client,
    "GetUser",
    { userId: 1 },
    new grpc.Metadata()
  );
  console.log(`   id=${user.id}  name=${JSON.stringify(user.name)}`);

  client.close();
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("CONCEPT 05 — Error Handling & Metadata");
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
