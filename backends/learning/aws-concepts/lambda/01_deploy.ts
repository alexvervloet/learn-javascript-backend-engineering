
import { fileURLToPath } from "node:url";

import path from "node:path";
import {
  LambdaClient,
  CreateFunctionCommand,
  ListFunctionsCommand,
  GetFunctionConfigurationCommand,
  UpdateFunctionCodeCommand,
  DeleteFunctionCommand,
  waitUntilFunctionActiveV2,
} from "@aws-sdk/client-lambda";
import { config } from "../helpers.js";
import { zipFile, zipCode } from "./zip.js";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

const lambda = new LambdaClient(config);
const ROLE = "arn:aws:iam::000000000000:role/lambda-role"; // LocalStack ignores IAM; any ARN works
const handlerPath = path.join(here, "functions", "hello", "handler.js");

async function main(): Promise<void> {
  // --- Create function ---
  console.log("=== Creating Lambda function ===");
  await lambda.send(
    new CreateFunctionCommand({
      FunctionName: "hello",
      Runtime: "nodejs22.x",
      Role: ROLE,
      Handler: "handler.handler", // file "handler.js", exported `handler`
      Code: { ZipFile: zipFile(handlerPath) },
      Timeout: 10,
      MemorySize: 128,
      Description: "Greets a user by name",
    })
  );
  console.log("Function 'hello' created");

  // CreateFunction returns as soon as the request is accepted, not when the
  // function can serve traffic. Until its State reaches "Active" the function
  // rejects invokes and code updates with a 409. The SDK ships waiters for
  // exactly this — they poll GetFunctionConfiguration on a backoff so you don't
  // hand-roll a sleep that is either too short or wastes time.
  //
  // Skipping this is the classic first Lambda deploy script bug: it passes on a
  // fast day and fails in CI, because the race is with AWS's provisioning, not
  // with your code.
  await waitUntilFunctionActiveV2({ client: lambda, maxWaitTime: 60 }, { FunctionName: "hello" });
  console.log("Function is Active");

  // --- List functions ---
  console.log("\n=== Listing functions ===");
  const { Functions = [] } = await lambda.send(new ListFunctionsCommand({}));
  for (const fn of Functions) {
    console.log(`  ${fn.FunctionName}  runtime=${fn.Runtime}  memory=${fn.MemorySize}MB`);
  }

  // --- Get function config ---
  console.log("\n=== Function configuration ===");
  const cfg = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: "hello" }));
  console.log(`  Handler:       ${cfg.Handler}`);
  console.log(`  Timeout:       ${cfg.Timeout}s`);
  console.log(`  Last modified: ${cfg.LastModified}`);

  // --- Update function code (re-deploy) ---
  console.log("\n=== Updating function code ===");
  const newCode = `exports.handler = async (event) => {
  const name = event.name ?? "world";
  const version = event.version ?? 2;
  return { statusCode: 200, body: JSON.stringify({ message: \`Hello v\${version}, \${name}!\` }) };
};`;
  await lambda.send(new UpdateFunctionCodeCommand({ FunctionName: "hello", ZipFile: zipCode(newCode) }));
  console.log("Code updated");

  // --- Delete ---
  console.log("\n=== Deleting function ===");
  await lambda.send(new DeleteFunctionCommand({ FunctionName: "hello" }));
  const { Functions: remaining = [] } = await lambda.send(new ListFunctionsCommand({}));
  console.log(`Remaining functions: ${JSON.stringify(remaining.map((f) => f.FunctionName))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
