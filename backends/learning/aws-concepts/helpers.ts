// Shared AWS SDK v3 client config pointed at LocalStack.
//
// AWS SDK v3 uses modular per-service packages (@aws-sdk/client-*) and a command
// pattern — `client.send(new XCommand({...}))`. Every client takes the same
// shape of config, so we centralise it here.
//
//   - endpoint:    point every call at LocalStack instead of real AWS
//   - credentials: LocalStack accepts any non-empty creds
//   - region:      required by the SDK even though LocalStack ignores it

const ENDPOINT = process.env.AWS_ENDPOINT_URL || "http://localhost:4566";
const REGION = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" };

// Common config for any service client.
const config = { endpoint: ENDPOINT, region: REGION, credentials };

// S3 needs path-style addressing against LocalStack (bucket in the path, not the
// hostname) so requests resolve to localhost:4566 rather than a virtual host.
const s3Config = { ...config, forcePathStyle: true };

export { ENDPOINT, REGION, credentials, config, s3Config };
