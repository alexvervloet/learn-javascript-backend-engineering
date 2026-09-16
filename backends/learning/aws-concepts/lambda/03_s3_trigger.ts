
import { fileURLToPath } from "node:url";

import path from "node:path";
import { LambdaClient, CreateFunctionCommand, AddPermissionCommand, DeleteFunctionCommand } from "@aws-sdk/client-lambda";
import {
  S3Client,
  CreateBucketCommand,
  PutBucketNotificationConfigurationCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";
import { config, s3Config } from "../helpers.js";
import { zipFile } from "./zip.js";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

const lambda = new LambdaClient(config);
const s3 = new S3Client(s3Config);
const ROLE = "arn:aws:iam::000000000000:role/lambda-role";
const BUCKET = "uploads-trigger-demo";
const FN = "s3-processor";
const handlerPath = path.join(here, "functions", "s3-processor", "handler.js");
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  // --- Deploy the function ---
  console.log("=== Deploying s3-processor Lambda ===");
  const fn = await lambda.send(
    new CreateFunctionCommand({
      FunctionName: FN,
      Runtime: "nodejs20.x",
      Role: ROLE,
      Handler: "handler.handler",
      Code: { ZipFile: zipFile(handlerPath) },
      Timeout: 15,
    })
  );
  console.log(`Function ARN: ${fn.FunctionArn}`);

  // --- Create S3 bucket ---
  await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  console.log(`Bucket '${BUCKET}' created`);

  // --- Grant S3 permission to invoke the Lambda ---
  // Without this, S3 can't call the function — even in LocalStack.
  await lambda.send(
    new AddPermissionCommand({
      FunctionName: FN,
      StatementId: "allow-s3-invoke",
      Action: "lambda:InvokeFunction",
      Principal: "s3.amazonaws.com",
      SourceArn: `arn:aws:s3:::${BUCKET}`,
    })
  );
  console.log("Permission granted: S3 can invoke the function");

  // --- Set up the S3 event notification ---
  // Trigger on any ObjectCreated event; the suffix filter targets .csv files.
  await s3.send(
    new PutBucketNotificationConfigurationCommand({
      Bucket: BUCKET,
      NotificationConfiguration: {
        LambdaFunctionConfigurations: [
          {
            LambdaFunctionArn: fn.FunctionArn,
            Events: ["s3:ObjectCreated:*"],
            Filter: { Key: { FilterRules: [{ Name: "suffix", Value: ".csv" }] } },
          },
        ],
      },
    })
  );
  console.log("S3 notification configured: .csv uploads → Lambda");

  // --- Upload files to trigger the function ---
  console.log("\n=== Uploading files ===");
  await sleep(2000); // give LocalStack a moment to wire the trigger

  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: "data/users.csv", Body: "id,name\n1,Alice" }));
  console.log("  Uploaded data/users.csv  ← should trigger Lambda");
  await sleep(1000);

  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: "images/photo.jpg", Body: Buffer.from("(fake image)") }));
  console.log("  Uploaded images/photo.jpg ← should NOT trigger (not .csv)");
  await sleep(1000);

  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: "reports/q4.csv", Body: "month,revenue\nQ4,90000" }));
  console.log("  Uploaded reports/q4.csv  ← should trigger Lambda");

  console.log("\nCheck LocalStack container logs to see Lambda output:");
  console.log("  docker logs $(docker ps -q --filter 'name=localstack') 2>&1 | grep s3_processor");

  // --- Cleanup ---
  await sleep(2000);
  const { Contents = [] } = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET }));
  for (const obj of Contents) await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
  await s3.send(new DeleteBucketCommand({ Bucket: BUCKET }));
  await lambda.send(new DeleteFunctionCommand({ FunctionName: FN }));
  console.log("\nCleaned up.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
