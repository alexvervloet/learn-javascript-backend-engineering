import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";
import { s3Config } from "../helpers.js";

const s3 = new S3Client(s3Config);
const BUCKET = "objects-demo";

async function main() {
  await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));

  // --- Upload ---
  console.log("=== Uploading objects ===");
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: "config/settings.json", Body: JSON.stringify({ version: 1, debug: true }) }));
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: "data/users.csv", Body: "id,name\n1,Alice\n2,Bob" }));
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: "data/orders.csv", Body: "id,user_id,total\n1,1,99.99" }));
  console.log("Uploaded: config/settings.json, data/users.csv, data/orders.csv");

  // --- List all ---
  console.log("\n=== Listing all objects ===");
  const all = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET }));
  for (const obj of all.Contents ?? []) console.log(`  ${obj.Key}  (${obj.Size} bytes)`);

  // --- List with prefix (acts like a folder filter) ---
  console.log("\n=== Listing with prefix 'data/' ===");
  const dataOnly = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "data/" }));
  for (const obj of dataOnly.Contents ?? []) console.log(`  ${obj.Key}`);

  // --- Download ---
  console.log("\n=== Downloading an object ===");
  const got = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: "config/settings.json" }));
  // The body is a stream; transformToString() is the SDK v3 convenience helper.
  console.log(`config/settings.json: ${await got.Body?.transformToString()}`);

  // --- Object metadata ---
  console.log("\n=== Object metadata (head) ===");
  const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: "data/users.csv" }));
  console.log(`  Content-Length: ${head.ContentLength}`);
  console.log(`  Last-Modified:  ${head.LastModified?.toISOString()}`);
  console.log(`  ETag:           ${head.ETag}`);

  // --- Copy ---
  console.log("\n=== Copying an object ===");
  await s3.send(new CopyObjectCommand({ Bucket: BUCKET, CopySource: `${BUCKET}/data/users.csv`, Key: "backup/users.csv" }));
  console.log("Copied data/users.csv → backup/users.csv");

  // --- Delete single ---
  console.log("\n=== Deleting a single object ===");
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: "data/orders.csv" }));
  console.log("Deleted data/orders.csv");

  // --- Bulk delete ---
  console.log("\n=== Bulk delete ===");
  const remaining = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET }));
  const keys = (remaining.Contents ?? []).map((obj) => ({ Key: obj.Key }));
  await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys } }));
  console.log(`Bulk deleted ${keys.length} objects`);

  // --- Cleanup ---
  await s3.send(new DeleteBucketCommand({ Bucket: BUCKET }));
  console.log(`\nCleaned up bucket '${BUCKET}'`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
