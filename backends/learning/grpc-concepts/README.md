# gRPC Deep Dive (Node)

Remote procedure calls with Protocol Buffers and gRPC, using **@grpc/grpc-js**
(pure-JS implementation) and **@grpc/proto-loader** (runtime .proto loading).

## What is gRPC?

gRPC lets you call functions on a remote server as if they were local — no JSON,
no URL design, no status-code mapping. You define your API in a `.proto` schema
and call methods directly. Under the hood: **HTTP/2** (multiplexing, header
compression) and **Protocol Buffers** (compact, schema-validated binary).

## No codegen step

There's **no `protoc` build step** and no generated stubs to keep in sync.
`@grpc/proto-loader` parses the `.proto` at runtime (see [load.ts](load.ts)) and
hands back the service constructors and message shapes directly. Edit a `.proto`,
restart — done.

## The 4 RPC patterns

```
Unary              Client ──req──> Server ──res──> Client
Server streaming   Client ──req──> Server ──res1──res2──res3──> Client
Client streaming   Client ──req1──req2──req3──> Server ──res──> Client
Bidirectional      Client <──req1──res1──req2──res2──> Server
```

## Layout

```
grpc-concepts/
  proto/                  ← .proto schemas (edit these)
    greeter.proto         → used by 01, 05, 06
    stock.proto           → 02
    upload.proto          → 03
    chat.proto            → 04
  load.ts                 ← runtime proto loader (replaces generate_protos.sh)
  01_unary.ts … 06_interceptors.ts
```

## Setup & running

```bash
npm install        # from the repo root
npx tsx 01_unary.ts   # each file is self-contained: starts a server, runs a client, exits
```

| File | Pattern | What you'll learn |
|------|---------|-------------------|
| [01_unary.ts](01_unary.ts) | Unary | service/handlers, client stub, `callback` errors, deadlines |
| [02_server_streaming.ts](02_server_streaming.ts) | Server stream | `call.write`/`call.end`, readable stream, `cancel`, deadline |
| [03_client_streaming.ts](03_client_streaming.ts) | Client stream | writable stub, server accumulates, single response |
| [04_bidirectional_streaming.ts](04_bidirectional_streaming.ts) | Bidi stream | duplex stream, concurrent read/write, client cancel |
| [05_errors_and_metadata.ts](05_errors_and_metadata.ts) | Unary | `grpc.status`, `grpc.Metadata`, initial vs trailing metadata |
| [06_interceptors.ts](06_interceptors.ts) | Unary | server auth + logging interceptors, client token injection |

