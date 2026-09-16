# S3 — Simple Storage Service

S3 is object storage. You store arbitrary files (objects) inside named containers
(buckets). There is no filesystem hierarchy — keys like `data/users/123.json`
look like paths but S3 treats them as flat strings.

## Key concepts

- **Bucket** — a globally unique named container, one per environment/app/purpose.
- **Object** — any file + metadata, addressed by a key. Max size 5 TB.
- **Key** — the object's "path" within a bucket, e.g. `uploads/2024/photo.jpg`.
- **Presigned URL** — a time-limited URL granting temporary access to one object
  without AWS credentials. Used for secure browser/third-party uploads and downloads.

## What the files cover

| File | What it teaches |
|------|----------------|
| `01_buckets.ts` | Create, list, tag, version, and delete buckets |
| `02_objects.ts` | Upload, list (with prefix), download, copy, delete objects |
| `03_presigned_urls.ts` | Generate GET, PUT, and POST presigned URLs (s3-request-presigner / s3-presigned-post) |

## How to run

```bash
# From aws-concepts/
docker compose up -d

npx tsx s3/01_buckets.ts
npx tsx s3/02_objects.ts
npx tsx s3/03_presigned_urls.ts
```
