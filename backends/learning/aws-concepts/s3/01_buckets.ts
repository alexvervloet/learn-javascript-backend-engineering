import {
  S3Client,
  CreateBucketCommand,
  ListBucketsCommand,
  PutBucketTaggingCommand,
  GetBucketTaggingCommand,
  PutBucketVersioningCommand,
  GetBucketVersioningCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";
import { s3Config } from "../helpers.js";

const s3 = new S3Client(s3Config);

async function main() {
  // --- Create ---
  console.log("=== Creating buckets ===");
  await s3.send(new CreateBucketCommand({ Bucket: "my-app-uploads" }));
  await s3.send(new CreateBucketCommand({ Bucket: "my-app-backups" }));
  console.log("Created: my-app-uploads, my-app-backups");

  // --- List ---
  console.log("\n=== Listing buckets ===");
  const { Buckets = [] } = await s3.send(new ListBucketsCommand({}));
  for (const b of Buckets) {
    console.log(`  ${b.Name}  (created: ${b.CreationDate?.toISOString().slice(0, 10)})`);
  }

  // --- Tag ---
  console.log("\n=== Tagging a bucket ===");
  await s3.send(
    new PutBucketTaggingCommand({
      Bucket: "my-app-uploads",
      Tagging: { TagSet: [{ Key: "env", Value: "dev" }, { Key: "team", Value: "backend" }] },
    })
  );
  const { TagSet } = await s3.send(new GetBucketTaggingCommand({ Bucket: "my-app-uploads" }));
  console.log(`Tags on my-app-uploads: ${JSON.stringify(TagSet)}`);

  // --- Versioning ---
  // With versioning on, deleting an object adds a delete marker instead of
  // removing it — key for audit trails and recovering from accidental deletes.
  console.log("\n=== Enabling versioning ===");
  await s3.send(
    new PutBucketVersioningCommand({
      Bucket: "my-app-uploads",
      VersioningConfiguration: { Status: "Enabled" },
    })
  );
  const versioning = await s3.send(new GetBucketVersioningCommand({ Bucket: "my-app-uploads" }));
  console.log(`Versioning on my-app-uploads: ${versioning.Status || "Disabled"}`);

  // --- Delete ---
  // Buckets must be empty before deletion (with versioning you'd also delete versions).
  console.log("\n=== Deleting buckets ===");
  await s3.send(new DeleteBucketCommand({ Bucket: "my-app-uploads" }));
  await s3.send(new DeleteBucketCommand({ Bucket: "my-app-backups" }));
  console.log("Deleted both buckets");

  const { Buckets: remaining = [] } = await s3.send(new ListBucketsCommand({}));
  console.log(`Remaining buckets: ${JSON.stringify(remaining.map((b) => b.Name))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
