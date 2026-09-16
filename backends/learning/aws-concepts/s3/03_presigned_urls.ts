import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";
// In SDK v3 presigning lives in dedicated packages, not on the client itself.
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { s3Config } from "../helpers.js";

const s3 = new S3Client(s3Config);
const BUCKET = "presigned-demo";

async function main() {
  await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: "report.pdf", Body: Buffer.from("(fake PDF content)") }));

  // --- GET presigned URL ---
  // Anyone with this URL can download the object until it expires — no AWS creds
  // needed. Use case: a temporary download link for an invoice/export.
  console.log("=== Presigned GET URL ===");
  const getUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: "report.pdf" }), { expiresIn: 3600 });
  console.log(`Download URL (1hr expiry):\n  ${getUrl}\n`);
  console.log("Test it:  curl '<url>' -o report.pdf");

  // --- PUT presigned URL ---
  // The server mints this URL; the client uploads straight to S3, so the file
  // never touches your server. Use case: browser avatar/CSV/large-file uploads.
  console.log("\n=== Presigned PUT URL ===");
  const putUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: "user-upload.jpg", ContentType: "image/jpeg" }),
    { expiresIn: 300 }
  );
  console.log(`Upload URL (5min expiry):\n  ${putUrl}\n`);
  console.log("Test it:  curl -X PUT -H 'Content-Type: image/jpeg' --data-binary @photo.jpg '<url>'");

  // --- POST presigned (browser form upload) ---
  // PUT URLs require setting headers, which HTML forms can't do. createPresignedPost
  // returns a url + fields you drop into the <form>. Conditions enforce file-size
  // and content-type limits on the S3 side.
  console.log("\n=== Presigned POST (HTML form upload) ===");
  const post = await createPresignedPost(s3, {
    Bucket: BUCKET,
    Key: "avatars/${filename}",
    Fields: { "Content-Type": "image/png" },
    Conditions: [{ "Content-Type": "image/png" }, ["content-length-range", 1, 5_000_000]],
    Expires: 600,
  });
  console.log(`POST to:     ${post.url}`);
  console.log(`Form fields: ${JSON.stringify(Object.keys(post.fields))}`);
  console.log("\nIn the form, include every fields[] entry as a hidden input, then the file last.");

  // --- Cleanup ---
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: "report.pdf" }));
  await s3.send(new DeleteBucketCommand({ Bucket: BUCKET }));
  console.log("\nCleaned up.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
