/**
 * Concept 06 — Interceptors (Middleware)
 *
 * Interceptors are middleware that wrap every RPC on a server or client. They
 * add cross-cutting concerns — logging, auth, tracing, metrics — without
 * touching each method's business logic.
 *
 *   SERVER interceptors wrap incoming RPCs before they reach the handler:
 *     inspect/modify metadata, abort early (auth), time the call.
 *   CLIENT interceptors wrap outgoing RPCs before they leave:
 *     inject auth headers, add tracing IDs, retry.
 *
 * grpc-js shapes interceptors like this:
 *   - A client interceptor is `(options, nextCall) => new InterceptingCall(...)`
 *     with a `start(metadata, listener, next)` hook to mutate outbound metadata.
 *   - A server interceptor is `(methodDescriptor, call) => new
 *     ServerInterceptingCall(call, responders)`. The `start` responder builds a
 *     listener; `withOnReceiveMetadata` is where you read auth metadata and can
 *     short-circuit with `call.sendStatus(...)`.
 *
 * HOW TO RUN:
 *   npx tsx 06_interceptors.ts
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


const PORT = 50056;
const VALID_TOKEN = "secret-token-abc";
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

const { Greeter } = loadProto("greeter.proto");

// ---------------------------------------------------------------------------
// Server interceptor 1 — logging (method name + duration + status)
// ---------------------------------------------------------------------------

function loggingInterceptor(
  methodDescriptor: grpc.ServerMethodDefinition<unknown, unknown>,
  call: grpc.ServerInterceptingCallInterface
): grpc.ServerInterceptingCall {
  const start = process.hrtime.bigint();
  return new grpc.ServerInterceptingCall(call, {
    // The parameter types come from grpc's StatusResponder, so they are left
    // to inference rather than restated (and possibly restated wrongly).
    sendStatus(status, next) {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const label = status.code === grpc.status.OK ? "OK" : `ERR(${grpc.status[asGrpcError(status).code]})`;
      console.log(`  [log] ${methodDescriptor.path}  ${label}  ${ms.toFixed(1)}ms`);
      next(status);
    },
  });
}

// ---------------------------------------------------------------------------
// Server interceptor 2 — auth token check
// ---------------------------------------------------------------------------

function authInterceptor(
  _methodDescriptor: grpc.ServerMethodDefinition<unknown, unknown>,
  call: grpc.ServerInterceptingCallInterface
): grpc.ServerInterceptingCall {
  return new grpc.ServerInterceptingCall(call, {
    start(next) {
      const listener = new grpc.ServerListenerBuilder()
        .withOnReceiveMetadata((metadata, mdNext) => {
          // Metadata.get returns (string | Buffer)[] — a gRPC header can carry
          // binary values — so the read is converted before comparing.
          const token = String(metadata.get("authorization")[0] ?? "");
          if (token !== VALID_TOKEN) {
            console.log(`  [auth] REJECTED  token=${JSON.stringify(token)}`);
            // Short-circuit: send the status and never forward to the handler.
            call.sendStatus({
              code: grpc.status.UNAUTHENTICATED,
              details: "Invalid or missing token",
              metadata: new grpc.Metadata(),
            });
            return;
          }
          console.log(`  [auth] ACCEPTED  token=${JSON.stringify(token)}`);
          mdNext(metadata);
        })
        .build();
      next(listener);
    },
  });
}

// ---------------------------------------------------------------------------
// Client interceptor — inject the auth token on every outgoing call
// ---------------------------------------------------------------------------

function tokenInjector(
  options: grpc.InterceptorOptions,
  nextCall: grpc.NextCall
): grpc.InterceptingCall {
  return new grpc.InterceptingCall(nextCall(options), {
    start(metadata, listener, next) {
      metadata.add("authorization", VALID_TOKEN);
      next(metadata, listener);
    },
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const handlers = {
  SayHello(
    call: grpc.ServerUnaryCall<HelloRequest, HelloReply>,
    callback: grpc.sendUnaryData<HelloReply>
  ) {
    callback(null, { message: `Hello, ${call.request.name}!` });
  },
  GetUser(
    call: grpc.ServerUnaryCall<GetUserRequest, User>,
    callback: grpc.sendUnaryData<User>
  ) {
    // Keyed by an id that arrives over the wire, so Record allows the lookup
    // and forces the miss below to be handled.
    const users: Record<number, User> = { 1: { id: 1, name: "Alex", email: "alex@example.com" } };
    const user = users[call.request.userId];
    if (!user) {
      callback({ code: grpc.status.NOT_FOUND, details: `User ${call.request.userId} not found` });
      return;
    }
    callback(null, user);
  },
};

function makeServer(): grpc.Server {
  // Interceptors compose in array order: auth runs before logging.
  const server = new grpc.Server({ interceptors: [authInterceptor, loggingInterceptor] });
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
// Demo
// ---------------------------------------------------------------------------

// The stub's methods come from the .proto at runtime, so the loader's
// ServiceClient type knows nothing about them.
type UnaryCallback<T> = (err: grpc.ServiceError | null, res: T) => void;

interface GreeterClient extends grpc.Client {
  SayHello(req: HelloRequest, metadata: grpc.Metadata, cb: UnaryCallback<HelloReply>): void;
  GetUser(req: GetUserRequest, cb: UnaryCallback<User>): void;
}

function sayHello(
  client: GreeterClient,
  name: string,
  metadata = new grpc.Metadata()
): Promise<HelloReply> {
  return new Promise<HelloReply>((resolve, reject) => {
    client.SayHello({ name }, metadata, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

function getUser(client: GreeterClient, userId: number): Promise<User> {
  return new Promise<User>((resolve, reject) => {
    client.GetUser({ userId }, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

async function runClient() {
  const addr = `localhost:${PORT}`;
  const creds = grpc.credentials.createInsecure();

  console.log("\n1. Call without auth token (expect UNAUTHENTICATED):");
  // The stub's methods come from the .proto at runtime, so the loader's
  // ServiceClient type knows nothing about them.
  const plain = new Greeter(addr, creds) as unknown as GreeterClient;
  try {
    await sayHello(plain, "Alex");
  } catch (e) {
    console.log(`   ${grpc.status[asGrpcError(e).code]}: ${asGrpcError(e).details}`);
  }

  console.log("\n2. Call with wrong token (expect UNAUTHENTICATED):");
  try {
    const md = new grpc.Metadata();
    md.set("authorization", "wrong-token");
    await sayHello(plain, "Alex", md);
  } catch (e) {
    console.log(`   ${grpc.status[asGrpcError(e).code]}: ${asGrpcError(e).details}`);
  }

  console.log("\n3. Call with correct token (manually):");
  const md = new grpc.Metadata();
  md.set("authorization", VALID_TOKEN);
  console.log(`   ${JSON.stringify((await sayHello(plain, "Alex", md)).message)}`);
  plain.close();

  console.log("\n4. Using a client interceptor — token injected automatically:");
  const authed = new Greeter(addr, creds, {
    interceptors: [tokenInjector],
  }) as unknown as GreeterClient;
  console.log(`   ${JSON.stringify((await sayHello(authed, "Dana")).message)}`);
  const user = await getUser(authed, 1);
  console.log(`   GetUser → id=${user.id}  name=${JSON.stringify(user.name)}`);
  authed.close();
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("CONCEPT 06 — Interceptors");
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
