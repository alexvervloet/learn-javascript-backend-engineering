
import { fileURLToPath } from "node:url";

// Shared proto loader.
//
// There is **no codegen step**. The idiomatic 2026 approach is
// `@grpc/proto-loader`, which parses the .proto at runtime and hands back the
// service/message definitions directly. Edit the .proto, restart — no build
// script, no generated files to gitignore.
//
// (A codegen path exists too — `grpc-tools` + `ts-proto` for typed stubs — but
// dynamic loading is the simplest and most common choice for plain JS.)

import path from "node:path";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import type { GrpcObject, ServiceClientConstructor } from "@grpc/grpc-js";

// What loadProto hands back for one service.
//
// There is no per-service type here, and there cannot be: proto-loader parses
// the .proto at runtime, so the method names exist only as strings until the
// process starts. `ts-proto` is the codegen path that produces real stubs; this
// module deliberately takes the dynamic one, and this alias is where that
// trade-off is written down rather than spread across every call site.
type LoadedServices = Record<string, ServiceClientConstructor>;

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

// Options chosen to match protobuf's defaults closely:
//   keepCase: false    → snake_case proto fields become camelCase in JS (user_id → userId)
//   longs: Number      → int64 fields come back as JS numbers (fine for timestamps here)
//   defaults: true     → unset fields get their proto3 zero value
const LOAD_OPTIONS = {
  keepCase: false,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
};

function loadProto(file: string): LoadedServices {
  const packageDefinition = protoLoader.loadSync(
    path.join(here, "proto", file),
    LOAD_OPTIONS
  );
  return grpc.loadPackageDefinition(packageDefinition) as GrpcObject as LoadedServices;
}

export { loadProto };
export type { LoadedServices };
