// NOTE: this file stays CommonJS JavaScript on purpose, and is the only
// place in the repo that does.
//
// It is not repo source — 01_deploy.ts zips it and uploads it to Lambda,
// where it runs under the nodejs22.x runtime. That runtime executes
// JavaScript, and the function's configured Handler is "handler.handler",
// which means a file literally named handler.js inside the zip. Converting
// it to TypeScript would need a bundling step before upload, which is a
// different lesson than the one this module is teaching.
// Triggered by S3 ObjectCreated events. The event carries one Record per object.
exports.handler = async (event) => {
  for (const record of event.Records ?? []) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const size = record.s3.object.size ?? "unknown";
    console.log(`[s3_processor] New object: s3://${bucket}/${key}  (${size} bytes)`);
  }
  return { processed: (event.Records ?? []).length };
};
