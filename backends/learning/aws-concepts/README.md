# AWS Core Services with LocalStack (Node)

Practice the core AWS services locally — no AWS account or billing — using the
**AWS SDK for JavaScript v3** against [LocalStack](https://localstack.cloud),
which emulates the AWS APIs on `http://localhost:4566`.

## Services covered

| Service | What it is |
|---------|-----------|
| S3 | Object storage — files, blobs, static assets |
| DynamoDB | NoSQL key-value + document database |
| SQS | Message queue — decouple services, buffer workloads |
| SNS | Pub/sub — broadcast messages to multiple consumers |
| Lambda | Serverless compute — run code in response to events |

## SDK v3 style

The v3 SDK is modular and command-based:

```js
const { S3Client, CreateBucketCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({ endpoint, region, credentials, forcePathStyle: true });
await s3.send(new CreateBucketCommand({ Bucket: "my-bucket" }));
```

Shared client config lives in [helpers.ts](helpers.ts). The AWS SDK v3 is
command-oriented: you import each operation as a `Command` and `send` it, so
only the calls you actually use get bundled.

## Setup

```bash
# 1. Start LocalStack
docker compose up -d

# 2. Install dependencies (from the repo root)
npm install
```

## Running scripts

Each script is self-contained — it sets up what it needs, demonstrates the
concept, and cleans up. Run from the `aws-concepts/` directory:

```bash
npx tsx s3/01_buckets.ts
npx tsx dynamodb/02_crud.ts
npx tsx lambda/02_invoke.ts
# etc.
```

These are runnable demos, not Jest tests — they need LocalStack running and
aren't part of `npm test`.

## What the folders cover

| Folder | Files |
|--------|-------|
| `s3/` | Buckets, objects (upload/download/copy), presigned URLs |
| `dynamodb/` | Tables, CRUD (raw client), queries (Document client) |
| `sqs/` | Queues, messages + visibility timeout, dead letter queues |
| `sns/` | Topics, publish, fan-out (SNS → multiple SQS queues) |
| `lambda/` | Deploy a function, invoke it, trigger from S3 events |

## Community vs Pro

The free Community tier covers everything here. Notable limits: IAM is a no-op
(permissions aren't enforced); RDS/ECS/EKS/ElastiCache are Pro-only; Lambda needs
the Docker socket (already mounted in the compose file).
