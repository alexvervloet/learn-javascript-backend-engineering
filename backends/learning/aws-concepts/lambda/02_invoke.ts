
import { fileURLToPath } from "node:url";

import path from "node:path";
import {
  LambdaClient,
  CreateFunctionCommand,
  InvokeCommand,
  UpdateFunctionCodeCommand,
  DeleteFunctionCommand,
} from "@aws-sdk/client-lambda";
import { config } from "../helpers.js";
import { zipFile, zipCode } from "./zip.js";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

const lambda = new LambdaClient(config);
const ROLE = "arn:aws:iam::000000000000:role/lambda-role";
const handlerPath = path.join(here, "functions", "hello", "handler.js");
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// The SDK returns Payload as a byte array; decode + JSON.parse it.
// Lambda returns Payload as a byte array. What is inside is whatever the
// function returned, so the decoded value is unknown until a caller says.
// Payload is optional on the response — an invoke can fail before the
// function produced one — so the parameter admits that.
const decode = (payload: Uint8Array | undefined): unknown =>
  payload === undefined ? null : JSON.parse(Buffer.from(payload).toString("utf8"));

async function main(): Promise<void> {
  await lambda.send(
    new CreateFunctionCommand({
      FunctionName: "hello",
      Runtime: "nodejs20.x",
      Role: ROLE,
      Handler: "handler.handler",
      Code: { ZipFile: zipFile(handlerPath) },
      Timeout: 10,
    })
  );

  // LocalStack may take a moment to spin up the container for the first invoke.
  await sleep(2000);

  // --- Synchronous invocation (RequestResponse) ---
  // The caller waits for the result. Use for API responses / real-time work.
  console.log("=== Synchronous invocation ===");
  const sync = await lambda.send(
    new InvokeCommand({ FunctionName: "hello", InvocationType: "RequestResponse", Payload: JSON.stringify({ name: "Alex" }) })
  );
  console.log(`  HTTP status:    ${sync.StatusCode}`); // 200 = invocation ok (not your function's statusCode)
  console.log(`  Function error: ${sync.FunctionError ?? "none"}`);
  console.log(`  Response body:  ${JSON.stringify(decode(sync.Payload))}`);

  // --- Invoke with no payload ---
  console.log("\n=== Invoke with no input ===");
  const empty = await lambda.send(new InvokeCommand({ FunctionName: "hello", InvocationType: "RequestResponse", Payload: "{}" }));
  console.log(`  ${JSON.stringify(decode(empty.Payload))}`);

  // --- Asynchronous invocation (Event) ---
  // Lambda queues the event and returns immediately — no result. Fire-and-forget.
  console.log("\n=== Asynchronous invocation ===");
  const async = await lambda.send(
    new InvokeCommand({ FunctionName: "hello", InvocationType: "Event", Payload: JSON.stringify({ name: "async-caller" }) })
  );
  console.log(`  HTTP status: ${async.StatusCode}`); // 202 Accepted — queued, not yet run
  console.log("  Fire-and-forget: no payload returned");

  // --- Simulated error: the function throws ---
  console.log("\n=== Function error handling ===");
  const errorCode = `exports.handler = async (event) => {
  if (event.crash) throw new Error("Something went wrong!");
  return { ok: true };
};`;
  await lambda.send(new UpdateFunctionCodeCommand({ FunctionName: "hello", ZipFile: zipCode(errorCode) }));
  await sleep(1000);

  const errored = await lambda.send(
    new InvokeCommand({ FunctionName: "hello", InvocationType: "RequestResponse", Payload: JSON.stringify({ crash: true }) })
  );
  // StatusCode is still 200 — the invocation succeeded; the function error is in FunctionError.
  console.log(`  StatusCode:     ${errored.StatusCode}`);
  console.log(`  FunctionError:  ${errored.FunctionError}`);
  console.log(`  Error payload:  ${JSON.stringify(decode(errored.Payload))}`);

  // --- Cleanup ---
  await lambda.send(new DeleteFunctionCommand({ FunctionName: "hello" }));
  console.log("\nCleaned up.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
